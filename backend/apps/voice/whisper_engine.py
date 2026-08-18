"""
Whisper Speech-to-Text Engine.
Supports Faster-Whisper (CTranslate2 optimized), standard local Whisper, and OpenAI Whisper API.
Model is loaded once at startup and reused for all requests.
"""

import os
import logging
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

# ─── Lazy model loader (singleton) ───────────────────────────────────────
_whisper_model = None
_is_faster_whisper = False


def _get_local_model():
    """Load Faster-Whisper (or standard Whisper) once and cache it."""
    global _whisper_model, _is_faster_whisper
    if _whisper_model is None:
        model_name = settings.WHISPER_MODEL  # e.g. 'tiny' or 'base'
        try:
            from faster_whisper import WhisperModel
            logger.info("Loading Faster-Whisper engine model '%s' (CPU int8)...", model_name)
            _whisper_model = WhisperModel(model_name, device="cpu", compute_type="int8")
            _is_faster_whisper = True
            logger.info("Faster-Whisper model '%s' loaded successfully.", model_name)
        except ImportError:
            import whisper
            logger.info("Loading standard Whisper model '%s' ...", model_name)
            _whisper_model = whisper.load_model(model_name)
            _is_faster_whisper = False
            logger.info("Standard Whisper model '%s' loaded successfully.", model_name)
    return _whisper_model, _is_faster_whisper


# ─── Whisper Engine ───────────────────────────────────────────────────────
class WhisperEngine:
    """
    Transcribes audio files to text.

    Usage:
        engine = WhisperEngine()
        text = engine.transcribe('/path/to/audio.wav')
    """

    def __init__(self):
        self.backend = settings.WHISPER_BACKEND  # 'local' | 'api'

    def transcribe(self, audio_file_path: str) -> dict:
        """
        Transcribe an audio file.

        Returns:
            {
                'text':     str,    # raw transcription
                'language': str,    # detected language code
                'backend':  str,    # 'faster-whisper' | 'local-whisper' | 'api'
            }
        """
        if not Path(audio_file_path).exists():
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

        if self.backend == 'local':
            return self._transcribe_local(audio_file_path)
        elif self.backend == 'api':
            return self._transcribe_api(audio_file_path)
        else:
            raise ValueError(f"Unknown WHISPER_BACKEND: {self.backend}")

    # ── Local Whisper (Faster-Whisper / Standard) ─────────────────────────
    def _transcribe_local(self, audio_file_path: str) -> dict:
        model, is_faster = _get_local_model()

        if is_faster:
            segments, info = model.transcribe(audio_file_path, beam_size=5)
            text = " ".join([segment.text for segment in segments]).strip()
            lang = info.language or 'en'
            backend_label = 'faster-whisper'
        else:
            result = model.transcribe(
                audio_file_path,
                language=None,          # auto-detect
                task='transcribe',
                fp16=False,             # CPU-safe
                verbose=False,
            )
            text = result.get('text', '').strip()
            lang = result.get('language', 'en')
            backend_label = 'local-whisper'

        logger.info("[%s] Transcribed: '%s' (lang=%s)", backend_label, text, lang)
        return {'text': text, 'language': lang, 'backend': backend_label}

    # ── API Whisper (for future) ───────────────────────────────────────────
    def _transcribe_api(self, audio_file_path: str) -> dict:
        try:
            import openai
            openai.api_key = settings.OPENAI_API_KEY
            with open(audio_file_path, 'rb') as audio_file:
                response = openai.audio.transcriptions.create(
                    model='whisper-1',
                    file=audio_file,
                    response_format='verbose_json',
                )
            text = response.text.strip()
            lang = getattr(response, 'language', 'en')
            logger.info("Whisper API transcribed: '%s'", text)
            return {'text': text, 'language': lang, 'backend': 'api'}
        except Exception as e:
            logger.error("Whisper API failed: %s. Falling back to local.", str(e))
            # Auto-fallback to local
            return self._transcribe_local(audio_file_path)
