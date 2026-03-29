"""
Chatbot API Routes
Handles chat requests from frontend
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
from database import connect_to_mongodb, get_course_collection
from chatbot.rag_pipeline import RAGPipeline
import traceback

# Create Blueprint
chatbot_bp = Blueprint('chatbot', __name__)

# Initialize RAG pipeline (singleton)
rag_pipeline = None

def get_rag_pipeline():
    """Get or create RAG pipeline instance"""
    global rag_pipeline
    if rag_pipeline is None:
        try:
            # Initialize ChromaDB path
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            chroma_db_path = os.path.join(BASE_DIR, 'chroma_db')
            
            rag_pipeline = RAGPipeline(chroma_db_path=chroma_db_path)
            
            # Load embeddings on startup (from existing embedding files, will be stored in ChromaDB)
            # Load timetable embeddings
            timetable_embeddings_folder = os.path.join(BASE_DIR, 'embeddings', 'timetables')
            if os.path.exists(timetable_embeddings_folder):
                rag_pipeline.load_timetable_embeddings(timetable_embeddings_folder)
            
            # Load schedules embeddings
            schedules_embeddings_folder = os.path.join(BASE_DIR, 'embeddings', 'schedules')
            if os.path.exists(schedules_embeddings_folder):
                rag_pipeline.load_schedules_embeddings(schedules_embeddings_folder)
        except Exception as e:
            print(f"⚠️  Chatbot: Failed to initialize RAG pipeline: {e}")
            import traceback
            traceback.print_exc()
    
    return rag_pipeline

@chatbot_bp.route('/chat', methods=['POST'])
@jwt_required()
def chat():
    """Handle chat messages from users"""
    try:
        current_user = get_jwt_identity()
        user_email = current_user.get('email')
        user_role = current_user.get('role')
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request payload"}), 400
        
        question = data.get('question', '').strip()
        if not question:
            return jsonify({"error": "Question is required"}), 400
        
        # Get user's course (for students and admins)
        user_course = None
        db = connect_to_mongodb()
        
        if user_role == 'admin':
            # Get admin's course
            admin_collection = db.admin
            admin = admin_collection.find_one({"email": user_email})
            if admin:
                user_course = admin.get('course')
        elif user_role == 'student':
            # Get student's course from their document
            # Try to find student in any course collection
            for course_key in ['computerScience', 'chemistry', 'physics']:
                try:
                    students_collection = get_course_collection(db, course_key)
                    student = students_collection.find_one({"email": user_email})
                    if student:
                        user_course = course_key
                        break
                except:
                    continue
        
        # Get RAG pipeline
        pipeline = get_rag_pipeline()
        
        # Reload embeddings if needed (for timetable and schedules)
        # Note: Once loaded into ChromaDB, they persist. Only reload if embedding files are updated.
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        timetable_embeddings_folder = os.path.join(BASE_DIR, 'embeddings', 'timetables')
        schedules_embeddings_folder = os.path.join(BASE_DIR, 'embeddings', 'schedules')
        os.makedirs(schedules_embeddings_folder, exist_ok=True)
        
        # Only reload if stores are not initialized (first time) or if files are newer
        # For now, we'll reload on each request to ensure latest data (can be optimized later)
        if not pipeline.timetable_store:
            pipeline.load_timetable_embeddings(timetable_embeddings_folder)
        if not pipeline.schedules_store:
            pipeline.load_schedules_embeddings(schedules_embeddings_folder)
        
        # Answer the question
        result = pipeline.answer_question(
            question=question,
            user_email=user_email,
            user_role=user_role,
            user_course=user_course,
            db=db
        )
        
        return jsonify({
            "success": True,
            "answer": result.get("answer", "I couldn't process your question."),
            "query_type": result.get("query_type", "unknown"),
            "sources": result.get("sources", [])
        }), 200
    
    except Exception as e:
        print(f"❌ Chat error: {e}")
        traceback.print_exc()
        return jsonify({
            "error": "Server error while processing your question",
            "message": str(e)
        }), 500

@chatbot_bp.route('/health', methods=['GET'])
def chatbot_health_check():
    """Health check endpoint for chatbot service"""
    try:
        pipeline = get_rag_pipeline()
        status = {
            "status": "healthy",
            "service": "chatbot",
            "embeddings_available": pipeline.embeddings is not None,
            "llm_available": pipeline.llm is not None,
            "timetable_store_loaded": pipeline.timetable_store is not None,
            "schedules_store_loaded": pipeline.schedules_store is not None,
            "attendance_store_loaded": pipeline.attendance_store is not None
        }
        return jsonify(status), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "service": "chatbot",
            "error": str(e)
        }), 500
