import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/inspections/services.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

original_fallback = """        if not parameter and not process_parameter:
            parameter = InspectionParameter.objects.filter(template__part_id=session.part_id).first()
            if not parameter:
                parameter = InspectionParameter.objects.first()
            if not parameter:
                raise ValueError(f"Parameter '{parameter_code}' not found for part {session.part.part_number}.")"""


fixed_fallback = """        if not parameter and not process_parameter:
            # Removed dangerous fallback that substituted wrong tolerances (C2)
            raise ValueError(f"Parameter '{parameter_code}' not found for part {session.part.part_number}.")"""

content = content.replace(original_fallback, fixed_fallback)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
