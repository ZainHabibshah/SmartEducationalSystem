# database.py
from pymongo import MongoClient, ASCENDING
from flask_pymongo import PyMongo

# Initialize PyMongo
mongo = PyMongo()

def init_db(app):
    """Initialize database connection.

    NOTE:
    - For direct `MongoClient` usage we use the same Atlas cluster/database
      as `check_database.py` so the `admin` and `students` collections are
      consistent across the project.
    - If you want to use `flask_pymongo` elsewhere, update the URI below
      accordingly.
    """
    # Keep a reasonable default for flask_pymongo; direct connections below
    # use the Atlas cluster instead.
    app.config["MONGO_URI"] = "mongodb://localhost:27017/EducationalAppData"
    mongo.init_app(app)
    return mongo

def get_db():
    """Get database instance"""
    return mongo.db

def connect_to_mongodb():
    """Direct MongoDB connection using the same settings as `check_database.py`.

    This ensures the authentication code works with the `admin` document that
    already exists in your Atlas database.
    """
    try:
        # Same URI / DB name used in `check_database.py`
        client = MongoClient("mongodb+srv://Luffy:hab1457@ses.wmweowm.mongodb.net/")
        db = client["smart_app_db"]
        print("✅ Connected to MongoDB 'smart_app_db' successfully!")

        # Verify collections exist and show counts
        admin_count = db.admin.count_documents({})
        students_count = db.students.count_documents({})
        print(f"✅ Found {admin_count} admin users and {students_count} students")

        return db
    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")
        return None