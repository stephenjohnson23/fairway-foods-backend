from pymongo import MongoClient
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client["golf_meal_app"]

# Get first golf course
first_course = db["golfcourses"].find_one()
if first_course:
    course_id = str(first_course["_id"])
    
    # Update all menu items without courseId
    result = db["menuitems"].update_many(
        {"courseId": {"$exists": False}},
        {"$set": {"courseId": course_id}}
    )
    print(f"Updated {result.modified_count} menu items with courseId: {course_id}")
else:
    print("No golf courses found!")
