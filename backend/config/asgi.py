"""
ASGI config — supports both HTTP (Django) and WebSocket (Django Channels).
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Import websocket URL patterns after Django is set up
django_asgi_app = get_asgi_application()

from apps.dashboard.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    # HTTP requests → standard Django
    'http': django_asgi_app,

    # WebSocket requests → Django Channels
    'websocket': AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
