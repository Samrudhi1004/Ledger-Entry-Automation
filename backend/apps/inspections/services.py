"""
Validation Engine + Inspection Service.

ToleranceValidator  — checks if a measured value is within tolerance.
InspectionService   — orchestrates session creation, measurement recording,
                      MongoDB document management, and WebSocket notifications.
"""

import logging
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from django.core.cache import cache
from django.db.models import F
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from config.db import get_collection, Collections
from apps.parts.models import InspectionParameter, InspectionTemplate, ProcessParameter
from .models import InspectionSession

logger = logging.getLogger(__name__)


def _dispatch_async_websocket(group_name: str, payload: dict):
    """Sends WebSocket group message in a background thread to prevent blocking HTTP response."""
    def _send():
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(group_name, payload)
        except Exception as exc:
            logger.warning("Failed to dispatch WebSocket event in background thread: %s", exc)

    threading.Thread(target=_send, daemon=True).start()


def _get_cached_parameter(part_id: int, parameter_code: str):
    """Retrieves InspectionParameter from Redis cache (1 hour timeout) or DB."""
    cache_key = f"param_spec_{part_id}_{parameter_code}"
    cached_param = cache.get(cache_key)
    if cached_param is not None:
        return cached_param

    param = InspectionParameter.objects.filter(
        template__part_id=part_id,
        parameter_code=parameter_code,
        template__is_active=True,
    ).first()

    if param:
        cache.set(cache_key, param, timeout=3600)
    return param


def _get_cached_process_parameter(part_id: int, parameter_code: str):
    """Retrieves ProcessParameter from Redis cache (1 hour timeout) or DB."""
    cache_key = f"proc_param_spec_{part_id}_{parameter_code}"
    cached_proc_param = cache.get(cache_key)
    if cached_proc_param is not None:
        return cached_proc_param

    proc_param = ProcessParameter.objects.filter(
        template__part_id=part_id,
        parameter_code=parameter_code,
        template__is_active=True,
    ).first()

    if proc_param:
        cache.set(cache_key, proc_param, timeout=3600)
    return proc_param


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
    Applies the 3 Mechanical Rules while preserving original DB spec values.
    """

    def validate(self, measured_value: float, parameter: InspectionParameter) -> ValidationResult:
        nominal      = float(parameter.nominal_value)
        upper_limit  = float(parameter.upper_limit)
        lower_limit  = float(parameter.lower_limit)
        deviation    = round(measured_value - nominal, 6)

        m_type = (parameter.measurement_type or '').lower()
        p_code = (parameter.parameter_code or '').upper()
        p_name = (parameter.parameter_name or '').upper()

        if m_type == 'visual':
            # Rule 2: Visual Pass/Fail Check (1.0 = PASS / YES, 0.0 = REJECT / NO)
            is_within = measured_value >= 0.5
            message = 'Visual Inspection PASSED (YES).' if is_within else 'Visual Inspection REJECTED (NO).'
        elif m_type == 'min_limit' or 'MIN' in p_name:
            # Rule 3A: Minimum Threshold (Any value >= nominal or lower_limit is OK)
            min_bound = nominal if nominal > 0 else lower_limit
            is_within = measured_value >= min_bound
            message = (
                f'Value {measured_value} {parameter.unit} meets minimum limit of {min_bound} {parameter.unit}.'
                if is_within
                else f'Value {measured_value} {parameter.unit} is below minimum limit of {min_bound} {parameter.unit}.'
            )
        elif m_type in ['max_limit', 'surface'] or 'MAX' in p_name:
            # Rule 3B: Maximum Threshold (Any roughness <= nominal is OK)
            max_bound = nominal if nominal > 0 else upper_limit
            is_within = measured_value <= max_bound
            message = (
                f'Measurement {measured_value} {parameter.unit} is within maximum allowed {max_bound} {parameter.unit}.'
                if is_within
                else f'Measurement {measured_value} {parameter.unit} exceeds maximum allowed {max_bound} {parameter.unit}.'
            )
        else:
            # Rule 1: Specific Limits Range
            is_within = lower_limit <= measured_value <= upper_limit
            if is_within:
                message = f'Value {measured_value} {parameter.unit} is within specification.'
            else:
                direction = 'above' if measured_value > upper_limit else 'below'
                message   = (
                    f'Value {measured_value} {parameter.unit} is {direction} specification. '
                    f'Allowed: [{lower_limit}, {upper_limit}] {parameter.unit}'
                )

        status = 'ok' if is_within else 'out_of_spec'

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
        inspection_type: str = 'first_piece',
        shift: str = 'A',
        supervisor=None,
        template_id=None,
        trial_number: int = 1,
        parent_session_id: str = None,
        hourly_slot: int = 1,
    ) -> InspectionSession:
        """
        Creates a PostgreSQL InspectionSession + initialises MongoDB document.
        """
        actual_inspection_type = inspection_type or 'first_piece'

        # Validate trial number max 3 for first_piece
        if actual_inspection_type == 'first_piece' and trial_number > 3:
            raise ValueError("First Piece Inspection is limited to a maximum of 3 attempts (1st PC #1, #2, #3).")

        # Get the specific template by template_id, or fall back to first active match
        if template_id:
            template = InspectionTemplate.objects.prefetch_related('parameters', 'process_parameters').get(
                pk=template_id,
                is_active=True,
            )
        else:
            template = InspectionTemplate.objects.prefetch_related('parameters', 'process_parameters').filter(
                part=part,
                inspection_type=actual_inspection_type,
                is_active=True,
            ).first()

            if not template:
                template = InspectionTemplate.objects.prefetch_related('parameters', 'process_parameters').filter(
                    part=part,
                    is_active=True,
                ).first()

        if not template:
            raise ValueError("No active inspection template found.")

        parameters         = list(template.parameters.order_by('sequence_order'))
        process_parameters = list(template.process_parameters.filter(is_active=True).order_by('sequence_order')) if actual_inspection_type == 'first_piece' else []
        total_params       = len(parameters)

        # Reuse existing active session for today (same machine, part, shift, trial) if present
        from django.utils import timezone as django_tz
        today = django_tz.now().date()
        filter_kwargs = {
            'machine': machine,
            'part': part,
            'shift': shift,
            'started_at__date': today,
            'inspection_type': actual_inspection_type,
        }
        if actual_inspection_type == 'first_piece':
            filter_kwargs['trial_number'] = trial_number
        elif actual_inspection_type == 'hourly':
            filter_kwargs['hourly_unlocked_slot'] = hourly_slot

        existing_session = InspectionSession.objects.filter(**filter_kwargs).order_by('-started_at').first()

        if existing_session and not (actual_inspection_type == 'first_piece' and trial_number > 1 and not parent_session_id):
            return existing_session

        session_id     = uuid.uuid4()

        parent_session = None
        initial_measurements = []
        rejected_codes = set()

        if parent_session_id and str(parent_session_id).strip():
            clean_parent_id = str(parent_session_id).strip()
            try:
                parent_uuid = uuid.UUID(clean_parent_id)
                parent_session = InspectionSession.objects.filter(session_id=parent_uuid).first()
            except (ValueError, TypeError, AttributeError):
                parent_session = None

            if parent_session:
                parent_doc = self.collection.find_one({'_id': str(parent_session.session_id)})
                if parent_doc:
                    rejected_list = parent_doc.get('rejected_parameters') or []
                    if rejected_list:
                        rejected_codes = set(rejected_list)
                    else:
                        for p_sum in parent_doc.get('parameter_summary', []):
                            if p_sum.get('status') == 'out_of_spec':
                                rejected_codes.add(p_sum.get('parameter_code'))

                    parent_measurements = parent_doc.get('measurements', [])
                    for m in parent_measurements:
                        code = m.get('parameter_code')
                        if code and code not in rejected_codes and m.get('status') == 'ok':
                            m_copy = dict(m)
                            m_copy['carried_forward'] = True
                            initial_measurements.append(m_copy)

        initial_recorded_count = len(initial_measurements)

        # 1. Create PostgreSQL session
        session = InspectionSession.objects.create(
            session_id           = session_id,
            part                 = part,
            machine              = machine,
            operator             = operator,
            supervisor           = supervisor,
            template             = template,
            inspection_type      = actual_inspection_type,
            shift                = shift,
            trial_number         = trial_number,
            hourly_unlocked_slot = hourly_slot if actual_inspection_type == 'hourly' else 0,
            parent_session       = parent_session,
            total_parameters     = total_params,
            recorded_count       = initial_recorded_count,
        )

        carried_map = {m['parameter_code']: m for m in initial_measurements}
        param_summary_list = []

        for p in parameters:
            code = p.parameter_code
            tech = p.measurement_technique or 'VERNIER CALIPER'
            samp = p.sample_size or '5NOS/SHIFT'

            if code in carried_map:
                param_summary_list.append({
                    'parameter_code':        code,
                    'parameter_name':        p.parameter_name,
                    'unit':                  p.unit,
                    'nominal':               float(p.nominal_value),
                    'upper_limit':           float(p.upper_limit),
                    'lower_limit':           float(p.lower_limit),
                    'is_critical':           p.is_critical,
                    'measurement_technique': tech,
                    'evaluation_technique':  tech,
                    'sample_size':           samp,
                    'sample_frequency':      samp,
                    'status':                'ok',
                    'measured_value':        carried_map[code].get('measured_value'),
                    'carried_forward':       True,
                })
            else:
                param_summary_list.append({
                    'parameter_code':        code,
                    'parameter_name':        p.parameter_name,
                    'unit':                  p.unit,
                    'nominal':               float(p.nominal_value),
                    'upper_limit':           float(p.upper_limit),
                    'lower_limit':           float(p.lower_limit),
                    'is_critical':           p.is_critical,
                    'measurement_technique': tech,
                    'evaluation_technique':  tech,
                    'sample_size':           samp,
                    'sample_frequency':      samp,
                    'status':                'pending',
                })

        proc_param_summary_list = []
        if actual_inspection_type == 'first_piece':
            for pp in process_parameters:
                proc_param_summary_list.append({
                    'parameter_code':        pp.parameter_code,
                    'parameter_name':        pp.parameter_name,
                    'data_type':             pp.data_type,
                    'unit':                  pp.unit or '',
                    'specification':         pp.specification or '',
                    'nominal':               float(pp.nominal_value) if pp.nominal_value is not None else None,
                    'upper_limit':           float(pp.upper_limit) if pp.upper_limit is not None else None,
                    'lower_limit':           float(pp.lower_limit) if pp.lower_limit is not None else None,
                    'is_required':           pp.is_required,
                    'status':                'pending',
                    'is_process_parameter':  True,
                })

        # Resolve operation name: use template.name if set, else fall back to
        # inspection_type display label so the dashboard always shows a meaningful name.
        insp_type_labels = {
            'first_piece': '1st Piece Cum In-Process Inspection',
            'hourly':      'Hourly In-Process Inspection',
            'final':       'Final Inspection',
            'setup_approval': 'Setup Approval',
        }
        operation_name = (
            template.name.strip()
            if template and template.name and template.name.strip()
            else insp_type_labels.get(actual_inspection_type, actual_inspection_type.replace('_', ' ').title())
        )

        # 2. Initialise MongoDB document
        mongo_doc = {
            '_id':                       str(session_id),
            'session_id':                str(session_id),
            'part_number':               part.part_number,
            'part_name':                 part.part_name,
            'machine_code':              machine.machine_code,
            'plant_id':                  machine.plant_id,
            'operator_id':               operator.id,
            'operator_name':             operator.get_full_name(),
            'supervisor_id':             supervisor.id if supervisor else None,
            'inspection_type':           actual_inspection_type,
            'template_id':               template.pk if template else None,
            'operation_name':            operation_name,
            'hourly_slot':               hourly_slot if actual_inspection_type == 'hourly' else 0,
            'shift':                     shift,
            'status':                    'in_progress',
            'trial_number':              trial_number,
            'parent_session_id':         parent_session_id,
            'started_at':                datetime.now(timezone.utc),
            'completed_at':              None,
            'measurements':              initial_measurements,
            'supervisor_remark':         '',
            'approved_at':               None,
            'parameter_summary':         param_summary_list,
            'process_parameter_summary': proc_param_summary_list,
        }
        self.collection.insert_one(mongo_doc)

        self._push_session_event(session, 'session_started')
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
        hourly_slot: int = None,
        inspection_type: str = None,
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

        # Fetch parameter safely from Redis cache or DB by part_id and parameter_code
        parameter = _get_cached_parameter(session.part_id, parameter_code)

        process_parameter = None
        if not parameter:
            process_parameter = _get_cached_process_parameter(session.part_id, parameter_code)

        if not parameter and not process_parameter:
            raise ValueError(f"Parameter '{parameter_code}' not found for part {session.part.part_number}.")

        current_slot = hourly_slot if (hourly_slot is not None and hourly_slot > 0) else (session.hourly_unlocked_slot or 1)

        # Determine measurement classification:
        # Operator entries -> hourly (1/HR through 8/HR)
        # Inspector entries -> first_piece (1ST PC #1, 1ST PC #2, 1ST PC #3)
        if inspection_type == 'first_piece' or (not inspection_type and session.inspection_type == 'first_piece' and (hourly_slot is None or hourly_slot == 0)):
            meas_type = 'first_piece'
            meas_trial = session.trial_number or 1
            meas_slot = 0
        else:
            meas_type = 'hourly'
            meas_slot = current_slot if current_slot > 0 else 1
            meas_trial = 0

        # Check existing measurement in MongoDB for this specific slot/trial & parameter
        existing_idx = None
        doc = self.collection.find_one({'_id': str(session_id)})
        if doc and 'measurements' in doc:
            for idx, m in enumerate(doc['measurements']):
                m_type = m.get('inspection_type') or ('first_piece' if (m.get('trial_number') or 0) > 0 else 'hourly')
                if m.get('parameter_code') == parameter_code:
                    if meas_type == 'first_piece' and m_type == 'first_piece' and (m.get('trial_number') or 1) == meas_trial:
                        existing_idx = idx
                        break
                    elif meas_type == 'hourly' and m_type == 'hourly' and m.get('hourly_slot') == meas_slot:
                        existing_idx = idx
                        break

        # Handle Process Parameter measurement recording & validation
        if process_parameter:
            dt = process_parameter.data_type
            mtype = (process_parameter.measurement_type or '').lower()
            status_val = 'ok'
            dev = 0.0
            msg = f"Process parameter '{process_parameter.parameter_name}' recorded."
            is_crit = False

            if dt == 'numeric':
                num_val = float(measured_value) if measured_value is not None else 0.0
                nom = float(process_parameter.nominal_value) if process_parameter.nominal_value is not None else 0.0
                dev = round(num_val - nom, 6)
                ll = float(process_parameter.lower_limit) if process_parameter.lower_limit is not None else None
                ul = float(process_parameter.upper_limit) if process_parameter.upper_limit is not None else None

                if mtype == 'visual':
                    is_within = num_val >= 0.5
                    msg = 'Visual Inspection PASSED (YES).' if is_within else 'Visual Inspection REJECTED (NO).'
                elif mtype == 'min_limit' or 'MIN' in (process_parameter.parameter_name or '').upper():
                    min_bound = nom if nom > 0 else (ll if ll is not None else 0.0)
                    is_within = num_val >= min_bound
                    msg = f"Value {num_val} {process_parameter.unit} meets minimum limit of {min_bound}." if is_within else f"Value {num_val} {process_parameter.unit} is below minimum limit of {min_bound}."
                elif mtype in ['max_limit', 'surface'] or 'MAX' in (process_parameter.parameter_name or '').upper():
                    max_bound = nom if nom > 0 else (ul if ul is not None else 99999.0)
                    is_within = num_val <= max_bound
                    msg = f"Measurement {num_val} {process_parameter.unit} is within maximum allowed {max_bound}." if is_within else f"Measurement {num_val} {process_parameter.unit} exceeds maximum allowed {max_bound}."
                else:
                    # Dimensional / Weight / Range
                    if ll is not None and ul is not None:
                        is_within = ll <= num_val <= ul
                    else:
                        is_within = True
                    msg = f"Value {num_val} {process_parameter.unit} is within specification." if is_within else f"Value {num_val} {process_parameter.unit} is outside specification."

                status_val = 'ok' if is_within else 'out_of_spec'
            elif dt == 'yes_no':
                str_val = str(voice_raw_text or measured_value or '').strip().upper()
                exp_val = (process_parameter.specification or 'YES').strip().upper()
                if str_val not in [exp_val, 'YES', '1', 'TRUE', 'OK', 'PASS']:
                    status_val = 'out_of_spec'
                    msg = f"Value '{str_val}' does not match expected '{exp_val}'."
            elif dt in ['text', 'selection']:
                str_val = str(voice_raw_text or measured_value or '').strip()
                if process_parameter.specification:
                    exp_val = process_parameter.specification.strip()
                    if str_val.lower() != exp_val.lower():
                        status_val = 'out_of_spec'
                        msg = f"Value '{str_val}' does not match expected '{exp_val}'."

            measurement = {
                'parameter_code':        parameter_code,
                'parameter_name':        process_parameter.parameter_name,
                'unit':                  process_parameter.unit,
                'nominal':               float(process_parameter.nominal_value) if process_parameter.nominal_value is not None else None,
                'upper_limit':           float(process_parameter.upper_limit) if process_parameter.upper_limit is not None else None,
                'lower_limit':           float(process_parameter.lower_limit) if process_parameter.lower_limit is not None else None,
                'measured_value':        measured_value,
                'deviation':             dev,
                'status':                status_val,
                'is_critical_fail':      is_crit,
                'is_process_parameter':  True,
                'voice_raw_text':        voice_raw_text,
                'audio_file_path':       audio_file_path,
                'method':                method,
                'inspection_type':       meas_type,
                'trial_number':          meas_trial,
                'hourly_slot':           meas_slot,
                'recorded_at':           datetime.now(timezone.utc),
            }

            if existing_idx is not None:
                self.collection.update_one(
                    {'_id': str(session_id)},
                    {
                        '$set': {
                            f'measurements.{existing_idx}': measurement,
                            'process_parameter_summary.$[param].status': status_val,
                            'process_parameter_summary.$[param].measured_value': measured_value,
                        }
                    },
                    array_filters=[{'param.parameter_code': parameter_code}],
                )
            else:
                self.collection.update_one(
                    {'_id': str(session_id)},
                    {
                        '$push': {'measurements': measurement},
                        '$set': {
                            'process_parameter_summary.$[param].status': status_val,
                            'process_parameter_summary.$[param].measured_value': measured_value,
                        }
                    },
                    array_filters=[{'param.parameter_code': parameter_code}],
                )

            # Auto-sync reading into process_param_entries for Setup Approval Report atomically
            t_num = meas_trial if (meas_trial >= 1 and meas_trial <= 3) else 1
            t_key = f"trial_{t_num}"
            entry_val = str(voice_raw_text or measured_value or '').strip()

            update_res = self.collection.update_one(
                {'_id': str(session_id), 'process_param_entries.parameter_code': parameter_code},
                {'$set': {f'process_param_entries.$.{t_key}': entry_val}}
            )
            if update_res.matched_count == 0:
                self.collection.update_one(
                    {'_id': str(session_id)},
                    {'$push': {'process_param_entries': {
                        'parameter_code': parameter_code,
                        'parameter_name': process_parameter.parameter_name,
                        'specification': process_parameter.specification or '',
                        t_key: entry_val,
                    }}}
                )

            # Push WebSocket event for Process Parameter
            self._push_process_param_event(
                session, process_parameter, status_val, measured_value,
                voice_raw_text=voice_raw_text, method=method,
                meas_type=meas_type, meas_trial=meas_trial, meas_slot=meas_slot,
            )

            return {
                'parameter_code': parameter_code,
                'measured_value': measured_value,
                'status':         status_val,
                'deviation':      dev,
                'message':        msg,
                'is_critical':    is_crit,
                'progress':       session.progress_percent,
            }

        # Check hourly authorization
        if session.inspection_type == 'hourly' or current_slot > 0:
            first_piece_active = InspectionSession.objects.filter(
                machine=session.machine,
                part=session.part,
                inspection_type='first_piece',
                status__in=[InspectionSession.Status.FINALIZED_PASSED, InspectionSession.Status.APPROVED],
            ).exists()
            if not first_piece_active and not session.is_setup_approved and session.hourly_unlocked_slot == 0:
                session.is_setup_approved = True
                session.save(update_fields=['is_setup_approved'])

        # Validate
        result = self.validator.validate(measured_value, parameter)

        # Build measurement document
        measurement = {
            'parameter_code':   parameter_code,
            'parameter_name':   parameter.parameter_name,
            'unit':             parameter.unit,
            'nominal':          float(parameter.nominal_value),
            'upper_limit':      float(parameter.upper_limit),
            'lower_limit':      float(parameter.lower_limit),
            'measured_value':   measured_value,
            'deviation':        result.deviation,
            'status':           result.status,
            'is_critical_fail': result.is_critical,
            'voice_raw_text':   voice_raw_text,
            'audio_file_path':  audio_file_path,
            'method':           method,
            'inspection_type':  meas_type,
            'trial_number':     meas_trial,
            'hourly_slot':      meas_slot,
            'recorded_at':      datetime.now(timezone.utc),
        }

        # Update MongoDB document
        if existing_idx is not None:
            self.collection.update_one(
                {'_id': str(session_id)},
                {
                    '$set': {
                        f'measurements.{existing_idx}': measurement,
                        'parameter_summary.$[param].status': result.status,
                        'parameter_summary.$[param].measured_value': measured_value,
                    }
                },
                array_filters=[{'param.parameter_code': parameter_code}],
            )
        else:
            self.collection.update_one(
                {'_id': str(session_id)},
                {
                    '$push': {'measurements': measurement},
                    '$set': {
                        'parameter_summary.$[param].status': result.status,
                        'parameter_summary.$[param].measured_value': measured_value,
                    }
                },
                array_filters=[{'param.parameter_code': parameter_code}],
            )

        # Update PostgreSQL counters and reminder timestamps atomically
        from django.utils import timezone as django_timezone
        now_dt = django_timezone.now()

        update_dict = {
            'last_measurement_at': now_dt,
            'operator_reminded': False,
            'supervisor_escalated': False,
        }
        
        if existing_idx is None:
            update_dict['recorded_count'] = F('recorded_count') + 1
            session.recorded_count += 1

        if result.status == 'out_of_spec':
            update_dict['has_ooc'] = True
            session.has_ooc = True
        if result.is_critical:
            update_dict['has_critical_fail'] = True
            session.has_critical_fail = True

        session.last_measurement_at = now_dt
        InspectionSession.objects.filter(pk=session.pk).update(**update_dict)

        # Push WebSocket event
        self._push_measurement_event(
            session, parameter, result, measured_value,
            voice_raw_text=voice_raw_text, method=method,
            meas_type=meas_type, meas_trial=meas_trial, meas_slot=meas_slot
        )

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

    # ── Finalize First Piece Session (Inspector Workflow) ─────────────────
    def finalize_first_piece_session(self, session_id: str, inspector) -> InspectionSession:
        """
        Inspector finalizes the First Piece Inspection independently.
        Generates First Piece PDF report and enables machine for production if PASSED.
        """
        session = InspectionSession.objects.get(session_id=session_id)
        if session.inspection_type != 'first_piece':
            raise ValueError("Only First Piece Inspections can be finalized via this workflow.")

        now = datetime.now(timezone.utc)
        doc = self.get_session_document(str(session_id)) or {}
        summary_list = doc.get('parameter_summary', [])

        # │► Belt-and-suspenders guard: never finalize an empty session.
        # If the MongoDB document has no measurements AND parameter_summary is empty,
        # that means 0 parameters were recorded. This must NEVER produce 'finalized_passed'.
        # The Flutter frontend also guards this, but we enforce it on the backend too.
        measurements = doc.get('measurements', [])
        if not measurements and not summary_list:
            raise ValueError(
                "Cannot finalize: No measurements have been recorded for this First Piece Inspection session. "
                "Record at least one parameter measurement before finalizing."
            )

        has_out_of_spec = any(p.get('status') == 'out_of_spec' for p in summary_list)

        if has_out_of_spec:
            session.status = InspectionSession.Status.FINALIZED_FAILED
            session.is_setup_approved = False
        else:
            session.status = InspectionSession.Status.FINALIZED_PASSED
            session.is_setup_approved = True
            session.hourly_unlocked_slot = 1

        session.is_first_piece_finalized = True
        session.finalized_at = now
        session.finalized_by = inspector
        session.completed_at = now

        # Generate official First Piece Inspection PDF report
        try:
            from .pdf_generator import generate_first_piece_pdf
            pdf_path = generate_first_piece_pdf(session, doc)
            session.pdf_report_path = pdf_path
        except Exception as e:
            logger.error(f"Error generating first piece PDF: {e}")

        session.save(update_fields=['status', 'is_first_piece_finalized', 'finalized_at', 'finalized_by', 'completed_at', 'is_setup_approved', 'hourly_unlocked_slot', 'pdf_report_path'])

        self.collection.update_one(
            {'_id': str(session_id)},
            {'$set': {
                'status': session.status,
                'is_first_piece_finalized': True,
                'is_setup_approved': session.is_setup_approved,
                'finalized_at': now,
                'finalized_by_id': inspector.id,
                'finalized_by_name': inspector.get_full_name(),
                'completed_at': now,
                'hourly_unlocked_slot': session.hourly_unlocked_slot,
                'pdf_report_path': session.pdf_report_path,
            }}
        )

        self._push_session_event(session, 'first_piece_finalized')
        return session


    # ── Supervisor Review ─────────────────────────────────────────────────
    def review_session(
        self,
        session_id: str,
        action: str,          # 'approve' | 'reject'
        supervisor,
        remark: str = '',
        rejected_parameters: list = None,
    ) -> InspectionSession:
        """Supervisor approves or rejects an inspection session."""
        session = InspectionSession.objects.get(session_id=session_id)
        now     = datetime.now(timezone.utc)

        new_status = (
            InspectionSession.Status.APPROVED
            if action == 'approve'
            else InspectionSession.Status.REJECTED
        )

        doc = self.collection.find_one({'_id': str(session_id)})
        if action == 'reject':
            if not rejected_parameters and doc:
                latest_measurements = doc.get('measurements', [])
                if latest_measurements:
                    latest_trial = max(m.get('trial_number', 1) for m in latest_measurements)
                    rejected_parameters = list(set([
                        m['parameter_code'] for m in latest_measurements
                        if m.get('trial_number', 1) == latest_trial and m.get('status') == 'out_of_spec'
                    ]))
                if not rejected_parameters and 'parameter_summary' in doc:
                    rejected_parameters = [
                        p['parameter_code'] for p in doc['parameter_summary']
                        if p.get('status') == 'out_of_spec'
                    ]
        else:
            rejected_parameters = []

        session.status            = new_status
        session.supervisor        = supervisor
        session.supervisor_remark = remark
        if action == 'approve':
            session.is_setup_approved = True
            if session.hourly_unlocked_slot == 0:
                session.hourly_unlocked_slot = 1
        if action == 'reject':
            session.rejection_reason = remark
        session.reviewed_at       = now
        session.save(update_fields=['status', 'supervisor', 'supervisor_remark', 'rejection_reason', 'reviewed_at', 'is_setup_approved', 'hourly_unlocked_slot'])

        self.collection.update_one(
            {'_id': str(session_id)},
            {'$set': {
                'status':              new_status,
                'supervisor_id':       supervisor.id,
                'supervisor_remark':   remark,
                'rejection_reason':    remark if action == 'reject' else '',
                'rejected_parameters': rejected_parameters,
                'is_setup_approved':   session.is_setup_approved,
                'hourly_unlocked_slot': session.hourly_unlocked_slot,
                'approved_at':         now if action == 'approve' else None,
            }},
        )

        if action == 'reject':
            self._push_rejection_alert(session, remark, rejected_parameters)
        else:
            self._push_session_event(session, 'supervisor_action')

        return session

    # ── Get Full Document ─────────────────────────────────────────────────
    def get_session_document(self, session_id: str) -> Optional[dict]:
        """Retrieve full inspection document from MongoDB, merging multi-trial measurements and hourly slots."""
        doc = self.collection.find_one({'_id': str(session_id)})
        if not doc:
            return None

        doc['_id'] = str(doc['_id'])
        session_obj = InspectionSession.objects.filter(session_id=str(session_id)).select_related('operator', 'supervisor', 'finalized_by', 'machine', 'part').first()
        if session_obj:
            doc['inspection_type'] = session_obj.inspection_type
            doc['hourly_slot'] = session_obj.hourly_unlocked_slot or 1
            doc['hourly_unlocked_slot'] = session_obj.hourly_unlocked_slot
            doc['is_setup_approved'] = session_obj.is_setup_approved
            doc['status'] = session_obj.status
            if session_obj.finalized_by:
                doc['finalized_by_name'] = session_obj.finalized_by.get_full_name()
                doc['inspector_name'] = session_obj.finalized_by.get_full_name()
            elif session_obj.operator and (session_obj.operator.role in ['quality_engineer', 'inspector'] or session_obj.inspection_type == 'first_piece'):
                doc['inspector_name'] = session_obj.operator.get_full_name()
            if session_obj.operator:
                doc['operator_name'] = session_obj.operator.get_full_name()
            if session_obj.supervisor:
                doc['supervisor_name'] = session_obj.supervisor.get_full_name()

            if not doc.get('process_param_entries'):
                setup_doc = self.collection.find_one(
                    {
                        'inspection_type': 'setup_approval',
                        'machine_id': session_obj.machine_id,
                    },
                    sort=[('submitted_at', -1)]
                )
                if setup_doc and setup_doc.get('process_param_entries'):
                    doc['process_param_entries'] = setup_doc.get('process_param_entries')

        root_id = str(doc.get('parent_session_id') or doc['_id'])

        related_docs = list(self.collection.find({
            '$or': [
                {'_id': root_id},
                {'parent_session_id': root_id},
                {'_id': str(session_id)}
            ]
        }))

        # Collect and deduplicate all measurements across First Piece (Trials 1..3) and Hourly (Hours 1..8)
        meas_dict = {}

        def add_meas(m_item, def_type='first_piece', def_trial=1, def_slot=1):
            code = m_item.get('parameter_code')
            if not code:
                return
            itype = m_item.get('inspection_type') or def_type
            
            # Safely extract trial_number for First Piece
            trial = m_item.get('trial_number')
            if trial is None or (trial == 0 and itype == 'first_piece'):
                trial = def_trial if def_trial is not None and def_trial > 0 else 1

            # Safely extract hourly_slot for Hourly Inspection
            slot = m_item.get('hourly_slot')
            if slot is None or (slot == 0 and itype == 'hourly'):
                slot = def_slot if def_slot is not None and def_slot > 0 else 1

            key = (code, itype, slot if itype == 'hourly' else trial)
            m_copy = dict(m_item)
            m_copy['inspection_type'] = itype
            m_copy['trial_number'] = trial if itype == 'first_piece' else 0
            m_copy['hourly_slot'] = slot if itype == 'hourly' else 0
            meas_dict[key] = m_copy

        for d in sorted(related_docs, key=lambda x: x.get('trial_number', 1)):
            trial_no = d.get('trial_number')
            if trial_no is None:
                trial_no = 1
            d_type = d.get('inspection_type') or (session_obj.inspection_type if session_obj else 'first_piece')
            d_slot = d.get('hourly_slot') or (d.get('hourly_unlocked_slot') or 1)
            for m in d.get('measurements', []):
                add_meas(m, def_type=d_type, def_trial=trial_no, def_slot=d_slot)

        if session_obj:
            session_date = session_obj.started_at.date() if session_obj.started_at else None
            session_shift = session_obj.shift

            fp_kwargs = {
                'machine': session_obj.machine,
                'part': session_obj.part,
                'inspection_type': 'first_piece',
            }
            if session_date:
                fp_kwargs['started_at__date'] = session_date
            if session_shift:
                fp_kwargs['shift'] = session_shift

            fp_sessions = InspectionSession.objects.filter(**fp_kwargs).order_by('trial_number', 'started_at')
            for fp_s in fp_sessions:
                fp_doc = self.collection.find_one({'_id': str(fp_s.session_id)})
                if fp_doc:
                    t_no = fp_s.trial_number or fp_doc.get('trial_number') or 1
                    if fp_s.finalized_by and 'inspector_name' not in doc:
                        doc['inspector_name'] = fp_s.finalized_by.get_full_name()
                    for m in fp_doc.get('measurements', []):
                        add_meas(m, def_type='first_piece', def_trial=t_no, def_slot=1)

            hourly_kwargs = {
                'machine': session_obj.machine,
                'part': session_obj.part,
                'inspection_type': 'hourly',
            }
            if session_date:
                hourly_kwargs['started_at__date'] = session_date
            if session_shift:
                hourly_kwargs['shift'] = session_shift

            hourly_sessions = InspectionSession.objects.filter(**hourly_kwargs).order_by('hourly_unlocked_slot', 'started_at')
            for h_sess in hourly_sessions:
                h_doc = self.collection.find_one({'_id': str(h_sess.session_id)})
                if h_doc:
                    slot = h_sess.hourly_unlocked_slot or h_doc.get('hourly_slot') or 1
                    for m in h_doc.get('measurements', []):
                        add_meas(m, def_type='hourly', def_trial=0, def_slot=slot)

        doc['measurements'] = list(meas_dict.values())
        return doc

    # ── WebSocket Push ────────────────────────────────────────────────────
    def _push_measurement_event(self, session, parameter, result, value, voice_raw_text='', method='voice',
                                meas_type=None, meas_trial=None, meas_slot=None):
        group_name    = f"plant_{session.machine.plant_id}"
        operator_name = session.operator.get_full_name() if session.operator else f"Operator #{session.operator_id}"
        _dispatch_async_websocket(
            group_name,
            {
                'type':              'inspection.event',
                'event':             'measurement_recorded',
                'session_id':        str(session.session_id),
                'parent_session_id': str(session.parent_session_id) if session.parent_session_id else '',
                'machine_code':      session.machine.machine_code,
                'part_number':       session.part.part_number,
                'part_name':         session.part.part_name,
                'operator_id':       session.operator_id,
                'operator_name':     operator_name,
                'parameter_code':    parameter.parameter_code,
                'parameter_name':    parameter.parameter_name,
                'nominal':           float(parameter.nominal_value),
                'lower_limit':       float(parameter.lower_limit),
                'upper_limit':       float(parameter.upper_limit),
                'unit':              parameter.unit,
                'measured_value':    value,
                'status':            result.status,
                'is_critical':       result.is_critical,
                'progress':          session.progress_percent,
                'voice_raw_text':    voice_raw_text,
                'method':             method,
                'shift':              session.shift,
                'trial_number':       meas_trial if meas_trial is not None else (session.trial_number or 1),
                'inspection_type':    meas_type if meas_type is not None else session.inspection_type,
                'hourly_slot':        meas_slot if meas_slot is not None else (session.hourly_unlocked_slot or 1),
            },
        )

    def _push_process_param_event(self, session, process_parameter, status_val, value, voice_raw_text='', method='voice',
                                  meas_type='first_piece', meas_trial=1, meas_slot=0):
        group_name    = f"plant_{session.machine.plant_id}"
        operator_name = session.operator.get_full_name() if session.operator else f"Operator #{session.operator_id}"
        _dispatch_async_websocket(
            group_name,
            {
                'type':              'inspection.event',
                'event':             'measurement_recorded',
                'session_id':        str(session.session_id),
                'parent_session_id': str(session.parent_session_id) if session.parent_session_id else '',
                'machine_code':      session.machine.machine_code,
                'part_number':       session.part.part_number,
                'part_name':         session.part.part_name,
                'operator_id':       session.operator_id,
                'operator_name':     operator_name,
                'parameter_code':    process_parameter.parameter_code,
                'parameter_name':    process_parameter.parameter_name,
                'nominal':           float(process_parameter.nominal_value) if process_parameter.nominal_value is not None else None,
                'lower_limit':       float(process_parameter.lower_limit) if process_parameter.lower_limit is not None else None,
                'upper_limit':       float(process_parameter.upper_limit) if process_parameter.upper_limit is not None else None,
                'unit':              process_parameter.unit or '',
                'measured_value':    value,
                'status':            status_val,
                'is_critical':       False,
                'is_process_parameter': True,
                'progress':          session.progress_percent,
                'voice_raw_text':    voice_raw_text,
                'method':            method,
                'shift':             session.shift,
                'trial_number':      meas_trial,
                'inspection_type':   meas_type,
                'hourly_slot':       meas_slot,
            },
        )

    def _push_session_event(self, session, event_type: str):
        group_name    = f"plant_{session.machine.plant_id}"
        operator_name = session.operator.get_full_name() if session.operator else f"Operator #{session.operator_id}"
        _dispatch_async_websocket(
            group_name,
            {
                'type':          'inspection.event',
                'event':         event_type,
                'session_id':    str(session.session_id),
                'machine_code':  session.machine.machine_code,
                'part_number':   session.part.part_number,
                'part_name':     session.part.part_name,
                'operator_id':   session.operator_id,
                'operator_name': operator_name,
                'status':        session.status,
                'has_ooc':       session.has_ooc,
                'trial_number':  session.trial_number,
                'shift':         session.shift,
                'inspection_type': session.inspection_type,
            },
        )

    def _push_rejection_alert(self, session, remark: str, rejected_parameters: list = None):
        group_name    = f"plant_{session.machine.plant_id}"
        next_trial    = min(session.trial_number + 1, 3)
        _dispatch_async_websocket(
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
                'rejected_parameters': rejected_parameters or [],
                'status':             session.status,
            },
        )

    # ── Supervisor 3rd Trial Override ─────────────────────────────────────
    def supervisor_override_measurement(
        self,
        session_id: str,
        parameter_code: str,
        override_value: float,
        supervisor,
        remark: str = '',
    ) -> dict:
        """Allows Supervisor direct override/correction for 1ST PC #3 (3rd Trial Chance)."""
        session = InspectionSession.objects.get(session_id=session_id)
        if session.trial_number != 3 and not session.supervisor_override_active:
            raise ValueError("Supervisor direct override is only permitted for 1ST PC #3 (3rd Trial Chance).")

        parameter = InspectionParameter.objects.filter(
            template__part=session.part,
            parameter_code=parameter_code,
            template__is_active=True,
        ).first()
        if not parameter:
            raise ValueError(f"Parameter '{parameter_code}' not found.")

        result = self.validator.validate(override_value, parameter)

        # Update MongoDB document parameter_summary & measurements
        now = datetime.now(timezone.utc)
        self.collection.update_one(
            {'_id': str(session_id), 'parameter_summary.parameter_code': parameter_code},
            {'$set': {
                'parameter_summary.$.measured_value':       override_value,
                'parameter_summary.$.status':               result.status,
                'parameter_summary.$.override_by_supervisor': True,
                'parameter_summary.$.supervisor_id':         supervisor.id,
                'parameter_summary.$.supervisor_remark':     remark,
                'parameter_summary.$.updated_at':            now,
            }},
        )

        session.has_ooc = result.status == 'out_of_spec'
        session.supervisor_override_active = True
        session.save(update_fields=['has_ooc', 'supervisor_override_active'])

        self._push_session_event(session, 'supervisor_override')
        return {
            'status': 'success',
            'parameter_code': parameter_code,
            'measured_value': override_value,
            'result_status': result.status,
        }

    # ── Hourly Time-Lock Management ───────────────────────────────────────
    def get_hourly_status(self, session_id: str) -> dict:
        """Returns time-locked status for hourly slots 1/HR through 8/HR."""
        session = InspectionSession.objects.get(session_id=session_id)
        now = datetime.now(timezone.utc)
        start = session.shift_start_time or session.started_at
        elapsed_minutes = (now - start).total_seconds() / 60.0

        slots = []
        for i in range(1, 9):
            unlock_minute = (i - 1) * 60  # 1/HR opens at 0m, 2/HR at 60m...
            is_unlocked = elapsed_minutes >= unlock_minute
            is_overdue  = elapsed_minutes >= (unlock_minute + 75)  # 15m grace period

            slots.append({
                'slot':          f"{i}/HR",
                'slot_number':   i,
                'is_unlocked':   is_unlocked,
                'is_overdue':    is_overdue,
                'unlock_minute': unlock_minute,
            })

        return {
            'session_id':      str(session.session_id),
            'elapsed_minutes': round(elapsed_minutes, 1),
            'slots':           slots,
        }
