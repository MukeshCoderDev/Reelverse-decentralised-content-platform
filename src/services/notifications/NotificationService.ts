import { EventEmitter } from 'events';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'live' | 'monetization' | 'social';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  persistent?: boolean;
}

export interface NotificationPreferences {
  enabled: boolean;
  categories: {
    [key: string]: {
      enabled: boolean;
      pushEnabled: boolean;
      emailEnabled: boolean;
      inAppEnabled: boolean;
      sound: boolean;
      vibration: boolean;
    };
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
  batchDelivery: {
    enabled: boolean;
    interval: number; // minutes
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export class NotificationService extends EventEmitter {
  private notifications: Map<string, Notification> = new Map();
  private preferences: NotificationPreferences;
  private batchQueue: Notification[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isSupported: boolean;

  constructor() {
    super();
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.preferences = this.getDefaultPreferences();
    this.loadPreferences();
    this.requestPermission();
    this.setupServiceWorker();
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      categories: {
        live: {
          enabled: true,
          pushEnabled: true,
          emailEnabled: false,
          inAppEnabled: true,
          sound: true,
          vibration: true
        },
        monetization: {
          enabled: true,
          pushEnabled: true,
          emailEnabled: true,
          inAppEnabled: true,
          sound: true,
          vibration: false
        },
        social: {
          enabled: true,
          pushEnabled: false,
          emailEnabled: false,
          inAppEnabled: true,
          sound: false,
          vibration: false
        },
        system: {
          enabled: true,
          pushEnabled: true,
          emailEnabled: false,
          inAppEnabled: true,
          sound: false,
          vibration: false
        },
        security: {
          enabled: true,
          pushEnabled: true,
          emailEnabled: true,
          inAppEnabled: true,
          sound: true,
          vibration: true
        }
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      batchDelivery: {
        enabled: false,
        interval: 15
      }
    };
  }

  private loadPreferences() {
    const saved = localStorage.getItem('notificationPreferences');
    if (saved) {
      try {
        this.preferences = { ...this.preferences, ...JSON.parse(saved) };
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      }
    }
  }

  private savePreferences() {
    localStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
  }

  private async requestPermission(): Promise<boolean> {
    if (!this.isSupported) return false;

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  private async setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async sendNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<string> {
    const id = this.generateId();
    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false
    };

    // Check if notifications are enabled for this category
    const categoryPrefs = this.preferences.categories[notification.category];
    if (!this.preferences.enabled || !categoryPrefs?.enabled) {
      return id;
    }

    // Check quiet hours
    if (this.isQuietHours()) {
      // Store for later delivery unless urgent
      if (notification.priority !== 'urgent') {
        this.storeForLater(fullNotification);
        return id;
      }
    }

    // Add to notifications store
    this.notifications.set(id, fullNotification);

    // Handle batch delivery
    if (this.preferences.batchDelivery.enabled && notification.priority !== 'urgent') {
      this.addToBatch(fullNotification);
    } else {
      await this.deliverNotification(fullNotification);
    }

    // Emit event for real-time updates
    this.emit('notificationReceived', fullNotification);

    // Auto-expire if set
    if (fullNotification.expiresAt) {
      setTimeout(() => {
        this.removeNotification(id);
      }, fullNotification.expiresAt.getTime() - Date.now());
    }

    return id;
  }

  private async deliverNotification(notification: Notification) {
    const categoryPrefs = this.preferences.categories[notification.category];
    if (!categoryPrefs) return;

    // In-app notification
    if (categoryPrefs.inAppEnabled) {
      this.showInAppNotification(notification);
    }

    // Push notification
    if (categoryPrefs.pushEnabled && this.isSupported) {
      await this.showPushNotification(notification);
    }

    // Sound and vibration
    if (categoryPrefs.sound) {
      this.playNotificationSound(notification.type);
    }

    if (categoryPrefs.vibration && 'vibrate' in navigator) {
      navigator.vibrate(this.getVibrationPattern(notification.priority));
    }

    // Email notification (would be handled by backend)
    if (categoryPrefs.emailEnabled) {
      this.scheduleEmailNotification(notification);
    }
  }

  private showInAppNotification(notification: Notification) {
    this.emit('showInApp', notification);
  }

  private async showPushNotification(notification: Notification) {
    if (Notification.permission !== 'granted') return;

    const options: NotificationOptions = {
      body: notification.message,
      icon: this.getNotificationIcon(notification.type),
      badge: '/icons/badge.png',
      tag: notification.category,
      requireInteraction: notification.priority === 'urgent',
      silent: false,
      data: {
        id: notification.id,
        actionUrl: notification.actionUrl,
        category: notification.category
      }
    };

    // Add action buttons
    if (notification.actionUrl && notification.actionLabel) {
      options.actions = [
        {
          action: 'open',
          title: notification.actionLabel,
          icon: '/icons/open.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ];
    }

    const pushNotification = new Notification(notification.title, options);

    pushNotification.onclick = () => {
      if (notification.actionUrl) {
        window.open(notification.actionUrl, '_blank');
      }
      pushNotification.close();
      this.markAsRead(notification.id);
    };

    // Auto-close after delay
    setTimeout(() => {
      pushNotification.close();
    }, 10000);
  }

  private playNotificationSound(type: string) {
    const audio = new Audio();
    switch (type) {
      case 'live':
        audio.src = '/sounds/live-notification.mp3';
        break;
      case 'monetization':
        audio.src = '/sounds/money-notification.mp3';
        break;
      case 'error':
        audio.src = '/sounds/error-notification.mp3';
        break;
      default:
        audio.src = '/sounds/default-notification.mp3';
    }
    
    audio.volume = 0.5;
    audio.play().catch(error => {
      console.warn('Could not play notification sound:', error);
    });
  }

  private getVibrationPattern(priority: string): number[] {
    switch (priority) {
      case 'urgent':
        return [200, 100, 200, 100, 200];
      case 'high':
        return [100, 50, 100];
      case 'medium':
        return [100];
      default:
        return [50];
    }
  }

  private getNotificationIcon(type: string): string {
    const icons = {
      live: '/icons/live.png',
      monetization: '/icons/money.png',
      social: '/icons/social.png',
      error: '/icons/error.png',
      warning: '/icons/warning.png',
      success: '/icons/success.png',
      info: '/icons/info.png'
    };
    return icons[type as keyof typeof icons] || icons.info;
  }

  private scheduleEmailNotification(notification: Notification) {
    // In a real implementation, this would make an API call to schedule email
    console.log('Email notification scheduled:', notification.title);
  }

  private addToBatch(notification: Notification) {
    this.batchQueue.push(notification);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.deliverBatch();
      }, this.preferences.batchDelivery.interval * 60 * 1000);
    }
  }

  private async deliverBatch() {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;

    // Group by category
    const grouped = batch.reduce((acc, notification) => {
      if (!acc[notification.category]) {
        acc[notification.category] = [];
      }
      acc[notification.category].push(notification);
      return acc;
    }, {} as Record<string, Notification[]>);

    // Send batch notification for each category
    for (const [category, notifications] of Object.entries(grouped)) {
      const batchNotification: Notification = {
        id: this.generateId(),
        type: 'info',
        title: `${notifications.length} ${category} notifications`,
        message: notifications.map(n => n.title).join(', '),
        timestamp: new Date(),
        read: false,
        priority: 'medium',
        category: 'batch',
        metadata: {
          originalNotifications: notifications.map(n => n.id)
        }
      };

      await this.deliverNotification(batchNotification);
    }
  }

  private isQuietHours(): boolean {
    if (!this.preferences.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const start = this.preferences.quietHours.start;
    const end = this.preferences.quietHours.end;

    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Quiet hours span midnight
      return currentTime >= start || currentTime <= end;
    }
  }

  private storeForLater(notification: Notification) {
    // Store in localStorage for delivery after quiet hours
    const stored = JSON.parse(localStorage.getItem('delayedNotifications') || '[]');
    stored.push(notification);
    localStorage.setItem('delayedNotifications', JSON.stringify(stored));
  }

  markAsRead(id: string): boolean {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.read = true;
      this.emit('notificationRead', notification);
      return true;
    }
    return false;
  }

  markAllAsRead(category?: string): number {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (!notification.read && (!category || notification.category === category)) {
        notification.read = true;
        count++;
      }
    }
    
    if (count > 0) {
      this.emit('notificationsRead', { count, category });
    }
    
    return count;
  }

  removeNotification(id: string): boolean {
    const removed = this.notifications.delete(id);
    if (removed) {
      this.emit('notificationRemoved', id);
    }
    return removed;
  }

  clearAll(category?: string): number {
    let count = 0;
    const toRemove: string[] = [];

    for (const [id, notification] of this.notifications.entries()) {
      if (!category || notification.category === category) {
        if (!notification.persistent) {
          toRemove.push(id);
          count++;
        }
      }
    }

    toRemove.forEach(id => this.notifications.delete(id));
    
    if (count > 0) {
      this.emit('notificationsCleared', { count, category });
    }
    
    return count;
  }

  getNotifications(options: {
    category?: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Notification[] {
    const { category, unreadOnly = false, limit, offset = 0 } = options;
    
    let notifications = Array.from(this.notifications.values());

    // Filter by category
    if (category) {
      notifications = notifications.filter(n => n.category === category);
    }

    // Filter by read status
    if (unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (limit) {
      notifications = notifications.slice(offset, offset + limit);
    }

    return notifications;
  }

  getStats(): NotificationStats {
    const notifications = Array.from(this.notifications.values());
    
    const stats: NotificationStats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      byCategory: {},
      byType: {},
      byPriority: {}
    };

    notifications.forEach(notification => {
      // By category
      stats.byCategory[notification.category] = (stats.byCategory[notification.category] || 0) + 1;
      
      // By type
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
      
      // By priority
      stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;
    });

    return stats;
  }

  updatePreferences(preferences: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...preferences };
    this.savePreferences();
    this.emit('preferencesUpdated', this.preferences);
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  // Convenience methods for common notification types
  async sendLiveNotification(title: string, message: string, streamUrl?: string) {
    return this.sendNotification({
      type: 'live',
      title,
      message,
      priority: 'high',
      category: 'live',
      actionUrl: streamUrl,
      actionLabel: 'Watch Stream'
    });
  }

  async sendMonetizationNotification(title: string, message: string, amount?: number) {
    return this.sendNotification({
      type: 'monetization',
      title,
      message,
      priority: 'medium',
      category: 'monetization',
      metadata: { amount }
    });
  }

  async sendSocialNotification(title: string, message: string, profileUrl?: string) {
    return this.sendNotification({
      type: 'social',
      title,
      message,
      priority: 'low',
      category: 'social',
      actionUrl: profileUrl,
      actionLabel: 'View Profile'
    });
  }

  async sendSystemNotification(title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    return this.sendNotification({
      type: 'info',
      title,
      message,
      priority,
      category: 'system'
    });
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const notificationService = new NotificationService();