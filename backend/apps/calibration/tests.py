from datetime import date, timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import CalibrationEquipment, CalibrationPlanEntry, CalibrationRecord
from .serializers import CalibrationEquipmentSerializer


class CalibrationDemoDataTests(TestCase):
    @patch(
        'apps.calibration.management.commands.seed_calibration_demo.timezone.localdate',
        return_value=date(2026, 9, 3),
    )
    def test_demo_seed_is_complete_and_idempotent(self, _localdate):
        output = StringIO()
        call_command('seed_calibration_demo', stdout=output)
        call_command('seed_calibration_demo', stdout=output)

        demo = CalibrationEquipment.objects.filter(equipment_id__startswith='CAL-')
        self.assertEqual(demo.count(), 36)
        self.assertEqual(demo.filter(is_failed=True).count(), 0)
        self.assertEqual(CalibrationPlanEntry.objects.filter(
            equipment__in=demo, planned_date__year=2025,
        ).count(), 36)
        self.assertEqual(CalibrationPlanEntry.objects.filter(
            equipment__in=demo, planned_date__year=2026,
        ).count(), 36)
        self.assertEqual(CalibrationRecord.objects.filter(
            equipment__in=demo, calibration_date__year=2025, result='passed',
        ).count(), 36)
        self.assertEqual(CalibrationRecord.objects.filter(
            equipment__in=demo, calibration_date__year=2026, result='passed',
        ).count(), 24)


def equipment_data(**overrides):
    data = {
        'equipment_id': 'EQ-001',
        'equipment_name': 'Digital Vernier Caliper',
        'equipment_type': 'Dimensional',
        'serial_number': 'SN-001',
        'department': 'Quality',
        'location': 'Lab 1',
        'calibration_frequency_days': 365,
        'last_calibration_date': date(2026, 1, 1),
        'next_calibration_date': date(2027, 1, 1),
        'remarks': '',
    }
    data.update(overrides)
    return data


class CalibrationEquipmentStatusTests(TestCase):
    def test_status_boundaries_and_failed_override(self):
        today = date(2026, 8, 27)
        equipment = CalibrationEquipment(**equipment_data(next_calibration_date=today + timedelta(days=31)))

        with patch('apps.calibration.models.timezone.localdate', return_value=today):
            self.assertEqual(equipment.calibration_status, 'Valid')
            equipment.next_calibration_date = today + timedelta(days=30)
            self.assertEqual(equipment.calibration_status, 'Due Soon')
            equipment.next_calibration_date = today
            self.assertEqual(equipment.calibration_status, 'Due Today')
            equipment.next_calibration_date = today - timedelta(days=1)
            self.assertEqual(equipment.calibration_status, 'Overdue')
            equipment.is_failed = True
            self.assertEqual(equipment.calibration_status, 'Failed')
            self.assertIsNone(equipment.days_remaining)

    def test_next_calibration_must_follow_last_calibration(self):
        serializer = CalibrationEquipmentSerializer(data=equipment_data(
            next_calibration_date=date(2026, 1, 1),
        ))
        self.assertFalse(serializer.is_valid())
        self.assertIn('next_calibration_date', serializer.errors)

    def test_frequency_must_be_at_least_one_day(self):
        serializer = CalibrationEquipmentSerializer(data=equipment_data(
            calibration_frequency_days=0,
        ))
        self.assertFalse(serializer.is_valid())
        self.assertIn('calibration_frequency_days', serializer.errors)


class CalibrationEquipmentApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='calibration-tester',
            password='test-password',
            email='calibration@example.com',
            employee_id='CAL-TEST-1',
            role=user_model.Role.CALIBRATOR,
        )
        self.client.force_authenticate(self.user)
        self.equipment = CalibrationEquipment.objects.create(**equipment_data())

    def test_mark_failed_preserves_equipment(self):
        response = self.client.post(
            reverse('calibration-equipment-mark-failed', args=[self.equipment.pk]),
            {
                'failed_date': '2026-08-27',
                'failure_remark': 'Damaged measuring jaw',
                'calibration_agency': 'ABC Labs',
                'report_number': 'RPT-9',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.equipment.refresh_from_db()
        self.assertTrue(self.equipment.is_failed)
        self.assertEqual(self.equipment.failure_remark, 'Damaged measuring jaw')
        self.assertTrue(CalibrationEquipment.objects.filter(pk=self.equipment.pk).exists())
        record = CalibrationRecord.objects.get(equipment=self.equipment)
        self.assertEqual(record.result, CalibrationRecord.Result.FAILED)
        self.assertEqual(record.planned_date, date(2027, 1, 1))
        self.assertEqual(record.calibration_agency, 'ABC Labs')
        self.assertEqual(record.report_number, 'RPT-9')
        self.assertEqual(record.recorded_by, self.user)

    def test_registering_equipment_creates_its_initial_plan(self):
        response = self.client.post(
            reverse('calibration-equipment-list'),
            equipment_data(
                equipment_id='EQ-AUTO-PLAN',
                serial_number='SN-AUTO-PLAN',
                next_calibration_date=date(2027, 6, 15),
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        equipment = CalibrationEquipment.objects.get(equipment_id='EQ-AUTO-PLAN')
        self.assertTrue(CalibrationPlanEntry.objects.filter(
            equipment=equipment,
            planned_date=date(2027, 6, 15),
        ).exists())

    def test_mark_passed_reactivates_equipment_and_schedules_next_calibration(self):
        self.equipment.is_failed = True
        self.equipment.failed_date = date(2026, 8, 20)
        self.equipment.failure_remark = 'Temporary failure'
        self.equipment.calibration_frequency_days = 30
        self.equipment.save()

        response = self.client.post(
            reverse('calibration-equipment-mark-passed', args=[self.equipment.pk]),
            {
                'passed_date': '2026-08-27',
                'certificate_number': 'CERT-101',
                'report_file': SimpleUploadedFile(
                    'calibration-report.pdf', b'%PDF-1.4 test report', content_type='application/pdf'
                ),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.equipment.refresh_from_db()
        self.assertFalse(self.equipment.is_failed)
        self.assertEqual(self.equipment.last_calibration_date, date(2026, 8, 27))
        self.assertEqual(self.equipment.next_calibration_date, date(2026, 9, 26))
        self.assertIsNone(self.equipment.failed_date)
        self.assertEqual(self.equipment.failure_remark, '')
        record = CalibrationRecord.objects.get(equipment=self.equipment)
        self.assertEqual(record.result, CalibrationRecord.Result.PASSED)
        self.assertEqual(record.next_due_date, date(2026, 9, 26))
        self.assertEqual(record.certificate_number, 'CERT-101')
        self.assertEqual(record.report_file_name, 'calibration-report.pdf')
        self.assertEqual(bytes(record.report_file), b'%PDF-1.4 test report')
        self.assertTrue(CalibrationPlanEntry.objects.filter(
            equipment=self.equipment,
            planned_date=date(2026, 9, 26),
        ).exists())

        download = self.client.get(reverse('calibration-report-download', args=[record.pk]))
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.content, b'%PDF-1.4 test report')
        self.assertIn('attachment;', download['Content-Disposition'])

    def test_pass_rejects_unsupported_report_file(self):
        response = self.client.post(
            reverse('calibration-equipment-mark-passed', args=[self.equipment.pk]),
            {
                'passed_date': '2026-08-27',
                'report_file': SimpleUploadedFile(
                    'report.html', b'<script>alert(1)</script>', content_type='text/html'
                ),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(CalibrationRecord.objects.filter(equipment=self.equipment).exists())

    def test_history_and_plan_return_permanent_records(self):
        CalibrationPlanEntry.objects.create(
            equipment=self.equipment,
            planned_date=date(2026, 8, 25),
            remarks='Annual calibration',
        )
        record = CalibrationRecord.objects.create(
            equipment=self.equipment,
            planned_date=date(2026, 8, 25),
            calibration_date=date(2026, 8, 27),
            result=CalibrationRecord.Result.PASSED,
            certificate_number='CERT-2026',
            next_due_date=date(2027, 8, 27),
            recorded_by=self.user,
        )

        history_response = self.client.get(
            reverse('calibration-equipment-history', args=[self.equipment.pk])
        )
        plan_response = self.client.get(reverse('calibration-plan'), {'year': 2026})

        self.assertEqual(history_response.status_code, 200)
        self.assertEqual(history_response.data['records'][0]['id'], record.pk)
        self.assertEqual(history_response.data['equipment']['equipment_id'], 'EQ-001')
        self.assertEqual(plan_response.status_code, 200)
        self.assertEqual(plan_response.data['rows'][0]['certificate_number'], 'CERT-2026')
        self.assertEqual(plan_response.data['rows'][0]['remarks'], 'Annual calibration')

    def test_calibration_plan_entries_can_be_added_edited_and_removed(self):
        create_response = self.client.post(reverse('calibration-plan'), {
            'equipment': self.equipment.pk,
            'planned_date': '2027-03-15',
            'remarks': 'Initial plan',
        }, format='json')

        self.assertEqual(create_response.status_code, 201)
        entry_id = create_response.data['id']
        update_response = self.client.patch(
            reverse('calibration-plan-detail', args=[entry_id]),
            {'planned_date': '2027-04-10', 'remarks': 'Revised plan'},
            format='json',
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.data['planned_date'], '2027-04-10')

        duplicate_response = self.client.post(reverse('calibration-plan'), {
            'equipment': self.equipment.pk,
            'planned_date': '2027-04-10',
        }, format='json')
        self.assertEqual(duplicate_response.status_code, 400)

        delete_response = self.client.delete(
            reverse('calibration-plan-detail', args=[entry_id])
        )
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(CalibrationPlanEntry.objects.filter(pk=entry_id).exists())
        self.assertTrue(CalibrationEquipment.objects.filter(pk=self.equipment.pk).exists())

    def test_equipment_detail_does_not_allow_delete(self):
        response = self.client.delete(
            reverse('calibration-equipment-detail', args=[self.equipment.pk])
        )
        self.assertEqual(response.status_code, 405)

    def test_non_calibrator_cannot_access_calibration_api(self):
        user_model = get_user_model()
        operator = user_model.objects.create_user(
            username='operator-test',
            password='test-password',
            employee_id='OP-TEST-1',
            role=user_model.Role.OPERATOR,
        )
        self.client.force_authenticate(operator)

        response = self.client.get(reverse('calibration-equipment-list'))

        self.assertEqual(response.status_code, 403)

    def test_future_failed_date_is_rejected(self):
        future_date = timezone.localdate() + timedelta(days=1)

        response = self.client.post(
            reverse('calibration-equipment-mark-failed', args=[self.equipment.pk]),
            {'failed_date': future_date.isoformat()},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.equipment.refresh_from_db()
        self.assertFalse(self.equipment.is_failed)

    def test_future_passed_date_is_rejected(self):
        future_date = timezone.localdate() + timedelta(days=1)

        response = self.client.post(
            reverse('calibration-equipment-mark-passed', args=[self.equipment.pk]),
            {'passed_date': future_date.isoformat()},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.equipment.refresh_from_db()
        self.assertEqual(self.equipment.last_calibration_date, date(2026, 1, 1))

    def test_summary_counts_date_groups_and_failed_equipment(self):
        today = date(2026, 8, 27)
        rows = [
            ('EQ-VALID', 'SN-VALID', today + timedelta(days=31), False),
            ('EQ-30', 'SN-30', today + timedelta(days=30), False),
            ('EQ-7', 'SN-7', today + timedelta(days=7), False),
            ('EQ-TODAY', 'SN-TODAY', today, False),
            ('EQ-OVERDUE', 'SN-OVERDUE', today - timedelta(days=1), False),
            ('EQ-FAILED', 'SN-FAILED', today + timedelta(days=100), True),
        ]
        for equipment_id, serial_number, due_date, is_failed in rows:
            CalibrationEquipment.objects.create(**equipment_data(
                equipment_id=equipment_id,
                serial_number=serial_number,
                next_calibration_date=due_date,
                is_failed=is_failed,
            ))

        with patch('apps.calibration.views.timezone.localdate', return_value=today):
            response = self.client.get(reverse('calibration-summary'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {
            'total_equipment': 7,
            'valid_equipment': 2,
            'due_within_30_days': 3,
            'due_within_7_days': 2,
            'overdue_equipment': 1,
            'failed_equipment': 1,
        })
