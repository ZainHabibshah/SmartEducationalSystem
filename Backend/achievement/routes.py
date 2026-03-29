# achievement/routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import connect_to_mongodb, get_course_collection
import traceback

achievement_bp = Blueprint('achievement', __name__)

def get_database():
    return connect_to_mongodb()


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


@achievement_bp.route('/get-student-achievements', methods=['GET'])
@jwt_required()
def get_student_achievements():
    """Get student's unlocked achievement badges"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can view achievements"}), 403
        
        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500
        
        student_email = current_user['email']
        
        # Find student in all course collections
        course_collections = ['roi_pa_31', 'roi_pa_32', 'roi_pa_33', 'roi_pa_34', 'roi_pa_35']
        student = None
        students_collection = None
        
        for course in course_collections:
            try:
                collection = get_course_collection(db, course)
                student = collection.find_one({"email": student_email})
                if student:
                    students_collection = collection
                    break
            except:
                continue
        
        if not student:
            return jsonify({"error": "Student not found"}), 404
        
        # Get unlocked badges
        badges = student.get('achievement_badges', [])
        
        return jsonify({
            "success": True,
            "badges": badges
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting student achievements: {e}")
        traceback.print_exc()
        return jsonify({"error": "Server error while fetching achievements"}), 500


@achievement_bp.route('/check-achievements', methods=['POST'])
@jwt_required()
def check_achievements_endpoint():
    """Check and update student achievements based on quiz history"""
    try:
        current_user = get_jwt_identity()
        
        if current_user['role'] != 'student':
            return jsonify({"error": "Only students can check achievements"}), 403
        
        db = get_database()
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500
        
        student_email = current_user['email']
        
        # Find student in all course collections
        course_collections = ['roi_pa_31', 'roi_pa_32', 'roi_pa_33', 'roi_pa_34', 'roi_pa_35']
        student = None
        students_collection = None
        
        for course in course_collections:
            try:
                collection = get_course_collection(db, course)
                student = collection.find_one({"email": student_email})
                if student:
                    students_collection = collection
                    break
            except:
                continue
        
        if not student:
            return jsonify({"error": "Student not found"}), 404
        
        # Get quiz history
        quiz_history = student.get('quiz_history', [])
        
        # Check achievements
        newly_unlocked = check_achievements(quiz_history)
        
        # Get existing badges
        existing_badges = set(student.get('achievement_badges', []))
        
        # Add newly unlocked badges
        updated_badges = existing_badges.union(set(newly_unlocked))
        
        # Update student document
        students_collection.update_one(
            {"_id": student["_id"]},
            {"$set": {"achievement_badges": list(updated_badges)}}
        )
        
        # Find newly unlocked (not in existing)
        new_badges = list(set(newly_unlocked) - existing_badges)
        
        print(f"✅ Updated achievements for student {student_email}: {len(new_badges)} new badges")
        
        return jsonify({
            "success": True,
            "badges": list(updated_badges),
            "newBadges": new_badges
        }), 200
        
    except Exception as e:
        print(f"❌ Error checking achievements: {e}")
        traceback.print_exc()
        return jsonify({"error": "Server error while checking achievements"}), 500
