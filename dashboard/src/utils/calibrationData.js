export const EMPTY_FORM = {
  equipment_id: '',
  equipment_name: '',
  equipment_type: '',
  manufacturer: '',
  model_number: '',
  range_size: '',
  least_count: '',
  acceptance_criteria: '',
  history_card_number: '',
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
  repair_equipment: 0,
  scrapped_equipment: 0,
  compliance_percentage: 100,
};

export const STATUS_BADGES = {
  Valid: 'badge-ok',
  'Due Soon': 'badge-progress',
  'Due Today': 'badge-pending',
  Overdue: 'badge-ooc',
  Rejected: 'badge-rejected',
  'Under Repair': 'badge-pending',
  Scrapped: 'badge-manual',
};

export const DASHBOARD_FILTER_OPTIONS = [
  ['all', 'All equipment'],
  ['compliant', 'Not overdue'],
  ['valid', 'Valid equipment'],
  ['due30', 'Due within 30 days'],
  ['due15', 'Due within 15 days'],
  ['due3', 'Due within 3 days'],
  ['due7', 'Due within 7 days'],
  ['dueSoon', 'Due soon (1–30 days)'],
  ['dueToday', 'Due today'],
  ['due1to7', 'Due in 1–7 days'],
  ['due8to30', 'Due in 8–30 days'],
  ['overdue', 'Overdue equipment'],
  ['needsAction', 'Needs action'],
  ['failed', 'Rejected equipment'],
  ['repair', 'Under repair'],
  ['scrapped', 'Scrapped equipment'],
];

export const dashboardFilterLabel = (filter) => {
  if (filter?.startsWith('date:')) return `Due on ${formatDate(filter.slice(5))}`;
  if (filter?.startsWith('month:')) {
    const [year, month] = filter.slice(6).split('-').map(Number);
    return `Due in ${new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
  }
  return DASHBOARD_FILTER_OPTIONS.find(([value]) => value === filter)?.[1] ?? 'Equipment details';
};

export function filterDashboardEquipment(equipment, filter) {
  return equipment.filter((item) => {
    if (filter?.startsWith('date:')) return item.next_calibration_date === filter.slice(5);
    if (filter?.startsWith('month:')) return item.next_calibration_date?.startsWith(filter.slice(6));
    const days = Number(item.days_remaining);
    const active = item.state === 'active';
    switch (filter) {
      case 'valid': return item.status === 'Valid';
      case 'compliant': return item.status !== 'Overdue';
      case 'due30': return active && days >= 0 && days <= 30;
      case 'due15': return active && days >= 0 && days <= 15;
      case 'due3': return active && days >= 0 && days <= 3;
      case 'due7': return active && days >= 0 && days <= 7;
      case 'dueSoon': return item.status === 'Due Soon';
      case 'dueToday': return item.status === 'Due Today';
      case 'due1to7': return active && days >= 1 && days <= 7;
      case 'due8to30': return active && days >= 8 && days <= 30;
      case 'overdue': return item.status === 'Overdue';
      case 'needsAction': return item.status === 'Rejected' || item.status === 'Under Repair';
      case 'failed': return item.status === 'Rejected';
      case 'repair': return item.status === 'Under Repair';
      case 'scrapped': return item.status === 'Scrapped';
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
  if (equipment.state !== 'active') return '—';
  if (equipment.days_remaining === 0) return 'Due today';
  if (equipment.days_remaining < 0) {
    const overdueDays = Math.abs(equipment.days_remaining);
    return `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue`;
  }
  return `${equipment.days_remaining} days`;
}

export function calculateNextCalibrationDate(lastDate, frequencyDays) {
  const days = Number(frequencyDays);
  if (!lastDate || !Number.isInteger(days) || days < 1 || days > 36500) return '';
  const date = new Date(`${lastDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() > 2100) return '';
  return date.toISOString().slice(0, 10);
}
