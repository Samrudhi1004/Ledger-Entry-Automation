import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Upload, Download, Eye, CheckCircle, XCircle,
  FileText, Filter, RefreshCw, Send, ChevronDown,
  Calendar, Clock, User, Tag, AlertTriangle, X, Paperclip, Edit3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { can } from '../utils/access';
import {
  getDocuments, uploadDocument,
  approveDocument, rejectDocument, submitForReview,
  getDocumentHistory, getDownloadUrl, getAssignableUsers,
  getDocumentRoles, getDocumentAccess, saveDocumentAccess,
} from '../api/documentControl';
import DocumentViewerModal from '../components/document_control/DocumentViewerModal';
import DCRSubmissionModal from '../components/document_control/DCRSubmissionModal';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';

// ── Level Badge & Tabs Config ────────────────────────────────────────────────
const LEVEL_CONFIG = {
  ALL: { label: 'All Levels', desc: 'Full Document Register' },
  L1:  { label: 'L1: Quality Manual', desc: 'Company Policies & Apex Manual', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  L2:  { label: 'L2: SOPs', desc: 'Standard Operating Procedures / QSP', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  L3:  { label: 'L3: Work Instructions', desc: 'Machine & Inspection Instructions', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  L4:  { label: 'L4: Forms & Records', desc: 'Templates, DCRs & Formats', bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
};

function LevelBadge({ level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.L2;
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: '11px',
      fontWeight: '700',
      padding: '2px 8px',
      borderRadius: '12px',
      whiteSpace: 'nowrap',
    }}>
      {level || 'L2'}
    </span>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:             { label: 'Draft',             bg: '#f1f5f9', color: '#475569' },
  under_review:      { label: 'Under Review',      bg: '#fef3c7', color: '#d97706' },
  awaiting_approval: { label: 'Awaiting Approval', bg: '#eff6ff', color: '#1d4ed8' },
  approved:          { label: 'Approved',          bg: '#d1fae5', color: '#059669' },
  rejected:          { label: 'Rejected',          bg: '#fee2e2', color: '#dc2626' },
  obsolete:          { label: 'Obsolete',          bg: '#f1f5f9', color: '#94a3b8' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, fontSize: '11px', fontWeight: '700',
      padding: '3px 9px', borderRadius: '20px', whiteSpace: 'nowrap', letterSpacing: '0.3px'
    }}>
      {cfg.label}
    </span>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({ onClose, onSuccess }) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    title: '',
    description: '',
    doc_level: 'L2',
    document_number: '',
    revision: '0',
    revision_date: today,
    effective_date: today,
    reviewed_by: '',
    approved_by: '',
    status: 'approved', // 'approved' = Active Master, 'under_review' = Send for Review
  });
  const [users, setUsers] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dropRef = useRef();

  // Only fetch users when the review workflow is selected
  useEffect(() => {
    if (form.status === 'under_review') {
      getAssignableUsers()
        .then(res => setUsers(res.data || []))
        .catch(err => console.error('Failed to fetch users', err));
    }
  }, [form.status]);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a file.');
    if (!form.title.trim()) return setError('Description / Procedure Title is required.');
    if (form.status === 'under_review' && !form.reviewed_by)
      return setError('Please select a Reviewer before sending for review.');

    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title.trim());
      if (form.description.trim()) fd.append('description', form.description.trim());
      fd.append('doc_level', form.doc_level);
      if (form.document_number.trim()) fd.append('document_number', form.document_number.trim());
      if (form.revision.trim()) fd.append('revision', form.revision.trim());
      if (form.revision_date) fd.append('revision_date', form.revision_date);
      if (form.effective_date) fd.append('effective_date', form.effective_date);
      fd.append('status', form.status);
      // Only send reviewer/approver when going through review workflow
      if (form.status === 'under_review') {
        if (form.reviewed_by) fd.append('reviewed_by', form.reviewed_by);
        if (form.approved_by) fd.append('approved_by', form.approved_by);
      }
      fd.append('allowed_role_slugs', JSON.stringify([])); // no role restriction — access managed per-user
      await uploadDocument(fd);
      onSuccess();
    } catch (err) {
      const response = err.response?.data;
      const details = response && typeof response === 'object'
        ? Object.entries(response)
          .flatMap(([field, messages]) => (Array.isArray(messages) ? messages : [messages])
            .map((message) => `${field}: ${message}`))
          .join(' ')
        : '';
      setError(details || response?.error || response?.detail || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isReview = form.status === 'under_review';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '580px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)', overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 26px 16px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Upload Controlled Document</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Index of Quality System Procedures & Records</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="#94a3b8" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 26px 24px', maxHeight: '82vh', overflowY: 'auto' }}>

          {/* ── Drag-and-drop zone ── */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('dc-file-input').click()}
            style={{
              border: `2px dashed ${file ? '#6366f1' : '#cbd5e1'}`,
              borderRadius: '12px', padding: '16px', textAlign: 'center',
              cursor: 'pointer', marginBottom: '16px',
              background: file ? 'rgba(99,102,241,0.04)' : '#f8fafc',
              transition: 'all 0.2s ease'
            }}
          >
            <input id="dc-file-input" type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
            {file ? (
              <div>
                <Paperclip size={20} color="#6366f1" style={{ marginBottom: '6px' }} />
                <p style={{ margin: 0, fontWeight: '600', color: '#6366f1', fontSize: '13px' }}>{file.name}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB · click to change
                </p>
              </div>
            ) : (
              <div>
                <Upload size={22} color="#94a3b8" style={{ marginBottom: '6px' }} />
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                  Drag & drop or click to select file
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                  PDF, Word, Excel, Images (Max 50 MB)
                </p>
              </div>
            )}
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626',
              borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '14px'
            }}>
              {error}
            </div>
          )}

          {/* ── Level & Doc No ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Level *
              </label>
              <select
                value={form.doc_level}
                onChange={(e) => setForm(p => ({ ...p, doc_level: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#fff' }}
              >
                <option value="L1">L1 : Quality Manual & Policy</option>
                <option value="L2">L2 : Standard Operating Procedure (SOP/QSP)</option>
                <option value="L3">L3 : Work Instruction (WI)</option>
                <option value="L4">L4 : Form / Format / Checklist</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Doc No. (e.g. QSP-04-01)
              </label>
              <input
                value={form.document_number}
                onChange={(e) => setForm(p => ({ ...p, document_number: e.target.value }))}
                placeholder="e.g. QSP-04-01 (or auto-generate)"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* ── Description / Procedure Title ── */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
              Description (Procedure Title) *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Product Safety, Business Planning, Plant Facility..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* ── Rev. No., Rev. Date & Effective Date ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Rev. No.
              </label>
              <input
                value={form.revision}
                onChange={(e) => setForm(p => ({ ...p, revision: e.target.value }))}
                placeholder="0"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Rev. Date
              </label>
              <input
                type="date"
                value={form.revision_date}
                onChange={(e) => setForm(p => ({ ...p, revision_date: e.target.value }))}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Effective from
              </label>
              <input
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm(p => ({ ...p, effective_date: e.target.value }))}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* ── Release Workflow Status ── */}
          <div style={{
            background: '#f8fafc', border: `1px solid ${isReview ? '#c7d2fe' : '#e2e8f0'}`,
            borderRadius: '12px', padding: '14px 16px', marginBottom: '14px',
            transition: 'border-color 0.2s ease'
          }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '10px' }}>
              Release Workflow Status
            </label>

            {/* Active Master radio */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
              padding: '10px 12px', borderRadius: '8px', marginBottom: '8px',
              background: !isReview ? '#eef2ff' : '#fff',
              border: `1px solid ${!isReview ? '#a5b4fc' : '#e2e8f0'}`,
              transition: 'all 0.15s ease'
            }}>
              <input
                type="radio"
                name="doc_status"
                value="approved"
                checked={!isReview}
                onChange={() => setForm(p => ({ ...p, status: 'approved', reviewed_by: '', approved_by: '' }))}
                style={{ accentColor: '#4f46e5', marginTop: '2px' }}
              />
              <div>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>Active Master</span>
                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>(Already approved procedure)</span>
                {!isReview && (
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#6366f1', fontWeight: 500 }}>
                    Document will be immediately registered and active in the Document Library.
                  </p>
                )}
              </div>
            </label>

            {/* Send for Review radio */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
              padding: '10px 12px', borderRadius: '8px',
              background: isReview ? '#fefce8' : '#fff',
              border: `1px solid ${isReview ? '#fde68a' : '#e2e8f0'}`,
              transition: 'all 0.15s ease'
            }}>
              <input
                type="radio"
                name="doc_status"
                value="under_review"
                checked={isReview}
                onChange={() => setForm(p => ({ ...p, status: 'under_review' }))}
                style={{ accentColor: '#4f46e5', marginTop: '2px' }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>Send for Review & Approval</span>
                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>(Triggers notifications)</span>
                {isReview && (
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#92400e', fontWeight: 500 }}>
                    Assigned Reviewer will be notified via email and in-app bell to review and recommend.
                  </p>
                )}
              </div>
            </label>

            {/* ── Conditional Reviewer / Approver panel ── */}
            {isReview && (
              <div style={{
                marginTop: '12px', padding: '12px 14px',
                background: '#fff', border: '1px solid #fde68a', borderRadius: '10px',
                animation: 'fadeIn 0.2s ease'
              }}>
                <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#92400e', fontWeight: 600 }}>
                  Select who will review and approve this document:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                      Reviewer * <span style={{ color: '#dc2626' }}>Required</span>
                    </label>
                    <select
                      value={form.reviewed_by}
                      onChange={(e) => setForm(p => ({ ...p, reviewed_by: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${!form.reviewed_by ? '#fca5a5' : '#e2e8f0'}`, fontSize: '13px', outline: 'none', background: '#fff' }}
                    >
                      <option value="">Select Reviewer</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {(u.first_name || u.last_name) ? `${u.first_name} ${u.last_name}`.trim() : u.username} {u.role ? `(${u.role})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                      Approver <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <select
                      value={form.approved_by}
                      onChange={(e) => setForm(p => ({ ...p, approved_by: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#fff' }}
                    >
                      <option value="">Select Approver (Optional)</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {(u.first_name || u.last_name) ? `${u.first_name} ${u.last_name}`.trim() : u.username} {u.role ? `(${u.role})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Scope / Notes (Optional) ── */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
              Scope / Notes (Optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Brief summary of document scope or applicability..."
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical'
              }}
            />
          </div>

          {/* ── Submit ── */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px', borderRadius: '8px', border: '1px solid #e2e8f0',
                background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#64748b'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '9px 20px', borderRadius: '8px', border: 'none',
                background: loading ? '#a5b4fc' : '#6366f1',
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '700', transition: 'background 0.15s ease'
              }}
            >
              {loading
                ? 'Uploading...'
                : isReview
                  ? 'Save & Send for Review'
                  : 'Save & Register Master'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ── Document Access Modal (Per-User Permission Matrix) ───────────────────────
const ROLE_COLORS = {
  admin:            { bg: '#fef3c7', color: '#92400e' },
  supervisor:       { bg: '#ede9fe', color: '#5b21b6' },
  inspector:        { bg: '#ecfdf5', color: '#065f46' },
  quality_engineer: { bg: '#eff6ff', color: '#1e40af' },
  calibrator:       { bg: '#fff7ed', color: '#9a3412' },
  operator:         { bg: '#f1f5f9', color: '#334155' },
};

const PERMS = [
  { key: 'can_preview',  label: 'Preview' },
  { key: 'can_download', label: 'Download' },
  { key: 'can_print',    label: 'Print' },
  { key: 'can_edit',     label: 'Edit (DCR)' },
  { key: 'can_delete',   label: 'Delete' },
];

function DocumentAccessModal({ doc, onClose, onSuccess }) {
  const [users, setUsers]     = useState([]);     // all org users from API
  const [perms, setPerms]     = useState({});     // { userId: { can_preview, ... } }
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    getDocumentAccess(doc.id)
      .then((res) => {
        const usersData = res.data?.users || [];
        setUsers(usersData);
        // Build initial perms map from API response
        const map = {};
        usersData.forEach((u) => {
          map[u.user_id] = {
            can_preview:  u.can_preview,
            can_download: u.can_download,
            can_print:    u.can_print,
            can_edit:     u.can_edit,
            can_delete:   u.can_delete,
          };
        });
        setPerms(map);
      })
      .catch(() => setError('Unable to load user list. Please try again.'))
      .finally(() => setLoading(false));
  }, [doc.id]);

  const toggle = (userId, permKey) => {
    setPerms((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [permKey]: !prev[userId]?.[permKey],
      },
    }));
  };

  const toggleRow = (userId) => {
    const current = perms[userId] || {};
    const allOn = PERMS.every((p) => current[p.key]);
    const next = {};
    PERMS.forEach((p) => { next[p.key] = !allOn; });
    setPerms((prev) => ({ ...prev, [userId]: next }));
  };

  const toggleColumn = (permKey) => {
    const allOn = users.every((u) => perms[u.user_id]?.[permKey]);
    setPerms((prev) => {
      const next = { ...prev };
      users.forEach((u) => {
        next[u.user_id] = { ...(next[u.user_id] || {}), [permKey]: !allOn };
      });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const permissions = users.map((u) => ({
        user_id:      u.user_id,
        can_preview:  perms[u.user_id]?.can_preview  || false,
        can_download: perms[u.user_id]?.can_download || false,
        can_print:    perms[u.user_id]?.can_print    || false,
        can_edit:     perms[u.user_id]?.can_edit     || false,
        can_delete:   perms[u.user_id]?.can_delete   || false,
      }));
      await saveDocumentAccess(doc.id, permissions);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to save access settings.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const hasAnyAccess = (userId) =>
    PERMS.some((p) => perms[userId]?.[p.key]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '860px', maxHeight: '90vh',
        background: '#fff', borderRadius: '20px',
        boxShadow: '0 30px 70px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                Document Access Control
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                {doc.document_number} : {doc.title}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, color: '#94a3b8', padding: '0 4px' }}
            >×</button>
          </div>

          {/* Info banner */}
          <div style={{
            marginTop: 12, padding: '10px 14px', background: '#f0f9ff',
            border: '1px solid #bae6fd', borderRadius: 8, fontSize: 12, color: '#0369a1'
          }}>
            <strong>How it works:</strong> Tick permission boxes for each user.
            Leaving all boxes unchecked hides the document from that user.
            The document uploader and all Admins always have full access.
          </div>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <input
            type="text"
            placeholder="Search by name, username, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
              fontSize: 13, outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{ margin: '12px 24px', padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12 }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading users...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No users found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '10px 24px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0', width: '35%' }}>Name</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0', width: '12%' }}>Role</th>
                  {PERMS.map((p) => (
                    <th
                      key={p.key}
                      title={`Click to toggle ${p.label} for all users`}
                      onClick={() => toggleColumn(p.key)}
                      style={{
                        padding: '10px 8px', textAlign: 'center', fontWeight: 700,
                        color: '#4338ca', borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer', userSelect: 'none', fontSize: 11,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {p.label}
                      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>click to toggle all</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => {
                  const anyAccess = hasAnyAccess(u.user_id);
                  const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.operator;
                  return (
                    <tr
                      key={u.user_id}
                      style={{
                        background: anyAccess ? '#f0fdf4' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                        transition: 'background 0.1s',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                    >
                      {/* Name + username */}
                      <td
                        style={{ padding: '10px 24px', cursor: 'pointer' }}
                        title="Click to toggle all permissions for this user"
                        onClick={() => toggleRow(u.user_id)}
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>@{u.username}</div>
                      </td>

                      {/* Role badge */}
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          ...roleStyle, padding: '2px 8px', borderRadius: 20,
                          fontSize: 10, fontWeight: 700, border: '1px solid transparent'
                        }}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Permission checkboxes */}
                      {PERMS.map((p) => (
                        <td key={p.key} style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={perms[u.user_id]?.[p.key] || false}
                            onChange={() => toggle(u.user_id, p.key)}
                            style={{ width: 16, height: 16, accentColor: '#4f46e5', cursor: 'pointer' }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {users.filter((u) => hasAnyAccess(u.user_id)).length} of {users.length} user(s) have access
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button" onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13
              }}
            >Cancel</button>
            <button
              type="button" onClick={handleSave} disabled={saving || loading}
              style={{
                padding: '9px 22px', borderRadius: 8, border: 'none',
                background: saving ? '#a5b4fc' : '#4f46e5',
                color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 13
              }}
            >
              {saving ? 'Saving...' : 'Save Access Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function DocumentControlDocumentsPage() {
  const { user } = useAuth();
  const { companyName, logoUrl } = useCompany();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const previewId = searchParams.get('preview');

  useEffect(() => {
    if (previewId && docs.length > 0) {
      const found = docs.find(d => String(d.id) === String(previewId));
      if (found) {
        setSelectedViewerDoc(found);
      }
    }
  }, [previewId, docs]);

  // Modals state
  const [showUpload, setShowUpload] = useState(false);
  const [accessDoc, setAccessDoc] = useState(null);
  const [selectedViewerDoc, setSelectedViewerDoc] = useState(null);
  const [selectedDCRDoc, setSelectedDCRDoc] = useState(null);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const canUpload = can(user, 'document.upload');
  const canManageDocumentAccess = (doc) => (
    String(doc.uploaded_by) === String(user?.id) ||
    user?.role === 'admin' ||
    user?.is_superuser
  );
  const canRaiseDCR = can(user, 'document.dcr.create');

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedLevel !== 'ALL') params.level = selectedLevel;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const res = await getDocuments(params);
      setDocs(res.data?.results || res.data || []);
    } catch (e) {
      console.error('Failed to load documents', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [selectedLevel, filters.status, filters.search]);

  const openHistory = async (doc, e) => {
    e.stopPropagation();
    setHistoryDoc(doc);
    setLoadingHistory(true);
    try {
      const res = await getDocumentHistory(doc.id);
      setHistoryLogs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDateDMY = (d) => {
    if (!d) return '-';
    try {
      const parts = String(d).split('T')[0].split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return d || '-';
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <>
      <Header
        title="Document Register"
        subtitle="Browse, inspect & manage controlled quality documents (L1 : L4) • Click any row to view"
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Breadcrumbs items={[{ label: 'Document Control', to: '/document-control' }, { label: 'Documents (L1 : L4)' }]} />
        {/* Action Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={fetchDocs}
            style={{
              padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
              background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: '600', color: '#475569'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              style={{
                padding: '9px 18px', borderRadius: '10px', border: 'none',
                background: '#4f46e5', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', fontWeight: '700',
                boxShadow: '0 4px 12px rgba(79,70,229,0.3)'
              }}
            >
              <Upload size={15} /> Upload Document
            </button>
          )}
        </div>

      {/* Level Hierarchy Tabs (L1, L2, L3, L4) */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '12px',
        overflowX: 'auto',
      }}>
        {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => {
          const active = selectedLevel === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedLevel(key)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: active ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                backgroundColor: active ? '#eef2ff' : '#ffffff',
                color: active ? '#4338ca' : '#475569',
                fontWeight: active ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{cfg.label}</span>
              {key !== 'ALL' && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: active ? '#c7d2fe' : '#f1f5f9',
                  color: active ? '#312e81' : '#64748b',
                  fontWeight: '700',
                }}>
                  {key}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: '#fff', borderRadius: '14px', padding: '14px 18px',
        border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            placeholder="Search code, title, or description..."
            value={filters.search}
            onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
            style={{
              width: '100%', paddingLeft: '36px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px',
              borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>


        <select
          value={filters.status}
          onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))}
          style={{
            padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
            fontSize: '13px', outline: 'none', background: '#fff', minWidth: '140px'
          }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Matrix Header Banner */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px 16px 0 0',
        padding: '16px 22px',
        borderBottom: '2px solid #cbd5e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Company Logo"
              style={{ maxHeight: '40px', maxWidth: '130px', objectFit: 'contain' }}
            />
          ) : (
            <div style={{
              width: '38px', height: '38px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: '800', fontSize: '14px', letterSpacing: '0.5px'
            }}>
              {(companyName || 'MM').substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{
              fontSize: '16px',
              fontWeight: '800',
              color: '#0f172a',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              {companyName ? companyName.toUpperCase() : 'QUALITY MANAGEMENT SYSTEM'}
            </div>
            <div style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#475569',
              letterSpacing: '0.3px',
              marginTop: '2px'
            }}>
              INDEX OF QUALITY SYSTEM PROCEDURES & APPLICABILITY MATRIX
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#4f46e5',
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            padding: '4px 10px',
            borderRadius: '20px'
          }}>
            IATF 16949 / ISO 9001
          </span>
          <span style={{
            fontSize: '12px',
            color: '#64748b',
            fontWeight: '600'
          }}>
            {docs.length} Procedure{docs.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Document Table */}
      <div style={{
        background: '#fff', borderRadius: '0 0 16px 16px', border: '1px solid #e2e8f0',
        borderTop: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflowX: 'auto'
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Loading documents...</p>
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <FileText size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#94a3b8' }}>
              No {selectedLevel !== 'ALL' ? selectedLevel : ''} documents found
            </p>
            {canUpload && (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#6366f1', cursor: 'pointer' }} onClick={() => setShowUpload(true)}>
                + Upload a new document
              </p>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '50px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Sr.</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '70px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Level</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', width: '140px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Doc No.</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '80px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Rev. No.</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '110px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Rev. Date</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '120px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Effective from</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '130px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Reviewed by</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '130px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Approved by</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '100px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Preview</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', width: '140px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedViewerDoc(doc)}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  {/* 1. Sr. */}
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>
                    {i + 1}
                  </td>

                  {/* 2. Level */}
                  <td style={{ padding: '13px 14px', textAlign: 'center' }}>
                    <LevelBadge level={doc.doc_level} />
                  </td>

                  {/* 3. Doc No. */}
                  <td style={{ padding: '13px 16px', textAlign: 'left' }}>
                    <span style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontWeight: '700',
                      color: '#0f172a',
                      fontSize: '13px',
                      background: '#f8fafc',
                      padding: '3px 7px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}>
                      {doc.document_number}
                    </span>
                  </td>

                  {/* 4. Description (Procedure Title) */}
                  <td style={{ padding: '13px 16px', textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px', lineHeight: 1.4 }}>
                      {doc.title}
                    </div>
                    {doc.description && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                        {doc.description}
                      </div>
                    )}
                    {doc.file_name && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                        📎 {doc.file_name} <span style={{ color: '#cbd5e1' }}>•</span> {formatSize(doc.file_size)}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#6366f1', marginTop: '4px', fontWeight: 600 }}>
                      {doc.allowed_roles?.length
                        ? `Visible to: ${doc.allowed_roles.map((role) => role.name).join(', ')}`
                        : 'Visible to all document users'}
                    </div>
                  </td>

                  {/* 5. Rev. No. */}
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: '13px', color: '#0f172a', fontWeight: '700' }}>
                    {doc.revision ?? '0'}
                  </td>

                  {/* 6. Rev. Date */}
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' }}>
                    {formatDateDMY(doc.revision_date)}
                  </td>

                  {/* 7. Effective from */}
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' }}>
                    {formatDateDMY(doc.effective_date)}
                  </td>

                  {/* 8. Reviewed by */}
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' }}>
                    {doc.reviewed_by_name ? (
                      <span style={{ fontWeight: '600', color: '#0f172a' }}>{doc.reviewed_by_name}</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>

                  {/* 9. Approved by */}
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' }}>
                    {doc.approved_by_name ? (
                      <span style={{ fontWeight: '600', color: '#0f172a' }}>{doc.approved_by_name}</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>

                  {/* 10. Preview */}
                  <td style={{ padding: '13px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    {doc.my_permissions?.can_preview && (
                      <button
                        title="Open Document in Viewer"
                        onClick={() => setSelectedViewerDoc(doc)}
                        style={{
                          background: '#e0e7ff', border: 'none', borderRadius: '7px',
                          padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
                          color: '#4338ca', fontSize: '12px', fontWeight: '600', transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#c7d2fe'}
                        onMouseLeave={e => e.currentTarget.style.background = '#e0e7ff'}
                      >
                        <Eye size={13} /> Preview
                      </button>
                    )}
                    {!doc.my_permissions?.can_preview && (
                      <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                        No Access
                      </span>
                    )}
                  </td>

                  {/* 11. Actions */}
                  <td style={{ padding: '13px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      <StatusBadge status={doc.status} />

                      {canRaiseDCR && (
                        <button
                          title="Raise Document Change Request (DCR)"
                          onClick={() => setSelectedDCRDoc(doc)}
                          style={{
                            background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '7px',
                            padding: '5px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            color: '#6d28d9', fontSize: '11px', fontWeight: '600'
                          }}
                        >
                          <Edit3 size={12} /> DCR
                        </button>
                      )}

                      {canManageDocumentAccess(doc) && (
                        <button
                          title="Edit document visibility"
                          onClick={() => setAccessDoc(doc)}
                          style={{
                            background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '7px',
                            padding: '5px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            color: '#0e7490', fontSize: '11px', fontWeight: '600'
                          }}
                        >
                          <User size={12} /> Access
                        </button>
                      )}

                      <button
                        title="Audit history"
                        onClick={(e) => openHistory(doc, e)}
                        style={{
                          background: '#f1f5f9', border: 'none', borderRadius: '7px',
                          padding: '5px 7px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: '#64748b'
                        }}
                      >
                        <Clock size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchDocs(); }}
          userRole={user?.role}
        />
      )}

      {accessDoc && (
        <DocumentAccessModal
          doc={accessDoc}
          onClose={() => setAccessDoc(null)}
          onSuccess={() => {
            setAccessDoc(null);
            fetchDocs();
          }}
        />
      )}

      {/* In-App Direct Document Viewer Modal */}
      {selectedViewerDoc && (
        <DocumentViewerModal
          doc={selectedViewerDoc}
          onClose={() => {
            setSelectedViewerDoc(null);
            if (previewId) {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete('preview');
              setSearchParams(newParams);
            }
          }}
          onUpdate={fetchDocs}
          canRequestDCR={canRaiseDCR}
          onRequestDCR={(docToChange) => setSelectedDCRDoc(docToChange)}
        />
      )}

      {/* DCR Submission Modal (Form DKI/MR/F/05) */}
      {selectedDCRDoc && (
        <DCRSubmissionModal
          doc={selectedDCRDoc}
          onClose={() => setSelectedDCRDoc(null)}
          onSuccess={() => {
            setSelectedDCRDoc(null);
            fetchDocs();
          }}
        />
      )}

      {/* History Audit Modal */}
      {historyDoc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '520px',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Audit Activity Log</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{historyDoc.document_number} : {historyDoc.title}</p>
              </div>
              <button onClick={() => setHistoryDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <X size={18} color="#94a3b8" />
              </button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Loading activity...</div>
              ) : historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No activity records found.</div>
              ) : (
                historyLogs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{log.action}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>By: {log.performed_by_name}</div>
                      {log.comment && <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px' }}>{log.comment}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      </div>
      </div>
    </>
  );
}
