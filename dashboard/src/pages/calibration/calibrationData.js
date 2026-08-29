export const EMPTY_FORM = {
  equipment_id: '',
  equipment_name: '',
  equipment_type: '',
  serial_number: '',
  department: '',
  location: '',
  calibration_frequency_days: '',
  last_calibration_date: '',
  next_calibration_date: '',
  remarks: '',
};

export const EMPTY_SUMMARY = {
  total_equipment: 0,
  valid_equipment: 0,
  due_within_30_days: 0,
  due_within_7_days: 0,
  overdue_equipment: 0,
  failed_equipment: 0,
};

export const STATUS_BADGES = {
  Valid: 'badge-ok',
  'Due Soon': 'badge-progress',
  'Due Today': 'badge-pending',
  Overdue: 'badge-ooc',
  Failed: 'badge-rejected',
};

export function apiErrorMessage(error, fallback) {
  const data = error.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  const firstValue = Object.values(data)[0];
  if (Array.isArray(firstValue)) return firstValue[0];
  if (typeof firstValue === 'string') return firstValue;
  if (firstValue && typeof firstValue === 'object') {
    const nested = Object.values(firstValue)[0];
    return Array.isArray(nested) ? nested[0] : String(nested);
  }
  return fallback;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function daysLabel(equipment) {
  if (equipment.status === 'Failed') return '—';
  if (equipment.days_remaining === 0) return 'Due today';
  if (equipment.days_remaining < 0) return `${Math.abs(equipment.days_remaining)} overdue`;
  return `${equipment.days_remaining} days`;
}
