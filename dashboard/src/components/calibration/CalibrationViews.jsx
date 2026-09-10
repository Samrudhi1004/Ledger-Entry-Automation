import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  CalendarClock, CircleCheckBig,
  CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  BellRing, Download, Eye, FileClock, LayoutDashboard, PackageCheck, Pencil, Plus, Printer,
  Search, ShieldCheck, Trash2, TriangleAlert, Wrench,
} from 'lucide-react';

import StatCard from '../cards/StatCard';
import Modal from '../common/Modal';
import { EquipmentFields } from './CalibrationFields';
import {
  dashboardFilterLabel, daysLabel,
  calibrationNotifications, filterDashboardEquipment, formatDate, STATUS_BADGES,
} from '../../utils/calibrationData';

const PAGE_SIZE = 20;

function CompanyReportHeader({ company, title, format }) {
  const address = [company?.address, company?.location].filter(Boolean).join(', ');
  const contact = [company?.phone, company?.contact_email].filter(Boolean).join(' | ');
  return (
    <div className="calibration-plan-document-header">
      <div><strong>{company?.name || 'Company details not configured'}</strong>{address && <small>{address}</small>}{contact && <small>{contact}</small>}{company?.gstin && <small>GSTIN: {company.gstin}</small>}</div>
      <h1>{title}</h1>
      <span>{format}</span>
    </div>
  );
}

const STATUS_COLORS = {
  valid: '#047857',
  dueSoon: '#6d28d9',
  dueToday: '#d97706',
  overdue: '#dc2626',
};

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Date(2026, month, 1).toLocaleDateString('en-IN', { month: 'long' })
);

export function CalibrationNavigation() {
  const links = [
    ['/calibration', 'Dashboard', LayoutDashboard],
    ['/calibration/equipment', 'Equipment Management', ClipboardList],
    ['/calibration/plan', 'Calibration Plan', CalendarDays],
  ];
  return (
    <nav className="calibration-nav" aria-label="Calibration module navigation">
      {links.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `calibration-nav-link${isActive ? ' active' : ''}`}>
          <Icon size={16} aria-hidden="true" /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="calibration-chart-tooltip">
      <span>{item.name}</span><strong>{item.value} equipment</strong>
    </div>
  );
}

function ChartLegend({ data, selectedFilter, onFilterChange, label }) {
  return (
    <div className="calibration-chart-legend" aria-label={label}>
      {data.map((item) => (
        <button
          key={item.filter}
          type="button"
          className={`calibration-legend-button${selectedFilter === item.filter ? ' active' : ''}`}
          onClick={() => onFilterChange(item.filter)}
          aria-pressed={selectedFilter === item.filter}
        >
          <span className="calibration-legend-swatch" style={{ background: item.color }} aria-hidden="true" />
          <span>{item.name}</span>
          <strong>{item.value}</strong>
        </button>
      ))}
    </div>
  );
}

function CalibrationYearOverview({ equipment, selectedFilter, onFilterChange }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const counts = MONTHS.map((_, month) => equipment.filter((item) =>
    item.next_calibration_date?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
  ).length);

  return (
    <section className="card calibration-calendar-card" aria-labelledby="calibration-calendar-title">
      <div className="section-header calibration-calendar-header">
        <div>
          <h2 className="section-title" id="calibration-calendar-title"><CalendarDays size={16} aria-hidden="true" /> Yearly Calibration Calendar</h2>
          <p className="text-xs text-muted mt-4">Select a month to show instruments whose next calibration is due.</p>
        </div>
        <div className="calibration-calendar-toolbar" aria-label="Calendar year controls">
          <button type="button" className="btn btn-ghost calibration-calendar-icon-button" onClick={() => setYear((value) => value - 1)} aria-label="Previous year"><ChevronLeft size={18} aria-hidden="true" /></button>
          <strong className="calibration-calendar-month" aria-live="polite">{year}</strong>
          <button type="button" className="btn btn-ghost calibration-calendar-icon-button" onClick={() => setYear((value) => value + 1)} aria-label="Next year"><ChevronRight size={18} aria-hidden="true" /></button>
          <button type="button" className="btn btn-ghost btn-sm calibration-calendar-today" onClick={() => setYear(new Date().getFullYear())}>Current year</button>
        </div>
      </div>
      <div className="calibration-month-grid" role="group" aria-label={`${year} calibration months`}>
        {MONTHS.map((name, month) => {
          const filter = `month:${year}-${String(month + 1).padStart(2, '0')}`;
          return (
            <button key={name} type="button" className={`calibration-month-card${selectedFilter === filter ? ' selected' : ''}`} onClick={() => onFilterChange(filter)} aria-pressed={selectedFilter === filter}>
              <span>{name}</span><strong>{counts[month]}</strong><small>due</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DueWindowChart({ equipment, selectedFilter, onFilterChange }) {
  const count = (filter) => filterDashboardEquipment(equipment, filter).length;
  const data = [
    { name: 'Overdue', filter: 'overdue', value: count('overdue'), color: STATUS_COLORS.overdue },
    { name: 'Today', filter: 'dueToday', value: count('dueToday'), color: STATUS_COLORS.dueToday },
    { name: '1–7 Days', filter: 'due1to7', value: count('due1to7'), color: '#ca8a04' },
    { name: '8–30 Days', filter: 'due8to30', value: count('due8to30'), color: STATUS_COLORS.dueSoon },
    { name: 'Over 30 Days', filter: 'valid', value: count('valid'), color: STATUS_COLORS.valid },
  ];

  return (
    <section className="card calibration-chart-card" aria-labelledby="due-window-title">
      <div className="section-header">
        <div><h2 className="section-title" id="due-window-title"><span className="dot" /> Calibration Due Window</h2><p className="text-xs text-muted mt-4">Non-overlapping time ranges make upcoming workload clear.</p></div>
      </div>
      {equipment.length === 0 ? (
        <div className="empty-state calibration-chart-empty"><div className="empty-state-text">No due-date data available.</div></div>
      ) : (
        <div className="calibration-chart-shell" role="img" aria-label="Equipment count grouped by calibration due window">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
              <Bar dataKey="value" name="Equipment" radius={[6, 6, 0, 0]} isAnimationActive={false} onClick={(item) => onFilterChange(item.payload?.filter)}>
                {data.map((item) => <Cell key={item.filter} fill={item.color} cursor="pointer" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <ChartLegend data={data} selectedFilter={selectedFilter} onFilterChange={onFilterChange} label="Filter by calibration due window" />
    </section>
  );
}

function DashboardEquipmentModal({ equipment, filter, onClose, openStatus }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return filterDashboardEquipment(equipment, filter).filter((item) => !query || [
      item.equipment_id, item.equipment_name, item.equipment_type,
      item.history_card_number, item.department, item.location,
    ].join(' ').toLowerCase().includes(query));
  }, [equipment, filter, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [filter, search]);

  return (
    <Modal title={`${dashboardFilterLabel(filter)} (${filtered.length})`} size="xl" onClose={onClose}>
      <label className="calibration-search calibration-modal-search">
        <span className="sr-only">Search matching equipment</span><Search size={16} aria-hidden="true" />
        <input className="form-input" type="search" placeholder="Search equipment ID, name, type, history card, department or location" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
      </label>
      {filtered.length === 0 ? (
        <div className="empty-state calibration-detail-empty"><CircleCheckBig className="empty-state-icon" aria-hidden="true" /><div className="empty-state-text">No equipment matches this filter.</div></div>
      ) : (
        <div className="table-wrapper">
          <table className="calibration-detail-table">
            <thead><tr><th>Equipment</th><th>Type</th><th>History Card No.</th><th>Department / Location</th><th>Next Calibration</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{visible.map((item) => (
              <tr key={item.id}>
                <td><span className="font-mono font-bold text-blue">{item.equipment_id}</span><br /><span className="text-xs text-muted">{item.equipment_name}</span></td>
                <td>{item.equipment_type}</td>
                <td>{item.history_card_number || '—'}</td>
                <td>{[item.department, item.location].filter(Boolean).join(' / ') || '—'}</td>
                <td>{formatDate(item.next_calibration_date)}</td>
                <td><span className={`badge ${STATUS_BADGES[item.status] ?? 'badge-manual'}`}>{item.status}</span></td>
                <td><div className="calibration-actions">
                  {item.state !== 'scrapped' && <button type="button" className="btn btn-primary btn-sm" onClick={() => { onClose(); openStatus(item); }}>{item.state === 'rejected' ? 'Choose Action' : item.state === 'repair' ? 'Recalibrate' : 'Record Result'}</button>}
                  <Link className="btn btn-ghost btn-sm" to={`/calibration/equipment/${item.id}/history`}><FileClock size={14} aria-hidden="true" /> History</Link>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {filtered.length > PAGE_SIZE && <div className="calibration-pagination" aria-label="Equipment list pages"><button className="btn btn-ghost btn-sm" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</button><span>Page {page} of {pages}</span><button className="btn btn-ghost btn-sm" type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page === pages}>Next</button></div>}
    </Modal>
  );
}

function ComplianceCard({ summary, onOpen }) {
  const percentage = Number(summary.compliance_percentage || 0);
  const needsAction = Number(summary.failed_equipment || 0) + Number(summary.repair_equipment || 0);
  return (
    <button type="button" className="card calibration-compliance-card" onClick={() => onOpen('onTime')} aria-label={`Compliance ${summary.compliance_percentage} percent. Show calibrated on time equipment.`}>
      <div className="section-header">
        <div><h2 className="section-title"><ShieldCheck size={17} aria-hidden="true" /> Calibration Compliance</h2><p className="text-xs text-muted mt-4">On-time calibrations against the current plan.</p></div>
        <strong className="calibration-compliance-percent">{summary.compliance_percentage}%</strong>
      </div>
      <div className="calibration-compliance-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} /></div>
      <div className="calibration-compliance-summary-list" aria-label="Compliance summary">
        <span>Done on time — <strong>{summary.calibrated_on_time}</strong></span>
        <span>Due soon — <strong>{summary.due_within_30_days}</strong></span>
        <span>Overdue — <strong>{summary.overdue_equipment}</strong></span>
        <span>Needs action — <strong>{needsAction}</strong></span>
      </div>
    </button>
  );
}

function DashboardEquipmentList({ equipment, openStatus }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selected = filter === 'all' ? equipment : filterDashboardEquipment(equipment, filter);
    return selected.filter((item) => !query || [
      item.equipment_id, item.equipment_name, item.equipment_type,
      item.history_card_number, item.department, item.location, item.status,
    ].join(' ').toLowerCase().includes(query));
  }, [equipment, filter, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [filter, search]);

  return (
    <section className="card calibration-dashboard-list" aria-labelledby="calibration-dashboard-list-title">
      <div className="section-header calibration-section-header">
        <div><h2 className="section-title" id="calibration-dashboard-list-title"><PackageCheck size={17} aria-hidden="true" /> Calibration Equipment List</h2><p className="text-xs text-muted mt-4">Search and filter every registered instrument.</p></div>
        <span className="text-xs text-muted">{filtered.length} matching equipment</span>
      </div>
      <div className="filter-bar calibration-toolbar calibration-dashboard-list-filters">
        <label className="calibration-search"><span className="sr-only">Search dashboard equipment</span><Search size={16} aria-hidden="true" /><input className="form-input" type="search" placeholder="Search ID, name, type, history card or location" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><span className="sr-only">Filter dashboard equipment</span><select className="form-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All equipment</option><option value="due30">Due within 30 days</option><option value="due15">Due within 15 days</option><option value="due3">Due within 3 days</option><option value="dueToday">Due today</option><option value="overdue">Overdue</option><option value="valid">Valid</option><option value="repair">Under repair</option><option value="failed">Rejected</option><option value="scrapped">Scrapped</option></select></label>
      </div>
      <div className="table-wrapper"><table className="calibration-report-table calibration-dashboard-table"><thead><tr><th>Equipment</th><th>History Card No.</th><th>Department / Location</th><th>Next Calibration</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visible.length === 0 ? <tr><td colSpan="6">No equipment matches the current filters.</td></tr> : visible.map((item) => <tr key={item.id}>
          <td><strong>{item.equipment_id}</strong><br /><span className="text-xs text-muted">{item.equipment_name}</span></td><td>{item.history_card_number || '—'}</td><td>{[item.department, item.location].filter(Boolean).join(' / ') || '—'}</td><td>{formatDate(item.next_calibration_date)}</td><td><span className={`badge ${STATUS_BADGES[item.status] ?? 'badge-manual'}`}>{item.status}</span></td><td><div className="calibration-actions">{item.state !== 'scrapped' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => openStatus(item)}>{item.state === 'rejected' ? 'Choose Action' : item.state === 'repair' ? 'Recalibrate' : 'Record Result'}</button>}<Link className="btn btn-ghost btn-sm" to={`/calibration/equipment/${item.id}/history`}><FileClock size={14} aria-hidden="true" /> History</Link></div></td>
        </tr>)}
      </tbody></table></div>
      {filtered.length > PAGE_SIZE && <div className="calibration-pagination" aria-label="Dashboard equipment pages"><button className="btn btn-ghost btn-sm" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</button><span>Page {page} of {pages}</span><button className="btn btn-ghost btn-sm" type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page === pages}>Next</button></div>}
    </section>
  );
}

function NotificationModal({ notifications, onClose }) {
  return (
    <Modal title={`Calibration Notifications (${notifications.length})`} size="lg" onClose={onClose}>
      <p className="calibration-status-help">Review these calibration items and take action before the next due date.</p>
      <div className="calibration-notification-list">
        {notifications.length === 0 ? <div className="empty-state calibration-detail-empty"><CircleCheckBig className="empty-state-icon" aria-hidden="true" /><div className="empty-state-text">No active calibration notifications.</div></div> : notifications.map((item) => (
          <Link key={item.notificationId} className={`calibration-notification-item ${item.notificationType}`} to={`/calibration/equipment/${item.id}/history`} onClick={onClose}>
            <BellRing size={18} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.message}</small></span><ChevronRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </Modal>
  );
}

export function CalibrationDashboard({ summary, equipment, selectedFilter, onFilterChange, openStatus }) {
  const cards = [
    { filter: 'all', label: 'Total Equipment', value: summary.total_equipment, sub: 'Registered assets', accent: 'var(--accent-blue)', icon: <PackageCheck /> },
    { filter: 'due30', label: 'Due Within 30 Days', value: summary.due_within_30_days, sub: 'Includes due today', accent: 'var(--accent-purple)', icon: <CalendarClock /> },
    { filter: 'overdue', label: 'Overdue Equipment', value: summary.overdue_equipment, sub: 'Past calibration date', accent: 'var(--accent-red)', alert: summary.overdue_equipment > 0, icon: <TriangleAlert /> },
    { filter: 'repair', label: 'Under Repair', value: summary.repair_equipment, sub: 'Awaiting recalibration', accent: 'var(--accent-yellow)', icon: <Wrench /> },
  ];
  const [modalFilter, setModalFilter] = useState(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notifications = useMemo(() => calibrationNotifications(equipment).sort((a, b) => (a.daysRemaining ?? -1) - (b.daysRemaining ?? -1)), [equipment]);
  const notificationFingerprint = notifications.map((item) => item.notificationId).join('|');

  useEffect(() => {
    if (!notificationFingerprint) return;
    if (sessionStorage.getItem('calibration-notifications-seen') !== notificationFingerprint) {
      sessionStorage.setItem('calibration-notifications-seen', notificationFingerprint);
      setNotificationOpen(true);
    }
  }, [notificationFingerprint]);

  const showFilteredList = (filter) => {
    if (!filter) return;
    onFilterChange(filter);
    setModalFilter(filter);
  };

  return (
    <>
      <div className="calibration-notification-toolbar">
        <span className="text-xs text-muted">{summary.total_equipment} registered equipment · {summary.repair_equipment} awaiting recalibration</span>
        <button type="button" className="calibration-notification-button" onClick={() => setNotificationOpen(true)} aria-label={`Open ${notifications.length} calibration notifications`}><BellRing size={18} aria-hidden="true" /><span>Notifications</span><strong>{notifications.length}</strong></button>
      </div>

      <div className="stat-grid calibration-stat-grid" aria-label="Calibration summary filters">
        {cards.map((card) => (
          <button
            key={card.filter}
            type="button"
            className={`calibration-stat-filter${selectedFilter === card.filter ? ' active' : ''}`}
            onClick={() => showFilteredList(card.filter)}
            aria-pressed={selectedFilter === card.filter}
            aria-label={`${card.label}: ${card.value}. Show matching equipment.`}
          >
            <StatCard label={card.label} value={card.value} sub={card.sub} accent={card.accent} alert={card.alert} icon={card.icon} />
          </button>
        ))}
      </div>

      <div className="calibration-focus-grid">
        <ComplianceCard summary={summary} onOpen={showFilteredList} />
        <DueWindowChart equipment={equipment} selectedFilter={selectedFilter} onFilterChange={showFilteredList} />
      </div>

      <CalibrationYearOverview equipment={equipment} selectedFilter={selectedFilter} onFilterChange={showFilteredList} />
      <DashboardEquipmentList equipment={equipment} openStatus={openStatus} />

      {modalFilter && <DashboardEquipmentModal equipment={equipment} filter={modalFilter} onClose={() => setModalFilter(null)} openStatus={openStatus} />}
      {notificationOpen && <NotificationModal notifications={notifications} onClose={() => setNotificationOpen(false)} />}
    </>
  );
}

export function EquipmentManagement({ equipment, filteredEquipment, search, statusFilter, setSearch, setStatusFilter, openEdit, openStatus, onRegister }) {
  return (
    <section className="card" aria-labelledby="equipment-registry-title">
      <div className="section-header calibration-section-header">
        <h2 className="section-title" id="equipment-registry-title"><span className="dot" /> Equipment Registry ({filteredEquipment.length})</h2>
        <button className="btn btn-primary" type="button" onClick={onRegister}><Plus size={16} aria-hidden="true" /> Register Equipment</button>
      </div>
      <div className="filter-bar calibration-toolbar">
        <label className="calibration-search">
          <span className="sr-only">Search equipment</span><Search size={16} aria-hidden="true" />
          <input className="form-input" type="search" placeholder="Search ID, name, type, history card, department or location" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filter by calibration status</span>
          <select className="form-select calibration-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Statuses</option><option value="Valid">Valid</option><option value="Due Soon">Due Soon</option>
            <option value="Due Today">Due Today</option><option value="Overdue">Overdue</option><option value="Rejected">Rejected</option><option value="Under Repair">Under Repair</option><option value="Scrapped">Scrapped</option>
          </select>
        </label>
      </div>
      {filteredEquipment.length === 0 ? (
        <div className="empty-state"><PackageCheck className="empty-state-icon" aria-hidden="true" /><div className="empty-state-text">{equipment.length === 0 ? 'No equipment registered yet.' : 'No equipment matches the current filters.'}</div></div>
      ) : <EquipmentTable equipment={filteredEquipment} openEdit={openEdit} openStatus={openStatus} />}
    </section>
  );
}

function EquipmentTable({ equipment, openEdit, openStatus }) {
  return (
    <div className="table-wrapper">
      <table className="calibration-table">
        <thead><tr><th>Equipment ID</th><th>Equipment Name</th><th>Equipment Type</th><th>History Card No.</th><th>Department</th><th>Location</th><th>Last Calibration</th><th>Next Calibration</th><th>Days Remaining</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{equipment.map((item) => (
          <tr key={item.id}>
            <td className="font-mono font-bold text-blue">{item.equipment_id}</td><td>{item.equipment_name}</td><td>{item.equipment_type}</td><td className="font-mono">{item.history_card_number || '—'}</td><td>{item.department || '—'}</td><td>{item.location || '—'}</td><td>{formatDate(item.last_calibration_date)}</td><td>{formatDate(item.next_calibration_date)}</td><td className={item.days_remaining < 0 ? 'text-red font-bold' : ''}>{daysLabel(item)}</td><td><span className={`badge ${STATUS_BADGES[item.status] ?? 'badge-manual'}`}>{item.status}</span></td>
            <td><div className="calibration-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} aria-label={`Edit ${item.equipment_id}`}><Pencil size={14} aria-hidden="true" /> Edit</button>
              {item.state !== 'scrapped' && <button className="btn btn-ghost btn-sm" onClick={() => openStatus(item)} aria-label={`Record calibration action for ${item.equipment_id}`}><ClipboardCheck size={14} aria-hidden="true" /> {item.state === 'rejected' ? 'Repair / Scrap' : item.state === 'repair' ? 'Recalibrate' : 'Record Result'}</button>}
              <Link className="btn btn-ghost btn-sm" to={`/calibration/equipment/${item.id}/history`} aria-label={`View history card for ${item.equipment_id}`}><FileClock size={14} aria-hidden="true" /> History</Link>
            </div></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function EquipmentRegistryForm({ formData, formError, submitting, onChange, onSubmit, onCancel, modal = false }) {
  const form = (
    <form id="calibration-registry-form" onSubmit={onSubmit}>
      <EquipmentFields formData={formData} onChange={onChange} showHistoryCardNumber historyCardReadOnly />
      <p className="text-xs text-muted mt-4">The history card number is generated automatically from the equipment ID.</p>
      {!modal && (
        <div className="calibration-form-actions">
          <Link className="btn btn-ghost" to="/calibration/equipment">Cancel</Link>
          <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Registering...' : 'Register Equipment'}</button>
        </div>
      )}
    </form>
  );

  if (modal) {
    return (
      <Modal
        title="Register Equipment"
        size="lg"
        onClose={onCancel}
        footer={(
          <>
            <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="calibration-registry-form" disabled={submitting}>{submitting ? 'Registering...' : 'Register Equipment'}</button>
          </>
        )}
      >
        <p className="text-xs text-muted mb-4">All fields marked with * are required.</p>
        {formError && <div className="calibration-notice calibration-notice-error" role="alert">{formError}</div>}
        {form}
      </Modal>
    );
  }

  return (
    <section className="card calibration-registry-card" aria-labelledby="register-equipment-title">
      <div className="section-header"><div><h2 className="section-title" id="register-equipment-title"><span className="dot" /> Equipment Details</h2><p className="text-xs text-muted mt-4">All fields marked with * are required.</p></div></div>
      {formError && <div className="calibration-notice calibration-notice-error" role="alert">{formError}</div>}
      {form}
    </section>
  );
}

function planDateCell(date, year, month) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.getFullYear() === year && parsed.getMonth() === month ? parsed.getDate() : null;
}

function planRemarks(row) {
  return [row.plan_remarks, row.record_remarks].filter(Boolean).join(' · ');
}

export function CalibrationPlanReport({ year, setYear, rows, company, openEditor, removeEntry, downloadPdf, downloadingPdf }) {
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.filter((row) => {
      const matchesSearch = !query || [row.equipment_id, row.equipment_name].join(' ').toLowerCase().includes(query);
      const matchesMonth = !monthFilter || row.planned_date?.slice(5, 7) === monthFilter;
      const days = row.planned_date ? Math.round((new Date(`${row.planned_date}T00:00:00`) - today) / 86400000) : null;
      const matchesDue = !dueFilter || (row.result === 'Planned' && {
        overdue: days < 0,
        today: days === 0,
        due3: days > 0 && days <= 3,
        due15: days > 0 && days <= 15,
        due30: days > 0 && days <= 30,
      }[dueFilter]);
      return matchesSearch && matchesMonth && matchesDue && (!resultFilter || row.result.toLowerCase() === resultFilter);
    });
  }, [dueFilter, monthFilter, resultFilter, rows, search]);
  const pages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [dueFilter, monthFilter, resultFilter, rows.length, search, year]);

  return (
    <section className="card calibration-report-card">
      <div className="section-header calibration-report-toolbar">
        <div><h2 className="section-title"><CalendarDays size={16} aria-hidden="true" /> Annual Calibration Plan</h2><p className="text-xs text-muted mt-4">Planned dates and recorded results for {year}.</p></div>
        <div className="calibration-report-actions">
          <div className="calibration-report-year" aria-label="Plan year controls">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setYear((value) => value - 1)} aria-label="Previous plan year" disabled={year <= 2000}><ChevronLeft size={16} aria-hidden="true" /></button>
            <strong>{year}</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setYear((value) => value + 1)} aria-label="Next plan year" disabled={year >= 2100}><ChevronRight size={16} aria-hidden="true" /></button>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print</button>
          <button type="button" className="btn btn-primary" onClick={() => downloadPdf({ search: search.trim(), result: resultFilter, month: monthFilter, due: dueFilter })} disabled={downloadingPdf}><Download size={16} aria-hidden="true" /> {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</button>
          <button type="button" className="btn btn-primary" onClick={() => openEditor()}><Plus size={16} aria-hidden="true" /> Add Plan Entry</button>
        </div>
      </div>
      <div className="filter-bar calibration-toolbar calibration-plan-filters">
        <label className="calibration-search"><span className="sr-only">Search annual plan</span><Search size={16} aria-hidden="true" /><input className="form-input" type="search" placeholder="Search equipment ID or name" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><span className="sr-only">Filter annual plan by result</span><select className="form-select" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option value="">All Results</option><option value="planned">Planned</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select></label>
        <label><span className="sr-only">Filter annual plan by month</span><select className="form-select" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="">All Months</option>{MONTHS.map((month, index) => <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>)}</select></label>
        <label><span className="sr-only">Filter annual plan by due window</span><select className="form-select" value={dueFilter} onChange={(event) => setDueFilter(event.target.value)}><option value="">All Due Windows</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="due3">Due within 3 days</option><option value="due15">Due within 15 days</option><option value="due30">Due within 30 days</option></select></label>
        <span className="text-xs text-muted">{filteredRows.length} matching entries</span>
      </div>
      <div className="calibration-plan-management table-wrapper" role="region" aria-label={`${year} calibration plan entries`} tabIndex="0">
        <table className="calibration-report-table">
          <thead><tr><th>Equipment</th><th>Equipment ID</th><th>Planned Date</th><th>Actual Date</th><th>Result</th><th>Remarks</th><th>Controls</th></tr></thead>
          <tbody>{filteredRows.length === 0 ? <tr><td colSpan="7">No equipment matches the selected plan filters for {year}.</td></tr> : visibleRows.map((row) => (
            <tr key={row.key}><td>{row.equipment_name}</td><td>{row.equipment_id}</td><td>{formatDate(row.planned_date)}</td><td>{formatDate(row.actual_date)}</td><td>{row.result}</td><td>{planRemarks(row) || '—'}</td><td><div className="calibration-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditor(row)}><Pencil size={14} aria-hidden="true" /> Edit</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeEntry(row)}><Trash2 size={14} aria-hidden="true" /> Remove</button></div></td></tr>
          ))}</tbody>
        </table>
      </div>
      {filteredRows.length > PAGE_SIZE && <div className="calibration-pagination"><button className="btn btn-ghost btn-sm" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</button><span>Page {page} of {pages}</span><button className="btn btn-ghost btn-sm" type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page === pages}>Next</button></div>}
      <div className="calibration-print-sheet">
        <CompanyReportHeader company={company} title={`Measuring Instrument Calibration Plan ${year}`} format={<>FORMAT NO: QA/FR/54<br />REV: 00</>} />
        <div className="table-wrapper">
          <table className="calibration-plan-template">
            <thead>
              <tr><th rowSpan="2">Sr. No.</th><th rowSpan="2">Description</th><th rowSpan="2">Equipment<br />ID</th><th rowSpan="2">Plan vs<br />Actual</th><th colSpan="12">Month</th><th rowSpan="2">Remarks</th></tr>
              <tr>{MONTHS.map((month) => <th key={month}>{month.slice(0, 3)}<br />'{String(year).slice(-2)}</th>)}</tr>
            </thead>
           <tbody>{filteredRows.length === 0 ? <tr><td colSpan="17">No equipment matches the selected plan filters.</td></tr> : filteredRows.map((row, index) => (
              <Fragment key={row.key}>
                <tr>
                   <td rowSpan="2">{index + 1}</td><td rowSpan="2">{row.equipment_name}</td><td rowSpan="2">{row.equipment_id}</td><td>Plan</td>
                  {MONTHS.map((month, monthIndex) => { const day = planDateCell(row.planned_date, year, monthIndex); return <td key={month} className={day ? 'calibration-plan-mark planned' : ''}>{day || ''}</td>; })}
                  <td rowSpan="2">{planRemarks(row)}</td>
                </tr>
                <tr><td>Actual</td>{MONTHS.map((month, monthIndex) => { const day = planDateCell(row.actual_date, year, monthIndex); return <td key={month} className={day ? `calibration-plan-mark ${row.result === 'Rejected' ? 'failed' : 'actual'}` : ''}>{day || ''}</td>; })}</tr>
              </Fragment>
            ))}</tbody>
          </table>
        </div>
        <div className="calibration-plan-signatures"><span>Prepared By</span><span>Verified By</span></div>
      </div>
    </section>
  );
}

function EquipmentDetail({ label, value }) {
  return <div><span>{label}</span><strong>{value || '—'}</strong></div>;
}

export function CalibrationHistoryCard({ data, onViewReport, downloadPdf, downloadingPdf }) {
  const equipment = data?.equipment;
  const records = data?.records ?? [];
  const company = data?.company ?? {};
  if (!equipment) return null;
  return (
    <section className="card calibration-report-card">
      <div className="section-header calibration-report-toolbar">
        <div><h2 className="section-title"><FileClock size={16} aria-hidden="true" /> Equipment History Card</h2><p className="text-xs text-muted mt-4">Permanent calibration record for {equipment.equipment_id}.</p></div>
        <div className="calibration-report-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print</button>
          <button type="button" className="btn btn-primary" onClick={downloadPdf} disabled={downloadingPdf}><Download size={16} aria-hidden="true" /> {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</button>
        </div>
      </div>
      <div className="calibration-print-sheet">
        <CompanyReportHeader company={company} title="INSTRUMENT / GAUGE HISTORY CARD" format={<>FORMAT NO: QA/FR/10<br />REV: 00</>} />
        <div className="calibration-equipment-details">
          <EquipmentDetail label="Equipment" value={equipment.equipment_name} /><EquipmentDetail label="Equipment ID" value={equipment.equipment_id} />
          <EquipmentDetail label="Type" value={equipment.equipment_type} /><EquipmentDetail label="History Card No." value={equipment.history_card_number} />
          <EquipmentDetail label="Manufacturer / Make" value={equipment.manufacturer} /><EquipmentDetail label="Model" value={equipment.model_number} />
          <EquipmentDetail label="Range / Size" value={equipment.range_size} /><EquipmentDetail label="Least Count" value={equipment.least_count} />
          <EquipmentDetail label="Frequency" value={`${equipment.calibration_frequency_days} days`} /><EquipmentDetail label="Acceptance Criteria" value={equipment.acceptance_criteria} />
          <EquipmentDetail label="Department" value={equipment.department} /><EquipmentDetail label="Location" value={equipment.location} />
          <EquipmentDetail label="Last Calibration" value={formatDate(equipment.last_calibration_date)} /><EquipmentDetail label="Next Due" value={formatDate(equipment.next_calibration_date)} />
          <EquipmentDetail label="Equipment State" value={equipment.status} />
        </div>
        <div className="table-wrapper">
          <table className="calibration-report-table calibration-history-table">
            <thead><tr><th>Date</th><th>Calibration Agency</th><th>Certificate No.</th><th>Certificate / Evidence</th><th>Traceability</th><th>Calibration Details</th><th>Result / Disposition</th><th>Next Due</th><th>Remarks</th></tr></thead>
            <tbody>{records.length === 0 ? <tr><td colSpan="9">No calibration results have been recorded yet.</td></tr> : records.map((record) => (
              <tr key={record.id}><td>{formatDate(record.calibration_date)}</td><td>{record.calibration_agency || '—'}</td><td>{record.certificate_number || '—'}</td><td>{record.has_report ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => onViewReport(record)}><Eye size={14} aria-hidden="true" /> View Certificate</button> : '—'}</td><td>{record.traceability_certificate_number || '—'}</td><td>{record.calibration_details || '—'}</td><td>{record.result === 'accepted' ? 'Accepted' : 'Rejected'}{record.disposition ? ` · ${record.disposition === 'repair' ? 'Under Repair' : 'Scrapped'}` : ''}</td><td>{formatDate(record.next_due_date)}</td><td>{record.remarks || '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
