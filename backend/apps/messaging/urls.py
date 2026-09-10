from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.messaging.views import (
    ConversationViewSet,
    MessageViewSet,
    FileUploadView,
    UserSearchView,
    UserPresenceView,
    BulkUserPresenceView,
    DownloadAttachmentView
)

# Create router for viewsets
router = DefaultRouter()
router.register(r'conversations', ConversationViewSet, basename='conversation')

# Nested router for messages within conversations
app_name = 'messaging'

urlpatterns = [
    # Router URLs
    path('', include(router.urls)),

    # Messages within a conversation
    path('conversations/<uuid:conversation_pk>/messages/',
         MessageViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='conversation-messages'),
    path('conversations/<uuid:conversation_pk>/messages/<uuid:pk>/',
         MessageViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}),
         name='conversation-message-detail'),
    path('conversations/<uuid:conversation_pk>/messages/<uuid:pk>/read/',
         MessageViewSet.as_view({'post': 'read'}),
         name='message-read'),
    path('conversations/<uuid:conversation_pk>/messages/<uuid:pk>/forward/',
         MessageViewSet.as_view({'post': 'forward'}),
         name='message-forward'),

    # File upload
    path('upload/', FileUploadView.as_view(), name='file-upload'),

    # User search
    path('users/search/', UserSearchView.as_view(), name='user-search'),

    # User presence
    path('users/<int:user_id>/presence/', UserPresenceView.as_view(), name='user-presence'),
    path('users/presence/bulk/', BulkUserPresenceView.as_view(), name='bulk-user-presence'),

    # Download attachments
    path('attachments/<uuid:attachment_id>/download/', DownloadAttachmentView.as_view(), name='download-attachment'),
]
