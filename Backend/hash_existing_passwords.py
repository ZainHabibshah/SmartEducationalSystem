# hash_existing_passwords.py
import bcrypt
from pymongo import MongoClient

def hash_existing_passwords():
    # Your MongoDB Atlas connection
    client = MongoClient("mongodb+srv://SmartEducationalCompanion:03189043757@smarteducationalapp.fjrdgi1.mongodb.net/")
    db = client["EducationalAppData"]
    
    print("🔄 Hashing existing passwords...")
    
    # Hash admin password
    admin = db.admin.find_one({"email": "zainhabib@gmail.com"})
    if admin and isinstance(admin['password'], str):  # If password is plain text
        plain_password = admin['password']
        hashed_password = bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt())
        
        # Update the document
        db.admin.update_one(
            {"_id": admin['_id']},
            {"$set": {"password": hashed_password}}
        )
        print(f"✅ Admin password hashed: {admin['email']}")
    
    print("✅ Password hashing completed!")

if __name__ == "__main__":
    hash_existing_passwords()