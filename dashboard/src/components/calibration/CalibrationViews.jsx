import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlarmClock, CalendarClock, CircleCheckBig, CircleX,
  CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  LayoutDashboard, PackageCheck, Pencil, Plus,
  Search, TriangleAlert,
} from 'lucide-react';

import StatCard from '../cards/StatCard';
import { EquipmentFields } from './CalibrationFields';
import {
  DASHBOARD_FILTER_OPTIONS, dashboardFilterLabel, daysLabel,
  filterDashboardEquipment, formatDate, STATUS_BADGES,
} from '../../utils/calibrationData';

const STATUS_COLORS = {
  valid: '#047857',
  dueSoon: '#6d28d9',
  dueToday: '#d97706',
  overdue: '#dc2626',
  failed: '#991b1b',
};

const EQUIPMENT_STATUS_COLORS = {
  Valid: STATUS_COLORS.valid,
  'Due Soon': STATUS_COLORS.dueSoon,
  'Due Today': STATUS_COLORS.dueToday,
  Overdue: STATUS_COLORS.overdue,
  Failed: STATUS_COLORS.failed,
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function localDateKey(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function CalibrationNavigation() {
  const links = [
    ['/calibration', 'Dashboard', LayoutDashboard],
    ['/calibration/equipment', 'Equipment Management', ClipboardList],
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

function CalibrationCalendar({ equipment, selectedFilter, onFilterChange }) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = 42;
  const todayKey = localDateKey(new Date());
  const equipmentByDate = equipment.reduce((dates, item) => {
    if (!item.next_calibration_date) return dates;
    dates[item.next_calibration_date] = [...(dates[item.next_calibration_date] ?? []), item];
    return dates;
  }, {});
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const monthLabel = visibleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const moveMonth = (amount) => setVisibleMonth(new Date(year, month + amount, 1));
  const showCurrentMonth = () => {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <section className="card calibration-calendar-card" aria-labelledby="calibration-calendar-title">
      <div className="section-header calibration-calendar-header">
        <div>
          <h2 className="section-title" id="calibration-calendar-title"><CalendarDays size={16} aria-hidden="true" /> Calibration Calendar</h2>
          <p className="text-xs text-muted mt-4">Hover or focus a marked date for equipment details. Select it to filter the list.</p>
        </div>
        <div className="calibration-calendar-toolbar" aria-label="Calendar month controls">
          <button type="button" className="btn btn-ghost calibration-calendar-icon-button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} aria-hidden="true" /></button>
          <strong className="calibration-calendar-month" aria-live="polite">{monthLabel}</strong>
          <button type="button" className="btn btn-ghost calibration-calendar-icon-button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={18} aria-hidden="true" /></button>
          <button type="button" className="btn btn-ghost btn-sm calibration-calendar-today" onClick={showCurrentMonth}>Today</button>
        </div>
      </div>

      <div className="calibration-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calibration-calendar-grid" role="group" aria-label={`${monthLabel} calibration due dates`}>
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} className="calibration-calendar-blank" aria-hidden="true" />;
          const dateKey = localDateKey(new Date(year, month, day));
          const dateEquipment = equipmentByDate[dateKey] ?? [];
          const filter = `date:${dateKey}`;
          const isSelected = selectedFilter === filter;
          const placementClass = `${index % 7 >= 5 ? ' tooltip-right' : ''}${index >= cells.length - 7 ? ' tooltip-up' : ''}`;

          if (dateEquipment.length === 0) {
            return <span key={dateKey} className={`calibration-calendar-day${dateKey === todayKey ? ' today' : ''}`}><span>{day}</span></span>;
          }

          const equipmentNames = dateEquipment.map((item) => `${item.equipment_id} ${item.equipment_name}`).join(', ');
          return (
            <span key={dateKey} className={`calibration-calendar-day has-equipment${dateKey === todayKey ? ' today' : ''}${isSelected ? ' selected' : ''}${placementClass}`}>
              <button
                type="button"
                className="calibration-calendar-date-button"
                onClick={() => onFilterChange(filter)}
                aria-pressed={isSelected}
                aria-label={`${formatDate(dateKey)}: ${dateEquipment.length} equipment due. ${equipmentNames}`}
              >
                <span className="calibration-calendar-date-number">{day}</span>
                <span className="calibration-calendar-count">{dateEquipment.length}</span>
                <span className="calibration-calendar-status-dots" aria-hidden="true">
                  {dateEquipment.slice(0, 4).map((item) => <span key={item.id} style={{ backgroundColor: EQUIPMENT_STATUS_COLORS[item.status] ?? 'var(--text-muted)' }} />)}
                </span>
                <span className="calibration-calendar-tooltip" role="tooltip">
                  <strong>{formatDate(dateKey)}</strong>
                  {dateEquipment.slice(0, 4).map((item) => (
                    <span className="calibration-calendar-tooltip-item" key={item.id}>
                      <span><b>{item.equipment_id}</b><em style={{ color: EQUIPMENT_STATUS_COLORS[item.status] }}>{item.status}</em></span>
                      <span>{item.equipment_name}</span>
                      <small>{item.equipment_type} · {item.department} / {item.location}</small>
                    </span>
                  ))}
                  {dateEquipment.length > 4 && <small>+{dateEquipment.length - 4} more equipment</small>}
                  <small className="calibration-calendar-tooltip-hint">Select date to show the full list</small>
                </span>
              </button>
            </span>
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

function DashboardEquipmentDetails({ equipment, selectedFilter, onFilterChange, openStatus }) {
  const title = dashboardFilterLabel(selectedFilter);
  const isDateFilter = selectedFilter.startsWith('date:');
  return (
    <section className="card calibration-detail-card" aria-labelledby="calibration-detail-title">
      <div className="section-header calibration-detail-header">
        <div>
          <h2 className="section-title" id="calibration-detail-title"><span className="dot" /> {title}</h2>
          <p className="text-xs text-muted mt-4" aria-live="polite">Showing {equipment.length} matching equipment record{equipment.length === 1 ? '' : 's'}.</p>
        </div>
        <div className="calibration-detail-controls">
          <label className="sr-only" htmlFor="dashboard-equipment-filter">Equipment detail filter</label>
          <select id="dashboard-equipment-filter" className="form-select" value={selectedFilter} onChange={(event) => onFilterChange(event.target.value)}>
            {isDateFilter && <option value={selectedFilter}>{title}</option>}
            {DASHBOARD_FILTER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Link className="btn btn-ghost btn-sm" to="/calibration/equipment">Manage Equipment</Link>
        </div>
      </div>
      {equipment.length === 0 ? (
        <div className="empty-state calibration-detail-empty"><CircleCheckBig className="empty-state-icon" aria-hidden="true" /><div className="empty-state-text">No equipment matches this filter.</div></div>
      ) : (
        <div className="table-wrapper">
          <table className="calibration-detail-table">
            <thead><tr><th>Equipment</th><th>Type</th><th>Department / Location</th><th>Next Calibration</th><th>Days Remaining</th><th>Status</th></tr></thead>
            <tbody>{equipment.map((item) => (
              <tr key={item.id} className="calibration-clickable-row" onClick={() => openStatus(item)}>
                <td>
                  <button type="button" className="calibration-equipment-link" onClick={(event) => { event.stopPropagation(); openStatus(item); }} aria-label={`Record calibration result for ${item.equipment_id}, ${item.equipment_name}`}>
                    <span className="font-mono font-bold text-blue">{item.equipment_id}</span>
                    <span className="text-xs text-muted">{item.equipment_name}</span>
                  </button>
                </td>
                <td>{item.equipment_type}</td>
                <td>{item.department}<br /><span className="text-xs text-muted">{item.location}</span></td>
                <td>{formatDate(item.next_calibration_date)}</td>
                <td className={item.days_remaining < 0 ? 'text-red font-bold' : ''}>{daysLabel(item)}</td>
                <td><span className={`badge ${STATUS_BADGES[item.status] ?? 'badge-manual'}`}>{item.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function CalibrationDashboard({ summary, equipment, selectedFilter, onFilterChange, openStatus }) {
  const cards = [
    { filter: 'all', label: 'Total Equipment', value: summary.total_equipment, sub: 'Registered assets', accent: 'var(--accent-blue)', icon: <PackageCheck /> },
    { filter: 'valid', label: 'Valid Equipment', value: summary.valid_equipment, sub: 'More than 30 days', accent: 'var(--accent-green)', icon: <CircleCheckBig /> },
    { filter: 'due30', label: 'Due Within 30 Days', value: summary.due_within_30_days, sub: 'Includes due today', accent: 'var(--accent-purple)', icon: <CalendarClock /> },
    { filter: 'due7', label: 'Due Within 7 Days', value: summary.due_within_7_days, sub: 'Includes due today', accent: 'var(--accent-yellow)', icon: <AlarmClock /> },
    { filter: 'overdue', label: 'Overdue Equipment', value: summary.overdue_equipment, sub: 'Past calibration date', accent: 'var(--accent-red)', alert: summary.overdue_equipment > 0, icon: <TriangleAlert /> },
    { filter: 'failed', label: 'Failed Equipment', value: summary.failed_equipment, sub: 'Retained in registry', accent: 'var(--accent-red)', alert: summary.failed_equipment > 0, icon: <CircleX /> },
  ];
  const selectedEquipment = filterDashboardEquipment(equipment, selectedFilter);

  return (
    <>
      <div className="stat-grid calibration-stat-grid" aria-label="Calibration summary filters">
        {cards.map((card) => (
          <button
            key={card.filter}
            type="button"
            className={`calibration-stat-filter${selectedFilter === card.filter ? ' active' : ''}`}
            onClick={() => onFilterChange(card.filter)}
            aria-pressed={selectedFilter === card.filter}
            aria-label={`${card.label}: ${card.value}. Show matching equipment.`}
          >
            <StatCard label={card.label} value={card.value} sub={card.sub} accent={card.accent} alert={card.alert} icon={card.icon} />
          </button>
        ))}
      </div>

      <div className="calibration-charts-grid">
        <CalibrationCalendar equipment={equipment} selectedFilter={selectedFilter} onFilterChange={onFilterChange} />
        <DueWindowChart equipment={equipment} selectedFilter={selectedFilter} onFilterChange={onFilterChange} />
      </div>

      <DashboardEquipmentDetails equipment={selectedEquipment} selectedFilter={selectedFilter} onFilterChange={onFilterChange} openStatus={openStatus} />
    </>
  );
}

export function EquipmentManagement({ equipment, filteredEquipment, search, statusFilter, setSearch, setStatusFilter, openEdit, openStatus }) {
  return (
    <section className="card" aria-labelledby="equipment-registry-title">
      <div className="section-header calibration-section-header">
        <h2 className="section-title" id="equipment-registry-title"><span className="dot" /> Equipment Registry ({filteredEquipment.length})</h2>
        <Link className="btn btn-primary" to="/calibration/equipment/new"><Plus size={16} aria-hidden="true" /> Register Equipment</Link>
      </div>
      <div className="filter-bar calibration-toolbar">
        <label className="calibration-search">
          <span className="sr-only">Search equipment</span><Search size={16} aria-hidden="true" />
          <input className="form-input" type="search" placeholder="Search ID, name, type, serial, department or location" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filter by calibration status</span>
          <select className="form-select calibration-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Statuses</option><option value="Valid">Valid</option><option value="Due Soon">Due Soon</option>
            <option value="Due Today">Due Today</option><option value="Overdue">Overdue</option><option value="Failed">Failed</option>
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
        <thead><tr><th>Equipment ID</th><th>Equipment Name</th><th>Equipment Type</th><th>Serial Number</th><th>Department</th><th>Location</th><th>Last Calibration</th><th>Next Calibration</th><th>Days Remaining</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{equipment.map((item) => (
          <tr key={item.id}>
            <td className="font-mono font-bold text-blue">{item.equipment_id}</td><td>{item.equipment_name}</td><td>{item.equipment_type}</td><td className="font-mono">{item.serial_number}</td><td>{item.department}</td><td>{item.location}</td><td>{formatDate(item.last_calibration_date)}</td><td>{formatDate(item.next_calibration_date)}</td><td className={item.days_remaining < 0 ? 'text-red font-bold' : ''}>{daysLabel(item)}</td><td><span className={`badge ${STATUS_BADGES[item.status] ?? 'badge-manual'}`}>{item.status}</span></td>
            <td><div className="calibration-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} aria-label={`Edit ${item.equipment_id}`}><Pencil size={14} aria-hidden="true" /> Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => openStatus(item)} aria-label={`Record passed or failed calibration result for ${item.equipment_id}`}><ClipboardCheck size={14} aria-hidden="true" /> Pass / Fail</button>
            </div></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function EquipmentRegistryForm({ formData, formError, submitting, onChange, onSubmit }) {
  return (
    <section className="card calibration-registry-card" aria-labelledby="register-equipment-title">
      <div className="section-header"><div><h2 className="section-title" id="register-equipment-title"><span className="dot" /> Equipment Details</h2><p className="text-xs text-muted mt-4">All fields marked with * are required.</p></div></div>
      {formError && <div className="calibration-notice calibration-notice-error" role="alert">{formError}</div>}
      <form id="calibration-registry-form" onSubmit={onSubmit}>
        <EquipmentFields formData={formData} onChange={onChange} />
        <div className="calibration-form-actions">
          <Link className="btn btn-ghost" to="/calibration/equipment">Cancel</Link>
          <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Registering...' : 'Register Equipment'}</button>
        </div>
      </form>
    </section>
  );
}
