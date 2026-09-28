from django.db import models
from django.conf import settings

class BugReport(models.Model):
    STATUS_CHOICES = (
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bug_reports')
    message = models.TextField()
    # Cloudinary storage — survives Railway/Render redeploys (no local disk dependency)
    screenshot_url = models.URLField(blank=True, null=True)
    screenshot_public_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bug_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"BugReport #{self.id} from {self.user.username}"
