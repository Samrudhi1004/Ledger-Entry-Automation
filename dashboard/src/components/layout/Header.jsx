import { useWebSocket } from '../../context/WebSocketContext';

const SHIFTS = ['A', 'B', 'C'];

export default function Header({ title, subtitle, shift, onShiftChange }) {
  const ws = useWebSocket();
  const connected = ws?.connected ?? false;

  return (
    <header className="header">
      <div>
        <div className="header-title">{title}</div>
        {subtitle && <div className="header-sub">{subtitle}</div>}
      </div>

      <div className="header-right">
        {/* Shift selector */}
        {onShiftChange && (
          <div className="shift-tabs" role="group" aria-label="Shift selector">
            {SHIFTS.map((s) => (
              <button
                key={s}
                id={`shift-tab-${s}`}
                className={`shift-tab${shift === s ? ' active' : ''}`}
                onClick={() => onShiftChange(s)}
              >
                Shift {s}
              </button>
            ))}
          </div>
        )}

        {/* WebSocket status */}
        <div className="ws-indicator" title={connected ? 'Live feed connected' : 'Reconnecting...'}>
          <span className={`ws-dot${connected ? '' : ' disconnected'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>

        {/* Current time */}
        <span className="text-xs text-muted">
          {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </header>
  );
}
