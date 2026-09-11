import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Upload, Download, Eye, CheckCircle, XCircle,
  FileText, Filter, RefreshCw, Send, ChevronDown,
  Calendar, Clock, User, Tag, AlertTriangle, X, Paperclip,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getDocuments, getCategories, uploadDocument,
  approveDocument, rejectDocument, submitForReview,
  getDocumentHistory, getDownloadUrl,
} from '../api/documentControl';

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
function UploadModal({ categories, onClose, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', category: '', effective_date: '' });
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
    if (!form.category) return setError('Category is required.');
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category', form.category);
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
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '540px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)', overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{ padding: '22px 28px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Upload Document</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>File will be stored securely on Cloudinary</p>
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
              borderRadius: '12px', padding: '24px', textAlign: 'center',
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
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>PDF, Word, Excel — max 50 MB</p>
              </div>
            )}
          </div>

          {/* Fields */}
          {[
            { label: 'Document Title *', key: 'title', type: 'text', placeholder: 'e.g. Quality Control SOP v2' },
            { label: 'Description', key: 'description', type: 'text', placeholder: 'Brief description (optional)' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                {f.label}
              </label>
              <input
                type={f.type} placeholder={f.placeholder} value={form[f.key]}
                onChange={(e) => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none',
                  background: '#fff', boxSizing: 'border-box'
                }}
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                Effective Date
              </label>
              <input
                type="date" value={form.effective_date}
                onChange={(e) => setForm(p => ({ ...p, effective_date: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
              borderRadius: '10px', fontSize: '13px', marginBottom: '14px',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0',
              background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#475569'
            }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: loading ? '#a5b4fc' : '#6366f1', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700'
            }}>
              {loading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── History Drawer ────────────────────────────────────────────────────────────
function HistoryDrawer({ doc, onClose }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocumentHistory(doc.id)
      .then(r => setActivities(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [doc.id]);

  const ACTION_ICONS = {
    uploaded: '📤', submitted_review: '📋', approved: '✅',
    rejected: '❌', revised: '🔄', downloaded: '⬇️', obsoleted: '🗄️',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 900,
      display: 'flex', justifyContent: 'flex-end'
    }} onClick={onClose}>
      <div style={{
        width: '400px', height: '100%', background: '#fff',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.14)', overflow: 'auto', padding: '28px'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Activity Log</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              {doc.document_number} — {doc.title}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} color="#94a3b8" />
          </button>
        </div>
        {loading ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>Loading…</p>
        ) : activities.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>No activity yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activities.map((a, i) => (
              <div key={i} style={{
                background: '#f8fafc', borderRadius: '12px', padding: '14px',
                borderLeft: '3px solid #6366f1'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                    {ACTION_ICONS[a.action] || '•'} {a.action.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {new Date(a.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  By {a.performed_by_name}
                </p>
                {a.comment && (
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>
                    "{a.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DocumentControlDocumentsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'supervisor';

  const [docs, setDocs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: '', status: '' });
  const [actionLoading, setActionLoading] = useState({});

  const fetchDocs = () => {
    setLoading(true);
    const params = {};
    if (filters.search)   params.search   = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.status)   params.status   = filters.status;
    getDocuments(params)
      .then(r => setDocs(Array.isArray(r.data) ? r.data : r.data?.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDocs(); }, [filters]);
  useEffect(() => {
    getCategories().then(r => setCategories(Array.isArray(r.data) ? r.data : []));
  }, []);

  const handleSubmitReview = async (doc) => {
    setActionLoading(p => ({ ...p, [doc.id]: true }));
    try { await submitForReview(doc.id); fetchDocs(); } catch {}
    setActionLoading(p => ({ ...p, [doc.id]: false }));
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>All Documents</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            {docs.length} document{docs.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchDocs} style={{
            padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: '600', color: '#475569'
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
          {canManage && (
            <button onClick={() => setShowUpload(true)} style={{
              padding: '9px 18px', borderRadius: '10px', border: 'none',
              background: '#6366f1', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '13px', fontWeight: '700',
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
            }}>
              <Upload size={15} /> Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{
        background: '#fff', borderRadius: '14px', padding: '16px 20px',
        border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            placeholder="Search title, document number..."
            value={filters.search}
            onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
            style={{
              width: '100%', paddingLeft: '36px', paddingRight: '12px', paddingTop: '9px', paddingBottom: '9px',
              borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <select
          value={filters.category}
          onChange={(e) => setFilters(p => ({ ...p, category: e.target.value }))}
          style={{
            padding: '9px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
            fontSize: '13px', outline: 'none', background: '#fff', minWidth: '150px'
          }}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))}
          style={{
            padding: '9px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
            fontSize: '13px', outline: 'none', background: '#fff', minWidth: '150px'
          }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Loading documents…</p>
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <FileText size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#94a3b8' }}>No documents found</p>
            {canManage && (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#cbd5e1' }}>
                Upload your first document to get started.
              </p>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                {['Document', 'Category', 'Revision', 'Status', 'Uploaded By', 'Date', 'Size', 'Actions'].map(h => (
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
                <tr key={doc.id} style={{
                  borderBottom: i < docs.length - 1 ? '1px solid #f1f5f9' : 'none',
                  transition: 'background 0.15s'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <td style={{ padding: '14px 16px', maxWidth: '240px' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px', marginBottom: '2px' }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: '600' }}>
                      {doc.document_number}
                    </div>
                    {doc.file_name && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📎 {doc.file_name}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {doc.category_name && (
                      <span style={{
                        background: `${doc.category_color}20`, color: doc.category_color,
                        fontSize: '12px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px'
                      }}>
                        {doc.category_name}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                    {doc.revision}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge status={doc.status} />
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                    {doc.uploaded_by_name}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatDate(doc.created_at)}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatSize(doc.file_size)}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {/* View history */}
                      <button
                        title="View activity log"
                        onClick={() => setHistoryDoc(doc)}
                        style={{
                          background: '#f1f5f9', border: 'none', borderRadius: '8px',
                          padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                        }}
                      >
                        <Eye size={14} color="#64748b" />
                      </button>

                      {/* Download */}
                      {doc.cloudinary_url && (
                        <a
                          href={doc.cloudinary_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Download"
                          style={{
                            background: '#f1f5f9', border: 'none', borderRadius: '8px',
                            padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            textDecoration: 'none'
                          }}
                        >
                          <Download size={14} color="#6366f1" />
                        </a>
                      )}

                      {/* Submit for review (draft only, admin/supervisor) */}
                      {canManage && doc.status === 'draft' && (
                        <button
                          title="Submit for review"
                          onClick={() => handleSubmitReview(doc)}
                          disabled={actionLoading[doc.id]}
                          style={{
                            background: '#fef3c7', border: 'none', borderRadius: '8px',
                            padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                          }}
                        >
                          <Send size={14} color="#d97706" />
                        </button>
                      )}
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
          categories={categories}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchDocs(); }}
        />
      )}

      {/* History Drawer */}
      {historyDoc && (
        <HistoryDrawer doc={historyDoc} onClose={() => setHistoryDoc(null)} />
      )}
    </div>
  );
}
