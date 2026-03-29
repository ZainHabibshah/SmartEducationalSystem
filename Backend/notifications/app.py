from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from routes import notifications_bp
import os

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Register blueprint
app.register_blueprint(notifications_bp)

# Store socketio instance for use in routes
app.config['socketio'] = socketio

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"✅ Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to notification server'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"❌ Client disconnected: {request.sid}")

@socketio.on('join_student_room')
def handle_join_room(data):
    """Allow client to join a student's notification room"""
    try:
        student_id = data.get('student_id')
        if student_id:
            join_room(student_id)
            print(f"👤 Client {request.sid} joined room: {student_id}")
            emit('joined_room', {
                'message': f'Joined notification room for student {student_id}',
                'student_id': student_id
            })
    except Exception as e:
        print(f"❌ Error joining room: {e}")
        emit('error', {'message': str(e)})

if __name__ == '__main__':
    print("🚀 Starting Notification Server...")
    print("📡 WebSocket support enabled")
    print("🔌 Server running on http://localhost:5000")
    print("📚 MongoDB Collection: students")
    print("🔔 Notification Limit: 6 per student")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

