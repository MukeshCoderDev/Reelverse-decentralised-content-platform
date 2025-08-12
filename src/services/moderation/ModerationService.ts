import { EventEmitter } from 'events';
import { ChatMessage } from '../chat/LiveChatService';

export interface ModerationRule {
  id: string;
  name: string;
  type: 'keyword' | 'regex' | 'spam' | 'caps' | 'links' | 'custom';
  pattern: string;
  action: 'warn' | 'timeout' | 'delete' | 'ban';
  severity: 'low' | 'medium' | 'high';
  enabled: boolean;
  autoApply: boolean;
}

export interface ModerationAction {
  id: string;
  type: 'warn' | 'timeout' | 'delete' | 'ban';
  targetUserId: string;
  moderatorId: string;
  reason: string;
  timestamp: Date;
  duration?: number; // For timeouts
  messageId?: string; // For message deletions
  metadata?: Record<string, any>;
}

export interface AutoModerationConfig {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  rules: {
    profanityFilter: boolean;
    spamDetection: boolean;
    capsFilter: boolean;
    linkFilter: boolean;
    repetitiveMessages: boolean;
    excessiveEmotes: boolean;
  };
  thresholds: {
    capsPercentage: number;
    messageRepeatCount: number;
    emotePercentage: number;
    spamTimeWindow: number; // seconds
  };
}

export interface ModerationStats {
  totalActions: number;
  actionsByType: Record<string, number>;
  topModerators: Array<{ userId: string; actionCount: number }>;
  autoModerationEffectiveness: number;
  falsePositiveRate: number;
}

export class ModerationService extends EventEmitter {
  private rules: Map<string, ModerationRule> = new Map();
  private actions: ModerationAction[] = [];
  private config: AutoModerationConfig;
  private userWarnings: Map<string, number> = new Map();
  private userTimeouts: Map<string, Date> = new Map();
  private bannedUsers: Set<string> = new Set();
  private messageHistory: Map<string, ChatMessage[]> = new Map();

  constructor() {
    super();
    this.config = this.getDefaultConfig();
    this.initializeDefaultRules();
  }

  private getDefaultConfig(): AutoModerationConfig {
    return {
      enabled: true,
      sensitivity: 'medium',
      rules: {
        profanityFilter: true,
        spamDetection: true,
        capsFilter: true,
        linkFilter: false,
        repetitiveMessages: true,
        excessiveEmotes: false
      },
      thresholds: {
        capsPercentage: 70,
        messageRepeatCount: 3,
        emotePercentage: 50,
        spamTimeWindow: 30
      }
    };
  }

  private initializeDefaultRules(): void {
    const defaultRules: ModerationRule[] = [
      {
        id: 'profanity-basic',
        name: 'Basic Profanity Filter',
        type: 'keyword',
        pattern: 'spam|scam|fake|bot',
        action: 'delete',
        severity: 'medium',
        enabled: true,
        autoApply: true
      },
      {
        id: 'excessive-caps',
        name: 'Excessive Caps',
        type: 'caps',
        pattern: '',
        action: 'warn',
        severity: 'low',
        enabled: true,
        autoApply: true
      },
      {
        id: 'spam-detection',
        name: 'Spam Detection',
        type: 'spam',
        pattern: '',
        action: 'timeout',
        severity: 'high',
        enabled: true,
        autoApply: true
      },
      {
        id: 'link-filter',
        name: 'Link Filter',
        type: 'links',
        pattern: 'https?://[^\\s]+',
        action: 'delete',
        severity: 'low',
        enabled: false,
        autoApply: true
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  async moderateMessage(message: ChatMessage): Promise<ModerationAction | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Check if user is banned
    if (this.bannedUsers.has(message.userId)) {
      return this.createAction('ban', message.userId, 'system', 'User is banned', message.id);
    }

    // Check if user is timed out
    const timeoutEnd = this.userTimeouts.get(message.userId);
    if (timeoutEnd && timeoutEnd > new Date()) {
      return this.createAction('delete', message.userId, 'system', 'User is timed out', message.id);
    }

    // Store message in history for spam detection
    this.addMessageToHistory(message);

    // Apply moderation rules
    for (const rule of this.rules.values()) {
      if (!rule.enabled || !rule.autoApply) continue;

      const violation = await this.checkRule(rule, message);
      if (violation) {
        const action = this.createAction(
          rule.action,
          message.userId,
          'system',
          `Auto-moderation: ${rule.name}`,
          message.id
        );

        await this.executeAction(action);
        return action;
      }
    }

    return null;
  }

  async executeManualAction(
    type: 'warn' | 'timeout' | 'delete' | 'ban',
    targetUserId: string,
    moderatorId: string,
    reason: string,
    duration?: number,
    messageId?: string
  ): Promise<ModerationAction> {
    const action = this.createAction(type, targetUserId, moderatorId, reason, messageId, duration);
    await this.executeAction(action);
    return action;
  }

  private async checkRule(rule: ModerationRule, message: ChatMessage): Promise<boolean> {
    switch (rule.type) {
      case 'keyword':
        return this.checkKeywordRule(rule.pattern, message.message);
      
      case 'regex':
        return this.checkRegexRule(rule.pattern, message.message);
      
      case 'spam':
        return this.checkSpamRule(message);
      
      case 'caps':
        return this.checkCapsRule(message.message);
      
      case 'links':
        return this.checkLinksRule(message.message);
      
      default:
        return false;
    }
  }

  private checkKeywordRule(pattern: string, content: string): boolean {
    const keywords = pattern.toLowerCase().split('|');
    const lowerContent = content.toLowerCase();
    return keywords.some(keyword => lowerContent.includes(keyword.trim()));
  }

  private checkRegexRule(pattern: string, content: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(content);
    } catch {
      return false;
    }
  }

  private checkSpamRule(message: ChatMessage): boolean {
    if (!this.config.rules.spamDetection) return false;

    const userMessages = this.messageHistory.get(message.userId) || [];
    const recentMessages = userMessages.filter(
      msg => Date.now() - msg.timestamp.getTime() < this.config.thresholds.spamTimeWindow * 1000
    );

    // Check for repeated messages
    if (this.config.rules.repetitiveMessages) {
      const duplicateCount = recentMessages.filter(msg => msg.message === message.message).length;
      if (duplicateCount >= this.config.thresholds.messageRepeatCount) {
        return true;
      }
    }

    // Check message frequency
    if (recentMessages.length > 10) { // More than 10 messages in time window
      return true;
    }

    return false;
  }

  private checkCapsRule(content: string): boolean {
    if (!this.config.rules.capsFilter) return false;

    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 10) return false; // Ignore short messages

    const capsCount = content.replace(/[^A-Z]/g, '').length;
    const capsPercentage = (capsCount / letters.length) * 100;

    return capsPercentage > this.config.thresholds.capsPercentage;
  }

  private checkLinksRule(content: string): boolean {
    if (!this.config.rules.linkFilter) return false;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return urlRegex.test(content);
  }

  private createAction(
    type: 'warn' | 'timeout' | 'delete' | 'ban',
    targetUserId: string,
    moderatorId: string,
    reason: string,
    messageId?: string,
    duration?: number
  ): ModerationAction {
    return {
      id: this.generateActionId(),
      type,
      targetUserId,
      moderatorId,
      reason,
      timestamp: new Date(),
      duration,
      messageId,
      metadata: {}
    };
  }

  private async executeAction(action: ModerationAction): Promise<void> {
    this.actions.push(action);

    switch (action.type) {
      case 'warn':
        this.executeWarn(action);
        break;
      
      case 'timeout':
        this.executeTimeout(action);
        break;
      
      case 'delete':
        this.executeDelete(action);
        break;
      
      case 'ban':
        this.executeBan(action);
        break;
    }

    this.emit('actionExecuted', action);
  }

  private executeWarn(action: ModerationAction): void {
    const currentWarnings = this.userWarnings.get(action.targetUserId) || 0;
    this.userWarnings.set(action.targetUserId, currentWarnings + 1);

    this.emit('userWarned', {
      userId: action.targetUserId,
      warnings: currentWarnings + 1,
      reason: action.reason
    });

    // Auto-escalate after multiple warnings
    if (currentWarnings + 1 >= 3) {
      const timeoutAction = this.createAction(
        'timeout',
        action.targetUserId,
        'system',
        'Auto-escalation: Multiple warnings',
        undefined,
        300 // 5 minutes
      );
      this.executeAction(timeoutAction);
    }
  }

  private executeTimeout(action: ModerationAction): void {
    const duration = action.duration || 300; // Default 5 minutes
    const timeoutEnd = new Date(Date.now() + duration * 1000);
    this.userTimeouts.set(action.targetUserId, timeoutEnd);

    this.emit('userTimedOut', {
      userId: action.targetUserId,
      duration,
      reason: action.reason,
      endTime: timeoutEnd
    });

    // Auto-remove timeout
    setTimeout(() => {
      this.userTimeouts.delete(action.targetUserId);
      this.emit('timeoutExpired', { userId: action.targetUserId });
    }, duration * 1000);
  }

  private executeDelete(action: ModerationAction): void {
    this.emit('messageDeleted', {
      messageId: action.messageId,
      reason: action.reason,
      moderatorId: action.moderatorId
    });
  }

  private executeBan(action: ModerationAction): void {
    this.bannedUsers.add(action.targetUserId);
    this.userTimeouts.delete(action.targetUserId); // Remove any active timeouts
    this.userWarnings.delete(action.targetUserId); // Clear warnings

    this.emit('userBanned', {
      userId: action.targetUserId,
      reason: action.reason,
      moderatorId: action.moderatorId
    });
  }

  addRule(rule: ModerationRule): void {
    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
  }

  updateRule(ruleId: string, updates: Partial<ModerationRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      const updatedRule = { ...rule, ...updates };
      this.rules.set(ruleId, updatedRule);
      this.emit('ruleUpdated', updatedRule);
    }
  }

  removeRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      this.emit('ruleRemoved', ruleId);
    }
  }

  updateConfig(config: Partial<AutoModerationConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  unbanUser(userId: string, moderatorId: string): void {
    if (this.bannedUsers.delete(userId)) {
      const action = this.createAction('warn', userId, moderatorId, 'User unbanned');
      this.actions.push(action);
      this.emit('userUnbanned', { userId, moderatorId });
    }
  }

  clearUserTimeout(userId: string, moderatorId: string): void {
    if (this.userTimeouts.delete(userId)) {
      const action = this.createAction('warn', userId, moderatorId, 'Timeout cleared');
      this.actions.push(action);
      this.emit('timeoutCleared', { userId, moderatorId });
    }
  }

  private addMessageToHistory(message: ChatMessage): void {
    const userMessages = this.messageHistory.get(message.userId) || [];
    userMessages.push(message);
    
    // Keep only recent messages (last 50)
    if (userMessages.length > 50) {
      userMessages.shift();
    }
    
    this.messageHistory.set(message.userId, userMessages);
  }

  getRules(): ModerationRule[] {
    return Array.from(this.rules.values());
  }

  getActions(): ModerationAction[] {
    return [...this.actions];
  }

  getConfig(): AutoModerationConfig {
    return { ...this.config };
  }

  getUserWarnings(userId: string): number {
    return this.userWarnings.get(userId) || 0;
  }

  isUserTimedOut(userId: string): boolean {
    const timeoutEnd = this.userTimeouts.get(userId);
    return timeoutEnd ? timeoutEnd > new Date() : false;
  }

  isUserBanned(userId: string): boolean {
    return this.bannedUsers.has(userId);
  }

  getStats(): ModerationStats {
    const actionsByType: Record<string, number> = {};
    const moderatorActions: Record<string, number> = {};

    this.actions.forEach(action => {
      actionsByType[action.type] = (actionsByType[action.type] || 0) + 1;
      if (action.moderatorId !== 'system') {
        moderatorActions[action.moderatorId] = (moderatorActions[action.moderatorId] || 0) + 1;
      }
    });

    const topModerators = Object.entries(moderatorActions)
      .map(([userId, actionCount]) => ({ userId, actionCount }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 10);

    const autoActions = this.actions.filter(a => a.moderatorId === 'system').length;
    const totalActions = this.actions.length;
    const autoModerationEffectiveness = totalActions > 0 ? (autoActions / totalActions) * 100 : 0;

    return {
      totalActions,
      actionsByType,
      topModerators,
      autoModerationEffectiveness,
      falsePositiveRate: 5 // Mock value - would be calculated from user appeals/reversals
    };
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Additional methods for component integration
  getModerationQueue(): Array<{
    id: string;
    userId: string;
    username: string;
    message: string;
    messageId: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
  }> {
    // Mock moderation queue - in production, this would be populated by flagged messages
    return [
      {
        id: 'queue_1',
        userId: 'user_123',
        username: 'TestUser',
        message: 'This is a suspicious message',
        messageId: 'msg_123',
        reason: 'Spam detection',
        severity: 'medium',
        timestamp: new Date()
      }
    ];
  }

  getBannedUsers(): Array<{
    id: string;
    username: string;
    reason: string;
    bannedAt: Date;
  }> {
    // Convert banned user IDs to user objects - in production, would fetch from user service
    return Array.from(this.bannedUsers).map(userId => ({
      id: userId,
      username: `User_${userId.slice(-4)}`,
      reason: 'Violation of community guidelines',
      bannedAt: new Date(Date.now() - Math.random() * 86400000) // Random time in last 24h
    }));
  }

  getTimeoutUsers(): Array<{
    id: string;
    username: string;
    reason: string;
    remainingTime: number;
  }> {
    const now = new Date();
    return Array.from(this.userTimeouts.entries())
      .filter(([_, endTime]) => endTime > now)
      .map(([userId, endTime]) => ({
        id: userId,
        username: `User_${userId.slice(-4)}`,
        reason: 'Temporary suspension',
        remainingTime: Math.floor((endTime.getTime() - now.getTime()) / 1000)
      }));
  }

  getAutoModSettings() {
    return {
      spamLevel: this.config.sensitivity,
      profanityLevel: this.config.sensitivity,
      capsFilter: this.config.rules.capsFilter,
      linkFilter: this.config.rules.linkFilter
    };
  }

  getModerators(): Array<{
    id: string;
    username: string;
    role: string;
    addedAt: Date;
  }> {
    // Mock moderators list - in production, would fetch from user service
    return [
      {
        id: 'mod_1',
        username: 'ModeratorOne',
        role: 'Moderator',
        addedAt: new Date(Date.now() - 7 * 86400000)
      },
      {
        id: 'mod_2',
        username: 'ModeratorTwo',
        role: 'Senior Moderator',
        addedAt: new Date(Date.now() - 14 * 86400000)
      }
    ];
  }

  async banUser(userId: string, reason: string): Promise<void> {
    this.bannedUsers.add(userId);
    const action = this.createAction('ban', userId, 'manual', reason);
    await this.executeAction(action);
  }

  async timeoutUser(userId: string, duration: number, reason: string): Promise<void> {
    const action = this.createAction('timeout', userId, 'manual', reason, undefined, duration);
    await this.executeAction(action);
  }

  async unbanUser(userId: string): Promise<void> {
    this.unbanUser(userId, 'manual');
  }

  async approveMessage(messageId: string): Promise<void> {
    // Remove from moderation queue - mock implementation
    this.emit('messageApproved', { messageId });
  }

  updateAutoModSettings(settings: any): void {
    if (settings.spamLevel) {
      this.config.sensitivity = settings.spamLevel;
    }
    if (settings.profanityLevel) {
      this.config.sensitivity = settings.profanityLevel;
    }
    if (settings.capsFilter !== undefined) {
      this.config.rules.capsFilter = settings.capsFilter;
    }
    if (settings.linkFilter !== undefined) {
      this.config.rules.linkFilter = settings.linkFilter;
    }
    
    this.emit('autoModSettingsUpdated', settings);
  }

  removeTimeout(userId: string): Promise<void> {
    this.clearUserTimeout(userId, 'manual');
    return Promise.resolve();
  }

  addModerator(username: string): Promise<void> {
    // Mock implementation - in production, would integrate with user service
    this.emit('moderatorAdded', { username });
    return Promise.resolve();
  }

  removeModerator(userId: string): Promise<void> {
    // Mock implementation - in production, would integrate with user service
    this.emit('moderatorRemoved', { userId });
    return Promise.resolve();
  }

  exportLogs(): any {
    return {
      actions: this.actions,
      rules: Array.from(this.rules.values()),
      config: this.config,
      stats: this.getStats(),
      exportDate: new Date()
    };
  }

  enableEmergencyMode(): void {
    // Enable strict moderation settings
    this.config.sensitivity = 'high';
    this.config.rules = {
      profanityFilter: true,
      spamDetection: true,
      capsFilter: true,
      linkFilter: true,
      repetitiveMessages: true,
      excessiveEmotes: true
    };
    
    this.emit('emergencyModeEnabled');
  }
}