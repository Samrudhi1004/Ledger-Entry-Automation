# Import the Celery app so it is initialised when Django starts.
# Without this, Celery tasks would not be discovered until the first
# worker request, causing "NotRegistered" errors on cold starts.
from .celery import app as celery_app  # noqa: F401

__all__ = ('celery_app',)
