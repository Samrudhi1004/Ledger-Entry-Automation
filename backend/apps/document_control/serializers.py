"""
Serializers for the Document Control module.
"""

from rest_framework import serializers
from .models import Document, DocumentCategory, DocumentActivity


class DocumentCategorySerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = DocumentCategory
        fields = ['id', 'name', 'description', 'color_hex', 'created_at', 'document_count']
        read_only_fields = ['id', 'created_at', 'document_count']

    def get_document_count(self, obj):
        return obj.documents.count()


class DocumentActivitySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DocumentActivity
        fields = ['id', 'action', 'performed_by', 'performed_by_name', 'comment', 'timestamp']
        read_only_fields = fields

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return f'{obj.performed_by.first_name} {obj.performed_by.last_name}'.strip() or obj.performed_by.username
        return 'System'


class DocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — no file data."""
    category_name  = serializers.CharField(source='category.name', read_only=True)
    category_color = serializers.CharField(source='category.color_hex', read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    file_size_display = serializers.ReadOnlyField()

    class Meta:
        model = Document
        fields = [
            'id', 'document_number', 'title', 'description',
            'category', 'category_name', 'category_color',
            'status', 'revision', 'revision_number', 'is_latest_revision',
            'cloudinary_url', 'file_name', 'file_size', 'file_size_display', 'file_type',
            'uploaded_by', 'uploaded_by_name',
            'approved_by', 'approved_by_name',
            'effective_date', 'expiry_date',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj):
        u = obj.uploaded_by
        if u:
            return f'{u.first_name} {u.last_name}'.strip() or u.username
        return ''

    def get_approved_by_name(self, obj):
        u = obj.approved_by
        if u:
            return f'{u.first_name} {u.last_name}'.strip() or u.username
        return ''


class DocumentDetailSerializer(DocumentListSerializer):
    """Full detail serializer including activities and related entities."""
    activities   = DocumentActivitySerializer(many=True, read_only=True)
    revisions    = serializers.SerializerMethodField()
    related_part_name    = serializers.CharField(source='related_part.name', read_only=True, default=None)
    related_machine_name = serializers.CharField(source='related_machine.name', read_only=True, default=None)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta(DocumentListSerializer.Meta):
        fields = DocumentListSerializer.Meta.fields + [
            'activities', 'revisions',
            'related_part', 'related_part_name',
            'related_machine', 'related_machine_name',
            'reviewed_by', 'reviewed_by_name',
            'parent_document',
        ]
        read_only_fields = fields

    def get_reviewed_by_name(self, obj):
        u = obj.reviewed_by
        if u:
            return f'{u.first_name} {u.last_name}'.strip() or u.username
        return ''

    def get_revisions(self, obj):
        """Return all revisions in this document chain (oldest first)."""
        root = obj.parent_document if obj.parent_document else obj
        qs = Document.objects.filter(
            models.Q(id=root.id) | models.Q(parent_document=root)
        ).order_by('revision_number').values(
            'id', 'revision', 'revision_number', 'status',
            'created_at', 'is_latest_revision', 'uploaded_by__username'
        )
        return list(qs)


class DocumentCreateSerializer(serializers.ModelSerializer):
    """
    Used for POST (upload) — accepts multipart/form-data.
    The `file` field is handled in the view directly (not in the serializer)
    so we only validate the metadata fields here.
    """
    class Meta:
        model = Document
        fields = [
            'title', 'description', 'category',
            'effective_date', 'expiry_date',
            'related_part', 'related_machine',
        ]

    def validate_category(self, value):
        if not value:
            raise serializers.ValidationError('Category is required.')
        return value


# Need models.Q for DetailSerializer
from django.db import models
