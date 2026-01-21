import os
import resend
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@fairwayfoods.co.za")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")

def send_password_reset_email(to_email: str, reset_code: str):
    if not RESEND_API_KEY:
        print("RESEND_API_KEY not set, skipping email")
        return False
    
    resend.api_key = RESEND_API_KEY
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">Fairway Foods Password Reset</h2>
        <p>You requested a password reset. Use this code to reset your password:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2e7d32; letter-spacing: 5px;">{reset_code}</h1>
        </div>
        <p>This code expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
    </div>
    """
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Fairway Foods - Password Reset Code",
            "html": html_content
        })
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def send_registration_notification_to_admin(user_email: str, user_name: str):
    if not RESEND_API_KEY or not ADMIN_EMAIL:
        return False
    
    resend.api_key = RESEND_API_KEY
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [ADMIN_EMAIL],
            "subject": "New User Registration - Fairway Foods",
            "html": f"<p>New user registered: {user_name} ({user_email})</p>"
        })
        return True
    except:
        return False

def send_approval_email(to_email: str, user_name: str):
    if not RESEND_API_KEY:
        return False
    
    resend.api_key = RESEND_API_KEY
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Welcome to Fairway Foods!",
            "html": f"<p>Hi {user_name}, your account has been approved!</p>"
        })
        return True
    except:
        return False

def send_rejection_email(to_email: str, user_name: str):
    if not RESEND_API_KEY:
        return False
    
    resend.api_key = RESEND_API_KEY
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Fairway Foods Registration",
            "html": f"<p>Hi {user_name}, unfortunately your registration was not approved.</p>"
        })
        return True
    except:
        return False

def send_marketing_email(to_email: str, subject: str, html_content: str):
    if not RESEND_API_KEY:
        return False
    
    resend.api_key = RESEND_API_KEY
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        })
        return True
    except:
        return False

def send_contact_form_email(name: str, email: str, message: str):
    if not RESEND_API_KEY or not ADMIN_EMAIL:
        return False
    
    resend.api_key = RESEND_API_KEY
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [ADMIN_EMAIL],
            "subject": f"Contact Form: {name}",
            "html": f"<p><strong>From:</strong> {name} ({email})</p><p>{message}</p>"
        })
        return True
    except:
        return False
