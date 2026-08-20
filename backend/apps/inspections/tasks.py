"""
Celery Tasks for Inspection App.
Handles async measurement processing, Redis caching, and idempotency guarantees.
"""

import logging
import threading
import time
from celery import shared_task
from django.core.cache import cache
from .services import InspectionService

logger = logging.getLogger(__name__)
_service = InspectionService()


def process_measurement_in_background(
    session_id: str,
    parameter_code: str,
    measured_value: float,
    voice_raw_text: str = '',
    method: str = 'voice',
    hourly_slot: int = None,
    inspection_type: str = None,
    idempotency_key: str = None,
) -> dict:
    """
    Executes the DB, Redis, and WebSocket write operations for a measurement recording.
    Caches the result under idempotency_key (30 min TTL) if provided.
    """
    t_start = time.perf_counter()
    try:
        result = _service.record_measurement(
            session_id=session_id,
            parameter_code=parameter_code,
            measured_value=measured_value,
            voice_raw_text=voice_raw_text,
            method=method,
            hourly_slot=hourly_slot,
            inspection_type=inspection_type,
        )
        duration_ms = (time.perf_counter() - t_start) * 1000
        result['process_duration_ms'] = round(duration_ms, 2)
        result['status_code'] = 200

        if idempotency_key:
            cache_key = f"idempotency_{idempotency_key}"
            cache.set(cache_key, result, timeout=1800)

        logger.info(
            "[PERF TASK] Executed record_measurement for %s (val: %s) in %.2f ms (key: %s)",
            parameter_code, measured_value, duration_ms, idempotency_key
        )
        return result
    except Exception as exc:
        duration_ms = (time.perf_counter() - t_start) * 1000
        err_res = {
            'error': str(exc),
            'status_code': 400,
            'process_duration_ms': round(duration_ms, 2),
        }
        if idempotency_key:
            cache_key = f"idempotency_{idempotency_key}"
            cache.set(cache_key, err_res, timeout=1800)
        logger.error("Error executing measurement task for %s: %s", parameter_code, exc)
        return err_res


@shared_task(name="apps.inspections.tasks.record_measurement_task")
def record_measurement_task(
    session_id: str,
    parameter_code: str,
    measured_value: float,
    voice_raw_text: str = '',
    method: str = 'voice',
    hourly_slot: int = None,
    inspection_type: str = None,
    idempotency_key: str = None,
):
    """Celery task entry point."""
    return process_measurement_in_background(
        session_id=session_id,
        parameter_code=parameter_code,
        measured_value=measured_value,
        voice_raw_text=voice_raw_text,
        method=method,
        hourly_slot=hourly_slot,
        inspection_type=inspection_type,
        idempotency_key=idempotency_key,
    )


def dispatch_measurement_task_async(
    session_id: str,
    parameter_code: str,
    measured_value: float,
    voice_raw_text: str = '',
    method: str = 'voice',
    hourly_slot: int = None,
    inspection_type: str = None,
    idempotency_key: str = None,
):
    """
    Attempts to dispatch task to Celery worker; falls back to background daemon thread if Celery is not active.
    """
    try:
        record_measurement_task.delay(
            session_id=session_id,
            parameter_code=parameter_code,
            measured_value=measured_value,
            voice_raw_text=voice_raw_text,
            method=method,
            hourly_slot=hourly_slot,
            inspection_type=inspection_type,
            idempotency_key=idempotency_key,
        )
    except Exception as exc:
        logger.warning("Celery dispatch unavailable (%s), falling back to background thread.", exc)
        threading.Thread(
            target=process_measurement_in_background,
            kwargs={
                'session_id': session_id,
                'parameter_code': parameter_code,
                'measured_value': measured_value,
                'voice_raw_text': voice_raw_text,
                'method': method,
                'hourly_slot': hourly_slot,
                'inspection_type': inspection_type,
                'idempotency_key': idempotency_key,
            },
            daemon=True,
        ).start()
