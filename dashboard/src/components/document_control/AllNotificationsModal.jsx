import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Search,
  X,
  FileText,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
} from '../../api/documentControl';

// Clean legacy em dashes or en dashes from titles/messages
const sanitizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
};

export default function AllNotificationsModal({ isOpen, onClose, onNotificationUpdated }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'read'
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const modalRef = useRef(null);
  const navigate = useNavigate();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getNotifications({ all: 'true' });
      setNotifications(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Failed to load all notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAll();
      setSearchQuery('');
      setActiveTab('all');
    }
  }, [isOpen]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const counts = useMemo(() => {
    const unread = notifications.filter((n) => !n.is_read).length;
    const read = notifications.filter((n) => n.is_read).length;
    return {
      all: notifications.length,
      unread,
      read,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Tab filter
      if (activeTab === 'unread' && item.is_read) return false;
      if (activeTab === 'read' && !item.is_read) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(query);
        const messageMatch = (item.message || '').toLowerCase().includes(query);
        const docMatch = (item.document_title || '').toLowerCase().includes(query);
        const dcrMatch = (item.dcr_number || '').toLowerCase().includes(query);
        return titleMatch || messageMatch || docMatch || dcrMatch;
      }
      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  const handleItemClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        if (onNotificationUpdated) onNotificationUpdated();
      }
    } catch (e) {
      console.error('Failed to mark read', e);
    }
    onClose();

    if (notif.action_url) {
      navigate(notif.action_url);
    } else if (notif.action_type && notif.action_type.startsWith('DOC_')) {
      navigate('/document-control/documents');
    } else {
      navigate('/document-control/dcr?tab=action_required');
    }
  };

  const handleToggleRead = async (e, notif) => {
    e.stopPropagation();
    setActionLoadingId(notif.id);
    try {
      if (notif.is_read) {
        await markNotificationUnread(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: false } : n))
        );
      } else {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      }
      if (onNotificationUpdated) onNotificationUpdated();
    } catch (err) {
      console.error('Failed to toggle notification status', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onNotificationUpdated) onNotificationUpdated();
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    const diffMs = new Date() - new Date(isoString);
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatExactDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#ede9fe',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '17px',
                    fontWeight: '700',
                    color: '#0f172a',
                  }}
                >
                  All Notifications
                </h3>
                {counts.unread > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}
                  >
                    {counts.unread} unread
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                Workflow approvals, specifications, and change request alerts
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchAll}
              disabled={loading}
              title="Refresh notifications"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            {counts.unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: '#e0e7ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: '#4338ca',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search and Filter Tabs */}
        <div
          style={{
            padding: '12px 22px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Search box */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 240px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                fontSize: '13px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                color: '#0f172a',
                backgroundColor: '#f8fafc',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: '#f1f5f9',
              padding: '3px',
              borderRadius: '8px',
            }}
          >
            <button
              onClick={() => setActiveTab('all')}
              style={{
                border: 'none',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                backgroundColor: activeTab === 'all' ? '#ffffff' : 'transparent',
                color: activeTab === 'all' ? '#0f172a' : '#64748b',
                boxShadow:
                  activeTab === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              All
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'all' ? '#e2e8f0' : '#cbd5e1',
                  color: '#334155',
                }}
              >
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('unread')}
              style={{
                border: 'none',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                backgroundColor: activeTab === 'unread' ? '#ffffff' : 'transparent',
                color: activeTab === 'unread' ? '#0f172a' : '#64748b',
                boxShadow:
                  activeTab === 'unread' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Unread
              {counts.unread > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                  }}
                >
                  {counts.unread}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('read')}
              style={{
                border: 'none',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                backgroundColor: activeTab === 'read' ? '#ffffff' : 'transparent',
                color: activeTab === 'read' ? '#0f172a' : '#64748b',
                boxShadow:
                  activeTab === 'read' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Read
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'read' ? '#e2e8f0' : '#cbd5e1',
                  color: '#334155',
                }}
              >
                {counts.read}
              </span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 22px',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {loading ? (
            <div
              style={{
                padding: '48px 20px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              <RotateCw
                size={22}
                className="animate-spin"
                style={{ margin: '0 auto 10px', color: '#6366f1' }}
              />
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div
              style={{
                padding: '48px 20px',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <Bell
                size={36}
                style={{ color: '#cbd5e1', margin: '0 auto 10px', display: 'block' }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#334155',
                }}
              >
                {searchQuery ? 'No matching notifications found' : 'No notifications'}
              </p>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: '#94a3b8',
                }}
              >
                {searchQuery
                  ? 'Try searching with different keywords or clearing your filters.'
                  : 'You will receive alerts here when actions or documents are assigned to you.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const cleanTitle = sanitizeText(notif.title);
              const cleanMessage = sanitizeText(notif.message);
              const cleanDoc = sanitizeText(notif.document_title);

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: notif.is_read
                      ? '1px solid #e2e8f0'
                      : '1px solid #c7d2fe',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: notif.is_read
                      ? '0 1px 2px rgba(0,0,0,0.03)'
                      : '0 2px 6px rgba(99, 102, 241, 0.08)',
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#818cf8';
                    e.currentTarget.style.boxShadow =
                      '0 4px 12px rgba(15, 23, 42, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = notif.is_read
                      ? '#e2e8f0'
                      : '#c7d2fe';
                    e.currentTarget.style.boxShadow = notif.is_read
                      ? '0 1px 2px rgba(0,0,0,0.03)'
                      : '0 2px 6px rgba(99, 102, 241, 0.08)';
                  }}
                >
                  {/* Left Icon */}
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: notif.is_read ? '#f1f5f9' : '#e0e7ff',
                      color: notif.is_read ? '#64748b' : '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <FileText size={18} />
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {!notif.is_read && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: '#6366f1',
                              display: 'inline-block',
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: notif.is_read ? '600' : '700',
                            color: '#0f172a',
                          }}
                        >
                          {cleanTitle}
                        </span>
                      </div>

                      <span
                        title={formatExactDate(notif.created_at)}
                        style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: '5px 0 0 0',
                        fontSize: '12px',
                        color: '#475569',
                        lineHeight: '1.45',
                      }}
                    >
                      {cleanMessage}
                    </p>

                    {/* Metadata tags and action row */}
                    <div
                      style={{
                        marginTop: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {cleanDoc && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: '#ede9fe',
                              color: '#6366f1',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            Doc: {cleanDoc}
                          </span>
                        )}

                        {notif.dcr_number && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            DCR #{notif.dcr_number}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {/* Toggle Read/Unread Button */}
                        <button
                          onClick={(e) => handleToggleRead(e, notif)}
                          disabled={actionLoadingId === notif.id}
                          title={notif.is_read ? 'Mark as unread' : 'Mark as read'}
                          style={{
                            background: 'none',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <Check size={12} />
                          {notif.is_read ? 'Mark unread' : 'Mark read'}
                        </button>

                        {/* Open Action Link */}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#4f46e5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          Open <ExternalLink size={11} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Showing {filteredNotifications.length} of {notifications.length} notifications
          </span>

          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
