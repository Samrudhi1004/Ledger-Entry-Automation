import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatCard from '../components/cards/StatCard';
import { getReport, getParameterOOCRate } from '../api/analytics';
import { fmt } from '../utils/formatters';

export default function AnalyticsPage() {
  const [report, setReport]             = useState(null);
  const [oocParams, setOocParams]       = useState([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadingParams, setLoadingParams] = useState(true);

  const [fromConfig, setFromConfig] = useState('');
  const [toConfig, setToConfig]     = useState('');
  const [machineCode, setMachineCode] = useState('');

  const fetchAnalytics = async () => {
    setLoadingReport(true);
    try {
      const res = await getReport(fromConfig, toConfig, machineCode);
      setReport(res.data?.statistics);
    } catch { /* ignore */ } finally {
      setLoadingReport(false);
    }
  };

  const fetchOocParams = async () => {
    setLoadingParams(true);
    try {
      // Fetch for Poly V Pulley (FBT00222) as default
      const res = await getParameterOOCRate('FBT00222');
      setOocParams(res.data?.parameters ?? []);
    } catch { /* ignore */ } finally {
      setLoadingParams(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fromConfig, toConfig, machineCode]);

  useEffect(() => {
    fetchOocParams();
  }, []);

  return (
    <>
      <Header title="Analytics & Reports" subtitle="Long term quality metrics and parameters failure rates" />

      <div className="page-content bg-gradient-animated">
        {/* Date Filter Card */}
        <div className="card mb-20">
          <div className="filter-bar">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="analytics-from">From Date</label>
              <input
                id="analytics-from"
                type="date"
                className="form-input"
                value={fromConfig}
                onChange={(e) => setFromConfig(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="analytics-to">To Date</label>
              <input
                id="analytics-to"
                type="date"
                className="form-input"
                value={toConfig}
                onChange={(e) => setToConfig(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="analytics-machine">Machine Code</label>
              <input
                id="analytics-machine"
                type="text"
                className="form-input"
                placeholder="e.g. MCH-01"
                value={machineCode}
                onChange={(e) => setMachineCode(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 'auto' }}>
              <button
                id="reset-analytics"
                className="btn btn-ghost"
                onClick={() => { setFromConfig(''); setToConfig(''); setMachineCode(''); }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="stat-grid mb-20">
          <StatCard
            label="Total Runs"
            value={loadingReport ? '...' : report?.total}
            sub="Inspections completed"
            accent="var(--accent-blue)"
            icon="📈"
          />
          <StatCard
            label="Approved"
            value={loadingReport ? '...' : report?.approved}
            sub="Quality approved sheets"
            accent="var(--accent-green)"
            icon="✅"
          />
          <StatCard
            label="Rejected"
            value={loadingReport ? '...' : report?.rejected}
            sub="Quality rejected sheets"
            accent="var(--accent-red)"
            icon="❌"
          />
          <StatCard
            label="Out of Spec"
            value={loadingReport ? '...' : report?.ooc_count}
            sub="Runs with OOC warning"
            accent="var(--accent-yellow)"
            icon="⚠️"
          />
          <StatCard
            label="Pass Rate"
            value={loadingReport ? '...' : report ? `${report.pass_rate}%` : '—'}
            sub="Percentage of approved runs"
            accent="var(--accent-green)"
            icon="🎯"
          />
        </div>

        {/* Param Failure Table */}
        <div className="grid-1-2">
          <div className="card">
            <h3>Part Model Info</h3>
            <p className="text-sm mt-8">
              Analysis defaults to part: <strong>FBT00222 (POLY V PULLEY)</strong>.
            </p>
            <div className="info-row mt-12" style={{ flexDirection: 'column', gap: 10 }}>
              <div className="info-item">
                <span className="info-label">Worst failing parameter</span>
                <span className="info-value text-red font-bold">
                  {oocParams[0] ? `${oocParams[0]._id} (${oocParams[0].name})` : 'None'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Failure Rate</span>
                <span className="info-value font-mono">
                  {oocParams[0] ? `${fmt(oocParams[0].ooc_rate, 1)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title mb-16">
              <span className="dot" style={{ background: 'var(--accent-red)' }} />
              Parameter Failure Rates (OOC Rate)
            </h3>

            {loadingParams ? (
              <LoadingSpinner message="Calculating failures..." />
            ) : oocParams.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">No parameter failures recorded yet. Good job!</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Parameter Code</th>
                      <th>Parameter Name</th>
                      <th>Total Checks</th>
                      <th>OOC Counts</th>
                      <th>OOC Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oocParams.map((p, idx) => (
                      <tr key={idx}>
                        <td className="font-mono font-bold">{p._id}</td>
                        <td>{p.name}</td>
                        <td className="font-mono">{p.total}</td>
                        <td className="font-mono text-red">{p.ooc_count}</td>
                        <td className="font-mono font-bold" style={{ color: p.ooc_rate > 20 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                          {fmt(p.ooc_rate, 2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
