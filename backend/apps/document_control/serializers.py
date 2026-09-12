"""
Serializers for the Document Control module.
"""

from django.db import models
from rest_framework import serializers
from .models import (
    Document,
    DocumentActivity,
    DocumentChangeRequest,
    DCRNotification,
)


def get_user_display(user):
    if not user:
        return ''
    name = f"{user.first_name} {user.last_name}".strip()
    return name or user.username


class DocumentActivitySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DocumentActivity
        fields = ['id', 'action', 'performed_by', 'performed_by_name', 'comment', 'timestamp']
        read_only_fields = fields

    def get_performed_by_name(self, obj):
        return get_user_display(obj.performed_by) or 'System'


class DocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for document list views."""
    doc_level_display = serializers.CharField(source='get_doc_level_display', read_only=True)
    uploaded_by_name  = serializers.SerializerMethodField()
    approved_by_name  = serializers.SerializerMethodField()
    file_size_display = serializers.ReadOnlyField()

    class Meta:
        model = Document
        fields = [
            'id', 'document_number', 'title', 'description',
            'doc_level', 'doc_level_display',
            'status', 'revision', 'revision_number', 'is_latest_revision',
            'cloudinary_url', 'file_name', 'file_size', 'file_size_display', 'file_type',
            'uploaded_by', 'uploaded_by_name',
            'approved_by', 'approved_by_name',
            'effective_date', 'expiry_date',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj):
        return get_user_display(obj.uploaded_by)

    def get_approved_by_name(self, obj):
        return get_user_display(obj.approved_by)


class DocumentDetailSerializer(DocumentListSerializer):
    """Full detail serializer including activities, revision tree, and links."""
    activities           = DocumentActivitySerializer(many=True, read_only=True)
    revisions            = serializers.SerializerMethodField()
    related_part_name    = serializers.CharField(source='related_part.name', read_only=True, default=None)
    related_machine_name = serializers.CharField(source='related_machine.name', read_only=True, default=None)
    reviewed_by_name     = serializers.SerializerMethodField()

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
        return get_user_display(obj.reviewed_by)

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
    The file payload is handled directly in the view.
    """
    class Meta:
        model = Document
        fields = [
            'title', 'description', 'doc_level',
            'effective_date', 'expiry_date',
            'related_part', 'related_machine',
        ]



# ── DCR Serializers (DKI/MR/F/05) ─────────────────────────────────────────────

class DCRCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new Document Change Request.
    Validates that requestor and assigned reviewers meet role criteria.
    """
    class Meta:
        model = DocumentChangeRequest
        fields = [
            'document', 'document_description', 'basis_for_change',
            'form_doc_no', 'issue_no_date', 'rev_no_date',
            'assigned_cft_reviewer', 'assigned_calibrator', 'assigned_approver',
        ]

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'document_id' in data and 'document' not in data:
            data['document'] = data['document_id']
        if 'reason_for_change' in data and 'basis_for_change' not in data:
            data['basis_for_change'] = data['reason_for_change']
        if 'nature_of_change' in data and 'document_description' not in data:
            data['document_description'] = data['nature_of_change'] or data.get('reason_for_change', 'Document change requested')
        elif not data.get('document_description') and data.get('basis_for_change'):
            data['document_description'] = data['basis_for_change']
        if 'reviewer_id' in data and 'assigned_cft_reviewer' not in data:
            data['assigned_cft_reviewer'] = data['reviewer_id']
        if 'calibrator_id' in data and 'assigned_calibrator' not in data:
            data['assigned_calibrator'] = data['calibrator_id']
        if 'approver_id' in data and 'assigned_approver' not in data:
            data['assigned_approver'] = data['approver_id']
        return super().to_internal_value(data)

    def validate(self, attrs):
        user = self.context['request'].user
        # Exclude operator and inspector (quality_engineer) from raising DCRs
        if getattr(user, 'role', '') in ['operator', 'quality_engineer']:
            raise serializers.ValidationError(
                "Operators and Inspectors are not authorized to submit Document Change Requests."
            )

        cft = attrs.get('assigned_cft_reviewer')
        cal = attrs.get('assigned_calibrator')
        app = attrs.get('assigned_approver')

        if not cft:
            raise serializers.ValidationError({"assigned_cft_reviewer": "A CFT Reviewer must be assigned."})
        if getattr(cft, 'role', '') == 'operator':
            raise serializers.ValidationError({"assigned_cft_reviewer": "Reviewer cannot be an Operator."})

        if cal and getattr(cal, 'role', '') == 'operator':
            raise serializers.ValidationError({"assigned_calibrator": "Calibrator cannot be an Operator."})

        if not app:
            raise serializers.ValidationError({"assigned_approver": "An Approver must be assigned."})
        if getattr(app, 'role', '') == 'operator':
            raise serializers.ValidationError({"assigned_approver": "Approver cannot be an Operator."})

        return attrs


class DCRReviewSerializer(serializers.Serializer):
    """Payload when assigned CFT Reviewer submits their review."""
    review_remark = serializers.CharField(required=False, allow_blank=True)
    implementation_date = serializers.DateField(required=False, allow_null=True)
    cft_remarks = serializers.CharField(required=False, allow_blank=True)
    calibrator_remarks = serializers.CharField(required=False, allow_blank=True)

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'comments' in data and not data.get('review_remark'):
            data['review_remark'] = data['comments']
        res = super().to_internal_value(data)
        if not res.get('review_remark'):
            res['review_remark'] = 'Review completed and verified.'
        return res


class DCRApproveSerializer(serializers.Serializer):
    """Payload when assigned Approver stamps final approval."""
    mr_remarks = serializers.CharField(required=False, allow_blank=True)

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'comments' in data and not data.get('mr_remarks'):
            data['mr_remarks'] = data['comments']
        return super().to_internal_value(data)


class DCRRejectSerializer(serializers.Serializer):
    """Payload when either Reviewer or Approver rejects the DCR."""
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'rejected_reason' in data and not data.get('rejection_reason'):
            data['rejection_reason'] = data['rejected_reason']
        res = super().to_internal_value(data)
        if not res.get('rejection_reason'):
            raise serializers.ValidationError({'rejection_reason': 'Rejection reason is required.'})
        return res


class DCRListSerializer(serializers.ModelSerializer):
    """List serializer for DCR records."""
    document_title       = serializers.CharField(source='document.title', read_only=True)
    document_number      = serializers.CharField(source='document.document_number', read_only=True)
    document_revision    = serializers.CharField(source='document.revision', read_only=True)
    document_level       = serializers.CharField(source='document.doc_level', read_only=True)
    raised_by_name       = serializers.SerializerMethodField()
    cft_reviewer_name    = serializers.SerializerMethodField()
    calibrator_name      = serializers.SerializerMethodField()
    approver_name        = serializers.SerializerMethodField()

    class Meta:
        model = DocumentChangeRequest
        fields = [
            'id', 'dcr_number', 'document',
            'form_doc_no', 'issue_no_date', 'rev_no_date',
            'document_title', 'document_number', 'document_revision', 'document_level',
            'raised_by', 'raised_by_name', 'date_of_receipt',
            'assigned_cft_reviewer', 'cft_reviewer_name',
            'assigned_calibrator', 'calibrator_name',
            'assigned_approver', 'approver_name',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_raised_by_name(self, obj):
        return get_user_display(obj.raised_by)

    def get_cft_reviewer_name(self, obj):
        return get_user_display(obj.assigned_cft_reviewer)

    def get_calibrator_name(self, obj):
        return get_user_display(obj.assigned_calibrator)

    def get_approver_name(self, obj):
        return get_user_display(obj.assigned_approver)


class DCRDetailSerializer(DCRListSerializer):
    """Full detail view matching Form DKI/MR/F/05."""
    reviewed_by_name   = serializers.SerializerMethodField()
    approved_by_name   = serializers.SerializerMethodField()
    rejected_by_name   = serializers.SerializerMethodField()
    implemented_by_name = serializers.SerializerMethodField()
    cloudinary_url     = serializers.CharField(source='document.cloudinary_url', read_only=True)
    company_name       = serializers.SerializerMethodField()
    company_logo_url   = serializers.SerializerMethodField()

    class Meta(DCRListSerializer.Meta):
        fields = DCRListSerializer.Meta.fields + [
            'document_description', 'basis_for_change',
            'review_remark', 'implementation_date', 'cft_remarks', 'calibrator_remarks',
            'reviewed_by', 'reviewed_by_name', 'date_of_review',
            'mr_remarks', 'approved_by', 'approved_by_name', 'date_of_approval',
            'rejection_stage', 'rejection_reason', 'rejected_by', 'rejected_by_name', 'date_of_rejection',
            'implemented_revision', 'implemented_notes', 'implemented_by', 'implemented_by_name', 'implemented_at',
            'cloudinary_url', 'company_name', 'company_logo_url',
        ]
        read_only_fields = fields

    def get_company_name(self, obj):
        from apps.machines.models import Factory
        f = Factory.objects.filter(is_active=True).first()
        return f.name if f else 'Mantri Metallics Pvt. Ltd.'

    def get_company_logo_url(self, obj):
        from apps.machines.models import Factory
        f = Factory.objects.filter(is_active=True).first()
        return f.logo_url if (f and f.logo_url) else ''

    def get_reviewed_by_name(self, obj):
        return get_user_display(obj.reviewed_by)

    def get_approved_by_name(self, obj):
        return get_user_display(obj.approved_by)

    def get_rejected_by_name(self, obj):
        return get_user_display(obj.rejected_by)

    def get_implemented_by_name(self, obj):
        return get_user_display(obj.implemented_by)


class DCRNotificationSerializer(serializers.ModelSerializer):
    """Serializer for in-app DCR notification bell."""
    dcr_number = serializers.CharField(source='dcr.dcr_number', read_only=True)
    document_title = serializers.CharField(source='dcr.document.title', read_only=True)

    class Meta:
        model = DCRNotification
        fields = [
            'id', 'dcr', 'dcr_number', 'document_title',
            'recipient', 'title', 'message', 'action_type',
            'action_url', 'is_read', 'created_at',
        ]
        read_only_fields = fields
