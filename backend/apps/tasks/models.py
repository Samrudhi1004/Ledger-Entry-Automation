from django.db import models
from apps.users.models import User

class Task(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        FLAGGED_ISSUE = 'flagged_issue', 'Flagged Issue'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'


    title = models.CharField(max_length=255)
    description = models.TextField()
    allocated_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='allocated_tasks')
    allocated_to = models.ForeignKey(User, on_delete=models.PROTECT, related_name='assigned_tasks')
    deadline = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    issue_description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tasks'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} (Allocated to {self.allocated_to.username})"
