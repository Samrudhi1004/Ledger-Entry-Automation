from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.calibration.models import CalibrationEquipment, CalibrationPlanEntry, CalibrationRecord


EQUIPMENT = [
    ('Digital Vernier Caliper', 'Dimensional', 'Mitutoyo', '500-196-30', '0-150 mm', '0.01 mm', '±0.02 mm', 'Quality', 'Metrology Lab'),
    ('Outside Micrometer', 'Dimensional', 'Mitutoyo', '103-137', '0-25 mm', '0.01 mm', '±0.004 mm', 'Quality', 'Metrology Lab'),
    ('Vernier Height Gauge', 'Dimensional', 'Baker', 'VHG-300', '0-300 mm', '0.02 mm', '±0.04 mm', 'Quality', 'Inspection Room'),
    ('Dial Indicator', 'Dimensional', 'Mitutoyo', '2046S', '0-10 mm', '0.01 mm', '±0.015 mm', 'Production', 'Machine Shop'),
    ('Dial Bore Gauge', 'Dimensional', 'Baker', 'DBG-35', '18-35 mm', '0.01 mm', '±0.02 mm', 'Production', 'Machine Shop'),
    ('Thread Plug Gauge M10', 'Thread Gauge', 'Yamawa', 'M10-6H', 'M10 x 1.5', 'GO/NO-GO', 'ISO 1502', 'Quality', 'Gauge Room'),
    ('Granite Surface Plate', 'Flatness', 'Easson', 'GSP-630', '630 x 630 mm', 'Grade 0', '5 µm', 'Quality', 'Inspection Room'),
    ('Feeler Gauge Set', 'Dimensional', 'Stanley', 'FG-20', '0.05-1.00 mm', '0.05 mm', '±0.01 mm', 'Maintenance', 'Tool Crib'),
    ('Steel Rule', 'Dimensional', 'Kristeel', 'SR-300', '0-300 mm', '1 mm', '±0.5 mm', 'Production', 'Fabrication Bay'),
    ('Measuring Tape', 'Dimensional', 'Freemans', 'MT-5M', '0-5 m', '1 mm', '±1.0 mm', 'Stores', 'Incoming Inspection'),
    ('Pressure Gauge', 'Pressure', 'Wika', 'PG-10', '0-10 bar', '0.1 bar', '±1% FS', 'Maintenance', 'Compressor Room'),
    ('Vacuum Gauge', 'Pressure', 'Baumer', 'VG-760', '-760-0 mmHg', '10 mmHg', '±1.5% FS', 'Maintenance', 'Vacuum Station'),
    ('Torque Wrench', 'Torque', 'Norbar', 'TQ-100', '20-100 N·m', '1 N·m', '±3%', 'Assembly', 'Assembly Bay 1'),
    ('Torque Screwdriver', 'Torque', 'Tohnichi', 'RTD-50', '0.5-5 N·m', '0.1 N·m', '±3%', 'Assembly', 'Assembly Bay 2'),
    ('Platform Weighing Scale', 'Mass', 'Essae', 'DS-30', '0-30 kg', '5 g', '±10 g', 'Stores', 'Dispatch Area'),
    ('Precision Balance', 'Mass', 'Shimadzu', 'TX-500', '0-500 g', '0.01 g', '±0.02 g', 'Laboratory', 'Chemical Lab'),
    ('Temperature Indicator', 'Temperature', 'Tempsens', 'TI-400', '0-400 °C', '0.1 °C', '±0.5 °C', 'Heat Treatment', 'Furnace Area'),
    ('Digital Thermometer', 'Temperature', 'Fluke', '51-II', '-50-300 °C', '0.1 °C', '±0.5 °C', 'Quality', 'Metrology Lab'),
    ('K-Type Thermocouple', 'Temperature', 'Tempsens', 'K-600', '0-600 °C', '1 °C', '±2 °C', 'Heat Treatment', 'Furnace 2'),
    ('Humidity Meter', 'Environmental', 'Testo', '608-H1', '10-95% RH', '0.1% RH', '±3% RH', 'Laboratory', 'Standards Room'),
    ('Digital Stopwatch', 'Time', 'Casio', 'HS-80TW', '0-24 h', '0.01 s', '±0.1 s/day', 'Quality', 'Inspection Room'),
    ('Laser Tachometer', 'Speed', 'Lutron', 'DT-2234C', '10-99,999 rpm', '0.1 rpm', '±0.05%', 'Maintenance', 'Machine Shop'),
    ('Sound Level Meter', 'Acoustic', 'Testo', '815', '32-130 dB', '0.1 dB', '±1.0 dB', 'EHS', 'Safety Office'),
    ('Digital Lux Meter', 'Illumination', 'Metravi', '1330', '0-200,000 lux', '1 lux', '±3%', 'EHS', 'Safety Office'),
    ('Coating Thickness Gauge', 'Thickness', 'Elcometer', '456', '0-1500 µm', '1 µm', '±2.5%', 'Quality', 'Paint Inspection'),
    ('Surface Roughness Tester', 'Surface Finish', 'Mitutoyo', 'SJ-210', 'Ra 0.05-40 µm', '0.001 µm', '±10%', 'Quality', 'Metrology Lab'),
    ('Rockwell Hardness Tester', 'Hardness', 'Fuel Instruments', 'RHT-150', '20-100 HRC', '0.5 HRC', '±1 HRC', 'Quality', 'Material Lab'),
    ('Vibration Meter', 'Vibration', 'Fluke', '805', '0.01-50 mm/s', '0.01 mm/s', '±5%', 'Maintenance', 'Condition Monitoring'),
    ('Digital Clamp Meter', 'Electrical', 'Fluke', '325', '0-400 A', '0.1 A', '±2%', 'Maintenance', 'Electrical Shop'),
    ('Digital Multimeter', 'Electrical', 'Fluke', '87-V', '0-1000 V', '0.01 V', '±0.5%', 'Maintenance', 'Electrical Shop'),
    ('Insulation Resistance Tester', 'Electrical', 'Megger', 'MIT420', '0-200 GΩ', '0.01 MΩ', '±3%', 'Maintenance', 'Electrical Shop'),
    ('Earth Resistance Tester', 'Electrical', 'Kyoritsu', '4105A', '0-2000 Ω', '0.01 Ω', '±2%', 'Maintenance', 'Utility Area'),
    ('Digital pH Meter', 'Chemical', 'Eutech', 'pH 700', '0-14 pH', '0.01 pH', '±0.02 pH', 'Laboratory', 'Chemical Lab'),
    ('Conductivity Meter', 'Chemical', 'Eutech', 'CON 700', '0-200 mS/cm', '0.01 µS/cm', '±1%', 'Laboratory', 'Chemical Lab'),
    ('Digital Flow Meter', 'Flow', 'Krohne', 'H250', '0-100 L/min', '0.1 L/min', '±1.5%', 'Maintenance', 'Utility Area'),
    ('Digital Force Gauge', 'Force', 'Mark-10', 'M5-500', '0-500 N', '0.1 N', '±0.2%', 'Quality', 'Material Lab'),
]


class Command(BaseCommand):
    help = 'Create or refresh a complete calibration demo data set.'

    @transaction.atomic
    def handle(self, *args, **options):
        today = timezone.localdate()
        current_year = today.year
        previous_year = current_year - 1
        calibrator = get_user_model().objects.filter(role='calibrator').order_by('id').first()
        passed_this_year = 0

        for index, spec in enumerate(EQUIPMENT, start=1):
            name, equipment_type, manufacturer, model, range_size, least_count, error, department, location = spec
            month = ((index - 1) % 12) + 1
            day = 5 + ((index - 1) // 12) * 9
            previous_plan = date(previous_year, month, day)
            current_plan = date(current_year, month, day)
            previous_actual = previous_plan + timedelta(days=(index - 1) % 3)
            current_actual = current_plan + timedelta(days=(index - 1) % 3)
            current_is_complete = current_actual <= today
            latest_calibration = current_actual if current_is_complete else previous_actual
            next_calibration = latest_calibration + timedelta(days=365) if current_is_complete else current_plan

            equipment, _ = CalibrationEquipment.objects.update_or_create(
                equipment_id=f'CAL-{index:03d}',
                defaults={
                    'equipment_name': name,
                    'equipment_type': equipment_type,
                    'serial_number': f'DEMO-SN-{index:04d}',
                    'manufacturer': manufacturer,
                    'model_number': model,
                    'range_size': range_size,
                    'least_count': least_count,
                    'acceptable_error': error,
                    'acceptance_criteria': f'Results must remain within {error} across the operating range.',
                    'history_card_number': f'HC-QA-{index:03d}',
                    'department': department,
                    'location': location,
                    'calibration_frequency_days': 365,
                    'last_calibration_date': latest_calibration,
                    'next_calibration_date': next_calibration,
                    'remarks': 'Demo master instrument - available for use',
                    'is_failed': False,
                    'failed_date': None,
                    'failure_remark': '',
                },
            )

            CalibrationPlanEntry.objects.update_or_create(
                equipment=equipment,
                planned_date=previous_plan,
                defaults={'remarks': f'Annual calibration plan {previous_year}'},
            )
            CalibrationPlanEntry.objects.update_or_create(
                equipment=equipment,
                planned_date=current_plan,
                defaults={'remarks': f'Annual calibration plan {current_year}'},
            )
            self._save_passed_record(
                equipment, index, previous_plan, previous_actual, current_plan,
                previous_year, calibrator,
            )

            if current_is_complete:
                passed_this_year += 1
                next_due = current_actual + timedelta(days=365)
                self._save_passed_record(
                    equipment, index, current_plan, current_actual, next_due,
                    current_year, calibrator,
                )
                CalibrationPlanEntry.objects.update_or_create(
                    equipment=equipment,
                    planned_date=next_due,
                    defaults={'remarks': f'Next calibration due after {current_year} completion'},
                )

        self.stdout.write(self.style.SUCCESS(
            f'Calibration demo data is ready: {len(EQUIPMENT)} equipment, '
            f'{len(EQUIPMENT)} passed histories for {previous_year}, '
            f'{passed_this_year} passed histories through {today:%d %b %Y}, and no failures.'
        ))

    @staticmethod
    def _save_passed_record(equipment, index, planned_date, actual_date, next_due_date, year, calibrator):
        CalibrationRecord.objects.update_or_create(
            equipment=equipment,
            report_number=f'DEMO-RPT-{year}-{index:03d}',
            defaults={
                'planned_date': planned_date,
                'calibration_date': actual_date,
                'result': CalibrationRecord.Result.PASSED,
                'calibration_agency': 'Precision Calibration Services',
                'certificate_number': f'CERT-{year}-{index:03d}',
                'traceability_certificate_number': f'TRACE-{year}-{index:03d}',
                'specified_size': equipment.range_size,
                'calibration_details': (
                    f'{equipment.equipment_name} checked across its operating range; '
                    f'all readings were within {equipment.acceptable_error}.'
                ),
                'next_due_date': next_due_date,
                'remarks': 'Passed and released for use.',
                'recorded_by': calibrator,
            },
        )
