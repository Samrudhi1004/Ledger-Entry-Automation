from django.contrib import admin

from .models import CalibrationEquipment, CalibrationPlanEntry, CalibrationRecord


class CalibrationRecordInline(admin.TabularInline):
    model = CalibrationRecord
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(CalibrationEquipment)
class CalibrationEquipmentAdmin(admin.ModelAdmin):
    list_display = (
        'equipment_id', 'equipment_name', 'equipment_type',
        'next_calibration_date', 'calibration_status',
    )
    list_filter = ('is_failed', 'equipment_type', 'department')
    search_fields = ('equipment_id', 'equipment_name', 'serial_number')
    inlines = (CalibrationRecordInline,)


@admin.register(CalibrationRecord)
class CalibrationRecordAdmin(admin.ModelAdmin):
    list_display = ('equipment', 'calibration_date', 'result', 'certificate_number', 'report_file_name', 'next_due_date')
    list_filter = ('result', 'calibration_date')
    search_fields = ('equipment__equipment_id', 'equipment__equipment_name', 'certificate_number')

    def get_queryset(self, request):
        return super().get_queryset(request).defer('report_file')


@admin.register(CalibrationPlanEntry)
class CalibrationPlanEntryAdmin(admin.ModelAdmin):
    list_display = ('equipment', 'planned_date', 'remarks')
    list_filter = ('planned_date',)
    search_fields = ('equipment__equipment_id', 'equipment__equipment_name')
