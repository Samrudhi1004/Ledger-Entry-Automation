"""
Background Reminder & Escalation Worker.
Monitors active inspection sessions:
- 60 Minutes without new reading -> Trigger Operator Reminder
- 75 Minutes (60m + 15m grace) without new reading -> Escalates live alert to Quality Supervisor Web Dashboard!
"""

import os
import time
import logging
import threading
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


def check_overdue_sessions():
    from .models import InspectionSession

    try:
        now = timezone.now()
        # Active sessions in progress
        sessions = InspectionSession.objects.filter(status='in_progress').select_related('part', 'machine', 'operator')

        for session in sessions:
            # Reference timestamp: last_measurement_at or started_at
            last_activity = session.last_measurement_at or session.started_at
            if not last_activity:
                continue

            elapsed_minutes = (now - last_activity).total_seconds() / 60.0

            # 1. Check 60-Minute Operator Reminder
            if elapsed_minutes >= 60.0 and not session.operator_reminded:
                session.operator_reminded = True
                session.operator_reminded_at = now
                session.save(update_fields=['operator_reminded', 'operator_reminded_at'])

                logger.info(
                    f"⏰ OPERATOR REMINDER: Session {session.session_id} for Operator {session.operator.username} "
                    f"has no readings for {round(elapsed_minutes)} mins."
                )

                _broadcast_event({
                    'type': 'OPERATOR_REMINDER_DUE',
                    'plant_id': session.machine.plant_id if session.machine else 1,
                    'session_id': str(session.session_id),
                    'operator_id': session.operator.id,
                    'operator_name': session.operator.get_full_name() or session.operator.username,
                    'machine_code': session.machine.machine_code,
                    'part_number': session.part.part_number,
                    'elapsed_minutes': round(elapsed_minutes),
                    'message': f"Hourly inspection reading due for machine {session.machine.machine_code}.",
                })

            # 2. Check 75-Minute Supervisor Escalation (60 mins + 15 mins grace period)
            if elapsed_minutes >= 75.0 and not session.supervisor_escalated:
                session.supervisor_escalated = True
                session.supervisor_escalated_at = now
                session.save(update_fields=['supervisor_escalated', 'supervisor_escalated_at'])

                logger.warning(
                    f"🚨 SUPERVISOR ESCALATION: Session {session.session_id} for Operator {session.operator.username} "
                    f"is OVERDUE by {round(elapsed_minutes)} mins!"
                )

                _broadcast_event({
                    'type': 'SUPERVISOR_ESCALATION_ALERT',
                    'plant_id': session.machine.plant_id if session.machine else 1,
                    'session_id': str(session.session_id),
                    'operator_id': session.operator.id,
                    'operator_name': session.operator.get_full_name() or session.operator.username,
                    'machine_code': session.machine.machine_code,
                    'part_number': session.part.part_number,
                    'elapsed_minutes': round(elapsed_minutes),
                    'message': (
                        f"🚨 OVERDUE ESCALATION: Operator {session.operator.get_full_name() or session.operator.username} "
                        f"has not logged measurements on {session.machine.machine_code} for {round(elapsed_minutes)} minutes!"
                    ),
                })

    except Exception as e:
        logger.error(f"Error in check_overdue_sessions: {e}")


def _broadcast_event(payload):
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            # Safely extract Plant ID from payload (defaults to 1 if missing)
            plant_id = payload.get('plant_id', 1)
            async_to_sync(channel_layer.group_send)(
                f'plant_{plant_id}',
                {
                    'type': 'inspection.event',
                    'event': payload['type'],
                    'data': payload,
                }
            )
    except Exception as e:
        logger.error(f"Failed to send WS escalation alert: {e}")


class ReminderWorkerThread(threading.Thread):
    def __init__(self, interval_seconds=30):
        super().__init__(daemon=True, name="ReminderWorkerThread")
        self.interval_seconds = interval_seconds
        self.running = True

    def run(self):
        logger.info("Starting Central Server Reminder & Supervisor Escalation Background Worker...")
        while self.running:
            try:
                check_overdue_sessions()
            except Exception as err:
                logger.error(f"Error in worker loop: {err}")
            time.sleep(self.interval_seconds)


# H1+H2 FIX (step 3/3): Use a threading.Lock to protect _worker_started.
#
# Old code used a plain bool — two threads starting simultaneously could both
# read False and both call thread.start(), spawning two worker threads.
# The Lock makes the check-and-set atomic, so only one thread ever wins.
_worker_lock    = threading.Lock()
_worker_started = False


def start_reminder_worker():
    global _worker_started
    with _worker_lock:
        if not _worker_started:
            thread = ReminderWorkerThread(interval_seconds=30)
            thread.start()
            _worker_started = True
            logger.info("Reminder worker started (PID=%s).", os.getpid())
        else:
            logger.debug("Reminder worker already running — skipped duplicate start.")
