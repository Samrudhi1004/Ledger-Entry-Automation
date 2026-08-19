from django.apps import AppConfig


class VoiceConfig(AppConfig):
    name = 'apps.voice'

    def ready(self):
        """
        Model pre-warming is intentionally disabled for the free Render tier
        (512 MB RAM). Loading the Whisper model at startup would consume
        ~150 MB before any request is served, increasing crash risk.

        The WhisperEngine uses a singleton (_model cache), so the model is
        loaded on the first transcription request and reused for all subsequent
        requests within the same process lifecycle — effectively warm after
        the first call.
        """
        pass
