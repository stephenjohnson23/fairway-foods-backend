from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
import bcrypt
import jwt
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client["golf_meal_app"]
users_collection = db["users"]
menuitems_collection = db["menuitems"]
orders_collection = db["orders"]
golfcourses_collection = db["golfcourses"]

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GolfCourse(BaseModel):
    name: str
    location: str
    description: Optional[str] = None
    active: bool = True

class GolfCourseUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None

class MenuItem(BaseModel):
    name: str
    description: str
    price: float
    category: str
    courseId: str
    image: Optional[str] = None
    available: bool = True

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    image: Optional[str] = None
    available: Optional[bool] = None

class OrderItem(BaseModel):
    menuItemId: str
    name: str
    price: float
    quantity: int

class CreateOrder(BaseModel):
    items: List[OrderItem]
    customerName: str
    teeOffTime: str
    totalAmount: float
    courseId: str

class UpdateOrderStatus(BaseModel):
    status: str

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("user_id")
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def get_super_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "superuser":
        raise HTTPException(status_code=403, detail="Super user access required")
    return user

# Auth Endpoints
@app.post("/api/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    if users_collection.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user with pending status
    user = {
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": "user",
        "status": "pending",  # New field for approval status
        "courseIds": [],
        "createdAt": datetime.utcnow()
    }
    result = users_collection.insert_one(user)
    
    # TODO: Send email to super user for approval
    # For now, return success message
    
    return {
        "message": "Registration submitted. Your account is pending approval by the administrator.",
        "userId": str(result.inserted_id),
        "status": "pending"
    }

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    user = users_collection.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": str(user["_id"])})
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "user")
        }
    }

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user")
    }

# Golf Course Endpoints
@app.get("/api/courses")
async def get_courses():
    courses = list(golfcourses_collection.find({"active": True}))
    for course in courses:
        course["id"] = str(course["_id"])
        del course["_id"]
    return courses

@app.post("/api/courses")
async def create_course(course: GolfCourse, user: dict = Depends(get_admin_user)):
    course_dict = course.dict()
    course_dict["createdAt"] = datetime.utcnow()
    result = golfcourses_collection.insert_one(course_dict)
    course_dict["id"] = str(result.inserted_id)
    del course_dict["_id"]
    return course_dict

@app.put("/api/courses/{course_id}")
async def update_course(course_id: str, course: GolfCourseUpdate, user: dict = Depends(get_admin_user)):
    update_data = {k: v for k, v in course.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = golfcourses_collection.update_one(
        {"_id": ObjectId(course_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    
    updated_course = golfcourses_collection.find_one({"_id": ObjectId(course_id)})
    updated_course["id"] = str(updated_course["_id"])
    del updated_course["_id"]
    return updated_course

@app.delete("/api/courses/{course_id}")
async def delete_course(course_id: str, user: dict = Depends(get_admin_user)):
    result = golfcourses_collection.delete_one({"_id": ObjectId(course_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"message": "Course deleted successfully"}

# Menu Endpoints
@app.get("/api/menu")
async def get_menu(courseId: Optional[str] = None):
    query = {}
    if courseId:
        query["courseId"] = courseId
    items = list(menuitems_collection.find(query))
    for item in items:
        item["id"] = str(item["_id"])
        del item["_id"]
    return items

@app.post("/api/menu")
async def create_menu_item(item: MenuItem, user: dict = Depends(get_admin_user)):
    item_dict = item.dict()
    item_dict["createdAt"] = datetime.utcnow()
    result = menuitems_collection.insert_one(item_dict)
    item_dict["id"] = str(result.inserted_id)
    del item_dict["_id"]
    return item_dict

@app.put("/api/menu/{item_id}")
async def update_menu_item(item_id: str, item: MenuItemUpdate, user: dict = Depends(get_admin_user)):
    update_data = {k: v for k, v in item.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = menuitems_collection.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    updated_item = menuitems_collection.find_one({"_id": ObjectId(item_id)})
    updated_item["id"] = str(updated_item["_id"])
    del updated_item["_id"]
    return updated_item

@app.delete("/api/menu/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(get_admin_user)):
    result = menuitems_collection.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"message": "Menu item deleted successfully"}

# Order Endpoints
@app.post("/api/orders")
async def create_order(order: CreateOrder):
    order_dict = order.dict()
    order_dict["status"] = "pending"
    order_dict["createdAt"] = datetime.utcnow()
    order_dict["userId"] = None  # For guest orders
    result = orders_collection.insert_one(order_dict)
    order_dict["id"] = str(result.inserted_id)
    del order_dict["_id"]
    return order_dict

@app.post("/api/orders/user")
async def create_user_order(order: CreateOrder, user: dict = Depends(get_current_user)):
    order_dict = order.dict()
    order_dict["status"] = "pending"
    order_dict["createdAt"] = datetime.utcnow()
    order_dict["userId"] = str(user["_id"])
    result = orders_collection.insert_one(order_dict)
    order_dict["id"] = str(result.inserted_id)
    del order_dict["_id"]
    return order_dict

@app.get("/api/orders")
async def get_orders():
    orders = list(orders_collection.find().sort("createdAt", -1))
    for order in orders:
        order["id"] = str(order["_id"])
        del order["_id"]
        if "createdAt" in order:
            order["createdAt"] = order["createdAt"].isoformat()
    return orders

@app.get("/api/orders/my-orders")
async def get_my_orders(user: dict = Depends(get_current_user)):
    orders = list(orders_collection.find({"userId": str(user["_id"])}).sort("createdAt", -1))
    for order in orders:
        order["id"] = str(order["_id"])
        del order["_id"]
        if "createdAt" in order:
            order["createdAt"] = order["createdAt"].isoformat()
    return orders

@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: str, status_update: UpdateOrderStatus):
    result = orders_collection.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": status_update.status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    updated_order = orders_collection.find_one({"_id": ObjectId(order_id)})
    updated_order["id"] = str(updated_order["_id"])
    del updated_order["_id"]
    if "createdAt" in updated_order:
        updated_order["createdAt"] = updated_order["createdAt"].isoformat()
    return updated_order

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# User Management Endpoints (Super User only)
@app.get("/api/users")
async def get_all_users(user: dict = Depends(get_super_user)):
    users = list(users_collection.find())
    for u in users:
        u["id"] = str(u["_id"])
        del u["_id"]
        del u["password"]  # Don't send passwords
        if "courseIds" not in u:
            u["courseIds"] = []
    return users

@app.post("/api/users/create")
async def create_user_by_super(user_data: dict, user: dict = Depends(get_super_user)):
    email = user_data.get("email")
    name = user_data.get("name")
    role = user_data.get("role", "user")
    course_ids = user_data.get("courseIds", [])
    
    # Check if user already exists
    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    if role not in ["user", "admin", "kitchen", "cashier", "superuser"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Create default password (user should change it)
    default_password = "change123"
    
    new_user = {
        "email": email,
        "password": hash_password(default_password),
        "name": name,
        "role": role,
        "courseIds": course_ids,
        "createdAt": datetime.utcnow(),
        "passwordChanged": False
    }
    
    result = users_collection.insert_one(new_user)
    
    return {
        "message": "User created successfully",
        "userId": str(result.inserted_id),
        "defaultPassword": default_password
    }

@app.put("/api/users/{user_id}/role")
async def update_user_role(user_id: str, role_data: dict, user: dict = Depends(get_super_user)):
    new_role = role_data.get("role")
    if new_role not in ["user", "admin", "kitchen", "cashier", "superuser"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": new_role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated successfully"}

@app.put("/api/users/{user_id}/courses")
async def update_user_courses(user_id: str, courses_data: dict, user: dict = Depends(get_super_user)):
    course_ids = courses_data.get("courseIds", [])
    
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"courseIds": course_ids}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Course assignments updated successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)