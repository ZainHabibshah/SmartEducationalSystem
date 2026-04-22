# database.py
import os
from pymongo import MongoClient
import certifi

"""
Central MongoDB connection helpers.

⚠️ IMPORTANT – COLLECTION LAYOUT (requested design)
---------------------------------------------------
Database: smart_app_db
Collections:
  - admin           -> stores one document per course instructor/admin (role: 'admin', course field)
  - superadmins     -> stores platform-level super admin accounts (role: 'superadmin')
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

_mongo_client = None
_mongo_db = None

def _new_mongo_client(mongo_uri: str):
    return MongoClient(
        mongo_uri,
        # Keep auth endpoints responsive when Atlas is unreachable.
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
        socketTimeoutMS=30000,
        tls=True,
        tlsCAFile=certifi.where(),
        retryWrites=True,
    )


def connect_to_mongodb():
    """Direct MongoDB connection to the Atlas cluster and `smart_app_db`."""
    global _mongo_client, _mongo_db
    try:
        # Support legacy typo used in some local environments.
        mongo_uri = (
            os.getenv("MONGODB_URI", "").strip()
            or os.getenv("MONGOODB_URI", "").strip()
            or "mongodb+srv://Luffy:hab1457@ses.wmweowm.mongodb.net/"
        )
        db_name = os.getenv("MONGODB_DB_NAME", "smart_app_db").strip() or "smart_app_db"
        if "Luffy:hab1457" in mongo_uri:
            print("⚠️ Using fallback MongoDB URI from source code. Set MONGODB_URI in environment for production.")

        # Build a fresh client for each request to avoid stale sockets that can
        # hang login attempts for a long time on unstable networks.
        _mongo_client = _new_mongo_client(mongo_uri)
        _mongo_db = _mongo_client[db_name]
        _mongo_client.admin.command("ping")
        db = _mongo_db
        print(f"✅ Connected to MongoDB '{db_name}' successfully!")

        # Optional collection count diagnostics (disabled by default).
        # Running multiple count queries during login can add heavy delays when
        # the cluster is slow/unavailable.
        if os.getenv("DEBUG_DB_COUNTS", "").strip() == "1":
            try:
                admin_count = db["admin"].count_documents({})
                superadmin_count = db["superadmins"].count_documents({})
                cs_count = db["computerScience"].count_documents({})
                chem_count = db["Chemistery"].count_documents({})
                phy_count = db["Physics"].count_documents({})
                print(
                    f"📊 Admin: {admin_count}, "
                    f"Super Admin: {superadmin_count}, "
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
        _mongo_client = None
        _mongo_db = None
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