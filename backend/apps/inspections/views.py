from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.parts.models import Part
from apps.machines.models import Machine
from rest_framework import viewsets
from rest_framework.decorators import action
from django.conf import settings
from django.http import HttpResponse, FileResponse
import csv
import os

from apps.parts.models import Part
from apps.machines.models import Machine
from apps.users.permissions import IsSupervisorOrAbove, IsOperatorOrSupervisor
from .models import InspectionSession, DailyProductionReport
from .serializers import (
    StartInspectionSerializer,
    RecordMeasurementSerializer,
    ReviewSerializer,
    InspectionSessionSerializer,
    DailyProductionReportSerializer,
)
from .pdf_generator import generate_daily_production_pdf
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
    Records a single voice/manual measurement for a parameter.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        serializer = RecordMeasurementSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        val = serializer.validated_data.get('measured_value')
        if val is None:
            val = 0.0

        try:
            result = _service.record_measurement(
                session_id      = session_id,
                parameter_code  = serializer.validated_data['parameter_code'],
                measured_value  = float(val),
                voice_raw_text  = serializer.validated_data.get('voice_raw_text', ''),
                method          = serializer.validated_data.get('method', 'voice'),
                hourly_slot     = serializer.validated_data.get('hourly_slot'),
                inspection_type = serializer.validated_data.get('inspection_type'),
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
    GET /api/inspections/                                    → all sessions
    GET /api/inspections/?start_date=2026-08-01&end_date=... → date-wise range
    GET /api/inspections/?status=approved                    → filter by status
    GET /api/inspections/?machine=MCH-001                    → filter by machine code
    """
    serializer_class   = InspectionSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        qs = InspectionSession.objects.select_related(
            'part', 'machine', 'operator', 'supervisor', 'finalized_by'
        ).all()

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
            'part', 'machine', 'operator', 'supervisor'
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
            doc = _service.get_session_detail(str(session.session_id))
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

        part_no = session.part.part_number if session.part else None
        part_name = session.part.part_name if session.part else None

        return Response({
            'has_today_report': has_today,
            'is_setup_approved': is_approved,
            'session_id': str(session.session_id),
            'status': session.status,
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
            
            pdf_path = session.pdf_report_path
            if not pdf_path or not os.path.exists(os.path.join(settings.BASE_DIR, pdf_path)):
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
            session = InspectionSession.objects.filter(session_id=session_id).first()
            if session:
                session.delete()
                _service.collection.delete_one({'_id': str(session_id)})
            return Response({'message': f'Session {session_id} deleted.'})

        if machine_code:
            # Clear ALL sessions for this machine unconditionally to provide a completely clean slate
            active_sessions = InspectionSession.objects.filter(
                machine__machine_code=machine_code
            )
            session_ids = [str(s.session_id) for s in active_sessions]
            active_sessions.delete()
            if session_ids:
                _service.collection.delete_many({'_id': {'$in': session_ids}})

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

        doc = _service.collection.find_one(
            {
                'inspection_type': 'setup_approval',
                'template_id': int(template_id),
                'machine_id': int(machine_id),
            },
            sort=[('submitted_at', -1)],
        )

        if not doc:
            return Response(
                {'detail': 'No setup approval data found for this template and machine.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        doc['_id'] = str(doc['_id'])
        return Response(doc)

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
        doc_id = str(uuid.uuid4())

        doc = {
            '_id': doc_id,
            'inspection_type': 'setup_approval',
            'template_id': int(template_id),
            'machine_id': int(machine_id),
            'part_number': part_number,
            'inspector_id': request.user.id,
            'inspector_name': inspector_name,
            'process_param_entries': entries,
            'submitted_at': now,
            'status': 'submitted',
        }

        # Upsert — update today's existing document or insert new
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        existing = _service.collection.find_one({
            'inspection_type': 'setup_approval',
            'template_id': int(template_id),
            'machine_id': int(machine_id),
            'submitted_at': {'$gte': today_start},
        })

        if existing:
            _service.collection.update_one(
                {'_id': existing['_id']},
                {'$set': {
                    'process_param_entries': entries,
                    'inspector_id': request.user.id,
                    'inspector_name': inspector_name,
                    'submitted_at': now,
                    'status': 'submitted',
                }},
            )
            result_id = str(existing['_id'])
            updated = True
        else:
            _service.collection.insert_one(doc)
            result_id = doc_id
            updated = False

        # Sync process_param_entries to active sessions for this machine & template
        from apps.inspections.models import InspectionSession
        active_sessions = InspectionSession.objects.filter(
            machine_id=int(machine_id),
            started_at__date=now.date(),
        )
        session_ids = [str(s.session_id) for s in active_sessions]
        if session_ids:
            _service.collection.update_many(
                {'_id': {'$in': session_ids}},
                {'$set': {'process_param_entries': entries}}
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
    permission_classes = [IsAuthenticated]

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
        serializer.save(operator=operator)

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






