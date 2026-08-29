import { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { getUsers } from '../../api/users';
import { createTask } from '../../api/tasks';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, CheckSquare, User } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: '',                 label: 'All Roles' },
  { value: 'supervisor',       label: 'Supervisor' },
  { value: 'quality_engineer', label: 'Inspector' },
  { value: 'operator',         label: 'Operator' },
];

function getRoleLabel(role) {
  switch (role) {
    case 'supervisor':       return 'Supervisor';
    case 'quality_engineer': return 'Inspector';
    case 'operator':         return 'Operator';
    case 'admin':            return 'Admin';
    default: return role || 'User';
  }
}

export default function TaskModal({ isOpen, onClose, onTaskCreated }) {
  const { user: currentUser } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const minDeadline = new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    allocated_to: '',
    deadline: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setErrorMsg('');
      setRoleFilter('');
      setFormData({ title: '', description: '', allocated_to: '', deadline: '' });
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await getUsers();
      const data = res.data?.results ?? res.data ?? [];
      // Exclude self and inactive users
      const filtered = Array.isArray(data)
        ? data.filter(u => u.id !== currentUser?.id && u.is_active !== false && u.role !== 'admin')
        : [];
      setAllUsers(filtered);
    } catch {
      setAllUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Filter users by selected role
  const filteredUsers = useMemo(() => {
    if (!roleFilter) return allUsers;
    return allUsers.filter(u => u.role === roleFilter);
  }, [allUsers, roleFilter]);

  // When role changes, reset the selected user
  const handleRoleFilterChange = (e) => {
    setRoleFilter(e.target.value);
    setFormData(prev => ({ ...prev, allocated_to: '' }));
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    if (new Date(formData.deadline) <= new Date()) {
      setErrorMsg('Deadline must be in the future.');
      setSubmitting(false);
      return;
    }

    try {
      await createTask(formData);
      onTaskCreated();
    } catch (err) {
      const errData = err.response?.data;
      if (errData && typeof errData === 'object') {
        const key = Object.keys(errData)[0];
        const val = errData[key];
        setErrorMsg(`${key}: ${Array.isArray(val) ? val[0] : val}`);
      } else {
        setErrorMsg(errData?.detail || 'Failed to create task. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedUser = allUsers.find(u => String(u.id) === String(formData.allocated_to));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Allocate New Task"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !formData.title || !formData.allocated_to || !formData.deadline}
          >
            <CheckSquare size={15} />
            {submitting ? 'Allocating...' : 'Allocate Task'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {errorMsg && (
          <div
            className="badge badge-ooc"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <AlertCircle size={15} /> {errorMsg}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Task Title *</label>
          <input
            type="text"
            name="title"
            required
            className="form-input"
            placeholder="e.g. Complete daily calibration check"
            value={formData.title}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description *</label>
          <textarea
            name="description"
            required
            className="form-textarea"
            placeholder="Describe what needs to be done, any specific steps or requirements..."
            value={formData.description}
            onChange={handleChange}
            style={{ minHeight: 90 }}
          />
        </div>

        {/* Two-step user selection: Role → then Person */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Step 1: Select Role */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Step 1 — Filter by Role
            </label>
            <select
              value={roleFilter}
              onChange={handleRoleFilterChange}
              className="form-select"
              disabled={loadingUsers}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {roleFilter && (
              <div style={{ marginTop: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {filteredUsers.length} {getRoleLabel(roleFilter)}{filteredUsers.length !== 1 ? 's' : ''} available
              </div>
            )}
          </div>

          {/* Step 2: Select Person */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Step 2 — Select Person *
            </label>
            <select
              name="allocated_to"
              required
              value={formData.allocated_to}
              onChange={handleChange}
              className="form-select"
              disabled={loadingUsers || filteredUsers.length === 0}
            >
              <option value="">
                {loadingUsers
                  ? 'Loading...'
                  : filteredUsers.length === 0
                  ? roleFilter ? `No ${getRoleLabel(roleFilter)}s found` : 'Select a role first'
                  : 'Choose a person...'}
              </option>
              {filteredUsers.map(u => {
                const displayName = u.first_name || u.last_name 
                  ? `${u.first_name || ''} ${u.last_name || ''}`.trim() 
                  : (u.full_name || u.username);
                return (
                  <option key={u.id} value={u.id}>
                    {displayName}
                    {u.employee_id ? ` · ${u.employee_id}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Selected user preview card */}
        {selectedUser && (
          <div style={{
            marginTop: 12, marginBottom: 4,
            padding: '10px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <User size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                {selectedUser.first_name || selectedUser.last_name 
                  ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() 
                  : (selectedUser.full_name || selectedUser.username)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                @{selectedUser.username}
                {selectedUser.employee_id ? ` · ${selectedUser.employee_id}` : ''}
                {' · '}
                <span style={{ color: 'var(--accent-blue)' }}>{getRoleLabel(selectedUser.role)}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Deadline *</label>
            <input
              type="datetime-local"
              name="deadline"
              required
              min={minDeadline}
              value={formData.deadline}
              onChange={handleChange}
              className="form-input"
            />
          </div>
        </div>

      </form>
    </Modal>
  );
}
