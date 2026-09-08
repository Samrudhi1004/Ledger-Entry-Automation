import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/inspections/views.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# The incorrect code looks like this:
#    def get_permissions(self):
#        if self.action in ['export_excel', 'export_pdf']:
#            return []
#        return [IsAuthenticated()]
# We want to change the "return []" to "return [IsAuthenticated()]"

content = re.sub(
    r"def get_permissions\(self\):\n\s*if self\.action in \['export_excel', 'export_pdf'\]:\n\s*return \[\]\n\s*return \[IsAuthenticated\(\)\]",
    r"def get_permissions(self):\n        if self.action in ['export_excel', 'export_pdf']:\n            return [IsAuthenticated()]\n        return [IsAuthenticated()]",
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
