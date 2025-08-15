import React from 'react';
import { PublicScoreboard } from '../components/metrics/PublicScoreboard';

export const ScoreboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900">
      <PublicScoreboard />
    </div>
  );
};