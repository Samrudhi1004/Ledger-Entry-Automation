from django.urls import re_path
from .consumers import InspectionConsumer

websocket_urlpatterns = [
    re_path(r'^ws/dashboard/(?P<plant_id>\w+)/?$', InspectionConsumer.as_asgi()),
]
