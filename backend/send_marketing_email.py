#!/usr/bin/env python3
"""
Marketing Email Sender for Fairway Foods
Sends the club manager launch announcement email via Resend.

Usage:
    python send_marketing_email.py recipient@email.com "Recipient Name"
    
Or send to multiple recipients from a CSV file:
    python send_marketing_email.py --csv recipients.csv
"""

import os
import sys
import csv
import resend
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Resend
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@fairwayfoods.co.za")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def load_template():
    """Load the HTML email template"""
    template_path = Path(__file__).parent / "email_templates" / "club_manager_launch.html"
    
    if not template_path.exists():
        print(f"❌ Template not found at {template_path}")
        sys.exit(1)
    
    with open(template_path, "r") as f:
        return f.read()


def send_email(to_email: str, to_name: str = None):
    """Send the marketing email to a single recipient"""
    
    if not RESEND_API_KEY:
        print("❌ RESEND_API_KEY not configured in .env")
        return False
    
    html_content = load_template()
    
    # Personalize if name provided
    if to_name:
        html_content = html_content.replace("Hi there,", f"Hi {to_name},")
    
    subject = "🏌️ A New Revenue Stream for Your Golf Club – No Setup Costs"
    
    try:
        params = {
            "from": f"Fairway Foods <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        
        result = resend.Emails.send(params)
        print(f"✅ Email sent to {to_email} (ID: {result.get('id', 'unknown')})")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send to {to_email}: {str(e)}")
        return False


def send_bulk_from_csv(csv_file: str):
    """Send emails to all recipients in a CSV file"""
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file not found: {csv_file}")
        return
    
    sent = 0
    failed = 0
    
    with open(csv_file, "r") as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            email = row.get("email", "").strip()
            name = row.get("name", "").strip()
            
            if email:
                if send_email(email, name):
                    sent += 1
                else:
                    failed += 1
    
    print(f"\n📊 Summary: {sent} sent, {failed} failed")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    if sys.argv[1] == "--csv":
        if len(sys.argv) < 3:
            print("Usage: python send_marketing_email.py --csv recipients.csv")
            sys.exit(1)
        send_bulk_from_csv(sys.argv[2])
    else:
        email = sys.argv[1]
        name = sys.argv[2] if len(sys.argv) > 2 else None
        send_email(email, name)


if __name__ == "__main__":
    main()
