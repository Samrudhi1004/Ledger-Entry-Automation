import { useState, useEffect } from 'react';
import { useMessaging } from '../../context/MessagingContext';
import { X, Search, Users } from 'lucide-react';
import './GroupCreation.css';

export default function GroupCreation({ onClose }) {
  const { searchUsers, createConversation, selectConversation } = useMessaging();
  const [step, setStep] = useState(1); // 1: Add members, 2: Group details
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Search users
  useEffect(() => {
    const search = async () => {
      if (searchQuery.trim()) {
        const results = await searchUsers(searchQuery);
        setSearchResults(results);
      } else {
        const suggestions = await searchUsers('');
        setSearchResults(suggestions);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchUsers]);

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleNext = () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one member');
      return;
    }
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (selectedUsers.length === 0) {
      alert('Please select at least one member');
      return;
    }

    setIsCreating(true);

    try {
      const participantIds = selectedUsers.map(u => u.id);
      const newConversation = await createConversation(
        'group',
        participantIds,
        groupName.trim(),
        groupDescription.trim()
      );

      if (newConversation) {
        selectConversation(newConversation);
        onClose();
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="group-creation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="group-creation-header">
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
          <h2>{step === 1 ? 'Add Group Members' : 'Group Details'}</h2>
          <div className="step-indicator">
            Step {step} of 2
          </div>
        </div>

        {step === 1 ? (
          <>
            {/* Step 1: Select Members */}
            <div className="search-section">
              <div className="search-input-container">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  autoFocus
                />
              </div>
            </div>

            {selectedUsers.length > 0 && (
              <div className="selected-users">
                <div className="selected-users-label">
                  Selected ({selectedUsers.length})
                </div>
                <div className="selected-users-chips">
                  {selectedUsers.map(user => {
                    const displayName = user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : user.first_name || user.last_name || user.email.split('@')[0];

                    return (
                      <div key={user.id} className="user-chip">
                        <span>{displayName}</span>
                        <button onClick={() => toggleUserSelection(user)}>
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="users-list">
              {searchResults.map(user => {
                const isSelected = selectedUsers.some(u => u.id === user.id);
                const displayName = user.first_name && user.last_name
                  ? `${user.first_name} ${user.last_name}`.trim()
                  : user.first_name || user.last_name || user.email.split('@')[0];

                return (
                  <div
                    key={user.id}
                    className={`user-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleUserSelection(user)}
                  >
                    <div className="user-avatar">
                      {user.first_name?.charAt(0) || user.email.charAt(0)}
                    </div>
                    <div className="user-info">
                      <div className="user-name">
                        {displayName}
                      </div>
                      <div className="user-email">{user.email}</div>
                    </div>
                    <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                      {isSelected && '✓'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleNext}
                disabled={selectedUsers.length === 0}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Group Details */}
            <div className="group-details-section">
              <div className="group-icon-placeholder">
                <Users size={40} />
              </div>

              <div className="form-group">
                <label>Group Name *</label>
                <input
                  type="text"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="form-input"
                  maxLength={100}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  placeholder="Enter group description"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="form-textarea"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="members-summary">
                <div className="members-summary-header">
                  <Users size={18} />
                  <span>Members ({selectedUsers.length})</span>
                </div>
                <div className="members-summary-list">
                  {selectedUsers.map(user => {
                    const displayName = user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : user.first_name || user.last_name || user.email.split('@')[0];

                    return (
                      <div key={user.id} className="member-summary-item">
                        <div className="member-avatar-small">
                          {user.first_name?.charAt(0) || user.email.charAt(0)}
                        </div>
                        <span>{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={handleBack}>
                Back
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateGroup}
                disabled={isCreating || !groupName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
