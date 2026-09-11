import React, { useState } from 'react';
import {
  X, Download, ExternalLink, FileText, AlertCircle,
  Maximize2, Minimize2, Edit3, Calendar, Tag, CheckCircle, Shield
} from 'lucide-react';

const LEVEL_COLORS = {
  L1: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', label: 'L1 — Quality Manual' },
  L2: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'L2 — SOP' },
  L3: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', label: 'L3 — Work Instruction' },
  L4: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'L4 — Form / Record' },
};

export default function DocumentViewerModal({ doc, onClose, onRequestDCR, canRequestDCR }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!doc) return null;

  const isPdf = doc.file_name?.toLowerCase().endsWith('.pdf') || doc.file_type?.includes('pdf');
  const isImage = doc.file_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.file_name || '');
  const levelInfo = LEVEL_COLORS[doc.doc_level] || LEVEL_COLORS.L2;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 1200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isFullscreen ? '0' : '20px',
      transition: 'all 0.2s ease',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: isFullscreen ? '0' : '16px',
        width: isFullscreen ? '100vw' : '92vw',
        height: isFullscreen ? '100vh' : '90vh',
        maxWidth: isFullscreen ? 'none' : '1400px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          flexShrink: 0,
        }}>
          {/* Left: Document Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#e0e7ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '18px',
            }}>
              📄
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  {doc.title}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: levelInfo.bg,
                  color: levelInfo.color,
                  border: `1px solid ${levelInfo.border}`,
                }}>
                  {doc.doc_level || 'L2'}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#e2e8f0',
                  color: '#334155',
                }}>
                  {doc.revision || 'Rev A'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                <span><strong>Code:</strong> {doc.document_number}</span>
                <span>•</span>
                <span><strong>Category:</strong> {doc.category_name || 'General'}</span>
                <span>•</span>
                <span><strong>Uploaded by:</strong> {doc.uploaded_by_name || 'System'}</span>
                {doc.file_size_display && (
                  <>
                    <span>•</span>
                    <span><strong>Size:</strong> {doc.file_size_display}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {canRequestDCR && (
              <button
                onClick={() => {
                  onClose();
                  onRequestDCR(doc);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                }}
              >
                <Edit3 size={15} /> Request Change (DCR)
              </button>
            )}

            {doc.cloudinary_url && (
              <a
                href={doc.cloudinary_url}
                target="_blank"
                rel="noreferrer"
                title="Open in new tab"
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={15} /> Open Original
              </a>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              style={{
                background: 'none',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#64748b',
              }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              onClick={onClose}
              title="Close viewer"
              style={{
                background: '#fee2e2',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#dc2626',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div style={{
          flex: 1,
          backgroundColor: '#0f172a',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {doc.cloudinary_url ? (
            isPdf ? (
              <iframe
                src={`${doc.cloudinary_url}#toolbar=1&navpanes=0`}
                title={doc.title}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#334155',
                }}
              />
            ) : isImage ? (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                boxSizing: 'border-box',
                overflow: 'auto',
              }}>
                <img
                  src={doc.cloudinary_url}
                  alt={doc.title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  }}
                />
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                backgroundColor: '#ffffff',
                padding: '40px',
                borderRadius: '16px',
                maxWidth: '480px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              }}>
                <FileText size={48} color="#4f46e5" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>{doc.file_name}</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                  This file format cannot be embedded directly in the browser. You can open or download it using the link below.
                </p>
                <a
                  href={doc.cloudinary_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '600',
                    fontSize: '14px',
                  }}
                >
                  <Download size={16} /> Download File
                </a>
              </div>
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <AlertCircle size={40} style={{ marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '15px' }}>No file attached to this document record.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
