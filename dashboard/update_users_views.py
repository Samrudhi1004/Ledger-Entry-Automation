import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/users/views.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the entire hacked post() method with just the super() call
# and update the docstring to remove the mention of demo accounts.

new_content = re.sub(
    r'    """\n    POST /api/users/login/\n    Returns access \+ refresh JWT tokens with embedded role info\.\n    Auto-ensures credentials for default demo accounts\.\n    """',
    r'    """\n    POST /api/users/login/\n    Returns access + refresh JWT tokens with embedded role info.\n    """',
    content
)

new_content = re.sub(
    r'    def post\(self, request, \*args, \*\*kwargs\):[\s\S]*?return super\(\)\.post\(request, \*args, \*\*kwargs\)',
    r'    # Inherits post() directly from TokenObtainPairView.',
    new_content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)
