import { Link, NavLink } from 'react-router-dom';
import {
  AlarmClock, ArrowRight, Ban, CalendarClock, CircleCheckBig, CircleX,
  ClipboardList, FilePlus2, LayoutDashboard, PackageCheck, Pencil, Plus,
  Search, TriangleAlert,
} from 'lucide-react';

import StatCard from '../../components/cards/StatCard';
import { EquipmentFields } from './CalibrationFields';
import { daysLabel, formatDate, STATUS_BADGES } from './calibrationData';

export function CalibrationNavigation() {
  const links = [
    ['/calibration', 'Dashboard', LayoutDashboard],
    ['/calibration/equipment', 'Equipment Management', ClipboardList],
    ['/calibration/equipment/new', 'Register Equipment', FilePlus2],
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

export function CalibrationDashboard({ summary, attentionEquipment }) {
  return (
    <>
      <div className="stat-grid calibration-stat-grid">
        <StatCard label="Total Equipment" value={summary.total_equipment} sub="Registered assets" accent="var(--accent-blue)" icon={<PackageCheck />} />
        <StatCard label="Valid Equipment" value={summary.valid_equipment} sub="More than 30 days" accent="var(--accent-green)" icon={<CircleCheckBig />} />
        <StatCard label="Due Within 30 Days" value={summary.due_within_30_days} sub="Includes due today" accent="var(--accent-purple)" icon={<CalendarClock />} />
        <StatCard label="Due Within 7 Days" value={summary.due_within_7_days} sub="Immediate attention" accent="var(--accent-yellow)" icon={<AlarmClock />} />
        <StatCard label="Overdue Equipment" value={summary.overdue_equipment} sub="Past calibration date" accent="var(--accent-red)" alert={summary.overdue_equipment > 0} icon={<TriangleAlert />} />
        <StatCard label="Failed Equipment" value={summary.failed_equipment} sub="Retained in registry" accent="var(--accent-red)" alert={summary.failed_equipment > 0} icon={<CircleX />} />
      </div>

      <div className="calibration-dashboard-grid">
        <section className="card" aria-labelledby="attention-title">
          <div className="section-header">
            <h2 className="section-title" id="attention-title"><span className="dot" /> Needs Attention</h2>
            <Link className="btn btn-ghost btn-sm" to="/calibration/equipment">View All <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          {attentionEquipment.length === 0 ? (
            <div className="empty-state">
              <CircleCheckBig className="empty-state-icon" aria-hidden="true" />
              <div className="empty-state-text">No equipment currently needs attention.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Equipment</th><th>Next Calibration</th><th>Status</th></tr></thead>
                <tbody>{attentionEquipment.map((item) => (
                  <tr key={item.id}>
                    <td><span className="font-mono font-bold text-blue">{item.equipment_id}</span><br /><span className="text-xs text-muted">{item.equipment_name}</span></td>
                    <td>{formatDate(item.next_calibration_date)}</td>
                    <td><span className={`badge ${STATUS_BADGES[item.status] ?? 'badge-manual'}`}>{item.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card calibration-quick-actions" aria-labelledby="quick-actions-title">
          <h2 className="section-title" id="quick-actions-title"><span className="dot" /> Quick Actions</h2>
          <Link className="calibration-action-card" to="/calibration/equipment">
            <ClipboardList aria-hidden="true" />
            <span><strong>Equipment Management</strong><small>Search and update registered equipment</small></span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className="calibration-action-card" to="/calibration/equipment/new">
            <FilePlus2 aria-hidden="true" />
            <span><strong>Register Equipment</strong><small>Add a new calibration asset</small></span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </>
  );
}

export function EquipmentManagement({ equipment, filteredEquipment, search, statusFilter, setSearch, setStatusFilter, openEdit, openFailure }) {
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
      ) : <EquipmentTable equipment={filteredEquipment} openEdit={openEdit} openFailure={openFailure} />}
    </section>
  );
}

function EquipmentTable({ equipment, openEdit, openFailure }) {
  return (
    <div className="table-wrapper">
      <table className="calibration-table">
        <thead><tr><th>Equipment ID</th><th>Equipment Name</th><th>Equipment Type</th><th>Serial Number</th><th>Department</th><th>Location</th><th>Last Calibration</th><th>Next Calibration</th><th>Days Remaining</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{equipment.map((item) => (
          <tr key={item.id}>
            <td className="font-mono font-bold text-blue">{item.equipment_id}</td><td>{item.equipment_name}</td><td>{item.equipment_type}</td><td className="font-mono">{item.serial_number}</td><td>{item.department}</td><td>{item.location}</td><td>{formatDate(item.last_calibration_date)}</td><td>{formatDate(item.next_calibration_date)}</td><td className={item.days_remaining < 0 ? 'text-red font-bold' : ''}>{daysLabel(item)}</td><td><span className={`badge ${STATUS_BADGES[item.status] ?? 'badge-manual'}`}>{item.status}</span></td>
            <td><div className="calibration-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} aria-label={`Edit ${item.equipment_id}`}><Pencil size={14} aria-hidden="true" /> Edit</button>
              {!item.is_failed && <button className="btn btn-danger btn-sm" onClick={() => openFailure(item)} aria-label={`Mark ${item.equipment_id} as failed`}><Ban size={14} aria-hidden="true" /> Mark Failed</button>}
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
