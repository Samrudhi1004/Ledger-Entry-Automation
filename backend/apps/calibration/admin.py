from django.contrib import admin

from .models import CalibrationEquipment


@admin.register(CalibrationEquipment)
class CalibrationEquipmentAdmin(admin.ModelAdmin):
    list_display = (
        'equipment_id', 'equipment_name', 'equipment_type',
        'next_calibration_date', 'calibration_status',
    )
    list_filter = ('is_failed', 'equipment_type', 'department')
    search_fields = ('equipment_id', 'equipment_name', 'serial_number')

