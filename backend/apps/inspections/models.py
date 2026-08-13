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
        IN_PROGRESS      = 'in_progress',      'In Progress'
        PENDING_REVIEW   = 'pending_review',   'Pending Review'
        APPROVED         = 'approved',         'Approved'
        REJECTED         = 'rejected',         'Rejected'
        FINALIZED_PASSED = 'finalized_passed', 'Finalized (Passed)'
        FINALIZED_FAILED = 'finalized_failed', 'Finalized (Failed)'
        COMPLETED        = 'completed',        'Completed'

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
    finalized_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='finalized_sessions',
    )

    # Session metadata
    inspection_type            = models.CharField(max_length=20)  # first_piece / hourly / final
    shift                      = models.CharField(max_length=1, choices=Shift.choices, default=Shift.A)
    status                     = models.CharField(max_length=25, choices=Status.choices, default=Status.IN_PROGRESS)
    trial_number               = models.IntegerField(default=1)   # 1 for 1st PC #1, 2 for 1st PC #2, 3 for 1st PC #3
    parent_session             = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='child_trials')
    rejection_reason           = models.TextField(blank=True)
    hourly_unlocked_slot       = models.IntegerField(default=0)   # 0 = setup, 1..8 for 1/HR..8/HR
    shift_start_time           = models.DateTimeField(null=True, blank=True)
    supervisor_override_active = models.BooleanField(default=False)
    is_setup_approved          = models.BooleanField(default=False)
    is_first_piece_finalized   = models.BooleanField(default=False)
    finalized_at               = models.DateTimeField(null=True, blank=True)
    pdf_report_path            = models.CharField(max_length=500, blank=True, null=True)

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

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()
        if self.inspection_type == 'first_piece' and self.trial_number > 3:
            raise ValidationError("First Piece Inspection is limited to a maximum of 3 attempts (1st PC #1, #2, #3).")

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


class DailyProductionReport(models.Model):
    """
    Dedicated model for End-of-Day Daily Production Reports.
    Completely separate from inspection session records.
    """
    report_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    date = models.DateField()
    machine = models.ForeignKey('machines.Machine', on_delete=models.PROTECT, related_name='production_reports')
    part = models.ForeignKey('parts.Part', on_delete=models.PROTECT, related_name='production_reports')
    operation = models.CharField(max_length=100, blank=True, default='')
    shift = models.CharField(max_length=1, choices=InspectionSession.Shift.choices, default=InspectionSession.Shift.A)
    operator = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='production_reports')

    production_target = models.PositiveIntegerField(default=0)
    jobs_completed = models.PositiveIntegerField(default=0)
    correct_jobs = models.PositiveIntegerField(default=0)
    incorrect_jobs = models.PositiveIntegerField(default=0)

    cr_count = models.PositiveIntegerField(default=0)  # Customer Rejection / CR Quantity
    mr_count = models.PositiveIntegerField(default=0)  # Machine Rejection / MR Quantity
    rw_count = models.PositiveIntegerField(default=0)  # Rework / RW Quantity

    remarks = models.TextField(blank=True, default='')
    achievement_percentage = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'daily_production_reports'
        ordering = ['-date', '-created_at']

    def save(self, *args, **kwargs):
        if self.production_target > 0:
            self.achievement_percentage = round((self.jobs_completed / self.production_target) * 100, 2)
        else:
            self.achievement_percentage = 0.0
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Daily Production Report {self.date} | {self.machine.machine_code} | {self.operator.username}"

