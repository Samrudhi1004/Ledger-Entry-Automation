import { createContext, useContext, useState, useCallback } from 'react';

/**
 * MessageNotificationContext
 *
 * A thin global bridge between the Messaging WebSocket (inside MessagesPage's
 * MessagingProvider) and the NotificationBell (in Header, outside that provider).
 *
 * Shape of each notification:
 *   { id, conversation_id, sender_name, preview, created_at, is_read }
 */

const MessageNotificationContext = createContext(null);

export function MessageNotificationProvider({ children }) {
  const [msgNotifications, setMsgNotifications] = useState([]);

  /** Called by MessagingContext when a new_message_notification WS event arrives */
  const pushMessageNotification = useCallback((notification) => {
    setMsgNotifications((prev) => {
      // Avoid duplicate if same message arrives twice
      if (prev.some((n) => n.id === notification.id)) return prev;
      return [notification, ...prev].slice(0, 50); // keep last 50
    });
  }, []);

  /** Called when user clicks a message notification in the bell */
  const markMessageNotificationRead = useCallback((notifId) => {
    setMsgNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
  }, []);

  /** Mark all message notifications read (e.g. when user opens /messages) */
  const markAllMessageNotificationsRead = useCallback(() => {
    setMsgNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, []);

  const unreadMessageCount = msgNotifications.filter((n) => !n.is_read).length;

  return (
    <MessageNotificationContext.Provider
      value={{
        msgNotifications,
        unreadMessageCount,
        pushMessageNotification,
        markMessageNotificationRead,
        markAllMessageNotificationsRead,
      }}
    >
      {children}
    </MessageNotificationContext.Provider>
  );
}

export function useMessageNotifications() {
  const ctx = useContext(MessageNotificationContext);
  if (!ctx) throw new Error('useMessageNotifications must be used within MessageNotificationProvider');
  return ctx;
}
