"""
Views for the Document Control module.

Handles:
  1. DocumentCategoryViewSet (CRUD for categories)
  2. DocumentViewSet (Upload, revisions, in-app viewer metadata, levels L1-L4)
  3. DocumentChangeRequestViewSet (Form DKI/MR/F/05 DCR workflow, reviews, approvals, rejection, PDF)
  4. DCRNotificationViewSet (Realtime notifications, unread counts, mark as read)
"""

import mimetypes
import logging
from datetime import datetime

from django.db import transaction
from django.db.models import Q
from django.shortcuts import redirect
from django.http import HttpResponse
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

try:
    import cloudinary
    import cloudinary.uploader
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False

try:
    import filetype as filetype_lib
    FILETYPE_AVAILABLE = True
except ImportError:
    FILETYPE_AVAILABLE = False

from .models import Document, DocumentCategory, DocumentActivity, DocumentChangeRequest, DCRNotification
from .serializers import (
    DocumentCategorySerializer,
    DocumentListSerializer,
    DocumentDetailSerializer,
    DocumentCreateSerializer,
    DocumentActivitySerializer,
    DCRCreateSerializer,
    DCRReviewSerializer,
    DCRApproveSerializer,
    DCRRejectSerializer,
    DCRListSerializer,
    DCRDetailSerializer,
    DCRNotificationSerializer,
)
from .services.dcr_mailer import (
    notify_dcr_submitted,
    notify_dcr_reviewed,
    notify_dcr_rejected,
    notify_dcr_approved,
)
from .services.dcr_pdf import generate_dcr_pdf

logger = logging.getLogger(__name__)
User = get_user_model()

# Non-operator roles permitted to upload or initiate DCRs
ELIGIBLE_ROLES = ('admin', 'supervisor', 'calibrator')
FILE_SIZE_LIMIT = 50 * 1024 * 1024  # 50 MB


def _generate_document_number():
    """Auto-generate document number: DOC-YYYY-NNN"""
    year = datetime.now().year
    prefix = f'DOC-{year}-'
    last = (
        Document.objects
        .filter(document_number__startswith=prefix)
        .order_by('-document_number')
        .values_list('document_number', flat=True)
        .first()
    )
    if last:
        try:
            seq = int(last.split('-')[-1]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f'{prefix}{seq:03d}'


def _detect_mime(file):
    """Detect MIME type for uploaded document."""
    if FILETYPE_AVAILABLE:
        file_bytes = file.read(2048)
        file.seek(0)
        kind = filetype_lib.guess(file_bytes)
        if kind:
            return kind.mime
    mime, _ = mimetypes.guess_type(file.name)
    return mime or 'application/octet-stream'


def _upload_to_cloudinary(file, file_type, category_name='general'):
    """Upload document file to Cloudinary."""
    if not CLOUDINARY_AVAILABLE:
        raise RuntimeError('Cloudinary is not configured.')

    year = datetime.now().year
    resource_type = 'image' if file_type.startswith('image/') else 'raw'
    folder = f'document_control/{category_name}/{year}'

    result = cloudinary.uploader.upload(
        file,
        folder=folder,
        resource_type=resource_type,
        use_filename=True,
        unique_filename=True,
    )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 1. DocumentCategory ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class DocumentCategoryViewSet(viewsets.ModelViewSet):
    """CRUD for document categories. Read: authenticated, Write: admin only."""
    queryset = DocumentCategory.objects.all().order_by('name')
    serializer_class = DocumentCategorySerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', '') != 'admin':
            return Response({'error': 'Only admins can create categories.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if getattr(request.user, 'role', '') != 'admin':
            return Response({'error': 'Only admins can edit categories.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if getattr(request.user, 'role', '') != 'admin':
            return Response({'error': 'Only admins can delete categories.'}, status=403)
        return super().destroy(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Document ViewSet (Includes L1-L4 Filtering and Direct In-App Viewing)
# ─────────────────────────────────────────────────────────────────────────────

class DocumentViewSet(viewsets.ModelViewSet):
    """
    Main Document ViewSet.
    Supports filtering by level (L1, L2, L3, L4), status, category, and text search.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Document.objects.select_related(
            'category', 'uploaded_by', 'approved_by', 'reviewed_by'
        ).filter(is_latest_revision=True)

        user = self.request.user
        user_role = getattr(user, 'role', '')

        # Operators and inspectors only see approved documents
        if user_role in ('operator', 'quality_engineer'):
            qs = qs.filter(status=Document.Status.APPROVED)

        params = self.request.query_params
        # Filter by Document Level (L1, L2, L3, L4)
        if level := params.get('level'):
            qs = qs.filter(doc_level=level)

        # Filter by Category
        if category := params.get('category'):
            qs = qs.filter(category__id=category)

        # Filter by Status
        if status_filter := params.get('status'):
            qs = qs.filter(status=status_filter)

        # Search Query
        if search := params.get('search'):
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(document_number__icontains=search) |
                Q(description__icontains=search)
            )

        return qs.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DocumentDetailSerializer
        if self.action == 'create':
            return DocumentCreateSerializer
        return DocumentListSerializer

    def create(self, request, *args, **kwargs):
        user_role = getattr(request.user, 'role', '')
        if user_role not in ELIGIBLE_ROLES:
            return Response({'error': 'Operators and Inspectors cannot upload documents.'}, status=403)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'A file is required.'}, status=400)

        if file.size > FILE_SIZE_LIMIT:
            return Response({'error': 'Document files must be under 50 MB.'}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file_type = _detect_mime(file)
        category = serializer.validated_data.get('category')
        category_name = category.name.lower().replace(' ', '_') if category else 'general'

        try:
            upload_result = _upload_to_cloudinary(file, file_type, category_name)
        except Exception as exc:
            logger.error('Cloudinary upload failed: %s', exc)
            return Response({'error': f'File upload failed: {exc}'}, status=500)

        doc_number = _generate_document_number()

        with transaction.atomic():
            doc = serializer.save(
                uploaded_by=request.user,
                document_number=doc_number,
                cloudinary_url=upload_result['secure_url'],
                cloudinary_public_id=upload_result['public_id'],
                file_name=file.name,
                file_size=file.size,
                file_type=file_type,
                status=Document.Status.DRAFT,
            )
            DocumentActivity.objects.create(
                document=doc,
                action='uploaded',
                performed_by=request.user,
                comment=f'Uploaded initial file: {file.name}',
            )

        return Response(DocumentListSerializer(doc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='submit_review')
    def submit_review(self, request, pk=None):
        doc = self.get_object()
        if getattr(request.user, 'role', '') not in ELIGIBLE_ROLES:
            return Response({'error': 'Permission denied.'}, status=403)
        if doc.status != Document.Status.DRAFT:
            return Response({'error': 'Only Draft documents can be submitted for review.'}, status=400)

        doc.status = Document.Status.UNDER_REVIEW
        doc.save(update_fields=['status', 'updated_at'])
        DocumentActivity.objects.create(
            document=doc, action='submitted_review', performed_by=request.user,
            comment=request.data.get('comment', 'Submitted for review.')
        )
        return Response({'status': doc.status, 'detail': 'Submitted for review.'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        doc = self.get_object()
        if getattr(request.user, 'role', '') != 'admin':
            return Response({'error': 'Only admins can approve documents directly.'}, status=403)
        if doc.status not in (Document.Status.DRAFT, Document.Status.UNDER_REVIEW):
            return Response({'error': f'Cannot approve document with status {doc.status}.'}, status=400)

        doc.status = Document.Status.APPROVED
        doc.approved_by = request.user
        doc.effective_date = request.data.get('effective_date') or timezone.now().date()
        doc.save(update_fields=['status', 'approved_by', 'effective_date', 'updated_at'])
        DocumentActivity.objects.create(
            document=doc, action='approved', performed_by=request.user,
            comment=request.data.get('comment', 'Document approved.')
        )
        return Response({'status': doc.status, 'detail': 'Document approved.'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        doc = self.get_object()
        if getattr(request.user, 'role', '') != 'admin':
            return Response({'error': 'Only admins can reject documents.'}, status=403)

        doc.status = Document.Status.REJECTED
        doc.save(update_fields=['status', 'updated_at'])
        DocumentActivity.objects.create(
            document=doc, action='rejected', performed_by=request.user,
            comment=request.data.get('comment', 'Document rejected.')
        )
        return Response({'status': doc.status, 'detail': 'Document rejected.'})

    @action(detail=True, methods=['post'])
    def revise(self, request, pk=None):
        """Upload a new revision of an existing document."""
        original = self.get_object()
        user_role = getattr(request.user, 'role', '')
        if user_role not in ELIGIBLE_ROLES:
            return Response({'error': 'Permission denied.'}, status=403)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'A new revision file is required.'}, status=400)

        next_rev_num = original.revision_number + 1
        rev_letter = chr(ord('A') + next_rev_num - 1) if next_rev_num <= 26 else str(next_rev_num)
        rev_label = f'Rev {rev_letter}'

        file_type = _detect_mime(file)
        category_name = original.category.name.lower().replace(' ', '_') if original.category else 'general'

        try:
            upload_result = _upload_to_cloudinary(file, file_type, category_name)
        except Exception as exc:
            return Response({'error': f'Upload failed: {exc}'}, status=500)

        root = original.parent_document if original.parent_document else original

        with transaction.atomic():
            Document.objects.filter(
                Q(id=root.id) | Q(parent_document=root)
            ).update(is_latest_revision=False)

            new_doc = Document.objects.create(
                document_number=original.document_number,
                title=request.data.get('title') or original.title,
                description=request.data.get('description') or original.description,
                category=original.category,
                doc_level=original.doc_level,
                status=Document.Status.APPROVED if user_role == 'admin' else Document.Status.DRAFT,
                revision=rev_label,
                revision_number=next_rev_num,
                is_latest_revision=True,
                parent_document=root,
                cloudinary_url=upload_result['secure_url'],
                cloudinary_public_id=upload_result['public_id'],
                file_name=file.name,
                file_size=file.size,
                file_type=file_type,
                uploaded_by=request.user,
                related_part=original.related_part,
                related_machine=original.related_machine,
                effective_date=request.data.get('effective_date') or original.effective_date,
            )
            DocumentActivity.objects.create(
                document=new_doc, action='revised', performed_by=request.user,
                comment=f'New revision {rev_label} uploaded. Supersedes {original.revision}.',
            )

            # If this revision is tied to an approved DCR, mark DCR as IMPLEMENTED
            if dcr_id := request.data.get('dcr_id'):
                try:
                    dcr = DocumentChangeRequest.objects.get(id=dcr_id, status=DocumentChangeRequest.Status.APPROVED)
                    dcr.implemented_revision = new_doc
                    dcr.implemented_notes = request.data.get('implementation_notes', f'Implemented with {rev_label}')
                    dcr.implemented_by = request.user
                    dcr.implemented_at = timezone.now()
                    dcr.status = DocumentChangeRequest.Status.IMPLEMENTED
                    dcr.save()
                except DocumentChangeRequest.DoesNotExist:
                    pass

        return Response(DocumentListSerializer(new_doc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        doc = self.get_object()
        if not doc.cloudinary_url:
            return Response({'error': 'No file attached.'}, status=404)
        DocumentActivity.objects.create(document=doc, action='downloaded', performed_by=request.user)
        return redirect(doc.cloudinary_url)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        doc = self.get_object()
        activities = doc.activities.select_related('performed_by').order_by('-timestamp')
        return Response(DocumentActivitySerializer(activities, many=True).data)

    @action(detail=True, methods=['post'])
    def obsolete(self, request, pk=None):
        doc = self.get_object()
        if getattr(request.user, 'role', '') != 'admin':
            return Response({'error': 'Only admins can mark documents as obsolete.'}, status=403)
        doc.status = Document.Status.OBSOLETE
        doc.save(update_fields=['status', 'updated_at'])
        DocumentActivity.objects.create(
            document=doc, action='obsoleted', performed_by=request.user,
            comment=request.data.get('comment', 'Marked obsolete.')
        )
        return Response({'status': doc.status, 'detail': 'Document marked as obsolete.'})


# ─────────────────────────────────────────────────────────────────────────────
# 3. DocumentChangeRequest ViewSet (Form DKI/MR/F/05)
# ─────────────────────────────────────────────────────────────────────────────

class DocumentChangeRequestViewSet(viewsets.ModelViewSet):
    """
    Complete lifecycle ViewSet for Form DKI/MR/F/05.
    Actions:
      - submit (create DCR)
      - submit_review (CFT review approval)
      - reject_review (CFT review rejection)
      - approve (MR final authorization)
      - reject_approval (MR final rejection)
      - pdf (Export ReportLab PDF)
      - assignable_users (List users for dropdowns)
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = DocumentChangeRequest.objects.select_related(
            'document', 'raised_by', 'assigned_cft_reviewer',
            'assigned_calibrator', 'assigned_approver',
            'reviewed_by', 'approved_by', 'rejected_by', 'implemented_revision'
        )

        tab = self.request.query_params.get('tab')
        if tab == 'my_requests':
            return qs.filter(raised_by=user).order_by('-created_at')
        elif tab == 'action_required':
            return qs.filter(
                (Q(assigned_cft_reviewer=user) & Q(status=DocumentChangeRequest.Status.AWAITING_REVIEW)) |
                (Q(assigned_calibrator=user) & Q(status=DocumentChangeRequest.Status.AWAITING_REVIEW)) |
                (Q(assigned_approver=user) & Q(status=DocumentChangeRequest.Status.AWAITING_APPROVAL))
            ).order_by('-created_at')

        # Default: if admin, show all; otherwise show requests involving user
        if getattr(user, 'role', '') == 'admin':
            return qs.order_by('-created_at')
        return qs.filter(
            Q(raised_by=user) |
            Q(assigned_cft_reviewer=user) |
            Q(assigned_calibrator=user) |
            Q(assigned_approver=user)
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.action in ('create',):
            return DCRCreateSerializer
        if self.action in ('retrieve',):
            return DCRDetailSerializer
        return DCRListSerializer

    def create(self, request, *args, **kwargs):
        """Submit a new Document Change Request (Form DKI/MR/F/05)."""
        user_role = getattr(request.user, 'role', '')
        if user_role in ('operator', 'quality_engineer'):
            return Response(
                {'error': 'Operators and Inspectors cannot submit Document Change Requests.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = DCRCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            dcr = serializer.save(
                raised_by=request.user,
                status=DocumentChangeRequest.Status.AWAITING_REVIEW,
                date_of_receipt=timezone.now().date(),
            )
            DocumentActivity.objects.create(
                document=dcr.document,
                action='submitted_review',
                performed_by=request.user,
                comment=f"DCR Note {dcr.dcr_number} submitted by {request.user.username}.",
            )

        # Trigger In-App Notification and Asynchronous Email via Mailjet
        notify_dcr_submitted(dcr)

        return Response(DCRDetailSerializer(dcr).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='submit')
    def submit(self, request, *args, **kwargs):
        """Alias for submit."""
        return self.create(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='submit-review')
    def submit_review(self, request, pk=None):
        """Assigned CFT Reviewer approves review and forwards DCR to Approver."""
        dcr = self.get_object()
        user = request.user

        is_assigned = (dcr.assigned_cft_reviewer_id == user.id)
        is_admin = (getattr(user, 'role', '') == 'admin')

        if not (is_assigned or is_admin):
            return Response({'error': 'Only the assigned CFT Reviewer or Admin can review this DCR.'}, status=403)

        if dcr.status != DocumentChangeRequest.Status.AWAITING_REVIEW:
            return Response({'error': f'DCR cannot be reviewed in status {dcr.status}.'}, status=400)

        serializer = DCRReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            dcr.review_remark = serializer.validated_data['review_remark']
            dcr.implementation_date = serializer.validated_data.get('implementation_date')
            dcr.cft_remarks = serializer.validated_data.get('cft_remarks', '')
            dcr.calibrator_remarks = serializer.validated_data.get('calibrator_remarks', '')
            dcr.reviewed_by = user
            dcr.date_of_review = timezone.now()
            dcr.status = DocumentChangeRequest.Status.AWAITING_APPROVAL
            dcr.save()

            DocumentActivity.objects.create(
                document=dcr.document,
                action='comment',
                performed_by=user,
                comment=f"DCR {dcr.dcr_number} reviewed by {user.username}. Forwarded for final approval.",
            )

        # Notify assigned Approver via in-app notification & Mailjet email
        notify_dcr_reviewed(dcr)

        return Response(DCRDetailSerializer(dcr).data)

    @action(detail=True, methods=['post'], url_path='submit_review')
    def submit_review_alias(self, request, pk=None):
        return self.submit_review(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='reject-review')
    def reject_review(self, request, pk=None):
        """CFT Reviewer rejects the DCR (workflow terminates, requestor notified)."""
        dcr = self.get_object()
        user = request.user

        is_assigned = (dcr.assigned_cft_reviewer_id == user.id)
        is_admin = (getattr(user, 'role', '') == 'admin')

        if not (is_assigned or is_admin):
            return Response({'error': 'Only the assigned CFT Reviewer or Admin can reject this DCR.'}, status=403)

        serializer = DCRRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data['rejection_reason']

        with transaction.atomic():
            dcr.rejection_stage = 'review'
            dcr.rejection_reason = reason
            dcr.rejected_by = user
            dcr.date_of_rejection = timezone.now()
            dcr.status = DocumentChangeRequest.Status.REJECTED
            dcr.save()

            DocumentActivity.objects.create(
                document=dcr.document,
                action='rejected',
                performed_by=user,
                comment=f"DCR {dcr.dcr_number} rejected at CFT Review by {user.username}. Reason: {reason}",
            )

        notify_dcr_rejected(dcr, 'review', user, reason)

        return Response(DCRDetailSerializer(dcr).data)

    @action(detail=True, methods=['post'], url_path='reject_review')
    def reject_review_alias(self, request, pk=None):
        return self.reject_review(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Assigned Admin / MR grants final authorization for DCR."""
        dcr = self.get_object()
        user = request.user

        if getattr(user, 'role', '') != 'admin':
            return Response({'error': 'Only Admin / Management Representative can grant final DCR approval.'}, status=403)

        if dcr.status != DocumentChangeRequest.Status.AWAITING_APPROVAL:
            return Response({'error': f'DCR cannot be approved in status {dcr.status}. Review must be completed first.'}, status=400)

        serializer = DCRApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            dcr.mr_remarks = serializer.validated_data.get('mr_remarks', '')
            dcr.approved_by = user
            dcr.date_of_approval = timezone.now()
            dcr.status = DocumentChangeRequest.Status.APPROVED
            dcr.save()

            # Update document status to approved
            doc = dcr.document
            doc.status = Document.Status.APPROVED
            doc.save(update_fields=['status'])

            DocumentActivity.objects.create(
                document=dcr.document,
                action='approved',
                performed_by=user,
                comment=f"DCR {dcr.dcr_number} approved by {user.username}. Unlocked for new revision upload.",
            )

        notify_dcr_approved(dcr)

        return Response(DCRDetailSerializer(dcr).data)

    @action(detail=True, methods=['post'], url_path='reject-approval')
    def reject_approval(self, request, pk=None):
        """Admin / MR rejects DCR at final approval stage."""
        dcr = self.get_object()
        user = request.user

        if getattr(user, 'role', '') != 'admin':
            return Response({'error': 'Only Admin can reject DCR at approval stage.'}, status=403)

        serializer = DCRRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data['rejection_reason']

        with transaction.atomic():
            dcr.rejection_stage = 'approval'
            dcr.rejection_reason = reason
            dcr.rejected_by = user
            dcr.date_of_rejection = timezone.now()
            dcr.status = DocumentChangeRequest.Status.REJECTED
            dcr.save()

            DocumentActivity.objects.create(
                document=dcr.document,
                action='rejected',
                performed_by=user,
                comment=f"DCR {dcr.dcr_number} rejected at final approval by {user.username}. Reason: {reason}",
            )

        notify_dcr_rejected(dcr, 'approval', user, reason)

        return Response(DCRDetailSerializer(dcr).data)

    @action(detail=True, methods=['post'], url_path='reject_approval')
    def reject_approval_alias(self, request, pk=None):
        return self.reject_approval(request, pk=pk)

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        """Download Form DKI/MR/F/05 formatted PDF."""
        dcr = self.get_object()
        pdf_bytes = generate_dcr_pdf(dcr)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        filename = f"{dcr.dcr_number.replace('/', '_')}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='assignable-users')
    def assignable_users(self, request):
        """Returns non-operator/inspector users for CFT, Calibrator, and Approver dropdowns."""
        eligible_users = User.objects.exclude(
            role__in=['operator', 'quality_engineer', 'inspector']
        ).values('id', 'first_name', 'last_name', 'username', 'role', 'email')

        result = []
        for u in eligible_users:
            full_name = f"{u['first_name']} {u['last_name']}".strip() or u['username']
            result.append({
                'id': u['id'],
                'name': full_name,
                'username': u['username'],
                'role': u['role'],
                'email': u['email'],
            })
        return Response(result)

    @action(detail=False, methods=['get'], url_path='assignable_users')
    def assignable_users_alias(self, request):
        return self.assignable_users(request)


# ─────────────────────────────────────────────────────────────────────────────
# 4. DCRNotification ViewSet (Realtime Notification Popups & Bell)
# ─────────────────────────────────────────────────────────────────────────────

class DCRNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Provides realtime in-app notifications for the logged-in user."""
    serializer_class = DCRNotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DCRNotification.objects.filter(recipient=self.request.user).order_by('-created_at')[:30]

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = DCRNotification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count_alias(self, request):
        return self.unread_count(request)

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'status': 'marked_read'})

    @action(detail=True, methods=['post'], url_path='mark_read')
    def mark_read_alias(self, request, pk=None):
        return self.mark_read(request, pk=pk)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        DCRNotification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'all_marked_read'})

    @action(detail=False, methods=['post'], url_path='mark_all_read')
    def mark_all_read_alias(self, request):
        return self.mark_all_read(request)
