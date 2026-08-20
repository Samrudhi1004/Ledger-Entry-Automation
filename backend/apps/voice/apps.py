import sys
import threading
from django.apps import AppConfig


def _is_web_server() -> bool:
    """Return True only when running as a WSGI/ASGI web server, not a management command."""
    argv = sys.argv
    if not argv:
        return False
    # gunicorn / uvicorn / daphne — never have manage.py in argv[0]
    # Also exclude python -c commands
    if not argv[0].endswith('manage.py') and argv[0] != '-c':
        return True
    # 'python manage.py runserver' is the dev server
    if len(argv) > 1 and argv[1] == 'runserver':
        return True
    return False


class VoiceConfig(AppConfig):
    name = 'apps.voice'

    def ready(self):
        """Pre-warm Whisper engine in background thread at server startup.

        NOTE: We intentionally skip pre-warming during management commands
        (collectstatic, migrate, etc.) because those commands exit quickly,
        which kills the daemon thread mid-way through ctranslate2 C++
        initialization → SIGABRT / core dump.
        """
        if not _is_web_server():
            return  # Don't pre-warm during collectstatic, migrate, etc.

        def _prewarm():
            try:
                from .whisper_engine import _get_local_model
                _get_local_model()
            except Exception:
                pass
        threading.Thread(target=_prewarm, daemon=True).start()
