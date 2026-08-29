from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import CalibrationEquipment
from .serializers import CalibrationEquipmentSerializer


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
            {'failed_date': '2026-08-27', 'failure_remark': 'Damaged measuring jaw'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.equipment.refresh_from_db()
        self.assertTrue(self.equipment.is_failed)
        self.assertEqual(self.equipment.failure_remark, 'Damaged measuring jaw')
        self.assertTrue(CalibrationEquipment.objects.filter(pk=self.equipment.pk).exists())

    def test_mark_passed_reactivates_equipment_and_schedules_next_calibration(self):
        self.equipment.is_failed = True
        self.equipment.failed_date = date(2026, 8, 20)
        self.equipment.failure_remark = 'Temporary failure'
        self.equipment.calibration_frequency_days = 30
        self.equipment.save()

        response = self.client.post(
            reverse('calibration-equipment-mark-passed', args=[self.equipment.pk]),
            {'passed_date': '2026-08-27'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.equipment.refresh_from_db()
        self.assertFalse(self.equipment.is_failed)
        self.assertEqual(self.equipment.last_calibration_date, date(2026, 8, 27))
        self.assertEqual(self.equipment.next_calibration_date, date(2026, 9, 26))
        self.assertIsNone(self.equipment.failed_date)
        self.assertEqual(self.equipment.failure_remark, '')

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
