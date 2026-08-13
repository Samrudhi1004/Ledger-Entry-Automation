/**
 * Badge — status indicator pill
 * type: 'ok' | 'ooc' | 'approved' | 'rejected' | 'pending' | 'progress' | 'critical' | 'voice' | 'manual'
 */
const LABELS = {
  ok:            'OK',
  out_of_spec:   'OOC',
  ooc:           'OOC',
  approved:      'Approved',
  rejected:      'Rejected',
  pending:       'Pending',
  pending_review:'Pending Review',
  in_progress:   'In Progress',
  progress:      'In Progress',
  critical:      'Critical',
  voice:         'Voice',
  manual:        'Manual',
};

export default function Badge({ type, label }) {
  const cls   = type?.replace(/_/g, '-').toLowerCase();
  const text  = label ?? LABELS[type] ?? type;
  return <span className={`badge badge-${cls}`}>{text}</span>;
}
