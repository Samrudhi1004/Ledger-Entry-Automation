"""
Views for the Document Control module.

File upload uses Cloudinary (resource_type='raw' for docs, 'image' for images)
mirroring the existing messaging app pattern exactly.
"""

import mimetypes
import logging
from datetime import datetime

from django.db import transaction
from django.db.models import Q
from django.shortcuts import redirect

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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

from .models import Document, DocumentCategory, DocumentActivity
from .serializers import (
    DocumentCategorySerializer,
    DocumentListSerializer,
    DocumentDetailSerializer,
    DocumentCreateSerializer,
    DocumentActivitySerializer,
)

logger = logging.getLogger(__name__)

# Roles allowed to upload / approve / reject
UPLOAD_ROLES  = ('admin', 'supervisor')
APPROVE_ROLES = ('admin', 'supervisor')
FILE_SIZE_LIMIT = 50 * 1024 * 1024  # 50 MB


def _user_display_name(user):
    if user:
        return f'{user.first_name} {user.last_name}'.strip() or user.username
    return 'Unknown'


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
    """Detect MIME type — mirrors messaging/views.py FileUploadView pattern."""
    if FILETYPE_AVAILABLE:
        file_bytes = file.read(2048)
        file.seek(0)
        kind = filetype_lib.guess(file_bytes)
        if kind:
            return kind.mime
    # Fallback
    mime, _ = mimetypes.guess_type(file.name)
    return mime or 'application/octet-stream'


def _upload_to_cloudinary(file, file_type, category_name='general'):
    """
    Upload file to Cloudinary.
    resource_type='raw' for non-image documents, 'image' for images.
    Returns dict with 'secure_url' and 'public_id'.
    """
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
# DocumentCategory ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class DocumentCategoryViewSet(viewsets.ModelViewSet):
    """
    CRUD for document categories.
    Write access: admin only. Read access: all authenticated users.
    """
    queryset = DocumentCategory.objects.all().order_by('name')
    serializer_class = DocumentCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        if request.user.role not in ('admin',):
            return Response({'error': 'Only admins can create categories.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.role not in ('admin',):
            return Response({'error': 'Only admins can edit categories.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('admin',):
            return Response({'error': 'Only admins can delete categories.'}, status=403)
        return super().destroy(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# Document ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class DocumentViewSet(viewsets.ModelViewSet):
    """
    Main document ViewSet.

    List/Retrieve : all authenticated users
    Create        : admin, supervisor
    Update/Delete : admin only
    Custom actions: submit_review, approve, reject, revise, download, history
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Document.objects.select_related(
            'category', 'uploaded_by', 'approved_by', 'reviewed_by'
        ).filter(is_latest_revision=True)

        # Operators only see approved documents
        user = self.request.user
        if hasattr(user, 'role') and user.role not in APPROVE_ROLES:
            qs = qs.filter(status=Document.Status.APPROVED)

        # Filters
        params = self.request.query_params
        if category := params.get('category'):
            qs = qs.filter(category__id=category)
        if status_filter := params.get('status'):
            qs = qs.filter(status=status_filter)
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

    # ── CREATE (Upload) ───────────────────────────────────────────────────────

    def create(self, request, *args, **kwargs):
        if not hasattr(request.user, 'role') or request.user.role not in UPLOAD_ROLES:
            return Response({'error': 'Only admins and supervisors can upload documents.'}, status=403)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'A file is required.'}, status=400)

        # File size check
        if file.size > FILE_SIZE_LIMIT:
            return Response({'error': 'Document files must be under 50 MB.'}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Detect MIME
        file_type = _detect_mime(file)

        # Get category name for Cloudinary folder
        category = serializer.validated_data.get('category')
        category_name = category.name.lower().replace(' ', '_') if category else 'general'

        # Upload to Cloudinary
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
                comment=f'Uploaded file: {file.name}',
            )

        return Response(DocumentListSerializer(doc).data, status=201)

    # ── SUBMIT FOR REVIEW ─────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='submit_review')
    def submit_review(self, request, pk=None):
        doc = self.get_object()
        if request.user.role not in UPLOAD_ROLES:
            return Response({'error': 'Permission denied.'}, status=403)
        if doc.status != Document.Status.DRAFT:
            return Response({'error': 'Only Draft documents can be submitted for review.'}, status=400)

        doc.status = Document.Status.UNDER_REVIEW
        doc.save(update_fields=['status', 'updated_at'])
        DocumentActivity.objects.create(
            document=doc, action='submitted_review', performed_by=request.user,
            comment=request.data.get('comment', '')
        )
        return Response({'status': doc.status, 'detail': 'Submitted for review.'})

    # ── APPROVE ────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        doc = self.get_object()
        if request.user.role not in APPROVE_ROLES:
            return Response({'error': 'Only admins and supervisors can approve documents.'}, status=403)
        if doc.status != Document.Status.UNDER_REVIEW:
            return Response({'error': 'Only documents under review can be approved.'}, status=400)

        doc.status = Document.Status.APPROVED
        doc.approved_by = request.user
        doc.save(update_fields=['status', 'approved_by', 'updated_at'])
        DocumentActivity.objects.create(
            document=doc, action='approved', performed_by=request.user,
            comment=request.data.get('comment', '')
        )
        return Response({'status': doc.status, 'detail': 'Document approved.'})

    # ── REJECT ─────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        doc = self.get_object()
        if request.user.role not in APPROVE_ROLES:
            return Response({'error': 'Only admins and supervisors can reject documents.'}, status=403)
        if doc.status not in (Document.Status.UNDER_REVIEW, Document.Status.DRAFT):
            return Response({'error': 'Document cannot be rejected in its current state.'}, status=400)

        comment = request.data.get('comment', '')
        if not comment:
            return Response({'error': 'A rejection reason (comment) is required.'}, status=400)

        doc.status = Document.Status.REJECTED
        doc.save(update_fields=['status', 'updated_at'])
        DocumentActivity.objects.create(
            document=doc, action='rejected', performed_by=request.user, comment=comment
        )
        return Response({'status': doc.status, 'detail': 'Document rejected.'})

    # ── REVISE (upload new revision) ───────────────────────────────────────────

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def revise(self, request, pk=None):
        original = self.get_object()
        if request.user.role not in UPLOAD_ROLES:
            return Response({'error': 'Permission denied.'}, status=403)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'A file is required for revision.'}, status=400)
        if file.size > FILE_SIZE_LIMIT:
            return Response({'error': 'Document files must be under 50 MB.'}, status=400)

        file_type = _detect_mime(file)
        category_name = original.category.name.lower().replace(' ', '_')

        try:
            upload_result = _upload_to_cloudinary(file, file_type, category_name)
        except Exception as exc:
            logger.error('Cloudinary upload failed: %s', exc)
            return Response({'error': f'File upload failed: {exc}'}, status=500)

        # Determine revision label
        rev_num = original.revision_number + 1
        rev_labels = ['A','B','C','D','E','F','G','H','I','J','K','L','M',
                      'N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
        rev_label = f'Rev {rev_labels[rev_num - 1]}' if rev_num <= 26 else f'Rev {rev_num}'

        with transaction.atomic():
            # Mark old revision as not latest
            original.is_latest_revision = False
            original.save(update_fields=['is_latest_revision'])

            root = original.parent_document if original.parent_document else original

            new_doc = Document.objects.create(
                document_number=_generate_document_number(),
                title=original.title,
                description=request.data.get('description', original.description),
                category=original.category,
                status=Document.Status.DRAFT,
                revision=rev_label,
                revision_number=rev_num,
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
                effective_date=original.effective_date,
            )
            DocumentActivity.objects.create(
                document=new_doc, action='revised', performed_by=request.user,
                comment=f'New revision {rev_label} uploaded. Previous: {original.revision}',
            )

        return Response(DocumentListSerializer(new_doc).data, status=201)

    # ── DOWNLOAD ───────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        doc = self.get_object()
        if not doc.cloudinary_url:
            return Response({'error': 'No file attached to this document.'}, status=404)

        # Log download activity
        DocumentActivity.objects.create(
            document=doc, action='downloaded', performed_by=request.user
        )
        return redirect(doc.cloudinary_url)

    # ── HISTORY ────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        doc = self.get_object()
        activities = doc.activities.select_related('performed_by').order_by('-timestamp')
        return Response(DocumentActivitySerializer(activities, many=True).data)

    # ── MARK OBSOLETE ──────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def obsolete(self, request, pk=None):
        doc = self.get_object()
        if request.user.role not in ('admin',):
            return Response({'error': 'Only admins can mark documents as obsolete.'}, status=403)
        doc.status = Document.Status.OBSOLETE
        doc.save(update_fields=['status', 'updated_at'])
        DocumentActivity.objects.create(
            document=doc, action='obsoleted', performed_by=request.user,
            comment=request.data.get('comment', '')
        )
        return Response({'status': doc.status, 'detail': 'Document marked as obsolete.'})
