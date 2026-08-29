import re

file_path = 'dashboard/src/pages/ParametersPage.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'useAuth' not in content:
    content = content.replace(
        "import { useState, useEffect, useCallback } from 'react';", 
        "import { useState, useEffect, useCallback } from 'react';\nimport { useAuth } from '../context/AuthContext';"
    )
    content = content.replace(
        "export default function ParametersPage() {", 
        "export default function ParametersPage() {\n  const { user } = useAuth();\n  const isAdmin = user?.role === 'admin';"
    )

    patterns = [
        r'(<button[^>]*onClick={\(\)\s*=>\s*handle(?:OpenEditMachine|DeleteMachine|OpenEditPart|DeletePartItem|DeleteOperationItem)\([^>]+>.*?</button>)',
        r'(<button[^>]*onClick={handleOpenAdd(?:Machine|Part)}[^>]+>.*?</button>)',
        r'(<button[^>]*onClick={\(\)\s*=>\s*setShowAddOpModal\(true\)}[^>]+>.*?</button>)',
        r'(<button[^>]*onClick={\(\)\s*=>\s*handle(?:OpenEditParam|DeleteParam|OpenEditProcessParam|DeleteProcessParam)\([^>]+>.*?</button>)',
        r'(<button[^>]*onClick={\(\)\s*=>\s*setShowAddParamModal\(true\)}[^>]+>.*?</button>)',
        r'(<button[^>]*onClick={\(\)\s*=>\s*setShowProcessParamModal\(true\)}[^>]+>.*?</button>)'
    ]

    for pat in patterns:
        content = re.sub(pat, r'<>{isAdmin ? null : \1}</>', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Modified ParametersPage.jsx')
else:
    print('Already modified.')
