import os
import httpx
from typing import Optional, List

async def send_brevo_email(to_email: str, subject: str, html_content: str, attachment: Optional[list] = None) -> bool:
    api_key = os.environ.get("BREVO_API_KEY") or os.environ.get("VITE_BREVO_API_KEY")
    sender_email = os.environ.get("BREVO_SENDER_EMAIL") or os.environ.get("VITE_BREVO_SENDER_EMAIL", "eihubsoi@gmail.com")
    sender_name = os.environ.get("BREVO_SENDER_NAME") or os.environ.get("VITE_BREVO_SENDER_NAME", "EI HUB Support")
    
    if not api_key:
        print(f"[Brevo Fallback Dev Mode] To: {to_email} | Subject: {subject}")
        return True
        
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content
    }
    
    if attachment:
        payload["attachment"] = attachment
        
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            response = await http_client.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
            if response.status_code in [200, 201, 202]:
                print(f"Brevo email successfully sent to {to_email}")
                return True
            else:
                print(f"Brevo API error: {response.status_code} {response.text}")
                return False
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

async def send_brevo_email_advanced(to_emails: List[str], subject: str, html_content: str, cc_emails: Optional[List[str]] = None, bcc_emails: Optional[List[str]] = None, attachment: Optional[list] = None) -> bool:
    api_key = os.environ.get("BREVO_API_KEY") or os.environ.get("VITE_BREVO_API_KEY")
    sender_email = os.environ.get("BREVO_SENDER_EMAIL") or os.environ.get("VITE_BREVO_SENDER_EMAIL", "eihubsoi@gmail.com")
    sender_name = os.environ.get("BREVO_SENDER_NAME") or os.environ.get("VITE_BREVO_SENDER_NAME", "EI HUB Support")
    
    if not api_key:
        print(f"[Brevo Fallback Dev Mode] To: {to_emails} | Subject: {subject}")
        return True
        
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": email} for email in to_emails],
        "subject": subject,
        "htmlContent": html_content
    }
    
    if cc_emails:
        payload["cc"] = [{"email": email} for email in cc_emails]
    if bcc_emails:
        payload["bcc"] = [{"email": email} for email in bcc_emails]
    if attachment:
        payload["attachment"] = attachment
        
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            response = await http_client.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
            if response.status_code in [200, 201, 202]:
                print(f"Brevo advanced email successfully sent to {to_emails}")
                return True
            else:
                print(f"Brevo API error: {response.status_code} {response.text}")
                return False
    except Exception as e:
        print(f"Failed to send advanced email: {e}")
        return False
