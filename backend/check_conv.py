import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.messaging.models import Conversation
for c in Conversation.objects.filter(type='direct'):
    print(c.id, [p.username for p in c.participants.all()])
