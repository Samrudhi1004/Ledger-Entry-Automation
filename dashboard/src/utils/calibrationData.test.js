import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateNextCalibrationDate, calibrationNotifications, daysLabel, filterDashboardEquipment,
} from './calibrationData.js';

const equipment = [
  { equipment_id: 'VALID', state: 'active', status: 'Valid', days_remaining: 31 },
  { equipment_id: 'DUE-20', state: 'active', status: 'Due Soon', days_remaining: 20, next_calibration_date: '2026-09-18' },
  { equipment_id: 'DUE-5', state: 'active', status: 'Due Soon', days_remaining: 5 },
  { equipment_id: 'TODAY', state: 'active', status: 'Due Today', days_remaining: 0 },
  { equipment_id: 'OVERDUE', state: 'active', status: 'Overdue', days_remaining: -1 },
  { equipment_id: 'REJECTED', state: 'rejected', status: 'Rejected', days_remaining: null },
  { equipment_id: 'REPAIR', state: 'repair', status: 'Under Repair', days_remaining: null },
];

test('dashboard due windows return the exact matching equipment', () => {
  assert.deepEqual(
    filterDashboardEquipment(equipment, 'due30').map((item) => item.equipment_id),
    ['DUE-20', 'DUE-5', 'TODAY'],
  );
  assert.deepEqual(
    filterDashboardEquipment(equipment, 'due7').map((item) => item.equipment_id),
    ['DUE-5', 'TODAY'],
  );
  assert.deepEqual(
    filterDashboardEquipment(equipment, 'due3').map((item) => item.equipment_id),
    ['TODAY'],
  );
  assert.deepEqual(
    filterDashboardEquipment(equipment, 'failed').map((item) => item.equipment_id),
    ['REJECTED'],
  );
  assert.deepEqual(
    filterDashboardEquipment(equipment, 'date:2026-09-18').map((item) => item.equipment_id),
    ['DUE-20'],
  );
  assert.deepEqual(
    filterDashboardEquipment(equipment, 'month:2026-09').map((item) => item.equipment_id),
    ['DUE-20'],
  );
});

test('date calculation and emergency grouping stay deterministic', () => {
  assert.equal(calculateNextCalibrationDate('2026-01-01', 365), '2027-01-01');
  assert.deepEqual(calibrationNotifications(equipment).map((item) => item.equipment_id), [
    'DUE-20', 'DUE-5', 'TODAY', 'OVERDUE', 'REJECTED', 'REPAIR',
  ]);
  assert.equal(daysLabel({ state: 'active', status: 'Overdue', days_remaining: -1 }), '1 day overdue');
  assert.equal(daysLabel({ state: 'active', status: 'Overdue', days_remaining: -8 }), '8 days overdue');
});
