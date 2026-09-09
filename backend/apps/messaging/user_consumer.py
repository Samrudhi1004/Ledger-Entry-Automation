import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

User = get_user_model()


class UserNotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for user-level messaging notifications.
    Notifies user of new messages across ALL their conversations in real-time.
    """

    async def connect(self):
        """Accept WebSocket connection after authentication."""
        self.user = None

        # Authenticate user from token
        query_string = self.scope['query_string'].decode()
        parsed_qs = parse_qs(query_string)
        token = parsed_qs.get('token', [None])[0]

        if not token:
            await self.close(code=4001)
            return

        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            self.user = await self.get_user(user_id)

            if not self.user:
                await self.close(code=4001)
                return

        except TokenError:
            await self.close(code=4001)
            return

        # Join user's personal notification group
        self.user_group_name = f'user_notifications_{self.user.id}'

        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        await self.accept()

        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': f'Connected to user notifications for user {self.user.id}'
        }))

    async def disconnect(self, close_code):
        """Leave notification group on disconnect."""
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Handle ping/pong to keep connection alive."""
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong'
                }))
            else:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown action: {action}'
                }))

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))

    async def new_message_notification(self, event):
        """Send new message notification to user."""
        await self.send(text_data=json.dumps({
            'type': 'new_message_notification',
            'data': event['data']
        }))

    async def conversation_updated(self, event):
        """Send conversation update notification to user."""
        await self.send(text_data=json.dumps({
            'type': 'conversation_updated',
            'data': event['data']
        }))

    @database_sync_to_async
    def get_user(self, user_id):
        """Get user by ID."""
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None
