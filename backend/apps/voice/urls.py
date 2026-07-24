from django.urls import path
from .views import VoiceTranscribeView, ParseTextView

urlpatterns = [
    path('transcribe/', VoiceTranscribeView.as_view(), name='voice-transcribe'),
    path('parse/',      ParseTextView.as_view(),       name='voice-parse'),
]
