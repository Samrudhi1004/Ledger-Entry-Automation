import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getSessions } from '../api/inspections';
import api from '../api/axios';
import { formatDateTime, shortId } from '../utils/formatters';

export default function InspectionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [oocFilter, setOocFilter] = useState('');
  const [groupByDate, setGroupByDate] = useState(false);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const res = await api.get('/api/machines/');
        const loaded = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
        setMachines(loaded);
      } catch (_) {}
    };
    fetchMachines();
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (statusFilter) params.status = statusFilter;
      if (machineFilter) params.machine = machineFilter;
      if (partFilter) params.part = partFilter;
      if (shiftFilter) params.shift = shiftFilter;
      if (typeFilter) params.inspection_type = typeFilter;

      const res = await getSessions(params);
      let data = res.data?.results ?? res.data ?? [];
      data = Array.isArray(data) ? data : [];

      if (oocFilter === 'ooc') {
        data = data.filter((s) => s.has_ooc);
      } else if (oocFilter === 'critical') {
        data = data.filter((s) => s.has_critical_fail);
      } else if (oocFilter === 'ok') {
        data = data.filter((s) => !s.has_ooc && !s.has_critical_fail && s.status !== 'in_progress');
      }

      setSessions(data);
    } catch (_) {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, statusFilter, machineFilter, partFilter, shiftFilter, typeFilter, oocFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleShortcut = (type) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    if (type === 'today') { setStartDate(fmt(today)); setEndDate(fmt(today)); }
    else if (type === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); setStartDate(fmt(y)); setEndDate(fmt(y)); }
    else if (type === '7days') { const p = new Date(today); p.setDate(p.getDate() - 7); setStartDate(fmt(p)); setEndDate(fmt(today)); }
    else if (type === 'month') { setStartDate(fmt(new Date(today.getFullYear(), today.getMonth(), 1))); setEndDate(fmt(today)); }
    else { setStartDate(''); setEndDate(''); }
  };

  const handleResetFilters = () => {
    setStartDate(''); setEndDate(''); setStatusFilter('');
    setMachineFilter(''); setPartFilter(''); setShiftFilter('');
    setTypeFilter(''); setOocFilter('');
  };

  const renderSpecBadge = (s) => {
    if (s.has_critical_fail) return <Badge type="critical" />;
    if (s.has_ooc) return <Badge type="ooc" />;
    if (s.status === 'in_progress') return (
      <span style={{ background: '#EFF6FF', color: '#0284C7', border: '1px solid #BAE6FD', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Recording...</span>
    );
    if (s.status === 'pending_review') return (
      <span style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Awaiting Check</span>
    );
    return <Badge type="ok" />;
  };

  const totalCount = sessions.length;
  const approvedCount = sessions.filter((s) => s.status === 'approved' || s.status === 'finalized_passed').length;
  const rejectedCount = sessions.filter((s) => s.status === 'rejected' || s.status === 'finalized_failed').length;
  const pendingCount = sessions.filter((s) => s.status === 'pending_review' || s.status === 'in_progress').length;
  const passRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  const sessionsByDate = sessions.reduce((acc, s) => {
    const dateStr = s.started_at ? s.started_at.split('T')[0] : 'Unknown Date';
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(s);
    return acc;
  }, {});

  // ── Shared inline styles ──────────────────────────────────────────────────
  const pageStyle = { background: '#F1F5F9', minHeight: '100vh', padding: '24px 28px' };

  const cardStyle = {
    background: '#FFFFFF', borderRadius: 12,
    border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
  };

  const inputStyle = {
    background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%',
    outline: 'none', boxSizing: 'border-box',
  };

  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  const labelStyle = { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6, display: 'block' };

  const shortcutBtnBase = {
    padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20,
    cursor: 'pointer', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569',
    transition: 'all 0.15s',
  };

  const thStyle = {
    padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.6px', background: '#F8FAFC',
    borderBottom: '1.5px solid #E2E8F0', whiteSpace: 'nowrap',
  };

  const tdStyle = {
    padding: '13px 14px', fontSize: 13, color: '#334155',
    borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle',
  };

  const summaryCards = [
    { label: 'TOTAL INSPECTIONS', value: totalCount, sub: 'In selected date range', color: '#0F172A', accent: '#38BDF8', bg: '#EFF6FF', border: '#BAE6FD' },
    { label: 'PASSED / APPROVED', value: approvedCount, sub: `${passRate}% Pass Rate`, color: '#059669', accent: '#059669', bg: '#F0FDF4', border: '#BBF7D0' },
    { label: 'REJECTED / OOC', value: rejectedCount, sub: 'Requires Corrective Action', color: '#DC2626', accent: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
    { label: 'PENDING / IN-PROGRESS', value: pendingCount, sub: 'Awaiting Review', color: '#B45309', accent: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  ];

  const renderTable = (rows) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Session ID', 'Machine', 'Part Number', 'Stage', 'Operator', 'Shift', 'Status', 'Reading Spec', 'Date / Time', ''].map((h, i) => (
              <th key={i} style={{ ...thStyle, textAlign: i === 9 ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.session_id}
              style={{ cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: '#64748B' }}>{shortId(s.session_id)}</td>
              <td style={{ ...tdStyle, fontWeight: 700, color: '#0F172A' }}>{s.machine?.machine_code ?? s.machine_code}</td>
              <td style={{ ...tdStyle, color: '#475569' }}>{s.part?.part_number ?? s.part_number}</td>
              <td style={{ ...tdStyle, textTransform: 'capitalize', color: '#7C3AED', fontWeight: 600 }}>{s.inspection_type?.replace('_', ' ')}</td>
              <td style={tdStyle}>{s.operator?.username ?? '—'}</td>
              <td style={tdStyle}>
                <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  Shift {s.shift}
                </span>
              </td>
              <td style={tdStyle}><Badge type={s.status} /></td>
              <td style={tdStyle}>{renderSpecBadge(s)}</td>
              <td style={{ ...tdStyle, fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{formatDateTime(s.started_at)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <button
                  onClick={() => navigate(`/inspections/${s.session_id}`)}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                    background: '#0F172A', color: '#FFFFFF', border: 'none', cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  View Sheet →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Header
        title="Date-Wise Inspection Log"
        subtitle="Filter, inspect, and verify historical quality sheets by date, machine, part, and shift"
      />

      <div style={pageStyle}>

        {/* ── Summary Cards ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 22 }}>
          {summaryCards.map((c) => (
            <div key={c.label} style={{ ...cardStyle, padding: 20, borderLeft: `4px solid ${c.border}`, background: c.bg }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{c.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: c.color, margin: '6px 0 2px' }}>{c.value}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Filter Panel ──────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, padding: 20, marginBottom: 20 }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📅</div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', letterSpacing: '0.3px' }}>INSPECTION FILTERS</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['today', 'Today'], ['yesterday', 'Yesterday'], ['7days', 'Last 7 Days'], ['month', 'This Month'], ['all', 'All Time']].map(([key, label]) => (
                <button key={key} onClick={() => handleShortcut(key)} style={shortcutBtnBase}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#0284C7'; e.currentTarget.style.borderColor = '#BAE6FD'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Filter Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Machine</label>
              <select style={selectStyle} value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
                <option value="">All Machines</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.machine_code}>{m.machine_code} ({m.name})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Part Number</label>
              <input type="text" style={inputStyle} placeholder="e.g. FBT00222" value={partFilter} onChange={(e) => setPartFilter(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Shift</label>
              <select style={selectStyle} value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                <option value="">All Shifts</option>
                <option value="A">Shift A (Morning)</option>
                <option value="B">Shift B (Evening)</option>
                <option value="C">Shift C (Night)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Stage</label>
              <select style={selectStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Stages</option>
                <option value="first_piece">First Piece</option>
                <option value="hourly">Hourly In-Process</option>
                <option value="final">Final Inspection</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="approved">Approved / Finalized</option>
                <option value="rejected">Rejected</option>
                <option value="pending_review">Pending Review</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tolerance / Defects</label>
              <select style={selectStyle} value={oocFilter} onChange={(e) => setOocFilter(e.target.value)}>
                <option value="">All Readings</option>
                <option value="ooc">Out-Of-Spec Only</option>
                <option value="critical">Critical Failures Only</option>
                <option value="ok">Clean (OK Only)</option>
              </select>
            </div>
          </div>

          {/* Bottom row: group toggle + reset */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" id="groupDate" checked={groupByDate} onChange={(e) => setGroupByDate(e.target.checked)} />
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Group Inspection Sheets by Date</span>
            </label>
            <button
              onClick={handleResetFilters}
              style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FECACA'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            >
              ✕ Reset All Filters
            </button>
          </div>
        </div>

        {/* ── Results Table ─────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>

          {/* Card header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFC' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              Inspection Sheets
              {!loading && (
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: '#64748B' }}>
                  {sessions.length} record{sessions.length !== 1 ? 's' : ''} found
                </span>
              )}
            </div>
            <button
              onClick={fetchSessions}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569' }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <LoadingSpinner message="Fetching inspection logs..." />
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📂</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#334155', marginBottom: 6 }}>No Inspection Sheets Found</div>
                <div style={{ fontSize: 13, color: '#94A3B8' }}>No records match the selected date range and filter criteria.</div>
              </div>
            ) : groupByDate ? (
              <div style={{ padding: '0 0 8px' }}>
                {Object.entries(sessionsByDate).map(([dateStr, items]) => (
                  <div key={dateStr} style={{ marginBottom: 4 }}>
                    <div style={{
                      padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
                      fontSize: 12, fontWeight: 700, color: '#0284C7', letterSpacing: '0.4px',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ background: '#EFF6FF', border: '1px solid #BAE6FD', borderRadius: 6, padding: '2px 10px' }}>
                        📅 {dateStr}
                      </span>
                      <span style={{ color: '#64748B', fontWeight: 500 }}>{items.length} inspection{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    {renderTable(items)}
                  </div>
                ))}
              </div>
            ) : (
              renderTable(sessions)
            )}
          </div>
        </div>
      </div>
    </>
  );
}
