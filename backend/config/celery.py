"""
Celery application entry point.

Loaded automatically via config/__init__.py so that Celery workers
and Django share the same settings module without duplication.
"""

import os
from celery import Celery

# Tell Celery which Django settings module to use
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('ledger_automation')

# Read Celery config from Django settings — any key that starts with
# CELERY_ is automatically picked up (e.g. CELERY_BROKER_URL).
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks.py in every installed Django app
app.autodiscover_tasks()
