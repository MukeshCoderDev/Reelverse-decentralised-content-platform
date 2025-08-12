import React, { useState, useEffect } from 'react';
import { notificationService, NotificationStats } from '../../services/notifications/NotificationService';
import { NotificationCenter } from './NotificationCenter';

interface NotificationBellProps {
  className?: string;
  showBadge?: boolean;
  maxBadgeCount?: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  className = '',
  showBadge = true,
  maxBadgeCount = 99
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Load initial stats
    loadStats();

    // Listen for notification events
    const handleNotificationReceived = () => {
      loadStats();
      triggerAnimation();
    };

    const handleNotificationRead = () => {
      loadStats();
    };

    notificationService.on('notificationReceived', handleNotificationReceived);
    notificationService.on('notificationRead', handleNotificationRead);
    notificationService.on('notificationsRead', handleNotificationRead);
    notificationService.on('notificationRemoved', handleNotificationRead);
    notificationService.on('notificationsCleared', handleNotificationRead);

    return () => {
      notificationService.off('notificationReceived', handleNotificationReceived);
      notificationService.off('notificationRead', handleNotificationRead);
      notificationService.off('notificationsRead', handleNotificationRead);
      notificationService.off('notificationRemoved', handleNotificationRead);
      notificationService.off('notificationsCleared', handleNotificationRead);
    };
  }, []);

  const loadStats = () => {
    const notificationStats = notificationService.getStats();
    setStats(notificationStats);
  };

  const triggerAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const formatBadgeCount = (count: number): string => {
    if (count > maxBadgeCount) {
      return `${maxBadgeCount}+`;
    }
    return count.toString();
  };

  const hasUnread = stats && stats.unread > 0;

  return (
    <>
      <button
        className={`notification-bell ${className} ${isAnimating ? 'animating' : ''} ${hasUnread ? 'has-unread' : ''}`}
        onClick={handleClick}
        title={`${stats?.unread || 0} unread notifications`}
      >
        <div className="bell-icon">
          🔔
        </div>
        
        {showBadge && hasUnread && (
          <div className="notification-badge">
            {formatBadgeCount(stats.unread)}
          </div>
        )}
        
        {/* Pulse animation for new notifications */}
        {isAnimating && (
          <div className="notification-pulse" />
        )}
      </button>

      <NotificationCenter
        isOpen={isOpen}
        onClose={handleClose}
      />
    </>
  );
};