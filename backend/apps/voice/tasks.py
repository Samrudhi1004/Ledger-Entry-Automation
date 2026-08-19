"""
Background transcription using Python threads + Redis cache.

Why threading instead of Celery?
    Celery requires a separately paid background worker process.
    For Whisper transcription, a daemon thread inside the existing
    Django/Daphne process is simpler and completely free.

    The GIL is released during file I/O and model inference, so the
    thread runs concurrently with other requests. The result is stored
    in Django's Redis cache and polled by the client via
    GET /api/voice/status/<job_id>/.

Limitation vs Celery:
    If the server restarts mid-transcription, the in-flight thread dies
    and the job will never reach SUCCESS. The client's 60-second timeout
    in the Flutter app will catch this and show an error gracefully.
"""

import logging
import threading
import uuid
from datetime import datetime, timezone

from django.core.cache import cache

from .whisper_engine import WhisperEngine
from .number_parser import parse_measurement

logger = logging.getLogger(__name__)

# Cache timeout for job results — 10 minutes is plenty for a single voice entry
JOB_CACHE_TIMEOUT = 600


# ─── MongoDB helper (shared with views) ──────────────────────────────────────

def _log_to_mongodb(user_id, raw_text, parsed_value, file_path, language, backend):
    """Persist voice log to MongoDB for audit trail."""
    try:
        from config.db import get_collection, Collections
        get_collection(Collections.VOICE_LOGS).insert_one({
            'user_id':      user_id,
            'raw_text':     raw_text,
            'parsed_value': parsed_value,
            'file_path':    file_path,
            'language':     language,
            'backend':      backend,
            'timestamp':    datetime.now(timezone.utc),
        })
    except Exception as exc:
        logger.warning("Failed to log voice entry to MongoDB: %s", exc)


# ─── Background runner ────────────────────────────────────────────────────────

def _run_transcription(job_id: str, file_path: str, user_id: int):
    """
    Target function for the background thread.
    Runs Whisper, stores result in Redis cache under the job_id key.
    """
    try:
        engine        = WhisperEngine()
        transcription = engine.transcribe(file_path)

        raw_text     = transcription['text']
        language     = transcription['language']
        backend      = transcription['backend']
        parsed_value = parse_measurement(raw_text)
        is_parseable = parsed_value is not None

        _log_to_mongodb(
            user_id      = user_id,
            raw_text     = raw_text,
            parsed_value = parsed_value,
            file_path    = file_path,
            language     = language,
            backend      = backend,
        )

        # Store SUCCESS result in Redis
        cache.set(f"voice_job_{job_id}", {
            'status':       'done',
            'raw_text':     raw_text,
            'parsed_value': parsed_value,
            'is_parseable': is_parseable,
            'language':     language,
            'backend':      backend,
            'audio_path':   file_path,
            'message':      '' if is_parseable else 'Could not parse a number. Please try again or enter manually.',
        }, timeout=JOB_CACHE_TIMEOUT)

    except Exception as exc:
        logger.error("Background transcription failed (job=%s): %s", job_id, exc)
        # Store FAILURE result so the client doesn't poll forever
        cache.set(f"voice_job_{job_id}", {
            'status': 'failed',
            'error':  'Transcription failed. Please try again.',
        }, timeout=JOB_CACHE_TIMEOUT)


# ─── Public API (same interface as the old Celery task) ──────────────────────

def dispatch_transcription(file_path: str, user_id: int) -> str:
    """
    Start a background thread for transcription and return a job_id immediately.

    The caller stores nothing — progress is tracked via Redis cache.
    Returns the job_id string to pass back to the client.
    """
    job_id = str(uuid.uuid4())

    # Mark job as pending so status endpoint returns 'processing' immediately
    cache.set(f"voice_job_{job_id}", {'status': 'processing'}, timeout=JOB_CACHE_TIMEOUT)

    # daemon=True means the thread won't block server shutdown
    thread = threading.Thread(
        target=_run_transcription,
        args=(job_id, file_path, user_id),
        daemon=True,
    )
    thread.start()

    return job_id


def get_job_result(job_id: str) -> dict:
    """
    Read the current result for a job from Redis cache.
    Returns {'status': 'processing'} if job is still running or not found.
    """
    return cache.get(f"voice_job_{job_id}", {'status': 'processing'})
