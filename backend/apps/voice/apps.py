from django.apps import AppConfig


class VoiceConfig(AppConfig):
    name = 'apps.voice'

    def ready(self):
        """
        Pre-load the Whisper model into memory when Django starts up.

        Without this, the model is loaded lazily on the first transcription
        request inside a Celery worker, adding 10–30 s to the first job.
        Loading here means the model is already warm by the time any task runs.

        RUN_MAIN guard: Django's dev-server runs ready() twice (once for the
        reloader, once for the real process). Skipping on the reloader process
        avoids loading a 150 MB model into memory twice in development.
        """
        import os
        if os.environ.get('RUN_MAIN') == 'true':
            # Development reloader process — skip to avoid double-loading
            return

        try:
            from .whisper_engine import _get_local_model
            _get_local_model()
        except Exception:
            # Don't crash server startup if the model file is missing or
            # faster-whisper is not installed — the task will fail gracefully.
            pass
