import os
import resend
from dotenv import load_dotenv
from pathlib import Path

# Explicitly load .env from the backend directory
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

# Configure Resend
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "hello@fairwayfoods.co.za")

print(f"Email service initialized - API Key present: {bool(RESEND_API_KEY)}")

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

async def send_email(to_email: str, subject: str, html_content: str, text_content: str = "", from_email: str = None) -> bool:
    """Send an email using Resend"""
    
    if not RESEND_API_KEY:
        print("Email service not configured - RESEND_API_KEY missing")
        return False
    
    try:
        # Use custom from_email if provided, otherwise use default
        sender_email = from_email if from_email else FROM_EMAIL
        
        params = {
            "from": f"Fairway Foods <{sender_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        
        if text_content:
            params["text"] = text_content
        
        email = resend.Emails.send(params)
        print(f"Email sent successfully to {to_email}, ID: {email.get('id', 'unknown')}")
        return True
        
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False


async def send_registration_notification_to_admin(admin_emails: list, new_user_email: str, new_user_name: str):
    """Notify admins about new user registration"""
    
    subject = "New User Registration - Approval Required"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2e7d32;">New User Registration</h2>
                <p>A new user has registered and requires approval:</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Name:</strong> {new_user_name}</p>
                    <p><strong>Email:</strong> {new_user_email}</p>
                </div>
                
                <p>Please log in to the admin panel to approve or reject this registration.</p>
                
                <p style="margin-top: 30px;">
                    Best regards,<br>
                    <strong>Fairway Foods System</strong>
                </p>
            </div>
        </body>
    </html>
    """
    
    text_content = f"""
New User Registration

A new user has registered and requires approval:

Name: {new_user_name}
Email: {new_user_email}

Please log in to the admin panel to approve or reject this registration.

Best regards,
Fairway Foods System
    """
    
    for admin_email in admin_emails:
        await send_email(admin_email, subject, html_content, text_content)


async def send_approval_email(user_email: str, user_name: str):
    """Notify user that their account has been approved"""
    
    subject = "Welcome to Fairway Foods - Account Approved!"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2e7d32;">Welcome to Fairway Foods!</h2>
                <p>Hi {user_name},</p>
                
                <p>Great news! Your account has been approved and you can now access all features of Fairway Foods.</p>
                
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>What you can do now:</strong></p>
                    <ul style="margin: 10px 0;">
                        <li>Browse menus from your favorite golf courses</li>
                        <li>Place orders for pickup</li>
                        <li>Save your preferences for faster ordering</li>
                    </ul>
                </div>
                
                <p>Log in now and start ordering!</p>
                
                <p style="margin-top: 30px;">
                    Best regards,<br>
                    <strong>The Fairway Foods Team</strong>
                </p>
            </div>
        </body>
    </html>
    """
    
    text_content = f"""
Welcome to Fairway Foods!

Hi {user_name},

Great news! Your account has been approved and you can now access all features of Fairway Foods.

What you can do now:
- Browse menus from your favorite golf courses
- Place orders for pickup
- Save your preferences for faster ordering

Log in now and start ordering!

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


async def send_contact_form_email(name: str, email: str, club: str, phone: str, message: str) -> bool:
    """Send contact form submission to Fairway Foods team"""
    
    subject = f"🏌️ New Demo Request from {club}"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); padding: 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0;">⛳ New Demo Request</h1>
            </div>
            
            <div style="padding: 30px; background: #fff;">
                <h2 style="color: #2e7d32; margin-top: 0;">Contact Details</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold; width: 140px;">Name:</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;">{name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;"><a href="mailto:{email}" style="color: #2e7d32;">{email}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold;">Golf Club:</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;">{club}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold;">Phone:</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;">{phone or 'Not provided'}</td>
                    </tr>
                </table>
                
                <h3 style="color: #2e7d32; margin-top: 30px;">Message</h3>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; border-left: 4px solid #2e7d32;">
                    {message or 'No message provided'}
                </div>
                
                <div style="margin-top: 30px; padding: 20px; background: #e8f5e9; border-radius: 8px; text-align: center;">
                    <p style="margin: 0; color: #1b5e20;"><strong>Reply to this lead within 24 hours!</strong></p>
                </div>
            </div>
            
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                This email was sent from the Fairway Foods website contact form.
            </div>
        </body>
    </html>
    """
    
    text_content = f"""
New Demo Request from {club}

Contact Details:
- Name: {name}
- Email: {email}
- Golf Club: {club}
- Phone: {phone or 'Not provided'}

Message:
{message or 'No message provided'}

---
Reply to this lead within 24 hours!
    """
    
    # Send to admin email (configured in .env)
    return await send_email(ADMIN_EMAIL, subject, html_content, text_content)


async def send_marketing_email(to_email: str, template_name: str = "club_manager_launch") -> bool:
    """Send marketing email using HTML template"""
    
    # Get the template path
    template_path = Path(__file__).parent / "email_templates" / f"{template_name}.html"
    
    if not template_path.exists():
        print(f"Template not found: {template_path}")
        return False
    
    # Read the HTML template
    with open(template_path, "r") as f:
        html_content = f.read()
    
    subject = "Partner with Fairway Foods - Elevate Your Golf Club Experience ⛳"
    
    return await send_email(to_email, subject, html_content)


async def send_custom_marketing_email(
    to_emails: list, 
    subject: str, 
    html_content: str, 
    from_email: str = None
) -> dict:
    """
    Send custom marketing email to multiple recipients
    Returns dict with success count and failures
    """
    results = {
        "total": len(to_emails),
        "sent": 0,
        "failed": 0,
        "failures": []
    }
    
    for email in to_emails:
        try:
            success = await send_email(
                to_email=email.strip(),
                subject=subject,
                html_content=html_content,
                from_email=from_email
            )
            if success:
                results["sent"] += 1
            else:
                results["failed"] += 1
                results["failures"].append(email)
        except Exception as e:
            print(f"Failed to send to {email}: {str(e)}")
            results["failed"] += 1
            results["failures"].append(email)
    
    return results


async def send_password_reset_email(user_email: str, user_name: str, reset_code: str):
    """Send password reset code to user"""
    
    subject = "Reset Your Fairway Foods Password"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2e7d32;">Password Reset Request</h2>
                <p>Hi {user_name},</p>
                
                <p>We received a request to reset your Fairway Foods password.</p>
                
                <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #666;">Your reset code is:</p>
                    <p style="margin: 10px 0; font-size: 32px; font-weight: bold; color: #1976d2; letter-spacing: 4px;">{reset_code}</p>
                    <p style="margin: 0; font-size: 12px; color: #999;">This code expires in 15 minutes</p>
                </div>
                
                <p>Enter this code in the app to reset your password.</p>
                
                <p style="color: #f57c00;"><strong>If you didn't request this reset, please ignore this email.</strong></p>
                
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
Password Reset Request

Hi {user_name},

We received a request to reset your Fairway Foods password.

Your reset code is: {reset_code}

This code expires in 15 minutes.

Enter this code in the app to reset your password.

If you didn't request this reset, please ignore this email.

Best regards,
The Fairway Foods Team
    """
    
    return await send_email(user_email, subject, html_content, text_content)


async def send_welcome_email(user_email: str, user_name: str) -> bool:
    """Send welcome email when user signs up"""
    subject = "Welcome to Fairway Foods! ⛳🍽️"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">⛳ Welcome to Fairway Foods!</h1>
                </div>
                
                <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #2e7d32;">Hi {user_name}! 👋</h2>
                    
                    <p>Thank you for signing up with Fairway Foods - your on-course food ordering companion!</p>
                    
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #2e7d32;">What happens next?</h3>
                        <ul style="padding-left: 20px;">
                            <li>Your account is pending approval by the club administrator</li>
                            <li>You'll receive an email once approved</li>
                            <li>Then you can start ordering delicious food on the course!</li>
                        </ul>
                    </div>
                    
                    <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #2e7d32;">🍽️ How it works:</h3>
                        <ol style="padding-left: 20px;">
                            <li><strong>Browse</strong> - Check out our delicious menu</li>
                            <li><strong>Order</strong> - Add items to your cart and checkout</li>
                            <li><strong>Enjoy</strong> - Your food will be ready at your tee-off time!</li>
                        </ol>
                    </div>
                    
                    <p style="margin-top: 30px;">
                        See you on the course!<br>
                        <strong>The Fairway Foods Team</strong>
                    </p>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p><a href="https://fairwayfoods.co.za" style="color: #2e7d32;">fairwayfoods.co.za</a></p>
                </div>
            </div>
        </body>
    </html>
    """
    
    return await send_email(user_email, subject, html_content)


async def send_password_changed_email(user_email: str, user_name: str) -> bool:
    """Send notification when password is changed"""
    subject = "Your Fairway Foods Password Has Been Changed 🔐"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">⛳ Fairway Foods</h1>
                </div>
                
                <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #2e7d32;">Password Changed Successfully 🔐</h2>
                    
                    <p>Hi {user_name},</p>
                    
                    <p>This is a confirmation that your Fairway Foods password has been successfully changed.</p>
                    
                    <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                        <p style="margin: 0;"><strong>⚠️ Didn't make this change?</strong></p>
                        <p style="margin: 10px 0 0 0;">If you didn't change your password, please contact us immediately or use the "Forgot Password" feature to secure your account.</p>
                    </div>
                    
                    <p style="margin-top: 30px;">
                        Best regards,<br>
                        <strong>The Fairway Foods Team</strong>
                    </p>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p><a href="https://fairwayfoods.co.za" style="color: #2e7d32;">fairwayfoods.co.za</a></p>
                </div>
            </div>
        </body>
    </html>
    """
    
    return await send_email(user_email, subject, html_content)


async def send_order_confirmation_email(user_email: str, user_name: str, order_details: dict) -> bool:
    """Send order confirmation email"""
    subject = f"Order Confirmed! #{order_details.get('order_number', 'N/A')} ⛳🍽️"
    
    # Build items list HTML
    items_html = ""
    for item in order_details.get('items', []):
        items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{item.get('name', 'Item')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item.get('quantity', 1)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">R{item.get('price', 0):.2f}</td>
            </tr>
        """
    
    total = order_details.get('total', 0)
    tee_off_time = order_details.get('tee_off_time', 'Not specified')
    course_name = order_details.get('course_name', 'Your Golf Course')
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0;">⛳ Order Confirmed!</h1>
                </div>
                
                <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #2e7d32;">Thanks for your order, {user_name}! 🎉</h2>
                    
                    <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                        <p style="margin: 0; font-size: 14px; color: #666;">Order Number</p>
                        <p style="margin: 5px 0; font-size: 28px; font-weight: bold; color: #2e7d32;">#{order_details.get('order_number', 'N/A')}</p>
                    </div>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>📍 Course:</strong> {course_name}</p>
                        <p style="margin: 10px 0 0 0;"><strong>⏰ Tee-Off Time:</strong> {tee_off_time}</p>
                    </div>
                    
                    <h3 style="color: #2e7d32; margin-top: 30px;">Order Details:</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #f5f5f5;">
                                <th style="padding: 10px; text-align: left;">Item</th>
                                <th style="padding: 10px; text-align: center;">Qty</th>
                                <th style="padding: 10px; text-align: right;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #e8f5e9;">
                                <td colspan="2" style="padding: 15px; font-weight: bold;">Total</td>
                                <td style="padding: 15px; text-align: right; font-weight: bold; font-size: 18px; color: #2e7d32;">R{total:.2f}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 30px 0;">
                        <p style="margin: 0; text-align: center;"><strong>🏌️ Your order will be ready for pickup at your tee-off time!</strong></p>
                    </div>
                    
                    <p style="margin-top: 30px;">
                        Enjoy your round!<br>
                        <strong>The Fairway Foods Team</strong>
                    </p>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p><a href="https://fairwayfoods.co.za" style="color: #2e7d32;">fairwayfoods.co.za</a></p>
                </div>
            </div>
        </body>
    </html>
    """
    
    return await send_email(user_email, subject, html_content)
