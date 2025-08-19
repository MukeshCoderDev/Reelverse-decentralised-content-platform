import React, { useState } from 'react';
import { LiveStreamDashboard } from '../components/live-streaming';
import '../components/live-streaming/LiveStreaming.css';
import { SessionKeyProvider, useSessionKey } from '../components/wallet/SessionKeyProvider';
import SponsoredActionButton from '../components/actions/SponsoredActionButton';

const LiveStreamDemoContent: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const userId = 'demo_user_123'; // Mock user ID
  const { smartAccountAddress, loading: sessionLoading } = useSessionKey();

  const handleStreamEnd = () => {
    setIsStreaming(false);
  };

  return (
    <div className="live-stream-demo">
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h3>Account Abstraction Demo</h3>
        {sessionLoading ? (
          <p>Loading smart account...</p>
        ) : (
          <p>Smart Account Address: {smartAccountAddress || 'Not available'}</p>
        )}
      </div>
      <LiveStreamDashboard
        userId={userId}
        onStreamEnd={handleStreamEnd}
      />
      <div style={{ marginTop: '20px' }}>
        <h4>Sponsored Action Demo</h4>
        <SponsoredActionButton target="like" contentId="demo_video_123" />
      </div>
    </div>
  );
};

export const LiveStreamDemo: React.FC = () => {
  return (
    <SessionKeyProvider>
      <LiveStreamDemoContent />
    </SessionKeyProvider>
  );
};

export default LiveStreamDemo;