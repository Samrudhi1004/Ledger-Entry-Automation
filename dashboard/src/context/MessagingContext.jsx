import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api, { BASE_URL, WS_BASE_URL } from '../api/axios';

const MessagingContext = createContext();

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within MessagingProvider');
  }
  return context;
};

export const MessagingProvider = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({}); // Track online status: { userId: true/false }
  const wsRef = useRef(null);
  const userNotificationWsRef = useRef(null);
  const presenceWsRef = useRef(null); // Presence tracking WebSocket
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const API_BASE = `/api`;
  const WS_BASE = WS_BASE_URL;

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const response = await api.get(`${API_BASE}/messaging/conversations/`);
      // Backend returns paginated response: { count, results: [...] }
      const data = response.data;
      setConversations(Array.isArray(data) ? data : (data.results || []));
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  }, [user, API_BASE]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId, offset = 0, limit = 50) => {
    if (!user) return;

    try {
      const response = await api.get(
        `${API_BASE}/messaging/conversations/${conversationId}/messages/?offset=${offset}&limit=${limit}`
      );

      if (offset === 0) {
        setMessages(response.data.results.reverse());
      } else {
        setMessages(prev => [...response.data.results.reverse(), ...prev]);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      return null;
    }
  }, [user, API_BASE]);

  // Connect to WebSocket
  const connectWebSocket = useCallback((conversationId) => {
    const token = localStorage.getItem('access_token');
    if (!token || !conversationId) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${WS_BASE}/ws/messaging/${conversationId}/?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'connection_established':
          console.log('Connection established:', data.message);
          break;

        case 'message_sent':
          // Confirmation that message was sent successfully with message ID
          console.log('Message sent confirmation:', data.data);

          // Add the message to state (only the sender gets this event)
          setMessages(prev => [...prev, data.data]);

          // Update conversation list
          setConversations(prev => {
            const updated = prev.map(conv =>
              conv.id === conversationId
                ? { ...conv, last_message: data.data, updated_at: new Date().toISOString() }
                : conv
            );
            return updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
          });

          // Handle file upload if pending
          if (window.pendingFileUpload) {
            const { file } = window.pendingFileUpload;
            if (data.data.id) {
              // Upload the file now that we have the message ID
              uploadFile(file, data.data.id).then((attachmentData) => {
                console.log('File uploaded successfully:', attachmentData);

                // Update the message with the attachment data
                if (attachmentData) {
                  setMessages(prev => prev.map(msg =>
                    msg.id === data.data.id
                      ? { ...msg, attachments: [...(msg.attachments || []), attachmentData] }
                      : msg
                  ));
                }

                window.pendingFileUpload = null;
              }).catch(error => {
                console.error('Failed to upload file:', error);
                window.pendingFileUpload = null;
              });
            }
          }
          break;

        case 'new_message':
          // Broadcast message from another user (don't add if it's our own message)
          if (data.data.sender.id !== user?.id) {
            setMessages(prev => [...prev, data.data]);

            // Update conversation list (move to top and update last message)
            setConversations(prev => {
              const updated = prev.map(conv =>
                conv.id === conversationId
                  ? { ...conv, last_message: data.data, updated_at: new Date().toISOString() }
                  : conv
              );
              return updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            });
          }
          break;

        case 'message_read':
          // Update read status
          setMessages(prev =>
            prev.map(msg =>
              msg.id === data.data.message_id
                ? { ...msg, read_by: [...(msg.read_by || []), data.data.read_by] }
                : msg
            )
          );
          break;

        case 'user_typing':
          // Show typing indicator
          const { user: typingUser, is_typing } = data.data;
          setTypingUsers(prev => ({
            ...prev,
            [typingUser.id]: is_typing ? typingUser : null
          }));

          // Clear typing indicator after 3 seconds
          if (is_typing) {
            setTimeout(() => {
              setTypingUsers(prev => ({ ...prev, [typingUser.id]: null }));
            }, 3000);
          }
          break;

        case 'message_reaction':
          // Update message reactions in real-time
          setMessages(prev =>
            prev.map(msg =>
              msg.id === data.data.message_id
                ? { ...msg, reactions: data.data.reactions }
                : msg
            )
          );
          break;

        case 'error':
          console.error('WebSocket error:', data.message);
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed, attempting to reconnect...');

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (activeConversation?.id === conversationId) {
          connectWebSocket(conversationId);
        }
      }, 3000);
    };

    wsRef.current = ws;
  }, [WS_BASE]);

  // Send message via WebSocket
  const sendMessage = useCallback((content, messageType = 'text', replyTo = null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    wsRef.current.send(JSON.stringify({
      action: 'send_message',
      data: {
        content,
        message_type: messageType,
        reply_to: replyTo
      }
    }));
  }, []);

  // Mark message as read
  const markAsRead = useCallback((messageId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      action: 'mark_read',
      data: {
        message_id: messageId
      }
    }));
  }, []);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    // Debounce typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    wsRef.current.send(JSON.stringify({
      action: 'typing',
      data: {
        is_typing: isTyping
      }
    }));

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        wsRef.current.send(JSON.stringify({
          action: 'typing',
          data: { is_typing: false }
        }));
      }, 3000);
    }
  }, []);

  // Create new conversation
  const createConversation = useCallback(async (type, participantIds, name = '', description = '') => {
    if (!user) return;

    try {
      const response = await api.post(
        `${API_BASE}/messaging/conversations/`,
        {
          type,
          participant_ids: participantIds,
          name,
          description
        }
      );

      setConversations(prev => [response.data, ...prev]);
      return response.data;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }, [user, API_BASE]);

  // Search users
  const searchUsers = useCallback(async (query) => {
    if (!user) return [];

    try {
      const response = await api.get(
        `${API_BASE}/messaging/users/search/?q=${encodeURIComponent(query)}`
      );
      // Backend returns paginated response: { count, results: [...] }
      const data = response.data;
      return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
      console.error('Failed to search users:', error);
      return [];
    }
  }, [user, API_BASE]);

  // Upload file
  const uploadFile = useCallback(async (file, messageId) => {
    if (!user) return null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('message_id', messageId);

    try {
      const response = await api.post(
        `${API_BASE}/messaging/upload/`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to upload file:', error);
      return null;
    }
  }, [user, API_BASE]);

  // Select conversation and connect WebSocket
  const selectConversation = useCallback((conversation) => {
    setActiveConversation(conversation);
    setMessages([]);

    if (conversation) {
      fetchMessages(conversation.id);
      connectWebSocket(conversation.id);
    }
  }, [fetchMessages, connectWebSocket]);

  // Update message reactions (for optimistic updates)
  const updateMessageReactions = useCallback((messageId, reactions) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, reactions }
          : msg
      )
    );
  }, []);

  // Pin / unpin a message in the active conversation (max 3)
  const pinMessage = useCallback(async (conversationId, messageId) => {
    try {
      const response = await api.post(
        `${API_BASE}/messaging/conversations/${conversationId}/pin-message/`,
        { message_id: messageId }
      );
      const { pinned_messages } = response.data;
      // Update the conversation in state with the new pinned list
      setActiveConversation(prev =>
        prev && prev.id === conversationId
          ? { ...prev, pinned_messages }
          : prev
      );
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, pinned_messages }
            : conv
        )
      );
      return response.data;
    } catch (error) {
      console.error('Failed to pin message:', error);
      // Surface error message to caller
      const msg = error?.response?.data?.error || 'Failed to pin message';
      throw new Error(msg);
    }
  }, [API_BASE]);

  // Connect to user notification WebSocket for real-time updates across all conversations
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    const wsUrl = `${WS_BASE}/ws/messaging/notifications/?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('User notification WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'connection_established':
          console.log('User notifications:', data.message);
          break;

        case 'new_message_notification':
          // Update conversation list with new message
          const { conversation_id, message } = data.data;
          console.log('Received new_message_notification:', { conversation_id, message });

          setConversations(prev => {
            const updated = prev.map(conv =>
              conv.id === conversation_id
                ? {
                    ...conv,
                    last_message: {
                      id: message.id,
                      sender: message.sender,
                      content: message.content,
                      message_type: message.message_type,
                      created_at: message.created_at
                    },
                    updated_at: message.created_at,
                    unread_count: conv.id !== activeConversation?.id
                      ? (conv.unread_count || 0) + 1
                      : conv.unread_count
                  }
                : conv
            );
            const sorted = updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            console.log('Conversations after update and sort:', sorted.map(c => ({ id: c.id, updated_at: c.updated_at })));
            return sorted;
          });

          // If the message is for the active conversation, add it to messages
          if (activeConversation?.id === conversation_id) {
            setMessages(prev => {
              // Check if message already exists (avoid duplicates)
              if (prev.some(m => m.id === message.id)) {
                return prev;
              }
              return [...prev, message];
            });
          }
          break;

        case 'pong':
          // Keep-alive response
          break;

        default:
          console.log('Unknown notification type:', data.type);
      }
    };

    ws.onerror = (error) => {
      console.error('User notification WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('User notification WebSocket closed, attempting to reconnect...');
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (user) {
          // Component will reconnect via this effect
        }
      }, 5000);
    };

    // Keep connection alive with ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);

    userNotificationWsRef.current = ws;

    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user, WS_BASE, activeConversation]);

  // Connect to presence WebSocket for real-time online/offline status
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    const wsUrl = `${WS_BASE}/ws/presence/?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Presence WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'connection_established':
          console.log('Presence tracking:', data.message);
          break;

        case 'initial_presence':
          // Set initial online users when connecting
          const { online_users } = data.data;
          console.log('Initial online users:', online_users);
          const initialOnlineUsers = {};
          online_users.forEach(userId => {
            initialOnlineUsers[userId] = true;
          });
          setOnlineUsers(initialOnlineUsers);
          console.log('Set initial onlineUsers:', initialOnlineUsers);
          break;

        case 'user_status_changed':
          // Update online status for the user
          const { user_id, status } = data.data;
          console.log('User status changed:', { user_id, status });
          setOnlineUsers(prev => {
            const updated = {
              ...prev,
              [user_id]: status === 'online'
            };
            console.log('Updated onlineUsers:', updated);
            return updated;
          });
          break;

        case 'pong':
          // Keep-alive response
          break;

        default:
          console.log('Unknown presence message type:', data.type);
      }
    };

    ws.onerror = (error) => {
      console.error('Presence WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Presence WebSocket closed, attempting to reconnect...');
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (user) {
          // Component will reconnect via this effect
        }
      }, 5000);
    };

    // Keep connection alive with ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);

    presenceWsRef.current = ws;

    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user, WS_BASE]);

  // Load initial conversations
  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (userNotificationWsRef.current) {
        userNotificationWsRef.current.close();
      }
      if (presenceWsRef.current) {
        presenceWsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const value = {
    conversations,
    activeConversation,
    messages,
    loading,
    typingUsers,
    onlineUsers,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markAsRead,
    sendTypingIndicator,
    createConversation,
    searchUsers,
    uploadFile,
    selectConversation,
    setActiveConversation,
    updateMessageReactions,
    pinMessage,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
  // Updated: 2026-09-08
};
