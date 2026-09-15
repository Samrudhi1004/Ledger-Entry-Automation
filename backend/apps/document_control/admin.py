from django.contrib import admin
from .models import Document, DocumentActivity, DocumentChangeRequest, DCRNotification


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display   = ['document_number', 'title', 'doc_level', 'status', 'revision', 'uploaded_by', 'created_at']
    list_filter    = ['doc_level', 'status', 'is_latest_revision']
    search_fields  = ['document_number', 'title']
    readonly_fields = ['id', 'document_number', 'cloudinary_url', 'cloudinary_public_id',
                       'file_name', 'file_size', 'file_type', 'created_at', 'updated_at']
    raw_id_fields  = ['uploaded_by', 'approved_by', 'reviewed_by', 'related_part', 'related_machine']


@admin.register(DocumentActivity)
class DocumentActivityAdmin(admin.ModelAdmin):
    list_display   = ['document', 'action', 'performed_by', 'timestamp']
    list_filter    = ['action']
    search_fields  = ['document__document_number', 'document__title']
    readonly_fields = ['document', 'action', 'performed_by', 'comment', 'timestamp']


@admin.register(DocumentChangeRequest)
class DocumentChangeRequestAdmin(admin.ModelAdmin):
    list_display   = ['dcr_number', 'document', 'raised_by', 'status', 'assigned_cft_reviewer', 'assigned_approver', 'created_at']
    list_filter    = ['status', 'date_of_receipt']
    search_fields  = ['dcr_number', 'document__document_number', 'document__title', 'raised_by__username']
    raw_id_fields  = ['document', 'raised_by', 'assigned_cft_reviewer', 'assigned_calibrator', 'assigned_approver', 'reviewed_by', 'approved_by', 'rejected_by', 'implemented_revision', 'implemented_by']


@admin.register(DCRNotification)
class DCRNotificationAdmin(admin.ModelAdmin):
    list_display   = ['recipient', 'title', 'action_type', 'is_read', 'created_at']
    list_filter    = ['is_read', 'action_type']
    search_fields  = ['recipient__username', 'title', 'message']
    raw_id_fields  = ['dcr', 'recipient']

