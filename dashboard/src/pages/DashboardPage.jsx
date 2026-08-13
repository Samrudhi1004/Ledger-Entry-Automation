import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import StatCard from '../components/cards/StatCard';
import OOCTrendChart from '../components/charts/OOCTrendChart';
import ShiftDonutChart from '../components/charts/ShiftDonutChart';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import LiveActivityStream from '../components/inspection/LiveActivityStream';
import LiveSheetViewer from '../components/inspection/LiveSheetViewer';
import { getLiveStatus, getShiftSummary } from '../api/dashboard';
import { getOOCTrend } from '../api/analytics';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { formatTime, currentShift, shortId } from '../utils/formatters';

const PLANT_ID = 1; // default plant — can be made dynamic
const POLL_INTERVAL = 15000; // 15s live feed polling

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ws = useWebSocket();

  const [shift, setShift]             = useState(currentShift());
  const [sessions, setSessions]       = useState([]);
  const [summary, setSummary]         = useState(null);
  const [trendData, setTrendData]     = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeLiveSheetSessionId, setActiveLiveSheetSessionId] = useState(null);

  // ── Alert events from WebSocket ─────────────────────────
  const wsEvents = ws?.events ?? [];
  const recentAlerts = wsEvents
    .filter((e) => ['out_of_spec_alert', 'session_completed', 'measurement_recorded', 'SUPERVISOR_ESCALATION_ALERT', 'OPERATOR_REMINDER_DUE'].includes(e.event))
    .slice(0, 10);

  const escalationAlert = wsEvents.find((e) => e.event === 'SUPERVISOR_ESCALATION_ALERT');

  // ── Fetch live sessions ──────────────────────────────────
  const fetchLive = useCallback(async () => {
    try {
      const res = await getLiveStatus();
      setSessions(res.data.active_sessions ?? []);
    } catch { /* silently retry */ } finally {
      setSessionsLoading(false);
    }
  }, []);

  // ── Fetch shift summary ──────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const res = await getShiftSummary(PLANT_ID, shift);
      setSummary(res.data.summary);
    } catch { /* */ }
  }, [shift]);

  // ── Fetch 7-day OOC trend ────────────────────────────────
  const fetchTrend = useCallback(async () => {
    try {
      const res = await getOOCTrend(7, PLANT_ID);
      setTrendData(res.data.trend ?? []);
    } catch { /* */ }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLive();
    fetchSummary();
    fetchTrend();
  }, [fetchLive, fetchSummary, fetchTrend]);

  // Re-fetch on shift change
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Poll live feed every 15s (WebSocket handles real-time, poll is a fallback)
  useEffect(() => {
    const interval = setInterval(fetchLive, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLive]);

  // Refresh live feed when WebSocket session events arrive
  useEffect(() => {
    const latestEvent = wsEvents[0]?.event;
    if (['session_completed', 'session_started', 'rejection_alert'].includes(latestEvent)) {
      fetchLive();
      fetchSummary();
    }
  }, [wsEvents[0]?._receivedAt]);

  // Update session progress or status live when a measurement event arrives
  useEffect(() => {
    const latest = wsEvents[0];
    if (latest?.event === 'measurement_recorded' && latest.session_id) {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.session_id === latest.session_id) {
            return {
              ...s,
              progress: latest.progress ?? s.progress,
              has_ooc: s.has_ooc || latest.status === 'out_of_spec',
              has_critical_fail: s.has_critical_fail || latest.is_critical,
              last_measurement_at: latest._receivedAt,
            };
          }
          return s;
        })
      );
    }
  }, [wsEvents[0]?._receivedAt]);

  return (
    <>
      <Header
        title="Supervisor Live Inspection Dashboard"
        subtitle={`Real-Time Operator & Sheet Monitoring · Welcome ${user?.first_name ?? user?.username ?? 'Supervisor'}`}
        shift={shift}
        onShiftChange={setShift}
      />

      <div className="page-content bg-gradient-animated">
        {/* ── Supervisor Escalation Alert Banner ──────────────── */}
        {escalationAlert && (
          <div className="card mb-20" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', animation: 'critical-pulse 2s infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 15, color: '#fca5a5', display: 'block' }}>
                  SUPERVISOR ESCALATION: OVERDUE MEASUREMENT REMINDER
                </strong>
                <span style={{ fontSize: 13, color: '#f87171' }}>
                  {escalationAlert.data?.message || escalationAlert.message || 'An operator has exceeded the 60-min measurement window by 15+ minutes!'}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => ws?.clearEvents?.()}
                style={{ color: '#fca5a5', borderColor: '#ef4444' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── KPI Stat Cards ─────────────────────────────── */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <StatCard
            label="Total Inspections"
            value={summary?.total ?? '—'}
            sub={`Shift ${shift} · Today`}
            accent="var(--accent-blue)"
          />
          <StatCard
            label="Approved"
            value={summary?.approved ?? '—'}
            sub={summary ? `${summary.pass_rate}% pass rate` : ''}
            accent="var(--accent-green)"
          />
          <StatCard
            label="Rejected"
            value={summary?.rejected ?? '—'}
            sub="Failed inspections"
            accent="var(--accent-red)"
          />
          <StatCard
            label="OOC Count"
            value={summary?.ooc_count ?? '—'}
            sub="Out-of-spec parameters"
            accent="var(--accent-yellow)"
            alert={(summary?.ooc_count ?? 0) > 0}
          />
        </div>

        {/* ── Active Operators Matrix + Live Mic Entry Stream ─────────────────────── */}
        <div className="grid-2-1 mb-20">
          {/* Active Operator-Machine Cards Grid */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">
                <span className="dot" />
                Active Operators & Machines
                <span className="badge badge-progress" style={{ marginLeft: 4 }}>
                  {sessions.length} Live Sessions
                </span>
              </div>
              <button
                id="refresh-live"
                className="btn btn-ghost btn-sm"
                onClick={fetchLive}
              >
                ↻ Refresh
              </button>
            </div>

            {sessionsLoading ? (
              <LoadingSpinner message="Fetching active operator sessions..." />
            ) : sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">No active operator sessions right now</div>
                <div className="text-xs text-muted mt-4">
                  When operators start machine inspections on their mobile app, they will appear here live.
                </div>
              </div>
            ) : (
              <div className="live-feed">
                {sessions.map((s) => {
                  const isRecentlyUpdated =
                    wsEvents[0]?.event === 'measurement_recorded' &&
                    wsEvents[0]?.session_id === s.session_id;

                  return (
                    <div
                      key={s.session_id}
                      id={`session-card-${s.session_id}`}
                      className={`session-card${s.has_critical_fail ? ' has-critical' : s.has_ooc ? ' has-ooc' : ''}`}
                      style={{
                        background: isRecentlyUpdated
                          ? 'rgba(139, 92, 246, 0.15)'
                          : 'var(--bg-elevated)',
                        transition: 'background 0.4s ease',
                      }}
                    >
                      <div className="session-header">
                        <div>
                          <div className="session-machine" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{s.machine_code}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({s.machine_name || 'CNC'})</span>
                          </div>
                          <div className="session-part" style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                            Part: {s.part_number}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {isRecentlyUpdated && (
                            <span className="badge badge-voice" style={{ animation: 'pulse-badge 1s infinite' }}>
                              MIC ENTRY
                            </span>
                          )}
                          {s.has_critical_fail && <Badge type="critical" />}
                          {s.has_ooc && !s.has_critical_fail && <Badge type="ooc" />}
                          <span className="badge badge-progress">{s.inspection_type}</span>
                        </div>
                      </div>

                      <div className="session-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="session-operator" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                            {s.operator_name || `Operator #${s.operator_id}`}
                          </span>
                          <span className="text-xs text-muted"> · Shift {s.shift}</span>
                          <span className="text-xs text-muted"> · Started {formatTime(s.started_at)}</span>
                        </div>

                        {/* Button to pop up Live Sheet */}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLiveSheetSessionId(s.session_id);
                          }}
                          style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            borderColor: 'var(--accent-blue)',
                            color: 'var(--accent-blue)',
                            fontWeight: 600,
                          }}
                        >
                          View Live Sheet
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div className="progress-bar" style={{ flex: 1 }}>
                          <div
                            className={`progress-fill${s.has_ooc ? ' ooc' : ''}`}
                            style={{ width: `${s.progress ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          {s.progress ?? 0}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Real-Time Voice Mic Data Entry Stream */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">
                <span className="dot" style={{ background: 'var(--accent-purple)' }} />
                Real-Time Mic Entry Ticker
              </div>
              <div className="ws-indicator">
                <span className="ws-dot" />
                <span>Live Feed</span>
              </div>
            </div>
            <LiveActivityStream maxItems={15} />
          </div>
        </div>

        {/* ── Shift Donut + 7-Day OOC Trend ─────────────────── */}
        <div className="grid-2">
          {/* Shift Donut */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">
                <span className="dot" style={{ background: 'var(--accent-yellow)' }} />
                Shift {shift} Summary
              </div>
              {summary && (
                <span className="text-xs text-muted">
                  Pass rate: <span className="text-green font-bold">{summary.pass_rate}%</span>
                </span>
              )}
            </div>
            <ShiftDonutChart summary={summary} />
          </div>

          {/* OOC Trend Chart */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">
                <span className="dot" style={{ background: 'var(--accent-red)' }} />
                7-Day Out-of-Spec Trend
              </div>
            </div>
            <OOCTrendChart data={trendData} />
          </div>
        </div>
      </div>

      {/* Real-time Interactive Form F02 Live Sheet Viewer Modal */}
      {activeLiveSheetSessionId && (
        <LiveSheetViewer
          sessionId={activeLiveSheetSessionId}
          onClose={() => setActiveLiveSheetSessionId(null)}
        />
      )}
    </>
  );
}
