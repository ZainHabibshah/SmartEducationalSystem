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
import re

# Create Blueprint
chatbot_bp = Blueprint('chatbot', __name__)

# Initialize RAG pipeline (singleton)
rag_pipeline = None

def _normalize_intent(value: str):
    v = (value or "").strip().lower()
    if v in {"timetable", "course", "student", "ai"}:
        return v
    return None

def _parse_intent_command(question: str):
    """
    Parse a leading slash command:
    /timetable, /course, /student
    Allows punctuation after command (e.g., '/course,'), and returns (intent, remaining_text).
    """
    raw = (question or "")
    left = raw.lstrip()
    m = re.match(r"^/(timetable|course|student|ai)\b", left, flags=re.IGNORECASE)
    if not m:
        return None, raw
    intent = (m.group(1) or "").lower()
    remaining = left[m.end():]
    remaining = re.sub(r"^[\s,.;:!?-]+", "", remaining).strip()
    return intent, remaining

def get_rag_pipeline():
    """Get or create RAG pipeline instance"""
    global rag_pipeline
    if rag_pipeline is None:
        try:
            # Initialize ChromaDB path
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            chroma_db_path = os.path.join(BASE_DIR, 'chroma_db')
            
            rag_pipeline = RAGPipeline(chroma_db_path=chroma_db_path)
            
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
        user_name = current_user.get('name', 'User')
        token_course = current_user.get('course')
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request payload"}), 400
        
        question = data.get('question', '').strip()
        body_intent = _normalize_intent(data.get('intent'))
        if not question:
            return jsonify({"error": "Question is required"}), 400
        if len(question) > 1200:
            return jsonify({"error": "Question is too long"}), 400

        if user_role not in {'admin', 'student'}:
            return jsonify({"error": "Unauthorized role for chatbot access"}), 403

        cmd_intent, question_after_cmd = _parse_intent_command(question)
        effective_intent = cmd_intent or body_intent
        question = question_after_cmd if cmd_intent else question
        
        # Get user's course (for students and admins)
        user_course = None
        db = connect_to_mongodb()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        # Prefer JWT course to avoid extra DB lookup.
        if token_course:
            user_course = token_course
        
        if user_role == 'admin' and not user_course:
            # Teacher (role 'admin'): Get their course from `admin` collection
            admin_collection = db.admin
            admin = admin_collection.find_one({"email": user_email})
            if admin:
                user_course = admin.get('course')
        elif user_role == 'student' and not user_course:
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
        
        # Reload embeddings if needed (schedules only).
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        schedules_embeddings_folder = os.path.join(BASE_DIR, 'embeddings', 'schedules')
        os.makedirs(schedules_embeddings_folder, exist_ok=True)
        
        # Rebuild schedules vectors each request so vectors stay in sync after upload/delete.
        pipeline.load_schedules_embeddings(schedules_embeddings_folder)
        
        # Answer the question
        result = pipeline.answer_question(
            question=question,
            user_email=user_email,
            user_role=user_role,
            user_course=user_course,
            db=db,
            user_name=user_name,
            intent=effective_intent,
        )
        
        return jsonify({
            "success": True,
            "answer": result.get("answer", "I couldn't process your question."),
            "query_type": result.get("query_type", "unknown"),
            "sources": result.get("sources", []),
            "intent": effective_intent,
        }), 200
    
    except Exception as e:
        print(f"❌ Chat error: {e}")
        traceback.print_exc()
        return jsonify({
            "error": "Server error while processing your question",
            "message": "internal_error"
        }), 500

@chatbot_bp.route('/health', methods=['GET'])
def chatbot_health_check():
    """Health check endpoint for chatbot service"""
    try:
        pipeline = get_rag_pipeline()
        groq_key = getattr(pipeline, "_groq_api_key", None)
        vector_counts = pipeline.get_vector_counts() if pipeline else {"timetable": 0, "schedules": 0, "attendance": 0}
        status = {
            "status": "healthy",
            "service": "chatbot",
            "embeddings_available": pipeline.embeddings is not None,
            "llm_available": pipeline.llm is not None,
            "groq_api_configured": bool(groq_key),
            "groq_http_fallback": bool(groq_key),
            "timetable_store_loaded": pipeline.timetable_store is not None,
            "schedules_store_loaded": pipeline.schedules_store is not None,
            "attendance_store_loaded": pipeline.attendance_store is not None,
            "vector_counts": vector_counts,
        }
        return jsonify(status), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "service": "chatbot",
            "error": str(e)
        }), 500
