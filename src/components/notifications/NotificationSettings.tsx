import React, { useState, useEffect } from 'react';
import { notificationService, NotificationPreferences } from '../../services/notifications/NotificationService';

interface NotificationSettingsProps {
  onClose?: () => void;
  className?: string;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  onClose,
  className = ''
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = () => {
    const prefs = notificationService.getPreferences();
    setPreferences(prefs);
  };

  const handleGlobalToggle = (enabled: boolean) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      enabled
    });
    setHasChanges(true);
  };

  const handleCategoryToggle = (category: string, field: keyof NotificationPreferences['categories'][string], value: boolean) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      categories: {
        ...preferences.categories,
        [category]: {
          ...preferences.categories[category],
          [field]: value
        }
      }
    });
    setHasChanges(true);
  };

  const handleQuietHoursToggle = (enabled: boolean) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        enabled
      }
    });
    setHasChanges(true);
  };

  const handleQuietHoursTime = (field: 'start' | 'end', value: string) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [field]: value
      }
    });
    setHasChanges(true);
  };

  const handleBatchDeliveryToggle = (enabled: boolean) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      batchDelivery: {
        ...preferences.batchDelivery,
        enabled
      }
    });
    setHasChanges(true);
  };

  const handleBatchInterval = (interval: number) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      batchDelivery: {
        ...preferences.batchDelivery,
        interval
      }
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!preferences || !hasChanges) return;
    
    setIsSaving(true);
    
    try {
      notificationService.updatePreferences(preferences);
      setHasChanges(false);
      
      // Show success message
      await notificationService.sendSystemNotification(
        'Settings Saved',
        'Your notification preferences have been updated.',
        'low'
      );
    } catch (error) {
      console.error('Failed to save preferences:', error);
      
      // Show error message
      await notificationService.sendSystemNotification(
        'Save Failed',
        'Failed to save notification preferences. Please try again.',
        'high'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    loadPreferences();
    setHasChanges(false);
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await notificationService.sendSystemNotification(
          'Notifications Enabled',
          'You will now receive push notifications.',
          'low'
        );
      }
    }
  };

  if (!preferences) {
    return (
      <div className="notification-settings loading">
        <div className="loading-spinner"></div>
        <span>Loading settings...</span>
      </div>
    );
  }

  const categories = Object.keys(preferences.categories);
  const notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported';

  return (
    <div className={`notification-settings ${className}`}>
      <div className="settings-header">
        <h2>Notification Settings</h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="settings-content">
        {/* Global Settings */}
        <div className="settings-section">
          <h3>General</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Enable Notifications</label>
              <p className="setting-description">
                Turn all notifications on or off
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={preferences.enabled}
                onChange={(e) => handleGlobalToggle(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Browser Permission */}
          {notificationPermission !== 'granted' && (
            <div className="setting-item">
              <div className="setting-info">
                <label className="setting-label">Browser Notifications</label>
                <p className="setting-description">
                  {notificationPermission === 'denied' 
                    ? 'Browser notifications are blocked. Enable them in your browser settings.'
                    : 'Allow browser notifications to receive push notifications.'
                  }
                </p>
              </div>
              {notificationPermission === 'default' && (
                <button
                  className="permission-button"
                  onClick={requestNotificationPermission}
                >
                  Enable
                </button>
              )}
            </div>
          )}
        </div>

        {/* Category Settings */}
        <div className="settings-section">
          <h3>Notification Categories</h3>
          
          {categories.map(category => {
            const categoryPrefs = preferences.categories[category];
            return (
              <div key={category} className="category-settings">
                <div className="category-header">
                  <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={categoryPrefs.enabled}
                      onChange={(e) => handleCategoryToggle(category, 'enabled', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                
                {categoryPrefs.enabled && (
                  <div className="category-options">
                    <div className="option-row">
                      <label className="option-label">
                        <input
                          type="checkbox"
                          checked={categoryPrefs.inAppEnabled}
                          onChange={(e) => handleCategoryToggle(category, 'inAppEnabled', e.target.checked)}
                        />
                        In-app notifications
                      </label>
                      
                      <label className="option-label">
                        <input
                          type="checkbox"
                          checked={categoryPrefs.pushEnabled}
                          onChange={(e) => handleCategoryToggle(category, 'pushEnabled', e.target.checked)}
                        />
                        Push notifications
                      </label>
                    </div>
                    
                    <div className="option-row">
                      <label className="option-label">
                        <input
                          type="checkbox"
                          checked={categoryPrefs.sound}
                          onChange={(e) => handleCategoryToggle(category, 'sound', e.target.checked)}
                        />
                        Sound
                      </label>
                      
                      <label className="option-label">
                        <input
                          type="checkbox"
                          checked={categoryPrefs.vibration}
                          onChange={(e) => handleCategoryToggle(category, 'vibration', e.target.checked)}
                        />
                        Vibration
                      </label>
                    </div>
                    
                    <div className="option-row">
                      <label className="option-label">
                        <input
                          type="checkbox"
                          checked={categoryPrefs.emailEnabled}
                          onChange={(e) => handleCategoryToggle(category, 'emailEnabled', e.target.checked)}
                        />
                        Email notifications
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quiet Hours */}
        <div className="settings-section">
          <h3>Quiet Hours</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Enable Quiet Hours</label>
              <p className="setting-description">
                Pause non-urgent notifications during specified hours
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={preferences.quietHours.enabled}
                onChange={(e) => handleQuietHoursToggle(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {preferences.quietHours.enabled && (
            <div className="quiet-hours-settings">
              <div className="time-inputs">
                <div className="time-input">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) => handleQuietHoursTime('start', e.target.value)}
                  />
                </div>
                <div className="time-input">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) => handleQuietHoursTime('end', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Batch Delivery */}
        <div className="settings-section">
          <h3>Batch Delivery</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Enable Batch Delivery</label>
              <p className="setting-description">
                Group non-urgent notifications and deliver them together
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={preferences.batchDelivery.enabled}
                onChange={(e) => handleBatchDeliveryToggle(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {preferences.batchDelivery.enabled && (
            <div className="batch-settings">
              <div className="interval-setting">
                <label>Delivery Interval</label>
                <select
                  value={preferences.batchDelivery.interval}
                  onChange={(e) => handleBatchInterval(Number(e.target.value))}
                >
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="settings-footer">
        <div className="footer-actions">
          <button
            className="reset-button"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            Reset
          </button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        
        {hasChanges && (
          <p className="unsaved-changes">You have unsaved changes</p>
        )}
      </div>
    </div>
  );
};