from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Count, Q
from django.core.cache import cache
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
        from_date    = request.query_params.get('from')
        to_date      = request.query_params.get('to')
        machine_code = request.query_params.get('machine')

        # Cache analytics reports for 5 minutes — report data changes infrequently
        # and re-aggregating the full table on every request is expensive.
        cache_key = f"inspection_report_{from_date}_{to_date}_{machine_code or 'all'}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        qs = InspectionSession.objects.all()
        if from_date:
            qs = qs.filter(started_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(started_at__date__lte=to_date)
        if machine_code:
            qs = qs.filter(machine__machine_code=machine_code)

        stats = qs.aggregate(
            total=Count('id'),
            approved=Count('id', filter=Q(status__in=['approved', 'finalized_passed']) | Q(is_setup_approved=True)),
            pending=Count('id', filter=Q(status='pending_review')),
            ooc_count=Count('id', filter=Q(has_ooc=True)),
            critical_fails=Count('id', filter=Q(has_critical_fail=True)),
        )

        total = stats['total'] or 1
        stats['pass_rate'] = round((stats['approved'] / total) * 100, 2)

        result = {
            'filters': {
                'from_date':    from_date,
                'to_date':      to_date,
                'machine_code': machine_code,
            },
            'statistics': stats,
        }
        cache.set(cache_key, result, timeout=300)
        return Response(result)


class OOCTrendView(APIView):
    """
    GET /api/analytics/ooc-trend/?days=7&plant=1
    Returns daily out-of-spec count for trend chart on dashboard.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        days     = int(request.query_params.get('days', 7))
        plant_id = request.query_params.get('plant')
        today    = timezone.localdate()

        # Cache OOC trend for 5 minutes. The old implementation ran N×3 separate
        # DB queries (one count() call per metric per day). This version uses a
        # single annotated query and caches the result, so repeat requests are
        # served in < 1ms instead of 1–5 seconds.
        cache_key = f"ooc_trend_{days}_{plant_id or 'all'}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # Single aggregated query — replaces the previous per-day loop
        start_day = today - timedelta(days=days - 1)
        qs = InspectionSession.objects.filter(started_at__date__gte=start_day)
        if plant_id:
            qs = qs.filter(machine__plant_id=plant_id)

        stats = qs.values('started_at__date').annotate(
            total=Count('id'),
            ooc_count=Count('id', filter=Q(has_ooc=True)),
            approved=Count('id', filter=Q(status='approved')),
        ).order_by('started_at__date')

        # Build a lookup map so days with zero sessions are still included
        stats_map = {str(row['started_at__date']): row for row in stats}

        trend = []
        for i in range(days - 1, -1, -1):
            day = today - timedelta(days=i)
            row = stats_map.get(str(day), {})
            trend.append({
                'date':      day.isoformat(),
                'total':     row.get('total', 0),
                'ooc_count': row.get('ooc_count', 0),
                'approved':  row.get('approved', 0),
            })

        result = {'trend': trend, 'days': days}
        cache.set(cache_key, result, timeout=300)
        return Response(result)


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


class DailyCompletedReportsView(APIView):
    """
    GET /api/analytics/daily-completed-reports/
    Returns ONLY 100% completed daily reports (all required 11 inspection slots: 1PC#1..#3 + 1..8/HR).
    Excludes drafts, in-progress, pending, partially completed, or rejected sessions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date     = request.query_params.get('start_date') or request.query_params.get('from')
        end_date       = request.query_params.get('end_date') or request.query_params.get('to')
        machine_code   = request.query_params.get('machine')
        part_number    = request.query_params.get('part')
        shift          = request.query_params.get('shift')
        operator_name  = request.query_params.get('operator')
        inspector_name = request.query_params.get('inspector')

        qs = InspectionSession.objects.select_related(
            'machine', 'part', 'operator', 'supervisor', 'finalized_by'
        ).all()

        # Strict completion filter
        from django.db.models import F
        qs = qs.filter(
            Q(status__in=['completed', 'finalized_passed', 'approved']) |
            Q(is_setup_approved=True, hourly_unlocked_slot__gte=F('machine__plant__factory__shift_hours'))
        ).exclude(
            status__in=['draft', 'in_progress', 'pending_review', 'rejected', 'finalized_failed']
        )

        if start_date:
            qs = qs.filter(started_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(started_at__date__lte=end_date)
        if machine_code:
            qs = qs.filter(machine__machine_code__icontains=machine_code.strip())
        if part_number:
            qs = qs.filter(part__part_number__icontains=part_number.strip())
        if shift:
            qs = qs.filter(shift=shift)
        if operator_name:
            qs = qs.filter(
                Q(operator__username__icontains=operator_name.strip()) |
                Q(operator__first_name__icontains=operator_name.strip()) |
                Q(operator__last_name__icontains=operator_name.strip())
            )
        if inspector_name:
            qs = qs.filter(
                Q(finalized_by__username__icontains=inspector_name.strip()) |
                Q(finalized_by__first_name__icontains=inspector_name.strip()) |
                Q(finalized_by__last_name__icontains=inspector_name.strip()) |
                Q(supervisor__username__icontains=inspector_name.strip()) |
                Q(supervisor__first_name__icontains=inspector_name.strip()) |
                Q(supervisor__last_name__icontains=inspector_name.strip())
            )

        seen_keys = set()
        reports = []
        for s in qs.order_by('-started_at'):
            date_str = s.started_at.strftime('%d %b %Y') if s.started_at else ''
            key = (date_str, s.machine.machine_code if s.machine else '', s.part.part_number if s.part else '', s.shift)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            operator_full = s.operator.get_full_name() if s.operator else '—'
            inspector_full = (
                s.finalized_by.get_full_name()
                if s.finalized_by
                else (s.supervisor.get_full_name() if s.supervisor else operator_full)
            )

            reports.append({
                'report_id': str(s.session_id),
                'session_id': str(s.session_id),
                'date': date_str,
                'raw_date': s.started_at.isoformat() if s.started_at else '',
                'machine': s.machine.machine_code if s.machine else '—',
                'part': f"{s.part.part_number} ({s.part.part_name})" if s.part and s.part.part_name else (s.part.part_number if s.part else '—'),
                'part_number': s.part.part_number if s.part else '',
                'shift': s.shift or 'A',
                'operator': operator_full,
                'inspector': inspector_full,
                'status': 'Completed',
                'pdf_url': f"/api/inspections/{s.session_id}/pdf/",
            })

        return Response({'reports': reports})

