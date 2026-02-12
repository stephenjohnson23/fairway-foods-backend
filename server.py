from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
from email_service import send_registration_notification_to_admin, send_approval_email, send_rejection_email, send_password_reset_email, send_marketing_email, send_contact_form_email, send_custom_marketing_email, send_welcome_email, send_password_changed_email, send_order_confirmation_email
from whatsapp_service import send_order_confirmation_whatsapp, send_order_ready_whatsapp, send_order_status_whatsapp

load_dotenv()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()

# Serve the marketing website
WEBSITE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "website")

# Downloads page with clickable links
@app.get("/api/downloads", response_class=FileResponse)
async def downloads_page():
    """HTML page with download links"""
    from fastapi.responses import HTMLResponse
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fairway Foods - Downloads</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            h1 { color: #2e7d32; }
            .download-btn { 
                display: block; 
                background: #2e7d32; 
                color: white; 
                padding: 15px 25px; 
                text-decoration: none; 
                border-radius: 8px; 
                margin: 15px 0;
                text-align: center;
            }
            .download-btn:hover { background: #1b5e20; }
            .view-btn { 
                display: block; 
                background: #17a2b8; 
                color: white; 
                padding: 10px 20px; 
                text-decoration: none; 
                border-radius: 8px; 
                margin: 10px 0;
                text-align: center;
                font-size: 14px;
            }
            .view-btn:hover { background: #138496; }
            .section { margin: 30px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; }
            h3 { margin-top: 0; }
        </style>
    </head>
    <body>
        <h1>⛳ Fairway Foods Downloads</h1>
        
        <div class="section">
            <h3>🌐 Marketing Website (with WhatsApp button)</h3>
            <a class="download-btn" href="/api/download-website" download>Download website.zip</a>
            <a class="view-btn" href="/api/view-website-source" target="_blank">📄 View Source (Copy & Paste)</a>
        </div>
        
        <div class="section">
            <h3>📱 Web App (with WhatsApp button)</h3>
            <a class="download-btn" href="/api/download-html" download>Download index.html</a>
            <a class="download-btn" href="/api/download-webapp" download>Download webapp.zip (Full Package)</a>
            <a class="view-btn" href="/api/view-source" target="_blank">📄 View Source (Copy & Paste)</a>
        </div>
        
        <div class="section">
            <h3>⚙️ Backend Files</h3>
            <a class="download-btn" href="/api/download-backend" download>Download backend.zip (Render-ready)</a>
        </div>
        
        <div class="section">
            <h3>📧 Email Templates</h3>
            <a class="download-btn" href="/api/download-email-templates" download>Download email_templates.zip</a>
        </div>
        
        <hr>
        <p><small>If downloads don't start, right-click and select "Save link as..."</small></p>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# Download endpoint for website ZIP
@app.get("/api/download-website")
async def download_website():
    zip_path = os.path.join(os.path.dirname(__file__), "fairway-foods-website.zip")
    if os.path.exists(zip_path):
        return FileResponse(
            path=zip_path,
            filename="fairway-foods-website.zip",
            media_type="application/zip"
        )
    raise HTTPException(status_code=404, detail="ZIP file not found")

@app.get("/api/view-website-source")
async def view_website_source():
    """View the raw website HTML source code as plain text"""
    html_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "website", "index.html")
    if os.path.exists(html_path):
        return FileResponse(
            path=html_path, 
            media_type="text/plain",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    raise HTTPException(status_code=404, detail="Website index.html not found")

@app.get("/api/view-server-py")
async def view_server_py():
    """View the server.py source code as plain text"""
    py_path = os.path.join(os.path.dirname(__file__), "server.py")
    if os.path.exists(py_path):
        return FileResponse(
            path=py_path, 
            media_type="text/plain",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )
    raise HTTPException(status_code=404, detail="server.py not found")

@app.post("/api/debug/check-password")
async def debug_check_password(data: dict):
    """Debug endpoint to check password fields for a user"""
    email = data.get("email")
    test_password = data.get("password")
    
    if not email:
        return {"error": "Email required"}
    
    user = users_collection.find_one({"email": email})
    if not user:
        return {"error": "User not found", "email": email}
    
    result = {
        "email": email,
        "has_password_field": "password" in user,
        "has_hashed_password_field": "hashed_password" in user,
        "password_field_starts_with": user.get("password", "")[:20] + "..." if user.get("password") else None,
        "hashed_password_field_starts_with": user.get("hashed_password", "")[:20] + "..." if user.get("hashed_password") else None,
    }
    
    if test_password:
        # Test bcrypt on password field
        if user.get("password"):
            try:
                result["bcrypt_password_valid"] = verify_password(test_password, user["password"])
            except Exception as e:
                result["bcrypt_password_error"] = str(e)
        
        # Test passlib on hashed_password field
        if user.get("hashed_password"):
            try:
                result["passlib_hashed_password_valid"] = pwd_context.verify(test_password, user["hashed_password"])
            except Exception as e:
                result["passlib_hashed_password_error"] = str(e)
        
        # Test passlib on password field (in case it was hashed with passlib)
        if user.get("password"):
            try:
                result["passlib_password_valid"] = pwd_context.verify(test_password, user["password"])
            except Exception as e:
                result["passlib_password_error"] = str(e)
    
    return result

@app.get("/api/debug/list-users")
async def debug_list_users():
    """Debug endpoint to list all users (emails and roles only)"""
    users = list(users_collection.find({}, {"email": 1, "role": 1, "name": 1, "status": 1}))
    return [
        {
            "id": str(u["_id"]),
            "email": u.get("email"),
            "name": u.get("name"),
            "role": u.get("role"),
            "status": u.get("status")
        }
        for u in users
    ]

@app.get("/api/download-webapp")
async def download_webapp():
    """Download the web app build as a ZIP file for self-hosting"""
    zip_path = os.path.join(os.path.dirname(__file__), "fairway-webapp.zip")
    if os.path.exists(zip_path):
        return FileResponse(zip_path, filename="fairway-webapp.zip", media_type="application/zip")
    raise HTTPException(status_code=404, detail="Web app ZIP not found")

@app.get("/api/download-html")
async def download_html():
    """Download just the index.html file directly"""
    html_path = os.path.join(os.path.dirname(__file__), "webapp_build", "index.html")
    if os.path.exists(html_path):
        return FileResponse(
            path=html_path, 
            filename="index.html", 
            media_type="text/html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    raise HTTPException(status_code=404, detail="index.html not found")

@app.get("/api/preview-app")
async def preview_app():
    """Preview the app without downloading"""
    html_path = os.path.join(os.path.dirname(__file__), "webapp_build", "index.html")
    if os.path.exists(html_path):
        return FileResponse(
            path=html_path, 
            media_type="text/html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    raise HTTPException(status_code=404, detail="index.html not found")

@app.get("/api/view-source")
async def view_source():
    """View the raw HTML source code as plain text"""
    html_path = os.path.join(os.path.dirname(__file__), "webapp_build", "index.html")
    if os.path.exists(html_path):
        return FileResponse(
            path=html_path, 
            media_type="text/plain",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    raise HTTPException(status_code=404, detail="index.html not found")

@app.get("/api/facebook-banner")
async def get_facebook_banner():
    """View the Facebook banner HTML"""
    html_path = os.path.join(os.path.dirname(__file__), "webapp_build", "facebook-banner.html")
    if os.path.exists(html_path):
        return FileResponse(
            path=html_path, 
            media_type="text/html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    raise HTTPException(status_code=404, detail="Facebook banner not found")

@app.get("/api/download-backend")
async def download_backend():
    """Download the backend code for Render.com deployment"""
    zip_path = os.path.join(os.path.dirname(__file__), "fairway-backend-render.zip")
    if os.path.exists(zip_path):
        return FileResponse(zip_path, filename="fairway-backend-render.zip", media_type="application/zip")
    raise HTTPException(status_code=404, detail="Backend ZIP not found")

@app.get("/api/download-email-templates")
async def download_email_templates():
    """Download email templates"""
    zip_path = os.path.join(os.path.dirname(__file__), "email_templates.zip")
    if os.path.exists(zip_path):
        return FileResponse(zip_path, filename="email_templates.zip", media_type="application/zip")
    raise HTTPException(status_code=404, detail="Email templates ZIP not found")

if os.path.exists(WEBSITE_DIR):
    app.mount("/website", StaticFiles(directory=WEBSITE_DIR, html=True), name="website")

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
DB_NAME = os.getenv("DB_NAME", "golf_meal_app")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]
users_collection = db["users"]
menuitems_collection = db["menuitems"]
orders_collection = db["orders"]
golfcourses_collection = db["golfcourses"]

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

security = HTTPBearer()

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    courseId: Optional[str] = None  # Optional golf course selection

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

class UserProfile(BaseModel):
    name: Optional[str] = None
    displayName: Optional[str] = None
    phone: Optional[str] = None
    membershipNumber: Optional[str] = None

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
    except jwt.InvalidTokenError:
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
    course_ids = [user_data.courseId] if user_data.courseId else []
    user = {
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": "user",
        "status": "pending",  # New field for approval status
        "courseIds": course_ids,
        "defaultCourseId": user_data.courseId,
        "createdAt": datetime.utcnow()
    }
    result = users_collection.insert_one(user)
    
    # Get all superuser emails and notify them
    try:
        superusers = list(users_collection.find({"role": "superuser"}, {"email": 1}))
        superuser_emails = [su["email"] for su in superusers if su.get("email")]
        
        if superuser_emails:
            await send_registration_notification_to_admin(superuser_emails, user_data.email, user_data.name)
            print(f"Registration notification sent to {len(superuser_emails)} superuser(s)")
        else:
            print("No superusers found to notify")
    except Exception as e:
        print(f"Failed to send admin notification email: {str(e)}")
    
    # Send welcome email to user
    try:
        await send_welcome_email(user_data.email, user_data.name)
    except Exception as e:
        print(f"Failed to send welcome email: {str(e)}")
    
    return {
        "message": "Registration submitted. Your account is pending approval by the administrator.",
        "userId": str(result.inserted_id),
        "status": "pending"
    }

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    user = users_collection.find_one({"email": user_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check password - try both 'password' and 'hashed_password' fields for backward compatibility
    password_valid = False
    
    # First try the standard 'password' field (bcrypt)
    if user.get("password"):
        try:
            password_valid = verify_password(user_data.password, user["password"])
        except:
            pass
    
    # If not valid, try 'hashed_password' field (passlib) - for backward compatibility
    if not password_valid and user.get("hashed_password"):
        try:
            password_valid = pwd_context.verify(user_data.password, user["hashed_password"])
        except:
            pass
    
    if not password_valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if account is pending approval
    if user.get("status") == "pending":
        raise HTTPException(status_code=403, detail="Your account is pending approval by the administrator")
    
    # Check if account is rejected
    if user.get("status") == "rejected":
        raise HTTPException(status_code=403, detail="Your account registration was not approved")
    
    token = create_access_token({"user_id": str(user["_id"])})
    
    # Get default course info if set
    default_course = None
    default_course_id = user.get("defaultCourseId")
    if default_course_id:
        course = golfcourses_collection.find_one({"_id": ObjectId(default_course_id), "active": True})
        if course:
            default_course = {
                "id": str(course["_id"]),
                "name": course["name"]
            }
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "user"),
            "courseIds": user.get("courseIds", []),
            "defaultCourseId": user.get("defaultCourseId"),
            "defaultCourse": default_course,
            "profile": {
                "displayName": user.get("displayName", user["name"]),
                "phone": user.get("phone", ""),
                "membershipNumber": user.get("membershipNumber", "")
            }
        }
    }

# Password Reset Endpoints
def generate_reset_code():
    """Generate a 6-digit reset code"""
    return ''.join(random.choices(string.digits, k=6))

@app.post("/api/auth/forgot-password")
async def forgot_password(data: dict):
    """Request a password reset code"""
    email = data.get("email", "").strip()
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Case-insensitive email search
    user = users_collection.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    
    # For security, always return success even if user doesn't exist
    if not user:
        return {"message": "If an account with this email exists, a reset code has been sent"}
    
    # Generate reset code
    reset_code = generate_reset_code()
    reset_expires = datetime.utcnow() + timedelta(minutes=15)
    
    # Store reset code in database
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "resetCode": reset_code,
            "resetCodeExpires": reset_expires
        }}
    )
    
    # Send email with reset code
    email_sent = await send_password_reset_email(
        user_email=user["email"],
        user_name=user.get("name", "User"),
        reset_code=reset_code
    )
    
    if email_sent:
        return {"message": "Reset code sent to your email", "email_sent": True}
    else:
        # Email not configured - return the code for testing purposes
        return {
            "message": "Email service not configured. Use this code to reset your password.",
            "email_sent": False,
            "reset_code": reset_code  # Only for testing - remove in production
        }

@app.post("/api/auth/verify-reset-code")
async def verify_reset_code(data: dict):
    """Verify a password reset code"""
    email = data.get("email", "").lower().strip()
    code = data.get("code", "").strip()
    
    if not email or not code:
        raise HTTPException(status_code=400, detail="Email and code are required")
    
    user = users_collection.find_one({"email": email})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or code")
    
    stored_code = user.get("resetCode")
    expires = user.get("resetCodeExpires")
    
    if not stored_code or stored_code != code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    if not expires or datetime.utcnow() > expires:
        raise HTTPException(status_code=400, detail="Reset code has expired")
    
    return {"message": "Code verified successfully", "verified": True}

@app.post("/api/auth/reset-password")
async def reset_password(data: dict):
    """Reset password using verified code"""
    email = data.get("email", "").strip()
    code = data.get("code", "").strip()
    new_password = data.get("newPassword", "")
    
    if not email or not code or not new_password:
        raise HTTPException(status_code=400, detail="Email, code, and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Case-insensitive email search
    user = users_collection.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")
    
    stored_code = user.get("resetCode")
    expires = user.get("resetCodeExpires")
    
    if not stored_code or stored_code != code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    if not expires or datetime.utcnow() > expires:
        raise HTTPException(status_code=400, detail="Reset code has expired")
    
    # Hash new password and clear reset code
    hashed_password = hash_password(new_password)
    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password": hashed_password},
            "$unset": {"resetCode": "", "resetCodeExpires": ""}
        }
    )
    
    # Send password changed notification email
    try:
        await send_password_changed_email(user.get("email"), user.get("name", "User"))
    except Exception as e:
        print(f"Failed to send password changed email: {str(e)}")
    
    return {"message": "Password reset successfully"}

# Test Email Endpoint
class TestEmailRequest(BaseModel):
    to_email: EmailStr
    template: str = "club_manager_launch"

@app.post("/api/email/send-test")
async def send_test_email(request: TestEmailRequest):
    """Send a test marketing email"""
    success = await send_marketing_email(request.to_email, request.template)
    
    if success:
        return {"message": f"Test email sent successfully to {request.to_email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email. Check email service configuration.")

# Contact Form Endpoint
class ContactFormRequest(BaseModel):
    name: str
    email: EmailStr
    club: str
    phone: Optional[str] = ""
    message: Optional[str] = ""

@app.post("/api/contact")
async def submit_contact_form(request: ContactFormRequest):
    """Handle website contact form submissions"""
    success = await send_contact_form_email(
        name=request.name,
        email=request.email,
        club=request.club,
        phone=request.phone or "",
        message=request.message or ""
    )
    
    if success:
        return {"success": True, "message": "Thank you! We'll be in touch within 24 hours."}
    else:
        raise HTTPException(status_code=500, detail="Failed to send your message. Please try again or email us directly.")


# Marketing Email Endpoint
class MarketingEmailRequest(BaseModel):
    emails: List[str]  # List of email addresses
    subject: str
    message: str  # HTML or plain text message
    from_email: Optional[str] = "stephen@fairwayfoods.co.za"

@app.post("/api/marketing/send")
async def send_marketing_emails(request: MarketingEmailRequest, user: dict = Depends(get_current_user)):
    """Send marketing emails to a list of recipients (superuser only)"""
    
    # Only superusers can send marketing emails
    if user.get("role") != "superuser":
        raise HTTPException(status_code=403, detail="Only super users can send marketing emails")
    
    if not request.emails:
        raise HTTPException(status_code=400, detail="No email addresses provided")
    
    if not request.subject or not request.message:
        raise HTTPException(status_code=400, detail="Subject and message are required")
    
    # Clean up email list
    clean_emails = [e.strip() for e in request.emails if e.strip() and "@" in e]
    
    if not clean_emails:
        raise HTTPException(status_code=400, detail="No valid email addresses provided")
    
    # Build HTML email with nice styling
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">⛳ Fairway Foods</h1>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    {request.message}
                </div>
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p>Fairway Foods - Order food on the course</p>
                    <p><a href="https://fairwayfoods.co.za" style="color: #2e7d32;">fairwayfoods.co.za</a></p>
                </div>
            </div>
        </body>
    </html>
    """
    
    # Send emails
    results = await send_custom_marketing_email(
        to_emails=clean_emails,
        subject=request.subject,
        html_content=html_content,
        from_email=request.from_email
    )
    
    return {
        "success": True,
        "message": f"Sent {results['sent']} of {results['total']} emails",
        "results": results
    }


# Profile Endpoints
@app.get("/api/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user's profile"""
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "displayName": user.get("displayName", user["name"]),
        "phone": user.get("phone", ""),
        "membershipNumber": user.get("membershipNumber", ""),
        "role": user.get("role", "user")
    }

@app.put("/api/profile")
async def update_profile(profile: UserProfile, user: dict = Depends(get_current_user)):
    """Update current user's profile"""
    update_data = {k: v for k, v in profile.dict().items() if v is not None}
    
    if update_data:
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": update_data}
        )
    
    updated_user = users_collection.find_one({"_id": user["_id"]})
    return {
        "message": "Profile updated successfully",
        "profile": {
            "displayName": updated_user.get("displayName", updated_user["name"]),
            "phone": updated_user.get("phone", ""),
            "membershipNumber": updated_user.get("membershipNumber", "")
        }
    }

@app.put("/api/profile/password")
async def change_password(password_data: dict, user: dict = Depends(get_current_user)):
    """Change current user's password"""
    current_password = password_data.get("currentPassword", "")
    new_password = password_data.get("newPassword", "")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Verify current password
    if not pwd_context.verify(current_password, user.get("hashed_password", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash and save new password
    hashed_password = pwd_context.hash(new_password)
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    return {"message": "Password changed successfully"}

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user")
    }

def get_admin_or_super_user(user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin", "superuser"]:
        raise HTTPException(status_code=403, detail="Admin or Super user access required")
    return user

# Golf Course Endpoints
@app.get("/api/courses")
async def get_courses():
    """Get all active courses (for guests/public)"""
    courses = list(golfcourses_collection.find({"active": True}))
    for course in courses:
        course["id"] = str(course["_id"])
        del course["_id"]
    return courses

@app.get("/api/courses/my-courses")
async def get_my_courses(user: dict = Depends(get_current_user)):
    """Get courses assigned to the current user"""
    role = user.get("role", "user")
    
    # Super users can see all courses
    if role == "superuser":
        courses = list(golfcourses_collection.find({"active": True}))
    else:
        # Other users only see their assigned courses
        user_course_ids = user.get("courseIds", [])
        if not user_course_ids:
            return []
        
        # Convert string IDs to ObjectIds for query
        object_ids = [ObjectId(cid) for cid in user_course_ids if ObjectId.is_valid(cid)]
        courses = list(golfcourses_collection.find({
            "_id": {"$in": object_ids},
            "active": True
        }))
    
    for course in courses:
        course["id"] = str(course["_id"])
        del course["_id"]
    return courses

@app.get("/api/courses/all")
async def get_all_courses(user: dict = Depends(get_super_user)):
    """Get all courses including inactive ones (Super User only)"""
    courses = list(golfcourses_collection.find())
    for course in courses:
        course["id"] = str(course["_id"])
        del course["_id"]
    return courses

@app.post("/api/courses")
async def create_course(course: GolfCourse, user: dict = Depends(get_super_user)):
    """Create a new golf course (Super User only)"""
    course_dict = course.dict()
    course_dict["createdAt"] = datetime.utcnow()
    result = golfcourses_collection.insert_one(course_dict)
    course_dict["id"] = str(result.inserted_id)
    del course_dict["_id"]
    return course_dict

@app.put("/api/courses/{course_id}")
async def update_course(course_id: str, course: GolfCourseUpdate, user: dict = Depends(get_super_user)):
    """Update a golf course (Super User only)"""
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
async def delete_course(course_id: str, user: dict = Depends(get_super_user)):
    """Delete a golf course (Super User only)"""
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
async def create_menu_item(item: MenuItem, user: dict = Depends(get_admin_or_super_user)):
    # Check if admin has access to this course (super users have access to all)
    if user.get("role") == "admin":
        user_courses = user.get("courseIds", [])
        if item.courseId not in user_courses:
            raise HTTPException(status_code=403, detail="You don't have access to this course")
    
    item_dict = item.dict()
    item_dict["createdAt"] = datetime.utcnow()
    result = menuitems_collection.insert_one(item_dict)
    item_dict["id"] = str(result.inserted_id)
    del item_dict["_id"]
    return item_dict

@app.put("/api/menu/{item_id}")
async def update_menu_item(item_id: str, item: MenuItemUpdate, user: dict = Depends(get_admin_or_super_user)):
    # Check if admin has access to the menu item's course
    existing_item = menuitems_collection.find_one({"_id": ObjectId(item_id)})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    if user.get("role") == "admin":
        user_courses = user.get("courseIds", [])
        if existing_item.get("courseId") not in user_courses:
            raise HTTPException(status_code=403, detail="You don't have access to this course")
    
    update_data = {k: v for k, v in item.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = menuitems_collection.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": update_data}
    )
    
    updated_item = menuitems_collection.find_one({"_id": ObjectId(item_id)})
    updated_item["id"] = str(updated_item["_id"])
    del updated_item["_id"]
    return updated_item

@app.delete("/api/menu/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(get_admin_or_super_user)):
    # Check if admin has access to the menu item's course
    existing_item = menuitems_collection.find_one({"_id": ObjectId(item_id)})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    if user.get("role") == "admin":
        user_courses = user.get("courseIds", [])
        if existing_item.get("courseId") not in user_courses:
            raise HTTPException(status_code=403, detail="You don't have access to this course")
    
    result = menuitems_collection.delete_one({"_id": ObjectId(item_id)})
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
    order_id = str(result.inserted_id)
    order_dict["id"] = order_id
    del order_dict["_id"]
    
    # Send order confirmation email
    try:
        # Get course name
        course_name = "Your Golf Course"
        if order.courseId:
            course = golfcourses_collection.find_one({"_id": ObjectId(order.courseId)})
            if course:
                course_name = course.get("name", "Your Golf Course")
        
        # Generate order number (last 6 digits of order ID)
        order_number = order_id[-6:].upper()
        
        order_details = {
            "order_number": order_number,
            "items": [{"name": item.name, "quantity": item.quantity, "price": item.price} for item in order.items],
            "total": order.totalAmount,
            "tee_off_time": order.teeOffTime or "Not specified",
            "course_name": course_name
        }
        
        await send_order_confirmation_email(
            user.get("email"),
            user.get("name", "Valued Customer"),
            order_details
        )
        
        # Send WhatsApp notification if user has a phone number
        user_phone = user.get("phone") or user.get("whatsapp")
        if user_phone:
            await send_order_confirmation_whatsapp(
                user_phone,
                user.get("name", "Valued Customer"),
                order_details
            )
    except Exception as e:
        print(f"Failed to send order confirmation: {str(e)}")
    
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
    
    # Send WhatsApp notification when order is ready
    if status_update.status == "ready":
        try:
            user_id = updated_order.get("userId")
            if user_id:
                user = users_collection.find_one({"_id": ObjectId(user_id)})
                if user:
                    user_phone = user.get("phone") or user.get("whatsapp")
                    if user_phone:
                        order_number = order_id[-6:].upper()
                        await send_order_ready_whatsapp(
                            user_phone,
                            user.get("name", "Valued Customer"),
                            order_number
                        )
        except Exception as e:
            print(f"Failed to send order ready WhatsApp: {str(e)}")
    
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
        # Include default course info
        if u.get("defaultCourseId"):
            course = golfcourses_collection.find_one({"_id": ObjectId(u["defaultCourseId"])})
            if course:
                u["defaultCourseName"] = course["name"]
    return users

@app.put("/api/users/{user_id}/default-course")
async def set_default_course(user_id: str, data: dict, user: dict = Depends(get_super_user)):
    """Set or clear the default course for a user"""
    default_course_id = data.get("defaultCourseId")
    
    # Validate the course exists and user has access to it
    if default_course_id:
        # Check if course exists
        course = golfcourses_collection.find_one({"_id": ObjectId(default_course_id)})
        if not course:
            raise HTTPException(status_code=400, detail="Course not found")
        
        # Check if user is assigned to this course
        target_user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_courses = target_user.get("courseIds", [])
        if default_course_id not in user_courses:
            raise HTTPException(status_code=400, detail="User is not assigned to this course")
    
    # Update the user's default course
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"defaultCourseId": default_course_id}}
    )
    
    return {"message": "Default course updated successfully"}

@app.post("/api/users/create")
async def create_user_by_super(user_data: dict, user: dict = Depends(get_super_user)):
    email = user_data.get("email")
    name = user_data.get("name")
    password = user_data.get("password")
    role = user_data.get("role", "user")
    course_ids = user_data.get("courseIds", [])
    
    # Validation
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if user already exists
    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    if role not in ["user", "admin", "kitchen", "cashier", "superuser"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    new_user = {
        "email": email,
        "password": hash_password(password),
        "name": name,
        "role": role,
        "status": "approved",  # Admin-created users are auto-approved
        "courseIds": course_ids,
        "createdAt": datetime.utcnow(),
        "passwordChanged": False
    }
    
    result = users_collection.insert_one(new_user)
    
    return {
        "message": "User created successfully",
        "userId": str(result.inserted_id)
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

@app.post("/api/users/{user_id}/approve")
async def approve_user(user_id: str, user: dict = Depends(get_super_user)):
    target_user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "approved", "approvedAt": datetime.utcnow()}}
    )
    
    # Send approval email to user
    try:
        await send_approval_email(target_user["email"], target_user["name"])
    except Exception as e:
        print(f"Failed to send approval email: {str(e)}")
    
    return {"message": "User approved successfully", "email": target_user["email"]}

@app.post("/api/users/{user_id}/reject")
async def reject_user(user_id: str, rejection_data: dict, user: dict = Depends(get_super_user)):
    reason = rejection_data.get("reason", "No reason provided")
    target_user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "rejected", "rejectedAt": datetime.utcnow(), "rejectionReason": reason}}
    )
    
    # Send rejection email to user
    try:
        await send_rejection_email(target_user["email"], target_user["name"], reason)
    except Exception as e:
        print(f"Failed to send rejection email: {str(e)}")
    
    return {"message": "User rejected", "email": target_user["email"]}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_super_user)):
    """Delete a user (superuser only)"""
    target_user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting self
    if str(target_user["_id"]) == user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Prevent deleting other superusers
    if target_user.get("role") == "superuser":
        raise HTTPException(status_code=400, detail="Cannot delete superuser accounts")
    
    result = users_collection.delete_one({"_id": ObjectId(user_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user_data: dict, user: dict = Depends(get_super_user)):
    """Update user details (superuser only)"""
    target_user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {}
    
    if "name" in user_data:
        update_fields["name"] = user_data["name"]
    if "email" in user_data:
        # Check if email is already taken by another user
        existing = users_collection.find_one({"email": user_data["email"], "_id": {"$ne": ObjectId(user_id)}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = user_data["email"]
    if "role" in user_data:
        update_fields["role"] = user_data["role"]
    if "courseIds" in user_data:
        update_fields["courseIds"] = user_data["courseIds"]
    if "status" in user_data:
        update_fields["status"] = user_data["status"]
    if "password" in user_data and user_data["password"]:
        # Hash the new password using the same method as registration
        update_fields["password"] = hash_password(user_data["password"])
    
    if update_fields:
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
    
    return {"message": "User updated successfully"}

# Order Management Endpoints (Super User only)
@app.put("/api/orders/{order_id}")
async def update_order(order_id: str, order_data: dict, user: dict = Depends(get_super_user)):
    """Update order details (superuser only)"""
    existing_order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not existing_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_fields = {}
    
    if "customerName" in order_data:
        update_fields["customerName"] = order_data["customerName"]
    if "teeOffTime" in order_data:
        update_fields["teeOffTime"] = order_data["teeOffTime"]
    if "status" in order_data:
        update_fields["status"] = order_data["status"]
    if "items" in order_data:
        update_fields["items"] = order_data["items"]
        # Recalculate total if items changed
        update_fields["total"] = sum(item.get("price", 0) * item.get("quantity", 1) for item in order_data["items"])
    if "total" in order_data and "items" not in order_data:
        update_fields["total"] = order_data["total"]
    
    if update_fields:
        orders_collection.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": update_fields}
        )
    
    updated_order = orders_collection.find_one({"_id": ObjectId(order_id)})
    updated_order["id"] = str(updated_order["_id"])
    del updated_order["_id"]
    if "createdAt" in updated_order:
        updated_order["createdAt"] = updated_order["createdAt"].isoformat()
    
    return updated_order

@app.delete("/api/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(get_super_user)):
    """Delete an order (superuser only)"""
    existing_order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not existing_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    result = orders_collection.delete_one({"_id": ObjectId(order_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Order deleted successfully"}

# Serve the web app build
WEB_BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web-build")

# Mount static files for the web app build (must be before other routes)
if os.path.exists(WEB_BUILD_DIR):
    app.mount("/webapp/_expo", StaticFiles(directory=os.path.join(WEB_BUILD_DIR, "_expo")), name="webapp_expo")
    app.mount("/webapp/assets", StaticFiles(directory=os.path.join(WEB_BUILD_DIR, "assets")), name="webapp_assets")
    app.mount("/api/webapp/_expo", StaticFiles(directory=os.path.join(WEB_BUILD_DIR, "_expo")), name="api_webapp_expo")
    app.mount("/api/webapp/assets", StaticFiles(directory=os.path.join(WEB_BUILD_DIR, "assets")), name="api_webapp_assets")

@app.get("/webapp")
@app.get("/webapp/")
@app.get("/api/webapp")
@app.get("/api/webapp/")
async def serve_webapp_index():
    """Serve the web app index page"""
    index_path = os.path.join(WEB_BUILD_DIR, "index.html")
    if os.path.exists(index_path):
        # Read and modify index.html to fix asset paths for /api/webapp/ routing
        with open(index_path, 'r') as f:
            content = f.read()
        # Replace absolute paths with api/webapp-prefixed paths
        content = content.replace('href="/favicon.ico"', 'href="/api/webapp/favicon.ico"')
        content = content.replace('src="/_expo/', 'src="/api/webapp/_expo/')
        content = content.replace('href="/_expo/', 'href="/api/webapp/_expo/')
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=content)
    raise HTTPException(status_code=404, detail="Web app not found")

@app.get("/webapp/favicon.ico")
@app.get("/api/webapp/favicon.ico")
async def serve_webapp_favicon():
    """Serve favicon"""
    favicon_path = os.path.join(WEB_BUILD_DIR, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    raise HTTPException(status_code=404, detail="Favicon not found")

@app.get("/webapp/{path:path}")
@app.get("/api/webapp/{path:path}")
async def serve_webapp_files(path: str):
    """Serve web app static files"""
    # Try exact path first
    file_path = os.path.join(WEB_BUILD_DIR, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Try with .html extension for routes
    html_path = os.path.join(WEB_BUILD_DIR, f"{path}.html")
    if os.path.exists(html_path):
        # Read and modify HTML to fix asset paths
        with open(html_path, 'r') as f:
            content = f.read()
        content = content.replace('href="/favicon.ico"', 'href="/api/webapp/favicon.ico"')
        content = content.replace('src="/_expo/', 'src="/api/webapp/_expo/')
        content = content.replace('href="/_expo/', 'href="/api/webapp/_expo/')
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=content)
    
    # Fallback to index.html for SPA routing
    index_path = os.path.join(WEB_BUILD_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, 'r') as f:
            content = f.read()
        content = content.replace('href="/favicon.ico"', 'href="/api/webapp/favicon.ico"')
        content = content.replace('src="/_expo/', 'src="/api/webapp/_expo/')
        content = content.replace('href="/_expo/', 'href="/api/webapp/_expo/')
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=content)
    
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
