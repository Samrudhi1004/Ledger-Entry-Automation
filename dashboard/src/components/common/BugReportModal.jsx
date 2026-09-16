import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';

export default function BugReportModal({ onClose }) {
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter a description of the issue.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('message', message);
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const res = await api.post('/support/bug-reports/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data' // Axios handles the boundary automatically usually, but explicitly setting it to multipart/form-data tells the interceptor
        }
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <h2 style={{ marginBottom: 16 }}>Report an Issue</h2>
        
        {success ? (
          <div className="alert alert-success">
            Thank you! Your issue has been reported successfully.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error" style={{ marginBottom: 16, color: 'red' }}>{error}</div>}
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Describe the issue or bug</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What went wrong? Please provide details..."
                style={{ width: '100%', minHeight: 100, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Screenshot (Optional)</label>
              <input 
                type="file" 
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => setScreenshot(e.target.files[0])}
                disabled={isSubmitting}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
