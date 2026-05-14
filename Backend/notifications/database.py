# database.py
import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING
from flask_pymongo import PyMongo

load_dotenv()

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
    app.config["MONGO_URI"] = os.getenv("MONGODB_URI", "mongodb://localhost:27017/EducationalAppData").strip()
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
        mongo_uri = os.getenv("MONGODB_URI", "").strip()
        if not mongo_uri:
            raise ValueError("MONGODB_URI is not defined. Add it to Backend/.env or your environment.")
        db_name = os.getenv("MONGODB_DB_NAME", "smart_app_db").strip() or "smart_app_db"
        client = MongoClient(mongo_uri, tls=True, tlsCAFile=certifi.where())
        db = client[db_name]
        print(f"✅ Connected to MongoDB '{db_name}' successfully!")

        # Verify collections exist and show counts
        admin_count = db.admin.count_documents({})
        students_count = db.students.count_documents({})
        print(f"✅ Found {admin_count} admin users and {students_count} students")

        return db
    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")
        return None
