from django.contrib import admin
from .models import Document, DocumentCategory, DocumentActivity


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display  = ['name', 'color_hex', 'created_at']
    search_fields = ['name']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display   = ['document_number', 'title', 'category', 'status', 'revision', 'uploaded_by', 'created_at']
    list_filter    = ['status', 'category', 'is_latest_revision']
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
