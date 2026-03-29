from flask import Flask
import os

def create_app():
    app = Flask(__name__)
    
    # App configuration
    app.config['SECRET_KEY'] = 'your-secret-key'
    
    # File upload configuration
    app.config['UPLOAD_FOLDER'] = 'uploads'
    app.config['EMBEDDINGS_FOLDER'] = 'embeddings'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Create necessary directories
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EMBEDDINGS_FOLDER'], exist_ok=True)
    
    # Register blueprints
    from routes import timetable_bp
    app.register_blueprint(timetable_bp, url_prefix='/api')
    
    # CORS setup
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    # Root endpoint
    @app.route('/')
    def home():
        return {
            'message': 'Timetable Processing API',
            'version': '1.0.0',
            'status': 'running'
        }
    
    return app

if __name__ == '__main__':
    app = create_app()
    print("🚀 Timetable API Server Started!")
    app.run(debug=True, host='0.0.0.0', port=5000)