import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { getSessionDetail } from '../api/inspections';
import { formatDateTime, fmt, fmtDeviation, formatDate } from '../utils/formatters';

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Per-parameter targeting state for 1ST PC #2
  const [flaggedParams, setFlaggedParams] = useState({});
  const [rejectRemark, setRejectRemark]   = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = async () => {
    try {
      const res = await getSessionDetail(sessionId);
      const sData = res.data;
      setSession(sData);

      // Pre-select out-of-spec parameters by default
      const initialFlags = {};
      (sData.measurements || sData.parameter_summary || []).forEach((m) => {
        if (m.status === 'out_of_spec') {
          initialFlags[m.parameter_code] = true;
        }
      });
      setFlaggedParams(initialFlags);
    } catch (err) {
      setError(err.response?.data?.error || 'Session details not found.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleParam = (pCode) => {
    setFlaggedParams((prev) => ({
      ...prev,
      [pCode]: !prev[pCode],
    }));
  };

  const handleSelectAllOOC = () => {
    const oocFlags = {};
    (session.measurements || session.parameter_summary || []).forEach((m) => {
      if (m.status === 'out_of_spec') {
        oocFlags[m.parameter_code] = true;
      }
    });
    setFlaggedParams(oocFlags);
  };

  const handleRejectSelected = async () => {
    const selectedCodes = Object.keys(flaggedParams).filter((k) => flaggedParams[k]);
    if (selectedCodes.length === 0) {
      alert('Please select at least one parameter to flag for 1ST PC #2 re-entry.');
      return;
    }
    if (!rejectRemark.trim()) {
      alert('Please enter a Supervisor Remark explaining why these parameter(s) are rejected.');
      return;
    }

    setActionLoading(true);
    try {
      await reviewSession(sessionId, 'reject', rejectRemark, selectedCodes);
      alert(`Successfully requested 1ST PC #2 retrial for parameter(s): ${selectedCodes.join(', ')}`);
      fetchDetail();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit targeted rejection.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [sessionId]);

  const handleDownloadPDF = () => {
    const element = document.querySelector('.official-report-sheet');
    if (!element || !session) return;

    setDownloading(true);

    const filename = `MMPL_Inspection_Report_${session.part_number}_${session.session_id.slice(0, 8)}.pdf`;

    const opt = {
      margin: [4, 4, 4, 4],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2.2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    const triggerSave = () => {
      if (window.html2pdf) {
        window.html2pdf().set(opt).from(element).save().then(() => {
          setDownloading(false);
        }).catch(() => {
          setDownloading(false);
          window.print();
        });
      } else {
        setDownloading(false);
        window.print();
      }
    };

    if (window.html2pdf) {
      triggerSave();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => triggerSave();
      script.onerror = () => {
        setDownloading(false);
        window.print();
      };
      document.body.appendChild(script);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Inspection Detail" />
        <div className="page-content bg-gradient-animated">
          <LoadingSpinner message="Fetching full inspection sheet..." />
        </div>
      </>
    );
  }

  if (error || !session) {
    return (
      <>
        <Header title="Inspection Detail" />
        <div className="page-content bg-gradient-animated">
          <div className="card text-center" style={{ padding: 40 }}>
            <div className="text-red mb-16" style={{ fontSize: '2rem' }}>⚠</div>
            <h3>Error Loading Details</h3>
            <p className="text-muted mt-8">{error || 'Session not found.'}</p>
            <Link to="/" className="btn btn-primary mt-20">Back to Dashboard</Link>
          </div>
        </div>
      </>
    );
  }

  const measurements = session.measurements || [];

  // Group all measurements by parameter_code to populate 1st Piece and Hourly columns
  const paramMap = {};
  measurements.forEach((m) => {
    const code = m.parameter_code;
    if (!paramMap[code]) {
      paramMap[code] = {
        code: code,
        name: m.parameter_name,
        nominal: m.nominal,
        lower_limit: m.lower_limit,
        upper_limit: m.upper_limit,
        unit: m.unit,
        readings: [],
        hasOOC: false,
      };
    }
    paramMap[code].readings.push(m.measured_value);
    if (m.status === 'out_of_spec') {
      paramMap[code].hasOOC = true;
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

          {session.status === 'approved' ? (
            <button
              id="print-official-report-btn"
              className="btn btn-primary"
              onClick={() => setShowReportModal(true)}
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <span>📥</span>
              <span>View & Download Report (Form F02)</span>
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#f59e0b',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span>🔒</span>
              <span>Report Download Available After Supervisor Approval ({session.status ? session.status.toUpperCase().replace('_', ' ') : 'PENDING'})</span>
            </div>
          )}
        </div>

        {/* Info Header Box */}
        <div className="card mb-20">
          <div className="info-row">
            <div className="info-item">
              <span className="info-label">Part Number</span>
              <span className="info-value font-bold">{session.part_number}</span>
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
              <span className="info-label">Shift / Type</span>
              <span className="info-value">Shift {session.shift} · {session.inspection_type}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Overall Status</span>
              <span className="info-value">
                <Badge type={session.status} />
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Started At</span>
              <span className="info-value">{formatDateTime(session.started_at)}</span>
            </div>
            {session.completed_at && (
              <div className="info-item">
                <span className="info-label">Completed At</span>
                <span className="info-value">{formatDateTime(session.completed_at)}</span>
              </div>
            )}
          </div>

          {session.supervisor_remark && (
            <div className="mt-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <span className="info-label">Supervisor Remarks</span>
              <p className="text-sm text-primary mt-4" style={{ fontStyle: 'italic' }}>
                "{session.supervisor_remark}"
              </p>
            </div>
          )}
        </div>

        {/* Measurements List Table & Targeted Rejection Control */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              <span className="dot" />
              Parameter Measurements ({measurements.length})
            </h3>
            {session.status === 'pending_review' && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleSelectAllOOC}
                style={{ color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}
              >
                ⚡ Select All Out-Of-Spec (OOC)
              </button>
            )}
          </div>

          {session.status === 'pending_review' && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--accent-red)' }}>
                🔍 Targeted Parameter Re-entry Request (1ST PC #2)
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Check individual parameter(s) below to request re-measurement. Passed parameters remain approved and carry forward automatically.
              </p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Supervisor Remark (e.g. 'HS-02 Hole size out of spec. Adjust tool #2 and re-measure.')"
                  value={rejectRemark}
                  onChange={(e) => setRejectRemark(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
                />
                <button
                  className="btn btn-danger"
                  onClick={handleRejectSelected}
                  disabled={actionLoading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {actionLoading ? '⏳ Sending Alert...' : '🚨 Request 1ST PC #2 for Checked Params'}
                </button>
              </div>
            </div>
          )}

          {measurements.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">No measurements recorded for this session yet.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    {session.status === 'pending_review' && <th style={{ width: 40, textAlign: 'center' }}>Flag #2</th>}
                    <th>Parameter</th>
                    <th>Nominal</th>
                    <th>Lower Limit</th>
                    <th>Upper Limit</th>
                    <th>Measured</th>
                    <th>Deviation</th>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Raw Transcript / Voice Note</th>
                    <th>Recorded At</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m, idx) => {
                    const isOOC = m.status === 'out_of_spec';
                    const isChecked = !!flaggedParams[m.parameter_code];

                    return (
                      <tr key={idx} className={isOOC ? 'row-ooc' : ''}>
                        {session.status === 'pending_review' && (
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleParam(m.parameter_code)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td>
                          <div><strong>{m.parameter_code}</strong></div>
                          <div className="text-xs text-muted">{m.parameter_name}</div>
                        </td>
                        <td className="mono-val">{fmt(m.nominal)}</td>
                        <td className="mono-val">{fmt(m.lower_limit)}</td>
                        <td className="mono-val">{fmt(m.upper_limit)}</td>
                        <td className="mono-val font-bold" style={{ color: isOOC ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                          {fmt(m.measured_value)}
                        </td>
                        <td className={isOOC ? 'deviation-ooc' : 'deviation-ok'}>
                          {fmtDeviation(m.measured_value, m.nominal)}
                        </td>
                        <td>
                          <Badge type={m.status} />
                        </td>
                        <td>
                          <Badge type={m.method} />
                        </td>
                        <td>
                          {m.voice_raw_text ? (
                            <div className="text-sm font-mono" style={{ opacity: 0.9 }}>
                              🎙 "{m.voice_raw_text}"
                            </div>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="text-xs text-muted">{formatDateTime(m.recorded_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Professional Quality Sheet Modal (Enforced 1-Page A4 Landscape Layout) */}
      {showReportModal && (
        <Modal
          size="xl"
          title="1ST PIECE CUM IN-PROCESS INSPECTION REPORT"
          onClose={() => setShowReportModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowReportModal(false)}>Close</button>
              <button
                className="btn btn-ghost"
                onClick={() => window.print()}
              >
                🖨️ Print
              </button>
              <button
                id="download-pdf-btn"
                className="btn btn-primary"
                onClick={handleDownloadPDF}
                disabled={downloading}
              >
                {downloading ? '⏳ Generating PDF...' : '📥 Download PDF Copy'}
              </button>
            </>
          }
        >
          <div
            className="official-report-sheet"
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: '10px 14px',
              fontFamily: "Arial, 'Helvetica Neue', sans-serif",
              fontSize: 10.5,
              lineHeight: 1.2,
              pageBreakInside: 'avoid',
              pageBreakAfter: 'avoid',
              breakAfter: 'avoid',
            }}
          >
            
            {/* Header Block */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', marginBottom: 6 }}>
              <tbody>
                <tr style={{ borderBottom: '1.5px solid #000000' }}>
                  <td style={{ width: '12%', padding: '6px 4px', borderRight: '1.5px solid #000000', textAlign: 'center', background: '#000000', color: '#ffffff' }}>
                    <div style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>MMPL</div>
                  </td>
                  <td style={{ width: '73%', padding: '4px 10px', borderRight: '1.5px solid #000000', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: '0.5px', color: '#000000' }}>MANTRI METALLICS PVT. LTD.</div>
                    <div style={{ fontSize: 11, fontWeight: 'bold', marginTop: 1, color: '#000000' }}>1ST PIECE CUM IN-PROCESS INSPECTION REPORT</div>
                  </td>
                  <td style={{ width: '15%', padding: '4px 6px', textAlign: 'right', fontSize: 8.5, color: '#000000' }}>
                    <div><strong>DOC REF:</strong> MMPL/PRD/F02</div>
                    <div><strong>REV:</strong> 02 (15.8.2013)</div>
                    <div style={{ marginTop: 1, fontWeight: 'bold' }}>PAGE 1 OF 1</div>
                  </td>
                </tr>

                {/* Metadata Row 1 */}
                <tr style={{ borderBottom: '1px solid #000000', background: '#ffffff' }}>
                  <td style={{ padding: '3px 6px', borderRight: '1px solid #000000' }}>
                    <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>Part Name:</span>{' '}
                    <strong style={{ fontSize: 10, color: '#000000' }}>{session.part_name || 'POLY V PULLEY'}</strong>
                  </td>
                  <td style={{ padding: '3px 6px', borderRight: '1px solid #000000' }}>
                    <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>Opr. Name:</span>{' '}
                    <strong style={{ fontSize: 10, color: '#000000' }}>{session.operator_name || `Operator #${session.operator_id}`}</strong>
                  </td>
                  <td style={{ padding: '3px 6px' }}>
                    <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>Machine Name:</span>{' '}
                    <strong style={{ fontSize: 10, color: '#000000' }}>{session.machine_name || 'CNC Turning Center'}</strong>
                  </td>
                </tr>

                {/* Metadata Row 2 */}
                <tr style={{ background: '#ffffff' }}>
                  <td style={{ padding: '3px 6px', borderRight: '1px solid #000000' }}>
                    <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>Part No.:</span>{' '}
                    <strong style={{ fontSize: 10, color: '#000000', fontFamily: 'Consolas, monospace' }}>{session.part_number}</strong>
                  </td>
                  <td style={{ padding: '3px 6px', borderRight: '1px solid #000000' }}>
                    <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>Date & Shift:</span>{' '}
                    <strong style={{ fontSize: 10, color: '#000000' }}>{formatDate(session.started_at)} &nbsp;|&nbsp; {session.shift ? `Shift ${session.shift}` : 'Shift A'}</strong>
                  </td>
                  <td style={{ padding: '3px 6px' }}>
                    <span style={{ fontSize: 8, color: '#555555', textTransform: 'uppercase' }}>Machine No.:</span>{' '}
                    <strong style={{ fontSize: 10, color: '#000000', fontFamily: 'Consolas, monospace' }}>{session.machine_code}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Compact 1-Page Inspection Grid Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', textAlign: 'center', fontSize: 9.5 }}>
              <thead>
                <tr style={{ background: '#e2e8f0', borderBottom: '1.5px solid #000000', color: '#000000' }}>
                  <th style={{ border: '1px solid #000000', padding: '4px 4px', width: '15%', textAlign: 'left', fontWeight: 'bold' }}>Parameter</th>
                  <th style={{ border: '1px solid #000000', padding: '4px 4px', width: '17%', fontWeight: 'bold' }}>Specification</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '6%', fontWeight: 'bold', background: '#cbd5e1' }}>1st Pc #1</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '6%', fontWeight: 'bold', background: '#cbd5e1' }}>1st Pc #2</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '6%', fontWeight: 'bold', background: '#cbd5e1' }}>1st Pc #3</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '5%', fontWeight: 'bold' }}>1/Hr</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '5%', fontWeight: 'bold' }}>2/Hr</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '5%', fontWeight: 'bold' }}>3/Hr</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '5%', fontWeight: 'bold' }}>4/Hr</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '5%', fontWeight: 'bold' }}>5/Hr</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '5%', fontWeight: 'bold' }}>6/Hr</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '5%', fontWeight: 'bold' }}>7/Hr</th>
                  <th style={{ border: '1px solid #000000', padding: '3px 1px', width: '5%', fontWeight: 'bold' }}>8/Hr</th>
                  <th style={{ border: '1px solid #000000', padding: '4px 2px', width: '7%', fontWeight: 'bold' }}>Remark</th>
                </tr>
              </thead>
              <tbody>
                {groupedParams.map((p, i) => {
                  const r = p.readings;
                  const isAltRow = i % 2 === 1;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #000000', background: isAltRow ? '#f8fafc' : '#ffffff' }}>
                      
                      {/* Parameter Name */}
                      <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'left' }}>
                        <div style={{ fontSize: 9.5, fontWeight: 'bold', color: '#000000', fontFamily: 'Consolas, monospace' }}>{p.code}</div>
                        <div style={{ fontSize: 8, color: '#444444' }}>{p.name}</div>
                      </td>

                      {/* Specification */}
                      <td style={{ border: '1px solid #000000', padding: '3px 4px', fontFamily: 'Consolas, monospace', fontSize: 9 }}>
                        <div style={{ fontWeight: 'bold', color: '#000000' }}>{p.nominal} {p.unit}</div>
                        <div style={{ color: '#555555', fontSize: 8 }}>[{p.lower_limit} to {p.upper_limit}]</div>
                      </td>

                      {/* 1st Piece Readings */}
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000', background: isAltRow ? '#e2e8f0' : '#f1f5f9' }}>
                        {r[0] !== undefined ? fmt(r[0]) : '—'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>
                        {r[1] !== undefined ? fmt(r[1]) : '—'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>
                        {r[2] !== undefined ? fmt(r[2]) : '—'}
                      </td>

                      {/* Hourly Readings (1/Hr .. 8/Hr) */}
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>{r[3] !== undefined ? fmt(r[3]) : '—'}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>{r[4] !== undefined ? fmt(r[4]) : '—'}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>{r[5] !== undefined ? fmt(r[5]) : '—'}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>{r[6] !== undefined ? fmt(r[6]) : '—'}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>{r[7] !== undefined ? fmt(r[7]) : '—'}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>{r[8] !== undefined ? fmt(r[8]) : '—'}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>{r[9] !== undefined ? fmt(r[9]) : '—'}</td>
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold', fontSize: 10, fontFamily: 'Consolas, monospace', color: '#000000' }}>{r[10] !== undefined ? fmt(r[10]) : '—'}</td>

                      {/* Remark Badge */}
                      <td style={{ border: '1px solid #000000', padding: '3px 1px', fontWeight: 'bold' }}>
                        {p.hasOOC ? (
                          <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 9 }}>OOC</span>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: 9 }}>OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Signature Footer */}
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center', borderTop: '1.5px solid #000000', paddingTop: 8 }}>
              <div>
                <div style={{ borderBottom: '1px dashed #000000', paddingBottom: 10, marginBottom: 3, fontStyle: 'italic', color: '#000000', fontSize: 9.5 }}>
                  {session.operator_name || 'Operator Sign'}
                </div>
                <strong style={{ fontSize: 9, letterSpacing: '0.5px' }}>OPERATOR SIGNATURE</strong>
              </div>
              <div>
                <div style={{ borderBottom: '1px dashed #000000', paddingBottom: 10, marginBottom: 3, fontStyle: 'italic', color: '#000000', fontSize: 9.5 }}>
                  Quality Inspector
                </div>
                <strong style={{ fontSize: 9, letterSpacing: '0.5px' }}>INSPECTOR SIGNATURE</strong>
              </div>
              <div>
                <div style={{ borderBottom: '1px dashed #000000', paddingBottom: 8, marginBottom: 3, fontStyle: 'italic', color: '#166534', fontWeight: 'bold', fontSize: 9.5 }}>
                  ✓ Approved on {formatDate(session.reviewed_at || session.completed_at || session.started_at)}
                </div>
                <strong style={{ fontSize: 9, letterSpacing: '0.5px' }}>SUPERVISOR SIGNATURE</strong>
              </div>
            </div>

            {/* Document Reference Footer */}
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 4, fontSize: 8, color: '#666666' }}>
              <div>Inspection Hub — Digital Ledger Automation System</div>
              <div style={{ fontWeight: 'bold', color: '#000000' }}>
                DOC. Ref. No. MMPL/PRD/F02 Rev. No. 02 Dt 15.8.2013
              </div>
            </div>

          </div>
        </Modal>
      )}
    </>
  );
}
