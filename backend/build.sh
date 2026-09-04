#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --no-input

# Auto-create superuser & demo users if they do not exist
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

demo_users = [
    {'username': 'operator', 'email': 'operator@example.com', 'password': 'Operator123!', 'employee_id': 'emp-op1', 'role': 'operator', 'first_name': 'Shop', 'last_name': 'Operator'},
    {'username': 'inspector', 'email': 'inspector@example.com', 'password': 'Inspector123!', 'employee_id': 'emp-ins1', 'role': 'quality_engineer', 'first_name': 'Quality', 'last_name': 'Inspector'},
    {'username': 'supervisor', 'email': 'supervisor@example.com', 'password': 'Supervisor123!', 'employee_id': 'emp-sup1', 'role': 'supervisor', 'first_name': 'Plant', 'last_name': 'Supervisor'},
]
for u in demo_users:
    if not User.objects.filter(username=u['username']).exists():
        User.objects.create_user(
            username=u['username'],
            email=u['email'],
            password=u['password'],
            employee_id=u['employee_id'],
            role=u['role'],
            first_name=u['first_name'],
            last_name=u['last_name']
        )
        print(f'Demo user {u[\"username\"]} created successfully!')

from apps.machines.models import Factory, Plant
factory, _ = Factory.objects.get_or_create(
    code='FAC-01',
    defaults={
        'name': 'Mantri Metallics',
        'location': 'Main Factory',
        'contact_email': 'info@mantrimetallics.com',
        'phone': '+91 98765 43210',
        'address': 'Plot No. 42, Industrial Area, Phase II',
        'gstin': '27AAAAA0000A1Z5',
        'industry_type': 'Precision Component Manufacturing',
    }
)
plant, _ = Plant.objects.get_or_create(code='PLT-01', defaults={'factory': factory, 'name': 'Shop Floor Plant 1'})
print(f'Default Factory ({factory.name}) and Plant ({plant.name}, ID: {plant.id}) created successfully!')

from apps.parts.models import InspectionParameter, ProcessParameter
for param in InspectionParameter.objects.all():
    param.save()
for param in ProcessParameter.objects.all():
    param.save()
print('All parameter limits successfully recalculated during build!')
"

# ── Pre-download Faster-Whisper model so it is baked into the build artifact ──
# HF_HOME points inside the project source so Render uploads the cached model
# files as part of the build artifact. At runtime the same HF_HOME env var
# makes the engine load from local disk (~500 ms) instead of re-downloading
# from HuggingFace on every cold start (~15 s).
echo "==> Pre-downloading Faster-Whisper 'tiny' model into build artifact..."
export HF_HOME="$(pwd)/.hf_cache"
python -c "
from faster_whisper import WhisperModel
import os
print(f'HF_HOME = {os.environ.get(\"HF_HOME\")}')
m = WhisperModel('tiny', device='cpu', compute_type='int8')
print('Faster-Whisper tiny model cached successfully.')
del m
"
echo "==> Model pre-download complete."