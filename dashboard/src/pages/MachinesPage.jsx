import { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Badge from '../components/common/Badge';
import LiveSheetViewer from '../components/inspection/LiveSheetViewer';
import api from '../api/axios';
import { getLiveStatus } from '../api/dashboard';
import { useWebSocket } from '../context/WebSocketContext';
import { Link } from 'react-router-dom';

const PLANT_ID = 1;

export default function MachinesPage() {
  const [machines, setMachines]             = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [activeLiveSheetSessionId, setActiveLiveSheetSessionId] = useState(null);

  const ws = useWebSocket();
  const wsEvents = ws?.events ?? [];

  // Fetch machines and active live sessions
  const fetchData = useCallback(async () => {
    try {
      const [mRes, sRes] = await Promise.all([
        api.get('/api/machines/'),
        getLiveStatus(), // Fetch all active sessions across all machines
      ]);
      const mData = mRes.data?.results ?? mRes.data ?? [];
      setMachines(Array.isArray(mData) ? mData : []);
      setActiveSessions(sRes.data?.active_sessions ?? []);
    } catch {
      setMachines([]);
      setActiveSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch active sessions when a session status change arrives via WebSockets
  useEffect(() => {
    const latestEvent = wsEvents[0]?.event;
    if (['session_completed', 'session_started', 'rejection_alert'].includes(latestEvent)) {
      fetchData();
    }
  }, [wsEvents[0]?._receivedAt, fetchData]);

  // Update progress live on WebSocket measurement events
  useEffect(() => {
    const latest = wsEvents[0];
    if (latest?.event === 'measurement_recorded' && latest.session_id) {
      setActiveSessions((prev) =>
        prev.map((s) => {
          if (s.session_id === latest.session_id) {
            return {
              ...s,
              progress: latest.progress ?? s.progress,
              has_ooc: s.has_ooc || latest.status === 'out_of_spec',
              has_critical_fail: s.has_critical_fail || latest.is_critical,
              lastUpdated: latest._receivedAt,
            };
          }
          return s;
        })
      );
    }
  }, [wsEvents[0]?._receivedAt]);

  // Compare using local date (IST) — not raw UTC string slice
  const todayLocal = new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD" in local TZ

  // Create a map from machine_code to active session started today
  const sessionMap = {};
  activeSessions.forEach((s) => {
    if (!s.started_at) return;
    const sDateLocal = new Date(s.started_at).toLocaleDateString('en-CA');
    if (sDateLocal === todayLocal && !sessionMap[s.machine_code]) {
      sessionMap[s.machine_code] = s;
    }
  });


  const activeMachinesCount = Object.keys(sessionMap).length;

  return (
    <>
      <Header
        title="Live Reports"
        subtitle="Real-Time Active Operator Tracking & Inspection Sheets per Machine"
      />

      <div className="page-content bg-gradient-animated">
        {/* Machine Table with Live Status */}
        <div className="card">
          <h3 className="section-title mb-16">
            <span className="dot" />
            Machine Registry & Real-Time Station Status ({machines.length})
          </h3>

          {loading ? (
            <LoadingSpinner message="Fetching machines & live operator assignments..." />
          ) : machines.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">No machines configured in database yet.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Machine Code</th>
                    <th>Machine Name</th>
                    <th>Active Operator</th>
                    <th>Part Number</th>
                    <th>Live Progress</th>
                    <th>Real-Time Status</th>
                    <th style={{ textAlign: 'right' }}>Live Inspection Sheet</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => {
                    const activeSession = sessionMap[m.machine_code];
                    const isRecentlyUpdated =
                      wsEvents[0]?.event === 'measurement_recorded' &&
                      wsEvents[0]?.machine_code === m.machine_code;

                    return (
                      <tr
                        key={m.id}
                        style={{
                          background: isRecentlyUpdated
                            ? 'rgba(139, 92, 246, 0.12)'
                            : activeSession
                            ? 'rgba(59, 130, 246, 0.04)'
                            : 'transparent',
                          transition: 'background 0.4s ease',
                        }}
                      >
                        {/* Machine Code */}
                        <td className="font-mono font-bold">
                          <Link to={`/machines/${m.id}`} className="text-blue" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span>{m.machine_code}</span>
                          </Link>
                        </td>

                        {/* Machine Name */}
                        <td>
                          <div><strong>{m.name}</strong></div>
                          <div className="text-xs text-muted">{m.machine_type || '—'} · {m.manufacturer || ''}</div>
                        </td>

                        {/* Active Operator */}
                        <td>
                          {activeSession ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ color: 'var(--accent-blue)', fontSize: '0.85rem' }}>
                                {activeSession.operator_name}
                              </strong>
                              <span className="text-xs text-muted"> (Shift {activeSession.shift})</span>
                            </div>
                          ) : (
                            <span className="text-muted text-xs">— Idle</span>
                          )}
                        </td>

                        {/* Part Number */}
                        <td>
                          {activeSession ? (
                            <div>
                              <strong className="mono" style={{ color: 'var(--text-primary)' }}>
                                {activeSession.part_number}
                              </strong>
                              <div className="text-xs text-muted">{activeSession.inspection_type}</div>
                            </div>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>

                        {/* Live Progress Bar */}
                        <td style={{ minWidth: 140 }}>
                          {activeSession ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="progress-bar" style={{ flex: 1 }}>
                                <div
                                  className={`progress-fill${activeSession.has_ooc ? ' ooc' : ''}`}
                                  style={{ width: `${activeSession.progress ?? 0}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                {activeSession.progress ?? 0}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted text-xs">0%</span>
                          )}
                        </td>

                        {/* Real-Time Status */}
                        <td>
                          {isRecentlyUpdated ? (
                            <span className="badge badge-voice" style={{ animation: 'pulse-badge 1s infinite' }}>
                              MIC ENTRY
                            </span>
                          ) : activeSession?.has_critical_fail ? (
                            <Badge type="critical" />
                          ) : activeSession?.has_ooc ? (
                            <Badge type="ooc" />
                          ) : activeSession ? (
                            <span className="badge badge-progress">IN PROGRESS</span>
                          ) : (
                            <span className="badge badge-manual">IDLE</span>
                          )}
                        </td>

                        {/* Live Sheet Action Button */}
                        <td style={{ textAlign: 'right' }}>
                          {activeSession ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setActiveLiveSheetSessionId(activeSession.session_id)}
                              style={{
                                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                                border: 'none',
                                fontWeight: 600,
                              }}
                            >
                              View Live Sheet (F02)
                            </button>
                          ) : (
                            <span className="text-muted text-xs" style={{ fontStyle: 'italic' }}>
                              No active session
                            </span>
                          )}
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

      {/* Real-Time Interactive Form F02 Live Sheet Viewer Modal */}
      {activeLiveSheetSessionId && (
        <LiveSheetViewer
          sessionId={activeLiveSheetSessionId}
          onClose={() => setActiveLiveSheetSessionId(null)}
        />
      )}
    </>
  );
}
