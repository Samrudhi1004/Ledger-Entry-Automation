import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('Verifying your email address...');
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link.');
        return;
      }
      try {
        await verifyEmail(token);
        setStatus('success');
        setMessage('Your email address has been successfully verified.');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Failed to verify email. The link may have expired.');
      }
    };
    
    verify();
  }, [token]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg-primary)'
    }}>
      <div className="card" style={{
        maxWidth: 400,
        width: '100%',
        padding: '40px 32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16
      }}>
        {status === 'loading' && (
          <>
            <Loader2 size={48} color="var(--accent-blue)" className="spinner" style={{ animation: 'spin 2s linear infinite' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Verifying Email</h2>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Email Verified!</h2>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Verification Failed</h2>
          </>
        )}

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '8px 0 16px' }}>
          {message}
        </p>

        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>

        {status !== 'loading' && (
          <button
            onClick={() => navigate('/profile')}
            style={{
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 24px',
              fontSize: '0.95rem',
              fontWeight: 500,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Return to Profile
          </button>
        )}
      </div>
    </div>
  );
}
