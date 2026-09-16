import os
import django
from django.core.mail import EmailMessage

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings

print(f"Backend: {settings.EMAIL_BACKEND}")
print(f"User: {settings.EMAIL_HOST_USER}")

try:
    from django.core.mail import EmailMultiAlternatives
    email = EmailMultiAlternatives(
        subject="Test HTML Email from Backend",
        body="This is a plain text fallback.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.SUPPORT_EMAIL],
    )
    email.attach_alternative("<html><body><h1>Test HTML</h1></body></html>", "text/html")
    # Don't fail silently so we can see the exact error
    email.send(fail_silently=False)
    print("Email sent successfully!")
except Exception as e:
    print(f"EXCEPTION: {e}")
