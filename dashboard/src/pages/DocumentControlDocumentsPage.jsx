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
  getDocumentRoles, updateDocumentAccess,
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
function UploadModal({ onClose, onSuccess, userRole }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    doc_level: 'L2',
    document_number: '',
    revision: '0',
    revision_date: new Date().toISOString().split('T')[0],
    effective_date: new Date().toISOString().split('T')[0],
    reviewed_by: '',
    approved_by: '',
    status: 'approved', // 'approved' (Active Master) or 'under_review' (Send for Sign-off)
  });
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedRoleSlugs, setSelectedRoleSlugs] = useState(() => userRole ? [userRole] : []);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dropRef = useRef();

  useEffect(() => {
    getAssignableUsers()
      .then(res => setUsers(res.data || []))
      .catch(err => console.error("Failed to fetch users", err));
    getDocumentRoles()
      .then(res => setRoles(res.data || []))
      .catch(err => console.error("Failed to fetch document roles", err));
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a file.');
    if (!form.title.trim()) return setError('Description / Procedure Title is required.');
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
      if (form.reviewed_by) fd.append('reviewed_by', form.reviewed_by);
      if (form.approved_by) fd.append('approved_by', form.approved_by);
      fd.append('status', form.status);
      fd.append('allowed_role_slugs', JSON.stringify(selectedRoleSlugs));
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
          {/* Drag-and-drop zone */}
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
                  {(file.size / 1024 / 1024).toFixed(2)} MB : click to change
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

          {/* Level & Doc No Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Level *
              </label>
              <select
                value={form.doc_level}
                onChange={(e) => setForm(p => ({ ...p, doc_level: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#fff'
                }}
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
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Description / Procedure Title */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
              Description (Procedure Title) *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Product Safety, Business Planning, Plant Facility..."
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Rev. No., Rev. Date & Effective Date Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Rev. No.
              </label>
              <input
                value={form.revision}
                onChange={(e) => setForm(p => ({ ...p, revision: e.target.value }))}
                placeholder="0"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                }}
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
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                }}
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
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Reviewer & Approver Sign-off Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Reviewer (Reviewed by)
              </label>
              <select
                value={form.reviewed_by}
                onChange={(e) => setForm(p => ({ ...p, reviewed_by: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#fff'
                }}
              >
                <option value="">Select Reviewer (Optional)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {(u.first_name || u.last_name) ? `${u.first_name} ${u.last_name}`.trim() : u.username} {u.role ? `(${u.role})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Approver (Approved by)
              </label>
              <select
                value={form.approved_by}
                onChange={(e) => setForm(p => ({ ...p, approved_by: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#fff'
                }}
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

          {/* Role visibility allow-list */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
            padding: '12px 14px', marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                  Document Visibility by Role
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Select roles that may view this document. Leave all unchecked to allow every role with document access.
                </p>
              </div>
              {selectedRoleSlugs.length > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4338ca', whiteSpace: 'nowrap' }}>
                  {selectedRoleSlugs.length} selected
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '7px', marginTop: '10px' }}>
              {roles.map((role) => {
                const checked = selectedRoleSlugs.includes(role.slug);
                return (
                  <label key={role.slug} style={{
                    display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 9px',
                    border: `1px solid ${checked ? '#c7d2fe' : '#e2e8f0'}`,
                    borderRadius: '8px', background: checked ? '#eef2ff' : '#fff',
                    color: checked ? '#3730a3' : '#475569', cursor: 'pointer', fontSize: '12px', fontWeight: 600
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedRoleSlugs((current) => checked
                        ? current.filter((slug) => slug !== role.slug)
                        : [...current, role.slug])}
                      style={{ accentColor: '#4f46e5' }}
                    />
                    {role.name}
                  </label>
                );
              })}
              {roles.length === 0 && (
                <span style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#94a3b8' }}>
                  No roles are available yet. The document will be visible to all document users.
                </span>
              )}
            </div>
          </div>

          {/* Release Workflow Selection */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '14px'
          }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
              Release Workflow Status
            </label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
                <input
                  type="radio"
                  name="doc_status"
                  value="approved"
                  checked={form.status === 'approved'}
                  onChange={() => setForm(p => ({ ...p, status: 'approved' }))}
                  style={{ accentColor: '#4f46e5' }}
                />
                <span style={{ fontWeight: '600' }}>Active Master</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>(Already approved procedure)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}>
                <input
                  type="radio"
                  name="doc_status"
                  value="under_review"
                  checked={form.status === 'under_review'}
                  onChange={() => setForm(p => ({ ...p, status: 'under_review' }))}
                  style={{ accentColor: '#4f46e5' }}
                />
                <span style={{ fontWeight: '600' }}>Send for Review & Approval</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>(Triggers notifications)</span>
              </label>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              {form.status === 'approved'
                ? 'Document will be immediately registered and active in the Matrix Register.'
                : 'Assigned Reviewer will be notified via email and in-app bell to review and recommend.'}
            </p>
          </div>

          {/* Scope / Remarks (Optional) */}
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
                border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Submit button */}
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
                background: '#6366f1', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '700'
              }}
            >
              {loading ? 'Uploading...' : (form.status === 'approved' ? 'Save & Register Master' : 'Save & Send for Review')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Document Visibility Modal ────────────────────────────────────────────────
function DocumentAccessModal({ doc, onClose, onSuccess }) {
  const [roles, setRoles] = useState([]);
  const [selectedRoleSlugs, setSelectedRoleSlugs] = useState(
    (doc.allowed_roles || []).map((role) => role.slug)
  );
  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDocumentRoles()
      .then((res) => setRoles(res.data || []))
      .catch(() => setError('Unable to load the current role list.'))
      .finally(() => setLoadingRoles(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await updateDocumentAccess(doc.id, selectedRoleSlugs);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Unable to save document visibility.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '640px', maxHeight: '88vh', overflow: 'hidden',
        background: '#fff', borderRadius: '18px', boxShadow: '0 25px 60px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Document Visibility</h3>
            <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '12px' }}>
              {doc.document_number} : {doc.title}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Who can see this document?</div>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>
              Tick the roles that should have access. Leave every role unchecked to make it visible to all users who have Document Control access. New roles appear here automatically.
            </p>
          </div>

          {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12 }}>{error}</div>}

          {loadingRoles ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading roles...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
              {roles.map((role) => {
                const checked = selectedRoleSlugs.includes(role.slug);
                return (
                  <label key={role.slug} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px',
                    border: `1px solid ${checked ? '#a5b4fc' : '#e2e8f0'}`,
                    borderRadius: 9, background: checked ? '#eef2ff' : '#fff',
                    color: checked ? '#3730a3' : '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedRoleSlugs((current) => checked
                        ? current.filter((slug) => slug !== role.slug)
                        : [...current, role.slug])}
                      style={{ accentColor: '#4f46e5' }}
                    />
                    <span>{role.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={loading || loadingRoles} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {loading ? 'Saving...' : 'Save Visibility'}
          </button>
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
    String(doc.uploaded_by) === String(user?.id)
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
