import React, { useState } from 'react';
import { LiveStreamingOrchestrator } from '../../services/LiveStreamingOrchestrator';
import { StreamSettings } from '../../services/streaming/StreamingService';

interface LiveStreamControlsProps {
  isLive: boolean;
  onStart: () => void;
  onStop: () => void;
  orchestrator: LiveStreamingOrchestrator;
}

export const LiveStreamControls: React.FC<LiveStreamControlsProps> = ({
  isLive,
  onStart,
  onStop,
  orchestrator
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Partial<StreamSettings>>({});

  const handleSettingsUpdate = () => {
    orchestrator.updateStreamSettings(settings);
    setShowSettings(false);
  };

  return (
    <div className="live-stream-controls">
      {/* Main stream control button */}
      <div className="primary-controls">
        {!isLive ? (
          <button
            className="stream-button start-stream"
            onClick={onStart}
          >
            🔴 Go Live
          </button>
        ) : (
          <button
            className="stream-button stop-stream"
            onClick={onStop}
          >
            ⏹️ End Stream
          </button>
        )}
      </div>

      {/* Secondary controls */}
      <div className="secondary-controls">
        <button
          className="control-button"
          onClick={() => setShowSettings(!showSettings)}
          title="Stream Settings"
        >
          ⚙️
        </button>
        
        <button
          className="control-button"
          title="Share Stream"
        >
          📤
        </button>
        
        <button
          className="control-button"
          title="Stream Health"
        >
          📊
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>Stream Settings</h3>
            <button
              className="close-button"
              onClick={() => setShowSettings(false)}
            >
              ✕
            </button>
          </div>
          
          <div className="settings-content">
            <div className="setting-group">
              <label htmlFor="stream-title">Stream Title</label>
              <input
                id="stream-title"
                type="text"
                value={settings.title || ''}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                placeholder="Enter stream title"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="stream-description">Description</label>
              <textarea
                id="stream-description"
                value={settings.description || ''}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                placeholder="Describe your stream"
                rows={3}
              />
            </div>

            <div className="setting-group">
              <label htmlFor="stream-category">Category</label>
              <select
                id="stream-category"
                value={settings.category || ''}
                onChange={(e) => setSettings({ ...settings, category: e.target.value })}
              >
                <option value="">Select category</option>
                <option value="Gaming">Gaming</option>
                <option value="Music">Music</option>
                <option value="Art">Art</option>
                <option value="Education">Education</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Technology">Technology</option>
                <option value="Sports">Sports</option>
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="stream-privacy">Privacy</label>
              <select
                id="stream-privacy"
                value={settings.privacy || 'public'}
                onChange={(e) => setSettings({ ...settings, privacy: e.target.value as any })}
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Monetization</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.monetization?.superChatEnabled || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      monetization: {
                        ...settings.monetization,
                        enabled: true,
                        superChatEnabled: e.target.checked,
                        donationsEnabled: settings.monetization?.donationsEnabled || false,
                        subscriptionRequired: settings.monetization?.subscriptionRequired || false
                      }
                    })}
                  />
                  Enable Super Chat
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.monetization?.donationsEnabled || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      monetization: {
                        ...settings.monetization,
                        enabled: true,
                        superChatEnabled: settings.monetization?.superChatEnabled || false,
                        donationsEnabled: e.target.checked,
                        subscriptionRequired: settings.monetization?.subscriptionRequired || false
                      }
                    })}
                  />
                  Enable Donations
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.monetization?.subscriptionRequired || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      monetization: {
                        ...settings.monetization,
                        enabled: true,
                        superChatEnabled: settings.monetization?.superChatEnabled || false,
                        donationsEnabled: settings.monetization?.donationsEnabled || false,
                        subscriptionRequired: e.target.checked
                      }
                    })}
                  />
                  Subscriber Only Mode
                </label>
              </div>
            </div>

            <div className="setting-group">
              <label>Recording</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.recording?.enabled || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      recording: {
                        ...settings.recording,
                        enabled: e.target.checked,
                        quality: settings.recording?.quality || '1080p'
                      }
                    })}
                  />
                  Record Stream
                </label>
                {settings.recording?.enabled && (
                  <select
                    value={settings.recording?.quality || '1080p'}
                    onChange={(e) => setSettings({
                      ...settings,
                      recording: {
                        ...settings.recording,
                        enabled: true,
                        quality: e.target.value as any
                      }
                    })}
                  >
                    <option value="source">Source Quality</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                  </select>
                )}
              </div>
            </div>

            <div className="settings-actions">
              <button
                className="save-button"
                onClick={handleSettingsUpdate}
              >
                Save Changes
              </button>
              <button
                className="cancel-button"
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="quick-actions">
        <QuickAction
          icon="🎥"
          label="Camera"
          onClick={() => {/* Toggle camera */}}
        />
        <QuickAction
          icon="🎤"
          label="Microphone"
          onClick={() => {/* Toggle microphone */}}
        />
        <QuickAction
          icon="🖥️"
          label="Screen Share"
          onClick={() => {/* Toggle screen share */}}
        />
        <QuickAction
          icon="💬"
          label="Chat Settings"
          onClick={() => {/* Open chat settings */}}
        />
      </div>
    </div>
  );
};

interface QuickActionProps {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, onClick, active = false }) => (
  <button
    className={`quick-action ${active ? 'active' : ''}`}
    onClick={onClick}
    title={label}
  >
    <span className="action-icon">{icon}</span>
    <span className="action-label">{label}</span>
  </button>
);