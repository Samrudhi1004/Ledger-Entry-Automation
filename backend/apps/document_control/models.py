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
from django.utils import timezone


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

    class Level(models.TextChoices):
        L1 = 'L1', 'L1 — Quality Manual & Policies'
        L2 = 'L2', 'L2 — Standard Operating Procedures (SOP)'
        L3 = 'L3', 'L3 — Work Instructions & Standards'
        L4 = 'L4', 'L4 — Forms, Formats & Checklists'

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
    doc_level   = models.CharField(
        max_length=2,
        choices=Level.choices,
        default=Level.L2,
        db_index=True,
        help_text="IATF/ISO Document Hierarchy Tier"
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


class DocumentChangeRequest(models.Model):
    """
    Formal Document Change Request (DCR) Note.
    Corresponds to paper standard Form DKI/MR/F/05.
    Manages multi-stage sequential review, approval, and revision implementation.
    """

    class Status(models.TextChoices):
        DRAFT             = 'draft',             'Draft'
        SUBMITTED         = 'submitted',         'Submitted'
        AWAITING_REVIEW   = 'awaiting_review',   'Awaiting Review'
        REVIEWED          = 'reviewed',          'Reviewed'
        AWAITING_APPROVAL = 'awaiting_approval', 'Awaiting Approval'
        APPROVED          = 'approved',          'Approved'
        REJECTED          = 'rejected',          'Rejected'
        IMPLEMENTED       = 'implemented',       'Implemented'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dcr_number = models.CharField(max_length=50, unique=True, db_index=True)

    # ── Section 0: Form Header Metadata (Form DKI/MR/F/05) ─────────────────────
    form_doc_no   = models.CharField(max_length=50, default='DKI/MR/F/05', blank=True)
    issue_no_date = models.CharField(max_length=50, default='01/01.04.2018', blank=True)
    rev_no_date   = models.CharField(max_length=50, default='01/01.04.2018', blank=True)

    # Linked original document
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='change_requests'
    )

    # ── Section 1: Initiator / Raised By ──────────────────────────────────────
    raised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='raised_dcrs'
    )
    date_of_receipt = models.DateField(default=timezone.now)
    document_description = models.TextField(help_text="What the document currently states")
    basis_for_change = models.TextField(help_text="Reason / technical basis for change")

    # ── Section 2: Named User Assignments ─────────────────────────────────────
    assigned_cft_reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='dcr_cft_reviews',
        help_text="Assigned Cross-Functional Team Reviewer"
    )
    assigned_calibrator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='dcr_calibrator_reviews',
        help_text="Assigned Calibrator for verification"
    )
    assigned_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='dcr_approvals',
        help_text="Assigned Management Representative / Admin Approver"
    )

    # ── Section 3: Review Stage (CFT & Calibrator) ────────────────────────────
    review_remark = models.TextField(blank=True, help_text="Change Review Remark")
    implementation_date = models.DateField(null=True, blank=True, help_text="Change to be implemented from")
    cft_remarks = models.TextField(blank=True, help_text="CFT Remarks")
    calibrator_remarks = models.TextField(blank=True, help_text="Calibrator Remarks")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_dcrs'
    )
    date_of_review = models.DateTimeField(null=True, blank=True)

    # ── Section 4: Approval Stage (MR / Admin) ────────────────────────────────
    mr_remarks = models.TextField(blank=True, help_text="Management Representative remarks")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='approved_dcrs'
    )
    date_of_approval = models.DateTimeField(null=True, blank=True)

    # ── Section 5: Rejection Details ─────────────────────────────────────────
    rejection_stage = models.CharField(max_length=20, blank=True)  # 'review' or 'approval'
    rejection_reason = models.TextField(blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='rejected_dcrs'
    )
    date_of_rejection = models.DateTimeField(null=True, blank=True)

    # ── Section 6: Implementation Stage ──────────────────────────────────────
    implemented_revision = models.ForeignKey(
        Document,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='implemented_from_dcr'
    )
    implemented_notes = models.TextField(blank=True, help_text="Change implemented with documents")
    implemented_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='implemented_dcrs'
    )
    implemented_at = models.DateTimeField(null=True, blank=True)

    # ── Status & Timestamps ───────────────────────────────────────────────────
    status = models.CharField(
        max_length=25,
        choices=Status.choices,
        default=Status.SUBMITTED,
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'document_change_requests'
        ordering = ['-created_at']
        verbose_name = 'Document Change Request'
        verbose_name_plural = 'Document Change Requests'

    def __str__(self):
        return f'{self.dcr_number} — {self.document.document_number} ({self.status})'

    def save(self, *args, **kwargs):
        if not self.dcr_number:
            year = timezone.now().year
            count = DocumentChangeRequest.objects.filter(dcr_number__startswith=f'DCR-{year}-').count() + 1
            self.dcr_number = f'DCR-{year}-{count:03d}'
        super().save(*args, **kwargs)


class DCRNotification(models.Model):
    """
    In-app notifications for DCR assignments, reviews, approvals, and rejections.
    Drives the realtime badge counter and dropdown in the application header.
    """

    class ActionType(models.TextChoices):
        REVIEW_REQUESTED   = 'review_requested',   'Review Requested'
        APPROVAL_REQUESTED = 'approval_requested', 'Approval Requested'
        DCR_APPROVED       = 'dcr_approved',       'DCR Approved'
        DCR_REJECTED       = 'dcr_rejected',       'DCR Rejected'
        DCR_IMPLEMENTED    = 'dcr_implemented',    'DCR Implemented'
        GENERAL            = 'general',            'General'

    dcr = models.ForeignKey(
        DocumentChangeRequest,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='dcr_notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    action_type = models.CharField(
        max_length=30,
        choices=ActionType.choices,
        default=ActionType.GENERAL
    )
    action_url = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'document_dcr_notifications'
        ordering = ['-created_at']
        verbose_name = 'DCR Notification'
        verbose_name_plural = 'DCR Notifications'

    def __str__(self):
        return f'{self.recipient} — {self.title} ({self.created_at})'

