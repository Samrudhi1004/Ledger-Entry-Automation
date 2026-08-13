"""
Seed script for Process No. 10 (Part FBT00222 POLY V PULLEY).
Exclusively configures the 18 product characteristics from Process No. 10 drawing.
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from decimal import Decimal
from apps.machines.models import Factory, Plant, Machine
from apps.parts.models import Part, InspectionTemplate, InspectionParameter
from apps.users.models import User

def seed_data():
    print("Seeding Process No. 10 (CP FBT00222 POLY V PULLEY) data...")

    # 1. Create or get Admin user
    admin_user, _ = User.objects.get_or_create(
        username="admin",
        defaults={
            "employee_id": "EMP-001",
            "email": "admin@mantri.com",
            "role": User.Role.ADMIN,
            "first_name": "Admin",
            "last_name": "User"
        }
    )

    # 2. Create Factory, Plant, Machine
    factory, _ = Factory.objects.get_or_create(
        code="MMPL-01",
        defaults={
            "name": "Mantri Metallics Pvt. Ltd.",
            "location": "Shiroli M.I.D.C., Kolhapur"
        }
    )

    plant, _ = Plant.objects.get_or_create(
        code="PLANT-01",
        factory=factory,
        defaults={
            "name": "Main Machining Plant"
        }
    )

    cnc_machine, _ = Machine.objects.get_or_create(
        machine_code="CNC-01",
        defaults={
            "name": "CNC Turinig Center 01",
            "plant": plant,
            "machine_type": "CNC",
            "manufacturer": "Ace Micromatic",
            "status": Machine.Status.ACTIVE
        }
    )

    vmc_machine, _ = Machine.objects.get_or_create(
        machine_code="VMC-01",
        defaults={
            "name": "VMC Drilling Machine 01",
            "plant": plant,
            "machine_type": "VMC",
            "manufacturer": "Haas",
            "status": Machine.Status.ACTIVE
        }
    )

    balancing_machine, _ = Machine.objects.get_or_create(
        machine_code="BAL-01",
        defaults={
            "name": "Dynamic Balancing Rig 01",
            "plant": plant,
            "machine_type": "BALANCING",
            "manufacturer": "Schenck",
            "status": Machine.Status.ACTIVE
        }
    )

    # 3. Create Part
    part, _ = Part.objects.get_or_create(
        part_number="FBT00222",
        defaults={
            "part_name": "POLY V PULLEY",
            "machine": cnc_machine,
            "drawing_number": "DRG-FBT00222-10",
            "description": "Process No. 10 — 1st Side Finish Turning",
            "created_by": admin_user
        }
    )
    

    # Deactivate any previous templates to make Process No. 10 exclusive
    InspectionTemplate.objects.filter(part=part).update(is_active=False)

    # Exclusively define Process No. 10 (18 characteristics from drawing)
    process_10_params = [
        # (Name, Code, Nominal, UpperTol, LowerTol, Unit, IsCritical, Seq, Method, Sample)
        ("TOTAL LENGTH",          "TL-01",   "105.10", "0.20",  "-0.20", "mm", False, 1,  "DEPTH VERNIER",      "5NOS/SHIFT"),
        ("O.D.",                  "OD-01",   "25.40",  "0.10",  "-0.10", "mm", True,  2,  "VERNIER CALIPER",    "100%"),
        ("CHA.",                  "CHA-01",  "0.50",   "0.10",  "-0.10", "mm", False, 3,  "VISUALLY",           "5NOS/SHIFT"),
        ("CHAMFER",               "CHM-01",  "1.00",   "0.10",  "-0.10", "mm", False, 4,  "VISUALLY",           "LAYOUT INSPECTION"),
        ("DIA",                   "DIA-01",  "15.00",  "0.20",  "-0.20", "mm", False, 5,  "PLUG GAUGE",         "5NOS/SHIFT"),
        ("O.D.",                  "OD-02",   "101.00", "0.30",  "-0.30", "mm", False, 6,  "VERNIER CALIPER",    "5NOS/SHIFT"),
        ("GROOVE ANGLE",          "GA-01",   "40.00",  "1.00",  "-1.00", "deg",False, 7,  "PROFILE PROJECTOR",  "1st PIECE/SHIFT"),
        ("GROOVE RADIUS",         "GR-01",   "0.50",   "0.15",  "-0.15", "mm", False, 8,  "PROFILE PROJECTOR",  "1st PIECE/SHIFT"),
        ("GROOVE RADIUS",         "GR-02",   "0.38",   "0.10",  "-0.10", "mm", False, 9,  "PROFILE PROJECTOR",  "1st PIECE/SHIFT"),
        ("GROOVE DISTANCE",       "GD-01",   "3.56",   "0.05",  "-0.05", "mm", True,  10, "PROFILE PROJECTOR",  "1st PIECE/SHIFT"),
        ("DISTANCE",              "DIST-01", "11.08",  "0.10",  "-0.10", "mm", False, 11, "PROFILE PROJECTOR",  "1st PIECE/SHIFT"),
        ("DISTANCE MIN",          "DIST-02", "3.30",   "0.50",  "0.00",  "mm", False, 12, "PROFILE PROJECTOR",  "1st PIECE/SHIFT"),
        ("DISTANCE",              "DIST-03", "31.52",  "0.10",  "-0.10", "mm", False, 13, "PROFILE PROJECTOR",  "1st PIECE/SHIFT"),
        ("GROOVE DIA",            "GDIA-01", "131.93", "0.50",  "-0.50", "mm", False, 14, "PROFILE PROJECTOR",  "1st PIECE/SHIFT"),
        ("GROOVE DIA OVER BALL",  "GDB-01",  "133.42", "0.50",  "-0.50", "mm", True,  15, "VERNIER CALIPER",    "100%"),
        ("CHA.",                  "CHA-02",  "2.00",   "0.10",  "-0.10", "mm", False, 16, "VISUALLY",           "LAYOUT INSPECTION"),
        ("O.D.",                  "OD-03",   "138.00", "0.30",  "-0.30", "mm", False, 17, "VERNIER CALIPER",    "5NOS/SHIFT"),
        ("SURFACE FINISH",        "SF-01",   "3.20",   "0.50",  "-0.50", "Ra", False, 18, "COMPARE WITH MASTER","LAYOUT INSPECTION"),
    ]

    template, _ = InspectionTemplate.objects.get_or_create(
        part=part,
        inspection_type=InspectionTemplate.InspectionType.FIRST_PIECE,
        version=10,
        defaults={"created_by": admin_user, "is_active": True}
    )
    template.is_active = True
    template.save()

    # Clear existing parameters for fresh seed of Process No. 10
    InspectionParameter.objects.filter(template=template).delete()

    for name, code, nominal, upper_t, lower_t, unit, critical, seq, method, sample in process_10_params:
        m_type = InspectionParameter.MeasurementType.DIMENSIONAL
        if method == "VISUALLY":
            m_type = InspectionParameter.MeasurementType.VISUAL
        elif unit == "Ra":
            m_type = InspectionParameter.MeasurementType.SURFACE

        InspectionParameter.objects.create(
            template=template,
            parameter_code=code,
            parameter_name=name,
            nominal_value=Decimal(nominal),
            upper_tolerance=Decimal(upper_t),
            lower_tolerance=Decimal(lower_t),
            unit=unit,
            measurement_type=m_type,
            is_critical=critical,
            sequence_order=seq,
            voice_prompt=f"Please record {name} ({code}) using {method}",
        )

    print(f"SUCCESS: Process No. 10 (FBT00222) exclusively active with {len(process_10_params)} parameters!")

if __name__ == "__main__":
    seed_data()
