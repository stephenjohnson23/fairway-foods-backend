from pymongo import MongoClient
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client["golf_meal_app"]

# Create sample golf courses
def create_golf_courses():
    courses = db["golfcourses"]
    if courses.count_documents({}) == 0:
        sample_courses = [
            {
                "name": "Pebble Beach Golf Links",
                "location": "Pebble Beach, CA",
                "description": "World-renowned coastal golf course",
                "active": True
            },
            {
                "name": "Augusta National",
                "location": "Augusta, GA",
                "description": "Home of the Masters Tournament",
                "active": True
            },
            {
                "name": "St Andrews Links",
                "location": "St Andrews, Scotland",
                "description": "The Home of Golf",
                "active": True
            }
        ]
        result = courses.insert_many(sample_courses)
        print(f"Created {len(sample_courses)} sample golf courses")
        return list(result.inserted_ids)
    else:
        print("Golf courses already exist")
        return [course["_id"] for course in courses.find()]

# Create admin user
def create_admin():
    users = db["users"]
    if not users.find_one({"email": "admin@golf.com"}):
        admin_user = {
            "email": "admin@golf.com",
            "password": bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "name": "Admin User",
            "role": "admin"
        }
        users.insert_one(admin_user)
        print("Admin user created: admin@golf.com / admin123")
    else:
        print("Admin user already exists")

# Create kitchen user
def create_kitchen():
    users = db["users"]
    if not users.find_one({"email": "kitchen@golf.com"}):
        kitchen_user = {
            "email": "kitchen@golf.com",
            "password": bcrypt.hashpw("kitchen123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "name": "Kitchen Staff",
            "role": "kitchen"
        }
        users.insert_one(kitchen_user)
        print("Kitchen user created: kitchen@golf.com / kitchen123")
    else:
        print("Kitchen user already exists")

# Create cashier user
def create_cashier():
    users = db["users"]
    if not users.find_one({"email": "cashier@golf.com"}):
        cashier_user = {
            "email": "cashier@golf.com",
            "password": bcrypt.hashpw("cashier123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "name": "Cashier",
            "role": "cashier"
        }
        users.insert_one(cashier_user)
        print("Cashier user created: cashier@golf.com / cashier123")
    else:
        print("Cashier user already exists")

# Create regular user
def create_regular_user():
    users = db["users"]
    if not users.find_one({"email": "user@golf.com"}):
        regular_user = {
            "email": "user@golf.com",
            "password": bcrypt.hashpw("user123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "name": "John Golfer",
            "role": "user"
        }
        users.insert_one(regular_user)
        print("Regular user created: user@golf.com / user123")
    else:
        print("Regular user already exists")

# Create sample menu items
def create_menu_items(course_ids):
    menuitems = db["menuitems"]
    if menuitems.count_documents({}) == 0:
        # Get first course ID as default
        default_course_id = str(course_ids[0])
        
        sample_items = [
            {
                "name": "Club Sandwich",
                "description": "Triple-decker with turkey, bacon, lettuce, and tomato",
                "price": 12.99,
                "category": "Sandwiches",
                "courseId": default_course_id,
                "available": True
            },
            {
                "name": "Caesar Salad",
                "description": "Crisp romaine with parmesan and garlic croutons",
                "price": 9.99,
                "category": "Salads",
                "courseId": default_course_id,
                "available": True
            },
            {
                "name": "Grilled Chicken Wrap",
                "description": "Grilled chicken with fresh vegetables in a tortilla wrap",
                "price": 11.99,
                "category": "Sandwiches",
                "courseId": default_course_id,
                "available": True
            },
            {
                "name": "French Fries",
                "description": "Crispy golden fries with sea salt",
                "price": 5.99,
                "category": "Sides",
                "courseId": default_course_id,
                "available": True
            },
            {
                "name": "Iced Tea",
                "description": "Freshly brewed iced tea",
                "price": 3.99,
                "category": "Beverages",
                "courseId": default_course_id,
                "available": True
            },
            {
                "name": "Lemonade",
                "description": "Fresh squeezed lemonade",
                "price": 3.99,
                "category": "Beverages",
                "courseId": default_course_id,
                "available": True
            },
            {
                "name": "Burger Deluxe",
                "description": "Juicy beef burger with cheese, lettuce, tomato, and special sauce",
                "price": 14.99,
                "category": "Burgers",
                "courseId": default_course_id,
                "available": True
            },
            {
                "name": "Fish & Chips",
                "description": "Beer-battered cod with crispy fries",
                "price": 15.99,
                "category": "Main Course",
                "courseId": default_course_id,
                "available": True
            }
        ]
        menuitems.insert_many(sample_items)
        print(f"Created {len(sample_items)} sample menu items for first course")
    else:
        print("Menu items already exist")

if __name__ == "__main__":
    print("Seeding database...")
    create_admin()
    create_kitchen()
    create_cashier()
    create_regular_user()
    course_ids = create_golf_courses()
    create_menu_items(course_ids)
    print("Database seeding complete!")
