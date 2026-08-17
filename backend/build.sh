#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --no-input

# Auto-create superuser if it does not exist
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'LihaTech')
email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'LihaTech2026@gmail.com')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'Admin12345!')
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password, employee_id='emp-001', role='admin')
    print(f'Superuser {username} created successfully!')
else:
    print(f'Superuser {username} already exists.')
"