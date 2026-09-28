import { useMessaging } from '../../context/MessagingContext';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { Search } from 'lucide-react';
import './ConversationList.css';

export default function ConversationList() {
  const { conversations, activeConversation, selectConversation, onlineUsers } = useMessaging();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const getConversationName = (conversation) => {
    if (conversation.type === 'group') {
      return conversation.name || 'Unnamed Group';
    }

    // For direct messages, show the other participant's name
    const otherParticipant = conversation.participants.find(p => p.id !== user.id);
    return otherParticipant
      ? `${otherParticipant.first_name} ${otherParticipant.last_name}`.trim() || otherParticipant.email
      : 'Unknown User';
  };

  const isConversationUserOnline = (conversation) => {
    // Only check for direct messages
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(p => p.id !== user.id);
      return otherParticipant && onlineUsers[otherParticipant.id];
    }
    return false;
  };

  const getLastMessagePreview = (conversation) => {
    if (!conversation.last_message) return 'No messages yet';

    const { sender, content, message_type } = conversation.last_message;
    const senderName = sender.id === user.id ? 'You' : sender.first_name || sender.email.split('@')[0];

    if (message_type === 'image') return `${senderName}: 📷 Image`;
    if (message_type === 'file') return `${senderName}: 📎 File`;
    if (message_type === 'meeting') return `${senderName}: 📅 Meeting`;

    return `${senderName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`;
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isToday(date)) {
        return format(date, 'HH:mm');
      } else if (isYesterday(date)) {
        return 'Yesterday';
      } else if (differenceInDays(new Date(), date) < 7) {
        return format(date, 'EEEE');
      } else {
        return format(date, 'MMM dd');
      }
    } catch {
      return '';
    }
  };

  // Filter conversations locally : no API call per keystroke
  const filteredConversations = searchQuery.trim()
    ? conversations.filter(conversation => {
        const name = getConversationName(conversation).toLowerCase();
        const query = searchQuery.toLowerCase();
        if (name.includes(query)) return true;
        // Also search participant email for direct chats
        if (conversation.type === 'direct') {
          const other = conversation.participants.find(p => p.id !== user.id);
          return other?.email?.toLowerCase().includes(query);
        }
        return false;
      })
    : conversations;

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Chats</h2>
      </div>

      <div className="conversation-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="conversations">
        {filteredConversations.length === 0 ? (
          <div className="no-conversations">
            {searchQuery.trim() ? (
              <p>No conversations match &ldquo;<strong>{searchQuery}</strong>&rdquo;</p>
            ) : (
              <>
                <p>No conversations yet</p>
                <p className="text-muted">Start a new chat to get started</p>
              </>
            )}
          </div>
        ) : (
          filteredConversations.map(conversation => (
            <div
              key={conversation.id}
              className={`conversation-item ${activeConversation?.id === conversation.id ? 'active' : ''}`}
              onClick={() => selectConversation(conversation)}
            >
              <div className="conversation-avatar-wrapper">
                <div className="conversation-avatar">
                  {getConversationName(conversation).charAt(0).toUpperCase()}
                </div>
                {conversation.type === 'direct' && (
                  <span className={`presence-indicator ${isConversationUserOnline(conversation) ? 'online' : 'offline'}`} />
                )}
              </div>

              <div className="conversation-content">
                <div className="conversation-header">
                  <h3 className="conversation-name">{getConversationName(conversation)}</h3>
                  <span className="conversation-time">
                    {getTimeAgo(conversation.updated_at)}
                  </span>
                </div>

                <div className="conversation-preview">
                  <p className="last-message">{getLastMessagePreview(conversation)}</p>
                  {conversation.unread_count > 0 && (
                    <span className="unread-badge">{conversation.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
