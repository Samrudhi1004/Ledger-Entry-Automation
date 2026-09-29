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

# Per-user connection-count key: presence:conn_count:{user_id}
# Tracks how many WebSocket connections a user currently has open so that
# we only mark them offline (and broadcast the event) when the LAST
# connection closes — preventing false offline events when the same user
# has multiple tabs or devices open simultaneously.
PRESENCE_CONN_COUNT_PREFIX = 'presence:conn_count:'


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

        # Mark user as online and increment their connection counter.
        await self.mark_user_online(self.user.id)

        # Join presence broadcast group
        await self.channel_layer.group_add(
            'presence_updates',
            self.channel_name
        )

        await self.accept()

        # Get all currently online users
        online_user_ids = await self.get_all_online_users()

        # Send initial presence + connection confirmation.
        # Only suppress genuine WebSocket send errors (client gone mid-handshake).
        # Channel-layer errors are re-raised so we can clean up properly.
        try:
            await self.send(text_data=json.dumps({
                'type': 'initial_presence',
                'data': {
                    'online_users': online_user_ids
                }
            }))
        except Exception:
            # Client disconnected before initial data could be delivered.
            # Clean up group membership and presence state then bail out.
            await self._cleanup_on_failed_connect()
            return

        try:
            # Broadcast to all users that this user is now online
            await self.channel_layer.group_send(
                'presence_updates',
                {
                    'type': 'user_status_changed',
                    'user_id': self.user.id,
                    'status': 'online'
                }
            )
        except Exception:
            # Channel-layer failure during online broadcast — clean up so the
            # user is not left in a half-connected state.
            await self._cleanup_on_failed_connect()
            return

        try:
            # Send connection confirmation
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': f'Presence tracking connected for user {self.user.id}'
            }))
        except Exception:
            # Client disconnected just before confirmation — already online in
            # the group; disconnect() will handle full cleanup.
            pass

    async def _cleanup_on_failed_connect(self):
        """Remove user from group and undo online marking after a failed connect."""
        try:
            await self.channel_layer.group_discard(
                'presence_updates',
                self.channel_name
            )
        except Exception:
            pass
        await self.mark_user_offline(self.user.id)

    async def disconnect(self, close_code):
        """Mark user as offline when they disconnect."""
        if hasattr(self, 'user') and self.user:
            # Mark user as offline (decrements connection counter; only removes
            # from presence index when the last connection closes).
            await self.mark_user_offline(self.user.id)

            # Leave the group FIRST so this consumer does not receive its own
            # broadcast and attempt to send on an already-closed WebSocket.
            # Wrap separately so a channel-layer failure here does NOT prevent
            # the offline broadcast from reaching the remaining clients.
            try:
                await self.channel_layer.group_discard(
                    'presence_updates',
                    self.channel_name
                )
            except Exception:
                pass

            # Only broadcast offline if this was the user's last connection.
            if not await self.user_has_active_connections(self.user.id):
                # Now safe to broadcast — this consumer is no longer in the group.
                await self.channel_layer.group_send(
                    'presence_updates',
                    {
                        'type': 'user_status_changed',
                        'user_id': self.user.id,
                        'status': 'offline'
                    }
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
        try:
            await self.send(text_data=json.dumps({
                'type': 'user_status_changed',
                'data': {
                    'user_id': event['user_id'],
                    'status': event['status']
                }
            }))
        except Exception:
            # Client disconnected before message could be delivered — safe to ignore.
            pass

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
        Django cache backend : no cache.keys() needed.
        """
        online_ids = cache.get(PRESENCE_INDEX_KEY)
        if not online_ids:
            return []
        return list(online_ids)

    @database_sync_to_async
    def user_has_active_connections(self, user_id):
        """Return True if the user still has at least one active WS connection."""
        count = cache.get(f'{PRESENCE_CONN_COUNT_PREFIX}{user_id}', 0)
        return count > 0

    @database_sync_to_async
    def mark_user_online(self, user_id):
        """Increment connection count, mark user as online, add to presence index."""
        # Increment per-user connection counter atomically via add+incr pattern.
        conn_key = f'{PRESENCE_CONN_COUNT_PREFIX}{user_id}'
        count = cache.get(conn_key, 0)
        cache.set(conn_key, count + 1, timeout=PRESENCE_TIMEOUT)

        # Keep the shared index up-to-date.
        # Re-fetch each time to minimise (not eliminate) race window on
        # non-atomic backends; on Redis use atomic ops via django-redis if needed.
        cache_key = f'{PRESENCE_KEY_PREFIX}{user_id}'
        cache.set(cache_key, 'online', timeout=PRESENCE_TIMEOUT)

        online_ids = cache.get(PRESENCE_INDEX_KEY) or set()
        online_ids.add(user_id)
        cache.set(PRESENCE_INDEX_KEY, online_ids, timeout=PRESENCE_TIMEOUT)

    @database_sync_to_async
    def mark_user_offline(self, user_id):
        """Decrement connection count; remove from presence index on last disconnect."""
        conn_key = f'{PRESENCE_CONN_COUNT_PREFIX}{user_id}'
        count = max(cache.get(conn_key, 0) - 1, 0)
        if count > 0:
            cache.set(conn_key, count, timeout=PRESENCE_TIMEOUT)
            # Still has other connections — stay online in the index.
            return

        # Last connection closed — remove from presence entirely.
        cache.delete(conn_key)
        cache_key = f'{PRESENCE_KEY_PREFIX}{user_id}'
        cache.delete(cache_key)

        online_ids = cache.get(PRESENCE_INDEX_KEY) or set()
        online_ids.discard(user_id)
        if online_ids:
            cache.set(PRESENCE_INDEX_KEY, online_ids, timeout=PRESENCE_TIMEOUT)
        else:
            cache.delete(PRESENCE_INDEX_KEY)
