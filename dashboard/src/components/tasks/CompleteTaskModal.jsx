import { useState, useRef } from 'react';
import Modal from '../common/Modal';
import { CheckSquare, Upload, X, FileText, AlertCircle } from 'lucide-react';
import { completeTask } from '../../api/tasks';

const ALLOWED_ACCEPT = 'image/*,.pdf,.docx,.xlsx,.mp4,.mov';

function FilePreview({ file, onRemove }) {
  const isImage = file.type.startsWith('image/');
  const [src, setSrc] = useState('');

  if (isImage && !src) {
    const reader = new FileReader();
    reader.onload = (e) => setSrc(e.target.result);
    reader.readAsDataURL(file);
  }

  const sizeLabel = file.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(1)} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      {isImage && src ? (
        <img
          src={src}
          alt={file.name}
          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: 4, flexShrink: 0,
          background: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={20} color="var(--text-muted)" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sizeLabel}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', flexShrink: 0 }}
        title="Remove file"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default function CompleteTaskModal({ task, onClose, onCompleted }) {
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const addFiles = (incoming) => {
    const arr = Array.from(incoming);
    setFiles(prev => {
      const next = [...prev];
      for (const f of arr) {
        // Deduplicate by name + size
        if (!next.find(x => x.name === f.name && x.size === f.size)) {
          next.push(f);
        }
      }
      return next;
    });
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      let payload = null;
      if (files.length > 0) {
        payload = new FormData();
        files.forEach(f => payload.append('files', f));
      }
      await completeTask(task.id, payload);
      onCompleted();
      onClose();
    } catch (err) {
      const errData = err.response?.data;
      const msg =
        errData?.detail ||
        errData?.files?.[0] ||
        (typeof errData === 'string' ? errData : null) ||
        'Failed to complete task. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={!submitting ? onClose : undefined}
      closeOnBackdrop={!submitting}
      title="Complete Task"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-sm"
            style={{
              background: submitting ? 'var(--text-muted)' : 'var(--accent-green)',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 6,
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            <CheckSquare size={15} />
            {submitting ? 'Completing…' : 'Mark Complete'}
          </button>
        </>
      }
    >
      {/* Task title */}
      <div style={{
        padding: '10px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Task</div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{task.title}</div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="badge badge-ooc"
          style={{ width: '100%', padding: '9px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent-blue)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '22px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'color-mix(in srgb, var(--accent-blue) 8%, transparent)' : 'var(--bg-elevated)',
          transition: 'border-color 0.15s, background 0.15s',
          marginBottom: files.length > 0 ? 12 : 0,
        }}
      >
        <Upload size={22} color="var(--text-muted)" style={{ marginBottom: 6 }} />
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Drop files here or <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>browse</span>
        </div>
        <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Images, PDF, Word, Excel, MP4, MOV · max 20 MB each · optional
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Attached file list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((f, idx) => (
            <FilePreview key={`${f.name}-${f.size}-${idx}`} file={f} onRemove={() => removeFile(idx)} />
          ))}
        </div>
      )}
    </Modal>
  );
}
