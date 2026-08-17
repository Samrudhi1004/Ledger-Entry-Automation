from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import Factory, Plant, Machine
from .serializers import FactorySerializer, PlantSerializer, MachineSerializer, MachineListSerializer
from apps.users.permissions import IsAdminUser, IsSupervisorOrAbove


# ─── Factory ──────────────────────────────────────────────────────────────
class FactoryListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/machines/factories/   → list factories
    POST /api/machines/factories/   → create (Admin only)
    """
    queryset           = Factory.objects.filter(is_active=True)
    serializer_class   = FactorySerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


class FactoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/machines/factories/<id>/"""
    queryset           = Factory.objects.all()
    serializer_class   = FactorySerializer
    permission_classes = [IsSupervisorOrAbove]


# ─── Plant ────────────────────────────────────────────────────────────────
class PlantListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/machines/plants/              → all plants
    GET  /api/machines/plants/?factory=1    → filter by factory
    POST /api/machines/plants/              → create (Admin only)
    """
    serializer_class   = PlantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Plant.objects.select_related('factory').filter(is_active=True)
        factory_id = self.request.query_params.get('factory')
        if factory_id:
            qs = qs.filter(factory_id=factory_id)
        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


class PlantDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/machines/plants/<id>/"""
    queryset           = Plant.objects.all()
    serializer_class   = PlantSerializer
    permission_classes = [IsSupervisorOrAbove]


# ─── Machine ──────────────────────────────────────────────────────────────
class MachineListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/machines/                 → all machines
    GET  /api/machines/?plant=1         → filter by plant
    GET  /api/machines/?status=active   → filter by status
    POST /api/machines/                 → create (Admin only)
    """
    permission_classes = [IsAuthenticated]

    serializer_class = MachineSerializer

    def get_queryset(self):
        qs = Machine.objects.select_related('plant__factory').filter(is_active=True)
        plant_id = self.request.query_params.get('plant')
        status   = self.request.query_params.get('status')
        if plant_id:
            qs = qs.filter(plant_id=plant_id)
        if status:
            qs = qs.filter(status=status)
        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisorOrAbove()]
        return [IsAuthenticated()]


class MachineDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/machines/<id>/"""
    queryset           = Machine.objects.select_related('plant__factory').all()
    serializer_class   = MachineSerializer
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response({'message': f'Machine {instance.machine_code} deactivated successfully.'}, status=status.HTTP_204_NO_CONTENT)


class MachineByQRView(APIView):
    """
    GET /api/machines/scan/<qr_code>/
    Flutter app scans QR → fetches machine details instantly.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, qr_code):
        try:
            machine = Machine.objects.select_related('plant__factory').get(
                qr_code=qr_code, is_active=True
            )
            serializer = MachineSerializer(machine, context={'request': request})
            return Response(serializer.data)
        except Machine.DoesNotExist:
            return Response(
                {'error': f'No active machine found for QR code: {qr_code}'},
                status=status.HTTP_404_NOT_FOUND,
            )
