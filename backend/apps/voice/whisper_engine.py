"""
Whisper Speech-to-Text Engine.
Supports Faster-Whisper (CTranslate2 optimized), standard local Whisper, and OpenAI Whisper API.
Model is loaded once at startup and reused for all requests.
"""

import os
import time
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
    t_start = time.perf_counter()
    was_cached = _whisper_model is not None

    if _whisper_model is None:
        model_name = settings.WHISPER_MODEL  # e.g. 'tiny' or 'base'
        try:
            from faster_whisper import WhisperModel

            # Determine whether a local cache directory exists.
            # If yes, skip ALL HuggingFace network calls (local_files_only=True).
            # This eliminates the ~8-10 s remote metadata check on every cold start.
            hf_home = os.environ.get('HF_HOME', '')
            cache_dir = Path(hf_home) / 'hub' if hf_home else None
            has_local_cache = bool(cache_dir and cache_dir.exists() and any(cache_dir.iterdir()))

            logger.info(
                "[PERF ENGINE] Loading Faster-Whisper engine model '%s' (CPU int8) "
                "[local_files_only=%s, hf_home=%s]...",
                model_name, has_local_cache, hf_home or '(default)',
            )

            load_kwargs = dict(device="cpu", compute_type="int8")
            if has_local_cache:
                load_kwargs['local_files_only'] = True

            try:
                _whisper_model = WhisperModel(model_name, **load_kwargs)
            except Exception as local_err:
                if has_local_cache:
                    # Cache present but failed (e.g. corrupted) — retry with download
                    logger.warning(
                        "[PERF ENGINE] local_files_only load failed (%s), retrying with download...", local_err
                    )
                    load_kwargs.pop('local_files_only', None)
                    _whisper_model = WhisperModel(model_name, **load_kwargs)
                else:
                    raise

            _is_faster_whisper = True
            logger.info(
                "[PERF ENGINE] Faster-Whisper model '%s' loaded in %.2f ms",
                model_name, (time.perf_counter() - t_start) * 1000
            )
        except ImportError:
            import whisper
            logger.info("[PERF ENGINE] Loading standard Whisper model '%s' ...", model_name)
            _whisper_model = whisper.load_model(model_name)
            _is_faster_whisper = False
            logger.info(
                "[PERF ENGINE] Standard Whisper model '%s' loaded in %.2f ms",
                model_name, (time.perf_counter() - t_start) * 1000
            )

    load_duration_ms = (time.perf_counter() - t_start) * 1000
    return _whisper_model, _is_faster_whisper, load_duration_ms, was_cached


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
                'text':                str,    # raw transcription
                'language':            str,    # detected language code
                'backend':             str,    # 'faster-whisper' | 'local-whisper' | 'api'
                'model_load_ms':       float,  # model acquisition time
                'model_was_cached':    bool,   # whether model was cached
                'engine_duration_ms':  float,  # pure inference duration
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
        model, is_faster, load_ms, was_cached = _get_local_model()

        t_infer_start = time.perf_counter()
        if is_faster:
            segments, info = model.transcribe(
                audio_file_path,
                beam_size=1,
                initial_prompt="Numeric measurement entry: 1800, 25.01, 0.25, 315, PASS, FAIL.",
            )
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

        infer_ms = (time.perf_counter() - t_infer_start) * 1000
        logger.info(
            "[PERF ENGINE] [%s] Inference took %.2f ms | Text: '%s' (lang=%s)",
            backend_label, infer_ms, text, lang
        )
        return {
            'text': text,
            'language': lang,
            'backend': backend_label,
            'model_load_ms': round(load_ms, 2),
            'model_was_cached': was_cached,
            'engine_duration_ms': round(infer_ms, 2),
        }

    # ── API Whisper (for future) ───────────────────────────────────────────
    def _transcribe_api(self, audio_file_path: str) -> dict:
        t_infer_start = time.perf_counter()
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
            infer_ms = (time.perf_counter() - t_infer_start) * 1000
            logger.info("[PERF ENGINE] Whisper API took %.2f ms | Text: '%s'", infer_ms, text)
            return {
                'text': text,
                'language': lang,
                'backend': 'api',
                'model_load_ms': 0.0,
                'model_was_cached': True,
                'engine_duration_ms': round(infer_ms, 2),
            }
        except Exception as e:
            logger.error("Whisper API failed: %s. Falling back to local.", str(e))
            # Auto-fallback to local
            return self._transcribe_local(audio_file_path)
