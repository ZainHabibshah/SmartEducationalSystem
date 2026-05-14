# check_database.py
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()


def check_database():
    # MongoDB Atlas connection
    mongo_uri = os.getenv("MONGODB_URI", "").strip()
    if not mongo_uri:
        raise ValueError("MONGODB_URI is not defined. Add it to Backend/.env or your environment.")
    client = MongoClient(mongo_uri)
    db_name = os.getenv("MONGODB_DB_NAME", "smart_app_db").strip() or "smart_app_db"
    db = client[db_name]

    print("🔍 Checking database contents...")

    # Check Admin collection
    admin_collection = db["admin"]
    admin_count = admin_collection.count_documents({})
    print(f"📊 Admin documents count: {admin_count}")

    admins = list(admin_collection.find({}))
    for admin in admins:
        print(f"👤 Admin: {admin}")

    # Check per‑course student collections
    for coll_name in ["computerScience", "Chemistery", "Physics"]:
        coll = db[coll_name]
        count = coll.count_documents({})
        print(f"📊 {coll_name} documents count: {count}")
        for student in coll.find({}):
            print(f"🎓 [{coll_name}] Student: {student}")

    print("✅ Database check completed!")

if __name__ == "__main__":
    check_database()