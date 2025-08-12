import React, { useState, useEffect } from 'react';
import { LiveStreamingOrchestrator, StreamDashboard } from '../../services/LiveStreamingOrchestrator';
import { StreamSettings, StreamConfig } from '../../services/streaming/StreamingService';
import { LiveStreamControls } from './LiveStreamControls';
import { LiveChatPanel } from './LiveChatPanel';
import { StreamAnalytics } from './StreamAnalytics';
import { MonetizationPanel } from './MonetizationPanel';
import { ModerationPanel } from './ModerationPanel';

interface LiveStreamDashboardProps {
  userId: string;
  onStreamEnd?: () => void;
}

export const LiveStreamDashboard: React.FC<LiveStreamDashboardProps> = ({
  userId,
  onStreamEnd
}) => {
  const [orchestrator] = useState(() => new LiveStreamingOrchestrator());
  const [dashboard, setDashboard] = useState<StreamDashboard | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'analytics' | 'monetization' | 'moderation'>('chat');

  useEffect(() => {
    const updateDashboard = () => {
      const dashboardData = orchestrator.getDashboard();
      setDashboard(dashboardData);
    };

    const handleStreamEvent = (event: any) => {
      if (event.type === 'started') {
        setIsLive(true);
      } else if (event.type === 'ended') {
        setIsLive(false);
        onStreamEnd?.();
      }
      updateDashboard();
    };

    const handleViewerCountChanged = () => {
      updateDashboard();
    };

    const handleMetricsUpdated = () => {
      updateDashboard();
    };

    orchestrator.on('streamEvent', handleStreamEvent);
    orchestrator.on('viewerCountChanged', handleViewerCountChanged);
    orchestrator.on('metricsUpdated', handleMetricsUpdated);
    orchestrator.on('analyticsUpdate', updateDashboard);
    orchestrator.on('monetizationEvent', updateDashboard);

    // Update dashboard every 5 seconds
    const interval = setInterval(updateDashboard, 5000);

    return () => {
      orchestrator.removeAllListeners();
      clearInterval(interval);
    };
  }, [orchestrator, onStreamEnd]);

  const handleInitializeStream = async (settings: StreamSettings, config: StreamConfig) => {
    try {
      await orchestrator.initializeStream(userId, settings, config);
      setIsInitialized(true);
      setDashboard(orchestrator.getDashboard());
    } catch (error) {
      console.error('Failed to initialize stream:', error);
    }
  };

  const handleStartStream = async () => {
    try {
      await orchestrator.startLiveStream();
    } catch (error) {
      console.error('Failed to start stream:', error);
    }
  };

  const handleStopStream = async () => {
    try {
      await orchestrator.stopLiveStream();
    } catch (error) {
      console.error('Failed to stop stream:', error);
    }
  };

  if (!isInitialized) {
    return (
      <StreamSetup
        onInitialize={handleInitializeStream}
      />
    );
  }

  return (
    <div className="live-stream-dashboard">
      {/* Header with stream status and controls */}
      <div className="dashboard-header">
        <div className="stream-status">
          <div className={`status-indicator ${isLive ? 'live' : 'offline'}`}>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </div>
          {dashboard?.stream && (
            <div className="stream-info">
              <h2>{dashboard.stream.settings.title}</h2>
              <div className="stream-stats">
                <span className="viewer-count">
                  👥 {dashboard.stream.viewerCount} viewers
                </span>
                <span className="stream-quality">
                  📊 {dashboard.performance.quality}
                </span>
                <span className="stream-uptime">
                  ⏱️ {formatUptime(dashboard.performance.uptime)}
                </span>
              </div>
            </div>
          )}
        </div>
        
        <LiveStreamControls
          isLive={isLive}
          onStart={handleStartStream}
          onStop={handleStopStream}
          orchestrator={orchestrator}
        />
      </div>

      {/* Main dashboard content */}
      <div className="dashboard-content">
        {/* Left panel - Stream preview and controls */}
        <div className="stream-panel">
          <div className="stream-preview">
            {isLive ? (
              <video
                className="stream-video"
                autoPlay
                muted
                playsInline
              />
            ) : (
              <div className="stream-placeholder">
                <div className="placeholder-content">
                  <h3>Stream Preview</h3>
                  <p>Your stream will appear here when live</p>
                </div>
              </div>
            )}
          </div>

          {/* Stream metrics */}
          {dashboard && (
            <div className="stream-metrics">
              <div className="metric">
                <span className="metric-label">Bitrate</span>
                <span className="metric-value">{dashboard.performance.bitrate} kbps</span>
              </div>
              <div className="metric">
                <span className="metric-label">Latency</span>
                <span className="metric-value">{dashboard.performance.latency} ms</span>
              </div>
              <div className="metric">
                <span className="metric-label">Revenue</span>
                <span className="metric-value">${dashboard.revenue.totalRevenue.toFixed(2)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Messages</span>
                <span className="metric-value">{dashboard.chatStats.messageCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right panel - Tabs for different features */}
        <div className="feature-panel">
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat
            </button>
            <button
              className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              📊 Analytics
            </button>
            <button
              className={`tab-button ${activeTab === 'monetization' ? 'active' : ''}`}
              onClick={() => setActiveTab('monetization')}
            >
              💰 Revenue
            </button>
            <button
              className={`tab-button ${activeTab === 'moderation' ? 'active' : ''}`}
              onClick={() => setActiveTab('moderation')}
            >
              🛡️ Moderation
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'chat' && (
              <LiveChatPanel orchestrator={orchestrator} />
            )}
            {activeTab === 'analytics' && dashboard && (
              <StreamAnalytics
                metrics={dashboard.metrics}
                performance={dashboard.performance}
                orchestrator={orchestrator}
              />
            )}
            {activeTab === 'monetization' && (
              <MonetizationPanel orchestrator={orchestrator} />
            )}
            {activeTab === 'moderation' && (
              <ModerationPanel orchestrator={orchestrator} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Stream setup component for initial configuration
const StreamSetup: React.FC<{
  onInitialize: (settings: StreamSettings, config: StreamConfig) => void;
}> = ({ onInitialize }) => {
  const [settings, setSettings] = useState<StreamSettings>({
    title: '',
    description: '',
    privacy: 'public',
    category: 'Gaming',
    tags: [],
    monetization: {
      enabled: true,
      superChatEnabled: true,
      donationsEnabled: true,
      subscriptionRequired: false
    },
    recording: {
      enabled: true,
      quality: '1080p'
    }
  });

  const [config, setConfig] = useState<StreamConfig>({
    video: {
      width: 1920,
      height: 1080,
      frameRate: 30,
      bitrate: 5000
    },
    audio: {
      sampleRate: 48000,
      bitrate: 128,
      channels: 2
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInitialize(settings, config);
  };

  return (
    <div className="stream-setup">
      <h2>Set Up Your Live Stream</h2>
      <form onSubmit={handleSubmit} className="setup-form">
        <div className="form-group">
          <label htmlFor="title">Stream Title</label>
          <input
            id="title"
            type="text"
            value={settings.title}
            onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={settings.description}
            onChange={(e) => setSettings({ ...settings, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="privacy">Privacy</label>
            <select
              id="privacy"
              value={settings.privacy}
              onChange={(e) => setSettings({ ...settings, privacy: e.target.value as any })}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={settings.category}
              onChange={(e) => setSettings({ ...settings, category: e.target.value })}
            >
              <option value="Gaming">Gaming</option>
              <option value="Music">Music</option>
              <option value="Art">Art</option>
              <option value="Education">Education</option>
              <option value="Entertainment">Entertainment</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Quality Settings</label>
          <div className="quality-options">
            <label className="checkbox-label">
              <input
                type="radio"
                name="quality"
                checked={config.video.height === 1080}
                onChange={() => setConfig({
                  ...config,
                  video: { ...config.video, width: 1920, height: 1080, bitrate: 5000 }
                })}
              />
              1080p (Recommended)
            </label>
            <label className="checkbox-label">
              <input
                type="radio"
                name="quality"
                checked={config.video.height === 720}
                onChange={() => setConfig({
                  ...config,
                  video: { ...config.video, width: 1280, height: 720, bitrate: 3000 }
                })}
              />
              720p
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Monetization</label>
          <div className="monetization-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.monetization.superChatEnabled}
                onChange={(e) => setSettings({
                  ...settings,
                  monetization: { ...settings.monetization, superChatEnabled: e.target.checked }
                })}
              />
              Enable Super Chat
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.monetization.donationsEnabled}
                onChange={(e) => setSettings({
                  ...settings,
                  monetization: { ...settings.monetization, donationsEnabled: e.target.checked }
                })}
              />
              Enable Donations
            </label>
          </div>
        </div>

        <button type="submit" className="setup-button">
          Initialize Stream
        </button>
      </form>
    </div>
  );
};

const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};