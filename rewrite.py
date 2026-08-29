import re

file_path = 'dashboard/src/components/parameters/AdminParametersView.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will just write a new version of the component and overwrite it to avoid complex string replaces
