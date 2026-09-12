import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../document_control/NotificationBell';

const SHIFTS = ['A', 'B', 'C'];

export default function Header({
  title,
  subtitle,
  shift,
  onShiftChange,
  showLiveStatus = true,
  showNotifications = true,
  actions,
}) {
  const ws = useWebSocket();
  const connected = ws?.connected ?? false;
  const { user } = useAuth();

  const roleLabels = {
    admin: 'ADMIN',
    supervisor: 'SUPERVISOR',
    calibrator: 'CALIBRATOR',
    operator: 'OPERATOR',
    quality_engineer: 'INSPECTOR',
    inspector: 'INSPECTOR',
  };
  const roleText = user ? (roleLabels[user.role] || user.role?.toUpperCase()) : '';

  return (
    <header className="header">
      <div>
        <div className="header-title">{title}</div>
        {subtitle && <div className="header-sub">{subtitle}</div>}
      </div>

      <div className="header-right">
        {actions}

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

        {/* Active User Role Badge */}
        {roleText && (
          <div className={`header-role-pill role-${user?.role || 'default'}`} title={`Logged in as ${roleText}`}>
            {roleText}
          </div>
        )}

        {/* WebSocket status */}
        {showLiveStatus && (
          <div className="ws-indicator" title={connected ? 'Live feed connected' : 'Reconnecting...'}>
            <span className={`ws-dot${connected ? '' : ' disconnected'}`} />
            {connected ? 'Live' : 'Offline'}
          </div>
        )}

        {/* Universal Notification Bell */}
        {showNotifications && <NotificationBell />}

        {/* Current time */}
        <span className="text-xs text-muted">
          {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </header>
  );
}
