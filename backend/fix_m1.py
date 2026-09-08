import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/config/settings.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We want to remove lines 149 to 156 safely.
dead_code_pattern = """CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = [
    'https://ledger-entry-dashboard.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
]"""

# Since CORS_ALLOW_ALL_ORIGINS is also redefined dynamically at the bottom, 
# we can safely remove this entire block.

content = content.replace(dead_code_pattern, "# CORS origins are dynamically configured below (see end of file)")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
