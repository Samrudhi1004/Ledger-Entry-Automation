import { useState, useEffect, useMemo } from 'react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { getTasks, resolveIssue } from '../api/tasks';
import { formatDateTime } from '../utils/formatters';
import TaskModal from '../components/tasks/TaskModal';
import {
  Plus, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  ListTodo, ChevronDown, ChevronUp, User, ClipboardList, Send
} from 'lucide-react';

function ResolveModal({ task, onClose, onConfirm }) {
  const [actionType, setActionType] = useState('reopen');
  const [newDeadline, setNewDeadline] = useState('');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    if (task?.deadline && actionType === 'extend') {
      const d = new Date(task.deadline);
      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d - tzoffset)).toISOString().slice(0, 16);
      setNewDeadline(localISOTime);
    }
  }, [task, actionType]);

  if (!task) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ width: 400 }}>
        <h3 style={{ margin: '0 0 16px 0' }}>Resolve Issue</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          How do you want to handle the issue for task: <strong>{task.title}</strong>?
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="actionType" value="reopen" checked={actionType === 'reopen'} onChange={() => setActionType('reopen')} />
            Reopen (Keep existing deadline)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="actionType" value="extend" checked={actionType === 'extend'} onChange={() => setActionType('extend')} />
            Extend Task (Set new deadline)
          </label>
          {actionType === 'extend' && (
            <div style={{ marginLeft: 24 }}>
              <input type="datetime-local" className="form-input" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="actionType" value="cancel" checked={actionType === 'cancel'} onChange={() => setActionType('cancel')} />
            Cancel Task
          </label>
        </div>

        {actionType !== 'cancel' && (
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Additional Instructions (Optional)</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Please make sure to check the pressure gauge this time..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              style={{ minHeight: 60 }}
            />
          </div>
        )}

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Back</button>
          <button className="btn btn-primary" onClick={() => onConfirm(actionType, actionType === 'extend' ? new Date(newDeadline).toISOString() : null, instructions)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:       { label: 'Pending',       badgeClass: 'badge-pending',  rowClass: '' },
  accepted:      { label: 'Accepted',      badgeClass: 'badge-progress', rowClass: '' },
  flagged_issue: { label: 'Issue Flagged', badgeClass: 'badge-ooc',      rowClass: 'row-ooc' },
  completed:     { label: 'Completed',     badgeClass: 'badge-ok',       rowClass: '' },
  cancelled:     { label: 'Cancelled',     badgeClass: 'badge-manual',   rowClass: '' },
};

function getDeadlineInfo(deadlineStr, status) {
  if (!deadlineStr) return { label: '—', urgent: false, overdue: false };
  const now = new Date();
  const dl = new Date(deadlineStr);
  const diffMs = dl - now;
  const diffMins = diffMs / 60000;
  
  const isFinished = status === 'completed' || status === 'cancelled';
  const overdue = !isFinished && diffMs < 0;
  const urgent = !isFinished && !overdue && diffMins <= 60;
  
  return { label: formatDateTime(deadlineStr), urgent, overdue };
}

function DeadlinePill({ deadlineStr, status }) {
  const { label, urgent, overdue } = getDeadlineInfo(deadlineStr, status);
  let cls = 'badge badge-manual';
  if (overdue) cls = 'badge badge-ooc';
  else if (urgent) cls = 'badge badge-pending';
  return <span className={cls}>{overdue ? 'OVERDUE · ' : urgent ? 'DUE SOON · ' : ''}{label}</span>;
}

// Expandable issue row used in all table views
function TaskRow({ task, currentUser, onResolve, showAllocatedBy = true }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const isAllocator = task.allocated_by?.id === currentUser?.id || currentUser?.role === 'admin';

  return (
    <>
      <tr className={cfg.rowClass}>
        <td>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{task.title}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.description}
          </div>
        </td>
        {showAllocatedBy && (
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={12} style={{ color: 'var(--text-muted)' }} />
              <span>{task.allocated_by?.first_name} {task.allocated_by?.last_name}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{task.allocated_by?.username}</div>
          </td>
        )}
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={12} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ color: 'var(--text-primary)' }}>{task.allocated_to?.first_name} {task.allocated_to?.last_name}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{task.allocated_to?.username}</div>
        </td>
        <td><DeadlinePill deadlineStr={task.deadline} status={task.status} /></td>
        <td><span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span></td>
        <td style={{ textAlign: 'right' }}>
          {task.status === 'flagged_issue' && isAllocator && (
            <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(v => !v)} style={{ gap: 4 }}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Hide' : 'View Issue'}
            </button>
          )}
          {task.status === 'completed' && (
            <span style={{ color: 'var(--accent-green)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <CheckCircle2 size={14} /> Done
            </span>
          )}
        </td>
      </tr>
      {expanded && task.status === 'flagged_issue' && isAllocator && (
        <tr style={{ background: 'rgba(239,68,68,0.04)' }}>
          <td colSpan={showAllocatedBy ? 6 : 5} style={{ padding: '12px 16px' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: '12px 16px'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Issue Description
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{task.issue_description}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => onResolve(task)} style={{ flexShrink: 0 }}>
                <CheckCircle2 size={13} /> Resolve &amp; Reopen
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── ADMIN VIEW: Full analytics + all tasks ────────────────────────────────────

function AdminTasksView({ tasks, loading, refreshing, onRefresh, onAllocate, onResolve, currentUser }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewTab, setViewTab] = useState('all');

  const stats = {
    total:     tasks.length,
    pending:   tasks.filter(t => t.status === 'pending').length,
    accepted:  tasks.filter(t => t.status === 'accepted').length,
    flagged:   tasks.filter(t => t.status === 'flagged_issue').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  const tabs = [
    { key: 'all',      label: 'All Tasks',       count: tasks.length },
    { key: 'mine',     label: 'Allocated by Me', count: tasks.filter(t => t.allocated_by?.id === currentUser?.id).length },
    { key: 'assigned', label: 'Assigned to Me',  count: tasks.filter(t => t.allocated_to?.id === currentUser?.id).length },
  ];

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (viewTab === 'mine') list = list.filter(t => t.allocated_by?.id === currentUser?.id);
    if (viewTab === 'assigned') list = list.filter(t => t.allocated_to?.id === currentUser?.id);
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    return list;
  }, [tasks, viewTab, statusFilter, currentUser]);

  return (
    <>
      {/* Stats Cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card" style={{ '--stat-accent': 'var(--accent-blue)' }}>
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub"><ListTodo size={12} /> All tasks</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': '#f59e0b' }}>
          <div className="stat-label">In Progress</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pending + stats.accepted}</div>
          <div className="stat-sub"><Clock size={12} /> Pending + Accepted</div>
        </div>
        <div className={`stat-card${stats.flagged > 0 ? ' alert' : ''}`} style={{ '--stat-accent': 'var(--accent-red)' }}>
          <div className="stat-label">Flagged Issues</div>
          <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{stats.flagged}</div>
          <div className="stat-sub"><AlertTriangle size={12} /> Needs resolution</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': 'var(--accent-green)' }}>
          <div className="stat-label">Completed</div>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{stats.completed}</div>
          <div className="stat-sub"><CheckCircle2 size={12} /> Finished</div>
        </div>
      </div>

      <div className="card">
        {/* Toolbar */}
        <div className="section-header" style={{ marginBottom: 0, paddingBottom: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewTab(tab.key)}
                className="btn btn-sm"
                style={{
                  background: viewTab === tab.key ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                  color: viewTab === tab.key ? '#fff' : 'var(--text-secondary)',
                  border: viewTab === tab.key ? 'none' : '1px solid var(--border)',
                }}
              >
                {tab.label}
                <span style={{ marginLeft: 4, background: viewTab === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--bg-hover)', borderRadius: 10, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160, padding: '6px 12px' }}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="flagged_issue">Flagged Issue</option>
              <option value="completed">Completed</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={refreshing} title="Refresh">
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button className="btn btn-primary" onClick={onAllocate}>
              <Plus size={16} /> Allocate Task
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? <LoadingSpinner message="Loading tasks..." /> : filteredTasks.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <div className="empty-state-text">
              {statusFilter !== 'all' || viewTab !== 'all' ? 'No tasks match your current filters.' : 'No tasks yet. Click "Allocate Task" to create the first one.'}
            </div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Allocated By</th>
                  <th>Assigned To</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <TaskRow key={task.id} task={task} currentUser={currentUser} onResolve={onResolve} showAllocatedBy={true} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── SUPERVISOR / INSPECTOR VIEW: My tasks only + allocate ─────────────────────

function UserTasksView({ tasks, loading, refreshing, onRefresh, onAllocate, onResolve, currentUser }) {
  const [activeTab, setActiveTab] = useState('assigned');

  const assignedToMe = useMemo(() => tasks.filter(t => t.allocated_to?.id === currentUser?.id), [tasks, currentUser]);
  const allocatedByMe = useMemo(() => tasks.filter(t => t.allocated_by?.id === currentUser?.id), [tasks, currentUser]);

  const displayTasks = activeTab === 'assigned' ? assignedToMe : allocatedByMe;

  return (
    <div className="card">
      {/* Toolbar */}
      <div className="section-header" style={{ marginBottom: 0, paddingBottom: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setActiveTab('assigned')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'assigned' ? 'var(--accent-blue)' : 'var(--bg-elevated)',
              color: activeTab === 'assigned' ? '#fff' : 'var(--text-secondary)',
              border: activeTab === 'assigned' ? 'none' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <ClipboardList size={13} />
            Assigned to Me
            <span style={{ marginLeft: 2, background: activeTab === 'assigned' ? 'rgba(255,255,255,0.25)' : 'var(--bg-hover)', borderRadius: 10, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
              {assignedToMe.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'mine' ? 'var(--accent-blue)' : 'var(--bg-elevated)',
              color: activeTab === 'mine' ? '#fff' : 'var(--text-secondary)',
              border: activeTab === 'mine' ? 'none' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Send size={13} />
            Allocated by Me
            <span style={{ marginLeft: 2, background: activeTab === 'mine' ? 'rgba(255,255,255,0.25)' : 'var(--bg-hover)', borderRadius: 10, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
              {allocatedByMe.length}
            </span>
          </button>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={refreshing} title="Refresh">
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button className="btn btn-primary" onClick={onAllocate}>
            <Plus size={16} /> Allocate Task
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? <LoadingSpinner message="Loading tasks..." /> : displayTasks.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 24px' }}>
          <div className="empty-state-text">
            {activeTab === 'assigned'
              ? 'No tasks have been assigned to you yet.'
              : 'You have not allocated any tasks yet. Click "Allocate Task" to create one.'}
          </div>
        </div>
      ) : (
        <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Task</th>
                {activeTab === 'mine' && <th>Assigned To</th>}
                {activeTab === 'assigned' && <th>Assigned To</th>}
                <th>Deadline</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  currentUser={currentUser}
                  onResolve={onResolve}
                  showAllocatedBy={false}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [resolvingTask, setResolvingTask] = useState(null);

  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getTasks();
      setTasks(res.data?.results ?? res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleResolveIssue = async (actionType, newDeadline, instructions) => {
    if (!resolvingTask) return;
    try {
      await resolveIssue(resolvingTask.id, { 
        action: actionType, 
        new_deadline: newDeadline,
        instructions: instructions 
      });
      fetchTasks(true);
      setResolvingTask(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to resolve issue');
    }
  };

  if (user?.role === 'operator') {
    return (
      <div className="page-container" style={{ padding: '64px 24px', textAlign: 'center' }}>
        <Header title="Tasks" />
        <div style={{ background: 'var(--bg-elevated)', padding: 32, borderRadius: 12, border: '1px solid var(--border)', display: 'inline-block', marginTop: 40 }}>
          <ClipboardList size={48} style={{ color: 'var(--accent-blue)', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>Task View Available on Mobile App</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>
            As an operator, you can view and complete your assigned tasks directly from the mobile app while you are out on the floor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title="Tasks Management" subtitle="Allocate and track operational tasks" />
      
      <div className="page-content" style={{ padding: '24px' }}>
        {user?.role === 'admin' ? (
          <AdminTasksView
            tasks={tasks}
            loading={loading}
            refreshing={refreshing}
            onRefresh={() => fetchTasks(true)}
            onAllocate={() => setShowModal(true)}
            onResolve={task => setResolvingTask(task)}
            currentUser={user}
          />
        ) : (
          <UserTasksView
            tasks={tasks}
            loading={loading}
            refreshing={refreshing}
            onRefresh={() => fetchTasks(true)}
            onAllocate={() => setShowModal(true)}
            onResolve={task => setResolvingTask(task)}
            currentUser={user}
          />
        )}
      </div>

      {showModal && (
        <TaskModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onTaskCreated={() => { fetchTasks(true); setShowModal(false); }}
        />
      )}
      
      {resolvingTask && (
        <ResolveModal 
          task={resolvingTask} 
          onClose={() => setResolvingTask(null)}
          onConfirm={handleResolveIssue}
        />
      )}
    </div>
  );
}
