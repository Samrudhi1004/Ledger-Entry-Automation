import { useState, useEffect } from 'react';
import { useMessaging } from '../../context/MessagingContext';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { X, Search, Video, Check, Loader } from 'lucide-react';
import api from '../../api/axios';
import './CreateMeet.css';

/**
 * Generates a random alphanumeric room code (10 chars).
 */
function randomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CreateMeet({ onClose }) {
  const { searchUsers, createConversation, conversations, fetchConversations, activeConversation, fetchMessages } = useMessaging();
  const { user } = useAuth();
  const { companyName } = useCompany();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Load org users on mount and on search change
  useEffect(() => {
    const search = async () => {
      const results = await searchUsers(searchQuery.trim());
      setSearchResults(results);
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchUsers]);

  const toggleUser = (u) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((s) => s.id === u.id);
      return exists ? prev.filter((s) => s.id !== u.id) : [...prev, u];
    });
  };

  const getDisplayName = (u) =>
    u.first_name && u.last_name
      ? `${u.first_name} ${u.last_name}`.trim()
      : u.first_name || u.last_name || (u.email ? u.email.split('@')[0] : 'Unknown');

  /**
   * Find an existing direct conversation with a user, or create one.
   */
  const getOrCreateDirectConversation = async (targetUserId) => {
    // Check existing conversations first
    const existing = conversations.find(
      (c) =>
        c.type === 'direct' &&
        c.participants.some((p) => p.id === targetUserId) &&
        c.participants.some((p) => p.id === user.id)
    );
    if (existing) return existing;

    // Create new direct conversation
    return await createConversation('direct', [targetUserId]);
  };

  /**
   * Send a message to a conversation via REST API (no WS needed).
   */
  const sendMessageViaRest = async (conversationId, content) => {
    await api.post(`/api/messaging/conversations/${conversationId}/messages/`, {
      content,
      message_type: 'text',
    });
  };

  const handleCreateMeet = async () => {
    if (selectedUsers.length === 0) return;

    setIsCreating(true);
    setStatusMessage('Generating meeting link...');

    try {
      // Build Jitsi URL using dynamic company name (e.g. "Mantri Industries" → "MantriIndustries")
      const prefix = (companyName || 'OrgMeet')
        .replace(/[^a-zA-Z0-9]/g, '')  // strip special chars & spaces
        .substring(0, 20);             // cap length
      const meetUrl = `https://meet.jit.si/${prefix}-${randomCode()}`;
      const meetMessage = `📹 Join my meeting:\n${meetUrl}`;

      // Open Jitsi Meet in new tab immediately
      window.open(meetUrl, '_blank', 'noopener,noreferrer');

      setStatusMessage(`Sending invite to ${selectedUsers.length} participant(s)...`);

      // Send meet link to each selected user's direct conversation
      const sentToConvoIds = [];
      let successCount = 0;
      let failCount = 0;

      const sendPromises = selectedUsers.map(async (invitee) => {
        try {
          const conversation = await getOrCreateDirectConversation(invitee.id);
          if (conversation) {
            await sendMessageViaRest(conversation.id, meetMessage);
            sentToConvoIds.push(conversation.id);
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`Failed to send meet invite to ${getDisplayName(invitee)}:`, err);
          failCount++;
        }
      });

      await Promise.all(sendPromises);

      // If the currently open chat is one of the invited users' convos, refresh its messages
      if (activeConversation && sentToConvoIds.includes(activeConversation.id)) {
        await fetchMessages(activeConversation.id);
      }

      // Refresh conversation list so new/updated convos appear at top immediately
      await fetchConversations();

      if (failCount === 0) {
        setStatusMessage('Done! Meeting opened and invites sent ✓');
        setTimeout(onClose, 1200);
      } else if (successCount > 0) {
        setStatusMessage(`Warning: ${failCount} invite(s) failed, ${successCount} sent.`);
        setTimeout(onClose, 2500);
      } else {
        setStatusMessage('Failed to send any invites.');
        setIsCreating(false);
      }
    } catch (err) {
      console.error('Failed to create meet:', err);
      setStatusMessage('Something went wrong. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="cm-header">
          <div className="cm-header-icon">
            <Video size={20} />
          </div>
          <div className="cm-header-text">
            <h2>Create a Meeting</h2>
            <p>Invite people from your organisation</p>
          </div>
          <button className="cm-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="cm-search-wrapper">
          <Search size={16} className="cm-search-icon" />
          <input
            type="text"
            className="cm-search-input"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            disabled={isCreating}
          />
        </div>

        {/* Selected chips */}
        {selectedUsers.length > 0 && (
          <div className="cm-chips">
            {selectedUsers.map((u) => (
              <span key={u.id} className="cm-chip">
                {getDisplayName(u)}
                <button
                  className="cm-chip-remove"
                  onClick={() => toggleUser(u)}
                  disabled={isCreating}
                  aria-label={`Remove ${getDisplayName(u)}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* User list */}
        <div className="cm-user-list">
          {searchResults.length === 0 ? (
            <div className="cm-empty">No users found</div>
          ) : (
            searchResults.map((u) => {
              const selected = selectedUsers.some((s) => s.id === u.id);
              const name = getDisplayName(u);
              const initial = (u.first_name?.[0] || u.email?.[0] || '?').toUpperCase();

              return (
                <div
                  key={u.id}
                  className={`cm-user-item ${selected ? 'selected' : ''}`}
                  onClick={() => !isCreating && toggleUser(u)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && !isCreating && toggleUser(u)}
                >
                  <div className="cm-avatar">{initial}</div>
                  <div className="cm-user-info">
                    <span className="cm-user-name">{name}</span>
                    <span className="cm-user-email">{u.email}</span>
                  </div>
                  <div className={`cm-checkbox ${selected ? 'checked' : ''}`}>
                    {selected && <Check size={13} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Status message */}
        {statusMessage && (
          <div className="cm-status">
            {isCreating && <Loader size={14} className="cm-spinner" />}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="cm-footer">
          <button className="cm-btn-cancel" onClick={onClose} disabled={isCreating}>
            Cancel
          </button>
          <button
            className="cm-btn-create"
            onClick={handleCreateMeet}
            disabled={selectedUsers.length === 0 || isCreating}
          >
            {isCreating ? (
              <>
                <Loader size={16} className="cm-spinner" />
                Creating...
              </>
            ) : (
              <>
                <Video size={16} />
                Create Meet {selectedUsers.length > 0 && `(${selectedUsers.length})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
