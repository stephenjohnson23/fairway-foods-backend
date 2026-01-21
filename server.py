from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
from passlib.context import CryptContext
import bcrypt
import jwt
import os
import random
import string
from dotenv import load_dotenv

load_dotenv()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="Fairway Foods API", version="1.0.0")

# CORS - Allow your domains
origins = [
    "https://fairwayfoods.co.za",
    "https://www.fairwayfoods.co.za",
    "https://app.fairwayfoods.co.za",
    "http://localhost:3000",
    "http://localhost:8081",
    "*"  # Allow all for development - remove in strict production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "fairway_foods")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
users_collection = db["users"]
golfcourses_collection = db["golfcourses"]
menu_collection = db["menu"]
orders_collection = db["orders"]

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CourseCreate(BaseModel):
    name: str
    location: str
    description: Optional[str] = ""
    active: bool = True

class MenuItemCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    category: str
    available: bool = True
    courseId: str

class OrderCreate(BaseModel):
    items: List[dict]
    total: float
    customerName: str
    teeOffTime: Optional[str] = None
    courseId: str
    notes: Optional[str] = ""

# Dependencies
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def get_admin_or_super_user(user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "superuser"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def get_super_user(user: dict = Depends(get_current_user)):
    if user["role"] != "superuser":
        raise HTTPException(status_code=403, detail="Super user access required")
    return user

# Health check
@app.get("/")
async def root():
    return {"message": "Fairway Foods API is running", "status": "healthy"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}

# AUTH ENDPOINTS
@app.post("/api/auth/register")
async def register(user_data: UserCreate):
    existing_user = users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = {
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": "user",
        "status": "pending",
        "courseIds": [],
        "createdAt": datetime.utcnow(),
        "passwordChanged": False
    }
    
    result = users_collection.insert_one(new_user)
    
    return {
        "message": "Registration submitted. Waiting for admin approval.",
        "userId": str(result.inserted_id)
    }

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    user = users_collection.find_one({"email": user_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.get("status") == "pending":
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    if user.get("status") == "rejected":
        raise HTTPException(status_code=403, detail="Account has been rejected")
    
    token = create_access_token({"user_id": str(user["_id"]), "role": user["role"]})
    
    # Get default course info
    default_course = None
    default_course_id = user.get("defaultCourseId") or (user.get("courseIds", [None])[0] if user.get("courseIds") else None)
    if default_course_id:
        course = golfcourses_collection.find_one({"_id": ObjectId(default_course_id)})
        if course:
            default_course = {"id": str(course["_id"]), "name": course["name"]}
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "role": user["role"],
            "courseIds": user.get("courseIds", []),
            "defaultCourse": default_course
        }
    }

# PASSWORD RESET
@app.post("/api/auth/forgot-password")
async def forgot_password(data: dict):
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    user = users_collection.find_one({"email": email})
    if not user:
        return {"message": "If the email exists, a reset code has been sent"}
    
    reset_code = ''.join(random.choices(string.digits, k=6))
    expires = datetime.utcnow() + timedelta(hours=1)
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_password_token": reset_code, "reset_password_expires": expires}}
    )
    
    # Send email (if configured)
    try:
        from email_service import send_password_reset_email
        send_password_reset_email(email, reset_code)
    except Exception as e:
        print(f"Email sending failed: {e}")
    
    return {"message": "If the email exists, a reset code has been sent"}

@app.post("/api/auth/reset-password")
async def reset_password(data: dict):
    email = data.get("email")
    code = data.get("code")
    new_password = data.get("newPassword")
    
    if not all([email, code, new_password]):
        raise HTTPException(status_code=400, detail="Email, code, and new password are required")
    
    user = users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")
    
    if user.get("reset_password_token") != code:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    if user.get("reset_password_expires") and user["reset_password_expires"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset code has expired")
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password": hash_password(new_password), "passwordChanged": True},
            "$unset": {"reset_password_token": "", "reset_password_expires": ""}
        }
    )
    
    return {"message": "Password reset successfully"}

@app.post("/api/profile/change-password")
async def change_password(password_data: dict, user: dict = Depends(get_current_user)):
    current_password = password_data.get("currentPassword", "")
    new_password = password_data.get("newPassword", "")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    if not verify_password(current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hash_password(new_password), "passwordChanged": True}}
    )
    
    return {"message": "Password changed successfully"}

# COURSES
@app.get("/api/courses")
async def get_courses():
    courses = list(golfcourses_collection.find({"active": {"$ne": False}}))
    return [{"id": str(c["_id"]), "name": c["name"], "location": c.get("location", ""), "description": c.get("description", "")} for c in courses]

@app.get("/api/courses/my-courses")
async def get_my_courses(user: dict = Depends(get_current_user)):
    if user["role"] == "superuser":
        courses = list(golfcourses_collection.find({"active": {"$ne": False}}))
    else:
        course_ids = [ObjectId(cid) for cid in user.get("courseIds", [])]
        courses = list(golfcourses_collection.find({"_id": {"$in": course_ids}, "active": {"$ne": False}}))
    return [{"id": str(c["_id"]), "name": c["name"], "location": c.get("location", "")} for c in courses]

@app.post("/api/courses")
async def create_course(course: CourseCreate, user: dict = Depends(get_super_user)):
    course_dict = course.dict()
    course_dict["createdAt"] = datetime.utcnow()
    result = golfcourses_collection.insert_one(course_dict)
    return {"id": str(result.inserted_id), "message": "Course created successfully"}

@app.put("/api/courses/{course_id}")
async def update_course(course_id: str, course_data: dict, user: dict = Depends(get_super_user)):
    result = golfcourses_collection.update_one(
        {"_id": ObjectId(course_id)},
        {"$set": course_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"message": "Course updated successfully"}

@app.delete("/api/courses/{course_id}")
async def delete_course(course_id: str, user: dict = Depends(get_super_user)):
    result = golfcourses_collection.delete_one({"_id": ObjectId(course_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"message": "Course deleted successfully"}

# MENU
@app.get("/api/menu")
async def get_menu(courseId: Optional[str] = None):
    query = {}
    if courseId:
        query["courseId"] = courseId
    items = list(menu_collection.find(query))
    return [{"id": str(i["_id"]), **{k: v for k, v in i.items() if k != "_id"}} for i in items]

@app.post("/api/menu")
async def create_menu_item(item: MenuItemCreate, user: dict = Depends(get_admin_or_super_user)):
    if user["role"] != "superuser" and item.courseId not in user.get("courseIds", []):
        raise HTTPException(status_code=403, detail="You don't have access to this course")
    
    item_dict = item.dict()
    item_dict["createdAt"] = datetime.utcnow()
    result = menu_collection.insert_one(item_dict)
    return {"id": str(result.inserted_id), "message": "Menu item created"}

@app.put("/api/menu/{item_id}")
async def update_menu_item(item_id: str, item_data: dict, user: dict = Depends(get_admin_or_super_user)):
    existing = menu_collection.find_one({"_id": ObjectId(item_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    if user["role"] != "superuser" and existing.get("courseId") not in user.get("courseIds", []):
        raise HTTPException(status_code=403, detail="You don't have access to this course")
    
    menu_collection.update_one({"_id": ObjectId(item_id)}, {"$set": item_data})
    return {"message": "Menu item updated"}

@app.delete("/api/menu/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(get_admin_or_super_user)):
    existing = menu_collection.find_one({"_id": ObjectId(item_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    if user["role"] != "superuser" and existing.get("courseId") not in user.get("courseIds", []):
        raise HTTPException(status_code=403, detail="You don't have access to this course")
    
    menu_collection.delete_one({"_id": ObjectId(item_id)})
    return {"message": "Menu item deleted"}

# ORDERS
@app.get("/api/orders")
async def get_orders(courseId: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if courseId:
        query["courseId"] = courseId
    if status:
        query["status"] = status
    
    if user["role"] not in ["superuser", "admin", "kitchen", "cashier"]:
        query["userId"] = str(user["_id"])
    
    orders = list(orders_collection.find(query).sort("createdAt", -1))
    return [{"id": str(o["_id"]), **{k: v for k, v in o.items() if k != "_id"}} for o in orders]

@app.post("/api/orders")
async def create_order(order: OrderCreate, user: dict = Depends(get_current_user)):
    order_dict = order.dict()
    order_dict["userId"] = str(user["_id"])
    order_dict["status"] = "pending"
    order_dict["createdAt"] = datetime.utcnow()
    result = orders_collection.insert_one(order_dict)
    return {"id": str(result.inserted_id), "message": "Order placed successfully"}

@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: str, status_data: dict, user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "superuser", "kitchen", "cashier"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_status = status_data.get("status")
    if new_status not in ["pending", "preparing", "ready", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = orders_collection.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order status updated"}

@app.delete("/api/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(get_super_user)):
    result = orders_collection.delete_one({"_id": ObjectId(order_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted"}

# USERS (Admin)
@app.get("/api/users")
async def get_users(user: dict = Depends(get_super_user)):
    users = list(users_collection.find())
    return [{
        "id": str(u["_id"]),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u["role"],
        "status": u.get("status"),
        "courseIds": u.get("courseIds", []),
        "createdAt": u.get("createdAt")
    } for u in users]

@app.post("/api/users/create")
async def create_user(user_data: dict, user: dict = Depends(get_super_user)):
    email = user_data.get("email")
    name = user_data.get("name")
    password = user_data.get("password")
    role = user_data.get("role", "user")
    course_ids = user_data.get("courseIds", [])
    
    if not email or not name or not password:
        raise HTTPException(status_code=400, detail="Email, name, and password are required")
    
    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user = {
        "email": email,
        "password": hash_password(password),
        "name": name,
        "role": role,
        "status": "approved",
        "courseIds": course_ids,
        "createdAt": datetime.utcnow(),
        "passwordChanged": False
    }
    
    result = users_collection.insert_one(new_user)
    return {"message": "User created", "userId": str(result.inserted_id)}

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user_data: dict, user: dict = Depends(get_super_user)):
    update_fields = {}
    if "name" in user_data:
        update_fields["name"] = user_data["name"]
    if "email" in user_data:
        update_fields["email"] = user_data["email"]
    if "role" in user_data:
        update_fields["role"] = user_data["role"]
    if "courseIds" in user_data:
        update_fields["courseIds"] = user_data["courseIds"]
    if "password" in user_data and user_data["password"]:
        update_fields["password"] = hash_password(user_data["password"])
    
    result = users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User updated"}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_super_user)):
    result = users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@app.post("/api/users/{user_id}/approve")
async def approve_user(user_id: str, user: dict = Depends(get_super_user)):
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "approved"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User approved"}

@app.post("/api/users/{user_id}/reject")
async def reject_user(user_id: str, user: dict = Depends(get_super_user)):
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "rejected"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User rejected"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8001)))
