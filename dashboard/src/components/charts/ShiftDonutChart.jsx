import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = {
  approved: '#10b981',
  rejected: '#ef4444',
  pending:  '#f59e0b',
  ooc:      '#8b5cf6',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      fontSize: '0.78rem',
    }}>
      <p style={{ color: payload[0].payload.fill }}>{payload[0].name}: <strong>{payload[0].value}</strong></p>
    </div>
  );
};

export default function ShiftDonutChart({ summary }) {
  if (!summary) {
    return (
      <div className="empty-state" style={{ height: 200 }}>
        <div className="empty-state-icon">🍩</div>
        <div className="empty-state-text">No shift data</div>
      </div>
    );
  }

  const data = [
    { name: 'Approved', value: summary.approved, fill: COLORS.approved },
    { name: 'Rejected', value: summary.rejected, fill: COLORS.rejected },
    { name: 'Pending',  value: summary.pending,  fill: COLORS.pending  },
  ].filter((d) => d.value > 0);

  if (!data.length) {
    return (
      <div className="empty-state" style={{ height: 200 }}>
        <div className="empty-state-icon">🍩</div>
        <div className="empty-state-text">No inspections this shift yet</div>
      </div>
    );
  }

  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} stroke="var(--bg-surface)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
