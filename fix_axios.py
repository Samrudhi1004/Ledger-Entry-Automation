import re

file_path = 'dashboard/src/api/axios.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "'https://ledger-entry-backend.onrender.com'",
    "'http://127.0.0.1:8000'"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
