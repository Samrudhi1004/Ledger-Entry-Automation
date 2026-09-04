import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      // Use the environment variable for API URL or default to localhost
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/api/users/password-reset/request/`, { email });
      setMessage(response.data.message || 'If an account with that email exists, a password reset link has been sent.');
    } catch (err) {
      setError(
        err.response?.data?.error || 
        err.response?.data?.detail || 
        'Something went wrong. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page bg-gradient-animated">
      <div className="login-card">
        <h1 className="login-title">Reset Password</h1>
        <p className="login-sub" style={{ marginBottom: '24px' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {error && <div className="login-error">{error}</div>}
        {message && <div style={{ padding: '12px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', border: '1px solid #a7f3d0' }}>{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              className="form-input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/login" style={{ fontSize: '14px', color: 'var(--text-muted, #64748b)', textDecoration: 'none' }}>
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
