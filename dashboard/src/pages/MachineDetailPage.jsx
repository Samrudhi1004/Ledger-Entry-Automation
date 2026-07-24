import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatCard from '../components/cards/StatCard';
import api from '../api/axios';
import { getMachinePerformance } from '../api/analytics';
import { fmt } from '../utils/formatters';

export default function MachineDetailPage() {
  const { machineId } = useParams();
  const [machine, setMachine] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const mRes = await api.get(`/api/machines/${machineId}/`);
        setMachine(mRes.data);

        const pRes = await getMachinePerformance(machineId, 30);
        setPerformance(pRes.data);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [machineId]);

  if (loading) {
    return (
      <>
        <Header title="Machine Performance" />
        <div className="page-content bg-gradient-animated">
          <LoadingSpinner message="Fetching performance log..." />
        </div>
      </>
    );
  }

  if (!machine) {
    return (
      <>
        <Header title="Machine Performance" />
        <div className="page-content bg-gradient-animated">
          <div className="card text-center" style={{ padding: 40 }}>
            <h3>Machine Not Found</h3>
            <Link to="/machines" className="btn btn-primary mt-20">Back to Machines</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={`Machine: ${machine.machine_code}`}
        subtitle={`Historical health metrics & pass rates`}
      />

      <div className="page-content bg-gradient-animated">
        <div className="page-breadcrumb mb-16">
          <Link to="/machines">Machines</Link> / <span>{machine.machine_code}</span>
        </div>

        <div className="grid-1-2">
          {/* Specs */}
          <div className="card">
            <h3>Machine Specs</h3>
            <div className="info-row mt-12" style={{ flexDirection: 'column', gap: 10 }}>
              <div className="info-item">
                <span className="info-label">Name</span>
                <span className="info-value">{machine.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Type</span>
                <span className="info-value">{machine.machine_type}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Manufacturer</span>
                <span className="info-value">{machine.manufacturer}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Model Number</span>
                <span className="info-value">{machine.model_number}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Registry status</span>
                <span className="info-value">
                  <span className={`badge badge-${machine.status === 'Active' ? 'ok' : 'pending'}`}>
                    {machine.status}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Performance summary */}
          <div>
            <div className="stat-grid mb-20" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <StatCard
                label="30-Day Checkups"
                value={performance?.total ?? 0}
                sub="Inspection sheets processed"
                accent="var(--accent-blue)"
                icon="📋"
              />
              <StatCard
                label="Pass Rate"
                value={performance ? `${fmt(performance.pass_rate, 1)}%` : '0%'}
                sub="Sheets quality approved"
                accent="var(--accent-green)"
                icon="🎯"
              />
              <StatCard
                label="OOC Incidents"
                value={performance?.ooc_count ?? 0}
                sub="Runs flagged out of spec"
                accent="var(--accent-yellow)"
                icon="⚠️"
              />
              <StatCard
                label="OOC Ratio"
                value={performance ? `${fmt(performance.ooc_rate, 1)}%` : '0%'}
                sub="OOC per run average"
                accent="var(--accent-red)"
                icon="🔥"
              />
            </div>

            <div className="card">
              <h3>Quality Status Note</h3>
              <p className="text-sm mt-8 text-secondary">
                This station operates within standard manufacturing parameters. Out-Of-Specification events are flagged immediately to supervisors for confirmation. Maintain proper tooling cycles to reduce OOC drifts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
