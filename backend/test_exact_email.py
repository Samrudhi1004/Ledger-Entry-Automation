import os
import django
from django.core.mail import EmailMultiAlternatives

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings

subject = "New Bug Report: #999 from admin"

html_content = """
<html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; border: 1px solid #e9ecef;">
            <h2 style="color: #dc3545; margin-top: 0; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">New Bug Report </h2>
            
            <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0;"><strong>Report ID:</strong> #999</p>
                <p style="margin: 0 0 10px 0;"><strong>User:</strong> admin (admin@example.com)</p>
                <p style="margin: 0 0 10px 0;"><strong>Status:</strong> <span style="background-color: #ffc107; color: #000; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Open</span></p>
            </div>

            <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #dee2e6; margin-bottom: 20px;">
                <h3 style="margin-top: 0; color: #495057; font-size: 16px;">Issue Description:</h3>
                <p style="white-space: pre-wrap; margin-bottom: 0;">This is a test message from script</p>
            </div>

            <p style="font-size: 14px; color: #6c757d; margin-bottom: 0;">Please check the admin dashboard for more details.</p>
        </div>
    </body>
</html>
"""

body = """
A new bug/issue has been reported.

User: admin
Status: Open
Message:
This is a test message from script
"""

try:
    email = EmailMultiAlternatives(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.SUPPORT_EMAIL],
    )
    email.attach_alternative(html_content, "text/html")
    email.send(fail_silently=False)
    print("Exact template sent successfully!")
except Exception as e:
    print(f"EXCEPTION: {e}")
