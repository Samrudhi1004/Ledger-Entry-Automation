from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Count, Q
from datetime import datetime, timedelta

from apps.inspections.models import InspectionSession
from apps.users.permissions import IsSupervisorOrAbove
from config.db import get_collection, Collections


class InspectionReportView(APIView):
    """
    GET /api/analytics/report/?from=2025-01-01&to=2025-01-31&machine=MCH-001
    Returns inspection statistics for a date range.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        from_date = request.query_params.get('from')
        to_date   = request.query_params.get('to')
        machine_code = request.query_params.get('machine')

        qs = InspectionSession.objects.all()
        if from_date:
            qs = qs.filter(started_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(started_at__date__lte=to_date)
        if machine_code:
            qs = qs.filter(machine__machine_code=machine_code)

        stats = qs.aggregate(
            total=Count('id'),
            approved=Count('id', filter=Q(status='approved')),
            rejected=Count('id', filter=Q(status='rejected')),
            pending=Count('id', filter=Q(status='pending_review')),
            ooc_count=Count('id', filter=Q(has_ooc=True)),
            critical_fails=Count('id', filter=Q(has_critical_fail=True)),
        )

        total = stats['total'] or 1
        stats['pass_rate']   = round((stats['approved'] / total) * 100, 2)
        stats['reject_rate'] = round((stats['rejected'] / total) * 100, 2)

        return Response({
            'filters': {
                'from_date':    from_date,
                'to_date':      to_date,
                'machine_code': machine_code,
            },
            'statistics': stats,
        })


class OOCTrendView(APIView):
    """
    GET /api/analytics/ooc-trend/?days=7&plant=1
    Returns daily out-of-spec count for trend chart on dashboard.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        days     = int(request.query_params.get('days', 7))
        plant_id = request.query_params.get('plant')
        today    = timezone.now().date()

        trend = []
        for i in range(days - 1, -1, -1):
            day = today - timedelta(days=i)
            qs  = InspectionSession.objects.filter(started_at__date=day)
            if plant_id:
                qs = qs.filter(machine__plant_id=plant_id)
            trend.append({
                'date':      day.isoformat(),
                'total':     qs.count(),
                'ooc_count': qs.filter(has_ooc=True).count(),
                'approved':  qs.filter(status='approved').count(),
            })

        return Response({'trend': trend, 'days': days})


class MachinePerformanceView(APIView):
    """
    GET /api/analytics/machine/<machine_id>/performance/?days=30
    OOC rate, inspection count, and pass rate for a specific machine.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, machine_id):
        days  = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)

        qs = InspectionSession.objects.filter(
            machine_id=machine_id,
            started_at__gte=since,
        )
        total    = qs.count()
        approved = qs.filter(status='approved').count()
        ooc      = qs.filter(has_ooc=True).count()

        return Response({
            'machine_id':  machine_id,
            'days':        days,
            'total':       total,
            'approved':    approved,
            'ooc_count':   ooc,
            'pass_rate':   round((approved / total) * 100, 2) if total else 0,
            'ooc_rate':    round((ooc / total) * 100, 2) if total else 0,
        })


class OperatorStatsView(APIView):
    """
    GET /api/analytics/operator/<operator_id>/stats/?days=30
    Inspection count and OOC rate per operator.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request, operator_id):
        days  = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)

        qs    = InspectionSession.objects.filter(
            operator_id=operator_id,
            started_at__gte=since,
        )
        total    = qs.count()
        approved = qs.filter(status='approved').count()
        ooc      = qs.filter(has_ooc=True).count()

        return Response({
            'operator_id': operator_id,
            'days':        days,
            'total':       total,
            'approved':    approved,
            'ooc_count':   ooc,
            'pass_rate':   round((approved / total) * 100, 2) if total else 0,
        })


class ParameterOOCRateView(APIView):
    """
    GET /api/analytics/parameters/ooc-rate/?part=PN-001
    Which parameters fail most often? Fetched from MongoDB.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        part_number = request.query_params.get('part', '')
        collection  = get_collection(Collections.INSPECTION_RECORDS)

        pipeline = [
            {'$match': {'part_number': part_number} if part_number else {}},
            {'$unwind': '$measurements'},
            {'$group': {
                '_id':       '$measurements.parameter_code',
                'name':      {'$first': '$measurements.parameter_name'},
                'total':     {'$sum': 1},
                'ooc_count': {'$sum': {'$cond': [{'$eq': ['$measurements.status', 'out_of_spec']}, 1, 0]}},
            }},
            {'$addFields': {'ooc_rate': {'$multiply': [{'$divide': ['$ooc_count', '$total']}, 100]}}},
            {'$sort': {'ooc_rate': -1}},
            {'$limit': 20},
        ]

        results = list(collection.aggregate(pipeline))
        for r in results:
            r['_id'] = str(r['_id'])
            r['ooc_rate'] = round(r.get('ooc_rate', 0), 2)

        return Response({'parameters': results})
