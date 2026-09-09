"""
JSONB Document Utilities for InspectionSession.

Helper functions to work with the document_payload JSONB field,
replacing MongoDB collection operations.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime


def get_document(session) -> dict:
    """
    Get the full document payload from a session.
    Returns empty dict if document_payload is None.
    """
    if session.document_payload is None:
        return {}
    return session.document_payload


def update_document(session, updates: dict, save: bool = True) -> None:
    """
    Update the document_payload with new data.

    Args:
        session: InspectionSession instance
        updates: Dictionary of fields to update
        save: Whether to save the session immediately
    """
    doc = get_document(session)
    doc.update(updates)
    session.document_payload = doc

    if save:
        session.save(update_fields=['document_payload'])


def add_measurement(session, measurement: dict, save: bool = True) -> None:
    """
    Add a new measurement to the measurements array.

    Args:
        session: InspectionSession instance
        measurement: Measurement dictionary to add
        save: Whether to save immediately
    """
    doc = get_document(session)
    measurements = doc.get('measurements', [])
    measurements.append(measurement)
    doc['measurements'] = measurements
    session.document_payload = doc

    if save:
        session.save(update_fields=['document_payload'])


def update_measurement(
    session,
    parameter_code: str,
    inspection_type: str,
    trial_number: int = 0,
    hourly_slot: int = 0,
    updates: dict = None,
    save: bool = True
) -> bool:
    """
    Update an existing measurement in the measurements array.

    Returns True if measurement was found and updated, False otherwise.
    """
    if updates is None:
        return False

    doc = get_document(session)
    measurements = doc.get('measurements', [])

    found = False
    for m in measurements:
        # Match based on parameter_code, inspection_type, and trial/slot
        if m.get('parameter_code') == parameter_code:
            if inspection_type == 'first_piece' and m.get('inspection_type') == 'first_piece':
                if m.get('trial_number') == trial_number:
                    m.update(updates)
                    found = True
                    break
            elif inspection_type == 'hourly' and m.get('inspection_type') == 'hourly':
                if m.get('hourly_slot') == hourly_slot:
                    m.update(updates)
                    found = True
                    break

    if found:
        doc['measurements'] = measurements
        session.document_payload = doc

        if save:
            session.save(update_fields=['document_payload'])

    return found


def measurement_exists(
    session,
    parameter_code: str,
    inspection_type: str,
    trial_number: int = 0,
    hourly_slot: int = 0
) -> bool:
    """
    Check if a measurement already exists for the given criteria.
    """
    doc = get_document(session)
    measurements = doc.get('measurements', [])

    for m in measurements:
        if m.get('parameter_code') == parameter_code:
            if inspection_type == 'first_piece' and m.get('inspection_type') == 'first_piece':
                if m.get('trial_number') == trial_number:
                    return True
            elif inspection_type == 'hourly' and m.get('inspection_type') == 'hourly':
                if m.get('hourly_slot') == hourly_slot:
                    return True

    return False


def update_parameter_summary(
    session,
    parameter_code: str,
    updates: dict,
    save: bool = True
) -> bool:
    """
    Update a parameter in the parameter_summary array.

    Returns True if parameter was found and updated, False otherwise.
    """
    doc = get_document(session)
    param_summary = doc.get('parameter_summary', [])

    found = False
    for p in param_summary:
        if p.get('parameter_code') == parameter_code:
            p.update(updates)
            found = True
            break

    if found:
        doc['parameter_summary'] = param_summary
        session.document_payload = doc

        if save:
            session.save(update_fields=['document_payload'])

    return found


def update_process_parameter_summary(
    session,
    parameter_code: str,
    updates: dict,
    save: bool = True
) -> bool:
    """
    Update a process parameter in the process_parameter_summary array.
    """
    doc = get_document(session)
    proc_summary = doc.get('process_parameter_summary', [])

    found = False
    for p in proc_summary:
        if p.get('parameter_code') == parameter_code:
            p.update(updates)
            found = True
            break

    if found:
        doc['process_parameter_summary'] = proc_summary
        session.document_payload = doc

        if save:
            session.save(update_fields=['document_payload'])

    return found


def add_or_update_process_param_entry(
    session,
    parameter_code: str,
    parameter_name: str,
    specification: str,
    trial_key: str,
    value: str,
    save: bool = True
) -> None:
    """
    Add or update a process parameter entry for setup approval.

    Args:
        trial_key: e.g., 'trial_1', 'trial_2', 'trial_3'
    """
    doc = get_document(session)
    entries = doc.get('process_param_entries', [])

    # Find existing entry
    entry = None
    for e in entries:
        if e.get('parameter_code') == parameter_code:
            entry = e
            break

    if entry:
        # Update existing entry
        entry[trial_key] = value
    else:
        # Create new entry
        entry = {
            'parameter_code': parameter_code,
            'parameter_name': parameter_name,
            'specification': specification,
            trial_key: value,
        }
        entries.append(entry)

    doc['process_param_entries'] = entries
    session.document_payload = doc

    if save:
        session.save(update_fields=['document_payload'])


def initialize_document(
    session,
    part_number: str,
    part_name: str,
    machine_code: str,
    plant_id: int,
    operator_id: int,
    operator_name: str,
    supervisor_id: Optional[int],
    inspection_type: str,
    template_id: Optional[int],
    operation_name: str,
    hourly_slot: int,
    shift: str,
    trial_number: int,
    parent_session_id: Optional[str],
    started_at: datetime,
    parameter_summary: List[dict],
    process_parameter_summary: List[dict],
    initial_measurements: List[dict] = None,
    save: bool = True
) -> None:
    """
    Initialize the document_payload for a new session.
    """
    if initial_measurements is None:
        initial_measurements = []

    doc = {
        'session_id': str(session.session_id),
        'part_number': part_number,
        'part_name': part_name,
        'machine_code': machine_code,
        'plant_id': plant_id,
        'operator_id': operator_id,
        'operator_name': operator_name,
        'supervisor_id': supervisor_id,
        'inspection_type': inspection_type,
        'template_id': template_id,
        'operation_name': operation_name,
        'hourly_slot': hourly_slot,
        'shift': shift,
        'status': 'in_progress',
        'trial_number': trial_number,
        'parent_session_id': parent_session_id,
        'started_at': started_at.isoformat() if isinstance(started_at, datetime) else started_at,
        'completed_at': None,
        'measurements': initial_measurements,
        'supervisor_remark': '',
        'approved_at': None,
        'parameter_summary': parameter_summary,
        'process_parameter_summary': process_parameter_summary,
        'process_param_entries': [],
    }

    session.document_payload = doc

    if save:
        session.save(update_fields=['document_payload'])
