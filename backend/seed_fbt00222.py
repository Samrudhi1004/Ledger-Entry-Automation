"""
Seed script for Part FBT00222 (POLY V PULLEY) from Process Control Plan CP FBT00222.
"""
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from decimal import Decimal
from apps.machines.models import Factory, Plant, Machine
from apps.parts.models import Part, InspectionTemplate, InspectionParameter
from apps.users.models import User

def seed_data():
    print("Seeding CP FBT00222 (POLY V PULLEY) data...")

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
            "name": "CNC Turning Center 01",
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
            "drawing_number": "DRG-FBT00222",
            "description": "Poly V Pulley for engine drive system",
            "created_by": admin_user
        }
    )

    # Define operations from PDF
    operations_data = [
        {
            "version": 10,
            "type": InspectionTemplate.InspectionType.FIRST_PIECE,
            "name": "Op 10 — 1st Side Finish Turning",
            "parameters": [
                ("Total Length", "TL-01", "105.1", "0.2", "-0.2", "mm", False, 1),
                ("O.D.", "OD-01", "25.4", "0.1", "-0.1", "mm", True, 2),
                ("CHA.", "CHA-01", "0.5", "0.0", "0.0", "deg", False, 3),
                ("Chamfer", "CHM-01", "1.0", "0.0", "0.0", "mm", False, 4),
                ("DIA", "DIA-01", "15.0", "0.02", "-0.02", "mm", True, 5),
                ("O.D.", "OD-02", "101.0", "0.3", "-0.3", "mm", False, 6),
                ("Groove Angle", "GA-01", "40.0", "1.0", "-1.0", "deg", False, 7),
                ("Groove Radius", "GR-01", "0.50", "0.25", "-0.25", "mm", False, 8),
                ("Groove Radius", "GR-02", "0.38", "0.1", "-0.1", "mm", False, 9),
                ("Groove Distance", "GD-01", "3.56", "0.05", "-0.05", "mm", True, 10),
                ("Distance", "DIST-01", "11.08", "0.1", "-0.1", "mm", False, 11),
                ("Distance Min", "DIST-02", "3.30", "1.0", "0.0", "mm", False, 12),
                ("Distance", "DIST-03", "31.52", "0.2", "-0.2", "mm", False, 13),
                ("Groove DIA", "GDIA-01", "130.93", "0.5", "-0.5", "mm", False, 14),
                ("Groove DIA Over Ball", "GDB-01", "133.42", "0.5", "-0.5", "mm", True, 15),
                ("CHA.", "CHA-02", "2.0", "0.0", "0.0", "deg", False, 16),
                ("O.D.", "OD-03", "138.0", "0.3", "-0.3", "mm", False, 17),
                ("Surface Finish", "SF-01", "3.2", "0.8", "-0.8", "Ra", False, 18),
            ]
        },
        {
            "version": 20,
            "type": InspectionTemplate.InspectionType.FIRST_PIECE,
            "name": "Op 20 — 2nd Side Finish Turning",
            "parameters": [
                ("Total Length", "TL-02", "102.1", "0.2", "-0.2", "mm", False, 1),
                ("Depth", "DEP-01", "45.5", "0.05", "-0.05", "mm", False, 2),
                ("Depth", "DEP-02", "5.0", "0.5", "-0.5", "mm", False, 3),
                ("Depth", "DEP-03", "56.0", "0.5", "-0.5", "mm", False, 4),
                ("I.B.", "IB-01", "46.0", "0.05", "0.03", "mm", True, 5),
                ("I.B.", "IB-02", "87.0", "0.2", "-0.2", "mm", False, 6),
                ("I.B.", "IB-03", "117.5", "0.3", "-0.3", "mm", False, 7),
                ("Depth", "DEP-04", "5.0", "1.0", "-1.0", "mm", False, 8),
                ("Casting Ref.", "CREF-01", "26.6", "0.5", "-0.5", "mm", False, 9),
                ("Chamfer", "CHM-02", "1.0", "0.0", "0.0", "mm", False, 10),
                ("Angle", "ANG-01", "45.0", "1.0", "-1.0", "deg", False, 11),
                ("Depth", "DEP-05", "46.1", "0.05", "-0.05", "mm", True, 12),
                ("Groove Distance", "GD-02", "35.0", "0.2", "-0.2", "mm", True, 13),
                ("Concentricity", "CNC-01", "0.05", "0.0", "-0.05", "mm", False, 14),
                ("Runout", "RNT-01", "0.05", "0.0", "-0.05", "mm", False, 15),
                ("Perpendicularity", "PRP-01", "0.05", "0.0", "-0.05", "mm", False, 16),
                ("Flatness", "FLT-01", "0.05", "0.0", "-0.05", "mm", False, 17),
                ("Surface Finish", "SF-02", "3.2", "0.8", "-0.8", "Ra", False, 18),
            ]
        },
        {
            "version": 30,
            "type": InspectionTemplate.InspectionType.FIRST_PIECE,
            "name": "Op 30 — Drilling (VMC)",
            "parameters": [
                ("Hole Size", "HS-01", "9.0", "0.25", "0.0", "mm", True, 1),
                ("PCD", "PCD-01", "62.0", "0.25", "-0.25", "mm", False, 2),
                ("Pre Hole DIA", "PHD-01", "8.75", "0.1", "-0.1", "mm", False, 3),
                ("Pre Hole Depth", "PHDP-01", "25.0", "0.5", "-0.5", "mm", False, 4),
                ("Tapping", "TAP-01", "10.0", "0.0", "0.0", "mm", True, 5),
                ("Tapping Depth", "TAPDP-01", "20.0", "0.5", "-0.5", "mm", False, 6),
                ("Spot Face", "SPF-01", "22.0", "0.2", "-0.2", "mm", False, 7),
                ("Spot Face Depth", "SPFDP-01", "2.0", "0.1", "-0.1", "mm", False, 8),
            ]
        },
        {
            "version": 40,
            "type": InspectionTemplate.InspectionType.FIRST_PIECE,
            "name": "Op 40 — Balancing",
            "parameters": [
                ("Hole Size", "HS-02", "8.0", "0.2", "-0.2", "mm", False, 1),
                ("Hole Depth Max", "HDM-01", "6.0", "0.0", "-6.0", "mm", False, 2),
                ("PCD", "PCD-02", "100.0", "0.5", "-0.5", "mm", False, 3),
                ("Unbalancing Max", "UNB-01", "6.0", "0.0", "-6.0", "g", True, 4),
            ]
        },
        {
            "version": 50,
            "type": InspectionTemplate.InspectionType.HOURLY,
            "name": "Op 50 — Powder Coating",
            "parameters": [
                ("Dry Film Thickness (DFT)", "DFT-01", "0.019", "0.001", "-0.001", "mm", True, 1),
            ]
        },
        {
            "version": 60,
            "type": InspectionTemplate.InspectionType.FINAL,
            "name": "Op 60 — Final Inspection",
            "parameters": [
                ("O.D.", "F-OD-01", "25.4", "0.1", "-0.1", "mm", True, 1),
                ("I.B.", "F-IB-01", "46.0", "0.05", "0.03", "mm", True, 2),
                ("Hole Size", "F-HS-01", "9.0", "0.25", "0.0", "mm", False, 3),
                ("Tapping", "F-TAP-01", "10.0", "0.0", "0.0", "mm", False, 4),
                ("Tapping Depth", "F-TDP-01", "20.0", "0.5", "-0.5", "mm", False, 5),
                ("Unbalancing Max", "F-UNB-01", "6.0", "0.0", "-6.0", "g", True, 6),
                ("Physical Condition", "F-PHY-01", "1.0", "0.0", "0.0", "visual", False, 7),
            ]
        }
    ]

    total_params_count = 0
    for op in operations_data:
        template, created = InspectionTemplate.objects.get_or_create(
            part=part,
            inspection_type=op["type"],
            version=op["version"],
            defaults={"created_by": admin_user, "is_active": True}
        )

        for name, code, nominal, upper_t, lower_t, unit, critical, seq in op["parameters"]:
            param, _ = InspectionParameter.objects.get_or_create(
                template=template,
                parameter_code=code,
                defaults={
                    "parameter_name": name,
                    "nominal_value": Decimal(nominal),
                    "upper_tolerance": Decimal(upper_t),
                    "lower_tolerance": Decimal(lower_t),
                    "unit": unit,
                    "is_critical": critical,
                    "sequence_order": seq
                }
            )
            total_params_count += 1

    print(f"SUCCESS: Seeded Part {part.part_number} with {len(operations_data)} operations and {total_params_count} parameters!")

if __name__ == "__main__":
    seed_data()
