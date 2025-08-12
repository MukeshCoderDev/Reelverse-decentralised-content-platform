import React, { useState, useEffect } from 'react';
import { LiveStreamingOrchestrator } from '../../services/LiveStreamingOrchestrator';

interface ModerationPanelProps {
  orchestrator: LiveStreamingOrchestrator;
}

export const ModerationPanel: React.FC<ModerationPanelProps> = ({ orchestrator }) => {
  const [moderationQueue, setModerationQueue] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [timeoutUsers, setTimeoutUsers] = useState<any[]>([]);
  const [autoModSettings, setAutoModSettings] = useState<any>({});
  const [moderators, setModerators] = useState<any[]>([]);
  const [chatSettings, setChatSettings] = useState<any>({});

  useEffect(() => {
    const updateModeration = () => {
      setModerationQueue(orchestrator.getModerationQueue());
      setBannedUsers(orchestrator.getBannedUsers());
      setTimeoutUsers(orchestrator.getTimeoutUsers());
      setAutoModSettings(orchestrator.getAutoModSettings());
      setModerators(orchestrator.getModerators());
      setChatSettings(orchestrator.getChatSettings());
    };

    const handleModerationEvent = () => {
      updateModeration();
    };

    orchestrator.on('moderationEvent', handleModerationEvent);
    orchestrator.on('userBanned', handleModerationEvent);
    orchestrator.on('userTimedOut', handleModerationEvent);
    orchestrator.on('messageDeleted', handleModerationEvent);

    updateModeration();

    return () => {
      orchestrator.off('moderationEvent', handleModerationEvent);
      orchestrator.off('userBanned', handleModerationEvent);
      orchestrator.off('userTimedOut', handleModerationEvent);
      orchestrator.off('messageDeleted', handleModerationEvent);
    };
  }, [orchestrator]);

  const handleBanUser = async (userId: string, reason: string) => {
    try {
      await orchestrator.banUser(userId, reason);
    } catch (error) {
      console.error('Failed to ban user:', error);
    }
  };

  const handleTimeoutUser = async (userId: string, duration: number, reason: string) => {
    try {
      await orchestrator.timeoutUser(userId, duration, reason);
    } catch (error) {
      console.error('Failed to timeout user:', error);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await orchestrator.unbanUser(userId);
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await orchestrator.deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <div className="moderation-panel">
      {/* Moderation queue */}
      <div className="moderation-queue">
        <h3>Moderation Queue</h3>
        {moderationQueue.length > 0 ? (
          <div className="queue-list">
            {moderationQueue.map((item) => (
              <div key={item.id} className="queue-item">
                <div className="item-header">
                  <span className="username">{item.username}</span>
                  <span className="timestamp">{formatTime(item.timestamp)}</span>
                  <span className={`severity ${item.severity}`}>{item.severity}</span>
                </div>
                <div className="item-content">
                  <div className="message">{item.message}</div>
                  <div className="reason">Flagged: {item.reason}</div>
                </div>
                <div className="item-actions">
                  <button
                    className="action-button approve"
                    onClick={() => orchestrator.approveMessage(item.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="action-button delete"
                    onClick={() => handleDeleteMessage(item.messageId)}
                  >
                    Delete
                  </button>
                  <button
                    className="action-button timeout"
                    onClick={() => handleTimeoutUser(item.userId, 300, item.reason)}
                  >
                    Timeout 5m
                  </button>
                  <button
                    className="action-button ban"
                    onClick={() => handleBanUser(item.userId, item.reason)}
                  >
                    Ban
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-queue">No items in moderation queue</div>
        )}
      </div>

      {/* Chat settings */}
      <div className="chat-settings">
        <h4>Chat Settings</h4>
        <div className="settings-grid">
          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={chatSettings.slowMode || false}
                onChange={(e) => orchestrator.updateChatSettings({
                  slowMode: e.target.checked
                })}
              />
              Slow Mode
            </label>
            {chatSettings.slowMode && (
              <input
                type="number"
                min="1"
                max="300"
                value={chatSettings.slowModeDelay || 30}
                onChange={(e) => orchestrator.updateChatSettings({
                  slowModeDelay: Number(e.target.value)
                })}
                placeholder="Seconds"
              />
            )}
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={chatSettings.subscriberOnly || false}
                onChange={(e) => orchestrator.updateChatSettings({
                  subscriberOnly: e.target.checked
                })}
              />
              Subscriber Only
            </label>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={chatSettings.emoteOnly || false}
                onChange={(e) => orchestrator.updateChatSettings({
                  emoteOnly: e.target.checked
                })}
              />
              Emote Only
            </label>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={chatSettings.linksAllowed || true}
                onChange={(e) => orchestrator.updateChatSettings({
                  linksAllowed: e.target.checked
                })}
              />
              Allow Links
            </label>
          </div>
        </div>
      </div>

      {/* Auto-moderation settings */}
      <div className="auto-mod-settings">
        <h4>Auto-Moderation</h4>
        <div className="auto-mod-grid">
          <div className="auto-mod-item">
            <label className="auto-mod-label">Spam Detection</label>
            <select
              value={autoModSettings.spamLevel || 'medium'}
              onChange={(e) => orchestrator.updateAutoModSettings({
                spamLevel: e.target.value
              })}
            >
              <option value="off">Off</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="auto-mod-item">
            <label className="auto-mod-label">Profanity Filter</label>
            <select
              value={autoModSettings.profanityLevel || 'medium'}
              onChange={(e) => orchestrator.updateAutoModSettings({
                profanityLevel: e.target.value
              })}
            >
              <option value="off">Off</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="auto-mod-item">
            <label className="auto-mod-label">
              <input
                type="checkbox"
                checked={autoModSettings.capsFilter || false}
                onChange={(e) => orchestrator.updateAutoModSettings({
                  capsFilter: e.target.checked
                })}
              />
              Block Excessive Caps
            </label>
          </div>

          <div className="auto-mod-item">
            <label className="auto-mod-label">
              <input
                type="checkbox"
                checked={autoModSettings.linkFilter || false}
                onChange={(e) => orchestrator.updateAutoModSettings({
                  linkFilter: e.target.checked
                })}
              />
              Block Suspicious Links
            </label>
          </div>
        </div>
      </div>

      {/* Banned users */}
      <div className="banned-users">
        <h4>Banned Users ({bannedUsers.length})</h4>
        {bannedUsers.length > 0 ? (
          <div className="users-list">
            {bannedUsers.slice(0, 10).map((user) => (
              <div key={user.id} className="user-item banned">
                <div className="user-info">
                  <span className="username">{user.username}</span>
                  <span className="ban-reason">{user.reason}</span>
                  <span className="ban-time">{formatTime(user.bannedAt)}</span>
                </div>
                <button
                  className="unban-button"
                  onClick={() => handleUnbanUser(user.id)}
                >
                  Unban
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-users">No banned users</div>
        )}
      </div>

      {/* Timed out users */}
      <div className="timeout-users">
        <h4>Timed Out Users ({timeoutUsers.length})</h4>
        {timeoutUsers.length > 0 ? (
          <div className="users-list">
            {timeoutUsers.slice(0, 10).map((user) => (
              <div key={user.id} className="user-item timeout">
                <div className="user-info">
                  <span className="username">{user.username}</span>
                  <span className="timeout-reason">{user.reason}</span>
                  <span className="timeout-remaining">
                    {formatDuration(user.remainingTime)} left
                  </span>
                </div>
                <button
                  className="untimeout-button"
                  onClick={() => orchestrator.removeTimeout(user.id)}
                >
                  Remove Timeout
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-users">No timed out users</div>
        )}
      </div>

      {/* Moderators */}
      <div className="moderators-section">
        <h4>Moderators ({moderators.length})</h4>
        <div className="moderators-list">
          {moderators.map((mod) => (
            <div key={mod.id} className="moderator-item">
              <div className="moderator-info">
                <span className="moderator-name">{mod.username}</span>
                <span className="moderator-role">{mod.role}</span>
                <span className="moderator-since">Since {formatTime(mod.addedAt)}</span>
              </div>
              <div className="moderator-actions">
                <button
                  className="remove-mod-button"
                  onClick={() => orchestrator.removeModerator(mod.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="add-moderator">
          <input
            type="text"
            placeholder="Username to add as moderator"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const username = (e.target as HTMLInputElement).value;
                if (username) {
                  orchestrator.addModerator(username);
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              const username = input.value;
              if (username) {
                orchestrator.addModerator(username);
                input.value = '';
              }
            }}
          >
            Add Moderator
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="moderation-actions">
        <button
          className="action-button clear-chat"
          onClick={() => orchestrator.clearChat()}
        >
          Clear Chat
        </button>
        <button
          className="action-button export-logs"
          onClick={() => orchestrator.exportModerationLogs()}
        >
          Export Logs
        </button>
        <button
          className="action-button emergency-mode"
          onClick={() => orchestrator.enableEmergencyMode()}
        >
          Emergency Mode
        </button>
      </div>
    </div>
  );
};