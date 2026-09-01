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
  Gauge,
  LogOut,
  ChevronDown,
  ChevronRight,
  CheckSquare,
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
  {
    key: 'tasks',
    label: 'Tasks Management',
    icon: CheckSquare,
    to: '/tasks',
    items: [],
  },
];

const CALIBRATION_MODULES = [
  {
    key: 'calibration',
    label: 'Calibration Equipment',
    icon: Gauge,
    to: '/calibration',
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
  const isCalibrator = user?.role === 'calibrator';
  const visibleModules = isCalibrator
    ? CALIBRATION_MODULES
    : MODULES.filter((module) => {
        if (user?.role === 'admin') return module.key === 'master' || module.key === 'tasks';
        if (user?.role === 'operator') return module.key !== 'tasks'; // operators use mobile app
        return true;
      });

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Factory size={20} color="#ffffff" />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">{isCalibrator ? 'Calibration Hub' : user?.role === 'admin' ? 'Admin Hub' : 'Inspection Hub'}</span>
          <span className="sidebar-logo-sub">{isCalibrator ? 'Equipment Control' : user?.role === 'admin' ? 'System Management' : 'Quality Control'}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {visibleModules.map((m) => {
          let module = m;
          if (module.key === 'master' && user?.role !== 'admin') {
            module = { ...m, items: m.items.filter(item => item.to !== '/users') };
          }
          const ModuleIcon = module.icon;

          if (module.to) {
            const isDirectActive = location.pathname === module.to || location.pathname.startsWith(`${module.to}/`);
            return (
              <div key={module.key} className="sidebar-module">
                <NavLink
                  to={module.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="module-icon">
                    <ModuleIcon size={16} />
                  </span>
                  <span>{module.label}</span>
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
        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            display: 'block',
            textDecoration: 'none',
            borderRadius: 10,
            border: isActive ? '1px solid rgba(29,78,216,0.25)' : '1px solid transparent',
            background: isActive ? 'rgba(29,78,216,0.06)' : 'transparent',
            transition: 'all 0.18s ease',
          })}
          onMouseEnter={e => {
            if (!e.currentTarget.classList.contains('active-profile')) {
              e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.07)';
            }
          }}
          onMouseLeave={e => {
            if (!e.currentTarget.style.borderColor.includes('29,78,216')) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }
          }}
        >
          <div className="user-pill">
            <div className="user-avatar" style={{ overflow: 'hidden', padding: 0 }}>
              {user?.profile_photo_url
                ? <img src={user.profile_photo_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : initials
              }
            </div>
            <div className="user-info">
              <div className="user-name">
                {user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '—'}
              </div>
              <div className="user-role">{user?.role ?? 'supervisor'}</div>
            </div>
            <button
              id="sidebar-logout"
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.preventDefault(); handleLogout(); }}
              disabled={loggingOut}
              style={{ padding: '4px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}

