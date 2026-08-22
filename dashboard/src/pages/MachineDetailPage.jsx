import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Badge from '../components/common/Badge';
import LiveSheetViewer from '../components/inspection/LiveSheetViewer';
import api from '../api/axios';
import { getSessions } from '../api/inspections';
import { getMachinePerformance } from '../api/analytics';
import { useWebSocket } from '../context/WebSocketContext';
import { formatDateTime } from '../utils/formatters';

export default function MachineDetailPage() {
  const { machineId } = useParams();
  const [machine, setMachine]           = useState(null);
  const [performance, setPerformance]   = useState(null);
  const [parts, setParts]               = useState([]);
  const [allSessions, setAllSessions]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [expandedParts, setExpandedParts] = useState({});
  const machineCodeRef = useRef(null);

  const ws = useWebSocket();
  const wsEvents = ws?.events ?? [];

  // ── Fetch everything ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const mRes = await api.get(`/api/machines/${machineId}/`);
      const mData = mRes.data;
      setMachine(mData);
      machineCodeRef.current = mData.machine_code;

      const [pRes, sRes, perfRes] = await Promise.all([
        api.get('/api/parts/', { params: { machine: machineId } }),
        getSessions({ machine: mData.machine_code }),
        getMachinePerformance(machineId, 30),
      ]);

      const partsData = pRes.data?.results ?? pRes.data ?? [];
      setParts(Array.isArray(partsData) ? partsData : []);

      const sessionsList = sRes.data?.results ?? sRes.data ?? [];
      setAllSessions(Array.isArray(sessionsList) ? sessionsList : []);

      setPerformance(perfRes.data);

      // Auto-expand all parts that have live sessions
      const todayLocal = new Date().toLocaleDateString('en-CA');
      const expanded = {};
      (Array.isArray(partsData) ? partsData : []).forEach(p => {
        const hasLive = (Array.isArray(sessionsList) ? sessionsList : []).some(s => {
          if (!s.started_at) return false;
          const sDateLocal = new Date(s.started_at).toLocaleDateString('en-CA');
          return s.part_number === p.part_number && sDateLocal === todayLocal;
        });
        if (hasLive) expanded[p.part_number] = true;
      });
      setExpandedParts(expanded);
    } catch {
      /* graceful error */
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-fetch on session lifecycle WebSocket events
  useEffect(() => {
    const latest = wsEvents[0];
    if (!latest || !machineCodeRef.current) return;
    if (['session_started', 'session_completed'].includes(latest.event) &&
        latest.machine_code === machineCodeRef.current) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsEvents[0]?._receivedAt]);

  // Live measurement update → update session progress in state
  useEffect(() => {
    const latest = wsEvents[0];
    if (!latest || latest.event !== 'measurement_recorded' || !machineCodeRef.current) return;
    if (latest.machine_code !== machineCodeRef.current) return;
    setAllSessions(prev =>
      prev.map(s => s.session_id === latest.session_id
        ? { ...s, progress: latest.progress ?? s.progress, has_ooc: s.has_ooc || latest.status === 'out_of_spec' }
        : s
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsEvents[0]?._receivedAt]);

  const handleClearHistory = async () => {
    if (!machine) return;
    if (!window.confirm(`Clear all test inspection history for ${machine.machine_code}?`)) return;
    try {
      await api.delete(`/api/inspections/clear-history/?machine_code=${machine.machine_code}`);
      alert(`✓ History cleared for ${machine.machine_code}`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to clear history.');
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const todayLocal = new Date().toLocaleDateString('en-CA');

  const getSessionsForPart = (partNumber) =>
    allSessions.filter(s => s.part_number === partNumber);

  const getLiveSessionsForPart = (partNumber) =>
    getSessionsForPart(partNumber).filter(s => {
      if (!s.started_at) return false;
      return new Date(s.started_at).toLocaleDateString('en-CA') === todayLocal;
    });

  const liveMachineSessionCount = parts.reduce((acc, p) => acc + getLiveSessionsForPart(p.part_number).length, 0);

  const inspectionTypeLabel = (type) => {
    const map = {
      first_piece: '1st Piece Inspection',
      hourly: 'Hourly In-Process',
      final: 'Final Check',
      setup_approval: 'Setup Approval',
    };
    return map[type] || type?.replace('_', ' ') || '—';
  };

  const statusStyle = (s) => {
    if (s.has_critical_fail) return { badge: 'badge-critical', label: 'CRITICAL', color: '#ef4444' };
    if (s.has_ooc) return { badge: 'badge-ooc', label: 'OOC', color: '#f97316' };
    if (s.status === 'completed') return { badge: 'badge-ok', label: 'COMPLETED', color: '#16a34a' };
    return { badge: 'badge-progress', label: 'IN PROGRESS', color: '#3b82f6' };
  };

  // ── WS live pulse indicator ─────────────────────────────────────
  const recentlyUpdatedSessionId =
    wsEvents[0]?.event === 'measurement_recorded'
      ? wsEvents[0]?.session_id
      : null;

  // ── Render ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Header title="Machine Station — Live Reports" />
        <div className="page-content bg-gradient-animated">
          <LoadingSpinner message="Loading parts, operations & live sessions..." />
        </div>
      </>
    );
  }

  if (!machine) {
    return (
      <>
        <Header title="Machine Station — Live Reports" />
        <div className="page-content bg-gradient-animated">
          <div className="card text-center" style={{ padding: 40 }}>
            <h3>Machine Not Found</h3>
            <Link to="/machines" className="btn btn-primary mt-20">← Back to Live Reports</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={`${machine.machine_code} — ${machine.name}`}
        subtitle="Live Reports ▸ Parts & Operations"
      />

      <div className="page-content bg-gradient-animated">
        {/* Breadcrumb */}
        <div className="page-breadcrumb mb-16">
          <Link to="/machines">Live Reports</Link>
          {' / '}
          <span>{machine.machine_code} — {machine.name}</span>
        </div>

        {/* Station Summary Card */}
        <div className="card mb-20">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}
              >
                ⚙️
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {machine.machine_code} · {machine.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {machine.machine_type || 'CNC'} · {machine.manufacturer || ''} · {machine.plant_name ?? 'Shop Floor Plant 1'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{parts.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Parts Configured</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: liveMachineSessionCount > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                  {liveMachineSessionCount}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Live Sessions Today</div>
              </div>
              {performance && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {performance.pass_rate ?? 0}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pass Rate (30d)</div>
                </div>
              )}
              <span className={`badge badge-${machine.status?.toLowerCase() === 'active' ? 'ok' : 'pending'}`}>
                {machine.status}
              </span>
            </div>
          </div>
        </div>

        {/* Parts & Live Operations Tree */}
        <div className="card mb-20">
          <div className="section-header mb-16">
            <div className="section-title" style={{ fontSize: '1.05rem' }}>
              <span className="dot" style={{ background: liveMachineSessionCount > 0 ? 'var(--accent-green)' : 'var(--accent-blue)' }} />
              Parts & Live Operations
              {liveMachineSessionCount > 0 && (
                <span className="badge badge-voice" style={{ marginLeft: 8, animation: 'pulse-badge 1s infinite' }}>
                  {liveMachineSessionCount} LIVE
                </span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={fetchData}>↻ Refresh</button>
          </div>

          {parts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">No parts configured for {machine.machine_code} yet.</div>
              <Link to="/parameters" className="btn btn-primary btn-sm mt-12" style={{ marginTop: 12 }}>
                Configure Parts & Operations →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {parts.map((part) => {
                const liveSessions = getLiveSessionsForPart(part.part_number);
                const allPartSessions = getSessionsForPart(part.part_number);
                const isExpanded = expandedParts[part.part_number] ?? liveSessions.length > 0;
                const hasLive = liveSessions.length > 0;

                return (
                  <div
                    key={part.part_number}
                    style={{
                      border: `1.5px solid ${hasLive ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                      borderRadius: 14,
                      background: hasLive ? 'rgba(16,185,129,0.03)' : 'var(--bg-elevated)',
                      overflow: 'hidden',
                      transition: 'border-color 0.3s',
                    }}
                  >
                    {/* Part Header */}
                    <button
                      onClick={() => setExpandedParts(prev => ({ ...prev, [part.part_number]: !isExpanded }))}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 18px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                        borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                          background: hasLive
                            ? 'rgba(16,185,129,0.15)'
                            : 'var(--bg-hover)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18,
                        }}
                      >
                        🔩
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {part.part_number}
                          {part.part_name && (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                              · {part.part_name}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {allPartSessions.length} total sessions · {liveSessions.length} live today
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {hasLive && (
                          <span className="badge badge-voice" style={{ fontSize: 10, animation: 'pulse-badge 1s infinite' }}>
                            LIVE
                          </span>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: 16, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                          ›
                        </span>
                      </div>
                    </button>

                    {/* Operations List */}
                    {isExpanded && (
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {liveSessions.length === 0 && allPartSessions.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            No inspection sessions yet for this part today.
                          </div>
                        ) : null}

                        {/* Live today sessions FIRST */}
                        {liveSessions.length > 0 && (
                          <>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>
                              🟢 Live Sessions Today
                            </div>
                            {liveSessions.map(s => {
                              const st = statusStyle(s);
                              const isJustUpdated = s.session_id === recentlyUpdatedSessionId;
                              return (
                                <button
                                  key={s.session_id}
                                  onClick={() => setSelectedSessionId(s.session_id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '12px 14px', border: 'none', cursor: 'pointer',
                                    borderRadius: 10, textAlign: 'left', width: '100%',
                                    background: isJustUpdated
                                      ? 'rgba(139,92,246,0.18)'
                                      : 'rgba(59,130,246,0.06)',
                                    borderLeft: `3px solid ${st.color}`,
                                    transition: 'background 0.35s ease',
                                  }}
                                >
                                  {/* Operation Type Icon */}
                                  <div style={{
                                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                    background: `${st.color}22`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 16,
                                  }}>
                                    {s.inspection_type === 'first_piece' ? '🔬' : s.inspection_type === 'hourly' ? '⏱️' : s.inspection_type === 'final' ? '✅' : '📋'}
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                      {inspectionTypeLabel(s.inspection_type)}
                                      {s.template_name && (
                                        <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6, fontSize: '0.8rem' }}>
                                          · {s.template_name}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                      <span>👤 {s.operator_name || `Operator #${s.operator_id}`}</span>
                                      <span>Shift {s.shift}</span>
                                      <span>{formatDateTime(s.started_at)}</span>
                                    </div>
                                  </div>

                                  {/* Progress */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, minWidth: 90 }}>
                                    <span className={`badge ${st.badge}`} style={{ fontSize: 10 }}>
                                      {isJustUpdated ? '🎙 LIVE ENTRY' : st.label}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                                        <div style={{
                                          height: '100%', borderRadius: 3,
                                          background: s.has_ooc ? '#ef4444' : '#3b82f6',
                                          width: `${s.progress ?? 0}%`,
                                          transition: 'width 0.5s ease',
                                        }} />
                                      </div>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {s.progress ?? 0}%
                                      </span>
                                    </div>
                                  </div>

                                  <span style={{ color: 'var(--accent-blue)', fontSize: 16, flexShrink: 0 }}>›</span>
                                </button>
                              );
                            })}
                          </>
                        )}

                        {/* Historical sessions for this part */}
                        {allPartSessions.filter(s => !liveSessions.includes(s)).length > 0 && (
                          <>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 6, marginBottom: 2 }}>
                              📁 Previous Sessions
                            </div>
                            {allPartSessions
                              .filter(s => !liveSessions.includes(s))
                              .slice(0, 5)
                              .map(s => {
                                const st = statusStyle(s);
                                return (
                                  <button
                                    key={s.session_id}
                                    onClick={() => setSelectedSessionId(s.session_id)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 12,
                                      padding: '10px 14px', border: 'none', cursor: 'pointer',
                                      borderRadius: 8, textAlign: 'left', width: '100%',
                                      background: 'var(--bg-hover)',
                                      borderLeft: `3px solid var(--border)`,
                                    }}
                                  >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                        {inspectionTypeLabel(s.inspection_type)}
                                        {s.template_name && <span style={{ fontWeight: 400, marginLeft: 6 }}>· {s.template_name}</span>}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                        {s.operator_name || `Operator #${s.operator_id}`} · {formatDateTime(s.started_at)}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                      <span className={`badge ${st.badge}`} style={{ fontSize: 10 }}>{st.label}</span>
                                      {s.has_ooc && <span className="badge badge-ooc" style={{ fontSize: 10 }}>OOC</span>}
                                    </div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>›</span>
                                  </button>
                                );
                              })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All Sessions History (Full Machine) */}
        <div className="card">
          <div className="section-header mb-16" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              <span className="dot" />
              All Inspection Sessions — {machine.machine_code} ({allSessions.length})
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={fetchData}>↻ Refresh</button>
              {allSessions.length > 0 && (
                <button className="btn btn-danger btn-sm" onClick={handleClearHistory}>
                  Clear History
                </button>
              )}
            </div>
          </div>

          {allSessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">No inspection history for {machine.machine_code} yet.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Part Number</th>
                    <th>Operation / Type</th>
                    <th>Operator</th>
                    <th>Shift</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>OOC</th>
                    <th>Date & Time</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allSessions.map((s) => {
                    const st = statusStyle(s);
                    const todaySDateLocal = new Date(s.started_at).toLocaleDateString('en-CA');
                    const isToday = todaySDateLocal === todayLocal;
                    return (
                      <tr
                        key={s.session_id}
                        style={{
                          background: isToday ? 'rgba(59,130,246,0.04)' : 'transparent',
                        }}
                      >
                        <td className="font-mono" style={{ fontWeight: 600 }}>{s.part_number}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{inspectionTypeLabel(s.inspection_type)}</div>
                          {s.template_name && <div className="text-xs text-muted">{s.template_name}</div>}
                        </td>
                        <td>{s.operator_name || `Operator #${s.operator_id}`}</td>
                        <td>Shift {s.shift}</td>
                        <td style={{ minWidth: 100 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="progress-bar" style={{ flex: 1, height: 5 }}>
                              <div
                                className={`progress-fill${s.has_ooc ? ' ooc' : ''}`}
                                style={{ width: `${s.progress ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold">{s.progress ?? 0}%</span>
                          </div>
                        </td>
                        <td><Badge type={s.status} /></td>
                        <td>
                          {s.has_ooc
                            ? <span className="badge badge-ooc">OOC</span>
                            : <span className="badge badge-ok">✓ OK</span>}
                        </td>
                        <td className="text-xs text-muted">{formatDateTime(s.started_at)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setSelectedSessionId(s.session_id)}
                            style={{
                              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                              border: 'none', fontWeight: 600,
                            }}
                          >
                            View Report (F02)
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Live / Historical Report Sheet Modal */}
      {selectedSessionId && (
        <LiveSheetViewer
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </>
  );
}
