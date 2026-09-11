"""
Custom Django email backend using Mailjet REST API.
This bypasses SMTP port restrictions on Railway by using HTTPS.
"""
import os
import base64
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail import EmailMultiAlternatives
from mailjet_rest import Client


class MailjetAPIBackend(BaseEmailBackend):
    """
    Email backend that uses Mailjet's REST API instead of SMTP.
    Works on platforms that block outbound SMTP ports (like Railway).

    Environment variables:
        EMAIL_HOST_USER     — Mailjet API Key
        EMAIL_HOST_PASSWORD — Mailjet API Secret
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

        # Build To / Cc / Bcc separately to avoid exposing BCC addresses.
        # message.recipients() merges all three — we must NOT use it for Mailjet's
        # 'To' field, as every address in 'To' is visible to all recipients.
        to_list  = [{'Email': addr} for addr in (message.to or [])]
        cc_list  = [{'Email': addr} for addr in (message.cc or [])]
        bcc_list = [{'Email': addr} for addr in (message.bcc or [])]

        if not to_list and not cc_list and not bcc_list:
            return False

        # Prepare the email data for Mailjet API
        msg_payload = {
            'From': {
                'Email': message.from_email,
                'Name': message.from_email.split('@')[0].title()
            },
            'Subject': message.subject,
        }

        if to_list:
            msg_payload['To'] = to_list
        if cc_list:
            msg_payload['Cc'] = cc_list
        if bcc_list:
            msg_payload['Bcc'] = bcc_list

        # Handle plain text and HTML content
        if isinstance(message, EmailMultiAlternatives) and message.alternatives:
            # If there are alternatives (HTML), use the first one
            for content, mimetype in message.alternatives:
                if mimetype == 'text/html':
                    msg_payload['HTMLPart'] = content
                    # Include plain text version if available
                    if message.body:
                        msg_payload['TextPart'] = message.body
                    break
            # If no HTML alternative was found, use plain text
            if 'HTMLPart' not in msg_payload and message.body:
                msg_payload['TextPart'] = message.body
        else:
            # Plain text only - ensure body is not empty
            msg_payload['TextPart'] = message.body if message.body else ' '

        # Translate Django attachments into Mailjet's Attachments format.
        # Each Django attachment is a tuple of (filename, content, mimetype).
        if message.attachments:
            mailjet_attachments = []
            for attachment in message.attachments:
                filename, content, mimetype = attachment
                if isinstance(content, str):
                    content = content.encode('utf-8')
                mailjet_attachments.append({
                    'Filename': filename or 'attachment',
                    'ContentType': mimetype or 'application/octet-stream',
                    'Base64Content': base64.b64encode(content).decode('utf-8'),
                })
            if mailjet_attachments:
                msg_payload['Attachments'] = mailjet_attachments

        data = {'Messages': [msg_payload]}

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
