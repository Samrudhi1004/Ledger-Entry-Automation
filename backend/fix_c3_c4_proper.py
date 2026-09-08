import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/inspections/reminder_worker.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

original_broadcast = """def _broadcast_event(payload):
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                'dashboard_plant_1',
                {
                    'type': 'dashboard_event',
                    'event': payload['type'],
                    'data': payload,
                }
            )
    except Exception as e:
        logger.error(f"Failed to send WS escalation alert: {e}")"""

fixed_broadcast = """def _broadcast_event(payload):
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            # Safely extract Plant ID from payload (defaults to 1 if missing)
            plant_id = payload.get('plant_id', 1)
            async_to_sync(channel_layer.group_send)(
                f'plant_{plant_id}',
                {
                    'type': 'inspection.event',
                    'event': payload['type'],
                    'data': payload,
                }
            )
    except Exception as e:
        logger.error(f"Failed to send WS escalation alert: {e}")"""

content = content.replace(original_broadcast, fixed_broadcast)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
