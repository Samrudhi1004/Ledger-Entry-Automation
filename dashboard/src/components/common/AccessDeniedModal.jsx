import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import Modal from './Modal';

const ACCESS_DENIED_EVENT = 'inspection-hub:access-denied';

/** Open the shared access-denied dialog from any page or action handler. */
export function showAccessDenied(message) {
  window.dispatchEvent(new CustomEvent(ACCESS_DENIED_EVENT, {
    detail: { message },
  }));
}

/** Mounted once by the protected layout so every module uses the same dialog. */
export function AccessDeniedModalHost() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAccessDenied = (event) => {
      setMessage(event.detail?.message || 'Your role has view-only access. Manage permission is required for this action.');
    };
    window.addEventListener(ACCESS_DENIED_EVENT, handleAccessDenied);
    return () => window.removeEventListener(ACCESS_DENIED_EVENT, handleAccessDenied);
  }, []);

  if (!message) return null;

  return (
    <Modal
      title="Access Denied"
      size="sm"
      onClose={() => setMessage('')}
      footer={(
        <button type="button" className="btn btn-primary" onClick={() => setMessage('')}>
          Close
        </button>
      )}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, color: '#475569' }}>
        <ShieldAlert size={24} color="#DC2626" style={{ flexShrink: 0 }} aria-hidden="true" />
        <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>
      </div>
    </Modal>
  );
}

export default AccessDeniedModalHost;
