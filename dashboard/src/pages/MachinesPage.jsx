import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../api/axios';
import { Link } from 'react-router-dom';

export default function MachinesPage() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const res = await api.get('/api/machines/');
        const data = res.data?.results ?? res.data ?? [];
        setMachines(Array.isArray(data) ? data : []);
      } catch {
        setMachines([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMachines();
  }, []);

  return (
    <>
      <Header title="Factory Machines" subtitle="View and manage machine lines & active stations" />

      <div className="page-content bg-gradient-animated">
        <div className="card">
          <h3 className="section-title mb-16">
            <span className="dot" />
            Machine Registry ({machines.length})
          </h3>

          {loading ? (
            <LoadingSpinner message="Fetching machines..." />
          ) : machines.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏭</div>
              <div className="empty-state-text">No machines configured in database yet.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Machine Code</th>
                    <th>Machine Name</th>
                    <th>Type</th>
                    <th>Manufacturer</th>
                    <th>Model Number</th>
                    <th>Status</th>
                    <th>Plant Location</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => (
                    <tr key={m.id}>
                      <td className="font-mono font-bold">
                        <Link to={`/machines/${m.id}`} className="text-blue" style={{ textDecoration: 'none' }}>
                          {m.machine_code}
                        </Link>
                      </td>
                      <td>{m.name}</td>
                      <td>{m.machine_type || '—'}</td>
                      <td>{m.manufacturer || '—'}</td>
                      <td>{m.model_number || '—'}</td>
                      <td>
                        <span className={`badge badge-${m.status?.toLowerCase() === 'active' ? 'ok' : 'pending'}`}>
                          {m.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>{m.plant_name ?? (m.plant ? `Plant #${m.plant}` : '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
