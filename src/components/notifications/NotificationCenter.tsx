import React, { useState, useEffect, useRef } from 'react';
import { notificationService, Notification, NotificationStats } from '../../services/notifications/NotificationService';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const centerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      loadStats();
    }
  }, [isOpen, selectedCategory, showUnreadOnly]);

  useEffect(() => {
    const handleNotificationReceived = (notification: Notification) => {
      if (isOpen) {
        loadNotifications();
        loadStats();
      }
    };

    const handleNotificationRead = () => {
      if (isOpen) {
        loadNotifications();
        loadStats();
      }
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
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const loadNotifications = () => {
    setIsLoading(true);
    const options = {
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      unreadOnly: showUnreadOnly,
      limit: 50
    };
    
    const notifs = notificationService.getNotifications(options);
    setNotifications(notifs);
    setIsLoading(false);
  };

  const loadStats = () => {
    const notificationStats = notificationService.getStats();
    setStats(notificationStats);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      notificationService.markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }
  };

  const handleMarkAllRead = () => {
    const category = selectedCategory !== 'all' ? selectedCategory : undefined;
    notificationService.markAllAsRead(category);
  };

  const handleClearAll = () => {
    const category = selectedCategory !== 'all' ? selectedCategory : undefined;
    notificationService.clearAll(category);
  };

  const handleRemoveNotification = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    notificationService.removeNotification(id);
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

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: '#ff4444',
      high: '#ff8800',
      medium: '#0066cc',
      low: '#666666'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const categories = stats ? Object.keys(stats.byCategory) : [];

  if (!isOpen) return null;

  return (
    <div className="notification-center-overlay">
      <div ref={centerRef} className={`notification-center ${className}`}>
        {/* Header */}
        <div className="notification-header">
          <div className="header-left">
            <h3>Notifications</h3>
            {stats && (
              <span className="notification-count">
                {stats.unread > 0 && (
                  <span className="unread-badge">{stats.unread}</span>
                )}
                {stats.total} total
              </span>
            )}
          </div>
          
          <div className="header-actions">
            <button
              className="header-action"
              onClick={handleMarkAllRead}
              disabled={!stats || stats.unread === 0}
              title="Mark all as read"
            >
              ✓
            </button>
            <button
              className="header-action"
              onClick={handleClearAll}
              title="Clear all"
            >
              🗑️
            </button>
            <button
              className="header-action close-button"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="notification-filters">
          <div className="category-filter">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-select"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                  {stats && ` (${stats.byCategory[category]})`}
                </option>
              ))}
            </select>
          </div>

          <label className="unread-filter">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
            />
            <span>Unread only</span>
          </label>
        </div>

        {/* Notifications List */}
        <div className="notifications-list">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <span>Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <div className="empty-title">No notifications</div>
              <div className="empty-message">
                {showUnreadOnly ? 'All caught up!' : 'You have no notifications yet.'}
              </div>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`notification-item ${notification.read ? 'read' : 'unread'} priority-${notification.priority}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-content">
                  <div className="notification-header-item">
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="notification-meta">
                      <span className="notification-category">
                        {notification.category}
                      </span>
                      <span className="notification-time">
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>
                    <div
                      className="priority-indicator"
                      style={{ backgroundColor: getPriorityColor(notification.priority) }}
                    />
                  </div>
                  
                  <div className="notification-body">
                    <h4 className="notification-title">{notification.title}</h4>
                    <p className="notification-message">{notification.message}</p>
                    
                    {notification.actionLabel && (
                      <div className="notification-action">
                        <span className="action-label">{notification.actionLabel}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="remove-notification"
                  onClick={(e) => handleRemoveNotification(notification.id, e)}
                  title="Remove notification"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="notification-footer">
            <button
              className="footer-action"
              onClick={() => {/* Open notification settings */}}
            >
              ⚙️ Settings
            </button>
            <button
              className="footer-action"
              onClick={() => {/* View all notifications */}}
            >
              View All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};