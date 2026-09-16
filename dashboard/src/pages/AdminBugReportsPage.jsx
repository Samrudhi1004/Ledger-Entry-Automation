import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';

export default function AdminBugReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      const res = await fetch('http://localhost:8000/api/support/bug-reports/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.results || data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Header title="Bug Reports" subtitle="User submitted issues" />
      <div className="page-content" style={{ padding: 24 }}>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="card">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: 12 }}>ID</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Screenshot</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 12 }}>#{report.id}</td>
                    <td>{report.user} ({report.user_email})</td>
                    <td>
                      <span className={`badge badge-${report.status === 'open' ? 'danger' : 'success'}`}>
                        {report.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300, whiteSpace: 'pre-wrap' }}>{report.message}</td>
                    <td>
                      {report.screenshot ? (
                        <a href={`http://localhost:8000${report.screenshot}`} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ padding: '4px 8px' }}>
                          View Image
                        </a>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </td>
                    <td>{new Date(report.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: 24, textAlign: 'center' }}>No bug reports found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
