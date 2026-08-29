import os
import django
import sys
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.parts.models import Machine, Part, InspectionTemplate, InspectionParameter, ProcessParameter

def seed_data():
    # 1. Ensure we have an admin and a supervisor
    supervisor = User.objects.filter(role='SUPERVISOR').first()
    if not supervisor:
        print("No supervisor found. Please run create_test_users.py first.")
        return

    # 2. Create a Machine
    machine, _ = Machine.objects.get_or_create(
        machine_code='CNC-001',
        defaults={'name': 'Haas VF-2', 'location': 'Main Plant #1', 'created_by': supervisor}
    )

    # 3. Create a Part
    part, _ = Part.objects.get_or_create(
        part_number='FBT00222',
        defaults={'part_name': 'POLY V PULLEY', 'machine': machine, 'created_by': supervisor}
    )

    # 4. Create an Inspection Template (Operation)
    template, _ = InspectionTemplate.objects.get_or_create(
        part=part,
        inspection_type='first_piece',
        version=1,
        defaults={'name': 'OP-10 Turning', 'created_by': supervisor, 'is_active': True}
    )

    # 5. Create some Product Parameters
    InspectionParameter.objects.get_or_create(
        template=template,
        parameter_code='OD-1',
        defaults={
            'parameter_name': 'Outer Diameter',
            'unit': 'mm',
            'nominal_value': 45.0,
            'upper_tolerance': 0.05,
            'lower_tolerance': 0.05,
            'measurement_type': 'variable',
            'sequence_order': 1
        }
    )

    InspectionParameter.objects.get_or_create(
        template=template,
        parameter_code='ID-1',
        defaults={
            'parameter_name': 'Inner Bore Diameter',
            'unit': 'mm',
            'nominal_value': 20.0,
            'upper_tolerance': 0.02,
            'lower_tolerance': 0.02,
            'measurement_type': 'variable',
            'sequence_order': 2
        }
    )

    # 6. Create some Process Parameters
    ProcessParameter.objects.get_or_create(
        template=template,
        parameter_code='SP-1',
        defaults={
            'parameter_name': 'Spindle Speed',
            'unit': 'RPM',
            'nominal_value': 1200,
            'upper_tolerance': 50,
            'lower_tolerance': 50,
            'data_type': 'numeric',
            'sequence_order': 1
        }
    )

    print("Seed complete! Added dummy Machine, Part, Operation, and Parameters.")

if __name__ == '__main__':
    seed_data()
