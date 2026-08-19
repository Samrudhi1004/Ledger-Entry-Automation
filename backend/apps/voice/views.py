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

from .number_parser import parse_measurement
from .tasks import dispatch_transcription, get_job_result

logger = logging.getLogger(__name__)


class VoiceTranscribeView(APIView):
    """
    POST /api/voice/transcribe/

    Saves audio to disk, starts a background thread for Whisper transcription,
    and returns a job_id immediately (< 0.5 s). The client polls
    GET /api/voice/status/<job_id>/ every 2 seconds for the result.

    Request: multipart/form-data
        audio_file: <audio file — WAV, M4A, MP3, WEBM>

    Response (HTTP 202):
        {
            "job_id":     "<uuid>",
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

        # Save audio to disk before handing off to the background thread.
        # The thread reads the file from this path after the request returns.
        upload_dir = Path(settings.MEDIA_ROOT) / 'voice_uploads'
        upload_dir.mkdir(parents=True, exist_ok=True)

        filename  = f"{uuid.uuid4()}{ext}"
        file_path = upload_dir / filename

        with open(file_path, 'wb+') as dest:
            for chunk in audio_file.chunks():
                dest.write(chunk)

        # Start background thread — returns job_id immediately, no waiting
        job_id = dispatch_transcription(str(file_path), request.user.id)

        return Response(
            {
                'job_id':     job_id,
                'status':     'processing',
                'audio_path': f'voice_uploads/{filename}',
            },
            status=status.HTTP_202_ACCEPTED,
        )


class VoiceStatusView(APIView):
    """
    GET /api/voice/status/<job_id>/

    Reads the transcription job's current state from Redis cache.
    The client calls this every 2 seconds after receiving a job_id
    from POST /api/voice/transcribe/.

    Responses:
        processing → {"status": "processing"}
        done       → {"status": "done", "raw_text": ..., "parsed_value": ..., ...}
        failed     → {"status": "failed", "error": "..."} HTTP 500
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        result = get_job_result(job_id)

        if result['status'] == 'failed':
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result)


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
