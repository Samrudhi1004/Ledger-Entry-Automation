import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (u, p) => {
    setError('');
    setLoading(true);
    try {
      await login(u, p);
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        'Invalid credentials. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin(username, password);
  };

  return (
    <div className="login-page bg-gradient-animated">
      <div className="login-card">
        <h1 className="login-title">Inspection Hub</h1>
        <p className="login-sub">Supervisor Dashboard · Quality Control</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="form-input"
              type="text"
              placeholder="Enter username (e.g. supervisor, admin)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="quick-login mt-16" style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '12px' }}>
          <p className="text-xs text-muted mb-8" style={{ textAlign: 'center' }}>Quick Demo Access:</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              id="btn-login-supervisor"
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => {
                setUsername('supervisor');
                setPassword('supervisor123');
                handleLogin('supervisor', 'supervisor123');
              }}
            >
              👔 Supervisor
            </button>
            <button
              id="btn-login-admin"
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => {
                setUsername('admin');
                setPassword('admin123');
                handleLogin('admin', 'admin123');
              }}
            >
              👑 Admin
            </button>
          </div>
        </div>

        <p className="text-xs text-muted mt-16" style={{ textAlign: 'center' }}>
          Factory Quality Inspection System · v1.0
        </p>
      </div>
    </div>
  );
}
