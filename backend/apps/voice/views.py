import os
import uuid
import logging
from pathlib import Path

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from django.conf import settings

from .whisper_engine import WhisperEngine
from .number_parser import parse_measurement
from config.db import get_collection, Collections

logger = logging.getLogger(__name__)
_whisper = WhisperEngine()


class VoiceTranscribeView(APIView):
    """
    POST /api/voice/transcribe/

    Accepts an audio file, transcribes with Whisper,
    parses the numeric measurement, and returns the result.

    Request: multipart/form-data
        audio_file: <audio file — WAV, M4A, MP3, WEBM>

    Response:
        {
            "raw_text":      "twenty five point zero one",
            "parsed_value":  25.01,
            "is_parseable":  true,
            "language":      "en",
            "backend":       "local"
        }
    """
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request):
        audio_file = request.FILES.get('audio_file')
        if not audio_file:
            return Response(
                {'error': 'No audio file provided. Send as multipart with key "audio_file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file extension
        allowed_extensions = {'.wav', '.mp3', '.m4a', '.webm', '.ogg', '.flac'}
        ext = Path(audio_file.name).suffix.lower()
        if ext not in allowed_extensions:
            return Response(
                {'error': f'Unsupported audio format: {ext}. Allowed: {allowed_extensions}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save to media/voice_uploads/ temporarily
        upload_dir = Path(settings.MEDIA_ROOT) / 'voice_uploads'
        upload_dir.mkdir(parents=True, exist_ok=True)

        filename     = f"{uuid.uuid4()}{ext}"
        file_path    = upload_dir / filename

        with open(file_path, 'wb+') as dest:
            for chunk in audio_file.chunks():
                dest.write(chunk)

        try:
            # ── Transcribe ─────────────────────────────────────────────
            transcription = _whisper.transcribe(str(file_path))
            raw_text      = transcription['text']
            language      = transcription['language']
            backend       = transcription['backend']

            # ── Parse number ────────────────────────────────────────────
            parsed_value  = parse_measurement(raw_text)
            is_parseable  = parsed_value is not None

            # ── Log to MongoDB ──────────────────────────────────────────
            self._log_voice_entry(
                user_id      = request.user.id,
                raw_text     = raw_text,
                parsed_value = parsed_value,
                file_path    = str(file_path),
                language     = language,
                backend      = backend,
            )

            return Response({
                'raw_text':     raw_text,
                'parsed_value': parsed_value,
                'is_parseable': is_parseable,
                'language':     language,
                'backend':      backend,
                'audio_path':   f"voice_uploads/{filename}",
                'message':      '' if is_parseable else 'Could not parse a number. Please try again or enter manually.',
            })

        except Exception as e:
            logger.error("Voice transcription error: %s", str(e))
            # Clean up file on error
            if file_path.exists():
                os.remove(file_path)
            return Response(
                {'error': f'Transcription failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _log_voice_entry(self, user_id, raw_text, parsed_value, file_path, language, backend):
        """Save voice log to MongoDB for audit trail."""
        try:
            from datetime import datetime, timezone
            get_collection(Collections.VOICE_LOGS).insert_one({
                'user_id':      user_id,
                'raw_text':     raw_text,
                'parsed_value': parsed_value,
                'file_path':    file_path,
                'language':     language,
                'backend':      backend,
                'timestamp':    datetime.now(timezone.utc),
            })
        except Exception as e:
            logger.warning("Failed to log voice entry to MongoDB: %s", str(e))


class ParseTextView(APIView):
    """
    POST /api/voice/parse/
    Parse raw text to number without audio upload.
    Useful for testing the number parser directly.

    Request: { "text": "twenty five point zero one" }
    Response: { "raw_text": "...", "parsed_value": 25.01, "is_parseable": true }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'text field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_value = parse_measurement(text)
        return Response({
            'raw_text':     text,
            'parsed_value': parsed_value,
            'is_parseable': parsed_value is not None,
        })
