#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --no-input

# Run clean user seed script (ensures only 5 standard accounts exist)
python clean_and_seed_users.py

python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
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
        'shift_hours': 8,
        'total_shifts_per_day': 3,
        'lunch_break_minutes': 30,
        'tea_break_minutes': 30,
        'available_working_minutes': 420,
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