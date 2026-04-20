# app.py - SIMPLE VERSION
import os
import sys
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

# Avoid long startup stalls when model hosts are unreachable.
# If models are already cached locally, modules load instantly; otherwise
# optional blueprints will fail fast and app still starts.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from auth.routes import auth_bp
from notifications.routes import notifications_bp

# Ensure Windows consoles that default to cp1252 don't crash on unicode log symbols.
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Environment variables loaded from .env file")
except ImportError:
    print("⚠️  python-dotenv not installed. Install with: pip install python-dotenv")
    print("⚠️  Environment variables will be loaded from system environment only")

app = Flask(__name__)

# Configuration
app.config['JWT_SECRET_KEY'] = 'your-super-secret-key-change-this'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600

# Initialize extensions
CORS(app, resources={
    r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]},
    r"/auth/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]},
})
jwt = JWTManager(app)

# Register blueprints - auth and notifications are always available
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(notifications_bp, url_prefix='/api/notifications')

# Register news blueprint
try:
    from news.routes import news_bp
    app.register_blueprint(news_bp, url_prefix='/api/news')
    print("✅ News blueprint registered")
except Exception as e:
    print(f"⚠️  News blueprint not available: {e}")

# Register optional blueprints (timetable and curriculum) - may fail if dependencies are missing
try:
    from timetable.routes import timetable_bp
    # Configure timetable module - save to uploads/timetables and embeddings/timetables
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads', 'timetables')
    app.config['EMBEDDINGS_FOLDER'] = os.path.join(BASE_DIR, 'embeddings', 'timetables')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EMBEDDINGS_FOLDER'], exist_ok=True)
    app.register_blueprint(timetable_bp, url_prefix='/api/timetable')
    print("✅ Timetable blueprint registered")
    print(f"📁 Timetable uploads folder: {app.config['UPLOAD_FOLDER']}")
    print(f"📁 Timetable embeddings folder: {app.config['EMBEDDINGS_FOLDER']}")
except Exception as e:
    print(f"⚠️  Timetable blueprint not available: {e}")

try:
    from curriculum.routes import curriculum_bp
    # Configure curriculum module
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    app.config['CURRICULUM_UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'curriculum', 'curriculum_uploads')
    app.config['CURRICULUM_EMBEDDINGS_FOLDER'] = os.path.join(BASE_DIR, 'curriculum', 'curriculum_embeddings')
    os.makedirs(app.config['CURRICULUM_UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['CURRICULUM_EMBEDDINGS_FOLDER'], exist_ok=True)
    app.register_blueprint(curriculum_bp, url_prefix='/api/curriculum')
    print("✅ Curriculum blueprint registered")
except Exception as e:
    print(f"⚠️  Curriculum blueprint not available: {e}")

# Register schedules blueprint
try:
    from schedules.routes import schedules_bp
    # Configure schedules module
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    app.config['SCHEDULES_UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads', 'schedules')
    os.makedirs(app.config['SCHEDULES_UPLOAD_FOLDER'], exist_ok=True)
    app.register_blueprint(schedules_bp, url_prefix='/api/schedules')
    print("✅ Schedules blueprint registered")
    print(f"📁 Schedules uploads folder: {app.config['SCHEDULES_UPLOAD_FOLDER']}")
except Exception as e:
    print(f"⚠️  Schedules blueprint not available: {e}")

# Register chatbot blueprint
try:
    from chatbot.routes import chatbot_bp
    # Configure chatbot module
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    app.config['CHATBOT_EMBEDDINGS_FOLDER'] = os.path.join(BASE_DIR, 'embeddings')
    os.makedirs(app.config['CHATBOT_EMBEDDINGS_FOLDER'], exist_ok=True)
    app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')
    print("✅ Chatbot blueprint registered")
except Exception as e:
    print(f"⚠️  Chatbot blueprint not available: {e}")
    import traceback
    traceback.print_exc()

# Course materials (PDF/DOCX/PPTX) → per-subject Chroma embeddings
try:
    from course_materials.routes import course_materials_bp
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    app.config['COURSE_MATERIALS_UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads', 'course_materials')
    os.makedirs(app.config['COURSE_MATERIALS_UPLOAD_FOLDER'], exist_ok=True)
    app.register_blueprint(course_materials_bp, url_prefix='/api/course-materials')
    print("✅ Course materials blueprint registered")
    print(f"📁 Course materials uploads: {app.config['COURSE_MATERIALS_UPLOAD_FOLDER']}")
except Exception as e:
    print(f"⚠️ Course materials blueprint not available: {e}")
    import traceback
    traceback.print_exc()

@app.route('/health')
def health_check():
    return jsonify({
        "status": "healthy", 
        "message": "Flask server is running",
        "timestamp": "2024-01-15T10:30:00Z"
    }), 200

if __name__ == '__main__':
    import sys
    import warnings
    backend_port = int(os.getenv("FLASK_PORT", "5000"))
    
    print(f"🚀 Starting Flask server on http://0.0.0.0:{backend_port}") 
    print(f"📱 For Android Emulator, use: http://10.0.2.2:{backend_port}")
    print("💻 For iOS Simulator/Physical Device, use your computer's IP address")
    
    # Fix for Windows threading issue with Flask reloader
    # Suppress the threading error that occurs on Windows (doesn't affect functionality)
    if sys.platform == 'win32':
        # Suppress noisy request logs on Windows terminals
        import logging
        logging.getLogger('werkzeug').setLevel(logging.ERROR)
        # Use no reloader on Windows for more reliable startup/network behavior.
        app.run(host='0.0.0.0', port=backend_port, debug=True, use_reloader=False, threaded=True)
    else:
        # On Linux/Mac, use normal reloader
        app.run(host='0.0.0.0', port=backend_port, debug=True, threaded=True)