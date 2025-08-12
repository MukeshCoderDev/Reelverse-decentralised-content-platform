import React, { useState, useEffect } from 'react';
import { LiveStreamingOrchestrator } from '../../services/LiveStreamingOrchestrator';

interface MonetizationPanelProps {
  orchestrator: LiveStreamingOrchestrator;
}

export const MonetizationPanel: React.FC<MonetizationPanelProps> = ({ orchestrator }) => {
  const [revenueData, setRevenueData] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [superChats, setSuperChats] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => {
    const updateMonetization = () => {
      const revenue = orchestrator.getRevenueData();
      const recentDonations = orchestrator.getRecentDonations();
      const recentSuperChats = orchestrator.getRecentSuperChats();
      const newSubscribers = orchestrator.getNewSubscribers();
      const activeGoals = orchestrator.getActiveGoals();

      setRevenueData(revenue);
      setDonations(recentDonations);
      setSuperChats(recentSuperChats);
      setSubscribers(newSubscribers);
      setGoals(activeGoals);
    };

    const handleMonetizationEvent = (event: any) => {
      updateMonetization();
    };

    orchestrator.on('monetizationEvent', handleMonetizationEvent);
    orchestrator.on('donationReceived', handleMonetizationEvent);
    orchestrator.on('superChatReceived', handleMonetizationEvent);
    orchestrator.on('newSubscriber', handleMonetizationEvent);

    updateMonetization();

    return () => {
      orchestrator.off('monetizationEvent', handleMonetizationEvent);
      orchestrator.off('donationReceived', handleMonetizationEvent);
      orchestrator.off('superChatReceived', handleMonetizationEvent);
      orchestrator.off('newSubscriber', handleMonetizationEvent);
    };
  }, [orchestrator]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="monetization-panel">
      {/* Revenue overview */}
      <div className="revenue-overview">
        <h3>Live Revenue</h3>
        {revenueData && (
          <div className="revenue-cards">
            <div className="revenue-card total">
              <div className="card-icon">💰</div>
              <div className="card-content">
                <div className="card-value">{formatCurrency(revenueData.total)}</div>
                <div className="card-label">Total Revenue</div>
              </div>
            </div>
            
            <div className="revenue-card donations">
              <div className="card-icon">🎁</div>
              <div className="card-content">
                <div className="card-value">{formatCurrency(revenueData.donations)}</div>
                <div className="card-label">Donations</div>
                <div className="card-count">{donations.length} donations</div>
              </div>
            </div>
            
            <div className="revenue-card super-chat">
              <div className="card-icon">💬</div>
              <div className="card-content">
                <div className="card-value">{formatCurrency(revenueData.superChat)}</div>
                <div className="card-label">Super Chat</div>
                <div className="card-count">{superChats.length} messages</div>
              </div>
            </div>
            
            <div className="revenue-card subscriptions">
              <div className="card-icon">⭐</div>
              <div className="card-content">
                <div className="card-value">{formatCurrency(revenueData.subscriptions)}</div>
                <div className="card-label">New Subs</div>
                <div className="card-count">{subscribers.length} subscribers</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Goals section */}
      <div className="goals-section">
        <h4>Stream Goals</h4>
        <div className="goals-list">
          {goals.map((goal) => (
            <div key={goal.id} className="goal-item">
              <div className="goal-info">
                <span className="goal-title">{goal.title}</span>
                <span className="goal-progress">
                  {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                </span>
              </div>
              <div className="goal-bar">
                <div
                  className="goal-fill"
                  style={{ width: `${(goal.current / goal.target) * 100}%` }}
                />
              </div>
              <div className="goal-percentage">
                {Math.round((goal.current / goal.target) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="activity-section">
        <div className="activity-tabs">
          <div className="tab-content">
            {/* Recent donations */}
            <div className="activity-list donations-list">
              <h4>Recent Donations</h4>
              {donations.length > 0 ? (
                donations.slice(0, 10).map((donation) => (
                  <div key={donation.id} className="activity-item donation">
                    <div className="activity-avatar">
                      {donation.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-username">{donation.username}</span>
                        <span className="activity-amount">{formatCurrency(donation.amount)}</span>
                        <span className="activity-time">{formatTime(donation.timestamp)}</span>
                      </div>
                      {donation.message && (
                        <div className="activity-message">{donation.message}</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-activity">No donations yet</div>
              )}
            </div>

            {/* Recent super chats */}
            <div className="activity-list super-chats-list">
              <h4>Recent Super Chats</h4>
              {superChats.length > 0 ? (
                superChats.slice(0, 10).map((superChat) => (
                  <div key={superChat.id} className="activity-item super-chat">
                    <div className="activity-avatar">
                      {superChat.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-username">{superChat.username}</span>
                        <span className="activity-amount super-chat-amount">
                          {formatCurrency(superChat.amount)}
                        </span>
                        <span className="activity-time">{formatTime(superChat.timestamp)}</span>
                      </div>
                      <div className="activity-message super-chat-message">
                        {superChat.message}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-activity">No Super Chats yet</div>
              )}
            </div>

            {/* New subscribers */}
            <div className="activity-list subscribers-list">
              <h4>New Subscribers</h4>
              {subscribers.length > 0 ? (
                subscribers.slice(0, 10).map((subscriber) => (
                  <div key={subscriber.id} className="activity-item subscriber">
                    <div className="activity-avatar">
                      {subscriber.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-username">{subscriber.username}</span>
                        <span className="activity-tier">{subscriber.tier}</span>
                        <span className="activity-time">{formatTime(subscriber.timestamp)}</span>
                      </div>
                      <div className="activity-message">
                        Subscribed at {subscriber.tier} tier
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-activity">No new subscribers yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue settings */}
      <div className="revenue-settings">
        <h4>Monetization Settings</h4>
        <div className="settings-grid">
          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                defaultChecked
                onChange={(e) => orchestrator.updateMonetizationSettings({
                  donationsEnabled: e.target.checked
                })}
              />
              Enable Donations
            </label>
          </div>
          
          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                defaultChecked
                onChange={(e) => orchestrator.updateMonetizationSettings({
                  superChatEnabled: e.target.checked
                })}
              />
              Enable Super Chat
            </label>
          </div>
          
          <div className="setting-item">
            <label className="setting-label">
              Minimum Donation Amount
            </label>
            <input
              type="number"
              min="1"
              defaultValue="5"
              onChange={(e) => orchestrator.updateMonetizationSettings({
                minimumDonation: Number(e.target.value)
              })}
            />
          </div>
          
          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                onChange={(e) => orchestrator.updateMonetizationSettings({
                  subscriberOnlyMode: e.target.checked
                })}
              />
              Subscriber Only Mode
            </label>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="quick-actions">
        <button
          className="action-button primary"
          onClick={() => orchestrator.createDonationGoal()}
        >
          Create Goal
        </button>
        <button
          className="action-button secondary"
          onClick={() => orchestrator.exportRevenueReport()}
        >
          Export Report
        </button>
        <button
          className="action-button secondary"
          onClick={() => orchestrator.viewPayoutSettings()}
        >
          Payout Settings
        </button>
      </div>
    </div>
  );
};