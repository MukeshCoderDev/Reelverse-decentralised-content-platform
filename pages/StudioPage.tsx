import React from 'react';
import Icon from '../components/Icon';

const StudioPage: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-secondary rounded-lg border border-border">
      <Icon name="gauge" size={64} className="text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold">Creator Studio Dashboard</h2>
      <p className="text-muted-foreground mt-2">Your dashboard for analytics, content, and monetization will be here.</p>
    </div>
  );
};

export default StudioPage;