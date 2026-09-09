import { useState, useRef } from 'react';
import { useMessaging } from '../../context/MessagingContext';
import { Paperclip, Send, Smile, X } from 'lucide-react';
import './MessageInput.css';

export default function MessageInput({ replyingTo, onCancelReply }) {
  const { sendMessage, sendTypingIndicator, activeConversation, uploadFile } = useMessaging();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Send typing indicator
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    } else if (value.length === 0 && isTyping) {
      setIsTyping(false);
      sendTypingIndicator(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if ((!message.trim() && !selectedFile) || !activeConversation) return;

    setUploading(true);

    try {
      // If there's a file, prepare it for upload after message is sent
      if (selectedFile) {
        // Store file in window for the WebSocket message handler to pick up
        window.pendingFileUpload = {
          file: selectedFile
        };

        // Send message with appropriate type
        const textContent = message.trim() || `📎 ${selectedFile.name}`;
        const messageType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
        sendMessage(textContent, messageType, replyingTo?.id);

        setSelectedFile(null);
        setMessage('');
      } else {
        // Send text-only message (with optional reply)
        sendMessage(message.trim(), 'text', replyingTo?.id);
        setMessage('');
      }

      // Clear reply state after sending
      if (replyingTo && onCancelReply) {
        onCancelReply();
      }

      setIsTyping(false);
      sendTypingIndicator(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      window.pendingFileUpload = null;
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB for images, 5MB for documents)
      const maxSize = file.type.startsWith('image/') ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
        return;
      }
      setSelectedFile(file);
      console.log('File selected:', file.name);
    }
    // Reset file input
    e.target.value = '';
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />

      {replyingTo && (
        <div className="replying-to-preview">
          <div className="reply-info">
            <div className="reply-header">Replying to {replyingTo.sender.first_name}</div>
            <div className="reply-content">{replyingTo.content}</div>
          </div>
          <button
            type="button"
            className="remove-reply-button"
            onClick={onCancelReply}
            title="Cancel reply"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {selectedFile && (
        <div className="selected-file-preview">
          <div className="file-info">
            <Paperclip size={16} />
            <span className="file-name">{selectedFile.name}</span>
            <span className="file-size">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            type="button"
            className="remove-file-button"
            onClick={handleRemoveFile}
            title="Remove file"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="input-row">
        <button
          type="button"
          className="input-action-button"
          onClick={handleFileClick}
          title="Attach file"
          disabled={uploading}
        >
          <Paperclip size={20} />
        </button>

        <textarea
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="message-textarea"
          disabled={uploading}
        />

        <button
          type="button"
          className="input-action-button"
          title="Add emoji"
          disabled={uploading}
        >
          <Smile size={20} />
        </button>

        <button
          type="submit"
          className="send-button"
          disabled={(!message.trim() && !selectedFile) || uploading}
          title="Send message"
        >
          {uploading ? '...' : <Send size={20} />}
        </button>
      </div>
    </form>
  );
}
