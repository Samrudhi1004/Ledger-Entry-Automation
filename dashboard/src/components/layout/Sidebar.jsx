import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  Layers,
  Users,
  Sliders,
  Cpu,
  BarChart3,
  Factory,
  LogOut,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';

const MODULES = [
  {
    key: 'master',
    label: 'Master Database',
    icon: Database,
    items: [
      { icon: Users, label: 'Users & Operators', to: '/users' },
      { icon: Sliders, label: 'Master Parameters', to: '/parameters' },
    ],
  },
  {
    key: 'qa',
    label: 'Reports',
    icon: ShieldCheck,
    to: '/reports',
    items: [],
  },
  {
    key: 'production',
    label: 'Production Module',
    icon: Layers,
    to: '/production',
    items: [],
  },
];

export default function Sidebar({ pendingCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  // Initialize expanded state: expand module that contains current active route, or master by default
  const [expanded, setExpanded] = useState(() => {
    const activeMod = MODULES.find((m) => m.items && m.items.some((item) => item.to === location.pathname));
    return activeMod ? { [activeMod.key]: true } : { master: true };
  });

  // Automatically expand module when route changes
  useEffect(() => {
    const activeMod = MODULES.find((m) => m.items && m.items.some((item) => item.to === location.pathname));
    if (activeMod) {
      setExpanded((prev) => ({ ...prev, [activeMod.key]: true }));
    }
  }, [location.pathname]);

  const toggleModule = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
        <div className="sidebar-logo-icon">
          <Factory size={20} color="#ffffff" />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">{user?.role === 'admin' ? 'Admin Hub' : 'Inspection Hub'}</span>
          <span className="sidebar-logo-sub">{user?.role === 'admin' ? 'System Management' : 'Quality Control'}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {MODULES.filter(m => user?.role === 'admin' ? m.key === 'master' : true).map((m) => {
          let module = m;
          if (module.key === 'master' && user?.role !== 'admin') {
            module = { ...m, items: m.items.filter(item => item.to !== '/users') };
          }
          const ModuleIcon = module.icon;

          if (module.to) {
            const isDirectActive = location.pathname === module.to;
            return (
              <div key={module.key} className={`sidebar-module${isDirectActive ? ' has-active' : ''}`}>
                <NavLink
                  to={module.to}
                  className={`sidebar-module-header${isDirectActive ? ' active' : ''}`}
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                >
                  <span className="module-icon">
                    <ModuleIcon size={16} />
                  </span>
                  <span className="module-title">{module.label}</span>
                </NavLink>
              </div>
            );
          }

          const isExpanded = !!expanded[module.key];
          const hasActiveChild = module.items && module.items.some((item) => item.to === location.pathname);

          return (
            <div key={module.key} className={`sidebar-module${hasActiveChild ? ' has-active' : ''}`}>
              <button
                type="button"
                className={`sidebar-module-header${isExpanded ? ' expanded' : ''}`}
                onClick={() => toggleModule(module.key)}
              >
                <span className="module-icon">
                  <ModuleIcon size={16} />
                </span>
                <span className="module-title">{module.label}</span>
                <span className="module-chevron">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </button>

              {isExpanded && (
                <div className="sidebar-submodules">
                  {module.items && module.items.length > 0 ? (
                    module.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === '/'}
                          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                        >
                          <ItemIcon size={16} />
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {item.badgeKey === 'pending' && pendingCount > 0 && (
                            <span className="nav-badge">{pendingCount}</span>
                          )}
                        </NavLink>
                      );
                    })
                  ) : (
                    <div className="sidebar-empty-item">
                      <span style={{ opacity: 0.5, fontSize: '0.75rem', fontStyle: 'italic', paddingLeft: '8px' }}>
                        (Empty)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
            style={{ padding: '4px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

