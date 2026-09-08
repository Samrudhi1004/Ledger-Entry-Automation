import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/inspections/reminder_worker.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# C3: The group name is hardcoded to 'dashboard_plant_1'.
# C4: The type is hardcoded to 'dashboard_event', while consumers.py expects 'inspection.event'.

original_broadcast = """def _broadcast_event(session, event_type: str, message: str):
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            'dashboard_plant_1',
            {
                'type': 'dashboard_event',
                'data': {
                    'event_type': event_type,
                    'machine_id': session.machine_id,
                    'session_id': str(session.session_id),
                    'message': message,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
            }
        )"""


fixed_broadcast = """def _broadcast_event(session, event_type: str, message: str):
    channel_layer = get_channel_layer()
    if channel_layer:
        plant_id = session.machine.plant_id if (session.machine and session.machine.plant_id) else 1
        group_name = f"plant_{plant_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'inspection.event',  # Matched to consumer's async def inspection_event()
                'data': {
                    'event_type': event_type,
                    'machine_id': session.machine_id,
                    'session_id': str(session.session_id),
                    'message': message,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
            }
        )"""

content = content.replace(original_broadcast, fixed_broadcast)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
