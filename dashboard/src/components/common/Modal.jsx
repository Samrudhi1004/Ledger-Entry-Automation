import { useEffect } from 'react';

export default function Modal({ title, onClose, children, footer, size }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const modalClass = `modal${size === 'xl' ? ' modal-xl' : size === 'lg' ? ' modal-lg' : ''}`;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className={modalClass}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button id="modal-close" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
