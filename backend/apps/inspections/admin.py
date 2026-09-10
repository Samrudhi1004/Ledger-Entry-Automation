from django.contrib import admin
from .models import JHChecklistVersion, JHChecklistItem, JHInspectionRecord, JHInspectionItemResult


@admin.register(JHChecklistVersion)
class JHChecklistVersionAdmin(admin.ModelAdmin):
    list_display = ('version_number', 'filename', 'uploaded_by', 'uploaded_at', 'total_items', 'is_active')
    list_filter = ('is_active', 'uploaded_at')
    search_fields = ('filename', 'notes', 'uploaded_by__username')


@admin.register(JHChecklistItem)
class JHChecklistItemAdmin(admin.ModelAdmin):
    list_display = ('sub_no', 'assembly', 'sub_assembly', 'check_point', 'standard', 'tool_type', 'timing_sec', 'is_active', 'sort_order')
    list_filter = ('assembly', 'tool_type', 'is_active')
    search_fields = ('sub_no', 'assembly', 'check_point', 'standard')
    list_editable = ('is_active', 'sort_order')


@admin.register(JHInspectionRecord)
class JHInspectionRecordAdmin(admin.ModelAdmin):
    list_display = ('date', 'shift', 'machine', 'operator', 'status', 'total_items', 'ok_items', 'not_ok_items', 'created_at')
    list_filter = ('shift', 'status', 'date')
    search_fields = ('machine__machine_code', 'operator__username')


@admin.register(JHInspectionItemResult)
class JHInspectionItemResultAdmin(admin.ModelAdmin):
    list_display = ('inspection', 'item', 'status', 'remark', 'action_taken')
    list_filter = ('status',)

