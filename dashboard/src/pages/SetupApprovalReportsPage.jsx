import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OfficialFormF02Modal from '../components/reports/OfficialFormF02Modal';
import { getSessions, getSessionDetail, openInspectionPDF, downloadInspectionPDF } from '../api/inspections';
import { formatDate } from '../utils/formatters';
import { ShieldCheck, FileText, Download, Eye, Filter, RefreshCw, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';

export default function SetupApprovalReportsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('All');
  const [selectedMachine, setSelectedMachine] = useState('All');
  const [selectedPart, setSelectedPart] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Selected session for Form F02 Modal
  const [activeModalSession, setActiveModalSession] = useState(null);
  const [loadingSessionDetail, setLoadingSessionDetail] = useState(false);

  const fetchSetupSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        inspection_type: 'first_piece',
      };
      if (selectedShift !== 'All') params.shift = selectedShift;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedMachine !== 'All') params.machine = selectedMachine;

      const res = await getSessions(params);
      const loaded = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
      setSessions(loaded);
    } catch (err) {
      console.error('Failed to load setup approval sessions:', err);
      setError('Failed to load setup approval reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedShift, selectedStatus, selectedMachine]);

  useEffect(() => {
    fetchSetupSessions();
  }, [fetchSetupSessions]);

  // Handle open Form F02 Modal with full session details
  const handleOpenFormF02 = async (sessionSummary) => {
    setLoadingSessionDetail(true);
    try {
      const fullDoc = await getSessionDetail(sessionSummary.session_id);
      setActiveModalSession(fullDoc.data || sessionSummary);
    } catch (err) {
      console.warn('Could not fetch full MongoDB detail, falling back to summary:', err);
      setActiveModalSession(sessionSummary);
    } finally {
      setLoadingSessionDetail(false);
    }
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) => {
    if (startDate) {
      const dateVal = (s.started_at || s.created_at || '').slice(0, 10);
      if (dateVal < startDate) return false;
    }
    if (endDate) {
      const dateVal = (s.started_at || s.created_at || '').slice(0, 10);
      if (dateVal > endDate) return false;
    }
    if (selectedPart !== 'All' && s.part_number !== selectedPart) return false;
    return true;
  });

  // Extract unique machines and parts for filter dropdowns
  const uniqueMachines = Array.from(new Set(sessions.map((s) => s.machine_code).filter(Boolean)));
  const uniqueParts = Array.from(new Set(sessions.map((s) => s.part_number).filter(Boolean)));

  // Calculate Metrics
  const totalApprovals = filteredSessions.length;
  const approvedCount = filteredSessions.filter((s) => s.status === 'approved' || s.status === 'finalized_passed' || s.is_setup_approved).length;
  const passRate = totalApprovals > 0 ? Math.round((approvedCount / totalApprovals) * 100) : 100;
  const totalProcessParams = filteredSessions.reduce((acc, s) => acc + (s.process_parameter_summary?.length || 0), 0);

  return (
    <>
      <Header
        title="Set Up Approval Reports"
        subtitle="Historical archive of official Form F02 Setup Approvals featuring Section 1 Product & Section 2 Process parameters"
      />

      <div className="page-content bg-gradient-animated" style={{ padding: '24px', background: '#F1F5F9', minHeight: '100vh' }}>
        


        {/* FILTER BAR */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '18px 24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Filter size={16} color="#0284C7" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter Setup Reports</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>From Date</label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>To Date</label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Shift</label>
              <select
                className="form-select"
                style={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
              >
                <option value="All">All Shifts</option>
                <option value="A">Shift A</option>
                <option value="B">Shift B</option>
                <option value="C">Shift C</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Machine</label>
              <select
                className="form-select"
                style={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
              >
                <option value="All">All Machines</option>
                {uniqueMachines.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Part Number</label>
              <select
                className="form-select"
                style={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
                value={selectedPart}
                onChange={(e) => setSelectedPart(e.target.value)}
              >
                <option value="All">All Parts</option>
                {uniqueParts.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Status</label>
              <select
                className="form-select"
                style={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="finalized_passed">Finalized Passed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* SETUP APPROVAL REPORTS TABLE */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          
          <div style={{ padding: '16px 24px', background: '#FAFBFC', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color="#4F46E5" />
              <span>Official Setup Approval Records (Form F02 Archive)</span>
              <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                {filteredSessions.length} Reports
              </span>
            </div>

            <button
              onClick={fetchSetupSessions}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#EFF6FF', border: '1px solid #BAE6FD', color: '#0284C7', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '60px 20px' }}>
              <LoadingSpinner message="Loading Setup Approval Reports..." />
            </div>
          ) : error ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#DC2626' }}>{error}</div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <ShieldCheck size={40} color="#94A3B8" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 4 }}>No Setup Approval Reports Found</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>Try adjusting your filters or complete a First Piece inspection on the mobile app.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>Date & Shift</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>Machine</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>Part Number & Name</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>Inspector / Operator</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>Trial</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#475569' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((s, idx) => {
                    const isPassed = s.status === 'approved' || s.status === 'finalized_passed' || s.is_setup_approved;
                    const prodCount = s.parameter_summary?.length || 0;
                    const procCount = s.process_parameter_summary?.length || 0;

                    return (
                      <tr key={s.session_id} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                        
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                          <div>{formatDate(s.started_at || s.created_at)}</div>
                          <span style={{ fontSize: 10, background: '#F1F5F9', padding: '1px 6px', borderRadius: 4, color: '#64748B', fontWeight: 700 }}>
                            Shift {s.shift || 'A'}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                          {s.machine_code || 'CNC-01'}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 800, color: '#0F172A' }}>{s.part_number}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{s.part_name || 'Part'}</div>
                        </td>

                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                          {s.operator_name || `Inspector #${s.operator_id || ''}`}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: '#EFF6FF', border: '1px solid #BAE6FD', color: '#0284C7', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                            1ST PC #{s.trial_number || 1}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenFormF02(s)}
                              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                              title="View Form F02 Report"
                            >
                              <Eye size={14} />
                              <span>View Form F02</span>
                            </button>

                            <button
                              onClick={() => downloadInspectionPDF(s.session_id, `Setup_Approval_Report_${s.session_id.slice(0, 8)}.pdf`)}
                              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#059669', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                              title="Download PDF Copy"
                            >
                              <Download size={14} />
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* OFFICIAL FORM F02 MODAL */}
        {activeModalSession && (
          <OfficialFormF02Modal
            session={{ ...activeModalSession, is_setup_approval_only: true }}
            onClose={() => setActiveModalSession(null)}
          />
        )}
      </div>
    </>
  );
}
