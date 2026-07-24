import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
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

  // Form state for creating operator/user
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

    if (formData.password !== formData.password2) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await registerUser(formData);
      setShowModal(false);
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
        setErrorMsg('Failed to create user account.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userObj) => {
    if (!window.confirm(`Are you sure you want to delete account "${userObj.username}" (${userObj.full_name || userObj.employee_id})?`)) {
      return;
    }

    try {
      await deleteUser(userObj.id);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user account.');
    }
  };

  return (
    <>
      <Header title="User & Operator Management" subtitle="Create and manage shop-floor operator and supervisor accounts" />

      <div className="page-content bg-gradient-animated">
        <div className="card">
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
                style={{ width: 160, padding: '6px 12px' }}
              >
                <option value="">All Roles</option>
                <option value="operator">Operators</option>
                <option value="supervisor">Supervisors</option>
                <option value="admin">Admins</option>
              </select>

              <button
                id="create-operator-btn"
                className="btn btn-primary"
                onClick={() => {
                  setErrorMsg('');
                  setShowModal(true);
                }}
              >
                + Create Operator / Account
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Fetching user accounts..." />
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-text">No accounts found. Click "+ Create Operator" to add one!</div>
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
                        <span className={`badge badge-${u.role === 'operator' ? 'blue' : u.role === 'supervisor' ? 'purple' : 'ok'}`}>
                          {u.role ? u.role.toUpperCase() : 'USER'}
                        </span>
                      </td>
                      <td>{u.plant_name || '—'}</td>
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
                            🗑️ Delete
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

      {/* Modal for Creating New Operator Account */}
      {showModal && (
        <Modal
          title="Create New Operator / User Account"
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
                {submitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </>
          }
        >
          {errorMsg && (
            <div className="badge badge-red mb-16" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input
                  type="text"
                  name="username"
                  className="form-input"
                  placeholder="e.g. operator_rahul"
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
                  placeholder="e.g. EMP-102"
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
                  <option value="operator">Operator (Shop Floor)</option>
                  <option value="supervisor">Supervisor (Quality Control)</option>
                  <option value="admin">Admin</option>
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
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.factory_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  placeholder="Enter password..."
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
    </>
  );
}
