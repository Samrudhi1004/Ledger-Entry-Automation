import { Fragment, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlarmClock, CalendarClock, CircleCheckBig,
  CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  FileClock, LayoutDashboard, PackageCheck, Pencil, Plus, Printer,
  Search, Trash2, TriangleAlert,
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
          <p className="text-xs text-muted mt-4">Select a month to show every item planned for calibration.</p>
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
              <span>{name}</span><strong>{counts[month]}</strong><small>planned</small>
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

function DashboardEquipmentDetails({ equipment, selectedFilter, onFilterChange, openStatus, detailsRef }) {
  const title = dashboardFilterLabel(selectedFilter);
  const isDateFilter = selectedFilter.startsWith('date:');
  return (
    <section ref={detailsRef} tabIndex="-1" className="card calibration-detail-card" aria-labelledby="calibration-detail-title">
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
    { filter: 'due30', label: 'Due Within 30 Days', value: summary.due_within_30_days, sub: 'Includes due today', accent: 'var(--accent-purple)', icon: <CalendarClock /> },
    { filter: 'due7', label: 'Due Within 7 Days', value: summary.due_within_7_days, sub: 'Includes due today', accent: 'var(--accent-yellow)', icon: <AlarmClock /> },
    { filter: 'overdue', label: 'Overdue Equipment', value: summary.overdue_equipment, sub: 'Past calibration date', accent: 'var(--accent-red)', alert: summary.overdue_equipment > 0, icon: <TriangleAlert /> },
  ];
  const selectedEquipment = filterDashboardEquipment(equipment, selectedFilter);
  const detailsRef = useRef(null);
  const showFilteredList = (filter) => {
    if (!filter) return;
    onFilterChange(filter);
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      detailsRef.current?.focus({ preventScroll: true });
    });
  };

  return (
    <>
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

      <div className="calibration-charts-grid">
        <CalibrationYearOverview equipment={equipment} selectedFilter={selectedFilter} onFilterChange={showFilteredList} />
        <DueWindowChart equipment={equipment} selectedFilter={selectedFilter} onFilterChange={showFilteredList} />
      </div>

      <DashboardEquipmentDetails equipment={selectedEquipment} selectedFilter={selectedFilter} onFilterChange={showFilteredList} openStatus={openStatus} detailsRef={detailsRef} />
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
              <Link className="btn btn-ghost btn-sm" to={`/calibration/equipment/${item.id}/history`} aria-label={`View history card for ${item.equipment_id}`}><FileClock size={14} aria-hidden="true" /> History</Link>
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

function planDateCell(date, year, month) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.getFullYear() === year && parsed.getMonth() === month ? parsed.getDate() : null;
}

export function CalibrationPlanReport({ year, setYear, rows, openEditor, removeEntry }) {
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
          <button type="button" className="btn btn-primary" onClick={() => openEditor()}><Plus size={16} aria-hidden="true" /> Add Plan Entry</button>
        </div>
      </div>
      <div className="calibration-plan-management table-wrapper">
        <table className="calibration-report-table">
          <thead><tr><th>Equipment</th><th>Instrument ID / Serial No.</th><th>Planned Date</th><th>Actual Date</th><th>Result</th><th>Remarks</th><th>Controls</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan="7">No equipment scheduled for {year}. Use Add Plan Entry to select from the permanent equipment master.</td></tr> : rows.map((row) => (
            <tr key={row.key}><td>{row.equipment_name}</td><td>{row.equipment_id}<br /><span className="text-xs text-muted">{row.serial_number}</span></td><td>{formatDate(row.planned_date)}</td><td>{formatDate(row.actual_date)}</td><td>{row.result}</td><td>{row.remarks || '—'}</td><td><div className="calibration-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditor(row)}><Pencil size={14} aria-hidden="true" /> Edit</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeEntry(row)}><Trash2 size={14} aria-hidden="true" /> Remove</button></div></td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="calibration-print-sheet">
        <div className="calibration-plan-document-header">
          <strong>Inspection Hub</strong>
          <h1>Measuring Instrument Calibration Plan {year}</h1>
          <span>FORMAT NO: QA/FR/54<br />REV: 00</span>
        </div>
        <div className="table-wrapper">
          <table className="calibration-plan-template">
            <thead>
              <tr><th rowSpan="2">Sr. No.</th><th rowSpan="2">Description</th><th rowSpan="2">Instrument<br />ID No. / Sr. No.</th><th rowSpan="2">Plan vs<br />Actual</th><th colSpan="12">Month</th><th rowSpan="2">Remarks</th></tr>
              <tr>{MONTHS.map((month) => <th key={month}>{month.slice(0, 3)}'{String(year).slice(-2)}</th>)}</tr>
            </thead>
            <tbody>{rows.length === 0 ? <tr><td colSpan="17">No equipment scheduled for this year.</td></tr> : rows.map((row, index) => (
              <Fragment key={row.key}>
                <tr>
                  <td rowSpan="2">{index + 1}</td><td rowSpan="2">{row.equipment_name}</td><td rowSpan="2">{row.equipment_id}<br />{row.serial_number}</td><td>Plan</td>
                  {MONTHS.map((month, monthIndex) => { const day = planDateCell(row.planned_date, year, monthIndex); return <td key={month} className={day ? 'calibration-plan-mark planned' : ''}>{day || ''}</td>; })}
                  <td rowSpan="2">{row.remarks || ''}</td>
                </tr>
                <tr><td>Actual</td>{MONTHS.map((month, monthIndex) => { const day = planDateCell(row.actual_date, year, monthIndex); return <td key={month} className={day ? `calibration-plan-mark ${row.result === 'Failed' ? 'failed' : 'actual'}` : ''}>{day || ''}</td>; })}</tr>
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

export function CalibrationHistoryCard({ data, onDownloadReport }) {
  const equipment = data?.equipment;
  const records = data?.records ?? [];
  if (!equipment) return null;
  return (
    <section className="card calibration-report-card">
      <div className="section-header calibration-report-toolbar">
        <div><h2 className="section-title"><FileClock size={16} aria-hidden="true" /> Equipment History Card</h2><p className="text-xs text-muted mt-4">Permanent calibration record for {equipment.equipment_id}.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print</button>
      </div>
      <div className="calibration-print-sheet">
        <div className="calibration-report-heading"><h1>INSTRUMENT / GAUGE HISTORY CARD</h1><strong>{equipment.history_card_number || equipment.equipment_id}</strong></div>
        <div className="calibration-equipment-details">
          <EquipmentDetail label="Equipment" value={equipment.equipment_name} /><EquipmentDetail label="Equipment ID" value={equipment.equipment_id} />
          <EquipmentDetail label="Type" value={equipment.equipment_type} /><EquipmentDetail label="Serial No." value={equipment.serial_number} />
          <EquipmentDetail label="Manufacturer / Make" value={equipment.manufacturer} /><EquipmentDetail label="Model" value={equipment.model_number} />
          <EquipmentDetail label="Range / Size" value={equipment.range_size} /><EquipmentDetail label="Least Count" value={equipment.least_count} />
          <EquipmentDetail label="Frequency" value={`${equipment.calibration_frequency_days} days`} /><EquipmentDetail label="Acceptable Error" value={equipment.acceptable_error} />
          <EquipmentDetail label="Department" value={equipment.department} /><EquipmentDetail label="Location" value={equipment.location} />
          <EquipmentDetail label="Last Calibration" value={formatDate(equipment.last_calibration_date)} /><EquipmentDetail label="Next Due" value={formatDate(equipment.next_calibration_date)} />
          <EquipmentDetail label="Acceptance Criteria" value={equipment.acceptance_criteria} />
        </div>
        <div className="table-wrapper">
          <table className="calibration-report-table calibration-history-table">
            <thead><tr><th>Date</th><th>Agency</th><th>Report / Certificate</th><th>Evidence</th><th>Traceability</th><th>Specified Size</th><th>Details</th><th>Result</th><th>Next Due</th><th>Remarks</th></tr></thead>
            <tbody>{records.length === 0 ? <tr><td colSpan="10">No calibration results have been recorded yet.</td></tr> : records.map((record) => (
              <tr key={record.id}><td>{formatDate(record.calibration_date)}</td><td>{record.calibration_agency || '—'}</td><td>{record.report_number || '—'}<br />{record.certificate_number || '—'}</td><td>{record.has_report ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDownloadReport(record)}>Download<br />{record.report_file_name}</button> : '—'}</td><td>{record.traceability_certificate_number || '—'}</td><td>{record.specified_size || '—'}</td><td>{record.calibration_details || '—'}</td><td>{record.result}</td><td>{formatDate(record.next_due_date)}</td><td>{record.remarks || '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
