from django.utils import timezone
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from .models import Part, InspectionTemplate, InspectionParameter, ProcessParameter
from .serializers import (
    PartSerializer, PartListSerializer,
    InspectionTemplateSerializer, InspectionTemplateListSerializer,
    InspectionParameterSerializer, ProcessParameterSerializer,
)
from apps.users.permissions import IsAdminUser, IsQualityEngineer, IsSupervisorOrAbove


# ─── Parts ────────────────────────────────────────────────────────────────
class PartListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/parts/              → list all active parts
    GET  /api/parts/?machine=1    → filter by machine
    POST /api/parts/              → create part (QE / Admin)
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return PartListSerializer
        return PartSerializer

    def get_queryset(self):
        qs = Part.objects.select_related('machine').filter(is_active=True)
        machine_id = self.request.query_params.get('machine')
        if machine_id:
            qs = qs.filter(machine_id=machine_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


class PartDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/parts/<part_number>/"""
    serializer_class   = PartSerializer
    permission_classes = [IsAuthenticated]
    queryset           = Part.objects.select_related('machine').all()
    lookup_field       = 'part_number'

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response({'message': f'Part {instance.part_number} deactivated successfully.'}, status=status.HTTP_204_NO_CONTENT)


# ─── Inspection Templates ──────────────────────────────────────────────────
class TemplateListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/parts/<part_number>/templates/                     → all templates for part
    GET  /api/parts/<part_number>/templates/?type=first_piece    → filter by type
    POST /api/parts/<part_number>/templates/                     → create template (Supervisor/QE/Admin)
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return InspectionTemplateListSerializer
        return InspectionTemplateSerializer

    def get_queryset(self):
        from urllib.parse import unquote
        part_number = unquote(self.kwargs['part_number'])
        qs = InspectionTemplate.objects.filter(
            part__part_number=part_number,
            is_active=True,
        )
        inspection_type = self.request.query_params.get('type')
        if inspection_type:
            qs = qs.filter(inspection_type=inspection_type)
        return qs

    def perform_create(self, serializer):
        from urllib.parse import unquote
        part_number = unquote(self.kwargs['part_number'])
        part = Part.objects.get(part_number=part_number)
        # Auto-increment version
        last_version = InspectionTemplate.objects.filter(
            part=part,
            inspection_type=serializer.validated_data['inspection_type']
        ).count()
        serializer.save(part=part, created_by=self.request.user, version=last_version + 1)

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


class TemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/parts/templates/<id>/"""
    serializer_class   = InspectionTemplateSerializer
    queryset           = InspectionTemplate.objects.all()

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response({'message': 'Operation template deactivated successfully.'}, status=status.HTTP_204_NO_CONTENT)


class TemplatePublishView(APIView):
    """
    POST /api/parts/templates/<id>/publish/
    Publishes and broadcasts the configured template to shop floor operators and quality inspectors.
    """
    permission_classes = [IsAuthenticated, IsSupervisorOrAbove]

    def post(self, request, pk):
        try:
            template = InspectionTemplate.objects.prefetch_related('parameters', 'part__machine').get(pk=pk)
            template.is_active = True
            template.is_published = True
            template.published_at = timezone.now()
            template.save()

            serializer = InspectionTemplateSerializer(template, context={'request': request})
            return Response({
                'success': True,
                'message': f"Operation '{template.name or template.get_inspection_type_display()}' published and dispatched to mobile successfully!",
                'template': serializer.data,
                'published_at': template.published_at,
                'parameters_count': template.parameters.count(),
            }, status=status.HTTP_200_OK)
        except InspectionTemplate.DoesNotExist:
            return Response(
                {'error': f'Inspection template with ID {pk} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )


class ActiveTemplateView(APIView):
    """
    GET /api/parts/<part_number>/template/<inspection_type>/
    Returns the active template for a part + inspection type.
    This is the primary endpoint called by Flutter before starting inspection.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, part_number, inspection_type):
        from urllib.parse import unquote
        part_number = unquote(part_number)
        try:
            template = InspectionTemplate.objects.prefetch_related('parameters').get(
                part__part_number=part_number,
                inspection_type=inspection_type,
                is_active=True,
            )
            serializer = InspectionTemplateSerializer(template, context={'request': request})
            return Response(serializer.data)
        except InspectionTemplate.DoesNotExist:
            return Response(
                {'error': f'No active {inspection_type} template for part {part_number}'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except InspectionTemplate.MultipleObjectsReturned:
            # Return the latest version
            template = InspectionTemplate.objects.prefetch_related('parameters').filter(
                part__part_number=part_number,
                inspection_type=inspection_type,
                is_active=True,
            ).order_by('-version').first()
            serializer = InspectionTemplateSerializer(template, context={'request': request})
            return Response(serializer.data)


# ─── Parameters ───────────────────────────────────────────────────────────
class ParameterListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/parts/templates/<template_id>/parameters/
    POST /api/parts/templates/<template_id>/parameters/  → add parameter (Supervisor/QE/Admin)
    """
    serializer_class   = InspectionParameterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return InspectionParameter.objects.filter(
            template_id=self.kwargs['template_id']
        ).order_by('sequence_order')

    def perform_create(self, serializer):
        template = InspectionTemplate.objects.get(pk=self.kwargs['template_id'])
        serializer.save(template=template)

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


class ParameterDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/parts/parameters/<id>/"""
    serializer_class   = InspectionParameterSerializer
    queryset           = InspectionParameter.objects.all()

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


# ─── Process Parameters ───────────────────────────────────────────────────
class ProcessParameterListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/parts/templates/<template_id>/process-parameters/
    POST /api/parts/templates/<template_id>/process-parameters/  → add process parameter (Supervisor/Admin)
    """
    serializer_class   = ProcessParameterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        template_id = self.kwargs['template_id']
        return ProcessParameter.objects.filter(template_id=template_id).order_by('sequence_order')

    def perform_create(self, serializer):
        template = InspectionTemplate.objects.get(pk=self.kwargs['template_id'])
        serializer.save(template=template)

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


class ProcessParameterDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/parts/process-parameters/<id>/"""
    serializer_class   = ProcessParameterSerializer
    queryset           = ProcessParameter.objects.all()

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


class AllParameterListView(generics.ListAPIView):
    """GET /api/parts/parameters/all/"""
    from .serializers import GlobalInspectionParameterSerializer
    serializer_class = GlobalInspectionParameterSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None
    queryset = InspectionParameter.objects.select_related('template__part__machine', 'template__created_by').all().order_by('-id')


class AllProcessParameterListView(generics.ListAPIView):
    """GET /api/parts/process-parameters/all/"""
    from .serializers import GlobalProcessParameterSerializer
    serializer_class = GlobalProcessParameterSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None
    queryset = ProcessParameter.objects.select_related('template__part__machine', 'template__created_by').all().order_by('-id')


# ─────────────────────────────────────────────────────────────
# Drawings & Control Plans Management (Admin Only)
# ─────────────────────────────────────────────────────────────
from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import DrawingDocument, DrawingVersion, ControlPlanDocument, ControlPlanVersion
from .serializers import (
    DrawingDocumentSerializer, DrawingVersionSerializer,
    ControlPlanDocumentSerializer, ControlPlanVersionSerializer
)

class DrawingViewSet(viewsets.ModelViewSet):
    """
    API for managing Engineering Drawings and their Revision Histories.
    Strictly restricted to Admin users.
    """
    queryset = DrawingDocument.objects.select_related('part', 'created_by').prefetch_related('versions__uploaded_by').all()
    serializer_class = DrawingDocumentSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def perform_create(self, serializer):
        drawing = serializer.save(created_by=self.request.user)
        file_obj = self.request.FILES.get('file')
        revision_code = self.request.data.get('revision_code', drawing.current_revision or 'Rev A')
        change_notes = self.request.data.get('change_notes', 'Initial drawing upload')
        if file_obj:
            DrawingVersion.objects.create(
                drawing=drawing,
                revision_code=revision_code,
                file=file_obj,
                file_name=file_obj.name,
                file_size=file_obj.size,
                change_notes=change_notes,
                uploaded_by=self.request.user,
            )
            if drawing.current_revision != revision_code:
                drawing.current_revision = revision_code
                drawing.save(update_fields=['current_revision'])

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_version(self, request, pk=None):
        """POST /api/parts/drawings/{id}/upload_version/"""
        drawing = self.get_object()
        file_obj = request.FILES.get('file')
        revision_code = request.data.get('revision_code')
        change_notes = request.data.get('change_notes', '')

        if not file_obj:
            return Response({'error': 'A drawing file is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not revision_code:
            return Response({'error': 'A revision code is required (e.g. Rev B).'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            version = DrawingVersion.objects.create(
                drawing=drawing,
                revision_code=revision_code,
                file=file_obj,
                file_name=file_obj.name,
                file_size=file_obj.size,
                change_notes=change_notes,
                uploaded_by=request.user,
            )
            drawing.current_revision = revision_code
            drawing.save(update_fields=['current_revision'])

        return Response(DrawingDocumentSerializer(drawing, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """GET /api/parts/drawings/{id}/history/"""
        drawing = self.get_object()
        versions = drawing.versions.select_related('uploaded_by').all()
        serializer = DrawingVersionSerializer(versions, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path=r'versions/(?P<version_id>\d+)/download')
    def download_file(self, request, pk=None, version_id=None):
        """GET /api/parts/drawings/{id}/versions/{version_id}/download/"""
        drawing = self.get_object()
        version = get_object_or_404(DrawingVersion, pk=version_id, drawing=drawing)
        if not version.file:
            return Response({'error': 'Drawing file not found.'}, status=status.HTTP_404_NOT_FOUND)
        response = FileResponse(version.file.open('rb'), content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{version.file_name or "drawing.pdf"}"'
        return response


class ControlPlanViewSet(viewsets.ModelViewSet):
    """
    API for managing Process Control Plans and their Version Histories.
    Strictly restricted to Admin users.
    """
    queryset = ControlPlanDocument.objects.select_related('part', 'created_by').prefetch_related('versions__uploaded_by').all()
    serializer_class = ControlPlanDocumentSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def perform_create(self, serializer):
        control_plan = serializer.save(created_by=self.request.user)
        file_obj = self.request.FILES.get('file')
        revision_code = self.request.data.get('revision_code', control_plan.current_revision or 'v1.0')
        change_notes = self.request.data.get('change_notes', 'Initial control plan upload')
        if file_obj:
            ControlPlanVersion.objects.create(
                control_plan=control_plan,
                revision_code=revision_code,
                file=file_obj,
                file_name=file_obj.name,
                file_size=file_obj.size,
                change_notes=change_notes,
                uploaded_by=self.request.user,
            )
            if control_plan.current_revision != revision_code:
                control_plan.current_revision = revision_code
                control_plan.save(update_fields=['current_revision'])

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_version(self, request, pk=None):
        """POST /api/parts/control-plans/{id}/upload_version/"""
        control_plan = self.get_object()
        file_obj = request.FILES.get('file')
        revision_code = request.data.get('revision_code')
        change_notes = request.data.get('change_notes', '')

        if not file_obj:
            return Response({'error': 'A control plan file is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not revision_code:
            return Response({'error': 'A version/revision code is required (e.g. v1.1).'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            version = ControlPlanVersion.objects.create(
                control_plan=control_plan,
                revision_code=revision_code,
                file=file_obj,
                file_name=file_obj.name,
                file_size=file_obj.size,
                change_notes=change_notes,
                uploaded_by=request.user,
            )
            control_plan.current_revision = revision_code
            control_plan.save(update_fields=['current_revision'])

        return Response(ControlPlanDocumentSerializer(control_plan, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """GET /api/parts/control-plans/{id}/history/"""
        control_plan = self.get_object()
        versions = control_plan.versions.select_related('uploaded_by').all()
        serializer = ControlPlanVersionSerializer(versions, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path=r'versions/(?P<version_id>\d+)/download')
    def download_file(self, request, pk=None, version_id=None):
        """GET /api/parts/control-plans/{id}/versions/{version_id}/download/"""
        control_plan = self.get_object()
        version = get_object_or_404(ControlPlanVersion, pk=version_id, control_plan=control_plan)
        if not version.file:
            return Response({'error': 'Control plan file not found.'}, status=status.HTTP_404_NOT_FOUND)
        response = FileResponse(version.file.open('rb'), content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{version.file_name or "control_plan.pdf"}"'
        return response

