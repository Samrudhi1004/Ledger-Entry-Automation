import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/inspections/views.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

original_code = """        if machine_code:
            # Clear ALL sessions for this machine unconditionally to provide a completely clean slate
            active_sessions = InspectionSession.objects.filter(
                machine__machine_code=machine_code
            )"""

fixed_code = """        if machine_code:
            # Safely clear only non-completed sessions to keep historical finalized data intact
            active_sessions = InspectionSession.objects.filter(
                machine__machine_code=machine_code
            ).exclude(status='completed')"""

original_code_single = """        if session_id:
            session = InspectionSession.objects.filter(session_id=session_id).first()
            if session:
                session.delete()"""

fixed_code_single = """        if session_id:
            session = InspectionSession.objects.filter(session_id=session_id).exclude(status='completed').first()
            if session:
                session.delete()"""

content = content.replace(original_code, fixed_code)
content = content.replace(original_code_single, fixed_code_single)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
