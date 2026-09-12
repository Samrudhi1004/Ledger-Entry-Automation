import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, footer, size, closeOnBackdrop = true }) {
  const titleId = useId();
  const modalRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const previousFocus = document.activeElement;
    const handler = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const focusable = [...(modalRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], iframe'
      ) ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    requestAnimationFrame(() => {
      modalRef.current?.querySelector('[autofocus], button, input, select, textarea, a[href]')?.focus();
    });
    return () => {
      window.removeEventListener('keydown', handler);
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

  const modalClass = `modal${
    size === '2xl' || size === 'full' ? ' modal-2xl' : 
    size === 'xl' ? ' modal-xl' : 
    size === 'lg' ? ' modal-lg' : ''
  }`;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
    >
      <div ref={modalRef} className={modalClass} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header">
          <h3 id={titleId} className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
