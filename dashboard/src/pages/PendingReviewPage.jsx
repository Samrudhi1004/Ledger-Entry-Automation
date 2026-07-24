import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { getPendingSessions, reviewSession } from '../api/inspections';
import { formatDateTime, shortId } from '../utils/formatters';

export default function PendingReviewPage({ onPendingCountChange }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [remark, setRemark]     = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPending = async () => {
    try {
      const res = await getPendingSessions();
      const data = res.data?.results ?? res.data ?? [];
      const pendingList = Array.isArray(data) ? data : [];
      setSessions(pendingList);
      if (onPendingCountChange) {
        onPendingCountChange(pendingList.length);
      }
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleOpenReview = (session) => {
    setSelectedSession(session);
    setRemark('');
  };

  const handleReview = async (action) => {
    if (!selectedSession) return;
    if (action === 'reject' && !remark.trim()) {
      alert('Please enter a Supervisor Remark explaining why this trial is rejected and what machine offset needs adjustment.');
      return;
    }
    setActionLoading(true);
    try {
      await reviewSession(selectedSession.session_id, action, remark);
      setSelectedSession(null);
      fetchPending();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit review.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Header title="Pending Reviews" subtitle="Approve or reject completed piece-wise inspection sheets" />

      <div className="page-content bg-gradient-animated">
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">
              <span className="dot" style={{ background: 'var(--accent-yellow)' }} />
              Awaiting Action ({sessions.length})
            </h2>
            <button id="refresh-pending" className="btn btn-ghost btn-sm" onClick={fetchPending}>
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading pending sessions..." />
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-text">No pending reviews. Everything is cleared!</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Trial Tag</th>
                    <th>Session ID</th>
                    <th>Part Number</th>
                    <th>Machine</th>
                    <th>Operator</th>
                    <th>Shift</th>
                    <th>Status</th>
                    <th>Has OOC</th>
                    <th>Completed At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.session_id}
                      className={s.has_ooc ? 'row-ooc clickable-row' : 'clickable-row'}
                      onClick={() => navigate(`/inspections/${s.session_id}`)}
                    >
                      <td>
                        <span className={`badge ${s.trial_number === 1 ? 'badge-primary' : s.trial_number === 2 ? 'badge-warning' : 'badge-danger'}`}>
                          1ST PC #{s.trial_number ?? 1}
                        </span>
                      </td>
                      <td className="font-mono">{shortId(s.session_id)}</td>
                      <td>{s.part?.part_number ?? s.part_number}</td>
                      <td className="font-mono">{s.machine?.machine_code ?? s.machine_code}</td>
                      <td>{s.operator?.username ?? '—'}</td>
                      <td>{s.shift}</td>
                      <td>
                        <Badge type="pending" />
                      </td>
                      <td>
                        {s.has_ooc ? <Badge type="ooc" /> : <Badge type="ok" />}
                      </td>
                      <td>{formatDateTime(s.completed_at || s.started_at)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          id={`review-btn-${s.session_id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenReview(s)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedSession && (
        <Modal
          title={`Review Session — 1ST PC #${selectedSession.trial_number ?? 1} (${shortId(selectedSession.session_id)})`}
          onClose={() => setSelectedSession(null)}
          footer={
            <>
              <button
                id="review-reject-btn"
                className="btn btn-danger"
                onClick={() => handleReview('reject')}
                disabled={actionLoading}
              >
                Reject & Request 1ST PC #{Math.min((selectedSession.trial_number || 1) + 1, 3)}
              </button>
              <button
                id="review-approve-btn"
                className="btn btn-success"
                onClick={() => handleReview('approve')}
                disabled={actionLoading}
              >
                Approve & Save
              </button>
            </>
          }
        >
          <div className="info-row mb-16">
            <div className="info-item">
              <span className="info-label">Trial Phase</span>
              <span className="info-value text-blue font-bold">1ST PC #{selectedSession.trial_number ?? 1}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Part</span>
              <span className="info-value">{selectedSession.part?.part_number ?? selectedSession.part_number}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Machine</span>
              <span className="info-value font-mono">{selectedSession.machine?.machine_code ?? selectedSession.machine_code}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Operator</span>
              <span className="info-value">{selectedSession.operator?.username ?? selectedSession.operator_name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">OOC Issues</span>
              <span className="info-value">
                {selectedSession.has_ooc ? (
                  <span className="text-red font-bold">Yes (OOC)</span>
                ) : (
                  <span className="text-green">No (OK)</span>
                )}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="review-remark">Supervisor Rejection / Approval Remarks</label>
            <textarea
              id="review-remark"
              className="form-textarea"
              placeholder="e.g. 'TL-01 is out of spec by +0.3mm. Adjust Z-axis offset and perform 1ST PC #2 trial.'"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
            <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              ⚠️ Rejecting will trigger a real-time WebSocket alert on the Operator&apos;s phone to unlock 1ST PC #{Math.min((selectedSession.trial_number || 1) + 1, 3)}.
            </small>
          </div>
        </Modal>
      )}
    </>
  );
}
