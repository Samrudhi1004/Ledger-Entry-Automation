from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.parts.models import Part
from apps.machines.models import Machine
from apps.users.permissions import IsSupervisorOrAbove, IsOperatorOrSupervisor
from .models import InspectionSession
from .serializers import (
    StartInspectionSerializer,
    RecordMeasurementSerializer,
    ReviewSerializer,
    InspectionSessionSerializer,
)
from .services import InspectionService

_service = InspectionService()


# ─── Start Inspection ─────────────────────────────────────────────────────
class StartInspectionView(APIView):
    """
    POST /api/inspections/start/
    Operator starts a new inspection session.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = StartInspectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        d = serializer.validated_data
        try:
            part    = Part.objects.get(part_number=d['part_number'], is_active=True)
            machine = Machine.objects.get(pk=d['machine_id'], is_active=True)
        except Part.DoesNotExist:
            return Response({'error': 'Part not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Machine.DoesNotExist:
            return Response({'error': 'Machine not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            session = _service.create_session(
                part              = part,
                machine           = machine,
                operator          = request.user,
                inspection_type   = d.get('inspection_type', 'first_piece'),
                shift             = d.get('shift', 'A'),
                template_id       = d.get('template_id'),
                trial_number      = d.get('trial_number', 1),
                parent_session_id = d.get('parent_session_id'),
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            InspectionSessionSerializer(session).data,
            status=status.HTTP_201_CREATED,
        )


# ─── Record Measurement ───────────────────────────────────────────────────
class RecordMeasurementView(APIView):
    """
    POST /api/inspections/<session_id>/measure/
    Records a single voice/manual measurement for a parameter.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        serializer = RecordMeasurementSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = _service.record_measurement(
                session_id     = session_id,
                parameter_code = serializer.validated_data['parameter_code'],
                measured_value = serializer.validated_data['measured_value'],
                voice_raw_text = serializer.validated_data.get('voice_raw_text', ''),
                method         = serializer.validated_data['method'],
            )
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── Complete Session ─────────────────────────────────────────────────────
class CompleteInspectionView(APIView):
    """POST /api/inspections/<session_id>/complete/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = _service.complete_session(session_id)
            return Response(InspectionSessionSerializer(session).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── Session Detail ───────────────────────────────────────────────────────
class SessionDetailView(APIView):
    """
    GET /api/inspections/<session_id>/
    Returns full inspection document from MongoDB.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        doc = _service.get_session_document(session_id)
        if not doc:
            return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(doc)


# ─── Pending Review (Supervisor) ──────────────────────────────────────────
class PendingReviewView(generics.ListAPIView):
    """
    GET /api/inspections/pending/
    Supervisor sees all sessions awaiting review.
    """
    serializer_class   = InspectionSessionSerializer
    permission_classes = [IsSupervisorOrAbove]

    def get_queryset(self):
        qs = InspectionSession.objects.select_related(
            'part', 'machine', 'operator', 'supervisor'
        ).filter(status=InspectionSession.Status.PENDING_REVIEW)

        plant_id = self.request.query_params.get('plant')
        if plant_id:
            qs = qs.filter(machine__plant_id=plant_id)
        return qs


# ─── Approve / Reject ─────────────────────────────────────────────────────
class ApproveRejectView(APIView):
    """
    POST /api/inspections/<session_id>/review/
    Supervisor approves or rejects a completed inspection.
    """
    permission_classes = [IsSupervisorOrAbove]

    def post(self, request, session_id):
        serializer = ReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = _service.review_session(
                session_id          = session_id,
                action              = serializer.validated_data['action'],
                supervisor          = request.user,
                remark              = serializer.validated_data.get('remark', ''),
                rejected_parameters = serializer.validated_data.get('rejected_parameters', []),
            )
            return Response(InspectionSessionSerializer(session).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── Session List ─────────────────────────────────────────────────────────
class SessionListView(generics.ListAPIView):
    """
    GET /api/inspections/                        → all sessions
    GET /api/inspections/?status=approved        → filter by status
    GET /api/inspections/?machine=MCH-001        → filter by machine code
    """
    serializer_class   = InspectionSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = InspectionSession.objects.select_related(
            'part', 'machine', 'operator', 'supervisor'
        ).all()

        status_filter   = self.request.query_params.get('status')
        machine_code    = self.request.query_params.get('machine')
        operator_id     = self.request.query_params.get('operator')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if machine_code:
            qs = qs.filter(machine__machine_code=machine_code)
        if operator_id:
            qs = qs.filter(operator_id=operator_id)

        # Operators only see their own sessions
        if request := self.request:
            if request.user.is_operator:
                qs = qs.filter(operator=request.user)

        return qs


# ─── Operator Rejections List ─────────────────────────────────────────────
class RejectionsListView(generics.ListAPIView):
    """
    GET /api/inspections/rejections/
    Returns active rejected sessions for the operator that require corrective trial #2 or #3.
    """
    serializer_class   = InspectionSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return InspectionSession.objects.select_related(
            'part', 'machine', 'operator', 'supervisor'
        ).filter(
            operator=self.request.user,
            status=InspectionSession.Status.REJECTED,
            trial_number__lt=3,
        ).order_by('-reviewed_at')


# ─── Supervisor 3rd Trial Direct Override ─────────────────────────────────
class SupervisorOverrideView(APIView):
    """
    POST /api/inspections/<session_id>/supervisor-override/
    Allows Supervisor to directly enter/correct a parameter reading on 1ST PC #3.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        if not (request.user.is_supervisor or request.user.is_staff):
            return Response({'error': 'Only supervisors can perform direct overrides.'}, status=status.HTTP_403_FORBIDDEN)

        parameter_code = request.data.get('parameter_code')
        override_value = request.data.get('measured_value')
        remark         = request.data.get('remark', '')

        if not parameter_code or override_value is None:
            return Response({'error': 'parameter_code and measured_value are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            val = float(override_value)
            res = _service.supervisor_override_measurement(
                session_id=session_id,
                parameter_code=parameter_code,
                override_value=val,
                supervisor=request.user,
                remark=remark,
            )
            return Response(res, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── Hourly Time-Lock Status ──────────────────────────────────────────────
class HourlyStatusView(APIView):
    """
    GET /api/inspections/<session_id>/hourly-status/
    Returns open/locked/overdue status for hourly slots 1/HR through 8/HR.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            res = _service.get_hourly_status(session_id)
            return Response(res, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


