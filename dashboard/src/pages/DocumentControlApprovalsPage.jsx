import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ClipboardCheck, CheckCircle, XCircle, Download,
  Eye, RefreshCw, MessageSquare, AlertTriangle, X, FileText, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getDocuments, approveDocument, rejectDocument, getDocumentHistory,
} from '../api/documentControl';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ doc, onClose, onSuccess }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!comment.trim()) return setError('Rejection reason is required.');
    setLoading(true); setError('');
    try {
      await rejectDocument(doc.id, comment);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject document.');
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
        background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '460px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)'
      }}>
        <div style={{ padding: '22px 28px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>Reject Document</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>{doc.document_number} — {doc.title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} color="#94a3b8" />
          </button>
        </div>
        <div style={{ padding: '24px 28px 28px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
            Rejection Reason *
          </label>
          <textarea
            rows={4}
            placeholder="Explain why this document is being rejected..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
            }}
          />
          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0',
              background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#475569'
            }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading} style={{
              padding: '10px 22px', borderRadius: '10px', border: 'none',
              background: loading ? '#fca5a5' : '#dc2626', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700'
            }}>
              {loading ? 'Rejecting…' : 'Reject Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Approve Modal ─────────────────────────────────────────────────────────────
function ApproveModal({ doc, onClose, onSuccess }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await approveDocument(doc.id, comment);
      onSuccess();
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '460px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)'
      }}>
        <div style={{ padding: '22px 28px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>Approve Document</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>{doc.document_number} — {doc.title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} color="#94a3b8" />
          </button>
        </div>
        <div style={{ padding: '24px 28px 28px' }}>
          <div style={{ background: '#d1fae5', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <CheckCircle size={18} color="#059669" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#059669' }}>Confirm Approval</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#065f46' }}>
                This will mark the document as Approved and make it available to all users.
              </p>
            </div>
          </div>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
            Approval Comment (optional)
          </label>
          <textarea
            rows={3}
            placeholder="Any notes or conditions for approval..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
            }}
          />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0',
              background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#475569'
            }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading} style={{
              padding: '10px 22px', borderRadius: '10px', border: 'none',
              background: loading ? '#6ee7b7' : '#059669', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700'
            }}>
              {loading ? 'Approving…' : '✓ Approve Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DocumentControlApprovalsPage() {
  const { user } = useAuth();
  if (user && user.role !== 'admin') {
    return <Navigate to="/document-control" replace />;
  }
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const fetchPending = () => {
    setLoading(true);
    getDocuments({ status: 'under_review' })
      .then(r => setDocs(Array.isArray(r.data) ? r.data : r.data?.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPending(); }, []);

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <>
      <Header
        title="Document Approvals"
        subtitle={`${docs.length} document${docs.length !== 1 ? 's' : ''} awaiting quality review or management sign-off`}
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Breadcrumbs items={[{ label: 'Document Control', to: '/document-control' }, { label: 'Direct Approvals Queue' }]} />
        {/* Action Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={fetchPending} style={{
            padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: '600', color: '#475569'
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
          <RefreshCw size={28} style={{ marginBottom: '12px' }} />
          <p style={{ margin: 0, fontSize: '14px' }}>Loading pending documents…</p>
        </div>
      ) : docs.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
          padding: '80px 40px', textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <CheckCircle size={48} color="#d1fae5" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
            All Clear!
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            No documents pending approval at this time.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {docs.map((doc) => (
            <div key={doc.id} style={{
              background: '#fff', borderRadius: '16px', padding: '22px 24px',
              border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              borderLeft: '4px solid #f59e0b'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>

                {/* Left — doc info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <FileText size={16} color="#6366f1" />
                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '16px' }}>{doc.title}</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#6366f1', background: '#e0e7ff', padding: '2px 8px', borderRadius: '20px' }}>
                      {doc.document_number}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                      {doc.revision}
                    </span>
                  </div>

                  {doc.description && (
                    <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                      {doc.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {[
                      { icon: '👤', label: `Uploaded by ${doc.uploaded_by_name}` },
                      { icon: '📅', label: formatDate(doc.created_at) },
                      { icon: '📎', label: doc.file_name || 'No file' },
                    ].map((m, i) => (
                      <span key={i} style={{ fontSize: '12px', color: '#64748b' }}>
                        {m.icon} {m.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right — actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                  {doc.cloudinary_url && (
                    <a
                      href={doc.cloudinary_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
                        background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: '600',
                        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={14} /> View File
                    </a>
                  )}
                  <button
                    onClick={() => setApproveTarget(doc)}
                    style={{
                      padding: '8px 14px', borderRadius: '10px', border: 'none',
                      background: '#059669', color: '#fff', fontSize: '13px', fontWeight: '700',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    onClick={() => setRejectTarget(doc)}
                    style={{
                      padding: '8px 14px', borderRadius: '10px', border: '1px solid #fca5a5',
                      background: '#fff', color: '#dc2626', fontSize: '13px', fontWeight: '700',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {approveTarget && (
        <ApproveModal
          doc={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={() => { setApproveTarget(null); fetchPending(); }}
        />
      )}
      {rejectTarget && (
        <RejectModal
          doc={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSuccess={() => { setRejectTarget(null); fetchPending(); }}
        />
      )}
      </div>
      </div>
    </>
  );
}
