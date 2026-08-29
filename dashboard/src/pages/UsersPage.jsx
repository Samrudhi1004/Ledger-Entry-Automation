import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import Badge from '../components/common/Badge';
import { getUsers, registerUser, deleteUser, getPlants } from '../api/users';
import { formatDateTime } from '../utils/formatters';

export default function UsersPage() {
  const [users, setUsers]         = useState([]);
  const [plants, setPlants]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [deleting, setDeleting]                 = useState(false);
  const [successBannerMsg, setSuccessBannerMsg] = useState('');
  const [pageErrorBannerMsg, setPageErrorBannerMsg] = useState('');

  // Form state for creating user accounts
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    employee_id: '',
    email: '',
    phone: '',
    role: 'operator',
    plant: '',
    password: '',
    password2: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await getUsers(roleFilter ? { role: roleFilter } : {});
      const data = res.data?.results ?? res.data ?? [];
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlantList = async () => {
    try {
      const res = await getPlants();
      const data = res.data?.results ?? res.data ?? [];
      setPlants(Array.isArray(data) ? data : []);
      if (data.length > 0 && !formData.plant) {
        setFormData(prev => ({ ...prev, plant: data[0].id }));
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchUsers();
    fetchPlantList();
  }, [roleFilter]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessBannerMsg('');
    setPageErrorBannerMsg('');

    if (!formData.username.trim()) {
      setErrorMsg('Username is required.');
      return;
    }
    if (!formData.employee_id.trim()) {
      setErrorMsg('Employee ID is required.');
      return;
    }
    if (!formData.password) {
      setErrorMsg('Password is required.');
      return;
    }
    if (formData.password !== formData.password2) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await registerUser(formData);
      setShowModal(false);
      setSuccessBannerMsg(`✓ User account "${formData.username}" (${formData.role.toUpperCase()}) saved successfully to database! Login is enabled.`);
      // Reset form
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        employee_id: '',
        email: '',
        phone: '',
        role: 'operator',
        plant: plants[0]?.id ?? '',
        password: '',
        password2: '',
      });
      fetchUsers();
    } catch (err) {
      const errData = err.response?.data;
      if (errData && typeof errData === 'object') {
        const firstErrKey = Object.keys(errData)[0];
        const firstErrVal = errData[firstErrKey];
        setErrorMsg(`${firstErrKey.toUpperCase()}: ${Array.isArray(firstErrVal) ? firstErrVal[0] : firstErrVal}`);
      } else {
        setErrorMsg('Failed to save user account to database.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (userObj) => {
    setSuccessBannerMsg('');
    setPageErrorBannerMsg('');
    setDeleteTargetUser(userObj);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setDeleting(true);
    setSuccessBannerMsg('');
    setPageErrorBannerMsg('');

    try {
      const res = await deleteUser(deleteTargetUser.id);
      const data = res.data;
      
      const msg = data?.message || (data?.action === 'deactivated' 
        ? `User account "${deleteTargetUser.username}" has historical inspection records and was deactivated instead.`
        : `User account "${deleteTargetUser.username}" was deleted successfully.`);
      
      setSuccessBannerMsg(`✓ ${msg}`);
      setDeleteTargetUser(null);
      fetchUsers();
    } catch (err) {
      const respData = err.response?.data;
      let errMsg = 'Failed to delete user account.';
      if (respData?.message) {
        errMsg = respData.message;
      } else if (respData?.detail) {
        errMsg = respData.detail;
      }
      setPageErrorBannerMsg(errMsg);
      setDeleteTargetUser(null);
    } finally {
      setDeleting(false);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'supervisor': return 'SUPERVISOR';
      case 'quality_engineer': return 'INSPECTOR';
      case 'calibrator': return 'CALIBRATOR';
      case 'operator': return 'OPERATOR';
      case 'admin': return 'ADMIN';
      default: return role ? role.toUpperCase() : 'USER';
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'supervisor': return 'badge-purple';
      case 'quality_engineer': return 'badge-ok';
      case 'calibrator': return 'badge-progress';
      case 'operator': return 'badge-blue';
      default: return 'badge-manual';
    }
  };

  return (
    <>
      <Header
        title="User & Account Management"
        subtitle="Manage accounts for Supervisors, Quality Inspectors, Calibrators, and Machine Operators"
      />

      <div className="page-content bg-gradient-animated">
        <div className="card">
          {successBannerMsg && (
            <div className="badge badge-ok mb-16" style={{ width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{successBannerMsg}</span>
              <button onClick={() => setSuccessBannerMsg('')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

          {pageErrorBannerMsg && (
            <div className="badge badge-red mb-16" style={{ width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚠️ {pageErrorBannerMsg}</span>
              <button onClick={() => setPageErrorBannerMsg('')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

          <div className="section-header" style={{ marginBottom: 20 }}>
            <h3 className="section-title">
              <span className="dot" />
              Account Registry ({users.length})
            </h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <select
                className="form-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ width: 170, padding: '6px 12px' }}
              >
                <option value="">All Roles</option>
                <option value="supervisor">Supervisors</option>
                <option value="quality_engineer">Inspectors</option>
                <option value="calibrator">Calibrators</option>
                <option value="operator">Operators</option>
              </select>

              <button
                id="create-operator-btn"
                className="btn btn-primary"
                onClick={() => {
                  setErrorMsg('');
                  setShowModal(true);
                }}
              >
                + Create User / Account
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Fetching user accounts from database..." />
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">No accounts found. Click "+ Create User / Account" to add one!</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Plant Location</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-mono font-bold text-blue">{u.employee_id || `EMP-${u.id}`}</td>
                      <td>{u.full_name || u.username}</td>
                      <td className="font-mono">{u.username}</td>
                      <td>
                        <span className={`badge ${getRoleBadgeClass(u.role)}`}>
                          {getRoleLabel(u.role)}
                        </span>
                      </td>
                      <td>{u.plant_name || 'Main Plant #1'}</td>
                      <td>
                        <span className={`badge badge-${u.is_active !== false ? 'ok' : 'red'}`}>
                          {u.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="text-xs text-muted">{formatDateTime(u.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {u.role !== 'admin' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(u)}
                            title="Delete user account"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal for creating a new user account */}
      {showModal && (
        <Modal
          title="Create New User Account (Database Saved)"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                id="submit-create-user"
                className="btn btn-primary"
                onClick={handleCreateUser}
                disabled={submitting}
              >
                {submitting ? 'Saving to Database...' : 'Save Account & Enable Login'}
              </button>
            </>
          }
        >
          {errorMsg && (
            <div className="badge badge-red mb-16" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Username * (Login Identifier)</label>
                <input
                  type="text"
                  name="username"
                  className="form-input"
                  placeholder="e.g. supervisor_rahul or inspector_sarah"
                  required
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Employee ID *</label>
                <input
                  type="text"
                  name="employee_id"
                  className="form-input"
                  placeholder="e.g. EMP-105"
                  required
                  value={formData.employee_id}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  className="form-input"
                  placeholder="e.g. Rahul"
                  value={formData.first_name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  className="form-input"
                  placeholder="e.g. Sharma"
                  value={formData.last_name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Account Role *</label>
                <select
                  name="role"
                  className="form-select"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="supervisor">Supervisor (Quality Control & Approvals)</option>
                  <option value="quality_engineer">Inspector (Quality Inspector)</option>
                  <option value="calibrator">Calibrator (Calibration Equipment Management)</option>
                  <option value="operator">Operator (Shop Floor Machine Operator)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Plant Assignment *</label>
                <select
                  name="plant"
                  className="form-select"
                  value={formData.plant}
                  onChange={handleChange}
                >
                  {plants.length === 0 ? (
                    <option value="1">Main Machining Plant #1</option>
                  ) : (
                    plants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.factory_name})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Login Password *</label>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  placeholder="Enter login password..."
                  required
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input
                  type="password"
                  name="password2"
                  className="form-input"
                  placeholder="Confirm password..."
                  required
                  value={formData.password2}
                  onChange={handleChange}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal for Confirming User Deletion / Deactivation */}
      {deleteTargetUser && (
        <Modal
          title="Confirm User Account Removal"
          onClose={() => setDeleteTargetUser(null)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteTargetUser(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                id="confirm-delete-user-btn"
                className="btn btn-danger"
                onClick={confirmDeleteUser}
                disabled={deleting}
              >
                {deleting ? 'Removing Account...' : 'Confirm Remove Account'}
              </button>
            </>
          }
        >
          <div style={{ padding: '4px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>
              Are you sure you want to remove this user account?
            </p>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 8, fontSize: 13, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Full Name:</span>
                <strong style={{ color: '#fff' }}>{deleteTargetUser.full_name || deleteTargetUser.username}</strong>

                <span style={{ color: 'var(--text-muted)' }}>Employee ID:</span>
                <strong style={{ color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{deleteTargetUser.employee_id || `EMP-${deleteTargetUser.id}`}</strong>

                <span style={{ color: 'var(--text-muted)' }}>Username:</span>
                <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{deleteTargetUser.username}</strong>

                <span style={{ color: 'var(--text-muted)' }}>Role:</span>
                <div>
                  <span className={`badge ${getRoleBadgeClass(deleteTargetUser.role)}`}>
                    {getRoleLabel(deleteTargetUser.role)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, background: 'rgba(59, 130, 246, 0.08)', padding: 12, borderRadius: 6, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              ℹ️ <strong>System Protection Rule:</strong> If this account has recorded historical inspection or audit logs, the system will safely <strong>deactivate</strong> the account instead of deleting historical inspection records.
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
