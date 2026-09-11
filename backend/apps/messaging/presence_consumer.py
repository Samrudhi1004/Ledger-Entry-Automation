import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

User = get_user_model()

# Cache key format: presence:user:{user_id}
PRESENCE_KEY_PREFIX = 'presence:user:'
PRESENCE_TIMEOUT = 300  # 5 minutes

# A single cache key that holds the set of all currently online user IDs.
# This avoids calling cache.keys() which is specific to django-redis and
# unavailable on both LocMemCache and Django's built-in RedisCache backend.
PRESENCE_INDEX_KEY = 'presence:online_index'


class PresenceConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for tracking user online/offline presence.
    Users connect to this WebSocket and their status is tracked in Redis/cache.
    """

    async def connect(self):
        """Accept WebSocket connection and mark user as online."""
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

        # Mark user as online
        await self.mark_user_online(self.user.id)

        # Join presence broadcast group
        await self.channel_layer.group_add(
            'presence_updates',
            self.channel_name
        )

        await self.accept()

        # Get all currently online users
        online_user_ids = await self.get_all_online_users()

        # Send initial presence data to the newly connected user
        await self.send(text_data=json.dumps({
            'type': 'initial_presence',
            'data': {
                'online_users': online_user_ids
            }
        }))

        # Broadcast to all users that this user is now online
        await self.channel_layer.group_send(
            'presence_updates',
            {
                'type': 'user_status_changed',
                'user_id': self.user.id,
                'status': 'online'
            }
        )

        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': f'Presence tracking connected for user {self.user.id}'
        }))

    async def disconnect(self, close_code):
        """Mark user as offline when they disconnect."""
        if hasattr(self, 'user') and self.user:
            # Mark user as offline
            await self.mark_user_offline(self.user.id)

            # Broadcast to all users that this user is now offline
            await self.channel_layer.group_send(
                'presence_updates',
                {
                    'type': 'user_status_changed',
                    'user_id': self.user.id,
                    'status': 'offline'
                }
            )

            # Leave presence broadcast group
            await self.channel_layer.group_discard(
                'presence_updates',
                self.channel_name
            )

    async def receive(self, text_data):
        """Handle ping/pong to keep connection alive and update last seen."""
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'ping':
                # Update last seen timestamp
                if self.user:
                    await self.mark_user_online(self.user.id)

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

    async def user_status_changed(self, event):
        """Broadcast user status change to connected clients."""
        await self.send(text_data=json.dumps({
            'type': 'user_status_changed',
            'data': {
                'user_id': event['user_id'],
                'status': event['status']
            }
        }))

    @database_sync_to_async
    def get_user(self, user_id):
        """Get user by ID."""
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def get_all_online_users(self):
        """Return all currently online user IDs from the presence index.

        Uses a single cache key (PRESENCE_INDEX_KEY) that stores a set of user
        IDs rather than scanning all cache keys.  This is portable across every
        Django cache backend — no cache.keys() needed.
        """
        online_ids = cache.get(PRESENCE_INDEX_KEY)
        if not online_ids:
            return []
        return list(online_ids)

    @database_sync_to_async
    def mark_user_online(self, user_id):
        """Mark user as online in cache and add to the presence index."""
        cache_key = f'{PRESENCE_KEY_PREFIX}{user_id}'
        cache.set(cache_key, 'online', timeout=PRESENCE_TIMEOUT)

        # Keep the shared index up-to-date
        online_ids = cache.get(PRESENCE_INDEX_KEY) or set()
        online_ids.add(user_id)
        cache.set(PRESENCE_INDEX_KEY, online_ids, timeout=PRESENCE_TIMEOUT)

    @database_sync_to_async
    def mark_user_offline(self, user_id):
        """Mark user as offline in cache and remove from the presence index."""
        cache_key = f'{PRESENCE_KEY_PREFIX}{user_id}'
        cache.delete(cache_key)

        # Remove from the shared index
        online_ids = cache.get(PRESENCE_INDEX_KEY) or set()
        online_ids.discard(user_id)
        if online_ids:
            cache.set(PRESENCE_INDEX_KEY, online_ids, timeout=PRESENCE_TIMEOUT)
        else:
            cache.delete(PRESENCE_INDEX_KEY)
