import React, { useState, useEffect } from 'react';
import {
  FileText, CheckCircle, XCircle, Clock, AlertTriangle,
  Download, Send, Eye, RefreshCw, UserCheck, Shield, ChevronRight, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getDCRs, getDCRById, submitDCRReview, rejectDCRReview,
  approveDCR, rejectDCRApproval, getDCRPDFUrl
} from '../api/documentControl';
import Header from '../components/layout/Header';
import DCRSubmissionModal from '../components/document_control/DCRSubmissionModal';
import Breadcrumbs from '../components/layout/Breadcrumbs';

const STATUS_BADGES = {
  submitted:         { label: 'Submitted',         bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
  awaiting_review:   { label: 'Awaiting Review',   bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  reviewed:          { label: 'Reviewed',          bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  awaiting_approval: { label: 'Awaiting Approval', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
  approved:          { label: 'Approved',          bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  rejected:          { label: 'Rejected',          bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  implemented:       { label: 'Implemented',       bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

export default function DocumentControlDCRPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('action_required');
  const [dcrs, setDcrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDcr, setSelectedDcr] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showRaiseModal, setShowRaiseModal] = useState(false);

  // Review Form State
  const [reviewRemark, setReviewRemark] = useState('');
  const [implementationDate, setImplementationDate] = useState('');
  const [cftRemarks, setCftRemarks] = useState('');
  const [calibratorRemarks, setCalibratorRemarks] = useState('');

  // Approval Form State
  const [mrRemarks, setMrRemarks] = useState('');

  // Rejection State
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchDCRs = async () => {
    setLoading(true);
    try {
      const res = await getDCRs({ tab: activeTab });
      setDcrs(res.data?.results || res.data || []);
    } catch (e) {
      console.error('Failed to fetch DCRs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDCRs();
  }, [activeTab]);

  const openDCRModal = async (dcrSummary) => {
    setLoadingDetail(true);
    setSelectedDcr(null);
    setRejecting(false);
    setRejectionReason('');
    setActionError('');
    try {
      const res = await getDCRById(dcrSummary.id);
      setSelectedDcr(res.data);
      // Pre-fill review inputs if already present
      setReviewRemark(res.data.review_remark || '');
      setImplementationDate(res.data.implementation_date || '');
      setCftRemarks(res.data.cft_remarks || '');
      setCalibratorRemarks(res.data.calibrator_remarks || '');
      setMrRemarks(res.data.mr_remarks || '');
    } catch (e) {
      console.error('Failed to load DCR detail', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Reviewer Submits Approval
  const handleSubmitReview = async () => {
    if (!reviewRemark.trim()) {
      return setActionError('Please enter the Change Review Remark.');
    }
    setSubmittingAction(true);
    setActionError('');
    try {
      const res = await submitDCRReview(selectedDcr.id, {
        review_remark: reviewRemark,
        implementation_date: implementationDate || null,
        cft_remarks: cftRemarks,
        calibrator_remarks: calibratorRemarks,
      });
      setSelectedDcr(res.data);
      fetchDCRs();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to submit review.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Reviewer Rejection
  const handleRejectReview = async () => {
    if (!rejectionReason.trim()) {
      return setActionError('Please specify the reason for rejection.');
    }
    setSubmittingAction(true);
    setActionError('');
    try {
      const res = await rejectDCRReview(selectedDcr.id, {
        rejection_reason: rejectionReason,
      });
      setSelectedDcr(res.data);
      setRejecting(false);
      fetchDCRs();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to reject DCR.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Admin Approves DCR
  const handleApproveDCR = async () => {
    setSubmittingAction(true);
    setActionError('');
    try {
      const res = await approveDCR(selectedDcr.id, { mr_remarks: mrRemarks });
      setSelectedDcr(res.data);
      fetchDCRs();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to approve DCR.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Admin Rejects DCR
  const handleRejectApproval = async () => {
    if (!rejectionReason.trim()) {
      return setActionError('Please specify the reason for rejection.');
    }
    setSubmittingAction(true);
    setActionError('');
    try {
      const res = await rejectDCRApproval(selectedDcr.id, {
        rejection_reason: rejectionReason,
      });
      setSelectedDcr(res.data);
      setRejecting(false);
      fetchDCRs();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to reject DCR.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const isAssignedReviewer = selectedDcr && (
    selectedDcr.assigned_cft_reviewer === user?.id || user?.role === 'admin'
  );
  const isAssignedApprover = selectedDcr && (
    selectedDcr.assigned_approver === user?.id || user?.role === 'admin'
  );

  const canPerformReview = selectedDcr?.status === 'awaiting_review' && isAssignedReviewer;
  const canPerformApproval = selectedDcr?.status === 'awaiting_approval' && isAssignedApprover && user?.role === 'admin';

  return (
    <>
      <Header
        title="Document Change Requests (DCR)"
        subtitle="Form DKI/MR/F/05 — Multi-Stage Review, Authorize & Implement Quality Changes"
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Breadcrumbs items={[{ label: 'Document Control', to: '/document-control' }, { label: 'Change Requests (DCR)' }]} />
        {/* Action Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px' }}>
          <button
            onClick={fetchDCRs}
            style={{
              padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
              background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: '600', color: '#475569'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('action_required')}
          style={{
            padding: '8px 18px',
            borderRadius: '20px',
            border: activeTab === 'action_required' ? '1px solid #4f46e5' : '1px solid #e2e8f0',
            backgroundColor: activeTab === 'action_required' ? '#eef2ff' : '#ffffff',
            color: activeTab === 'action_required' ? '#4338ca' : '#475569',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          ⚡ Action Required (My Queue)
        </button>

        <button
          onClick={() => setActiveTab('my_requests')}
          style={{
            padding: '8px 18px',
            borderRadius: '20px',
            border: activeTab === 'my_requests' ? '1px solid #4f46e5' : '1px solid #e2e8f0',
            backgroundColor: activeTab === 'my_requests' ? '#eef2ff' : '#ffffff',
            color: activeTab === 'my_requests' ? '#4338ca' : '#475569',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          📝 My Requests
        </button>

        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: activeTab === 'all' ? '1px solid #4f46e5' : '1px solid #e2e8f0',
              backgroundColor: activeTab === 'all' ? '#eef2ff' : '#ffffff',
              color: activeTab === 'all' ? '#4338ca' : '#475569',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            📋 All Plant DCRs
          </button>
        )}

        {['admin', 'supervisor', 'calibrator'].includes(user?.role) && (
          <button
            onClick={() => setShowRaiseModal(true)}
            style={{
              marginLeft: 'auto',
              padding: '8px 18px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
            }}
          >
            + Raise Change Request
          </button>
        )}
      </div>

      {/* DCR List Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Loading Change Requests...</p>
          </div>
        ) : dcrs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <FileText size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>No Change Requests in this view</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              {activeTab === 'action_required'
                ? 'You have no pending reviews or approvals at this moment.'
                : 'You have not submitted any DCRs yet.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['DCR Note', 'Target Document', 'Level', 'Raised By', 'CFT Reviewer', 'Approver', 'Status', 'Date', 'Action'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                    fontWeight: '700', color: '#64748b', letterSpacing: '0.5px',
                    textTransform: 'uppercase', whiteSpace: 'nowrap'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dcrs.map((dcr, i) => {
                const badge = STATUS_BADGES[dcr.status] || STATUS_BADGES.submitted;
                return (
                  <tr
                    key={dcr.id}
                    onClick={() => openDCRModal(dcr)}
                    style={{
                      borderBottom: i < dcrs.length - 1 ? '1px solid #f1f5f9' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                      {dcr.dcr_number}
                    </td>
                    <td style={{ padding: '14px 16px', maxWidth: '240px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>
                        {dcr.document_title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6366f1', marginTop: '2px' }}>
                        {dcr.document_number} ({dcr.document_revision})
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '10px',
                        backgroundColor: '#f1f5f9', color: '#475569'
                      }}>
                        {dcr.document_level || 'L2'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                      {dcr.raised_by_name}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                      {dcr.cft_reviewer_name || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                      {dcr.approver_name || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px',
                        backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {new Date(dcr.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openDCRModal(dcr)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Eye size={13} /> View Form
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Form DKI/MR/F/05 Interactive Modal */}
      {selectedDcr && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 1300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}>
            {/* Modal Header Bar */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase' }}>
                  Document Change Request Note • Form DKI/MR/F/05
                </span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{selectedDcr.dcr_number}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px',
                    backgroundColor: (STATUS_BADGES[selectedDcr.status] || STATUS_BADGES.submitted).bg,
                    color: (STATUS_BADGES[selectedDcr.status] || STATUS_BADGES.submitted).color,
                    border: `1px solid ${(STATUS_BADGES[selectedDcr.status] || STATUS_BADGES.submitted).border}`,
                  }}>
                    {(STATUS_BADGES[selectedDcr.status] || STATUS_BADGES.submitted).label}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Download PDF Button */}
                <a
                  href={getDCRPDFUrl(selectedDcr.id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                  }}
                >
                  <Download size={14} /> Download PDF
                </a>

                <button
                  onClick={() => setSelectedDcr(null)}
                  style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#dc2626' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body: Standard Form Layout */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#ffffff' }}>

              {actionError && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#b91c1c',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}>
                  {actionError}
                </div>
              )}

              {/* Form DKI/MR/F/05 Card Header */}
              <div style={{
                border: '1.5px solid #0f172a',
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '20px',
              }}>
                {/* Header 3-box Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 180px',
                  backgroundColor: '#ffffff',
                  borderBottom: '1.5px solid #0f172a',
                  alignItems: 'center',
                }}>
                  {/* Left: Company Logo */}
                  <div style={{
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRight: '1.5px solid #0f172a',
                    minHeight: '60px',
                    backgroundColor: '#ffffff',
                  }}>
                    {selectedDcr.company_logo_url ? (
                      <img
                        src={selectedDcr.company_logo_url}
                        alt="Logo"
                        style={{ maxHeight: '48px', maxWidth: '100%', objectFit: 'contain' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>
                          [ {(selectedDcr.company_name || 'MM').substring(0, 2).toUpperCase()} ]
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748b' }}>QUALITY</div>
                      </div>
                    )}
                  </div>

                  {/* Center: Company Name */}
                  <div style={{ textAlign: 'center', padding: '10px 16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px' }}>
                      {(selectedDcr.company_name || 'MANTRI METALLICS PVT. LTD.').toUpperCase()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
                      Quality Management System
                    </div>
                  </div>

                  {/* Right: Doc / Issue / Rev Meta */}
                  <div style={{
                    borderLeft: '1.5px solid #0f172a',
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: '#0f172a',
                    lineHeight: '1.45',
                    backgroundColor: '#f8fafc',
                  }}>
                    <div><strong>Doc No:</strong> {selectedDcr.form_doc_no || 'DKI/MR/F/05'}</div>
                    <div><strong>Issue No/Date:</strong> {selectedDcr.issue_no_date || '01/01.04.2018'}</div>
                    <div><strong>Rev No/Date:</strong> {selectedDcr.rev_no_date || '01/01.04.2018'}</div>
                  </div>
                </div>

                {/* Banner: DOCUMENT CHANGE REQUEST NOTE */}
                <div style={{
                  borderBottom: '1.5px solid #0f172a',
                  backgroundColor: '#f1f5f9',
                  padding: '7px 12px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '800',
                  color: '#0f172a',
                  letterSpacing: '0.6px',
                }}>
                  DOCUMENT CHANGE REQUEST NOTE
                </div>

                {/* Row 1: Raised by & Date of receipt */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr',
                  padding: '10px 16px',
                  fontSize: '13px',
                  backgroundColor: '#ffffff',
                  borderBottom: '1.5px solid #0f172a'
                }}>
                  <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '12px' }}>
                    <strong>Raised by:</strong> {selectedDcr.raised_by_name}
                  </div>
                  <div style={{ paddingLeft: '12px' }}>
                    <strong>Date of receipt of change:</strong> {selectedDcr.date_of_receipt}
                  </div>
                </div>

                {/* Section 2: Description & Basis for Change */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                    1. DOCUMENT DESCRIPTION (Current specification/text):
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                    {selectedDcr.document_description}
                  </div>
                </div>

                <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                    2. BASIS FOR CHANGE (Technical justification):
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                    {selectedDcr.basis_for_change}
                  </div>
                </div>

                {/* Section 3: Review Section */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: canPerformReview ? '#f0fdf4' : '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                      3. CHANGE REVIEW REMARK (CFT & Calibrator):
                    </span>
                    {canPerformReview && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
                        Your Review Required
                      </span>
                    )}
                  </div>

                  {canPerformReview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        rows={2}
                        value={reviewRemark}
                        onChange={e => setReviewRemark(e.target.value)}
                        placeholder="Enter change review remarks..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>Change to be implemented from:</label>
                          <input
                            type="date"
                            value={implementationDate}
                            onChange={e => setImplementationDate(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>CFT Remarks:</label>
                          <input
                            value={cftRemarks}
                            onChange={e => setCftRemarks(e.target.value)}
                            placeholder="CFT member notes..."
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>Calibrator Remarks:</label>
                          <input
                            value={calibratorRemarks}
                            onChange={e => setCalibratorRemarks(e.target.value)}
                            placeholder="Calibration notes..."
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#334155' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '8px' }}>
                        {selectedDcr.review_remark || <span style={{ color: '#94a3b8' }}>Awaiting review submission...</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', color: '#475569' }}>
                        <div><strong>Implemented From:</strong> {selectedDcr.implementation_date || '—'}</div>
                        <div><strong>CFT Remarks:</strong> {selectedDcr.cft_remarks || '—'}</div>
                        <div><strong>Calibrator Remarks:</strong> {selectedDcr.calibrator_remarks || '—'}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 4: Sign-Off Matrix */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontSize: '12px' }}>
                  {/* CFT Column */}
                  <div style={{ padding: '12px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>CROSS FUNCTIONAL TEAM</div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>{selectedDcr.cft_reviewer_name || 'Assigned CFT'}</div>
                    <div style={{ marginTop: '8px', fontWeight: '700', color: selectedDcr.date_of_review ? '#15803d' : '#d97706' }}>
                      {selectedDcr.date_of_review ? `✅ Reviewed (${new Date(selectedDcr.date_of_review).toLocaleDateString()})` : '⏳ Pending Review'}
                    </div>
                  </div>

                  {/* Calibrator Column */}
                  <div style={{ padding: '12px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>CALIBRATOR</div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>{selectedDcr.calibrator_name || 'Calibrator'}</div>
                    <div style={{ marginTop: '8px', fontWeight: '700', color: selectedDcr.date_of_review ? '#15803d' : '#94a3b8' }}>
                      {selectedDcr.date_of_review ? '✅ Verified' : '—'}
                    </div>
                  </div>

                  {/* MR Column */}
                  <div style={{ padding: '12px', backgroundColor: canPerformApproval ? '#fffbeb' : '#ffffff' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>MANAGEMENT REPRESENTATIVE</div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>{selectedDcr.approver_name || 'Admin'}</div>
                    <div style={{ marginTop: '8px', fontWeight: '700', color: selectedDcr.status === 'approved' ? '#15803d' : (selectedDcr.status === 'rejected' ? '#dc2626' : '#d97706') }}>
                      {selectedDcr.status === 'approved' ? `✅ Approved (${new Date(selectedDcr.date_of_approval).toLocaleDateString()})` : (selectedDcr.status === 'rejected' ? '❌ Rejected' : '⏳ Pending')}
                    </div>
                  </div>
                </div>

                {/* Section 5: MR Remarks (if approving or completed) */}
                {(canPerformApproval || selectedDcr.mr_remarks) && (
                  <div style={{ padding: '14px 16px', backgroundColor: canPerformApproval ? '#fffbeb' : '#ffffff' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      Management Representative Remarks:
                    </label>
                    {canPerformApproval ? (
                      <textarea
                        rows={2}
                        value={mrRemarks}
                        onChange={e => setMrRemarks(e.target.value)}
                        placeholder="Add authorization remarks..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    ) : (
                      <div style={{ fontSize: '13px', color: '#334155' }}>{selectedDcr.mr_remarks}</div>
                    )}
                  </div>
                )}

                {/* Rejection Display Box */}
                {selectedDcr.status === 'rejected' && (
                  <div style={{ padding: '14px 16px', backgroundColor: '#fee2e2', borderTop: '1px solid #fca5a5' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#b91c1c', marginBottom: '2px' }}>
                      DCR REJECTED AT {selectedDcr.rejection_stage?.toUpperCase()} STAGE:
                    </div>
                    <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                      Reason: <strong>{selectedDcr.rejection_reason}</strong> (by {selectedDcr.rejected_by_name || 'Reviewer'})
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons for Reviewer / Approver */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                {rejecting ? (
                  <div style={{ width: '100%', backgroundColor: '#fee2e2', padding: '16px', borderRadius: '10px', border: '1px solid #fca5a5' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#b91c1c', marginBottom: '6px' }}>
                      Specify Rejection Reason (Requestor will receive immediate notification):
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Why is this change request rejected?..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setRejecting(false)}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={canPerformReview ? handleRejectReview : handleRejectApproval}
                        disabled={submittingAction}
                        style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}
                      >
                        {submittingAction ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Review Actions */}
                    {canPerformReview && (
                      <>
                        <button
                          onClick={() => setRejecting(true)}
                          style={{
                            padding: '9px 18px',
                            borderRadius: '8px',
                            border: '1px solid #fca5a5',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <XCircle size={15} /> Reject DCR
                        </button>
                        <button
                          onClick={handleSubmitReview}
                          disabled={submittingAction}
                          style={{
                            padding: '9px 22px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: submittingAction ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                          }}
                        >
                          <CheckCircle size={15} /> {submittingAction ? 'Submitting...' : 'Approve CFT Review & Forward'}
                        </button>
                      </>
                    )}

                    {/* Approver Actions */}
                    {canPerformApproval && (
                      <>
                        <button
                          onClick={() => setRejecting(true)}
                          style={{
                            padding: '9px 18px',
                            borderRadius: '8px',
                            border: '1px solid #fca5a5',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <XCircle size={15} /> Reject DCR
                        </button>
                        <button
                          onClick={handleApproveDCR}
                          disabled={submittingAction}
                          style={{
                            padding: '9px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#4f46e5',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: submittingAction ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
                          }}
                        >
                          <CheckCircle size={15} /> {submittingAction ? 'Authorizing...' : 'Authorize & Approve DCR Note'}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Raise Change Request Modal */}
      {showRaiseModal && (
        <DCRSubmissionModal
          onClose={() => setShowRaiseModal(false)}
          onSuccess={() => {
            setShowRaiseModal(false);
            fetchDCRs();
          }}
        />
      )}
      </div>
      </div>
    </>
  );
}
