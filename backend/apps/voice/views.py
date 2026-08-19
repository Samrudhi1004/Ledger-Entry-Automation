import os
import uuid
import logging
from pathlib import Path

from celery.result import AsyncResult
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from django.conf import settings

from .number_parser import parse_measurement

logger = logging.getLogger(__name__)


class VoiceTranscribeView(APIView):
    """
    POST /api/voice/transcribe/

    Accepts an audio file, saves it to disk, then dispatches a Celery
    background task for transcription. Returns a job_id immediately
    (< 0.5 s) so the user is never blocked waiting for Whisper.

    The client polls GET /api/voice/status/<job_id>/ every 2 seconds
    to check progress and retrieve the final result.

    Request: multipart/form-data
        audio_file: <audio file — WAV, M4A, MP3, WEBM>

    Response (HTTP 202):
        {
            "job_id":     "<celery-task-id>",
            "status":     "processing",
            "audio_path": "voice_uploads/<filename>"
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

        # Save audio to media/voice_uploads/ before handing off to Celery.
        # The file must be on disk before the task runs because the worker
        # process reads it from the filesystem path.
        upload_dir = Path(settings.MEDIA_ROOT) / 'voice_uploads'
        upload_dir.mkdir(parents=True, exist_ok=True)

        filename  = f"{uuid.uuid4()}{ext}"
        file_path = upload_dir / filename

        with open(file_path, 'wb+') as dest:
            for chunk in audio_file.chunks():
                dest.write(chunk)

        # Dispatch to Celery — returns immediately with a task ID.
        # The actual Whisper transcription runs in a separate background process.
        from .tasks import transcribe_audio_task
        job = transcribe_audio_task.delay(str(file_path), request.user.id)

        return Response(
            {
                'job_id':     job.id,
                'status':     'processing',
                'audio_path': f'voice_uploads/{filename}',
            },
            status=status.HTTP_202_ACCEPTED,
        )


class VoiceStatusView(APIView):
    """
    GET /api/voice/status/<job_id>/

    Polls the Celery result backend (Redis) for the transcription job's
    current state. The client calls this every 2 seconds after receiving
    a job_id from POST /api/voice/transcribe/.

    Responses:
        PENDING  → {"status": "processing"}
        SUCCESS  → {"status": "done", "raw_text": ..., "parsed_value": ..., ...}
        FAILURE  → {"status": "failed", "error": "..."} HTTP 500
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        result = AsyncResult(job_id)

        if result.state == 'PENDING':
            return Response({'status': 'processing'})

        if result.state == 'FAILURE':
            return Response(
                {'status': 'failed', 'error': 'Transcription failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if result.state == 'SUCCESS':
            # Spread the task's return dict directly into the response
            return Response({'status': 'done', **result.result})

        # STARTED, RETRY, or any custom state — still working
        return Response({'status': result.state.lower()})


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
