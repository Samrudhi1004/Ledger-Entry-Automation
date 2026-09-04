import os
import sys
import django
import random
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.machines.models import Plant, Machine
from apps.parts.models import Part, InspectionTemplate, InspectionParameter
from apps.users.models import User
from apps.inspections.models import InspectionSession, DailyProductionReport, DowntimeReport
from apps.inspections.services import InspectionService

def seed_test_data():
    print("Seeding test data for 12-hour shift and Form F02 PDF verification...")

    # 1. Update Plant to 12 hours
    plant = Plant.objects.first()
    if plant:
        plant.shift_duration_hours = 12
        plant.total_break_mins = 90
        plant.save()
        print(f"Updated Plant {plant.code} to 12-hour shift (Break: 90 mins)")

    # 2. Get prerequisites
    admin = User.objects.filter(username="admin").first()
    machine = Machine.objects.filter(machine_code="CNC-01").first()
    part = Part.objects.filter(part_number="FBT00222").first()
    template = InspectionTemplate.objects.filter(part=part, is_active=True).first()

    if not all([admin, machine, part, template]):
        print("Missing base data. Please run 'python seed_fbt00222.py' first.")
        return

    svc = InspectionService()
    
    # 3. Create a Dummy Inspection Session (Form F02)
    session = svc.create_session(
        operator=admin,
        part=part,
        machine=machine,
        inspection_type="first_piece",
        shift="A",
        template_id=template.id,
        trial_number=1,
    )
    session_id = str(session.session_id)
    print(f"Started Session: {session_id}")

    # Add mock measurements
    params = InspectionParameter.objects.filter(template=template).order_by('sequence_order')
    for param in params:
        val = float(param.nominal_value) + random.uniform(-float(param.lower_tolerance or 0)/2, float(param.upper_tolerance or 0)/2)
        
        # Setup approval measurement (Trial 1)
        svc.record_measurement(
            session_id=session_id,
            parameter_code=param.parameter_code,
            measured_value=round(val, 2),
            method='form'
        )
        
        # Hourly measurements (for a few slots to populate Form F02)
        for hr in [1, 2, 4, 8, 12]:
            hr_val = float(param.nominal_value) + random.uniform(-float(param.lower_tolerance or 0), float(param.upper_tolerance or 0))
            svc.record_measurement(
                session_id=session_id,
                parameter_code=param.parameter_code,
                measured_value=round(hr_val, 2),
                method='form',
                hourly_slot=hr
            )

    svc.finalize_first_piece_session(session_id=session_id, inspector=admin)
    print("Finalized 12-hour mock Inspection Session (Form F02)")

    # 4. Create a Daily Production Report
    prod_report = DailyProductionReport.objects.create(
        date=datetime.now().date(),
        machine=machine,
        part=part,
        operation="Turning",
        shift="A",
        operator=admin,
        production_target=250, # Will be auto-calculated later in Task 3
        jobs_completed=240,
        correct_jobs=235,
        incorrect_jobs=5,
        cr_count=2,
        mr_count=3,
        rw_count=0,
        remarks="Test data for 12-hour shift"
    )

    DowntimeReport.objects.create(
        production_report=prod_report,
        no_load=15,
        no_operator=0,
        setting=45,
        total_downtime=60,
        remarks="Setting time taken for setup."
    )
    print(f"Created Daily Production & Downtime Report for {machine.machine_code}")
    print("DONE! You can now check the Dashboard.")

if __name__ == "__main__":
    seed_test_data()
