# check_database.py
from pymongo import MongoClient

def check_database():
    # Your MongoDB Atlas connection
    client = MongoClient("mongodb+srv://Luffy:hab1457@ses.wmweowm.mongodb.net/")
    db = client["smart_app_db"]
    
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