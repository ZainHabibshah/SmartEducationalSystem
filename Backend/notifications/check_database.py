# check_database.py
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

def check_database():
    # Your MongoDB Atlas connection
    mongo_uri = os.getenv("MONGODB_URI", "").strip()
    if not mongo_uri:
        raise ValueError("MONGODB_URI is not defined. Add it to Backend/.env or your environment.")
    client = MongoClient(mongo_uri)
    db_name = os.getenv("MONGODB_DB_NAME", "smart_app_db").strip() or "smart_app_db"
    db = client[db_name]
    
    print("🔍 Checking database contents...")
    
    # Check admin collection
    admin_collection = db.admin
    admin_count = admin_collection.count_documents({})
    print(f"📊 Admin documents count: {admin_count}")
    
    # List all admin documents
    admins = list(admin_collection.find({}))
    for admin in admins:
        print(f"👤 Admin: {admin}")
    
    # Check students collection
    students_collection = db.students
    student_count = students_collection.count_documents({})
    print(f"📊 Student documents count: {student_count}")
    
    # List all student documents
    students = list(students_collection.find({}))
    for student in students:
        print(f"🎓 Student: {student}")
    
    print("✅ Database check completed!")

if __name__ == "__main__":
    check_database()