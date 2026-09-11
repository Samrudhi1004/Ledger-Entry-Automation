import { useMessaging } from '../../context/MessagingContext';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Video, Download, X, Reply, Forward, Pin, Smile } from 'lucide-react';
import MessageInput from './MessageInput';
import './ChatWindow.css';

export default function ChatWindow() {
  const { activeConversation, messages, typingUsers, onlineUsers, markAsRead, conversations, fetchConversations, updateMessageReactions, pinMessage } = useMessaging();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxImageName, setLightboxImageName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [emojiPicker, setEmojiPicker] = useState(null);
  const [forwardModal, setForwardModal] = useState(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [activePinIndex, setActivePinIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [reactionModal, setReactionModal] = useState(null); // { message, reactions }
  const messageRefs = useRef({});
  const previousMessageCountRef = useRef(0);

  // Convert URLs in text to clickable links
  const linkify = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="message-link"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Check if user is near the bottom of the scroll container
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const threshold = 100; // pixels from bottom
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    return position < threshold;
  };

  // Handle scroll events to detect if user is manually scrolling
  const handleScroll = () => {
    if (isNearBottom()) {
      setUserIsScrolling(false);
    } else {
      setUserIsScrolling(true);
    }
  };

  // Smart auto-scroll: only scroll to bottom if user is already at bottom or it's a new message from them
  useEffect(() => {
    const newMessageCount = messages.length;
    const hasNewMessages = newMessageCount > previousMessageCountRef.current;

    if (hasNewMessages) {
      const lastMessage = messages[messages.length - 1];
      const isOwnMessage = lastMessage?.sender?.id === user?.id;

      // Auto-scroll if:
      // 1. User sent the message, OR
      // 2. User is already near the bottom (not scrolling through history)
      if (isOwnMessage || (!userIsScrolling && isNearBottom())) {
        scrollToBottom();
      }
    }

    previousMessageCountRef.current = newMessageCount;
  }, [messages, user?.id, userIsScrolling]);

  // Scroll to bottom when switching conversations or when messages first load
  useEffect(() => {
    if (activeConversation && messages.length > 0) {
      setUserIsScrolling(false);
      previousMessageCountRef.current = messages.length;
      // Use setTimeout to ensure DOM has updated before scrolling
      setTimeout(() => {
        scrollToBottom('auto');
      }, 50);
    }
  }, [activeConversation?.id]);

  // Reset scroll state when conversation changes
  useEffect(() => {
    if (activeConversation) {
      setUserIsScrolling(false);
      previousMessageCountRef.current = 0;
      // Sync pinned messages from conversation object
      setPinnedMessages(activeConversation.pinned_messages || []);
      setActivePinIndex(0);
    }
  }, [activeConversation?.id]);

  // Keep local pinnedMessages in sync when context updates pinned_messages (after pin/unpin)
  useEffect(() => {
    setPinnedMessages(activeConversation?.pinned_messages || []);
  }, [activeConversation?.pinned_messages]);

  // Mark messages as read when they come into view
  useEffect(() => {
    if (messages.length > 0 && activeConversation) {
      const unreadMessages = messages.filter(
        msg => msg.sender.id !== user.id && !msg.read_by?.some(r => r?.user?.id === user.id)
      );

      unreadMessages.forEach(msg => {
        markAsRead(msg.id);
      });
    }
  }, [messages, activeConversation, user.id, markAsRead]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        closeContextMenu();
      }
      if (emojiPicker) {
        closeEmojiPicker();
      }
    };

    if (contextMenu || emojiPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu, emojiPicker]);

  if (!activeConversation) {
    return (
      <div className="chat-window">
        <div className="no-conversation">
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the list to start messaging</p>
        </div>
      </div>
    );
  }

  const getConversationName = () => {
    if (activeConversation.type === 'group') {
      return activeConversation.name || 'Unnamed Group';
    }

    const otherParticipant = activeConversation.participants.find(p => p.id !== user.id);
    return otherParticipant
      ? `${otherParticipant.first_name} ${otherParticipant.last_name}`.trim() || otherParticipant.email
      : 'Unknown User';
  };

  const isUserOnline = () => {
    if (activeConversation.type === 'direct') {
      const otherParticipant = activeConversation.participants.find(p => p.id !== user.id);
      if (otherParticipant) {
        console.log('Checking online status for user:', otherParticipant.id, 'onlineUsers:', onlineUsers);
        return onlineUsers[otherParticipant.id];
      }
    }
    // For group chats, don't show online indicator in header
    return false;
  };

  const getOnlineStatus = () => {
    // For direct messages, show the other user's online status
    if (activeConversation.type === 'direct') {
      return isUserOnline() ? 'Active now' : 'Offline';
    }
    // For group chats, show participant count without indicator
    return `${activeConversation.participants.length} participants`;
  };

  const shouldShowStatusIndicator = () => {
    // Only show indicator for direct messages
    return activeConversation.type === 'direct';
  };

  const formatMessageTime = (timestamp) => {
    try {
      return format(new Date(timestamp), 'HH:mm');
    } catch {
      return '';
    }
  };

  const groupedMessages = messages.reduce((groups, message) => {
    const lastGroup = groups[groups.length - 1];

    // Check if message should be grouped with previous one
    if (
      lastGroup &&
      lastGroup.sender.id === message.sender.id &&
      new Date(message.created_at) - new Date(lastGroup.messages[lastGroup.messages.length - 1].created_at) < 60000
    ) {
      lastGroup.messages.push(message);
    } else {
      groups.push({
        sender: message.sender,
        messages: [message]
      });
    }

    return groups;
  }, []);

  const typingUsersList = Object.values(typingUsers).filter(Boolean);

  const handleStartMeeting = () => {
    window.open('https://meet.google.com/new', '_blank');
  };

  const handleImageClick = (imageUrl, imageName) => {
    setLightboxImage(imageUrl);
    setLightboxImageName(imageName || 'image');
  };

  const closeLightbox = () => {
    setLightboxImage(null);
    setLightboxImageName('');
  };

  const handleDownloadImage = async () => {
    if (!lightboxImage) return;

    try {
      const response = await fetch(lightboxImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = lightboxImageName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const handleFileClick = async (attachment) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/api/messaging/attachments/${attachment.id}/download/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // For PDFs, open in a new tab to view
      if (attachment.file_type === 'application/pdf') {
        window.open(url, '_blank');
      } else {
        // For other files, download directly
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Clean up blob URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Failed to load file:', error);
      alert('Failed to load file. Please try again.');
    }
  };

  const handleMessageContextMenu = (e, message) => {
    e.preventDefault();

    const menuHeight = 200; // Approximate height of context menu
    const menuWidth = 180;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    let x = e.clientX;
    let y = e.clientY;

    // Try to position menu to the right of cursor first
    if (x + menuWidth > windowWidth) {
      // If no space on right, try left side
      x = e.clientX - menuWidth - 10;
      // If still off screen, position at left edge with padding
      if (x < 10) {
        x = 10;
      }
    }

    // Position menu above cursor if it would go off bottom
    if (y + menuHeight > windowHeight) {
      y = e.clientY - menuHeight;
      // If menu would go off top, position it with space from bottom
      if (y < 10) {
        y = windowHeight - menuHeight - 10;
      }
    }

    setContextMenu({
      x,
      y,
      message
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    closeContextMenu();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleForward = (message) => {
    setForwardModal({ message });
    setSelectedConversations([]);
    setForwardSearchQuery('');
    closeContextMenu();
  };

  const closeForwardModal = () => {
    setForwardModal(null);
    setSelectedConversations([]);
    setForwardSearchQuery('');
  };

  const toggleConversationSelection = (conversationId) => {
    setSelectedConversations(prev => {
      if (prev.includes(conversationId)) {
        return prev.filter(id => id !== conversationId);
      } else {
        return [...prev, conversationId];
      }
    });
  };

  const handleForwardToSelected = async () => {
    if (selectedConversations.length === 0) return;

    try {
      const messageToForward = forwardModal.message;
      const token = localStorage.getItem('access_token');
      const baseUrl = 'http://127.0.0.1:8000/api/messaging';

      // Forward to all selected conversations
      const forwardPromises = selectedConversations.map(conversationId => {
        const forwardUrl = `${baseUrl}/conversations/${activeConversation.id}/messages/${messageToForward.id}/forward/`;

        return fetch(forwardUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            target_conversation_id: conversationId
          })
        });
      });

      const responses = await Promise.all(forwardPromises);

      // Check if any succeeded
      const anySucceeded = responses.some(r => r.ok);

      if (anySucceeded) {
        // Refresh conversation list to show updated order
        await fetchConversations();
        closeForwardModal();
      } else {
        // Log errors but don't show alert
        responses.forEach((r, idx) => {
          if (!r.ok) {
            console.error(`Failed to forward to conversation ${selectedConversations[idx]}: ${r.status}`);
          }
        });
        closeForwardModal();
      }
    } catch (error) {
      console.error('Failed to forward message:', error);
      closeForwardModal();
    }
  };

  const getFilteredConversations = () => {
    const filtered = conversations.filter(conv => conv.id !== activeConversation?.id);

    if (!forwardSearchQuery.trim()) {
      return filtered;
    }

    const query = forwardSearchQuery.toLowerCase();
    return filtered.filter(conversation => {
      if (conversation.type === 'group') {
        return conversation.name?.toLowerCase().includes(query);
      } else {
        const otherParticipant = conversation.participants.find(p => p.id !== user.id);
        const fullName = `${otherParticipant?.first_name} ${otherParticipant?.last_name}`.toLowerCase();
        const email = otherParticipant?.email?.toLowerCase() || '';
        return fullName.includes(query) || email.includes(query);
      }
    });
  };

  const getForwardConversationName = (conversation) => {
    if (conversation.type === 'group') {
      return conversation.name || 'Unnamed Group';
    } else {
      const otherParticipant = conversation.participants.find(p => p.id !== user.id);
      return `${otherParticipant?.first_name || ''} ${otherParticipant?.last_name || ''}`.trim()
        || otherParticipant?.email
        || 'Unknown';
    }
  };

  const handlePin = async (message) => {
    const isCurrentlyPinned = pinnedMessages.some(m => m.id === message.id);

    // Enforce client-side max before hitting API
    if (!isCurrentlyPinned && pinnedMessages.length >= 3) {
      alert('You can only pin up to 3 messages. Unpin one first.');
      closeContextMenu();
      return;
    }

    closeContextMenu();

    try {
      await pinMessage(activeConversation.id, message.id);
      // activePinIndex stays valid; clamp if needed
      setActivePinIndex(prev => Math.min(prev, Math.max(0, pinnedMessages.length - (isCurrentlyPinned ? 2 : 0))));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleScrollToPin = (pinnedMsg) => {
    // Find the DOM element for this message and scroll to it
    const el = messageRefs.current[pinnedMsg.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight
      setHighlightedMessageId(pinnedMsg.id);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  const handleReact = (message) => {
    setEmojiPicker({ message, x: contextMenu.x, y: contextMenu.y });
    closeContextMenu();
  };

  const handleReactionBadgeClick = (message, emoji) => {
    // Show modal with who reacted
    const messageReactions = message.reactions || [];
    const emojiReactions = messageReactions.filter(r => r.emoji === emoji);

    setReactionModal({
      message,
      emoji,
      reactions: emojiReactions
    });
  };

  const closeReactionModal = () => {
    setReactionModal(null);
  };

  const handleRemoveReaction = async (emoji, message) => {
    // Optimistic update - remove reaction immediately
    const currentReactions = message.reactions || [];
    const optimisticReactions = currentReactions.filter(
      r => !(r.user.id === user.id && r.emoji === emoji)
    );

    // Update UI immediately
    updateMessageReactions(message.id, optimisticReactions);
    closeReactionModal();

    // Send to backend
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/api/messaging/conversations/${activeConversation.id}/messages/${message.id}/react/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emoji })
        }
      );

      if (response.ok) {
        const data = await response.json();
        updateMessageReactions(message.id, data.reactions);
        // Refresh conversation list to move this conversation to top
        fetchConversations();
      } else {
        console.error('Failed to remove reaction:', response.status);
        // Revert on error
        updateMessageReactions(message.id, currentReactions);
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
      // Revert on error
      updateMessageReactions(message.id, currentReactions);
    }
  };

  const handleEmojiSelect = async (emoji, message) => {
    // Optimistic update - update UI immediately
    const currentReactions = message.reactions || [];
    const existingReactionIndex = currentReactions.findIndex(
      r => r.user.id === user.id && r.emoji === emoji
    );

    let optimisticReactions;
    if (existingReactionIndex >= 0) {
      // Remove reaction (toggle off)
      optimisticReactions = currentReactions.filter((_, idx) => idx !== existingReactionIndex);
    } else {
      // Add reaction (toggle on)
      optimisticReactions = [
        ...currentReactions,
        {
          id: `temp-${Date.now()}`,
          emoji,
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email
          },
          created_at: new Date().toISOString()
        }
      ];
    }

    // Update UI immediately (optimistic)
    updateMessageReactions(message.id, optimisticReactions);

    // Close emoji picker
    setEmojiPicker(null);

    // Send to backend
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/api/messaging/conversations/${activeConversation.id}/messages/${message.id}/react/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emoji })
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Update with server response (in case of any differences)
        updateMessageReactions(message.id, data.reactions);
        // Refresh conversation list to move this conversation to top
        fetchConversations();
      } else {
        console.error('Failed to add reaction:', response.status);
        // Revert optimistic update on error
        updateMessageReactions(message.id, currentReactions);
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
      // Revert optimistic update on error
      updateMessageReactions(message.id, currentReactions);
    }
  };

  const closeEmojiPicker = () => {
    setEmojiPicker(null);
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-info">
          <h3>{getConversationName()}</h3>
          <p className={`chat-status ${shouldShowStatusIndicator() ? (isUserOnline() ? 'online' : 'offline') : 'no-indicator'}`}>
            {getOnlineStatus()}
          </p>
        </div>

        <div className="chat-header-actions">
          <button className="icon-button" onClick={handleStartMeeting} title="Start Google Meet">
            <Video size={20} />
          </button>
          <button className="icon-button" title="More options">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <div className="pinned-banner">
          <div className="pinned-banner-icon">
            <Pin size={14} />
          </div>
          <div
            className="pinned-banner-content"
            onClick={() => handleScrollToPin(pinnedMessages[activePinIndex])}
          >
            <span className="pinned-banner-label">Pinned Message</span>
            <span className="pinned-banner-text">
              {pinnedMessages[activePinIndex]?.content || '📎 Attachment'}
            </span>
          </div>
          {pinnedMessages.length > 1 && (
            <div className="pinned-dots">
              {pinnedMessages.map((_, i) => (
                <button
                  key={i}
                  className={`pinned-dot${i === activePinIndex ? ' active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setActivePinIndex(i); }}
                  title={`Pinned message ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
        {groupedMessages.map((group, groupIndex) => {
          const isSent = group.sender.id === user.id;

          return (
            <div key={groupIndex} className={`message-group ${isSent ? 'sent' : 'received'}`}>
              {!isSent && (
                <div className="message-avatar">
                  {group.sender.first_name?.charAt(0) || group.sender.email.charAt(0)}
                </div>
              )}

              <div className="message-content">
                {!isSent && (
                  <p className="message-sender">
                    {group.sender.first_name} {group.sender.last_name}
                  </p>
                )}

                {group.messages.map(message => (
                  <div
                    key={message.id}
                    ref={el => { if (el) messageRefs.current[message.id] = el; }}
                    className={highlightedMessageId === message.id ? 'message-highlight-flash' : ''}
                  >
                    <div
                      className="message-bubble"
                      onContextMenu={(e) => handleMessageContextMenu(e, message)}
                    >
                      {message.reply_to_message && (
                        <div className="reply-preview-in-message">
                          <div className="reply-preview-bar"></div>
                          <div className="reply-preview-content">
                            <div className="reply-preview-sender">
                              {message.reply_to_message.sender?.first_name || 'User'} {message.reply_to_message.sender?.last_name || ''}
                            </div>
                            <div className="reply-preview-text">
                              {message.reply_to_message.content}
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="message-text">{linkify(message.content)}</p>

                      {message.attachments?.length > 0 && (
                        <div className="message-attachment">
                          {message.attachments.map(attachment => (
                            <div key={attachment.id}>
                              {attachment.attachment_type === 'image' ? (
                                <img
                                  src={attachment.cloudinary_url}
                                  alt={attachment.file_name}
                                  className="message-image"
                                  onClick={() => handleImageClick(attachment.cloudinary_url, attachment.file_name)}
                                />
                              ) : (
                                <div
                                  className="message-file"
                                  onClick={() => handleFileClick(attachment)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <span>📎</span>
                                  <span>{attachment.file_name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reactions - displayed inside message bubble */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="message-reactions-inline">
                          {Object.entries(
                            message.reactions.reduce((acc, reaction) => {
                              if (!acc[reaction.emoji]) {
                                acc[reaction.emoji] = [];
                              }
                              acc[reaction.emoji].push(reaction.user);
                              return acc;
                            }, {})
                          ).map(([emoji, users]) => (
                            <button
                              key={emoji}
                              className={`reaction-badge ${users.some(u => u.id === user.id) ? 'user-reacted' : ''}`}
                              onClick={() => handleReactionBadgeClick(message, emoji)}
                              title={users.map(u => `${u.first_name} ${u.last_name}`).join(', ')}
                            >
                              {emoji} {users.length > 1 ? users.length : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="message-meta">
                      <span>{formatMessageTime(message.created_at)}</span>
                      {isSent && message.read_by?.length > 0 && <span>✓✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {typingUsersList.length > 0 && (
          <div className="typing-indicator">
            <div className="message-avatar">
              {typingUsersList[0].first_name?.charAt(0) || typingUsersList[0].email.charAt(0)}
            </div>
            <div className="typing-indicator-dots">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <MessageInput replyingTo={replyingTo} onCancelReply={handleCancelReply} />

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <button className="lightbox-download" onClick={handleDownloadImage} title="Download image">
                <Download size={20} />
              </button>
              <button className="lightbox-close" onClick={closeLightbox} title="Close">
                <X size={24} />
              </button>
            </div>
            <img src={lightboxImage} alt="Full size" className="lightbox-image" />
          </div>
        </div>
      )}

      {/* Message Context Menu */}
      {contextMenu && (
        <div
          className="message-context-menu"
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => handleReply(contextMenu.message)}>
            <Reply size={18} />
            <span>Reply</span>
          </div>
          <div className="context-menu-item" onClick={() => handleForward(contextMenu.message)}>
            <Forward size={18} />
            <span>Forward</span>
          </div>
          <div className="context-menu-item" onClick={() => handlePin(contextMenu.message)}>
            <Pin size={18} />
            <span>{pinnedMessages.some(m => m.id === contextMenu.message?.id) ? 'Unpin' : 'Pin'}</span>
          </div>
          <div className="context-menu-item" onClick={() => handleReact(contextMenu.message)}>
            <Smile size={18} />
            <span>React</span>
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {emojiPicker && (
        <div
          className="emoji-picker"
          style={{
            position: 'fixed',
            top: `${emojiPicker.y}px`,
            left: `${emojiPicker.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="emoji-picker-header">React with emoji</div>
          <div className="emoji-list">
            {['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '👏', '✨', '💯'].map(emoji => (
              <button
                key={emoji}
                className="emoji-button"
                onClick={() => handleEmojiSelect(emoji, emojiPicker.message)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {forwardModal && (
        <div className="modal-overlay" onClick={closeForwardModal}>
          <div className="forward-modal-whatsapp" onClick={(e) => e.stopPropagation()}>
            <div className="forward-modal-header">
              <button className="modal-close-icon" onClick={closeForwardModal}>
                <X size={24} />
              </button>
              <h3>Forward message to</h3>
            </div>

            <div className="forward-search-bar">
              <input
                type="text"
                placeholder="Search name, number or @username"
                value={forwardSearchQuery}
                onChange={(e) => setForwardSearchQuery(e.target.value)}
                className="forward-search-input"
              />
            </div>

            <div className="forward-chats-label">Recent chats</div>

            <div className="conversation-list-forward">
              {getFilteredConversations().map(conversation => {
                const isSelected = selectedConversations.includes(conversation.id);
                const otherParticipant = conversation.type === 'direct'
                  ? conversation.participants.find(p => p.id !== user.id)
                  : null;

                return (
                  <div
                    key={conversation.id}
                    className={`forward-conversation-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleConversationSelection(conversation.id)}
                  >
                    <div className={`forward-checkbox ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <span>✓</span>}
                    </div>

                    <div className="conversation-avatar-forward">
                      {conversation.type === 'group'
                        ? conversation.name?.charAt(0) || 'G'
                        : otherParticipant?.first_name?.charAt(0) || 'U'}
                    </div>

                    <div className="conversation-info-forward">
                      <div className="conversation-name-forward">
                        {getForwardConversationName(conversation)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedConversations.length > 0 && (
              <>
                <div className="forward-selected-contacts">
                  {selectedConversations.map(convId => {
                    const conversation = conversations.find(c => c.id === convId);
                    if (!conversation) return null;

                    return (
                      <div key={convId} className="selected-contact-chip">
                        <span>{getForwardConversationName(conversation)}</span>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          toggleConversationSelection(convId);
                        }}>
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="forward-send-button-container">
                  <button className="forward-send-button" onClick={handleForwardToSelected}>
                    <Forward size={20} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reaction Details Modal - WhatsApp Style */}
      {reactionModal && (
        <div className="modal-overlay" onClick={closeReactionModal}>
          <div className="reaction-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reaction-modal-header">
              <div className="reaction-modal-emoji">{reactionModal.emoji}</div>
              <span className="reaction-count">{reactionModal.reactions.length} {reactionModal.reactions.length === 1 ? 'reaction' : 'reactions'}</span>
              <button className="modal-close-button" onClick={closeReactionModal}>
                <X size={20} />
              </button>
            </div>

            <div className="reaction-list">
              {reactionModal.reactions.map((reaction) => {
                const isCurrentUser = reaction.user.id === user.id;
                return (
                  <div key={reaction.id} className="reaction-item">
                    <div className="reaction-user-info">
                      <div className="reaction-user-avatar">
                        {reaction.user.first_name?.charAt(0) || reaction.user.email.charAt(0)}
                      </div>
                      <div className="reaction-user-details">
                        <div className="reaction-user-name">
                          {isCurrentUser ? 'You' : `${reaction.user.first_name} ${reaction.user.last_name}`.trim() || reaction.user.email}
                        </div>
                        {isCurrentUser && (
                          <div className="reaction-user-action" onClick={() => handleRemoveReaction(reactionModal.emoji, reactionModal.message)}>
                            Click to remove
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="reaction-emoji-display">{reactionModal.emoji}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
