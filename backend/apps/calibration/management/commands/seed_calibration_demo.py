from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.calibration.models import CalibrationEquipment


class Command(BaseCommand):
    help = 'Create or refresh calibration equipment demo records.'

    def handle(self, *args, **options):
        today = timezone.localdate()
        records = [
            ('CAL-001', 'Digital Vernier Caliper', 'Dimensional', 'DVC-2026-001', 'Quality', 'Metrology Lab', 365, -245, 120, 'Master vernier for final inspection', False),
            ('CAL-002', 'Outside Micrometer', 'Dimensional', 'MIC-2026-014', 'Production', 'Line A Tool Room', 180, -160, 20, '0-25 mm range', False),
            ('CAL-003', 'Pressure Gauge', 'Pressure', 'PG-2026-008', 'Maintenance', 'Compressor Room', 90, -85, 5, 'Main compressor reference gauge', False),
            ('CAL-004', 'Torque Wrench', 'Torque', 'TW-2026-022', 'Assembly', 'Assembly Bay 2', 180, -180, 0, 'Due for calibration today', False),
            ('CAL-005', 'Granite Surface Plate', 'Flatness', 'GSP-2026-003', 'Quality', 'Inspection Room', 365, -377, -12, 'Calibration booking pending', False),
            ('CAL-006', 'Precision Weighing Scale', 'Mass', 'PWS-2026-006', 'Laboratory', 'Chemical Lab', 180, -40, 140, 'Removed from service after unstable readings', True),
        ]

        for equipment_id, name, equipment_type, serial, department, location, frequency, last_offset, next_offset, remarks, failed in records:
            CalibrationEquipment.objects.update_or_create(
                equipment_id=equipment_id,
                defaults={
                    'equipment_name': name,
                    'equipment_type': equipment_type,
                    'serial_number': serial,
                    'department': department,
                    'location': location,
                    'calibration_frequency_days': frequency,
                    'last_calibration_date': today + timedelta(days=last_offset),
                    'next_calibration_date': today + timedelta(days=next_offset),
                    'remarks': remarks,
                    'is_failed': failed,
                    'failed_date': today - timedelta(days=2) if failed else None,
                    'failure_remark': 'Unstable readings during verification' if failed else '',
                },
            )

        self.stdout.write(self.style.SUCCESS('Calibration demo data is ready (6 records).'))
