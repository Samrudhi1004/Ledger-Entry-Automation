import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

const NAV_ITEMS = [
  { icon: '⚡', label: 'Live Dashboard',    to: '/' },
  { icon: '⏳', label: 'Pending Reviews',   to: '/pending',   badgeKey: 'pending' },
  { icon: '📋', label: 'Inspections',       to: '/inspections' },
  { icon: '📊', label: 'Analytics',         to: '/analytics' },
  { icon: '🏭', label: 'Machines',          to: '/machines' },
  { icon: '👥', label: 'Users & Operators', to: '/users' },
];

export default function Sidebar({ pendingCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || user.username?.[0]?.toUpperCase()
    : '?';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏭</div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">Inspection Hub</span>
          <span className="sidebar-logo-sub">Quality Control</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badgeKey === 'pending' && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="user-pill">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">
              {user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '—'}
            </div>
            <div className="user-role">{user?.role ?? 'supervisor'}</div>
          </div>
          <button
            id="sidebar-logout"
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{ padding: '4px 8px', flexShrink: 0 }}
            title="Log out"
          >
            ↩
          </button>
        </div>
      </div>
    </aside>
  );
}
