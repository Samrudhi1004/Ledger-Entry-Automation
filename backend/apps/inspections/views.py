import time
import logging
from django.core.cache import cache
from django.db import transaction
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

logger = logging.getLogger(__name__)

from apps.parts.models import Part
from apps.machines.models import Machine
from rest_framework import viewsets
from rest_framework.decorators import action
from django.conf import settings
from django.http import HttpResponse, FileResponse
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import csv
import os
from concurrent.futures import ThreadPoolExecutor

# L1 FIX: Removed duplicate imports — Part and Machine already imported on lines 11-12.
from apps.users.permissions import IsSupervisorOrAbove, IsOperatorOrSupervisor
from .models import (
    InspectionSession,
    DailyProductionReport,
    DowntimeReport,
    JHChecklistItem,
    JHInspectionRecord,
    JHInspectionItemResult,
)
from .serializers import (
    StartInspectionSerializer,
    RecordMeasurementSerializer,
    BatchMeasureSerializer,
    ReviewSerializer,
    InspectionSessionSerializer,
    DailyProductionReportSerializer,
    DowntimeReportSerializer,
    JHChecklistItemSerializer,
    JHInspectionItemResultSerializer,
    JHInspectionRecordSerializer,
    JHInspectionSubmitSerializer,
)
from .pdf_generator import generate_daily_production_pdf, generate_downtime_pdf
# M4 FIX: Import shared singleton — do NOT instantiate InspectionService() here.
# One instance is shared across views.py, tasks.py, and any future modules.
from .services import inspection_service as _service


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
            # Part and Machine are independent lookups — neither depends on the
            # other's result, so they can safely run in parallel. ThreadPoolExecutor
            # releases the GIL during DB I/O, allowing both queries to be in-flight
            # at the same time. Total wait ≈ max(t_part, t_machine) instead of
            # t_part + t_machine, cutting this block's latency roughly in half.
            with ThreadPoolExecutor(max_workers=2) as executor:
                part_future    = executor.submit(
                    Part.objects.get, part_number=d['part_number'], is_active=True
                )
                machine_future = executor.submit(
                    Machine.objects.get, pk=d['machine_id'], is_active=True
                )
                part    = part_future.result()    # re-raises Part.DoesNotExist if not found
                machine = machine_future.result()  # re-raises Machine.DoesNotExist if not found
        except Part.DoesNotExist:
            # H3 FIX: Never substitute a random part — return 404 immediately.
            # Old code silently picked any available part, causing measurements
            # to be validated against completely wrong tolerances.
            return Response(
                {'error': f"Part '{d['part_number']}' not found or is inactive. Please check the part number."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Machine.DoesNotExist:
            # H3 FIX: Same — never substitute a random machine.
            return Response(
                {'error': f"Machine ID {d['machine_id']} not found or is inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            # Determine effective shift based on user's assigned_shift
            requested_shift = d.get('shift') or 'I'
            if requested_shift in ('A', 'B', 'C'):
                shift_alias_map = {'A': 'I', 'B': 'II', 'C': 'III'}
                requested_shift = shift_alias_map.get(requested_shift, 'I')

            # If user has an assigned shift other than ALL, enforce it
            user_shift = getattr(request.user, 'assigned_shift', 'ALL')
            if user_shift and user_shift != 'ALL':
                effective_shift = user_shift
            else:
                effective_shift = requested_shift

            session = _service.create_session(
                part              = part,
                machine           = machine,
                operator          = request.user,
                inspection_type   = d.get('inspection_type', 'first_piece'),
                shift             = effective_shift,
                template_id       = d.get('template_id'),
                trial_number      = d.get('trial_number', 1),
                parent_session_id = d.get('parent_session_id'),
                hourly_slot       = d.get('hourly_slot', 1),
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
    Records a single voice/manual measurement for a parameter asynchronously.
    Returns HTTP 202 Accepted immediately (<100ms response time).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        t_start = time.perf_counter()
        serializer = RecordMeasurementSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        param_code = serializer.validated_data['parameter_code']
        val = serializer.validated_data.get('measured_value')
        if val is None:
            val = 0.0
        float_val = float(val)
        method = serializer.validated_data.get('method', 'voice')

        # 1. Idempotency Key Extraction
        idem_key = (
            request.headers.get('X-Idempotency-Key')
            or serializer.validated_data.get('idempotency_key')
            or f"meas_{session_id}_{param_code}_{float_val}"
        ).strip()

        # 2. Check Redis Idempotency Cache
        cache_key = f"idempotency_{idem_key}"
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            status_code = cached_result.get('status_code', 200)
            duration_ms = (time.perf_counter() - t_start) * 1000
            logger.info(
                "[PERF MEASURE IDEMPOTENT] Code: %s | Val: %s | Idempotent Cache Hit: %.2f ms",
                param_code, float_val, duration_ms
            )
            return Response(cached_result, status=status_code)

        # 3. Process Synchronously (No WebSockets in mobile app)
        from .tasks import process_measurement_in_background
        result = process_measurement_in_background(
            session_id=session_id,
            parameter_code=param_code,
            measured_value=float_val,
            voice_raw_text=serializer.validated_data.get('voice_raw_text', ''),
            method=method,
            hourly_slot=serializer.validated_data.get('hourly_slot'),
            inspection_type=serializer.validated_data.get('inspection_type'),
            idempotency_key=idem_key,
        )

        duration_ms = (time.perf_counter() - t_start) * 1000
        logger.info(
            "[PERF MEASURE SYNC] Code: %s | Val: %s | Method: %s | HTTP 200 Time: %.2f ms",
            param_code, float_val, method, duration_ms
        )

        return Response(result, status=result.get('status_code', status.HTTP_200_OK))


# ─── Batch Measure (Per-Piece Form Submission) ────────────────────────────
class BatchMeasureView(APIView):
    """
    POST /api/inspections/<session_id>/batch-measure/

    Accepts ALL field measurements for one physical piece in a single request.
    The inspector fills the whole form and taps 'Submit Piece'.

    Workflow:
    1. Validate every measurement via InspectionService.record_measurement()
    2. Collect per-field results (ok / out_of_spec)
    3. All pass  -> auto-complete session, return piece_complete=True
    4. Any fail  -> return piece_complete=False + failed_codes list
                    (Flutter starts a new session with parent_session_id so
                     the retry only reopens failed fields)

    Response shape:
    {
      "piece_complete": bool,
      "total": int,
      "passed_count": int,
      "failed_count": int,
      "failed_codes": ["D-02", "PP-01"],
      "results": [
        {"parameter_code": "D-01", "status": "ok",          "message": "...", "measured_value": 25.02},
        {"parameter_code": "D-02", "status": "out_of_spec", "message": "...", "measured_value": 12.3}
      ]
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        t_batch_start = time.perf_counter()
        serializer = BatchMeasureSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        measurements_data = serializer.validated_data['measurements']
        if not measurements_data:
            return Response(
                {'error': 'measurements list cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        failed_codes = []

        for m in measurements_data:
            code     = m['parameter_code']
            val      = m.get('measured_value') or 0.0
            raw_text = m.get('voice_raw_text', '')
            method   = m.get('method', 'form')

            try:
                field_result = _service.record_measurement(
                    session_id      = session_id,
                    parameter_code  = code,
                    measured_value  = float(val),
                    voice_raw_text  = raw_text,
                    method          = method,
                    inspection_type = 'first_piece',
                )
                field_status = field_result.get('status', 'ok')
                results.append({
                    'parameter_code': code,
                    'status':         field_status,
                    'measured_value': field_result.get('measured_value', val),
                    'message':        field_result.get('message', ''),
                })
                if field_status == 'out_of_spec':
                    failed_codes.append(code)
            except Exception as exc:
                # Unrecognised parameter — count as failure so the field re-opens
                results.append({
                    'parameter_code': code,
                    'status':         'error',
                    'measured_value': val,
                    'message':        str(exc),
                })
                failed_codes.append(code)

        passed_count   = len(results) - len(failed_codes)
        piece_complete = len(failed_codes) == 0

        # Auto-complete when every field passes — no separate /complete/ call needed.
        if piece_complete:
            try:
                _service.complete_session(session_id)
            except Exception:
                pass  # may already be completed; ignore
        else:
            try:
                _service.collection.update_one(
                    {'_id': str(session_id)},
                    {'$set': {'rejected_parameters': failed_codes}}
                )
                InspectionSession.objects.filter(session_id=session_id).update(has_ooc=True)
            except Exception as e:
                logger.warning("Could not update rejected_parameters on session %s: %s", session_id, e)

        duration_ms = (time.perf_counter() - t_batch_start) * 1000
        logger.info(
            "[PERF BATCH MEASURE RECORDED] Count: %d fields | Passed: %d | Failed: %d | Total Duration: %.2f ms",
            len(results), passed_count, len(failed_codes), duration_ms
        )

        return Response({
            'piece_complete': piece_complete,
            'total':          len(results),
            'passed_count':   passed_count,
            'failed_count':   len(failed_codes),
            'failed_codes':   failed_codes,
            'results':        results,
        }, status=status.HTTP_200_OK)


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
            'part',
            'machine',
            'machine__plant',
            'machine__plant__factory',
            'operator',
            'supervisor',
            'finalized_by',
            'template',
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
    GET /api/inspections/                                    → all sessions
    GET /api/inspections/?start_date=2026-08-01&end_date=... → date-wise range
    GET /api/inspections/?status=approved                    → filter by status
    GET /api/inspections/?machine=MCH-001                    → filter by machine code
    """
    serializer_class   = InspectionSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q, Subquery, OuterRef, Value
        from django.db.models.functions import NullIf
        from apps.parts.models import InspectionTemplate

        # Annotate each session with the operation name from the matching
        # InspectionTemplate (part + inspection_type) — same ORM pattern as
        # part_number/part_name. NullIf converts blank names to NULL so the
        # serializer's None-check works correctly.
        template_name_subquery = Subquery(
            InspectionTemplate.objects.filter(
                part=OuterRef('part'),
                inspection_type=OuterRef('inspection_type'),
                is_active=True,
            ).order_by('-version').annotate(
                safe_name=NullIf('name', Value(''))
            ).values('safe_name')[:1]
        )

        qs = InspectionSession.objects.select_related(
            'part',
            'machine',
            'machine__plant',
            'machine__plant__factory',
            'operator',
            'supervisor',
            'finalized_by',
            'template',
        ).annotate(template_name=template_name_subquery)

        status_filter   = self.request.query_params.get('status')
        machine_code    = self.request.query_params.get('machine')
        part_number     = self.request.query_params.get('part')
        shift           = self.request.query_params.get('shift')
        inspection_type = self.request.query_params.get('inspection_type')
        operator_id     = self.request.query_params.get('operator')
        operator_name   = self.request.query_params.get('operator_name')
        inspector_name  = self.request.query_params.get('inspector_name')
        only_completed  = self.request.query_params.get('only_completed')
        start_date      = self.request.query_params.get('start_date')
        end_date        = self.request.query_params.get('end_date')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if machine_code:
            qs = qs.filter(machine__machine_code__icontains=machine_code)
        if part_number:
            qs = qs.filter(part__part_number__icontains=part_number)
        if shift:
            qs = qs.filter(shift=shift)
        if inspection_type:
            qs = qs.filter(inspection_type=inspection_type)
        if operator_id:
            qs = qs.filter(operator_id=operator_id)
        if operator_name:
            qs = qs.filter(
                Q(operator__username__icontains=operator_name) |
                Q(operator__first_name__icontains=operator_name) |
                Q(operator__last_name__icontains=operator_name)
            )
        if inspector_name:
            qs = qs.filter(
                Q(finalized_by__username__icontains=inspector_name) |
                Q(finalized_by__first_name__icontains=inspector_name) |
                Q(finalized_by__last_name__icontains=inspector_name) |
                Q(supervisor__username__icontains=inspector_name) |
                Q(supervisor__first_name__icontains=inspector_name) |
                Q(supervisor__last_name__icontains=inspector_name)
            )
        if only_completed and only_completed.lower() in ['true', '1', 'yes']:
            qs = qs.filter(
                Q(status__in=['approved', 'finalized_passed', 'completed']) |
                Q(is_setup_approved=True) |
                Q(is_first_piece_finalized=True)
            )
        if start_date:
            qs = qs.filter(started_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(started_at__date__lte=end_date)

        # Filter by plant if user belongs to a specific plant
        if request := self.request:
            if hasattr(request.user, 'plant') and request.user.plant:
                qs = qs.filter(machine__plant=request.user.plant)

        return qs.order_by('-started_at')


# ─── Operator Rejections List ─────────────────────────────────────────────
class RejectionsListView(generics.ListAPIView):
    """
    GET /api/inspections/rejections/
    Returns active rejected sessions that require corrective trial #2 or #3.
    """
    serializer_class   = InspectionSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = InspectionSession.objects.select_related(
            'part',
            'machine',
            'machine__plant',
            'machine__plant__factory',
            'operator',
            'supervisor',
            'finalized_by',
            'template',
        ).filter(
            status=InspectionSession.Status.REJECTED,
            trial_number__lt=3,
        ).order_by('-reviewed_at')

        user = self.request.user
        if hasattr(user, 'plant') and user.plant:
            plant_qs = qs.filter(machine__plant=user.plant)
            if plant_qs.exists():
                return plant_qs
        return qs


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


# ─── Check Setup Approval Status ──────────────────────────────────────────
class SetupStatusView(APIView):
    """
    GET /api/inspections/setup-status/?machine=2
    Returns whether 1st Piece Inspection is approved for a machine.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        machine_id = request.query_params.get('machine')
        if not machine_id:
            return Response({'error': 'machine parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db.models import Q
        from django.utils import timezone
        today = timezone.localdate()

        # Check for today's active session first
        session = None
        if str(machine_id).isdigit():
            session = InspectionSession.objects.select_related('part', 'machine').filter(
                Q(machine_id=int(machine_id)) | Q(machine__machine_code=machine_id),
                started_at__date=today
            ).order_by('-started_at').first()
        else:
            session = InspectionSession.objects.select_related('part', 'machine').filter(
                machine__machine_code=machine_id,
                started_at__date=today
            ).order_by('-started_at').first()

        has_today = True

        # Fallback to latest session if today's check finds no session
        if not session:
            has_today = False
            if str(machine_id).isdigit():
                session = InspectionSession.objects.select_related('part', 'machine').filter(
                    Q(machine_id=int(machine_id)) | Q(machine__machine_code=machine_id)
                ).order_by('-started_at').first()
            else:
                session = InspectionSession.objects.select_related('part', 'machine').filter(
                    machine__machine_code=machine_id
                ).order_by('-started_at').first()

        if not session:
            return Response({
                'has_today_report': False,
                'is_setup_approved': False,
                'status': 'no_session_today',
                'message': 'No inspection started for today.'
            })

        completed_slots = []
        try:
            doc = _service.get_session_document(str(session.session_id))
            if doc and 'measurements' in doc:
                slot_set = set()
                for m in doc['measurements']:
                    slot = m.get('hourly_slot')
                    if slot and isinstance(slot, int):
                        slot_set.add(slot)
                    elif m.get('inspection_type') == 'hourly' and m.get('hourly_slot'):
                        try:
                            slot_set.add(int(m.get('hourly_slot')))
                        except Exception:
                            pass
                completed_slots = sorted(list(slot_set))
        except Exception:
            pass

        next_slot = (max(completed_slots) + 1) if completed_slots else 1

        is_approved = True

        part_id = session.part.id if session.part else None
        part_no = session.part.part_number if session.part else None
        part_name = session.part.part_name if session.part else None
        machine_id = session.machine.id if session.machine else None

        shift_hrs = 8
        if session.machine and session.machine.plant and session.machine.plant.factory:
            shift_hrs = session.machine.plant.factory.shift_hours or 8

        return Response({
            'has_today_report': has_today,
            'is_setup_approved': is_approved,
            'session_id': str(session.session_id),
            'status': session.status,
            'shift_hours': shift_hrs,
            'total_hourly_slots': shift_hrs,
            'machine_id': machine_id,
            'part_id': part_id,
            'part_number': part_no,
            'part_name': part_name,
            'inspection_type': session.inspection_type,
            'completed_hourly_slots': completed_slots,
            'next_unlocked_slot': next_slot,
            'message': 'Today\'s inspection report active.' if has_today else 'No inspection started for today.'
        })


# ─── Finalize First Piece Inspection ──────────────────────────────────────
class FinalizeFirstPieceView(APIView):
    """
    POST /api/inspections/<session_id>/finalize/
    Inspector finalizes First Piece inspection and generates PDF.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = _service.finalize_first_piece_session(session_id, request.user)
            return Response(InspectionSessionSerializer(session).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── First Piece PDF Report View ──────────────────────────────────────────
class FirstPiecePDFView(APIView):
    """
    GET /api/inspections/<session_id>/pdf/
    Returns the official First Piece Inspection Report PDF file.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        import os
        from django.conf import settings
        from django.http import FileResponse

        try:
            session = InspectionSession.objects.get(session_id=session_id)
            doc = _service.get_session_document(session_id) or {}
            
            from .pdf_generator import generate_first_piece_pdf
            pdf_path = generate_first_piece_pdf(session, doc)
            session.pdf_report_path = pdf_path
            session.save(update_fields=['pdf_report_path'])

            abs_pdf_path = os.path.join(settings.BASE_DIR, pdf_path)
            if not os.path.exists(abs_pdf_path):
                return Response({'error': 'PDF report file not found.'}, status=status.HTTP_404_NOT_FOUND)

            return FileResponse(open(abs_pdf_path, 'rb'), content_type='application/pdf', filename=f"FirstPiece_Report_{session_id}.pdf")
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── First Piece Authorization Status View ────────────────────────────────
class FirstPieceStatusView(APIView):
    """
    GET /api/inspections/first-piece-status/?machine_id=2&part_number=PN-101
    Checks if 1st Piece Inspection is finalized and passed for a machine/part.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        machine_id = request.query_params.get('machine_id') or request.query_params.get('machine')
        part_number = request.query_params.get('part_number')

        if not machine_id:
            return Response({'error': 'machine_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        qs = InspectionSession.objects.filter(machine_id=machine_id, inspection_type='first_piece')
        if part_number:
            qs = qs.filter(part__part_number=part_number)

        passed_session = qs.filter(status=InspectionSession.Status.FINALIZED_PASSED).order_by('-finalized_at').first()

        if passed_session:
            return Response({
                'is_authorized': True,
                'status': 'finalized_passed',
                'session_id': str(passed_session.session_id),
                'pdf_url': f"/api/inspections/{passed_session.session_id}/pdf/",
                'message': 'First Piece Inspection is finalized and PASSED. Production authorized.'
            })

        latest_session = qs.order_by('-started_at').first()
        return Response({
            'is_authorized': False,
            'status': latest_session.status if latest_session else 'not_started',
            'session_id': str(latest_session.session_id) if latest_session else None,
            'message': 'First Piece Inspection has not been finalized as PASSED yet.'
        })


# ─── Clear Inspection History (Clean Slate) ──────────────────────────────
class ClearHistoryView(APIView):
    """
    DELETE /api/inspections/clear-history/?machine_code=CNC-01
    or DELETE /api/inspections/clear-history/?session_id=...
    Supervisors can clear live monitoring view for a machine.
    Finalized reports (First Piece, Setup Approval, Production) remain permanent in database.
    """
    permission_classes = [IsSupervisorOrAbove]

    def delete(self, request):
        machine_code = request.query_params.get('machine_code')
        session_id   = request.query_params.get('session_id')

        if session_id:
            session = InspectionSession.objects.filter(session_id=session_id).exclude(status='completed').first()
            if session:
                session.delete()  # Deletes PostgreSQL record including document_payload
            return Response({'message': f'Session {session_id} deleted.'})

        if machine_code:
            # Safely clear only non-completed sessions to keep historical finalized data intact
            active_sessions = InspectionSession.objects.filter(
                machine__machine_code=machine_code
            ).exclude(status='completed')
            active_sessions.delete()  # Deletes PostgreSQL records including document_payload

            return Response({
                'message': f'All history completely cleared for machine {machine_code}.'
            })

        return Response({'error': 'machine_code or session_id parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)


# ─── Setup Approval ────────────────────────────────────────────────────────
class SetupApprovalView(APIView):
    """
    POST /api/inspections/setup-approval/
        Inspector submits Setup Approval with Process Parameter readings for 1PC#1, 1PC#2, 1PC#3.
        Stored as a separate document in MongoDB (inspection_type='setup_approval').
        Architecturally SEPARATE from the normal First PC Inspection sessions.

    GET  /api/inspections/setup-approval/?template=<id>&machine=<id>
        Returns the most recent Setup Approval data for a template + machine combination.
        Used to pre-populate the SetupApprovalScreen on the mobile app.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        template_id = request.query_params.get('template')
        machine_id  = request.query_params.get('machine')

        if not template_id or not machine_id:
            return Response(
                {'error': 'Both template and machine query parameters are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.inspections.models import SetupApproval
        setup = SetupApproval.objects.filter(
            template_id=int(template_id),
            machine_id=int(machine_id),
        ).order_by('-submitted_at').first()

        if not setup:
            return Response(
                {'detail': 'No setup approval data found for this template and machine.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            '_id': str(setup.id),
            'inspection_type': 'setup_approval',
            'template_id': setup.template_id,
            'machine_id': setup.machine_id,
            'part_number': setup.part_number,
            'inspector_id': setup.inspector_id,
            'inspector_name': setup.inspector_name,
            'process_param_entries': setup.process_param_entries,
            'submitted_at': setup.submitted_at,
            'status': setup.status,
        })

    def post(self, request):
        """
        Payload:
        {
            "template_id": 5,
            "machine_id": 3,
            "part_number": "FBT00222",
            "inspector_name": "Samruddhi Bartakke",
            "process_param_entries": [
                {
                    "parameter_code": "PR1",
                    "parameter_name": "RPM",
                    "trial_1": "1200",
                    "trial_2": "1250",
                    "trial_3": "1200"
                }
            ]
        }
        """
        from datetime import datetime, timezone as tz
        import uuid

        template_id    = request.data.get('template_id')
        machine_id     = request.data.get('machine_id')
        part_number    = request.data.get('part_number', '')
        entries        = request.data.get('process_param_entries', [])
        inspector_name = request.data.get('inspector_name', request.user.get_full_name())

        if not template_id or not machine_id:
            return Response(
                {'error': 'template_id and machine_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(entries, list):
            return Response(
                {'error': 'process_param_entries must be a list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = datetime.now(tz.utc)

        # Upsert — update today's existing document or insert new
        from apps.inspections.models import SetupApproval, InspectionSession
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        existing = SetupApproval.objects.filter(
            template_id=int(template_id),
            machine_id=int(machine_id),
            submitted_at__gte=today_start,
        ).first()

        if existing:
            existing.process_param_entries = entries
            existing.inspector = request.user
            existing.inspector_name = inspector_name
            existing.submitted_at = now
            existing.status = 'submitted'
            existing.save()
            result_id = str(existing.id)
            updated = True
        else:
            new_setup = SetupApproval.objects.create(
                template_id=int(template_id),
                machine_id=int(machine_id),
                part_number=part_number,
                inspector=request.user,
                inspector_name=inspector_name,
                process_param_entries=entries,
                status='submitted',
            )
            result_id = str(new_setup.id)
            updated = False

        # Sync process_param_entries to active sessions' document_payload for this machine
        from apps.inspections import document_utils as doc_utils
        active_sessions = InspectionSession.objects.filter(
            machine_id=int(machine_id),
            started_at__date=now.date(),
        )
        for session in active_sessions:
            doc_utils.update_document(
                session,
                updates={'process_param_entries': entries},
                save=True
            )

        return Response(
            {
                'success': True,
                'message': 'Setup Approval process parameters submitted successfully.',
                'setup_approval_id': result_id,
                'template_id': template_id,
                'machine_id': machine_id,
                'submitted_at': now.isoformat(),
                'entries_count': len(entries),
                'updated': updated,
            },
            status=status.HTTP_201_CREATED,
        )


# ─── Daily Production Reports ──────────────────────────────────────────────
class DailyProductionReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for End-of-Day Daily Production Reports.
    GET /api/inspections/daily-production-reports/
    POST /api/inspections/daily-production-reports/
    GET /api/inspections/daily-production-reports/{id}/export_pdf/
    GET /api/inspections/daily-production-reports/export_excel/
    """
    serializer_class = DailyProductionReportSerializer

    def get_permissions(self):
        if self.action in ['export_excel', 'export_pdf']:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = DailyProductionReport.objects.select_related('machine', 'part', 'operator').all()

        date_str = self.request.query_params.get('date')
        if date_str:
            qs = qs.filter(date=date_str)

        machine_id = self.request.query_params.get('machine') or self.request.query_params.get('machine_id')
        if machine_id:
            qs = qs.filter(machine_id=machine_id)

        part_id = self.request.query_params.get('part') or self.request.query_params.get('part_id')
        if part_id:
            qs = qs.filter(part_id=part_id)

        shift = self.request.query_params.get('shift')
        if shift:
            qs = qs.filter(shift=shift)

        operator_id = self.request.query_params.get('operator') or self.request.query_params.get('operator_id')
        if operator_id:
            qs = qs.filter(operator_id=operator_id)

        return qs

    def perform_create(self, serializer):
        # Set operator to current user if not explicitly passed
        operator = serializer.validated_data.get('operator') or self.request.user
        submitted_shift = serializer.validated_data.get('shift') or 'I'
        if submitted_shift in ('A', 'B', 'C'):
            submitted_shift = {'A': 'I', 'B': 'II', 'C': 'III'}.get(submitted_shift, 'I')

        # If operator has an assigned shift other than ALL, enforce it
        user_shift = getattr(operator, 'assigned_shift', 'ALL')
        if user_shift and user_shift != 'ALL':
            effective_shift = user_shift
        else:
            effective_shift = submitted_shift

        serializer.save(operator=operator, shift=effective_shift)

    @action(detail=True, methods=['get'])
    def export_pdf(self, request, pk=None):
        report = self.get_object()
        relative_path = generate_daily_production_pdf(report)
        full_path = os.path.join(settings.BASE_DIR, relative_path)
        if os.path.exists(full_path):
            return FileResponse(open(full_path, 'rb'), content_type='application/pdf', filename=f"DailyProduction_Report_{report.report_id}.pdf")
        return Response({"error": "PDF generation failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="Daily_Production_Reports.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Date', 'Machine Code', 'Machine Name', 'Part Number', 'Part Name', 'Operation',
            'Shift', 'Operator', 'Target', 'Completed', 'Correct', 'Incorrect',
            'CR', 'MR', 'RW', 'Achievement %', 'Remarks'
        ])

        for r in qs:
            op_name = r.operator.get_full_name().strip() if r.operator else ''
            if not op_name and r.operator:
                op_name = r.operator.username
            writer.writerow([
                str(r.date), r.machine.machine_code, r.machine.name,
                r.part.part_number, r.part.part_name, r.operation,
                r.shift, op_name, r.production_target, r.jobs_completed,
                r.correct_jobs, r.incorrect_jobs, r.cr_count, r.mr_count,
                r.rw_count, f"{r.achievement_percentage}%", r.remarks
            ])

        return response


def generate_downtime_xlsx(qs, date_str: str, shift_str: str) -> io.BytesIO:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Downtime Report"
    ws.views.sheetView[0].showGridLines = True

    cyan_fill = PatternFill(start_color="B0E0E6", end_color="B0E0E6", fill_type="solid")
    light_blue_fill = PatternFill(start_color="93C5FD", end_color="93C5FD", fill_type="solid")
    sky_fill = PatternFill(start_color="7DD3FC", end_color="7DD3FC", fill_type="solid")
    soft_cyan_fill = PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='000000'),
        right=Side(style='thin', color='000000'),
        top=Side(style='thin', color='000000'),
        bottom=Side(style='thin', color='000000')
    )

    title_font = Font(name="Arial", size=13, bold=True)
    header_font = Font(name="Arial", size=20, bold=True)
    sub_font = Font(name="Arial", size=10, bold=True)
    bold_cell_font = Font(name="Arial", size=9, bold=True)
    regular_font = Font(name="Arial", size=9)
    note_font = Font(name="Arial", size=9, italic=True)

    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")

    # 1. Title Banner (Rows 1 to 3)
    ws.merge_cells("A1:C2")
    ws["A1"] = "HANUMAN ENGINEERING\nWORKS"
    ws["A1"].font = title_font
    ws["A1"].alignment = align_center

    ws.merge_cells("A3:C3")
    ws["A3"] = f"Date: {date_str if date_str and date_str != 'All' else ''}"
    ws["A3"].font = sub_font
    ws["A3"].alignment = align_left

    ws.merge_cells("D1:S3")
    ws["D1"] = "DOWN TIME REPORT"
    ws["D1"].font = header_font
    ws["D1"].alignment = align_center

    ws.merge_cells("T1:V1")
    ws["T1"] = "FORMAT NO. :- QF/MF-06"
    ws["T1"].font = sub_font
    ws["T1"].alignment = align_right

    ws.merge_cells("T2:V2")
    ws["T2"] = "REV. No./ Date :- 00 / 30.09.2026"
    ws["T2"].font = sub_font
    ws["T2"].alignment = align_right

    ws.merge_cells("T3:V3")
    ws["T3"] = f"Shift: {shift_str if shift_str and shift_str != 'All' else ''}"
    ws["T3"].font = sub_font
    ws["T3"].alignment = align_left

    for row in range(1, 4):
        for col in range(1, 23):
            cell = ws.cell(row=row, column=col)
            cell.fill = cyan_fill
            cell.border = thin_border

    # 2. Merged Headers (Rows 4 & 5)
    ws.merge_cells("A4:A5")
    ws["A4"] = "Sr. No."

    ws.merge_cells("B4:B5")
    ws["B4"] = "Machine\nNo."

    ws.merge_cells("C4:C5")
    ws["C4"] = "Operator Name"

    ws.merge_cells("D4:D5")
    ws["D4"] = "Target"

    ws.merge_cells("E4:E5")
    ws["E4"] = "Produced"

    ws.merge_cells("F4:F5")
    ws["F4"] = "Accepted\n/ Actual"

    ws.merge_cells("G4:I4")
    ws["G4"] = "Rejection Summary"
    ws["G5"] = "CR"
    ws["H5"] = "MR"
    ws["I5"] = "RW"

    ws.merge_cells("J4:R4")
    ws["J4"] = "DOWN TIME IN MINUTES"
    ws["J5"] = "NO LOAD"
    ws["K5"] = "NO\nOPERATOR"
    ws["L5"] = "U/M"
    ws["M5"] = "SETTING"
    ws["N5"] = "INSP.\nWAIT"
    ws["O5"] = "TOOL\nCHANGE"
    ws["P5"] = "P/O"
    ws["Q5"] = "R/W"
    ws["R5"] = "TOOL\nPROB"

    ws.merge_cells("S4:S5")
    ws["S4"] = "Total Down\nTime (Min.)"

    ws.merge_cells("T4:V5")
    ws["T4"] = "Remarks"

    for row in (4, 5):
        for col in range(1, 23):
            cell = ws.cell(row=row, column=col)
            cell.font = bold_cell_font
            cell.alignment = align_center
            cell.border = thin_border
            if 7 <= col <= 9:
                cell.fill = light_blue_fill
            elif 10 <= col <= 18:
                cell.fill = sky_fill
            elif col == 19:
                cell.fill = soft_cyan_fill
            else:
                cell.fill = cyan_fill

    # 3. Data Rows (Row 6 onwards)
    current_row = 6
    for idx, obj in enumerate(qs, 1):
        prod = obj.production_report
        op_name = prod.operator.get_full_name().strip() if prod.operator else '—'
        if not op_name and prod.operator:
            op_name = prod.operator.username

        ws.cell(row=current_row, column=1, value=idx).alignment = align_center
        ws.cell(row=current_row, column=2, value=prod.machine.machine_code).alignment = align_center
        ws.cell(row=current_row, column=3, value=op_name).alignment = align_left
        ws.cell(row=current_row, column=4, value=prod.production_target).alignment = align_center
        ws.cell(row=current_row, column=5, value=prod.jobs_completed).alignment = align_center
        ws.cell(row=current_row, column=6, value=prod.correct_jobs).alignment = align_center

        ws.cell(row=current_row, column=7, value=prod.cr_count).alignment = align_center
        ws.cell(row=current_row, column=8, value=prod.mr_count).alignment = align_center
        ws.cell(row=current_row, column=9, value=prod.rw_count).alignment = align_center

        ws.cell(row=current_row, column=10, value=obj.no_load).alignment = align_center
        ws.cell(row=current_row, column=11, value=obj.no_operator).alignment = align_center
        ws.cell(row=current_row, column=12, value=obj.um).alignment = align_center
        ws.cell(row=current_row, column=13, value=obj.setting).alignment = align_center
        ws.cell(row=current_row, column=14, value=obj.inspection_wait).alignment = align_center
        ws.cell(row=current_row, column=15, value=obj.tool_change).alignment = align_center
        ws.cell(row=current_row, column=16, value=obj.power_off).alignment = align_center
        ws.cell(row=current_row, column=17, value=obj.rework).alignment = align_center
        ws.cell(row=current_row, column=18, value=obj.tool_problem).alignment = align_center

        ws.cell(row=current_row, column=19, value=f"=SUM(J{current_row}:R{current_row})").alignment = align_center
        ws.cell(row=current_row, column=19).font = bold_cell_font

        ws.merge_cells(start_row=current_row, start_column=20, end_row=current_row, end_column=22)
        ws.cell(row=current_row, column=20, value=obj.remarks or '').alignment = align_left

        for col in range(1, 23):
            c = ws.cell(row=current_row, column=col)
            c.border = thin_border
            if not c.font.bold:
                c.font = regular_font

        current_row += 1

    # Empty grid rows up to row 19 matching template layout
    while current_row < 20:
        ws.cell(row=current_row, column=1, value=current_row - 5).alignment = align_center
        ws.cell(row=current_row, column=19, value=f"=SUM(J{current_row}:R{current_row})").alignment = align_center
        ws.cell(row=current_row, column=19).font = bold_cell_font
        ws.merge_cells(start_row=current_row, start_column=20, end_row=current_row, end_column=22)

        for col in range(1, 23):
            c = ws.cell(row=current_row, column=col)
            c.border = thin_border
            if not c.font.bold:
                c.font = regular_font
        current_row += 1

    # 4. Total Breakdown Row (Row 20)
    total_row = current_row
    ws.merge_cells(start_row=total_row, start_column=1, end_row=total_row, end_column=18)
    ws.cell(row=total_row, column=1, value="Total breakdown Time(Min.)").alignment = align_right
    ws.cell(row=total_row, column=1).font = bold_cell_font

    ws.cell(row=total_row, column=19, value=f"=SUM(S6:S{total_row-1})").alignment = align_center
    ws.cell(row=total_row, column=19).font = bold_cell_font
    ws.cell(row=total_row, column=19).fill = soft_cyan_fill

    ws.merge_cells(start_row=total_row, start_column=20, end_row=total_row, end_column=22)
    for col in range(1, 23):
        ws.cell(row=total_row, column=col).border = thin_border

    # 5. Supervisor Sign Row (Row 21)
    sig_row = total_row + 1
    ws.merge_cells(start_row=sig_row, start_column=1, end_row=sig_row + 1, end_column=22)
    ws.cell(row=sig_row, column=1, value="Supervisor Sign").alignment = Alignment(horizontal="left", vertical="top")
    ws.cell(row=sig_row, column=1).font = Font(name="Arial", size=11, bold=True)
    for r in range(sig_row, sig_row + 2):
        for c in range(1, 23):
            ws.cell(row=r, column=c).border = thin_border

    # 6. Footer Note (Row 23)
    note_row = sig_row + 2
    ws.merge_cells(start_row=note_row, start_column=1, end_row=note_row, end_column=18)
    ws.cell(row=note_row, column=1, value="Note: Actual Time to be Recorded in time (minutes)").alignment = align_left
    ws.cell(row=note_row, column=1).font = note_font

    ws.merge_cells(start_row=note_row, start_column=19, end_row=note_row, end_column=22)
    ws.cell(row=note_row, column=19, value="Checked By").alignment = align_right
    ws.cell(row=note_row, column=19).font = bold_cell_font

    for col in range(1, 23):
        ws.cell(row=note_row, column=col).border = thin_border

    # L8 FIX: Auto-adjust column widths dynamically based on actual cell content.
    # Replaces the previous hardcoded col_widths dictionary that caused long 
    # text (like remarks or part numbers) to get cut off.
    from openpyxl.utils import get_column_letter
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter # Get the column name
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        
        # Add a little padding and cap the maximum width at 50 to avoid crazy wide columns
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column].width = adjusted_width

    ws.row_dimensions[1].height = 20
    ws.row_dimensions[2].height = 20
    ws.row_dimensions[3].height = 18
    ws.row_dimensions[4].height = 20
    ws.row_dimensions[5].height = 22

    buffer = io.BytesIO()
    wb.save(buffer)
    # L6 FIX: Always close openpyxl workbooks after saving to free memory immediately.
    # Otherwise, unclosed workbooks linger until garbage collection, causing a slow
    # memory leak that can eventually OOM a small server during heavy report generation.
    wb.close()
    buffer.seek(0)
    return buffer


# ─── Downtime Reports ──────────────────────────────────────────────────────
class DowntimeReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Downtime Reports attached to Daily Production Reports.
    GET  /api/inspections/downtime-reports/?date=...&shift=...
    POST /api/inspections/downtime-reports/
    POST /api/inspections/downtime-reports/bulk_save/
    GET  /api/inspections/downtime-reports/export_excel/?date=...&shift=...
    GET  /api/inspections/downtime-reports/export_pdf/?date=...&shift=...
    """
    serializer_class = DowntimeReportSerializer

    def get_permissions(self):
        if self.action in ['export_excel', 'export_pdf']:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def get_queryset(self):
        # Fetch only SUBMITTED Daily Production Reports
        prod_qs = DailyProductionReport.objects.filter(status='SUBMITTED').select_related('machine', 'operator')

        date_str = self.request.query_params.get('date')
        if date_str:
            prod_qs = prod_qs.filter(date=date_str)

        shift = self.request.query_params.get('shift')
        if shift:
            prod_qs = prod_qs.filter(shift=shift)

        machine_id = self.request.query_params.get('machine') or self.request.query_params.get('machine_id')
        if machine_id:
            prod_qs = prod_qs.filter(machine_id=machine_id)

        # Ensure a DowntimeReport exists for each submitted production report
        for prod in prod_qs:
            DowntimeReport.objects.get_or_create(production_report=prod)

        return DowntimeReport.objects.filter(
            production_report__in=prod_qs
        ).select_related(
            'production_report',
            'production_report__machine',
            'production_report__operator',
            'created_by'
        ).order_by('production_report__date', 'production_report__machine__machine_code')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def bulk_save(self, request):
        data_list = request.data if isinstance(request.data, list) else request.data.get('reports', [])
        if not isinstance(data_list, list):
            return Response({"error": "Expected a list of downtime report records."}, status=status.HTTP_400_BAD_REQUEST)

        updated_reports = []
        for item in data_list:
            prod_id = item.get('production_report_id') or item.get('production_report')
            report_obj = None

            if item.get('id'):
                report_obj = DowntimeReport.objects.filter(id=item['id']).first()

            if not report_obj and prod_id:
                prod = DailyProductionReport.objects.filter(id=prod_id).first()
                if prod:
                    report_obj, _ = DowntimeReport.objects.get_or_create(production_report=prod)

            if not report_obj:
                continue

            serializer = DowntimeReportSerializer(report_obj, data=item, partial=True)
            if serializer.is_valid():
                obj = serializer.save(created_by=request.user)
                if item.get('mark_completed'):
                    obj.status = DowntimeReport.Status.COMPLETED
                    obj.save()
                updated_reports.append(serializer.data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return Response(updated_reports, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        qs = self.filter_queryset(self.get_queryset())
        date_str = request.query_params.get('date', 'All')
        shift_str = request.query_params.get('shift', 'All')

        excel_buffer = generate_downtime_xlsx(qs, date_str, shift_str)
        response = HttpResponse(
            excel_buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="Downtime_Report_{date_str}_{shift_str}.xlsx"'
        return response

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        qs = self.filter_queryset(self.get_queryset())
        date_str = request.query_params.get('date', 'All')
        shift_str = request.query_params.get('shift', 'All')

        relative_path = generate_downtime_pdf(qs, date_str, shift_str)
        full_path = os.path.join(settings.BASE_DIR, relative_path)
        if os.path.exists(full_path):
            return FileResponse(
                open(full_path, 'rb'),
                content_type='application/pdf',
                filename=f"Downtime_Report_{date_str}_{shift_str}.pdf"
            )
        return Response({"error": "PDF generation failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def history(self, request):
        """
        Returns date-wise and shift-wise summary of submitted downtime reports for history tracking.

        M3 FIX: Added date-range cap — defaults to last 90 days.
        Use ?days=N (max 365) to customise the lookback window.
        Without a cap, this fetched ALL records ever created, causing server-side
        memory spikes and slow responses after months of factory operation.
        """
        from django.utils import timezone as django_tz
        import datetime as dt

        # Parse ?days= query param — default 90, hard cap at 365
        try:
            days = min(int(request.query_params.get('days', 90)), 365)
        except (ValueError, TypeError):
            days = 90

        since_date = (django_tz.now() - dt.timedelta(days=days)).date()

        reports = DowntimeReport.objects.select_related(
            'production_report',
            'production_report__machine',
            'created_by'
        ).filter(
            production_report__date__gte=since_date   # ← limit to recent records
        ).order_by('-production_report__date')

        date_groups = {}
        for r in reports:
            prod = r.production_report
            if not prod:
                continue
            d_str = str(prod.date)
            shift = prod.shift
            key = f"{d_str}_{shift}"

            if key not in date_groups:
                date_groups[key] = {
                    'key': key,
                    'date': d_str,
                    'shift': shift,
                    'count': 0,
                    'completed_count': 0,
                    'total_downtime': 0,
                    'status': 'COMPLETED' if r.status == 'COMPLETED' else 'PENDING',
                    'updated_at': r.updated_at,
                    'submitted_by': (r.created_by.get_full_name() or r.created_by.username) if r.created_by else 'Supervisor',
                    'machines': []
                }

            date_groups[key]['count'] += 1
            if r.status == 'COMPLETED':
                date_groups[key]['completed_count'] += 1
            date_groups[key]['total_downtime'] += r.total_downtime
            if prod.machine and prod.machine.machine_code not in date_groups[key]['machines']:
                date_groups[key]['machines'].append(prod.machine.machine_code)

        history_list = list(date_groups.values())
        return Response({
            'count':   len(history_list),
            'days':    days,
            'since':   str(since_date),
            'results': history_list,
        }, status=status.HTTP_200_OK)


# ─── JH (Autonomous Maintenance) Views ───────────────────────────────────────

class JHChecklistItemsView(APIView):
    """
    GET /api/inspections/jh/items/
    Returns all active JH checklist checkpoints ordered by sort_order.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = JHChecklistItem.objects.filter(is_active=True).order_by('sort_order', 'sub_no')
        serializer = JHChecklistItemSerializer(items, many=True)
        return Response({
            'count': items.count(),
            'results': serializer.data,
        }, status=status.HTTP_200_OK)


class JHInspectionSubmitView(APIView):
    """
    POST /api/inspections/jh/submit/
    Submits a shift's Autonomous Maintenance checklist.
    Stored in PostgreSQL under JHInspectionRecord and JHInspectionItemResult.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = JHInspectionSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        machine_id = data['machine_id']
        insp_date = data['date']
        shift = data['shift']
        remarks = data.get('overall_remarks', '')
        results_data = data['results']

        machine = Machine.objects.select_related('plant', 'plant__factory').filter(id=machine_id).first()
        if not machine:
            return Response({'error': f"Machine ID {machine_id} not found."}, status=status.HTTP_404_NOT_FOUND)

        # Validate shift for 12-hr vs 8-hr schedule
        machine_shift_hours = 8
        if machine.plant and machine.plant.shift_duration_hours:
            machine_shift_hours = machine.plant.shift_duration_hours
        elif machine.plant and machine.plant.factory and machine.plant.factory.shift_hours:
            machine_shift_hours = machine.plant.factory.shift_hours

        if machine_shift_hours == 12 and shift == 'III':
            return Response(
                {'error': "Shift III is not applicable for 12-hour schedule machines (only Shift I and Shift II allowed)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce operator role restriction (JH Inspection is strictly for operators)
        user_role = getattr(request.user, 'role', '')
        if user_role and user_role not in ('operator', 'admin'):
            return Response(
                {'error': "पहुंच अस्वीकृत (Access Denied): J-H (Autonomous Maintenance) निरीक्षण केवल मशीन ऑपरेटरों के लिए है।"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Enforce operator assigned shift restriction
        user_shift = getattr(request.user, 'assigned_shift', 'ALL')
        if user_shift and user_shift != 'ALL' and user_shift != shift:
            return Response(
                {'error': f"पहुंच अस्वीकृत (Access Denied): आप केवल शिफ्ट {user_shift} के लिए अधिकृत हैं। आप शिफ्ट {shift} का निरीक्षण सबमिट नहीं कर सकते।"},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            record, _ = JHInspectionRecord.objects.update_or_create(
                machine=machine,
                date=insp_date,
                shift=shift,
                defaults={
                    'operator': request.user,
                    'overall_remarks': remarks,
                }
            )

            record.item_results.all().delete()

            ok_count = 0
            not_ok_count = 0
            corrected_count = 0

            item_ids = [r['item_id'] for r in results_data]
            items_dict = {item.id: item for item in JHChecklistItem.objects.filter(id__in=item_ids)}

            new_results = []
            for r in results_data:
                item_obj = items_dict.get(r['item_id'])
                if not item_obj:
                    continue

                item_status = r['status']
                if item_status == 'OK':
                    ok_count += 1
                elif item_status == 'NOT_OK':
                    not_ok_count += 1
                elif item_status == 'CORRECTED':
                    corrected_count += 1

                new_results.append(
                    JHInspectionItemResult(
                        inspection=record,
                        item=item_obj,
                        status=item_status,
                        remark=r.get('remark', ''),
                        action_taken=r.get('action_taken', ''),
                    )
                )

            JHInspectionItemResult.objects.bulk_create(new_results)

            record.total_items = len(new_results)
            record.ok_items = ok_count
            record.not_ok_items = not_ok_count
            record.corrected_items = corrected_count

            if not_ok_count > 0:
                record.status = JHInspectionRecord.Status.HAS_ISSUES
            elif corrected_count > 0:
                record.status = JHInspectionRecord.Status.CORRECTED
            else:
                record.status = JHInspectionRecord.Status.ALL_OK

            record.save()

        output_serializer = JHInspectionRecordSerializer(record)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class JHInspectionReportsView(APIView):
    """
    GET /api/inspections/jh/reports/
    Lists shift inspection records with filters (machine, date range, shift, status).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = JHInspectionRecord.objects.select_related('machine', 'operator').prefetch_related('item_results', 'item_results__item').all()

        machine_param = request.query_params.get('machine')
        if machine_param:
            if machine_param.isdigit():
                qs = qs.filter(machine_id=int(machine_param))
            else:
                qs = qs.filter(machine__machine_code__iexact=machine_param)

        date_param = request.query_params.get('date')
        if date_param:
            qs = qs.filter(date=date_param)

        start_date = request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(date__gte=start_date)

        end_date = request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(date__lte=end_date)

        shift_param = request.query_params.get('shift')
        if shift_param and shift_param != 'All':
            qs = qs.filter(shift=shift_param)

        status_param = request.query_params.get('status')
        if status_param and status_param != 'All':
            qs = qs.filter(status=status_param)

        serializer = JHInspectionRecordSerializer(qs[:100], many=True)
        return Response({
            'count': qs.count(),
            'results': serializer.data
        }, status=status.HTTP_200_OK)


class JHInspectionDetailView(APIView):
    """
    GET /api/inspections/jh/reports/<pk>/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        import uuid
        qs = JHInspectionRecord.objects.select_related('machine', 'operator').prefetch_related('item_results', 'item_results__item')
        if pk.isdigit():
            record = qs.filter(id=int(pk)).first()
        else:
            try:
                u = uuid.UUID(pk)
                record = qs.filter(record_id=u).first()
            except ValueError:
                record = None

        if not record:
            return Response({'error': 'JH Inspection record not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = JHInspectionRecordSerializer(record)
        return Response(serializer.data, status=status.HTTP_200_OK)


class JHInspectionMatrixView(APIView):
    """
    GET /api/inspections/jh/matrix/?machine=<machine_id_or_code>&month=<YYYY-MM>
    Returns the full 31-day compliance grid with Shift I, II, III for each checklist item.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import calendar
        from datetime import datetime, date

        machine_param = request.query_params.get('machine')
        month_param = request.query_params.get('month')

        now = datetime.now()
        year = now.year
        month = now.month

        if month_param:
            try:
                parts = month_param.split('-')
                year = int(parts[0])
                month = int(parts[1])
            except Exception:
                pass

        _, days_in_month = calendar.monthrange(year, month)

        machine = None
        if machine_param:
            if machine_param.isdigit():
                machine = Machine.objects.select_related('plant', 'plant__factory').filter(id=int(machine_param)).first()
            else:
                machine = Machine.objects.select_related('plant', 'plant__factory').filter(machine_code__iexact=machine_param).first()

        if not machine:
            machine = Machine.objects.select_related('plant', 'plant__factory').first()

        # Determine shift duration from query param or machine.plant / factory
        shift_hours_param = request.query_params.get('shift_hours')
        if shift_hours_param and shift_hours_param in ('8', '12'):
            shift_hours = int(shift_hours_param)
        elif machine and machine.plant and machine.plant.shift_duration_hours:
            shift_hours = machine.plant.shift_duration_hours
        elif machine and machine.plant and machine.plant.factory and machine.plant.factory.shift_hours:
            shift_hours = machine.plant.factory.shift_hours
        else:
            shift_hours = 8

        if shift_hours == 12:
            active_shifts = ['I', 'II']
            shift_count = 2
        else:
            shift_hours = 8
            active_shifts = ['I', 'II', 'III']
            shift_count = 3

        items = list(JHChecklistItem.objects.filter(is_active=True).order_by('sort_order', 'sub_no'))
        items_data = JHChecklistItemSerializer(items, many=True).data

        matrix = {}
        for it in items:
            matrix[it.sub_no] = {}

        records_data = []

        if machine:
            start_date = date(year, month, 1)
            end_date = date(year, month, days_in_month)

            records = JHInspectionRecord.objects.filter(
                machine=machine,
                date__gte=start_date,
                date__lte=end_date
            ).select_related('operator').prefetch_related('item_results', 'item_results__item')

            for rec in records:
                day_num = rec.date.day
                shift_code = rec.shift
                col_key = f"{day_num}_{shift_code}"

                records_data.append({
                    'id': rec.id,
                    'record_id': str(rec.record_id),
                    'date': str(rec.date),
                    'day': day_num,
                    'shift': rec.shift,
                    'status': rec.status,
                    'operator_name': rec.operator.get_full_name() or rec.operator.username if rec.operator else '—',
                    'ok_items': rec.ok_items,
                    'not_ok_items': rec.not_ok_items,
                    'corrected_items': rec.corrected_items,
                })

                for res in rec.item_results.all():
                    if res.item.sub_no in matrix:
                        matrix[res.item.sub_no][col_key] = {
                            'status': res.status,
                            'remark': res.remark,
                            'action_taken': res.action_taken,
                            'operator': rec.operator.get_full_name() or rec.operator.username if rec.operator else '—',
                        }

        return Response({
            'month': f"{year:04d}-{month:02d}",
            'year': year,
            'month_num': month,
            'days_in_month': days_in_month,
            'shift_hours': shift_hours,
            'shift_count': shift_count,
            'shifts': active_shifts,
            'machine': {
                'id': machine.id if machine else None,
                'machine_code': machine.machine_code if machine else '—',
                'name': machine.name if machine else '—',
                'shift_duration_hours': shift_hours,
            } if machine else None,
            'items': items_data,
            'matrix': matrix,
            'records': records_data,
        }, status=status.HTTP_200_OK)


class JHInspectionMatrixExportExcelView(APIView):
    """
    GET /api/inspections/jh/matrix/export_excel/?machine=<id_or_code>&month=<YYYY-MM>
    Exports the official Form QF/MF-08 Jishu Hozen 31-day monitoring sheet in authentic Excel (.xlsx) format.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import datetime
        from django.http import HttpResponse
        from .jh_excel_generator import generate_jh_matrix_xlsx

        machine_param = request.query_params.get('machine')
        month_param = request.query_params.get('month')

        now = datetime.now()
        year = now.year
        month = now.month

        if month_param:
            try:
                parts = month_param.split('-')
                year = int(parts[0])
                month = int(parts[1])
            except Exception:
                pass

        machine = None
        if machine_param:
            if machine_param.isdigit():
                machine = Machine.objects.select_related('plant', 'plant__factory').filter(id=int(machine_param)).first()
            else:
                machine = Machine.objects.select_related('plant', 'plant__factory').filter(machine_code__iexact=machine_param).first()

        if not machine:
            machine = Machine.objects.select_related('plant', 'plant__factory').first()

        # Determine shift duration
        shift_hours_param = request.query_params.get('shift_hours')
        if shift_hours_param and shift_hours_param in ('8', '12'):
            shift_hours = int(shift_hours_param)
        elif machine and machine.plant and machine.plant.shift_duration_hours:
            shift_hours = machine.plant.shift_duration_hours
        elif machine and machine.plant and machine.plant.factory and machine.plant.factory.shift_hours:
            shift_hours = machine.plant.factory.shift_hours
        else:
            shift_hours = 8

        excel_buffer = generate_jh_matrix_xlsx(
            machine=machine,
            year=year,
            month=month,
            shift_hours=shift_hours,
        )

        mc_code = machine.machine_code if machine else "Machine"
        filename = f"JH_Matrix_{mc_code}_{year:04d}-{month:02d}.xlsx"

        response = HttpResponse(
            excel_buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class JHChecklistUploadParseView(APIView):
    """
    POST /api/inspections/jh/checklist/upload_parse/
    Accepts multipart/form-data with 'file' (PDF or Excel).
    Parses table checkpoints and returns structured JSON for review/preview.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .jh_checklist_parser import parse_jh_checklist_file

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No file uploaded. Please select a .pdf or .xlsx file.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            items = parse_jh_checklist_file(uploaded_file, uploaded_file.name)
            if not items:
                return Response({'error': 'No checklist items could be parsed from the uploaded file. Please check file format.'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

            return Response({
                'success': True,
                'filename': uploaded_file.name,
                'count': len(items),
                'items': items,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'Failed to parse file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class JHChecklistBulkSaveView(APIView):
    """
    POST /api/inspections/jh/checklist/bulk_save/
    Saves or replaces checklist items in the database atomically, recording version audit history.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.db import transaction
        from .models import JHChecklistItem, JHChecklistVersion

        items_data = request.data.get('items', [])
        replace_all = request.data.get('replace_all', True)
        filename = request.data.get('filename') or 'uploaded_checklist.xlsx'
        notes = request.data.get('notes') or ''

        if not items_data or not isinstance(items_data, list):
            return Response({'error': 'A list of checklist items is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Compute next version number
                last_ver = JHChecklistVersion.objects.order_by('-version_number').values_list('version_number', flat=True).first() or 0
                next_ver = last_ver + 1

                if replace_all:
                    # Deactivate existing active items and versions
                    JHChecklistVersion.objects.filter(is_active=True).update(is_active=False)
                    JHChecklistItem.objects.filter(is_active=True).update(is_active=False)

                # Create new version record
                ver_obj = JHChecklistVersion.objects.create(
                    version_number=next_ver,
                    filename=filename,
                    uploaded_by=request.user if request.user.is_authenticated else None,
                    total_items=len(items_data),
                    notes=notes,
                    is_active=True,
                )

                created_records = []
                for idx, row in enumerate(items_data, start=1):
                    sub_no = str(row.get('sub_no') or f"1.{idx}").strip()
                    assembly = str(row.get('assembly') or "General Inspection").strip()
                    sub_assembly = str(row.get('sub_assembly') or "").strip()
                    check_point = str(row.get('check_point') or "").strip()
                    standard = str(row.get('standard') or "").strip()

                    if not check_point:
                        continue

                    tool_type = str(row.get('tool_type') or 'VISUAL').upper()
                    if tool_type not in ('VISUAL', 'TOUCH', 'TOOL'):
                        tool_type = 'VISUAL'

                    item = JHChecklistItem(
                        version=ver_obj,
                        sub_no=sub_no,
                        assembly=assembly,
                        sub_assembly=sub_assembly,
                        check_point=check_point,
                        standard=standard,
                        tool_type=tool_type,
                        rank=str(row.get('rank') or 'D').strip(),
                        frequency=str(row.get('frequency') or 'D').strip(),
                        timing_sec=str(row.get('timing_sec') or '5 DPT').strip(),
                        action_clean=bool(row.get('action_clean', False)),
                        action_lubricate=bool(row.get('action_lubricate', False)),
                        action_inspect=bool(row.get('action_inspect', True)),
                        action_retighten=bool(row.get('action_retighten', False)),
                        sort_order=int(row.get('sort_order') or idx),
                        is_active=True,
                    )
                    created_records.append(item)

                JHChecklistItem.objects.bulk_create(created_records)

                # Update count
                ver_obj.total_items = len(created_records)
                ver_obj.save(update_fields=['total_items'])

            return Response({
                'success': True,
                'message': f'Successfully saved {len(created_records)} checklist items as Version v{next_ver}.',
                'version_number': next_ver,
                'count': len(created_records),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'Database save error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class JHChecklistVersionListView(APIView):
    """
    GET /api/inspections/jh/checklist/versions/
    Returns audit history of all uploaded checklist versions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import JHChecklistVersion
        versions = JHChecklistVersion.objects.select_related('uploaded_by').order_by('-version_number')
        data = []
        for v in versions:
            uploader_name = 'System'
            if v.uploaded_by:
                uploader_name = f"{v.uploaded_by.first_name} {v.uploaded_by.last_name}".strip() or v.uploaded_by.username
            data.append({
                'id': v.id,
                'version_number': v.version_number,
                'filename': v.filename,
                'uploaded_by': uploader_name,
                'uploaded_at': v.uploaded_at.isoformat(),
                'total_items': v.total_items,
                'notes': v.notes,
                'is_active': v.is_active,
            })
        return Response(data, status=status.HTTP_200_OK)


class JHChecklistVersionDetailView(APIView):
    """
    GET /api/inspections/jh/checklist/versions/<int:version_number>/
    Returns items for a specific historical checklist version.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, version_number):
        from .models import JHChecklistVersion, JHChecklistItem
        ver = JHChecklistVersion.objects.filter(version_number=version_number).first()
        if not ver:
            return Response({'error': 'Version not found.'}, status=status.HTTP_404_NOT_FOUND)

        items = JHChecklistItem.objects.filter(version=ver).order_by('sort_order', 'sub_no')
        items_data = [{
            'id': it.id,
            'sub_no': it.sub_no,
            'assembly': it.assembly,
            'sub_assembly': it.sub_assembly,
            'check_point': it.check_point,
            'standard': it.standard,
            'tool_type': it.tool_type,
            'rank': it.rank,
            'frequency': it.frequency,
            'timing_sec': it.timing_sec,
            'sort_order': it.sort_order,
        } for it in items]

        return Response({
            'version_number': ver.version_number,
            'filename': ver.filename,
            'is_active': ver.is_active,
            'total_items': len(items_data),
            'items': items_data,
        }, status=status.HTTP_200_OK)


class JHChecklistVersionRestoreView(APIView):
    """
    POST /api/inspections/jh/checklist/versions/<int:version_number>/restore/
    Rolls back / restores a previous checklist version as active.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, version_number):
        from django.db import transaction
        from .models import JHChecklistVersion, JHChecklistItem

        ver = JHChecklistVersion.objects.filter(version_number=version_number).first()
        if not ver:
            return Response({'error': 'Version not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                # Deactivate all
                JHChecklistVersion.objects.filter(is_active=True).update(is_active=False)
                JHChecklistItem.objects.filter(is_active=True).update(is_active=False)

                # Activate selected version and its items
                ver.is_active = True
                ver.save(update_fields=['is_active'])

                JHChecklistItem.objects.filter(version=ver).update(is_active=True)

            return Response({
                'success': True,
                'message': f'Version v{version_number} ({ver.filename}) has been restored as the active checklist.',
                'version_number': ver.version_number,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'Failed to restore version: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class JHChecklistTemplateDownloadView(APIView):
    """
    GET /api/inspections/jh/checklist/template/
    Downloads blank Form QF/MF-08 Excel template.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.http import HttpResponse
        from .jh_checklist_parser import generate_jh_template_xlsx

        buf = generate_jh_template_xlsx()
        response = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response['Content-Disposition'] = 'attachment; filename="JH_Checklist_Template_Form_QF_MF_08.xlsx"'
        return response










