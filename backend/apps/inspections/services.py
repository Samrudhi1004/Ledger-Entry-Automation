"""
Validation Engine + Inspection Service.

ToleranceValidator  — checks if a measured value is within tolerance.
InspectionService   — orchestrates session creation, measurement recording,
                      MongoDB document management, and WebSocket notifications.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from config.db import get_collection, Collections
from apps.parts.models import InspectionParameter, InspectionTemplate
from .models import InspectionSession


# ─── Validation Result ────────────────────────────────────────────────────
@dataclass
class ValidationResult:
    measured_value: float
    nominal:        float
    upper_limit:    float
    lower_limit:    float
    status:         str           # 'ok' | 'out_of_spec'
    deviation:      float         # measured - nominal
    is_critical:    bool
    message:        str


# ─── Tolerance Validator ──────────────────────────────────────────────────
class ToleranceValidator:
    """
    Validates a measured numeric value against an InspectionParameter's tolerance.
    """

    def validate(self, measured_value: float, parameter: InspectionParameter) -> ValidationResult:
        nominal      = float(parameter.nominal_value)
        upper_limit  = float(parameter.upper_limit)
        lower_limit  = float(parameter.lower_limit)
        deviation    = round(measured_value - nominal, 6)

        is_within = lower_limit <= measured_value <= upper_limit
        status    = 'ok' if is_within else 'out_of_spec'

        if is_within:
            message = f'Value {measured_value} {parameter.unit} is within specification.'
        else:
            direction = 'above' if measured_value > upper_limit else 'below'
            message   = (
                f'Value {measured_value} {parameter.unit} is {direction} specification. '
                f'Allowed: [{lower_limit}, {upper_limit}] {parameter.unit}'
            )

        return ValidationResult(
            measured_value = measured_value,
            nominal        = nominal,
            upper_limit    = upper_limit,
            lower_limit    = lower_limit,
            status         = status,
            deviation      = deviation,
            is_critical    = parameter.is_critical and not is_within,
            message        = message,
        )


# ─── Inspection Service ───────────────────────────────────────────────────
class InspectionService:
    """
    Orchestrates the full inspection workflow:
    1. Create session (PostgreSQL + MongoDB)
    2. Record measurements (MongoDB + PostgreSQL counters)
    3. Validate against tolerances
    4. Push WebSocket events
    5. Complete / review session
    """

    def __init__(self):
        self.validator  = ToleranceValidator()
        self.collection = get_collection(Collections.INSPECTION_RECORDS)

    # ── Create Session ────────────────────────────────────────────────────
    def create_session(
        self,
        part,
        machine,
        operator,
        inspection_type: str,
        shift: str,
        supervisor=None,
        template_id=None,
        trial_number: int = 1,
        parent_session_id: str = None,
    ) -> InspectionSession:
        """
        Creates a PostgreSQL InspectionSession + initialises MongoDB document.
        """
        # Get the specific template by template_id, or fall back to first active match
        if template_id:
            template = InspectionTemplate.objects.prefetch_related('parameters').get(
                pk=template_id,
                is_active=True,
            )
        else:
            template = InspectionTemplate.objects.prefetch_related('parameters').filter(
                part=part,
                inspection_type=inspection_type,
                is_active=True,
            ).first()

        if not template:
            raise ValueError("No active inspection template found.")
        parameters     = list(template.parameters.order_by('sequence_order'))
        total_params   = len(parameters)
        session_id     = uuid.uuid4()

        parent_session = None
        if parent_session_id:
            parent_session = InspectionSession.objects.filter(session_id=parent_session_id).first()

        # 1. Create PostgreSQL session using actual template inspection type
        session = InspectionSession.objects.create(
            session_id      = session_id,
            part            = part,
            machine         = machine,
            operator        = operator,
            supervisor      = supervisor,
            inspection_type = template.inspection_type,
            shift           = shift,
            trial_number    = trial_number,
            parent_session  = parent_session,
            total_parameters = total_params,
        )

        # 2. Initialise MongoDB document
        mongo_doc = {
            '_id':                 str(session_id),
            'session_id':          str(session_id),
            'part_number':         part.part_number,
            'part_name':           part.part_name,
            'machine_code':        machine.machine_code,
            'plant_id':            machine.plant_id,
            'operator_id':         operator.id,
            'operator_name':       operator.get_full_name(),
            'supervisor_id':       supervisor.id if supervisor else None,
            'inspection_type':     template.inspection_type,
            'shift':               shift,
            'status':              'in_progress',
            'trial_number':        trial_number,
            'parent_session_id':   parent_session_id,
            'started_at':          datetime.now(timezone.utc),
            'completed_at':        None,
            'measurements':        [],
            'supervisor_remark':   '',
            'approved_at':         None,
            # Initialise empty slots for each parameter
            'parameter_summary': [
                {
                    'parameter_code': p.parameter_code,
                    'parameter_name': p.parameter_name,
                    'unit':           p.unit,
                    'nominal':        float(p.nominal_value),
                    'upper_limit':    float(p.upper_limit),
                    'lower_limit':    float(p.lower_limit),
                    'is_critical':    p.is_critical,
                    'status':         'pending',
                }
                for p in parameters
            ],
        }
        self.collection.insert_one(mongo_doc)

        return session

    # ── Record Measurement ────────────────────────────────────────────────
    def record_measurement(
        self,
        session_id: str,
        parameter_code: str,
        measured_value: float,
        voice_raw_text: str = '',
        audio_file_path: str = '',
        method: str = 'voice',       # 'voice' | 'manual'
    ) -> dict:
        """
        Records a single measurement for a parameter.
        - Validates against tolerance
        - Saves to MongoDB
        - Updates PostgreSQL counters
        - Pushes WebSocket event to dashboard
        """
        # Fetch session
        session = InspectionSession.objects.select_related(
            'part', 'machine'
        ).get(session_id=session_id)

        # Fetch parameter safely by part and parameter code across active templates
        parameter = InspectionParameter.objects.filter(
            template__part=session.part,
            parameter_code=parameter_code,
            template__is_active=True,
        ).first()

        if not parameter:
            raise ValueError(f"Parameter '{parameter_code}' not found for part {session.part.part_number}.")

        # Validate
        result = self.validator.validate(measured_value, parameter)

        # Build measurement document
        measurement = {
            'parameter_code':  parameter_code,
            'parameter_name':  parameter.parameter_name,
            'unit':            parameter.unit,
            'nominal':         float(parameter.nominal_value),
            'upper_limit':     float(parameter.upper_limit),
            'lower_limit':     float(parameter.lower_limit),
            'measured_value':  measured_value,
            'deviation':       result.deviation,
            'status':          result.status,
            'is_critical_fail': result.is_critical,
            'voice_raw_text':  voice_raw_text,
            'audio_file_path': audio_file_path,
            'method':          method,
            'recorded_at':     datetime.now(timezone.utc),
        }

        # Update MongoDB document
        self.collection.update_one(
            {'_id': str(session_id)},
            {
                '$push': {'measurements': measurement},
                '$set': {
                    f'parameter_summary.$[param].status': result.status,
                    f'parameter_summary.$[param].measured_value': measured_value,
                }
            },
            array_filters=[{'param.parameter_code': parameter_code}],
        )

        # Update PostgreSQL counters and reminder timestamps
        from django.utils import timezone as django_timezone
        now_dt = django_timezone.now()
        update_fields = {
            'recorded_count': session.recorded_count + 1,
            'last_measurement_at': now_dt,
            'operator_reminded': False,
            'supervisor_escalated': False,
        }
        if result.status == 'out_of_spec':
            update_fields['has_ooc'] = True
        if result.is_critical:
            update_fields['has_critical_fail'] = True

        for field, value in update_fields.items():
            setattr(session, field, value)
        session.save(update_fields=list(update_fields.keys()))

        # Push WebSocket event
        self._push_measurement_event(session, parameter, result, measured_value)

        return {
            'parameter_code': parameter_code,
            'measured_value': measured_value,
            'status':         result.status,
            'deviation':      result.deviation,
            'message':        result.message,
            'is_critical':    result.is_critical,
            'progress':       session.progress_percent,
        }

    # ── Complete Session ──────────────────────────────────────────────────
    def complete_session(self, session_id: str) -> InspectionSession:
        """Marks session as pending supervisor review."""
        session = InspectionSession.objects.get(session_id=session_id)
        now = datetime.now(timezone.utc)

        session.status       = InspectionSession.Status.PENDING_REVIEW
        session.completed_at = now
        session.save(update_fields=['status', 'completed_at'])

        self.collection.update_one(
            {'_id': str(session_id)},
            {'$set': {'status': 'pending_review', 'completed_at': now}},
        )

        self._push_session_event(session, 'session_completed')
        return session

    # ── Supervisor Review ─────────────────────────────────────────────────
    def review_session(
        self,
        session_id: str,
        action: str,          # 'approve' | 'reject'
        supervisor,
        remark: str = '',
    ) -> InspectionSession:
        """Supervisor approves or rejects an inspection session."""
        session = InspectionSession.objects.get(session_id=session_id)
        now     = datetime.now(timezone.utc)

        new_status = (
            InspectionSession.Status.APPROVED
            if action == 'approve'
            else InspectionSession.Status.REJECTED
        )

        session.status            = new_status
        session.supervisor        = supervisor
        session.supervisor_remark = remark
        if action == 'reject':
            session.rejection_reason = remark
        session.reviewed_at       = now
        session.save(update_fields=['status', 'supervisor', 'supervisor_remark', 'rejection_reason', 'reviewed_at'])

        self.collection.update_one(
            {'_id': str(session_id)},
            {'$set': {
                'status':             new_status,
                'supervisor_id':      supervisor.id,
                'supervisor_remark':  remark,
                'rejection_reason':   remark if action == 'reject' else '',
                'approved_at':        now if action == 'approve' else None,
            }},
        )

        if action == 'reject':
            self._push_rejection_alert(session, remark)
        else:
            self._push_session_event(session, 'supervisor_action')

        return session

    # ── Get Full Document ─────────────────────────────────────────────────
    def get_session_document(self, session_id: str) -> Optional[dict]:
        """Retrieve full inspection document from MongoDB."""
        doc = self.collection.find_one({'_id': str(session_id)})
        if doc:
            doc['_id'] = str(doc['_id'])
        return doc

    # ── WebSocket Push ────────────────────────────────────────────────────
    def _push_measurement_event(self, session, parameter, result, value):
        channel_layer = get_channel_layer()
        group_name    = f"plant_{session.machine.plant_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type':           'inspection.event',
                'event':          'measurement_recorded',
                'session_id':     str(session.session_id),
                'machine_code':   session.machine.machine_code,
                'parameter_code': parameter.parameter_code,
                'parameter_name': parameter.parameter_name,
                'measured_value': value,
                'status':         result.status,
                'is_critical':    result.is_critical,
                'progress':       session.progress_percent,
            },
        )

    def _push_session_event(self, session, event_type: str):
        channel_layer = get_channel_layer()
        group_name    = f"plant_{session.machine.plant_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type':          'inspection.event',
                'event':         event_type,
                'session_id':    str(session.session_id),
                'machine_code':  session.machine.machine_code,
                'status':        session.status,
                'has_ooc':       session.has_ooc,
                'trial_number':  session.trial_number,
            },
        )

    def _push_rejection_alert(self, session, remark: str):
        channel_layer = get_channel_layer()
        group_name    = f"plant_{session.machine.plant_id}"
        next_trial    = min(session.trial_number + 1, 3)
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type':               'inspection.event',
                'event':              'rejection_alert',
                'session_id':         str(session.session_id),
                'trial_number':       session.trial_number,
                'next_trial_number':  next_trial,
                'machine_code':       session.machine.machine_code,
                'part_number':        session.part.part_number,
                'operator_id':        session.operator_id,
                'supervisor_remark':  remark,
                'status':             session.status,
            },
        )
