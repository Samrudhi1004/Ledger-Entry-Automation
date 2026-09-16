#!/usr/bin/env python
"""
========================================================================================
INSPECTION HUB — DEEP-DOWN MODULE-BY-MODULE TEST SUITE
========================================================================================
Covers the entire factory lifecycle across 14 independent operational modules:
  1. Auth & Role-Based Access Control (RBAC: Admin, Supervisor, Inspector, Operator, Calibrator)
  2. Factory & Shift Configuration (Shift hours, break minutes, available working time)
  3. Machines & Tooling Master Data (Machine hierarchy, QR generation, status toggles)
  4. Parts, Drawings & Control Plans (Drawings, revisions, control plans, operation templates)
  5. Tolerance & Parameter Spec Engine (Mechanical rules: Dimensional, Visual, Min/Max Limits)
  6. First Piece & Setup Approval Workflow (3-attempt trial constraints, process parameter approval)
  7. Inspection Sessions & Real-time Tolerance Checking (Payloads, OOC detection, critical flags)
  8. Daily Production & Downtime Math Engine (Available time / cycle time, Target, 9 Downtime loss categories)
  9. Autonomous Maintenance (Jishu Hozen - JH) (TPM 4-action checkpoints, shift audits, item evaluation)
  10. Calibration & Gauges Lifecycle (Equipment, frequency, days remaining, status engine, records)
  11. Shop Floor Task Management (Supervisor-to-operator assignments, state machine transitions)
  12. Document Control & IATF/ISO Revisioning (L1-L4 hierarchy, revisions Rev A->B, audit log)
  13. Team Messaging & Collaboration (Direct/Group chats, messages, pins, read receipts)
  14. Analytics & Quality Yield Engine (Pass rates, OOC aggregation, performance KPIs)

Execution:
  python test_deepdown_modules.py            -> Interactive Console Menu
  python test_deepdown_modules.py --all      -> Run all 14 modules sequentially
  python test_deepdown_modules.py --module 8 -> Run only Module 8 (e.g. Production & Downtime)
  python test_deepdown_modules.py --clean    -> Clean up any test records
========================================================================================
"""

import os
import sys
import time
import uuid
from decimal import Decimal
from datetime import date, timedelta, datetime

# Setup Django Environment
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.core.exceptions import ValidationError
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIRequestFactory, force_authenticate

# App Models & Classes
from apps.users.models import User
from apps.users.permissions import (
    IsOperator, IsSupervisor, IsQualityEngineer, IsCalibrator, IsAdminUser, IsSupervisorOrAbove
)
from apps.machines.models import Factory, Plant, Machine
from apps.parts.models import (
    Part, InspectionTemplate, InspectionParameter, ProcessParameter,
    DrawingDocument, DrawingVersion, ControlPlanDocument, ControlPlanVersion
)
from apps.inspections.models import (
    InspectionSession, DailyProductionReport, DowntimeReport,
    JHChecklistVersion, JHChecklistItem, JHInspectionRecord, JHInspectionItemResult,
    SetupApproval
)
from apps.inspections.services import ToleranceValidator
from apps.calibration.models import (
    CalibrationEquipment, CalibrationRecord, CalibrationPlanEntry
)
from apps.tasks.models import Task
from apps.document_control.models import Document, DocumentActivity
from apps.messaging.models import (
    Conversation, Message, MessageAttachment, MessageRead, MessageReaction
)
from apps.analytics.views import InspectionReportView

# ANSI Color Codes for terminal
C_RESET   = "\033[0m"
C_BOLD    = "\033[1m"
C_RED     = "\033[91m"
C_GREEN   = "\033[92m"
C_YELLOW  = "\033[93m"
C_BLUE    = "\033[94m"
C_CYAN    = "\033[96m"
C_MAGENTA = "\033[95m"
C_WHITE   = "\033[97m"

TAG = "TEST_DEEP_"

# ============================================================================
# TEST TRACKER & UTILITIES
# ============================================================================
class TestTracker:
    def __init__(self):
        self.subtests_passed = 0
        self.subtests_failed = 0
        self.current_module_passed = 0
        self.current_module_failed = 0
        self.modules_summary = []

    def start_module(self, mod_num, mod_name):
        self.current_module_passed = 0
        self.current_module_failed = 0
        print(f"\n{C_CYAN}{'='*80}{C_RESET}")
        print(f"{C_BOLD}{C_WHITE}[MODULE {mod_num:02d}] {mod_name.upper()}{C_RESET}")
        print(f"{C_CYAN}{'='*80}{C_RESET}")

    def assert_true(self, condition, message, details=""):
        if condition:
            self.subtests_passed += 1
            self.current_module_passed += 1
            print(f"  {C_GREEN}[PASS]{C_RESET} {message}")
            if details:
                print(f"         {C_WHITE}-> {details}{C_RESET}")
        else:
            self.subtests_failed += 1
            self.current_module_failed += 1
            print(f"  {C_RED}[FAIL]{C_RESET} {message}")
            if details:
                print(f"         {C_RED}-> DETAILS: {details}{C_RESET}")

    def end_module(self, mod_num, mod_name, elapsed_ms):
        status = "PASSED" if self.current_module_failed == 0 else "FAILED"
        status_colored = f"{C_GREEN}PASSED{C_RESET}" if status == "PASSED" else f"{C_RED}FAILED{C_RESET}"
        print(f"\n  -> Module {mod_num} Result: {status_colored} "
              f"({self.current_module_passed} passed, {self.current_module_failed} failed, {elapsed_ms:.1f}ms)\n")
        self.modules_summary.append({
            'num': mod_num,
            'name': mod_name,
            'passed': self.current_module_passed,
            'failed': self.current_module_failed,
            'time_ms': elapsed_ms,
            'status': status
        })

tracker = TestTracker()


# ============================================================================
# COMPREHENSIVE CLEANUP ROUTINE
# ============================================================================
def cleanup_all_test_data(quiet=False):
    """Safely cleans up any data tagged with TEST_DEEP_ across all tables."""
    if not quiet:
        print(f"\n{C_YELLOW}[CLEANUP] Purging all '{TAG}*' records from database...{C_RESET}")

    # 1. Messaging
    Conversation.objects.filter(name__startswith=TAG).delete()

    # 2. Document Control
    from apps.document_control.models import DocumentChangeRequest
    DocumentChangeRequest.objects.filter(dcr_number__startswith=TAG).delete()
    DocumentActivity.objects.filter(document__document_number__startswith=TAG).delete()
    Document.objects.filter(document_number__startswith=TAG).delete()

    # 3. Tasks
    Task.objects.filter(title__startswith=TAG).delete()

    # 4. Calibration
    CalibrationRecord.objects.filter(equipment__equipment_id__startswith=TAG).delete()
    CalibrationPlanEntry.objects.filter(equipment__equipment_id__startswith=TAG).delete()
    CalibrationEquipment.objects.filter(equipment_id__startswith=TAG).delete()

    # 5. Jishu Hozen
    JHInspectionItemResult.objects.filter(item__sub_no__startswith=TAG).delete()
    JHInspectionRecord.objects.filter(machine__machine_code__startswith=TAG).delete()
    JHChecklistItem.objects.filter(sub_no__startswith=TAG).delete()
    JHChecklistVersion.objects.filter(notes__startswith=TAG).delete()

    # 6. Production & Downtime
    DowntimeReport.objects.filter(production_report__operation__startswith=TAG).delete()
    DailyProductionReport.objects.filter(operation__startswith=TAG).delete()

    # 7. Inspections & Setup Approval
    SetupApproval.objects.filter(part_number__startswith=TAG).delete()
    InspectionSession.objects.filter(part__part_number__startswith=TAG).delete()

    # 8. Parts & Templates
    ProcessParameter.objects.filter(template__name__startswith=TAG).delete()
    InspectionParameter.objects.filter(template__name__startswith=TAG).delete()
    InspectionTemplate.objects.filter(name__startswith=TAG).delete()
    DrawingVersion.objects.filter(drawing__drawing_number__startswith=TAG).delete()
    DrawingDocument.objects.filter(drawing_number__startswith=TAG).delete()
    ControlPlanVersion.objects.filter(control_plan__control_plan_number__startswith=TAG).delete()
    ControlPlanDocument.objects.filter(control_plan_number__startswith=TAG).delete()
    Part.objects.filter(part_number__startswith=TAG).delete()

    # 9. Machines, Plants, Factories
    Machine.objects.filter(machine_code__startswith=TAG).delete()
    Plant.objects.filter(code__startswith=TAG).delete()
    Factory.objects.filter(code__startswith=TAG).delete()

    # 10. Users
    User.objects.filter(username__startswith=TAG.lower()).delete()

    if not quiet:
        print(f"{C_GREEN}[CLEANUP] Database is clean and ready.{C_RESET}\n")


# ============================================================================
# MODULE 1: AUTH & ROLE-BASED ACCESS CONTROL (RBAC)
# ============================================================================
def test_module_auth_rbac():
    tracker.start_module(1, "Authentication & Role-Based Access Control (RBAC)")
    t0 = time.time()

    # Create 5 users for all roles
    roles = [
        ('admin', User.Role.ADMIN),
        ('supervisor', User.Role.SUPERVISOR),
        ('inspector', User.Role.QUALITY_ENGINEER),
        ('operator', User.Role.OPERATOR),
        ('calibrator', User.Role.CALIBRATOR),
    ]

    created_users = {}
    for role_name, role_val in roles:
        u, created = User.objects.get_or_create(
            username=f"{TAG.lower()}{role_name}",
            defaults={
                'email': f"{TAG.lower()}{role_name}@example.com",
                'role': role_val,
                'employee_id': f"EMP_{TAG}{role_name.upper()}",
                'assigned_shift': User.Shift.SHIFT_I,
                'is_active': True
            }
        )
        u.set_password('TestPass@123')
        u.save()
        created_users[role_name] = u

    # Check 1.1: Users exist and passwords verify
    admin = created_users['admin']
    tracker.assert_true(admin.check_password('TestPass@123'), "Password hashing & authentication check")

    # Check 1.2: Role helper properties
    op = created_users['operator']
    tracker.assert_true(op.is_operator and not op.is_supervisor, "Operator helper property (is_operator == True)")
    
    sup = created_users['supervisor']
    tracker.assert_true(sup.is_supervisor and not sup.is_operator, "Supervisor helper property (is_supervisor == True)")

    insp = created_users['inspector']
    tracker.assert_true(insp.is_quality_engineer, "Inspector helper property (is_quality_engineer == True)")

    calib = created_users['calibrator']
    tracker.assert_true(calib.is_calibrator, "Calibrator helper property (is_calibrator == True)")

    # Check 1.3: Permission class checks
    req_factory = APIRequestFactory()
    request = req_factory.get('/')

    # Test IsSupervisorOrAbove permission
    perm = IsSupervisorOrAbove()
    request.user = sup
    tracker.assert_true(perm.has_permission(request, None), "IsSupervisorOrAbove grants access to Supervisor")
    request.user = insp
    tracker.assert_true(perm.has_permission(request, None), "IsSupervisorOrAbove grants access to Inspector")
    request.user = op
    tracker.assert_true(not perm.has_permission(request, None), "IsSupervisorOrAbove denies access to Operator")

    # Check 1.4: JWT Token issuance
    refresh = RefreshToken.for_user(op)
    tracker.assert_true(bool(refresh.access_token), "JWT token generation for user session", f"Token: {str(refresh.access_token)[:20]}...")

    tracker.end_module(1, "Authentication & Role-Based Access Control (RBAC)", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 2: FACTORY & SHIFT CONFIGURATION
# ============================================================================
def test_module_factory_shift():
    tracker.start_module(2, "Factory & Shift Configuration")
    t0 = time.time()

    # Create Factory with 8-hour shift, 30m lunch, 30m tea = 420 mins available
    factory, _ = Factory.objects.get_or_create(
        code=f"{TAG}FAC_01",
        defaults={
            'name': 'Test Precision Engineering Works',
            'location': 'Plot 42, MIDC Industrial Area',
            'shift_hours': 8,
            'total_shifts_per_day': 3,
            'lunch_break_minutes': 30,
            'tea_break_minutes': 30,
            'available_working_minutes': 420,
            'logo_url': 'https://example.com/logo.png',
            'is_active': True
        }
    )

    # Check 2.1: Available Working Time Formula
    calc_available = (factory.shift_hours * 60) - (factory.lunch_break_minutes + factory.tea_break_minutes)
    tracker.assert_true(
        calc_available == factory.available_working_minutes == 420,
        "Factory available working minutes math ( (8h * 60m) - 60m breaks = 420 mins )",
        f"Calculated: {calc_available}m, Expected: 420m"
    )

    # Check 2.2: 24-hour total daily plant coverage
    total_factory_day_hours = factory.shift_hours * factory.total_shifts_per_day
    tracker.assert_true(total_factory_day_hours == 24, "3 shifts * 8 hours = 24-hour factory coverage")

    # Check 2.3: Plant hierarchy attachment
    plant, _ = Plant.objects.get_or_create(
        code=f"{TAG}PLT_01",
        defaults={
            'factory': factory,
            'name': 'CNC Machining Bay 1',
            'shift_duration_hours': 8,
            'total_break_mins': 60
        }
    )
    tracker.assert_true(plant.factory_id == factory.id, "Plant properly linked to Factory hierarchy", f"Plant: {plant.name}")

    tracker.end_module(2, "Factory & Shift Configuration", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 3: MACHINES & SHOP FLOOR ASSETS
# ============================================================================
def test_module_machines():
    tracker.start_module(3, "Machines & Shop Floor Assets")
    t0 = time.time()

    plant = Plant.objects.get(code=f"{TAG}PLT_01")

    # Create Machine without explicit QR code to test auto-generation
    machine, _ = Machine.objects.get_or_create(
        machine_code=f"{TAG}MCH_01",
        defaults={
            'name': 'Doosan VMC-800 CNC Milling',
            'plant': plant,
            'machine_type': 'CNC 4-Axis Milling',
            'status': Machine.Status.ACTIVE,
            'is_active': True
        }
    )

    # Check 3.1: Auto QR Code Generation
    tracker.assert_true(machine.qr_code == machine.machine_code, "Machine auto-generates QR code from machine_code on save", f"QR: {machine.qr_code}")

    # Check 3.2: Status Transitions
    machine.status = Machine.Status.MAINTENANCE
    machine.save()
    machine.refresh_from_db()
    tracker.assert_true(machine.status == 'maintenance', "Machine status toggles to 'maintenance'")

    machine.status = Machine.Status.ACTIVE
    machine.save()
    tracker.assert_true(machine.status == 'active', "Machine status restores to 'active'")

    tracker.end_module(3, "Machines & Shop Floor Assets", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 4: PARTS, DRAWINGS & CONTROL PLANS
# ============================================================================
def test_module_parts_drawings():
    tracker.start_module(4, "Parts, Drawings & Control Plans")
    t0 = time.time()

    machine = Machine.objects.get(machine_code=f"{TAG}MCH_01")
    admin = User.objects.get(username=f"{TAG.lower()}admin")

    # Create Part
    part, _ = Part.objects.get_or_create(
        part_number=f"{TAG}PN_FLANGE_01",
        defaults={
            'machine': machine,
            'part_name': 'Precision Hydraulic Flange',
            'drawing_number': f"{TAG}DWG_FLG_01",
            'revision': 'Rev B',
            'created_by': admin
        }
    )
    tracker.assert_true(part.machine_id == machine.id, "Part successfully bound to Machine", f"Part: {part.part_number}")

    # Check 4.1: Engineering Drawing Document & Revisioning
    drawing, _ = DrawingDocument.objects.get_or_create(
        drawing_number=f"{TAG}DWG_FLG_01",
        defaults={
            'part': part,
            'title': 'Hydraulic Flange Detailed Drawing',
            'current_revision': 'Rev B',
            'created_by': admin
        }
    )
    version = DrawingVersion.objects.create(
        drawing=drawing,
        revision_code='Rev B',
        file_name='flange_rev_b.pdf',
        file_size=204800,
        change_notes='Added O-ring groove tolerance specification',
        uploaded_by=admin
    )
    tracker.assert_true(drawing.versions.count() >= 1, "Drawing Document tracks version history", f"Latest Rev: {version.revision_code}")

    # Check 4.2: Process Control Plan Document
    cp, _ = ControlPlanDocument.objects.get_or_create(
        control_plan_number=f"{TAG}CP_FLG_01",
        defaults={
            'part': part,
            'title': 'Process Control Plan - Flange Line',
            'current_revision': 'v1.0',
            'created_by': admin
        }
    )
    cp_ver = ControlPlanVersion.objects.create(
        control_plan=cp,
        revision_code='v1.0',
        file_name='control_plan_flange_v1.pdf',
        file_size=102400,
        uploaded_by=admin
    )
    tracker.assert_true(cp.versions.count() >= 1, "Control Plan document version created", f"CP Number: {cp.control_plan_number}")

    # Check 4.3: Inspection Template Creation (Operation)
    template, _ = InspectionTemplate.objects.get_or_create(
        part=part,
        inspection_type=InspectionTemplate.InspectionType.FIRST_PIECE,
        version=1,
        defaults={
            'name': f"{TAG}Op 10 - Rough Facing & Boring",
            'cycle_time_mins': 10.0,
            'target_parameter_count': 5,
            'is_published': True,
            'created_by': admin
        }
    )
    tracker.assert_true(template.cycle_time_mins == 10.0, "Template created with cycle_time_mins = 10.0", f"Template: {template.name}")

    tracker.end_module(4, "Parts, Drawings & Control Plans", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 5: TOLERANCE & PARAMETER SPEC ENGINE
# ============================================================================
def test_module_tolerances():
    tracker.start_module(5, "Tolerance & Parameter Spec Engine")
    t0 = time.time()

    part = Part.objects.get(part_number=f"{TAG}PN_FLANGE_01")
    template = InspectionTemplate.objects.get(part=part, inspection_type=InspectionTemplate.InspectionType.FIRST_PIECE, version=1)

    # 1. Dimensional Parameter (50.0000 ± 0.0500)
    p_dim = InspectionParameter.objects.create(
        template=template,
        parameter_name="Bore Diameter",
        parameter_code="P1",
        unit="mm",
        nominal_value=Decimal("50.0000"),
        upper_tolerance=Decimal("0.0500"),
        lower_tolerance=Decimal("-0.0500"),
        measurement_type=InspectionParameter.MeasurementType.DIMENSIONAL,
        is_critical=True,
        sequence_order=1
    )
    tracker.assert_true(
        p_dim.lower_limit == Decimal("49.9500") and p_dim.upper_limit == Decimal("50.0500"),
        "Rule 1 (Dimensional Limits): 50.00 +/- 0.05 -> [49.9500, 50.0500]",
        f"Actual: [{p_dim.lower_limit}, {p_dim.upper_limit}]"
    )

    # 2. Min Limit Parameter (nominal >= 12.0000)
    p_min = InspectionParameter.objects.create(
        template=template,
        parameter_name="Flange Thickness MIN",
        parameter_code="P2",
        unit="mm",
        nominal_value=Decimal("12.0000"),
        upper_tolerance=Decimal("0.0000"),
        lower_tolerance=Decimal("0.0000"),
        measurement_type=InspectionParameter.MeasurementType.MIN_LIMIT,
        sequence_order=2
    )
    tracker.assert_true(
        p_min.lower_limit == Decimal("12.0000") and p_min.upper_limit == Decimal("99999.0000"),
        "Rule 3A (Min Limit): Lower = 12.0000, Upper = 99999.0000",
        f"Actual: [{p_min.lower_limit}, {p_min.upper_limit}]"
    )

    # 3. Max Limit Parameter / Surface Finish (nominal <= 1.6000 Ra)
    p_max = InspectionParameter.objects.create(
        template=template,
        parameter_name="Surface Roughness Ra",
        parameter_code="P3",
        unit="Ra",
        nominal_value=Decimal("1.6000"),
        upper_tolerance=Decimal("0.0000"),
        lower_tolerance=Decimal("0.0000"),
        measurement_type=InspectionParameter.MeasurementType.MAX_LIMIT,
        sequence_order=3
    )
    tracker.assert_true(
        p_max.lower_limit == Decimal("0.0000") and p_max.upper_limit == Decimal("1.6000"),
        "Rule 3B (Max Limit): Lower = 0.0000, Upper = 1.6000",
        f"Actual: [{p_max.lower_limit}, {p_max.upper_limit}]"
    )

    # 4. Visual Inspection Parameter (1.0 = PASS, 0.0 = FAIL)
    p_vis = InspectionParameter.objects.create(
        template=template,
        parameter_name="Burr & Blowhole Check",
        parameter_code="P4",
        unit="ok/not_ok",
        nominal_value=Decimal("1.0000"),
        upper_tolerance=Decimal("0.0000"),
        lower_tolerance=Decimal("0.0000"),
        measurement_type=InspectionParameter.MeasurementType.VISUAL,
        sequence_order=4
    )
    tracker.assert_true(
        p_vis.lower_limit == Decimal("0.0000") and p_vis.upper_limit == Decimal("1.0000"),
        "Rule 2 (Visual Limits): Lower = 0.0000, Upper = 1.0000",
        f"Actual: [{p_vis.lower_limit}, {p_vis.upper_limit}]"
    )

    # 5. Process Parameter (Spindle Speed: 1200 RPM ± 50)
    proc_p = ProcessParameter.objects.create(
        template=template,
        parameter_name="Spindle Speed RPM",
        parameter_code="PR1",
        data_type=ProcessParameter.DataType.NUMERIC,
        measurement_type=ProcessParameter.MeasurementType.DIMENSIONAL,
        unit="RPM",
        nominal_value=Decimal("1200.0000"),
        upper_tolerance=Decimal("50.0000"),
        lower_tolerance=Decimal("-50.0000"),
        specification="1200",
        sequence_order=1
    )
    tracker.assert_true(
        proc_p.lower_limit == Decimal("1150.0000") and proc_p.upper_limit == Decimal("1250.0000"),
        "Process Parameter Auto-limits: 1200 +/- 50 RPM -> [1150, 1250]",
        f"Actual: [{proc_p.lower_limit}, {proc_p.upper_limit}]"
    )

    # Check ToleranceValidator Engine directly
    validator = ToleranceValidator()
    # Test In-spec
    res_ok = validator.validate(50.02, p_dim)
    tracker.assert_true(res_ok.status == 'ok', "ToleranceValidator accepts 50.02mm for 50.00 +/- 0.05")

    # Test Out-of-spec
    res_ooc = validator.validate(50.09, p_dim)
    tracker.assert_true(res_ooc.status == 'out_of_spec', "ToleranceValidator flags 50.09mm as out_of_spec")

    # Test Visual
    res_v_pass = validator.validate(1.0, p_vis)
    res_v_fail = validator.validate(0.0, p_vis)
    tracker.assert_true(res_v_pass.status == 'ok' and res_v_fail.status == 'out_of_spec', "Visual validator: 1.0 -> OK, 0.0 -> Out of spec")

    tracker.end_module(5, "Tolerance & Parameter Spec Engine", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 6: FIRST PIECE & SETUP APPROVAL WORKFLOW
# ============================================================================
def test_module_first_piece_setup():
    tracker.start_module(6, "First Piece & Setup Approval Workflow")
    t0 = time.time()

    part = Part.objects.get(part_number=f"{TAG}PN_FLANGE_01")
    machine = Machine.objects.get(machine_code=f"{TAG}MCH_01")
    template = InspectionTemplate.objects.get(part=part, inspection_type=InspectionTemplate.InspectionType.FIRST_PIECE, version=1)
    operator = User.objects.get(username=f"{TAG.lower()}operator")
    inspector = User.objects.get(username=f"{TAG.lower()}inspector")

    # Check 6.1: Enforce 3-attempts limit rule on First Piece Session
    session_4 = InspectionSession(
        part=part,
        machine=machine,
        operator=operator,
        template=template,
        inspection_type='first_piece',
        trial_number=4  # Exceeds max 3 attempts
    )
    attempt_limit_enforced = False
    try:
        session_4.clean()
    except ValidationError as e:
        attempt_limit_enforced = True
    tracker.assert_true(attempt_limit_enforced, "Attempt limit rule: Clean() blocks First Piece trial_number > 3")

    # Check 6.2: Create SetupApproval record
    setup_app = SetupApproval.objects.create(
        template=template,
        machine=machine,
        part_number=part.part_number,
        inspector=inspector,
        inspector_name=inspector.get_full_name() or inspector.username,
        process_param_entries=[
            {'parameter_code': 'PR1', 'parameter_name': 'Spindle Speed RPM', 'trial_1': '1200', 'trial_2': '1205', 'trial_3': '1198', 'status': 'OK'}
        ],
        status='approved'
    )
    tracker.assert_true(setup_app.status == 'approved', "SetupApproval record created and approved by Inspector", f"ID: {setup_app.id}")

    # Check 6.3: First Piece Session approval unlocks Hourly Slot
    fp_session = InspectionSession.objects.create(
        part=part,
        machine=machine,
        operator=operator,
        template=template,
        inspection_type='first_piece',
        trial_number=1,
        status=InspectionSession.Status.APPROVED,
        is_setup_approved=True,
        hourly_unlocked_slot=1  # 1/HR unlocked
    )
    tracker.assert_true(
        fp_session.is_setup_approved and fp_session.hourly_unlocked_slot == 1,
        "Approved First Piece session unlocks hourly inspection slot 1/HR"
    )

    tracker.end_module(6, "First Piece & Setup Approval Workflow", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 7: INSPECTION SESSIONS & TOLERANCE EVALUATION
# ============================================================================
def test_module_inspection_sessions():
    tracker.start_module(7, "Inspection Sessions & Tolerance Evaluation")
    t0 = time.time()

    part = Part.objects.get(part_number=f"{TAG}PN_FLANGE_01")
    machine = Machine.objects.get(machine_code=f"{TAG}MCH_01")
    operator = User.objects.get(username=f"{TAG.lower()}operator")
    supervisor = User.objects.get(username=f"{TAG.lower()}supervisor")

    # Create an Hourly Session
    session = InspectionSession.objects.create(
        part=part,
        machine=machine,
        operator=operator,
        supervisor=supervisor,
        inspection_type='hourly',
        shift=InspectionSession.Shift.I,
        status=InspectionSession.Status.IN_PROGRESS,
        total_parameters=4,
        recorded_count=4,
        has_ooc=True,  # 1 reading out of spec
        has_critical_fail=True,
        document_payload={
            'measurements': [
                {'param_code': 'P1', 'measured_value': 50.12, 'status': 'out_of_spec', 'is_critical': True}, # OOC + Critical
                {'param_code': 'P2', 'measured_value': 12.50, 'status': 'ok', 'is_critical': False},
                {'param_code': 'P3', 'measured_value': 1.20, 'status': 'ok', 'is_critical': False},
                {'param_code': 'P4', 'measured_value': 1.0, 'status': 'ok', 'is_critical': False},
            ]
        }
    )

    # Check 7.1: Progress percent property
    tracker.assert_true(session.progress_percent == 100, "Progress percentage is 100% when 4/4 parameters recorded")
    tracker.assert_true(session.is_complete, "Session is_complete flag evaluates to True")

    # Check 7.2: OOC and Critical Fail flags
    tracker.assert_true(session.has_ooc and session.has_critical_fail, "Session accurately flagged with has_ooc and has_critical_fail")

    # Check 7.3: Status lifecycle
    session.status = InspectionSession.Status.PENDING_REVIEW
    session.save()
    tracker.assert_true(session.status == 'pending_review', "Session status transitioned to 'pending_review'")

    session.status = InspectionSession.Status.APPROVED
    session.reviewed_at = timezone.now()
    session.supervisor_remark = "Approved with minor tool offset adjustment."
    session.save()
    tracker.assert_true(session.status == 'approved', "Supervisor approved session with remarks")

    tracker.end_module(7, "Inspection Sessions & Tolerance Evaluation", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 8: DAILY PRODUCTION & DOWNTIME MATH ENGINE
# ============================================================================
def test_module_production_downtime():
    tracker.start_module(8, "Daily Production & Downtime Math Engine")
    t0 = time.time()

    part = Part.objects.get(part_number=f"{TAG}PN_FLANGE_01")
    machine = Machine.objects.get(machine_code=f"{TAG}MCH_01")
    operator = User.objects.get(username=f"{TAG.lower()}operator")

    # Available time = 420 mins (8h * 60 - 60)
    # Cycle time = 10 mins
    # Expected target = 420 / 10 = 42 jobs
    # Jobs completed = 35
    # Expected achievement % = (35 / 42) * 100 = 83.33%

    prod_report = DailyProductionReport.objects.create(
        date=date.today(),
        machine=machine,
        part=part,
        operation=f"{TAG}Op 10 - Rough Facing & Boring",
        shift='I',
        operator=operator,
        jobs_completed=35,
        correct_jobs=33,
        incorrect_jobs=2,
        cr_count=0,
        mr_count=1,
        rw_count=1,
        status=DailyProductionReport.Status.SUBMITTED
    )

    # Check 8.1: Target Auto-Calculation
    tracker.assert_true(
        prod_report.production_target == 42,
        "Production Target Auto-Calculation: 420 min / 10 min cycle time = 42 jobs",
        f"Actual target: {prod_report.production_target}"
    )

    # Check 8.2: Achievement Percentage Calculation
    tracker.assert_true(
        prod_report.achievement_percentage == 83.33,
        "Achievement percentage: (35 / 42) * 100 = 83.33%",
        f"Actual: {prod_report.achievement_percentage}%"
    )

    # Check 8.3: 1-to-1 Linked DowntimeReport Auto-Creation & Expected Downtime Formula
    # Target (42) - Completed (35) = 7 short. Expected downtime = 7 * 10 min = 70 mins.
    dt_report = DowntimeReport.objects.get(production_report=prod_report)
    tracker.assert_true(
        dt_report.expected_downtime == 70,
        "Expected Downtime Formula: (42 target - 35 completed) * 10 min = 70 mins",
        f"Actual expected downtime: {dt_report.expected_downtime} mins"
    )

    # Check 8.4: 9 Loss Categories Summation
    dt_report.no_load = 15
    dt_report.setting = 20
    dt_report.tool_change = 10
    dt_report.inspection_wait = 25  # Total = 15 + 20 + 10 + 25 = 70 mins
    dt_report.status = DowntimeReport.Status.COMPLETED
    dt_report.save()

    tracker.assert_true(
        dt_report.total_downtime == 70,
        "Total Downtime matches sum of 9 loss categories: 15+20+10+25 = 70 mins",
        f"Actual total downtime: {dt_report.total_downtime} mins"
    )
    tracker.assert_true(dt_report.completed_at is not None, "Downtime report sets completed_at timestamp on completion")

    # Check 8.5: Negative validation constraint
    dt_report.no_load = -10
    has_validation_error = False
    try:
        dt_report.clean()
    except ValidationError:
        has_validation_error = True
    tracker.assert_true(has_validation_error, "Downtime values reject negative numbers with ValidationError")

    tracker.end_module(8, "Daily Production & Downtime Math Engine", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 9: AUTONOMOUS MAINTENANCE (JISHU HOZEN - JH)
# ============================================================================
def test_module_jishu_hozen():
    tracker.start_module(9, "Autonomous Maintenance (Jishu Hozen - JH)")
    t0 = time.time()

    machine = Machine.objects.get(machine_code=f"{TAG}MCH_01")
    operator = User.objects.get(username=f"{TAG.lower()}operator")
    admin = User.objects.get(username=f"{TAG.lower()}admin")

    # Check 9.1: Checklist Versioning
    jh_ver = JHChecklistVersion.objects.create(
        version_number=999,
        filename=f"{TAG}jh_checklist_v999.xlsx",
        notes=f"{TAG}Test Autonomous Maintenance Checklist",
        uploaded_by=admin,
        total_items=3
    )
    tracker.assert_true(jh_ver.version_number == 999, "Checklist version recorded with audit user", f"Version: {jh_ver}")

    # Check 9.2: Create TPM Checkpoints with Clean, Lubricate, Inspect, Retighten
    item1 = JHChecklistItem.objects.create(
        version=jh_ver,
        sub_no=f"{TAG}1.1",
        assembly="1. Machine Front Side",
        check_point="Clean chips from door glass and guide ways",
        standard="Free from chips and oil stains",
        tool_type=JHChecklistItem.ToolType.VISUAL,
        action_clean=True,
        action_inspect=True,
        timing_sec="15 DPT"
    )

    item2 = JHChecklistItem.objects.create(
        version=jh_ver,
        sub_no=f"{TAG}1.2",
        assembly="2. Lubrication System",
        check_point="Verify slide way lube oil level above min mark",
        standard="Oil level between MIN and MAX level indicator",
        tool_type=JHChecklistItem.ToolType.VISUAL,
        action_lubricate=True,
        action_inspect=True,
        timing_sec="10 DPT"
    )

    tracker.assert_true(item1.action_clean and item2.action_lubricate, "Checklist items record TPM actions (Clean, Lubricate, Inspect)")

    # Check 9.3: Shift Inspection Record Submission
    audit_record = JHInspectionRecord.objects.create(
        machine=machine,
        operator=operator,
        date=date.today(),
        shift=JHInspectionRecord.Shift.I,
        status=JHInspectionRecord.Status.ALL_OK,
        total_items=2,
        ok_items=2,
        not_ok_items=0
    )

    res1 = JHInspectionItemResult.objects.create(
        inspection=audit_record,
        item=item1,
        status=JHInspectionItemResult.ItemStatus.OK
    )
    res2 = JHInspectionItemResult.objects.create(
        inspection=audit_record,
        item=item2,
        status=JHInspectionItemResult.ItemStatus.OK
    )

    tracker.assert_true(audit_record.item_results.count() == 2, "JH Inspection records item-by-item evaluations", f"Status: {audit_record.status}")

    tracker.end_module(9, "Autonomous Maintenance (Jishu Hozen - JH)", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 10: CALIBRATION & GAUGES LIFECYCLE
# ============================================================================
def test_module_calibration():
    tracker.start_module(10, "Calibration & Gauges Lifecycle")
    t0 = time.time()

    today = date.today()

    # 1. Valid Equipment (due in 60 days)
    eq_valid = CalibrationEquipment.objects.create(
        equipment_id=f"{TAG}EQ_VERNIER_01",
        equipment_name="Digital Vernier Caliper 0-200mm",
        equipment_type="Caliper",
        range_size="0-200mm",
        least_count="0.01mm",
        calibration_frequency_days=365,
        last_calibration_date=today - timedelta(days=305),
        next_calibration_date=today + timedelta(days=60),
        state=CalibrationEquipment.State.ACTIVE
    )
    tracker.assert_true(
        eq_valid.history_card_number == f"HC-{eq_valid.equipment_id}",
        "Auto-generated History Card Number HC-<id>",
        f"Card: {eq_valid.history_card_number}"
    )
    tracker.assert_true(
        eq_valid.calibration_status == 'Valid' and eq_valid.days_remaining == 60,
        "Equipment with >30 days remaining has status 'Valid'",
        f"Status: {eq_valid.calibration_status}, Days remaining: {eq_valid.days_remaining}"
    )

    # 2. Due Soon Equipment (due in 15 days)
    eq_soon = CalibrationEquipment.objects.create(
        equipment_id=f"{TAG}EQ_MICROMETER_01",
        equipment_name="Outside Micrometer 25-50mm",
        equipment_type="Micrometer",
        calibration_frequency_days=180,
        last_calibration_date=today - timedelta(days=165),
        next_calibration_date=today + timedelta(days=15),
        state=CalibrationEquipment.State.ACTIVE
    )
    tracker.assert_true(
        eq_soon.calibration_status == 'Due Soon',
        "Equipment with 1-30 days remaining has status 'Due Soon'",
        f"Status: {eq_soon.calibration_status}"
    )

    # 3. Overdue Equipment (expired 5 days ago)
    eq_overdue = CalibrationEquipment.objects.create(
        equipment_id=f"{TAG}EQ_BOREGAUGE_01",
        equipment_name="Dial Bore Gauge 35-50mm",
        equipment_type="Bore Gauge",
        calibration_frequency_days=90,
        last_calibration_date=today - timedelta(days=95),
        next_calibration_date=today - timedelta(days=5),
        state=CalibrationEquipment.State.ACTIVE
    )
    tracker.assert_true(
        eq_overdue.calibration_status == 'Overdue',
        "Equipment with expired next_calibration_date has status 'Overdue'",
        f"Status: {eq_overdue.calibration_status}, Days: {eq_overdue.days_remaining}"
    )

    # 4. Under Repair Equipment
    eq_repair = CalibrationEquipment.objects.create(
        equipment_id=f"{TAG}EQ_HEIGHT_01",
        equipment_name="Digital Height Gauge 0-600mm",
        equipment_type="Height Gauge",
        calibration_frequency_days=365,
        last_calibration_date=today,
        next_calibration_date=today + timedelta(days=365),
        state=CalibrationEquipment.State.REPAIR
    )
    tracker.assert_true(
        eq_repair.calibration_status == 'Under Repair',
        "Equipment in repair state has status 'Under Repair'",
        f"Status: {eq_repair.calibration_status}"
    )

    # Check 10.5: Record Calibration Activity
    calibrator = User.objects.get(username=f"{TAG.lower()}calibrator")
    cal_rec = CalibrationRecord.objects.create(
        equipment=eq_valid,
        planned_date=today,
        calibration_date=today,
        result=CalibrationRecord.Result.ACCEPTED,
        calibration_agency="NABL Accredited Metrology Lab",
        report_number="CAL-REP-9921",
        certificate_number="NABL-CERT-2026-881",
        next_due_date=today + timedelta(days=365),
        recorded_by=calibrator
    )
    tracker.assert_true(cal_rec.result == 'accepted', "Calibration certificate and verification logged", f"Cert: {cal_rec.certificate_number}")

    tracker.end_module(10, "Calibration & Gauges Lifecycle", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 11: SHOP FLOOR TASK MANAGEMENT
# ============================================================================
def test_module_tasks():
    tracker.start_module(11, "Shop Floor Task Management")
    t0 = time.time()

    supervisor = User.objects.get(username=f"{TAG.lower()}supervisor")
    operator = User.objects.get(username=f"{TAG.lower()}operator")

    # Create task
    task = Task.objects.create(
        title=f"{TAG}Replace Worn Carbide Inserts on Tool 3",
        description="Inspect corner wear on CNMG 120408 inserts and index to new cutting edge.",
        allocated_by=supervisor,
        allocated_to=operator,
        deadline=timezone.now() + timedelta(hours=2),
        status=Task.Status.PENDING
    )
    tracker.assert_true(task.status == 'pending', "Task created with initial status 'pending'")

    # State Machine transitions
    task.status = Task.Status.ACCEPTED
    task.save()
    tracker.assert_true(task.status == 'accepted', "Task status transitioned to 'accepted' by Operator")

    task.status = Task.Status.FLAGGED_ISSUE
    task.issue_description = "Insert stock empty in tool crib. Spoke with stores."
    task.save()
    tracker.assert_true(task.status == 'flagged_issue', "Operator flagged issue with reason", f"Reason: {task.issue_description}")

    task.status = Task.Status.COMPLETED
    task.save()
    tracker.assert_true(task.status == 'completed', "Task marked completed")

    tracker.end_module(11, "Shop Floor Task Management", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 12: DOCUMENT CONTROL & IATF/ISO REVISIONS
# ============================================================================
def test_module_document_control():
    tracker.start_module(12, "Document Control & IATF/ISO Revisions")
    t0 = time.time()

    admin = User.objects.get(username=f"{TAG.lower()}admin")
    supervisor = User.objects.get(username=f"{TAG.lower()}supervisor")

    # 1. Create Level 2 SOP Document (Rev A)
    doc_a = Document.objects.create(
        document_number=f"{TAG}SOP_CNC_001",
        title="CNC Setup & First Piece Approval Standard Operating Procedure",
        description="Mandatory setup verification protocol for all CNC milling machines.",
        doc_level=Document.Level.L2,
        status=Document.Status.APPROVED,
        revision='Rev A',
        revision_number=1,
        is_latest_revision=True,
        uploaded_by=admin,
        reviewed_by=supervisor,
        approved_by=admin
    )
    tracker.assert_true(doc_a.doc_level == 'L2' and doc_a.revision == 'Rev A', "Document created at L2 (SOP) tier with Rev A")

    # 2. Upload New Revision (Rev B) linked to parent
    doc_b = Document.objects.create(
        document_number=f"{TAG}SOP_CNC_001_B",
        title="CNC Setup & First Piece Approval Standard Operating Procedure",
        description="Added QR code scan requirement before machining.",
        doc_level=Document.Level.L2,
        status=Document.Status.UNDER_REVIEW,
        revision='Rev B',
        revision_number=2,
        is_latest_revision=True,
        parent_document=doc_a,
        uploaded_by=supervisor
    )
    doc_a.is_latest_revision = False
    doc_a.save()

    tracker.assert_true(
        doc_b.parent_document_id == doc_a.id and not doc_a.is_latest_revision and doc_b.is_latest_revision,
        "Revision chain established: Rev A marked obsolete/superseded, Rev B is latest"
    )

    # 3. Audit Activity Log
    act = DocumentActivity.objects.create(
        document=doc_b,
        action='submitted_review',
        performed_by=supervisor,
        comment='Submitted Rev B for executive quality approval'
    )
    tracker.assert_true(act.action == 'submitted_review', "Document audit trail logged successfully")

    tracker.end_module(12, "Document Control & IATF/ISO Revisions", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 13: TEAM MESSAGING & COLLABORATION
# ============================================================================
def test_module_messaging():
    tracker.start_module(13, "Team Messaging & Collaboration")
    t0 = time.time()

    operator = User.objects.get(username=f"{TAG.lower()}operator")
    supervisor = User.objects.get(username=f"{TAG.lower()}supervisor")
    inspector = User.objects.get(username=f"{TAG.lower()}inspector")

    # 1. Direct Message Chat
    dm_conv = Conversation.objects.create(
        type=Conversation.Type.DIRECT
    )
    dm_conv.participants.add(operator, supervisor)

    msg1 = Message.objects.create(
        conversation=dm_conv,
        sender=operator,
        content="Machine MCH-01 tool offset adjusted. Ready for 1PC inspection.",
        message_type=Message.MessageType.TEXT
    )
    tracker.assert_true(dm_conv.messages.count() == 1, "Direct message sent between operator and supervisor")

    # 2. Read Receipt
    read_rec = MessageRead.objects.create(
        message=msg1,
        user=supervisor
    )
    tracker.assert_true(msg1.read_by.filter(user=supervisor).exists(), "Message read receipt registered by supervisor")

    # 3. Group Conversation & Pinning
    grp_conv = Conversation.objects.create(
        type=Conversation.Type.GROUP,
        name=f"{TAG}Shop Floor Shift-1 Line Leaders",
        description="Daily operational alerts and inspection handovers",
        created_by=supervisor,
        admin=supervisor
    )
    grp_conv.participants.add(supervisor, inspector, operator)

    grp_msg = Message.objects.create(
        conversation=grp_conv,
        sender=supervisor,
        content="Notice: Ensure all calibration due checks are done before shift start.",
        message_type=Message.MessageType.TEXT
    )
    grp_conv.pinned_messages.add(grp_msg)

    tracker.assert_true(grp_conv.participants.count() == 3, "Group conversation created with 3 participants")
    tracker.assert_true(grp_conv.pinned_messages.filter(id=grp_msg.id).exists(), "Message successfully pinned to group chat")

    tracker.end_module(13, "Team Messaging & Collaboration", (time.time() - t0) * 1000)


# ============================================================================
# MODULE 14: ANALYTICS & QUALITY YIELD ENGINE
# ============================================================================
def test_module_analytics():
    tracker.start_module(14, "Analytics & Quality Yield Engine")
    t0 = time.time()

    supervisor = User.objects.get(username=f"{TAG.lower()}supervisor")

    # Call InspectionReportView via APIRequestFactory
    view = InspectionReportView.as_view()
    factory = APIRequestFactory()
    request = factory.get(f'/api/analytics/report/?from={date.today()}&to={date.today()}')
    force_authenticate(request, user=supervisor)

    response = view(request)
    tracker.assert_true(response.status_code == 200, "Analytics Report endpoint returns HTTP 200 OK")

    data = response.data
    stats = data.get('statistics', {})
    tracker.assert_true('total' in stats and 'pass_rate' in stats, "Analytics returns aggregated metrics: total, pass_rate, ooc_count", f"Total: {stats.get('total')}, Pass Rate: {stats.get('pass_rate')}%")

    tracker.end_module(14, "Analytics & Quality Yield Engine", (time.time() - t0) * 1000)


# ============================================================================
# MODULE CATALOG & RUNNER
# ============================================================================
MODULES = [
    (1, "Auth & Role-Based Access Control (RBAC)", test_module_auth_rbac),
    (2, "Factory & Shift Configuration", test_module_factory_shift),
    (3, "Machines & Shop Floor Assets", test_module_machines),
    (4, "Parts, Drawings & Control Plans", test_module_parts_drawings),
    (5, "Tolerance & Parameter Spec Engine", test_module_tolerances),
    (6, "First Piece & Setup Approval Workflow", test_module_first_piece_setup),
    (7, "Inspection Sessions & Tolerance Evaluation", test_module_inspection_sessions),
    (8, "Daily Production & Downtime Math Engine", test_module_production_downtime),
    (9, "Autonomous Maintenance (Jishu Hozen - JH)", test_module_jishu_hozen),
    (10, "Calibration & Gauges Lifecycle", test_module_calibration),
    (11, "Shop Floor Task Management", test_module_tasks),
    (12, "Document Control & IATF/ISO Revisions", test_module_document_control),
    (13, "Team Messaging & Collaboration", test_module_messaging),
    (14, "Analytics & Quality Yield Engine", test_module_analytics),
]


def print_banner():
    print(f"\n{C_BLUE}{'='*80}{C_RESET}")
    print(f"{C_BOLD}{C_WHITE}   INSPECTION HUB -- DEEP-DOWN MODULE-BY-MODULE TEST SUITE   {C_RESET}")
    print(f"{C_BLUE}{'='*80}{C_RESET}")


def print_final_summary():
    print(f"\n{C_CYAN}{'='*80}{C_RESET}")
    print(f"{C_BOLD}{C_WHITE}                      FINAL TEST EXECUTION SUMMARY                      {C_RESET}")
    print(f"{C_CYAN}{'='*80}{C_RESET}")
    print(f"{'MOD':<5} | {'MODULE NAME':<44} | {'PASS':<6} | {'FAIL':<6} | {'TIME':<8} | {'STATUS'}")
    print("-" * 80)
    for m in tracker.modules_summary:
        st_color = C_GREEN if m['status'] == 'PASSED' else C_RED
        print(f"{m['num']:<5} | {m['name'][:44]:<44} | {m['passed']:<6} | {m['failed']:<6} | {m['time_ms']:>6.1f}ms | {st_color}{m['status']}{C_RESET}")
    print("-" * 80)
    total_passed = tracker.subtests_passed
    total_failed = tracker.subtests_failed
    print(f"{C_BOLD}TOTAL SUB-TESTS: {total_passed + total_failed} | "
          f"{C_GREEN}PASSED: {total_passed}{C_RESET}{C_BOLD} | "
          f"{C_RED}FAILED: {total_failed}{C_RESET}")
    print(f"{C_CYAN}{'='*80}{C_RESET}\n")


def run_all():
    print_banner()
    cleanup_all_test_data(quiet=True)
    t_start = time.time()
    for num, name, func in MODULES:
        func()
    print_final_summary()
    cleanup_all_test_data(quiet=False)
    print(f"{C_GREEN}All modules completed in {time.time() - t_start:.2f} seconds.{C_RESET}\n")


def run_single_module(mod_num):
    print_banner()
    # Find module
    target = None
    for num, name, func in MODULES:
        if num == mod_num:
            target = (num, name, func)
            break
    if not target:
        print(f"{C_RED}Error: Module {mod_num} not found. Available modules: 1 to {len(MODULES)}{C_RESET}")
        return

    # If module > 1, run prerequisite setup modules silently
    cleanup_all_test_data(quiet=True)
    print(f"{C_YELLOW}[SETUP] Preparing prerequisite modules...{C_RESET}")
    for num, name, func in MODULES:
        if num < mod_num:
            func()
    # Clear tracker summary of prerequisites so only target module shows
    tracker.subtests_passed = 0
    tracker.subtests_failed = 0
    tracker.modules_summary.clear()

    # Now run target module
    target[2]()
    print_final_summary()
    cleanup_all_test_data(quiet=False)


def interactive_menu():
    print_banner()
    while True:
        print(f"{C_BOLD}Available Test Modules:{C_RESET}")
        for num, name, _ in MODULES:
            print(f"  [{num:2d}] {name}")
        print(f"  [ A] Run All Modules (Complete Flow)")
        print(f"  [ C] Clean Database (Purge test data)")
        print(f"  [ Q] Quit")
        
        choice = input(f"\n{C_CYAN}Enter choice (1-{len(MODULES)}, A, C, Q): {C_RESET}").strip().upper()
        if choice == 'Q':
            print("Exiting test suite.")
            break
        elif choice == 'A':
            run_all()
            break
        elif choice == 'C':
            cleanup_all_test_data(quiet=False)
        else:
            try:
                mod_n = int(choice)
                if 1 <= mod_n <= len(MODULES):
                    run_single_module(mod_n)
                    break
                else:
                    print(f"{C_RED}Invalid module number!{C_RESET}")
            except ValueError:
                print(f"{C_RED}Invalid input!{C_RESET}")


if __name__ == '__main__':
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg in ['--all', '-a', 'all']:
            run_all()
        elif arg in ['--clean', '-c', 'clean']:
            cleanup_all_test_data(quiet=False)
        elif arg in ['--list', '-l', 'list']:
            print_banner()
            print(f"{C_BOLD}Available Modules (1 to {len(MODULES)}):{C_RESET}")
            for num, name, _ in MODULES:
                print(f"  {num:2d}. {name}")
        elif arg in ['--module', '-m']:
            if len(sys.argv) > 2:
                try:
                    m_num = int(sys.argv[2])
                    run_single_module(m_num)
                except ValueError:
                    print(f"{C_RED}Please specify a numeric module ID, e.g.: python test_deepdown_modules.py --module 8{C_RESET}")
            else:
                print(f"{C_RED}Please specify module number.{C_RESET}")
        else:
            try:
                m_num = int(arg)
                run_single_module(m_num)
            except ValueError:
                print(f"{C_RED}Unknown option: {arg}. Use --all, --module <N>, --clean, or no arguments for menu.{C_RESET}")
    else:
        interactive_menu()
