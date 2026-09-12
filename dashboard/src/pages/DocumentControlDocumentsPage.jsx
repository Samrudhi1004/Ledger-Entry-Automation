import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Upload, Download, Eye, CheckCircle, XCircle,
  FileText, Filter, RefreshCw, Send, ChevronDown,
  Calendar, Clock, User, Tag, AlertTriangle, X, Paperclip, Edit3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getDocuments, uploadDocument,
  approveDocument, rejectDocument, submitForReview,
  getDocumentHistory, getDownloadUrl,
} from '../api/documentControl';
import DocumentViewerModal from '../components/document_control/DocumentViewerModal';
import DCRSubmissionModal from '../components/document_control/DCRSubmissionModal';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';

// ── Level Badge & Tabs Config ────────────────────────────────────────────────
const LEVEL_CONFIG = {
  ALL: { label: 'All Levels', desc: 'Full Document Register' },
  L1:  { label: 'L1: Quality Manual', desc: 'Company Policies & Apex Manual', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  L2:  { label: 'L2: SOPs', desc: 'Standard Operating Procedures', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
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
  draft:        { label: 'Draft',        bg: '#f1f5f9', color: '#475569' },
  under_review: { label: 'Under Review', bg: '#fef3c7', color: '#d97706' },
  approved:     { label: 'Approved',     bg: '#d1fae5', color: '#059669' },
  rejected:     { label: 'Rejected',     bg: '#fee2e2', color: '#dc2626' },
  obsolete:     { label: 'Obsolete',     bg: '#f1f5f9', color: '#94a3b8' },
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
  const [form, setForm] = useState({
    title: '', description: '', doc_level: 'L2', effective_date: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dropRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a file.');
    if (!form.title) return setError('Title is required.');
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('description', form.description);
      fd.append('doc_level', form.doc_level);
      if (form.effective_date) fd.append('effective_date', form.effective_date);
      await uploadDocument(fd);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
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
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '560px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)', overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '22px 28px 18px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Upload Document</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Classify by Quality Level (L1–L4) and upload file</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="#94a3b8" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px 28px' }}>
          {/* Drag-and-drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('dc-file-input').click()}
            style={{
              border: `2px dashed ${file ? '#6366f1' : '#cbd5e1'}`,
              borderRadius: '12px', padding: '20px', textAlign: 'center',
              cursor: 'pointer', marginBottom: '18px',
              background: file ? 'rgba(99,102,241,0.04)' : '#f8fafc',
              transition: 'all 0.2s ease'
            }}
          >
            <input id="dc-file-input" type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
            {file ? (
              <div>
                <Paperclip size={22} color="#6366f1" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontWeight: '600', color: '#6366f1', fontSize: '14px' }}>{file.name}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB — click to change
                </p>
              </div>
            ) : (
              <div>
                <Upload size={24} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '600' }}>
                  Drag & drop or click to select
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  PDF, Images, Word, Excel (Max 50 MB)
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

          <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                Document Level (Hierarchy) *
              </label>
              <select
                value={form.doc_level}
                onChange={(e) => setForm(p => ({ ...p, doc_level: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', background: '#fff'
                }}
              >
                <option value="L1">L1 — Quality Manual & Policy</option>
                <option value="L2">L2 — Standard Operating Procedure (SOP)</option>
                <option value="L3">L3 — Work Instruction (WI)</option>
                <option value="L4">L4 — Form / Format / Checklist</option>
              </select>
          </div>

          {/* Title */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
              Title *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. CNC Spindle Maintenance SOP"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
              Description / Scope
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Brief summary of document scope..."
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Effective Date */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
              Effective Date
            </label>
            <input
              type="date"
              value={form.effective_date}
              onChange={(e) => setForm(p => ({ ...p, effective_date: e.target.value }))}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
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
              {loading ? 'Uploading...' : 'Save & Publish Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function DocumentControlDocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [filters, setFilters] = useState({ status: '', search: '' });

  // Modals state
  const [showUpload, setShowUpload] = useState(false);
  const [selectedViewerDoc, setSelectedViewerDoc] = useState(null);
  const [selectedDCRDoc, setSelectedDCRDoc] = useState(null);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const userRole = user?.role || '';
  const canUpload = ['admin', 'supervisor', 'calibrator'].includes(userRole);
  const canRaiseDCR = ['admin', 'supervisor', 'calibrator'].includes(userRole);

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

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
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
        subtitle="Browse, inspect & manage controlled quality documents (L1–L4) • Click any row to view"
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Breadcrumbs items={[{ label: 'Document Control', to: '/document-control' }, { label: 'Documents (L1–L4)' }]} />
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

      {/* Document Table */}
      <div style={{
        background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden'
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
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                {['Document', 'Level', 'Rev', 'Status', 'Author', 'Effective', 'Size', 'Actions'].map(h => (
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
              {docs.map((doc, i) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedViewerDoc(doc)}
                  style={{
                    borderBottom: i < docs.length - 1 ? '1px solid #f1f5f9' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  {/* Document Title & Code */}
                  <td style={{ padding: '14px 16px', maxWidth: '280px' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px', marginBottom: '2px' }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '600' }}>
                      {doc.document_number}
                    </div>
                    {doc.file_name && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📎 {doc.file_name}
                      </div>
                    )}
                  </td>

                  {/* Level Badge */}
                  <td style={{ padding: '14px 16px' }}>
                    <LevelBadge level={doc.doc_level} />
                  </td>


                  {/* Revision */}
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155', fontWeight: '700' }}>
                    {doc.revision}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge status={doc.status} />
                  </td>

                  {/* Author */}
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                    {doc.uploaded_by_name || 'System'}
                  </td>

                  {/* Date */}
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatDate(doc.effective_date || doc.created_at)}
                  </td>

                  {/* Size */}
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatSize(doc.file_size)}
                  </td>

                  {/* Row Actions */}
                  <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {/* Direct In-App View Eye Button */}
                      <button
                        title="Open in Document Viewer"
                        onClick={() => setSelectedViewerDoc(doc)}
                        style={{
                          background: '#e0e7ff', border: 'none', borderRadius: '8px',
                          padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                          color: '#4338ca', fontSize: '12px', fontWeight: '600'
                        }}
                      >
                        <Eye size={14} /> Open
                      </button>

                      {/* Request DCR Button */}
                      {canRaiseDCR && (
                        <button
                          title="Raise Document Change Request (DCR)"
                          onClick={() => setSelectedDCRDoc(doc)}
                          style={{
                            background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px',
                            padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            color: '#6d28d9', fontSize: '12px', fontWeight: '600'
                          }}
                        >
                          <Edit3 size={13} /> DCR
                        </button>
                      )}

                      {/* Audit History Log */}
                      <button
                        title="Audit history"
                        onClick={(e) => openHistory(doc, e)}
                        style={{
                          background: '#f1f5f9', border: 'none', borderRadius: '8px',
                          padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b'
                        }}
                      >
                        <Clock size={14} />
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
        />
      )}

      {/* In-App Direct Document Viewer Modal */}
      {selectedViewerDoc && (
        <DocumentViewerModal
          doc={selectedViewerDoc}
          onClose={() => setSelectedViewerDoc(null)}
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
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{historyDoc.document_number} — {historyDoc.title}</p>
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
