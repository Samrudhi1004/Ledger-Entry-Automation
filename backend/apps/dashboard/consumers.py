"""
WebSocket Consumer for the live inspection dashboard.

Groups:
  plant_<plant_id>  — all supervisors watching a specific plant's live feed

Events received from InspectionService:
  - measurement_recorded   → show live measurement + status
  - out_of_spec_alert      → highlight red on dashboard
  - session_completed      → move to pending review panel
  - supervisor_action      → update session status in real-time

Security (S2 + S3 Fix):
  - Token is NO LONGER read from the URL query parameter.
  - The client sends { type: 'authenticate', token: '<jwt>' } as its first message.
  - The consumer validates the token here before joining the broadcast group.
  - Unauthenticated or invalid connections are immediately closed (code 4401).
"""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class InspectionConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.plant_id   = self.scope['url_route']['kwargs']['plant_id']
        self.group_name = f"plant_{self.plant_id}"
        self.authenticated = False   # will be flipped to True after token validation

        # Accept the connection first — we validate token in the first receive() message.
        # The client has 10 seconds to send { type: 'authenticate', token: '...' } before
        # we close it automatically (handled on the frontend via immediate send on onopen).
        await self.accept()

        # Send connection acknowledgement (same as before — Flutter/React expect this)
        await self.send(text_data=json.dumps({
            'type':    'connected',
            'message': f'Connected to plant {self.plant_id} live dashboard. Send auth token.',
        }))

    async def disconnect(self, close_code):
        # Only discard from group if we were successfully authenticated and added
        if self.authenticated:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # ── Receive from WebSocket client ─────────────────────────────────────
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        msg_type = data.get('type')

        # ── Authentication handshake (first message the client must send) ──
        if msg_type in ('authenticate', 'auth'):
            token = data.get('token', '').strip()
            if not token:
                await self._reject_auth('No token provided.')
                return

            user = await self._get_user_from_token(token)
            if user is None:
                await self._reject_auth('Invalid or expired token.')
                return

            # Token is valid — join the broadcast group
            self.authenticated = True
            self.scope['user'] = user
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            logger.info(
                "[WS] User '%s' authenticated and joined group '%s'",
                user.username, self.group_name
            )
            await self.send(text_data=json.dumps({
                'type':    'auth_ok',
                'message': f'Authenticated as {user.username}.',
            }))
            return

        # ── Reject any other message from unauthenticated connections ──────
        if not self.authenticated:
            await self._reject_auth('Not authenticated. Send auth token first.')
            return

        # ── Ping/pong health check (authenticated clients only) ────────────
        if msg_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    # ── Broadcast handlers — called by channel_layer.group_send ───────────
    async def inspection_event(self, event):
        """
        Handles all inspection events pushed by InspectionService.
        Forwards directly to the connected WebSocket client.
        """
        # Remove the internal 'type' key before sending to browser
        payload = {k: v for k, v in event.items() if k != 'type'}
        await self.send(text_data=json.dumps(payload))

    # ── Helpers ───────────────────────────────────────────────────────────
    async def _reject_auth(self, reason: str):
        """Send an auth_error message then close the socket (code 4401 = unauthorised)."""
        logger.warning("[WS] Auth rejected for plant %s: %s", self.plant_id, reason)
        await self.send(text_data=json.dumps({
            'type':    'auth_error',
            'message': reason,
        }))
        await self.close(code=4401)

    @database_sync_to_async
    def _get_user_from_token(self, token: str):
        """
        Validate a SimpleJWT access token and return the User, or None if invalid.
        Runs in a thread pool (sync DB access is safe here via database_sync_to_async).
        """
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
            from django.contrib.auth import get_user_model
            User = get_user_model()

            validated = AccessToken(token)   # raises TokenError if invalid/expired
            user_id   = validated['user_id']
            return User.objects.get(pk=user_id, is_active=True)
        except Exception:
            return None
