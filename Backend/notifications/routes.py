from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId
import traceback
from database import connect_to_mongodb

# Create Blueprint
notifications_bp = Blueprint("notifications", __name__)

DATABASE_NAME = "smart_app_db"

# Per‑course collections (must match Backend/database.py)
COURSE_COLLECTIONS = {
    "computerScience": "computerScience",
    "chemistry": "Chemistery",
    "physics": "Physics",
}


def get_students_collection_for_course(db, course: str):
    """
    Helper to resolve a logical course key into the correct MongoDB collection.
    The `course` value should be one of: computerScience, chemistry, physics.
    """
    if db is None:
        return None
    coll_name = COURSE_COLLECTIONS.get(course)
    if not coll_name:
        raise ValueError(f"Unknown course: {course}")
    return db[coll_name]


# Email Configuration for SMTP
EMAIL_CONFIG = {
    'admin_email': 'smarteducationalcompanion@gmail.com',
    # Gmail App Password (generated in Google Account security settings)
    'admin_password': 'swzpinbqjrgaochz',
    'smtp_server': 'smtp.gmail.com',
    'smtp_port': 587
}

def _get_db_or_response():
    db = connect_to_mongodb()
    if db is None:
        return None, (jsonify({"error": "MongoDB connection not available"}), 500)
    return db, None

# Notification limits
NOTIFICATION_LIMIT = 6  # Max notifications per student
ADMIN_NOTIFICATION_HISTORY_LIMIT = 10  # Max notification history per admin

def send_email(recipients, subject, message, email_type="notification"):
    """
    Send email to recipients using SMTP
    For notifications, sends a brief alert without full content
    """
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['admin_email']
        msg['To'] = ', '.join(recipients) if isinstance(recipients, list) else recipients
        
        if email_type == "notification":
            # For notifications, just alert them without showing full content
            msg['Subject'] = "New Notification from Your Instructor"
            email_body = """
Hello,

Your instructor has sent you a new notification.

Please log in to your student account to view the notification details.

Best regards,
Smart Educational System
            """
            msg.attach(MIMEText(email_body.strip(), 'plain'))
        else:
            # For other email types, use the provided subject and message
            msg['Subject'] = subject
            msg.attach(MIMEText(message, 'plain'))
        
        # Connect to SMTP server and send email
        with smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port']) as server:
            server.starttls()
            server.login(EMAIL_CONFIG['admin_email'], EMAIL_CONFIG['admin_password'])
            server.send_message(msg)
            
        print(f"📧 Email sent successfully to: {msg['To']}")
        return True
        
    except Exception as e:
        print(f"❌ Error in send_email: {e}")
        traceback.print_exc()
        return False

def add_notification_to_admin_history(admin_collection, admin_email, notification_data):
    """
    Add notification to admin's history in MongoDB
    Automatically removes oldest if limit (10) is reached
    
    Args:
        admin_collection: MongoDB admin collection
        admin_email: Admin's email address
        notification_data: Dict with notification details
    """
    try:
        if admin_collection is None:
            return False, "MongoDB admin collection not available"
        
        # Find the admin
        admin = admin_collection.find_one({"email": admin_email})
        if not admin:
            return False, f"Admin with email {admin_email} not found"
        
        # Create notification history entry
        history_entry = {
            'message': notification_data.get('message', ''),
            'recipient_type': notification_data.get('recipient_type', 'unknown'),
            'recipients': notification_data.get('recipients', []),
            'date': datetime.now().isoformat(),
            'timestamp': datetime.now()
        }
        
        # Get current notification history or initialize empty list
        notification_history = admin.get('notification_history', [])
        
        # Add new entry
        notification_history.append(history_entry)
        
        # If limit exceeded, keep only newest 10
        if len(notification_history) > ADMIN_NOTIFICATION_HISTORY_LIMIT:
            notification_history.sort(key=lambda x: x.get('timestamp', datetime.min))
            notification_history = notification_history[-ADMIN_NOTIFICATION_HISTORY_LIMIT:]
        
        # Update admin document
        result = admin_collection.update_one(
            {"email": admin_email},
            {'$set': {'notification_history': notification_history}}
        )
        
        if result.modified_count > 0 or result.matched_count > 0:
            print(f"✅ Added notification to admin history for {admin_email}")
            return True, "Notification added to admin history"
        else:
            return False, "Failed to update admin document"
            
    except Exception as e:
        print(f"❌ Error adding notification to admin history: {e}")
        traceback.print_exc()
        return False, str(e)

def get_socketio():
    """Get SocketIO instance from Flask app"""
    from flask import current_app
    return current_app.config.get('socketio')

def find_student_by_id(students_collection, student_id):
    """
    Find a student by ID, supporting both ObjectId and custom string IDs
    Returns the student document or None if not found
    """
    if students_collection is None:
        return None
    # First, try to find by ObjectId (for standard MongoDB _id)
    try:
        student = students_collection.find_one({'_id': ObjectId(student_id)})
        if student:
            return student
    except:
        pass  # Not a valid ObjectId, continue to try other methods
    
    # Try to find by _id as string (for custom IDs like "Class09002")
    student = students_collection.find_one({'_id': student_id})
    if student:
        return student
    
    # Try common custom ID field names
    for field_name in ['student_id', 'studentId', 'id', 'studentID']:
        student = students_collection.find_one({field_name: student_id})
        if student:
            return student
    
    return None

def get_student_query(students_collection, student_id):
    """
    Get the query to find/update a student by ID
    Returns a dict that can be used in find_one/update_one
    Uses find_student_by_id to determine which field to use
    """
    if students_collection is None:
        return {"_id": student_id}  # Default fallback
    
    # First, try ObjectId
    try:
        test_query = {'_id': ObjectId(student_id)}
        if students_collection.find_one(test_query):
            return test_query
    except:
        pass
    
    # Try _id as string (for custom IDs like "Class09002")
    test_query = {'_id': student_id}
    if students_collection.find_one(test_query):
        return test_query
    
    # Try custom ID fields
    for field_name in ['student_id', 'studentId', 'id', 'studentID']:
        test_query = {field_name: student_id}
        if students_collection.find_one(test_query):
            return test_query
    
    # Default: try _id as string (will fail if not found, but that's handled)
    return {'_id': student_id}

def add_notification_to_student(students_collection, student_id, title, message):
    """
    Add notification to a student's document
    Automatically removes oldest notification if limit is reached
    Also sends an email notification to the student
    """
    try:
        if students_collection is None:
            return False, "MongoDB connection not available"
        # Create notification object
        notification = {
            'id': str(ObjectId()),  # Add unique ID for each notification
            'title': title,
            'message': message,
            'date': datetime.now().isoformat(),
            'timestamp': datetime.now(),
            'isRead': False  # Track read status
        }
        
        # Find the student using flexible ID matching
        student = find_student_by_id(students_collection, student_id)
        
        if not student:
            return False, f"Student with ID {student_id} not found"
        
        # Get current notifications or initialize empty list
        notifications = student.get('notifications', [])
        
        # Add new notification
        notifications.append(notification)
        
        # If limit exceeded, remove oldest notification
        if len(notifications) > NOTIFICATION_LIMIT:
            # Sort by timestamp and keep only the newest ones
            notifications.sort(key=lambda x: x.get('timestamp', datetime.min))
            notifications = notifications[-NOTIFICATION_LIMIT:]
        
        # Get the query to update the student
        query = get_student_query(students_collection, student_id)
        
        # Update student document
        result = students_collection.update_one(
            query,
            {'$set': {'notifications': notifications}}
        )
        
        if result.modified_count > 0:
            # Send email notification to student
            student_email = student.get('email')
            if student_email:
                try:
                    send_email(
                        recipients=[student_email],
                        subject="New Notification",
                        message="",  # Message not used for notification type
                        email_type="notification"
                    )
                except Exception as email_error:
                    print(f"⚠️ Failed to send email to {student_email}: {email_error}")
            
            # Emit real-time notification via WebSocket
            socketio = get_socketio()
            if socketio:
                # Create a clean notification object for WebSocket (without timestamp)
                ws_notification = {
                    'title': notification['title'],
                    'message': notification['message'],
                    'date': notification['date']
                }
                socketio.emit('new_notification', {
                    'student_id': str(student_id),
                    'notification': ws_notification
                }, room=str(student_id))
            
            return True, "Notification added successfully"
        else:
            return False, "Failed to update student document"
            
    except Exception as e:
        print(f"❌ Error adding notification: {e}")
        traceback.print_exc()
        return False, str(e)

@notifications_bp.route('/send-notification-all', methods=['POST'])
@jwt_required()
def send_notification_to_all():
    """
    Send notification to all registered students
    POST /send-notification-all
    Body: {
        "title": "Notification Title",
        "message": "Notification Message"
    }
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        data = request.get_json()
        
        # Validate required fields
        if not data or 'title' not in data or 'message' not in data:
            return jsonify({
                'error': 'Title and message are required',
                'example': {
                    'title': 'Important Announcement',
                    'message': 'This is a notification message'
                }
            }), 400
        
        title = data["title"]
        message = data["message"]

        # Course is required to know which collection to target
        course = (data.get("course") or "").strip()
        if not course:
            return jsonify({"error": "Course is required"}), 400

        try:
            students_collection = get_students_collection_for_course(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Get all students in this course
        students = list(students_collection.find({}))
        
        if not students:
            return jsonify({
                'success': False,
                'message': 'No students found in database',
                'hint': 'Use POST /register-student to add students first'
            }), 404
        
        success_count = 0
        failed_count = 0
        results = []
        
        # Send notification to each student
        for student in students:
            student_id = str(student["_id"])
            success, msg = add_notification_to_student(
                students_collection, student_id, title, message
            )
            
            if success:
                success_count += 1
                results.append({
                    'student_id': student_id,
                    'name': student.get('name', 'Unknown'),
                    'status': 'success'
                })
            else:
                failed_count += 1
                results.append({
                    'student_id': student_id,
                    'name': student.get('name', 'Unknown'),
                    'status': 'failed',
                    'error': msg
                })
        
        # Store in admin notification history
        try:
            current_user = get_jwt_identity()
            admin_email = current_user.get('email')
            if admin_email:
                notification_data = {
                    'message': message,
                    'recipient_type': 'class',
                    'recipients': [f"All students ({course})"]
                }
                add_notification_to_admin_history(db.admin, admin_email, notification_data)
        except Exception as e:
            print(f"⚠️ Failed to add to admin history: {e}")
        
        return jsonify({
            'success': True,
            'message': f'Notification sent to {success_count} students',
            'total_students': len(students),
            'success_count': success_count,
            'failed_count': failed_count,
            'notification': {
                'title': title,
                'message': message,
                'timestamp': datetime.now().isoformat()
            },
            'results': results
        }), 200
        
    except Exception as e:
        print(f"❌ Error sending notification to all: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@notifications_bp.route('/send-notification', methods=['POST'])
@jwt_required()
def send_notification_to_student():
    """
    Send notification to specific student(s)
    POST /send-notification
    Body: {
        "student_ids": ["student_id1", "student_id2"],  // Array of student IDs
        "title": "Notification Title",
        "message": "Notification Message"
    }
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        data = request.get_json()
        
        # Validate required fields
        if not data or 'student_ids' not in data or 'title' not in data or 'message' not in data:
            return jsonify({
                'error': 'student_ids, title, and message are required',
                'example': {
                    'student_ids': ['507f1f77bcf86cd799439011'],
                    'title': 'Important Announcement',
                    'message': 'This is a notification message'
                }
            }), 400
        
        student_ids = data["student_ids"]
        title = data["title"]
        message = data["message"]

        # Course is required to know which collection to target
        course = (data.get("course") or "").strip()
        if not course:
            return jsonify({"error": "Course is required"}), 400

        try:
            students_collection = get_students_collection_for_course(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        
        # Validate student_ids is a list
        if not isinstance(student_ids, list):
            return jsonify({'error': 'student_ids must be an array'}), 400
        
        if not student_ids:
            return jsonify({'error': 'student_ids array cannot be empty'}), 400
        
        success_count = 0
        failed_count = 0
        results = []
        
        # Send notification to each student
        for student_id in student_ids:
            try:
                # Try to send notification (supports both ObjectId and custom IDs)
                success, msg = add_notification_to_student(
                    students_collection, student_id, title, message
                )
                
                if success:
                    success_count += 1
                    results.append({
                        'student_id': student_id,
                        'status': 'success'
                    })
                else:
                    failed_count += 1
                    results.append({
                        'student_id': student_id,
                        'status': 'failed',
                        'error': msg
                    })
            except Exception as e:
                failed_count += 1
                results.append({
                    'student_id': student_id,
                    'status': 'failed',
                    'error': f'Error processing student ID: {str(e)}'
                })
        
        # Store in admin notification history
        try:
            current_user = get_jwt_identity()
            admin_email = current_user.get('email')
            if admin_email:
                # Get student emails for history
                recipient_emails = []
                for student_id in student_ids:
                    student = find_student_by_id(students_collection, student_id)
                    if student and 'email' in student:
                        recipient_emails.append(student['email'])
                
                # Determine recipient type based on count
                if len(student_ids) == 1:
                    recipient_type = 'single'
                else:
                    recipient_type = 'group'
                
                notification_data = {
                    'message': message,
                    'recipient_type': recipient_type,
                    'recipients': recipient_emails if recipient_emails else [f"{len(student_ids)} students"]
                }
                add_notification_to_admin_history(db.admin, admin_email, notification_data)
        except Exception as e:
            print(f"⚠️ Failed to add to admin history: {e}")
        
        return jsonify({
            'success': True,
            'message': f'Notification sent to {success_count} student(s)',
            'success_count': success_count,
            'failed_count': failed_count,
            'notification': {
                'title': title,
                'message': message,
                'timestamp': datetime.now().isoformat()
            },
            'results': results
        }), 200
        
    except Exception as e:
        print(f"❌ Error sending notification: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@notifications_bp.route('/get-student-notifications/<student_id>', methods=['GET'])
def get_student_notifications(student_id):
    """
    Get all notifications for a specific student
    GET /get-student-notifications/<student_id>
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        course = (request.args.get("course") or "").strip()
        if not course:
            return jsonify({"error": "Course is required"}), 400

        try:
            students_collection = get_students_collection_for_course(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Find student using flexible ID matching (supports both ObjectId and custom IDs)
        student = find_student_by_id(students_collection, student_id)
        
        if not student:
            return jsonify({
                'error': 'Student not found',
                'student_id': student_id,
                'hint': 'Make sure the student ID is correct. It can be an ObjectId or a custom ID like "Class09002"'
            }), 404
        
        notifications = student.get('notifications', [])
        
        # Convert ObjectId to string and remove timestamp (keep date)
        # Also ensure isRead field exists (for backwards compatibility)
        # Filter out notifications deleted by student
        import hashlib
        filtered_notifications = []
        for notif in notifications:
            if 'timestamp' in notif:
                del notif['timestamp']
            if 'isRead' not in notif:
                notif['isRead'] = False  # Default to unread for old notifications
            if 'id' not in notif:
                # Generate consistent ID based on notification content (hash of title + date + message)
                content_str = f"{notif.get('title', '')}{notif.get('date', '')}{notif.get('message', '')}"
                notif['id'] = hashlib.md5(content_str.encode()).hexdigest()[:24]
            
            # Only include notifications NOT deleted by student
            if not notif.get('deletedByStudent', False):
                filtered_notifications.append(notif)
        
        return jsonify({
            'success': True,
            'student_id': student_id,
            'student_name': student.get('name', 'Unknown'),
            'notification_count': len(filtered_notifications),
            'notification_limit': NOTIFICATION_LIMIT,
            'notifications': filtered_notifications
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting student notifications: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@notifications_bp.route('/mark-notification-read', methods=['POST'])
def mark_notification_read():
    """
    Mark a specific notification as read for a student
    POST /mark-notification-read
    Body: {
        "notification_id": "notification_id",
        "student_id": "student_id",
        "course": "computerScience"
    }
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        data = request.get_json()
        
        if not data or 'notification_id' not in data or 'student_id' not in data:
            return jsonify({'error': 'notification_id and student_id are required'}), 400
        
        notification_id = data['notification_id']
        student_id = data['student_id']
        course = data.get('course', '').strip()
        
        if not course:
            return jsonify({"error": "Course is required"}), 400

        try:
            students_collection = get_students_collection_for_course(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Find student
        student = find_student_by_id(students_collection, student_id)
        
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        
        # Get notifications and mark the specific one as read
        notifications = student.get('notifications', [])
        found = False
        
        # Generate consistent IDs for old notifications (same as in get endpoint)
        import hashlib
        for notif in notifications:
            if 'id' not in notif:
                content_str = f"{notif.get('title', '')}{notif.get('date', '')}{notif.get('message', '')}"
                notif['id'] = hashlib.md5(content_str.encode()).hexdigest()[:24]
            
            if notif.get('id') == notification_id:
                notif['isRead'] = True
                found = True
                print(f"✅ Found and marked notification as read: {notification_id}")
                break
        
        if not found:
            print(f"⚠️ Notification ID {notification_id} not found")
            print(f"📋 Available IDs: {[n.get('id', 'NO-ID') for n in notifications]}")
            return jsonify({'error': 'Notification not found'}), 404
        
        # Update student document
        query = get_student_query(students_collection, student_id)
        result = students_collection.update_one(
            query,
            {'$set': {'notifications': notifications}}
        )
        
        if result.modified_count > 0:
            return jsonify({
                'success': True,
                'message': 'Notification marked as read'
            }), 200
        else:
            return jsonify({'error': 'Failed to update notification'}), 500
        
    except Exception as e:
        print(f"❌ Error marking notification as read: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@notifications_bp.route('/delete-notification', methods=['POST'])
def delete_notification():
    """
    Permanently delete notification from student's side only
    This removes the notification from the student's notifications array.
    Admin notification history remains untouched.
    
    POST /delete-notification
    Body: {
        "notification_id": "notification_id",
        "student_id": "student_id",
        "course": "computerScience"
    }
    
    Note: Admin notification history is stored separately and is NOT affected by this deletion.
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        data = request.get_json()
        
        if not data or 'notification_id' not in data or 'student_id' not in data:
            return jsonify({'error': 'notification_id and student_id are required'}), 400
        
        notification_id = data['notification_id']
        student_id = data['student_id']
        course = data.get('course', '').strip()
        
        if not course:
            return jsonify({"error": "Course is required"}), 400

        try:
            students_collection = get_students_collection_for_course(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Find student
        student = find_student_by_id(students_collection, student_id)
        
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        
        # Get notifications to find the one to delete
        notifications = student.get('notifications', [])
        found = False
        
        # Generate consistent IDs for old notifications (same as in get endpoint)
        import hashlib
        for notif in notifications:
            if 'id' not in notif:
                content_str = f"{notif.get('title', '')}{notif.get('date', '')}{notif.get('message', '')}"
                notif['id'] = hashlib.md5(content_str.encode()).hexdigest()[:24]
            
            if notif.get('id') == notification_id:
                found = True
                break
        
        if not found:
            print(f"⚠️ Notification ID {notification_id} not found")
            return jsonify({'error': 'Notification not found'}), 404
        
        # Permanently remove notification from STUDENT's notifications array only
        # NOTE: This does NOT affect admin.notification_history which is stored separately
        # Admin notification history remains intact for record-keeping purposes
        query = get_student_query(students_collection, student_id)
        
        # First, try to remove by ID if it exists
        result = students_collection.update_one(
            query,
            {'$pull': {'notifications': {'id': notification_id}}}
        )
        
        # If that didn't work (for old notifications without ID), remove by matching content
        if result.modified_count == 0:
            # Get the notification to find its content for matching
            target_notif = None
            for notif in notifications:
                if notif.get('id') == notification_id:
                    target_notif = notif
                    break
            
            if target_notif:
                # Remove by matching all key fields
                result = students_collection.update_one(
                    query,
                    {'$pull': {
                        'notifications': {
                            'title': target_notif.get('title'),
                            'date': target_notif.get('date'),
                            'message': target_notif.get('message', '')
                        }
                    }}
                )
        
        if result.modified_count > 0:
            print(f"✅ Permanently deleted notification for student: {notification_id}")
            return jsonify({
                'success': True,
                'message': 'Notification deleted permanently'
            }), 200
        else:
            return jsonify({'error': 'Failed to delete notification'}), 500
        
    except Exception as e:
        print(f"❌ Error deleting notification: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@notifications_bp.route('/get-all-students', methods=['GET'])
def get_all_students():
    """
    Get all registered students
    GET /get-all-students
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        course = (request.args.get("course") or "").strip()
        if not course:
            return jsonify({"error": "Course is required"}), 400

        try:
            students_collection = get_students_collection_for_course(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        students = list(students_collection.find({}))
        
        # Convert ObjectId to string and format response
        formatted_students = []
        for student in students:
            notifications = student.get('notifications', [])
            
            # Get student ID (could be ObjectId or custom string)
            student_id_value = str(student.get('_id', ''))
            
            # Check for custom ID fields
            custom_id = student.get('student_id') or student.get('studentId') or student.get('id') or student.get('studentID')
            
            # Use custom ID if available, otherwise use _id
            display_id = custom_id if custom_id else student_id_value
            
            formatted_students.append({
                'student_id': display_id,
                'mongo_id': student_id_value,  # Always include MongoDB _id for reference
                'name': student.get('name', 'Unknown'),
                'email': student.get('email', ''),
                'notification_count': len(notifications),
                'notification_limit': NOTIFICATION_LIMIT
            })
        
        return jsonify({
            'success': True,
            'total_students': len(formatted_students),
            'students': formatted_students
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting all students: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@notifications_bp.route('/register-student', methods=['POST'])
def register_student():
    """
    Register a new student (for testing purposes)
    POST /register-student
    Body: {
        "name": "Student Name",
        "email": "student@example.com"
    }
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        course = (request.args.get("course") or "").strip()
        if not course:
            return jsonify({"error": "Course is required"}), 400

        try:
            students_collection = get_students_collection_for_course(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        data = request.get_json()
        
        # Validate required fields
        if not data or 'name' not in data:
            return jsonify({
                'error': 'Name is required',
                'example': {
                    'name': 'John Doe',
                    'email': 'john@example.com'
                }
            }), 400
        
        name = data['name']
        email = data.get('email', '')
        
        # Check if student with same email already exists
        if email:
            existing = students_collection.find_one({"email": email})
            if existing:
                return jsonify({
                    'error': 'Student with this email already exists',
                    'student_id': str(existing['_id'])
                }), 400
        
        # Create new student document
        student_doc = {
            'name': name,
            'email': email,
            'notifications': [],
            'created_at': datetime.now().isoformat()
        }
        
        result = students_collection.insert_one(student_doc)
        
        return jsonify({
            'success': True,
            'message': 'Student registered successfully',
            'student_id': str(result.inserted_id),
            'student': {
                'name': name,
                'email': email,
                'notification_count': 0,
                'notification_limit': NOTIFICATION_LIMIT
            }
        }), 201
        
    except Exception as e:
        print(f"❌ Error registering student: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@notifications_bp.route('/delete-student/<student_id>', methods=['DELETE'])
def delete_student(student_id):
    """
    Delete a student (for testing purposes)
    DELETE /delete-student/<student_id>
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        course = (request.args.get("course") or "").strip()
        if not course:
            return jsonify({"error": "Course is required"}), 400

        try:
            students_collection = get_students_collection_for_course(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Get the query to find/delete the student (supports both ObjectId and custom IDs)
        query = get_student_query(students_collection, student_id)
        
        result = students_collection.delete_one(query)
        
        if result.deleted_count > 0:
            return jsonify({
                'success': True,
                'message': 'Student deleted successfully',
                'student_id': student_id
            }), 200
        else:
            return jsonify({
                'error': 'Student not found',
                'student_id': student_id
            }), 404
        
    except Exception as e:
        print(f"❌ Error deleting student: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@notifications_bp.route('/get-admin-notification-history', methods=['GET'])
@jwt_required()
def get_admin_notification_history():
    """
    Get notification history for the logged-in admin
    Returns the last 10 notifications sent by this admin
    GET /get-admin-notification-history
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response
        
        # Get admin email from JWT
        current_user = get_jwt_identity()
        admin_email = current_user.get('email')
        
        if not admin_email:
            return jsonify({"error": "Admin email not found in token"}), 400
        
        # Get admin document
        admin_collection = db.admin
        admin = admin_collection.find_one({"email": admin_email})
        
        if not admin:
            return jsonify({"error": "Admin not found"}), 404
        
        # Get notification history (default to empty list)
        notification_history = admin.get('notification_history', [])
        
        # Convert timestamps to ISO strings for JSON serialization
        history_clean = []
        for entry in notification_history:
            clean_entry = {
                'id': entry.get('date', str(datetime.now().timestamp())),  # Use date as ID
                'message': entry.get('message', ''),
                'recipientType': entry.get('recipient_type', 'unknown'),
                'recipients': entry.get('recipients', []),
                'createdAt': entry.get('date', ''),
            }
            history_clean.append(clean_entry)
        
        # Sort by date (newest first) and return
        history_clean.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        print(f"✅ Loaded {len(history_clean)} notification history entries for {admin_email}")
        
        return jsonify({
            'success': True,
            'history': history_clean,
            'count': len(history_clean)
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting admin notification history: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@notifications_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    GET /health
    """
    try:
        db = connect_to_mongodb()
        mongo_status = 'connected' if db is not None else 'disconnected'
        
        return jsonify(
            {
                "status": "healthy",
                "service": "notifications",
                "mongodb": mongo_status,
                "database": DATABASE_NAME,
                "collections": list(COURSE_COLLECTIONS.values()),
                "notification_limit": NOTIFICATION_LIMIT,
                "admin_history_limit": ADMIN_NOTIFICATION_HISTORY_LIMIT,
                "timestamp": datetime.now().isoformat(),
            }
        ), 200
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'notifications',
            'mongodb': 'disconnected',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

# WebSocket events are registered in app.py
