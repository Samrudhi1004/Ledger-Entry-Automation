"""
WebSocket Consumer for the live inspection dashboard.

Groups:
  plant_<plant_id>  — all supervisors watching a specific plant's live feed

Events received from InspectionService:
  - measurement_recorded   → show live measurement + status
  - out_of_spec_alert      → highlight red on dashboard
  - session_completed      → move to pending review panel
  - supervisor_action      → update session status in real-time
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer


class InspectionConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.plant_id  = self.scope['url_route']['kwargs']['plant_id']
        self.group_name = f"plant_{self.plant_id}"

        # Add this connection to the plant's broadcast group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send connection acknowledgement
        await self.send(text_data=json.dumps({
            'type':    'connected',
            'message': f'Connected to plant {self.plant_id} live dashboard.',
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # ── Receive from WebSocket client (optional — for future use) ──────────
    async def receive(self, text_data):
        data = json.loads(text_data)
        # Ping/pong health check
        if data.get('type') == 'ping':
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
