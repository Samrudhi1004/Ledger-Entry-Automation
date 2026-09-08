import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/inspections/reminder_worker.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add plant_id to the broadcast payloads so _broadcast_event can route correctly

original_payload_1 = """                _broadcast_event({
                    'type': 'OPERATOR_REMINDER_DUE',"""

fixed_payload_1 = """                _broadcast_event({
                    'type': 'OPERATOR_REMINDER_DUE',
                    'plant_id': session.machine.plant_id if session.machine else 1,"""

original_payload_2 = """                _broadcast_event({
                    'type': 'SUPERVISOR_ESCALATION_ALERT',"""

fixed_payload_2 = """                _broadcast_event({
                    'type': 'SUPERVISOR_ESCALATION_ALERT',
                    'plant_id': session.machine.plant_id if session.machine else 1,"""

content = content.replace(original_payload_1, fixed_payload_1)
content = content.replace(original_payload_2, fixed_payload_2)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
