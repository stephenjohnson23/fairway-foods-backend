import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "US0b4a798889b2410e056ed7c10e656246")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "1b9e4be16c7ba2d4305e2ba829df4bdc")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "+14155238886")

# Initialize Twilio client
try:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    print(f"WhatsApp service initialized - Account: {TWILIO_ACCOUNT_SID[:10]}...")
except Exception as e:
    print(f"Failed to initialize WhatsApp service: {str(e)}")
    twilio_client = None


def format_whatsapp_number(phone: str) -> str:
    """Format phone number for WhatsApp (must include country code)"""
    # Remove spaces, dashes, parentheses
    phone = ''.join(c for c in phone if c.isdigit() or c == '+')
    
    # Add + if missing
    if not phone.startswith('+'):
        # Assume South Africa if no country code
        if phone.startswith('0'):
            phone = '+27' + phone[1:]
        else:
            phone = '+' + phone
    
    return phone


async def send_whatsapp_message(to_number: str, message: str) -> bool:
    """Send a WhatsApp message"""
    if not twilio_client:
        print("WhatsApp service not initialized")
        return False
    
    try:
        formatted_number = format_whatsapp_number(to_number)
        
        msg = twilio_client.messages.create(
            body=message,
            from_=f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
            to=f"whatsapp:{formatted_number}"
        )
        
        print(f"WhatsApp sent to {formatted_number}, SID: {msg.sid}")
        return True
        
    except Exception as e:
        print(f"Failed to send WhatsApp: {str(e)}")
        return False


async def send_order_confirmation_whatsapp(to_number: str, customer_name: str, order_details: dict) -> bool:
    """Send order confirmation via WhatsApp"""
    
    order_number = order_details.get('order_number', 'N/A')
    course_name = order_details.get('course_name', 'Golf Course')
    tee_off_time = order_details.get('tee_off_time', 'Not specified')
    total = order_details.get('total', 0)
    items = order_details.get('items', [])
    
    # Build items list
    items_text = '\n'.join([f"  • {item.get('quantity')}x {item.get('name')} - R{item.get('price'):.2f}" for item in items])
    
    message = f"""⛳ *Fairway Foods - Order Confirmed!*

Hi {customer_name}! 👋

Your order *#{order_number}* has been received!

📍 *Course:* {course_name}
⏰ *Tee-Off Time:* {tee_off_time}

🍽️ *Your Order:*
{items_text}

💰 *Total:* R{total:.2f}

Your food will be ready for pickup at your tee-off time!

Enjoy your round! 🏌️‍♂️"""

    return await send_whatsapp_message(to_number, message)


async def send_order_ready_whatsapp(to_number: str, customer_name: str, order_number: str) -> bool:
    """Send notification when order is ready"""
    
    message = f"""⛳ *Fairway Foods*

Hi {customer_name}! 👋

Great news! Your order *#{order_number}* is *READY FOR PICKUP!* 🎉

Please collect it from the kitchen/clubhouse.

Enjoy your meal! 🍔"""

    return await send_whatsapp_message(to_number, message)


async def send_order_status_whatsapp(to_number: str, customer_name: str, order_number: str, status: str) -> bool:
    """Send order status update via WhatsApp"""
    
    status_messages = {
        'pending': '📝 Your order has been received and is waiting to be prepared.',
        'preparing': '👨‍🍳 Your order is now being prepared!',
        'ready': '✅ Your order is READY FOR PICKUP!',
        'completed': '🎉 Thank you for your order! Enjoy your meal!',
        'cancelled': '❌ Your order has been cancelled. Please contact us if you have questions.'
    }
    
    status_text = status_messages.get(status, f'Your order status is: {status}')
    
    message = f"""⛳ *Fairway Foods - Order Update*

Hi {customer_name}!

Order *#{order_number}*:
{status_text}"""

    return await send_whatsapp_message(to_number, message)
