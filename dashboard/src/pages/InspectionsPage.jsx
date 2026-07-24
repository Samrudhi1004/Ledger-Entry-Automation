import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getSessions } from '../api/inspections';
import { formatDateTime, shortId } from '../utils/formatters';

export default function InspectionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (machineFilter) params.machine = machineFilter;
      
      const res = await getSessions(params);
      const data = res.data?.results ?? res.data ?? [];
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter, machineFilter]);

  return (
    <>
      <Header title="All Inspections" subtitle="Browse, filter, and view historical quality sheets" />

      <div className="page-content bg-gradient-animated">
        {/* Filters */}
        <div className="card mb-20">
          <div className="filter-bar">
            <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
              <label className="form-label" htmlFor="filter-status">Status</label>
              <select
                id="filter-status"
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="pending_review">Pending Review</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
              <label className="form-label" htmlFor="filter-machine">Machine Code</label>
              <input
                id="filter-machine"
                type="text"
                className="form-input"
                placeholder="e.g. MCH-01"
                value={machineFilter}
                onChange={(e) => setMachineFilter(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 'auto' }}>
              <button
                id="clear-filters"
                className="btn btn-ghost"
                onClick={() => { setStatusFilter(''); setMachineFilter(''); }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* List table */}
        <div className="card">
          {loading ? (
            <LoadingSpinner message="Fetching inspections log..." />
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <div className="empty-state-text">No inspections matching these filters.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Part Number</th>
                    <th>Machine</th>
                    <th>Operator</th>
                    <th>Shift</th>
                    <th>Status</th>
                    <th>OOC Warning</th>
                    <th>Date / Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.session_id}
                      className="clickable-row"
                      onClick={() => navigate(`/inspections/${s.session_id}`)}
                    >
                      <td className="font-mono">{shortId(s.session_id)}</td>
                      <td>{s.part?.part_number ?? s.part_number}</td>
                      <td className="font-mono">{s.machine?.machine_code ?? s.machine_code}</td>
                      <td>{s.operator?.username ?? '—'}</td>
                      <td>{s.shift}</td>
                      <td>
                        <Badge type={s.status} />
                      </td>
                      <td>
                        {s.has_critical_fail ? (
                          <Badge type="critical" />
                        ) : s.has_ooc ? (
                          <Badge type="ooc" />
                        ) : (
                          <Badge type="ok" />
                        )}
                      </td>
                      <td>{formatDateTime(s.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
