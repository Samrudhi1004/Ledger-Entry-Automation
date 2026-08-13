import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { getSessionDetail, reviewSession } from '../api/inspections';
import { formatDate, formatDateTime, fmt } from '../utils/formatters';
import OfficialFormF02Modal from '../components/reports/OfficialFormF02Modal';

const isValOOC = (val, lower, upper) => {
  if (val === undefined || val === null || val === '') return false;
  const num = Number(val);
  if (isNaN(num)) return false;
  if (lower !== undefined && lower !== null && num < Number(lower)) return true;
  if (upper !== undefined && upper !== null && num > Number(upper)) return true;
  return false;
};

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchSession = async () => {
    try {
      const res = await getSessionDetail(sessionId);
      setSession(res.data);
    } catch (err) {
      setError('Failed to load session details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const handleReview = async (action) => {
    setReviewing(true);
    try {
      await reviewSession(sessionId, action);
      await fetchSession();
    } catch (err) {
      alert(err.response?.data?.error || 'Review action failed.');
    } finally {
      setReviewing(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('official-form-f02-report');
    if (!element) return;

    setDownloading(true);

    const opt = {
      margin:       [5, 5, 5, 5],
      filename:     `Form_F02_Process_10_Report_${session.part_number}_${sessionId.slice(0, 8)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    const savePDF = () => {
      if (window.html2pdf) {
        window.html2pdf().set(opt).from(element).save().then(() => {
          setDownloading(false);
        }).catch(() => setDownloading(false));
      } else {
        alert('PDF library is loading. Please try again in a moment.');
        setDownloading(false);
      }
    };

    if (window.html2pdf) {
      savePDF();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = savePDF;
      document.body.appendChild(script);
    }
  };

  if (loading) return <LoadingSpinner message="Loading inspection session details..." />;
  if (error || !session) {
    return (
      <>
        <Header title="Session Details" />
        <div className="page-content">
          <div className="card text-center" style={{ padding: 40 }}>
            <h3>Error Loading Details</h3>
            <p className="text-muted mt-8">{error || 'Session not found.'}</p>
            <Link to="/" className="btn btn-primary mt-20">Back to Dashboard</Link>
          </div>
        </div>
      </>
    );
  }

  const measurements = session.measurements || [];

  const paramMap = {};
  measurements.forEach((m) => {
    const code = m.parameter_code;
    const trialNo = m.trial_number || 1;
    const inspType = m.inspection_type || (trialNo > 3 ? 'hourly' : (session.inspection_type || 'first_piece'));

    if (!paramMap[code]) {
      paramMap[code] = {
        code: code,
        name: m.parameter_name,
        nominal: m.nominal,
        lower_limit: m.lower_limit,
        upper_limit: m.upper_limit,
        unit: m.unit,
        trials: {},
        hourly: {},
      };
    }

    if (inspType === 'hourly') {
      const slot = m.hourly_slot || (trialNo > 3 ? trialNo - 3 : trialNo) || 1;
      paramMap[code].hourly[slot] = m.measured_value;
    } else {
      paramMap[code].trials[trialNo] = m.measured_value;
    }
  });

  const groupedParams = Object.values(paramMap);

  return (
    <>
      <Header
        title={`Inspection Session: ${sessionId.slice(-8).toUpperCase()}`}
        subtitle={`Detailed measurements log for part inspection`}
      />

      <div className="page-content bg-gradient-animated">
        {/* Breadcrumb & Action Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="page-breadcrumb">
            <Link to="/">Dashboard</Link> / <span>Session {sessionId.slice(-8).toUpperCase()}</span>
          </div>

          <button
            id="print-official-report-btn"
            className="btn btn-primary"
            onClick={() => setShowReportModal(true)}
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <span>View & Download Official Form F02 Report</span>
          </button>
        </div>

        {/* Info Header Box */}
        <div className="card mb-20">
          <div className="info-row">
            <div className="info-item">
              <span className="info-label">Process No</span>
              <span className="info-value font-bold">10.</span>
            </div>
            <div className="info-item">
              <span className="info-label">Part Number</span>
              <span className="info-value font-bold">{session.part_number} (POLY V PULLEY)</span>
            </div>
            <div className="info-item">
              <span className="info-label">Machine Code</span>
              <span className="info-value font-mono">{session.machine_code}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Operator</span>
              <span className="info-value">{session.operator_name || `Operator #${session.operator_id}`}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Shift</span>
              <span className="info-value">Shift {session.shift || 'A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Overall Status</span>
              <span className="info-value"><Badge type={session.status} /></span>
            </div>
          </div>
        </div>

        {/* PDF & Verification Status Banner */}
        <div className="card mb-20 p-16" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-blue)' }}>First Piece Quality Report & Certification</h4>
          <p className="text-secondary text-sm mb-12">Inspectors finalize First Piece sessions independently. View or export official PDF report below.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowReportModal(true)}>
              View & Download Official First Piece PDF Report
            </button>
          </div>
        </div>

      </div>

      {/* Official Form F02 Printable Report Modal */}
      {showReportModal && (
        <OfficialFormF02Modal 
          session={session} 
          onClose={() => setShowReportModal(false)} 
        />
      )}
    </>
  );
}
