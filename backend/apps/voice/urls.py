from django.urls import path
from .views import VoiceTranscribeView, ParseTextView, VoiceStatusView

urlpatterns = [
    path('transcribe/',            VoiceTranscribeView.as_view(), name='voice-transcribe'),
    path('parse/',                 ParseTextView.as_view(),        name='voice-parse'),
    # New: client polls this after receiving a job_id from /transcribe/
    path('status/<str:job_id>/',   VoiceStatusView.as_view(),      name='voice-status'),
]
