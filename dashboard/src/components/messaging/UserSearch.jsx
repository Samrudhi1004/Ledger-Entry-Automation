import { useState } from 'react';
import { useMessaging } from '../../context/MessagingContext';
import { X, Search, UserPlus } from 'lucide-react';
import './UserSearch.css';

export default function UserSearch({ onClose }) {
  const { searchUsers, createConversation } = useMessaging();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery) => {
    setQuery(searchQuery);

    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const users = await searchUsers(searchQuery);
    setResults(users);
    setLoading(false);
  };

  const handleStartConversation = async (userId) => {
    const conversation = await createConversation('direct', [userId]);

    if (conversation) {
      onClose();
    }
  };

  return (
    <div className="user-search-overlay">
      <div className="user-search-modal">
        <div className="user-search-header">
          <h3>New Conversation</h3>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="user-search-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="user-search-input"
            autoFocus
          />
        </div>

        <div className="user-search-results">
          {loading ? (
            <div className="search-loading">Searching...</div>
          ) : results.length === 0 ? (
            <div className="no-results">
              {query.length >= 2 ? 'No users found' : 'Type to search for users'}
            </div>
          ) : (
            results.map(user => (
              <div key={user.id} className="user-result-item">
                <div className="user-result-avatar">
                  {user.first_name?.charAt(0) || user.email.charAt(0)}
                </div>

                <div className="user-result-info">
                  <p className="user-result-name">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="user-result-email">{user.email}</p>
                  <p className="user-result-role">{user.role}</p>
                </div>

                <button
                  className="start-chat-button"
                  onClick={() => handleStartConversation(user.id)}
                  title="Start conversation"
                >
                  <UserPlus size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
