import os
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "")
FROM_NAME = os.getenv("FROM_NAME", "Fairway Foods")

async def send_email(to_email: str, subject: str, html_content: str, text_content: str = None):
    """Send email using Gmail SMTP"""
    
    # Check if email is configured
    if not SMTP_USERNAME or not SMTP_PASSWORD or SMTP_USERNAME == "your-email@gmail.com":
        print(f"Email not configured. Would have sent to {to_email}: {subject}")
        return False
    
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        message["To"] = to_email
        message["Subject"] = subject
        
        # Add text and HTML parts
        if text_content:
            text_part = MIMEText(text_content, "plain")
            message.attach(text_part)
        
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)
        
        # Send email
        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        
        print(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        return False


async def send_registration_notification_to_admin(user_name: str, user_email: str):
    """Notify super user about new registration"""
    
    subject = "New User Registration - Approval Required"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2e7d32;">New User Registration</h2>
                <p>A new user has registered on Fairway Foods and is awaiting approval:</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Name:</strong> {user_name}</p>
                    <p><strong>Email:</strong> {user_email}</p>
                </div>
                
                <p>Please log in to the User Management dashboard to review and approve or reject this registration.</p>
                
                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                    This is an automated message from Fairway Foods.
                </p>
            </div>
        </body>
    </html>
    """
    
    text_content = f"""
New User Registration - Approval Required

A new user has registered on Fairway Foods:

Name: {user_name}
Email: {user_email}

Please log in to review and approve or reject this registration.
    """
    
    # Get super user email
    from pymongo import MongoClient
    MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.getenv("DB_NAME", "golf_meal_app")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    super_user = db["users"].find_one({"role": "superuser"})
    
    if super_user:
        await send_email(super_user["email"], subject, html_content, text_content)


async def send_approval_email(user_email: str, user_name: str):
    """Notify user that their account has been approved"""
    
    subject = "Your Fairway Foods Account Has Been Approved! 🎉"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2e7d32;">Welcome to Fairway Foods!</h2>
                <p>Hi {user_name},</p>
                
                <p>Great news! Your account has been approved and you can now access Fairway Foods.</p>
                
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Your login email:</strong> {user_email}</p>
                </div>
                
                <p>You can now:</p>
                <ul>
                    <li>Browse menus from 10 Cape Town golf courses</li>
                    <li>Place orders for your tee-off time</li>
                    <li>Track your order history</li>
                </ul>
                
                <p>We look forward to serving you at Fairway Foods!</p>
                
                <p style="margin-top: 30px;">
                    Best regards,<br>
                    <strong>The Fairway Foods Team</strong>
                </p>
                
                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                    This is an automated message from Fairway Foods.
                </p>
            </div>
        </body>
    </html>
    """
    
    text_content = f"""
Welcome to Fairway Foods!

Hi {user_name},

Great news! Your account has been approved and you can now access Fairway Foods.

Your login email: {user_email}

You can now:
- Browse menus from 10 Cape Town golf courses
- Place orders for your tee-off time
- Track your order history

We look forward to serving you at Fairway Foods!

Best regards,
The Fairway Foods Team
    """
    
    await send_email(user_email, subject, html_content, text_content)


async def send_rejection_email(user_email: str, user_name: str, reason: str):
    """Notify user that their account has been rejected"""
    
    subject = "Fairway Foods Registration Update"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #666;">Registration Update</h2>
                <p>Hi {user_name},</p>
                
                <p>Thank you for your interest in Fairway Foods.</p>
                
                <p>Unfortunately, we're unable to approve your registration at this time.</p>
                
                <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                    <p><strong>Reason:</strong> {reason}</p>
                </div>
                
                <p>If you believe this is an error or would like more information, please contact our support team.</p>
                
                <p style="margin-top: 30px;">
                    Best regards,<br>
                    <strong>The Fairway Foods Team</strong>
                </p>
                
                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                    This is an automated message from Fairway Foods.
                </p>
            </div>
        </body>
    </html>
    """
    
    text_content = f"""
Registration Update

Hi {user_name},

Thank you for your interest in Fairway Foods.

Unfortunately, we're unable to approve your registration at this time.

Reason: {reason}

If you believe this is an error or would like more information, please contact our support team.

Best regards,
The Fairway Foods Team
    """
    
    await send_email(user_email, subject, html_content, text_content)
