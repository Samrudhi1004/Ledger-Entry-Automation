import assert from 'node:assert/strict';
import test from 'node:test';

import { filterDashboardEquipment } from './calibrationData.js';

const equipment = [
  { equipment_id: 'VALID', status: 'Valid', days_remaining: 31 },
  { equipment_id: 'DUE-20', status: 'Due Soon', days_remaining: 20, next_calibration_date: '2026-09-18' },
  { equipment_id: 'DUE-5', status: 'Due Soon', days_remaining: 5 },
  { equipment_id: 'TODAY', status: 'Due Today', days_remaining: 0 },
  { equipment_id: 'OVERDUE', status: 'Overdue', days_remaining: -1 },
  { equipment_id: 'FAILED', status: 'Failed', days_remaining: null },
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
    filterDashboardEquipment(equipment, 'failed').map((item) => item.equipment_id),
    ['FAILED'],
  );
  assert.deepEqual(
    filterDashboardEquipment(equipment, 'date:2026-09-18').map((item) => item.equipment_id),
    ['DUE-20'],
  );
});
