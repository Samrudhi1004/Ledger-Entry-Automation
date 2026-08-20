import threading
from django.apps import AppConfig


class VoiceConfig(AppConfig):
    name = 'apps.voice'

    def ready(self):
        """Pre-warm Whisper engine in background thread at server startup."""
        def _prewarm():
            try:
                from .whisper_engine import _get_local_model
                _get_local_model()
            except Exception as exc:
                pass
        threading.Thread(target=_prewarm, daemon=True).start()
