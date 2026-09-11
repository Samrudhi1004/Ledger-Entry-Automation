from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import DocumentCategoryViewSet, DocumentViewSet

router = SimpleRouter()
router.register('categories', DocumentCategoryViewSet, basename='document-category')
router.register('documents',  DocumentViewSet,         basename='document')

urlpatterns = [
    path('', include(router.urls)),
]
