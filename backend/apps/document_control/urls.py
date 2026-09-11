from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import (
    DocumentCategoryViewSet,
    DocumentViewSet,
    DocumentChangeRequestViewSet,
    DCRNotificationViewSet,
)

router = SimpleRouter()
router.register('categories',      DocumentCategoryViewSet,      basename='document-category')
router.register('documents',       DocumentViewSet,              basename='document')
router.register('change-requests', DocumentChangeRequestViewSet, basename='dcr')
router.register('notifications',   DCRNotificationViewSet,       basename='dcr-notifications')

urlpatterns = [
    path('', include(router.urls)),
]
