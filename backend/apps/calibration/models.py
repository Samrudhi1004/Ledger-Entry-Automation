from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone


class CalibrationEquipment(models.Model):
    equipment_id = models.CharField(max_length=50, unique=True)
    equipment_name = models.CharField(max_length=150)
    equipment_type = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, unique=True)
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
