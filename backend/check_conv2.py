import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.messaging.models import Conversation
from django.contrib.auth import get_user_model

User = get_user_model()
u1 = User.objects.get(username='operator')
u2 = User.objects.get(username='admin')
print(f"u1: {u1.id}, u2: {u2.id}")

existing_conv = Conversation.objects.filter(
    type=Conversation.Type.DIRECT,
    participants=u1
).filter(
    participants__id=u2.id
).first()

print(f"Existing conv: {existing_conv}")

print("All direct convs with both:")
for c in Conversation.objects.filter(type='direct'):
    if u1 in c.participants.all() and u2 in c.participants.all():
        print(c.id, [p.username for p in c.participants.all()])
