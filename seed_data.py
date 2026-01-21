from pymongo import MongoClient
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "fairway_foods")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_database():
    # Clear existing data
    db.users.delete_many({})
    db.golfcourses.delete_many({})
    db.menu.delete_many({})
    
    # Create golf courses
    courses = [
        {"name": "Royal Cape Golf Club", "location": "Cape Town", "active": True},
        {"name": "Durban Country Club", "location": "Durban", "active": True},
        {"name": "Glendower Golf Club", "location": "Johannesburg", "active": True},
        {"name": "Fancourt Links", "location": "George", "active": True},
        {"name": "Pearl Valley Golf", "location": "Paarl", "active": True},
    ]
    
    result = db.golfcourses.insert_many(courses)
    course_ids = [str(id) for id in result.inserted_ids]
    print(f"Created {len(course_ids)} golf courses")
    
    # Create users
    users = [
        {
            "email": "super@golf.com",
            "password": hash_password("super123"),
            "name": "Super Admin",
            "role": "superuser",
            "status": "approved",
            "courseIds": course_ids,
        },
        {
            "email": "admin@golf.com",
            "password": hash_password("admin123"),
            "name": "Admin User",
            "role": "admin",
            "status": "approved",
            "courseIds": [course_ids[0]],
        },
        {
            "email": "kitchen@golf.com",
            "password": hash_password("kitchen123"),
            "name": "Kitchen Staff",
            "role": "kitchen",
            "status": "approved",
            "courseIds": [course_ids[0]],
        },
        {
            "email": "cashier@golf.com",
            "password": hash_password("cashier123"),
            "name": "Cashier Staff",
            "role": "cashier",
            "status": "approved",
            "courseIds": [course_ids[0]],
        },
        {
            "email": "user@golf.com",
            "password": hash_password("user123"),
            "name": "Test User",
            "role": "user",
            "status": "approved",
            "courseIds": [course_ids[0]],
        },
    ]
    
    db.users.insert_many(users)
    print(f"Created {len(users)} users")
    
    # Create menu items for first course
    menu_items = [
        {"name": "Club Sandwich", "description": "Triple-decker sandwich", "price": 85.00, "category": "Mains", "available": True, "courseId": course_ids[0]},
        {"name": "Caesar Salad", "description": "Fresh romaine lettuce", "price": 75.00, "category": "Starters", "available": True, "courseId": course_ids[0]},
        {"name": "Beef Burger", "description": "200g beef patty", "price": 95.00, "category": "Mains", "available": True, "courseId": course_ids[0]},
        {"name": "Fish & Chips", "description": "Beer-battered hake", "price": 110.00, "category": "Mains", "available": True, "courseId": course_ids[0]},
        {"name": "Coca-Cola", "description": "330ml can", "price": 25.00, "category": "Beverages", "available": True, "courseId": course_ids[0]},
        {"name": "Castle Lager", "description": "340ml bottle", "price": 35.00, "category": "Beverages", "available": True, "courseId": course_ids[0]},
    ]
    
    db.menu.insert_many(menu_items)
    print(f"Created {len(menu_items)} menu items")
    
    print("\n✅ Database seeded successfully!")
    print("\nTest Credentials:")
    print("  Super User: super@golf.com / super123")
    print("  Admin: admin@golf.com / admin123")
    print("  Kitchen: kitchen@golf.com / kitchen123")
    print("  Cashier: cashier@golf.com / cashier123")
    print("  User: user@golf.com / user123")

if __name__ == "__main__":
    seed_database()
