import { useState } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../document_control/NotificationBell';
import BugReportModal from '../common/BugReportModal';

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
  const [showBugReportModal, setShowBugReportModal] = useState(false);

  const roleLabels = {
    admin: 'ADMIN',
    supervisor: 'SUPERVISOR',
    calibrator: 'CALIBRATOR',
    operator: 'OPERATOR',
    quality_engineer: 'QUALITY ENGINEER',
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

        {/* Report Issue Button */}
        <button 
          className="btn btn-outline" 
          onClick={() => setShowBugReportModal(true)}
          style={{ padding: '4px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Report an issue or bug"
        >
          <span style={{ color: '#d32f2f' }}>⚠️</span> Report Issue
        </button>

        {showBugReportModal && (
          <BugReportModal onClose={() => setShowBugReportModal(false)} />
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
