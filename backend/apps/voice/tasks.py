"""
Celery background tasks for the voice / transcription app.

Why a separate task?
    Whisper transcription on CPU takes 5–30 seconds. Running it
    inside a synchronous HTTP request blocks the Daphne worker for
    that entire time and freezes the user's screen. Moving it to a
    Celery task lets the view return a job_id immediately (< 0.5 s)
    while the heavy work happens in a separate background process.
"""

import logging
from datetime import datetime, timezone

from celery import shared_task

from .whisper_engine import WhisperEngine
from .number_parser import parse_measurement

logger = logging.getLogger(__name__)


# ─── MongoDB helper ───────────────────────────────────────────────────────────

def _log_to_mongodb(user_id, raw_text, parsed_value, file_path, language, backend):
    """
    Persist a voice transcription record to MongoDB for audit trail.
    Extracted from the view into a standalone helper so both the task
    and any future callers can reuse it without importing the view class.
    """
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


# ─── Celery Task ──────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2)
def transcribe_audio_task(self, file_path: str, user_id: int) -> dict:
    """
    Run Whisper transcription + number parsing in a background Celery process.

    The view dispatches this with .delay() and immediately returns a job_id
    to the client. The client polls GET /api/voice/status/<job_id>/ every
    2 seconds until state becomes SUCCESS or FAILURE.

    Returns a dict that is stored by Celery's result backend (Redis) and
    retrieved by VoiceStatusView.
    """
    try:
        engine        = WhisperEngine()
        transcription = engine.transcribe(file_path)

        raw_text     = transcription['text']
        language     = transcription['language']
        backend      = transcription['backend']
        parsed_value = parse_measurement(raw_text)
        is_parseable = parsed_value is not None

        # Persist to MongoDB after transcription succeeds
        _log_to_mongodb(
            user_id      = user_id,
            raw_text     = raw_text,
            parsed_value = parsed_value,
            file_path    = file_path,
            language     = language,
            backend      = backend,
        )

        return {
            'status':       'done',
            'raw_text':     raw_text,
            'parsed_value': parsed_value,
            'is_parseable': is_parseable,
            'language':     language,
            'backend':      backend,
            'audio_path':   file_path,
            'message':      '' if is_parseable else 'Could not parse a number. Please try again or enter manually.',
        }

    except Exception as exc:
        logger.error("Celery transcription task failed (attempt %s): %s",
                     self.request.retries + 1, exc)
        # Retry up to max_retries times with a 3-second gap before re-raising
        raise self.retry(exc=exc, countdown=3)
