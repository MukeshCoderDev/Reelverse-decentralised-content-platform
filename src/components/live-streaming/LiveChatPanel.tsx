import React, { useState, useEffect, useRef } from 'react';
import { LiveStreamingOrchestrator } from '../../services/LiveStreamingOrchestrator';
import { ChatMessage, ChatUser } from '../../services/chat/LiveChatService';

interface LiveChatPanelProps {
  orchestrator: LiveStreamingOrchestrator;
}

export const LiveChatPanel: React.FC<LiveChatPanelProps> = ({ orchestrator }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [superChatAmount, setSuperChatAmount] = useState<number>(5);
  const [showSuperChat, setShowSuperChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateChat = () => {
      setMessages(orchestrator.getChatMessages());
      setUsers(orchestrator.getChatUsers());
    };

    const handleChatMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    };

    const handleSuperChat = (superChat: any) => {
      setMessages(prev => [...prev, superChat]);
      scrollToBottom();
    };

    const handleUserJoined = (user: ChatUser) => {
      setUsers(prev => [...prev, user]);
    };

    const handleUserLeft = (userId: string) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
    };

    orchestrator.on('chatMessage', handleChatMessage);
    orchestrator.on('superChatReceived', handleSuperChat);
    orchestrator.on('userJoined', handleUserJoined);
    orchestrator.on('userLeft', handleUserLeft);

    // Initial load
    updateChat();

    return () => {
      orchestrator.off('chatMessage', handleChatMessage);
      orchestrator.off('superChatReceived', handleSuperChat);
      orchestrator.off('userJoined', handleUserJoined);
      orchestrator.off('userLeft', handleUserLeft);
    };
  }, [orchestrator]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      if (showSuperChat && superChatAmount > 0) {
        await orchestrator.sendSuperChat(newMessage, superChatAmount);
      } else {
        await orchestrator.sendChatMessage(newMessage);
      }
      setNewMessage('');
      setShowSuperChat(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleModerateMessage = async (messageId: string, action: 'delete' | 'timeout' | 'ban') => {
    try {
      await orchestrator.moderateMessage(messageId, action);
    } catch (error) {
      console.error('Failed to moderate message:', error);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getSuperChatStyle = (amount: number) => {
    if (amount >= 100) return { backgroundColor: '#FF0000', color: 'white' };
    if (amount >= 50) return { backgroundColor: '#FF8C00', color: 'white' };
    if (amount >= 20) return { backgroundColor: '#FFD700', color: 'black' };
    if (amount >= 10) return { backgroundColor: '#32CD32', color: 'white' };
    if (amount >= 5) return { backgroundColor: '#1E90FF', color: 'white' };
    return { backgroundColor: '#9370DB', color: 'white' };
  };

  return (
    <div className="live-chat-panel">
      {/* Chat header with viewer count */}
      <div className="chat-header">
        <h3>Live Chat</h3>
        <div className="viewer-info">
          <span className="viewer-count">{users.length} viewers</span>
        </div>
      </div>

      {/* Messages container */}
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-message ${message.type}`}
            style={message.type === 'super_chat' ? getSuperChatStyle(message.metadata?.amount || 0) : undefined}
          >
            <div className="message-header">
              <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
              <span className="username">
                {message.username}
                {message.metadata?.badges?.map(badge => (
                  <span key={badge.id} className="user-badge" style={{ color: badge.color }}>
                    {badge.icon}
                  </span>
                ))}
              </span>
              {message.type === 'super_chat' && (
                <span className="super-chat-amount">
                  ${message.metadata?.amount}
                </span>
              )}
            </div>
            <div className="message-content">
              {message.message}
            </div>
            {/* Moderation controls for streamers */}
            <div className="message-actions">
              <button
                className="action-button delete"
                onClick={() => handleModerateMessage(message.id, 'delete')}
                title="Delete message"
              >
                🗑️
              </button>
              <button
                className="action-button timeout"
                onClick={() => handleModerateMessage(message.id, 'timeout')}
                title="Timeout user"
              >
                ⏰
              </button>
              <button
                className="action-button ban"
                onClick={() => handleModerateMessage(message.id, 'ban')}
                title="Ban user"
              >
                🚫
              </button>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="chat-input-container">
        {showSuperChat && (
          <div className="super-chat-controls">
            <label>Super Chat Amount:</label>
            <select
              value={superChatAmount}
              onChange={(e) => setSuperChatAmount(Number(e.target.value))}
            >
              <option value={5}>$5</option>
              <option value={10}>$10</option>
              <option value={20}>$20</option>
              <option value={50}>$50</option>
              <option value={100}>$100</option>
            </select>
            <button
              className="cancel-super-chat"
              onClick={() => setShowSuperChat(false)}
            >
              Cancel
            </button>
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <div className="input-row">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={showSuperChat ? "Send a Super Chat..." : "Say something..."}
              className="message-input"
              maxLength={500}
            />
            <button
              type="button"
              className={`super-chat-toggle ${showSuperChat ? 'active' : ''}`}
              onClick={() => setShowSuperChat(!showSuperChat)}
              title="Super Chat"
            >
              💰
            </button>
            <button type="submit" className="send-button">
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Active viewers sidebar */}
      <div className="viewers-sidebar">
        <h4>Active Viewers</h4>
        <div className="viewers-list">
          {users.map((user) => (
            <div key={user.id} className="viewer-item">
              <div className="viewer-avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.username} />
                ) : (
                  <div className="avatar-placeholder">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="viewer-info">
                <span className="viewer-name">{user.username}</span>
                <div className="viewer-badges">
                  {user.isOwner && <span className="badge owner">👑</span>}
                  {user.isModerator && <span className="badge moderator">🛡️</span>}
                  {user.isSubscriber && <span className="badge subscriber">⭐</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};