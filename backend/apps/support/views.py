from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.mail import EmailMessage
from django.conf import settings
from .models import BugReport
from .serializers import BugReportSerializer
import logging

logger = logging.getLogger(__name__)

class BugReportListCreateView(generics.ListCreateAPIView):
    serializer_class = BugReportSerializer
    parser_classes = (MultiPartParser, FormParser)
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        return BugReport.objects.all()

    def perform_create(self, serializer):
        bug_report = serializer.save(user=self.request.user)
        
        from django.utils.html import escape
        from rest_framework.exceptions import APIException
        
        # Send email notification
        try:
            # You can change settings.ADMIN_EMAIL to the specific email later
            target_email = getattr(settings, 'SUPPORT_EMAIL', 'admin@example.com') 
            
            safe_username = escape(bug_report.user.username)
            safe_email = escape(bug_report.user.email)
            safe_message = escape(bug_report.message)
            
            subject = f"New Bug Report: #{bug_report.id} from {safe_username}"
            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; border: 1px solid #e9ecef;">
                        <h2 style="color: #dc3545; margin-top: 0; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">New Bug Report </h2>
                        
                        <div style="margin-bottom: 20px;">
                            <p style="margin: 0 0 10px 0;"><strong>Report ID:</strong> #{bug_report.id}</p>
                            <p style="margin: 0 0 10px 0;"><strong>User:</strong> {safe_username} ({safe_email})</p>
                            <p style="margin: 0 0 10px 0;"><strong>Status:</strong> <span style="background-color: #ffc107; color: #000; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">{bug_report.get_status_display()}</span></p>
                        </div>

                        <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #dee2e6; margin-bottom: 20px;">
                            <h3 style="margin-top: 0; color: #495057; font-size: 16px;">Issue Description:</h3>
                            <p style="white-space: pre-wrap; margin-bottom: 0;">{safe_message}</p>
                        </div>

                        <p style="font-size: 14px; color: #6c757d; margin-bottom: 0;">Please check the admin dashboard for more details.</p>
                    </div>
                </body>
            </html>
            """
            
            body = f"""
A new bug/issue has been reported.

User: {bug_report.user.username} ({bug_report.user.email})
Status: {bug_report.get_status_display()}
Message:
{bug_report.message}

Please check the admin dashboard for more details.
"""
            
            from django.core.mail import EmailMultiAlternatives
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[target_email],
            )
            email.attach_alternative(html_content, "text/html")
            
            if bug_report.screenshot:
                email.attach_file(bug_report.screenshot.path)
                
            email.send(fail_silently=False)
            
        except Exception as e:
            logger.error(f"Failed to send bug report email: {e}")
            bug_report.delete()
            raise APIException("Failed to send bug report email. Please try again later.")
