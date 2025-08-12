import React, { useState } from 'react';
import { LiveStreamDashboard } from '../components/live-streaming';
import '../components/live-streaming/LiveStreaming.css';

export const LiveStreamDemo: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const userId = 'demo_user_123'; // Mock user ID

  const handleStreamEnd = () => {
    setIsStreaming(false);
  };

  return (
    <div className="live-stream-demo">
      <LiveStreamDashboard
        userId={userId}
        onStreamEnd={handleStreamEnd}
      />
    </div>
  );
};

export default LiveStreamDemo;