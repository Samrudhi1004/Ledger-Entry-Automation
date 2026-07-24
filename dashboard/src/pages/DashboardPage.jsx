import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import StatCard from '../components/cards/StatCard';
import OOCTrendChart from '../components/charts/OOCTrendChart';
import ShiftDonutChart from '../components/charts/ShiftDonutChart';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
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

  // ── Alert events from WebSocket ─────────────────────────
  const wsEvents = ws?.events ?? [];
  const recentAlerts = wsEvents
    .filter((e) => ['out_of_spec_alert', 'session_completed', 'measurement_recorded', 'SUPERVISOR_ESCALATION_ALERT', 'OPERATOR_REMINDER_DUE'].includes(e.event))
    .slice(0, 10);

  const escalationAlert = wsEvents.find((e) => e.event === 'SUPERVISOR_ESCALATION_ALERT');

  // ── Fetch live sessions ──────────────────────────────────
  const fetchLive = useCallback(async () => {
    try {
      const res = await getLiveStatus(PLANT_ID);
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

  // Refresh live feed when a WebSocket session_completed event arrives
  useEffect(() => {
    if (wsEvents[0]?.event === 'session_completed') {
      fetchLive();
      fetchSummary();
    }
  }, [wsEvents[0]?.event]);

  return (
    <>
      <Header
        title="Live Dashboard"
        subtitle={`Welcome, ${user?.first_name ?? user?.username ?? 'Supervisor'}`}
        shift={shift}
        onShiftChange={setShift}
      />

      <div className="page-content bg-gradient-animated">
        {/* ── Supervisor Escalation Alert Banner ──────────────── */}
        {escalationAlert && (
          <div className="card mb-20" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', animation: 'critical-pulse 2s infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>🚨</span>
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
        <div className="stat-grid">
          <StatCard
            label="Total Inspections"
            value={summary?.total ?? '—'}
            sub={`Shift ${shift} · Today`}
            accent="var(--accent-blue)"
            icon="📋"
          />
          <StatCard
            label="Approved"
            value={summary?.approved ?? '—'}
            sub={summary ? `${summary.pass_rate}% pass rate` : ''}
            accent="var(--accent-green)"
            icon="✅"
          />
          <StatCard
            label="Rejected"
            value={summary?.rejected ?? '—'}
            sub="Failed inspections"
            accent="var(--accent-red)"
            icon="❌"
          />
          <StatCard
            label="Pending Review"
            value={summary?.pending ?? '—'}
            sub="Awaiting supervisor"
            accent="var(--accent-yellow)"
            icon="⏳"
          />
          <StatCard
            label="OOC Count"
            value={summary?.ooc_count ?? '—'}
            sub="Out-of-spec parameters"
            accent="var(--accent-red)"
            alert={(summary?.ooc_count ?? 0) > 0}
            icon="🔴"
          />
        </div>

        {/* ── Live Feed + Trend Chart ─────────────────────── */}
        <div className="grid-2-1 mb-20">
          {/* Live Session Feed */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">
                <span className="dot" />
                Active Inspections
                <span className="badge badge-progress" style={{ marginLeft: 4 }}>
                  {sessions.length} Live
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
              <LoadingSpinner message="Fetching live sessions..." />
            ) : sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🏭</div>
                <div className="empty-state-text">No active inspections right now</div>
              </div>
            ) : (
              <div className="live-feed">
                {sessions.map((s) => (
                  <div
                    key={s.session_id}
                    id={`session-card-${s.session_id}`}
                    className={`session-card${s.has_critical_fail ? ' has-critical' : s.has_ooc ? ' has-ooc' : ''}`}
                    onClick={() => navigate(`/inspections/${s.session_id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/inspections/${s.session_id}`)}
                  >
                    <div className="session-header">
                      <div>
                        <div className="session-machine">
                          🏭 {s.machine_code}
                        </div>
                        <div className="session-part">{s.part_number}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {s.has_critical_fail && <Badge type="critical" />}
                        {s.has_ooc && !s.has_critical_fail && <Badge type="ooc" />}
                        <span className="text-xs text-muted">{s.inspection_type}</span>
                      </div>
                    </div>

                    <div className="session-meta">
                      <span className="session-operator">👤 {s.operator_name}</span>
                      <span className="text-xs text-muted">· Shift {s.shift}</span>
                      <span className="text-xs text-muted">· {formatTime(s.started_at)}</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div
                          className={`progress-fill${s.has_ooc ? ' ooc' : ''}`}
                          style={{ width: `${s.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">{s.progress ?? 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OOC Trend Chart */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">
                <span className="dot" style={{ background: 'var(--accent-red)' }} />
                7-Day OOC Trend
              </div>
            </div>
            <OOCTrendChart data={trendData} />
          </div>
        </div>

        {/* ── Shift Donut + Recent Alerts ─────────────────── */}
        <div className="grid-2">
          {/* Shift Donut */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">
                <span className="dot" style={{ background: 'var(--accent-yellow)' }} />
                Shift {shift} Breakdown
              </div>
              {summary && (
                <span className="text-xs text-muted">
                  Pass rate: <span className="text-green font-bold">{summary.pass_rate}%</span>
                </span>
              )}
            </div>
            <ShiftDonutChart summary={summary} />
          </div>

          {/* Recent Alerts */}
          <div className="card">
            <div className="section-header">
              <div className="section-title">
                <span className="dot" style={{ background: 'var(--accent-red)' }} />
                Recent Alerts
              </div>
              {recentAlerts.length > 0 && (
                <button
                  id="clear-alerts"
                  className="btn btn-ghost btn-sm"
                  onClick={() => ws?.clearEvents?.()}
                >
                  Clear
                </button>
              )}
            </div>

            {recentAlerts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-text">No alerts · All systems normal</div>
              </div>
            ) : (
              <div className="alert-list">
                {recentAlerts.map((evt, i) => {
                  const isEscalation = evt.event === 'SUPERVISOR_ESCALATION_ALERT';
                  const isReminder   = evt.event === 'OPERATOR_REMINDER_DUE';
                  const isOOC        = evt.event === 'out_of_spec_alert';

                  return (
                    <div
                      key={i}
                      className={`alert-item${isEscalation || isOOC ? ' critical' : ' info'}`}
                    >
                      <span className="alert-icon">
                        {isEscalation ? '🚨' :
                         isReminder   ? '⏰' :
                         isOOC        ? '🔴' :
                         evt.event === 'session_completed' ? '✅' : '📊'}
                      </span>
                      <div className="alert-body">
                        <div className="alert-msg">
                          {isEscalation
                            ? `OVERDUE 75m: ${evt.data?.operator_name || evt.operator_name || 'Operator'} (${evt.data?.machine_code || evt.machine_code || ''})`
                            : isReminder
                            ? `REMINDER 60m: ${evt.data?.operator_name || evt.operator_name || 'Operator'} (${evt.data?.machine_code || evt.machine_code || ''})`
                            : isOOC
                            ? `OOC: ${evt.parameter_name ?? 'Parameter'} = ${evt.measured_value}`
                            : evt.event === 'session_completed'
                            ? `Session ${shortId(evt.session_id)} completed`
                            : `Measurement recorded · ${evt.parameter_code ?? ''}`}
                        </div>
                        <div className="alert-time">
                          {evt.data?.machine_code || evt.machine_code || ''} · {formatTime(evt._receivedAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
