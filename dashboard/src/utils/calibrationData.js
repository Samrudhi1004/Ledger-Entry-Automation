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

export const DASHBOARD_FILTER_OPTIONS = [
  ['all', 'All equipment'],
  ['valid', 'Valid equipment'],
  ['due30', 'Due within 30 days'],
  ['due7', 'Due within 7 days'],
  ['dueSoon', 'Due soon (1–30 days)'],
  ['dueToday', 'Due today'],
  ['due1to7', 'Due in 1–7 days'],
  ['due8to30', 'Due in 8–30 days'],
  ['overdue', 'Overdue equipment'],
  ['failed', 'Failed equipment'],
];

export const dashboardFilterLabel = (filter) => {
  if (filter?.startsWith('date:')) return `Due on ${formatDate(filter.slice(5))}`;
  return DASHBOARD_FILTER_OPTIONS.find(([value]) => value === filter)?.[1] ?? 'Equipment details';
};

export function filterDashboardEquipment(equipment, filter) {
  return equipment.filter((item) => {
    if (filter?.startsWith('date:')) return item.next_calibration_date === filter.slice(5);
    const days = Number(item.days_remaining);
    const active = item.status !== 'Failed';
    switch (filter) {
      case 'valid': return item.status === 'Valid';
      case 'due30': return active && days >= 0 && days <= 30;
      case 'due7': return active && days >= 0 && days <= 7;
      case 'dueSoon': return item.status === 'Due Soon';
      case 'dueToday': return item.status === 'Due Today';
      case 'due1to7': return active && days >= 1 && days <= 7;
      case 'due8to30': return active && days >= 8 && days <= 30;
      case 'overdue': return item.status === 'Overdue';
      case 'failed': return item.status === 'Failed';
      default: return true;
    }
  });
}

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
