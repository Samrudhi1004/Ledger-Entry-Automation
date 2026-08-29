import re

file_path = 'dashboard/src/pages/ParametersPage.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace <>{isAdmin ? null : ...}</> with ...
content = re.sub(r'<>{isAdmin \? null : (.+?)}</>', r'\1', content)

# Check if there are any other isAdmin references left below line 47 that need cleanup
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Cleaned up isAdmin fragments in ParametersPage.jsx')
