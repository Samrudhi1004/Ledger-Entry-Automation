from django.conf import settings
from django.db import models


class VoiceLog(models.Model):
    """
    Replaces the MongoDB voice_logs collection.

    Each row records one voice transcription event: the raw audio text,
    the parsed numeric value, the temporary file path, and the backend
    (whisper / google / etc.) that produced the result.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='voice_logs',
    )
    raw_text     = models.TextField(blank=True)
    parsed_value = models.CharField(max_length=255, blank=True)
    file_path    = models.CharField(max_length=500, blank=True)
    language     = models.CharField(max_length=20, blank=True)
    backend      = models.CharField(max_length=50, blank=True)  # 'whisper', 'google', …
    timestamp    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'voice_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"VoiceLog | user={self.user_id} | {self.timestamp:%Y-%m-%d %H:%M:%S}"
