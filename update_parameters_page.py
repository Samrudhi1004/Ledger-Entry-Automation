import re

file_path = 'dashboard/src/pages/ParametersPage.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
content = content.replace(
    "import { useAuth } from '../context/AuthContext';", 
    "import { useAuth } from '../context/AuthContext';\nimport AdminParametersView from '../components/parameters/AdminParametersView';"
)

# Add conditional return
content = content.replace(
    "  const isAdmin = user?.role === 'admin';", 
    "  const isAdmin = user?.role === 'admin';\n\n  if (isAdmin) {\n    return <AdminParametersView />;\n  }"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated ParametersPage.jsx')
