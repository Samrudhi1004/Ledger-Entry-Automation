from django.urls import re_path
from apps.messaging.consumers import MessagingConsumer
from apps.messaging.user_consumer import UserNotificationConsumer
from apps.messaging.presence_consumer import PresenceConsumer

websocket_urlpatterns = [
    re_path(r'^ws/messaging/(?P<conversation_id>[0-9a-f-]+)/?$', MessagingConsumer.as_asgi()),
    re_path(r'^ws/messaging/notifications/?$', UserNotificationConsumer.as_asgi()),
    re_path(r'^ws/presence/?$', PresenceConsumer.as_asgi()),
]
