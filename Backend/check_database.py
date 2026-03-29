# check_database.py
from pymongo import MongoClient


def check_database():
    # MongoDB Atlas connection
    client = MongoClient("mongodb+srv://Luffy:hab1457@ses.wmweowm.mongodb.net/")
    db = client["smart_app_db"]

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