import React, { useState, useEffect } from 'react';
import { notificationService, Notification } from '../../services/notifications/NotificationService';

interface InAppNotificationProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  maxVisible?: number;
  autoHideDuration?: number;
}

export const InAppNotification: React.FC<InAppNotificationProps> = ({
  position = 'top-right',
  maxVisible = 5,
  autoHideDuration = 5000
}) => {
  const [notifications, setNotifications] = useState<Array<Notification & { isVisible: boolean }>>([]);

  useEffect(() => {
    const handleShowInApp = (notification: Notification) => {
      setNotifications(prev => {
        // Remove oldest if at max capacity
        let updated = prev.length >= maxVisible ? prev.slice(1) : prev;
        
        // Add new notification
        updated = [...updated, { ...notification, isVisible: true }];
        
        return updated;
      });

      // Auto-hide after duration (unless urgent)
      if (notification.priority !== 'urgent') {
        setTimeout(() => {
          hideNotification(notification.id);
        }, autoHideDuration);
      }
    };

    notificationService.on('showInApp', handleShowInApp);

    return () => {
      notificationService.off('showInApp', handleShowInApp);
    };
  }, [maxVisible, autoHideDuration]);

  const hideNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, isVisible: false }
          : notification
      )
    );

    // Remove from array after animation
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 300);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      notificationService.markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }

    hideNotification(notification.id);
  };

  const handleDismiss = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    hideNotification(id);
  };

  const getNotificationIcon = (type: string) => {
    const icons = {
      live: '🔴',
      monetization: '💰',
      social: '👥',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };
    return icons[type as keyof typeof icons] || icons.info;
  };

  const getNotificationColor = (type: string) => {
    const colors = {
      live: '#ff4444',
      monetization: '#4ade80',
      social: '#0066cc',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#0066cc'
    };
    return colors[type as keyof typeof colors] || colors.info;
  };

  if (notifications.length === 0) return null;

  return (
    <div className={`in-app-notifications ${position}`}>
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`in-app-notification ${notification.type} priority-${notification.priority} ${notification.isVisible ? 'visible' : 'hidden'}`}
          onClick={() => handleNotificationClick(notification)}
          style={{
            borderLeftColor: getNotificationColor(notification.type)
          }}
        >
          <div className="notification-content">
            <div className="notification-header">
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-meta">
                <span className="notification-category">
                  {notification.category}
                </span>
                {notification.priority === 'urgent' && (
                  <span className="urgent-indicator">URGENT</span>
                )}
              </div>
              <button
                className="dismiss-button"
                onClick={(e) => handleDismiss(notification.id, e)}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
            
            <div className="notification-body">
              <h4 className="notification-title">{notification.title}</h4>
              <p className="notification-message">{notification.message}</p>
              
              {notification.actionLabel && (
                <div className="notification-action">
                  <span className="action-label">{notification.actionLabel} →</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar for auto-hide */}
          {notification.priority !== 'urgent' && (
            <div className="auto-hide-progress">
              <div 
                className="progress-bar"
                style={{
                  animationDuration: `${autoHideDuration}ms`
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};