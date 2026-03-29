# auth/routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from database import connect_to_mongodb, get_course_collection
import bcrypt
from datetime import datetime, timedelta
from bson import ObjectId
import random
import os
import traceback

# Re‑use email sending logic from notifications service
from notifications.routes import send_email
from threading import Timer, Thread

auth_bp = Blueprint('auth', __name__)

def get_database():
    return connect_to_mongodb()

def hash_password(password):
    """Hash a password for storing with 12 rounds (cost factor)"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))

def verify_password(stored_password, provided_password):
    """Verify a stored hashed password against the plain password.

    MongoDB may return the stored password either as bytes (Binary) or as a
    UTF‑8 string. `bcrypt.checkpw` requires the hashed password to be bytes,
    so we normalize here.
    """
    # Normalize stored hash to bytes
    if isinstance(stored_password, str):
        stored_password = stored_password.encode('utf-8')

    return bcrypt.checkpw(provided_password.encode('utf-8'), stored_password)

def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP of given length."""
    return ''.join(str(random.randint(0, 9)) for _ in range(length))

LOCKOUT_THRESHOLD = 5
LOCKOUT_DURATION = timedelta(minutes=15)

def get_user_display_name(user_doc, role):
    if role == 'admin':
        return user_doc.get('name') or 'Administrator'
    return user_doc.get('name') or user_doc.get('full_name') or 'Student'

def send_lock_notification(user_doc, role, locked_until):
    email = user_doc.get('email')
    if not email:
        return
    subject = "Account temporarily locked"
    readable_until = locked_until.strftime("%Y-%m-%d %H:%M:%S UTC")
    message = (
        f"Hello {get_user_display_name(user_doc, role)},\n\n"
        "We detected five consecutive incorrect password attempts on your "
        f"{role} account, so it has been temporarily locked for security reasons.\n\n"
        f"You will be able to sign in again after {readable_until} "
        "(approximately 15 minutes). If this wasn't you, please ensure your "
        "credentials remain secure.\n\n"
        "Regards,\nSmart Educational Companion Support"
    )
    send_email([email], subject, message, "lock")

def schedule_unlock_notification(collection, user_doc, role, locked_until):
    email = user_doc.get('email')
    if not email:
        return
    delay = max(0, int((locked_until - datetime.utcnow()).total_seconds()))

    def notify_unlock():
        try:
            fresh = collection.find_one({"_id": user_doc["_id"]})
            current_until = fresh.get('locked_until') if fresh else None
            if not current_until or current_until != locked_until:
                return
            subject = "Account unlocked – you can log in again"
            message = (
                f"Hello {get_user_display_name(user_doc, role)},\n\n"
                "Your account lock has expired and you can now log in using your "
                "credentials. If you did not trigger the previous failed attempts, "
                "consider updating your password.\n\n"
                "Regards,\nSmart Educational Companion Support"
            )
            send_email([email], subject, message, "unlock")
        except Exception as e:
            print(f"❌ Failed to send unlock notification: {e}")

    Timer(delay, notify_unlock, daemon=True).start()

def is_account_locked(user_doc):
    locked_until = user_doc.get('locked_until')
    if locked_until and isinstance(locked_until, datetime):
        if datetime.utcnow() < locked_until:
            return True, locked_until
    return False, None

def record_failed_attempt(collection, user_doc):
    attempts = (user_doc.get('failed_login_attempts') or 0) + 1
    locked = False
    locked_until = None
    if attempts >= LOCKOUT_THRESHOLD:
        locked_until = datetime.utcnow() + LOCKOUT_DURATION
        update_doc = {
            'failed_login_attempts': 0,
            'locked_until': locked_until
        }
        locked = True
    else:
        update_doc = {'failed_login_attempts': attempts}

    collection.update_one({'_id': user_doc['_id']}, {'$set': update_doc})
    return locked, locked_until, attempts

def reset_failed_attempts(collection, user_doc):
    update_doc = {'failed_login_attempts': 0}
    update = {'$set': update_doc}
    if user_doc.get('locked_until'):
        update['$unset'] = {'locked_until': ""}
    collection.update_one({'_id': user_doc['_id']}, update)


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request payload"}), 400
        
        role = (data.get('role') or '').strip().lower()
        email = data.get('email')
        password = data.get('password')

        print(f"🔍 FLASK: Received - Role: {role}, Email: {email}")

        if not role or not email or not password:
            return jsonify({"error": "Role, email, and password are required"}), 400

        def invalid_credentials(extra=None, status_code=401):
            response = {"error": "Incorrect email or password. Please try again."}
            if isinstance(extra, dict):
                response.update(extra)
            elif extra:
                response["details"] = extra
            return jsonify(response), status_code

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        if role == 'admin':
            # Admin login - no OTP required, direct login after password verification
            # Use the lowercase 'admin' collection (matches your MongoDB Atlas)
            admin_collection = db.admin
            admin = admin_collection.find_one({"email": email})

            print(f"🔍 FLASK: Found admin in DB: {admin is not None}")

            if not admin:
                print("⚠️ Invalid admin email")
                return invalid_credentials()

            locked, locked_until = is_account_locked(admin)
            if locked:
                remaining = max(
                    1,
                    int((locked_until - datetime.utcnow()).total_seconds() // 60) + 1
                )
                return invalid_credentials(
                    {
                        "message": "Account locked due to multiple failed login attempts.",
                        "locked_until": locked_until.isoformat(),
                        "retry_after_minutes": remaining
                    },
                    status_code=423
                )

            if not verify_password(admin['password'], password):
                print("⚠️ Invalid admin password")
                locked_now, locked_until_value, attempts = record_failed_attempt(admin_collection, admin)
                if locked_now:
                    send_lock_notification(admin, 'admin', locked_until_value)
                    schedule_unlock_notification(admin_collection, admin, 'admin', locked_until_value)
                    remaining = max(
                        1,
                        int((locked_until_value - datetime.utcnow()).total_seconds() // 60) + 1
                    )
                    return invalid_credentials(
                        {
                            "message": "Account locked due to multiple failed login attempts.",
                            "locked_until": locked_until_value.isoformat(),
                            "retry_after_minutes": remaining
                        },
                        status_code=423
                    )
                attempts_remaining = max(0, LOCKOUT_THRESHOLD - attempts)
                return invalid_credentials(
                    {"attempts_remaining": attempts_remaining}
                )

            reset_failed_attempts(admin_collection, admin)

            # Direct login - issue JWT token immediately
            access_token = create_access_token(identity={
                "role": "admin",
                "email": admin["email"],
                "admin_id": str(admin["_id"]),
                "name": admin.get("name", "Administrator"),
                # Each admin is responsible for exactly one course / collection
                # e.g. 'computerScience', 'chemistry', 'physics'
                "course": admin.get("course"),
            })
            
            return jsonify({
                "message": "Admin login successful",
                "access_token": access_token,
                "user": {
                    "role": "admin",
                    "email": admin["email"],
                    "name": admin.get("name", "Administrator"),
                    "admin_id": str(admin["_id"]),
                    "course": admin.get("course"),
                    "address": admin.get("address", ""),
                }
            }), 200

        elif role == 'student':
            # Students live in per-course collections
            # Automatically search across all course collections to find the student
            from database import COURSE_COLLECTIONS
            
            student = None
            students_collection = None
            found_course = None
            
            # Search for student in all course collections
            for course_key, collection_name in COURSE_COLLECTIONS.items():
                try:
                    temp_collection = get_course_collection(db, course_key)
                    temp_student = temp_collection.find_one({"email": email})
                    
                    if temp_student is not None:
                        student = temp_student
                        students_collection = temp_collection
                        found_course = course_key
                        print(f"🔍 FLASK: Found student in {course_key} collection")
                        break
                except Exception as e:
                    print(f"⚠️ Error searching in {course_key} collection: {e}")
                    continue
            
            if student is None or students_collection is None:
                print("⚠️ Student not found in any course collection")
                return invalid_credentials()

            locked, locked_until = is_account_locked(student)
            if locked:
                remaining = max(
                    1,
                    int((locked_until - datetime.utcnow()).total_seconds() // 60) + 1
                )
                return invalid_credentials(
                    {
                        "message": "Account locked due to multiple failed login attempts.",
                        "locked_until": locked_until.isoformat(),
                        "retry_after_minutes": remaining
                    },
                    status_code=423
                )
            
            if verify_password(student['password'], password):
                reset_failed_attempts(students_collection, student)
                # Update last login time
                students_collection.update_one(
                    {"_id": student['_id']},
                    {"$set": {"last_login": datetime.utcnow()}}
                )
                
                access_token = create_access_token(identity={
                    "role": "student",
                    "email": student['email'],
                    "student_id": str(student['_id']),
                    "name": student.get('name', ''),
                    # remember which course / collection this student belongs to
                    "course": found_course,
                })
                
                return jsonify({
                    "message": "Student login successful",
                    "access_token": access_token,
                    "user": {
                        "role": "student",
                        "email": student['email'],
                        "name": student.get('name') or student.get('full_name', ''),
                        "student_id": str(student['_id']),
                        "course": found_course,
                        "class": student.get('class', ''),
                        "registration_number": student.get('student_id', ''),
                    }
                }), 200
            else:
                print("⚠️ Invalid student password")
                locked_now, locked_until_value, attempts = record_failed_attempt(students_collection, student)
                if locked_now:
                    send_lock_notification(student, 'student', locked_until_value)
                    schedule_unlock_notification(students_collection, student, 'student', locked_until_value)
                    remaining = max(
                        1,
                        int((locked_until_value - datetime.utcnow()).total_seconds() // 60) + 1
                    )
                    return invalid_credentials(
                        {
                            "message": "Account locked due to multiple failed login attempts.",
                            "locked_until": locked_until_value.isoformat(),
                            "retry_after_minutes": remaining
                        },
                        status_code=423
                    )
                attempts_remaining = max(0, LOCKOUT_THRESHOLD - attempts)
                return invalid_credentials(
                    {"attempts_remaining": attempts_remaining}
                )
        else:
            return jsonify({"error": "Invalid role"}), 400

    except Exception as e:
        print(f"❌ FLASK Login error: {e}")
        return jsonify({"error": "Server error during login"}), 500


@auth_bp.route('/request-operation-otp', methods=['POST'])
@jwt_required()
def request_operation_otp():
    """Request OTP for serious operations (add/delete student, upload/delete timetable/curriculum)"""
    try:
        current_user = get_jwt_identity()
        
        # Only admin can request operation OTP
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admin can request operation OTP"}), 403

        data = request.get_json()
        operation_type = data.get('operation_type')  # e.g., 'add_student', 'delete_student', 'upload_timetable', etc.

        if not operation_type:
            return jsonify({"error": "Operation type is required"}), 400

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})

        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        # Generate OTP and store in admin document with short expiry
        otp_code = generate_otp(6)
        expires_at = datetime.utcnow() + timedelta(minutes=10)

        admin_collection.update_one(
            {"_id": admin["_id"]},
            {
                "$set": {
                    "operation_otp": otp_code,
                    "operation_otp_expires_at": expires_at,
                    "operation_otp_type": operation_type,
                }
            },
        )

        # Send OTP via email (asynchronously to avoid timeout)
        operation_names = {
            'add_student': 'Add Student',
            'delete_student': 'Delete Student',
            'upload_timetable': 'Upload Timetable',
            'delete_timetable': 'Delete Timetable',
            'upload_curriculum': 'Upload Curriculum',
            'delete_curriculum': 'Delete Curriculum',
        }
        operation_name = operation_names.get(operation_type, 'Operation')

        subject = f"OTP for {operation_name} Operation"
        message = (
            f"Dear {admin.get('name', 'Administrator')},\n\n"
            f"Your one-time password (OTP) for {operation_name} operation is: {otp_code}\n\n"
            "This code is valid for 10 minutes. If you did not request this operation, please ignore this email.\n\n"
            "Regards,\nSmart Educational Companion"
        )

        # Send email asynchronously to avoid blocking the response
        def send_otp_email():
            try:
                print(f"📧 Attempting to send OTP email to: {admin['email']}")
                print(f"📧 OTP Code: {otp_code}")
                print(f"📧 Operation: {operation_name}")
                
                email_sent = send_email([admin["email"]], subject, message, "individual")

                if email_sent:
                    print(f"✅ OTP email sent successfully to {admin['email']}")
                else:
                    print(f"❌ Failed to send OTP email to {admin['email']}")
                    print(f"💡 Check SMTP configuration in notifications/routes.py")
                    print(f"💡 Verify Gmail App Password is correct")
            except Exception as e:
                print(f"❌ Error sending OTP email: {e}")
                import traceback
                traceback.print_exc()

        # Start email sending in background thread
        email_thread = Thread(target=send_otp_email, daemon=True)
        email_thread.start()

        # Return response immediately without waiting for email
        return jsonify(
            {
                "message": f"OTP has been sent to your email for {operation_name} operation.",
                "email": admin["email"],
                "operation_type": operation_type,
            }
        ), 200

    except Exception as e:
        print(f"❌ FLASK Request Operation OTP error: {e}")
        return jsonify({"error": "Server error during OTP request"}), 500

@auth_bp.route('/verify-operation-otp', methods=['POST'])
@jwt_required()
def verify_operation_otp():
    """Verify OTP for serious operations"""
    try:
        current_user = get_jwt_identity()
        
        # Only admin can verify operation OTP
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admin can verify operation OTP"}), 403

        data = request.get_json()
        otp = data.get("otp")
        operation_type = data.get("operation_type")

        if not otp or not operation_type:
            return jsonify({"error": "OTP and operation type are required"}), 400

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})

        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        stored_otp = admin.get("operation_otp")
        expires_at = admin.get("operation_otp_expires_at")
        stored_operation_type = admin.get("operation_otp_type")

        # Basic OTP checks
        if not stored_otp or not expires_at:
            return jsonify({"error": "No OTP found. Please request a new OTP."}), 400

        # Check if OTP matches operation type
        if stored_operation_type != operation_type:
            return jsonify({"error": "OTP was generated for a different operation. Please request a new OTP."}), 400

        # `expires_at` will be a datetime when read from Mongo with default codecs
        if datetime.utcnow() > expires_at:
            return jsonify({"error": "OTP has expired. Please request a new OTP."}), 400

        if str(otp) != str(stored_otp):
            return jsonify({"error": "Invalid OTP"}), 401

        # Clear OTP fields after successful verification
        admin_collection.update_one(
            {"_id": admin["_id"]},
            {"$unset": {"operation_otp": "", "operation_otp_expires_at": "", "operation_otp_type": ""}},
        )

        return jsonify(
            {
                "message": "OTP verified successfully",
                "verified": True,
            }
        ), 200

    except Exception as e:
        print(f"❌ FLASK Verify Operation OTP error: {e}")
        return jsonify({"error": "Server error during OTP verification"}), 500


@auth_bp.route('/debug/admins', methods=['GET'])
def debug_admins():
    try:
        db = get_database()
        admins = list(db.admin.find({}, {'email': 1, 'role': 1}))
        
        admin_list = []
        for admin in admins:
            admin_list.append({
                'email': admin.get('email'),
                'role': admin.get('role'),
                'id': str(admin.get('_id'))
            })
            
        return jsonify({
            "admins": admin_list,
            "count": len(admin_list)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/register-student', methods=['POST'])
@jwt_required()
def register_student():
    try:
        current_user = get_jwt_identity()
        
        # Only admin can register students
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admin can register students"}), 403

        data = request.get_json()
        otp = data.get('otp')
        
        # Verify OTP for this operation
        if not otp:
            return jsonify({"error": "OTP is required for this operation. Please request an OTP first."}), 400

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})

        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        stored_otp = admin.get("operation_otp")
        expires_at = admin.get("operation_otp_expires_at")
        stored_operation_type = admin.get("operation_otp_type")

        # Verify OTP
        if not stored_otp or not expires_at:
            return jsonify({"error": "No OTP found. Please request a new OTP."}), 400

        if stored_operation_type != 'add_student':
            return jsonify({"error": "OTP was generated for a different operation. Please request a new OTP."}), 400

        if datetime.utcnow() > expires_at:
            return jsonify({"error": "OTP has expired. Please request a new OTP."}), 400

        if str(otp) != str(stored_otp):
            return jsonify({"error": "Invalid OTP"}), 401

        # Clear OTP after verification
        admin_collection.update_one(
            {"_id": admin["_id"]},
            {"$unset": {"operation_otp": "", "operation_otp_expires_at": "", "operation_otp_type": ""}},
        )

        # Now proceed with student registration
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('full_name') or data.get('name')
        father_name = data.get('father_name')
        address = data.get('address', '')
        past_school = data.get('past_school', '')
        phone = data.get('phone')

        # Basic required fields validation
        if not email or not password or not full_name or not father_name or not phone:
            return jsonify({"error": "Full name, father name, email, phone, and password are required"}), 400
        
        # Validate password length (ensure it's a string and has minimum length)
        password_str = str(password).strip() if password else ""
        if len(password_str) < 6:
            return jsonify({"error": f"Password must be at least 6 characters long. Received length: {len(password_str)}"}), 400
        
        # Use the validated password
        password = password_str

        # Use the admin's course to select the correct student collection
        admin_course = admin.get("course")
        if not admin_course:
            return jsonify({"error": "Admin is not linked to any course"}), 400

        try:
            students_collection = get_course_collection(db, admin_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Check if student already exists by email
        if students_collection.find_one({"email": email}):
            return jsonify({"error": "Student with this email already exists"}), 400

        # Auto-generate registration number (student_id) in format Class09XXX
        class_name = "Class09"
        count_in_class = students_collection.count_documents({"class": class_name})
        next_index = count_in_class + 1
        student_id = f"{class_name}{next_index:03d}"

        # ✅ HASH THE PASSWORD before storing
        hashed_password = hash_password(password)
        
        # Create student with hashed password and full details
        student_data = {
            "email": email,
            "password": hashed_password,  # ✅ Stored as hash
            "name": full_name,
            "full_name": full_name,
            "father_name": father_name,
            "address": address,
            "past_school": past_school,
            "phone": phone,
            "student_id": student_id,  # registration number
            "role": "student",
            "class": class_name,
            "section": data.get('section', ''),
            "is_active": True,
            "created_at": datetime.utcnow(),
            "created_by": current_user['admin_id'],
            "last_login": None,
            # Initialize attendance fields
            "total_present": 0,
            "total_absent": 0,
            "attendance": [],
            # Initialize achievement badges as empty array
            "achievement_badges": [],
            "quiz_history": []
        }
        
        result = students_collection.insert_one(student_data)
        
        # Send welcome email to student with their credentials
        try:
            subject = "Welcome to Smart Educational Companion!"
            message = (
                f"Dear {full_name},\n\n"
                "Congratulations! Your account has been successfully created.\n\n"
                "Welcome to the Smart Educational Companion app! We are excited to have you join our community.\n\n"
                "Your login credentials are:\n"
                f"Email: {email}\n"
                f"Password: {password}\n\n"
                "Please keep these credentials safe and use them to log in to the portal.\n\n"
                "If you have any questions or need assistance, please don't hesitate to contact us.\n\n"
                "Best regards,\n"
                "Smart Educational Companion Team"
            )
            
            print(f"📧 Sending welcome email to student: {email}")
            email_sent = send_email([email], subject, message, "welcome")
            
            if email_sent:
                print(f"✅ Welcome email sent successfully to {email}")
            else:
                print(f"⚠️ Failed to send welcome email to {email}, but student was registered successfully")
        except Exception as email_error:
            print(f"⚠️ Error sending welcome email: {email_error}")
            # Don't fail the registration if email fails
            import traceback
            traceback.print_exc()
        
        # Format course name for display
        course_display_names = {
            "computerScience": "Computer Science",
            "chemistry": "Chemistry",
            "physics": "Physics"
        }
        course_display_name = course_display_names.get(admin_course, admin_course)
        
        return jsonify({
            "message": "Student registered successfully",
            "student_mongo_id": str(result.inserted_id),
            "registration_number": student_id,
            "course": admin_course,
            "course_display_name": course_display_name
        }), 201

    except Exception as e:
        print(f"Student registration error: {e}")
        import traceback
        traceback.print_exc()
        error_message = str(e) if str(e) else "Server error during student registration"
        return jsonify({"error": error_message}), 500

@auth_bp.route('/delete-student/<student_id>', methods=['DELETE'])
@jwt_required()
def delete_student(student_id):
    """Delete a student - requires OTP verification"""
    try:
        current_user = get_jwt_identity()
        
        # Only admin can delete students
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admin can delete students"}), 403

        data = request.get_json() if request.is_json else {}
        otp = data.get('otp')
        
        # Verify OTP for this operation
        if not otp:
            return jsonify({"error": "OTP is required for this operation. Please request an OTP first."}), 400

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})

        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        stored_otp = admin.get("operation_otp")
        expires_at = admin.get("operation_otp_expires_at")
        stored_operation_type = admin.get("operation_otp_type")

        # Verify OTP
        if not stored_otp or not expires_at:
            return jsonify({"error": "No OTP found. Please request a new OTP."}), 400

        if stored_operation_type != 'delete_student':
            return jsonify({"error": "OTP was generated for a different operation. Please request a new OTP."}), 400

        if datetime.utcnow() > expires_at:
            return jsonify({"error": "OTP has expired. Please request a new OTP."}), 400

        if str(otp) != str(stored_otp):
            return jsonify({"error": "Invalid OTP"}), 401

        # Clear OTP after verification
        admin_collection.update_one(
            {"_id": admin["_id"]},
            {"$unset": {"operation_otp": "", "operation_otp_expires_at": "", "operation_otp_type": ""}},
        )

        # Now proceed with student deletion in the admin's own course only
        admin_course = admin.get("course")
        if not admin_course:
            return jsonify({"error": "Admin is not linked to any course"}), 400

        try:
            students_collection = get_course_collection(db, admin_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        
        # Try to find student by ObjectId first
        try:
            from bson import ObjectId
            student = students_collection.find_one({"_id": ObjectId(student_id)})
        except:
            student = None
        
        # If not found by ObjectId, try by student_id field
        if not student:
            student = students_collection.find_one({"student_id": student_id})
        
        # If still not found, try by email
        if not student:
            student = students_collection.find_one({"email": student_id})
        
        if not student:
            return jsonify({"error": "Student not found"}), 404

        # Delete the student
        result = students_collection.delete_one({"_id": student["_id"]})
        
        if result.deleted_count > 0:
            return jsonify({
                "message": "Student deleted successfully",
                "student_id": str(student["_id"]),
                "student_name": student.get('name') or student.get('full_name', 'Unknown')
            }), 200
        else:
            return jsonify({"error": "Failed to delete student"}), 500

    except Exception as e:
        print(f"Delete student error: {e}")
        import traceback
        traceback.print_exc()
        error_message = str(e) if str(e) else "Server error during student deletion"
        return jsonify({"error": error_message}), 500

@auth_bp.route('/get-students', methods=['GET'])
@jwt_required()
def get_students():
    """Get all students - Admin only"""
    try:
        current_user = get_jwt_identity()
        
        # Only admin can view all students, and only for their own course
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admin can view students list"}), 403

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500
        
        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})
        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        admin_course = admin.get("course")
        if not admin_course:
            return jsonify({"error": "Admin is not linked to any course"}), 400

        try:
            students_collection = get_course_collection(db, admin_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Get all students in this course, excluding password field
        students = list(students_collection.find({}, {'password': 0}))
        
        print(f"📊 Found {len(students)} students in database")
        
        # Convert ObjectId to string and format the response
        students_list = []
        for student in students:
            print(f"🔍 Processing student: {student.get('full_name') or student.get('name', 'Unknown')}")
            
            # Get quiz history (last 10)
            quiz_history = student.get('quiz_history', [])
            # Format quiz history for frontend
            formatted_quiz_history = []
            for quiz in quiz_history:
                formatted_quiz_history.append({
                    "topic": quiz.get('topic', 'N/A'),
                    "difficulty": quiz.get('difficulty', 'N/A'),
                    "score": quiz.get('score', 0),
                    "totalQuestions": quiz.get('totalQuestions', 10),
                    "percentage": quiz.get('percentage', 0),
                    "timeTaken": quiz.get('timeTaken', 0),
                    "completedAt": quiz.get('completedAt', '').isoformat() if isinstance(quiz.get('completedAt'), datetime) else str(quiz.get('completedAt', ''))
                })
            
            # Get achievement badges
            achievement_badges = student.get('achievement_badges', [])
            
            student_data = {
                'id': str(student['_id']),
                'fullName': student.get('full_name') or student.get('name', ''),
                'fatherName': student.get('father_name', ''),
                'address': student.get('address', ''),
                'pastSchool': student.get('past_school', ''),
                'phoneNumber': student.get('phone', ''),
                'email': student.get('email', ''),
                'registrationNumber': student.get('student_id', ''),
                'class': student.get('class', ''),
                'section': student.get('section', ''),
                'isActive': student.get('is_active', True),
                'createdAt': student.get('created_at').isoformat() if student.get('created_at') else None,
                'quizHistory': formatted_quiz_history,  # Add quiz history
                'achievementBadges': achievement_badges,  # Add achievement badges
            }
            students_list.append(student_data)
            print(f"✅ Formatted student data with {len(formatted_quiz_history)} quiz records")
        
        print(f"📤 Returning {len(students_list)} students to frontend")
        
        return jsonify({
            "students": students_list,
            "count": len(students_list)
        }), 200

    except Exception as e:
        print(f"Get students error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error while fetching students"}), 500

@auth_bp.route('/get-attendance-students', methods=['GET'])
@jwt_required()
def get_attendance_students():
    """Get all students for attendance - Admin only, includes attendance percentage and counts"""
    try:
        current_user = get_jwt_identity()
        
        # Only admin can view students for attendance
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admin can view attendance students"}), 403

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500
        
        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})
        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        admin_course = admin.get("course")
        if not admin_course:
            return jsonify({"error": "Admin is not linked to any course"}), 400

        try:
            students_collection = get_course_collection(db, admin_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Get all students in this course, excluding password field
        students = list(students_collection.find({}, {'password': 0}))
        
        print(f"📊 Found {len(students)} students for attendance")
        
        # Convert ObjectId to string and format the response with attendance percentage and counts
        students_list = []
        for student in students:
            # Get stored counts (default to 0 if not set)
            total_present = student.get('total_present', 0)
            total_absent = student.get('total_absent', 0)
            
            # If counts are not initialized, check attendance records
            # If student has attendance records but no counts, calculate from records
            attendance_records = student.get('attendance', [])
            if len(attendance_records) > 0 and total_present == 0 and total_absent == 0:
                # Calculate from records if counts weren't stored
                total_present = sum(1 for record in attendance_records if record.get('status') == 'present')
                total_absent = sum(1 for record in attendance_records if record.get('status') == 'absent')
                # Update the student document with calculated counts
                students_collection.update_one(
                    {"_id": student['_id']},
                    {"$set": {"total_present": total_present, "total_absent": total_absent}}
                )
            elif 'total_present' not in student or 'total_absent' not in student:
                # Initialize counts if they don't exist at all
                students_collection.update_one(
                    {"_id": student['_id']},
                    {"$set": {"total_present": 0, "total_absent": 0, "attendance": []}}
                )
            
            # Calculate percentage (will be 0.0 if both counts are 0)
            total_records = total_present + total_absent
            attendance_percentage = round((total_present / total_records * 100), 1) if total_records > 0 else 0.0
            absent_percentage = round((total_absent / total_records * 100), 1) if total_records > 0 else 0.0
            
            student_data = {
                'id': str(student['_id']),
                'registrationNumber': student.get('student_id', ''),
                'fullName': student.get('full_name') or student.get('name', ''),
                'fatherName': student.get('father_name', ''),
                'attendancePercentage': attendance_percentage,
                'absentPercentage': absent_percentage,
                'totalPresent': total_present,
                'totalAbsent': total_absent,
            }
            students_list.append(student_data)
        
        # Format course name for display
        course_display_names = {
            "computerScience": "Computer Science",
            "chemistry": "Chemistry",
            "physics": "Physics"
        }
        course_display_name = course_display_names.get(admin_course, admin_course)
        
        print(f"📤 Returning {len(students_list)} students for attendance")
        
        return jsonify({
            "students": students_list,
            "count": len(students_list),
            "course": admin_course,
            "course_display_name": course_display_name
        }), 200

    except Exception as e:
        print(f"Get attendance students error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error while fetching attendance students"}), 500

@auth_bp.route('/save-attendance', methods=['POST'])
@jwt_required()
def save_attendance():
    """Save attendance records for students - Admin only, updates present/absent counts and stores topic per day for admin"""
    try:
        current_user = get_jwt_identity()
        
        # Only admin can save attendance
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admin can save attendance"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request payload"}), 400
        
        attendance_records = data.get('attendance', {})  # {student_id: true/false}
        topics = data.get('topics', {})  # Course-specific topic
        date = data.get('date')  # Optional, defaults to today
        
        if not attendance_records:
            return jsonify({"error": "Attendance records are required"}), 400

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500
        
        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})
        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        admin_course = admin.get("course")
        if not admin_course:
            return jsonify({"error": "Admin is not linked to any course"}), 400

        try:
            students_collection = get_course_collection(db, admin_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Use provided date or default to today
        if date:
            attendance_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
        else:
            attendance_date = datetime.utcnow()
        
        attendance_date_str = attendance_date.strftime('%Y-%m-%d')
        
        # Save attendance for each student
        saved_count = 0
        for student_id, is_present in attendance_records.items():
            try:
                # Find student by ObjectId or student_id field
                from bson import ObjectId
                try:
                    student = students_collection.find_one({"_id": ObjectId(student_id)})
                except:
                    student = students_collection.find_one({"student_id": student_id})
                
                if not student:
                    print(f"⚠️ Student not found: {student_id}")
                    continue
                
                # Initialize attendance array if it doesn't exist
                if 'attendance' not in student:
                    student['attendance'] = []
                
                # Get current counts (default to 0)
                total_present = student.get('total_present', 0)
                total_absent = student.get('total_absent', 0)
                
                # Create a new attendance record entry
                attendance_record = {
                    'date': attendance_date_str,
                    'status': 'present' if is_present else 'absent',
                    'topics': topics,
                    'marked_by': current_user['email'],
                    'marked_at': datetime.utcnow()
                }
                
                # Always treat each upload as a new event: increment only the chosen status
                if is_present:
                    total_present += 1
                else:
                    total_absent += 1
                
                # Append the new record and update cumulative counts
                students_collection.update_one(
                    {"_id": student['_id']},
                    {
                        "$push": {"attendance": attendance_record},
                        "$set": {
                            "total_present": total_present,
                            "total_absent": total_absent
                        }
                    }
                )
                
                saved_count += 1
                print(f"✅ Saved attendance for student: {student.get('full_name') or student.get('name', 'Unknown')} - Present: {total_present}, Absent: {total_absent}")
                
            except Exception as e:
                print(f"❌ Error saving attendance for student {student_id}: {e}")
                continue
        
        # Also store today's topics in the admin document as an array entry
        try:
            admin_topics_entry = {
                "date": attendance_date_str,
                "course": admin_course,
                "topics": topics,
                "saved_count": saved_count,
                "saved_at": datetime.utcnow(),
            }

            # Initialize topics array if it doesn't exist
            admin_topics_field = "attendance_topics"
            if admin_topics_field not in admin:
                admin_collection.update_one(
                    {"_id": admin["_id"]},
                    {"$set": {admin_topics_field: []}}
                )

            # Append new entry for this date
            admin_collection.update_one(
                {"_id": admin["_id"]},
                {"$push": {admin_topics_field: admin_topics_entry}}
            )
        except Exception as e:
            # Log but don't fail whole request if admin topics history can't be stored
            print(f"⚠️ Error saving admin topics history: {e}")

        return jsonify({
            "message": f"Attendance saved successfully for {saved_count} student(s)",
            "date": attendance_date_str,
            "saved_count": saved_count
        }), 200

    except Exception as e:
        print(f"Save attendance error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error while saving attendance"}), 500

@auth_bp.route('/get-student-profile', methods=['GET'])
@jwt_required()
def get_student_profile():
    """Get student profile data including student_id from database"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can access this endpoint"}), 403
        
        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500
        
        course = current_user.get('course')
        if not course:
            return jsonify({"error": "Student is not linked to any course"}), 400
        
        try:
            students_collection = get_course_collection(db, course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        
        student = students_collection.find_one({"_id": ObjectId(current_user['student_id'])})
        
        if not student:
            return jsonify({"error": "Student not found"}), 404
        
        # Get student_id from database (could be in various fields)
        db_student_id = (
            student.get('student_id') or 
            student.get('studentId') or 
            student.get('id') or 
            student.get('studentID') or 
            str(student.get('_id', ''))
        )
        
        return jsonify({
            "success": True,
            "name": student.get('name') or student.get('full_name', ''),
            "email": student.get('email', ''),
            "student_id": db_student_id,
            "course": course
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting student profile: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error"}), 500


@auth_bp.route('/update-profile', methods=['PUT'])
@jwt_required()
def update_profile():
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        
        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        if current_user['role'] == 'admin':
            admin_collection = db.admin
            admin = admin_collection.find_one({"_id": ObjectId(current_user['admin_id'])})
            
            if not admin:
                return jsonify({"error": "Admin not found"}), 404

            update_data = {}
            if 'name' in data:
                update_data['name'] = data['name']
            if 'email' in data:
                existing_admin = admin_collection.find_one({"email": data['email'], "_id": {"$ne": admin['_id']}})
                if existing_admin:
                    return jsonify({"error": "Email already in use"}), 400
                update_data['email'] = data['email']
            if 'address' in data:
                update_data['address'] = data['address']
            if 'password' in data and data['password']:
                # ✅ Hash new password before storing
                update_data['password'] = hash_password(data['password'])

            admin_collection.update_one({"_id": admin['_id']}, {"$set": update_data})
            
            return jsonify({"message": "Admin profile updated successfully"}), 200

        elif current_user['role'] == 'student':
            # Student profile is stored in course‑specific collection
            course = current_user.get('course')
            if not course:
                return jsonify({"error": "Student is not linked to any course"}), 400

            try:
                students_collection = get_course_collection(db, course)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400

            student = students_collection.find_one({"_id": ObjectId(current_user['student_id'])})
            
            if not student:
                return jsonify({"error": "Student not found"}), 404

            update_data = {}
            # Students cannot change their name - it's assigned by admin
            # if 'name' in data:
            #     update_data['name'] = data['name']
            if 'email' in data:
                existing_student = students_collection.find_one({"email": data['email'], "_id": {"$ne": student['_id']}})
                if existing_student:
                    return jsonify({"error": "Email already in use"}), 400
                update_data['email'] = data['email']
            if 'password' in data and data['password']:
                # ✅ Hash new password before storing
                update_data['password'] = hash_password(data['password'])
            if 'phone' in data:
                update_data['phone'] = data['phone']
            if 'address' in data:
                update_data['address'] = data['address']

            students_collection.update_one({"_id": student['_id']}, {"$set": update_data})
            
            return jsonify({"message": "Student profile updated successfully"}), 200

    except Exception as e:
        print(f"Profile update error: {e}")
        return jsonify({"error": "Server error during profile update"}), 500


@auth_bp.route('/student-attendance', methods=['GET'])
@jwt_required()
def get_student_attendance():
    """Get attendance records for the logged-in student with topics from admin collection"""
    try:
        current_user = get_jwt_identity()
        
        print(f"🔍 Getting attendance for user: {current_user}")
        
        # Only students can access this endpoint
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can access this endpoint"}), 403
        
        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500
        
        # Get student's course
        course = current_user.get('course')
        if not course:
            print("⚠️ Student has no course in JWT")
            return jsonify({"error": "Student is not linked to any course"}), 400
        
        print(f"📚 Student course: {course}")
        
        try:
            students_collection = get_course_collection(db, course)
        except ValueError as exc:
            print(f"❌ Invalid course: {exc}")
            return jsonify({"error": str(exc)}), 400
        
        # Find student by ID
        student_id = current_user.get('student_id')
        print(f"🔍 Looking for student with ID: {student_id}")
        
        student = students_collection.find_one({"_id": ObjectId(student_id)})
        
        if not student:
            print(f"⚠️ Student not found with _id: {student_id}")
            return jsonify({"error": "Student not found"}), 404
        
        print(f"✅ Found student: {student.get('name') or student.get('full_name', 'Unknown')}")
        
        # Get attendance records from student document (only date and status)
        attendance_records = student.get('attendance', [])
        total_present = student.get('total_present', 0)
        total_absent = student.get('total_absent', 0)
        
        print(f"📊 Attendance summary - Present: {total_present}, Absent: {total_absent}, Records: {len(attendance_records)}")
        
        # Get admin's topics for this course
        admin_collection = db.admin
        # Find admin for this course
        admin = admin_collection.find_one({"course": course})
        
        # Create a date -> topics mapping from admin's attendance_topics
        # Map course to topic key in the topics object
        course_topic_keys = {
            'computerScience': 'computerScienceTopic',
            'chemistry': 'chemistryTopic',
            'physics': 'physicsTopic'
        }
        
        topic_key = course_topic_keys.get(course, 'computerScienceTopic')
        
        topics_by_date = {}
        if admin and 'attendance_topics' in admin:
            for topic_entry in admin['attendance_topics']:
                date = topic_entry.get('date')
                topics_data = topic_entry.get('topics', {})
                
                # Extract only the topic for this student's course
                if isinstance(topics_data, dict):
                    # Get the topic for the student's specific course
                    topic_str = topics_data.get(topic_key, 'No topics recorded')
                    if not topic_str:
                        topic_str = 'No topics recorded'
                else:
                    topic_str = str(topics_data) if topics_data else 'No topics recorded'
                
                topics_by_date[date] = topic_str
            
            print(f"📚 Loaded {len(topics_by_date)} topic entries from admin for {course}")
        
        # Count present/absent students for each date
        attendance_counts = {}
        for student_doc in students_collection.find({}, {'attendance': 1}):
            student_attendance = student_doc.get('attendance', [])
            for att_record in student_attendance:
                date = att_record.get('date')
                status = att_record.get('status', '').lower()
                
                if date not in attendance_counts:
                    attendance_counts[date] = {'present': 0, 'absent': 0}
                
                if status == 'present':
                    attendance_counts[date]['present'] += 1
                elif status == 'absent':
                    attendance_counts[date]['absent'] += 1
        
        print(f"📊 Calculated attendance counts for {len(attendance_counts)} dates")
        
        # Format attendance records for frontend and merge with topics and counts
        formatted_records = []
        for record in attendance_records:
            date = record.get('date', '')
            
            # Get topics for this date from admin's collection
            topics_str = topics_by_date.get(date, 'No topics recorded')
            
            # Get attendance counts for this date
            counts = attendance_counts.get(date, {'present': 0, 'absent': 0})
            
            formatted_record = {
                'date': date,
                'status': record.get('status', '').capitalize(),
                'topics': topics_str,
                'students_present': counts['present'],
                'students_absent': counts['absent'],
                'total_students': counts['present'] + counts['absent'],
                'marked_at': record.get('marked_at', '').isoformat() if isinstance(record.get('marked_at'), datetime) else ''
            }
            formatted_records.append(formatted_record)
        
        # Sort by date descending (newest first)
        formatted_records.sort(key=lambda x: x['date'], reverse=True)
        
        print(f"✅ Returning {len(formatted_records)} attendance records with topics")
        
        return jsonify({
            "success": True,
            "attendance": formatted_records,
            "summary": {
                "present": total_present,
                "absent": total_absent,
                "total": total_present + total_absent
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Get student attendance error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error while fetching attendance"}), 500


@auth_bp.route('/admin-quiz-topics', methods=['GET'])
@jwt_required()
def get_admin_quiz_topics():
    """Get all topics for admin's course (from their attendance_topics)"""
    try:
        current_user = get_jwt_identity()
        
        print(f"🔍 Current user from JWT: {current_user}")
        
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admins can access this endpoint"}), 403

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        admin_email = current_user.get('email')
        if not admin_email:
            return jsonify({"error": "Admin email not found"}), 400

        print(f"🔍 Looking for admin with email: {admin_email}")
        
        # Find admin - collection name is 'admin' (singular, lowercase)
        admin_collection = db['admin']
        admin = admin_collection.find_one({"email": admin_email})
        
        # If not found, try looking by _id if email doesn't match
        if not admin:
            print(f"⚠️ Admin not found by email, checking all admins...")
            all_admins = list(admin_collection.find({}))
            print(f"📋 All admin emails in DB: {[a.get('email') for a in all_admins]}")
            
            # Maybe the admin_id in JWT can help
            admin_id = current_user.get('admin_id')
            if admin_id:
                print(f"🔍 Trying to find by admin_id: {admin_id}")
                admin = admin_collection.find_one({"_id": ObjectId(admin_id)}) if admin_id else None
        
        print(f"🔍 Admin found: {admin is not None}")
        if admin:
            print(f"🔍 Admin email in DB: {admin.get('email')}")
            print(f"🔍 Admin course: {admin.get('course')}")
        
        if not admin:
            return jsonify({"error": "Admin not found"}), 404

        admin_course = admin.get('course')
        if not admin_course:
            return jsonify({"error": "Admin course not found"}), 404

        # Get attendance_topics - it's a LIST, not a dictionary
        attendance_topics = admin.get('attendance_topics', [])
        
        print(f"📚 Admin course: {admin_course}")
        print(f"📚 Attendance topics type: {type(attendance_topics)}")
        print(f"📚 Attendance topics count: {len(attendance_topics) if isinstance(attendance_topics, list) else 0}")
        
        # Extract unique topics for this course
        course_topic_keys = {
            'physics': 'physicsTopic',
            'chemistry': 'chemistryTopic',
            'computerScience': 'computerScienceTopic'
        }
        
        topic_key = course_topic_keys.get(admin_course)
        if not topic_key:
            return jsonify({"error": "Invalid course"}), 400
        
        # Collect all unique topics for this course
        topics = []
        if isinstance(attendance_topics, list):
            for entry in attendance_topics:
                if isinstance(entry, dict):
                    topics_data = entry.get('topics', {})
                    if isinstance(topics_data, dict) and topic_key in topics_data:
                        topic = topics_data[topic_key]
                        if topic and topic not in topics and topic != 'No topics recorded':
                            topics.append(topic)
        
        print(f"📚 Extracted topics: {topics}")
        
        print(f"✅ Admin quiz topics for {admin_course}: {topics}")
        
        return jsonify({
            "success": True,
            "topics": topics,
            "course": admin_course
        }), 200
        
    except Exception as e:
        print(f"Error getting admin quiz topics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error"}), 500


@auth_bp.route('/student-quiz-topics', methods=['GET'])
@jwt_required()
def get_student_quiz_topics():
    """Get all topics for student's course (from admin's attendance_topics)"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can access quiz topics"}), 403

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        student_course = current_user.get('course')
        if not student_course:
            return jsonify({"error": "Student course not found"}), 400

        # Find admin for this course - collection name is 'admin' (singular, lowercase)
        admin_collection = db['admin']
        admin = admin_collection.find_one({"course": student_course})
        
        if not admin:
            return jsonify({"error": "No admin found for this course"}), 404

        # Get attendance_topics dictionary
        attendance_topics = admin.get('attendance_topics', {})
        
        # Extract unique topics for this course
        course_topic_keys = {
            'physics': 'physicsTopic',
            'chemistry': 'chemistryTopic',
            'computerScience': 'computerScienceTopic',
            'chemistry': 'chemistryTopic',
            'physics': 'physicsTopic'
        }
        
        topic_key = course_topic_keys.get(student_course, 'computerScienceTopic')
        unique_topics = set()
        
        for entry in attendance_topics:
            topics_data = entry.get('topics', {})
            if isinstance(topics_data, dict):
                topic_str = topics_data.get(topic_key, '')
                if topic_str and topic_str != 'No topics recorded':
                    unique_topics.add(topic_str)
        
        topics_list = sorted(list(unique_topics))
        
        print(f"📚 Found {len(topics_list)} topics for {student_course}: {topics_list}")
        
        return jsonify({
            "topics": topics_list,
            "course": student_course,
            "count": len(topics_list)
        }), 200

    except Exception as e:
        print(f"❌ Error fetching quiz topics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error while fetching topics"}), 500


@auth_bp.route('/generate-quiz', methods=['POST'])
@jwt_required()
def generate_quiz():
    """Generate quiz using FREE LLM (Groq) based on topic and difficulty"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can generate quizzes"}), 403

        data = request.get_json()
        topic = data.get('topic', '').strip()
        difficulty = data.get('difficulty', 'easy').strip().lower()
        
        if not topic:
            return jsonify({"error": "Topic is required"}), 400
        
        if difficulty not in ['easy', 'medium', 'hard']:
            difficulty = 'easy'

        print(f"🎯 Generating quiz: Topic={topic}, Difficulty={difficulty}")

        # Try using FREE Groq API first (no subscription needed!)
        import os
        groq_api_key = os.getenv('GROQ_API_KEY', '') or "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"
        
        if groq_api_key:
            try:
                from groq import Groq
                client = Groq(api_key=groq_api_key)
                
                # Create prompt for LLM with variation
                import random
                quiz_variant = random.randint(1, 1000)
                current_time = datetime.now().strftime("%Y%m%d%H%M%S")
                
                prompt = f"""Generate exactly 10 UNIQUE multiple-choice questions (MCQs) about "{topic}" with {difficulty} difficulty level.

IMPORTANT: Make questions DIFFERENT each time. Use varied question styles, different aspects, and diverse examples.

Quiz Variant ID: {quiz_variant}-{current_time}

Requirements:
- Each question should have exactly 4 options
- Only one option should be correct
- Questions should be clear and educational
- Difficulty: {difficulty.upper()}
- Use varied question types (definition, application, analysis, comparison, problem-solving)
- Cover different subtopics and aspects of {topic}
- Each quiz should be significantly different from any previous quiz

Return ONLY a valid JSON array with this exact structure:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief explanation of the correct answer"
  }}
]

Generate 10 unique questions now:"""

                # Call Groq API (FREE!)
                response = client.chat.completions.create(
                    model="mixtral-8x7b-32768",  # Free model, very fast!
                    messages=[
                        {"role": "system", "content": "You are an educational quiz generator. Always return valid JSON arrays of unique quiz questions. Each generation should produce different questions."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.9,  # Increased from 0.7 for more variation
                    max_tokens=2500
                )
                
                content = response.choices[0].message.content.strip()
                
                # Parse JSON response
                import json
                # Remove markdown code blocks if present
                if content.startswith('```'):
                    lines = content.split('\n')
                    content = '\n'.join(lines[1:-1]) if len(lines) > 2 else content
                    if content.startswith('json'):
                        content = content[4:].strip()
                content = content.strip()
                
                questions = json.loads(content)
                
                # Validate structure
                if not isinstance(questions, list):
                    raise ValueError("Invalid question format")
                
                # Ensure we have 10 questions
                questions = questions[:10]
                
                # Format questions with IDs
                formatted_questions = []
                for idx, q in enumerate(questions):
                    formatted_questions.append({
                        "id": idx + 1,
                        "question": q.get("question", ""),
                        "options": q.get("options", []),
                        "correctIndex": q.get("correctIndex", 0),
                        "explanation": q.get("explanation", "")
                    })
                
                print(f"✅ Successfully generated {len(formatted_questions)} questions using Groq")
                
                return jsonify({
                    "questions": formatted_questions,
                    "topic": topic,
                    "difficulty": difficulty,
                    "totalQuestions": len(formatted_questions)
                }), 200
                
            except Exception as e:
                print(f"⚠️ Groq API error: {e}, falling back to sample questions")
                import traceback
                traceback.print_exc()
        
        # Fallback: Generate sample questions (works without any API key!)
        print("📝 Generating sample quiz (no API key configured)")
        
        import random
        
        # Sample question templates based on difficulty
        sample_questions = []
        
        for i in range(10):
            q_num = i + 1
            
            if difficulty == 'easy':
                question = f"What is a fundamental concept related to {topic}? (Question {q_num})"
                options = [
                    f"Basic concept A about {topic}",
                    f"Basic concept B about {topic}",
                    f"Basic concept C about {topic}",
                    f"Basic concept D about {topic}"
                ]
                explanation = f"This is a basic concept in {topic} that forms the foundation of understanding."
            elif difficulty == 'medium':
                question = f"How does {topic} apply in practical scenarios? (Question {q_num})"
                options = [
                    f"Application method A in {topic}",
                    f"Application method B in {topic}",
                    f"Application method C in {topic}",
                    f"Application method D in {topic}"
                ]
                explanation = f"This demonstrates a practical application of {topic} concepts."
            else:  # hard
                question = f"What is an advanced principle of {topic}? (Question {q_num})"
                options = [
                    f"Advanced principle A in {topic}",
                    f"Advanced principle B in {topic}",
                    f"Advanced principle C in {topic}",
                    f"Advanced principle D in {topic}"
                ]
                explanation = f"This is an advanced concept requiring deep understanding of {topic}."
            
            correct_idx = random.randint(0, 3)
            
            sample_questions.append({
                "id": q_num,
                "question": question,
                "options": options,
                "correctIndex": correct_idx,
                "explanation": explanation
            })
        
        print(f"✅ Generated {len(sample_questions)} sample questions")
        
        return jsonify({
            "questions": sample_questions,
            "topic": topic,
            "difficulty": difficulty,
            "totalQuestions": len(sample_questions),
            "note": "Configure GROQ_API_KEY for AI-generated questions"
        }), 200

    except Exception as e:
        print(f"❌ Error in generate_quiz: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error while generating quiz"}), 500


@auth_bp.route('/get-submitted-quiz-ids', methods=['GET'])
@jwt_required()
def get_submitted_quiz_ids():
    """Get list of quiz IDs that student has already submitted"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can access this endpoint"}), 403

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        student_course = current_user.get('course')
        student_id = current_user.get('student_id')
        
        if not student_course or not student_id:
            return jsonify({"error": "Student information incomplete"}), 400

        try:
            students_collection = get_course_collection(db, student_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Get student document
        from bson import ObjectId
        student = students_collection.find_one({"_id": ObjectId(student_id)})
        
        if not student:
            return jsonify({"error": "Student not found"}), 404

        # Extract quiz IDs from quiz history
        quiz_history = student.get('quiz_history', [])
        submitted_quiz_ids = [q.get('quizId') for q in quiz_history if q.get('quizId')]
        
        # Remove duplicates
        submitted_quiz_ids = list(set(submitted_quiz_ids))
        
        print(f"📋 Student {student_id} has submitted {len(submitted_quiz_ids)} quizzes: {submitted_quiz_ids}")
        
        return jsonify({
            'success': True,
            'submittedQuizIds': submitted_quiz_ids
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting submitted quiz IDs: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error"}), 500


@auth_bp.route('/save-quiz-result', methods=['POST'])
@jwt_required()
def save_quiz_result():
    """Save quiz result to student document (keep only last 10)"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can save quiz results"}), 403

        data = request.get_json()
        topic = data.get('topic', '')
        difficulty = data.get('difficulty', '')
        score = data.get('score', 0)
        total_questions = data.get('totalQuestions', 10)
        time_taken = data.get('timeTaken', 0)  # in seconds
        quiz_id = data.get('quizId', None)  # Add quizId for tracking admin-sent quizzes
        
        if not topic or not difficulty:
            return jsonify({"error": "Topic and difficulty are required"}), 400

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        student_course = current_user.get('course')
        student_id = current_user.get('student_id')
        
        if not student_course or not student_id:
            return jsonify({"error": "Student information incomplete"}), 400

        try:
            students_collection = get_course_collection(db, student_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Create quiz result record
        quiz_result = {
            "topic": topic,
            "difficulty": difficulty,
            "score": score,
            "totalQuestions": total_questions,
            "percentage": round((score / total_questions) * 100, 2) if total_questions > 0 else 0,
            "timeTaken": time_taken,
            "completedAt": datetime.utcnow()
        }
        
        # Add quizId if this was an admin-sent quiz (for tracking submissions)
        if quiz_id:
            quiz_result["quizId"] = quiz_id

        # Get student document
        from bson import ObjectId
        student = students_collection.find_one({"_id": ObjectId(student_id)})
        
        if not student:
            return jsonify({"error": "Student not found"}), 404

        # Get existing quiz history
        quiz_history = student.get('quiz_history', [])
        
        # Add new result
        quiz_history.append(quiz_result)
        
        # Keep only last 10 results
        if len(quiz_history) > 10:
            quiz_history = quiz_history[-10:]
        
        # Update student document
        students_collection.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {"quiz_history": quiz_history}}
        )
        
        # Check and update achievements
        try:
            newly_unlocked = check_achievements(quiz_history)
            existing_badges = set(student.get('achievement_badges', []))
            updated_badges = existing_badges.union(set(newly_unlocked))
            
            students_collection.update_one(
                {"_id": ObjectId(student_id)},
                {"$set": {"achievement_badges": list(updated_badges)}}
            )
            
            new_badges = list(set(newly_unlocked) - existing_badges)
            if new_badges:
                print(f"🎉 Student {student_id} unlocked {len(new_badges)} new achievement(s): {new_badges}")
        except Exception as e:
            print(f"⚠️ Error checking achievements: {e}")
        
        if quiz_id:
            print(f"✅ Saved quiz result for student {student_id}: {score}/{total_questions} on {topic} (Quiz ID: {quiz_id})")
        else:
            print(f"✅ Saved quiz result for student {student_id}: {score}/{total_questions} on {topic} (Self-assessment)")
        
        return jsonify({
            "message": "Quiz result saved successfully",
            "score": score,
            "totalQuestions": total_questions,
            "percentage": quiz_result["percentage"],
            "historyCount": len(quiz_history)
        }), 200

    except Exception as e:
        print(f"❌ Error saving quiz result: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@auth_bp.route('/get-leaderboard', methods=['GET'])
@jwt_required()
def get_leaderboard():
    """Get leaderboard for all students in the course with their scores and ranks"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can view leaderboard"}), 403

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        student_course = current_user.get('course')
        student_id = current_user.get('student_id')
        
        if not student_course or not student_id:
            return jsonify({"error": "Student information incomplete"}), 400

        try:
            students_collection = get_course_collection(db, student_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Get all students in the course
        students = list(students_collection.find({}, {'password': 0}))
        
        # Calculate total score and average percentage for each student
        leaderboard_data = []
        for student in students:
            quiz_history = student.get('quiz_history', [])
            
            # Calculate total score (sum of all scores)
            total_score = sum(q.get('score', 0) for q in quiz_history)
            
            # Calculate average percentage
            percentages = [q.get('percentage', 0) for q in quiz_history if q.get('percentage', 0) > 0]
            avg_percentage = sum(percentages) / len(percentages) if percentages else 0
            
            # Count total quizzes taken
            total_quizzes = len(quiz_history)
            
            leaderboard_data.append({
                'student_id': str(student.get('_id')),
                'name': student.get('name', 'Unknown'),
                'student_id_field': student.get('student_id', ''),
                'email': student.get('email', ''),
                'total_score': total_score,
                'avg_percentage': round(avg_percentage, 2),
                'total_quizzes': total_quizzes,
                'is_current_user': str(student.get('_id')) == student_id
            })
        
        # Sort by total_score (descending), then by avg_percentage (descending)
        leaderboard_data.sort(key=lambda x: (x['total_score'], x['avg_percentage']), reverse=True)
        
        # Add rank to each student
        for index, student_data in enumerate(leaderboard_data):
            student_data['rank'] = index + 1
        
        # Find current user's position
        current_user_data = next((s for s in leaderboard_data if s['is_current_user']), None)
        current_user_rank = current_user_data['rank'] if current_user_data else None
        
        # Get students ahead and behind
        students_ahead = [s for s in leaderboard_data if s['rank'] < current_user_rank] if current_user_rank else []
        students_behind = [s for s in leaderboard_data if s['rank'] > current_user_rank] if current_user_rank else []
        
        print(f"📊 Leaderboard: {len(leaderboard_data)} students, Current user rank: {current_user_rank}")
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard_data,
            'current_user_rank': current_user_rank,
            'current_user_data': current_user_data,
            'students_ahead_count': len(students_ahead),
            'students_behind_count': len(students_behind),
            'total_students': len(leaderboard_data)
        }), 200

    except Exception as e:
        print(f"❌ Error getting leaderboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@auth_bp.route('/get-admin-leaderboard', methods=['GET'])
@jwt_required()
def get_admin_leaderboard():
    """Get leaderboard for admin showing all students ranked by achievement score"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'admin':
            return jsonify({"error": "Only admin can view admin leaderboard"}), 403

        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})
        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        admin_course = admin.get("course")
        if not admin_course:
            return jsonify({"error": "Admin is not linked to any course"}), 400

        try:
            students_collection = get_course_collection(db, admin_course)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        # Get all students in the course
        students = list(students_collection.find({}, {'password': 0}))
        
        # Calculate achievement score for each student
        leaderboard_data = []
        for student in students:
            achievement_badges = student.get('achievement_badges', [])
            achievement_score = len(achievement_badges)  # Number of achievements unlocked
            
            # Also get quiz stats for additional info
            quiz_history = student.get('quiz_history', [])
            total_quizzes = len(quiz_history)
            total_score = sum(q.get('score', 0) for q in quiz_history)
            
            leaderboard_data.append({
                'student_id': str(student.get('_id')),
                'name': student.get('name', 'Unknown'),
                'student_id_field': student.get('student_id', ''),
                'email': student.get('email', ''),
                'achievement_score': achievement_score,
                'achievement_badges': achievement_badges,  # List of achievement IDs
                'total_quizzes': total_quizzes,
                'total_score': total_score,
            })
        
        # Sort by achievement_score (descending), then by total_score (descending)
        leaderboard_data.sort(key=lambda x: (x['achievement_score'], x['total_score']), reverse=True)
        
        # Add rank to each student
        for index, student_data in enumerate(leaderboard_data):
            student_data['rank'] = index + 1
        
        print(f"📊 Admin Leaderboard: {len(leaderboard_data)} students ranked by achievements")
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard_data,
            'total_students': len(leaderboard_data)
        }), 200

    except Exception as e:
        print(f"❌ Error getting admin leaderboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ============================================================================
# ADMIN QUIZ ROUTES
# ============================================================================

@auth_bp.route('/send-quiz-to-class', methods=['POST'])
@jwt_required()
def send_quiz_to_class():
    """
    Admin sends a quiz to all students in their course
    Creates a quiz notification with timer
    """
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        
        topic = data.get('topic')
        difficulty = data.get('difficulty', 'easy')
        admin_id = data.get('adminId')
        course = data.get('course')
        
        if not all([topic, admin_id, course]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Generate quiz using LLM
        try:
            # Try to get from environment, otherwise use hardcoded key
            groq_api_key = os.environ.get("GROQ_API_KEY") or "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"
            
            if not groq_api_key:
                print("⚠️  GROQ_API_KEY not found")
                raise ValueError("GROQ_API_KEY not configured")
            
            # Use requests library directly to avoid groq client version issues
            import requests
            
            print(f"🤖 Generating AI quiz for topic: {topic}, difficulty: {difficulty}")
            
            # Add variety to quiz generation with timestamp and random aspects
            import random
            quiz_variant = random.randint(1, 1000)
            current_time = datetime.now().strftime("%Y%m%d%H%M%S")
            
            prompt = f"""Generate exactly 10 UNIQUE multiple choice questions about {topic} at {difficulty} difficulty level.
IMPORTANT: Make questions DIFFERENT from previous quizzes. Use varied question styles, different aspects, and diverse examples.

Quiz Variant ID: {quiz_variant}-{current_time}

Format your response as a JSON array with this exact structure:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0
  }}
]

Requirements:
- Create 10 completely unique questions
- Use varied question types (definition, application, analysis, comparison, problem-solving)
- Cover different subtopics and aspects of {topic}
- Ensure questions are educational and appropriate for college students
- correctAnswer should be the index (0-3) of the correct option
- Each quiz should be significantly different from any previous quiz on this topic"""

            # Use direct API call to avoid groq client version issues
            headers = {
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.9,  # Increased from 0.7 for more variation
                "max_tokens": 2000
            }
            
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code != 200:
                raise ValueError(f"API request failed with status {response.status_code}: {response.text}")
            
            import json
            import re
            response_json = response.json()
            response_text = response_json['choices'][0]['message']['content']
            print(f"📝 LLM Response received ({len(response_text)} chars)")
            
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            
            if json_match:
                quiz_questions = json.loads(json_match.group(0))
                print(f"✅ Successfully generated {len(quiz_questions)} AI questions")
            else:
                raise ValueError("No JSON array found in response")
                
        except Exception as llm_error:
            print(f"❌ LLM Error: {type(llm_error).__name__}: {str(llm_error)}")
            traceback.print_exc()
            print("⚠️  Using fallback sample questions instead")
            # Fallback questions
            quiz_questions = [
                {
                    "question": f"Sample question about {topic} (Question {i+1})?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctAnswer": 0
                } for i in range(10)
            ]
        
        # Generate unique quiz ID
        import uuid
        import hashlib
        quiz_id = str(uuid.uuid4())
        
        # Get all students from the course
        db = get_database()
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        course_collection = get_course_collection(db, course)
        students = list(course_collection.find({}))
        
        if not students:
            return jsonify({'error': 'No students found in this course'}), 404
        
        # Create quiz notification for each student
        quiz_notification = {
            'id': hashlib.md5(quiz_id.encode()).hexdigest()[:24],
            'type': 'quiz',
            'quizId': quiz_id,
            'title': f'Quiz: {topic}',
            'message': f'New {difficulty} quiz on {topic}. Duration: 10 minutes',
            'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'isRead': False,
            'deletedByStudent': False,
            'quizData': {
                'topic': topic,
                'difficulty': difficulty,
                'questions': quiz_questions,
                'duration': 600,  # 10 minutes in seconds
                'startTime': datetime.now().isoformat(),
                'endTime': (datetime.now() + timedelta(minutes=10)).isoformat()
            }
        }
        
        # Add notification to all students
        for student in students:
            student_notifications = student.get('notifications', [])
            student_notifications.insert(0, quiz_notification.copy())
            
            # Keep only last 50 notifications
            if len(student_notifications) > 50:
                student_notifications = student_notifications[:50]
            
            course_collection.update_one(
                {'_id': student['_id']},
                {'$set': {'notifications': student_notifications}}
            )
        
        return jsonify({
            'success': True,
            'quizId': quiz_id,
            'totalStudents': len(students),
            'message': f'Quiz sent to {len(students)} students'
        }), 200
        
    except Exception as e:
        print(f"Error sending quiz: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@auth_bp.route('/get-quiz-status/<quiz_id>', methods=['GET'])
@jwt_required()
def get_quiz_status(quiz_id):
    """Get submission status for a quiz"""
    try:
        current_user = get_jwt_identity()
        
        # Get admin's course from query params
        course = request.args.get('course')
        if not course:
            return jsonify({'error': 'Course parameter required'}), 400
        
        db = get_database()
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        course_collection = get_course_collection(db, course)
        students = list(course_collection.find({}))
        
        total_students = len(students)
        submitted = 0
        
        print(f"🔍 Checking quiz status for quiz_id: {quiz_id} in course: {course}")
        print(f"👥 Total students in course: {total_students}")
        
        # Count how many students have submitted this quiz
        for student in students:
            quiz_history = student.get('quiz_history', [])
            for quiz in quiz_history:
                if quiz.get('quizId') == quiz_id:
                    submitted += 1
                    print(f"✅ Student {student.get('email', 'unknown')} submitted quiz {quiz_id}")
                    break
        
        pending = total_students - submitted
        
        print(f"📊 Quiz Status - Submitted: {submitted}, Pending: {pending}")
        
        return jsonify({
            'totalStudents': total_students,
            'submitted': submitted,
            'pending': pending
        }), 200
        
    except Exception as e:
        print(f"Error getting quiz status: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@auth_bp.route('/finish-quiz/<quiz_id>', methods=['POST'])
@jwt_required()
def finish_quiz(quiz_id):
    """
    Finish quiz - auto-submit for all students who haven't submitted
    Mark quiz as expired in notifications
    """
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        course = data.get('course')
        
        if not course:
            return jsonify({'error': 'Course parameter required'}), 400
        
        db = get_database()
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        course_collection = get_course_collection(db, course)
        students = list(course_collection.find({}))
        
        auto_submitted = 0
        
        for student in students:
            # Check if student already submitted
            quiz_history = student.get('quiz_history', [])
            already_submitted = any(q.get('quizId') == quiz_id for q in quiz_history)
            
            # Get quiz topic and difficulty from notification
            notifications = student.get('notifications', [])
            quiz_topic = 'Quiz'
            quiz_difficulty = 'N/A'
            
            for notif in notifications:
                if notif.get('quizId') == quiz_id:
                    # Get the topic and difficulty from the quiz notification
                    if notif.get('quizData'):
                        if notif['quizData'].get('topic'):
                            quiz_topic = notif['quizData']['topic']
                        if notif['quizData'].get('difficulty'):
                            quiz_difficulty = notif['quizData']['difficulty']
            
            if not already_submitted:
                # Auto-submit with 0 score using actual quiz topic and difficulty
                new_quiz_result = {
                    'quizId': quiz_id,
                    'topic': quiz_topic,
                    'difficulty': quiz_difficulty,
                    'score': 0,
                    'totalQuestions': 10,
                    'percentage': 0,
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'time': datetime.now().strftime('%H:%M:%S'),
                    'autoSubmitted': True
                }
                
                quiz_history.insert(0, new_quiz_result)
                if len(quiz_history) > 10:
                    quiz_history = quiz_history[:10]
                
                # Check and update achievements for this student
                try:
                    newly_unlocked = check_achievements(quiz_history)
                    existing_badges = set(student.get('achievement_badges', []))
                    updated_badges = existing_badges.union(set(newly_unlocked))
                    
                    course_collection.update_one(
                        {'_id': student['_id']},
                        {
                            '$set': {
                                'quiz_history': quiz_history,
                                'achievement_badges': list(updated_badges)
                            }
                        }
                    )
                except Exception as e:
                    print(f"⚠️ Error checking achievements for auto-submission: {e}")
                    # Still update quiz history even if achievement check fails
                    course_collection.update_one(
                        {'_id': student['_id']},
                        {'$set': {'quiz_history': quiz_history}}
                    )
                
                auto_submitted += 1
            
            # Mark quiz notification as expired and add finish notification
            for notif in notifications:
                if notif.get('quizId') == quiz_id:
                    notif['expired'] = True
                    notif['finishedByAdmin'] = True
            
            # Add a new notification informing student that quiz was finished by admin
            import hashlib
            finish_notification = {
                'id': hashlib.md5(f"{quiz_id}_finished_{student['_id']}".encode()).hexdigest()[:24],
                'type': 'alert',
                'title': f'Quiz Finished by Admin',
                'message': f'The quiz on "{quiz_topic}" has been finished by your instructor. You can no longer submit this quiz.',
                'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'isRead': False,
                'deletedByStudent': False,
                'priority': 'high'
            }
            
            notifications.insert(0, finish_notification)
            
            # Keep only last 50 notifications
            if len(notifications) > 50:
                notifications = notifications[:50]
            
            course_collection.update_one(
                {'_id': student['_id']},
                {'$set': {'notifications': notifications}}
            )
        
        return jsonify({
            'success': True,
            'autoSubmitted': auto_submitted,
            'message': f'Quiz finished. {auto_submitted} students auto-submitted.'
        }), 200
        
    except Exception as e:
        print(f"Error finishing quiz: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@auth_bp.route('/get-admin-quiz-history', methods=['GET'])
@jwt_required()
def get_admin_quiz_history():
    """
    Get history of all quizzes sent by admin with student results
    Returns quiz history with student-level details
    """
    try:
        current_user = get_jwt_identity()
        course = request.args.get('course')
        
        if not course:
            return jsonify({'error': 'Course parameter required'}), 400
        
        db = get_database()
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        course_collection = get_course_collection(db, course)
        students = list(course_collection.find({}))
        
        # Dictionary to store quiz history: { quizId: { quiz_data, students: [] } }
        quiz_history_map = {}
        
        # Process each student's quiz history
        for student in students:
            student_name = student.get('name', 'Unknown')
            student_email = student.get('email', 'unknown@email.com')
            quiz_history = student.get('quiz_history', [])
            
            for quiz in quiz_history:
                quiz_id = quiz.get('quizId')
                
                # Only include admin-sent quizzes (those with quizId)
                if not quiz_id:
                    continue
                
                # Initialize quiz entry if not exists
                if quiz_id not in quiz_history_map:
                    quiz_history_map[quiz_id] = {
                        'quizId': quiz_id,
                        'topic': quiz.get('topic', 'Unknown Topic'),
                        'difficulty': quiz.get('difficulty', 'N/A'),
                        'totalQuestions': quiz.get('totalQuestions', 10),
                        'sentDate': quiz.get('completedAt', datetime.utcnow()).strftime('%Y-%m-%d') if isinstance(quiz.get('completedAt'), datetime) else quiz.get('date', 'N/A'),
                        'sentTime': quiz.get('completedAt', datetime.utcnow()).strftime('%H:%M:%S') if isinstance(quiz.get('completedAt'), datetime) else quiz.get('time', 'N/A'),
                        'students': []
                    }
                
                # Add student result
                quiz_history_map[quiz_id]['students'].append({
                    'name': student_name,
                    'email': student_email,
                    'score': quiz.get('score', 0),
                    'totalQuestions': quiz.get('totalQuestions', 10),
                    'percentage': quiz.get('percentage', 0),
                    'autoSubmitted': quiz.get('autoSubmitted', False)
                })
        
        # Convert to list and sort by date (newest first)
        quiz_history_list = list(quiz_history_map.values())
        quiz_history_list.sort(key=lambda x: x['sentDate'], reverse=True)
        
        print(f"📊 Returning {len(quiz_history_list)} admin quizzes for course {course}")
        
        return jsonify({
            'success': True,
            'quizHistory': quiz_history_list,
            'totalQuizzes': len(quiz_history_list)
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting admin quiz history: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


# ============================================================================
# ACHIEVEMENTS SYSTEM
# ============================================================================

def check_achievements(quiz_history):
    """Check which achievements a student has unlocked based on their quiz history"""
    unlocked = []
    
    if not quiz_history or len(quiz_history) == 0:
        return unlocked
    
    # Helper functions
    def get_quizzes_by_difficulty(difficulty):
        return [q for q in quiz_history if q.get('difficulty', '').lower() == difficulty.lower()]
    
    def get_quizzes_by_topic(topic):
        return [q for q in quiz_history if q.get('topic', '').lower() == topic.lower()]
    
    def get_percentage(quiz):
        score = quiz.get('score', 0)
        total = quiz.get('totalQuestions', 10)
        return (score / total * 100) if total > 0 else 0
    
    def get_time_taken(quiz):
        return quiz.get('timeTaken', 0)  # in seconds
    
    # EASY ACHIEVEMENTS
    # 1. First Quiz
    if len(quiz_history) >= 1:
        unlocked.append('first_quiz')
    
    # 2. Perfect Score Easy
    easy_quizzes = get_quizzes_by_difficulty('easy')
    if any(get_percentage(q) == 100 for q in easy_quizzes):
        unlocked.append('perfect_score_easy')
    
    # 3. Three Quizzes
    if len(quiz_history) >= 3:
        unlocked.append('three_quizzes')
    
    # 4. Fast Learner (under 5 minutes = 300 seconds)
    if any(get_time_taken(q) < 300 for q in quiz_history):
        unlocked.append('fast_learner')
    
    # 5. Consistent Easy (80%+ on 2 easy quizzes)
    easy_80_plus = [q for q in easy_quizzes if get_percentage(q) >= 80]
    if len(easy_80_plus) >= 2:
        unlocked.append('consistent_easy')
    
    # MEDIUM ACHIEVEMENTS
    medium_quizzes = get_quizzes_by_difficulty('medium')
    
    # 6. Medium Master (10/10 on medium)
    if any(get_percentage(q) == 100 for q in medium_quizzes):
        unlocked.append('medium_master')
    
    # 7. Five Medium
    if len(medium_quizzes) >= 5:
        unlocked.append('five_medium')
    
    # 8. Two Perfect Medium
    perfect_medium = [q for q in medium_quizzes if get_percentage(q) == 100]
    if len(perfect_medium) >= 2:
        unlocked.append('two_perfect_medium')
    
    # 9. Different Topics (5 different topics)
    topics = set(q.get('topic', '').lower() for q in quiz_history if q.get('topic'))
    if len(topics) >= 5:
        unlocked.append('different_topics')
    
    # 10. Medium 80 Plus (80%+ on 3 medium)
    medium_80_plus = [q for q in medium_quizzes if get_percentage(q) >= 80]
    if len(medium_80_plus) >= 3:
        unlocked.append('medium_80_plus')
    
    # 11. Ten Quizzes
    if len(quiz_history) >= 10:
        unlocked.append('ten_quizzes')
    
    # 12. Three Topics Medium (90%+ on medium in 3 topics)
    medium_by_topic = {}
    for q in medium_quizzes:
        topic = q.get('topic', '').lower()
        if topic:
            if topic not in medium_by_topic:
                medium_by_topic[topic] = []
            medium_by_topic[topic].append(q)
    
    topics_90_plus = [topic for topic, quizzes in medium_by_topic.items() 
                      if any(get_percentage(q) >= 90 for q in quizzes)]
    if len(topics_90_plus) >= 3:
        unlocked.append('three_topics_medium')
    
    # 13. Streak Three (85%+ on 3 consecutive quizzes)
    if len(quiz_history) >= 3:
        # Check last 3 quizzes (most recent first)
        recent_three = quiz_history[-3:] if len(quiz_history) >= 3 else quiz_history
        if all(get_percentage(q) >= 85 for q in recent_three):
            unlocked.append('streak_three')
    
    # 14. Quick Medium (3 medium in under 4 minutes each = 240 seconds)
    quick_medium = [q for q in medium_quizzes if get_time_taken(q) < 240]
    if len(quick_medium) >= 3:
        unlocked.append('quick_medium')
    
    # 15. Balanced Performer (75%+ on 4 different topics)
    quizzes_by_topic = {}
    for q in quiz_history:
        topic = q.get('topic', '').lower()
        if topic and get_percentage(q) >= 75:
            if topic not in quizzes_by_topic:
                quizzes_by_topic[topic] = True
    
    if len(quizzes_by_topic) >= 4:
        unlocked.append('balanced_performer')
    
    # HARD ACHIEVEMENTS
    hard_quizzes = get_quizzes_by_difficulty('hard')
    
    # 16. Hard Perfect (10/10 on hard)
    if any(get_percentage(q) == 100 for q in hard_quizzes):
        unlocked.append('hard_perfect')
    
    # 17. Two Hard Perfect (10/10 on 2 hard with different topics)
    perfect_hard = [q for q in hard_quizzes if get_percentage(q) == 100]
    if len(perfect_hard) >= 2:
        perfect_hard_topics = set(q.get('topic', '').lower() for q in perfect_hard if q.get('topic'))
        if len(perfect_hard_topics) >= 2:
            unlocked.append('two_hard_perfect')
    
    # 18. Five Hard
    if len(hard_quizzes) >= 5:
        unlocked.append('five_hard')
    
    # 19. Hard Streak (90%+ on 3 consecutive hard)
    if len(hard_quizzes) >= 3:
        # Get last 3 hard quizzes
        hard_indices = [i for i, q in enumerate(quiz_history) if q.get('difficulty', '').lower() == 'hard']
        if len(hard_indices) >= 3:
            last_three_hard_indices = hard_indices[-3:]
            last_three_hard = [quiz_history[i] for i in last_three_hard_indices]
            if all(get_percentage(q) >= 90 for q in last_three_hard):
                unlocked.append('hard_streak')
    
    # 20. Ultimate Master (95%+ on 5 hard across 5 topics)
    hard_by_topic = {}
    for q in hard_quizzes:
        topic = q.get('topic', '').lower()
        if topic and get_percentage(q) >= 95:
            if topic not in hard_by_topic:
                hard_by_topic[topic] = True
    
    if len(hard_by_topic) >= 5:
        unlocked.append('ultimate_master')
    
    return unlocked


@auth_bp.route('/get-student-achievements', methods=['GET'])
@jwt_required()
def get_student_achievements():
    """Get student's unlocked achievement badges - Ultra-fast response to not block navigation"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can view achievements"}), 403
        
        db = get_database()
        if db is None:
            return jsonify({"success": True, "badges": []}), 200
        
        student_email = current_user['email']
        
        # Ultra-fast lookup - only check achievement_badges field, break on first match
        course_collections = ['roi_pa_31', 'roi_pa_32', 'roi_pa_33', 'roi_pa_34', 'roi_pa_35']
        
        for course in course_collections:
            try:
                collection = get_course_collection(db, course)
                # Minimal query - only achievement_badges field
                student = collection.find_one(
                    {"email": student_email}, 
                    {"achievement_badges": 1}
                )
                if student:
                    badges = student.get('achievement_badges', [])
                    return jsonify({"success": True, "badges": badges}), 200
            except:
                continue
        
        # Student not found - return empty immediately
        return jsonify({"success": True, "badges": []}), 200
        
    except Exception as e:
        print(f"❌ Error getting student achievements: {e}")
        # Always return success to not block frontend
        return jsonify({"success": True, "badges": []}), 200


@auth_bp.route('/check-achievements', methods=['POST'])
@jwt_required()
def check_achievements_endpoint():
    """Check and update student achievements - Returns immediately to not block navigation"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can check achievements"}), 403
        
        db = get_database()
        if db is None:
            return jsonify({"success": True, "badges": [], "newBadges": []}), 200
        
        student_email = current_user['email']
        
        # Quick student lookup - only fetch achievement_badges field
        course_collections = ['roi_pa_31', 'roi_pa_32', 'roi_pa_33', 'roi_pa_34', 'roi_pa_35']
        student = None
        students_collection = None
        
        for course in course_collections:
            try:
                collection = get_course_collection(db, course)
                student = collection.find_one({"email": student_email}, {"achievement_badges": 1, "quiz_history": 1, "_id": 1})
                if student:
                    students_collection = collection
                    break
            except:
                continue
        
        # Return immediately with existing badges if student not found
        if not student:
            return jsonify({"success": True, "badges": [], "newBadges": []}), 200
        
        # Get existing badges first - return immediately
        existing_badges = student.get('achievement_badges', [])
        quiz_history = student.get('quiz_history', [])
        
        # If no quiz history, return existing badges immediately
        if not quiz_history or len(quiz_history) == 0:
            return jsonify({
                "success": True,
                "badges": existing_badges,
                "newBadges": []
            }), 200
        
        # Do achievement checking in background thread to not block response
        def update_achievements_async():
            try:
                newly_unlocked = check_achievements(quiz_history)
                existing_set = set(existing_badges)
                updated_badges = existing_set.union(set(newly_unlocked))
                
                students_collection.update_one(
                    {"_id": student["_id"]},
                    {"$set": {"achievement_badges": list(updated_badges)}}
                )
                
                new_badges = list(set(newly_unlocked) - existing_set)
                if new_badges:
                    print(f"✅ Updated achievements for student {student_email}: {len(new_badges)} new badges")
            except Exception as bg_error:
                print(f"⚠️ Background achievement update error: {bg_error}")
        
        # Start background thread for checking - don't wait for it
        Thread(target=update_achievements_async, daemon=True).start()
        
        # Return immediately with existing badges - checking happens in background
        return jsonify({
            "success": True,
            "badges": existing_badges,
            "newBadges": []
        }), 200
        
    except Exception as e:
        print(f"❌ Error in check-achievements endpoint: {e}")
        traceback.print_exc()
        # Always return success to not block frontend
        return jsonify({"success": True, "badges": [], "newBadges": []}), 200