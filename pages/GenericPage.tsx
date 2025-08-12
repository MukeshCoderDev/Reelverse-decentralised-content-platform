import React from 'react';
import Icon from '../components/Icon';
import { IconName } from '../types';

interface GenericPageProps {
  title: string;
}

const GenericPage: React.FC<GenericPageProps> = ({ title }) => {
  // A simple map to get a relevant icon, or a default one
  const iconMap: { [key: string]: IconName } = {
    'Explore': 'search',
    'Subscriptions': 'badge-dollar',
    'Communities': 'users-round',
    'Notifications': 'bell',
    'Inbox': 'mail',
    'Your Profile': 'person',
    'History': 'clock',
    'Liked Videos': 'star',
    'Watch Later': 'timer',
    'Collections': 'folder',
    'Collects & Purchases': 'diamond',
    'Wallet': 'wallet',
    'Settings': 'settings'
  };
  const iconName = iconMap[title] || 'file-dashed';

  return (
    <div className="h-full flex flex-col items-center justify-center bg-secondary/50 rounded-lg border border-border text-center p-4">
      <Icon name={iconName} size={64} className="text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted-foreground mt-2">This page is under construction.</p>
      <p className="text-sm text-muted-foreground mt-1">Functionality for '{title}' will be implemented soon.</p>
    </div>
  );
};

export default GenericPage;