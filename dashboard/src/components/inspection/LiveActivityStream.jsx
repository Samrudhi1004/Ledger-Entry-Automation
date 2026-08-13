import { useWebSocket } from '../../context/WebSocketContext';
import { formatTime } from '../../utils/formatters';

export default function LiveActivityStream({ maxItems = 15 }) {
  const ws = useWebSocket();
  const events = ws?.events ?? [];

  // Filter events related to live measurement entries & sessions
  const liveEvents = events.filter((e) =>
    ['measurement_recorded', 'out_of_spec_alert', 'session_started', 'session_completed', 'rejection_alert'].includes(e.event)
  ).slice(0, maxItems);

  if (liveEvents.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '30px 20px' }}>
        <div className="empty-state-text" style={{ fontSize: '0.85rem' }}>
          Waiting for live operator voice entries...
        </div>
        <div className="text-xs text-muted mt-4">
          Entries recorded via mic will stream here in real time.
        </div>
      </div>
    );
  }

  return (
    <div className="live-activity-stream" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
      {liveEvents.map((evt, idx) => {
        const isMeasurement = evt.event === 'measurement_recorded';
        const isOOC = evt.status === 'out_of_spec' || evt.event === 'out_of_spec_alert';
        const isVoice = evt.method === 'voice' || !!evt.voice_raw_text;
        const isNewSession = evt.event === 'session_started';
        const isCompleted = evt.event === 'session_completed';

        return (
          <div
            key={idx}
            className="activity-item"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: isOOC
                ? 'rgba(239, 68, 68, 0.1)'
                : isVoice
                ? 'rgba(139, 92, 246, 0.08)'
                : 'var(--bg-elevated)',
              border: `1px solid ${
                isOOC
                  ? 'rgba(239, 68, 68, 0.3)'
                  : isVoice
                  ? 'rgba(139, 92, 246, 0.25)'
                  : 'var(--border)'
              }`,
              transition: 'var(--transition)',
              animation: idx === 0 ? 'slide-down 0.3s ease' : 'none',
            }}
          >
            {/* Event Tag */}
            <div style={{ fontSize: 10, fontWeight: 800, marginTop: 2, flexShrink: 0, padding: '2px 6px', borderRadius: 4, background: isOOC ? '#ef4444' : isVoice ? '#7c3aed' : '#3b82f6', color: '#ffffff' }}>
              {isOOC
                ? 'OOC'
                : isVoice
                ? 'VOICE'
                : isNewSession
                ? 'START'
                : isCompleted
                ? 'DONE'
                : 'DATA'}
            </div>

            {/* Event Body */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {evt.operator_name || 'Operator'} &nbsp;
                  <span className="mono" style={{ color: 'var(--accent-blue)', fontSize: '0.75rem' }}>
                    {evt.machine_code || 'Machine'}
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {formatTime(evt._receivedAt)}
                </span>
              </div>

              {isMeasurement && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <span>Recorded <strong>{evt.parameter_code}</strong> ({evt.parameter_name}): </span>
                  <span className="mono font-bold" style={{ color: isOOC ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {evt.measured_value} {evt.unit || ''}
                  </span>
                  {evt.nominal !== undefined && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                      (Spec: {evt.nominal} [{evt.lower_limit}..{evt.upper_limit}])
                    </span>
                  )}
                </div>
              )}

              {isNewSession && (
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue)' }}>
                  Started new session for part <strong>{evt.part_number || ''}</strong> ({evt.inspection_type || ''} · Shift {evt.shift || ''})
                </div>
              )}

              {isCompleted && (
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-green)' }}>
                  Completed session for machine {evt.machine_code}. Submitted for review.
                </div>
              )}

              {evt.voice_raw_text && (
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent-purple)',
                    marginTop: 4,
                    background: 'rgba(139, 92, 246, 0.12)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    display: 'inline-block',
                  }}
                >
                  🎙 Transcript: "{evt.voice_raw_text}"
                </div>
              )}
            </div>

            {/* Status / Method Badge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              {isOOC && <span className="badge badge-ooc">OOC</span>}
              {!isOOC && isMeasurement && <span className="badge badge-ok">OK</span>}
              {isVoice && <span className="badge badge-voice">MIC ENTRY</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
