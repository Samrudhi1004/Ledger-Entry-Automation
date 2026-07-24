/**
 * StatCard — KPI card with top-accent line
 *
 * Props:
 *  label       string
 *  value       number | string
 *  sub         string (small subtext below value)
 *  accent      CSS color (overrides --stat-accent)
 *  alert       bool (red glow state)
 *  icon        emoji
 */
export default function StatCard({ label, value, sub, accent, alert, icon }) {
  return (
    <div
      className={`stat-card${alert ? ' alert' : ''}`}
      style={accent ? { '--stat-accent': accent } : {}}
    >
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
