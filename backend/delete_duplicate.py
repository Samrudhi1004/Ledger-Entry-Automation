import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.messaging.models import Conversation

try:
    c = Conversation.objects.get(id='257537cd-5601-47f1-9a5e-601aad0db25c')
    c.delete()
    print("Deleted duplicate conversation successfully")
except Exception as e:
    print(f"Error: {e}")
