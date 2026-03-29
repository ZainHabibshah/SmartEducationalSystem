# database.py
from pymongo import MongoClient

"""
Central MongoDB connection helpers.

⚠️ IMPORTANT – COLLECTION LAYOUT (requested design)
---------------------------------------------------
Database: smart_app_db
Collections:
  - admin         -> stores one document per course‑instructor (role: 'admin', course field)
  - computerScience -> students of Computer Science course only
  - Chemistery      -> students of Chemistry course only
  - Physics         -> students of Physics course only

There is **no shared `students` collection** anymore. Every piece of
code that previously used `db.students` must instead choose the correct
course collection.
"""


COURSE_COLLECTIONS = {
    # key used in APIs / JWT -> MongoDB collection name
    "computerScience": "computerScience",
    "chemistry": "Chemistery",  # NOTE: collection name is intentionally spelled this way
    "physics": "Physics",
}


def connect_to_mongodb():
    """Direct MongoDB connection to the Atlas cluster and `smart_app_db`."""
    try:
        client = MongoClient(
            "mongodb+srv://Luffy:hab1457@ses.wmweowm.mongodb.net/"
        )
        db = client["smart_app_db"]
        print("✅ Connected to MongoDB 'smart_app_db' successfully!")

        # Helpful debug information about the new layout
        try:
            admin_count = db["admin"].count_documents({})
            cs_count = db["computerScience"].count_documents({})
            chem_count = db["Chemistery"].count_documents({})
            phy_count = db["Physics"].count_documents({})
            print(
                f"📊 Admin: {admin_count}, "
                f"CS students: {cs_count}, "
                f"Chemistry students: {chem_count}, "
                f"Physics students: {phy_count}"
            )
        except Exception as inner_exc:
            # Don't fail the whole connection just because counts failed
            print(f"⚠️ Could not read collection counts: {inner_exc}")

        return db
    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")
        return None


def get_course_collection(db, course_key: str):
    """
    Resolve a logical course key (e.g. 'computerScience', 'chemistry', 'physics')
    into the actual MongoDB collection object.
    """
    # PyMongo database objects don't support boolean testing - must compare with None
    if db is None:
        raise ValueError("Database connection is None. Cannot get course collection.")

    collection_name = COURSE_COLLECTIONS.get(course_key)
    if not collection_name:
        raise ValueError(f"Unknown course key: {course_key}")

    return db[collection_name]