"""
Document Control Models.

Three models:
  - DocumentCategory  : category/type of document (SOP, Work Instruction, etc.)
  - Document          : the actual document record with Cloudinary file storage
  - DocumentActivity  : immutable audit log for every action on a document
"""

import uuid
from django.conf import settings
from django.db import models


class DocumentCategory(models.Model):
    """
    Category / type of document.
    Examples: SOP, Work Instruction, Quality Standard, Form, Policy, ECN
    """
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    color_hex   = models.CharField(
        max_length=7,
        default='#6366f1',
        help_text='Hex color code for UI badge, e.g. #6366f1'
    )
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'document_categories'
        ordering = ['name']
        verbose_name = 'Document Category'
        verbose_name_plural = 'Document Categories'

    def __str__(self):
        return self.name


class Document(models.Model):
    """
    Core document record.
    File is stored on Cloudinary (resource_type='raw' for PDFs/docs, 'image' for images).
    Metadata (cloudinary_url, cloudinary_public_id, file_name, file_size, file_type)
    stored in PostgreSQL — mirrors the messaging.MessageAttachment pattern.
    """

    class Status(models.TextChoices):
        DRAFT        = 'draft',        'Draft'
        UNDER_REVIEW = 'under_review', 'Under Review'
        APPROVED     = 'approved',     'Approved'
        REJECTED     = 'rejected',     'Rejected'
        OBSOLETE     = 'obsolete',     'Obsolete'

    # Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Auto-generated document number, e.g. DOC-2026-001
    document_number = models.CharField(max_length=50, unique=True, db_index=True)

    # Core fields
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category    = models.ForeignKey(
        DocumentCategory,
        on_delete=models.PROTECT,
        related_name='documents'
    )
    status      = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    # Revision tracking
    revision        = models.CharField(max_length=20, default='Rev A')
    revision_number = models.PositiveIntegerField(default=1)
    is_latest_revision = models.BooleanField(default=True, db_index=True)
    # Points to the original/first document in this revision chain
    parent_document = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revisions'
    )

    # ── Cloudinary storage (mirrors messaging.MessageAttachment) ─────────────
    cloudinary_url       = models.URLField(blank=True, null=True)
    cloudinary_public_id = models.CharField(max_length=255, blank=True, null=True)
    file_name            = models.CharField(max_length=255, blank=True)
    file_size            = models.PositiveIntegerField(null=True, blank=True)  # bytes
    file_type            = models.CharField(max_length=100, blank=True)        # MIME type

    # ── Relations ────────────────────────────────────────────────────────────
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='uploaded_documents'
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_documents'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='approved_documents'
    )

    # Optional links to other entities
    related_part = models.ForeignKey(
        'parts.Part',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documents'
    )
    related_machine = models.ForeignKey(
        'machines.Machine',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documents'
    )

    # ── Dates ─────────────────────────────────────────────────────────────────
    effective_date = models.DateField(null=True, blank=True)
    expiry_date    = models.DateField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'documents'
        ordering = ['-created_at']
        verbose_name = 'Document'
        verbose_name_plural = 'Documents'

    def __str__(self):
        return f'{self.document_number} — {self.title} ({self.revision})'

    @property
    def file_size_display(self):
        """Human-readable file size."""
        if not self.file_size:
            return 'N/A'
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f'{size:.1f} {unit}'
            size /= 1024
        return f'{size:.1f} TB'


class DocumentActivity(models.Model):
    """
    Immutable audit log for every action on a document.
    Actions: uploaded, submitted_review, approved, rejected, revised, downloaded, obsoleted
    """

    ACTION_CHOICES = [
        ('uploaded',         'Uploaded'),
        ('submitted_review', 'Submitted for Review'),
        ('approved',         'Approved'),
        ('rejected',         'Rejected'),
        ('revised',          'New Revision Uploaded'),
        ('downloaded',       'Downloaded'),
        ('obsoleted',        'Marked Obsolete'),
        ('comment',          'Comment Added'),
    ]

    document     = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    action       = models.CharField(max_length=30, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='document_activities'
    )
    comment   = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'document_activities'
        ordering = ['-timestamp']
        verbose_name = 'Document Activity'
        verbose_name_plural = 'Document Activities'

    def __str__(self):
        return f'{self.document.document_number} — {self.action} by {self.performed_by}'
