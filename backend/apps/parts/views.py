from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

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
