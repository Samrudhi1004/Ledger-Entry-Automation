import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FileSpreadsheet, 
  Upload, 
  History, 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  X,
  ShieldAlert,
  Send,
  Check,
  FileCheck
} from 'lucide-react';
import { 
  getControlPlans, 
  createControlPlan, 
  uploadControlPlanVersion, 
  getControlPlanHistory, 
  deleteControlPlan, 
  getParts,
  submitControlPlanReview,
  reviewControlPlanAction,
  approveControlPlanAction
} from '../api/parts';
import { getUsers } from '../api/users';
import { useAuth } from '../context/AuthContext';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';

export default function ControlPlansPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSupervisorOrAbove = ['admin', 'supervisor', 'quality_engineer'].includes(user?.role);

  const [controlPlans, setControlPlans] = useState([]);
  const [parts, setParts] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload New Control Plan Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    part: '',
    control_plan_number: '',
    title: '',
    description: '',
    phase: 'production',
    revision_code: 'v1.0',
    change_type: 'initial',
    change_notes: 'Initial process control plan upload',
    file: null,
  });

  // Submit for Review Modal State
  const [isSubmitReviewModalOpen, setIsSubmitReviewModalOpen] = useState(false);
  const [activePlanForSubmit, setActivePlanForSubmit] = useState(null);
  const [submitReviewForm, setSubmitReviewForm] = useState({
    assigned_reviewer: '',
    assigned_approver: '',
    notes: '',
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Review Action Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activePlanForReview, setActivePlanForReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    action: 'recommend',
    comments: '',
  });
  const [isProcessingReview, setIsProcessingReview] = useState(false);

  // Approve Action Modal State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [activePlanForApprove, setActivePlanForApprove] = useState(null);
  const [approveForm, setApproveForm] = useState({
    action: 'approve',
    comments: '',
  });
  const [isProcessingApprove, setIsProcessingApprove] = useState(false);

  // Upload Revision (DCR) Modal State
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [activePlanForRevision, setActivePlanForRevision] = useState(null);
  const [revisionForm, setRevisionForm] = useState({
    revision_code: '',
    change_type: 'process_improvement',
    change_notes: '',
    assigned_reviewer: '',
    assigned_approver: '',
    file: null,
  });
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // History Drawer State
  const [activePlanForHistory, setActivePlanForHistory] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [cpRes, partsRes, usersRes] = await Promise.all([
        getControlPlans(),
        getParts(),
        getUsers()
      ]);
      const cpList = cpRes.data?.results ?? cpRes.data ?? [];
      const partsList = partsRes.data?.results ?? partsRes.data ?? [];
      const userList = usersRes.data?.results ?? usersRes.data ?? [];
      setControlPlans(Array.isArray(cpList) ? cpList : []);
      setParts(Array.isArray(partsList) ? partsList : []);
      setAssignableUsers(Array.isArray(userList) ? userList : []);
    } catch (err) {
      console.error('Failed to load control plans or master data:', err);
      setErrorMsg('Failed to load control plans. Please check network connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenHistory = async (cp) => {
    setActivePlanForHistory(cp);
    setLoadingHistory(true);
    try {
      const res = await getControlPlanHistory(cp.id);
      setHistoryList(res.data || []);
    } catch (err) {
      console.error('Failed to load control plan history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateControlPlan = async (e) => {
    e.preventDefault();
    if (!newPlanForm.control_plan_number || !newPlanForm.title || !newPlanForm.file) {
      alert('Please fill in Control Plan Number, Title, and select a File.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    if (newPlanForm.part) formData.append('part', newPlanForm.part);
    formData.append('control_plan_number', newPlanForm.control_plan_number);
    formData.append('title', newPlanForm.title);
    formData.append('description', newPlanForm.description);
    formData.append('phase', newPlanForm.phase || 'production');
    formData.append('current_revision', newPlanForm.revision_code || 'v1.0');
    formData.append('revision_code', newPlanForm.revision_code || 'v1.0');
    formData.append('change_type', newPlanForm.change_type || 'initial');
    formData.append('change_notes', newPlanForm.change_notes || 'Initial process control plan upload');
    formData.append('file', newPlanForm.file);

    try {
      await createControlPlan(formData);
      setSuccessMsg('Process Control Plan created successfully in Draft status.');
      setIsUploadModalOpen(false);
      setNewPlanForm({
        part: '',
        control_plan_number: '',
        title: '',
        description: '',
        phase: 'production',
        revision_code: 'v1.0',
        change_type: 'initial',
        change_notes: 'Initial process control plan upload',
        file: null,
      });
      fetchData();
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.response?.data?.error || err.response?.data?.control_plan_number?.[0] || 'Failed to upload control plan.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Submit for Review
  const handleOpenSubmitReviewModal = (cp) => {
    setActivePlanForSubmit(cp);
    setSubmitReviewForm({
      assigned_reviewer: cp.assigned_reviewer || '',
      assigned_approver: cp.assigned_approver || '',
      notes: '',
    });
    setIsSubmitReviewModalOpen(true);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!activePlanForSubmit) return;
    setIsSubmittingReview(true);
    try {
      const res = await submitControlPlanReview(activePlanForSubmit.id, {
        assigned_reviewer: submitReviewForm.assigned_reviewer || null,
        assigned_approver: submitReviewForm.assigned_approver || null,
        notes: submitReviewForm.notes,
      });
      setSuccessMsg(res.data?.message || 'Control Plan submitted for review successfully.');
      setIsSubmitReviewModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit control plan for review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // 2. Review Action (Recommend / Reject)
  const handleOpenReviewModal = (cp) => {
    setActivePlanForReview(cp);
    setReviewForm({
      action: 'recommend',
      comments: '',
    });
    setIsReviewModalOpen(true);
  };

  const handleReviewAction = async (e) => {
    e.preventDefault();
    if (!activePlanForReview) return;
    setIsProcessingReview(true);
    try {
      const res = await reviewControlPlanAction(activePlanForReview.id, {
        action: reviewForm.action,
        comments: reviewForm.comments,
      });
      setSuccessMsg(res.data?.message || 'Review action recorded successfully.');
      setIsReviewModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record review action.');
    } finally {
      setIsProcessingReview(false);
    }
  };

  // 3. Approve Action (Approve / Reject)
  const handleOpenApproveModal = (cp) => {
    setActivePlanForApprove(cp);
    setApproveForm({
      action: 'approve',
      comments: '',
    });
    setIsApproveModalOpen(true);
  };

  const handleApproveAction = async (e) => {
    e.preventDefault();
    if (!activePlanForApprove) return;
    setIsProcessingApprove(true);
    try {
      const res = await approveControlPlanAction(activePlanForApprove.id, {
        action: approveForm.action,
        comments: approveForm.comments,
      });
      setSuccessMsg(res.data?.message || 'Approval action recorded successfully.');
      setIsApproveModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record approval action.');
    } finally {
      setIsProcessingApprove(false);
    }
  };

  // 4. Upload Revision (DCR)
  const handleOpenRevisionModal = (cp) => {
    setActivePlanForRevision(cp);
    setRevisionForm({
      revision_code: '',
      change_type: 'process_improvement',
      change_notes: '',
      assigned_reviewer: cp.assigned_reviewer || '',
      assigned_approver: cp.assigned_approver || '',
      file: null,
    });
    setIsRevisionModalOpen(true);
  };

  const handleUploadRevision = async (e) => {
    e.preventDefault();
    const targetPlan = activePlanForRevision || activePlanForHistory;
    if (!targetPlan || !revisionForm.revision_code || !revisionForm.file) {
      alert('Please enter Version Code and select a file.');
      return;
    }

    setIsSubmittingRevision(true);
    const formData = new FormData();
    formData.append('revision_code', revisionForm.revision_code);
    formData.append('change_type', revisionForm.change_type || 'process_improvement');
    formData.append('change_notes', revisionForm.change_notes || 'Revision upload');
    if (revisionForm.assigned_reviewer) formData.append('assigned_reviewer', revisionForm.assigned_reviewer);
    if (revisionForm.assigned_approver) formData.append('assigned_approver', revisionForm.assigned_approver);
    formData.append('file', revisionForm.file);

    try {
      await uploadControlPlanVersion(targetPlan.id, formData);
      setSuccessMsg(`New version ${revisionForm.revision_code} uploaded successfully.`);
      setIsRevisionModalOpen(false);
      setRevisionForm({
        revision_code: '',
        change_type: 'process_improvement',
        change_notes: '',
        assigned_reviewer: '',
        assigned_approver: '',
        file: null,
      });
      if (activePlanForHistory) {
        handleOpenHistory(targetPlan);
      }
      fetchData();
    } catch (err) {
      console.error('Revision upload failed:', err);
      alert(err.response?.data?.error || 'Failed to upload new version.');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const handleDeleteControlPlan = async (cpId) => {
    if (!window.confirm('Are you sure you want to delete this Control Plan document?')) return;
    try {
      await deleteControlPlan(cpId);
      setSuccessMsg('Control Plan document deleted.');
      if (activePlanForHistory?.id === cpId) setActivePlanForHistory(null);
      fetchData();
    } catch (err) {
      alert('Failed to delete control plan.');
    }
  };

  const safeControlPlans = Array.isArray(controlPlans) ? controlPlans : [];
  const filteredControlPlans = safeControlPlans.filter((cp) => {
    const q = searchQuery.toLowerCase();
    return (
      cp.control_plan_number?.toLowerCase().includes(q) ||
      cp.title?.toLowerCase().includes(q) ||
      cp.part_number?.toLowerCase().includes(q) ||
      cp.current_revision?.toLowerCase().includes(q) ||
      cp.phase?.toLowerCase().includes(q) ||
      cp.status?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '14px', background: '#F1F5F9', color: '#475569', fontSize: '11.5px', fontWeight: '700', border: '1px solid #CBD5E1' }}>
            <Clock size={12} /> Draft
          </span>
        );
      case 'under_review':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '14px', background: '#FEF3C7', color: '#B45309', fontSize: '11.5px', fontWeight: '700', border: '1px solid #FCD34D' }}>
            <Clock size={12} /> Under Review
          </span>
        );
      case 'reviewed':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '14px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '11.5px', fontWeight: '700', border: '1px solid #BFDBFE' }}>
            <Check size={12} /> Reviewed
          </span>
        );
      case 'approved':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '14px', background: '#DCFCE7', color: '#15803D', fontSize: '11.5px', fontWeight: '700', border: '1px solid #86EFAC' }}>
            <CheckCircle2 size={12} /> Approved & Released
          </span>
        );
      case 'rejected':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '14px', background: '#FEE2E2', color: '#B91C1C', fontSize: '11.5px', fontWeight: '700', border: '1px solid #FCA5A5' }}>
            <AlertCircle size={12} /> Rejected
          </span>
        );
      default:
        return (
          <span style={{ padding: '4px 10px', borderRadius: '14px', background: '#F1F5F9', color: '#475569', fontSize: '11.5px', fontWeight: '700' }}>
            {status || 'Draft'}
          </span>
        );
    }
  };

  const getPhaseBadge = (phase) => {
    switch (phase) {
      case 'prototype':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#FEF3C7', color: '#92400E', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase' }}>
            Prototype
          </span>
        );
      case 'pre_launch':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#EFF6FF', color: '#1E40AF', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase' }}>
            Pre-Launch
          </span>
        );
      case 'production':
      default:
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#0F172A', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', border: '1px solid #E2E8F0' }}>
            Production
          </span>
        );
    }
  };

  if (!isSupervisorOrAbove) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <ShieldAlert size={56} color="#DC2626" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>Access Restricted</h2>
        <p style={{ color: '#64748B', margin: '12px 0 24px' }}>
          Process Control Plan repository and version history access is restricted to Supervisors and Administrators.
        </p>
        <NavLink to="/development" className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: '8px', background: '#0F172A', color: '#FFFFFF', textDecoration: 'none', fontWeight: '700' }}>
          Return to Development Module
        </NavLink>
      </div>
    );
  }

  return (
    <>
      <Header
        title="Control Plans"
        subtitle="Process control specifications, quality parameter plans, and sequential sign-off governance"
      />

      <div className="page-content" style={{ background: 'var(--bg-primary, #F8FAFC)', minHeight: '100vh', padding: '24px' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <Breadcrumbs items={[{ label: 'Development', to: '/development' }, { label: 'Control Plan Management' }]} />

          {/* Action Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <NavLink 
              to="/development" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: '#475569', 
                fontWeight: '600', 
                textDecoration: 'none',
                fontSize: '13.5px' 
              }}
            >
              <ArrowLeft size={16} /> Back to Development Module
            </NavLink>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '700',
                border: 'none',
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)'
              }}
            >
              <Plus size={16} /> Upload New Control Plan
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #F87171',
              color: '#991B1B',
              padding: '12px 18px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13.5px'
            }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              color: '#166534',
              padding: '12px 18px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13.5px'
            }}>
              {successMsg}
            </div>
          )}

          {/* Search Card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <Search size={18} color="#64748B" />
            <input
              type="text"
              placeholder="Search by Control Plan Number, Title, Part Number, Phase, or Status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '13.5px',
                color: '#0F172A',
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Table Container */}
          {loading ? (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#64748B' }}>
              <p>Loading Control Plans Repository...</p>
            </div>
          ) : filteredControlPlans.length === 0 ? (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '40px', textAlign: 'center' }}>
              <FileSpreadsheet size={40} color="#94A3B8" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>No Control Plans Found</h3>
              <p style={{ color: '#64748B', fontSize: '13px', margin: '8px 0 16px' }}>
                {searchQuery ? 'No control plan matches your search query.' : 'Upload your first process control plan to initiate version control.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  style={{
                    background: '#0F172A',
                    color: '#FFFFFF',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    border: 'none',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Upload Control Plan
                </button>
              )}
            </div>
          ) : (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Control Plan ID</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Title & Description</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Part Link</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Phase</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Version</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Governance Status</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>History Log</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Workflow Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredControlPlans.map((cp) => {
                    const latestFileUrl = cp.latest_version?.file_url;
                    const totalRevisions = cp.versions?.length || 0;
                    const isReviewer = user && (String(user.id) === String(cp.assigned_reviewer) || isAdmin);
                    const isApprover = user && (String(user.id) === String(cp.assigned_approver) || isAdmin);

                    return (
                      <tr key={cp.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        {/* Control Plan ID */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ background: '#F1F5F9', padding: '8px', borderRadius: '8px', color: '#0F172A' }}>
                              <FileSpreadsheet size={18} />
                            </div>
                            <div>
                              <strong style={{ fontSize: '13.5px', color: '#0F172A', display: 'block' }}>{cp.control_plan_number}</strong>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>By {cp.created_by_name || 'Admin'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Title & Description */}
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#0F172A', display: 'block' }}>{cp.title}</span>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>{cp.description || 'No notes provided'}</span>
                        </td>

                        {/* Part Link */}
                        <td style={{ padding: '14px 18px' }}>
                          {cp.part_number ? (
                            <span style={{ background: '#F1F5F9', color: '#0F172A', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', border: '1px solid #E2E8F0' }}>
                              {cp.part_number}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#94A3B8', fontStyle: 'italic' }}>General Plan</span>
                          )}
                        </td>

                        {/* Phase */}
                        <td style={{ padding: '14px 18px' }}>
                          {getPhaseBadge(cp.phase)}
                        </td>

                        {/* Version */}
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ background: '#F8FAFC', color: '#0F172A', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', border: '1px solid #CBD5E1' }}>
                            {cp.current_revision}
                          </span>
                        </td>

                        {/* Governance Status */}
                        <td style={{ padding: '14px 18px' }}>
                          <div>
                            {getStatusBadge(cp.status)}
                            {cp.status === 'under_review' && cp.assigned_reviewer_name && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                Reviewer: <strong>{cp.assigned_reviewer_name}</strong>
                              </div>
                            )}
                            {cp.status === 'reviewed' && cp.assigned_approver_name && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                Approver: <strong>{cp.assigned_approver_name}</strong>
                              </div>
                            )}
                            {cp.status === 'approved' && cp.approved_by_name && (
                              <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px' }}>
                                Approved by {cp.approved_by_name}
                              </div>
                            )}
                            {cp.status === 'rejected' && cp.rejection_reason && (
                              <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }} title={cp.rejection_reason}>
                                Reason: {cp.rejection_reason.length > 28 ? `${cp.rejection_reason.slice(0, 28)}...` : cp.rejection_reason}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Revisions Log */}
                        <td style={{ padding: '14px 18px' }}>
                          <button
                            onClick={() => handleOpenHistory(cp)}
                            style={{
                              background: '#F8FAFC',
                              color: '#334155',
                              border: '1px solid #E2E8F0',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <History size={14} />
                            <span>{totalRevisions} {totalRevisions === 1 ? 'Version' : 'Versions'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {/* Stage Action Buttons */}
                            {(cp.status === 'draft' || cp.status === 'rejected') && (
                              <button
                                onClick={() => handleOpenSubmitReviewModal(cp)}
                                style={{
                                  background: '#0F172A',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <Send size={13} /> Submit for Review
                              </button>
                            )}

                            {cp.status === 'under_review' && isReviewer && (
                              <button
                                onClick={() => handleOpenReviewModal(cp)}
                                style={{
                                  background: '#D97706',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <Check size={13} /> Review Plan
                              </button>
                            )}

                            {cp.status === 'reviewed' && isApprover && (
                              <button
                                onClick={() => handleOpenApproveModal(cp)}
                                style={{
                                  background: '#15803D',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <FileCheck size={13} /> Approve Plan
                              </button>
                            )}

                            {cp.status === 'approved' && (
                              <button
                                onClick={() => handleOpenRevisionModal(cp)}
                                style={{
                                  background: '#334155',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <Plus size={13} /> New Version (DCR)
                              </button>
                            )}

                            {/* Download Button */}
                            {latestFileUrl && (
                              <a
                                href={latestFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                style={{
                                  background: '#F1F5F9',
                                  color: '#0F172A',
                                  border: '1px solid #CBD5E1',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Download Active Plan Document"
                              >
                                <Download size={13} /> File
                              </a>
                            )}

                            {/* Delete (Draft only or Admin) */}
                            {(isAdmin || cp.status === 'draft') && (
                              <button
                                onClick={() => handleDeleteControlPlan(cp.id)}
                                style={{
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  border: '1px solid #FECACA',
                                  padding: '6px',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                                title="Delete Control Plan"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
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
      </div>

      {/* ── MODAL 1: Upload New Control Plan (Draft) ────────────────────── */}
      {isUploadModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '560px',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: '#0F172A',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ color: '#FFFFFF', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Upload Process Control Plan
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Register quality control specification document in Draft status
                </span>
              </div>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateControlPlan} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Control Plan Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CP-FLG-001"
                  required
                  value={newPlanForm.control_plan_number}
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, control_plan_number: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Control Plan Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flange Machining Line Quality Control Plan"
                  required
                  value={newPlanForm.title}
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, title: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Linked Part (Optional)
                  </label>
                  <select
                    value={newPlanForm.part}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, part: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="">General Control Plan</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.part_number} : {p.part_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Manufacturing Phase *
                  </label>
                  <select
                    value={newPlanForm.phase}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, phase: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="production">Production Phase</option>
                    <option value="pre_launch">Pre-Launch Phase</option>
                    <option value="prototype">Prototype Phase</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Initial Version Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. v1.0 or Rev 01"
                    value={newPlanForm.revision_code}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, revision_code: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Plan Document File (PDF/Excel) *
                  </label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, file: e.target.files[0] })}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Description & Scope Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Notes, sample plans, or special characteristics..."
                  value={newPlanForm.description}
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, description: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Uploading...' : 'Save Draft Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Submit for Review (Reviewer & Approver Popup) ────────── */}
      {isSubmitReviewModalOpen && activePlanForSubmit && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: '#0F172A',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ color: '#FFFFFF', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Submit Control Plan for Verification
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Designate Reviewer & Approver for {activePlanForSubmit.control_plan_number} ({activePlanForSubmit.current_revision})
                </span>
              </div>
              <button 
                onClick={() => setIsSubmitReviewModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Assigned Reviewer (Quality Inspector / Supervisor) *
                </label>
                <select
                  required
                  value={submitReviewForm.assigned_reviewer}
                  onChange={(e) => setSubmitReviewForm({ ...submitReviewForm, assigned_reviewer: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="">Select Quality Reviewer</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username} ({u.role_display || u.role})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  An automated email and in-app notification will be dispatched to this reviewer.
                </span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Assigned Approver (Quality Head / Admin) *
                </label>
                <select
                  required
                  value={submitReviewForm.assigned_approver}
                  onChange={(e) => setSubmitReviewForm({ ...submitReviewForm, assigned_approver: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="">Select Final Approver</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username} ({u.role_display || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Submission Remarks / Quality Rationale
                </label>
                <textarea
                  rows="3"
                  placeholder="State evaluation technique justification, sample frequency rationale, or special notes..."
                  value={submitReviewForm.notes}
                  onChange={(e) => setSubmitReviewForm({ ...submitReviewForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsSubmitReviewModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingReview ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingReview ? 'Submitting...' : 'Confirm Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Review Decision (Recommend / Reject) ───────────────── */}
      {isReviewModalOpen && activePlanForReview && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: '#0F172A',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ color: '#FFFFFF', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Review Control Plan : {activePlanForReview.control_plan_number}
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Verify sampling plans, measurement equipment, and control methods
                </span>
              </div>
              <button 
                onClick={() => setIsReviewModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReviewAction} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                  Review Decision *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: reviewForm.action === 'recommend' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                    background: reviewForm.action === 'recommend' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: reviewForm.action === 'recommend' ? '#1D4ED8' : '#334155'
                  }}>
                    <input
                      type="radio"
                      name="reviewAction"
                      value="recommend"
                      checked={reviewForm.action === 'recommend'}
                      onChange={() => setReviewForm({ ...reviewForm, action: 'recommend' })}
                    />
                    Recommend for Approval
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: reviewForm.action === 'reject' ? '2px solid #DC2626' : '1px solid #CBD5E1',
                    background: reviewForm.action === 'reject' ? '#FEF2F2' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: reviewForm.action === 'reject' ? '#B91C1C' : '#334155'
                  }}>
                    <input
                      type="radio"
                      name="reviewAction"
                      value="reject"
                      checked={reviewForm.action === 'reject'}
                      onChange={() => setReviewForm({ ...reviewForm, action: 'reject' })}
                    />
                    Return for Revision
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Review Remarks / Observations *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Record your verification findings on gauge capability, reaction plans, or sampling..."
                  value={reviewForm.comments}
                  onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingReview}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: reviewForm.action === 'recommend' ? '#2563EB' : '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isProcessingReview ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isProcessingReview ? 'Recording...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: Approve Decision (Authorize & Release / Reject) ─────── */}
      {isApproveModalOpen && activePlanForApprove && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: '#0F172A',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ color: '#FFFFFF', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Authorize Control Plan : {activePlanForApprove.control_plan_number}
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Authorize release to shop floor inspection operations
                </span>
              </div>
              <button 
                onClick={() => setIsApproveModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApproveAction} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                  Authorization Action *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: approveForm.action === 'approve' ? '2px solid #15803D' : '1px solid #CBD5E1',
                    background: approveForm.action === 'approve' ? '#DCFCE7' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: approveForm.action === 'approve' ? '#166534' : '#334155'
                  }}>
                    <input
                      type="radio"
                      name="approveAction"
                      value="approve"
                      checked={approveForm.action === 'approve'}
                      onChange={() => setApproveForm({ ...approveForm, action: 'approve' })}
                    />
                    Approve & Release
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: approveForm.action === 'reject' ? '2px solid #DC2626' : '1px solid #CBD5E1',
                    background: approveForm.action === 'reject' ? '#FEF2F2' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: approveForm.action === 'reject' ? '#B91C1C' : '#334155'
                  }}>
                    <input
                      type="radio"
                      name="approveAction"
                      value="reject"
                      checked={approveForm.action === 'reject'}
                      onChange={() => setApproveForm({ ...approveForm, action: 'reject' })}
                    />
                    Reject Document
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Approval Remarks
                </label>
                <textarea
                  rows="3"
                  placeholder="Formal authorization stamp remarks or rejection notes..."
                  value={approveForm.comments}
                  onChange={(e) => setApproveForm({ ...approveForm, comments: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingApprove}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: approveForm.action === 'approve' ? '#15803D' : '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isProcessingApprove ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isProcessingApprove ? 'Recording...' : 'Authorize & Sign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 5: Upload Revision (DCR Governance) ────────────────────── */}
      {isRevisionModalOpen && (activePlanForRevision || activePlanForHistory) && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '560px',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              background: '#0F172A',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ color: '#FFFFFF', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Upload New Control Plan Version (DCR)
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  {(activePlanForRevision || activePlanForHistory)?.control_plan_number} : Current { (activePlanForRevision || activePlanForHistory)?.current_revision }
                </span>
              </div>
              <button 
                onClick={() => setIsRevisionModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadRevision} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    New Version Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. v1.1 or v2.0"
                    value={revisionForm.revision_code}
                    onChange={(e) => setRevisionForm({ ...revisionForm, revision_code: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Change Category *
                  </label>
                  <select
                    value={revisionForm.change_type}
                    onChange={(e) => setRevisionForm({ ...revisionForm, change_type: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="process_improvement">Process Improvement / Optimization</option>
                    <option value="customer_change">Customer Engineering Change</option>
                    <option value="corrective_action">Corrective Action (CAPA)</option>
                    <option value="tooling_modification">Tooling / Fixture Modification</option>
                    <option value="engineering_change">Engineering Specification Change</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Version Reviewer
                  </label>
                  <select
                    value={revisionForm.assigned_reviewer}
                    onChange={(e) => setRevisionForm({ ...revisionForm, assigned_reviewer: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="">Retain Existing Reviewer</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username} ({u.role_display || u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Version Approver
                  </label>
                  <select
                    value={revisionForm.assigned_approver}
                    onChange={(e) => setRevisionForm({ ...revisionForm, assigned_approver: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="">Retain Existing Approver</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username} ({u.role_display || u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Control Plan File (PDF/Excel) *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setRevisionForm({ ...revisionForm, file: e.target.files[0] })}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Change Notes & Quality Justification *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detail exact parameter/process changes, sampling frequency modifications, or reason for revision..."
                  value={revisionForm.change_notes}
                  onChange={(e) => setRevisionForm({ ...revisionForm, change_notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsRevisionModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRevision}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingRevision ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingRevision ? 'Uploading...' : 'Submit Version (DCR)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DRAWER: Version History Log ─────────────────────────────────── */}
      {activePlanForHistory && (
        <div style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: '520px',
          background: '#FFFFFF',
          boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
          zIndex: 1060,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #E2E8F0'
        }}>
          {/* Drawer Header */}
          <div style={{
            background: '#0F172A',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ color: '#FFFFFF', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                Version History & Audit Log
              </h3>
              <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                {activePlanForHistory.control_plan_number} : {activePlanForHistory.title}
              </span>
            </div>
            <button 
              onClick={() => setActivePlanForHistory(null)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                Recorded Versions ({historyList.length})
              </span>
              <button
                onClick={() => handleOpenRevisionModal(activePlanForHistory)}
                style={{
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={13} /> Add Version
              </button>
            </div>

            {loadingHistory ? (
              <p style={{ color: '#64748B', fontSize: '13px' }}>Loading version entries...</p>
            ) : historyList.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: '13px', fontStyle: 'italic' }}>No version history logs found for this plan.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {historyList.map((ver, idx) => (
                  <div key={ver.id} style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    background: idx === 0 ? '#F8FAFC' : '#FFFFFF',
                    borderLeft: idx === 0 ? '4px solid #0F172A' : '1px solid #E2E8F0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: '#0F172A' }}>{ver.revision_code}</strong>
                        {idx === 0 && (
                          <span style={{ background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                            Latest
                          </span>
                        )}
                        {ver.change_type && (
                          <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '600' }}>
                            {ver.change_type.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {ver.file_url && (
                        <a
                          href={ver.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          style={{
                            background: '#0F172A',
                            color: '#FFFFFF',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Download size={12} /> Download
                        </a>
                      )}
                    </div>

                    <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', color: '#334155' }}>
                      {ver.change_notes || 'No change notes provided.'}
                    </p>

                    <div style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Uploaded by {ver.uploaded_by_name || 'Admin'}</span>
                      <span>{new Date(ver.uploaded_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
