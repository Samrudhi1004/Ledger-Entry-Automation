import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const MessageNotificationContext = createContext({
  msgNotifications: [],
  unreadMessageCount: 0,
  pushMessageNotification: () => { },
  markMessageNotificationRead: () => { },
  markAllMessageNotificationsRead: () => { },
  clearMessageNotifications: () => { },
});

export const MessageNotificationProvider = ({ children }) => {
  const [msgNotifications, setMsgNotifications] = useState([]);

  const pushMessageNotification = useCallback((notification) => {
    if (!notification) return;
    setMsgNotifications((prev) => {
      // Remove any existing notification with the same ID to prevent duplicates
      const filtered = prev.filter((n) => n.id !== notification.id);
      // Prepend newest notification and keep up to 50
      return [notification, ...filtered].slice(0, 50);
    });
  }, []);

  const markMessageNotificationRead = useCallback((id) => {
    setMsgNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllMessageNotificationsRead = useCallback(() => {
    setMsgNotifications((prev) =>
      prev.map((n) => (n.is_read ? n : { ...n, is_read: true }))
    );
  }, []);

  const clearMessageNotifications = useCallback(() => {
    setMsgNotifications([]);
  }, []);

  const unreadMessageCount = useMemo(() => {
    return msgNotifications.filter((n) => !n.is_read).length;
  }, [msgNotifications]);

  const value = useMemo(
    () => ({
      msgNotifications,
      unreadMessageCount,
      pushMessageNotification,
      markMessageNotificationRead,
      markAllMessageNotificationsRead,
      clearMessageNotifications,
    }),
    [
      msgNotifications,
      unreadMessageCount,
      pushMessageNotification,
      markMessageNotificationRead,
      markAllMessageNotificationsRead,
      clearMessageNotifications,
    ]
  );

  return (
    <MessageNotificationContext.Provider value={value}>
      {children}
    </MessageNotificationContext.Provider>
  );
};

export const useMessageNotifications = () => {
  const context = useContext(MessageNotificationContext);
  if (!context) {
    throw new Error('useMessageNotifications must be used within a MessageNotificationProvider');
  }
  return context;
};

export default MessageNotificationContext;
