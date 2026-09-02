import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useAuth } from '../context/AuthContext';
import { updateProfile, uploadProfilePhoto, changePassword } from '../api/auth';
import {
  User, Mail, Phone, Lock, Camera, CheckCircle2, AlertCircle,
  Building2, Calendar, IdCard, Shield, KeyRound, Eye, EyeOff, UploadCloud, RefreshCw, Sparkles
} from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef(null);

  const roleLabel = {
    admin: 'ADMINISTRATOR',
    supervisor: 'SUPERVISOR',
    operator: 'MACHINE OPERATOR',
    quality_engineer: 'QUALITY INSPECTOR',
    calibrator: 'CALIBRATION ENGINEER',
  }[user?.role] || (user?.role ? user.role.toUpperCase() : 'USER');

  const initials = user
    ? (`${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`).toUpperCase() || user.username?.[0]?.toUpperCase()
    : '?';

  // ── Personal Details Form State ─────────────────────────────────────
  const [details, setDetails] = useState({
    first_name: '',
    last_name:  '',
    email:      '',
    phone:      '',
  });

  // Sync form fields whenever the user context loads or refreshes
  useEffect(() => {
    if (user) {
      setDetails({
        first_name: user.first_name || '',
        last_name:  user.last_name  || '',
        email:      user.email      || '',
        phone:      user.phone      || '',
      });
    }
  }, [user]);
  const [detailsSaving,  setDetailsSaving]  = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState('');
  const [detailsError,   setDetailsError]   = useState('');

  const handleDetailsChange = (e) => {
    setDetails((p) => ({ ...p, [e.target.name]: e.target.value }));
    setDetailsSuccess('');
    setDetailsError('');
  };

  const handleDetailsSave = async (e) => {
    e.preventDefault();
    setDetailsSaving(true);
    setDetailsSuccess('');
    setDetailsError('');
    try {
      await updateProfile(details);
      await refreshUser();
      setDetailsSuccess('Personal information updated successfully.');
    } catch (err) {
      const d = err.response?.data;
      setDetailsError(d?.detail || d?.message || 'Failed to update personal information.');
    } finally {
      setDetailsSaving(false);
    }
  };

  // ── Photo Upload State ──────────────────────────────────────────────
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoSaving,  setPhotoSaving]  = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [photoError,   setPhotoError]   = useState('');

  const avatarSrc = photoPreview || user?.profile_photo_url || null;

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo file size must be smaller than 5 MB.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError('');
    setPhotoSuccess('');
  };

  const handlePhotoSave = async () => {
    if (!photoFile) return;
    setPhotoSaving(true);
    setPhotoSuccess('');
    setPhotoError('');
    try {
      await uploadProfilePhoto(photoFile);
      await refreshUser();
      setPhotoSuccess('Profile photo updated successfully.');
      setPhotoFile(null);
    } catch (err) {
      const d = err.response?.data;
      setPhotoError(d?.error || d?.message || 'Photo upload failed.');
    } finally {
      setPhotoSaving(false);
    }
  };

  // ── Password Form State ─────────────────────────────────────────────
  const [passwords, setPasswords] = useState({ old_password: '', new_password: '', confirm: '' });
  const [showOld, setShowOld]     = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError,   setPwError]   = useState('');

  const handlePasswordChange = (e) => {
    setPasswords((p) => ({ ...p, [e.target.name]: e.target.value }));
    setPwSuccess('');
    setPwError('');
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPwSuccess('');
    setPwError('');

    if (passwords.new_password !== passwords.confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    if (passwords.new_password.length < 6) {
      setPwError('New password must be at least 6 characters long.');
      return;
    }

    setPwSaving(true);
    try {
      await changePassword({ old_password: passwords.old_password, new_password: passwords.new_password });
      setPwSuccess('Password updated successfully.');
      setPasswords({ old_password: '', new_password: '', confirm: '' });
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.old_password?.[0] || d?.new_password?.[0] || d?.detail || d?.message || 'Failed to update password.';
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  };

  const formatDate = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <Header
        title="Profile & Account Settings"
        subtitle={`Manage your profile, personal information, and security credentials — ${roleLabel}`}
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Admin Sub-Navigation Tabs (Only visible to admin) ────────────── */}
          {user?.role === 'admin' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'var(--bg-card)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <NavLink
                to="/profile"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  background: isActive ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(15,23,42,0.25)' : 'none',
                  transition: 'all 0.2s ease',
                })}
              >
                <User size={16} /> My Profile
              </NavLink>

              <NavLink
                to="/company"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? 'var(--text-white)' : 'var(--text-muted)',
                  background: isActive ? 'var(--accent-blue)' : 'transparent',
                  transition: 'all 0.2s ease',
                })}
              >
                <Building2 size={16} /> Company Details
                <span className="badge badge-purple" style={{ fontSize: '0.68rem', padding: '2px 6px', marginLeft: 4 }}>
                  ADMIN
                </span>
              </NavLink>
            </div>
          )}

          {/* ── 1. Header Profile Banner Card ───────────────────────────────── */}
          <div className="card" style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              
              {/* Avatar circle */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to change profile picture"
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    background: avatarSrc ? 'transparent' : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    fontWeight: 700,
                    color: '#ffffff',
                    overflow: 'hidden',
                    border: '2px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    initials
                  )}
                </div>

                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePhotoSelect} />
              </div>

              {/* Summary text */}
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '—'}
                  </h2>
                  <span className="badge badge-purple" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                    {roleLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 10, flexWrap: 'wrap', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IdCard size={14} color="var(--text-muted)" />
                    <span className="font-mono">{user?.employee_id || `EMP-${user?.id}`}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={14} color="var(--text-muted)" />
                    <span>{user?.plant_name || 'Main Plant #1'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mail size={14} color="var(--text-muted)" />
                    <span>{user?.email || '—'}</span>
                  </div>
                </div>

                {/* Photo Action Row */}
                {photoFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handlePhotoSave}
                      disabled={photoSaving}
                    >
                      {photoSaving ? (
                        <>
                          <RefreshCw size={13} className="spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <UploadCloud size={13} /> Save Photo
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoError(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={13} /> Change Photo
                    </button>
                  </div>
                )}

                {photoSuccess && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', marginTop: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={14} /> {photoSuccess}
                  </div>
                )}
                {photoError && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-red)', marginTop: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={14} /> {photoError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. Grid: Personal Information + Change Password ──────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>

            {/* Personal Details Form Card */}
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <User size={18} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Personal Information
                </h3>
              </div>

              {detailsSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} /> {detailsSuccess}
                </div>
              )}

              {detailsError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={15} /> {detailsError}
                </div>
              )}

              <form onSubmit={handleDetailsSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">First Name</label>
                    <input
                      className="form-input"
                      name="first_name"
                      value={details.first_name}
                      onChange={handleDetailsChange}
                      placeholder="First Name"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Last Name</label>
                    <input
                      className="form-input"
                      name="last_name"
                      value={details.last_name}
                      onChange={handleDetailsChange}
                      placeholder="Last Name"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email Address</label>
                  <input
                    className="form-input"
                    name="email"
                    type="email"
                    value={details.email}
                    onChange={handleDetailsChange}
                    placeholder="admin@example.com"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    name="phone"
                    value={details.phone}
                    onChange={handleDetailsChange}
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div style={{ paddingTop: 6 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={detailsSaving}
                  >
                    {detailsSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Security & Password Form Card */}
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <KeyRound size={18} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Security & Password
                </h3>
              </div>

              {pwSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} /> {pwSuccess}
                </div>
              )}

              {pwError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={15} /> {pwError}
                </div>
              )}

              <form onSubmit={handlePasswordSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={showOld ? 'text' : 'password'}
                      name="old_password"
                      value={passwords.old_password}
                      onChange={handlePasswordChange}
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowOld(!showOld)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={showNew ? 'text' : 'password'}
                      name="new_password"
                      value={passwords.new_password}
                      onChange={handlePasswordChange}
                      placeholder="Min. 6 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    className="form-input"
                    type="password"
                    name="confirm"
                    value={passwords.confirm}
                    onChange={handlePasswordChange}
                    placeholder="Repeat new password"
                    required
                  />
                </div>

                <div style={{ paddingTop: 6 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pwSaving}
                  >
                    {pwSaving ? 'Updating Password...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

          </div>

          {/* ── 3. Read-Only System Metadata Card ─────────────────────────────── */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Shield size={18} color="var(--accent-blue)" />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  System Reference & Permissions
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  System-managed account parameters and assigned plant hierarchy
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 16 }}>
              
              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  System Username
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }} className="font-mono">
                  {user?.username || '—'}
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Employee Reference ID
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-blue)', marginTop: 6 }} className="font-mono">
                  {user?.employee_id || `EMP-${user?.id}`}
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Assigned Plant
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                  {user?.plant_name || 'Main Plant #1'}
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Date Joined
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                  {formatDate(user?.date_joined)}
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Account Status
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${user?.is_active !== false ? 'badge-ok' : 'badge-red'}`}>
                    {user?.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
}
