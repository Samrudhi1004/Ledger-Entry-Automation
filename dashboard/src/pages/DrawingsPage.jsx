import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FileText, 
  Upload, 
  History, 
  Plus, 
  Search, 
  Download, 
  FileCode, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  X,
  ShieldAlert,
  Send,
  Check,
  RotateCcw,
  Layers,
  FileCheck
} from 'lucide-react';
import { 
  getDrawings, 
  createDrawing, 
  uploadDrawingVersion, 
  getDrawingHistory, 
  deleteDrawing, 
  getParts,
  submitDrawingReview,
  reviewDrawingAction,
  approveDrawingAction
} from '../api/parts';
import { getUsers } from '../api/users';
import { useAuth } from '../context/AuthContext';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';

export default function DrawingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSupervisorOrAbove = ['admin', 'supervisor', 'quality_engineer'].includes(user?.role);

  const [drawings, setDrawings] = useState([]);
  const [parts, setParts] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload New Drawing Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newDrawingForm, setNewDrawingForm] = useState({
    part: '',
    drawing_number: '',
    title: '',
    description: '',
    doc_type: 'internal',
    revision_code: 'Rev A',
    change_type: 'initial',
    change_notes: 'Initial drawing upload',
    file: null,
  });

  // Submit for Review Modal State
  const [isSubmitReviewModalOpen, setIsSubmitReviewModalOpen] = useState(false);
  const [activeDrawingForSubmit, setActiveDrawingForSubmit] = useState(null);
  const [submitReviewForm, setSubmitReviewForm] = useState({
    assigned_reviewer: '',
    assigned_approver: '',
    notes: '',
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Review Action Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeDrawingForReview, setActiveDrawingForReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    action: 'recommend',
    comments: '',
  });
  const [isProcessingReview, setIsProcessingReview] = useState(false);

  // Approve Action Modal State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [activeDrawingForApprove, setActiveDrawingForApprove] = useState(null);
  const [approveForm, setApproveForm] = useState({
    action: 'approve',
    comments: '',
  });
  const [isProcessingApprove, setIsProcessingApprove] = useState(false);

  // Upload Revision (DCR) Modal State
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [activeDrawingForRevision, setActiveDrawingForRevision] = useState(null);
  const [revisionForm, setRevisionForm] = useState({
    revision_code: '',
    change_type: 'engineering_change',
    change_notes: '',
    assigned_reviewer: '',
    assigned_approver: '',
    file: null,
  });
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // History Drawer State
  const [activeDrawingForHistory, setActiveDrawingForHistory] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [dwgRes, partsRes, usersRes] = await Promise.all([
        getDrawings(),
        getParts(),
        getUsers()
      ]);
      const dwgList = dwgRes.data?.results ?? dwgRes.data ?? [];
      const partsList = partsRes.data?.results ?? partsRes.data ?? [];
      const userList = usersRes.data?.results ?? usersRes.data ?? [];
      setDrawings(Array.isArray(dwgList) ? dwgList : []);
      setParts(Array.isArray(partsList) ? partsList : []);
      setAssignableUsers(Array.isArray(userList) ? userList : []);
    } catch (err) {
      console.error('Failed to load drawings or master data:', err);
      setErrorMsg('Failed to load drawing documents. Please check network connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenHistory = async (drawing) => {
    setActiveDrawingForHistory(drawing);
    setLoadingHistory(true);
    try {
      const res = await getDrawingHistory(drawing.id);
      setHistoryList(res.data || []);
    } catch (err) {
      console.error('Failed to load drawing history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateDrawing = async (e) => {
    e.preventDefault();
    if (!newDrawingForm.drawing_number || !newDrawingForm.title || !newDrawingForm.file) {
      alert('Please fill in Drawing Number, Title, and select a File.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    if (newDrawingForm.part) formData.append('part', newDrawingForm.part);
    formData.append('drawing_number', newDrawingForm.drawing_number);
    formData.append('title', newDrawingForm.title);
    formData.append('description', newDrawingForm.description);
    formData.append('doc_type', newDrawingForm.doc_type || 'internal');
    formData.append('current_revision', newDrawingForm.revision_code || 'Rev A');
    formData.append('revision_code', newDrawingForm.revision_code || 'Rev A');
    formData.append('change_type', newDrawingForm.change_type || 'initial');
    formData.append('change_notes', newDrawingForm.change_notes || 'Initial drawing upload');
    formData.append('file', newDrawingForm.file);

    try {
      await createDrawing(formData);
      setSuccessMsg('Drawing uploaded successfully in Draft status.');
      setIsUploadModalOpen(false);
      setNewDrawingForm({
        part: '',
        drawing_number: '',
        title: '',
        description: '',
        doc_type: 'internal',
        revision_code: 'Rev A',
        change_type: 'initial',
        change_notes: 'Initial drawing upload',
        file: null,
      });
      fetchData();
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.response?.data?.error || err.response?.data?.drawing_number?.[0] || 'Failed to upload drawing.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Submit for Review
  const handleOpenSubmitReviewModal = (drawing) => {
    setActiveDrawingForSubmit(drawing);
    setSubmitReviewForm({
      assigned_reviewer: drawing.assigned_reviewer || '',
      assigned_approver: drawing.assigned_approver || '',
      notes: '',
    });
    setIsSubmitReviewModalOpen(true);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!activeDrawingForSubmit) return;
    setIsSubmittingReview(true);
    try {
      const res = await submitDrawingReview(activeDrawingForSubmit.id, {
        assigned_reviewer: submitReviewForm.assigned_reviewer || null,
        assigned_approver: submitReviewForm.assigned_approver || null,
        notes: submitReviewForm.notes,
      });
      setSuccessMsg(res.data?.message || 'Drawing submitted for review successfully.');
      setIsSubmitReviewModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit drawing for review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // 2. Review Action (Recommend / Reject)
  const handleOpenReviewModal = (drawing) => {
    setActiveDrawingForReview(drawing);
    setReviewForm({
      action: 'recommend',
      comments: '',
    });
    setIsReviewModalOpen(true);
  };

  const handleReviewAction = async (e) => {
    e.preventDefault();
    if (!activeDrawingForReview) return;
    setIsProcessingReview(true);
    try {
      const res = await reviewDrawingAction(activeDrawingForReview.id, {
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
  const handleOpenApproveModal = (drawing) => {
    setActiveDrawingForApprove(drawing);
    setApproveForm({
      action: 'approve',
      comments: '',
    });
    setIsApproveModalOpen(true);
  };

  const handleApproveAction = async (e) => {
    e.preventDefault();
    if (!activeDrawingForApprove) return;
    setIsProcessingApprove(true);
    try {
      const res = await approveDrawingAction(activeDrawingForApprove.id, {
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
  const handleOpenRevisionModal = (drawing) => {
    setActiveDrawingForRevision(drawing);
    setRevisionForm({
      revision_code: '',
      change_type: 'engineering_change',
      change_notes: '',
      assigned_reviewer: drawing.assigned_reviewer || '',
      assigned_approver: drawing.assigned_approver || '',
      file: null,
    });
    setIsRevisionModalOpen(true);
  };

  const handleUploadRevision = async (e) => {
    e.preventDefault();
    const targetDrawing = activeDrawingForRevision || activeDrawingForHistory;
    if (!targetDrawing || !revisionForm.revision_code || !revisionForm.file) {
      alert('Please enter Revision Code and select a file.');
      return;
    }

    setIsSubmittingRevision(true);
    const formData = new FormData();
    formData.append('revision_code', revisionForm.revision_code);
    formData.append('change_type', revisionForm.change_type || 'engineering_change');
    formData.append('change_notes', revisionForm.change_notes || 'Revision upload');
    if (revisionForm.assigned_reviewer) formData.append('assigned_reviewer', revisionForm.assigned_reviewer);
    if (revisionForm.assigned_approver) formData.append('assigned_approver', revisionForm.assigned_approver);
    formData.append('file', revisionForm.file);

    try {
      await uploadDrawingVersion(targetDrawing.id, formData);
      setSuccessMsg(`New revision ${revisionForm.revision_code} uploaded successfully.`);
      setIsRevisionModalOpen(false);
      setRevisionForm({
        revision_code: '',
        change_type: 'engineering_change',
        change_notes: '',
        assigned_reviewer: '',
        assigned_approver: '',
        file: null,
      });
      if (activeDrawingForHistory) {
        handleOpenHistory(targetDrawing);
      }
      fetchData();
    } catch (err) {
      console.error('Revision upload failed:', err);
      alert(err.response?.data?.error || 'Failed to upload new revision.');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const handleDeleteDrawing = async (drawingId) => {
    if (!window.confirm('Are you sure you want to delete this drawing document?')) return;
    try {
      await deleteDrawing(drawingId);
      setSuccessMsg('Drawing deleted successfully.');
      if (activeDrawingForHistory?.id === drawingId) setActiveDrawingForHistory(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete drawing.');
    }
  };

  const safeDrawings = Array.isArray(drawings) ? drawings : [];
  const filteredDrawings = safeDrawings.filter((dwg) => {
    const q = searchQuery.toLowerCase();
    return (
      dwg.drawing_number?.toLowerCase().includes(q) ||
      dwg.title?.toLowerCase().includes(q) ||
      dwg.part_number?.toLowerCase().includes(q) ||
      dwg.current_revision?.toLowerCase().includes(q) ||
      dwg.status?.toLowerCase().includes(q)
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

  if (!isSupervisorOrAbove) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <ShieldAlert size={56} color="#DC2626" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>Access Restricted</h2>
        <p style={{ color: '#64748B', margin: '12px 0 24px' }}>
          Engineering Drawing repository and revision history access is restricted to Supervisors and Administrators.
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
        title="Engineering Drawings"
        subtitle="Repository of engineering blueprints, revisions, and sequential review sign-offs"
      />

      <div className="page-content" style={{ background: 'var(--bg-primary, #F8FAFC)', minHeight: '100vh', padding: '24px' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <Breadcrumbs items={[{ label: 'Development', to: '/development' }, { label: 'Engineering Drawings' }]} />

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
              <Plus size={16} /> Upload New Drawing
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
              placeholder="Search by Drawing Number, Title, Part Number, Revision, or Status..."
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
              <p>Loading Engineering Drawings Repository...</p>
            </div>
          ) : filteredDrawings.length === 0 ? (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '40px', textAlign: 'center' }}>
              <FileCode size={40} color="#94A3B8" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>No Engineering Drawings Found</h3>
              <p style={{ color: '#64748B', fontSize: '13px', margin: '8px 0 16px' }}>
                {searchQuery ? 'No drawing matches your search query.' : 'Upload your first engineering drawing print to initiate revision control.'}
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
                  <Upload size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Upload Drawing
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
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Drawing ID</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Title & Scope</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Part Link</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Revision</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Governance Status</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>History Log</th>
                    <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Workflow Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrawings.map((dwg) => {
                    const latestFileUrl = dwg.latest_version?.file_url;
                    const totalRevisions = dwg.versions?.length || 0;
                    const isReviewer = user && (String(user.id) === String(dwg.assigned_reviewer) || isAdmin);
                    const isApprover = user && (String(user.id) === String(dwg.assigned_approver) || isAdmin);

                    return (
                      <tr key={dwg.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        {/* Drawing ID */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ background: '#F1F5F9', padding: '8px', borderRadius: '8px', color: '#0F172A' }}>
                              <FileCode size={18} />
                            </div>
                            <div>
                              <strong style={{ fontSize: '13.5px', color: '#0F172A', display: 'block' }}>{dwg.drawing_number}</strong>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>By {dwg.created_by_name || 'Admin'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Title & Scope */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#0F172A' }}>{dwg.title}</span>
                            <span style={{ fontSize: '10.5px', padding: '2px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>
                              {dwg.doc_type_display || dwg.doc_type || 'Internal'}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                            {dwg.description || 'No notes provided'}
                          </span>
                        </td>

                        {/* Part Link */}
                        <td style={{ padding: '14px 18px' }}>
                          {dwg.part_number ? (
                            <span style={{ background: '#F1F5F9', color: '#0F172A', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', border: '1px solid #E2E8F0' }}>
                              {dwg.part_number}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#94A3B8', fontStyle: 'italic' }}>General Print</span>
                          )}
                        </td>

                        {/* Active Revision */}
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ background: '#F8FAFC', color: '#0F172A', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', border: '1px solid #CBD5E1' }}>
                            {dwg.current_revision}
                          </span>
                        </td>

                        {/* Governance Status */}
                        <td style={{ padding: '14px 18px' }}>
                          <div>
                            {getStatusBadge(dwg.status)}
                            {dwg.status === 'under_review' && dwg.assigned_reviewer_name && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                Reviewer: <strong>{dwg.assigned_reviewer_name}</strong>
                              </div>
                            )}
                            {dwg.status === 'reviewed' && dwg.assigned_approver_name && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                Approver: <strong>{dwg.assigned_approver_name}</strong>
                              </div>
                            )}
                            {dwg.status === 'approved' && dwg.approved_by_name && (
                              <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px' }}>
                                Approved by {dwg.approved_by_name}
                              </div>
                            )}
                            {dwg.status === 'rejected' && dwg.rejection_reason && (
                              <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }} title={dwg.rejection_reason}>
                                Reason: {dwg.rejection_reason.length > 28 ? `${dwg.rejection_reason.slice(0, 28)}...` : dwg.rejection_reason}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Revisions Log */}
                        <td style={{ padding: '14px 18px' }}>
                          <button
                            onClick={() => handleOpenHistory(dwg)}
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
                            <span>{totalRevisions} {totalRevisions === 1 ? 'Rev' : 'Revs'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {/* Stage Action Buttons */}
                            {(dwg.status === 'draft' || dwg.status === 'rejected') && (
                              <button
                                onClick={() => handleOpenSubmitReviewModal(dwg)}
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

                            {dwg.status === 'under_review' && isReviewer && (
                              <button
                                onClick={() => handleOpenReviewModal(dwg)}
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
                                <Check size={13} /> Review Drawing
                              </button>
                            )}

                            {dwg.status === 'reviewed' && isApprover && (
                              <button
                                onClick={() => handleOpenApproveModal(dwg)}
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
                                <FileCheck size={13} /> Approve Drawing
                              </button>
                            )}

                            {dwg.status === 'approved' && (
                              <button
                                onClick={() => handleOpenRevisionModal(dwg)}
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
                                <Plus size={13} /> New Revision (DCR)
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
                                title="Download Active File"
                              >
                                <Download size={13} /> File
                              </a>
                            )}

                            {/* Delete (Draft only or Admin) */}
                            {(isAdmin || dwg.status === 'draft') && (
                              <button
                                onClick={() => handleDeleteDrawing(dwg.id)}
                                style={{
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  border: '1px solid #FECACA',
                                  padding: '6px',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                                title="Delete Drawing"
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

      {/* ── MODAL 1: Upload New Drawing (Draft) ─────────────────────────── */}
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
                  Upload Engineering Drawing
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Register drawing print with initial revision in Draft status
                </span>
              </div>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDrawing} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Drawing Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. DWG-FLG-001"
                  required
                  value={newDrawingForm.drawing_number}
                  onChange={(e) => setNewDrawingForm({ ...newDrawingForm, drawing_number: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Drawing Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flange Detailed Machining Print"
                  required
                  value={newDrawingForm.title}
                  onChange={(e) => setNewDrawingForm({ ...newDrawingForm, title: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Linked Part (Optional)
                  </label>
                  <select
                    value={newDrawingForm.part}
                    onChange={(e) => setNewDrawingForm({ ...newDrawingForm, part: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="">General Print (No specific part)</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.part_number} : {p.part_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Drawing Type
                  </label>
                  <select
                    value={newDrawingForm.doc_type}
                    onChange={(e) => setNewDrawingForm({ ...newDrawingForm, doc_type: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="internal">Internal Manufacturing Drawing</option>
                    <option value="customer">Customer Drawing</option>
                    <option value="tooling">Tooling & Fixture Drawing</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Initial Revision Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rev A or Rev 01"
                    value={newDrawingForm.revision_code}
                    onChange={(e) => setNewDrawingForm({ ...newDrawingForm, revision_code: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Drawing File (PDF/CAD) *
                  </label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setNewDrawingForm({ ...newDrawingForm, file: e.target.files[0] })}
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
                  placeholder="Notes, critical datum details, or specifications..."
                  value={newDrawingForm.description}
                  onChange={(e) => setNewDrawingForm({ ...newDrawingForm, description: e.target.value })}
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
                  {submitting ? 'Uploading...' : 'Save Draft Drawing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Submit for Review (Reviewer & Approver Popup) ────────── */}
      {isSubmitReviewModalOpen && activeDrawingForSubmit && (
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
                  Submit Drawing for Verification
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Designate Reviewer & Approver for {activeDrawingForSubmit.drawing_number} ({activeDrawingForSubmit.current_revision})
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
                  Submission Remarks / Engineering Rationale
                </label>
                <textarea
                  rows="3"
                  placeholder="State technical basis, critical datum requirements, or reason for submission..."
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
      {isReviewModalOpen && activeDrawingForReview && (
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
                  Review Drawing : {activeDrawingForReview.drawing_number}
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Verify technical tolerances, datum points, and suitability
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
                  Review Remarks / Justification *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Record your verification observations or required revisions..."
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
      {isApproveModalOpen && activeDrawingForApprove && (
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
                  Authorize Drawing : {activeDrawingForApprove.drawing_number}
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Authorize release to shop floor or reject specification
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
                  placeholder="Formal sign-off comments, authorization stamp remarks, or rejection notes..."
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
      {isRevisionModalOpen && (activeDrawingForRevision || activeDrawingForHistory) && (
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
                  Upload New Drawing Revision (DCR)
                </h3>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                  {(activeDrawingForRevision || activeDrawingForHistory)?.drawing_number} : Current { (activeDrawingForRevision || activeDrawingForHistory)?.current_revision }
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
                    New Revision Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rev B or Rev 02"
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
                    <option value="engineering_change">Engineering Change (ECR)</option>
                    <option value="customer_change">Customer Revision</option>
                    <option value="process_improvement">Process Optimization</option>
                    <option value="corrective_action">Corrective Action (CAPA)</option>
                    <option value="tooling_modification">Tooling / Jig Modification</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Revision Reviewer
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
                    Revision Approver
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
                  Drawing File (PDF/CAD) *
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
                  Change Notes & Technical Basis *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detail exact changes made, affected dimensions/tolerances, or reason for revision..."
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
                  {isSubmittingRevision ? 'Uploading...' : 'Submit Revision (DCR)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DRAWER: Revision History Log ─────────────────────────────────── */}
      {activeDrawingForHistory && (
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
                Revision History & Audit Log
              </h3>
              <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                {activeDrawingForHistory.drawing_number} : {activeDrawingForHistory.title}
              </span>
            </div>
            <button 
              onClick={() => setActiveDrawingForHistory(null)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                Recorded Revisions ({historyList.length})
              </span>
              <button
                onClick={() => handleOpenRevisionModal(activeDrawingForHistory)}
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
                <Plus size={13} /> Add Revision
              </button>
            </div>

            {loadingHistory ? (
              <p style={{ color: '#64748B', fontSize: '13px' }}>Loading revision entries...</p>
            ) : historyList.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: '13px', fontStyle: 'italic' }}>No revision logs found for this drawing.</p>
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
