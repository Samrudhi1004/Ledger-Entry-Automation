import { useState } from 'react';
import { MessagingProvider } from '../context/MessagingContext';
import ConversationList from '../components/messaging/ConversationList';
import ChatWindow from '../components/messaging/ChatWindow';
import UserSearch from '../components/messaging/UserSearch';
import { Plus } from 'lucide-react';
import './MessagesPage.css';

export default function MessagesPage() {
  const [showUserSearch, setShowUserSearch] = useState(false);

  return (
    <MessagingProvider>
      <div className="messages-page">
        <div className="messages-layout">
          <div className="conversations-panel">
            <ConversationList />
            <button
              className="new-chat-button"
              onClick={() => setShowUserSearch(true)}
            >
              <Plus size={20} />
              <span>New Chat</span>
            </button>
          </div>

          <div className="chat-panel">
            <ChatWindow />
          </div>
        </div>

        {showUserSearch && (
          <UserSearch onClose={() => setShowUserSearch(false)} />
        )}
      </div>
    </MessagingProvider>
  );
}
