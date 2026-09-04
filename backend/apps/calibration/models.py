from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone


class CalibrationEquipment(models.Model):
    equipment_id = models.CharField(max_length=50, unique=True)
    equipment_name = models.CharField(max_length=150)
    equipment_type = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, unique=True)
    manufacturer = models.CharField(max_length=150, blank=True)
    model_number = models.CharField(max_length=100, blank=True)
    range_size = models.CharField(max_length=100, blank=True)
    least_count = models.CharField(max_length=100, blank=True)
    acceptable_error = models.CharField(max_length=100, blank=True)
    acceptance_criteria = models.TextField(blank=True)
    history_card_number = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100)
    location = models.CharField(max_length=150)
    calibration_frequency_days = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    last_calibration_date = models.DateField()
    next_calibration_date = models.DateField(db_index=True)
    remarks = models.TextField(blank=True)
    is_failed = models.BooleanField(default=False, db_index=True)
    failed_date = models.DateField(blank=True, null=True)
    failure_remark = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'calibration_equipment'
        ordering = ['next_calibration_date', 'equipment_id']

    def __str__(self):
        return f'{self.equipment_id} - {self.equipment_name}'

    @property
    def days_remaining(self):
        if self.is_failed:
            return None
        return (self.next_calibration_date - timezone.localdate()).days

    @property
    def calibration_status(self):
        if self.is_failed:
            return 'Failed'
        if self.days_remaining < 0:
            return 'Overdue'
        if self.days_remaining == 0:
            return 'Due Today'
        if self.days_remaining <= 30:
            return 'Due Soon'
        return 'Valid'


class CalibrationRecord(models.Model):
    class Result(models.TextChoices):
        PASSED = 'passed', 'Passed'
        FAILED = 'failed', 'Failed'

    equipment = models.ForeignKey(
        CalibrationEquipment,
        on_delete=models.PROTECT,
        related_name='calibration_records',
    )
    planned_date = models.DateField()
    calibration_date = models.DateField()
    result = models.CharField(max_length=10, choices=Result.choices)
    calibration_agency = models.CharField(max_length=150, blank=True)
    report_number = models.CharField(max_length=100, blank=True)
    certificate_number = models.CharField(max_length=100, blank=True)
    traceability_certificate_number = models.CharField(max_length=100, blank=True)
    specified_size = models.CharField(max_length=100, blank=True)
    calibration_details = models.TextField(blank=True)
    next_due_date = models.DateField(blank=True, null=True)
    remarks = models.TextField(blank=True)
    # ponytail: PostgreSQL storage keeps reports durable on Render; move to object storage when volume grows.
    report_file = models.BinaryField(blank=True, null=True, editable=False)
    report_file_name = models.CharField(max_length=255, blank=True)
    report_content_type = models.CharField(max_length=100, blank=True)
    report_file_size = models.PositiveIntegerField(blank=True, null=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='calibration_records',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'calibration_records'
        ordering = ['-calibration_date', '-created_at']

    def __str__(self):
        return f'{self.equipment.equipment_id} - {self.calibration_date} - {self.get_result_display()}'


class CalibrationPlanEntry(models.Model):
    equipment = models.ForeignKey(
        CalibrationEquipment,
        on_delete=models.PROTECT,
        related_name='calibration_plan_entries',
    )
    planned_date = models.DateField(db_index=True)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'calibration_plan_entries'
        ordering = ['planned_date', 'equipment__equipment_id']
        constraints = [
            models.UniqueConstraint(
                fields=['equipment', 'planned_date'],
                name='unique_equipment_calibration_plan_date',
            ),
        ]

    def __str__(self):
        return f'{self.equipment.equipment_id} - {self.planned_date}'
