"""
Custom Django email backend using Mailjet REST API.
This bypasses SMTP port restrictions on Railway by using HTTPS.
"""
import os
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail import EmailMultiAlternatives
from mailjet_rest import Client


class MailjetAPIBackend(BaseEmailBackend):
    """
    Email backend that uses Mailjet's REST API instead of SMTP.
    Works on platforms that block outbound SMTP ports (like Railway).
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = os.getenv('EMAIL_HOST_USER', '')
        self.api_secret = os.getenv('EMAIL_HOST_PASSWORD', '')
        self.client = Client(auth=(self.api_key, self.api_secret), version='v3.1')

    def send_messages(self, email_messages):
        """
        Send one or more EmailMessage objects and return the number of email
        messages sent.
        """
        if not email_messages:
            return 0

        num_sent = 0
        for message in email_messages:
            try:
                sent = self._send(message)
                if sent:
                    num_sent += 1
            except Exception as e:
                if not self.fail_silently:
                    raise
                # Log the error but continue if fail_silently is True
                print(f"Failed to send email: {e}")

        return num_sent

    def _send(self, message):
        """Send a single email message using Mailjet API."""
        if not message.recipients():
            return False

        # Build the recipient list
        recipients = [{'Email': recipient} for recipient in message.recipients()]

        # Prepare the email data for Mailjet API
        data = {
            'Messages': [
                {
                    'From': {
                        'Email': message.from_email,
                        'Name': message.from_email.split('@')[0].title()
                    },
                    'To': recipients,
                    'Subject': message.subject,
                }
            ]
        }

        # Handle plain text and HTML content
        if isinstance(message, EmailMultiAlternatives) and message.alternatives:
            # If there are alternatives (HTML), use the first one
            for content, mimetype in message.alternatives:
                if mimetype == 'text/html':
                    data['Messages'][0]['HTMLPart'] = content
                    # Include plain text version if available
                    if message.body:
                        data['Messages'][0]['TextPart'] = message.body
                    break
            # If no HTML alternative was found, use plain text
            if 'HTMLPart' not in data['Messages'][0] and message.body:
                data['Messages'][0]['TextPart'] = message.body
        else:
            # Plain text only - ensure body is not empty
            if message.body:
                data['Messages'][0]['TextPart'] = message.body
            else:
                # Mailjet requires at least TextPart or HTMLPart
                data['Messages'][0]['TextPart'] = ' '

        # Send via Mailjet API
        try:
            result = self.client.send.create(data=data)
            if result.status_code == 200:
                return True
            else:
                error_msg = f"Mailjet API error: {result.status_code} - {result.json()}"
                if not self.fail_silently:
                    raise Exception(error_msg)
                print(error_msg)
                return False
        except Exception as e:
            if not self.fail_silently:
                raise
            print(f"Mailjet API exception: {e}")
            return False
