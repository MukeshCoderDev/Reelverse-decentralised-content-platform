import { EventEmitter } from 'events';

export interface SuperChatConfig {
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  currency: string;
  colors: {
    [key: number]: string; // Amount thresholds to colors
  };
  durations: {
    [key: number]: number; // Amount thresholds to pin durations (seconds)
  };
}

export interface DonationConfig {
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  currency: string;
  showDonorName: boolean;
  showAmount: boolean;
  playSound: boolean;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  benefits: string[];
  badgeColor: string;
  emoteSlots: number;
}

export interface MonetizationEvent {
  id: string;
  type: 'super_chat' | 'donation' | 'subscription' | 'tip';
  userId: string;
  username: string;
  amount: number;
  currency: string;
  message?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RevenueMetrics {
  totalRevenue: number;
  superChatRevenue: number;
  donationRevenue: number;
  subscriptionRevenue: number;
  tipRevenue: number;
  transactionCount: number;
  averageTransaction: number;
  topDonor: {
    userId: string;
    username: string;
    totalAmount: number;
  };
  revenueByHour: Record<string, number>;
}

export interface PayoutInfo {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  nextPayoutDate: Date;
  minimumPayout: number;
  fees: {
    platform: number; // percentage
    payment: number; // percentage
  };
}

export class LiveMonetizationService extends EventEmitter {
  private superChatConfig: SuperChatConfig;
  private donationConfig: DonationConfig;
  private subscriptionTiers: Map<string, SubscriptionTier> = new Map();
  private events: MonetizationEvent[] = [];
  private revenue: RevenueMetrics;
  private isEnabled = false;

  constructor() {
    super();
    this.superChatConfig = this.getDefaultSuperChatConfig();
    this.donationConfig = this.getDefaultDonationConfig();
    this.revenue = this.initializeRevenue();
    this.initializeDefaultTiers();
  }

  private getDefaultSuperChatConfig(): SuperChatConfig {
    return {
      enabled: true,
      minAmount: 1,
      maxAmount: 500,
      currency: 'USD',
      colors: {
        1: '#1E90FF',    // Blue
        5: '#9370DB',    // Purple
        10: '#32CD32',   // Green
        20: '#FFD700',   // Gold
        50: '#FF8C00',   // Orange
        100: '#FF0000'   // Red
      },
      durations: {
        1: 30,     // 30 seconds
        5: 60,     // 1 minute
        10: 120,   // 2 minutes
        20: 180,   // 3 minutes
        50: 240,   // 4 minutes
        100: 300   // 5 minutes
      }
    };
  }

  private getDefaultDonationConfig(): DonationConfig {
    return {
      enabled: true,
      minAmount: 1,
      maxAmount: 1000,
      currency: 'USD',
      showDonorName: true,
      showAmount: true,
      playSound: true
    };
  }

  private initializeRevenue(): RevenueMetrics {
    return {
      totalRevenue: 0,
      superChatRevenue: 0,
      donationRevenue: 0,
      subscriptionRevenue: 0,
      tipRevenue: 0,
      transactionCount: 0,
      averageTransaction: 0,
      topDonor: {
        userId: '',
        username: '',
        totalAmount: 0
      },
      revenueByHour: {}
    };
  }

  private initializeDefaultTiers(): void {
    const defaultTiers: SubscriptionTier[] = [
      {
        id: 'tier1',
        name: 'Supporter',
        price: 4.99,
        currency: 'USD',
        benefits: ['Custom badge', 'Exclusive emotes', 'Priority chat'],
        badgeColor: '#1E90FF',
        emoteSlots: 5
      },
      {
        id: 'tier2',
        name: 'VIP',
        price: 9.99,
        currency: 'USD',
        benefits: ['All Supporter benefits', 'VIP badge', 'More emotes', 'Discord access'],
        badgeColor: '#9370DB',
        emoteSlots: 10
      },
      {
        id: 'tier3',
        name: 'Champion',
        price: 24.99,
        currency: 'USD',
        benefits: ['All VIP benefits', 'Champion badge', 'Even more emotes', 'Monthly video call'],
        badgeColor: '#FFD700',
        emoteSlots: 20
      }
    ];

    defaultTiers.forEach(tier => {
      this.subscriptionTiers.set(tier.id, tier);
    });
  }

  enableMonetization(streamId: string): void {
    this.isEnabled = true;
    this.emit('monetizationEnabled', { streamId });
  }

  disableMonetization(): void {
    this.isEnabled = false;
    this.emit('monetizationDisabled');
  }

  async processSuperChat(
    userId: string,
    username: string,
    amount: number,
    message: string,
    currency: string = 'USD'
  ): Promise<MonetizationEvent> {
    if (!this.isEnabled || !this.superChatConfig.enabled) {
      throw new Error('Super Chat is not enabled');
    }

    if (amount < this.superChatConfig.minAmount || amount > this.superChatConfig.maxAmount) {
      throw new Error(`Super Chat amount must be between ${this.superChatConfig.minAmount} and ${this.superChatConfig.maxAmount}`);
    }

    const event: MonetizationEvent = {
      id: this.generateEventId(),
      type: 'super_chat',
      userId,
      username,
      amount,
      currency,
      message,
      timestamp: new Date(),
      metadata: {
        color: this.getSuperChatColor(amount),
        duration: this.getSuperChatDuration(amount),
        pinned: true
      }
    };

    await this.processPayment(event);
    this.recordEvent(event);
    
    this.emit('superChatReceived', event);
    return event;
  }

  async processDonation(
    userId: string,
    username: string,
    amount: number,
    message?: string,
    currency: string = 'USD'
  ): Promise<MonetizationEvent> {
    if (!this.isEnabled || !this.donationConfig.enabled) {
      throw new Error('Donations are not enabled');
    }

    if (amount < this.donationConfig.minAmount || amount > this.donationConfig.maxAmount) {
      throw new Error(`Donation amount must be between ${this.donationConfig.minAmount} and ${this.donationConfig.maxAmount}`);
    }

    const event: MonetizationEvent = {
      id: this.generateEventId(),
      type: 'donation',
      userId,
      username,
      amount,
      currency,
      message,
      timestamp: new Date(),
      metadata: {
        showName: this.donationConfig.showDonorName,
        showAmount: this.donationConfig.showAmount,
        playSound: this.donationConfig.playSound
      }
    };

    await this.processPayment(event);
    this.recordEvent(event);
    
    this.emit('donationReceived', event);
    return event;
  }

  async processSubscription(
    userId: string,
    username: string,
    tierId: string
  ): Promise<MonetizationEvent> {
    if (!this.isEnabled) {
      throw new Error('Monetization is not enabled');
    }

    const tier = this.subscriptionTiers.get(tierId);
    if (!tier) {
      throw new Error('Invalid subscription tier');
    }

    const event: MonetizationEvent = {
      id: this.generateEventId(),
      type: 'subscription',
      userId,
      username,
      amount: tier.price,
      currency: tier.currency,
      timestamp: new Date(),
      metadata: {
        tierId,
        tierName: tier.name,
        benefits: tier.benefits,
        badgeColor: tier.badgeColor,
        isNewSubscriber: true // Would check against existing subscriptions
      }
    };

    await this.processPayment(event);
    this.recordEvent(event);
    
    this.emit('subscriptionReceived', event);
    return event;
  }

  async processTip(
    userId: string,
    username: string,
    amount: number,
    currency: string = 'USD'
  ): Promise<MonetizationEvent> {
    if (!this.isEnabled) {
      throw new Error('Monetization is not enabled');
    }

    const event: MonetizationEvent = {
      id: this.generateEventId(),
      type: 'tip',
      userId,
      username,
      amount,
      currency,
      timestamp: new Date(),
      metadata: {}
    };

    await this.processPayment(event);
    this.recordEvent(event);
    
    this.emit('tipReceived', event);
    return event;
  }

  private async processPayment(event: MonetizationEvent): Promise<void> {
    // Mock payment processing - in production, integrate with Stripe/PayPal
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mock payment success
      this.emit('paymentProcessed', {
        eventId: event.id,
        status: 'success',
        transactionId: `txn_${Date.now()}`
      });
    } catch (error) {
      this.emit('paymentFailed', {
        eventId: event.id,
        error: error.message
      });
      throw error;
    }
  }

  private recordEvent(event: MonetizationEvent): void {
    this.events.push(event);
    this.updateRevenue(event);
  }

  private updateRevenue(event: MonetizationEvent): void {
    this.revenue.totalRevenue += event.amount;
    this.revenue.transactionCount++;
    
    switch (event.type) {
      case 'super_chat':
        this.revenue.superChatRevenue += event.amount;
        break;
      case 'donation':
        this.revenue.donationRevenue += event.amount;
        break;
      case 'subscription':
        this.revenue.subscriptionRevenue += event.amount;
        break;
      case 'tip':
        this.revenue.tipRevenue += event.amount;
        break;
    }

    // Update average transaction
    this.revenue.averageTransaction = this.revenue.totalRevenue / this.revenue.transactionCount;

    // Update top donor
    const userTotal = this.events
      .filter(e => e.userId === event.userId)
      .reduce((sum, e) => sum + e.amount, 0);
    
    if (userTotal > this.revenue.topDonor.totalAmount) {
      this.revenue.topDonor = {
        userId: event.userId,
        username: event.username,
        totalAmount: userTotal
      };
    }

    // Update revenue by hour
    const hour = new Date(event.timestamp).toISOString().slice(0, 13);
    this.revenue.revenueByHour[hour] = (this.revenue.revenueByHour[hour] || 0) + event.amount;

    this.emit('revenueUpdated', this.revenue);
  }

  private getSuperChatColor(amount: number): string {
    const thresholds = Object.keys(this.superChatConfig.colors)
      .map(Number)
      .sort((a, b) => b - a);
    
    for (const threshold of thresholds) {
      if (amount >= threshold) {
        return this.superChatConfig.colors[threshold];
      }
    }
    
    return this.superChatConfig.colors[1] || '#1E90FF';
  }

  private getSuperChatDuration(amount: number): number {
    const thresholds = Object.keys(this.superChatConfig.durations)
      .map(Number)
      .sort((a, b) => b - a);
    
    for (const threshold of thresholds) {
      if (amount >= threshold) {
        return this.superChatConfig.durations[threshold];
      }
    }
    
    return this.superChatConfig.durations[1] || 30;
  }

  updateSuperChatConfig(config: Partial<SuperChatConfig>): void {
    this.superChatConfig = { ...this.superChatConfig, ...config };
    this.emit('superChatConfigUpdated', this.superChatConfig);
  }

  updateDonationConfig(config: Partial<DonationConfig>): void {
    this.donationConfig = { ...this.donationConfig, ...config };
    this.emit('donationConfigUpdated', this.donationConfig);
  }

  addSubscriptionTier(tier: SubscriptionTier): void {
    this.subscriptionTiers.set(tier.id, tier);
    this.emit('subscriptionTierAdded', tier);
  }

  updateSubscriptionTier(tierId: string, updates: Partial<SubscriptionTier>): void {
    const tier = this.subscriptionTiers.get(tierId);
    if (tier) {
      const updatedTier = { ...tier, ...updates };
      this.subscriptionTiers.set(tierId, updatedTier);
      this.emit('subscriptionTierUpdated', updatedTier);
    }
  }

  removeSubscriptionTier(tierId: string): void {
    if (this.subscriptionTiers.delete(tierId)) {
      this.emit('subscriptionTierRemoved', tierId);
    }
  }

  getRevenue(): RevenueMetrics {
    return { ...this.revenue };
  }

  getEvents(): MonetizationEvent[] {
    return [...this.events];
  }

  getSubscriptionTiers(): SubscriptionTier[] {
    return Array.from(this.subscriptionTiers.values());
  }

  getSuperChatConfig(): SuperChatConfig {
    return { ...this.superChatConfig };
  }

  getDonationConfig(): DonationConfig {
    return { ...this.donationConfig };
  }

  getPayoutInfo(): PayoutInfo {
    const totalEarnings = this.revenue.totalRevenue;
    const platformFee = totalEarnings * 0.05; // 5% platform fee
    const paymentFee = totalEarnings * 0.029; // 2.9% payment processing fee
    const availableBalance = totalEarnings - platformFee - paymentFee;

    return {
      totalEarnings,
      availableBalance,
      pendingBalance: 0, // Mock value
      nextPayoutDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      minimumPayout: 50,
      fees: {
        platform: 5,
        payment: 2.9
      }
    };
  }

  getTopDonors(limit: number = 10): Array<{ userId: string; username: string; totalAmount: number }> {
    const donorTotals = new Map<string, { username: string; totalAmount: number }>();
    
    this.events.forEach(event => {
      const existing = donorTotals.get(event.userId);
      if (existing) {
        existing.totalAmount += event.amount;
      } else {
        donorTotals.set(event.userId, {
          username: event.username,
          totalAmount: event.amount
        });
      }
    });

    return Array.from(donorTotals.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);
  }

  getRevenueByTimeRange(startDate: Date, endDate: Date): RevenueMetrics {
    const filteredEvents = this.events.filter(
      event => event.timestamp >= startDate && event.timestamp <= endDate
    );

    const revenue = this.initializeRevenue();
    filteredEvents.forEach(event => {
      this.updateRevenueFromEvent(revenue, event);
    });

    return revenue;
  }

  private updateRevenueFromEvent(revenue: RevenueMetrics, event: MonetizationEvent): void {
    revenue.totalRevenue += event.amount;
    revenue.transactionCount++;
    
    switch (event.type) {
      case 'super_chat':
        revenue.superChatRevenue += event.amount;
        break;
      case 'donation':
        revenue.donationRevenue += event.amount;
        break;
      case 'subscription':
        revenue.subscriptionRevenue += event.amount;
        break;
      case 'tip':
        revenue.tipRevenue += event.amount;
        break;
    }

    revenue.averageTransaction = revenue.totalRevenue / revenue.transactionCount;
  }

  private generateEventId(): string {
    return `monetization_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Additional methods for component integration
  getRecentDonations(limit: number = 10): MonetizationEvent[] {
    return this.events
      .filter(event => event.type === 'donation')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getRecentSuperChats(limit: number = 10): MonetizationEvent[] {
    return this.events
      .filter(event => event.type === 'super_chat')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getNewSubscribers(limit: number = 10): MonetizationEvent[] {
    return this.events
      .filter(event => event.type === 'subscription')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getActiveGoals(): Array<{ id: string; title: string; current: number; target: number }> {
    // Mock goals - in production, these would be stored and managed
    return [
      {
        id: 'goal1',
        title: 'Stream Setup Fund',
        current: this.revenue.totalRevenue,
        target: 500
      },
      {
        id: 'goal2',
        title: 'New Equipment',
        current: this.revenue.totalRevenue * 0.6,
        target: 1000
      }
    ];
  }

  updateSettings(settings: any): void {
    if (settings.donationsEnabled !== undefined) {
      this.donationConfig.enabled = settings.donationsEnabled;
    }
    if (settings.superChatEnabled !== undefined) {
      this.superChatConfig.enabled = settings.superChatEnabled;
    }
    if (settings.minimumDonation !== undefined) {
      this.donationConfig.minAmount = settings.minimumDonation;
    }
    if (settings.subscriberOnlyMode !== undefined) {
      // Handle subscriber only mode
    }
    
    this.emit('settingsUpdated', settings);
  }

  createGoal(): any {
    // Mock goal creation
    return {
      id: `goal_${Date.now()}`,
      title: 'New Goal',
      target: 100,
      current: 0
    };
  }

  exportReport(): any {
    return {
      revenue: this.revenue,
      events: this.events,
      exportDate: new Date(),
      format: 'json'
    };
  }

  getPayoutSettings(): any {
    return {
      payoutInfo: this.getPayoutInfo(),
      paymentMethods: [
        { id: 'paypal', name: 'PayPal', enabled: true },
        { id: 'bank', name: 'Bank Transfer', enabled: true },
        { id: 'crypto', name: 'Cryptocurrency', enabled: false }
      ],
      schedule: 'weekly',
      minimumPayout: 50
    };
  }
}