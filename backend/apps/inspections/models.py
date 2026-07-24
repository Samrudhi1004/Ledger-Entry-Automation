"""
InspectionSession — lightweight PostgreSQL index that links to the
full inspection document stored in MongoDB.
"""

import uuid
from django.db import models


class InspectionSession(models.Model):
    """
    PostgreSQL record: acts as an index/reference for the full MongoDB document.
    All measurement details live in MongoDB (inspection_records collection).
    """

    class Status(models.TextChoices):
        IN_PROGRESS     = 'in_progress',     'In Progress'
        PENDING_REVIEW  = 'pending_review',  'Pending Review'
        APPROVED        = 'approved',        'Approved'
        REJECTED        = 'rejected',        'Rejected'

    class Shift(models.TextChoices):
        A = 'A', 'Shift A'
        B = 'B', 'Shift B'
        C = 'C', 'Shift C'

    # Unique identifier — same ID used as MongoDB document _id reference
    session_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # Relations
    part    = models.ForeignKey('parts.Part',    on_delete=models.PROTECT, related_name='sessions')
    machine = models.ForeignKey('machines.Machine', on_delete=models.PROTECT, related_name='sessions')
    operator   = models.ForeignKey(
        'users.User', on_delete=models.PROTECT, related_name='operated_sessions'
    )
    supervisor = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='supervised_sessions',
    )

    # Session metadata
    inspection_type            = models.CharField(max_length=20)  # first_piece / hourly / final
    shift                      = models.CharField(max_length=1, choices=Shift.choices, default=Shift.A)
    status                     = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    trial_number               = models.IntegerField(default=1)   # 1 for 1st PC #1, 2 for 1st PC #2, 3 for 1st PC #3
    parent_session             = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='child_trials')
    rejection_reason           = models.TextField(blank=True)
    hourly_unlocked_slot       = models.IntegerField(default=0)   # 0 = setup, 1..8 for 1/HR..8/HR
    shift_start_time           = models.DateTimeField(null=True, blank=True)
    supervisor_override_active = models.BooleanField(default=False)
    is_setup_approved          = models.BooleanField(default=False)

    # Quick flags (avoid expensive MongoDB lookups for dashboards)
    total_parameters  = models.PositiveIntegerField(default=0)
    recorded_count    = models.PositiveIntegerField(default=0)
    has_ooc           = models.BooleanField(default=False)  # out-of-spec flag
    has_critical_fail = models.BooleanField(default=False)

    # Timestamps & Reminder tracking
    started_at          = models.DateTimeField(auto_now_add=True)
    last_measurement_at = models.DateTimeField(null=True, blank=True)
    completed_at        = models.DateTimeField(null=True, blank=True)
    reviewed_at         = models.DateTimeField(null=True, blank=True)
    supervisor_remark   = models.TextField(blank=True)

    # Reminder & Escalation flags
    operator_reminded       = models.BooleanField(default=False)
    operator_reminded_at    = models.DateTimeField(null=True, blank=True)
    supervisor_escalated    = models.BooleanField(default=False)
    supervisor_escalated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'inspection_sessions'
        ordering = ['-started_at']

    def __str__(self):
        return f"Session {self.session_id} | {self.part.part_number} | {self.status}"

    @property
    def is_complete(self):
        return self.recorded_count >= self.total_parameters

    @property
    def progress_percent(self):
        if self.total_parameters == 0:
            return 0
        return round((self.recorded_count / self.total_parameters) * 100)
