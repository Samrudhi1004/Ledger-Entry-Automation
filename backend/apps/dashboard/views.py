from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta

from apps.inspections.models import InspectionSession
from apps.machines.models import Machine, Plant
from apps.users.permissions import IsSupervisorOrAbove


class LiveStatusView(APIView):
    """
    GET /api/dashboard/live/?plant=1
    Returns current active sessions and their progress for a plant.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        plant_id = request.query_params.get('plant')
        today    = timezone.now().date()
        qs = InspectionSession.objects.select_related(
            'part', 'machine', 'operator'
        ).filter(
            started_at__date=today,
            status=InspectionSession.Status.IN_PROGRESS
        )

        if plant_id:
            qs = qs.filter(machine__plant_id=plant_id)

        data = []
        for session in qs:
            data.append({
                'session_id':     str(session.session_id),
                'machine_code':   session.machine.machine_code,
                'part_number':    session.part.part_number,
                'operator_name':  session.operator.get_full_name(),
                'inspection_type': session.inspection_type,
                'shift':          session.shift,
                'progress':       session.progress_percent,
                'has_ooc':        session.has_ooc,
                'has_critical_fail': session.has_critical_fail,
                'started_at':     session.started_at.isoformat(),
            })

        return Response({'active_sessions': data, 'count': len(data)})


class ShiftSummaryView(APIView):
    """
    GET /api/dashboard/shift-summary/?plant=1&shift=A
    Returns today's inspection summary for a shift.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        plant_id = request.query_params.get('plant')
        shift    = request.query_params.get('shift', 'A')
        today    = timezone.now().date()

        qs = InspectionSession.objects.filter(
            started_at__date=today,
            shift=shift,
        )
        if plant_id:
            qs = qs.filter(machine__plant_id=plant_id)

        total    = qs.count()
        approved = qs.filter(status='approved').count()
        rejected = qs.filter(status='rejected').count()
        pending  = qs.filter(status='pending_review').count()
        ooc      = qs.filter(has_ooc=True).count()

        return Response({
            'date':     today.isoformat(),
            'shift':    shift,
            'summary': {
                'total':    total,
                'approved': approved,
                'rejected': rejected,
                'pending':  pending,
                'ooc_count': ooc,
                'pass_rate': round((approved / total) * 100, 1) if total else 0,
            }
        })
