import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Clock, ExternalLink, X, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/documentControl';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Poll unread count every 30 seconds
  const fetchCount = async () => {
    try {
      const res = await getUnreadNotificationCount();
      setUnreadCount(res.data?.unread_count || 0);
    } catch (e) {
      // Ignore polling network failures
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = async () => {
    if (!isOpen) {
      setLoading(true);
      setIsOpen(true);
      try {
        const res = await getNotifications();
        setNotifications(res.data?.results || res.data || []);
      } catch (e) {
        console.error("Failed to fetch notifications", e);
      } finally {
        setLoading(false);
      }
    } else {
      setIsOpen(false);
    }
  };

  const handleItemClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      }
    } catch (e) {
      console.error("Failed to mark notification read", e);
    }
    setIsOpen(false);
    navigate('/document-control/dcr');
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error("Failed to mark all read", e);
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
    return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef} onClick={e => e.stopPropagation()}>
      {/* Bell Trigger Button */}
      <button
        onClick={handleToggle}
        title="DCR Notifications"
        style={{
          position: 'relative',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          backgroundColor: isOpen ? '#eff6ff' : '#ffffff',
          color: isOpen ? '#4f46e5' : '#64748b',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
        onMouseEnter={e => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.color = '#334155';
          }
        }}
        onMouseLeave={e => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.color = '#64748b';
          }
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-3px',
            right: '-3px',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            borderRadius: '50%',
            minWidth: '18px',
            height: '18px',
            fontSize: '10px',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid #ffffff',
            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '380px',
          maxHeight: '460px',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08)',
          border: '1px solid #e2e8f0',
          zIndex: 1500,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                DCR Notifications
              </span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11px',
                  color: '#4f46e5',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Loading updates...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <Bell size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>No notifications yet</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>You will be alerted when a DCR is assigned to you.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: n.is_read ? '#ffffff' : '#f5f3ff',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = n.is_read ? '#f8fafc' : '#ede9fe'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = n.is_read ? '#ffffff' : '#f5f3ff'}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: n.is_read ? '#e2e8f0' : '#6366f1',
                    color: n.is_read ? '#64748b' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}>
                    <FileText size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '6px' }}>
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
                      {n.message}
                    </p>
                    {n.document_title && (
                      <span style={{
                        display: 'inline-block',
                        marginTop: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#6366f1',
                      }}>
                        Doc: {n.document_title}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
          }}>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/document-control/dcr');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#4f46e5',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              View All Change Requests &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
