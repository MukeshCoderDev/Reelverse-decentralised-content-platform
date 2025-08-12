import { EventEmitter } from 'events';

// Moderation interfaces
export interface ModerationRule {
  id: string;
  name: string;
  type: 'word_filter' | 'spam_detection' | 'link_filter' | 'caps_filter' | 'custom';
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: ModerationAction;
  conditions: ModerationCondition[];
  exemptions: string[]; // User IDs exempt from this rule
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationAction {
  type: 'warn' | 'timeout' | 'ban' | 'delete' | 'flag';
  duration?: number; // For timeout actions (in seconds)
  message?: string; // Custom message to user
  escalate?: boolean; // Escalate to human moderator
}

export interface ModerationCondition {
  field: 'message' | 'username' | 'user_age' | 'message_frequency' | 'caps_ratio';
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'regex' | 'starts_with' | 'ends_with';
  value: string | number;
  caseSensitive?: boolean;
}

export interface ModerationEvent {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  ruleId: string;
  ruleName: string;
  action: ModerationAction;
  originalMessage?: string;
  reason: string;
  timestamp: Date;
  moderatorId?: string; // If manually triggered
  appealed: boolean;
  resolved: boolean;
}

export interface AutoModerationConfig {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  spamDetection: SpamDetectionConfig;
  toxicityFilter: ToxicityFilterConfig;
  linkFilter: LinkFilterConfig;
  capsFilter: CapsFilterConfig;
  customFilters: CustomFilter[];
}

export interface SpamDetectionConfig {
  enabled: boolean;
  maxMessagesPerMinute: number;
  duplicateMessageThreshold: number;
  similarityThreshold: number; // 0-1, how similar messages need to be
  action: ModerationAction;
}

export interface ToxicityFilterConfig {
  enabled: boolean;
  threshold: number; // 0-1, confidence threshold for toxicity
  categories: ToxicityCategory[];
  action: ModerationAction;
}

export interface ToxicityCategory {
  name: string;
  enabled: boolean;
  threshold: number;
}

export interface LinkFilterConfig {
  enabled: boolean;
  allowWhitelisted: boolean;
  whitelistedDomains: string[];
  blockSuspicious: boolean;
  action: ModerationAction;
}

export interface CapsFilterConfig {
  enabled: boolean;
  maxCapsRatio: number; // 0-1, maximum ratio of caps to total characters
  minMessageLength: number; // Minimum message length to apply filter
  action: ModerationAction;
}

export interface CustomFilter {
  id: string;
  name: string;
  pattern: string; // Regex pattern
  flags: string; // Regex flags (i, g, m, etc.)
  action: ModerationAction;
  enabled: boolean;
}

export interface ModerationStats {
  totalActions: number;
  actionsByType: { [key: string]: number };
  actionsByRule: { [key: string]: number };
  falsePositives: number;
  appeals: number;
  resolvedAppeals: number;
  topViolators: UserViolation[];
  timeDistribution: { [hour: number]: number };
}

export interface UserViolation {
  userId: string;
  username: string;
  violationCount: number;
  lastViolation: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class StreamModerationService extends EventEmitter {
  private rules: Map<string, ModerationRule> = new Map();
  private events: ModerationEvent[] = [];
  private userMessageHistory: Map<string, string[]> = new Map();
  private userViolations: Map<string, UserViolation> = new Map();
  private config: AutoModerationConfig;

  constructor() {
    super();
    this.config = this.getDefaultConfig();
    this.initializeDefaultRules();
    this.setupEventHandlers();
  }

  private getDefaultConfig(): AutoModerationConfig {
    return {
      enabled: true,
      sensitivity: 'medium',
      spamDetection: {
        enabled: true,
        maxMessagesPerMinute: 10,
        duplicateMessageThreshold: 3,
        similarityThreshold: 0.8,
        action: { type: 'timeout', duration: 300, message: 'Spam detected' }
      },
      toxicityFilter: {
        enabled: true,
        threshold: 0.7,
        categories: [
          { name: 'harassment', enabled: true, threshold: 0.7 },
          { name: 'hate_speech', enabled: true, threshold: 0.6 },
          { name: 'profanity', enabled: true, threshold: 0.8 },
          { name: 'threats', enabled: true, threshold: 0.5 }
        ],
        action: { type: 'delete', message: 'Message removed for inappropriate content' }
      },
      linkFilter: {
        enabled: true,
        allowWhitelisted: true,
        whitelistedDomains: ['youtube.com', 'twitch.tv', 'twitter.com'],
        blockSuspicious: true,
        action: { type: 'delete', message: 'Links not allowed' }
      },
      capsFilter: {
        enabled: true,
        maxCapsRatio: 0.7,
        minMessageLength: 10,
        action: { type: 'warn', message: 'Please avoid excessive caps' }
      },
      customFilters: []
    };
  }

  private initializeDefaultRules(): void {
    // Spam detection rule
    this.addRule({
      id: 'spam_detection',
      name: 'Spam Detection',
      type: 'spam_detection',
      enabled: true,
      severity: 'medium',
      action: { type: 'timeout', duration: 300 },
      conditions: [
        { field: 'message_frequency', operator: 'greater_than', value: 10 }
      ],
      exemptions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Profanity filter
    this.addRule({
      id: 'profanity_filter',
      name: 'Profanity Filter',
      type: 'word_filter',
      enabled: true,
      severity: 'high',
      action: { type: 'delete', message: 'Message removed for inappropriate language' },
      conditions: [
        { field: 'message', operator: 'contains', value: 'profanity_list' }
      ],
      exemptions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Link filter
    this.addRule({
      id: 'link_filter',
      name: 'Link Filter',
      type: 'link_filter',
      enabled: true,
      severity: 'low',
      action: { type: 'delete', message: 'Links not allowed in chat' },
      conditions: [
        { field: 'message', operator: 'regex', value: 'https?://[^\\s]+' }
      ],
      exemptions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Caps filter
    this.addRule({
      id: 'caps_filter',
      name: 'Excessive Caps Filter',
      type: 'caps_filter',
      enabled: true,
      severity: 'low',
      action: { type: 'warn', message: 'Please avoid excessive caps' },
      conditions: [
        { field: 'caps_ratio', operator: 'greater_than', value: 0.7 }
      ],
      exemptions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  private setupEventHandlers(): void {
    this.on('messageReceived', (streamId: string, userId: string, username: string, message: string) => {
      this.moderateMessage(streamId, userId, username, message);
    });

    this.on('moderationAction', (event: ModerationEvent) => {
      this.recordModerationEvent(event);
    });
  }

  async moderateMessage(streamId: string, userId: string, username: string, message: string): Promise<boolean> {
    if (!this.config.enabled) {
      return true; // Allow message if moderation is disabled
    }

    // Track user message history
    this.trackUserMessage(userId, message);

    // Check each rule
    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.exemptions.includes(userId)) {
        continue;
      }

      const violation = await this.checkRule(rule, userId, username, message);
      if (violation) {
        await this.executeAction(streamId, rule, userId, username, message, violation);
        return false; // Block message
      }
    }

    return true; // Allow message
  }

  private trackUserMessage(userId: string, message: string): void {
    if (!this.userMessageHistory.has(userId)) {
      this.userMessageHistory.set(userId, []);
    }

    const history = this.userMessageHistory.get(userId)!;
    history.push(message);

    // Keep only last 50 messages per user
    if (history.length > 50) {
      history.shift();
    }

    // Update timestamp for rate limiting
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Count messages in last minute
    const recentMessages = history.filter((_, index) => {
      const messageTime = now - (history.length - index - 1) * 1000; // Approximate
      return messageTime > oneMinuteAgo;
    });

    if (recentMessages.length > this.config.spamDetection.maxMessagesPerMinute) {
      this.emit('spamDetected', userId, recentMessages.length);
    }
  }

  private async checkRule(rule: ModerationRule, userId: string, username: string, message: string): Promise<string | null> {
    switch (rule.type) {
      case 'word_filter':
        return this.checkWordFilter(rule, message);
      case 'spam_detection':
        return this.checkSpamDetection(rule, userId, message);
      case 'link_filter':
        return this.checkLinkFilter(rule, message);
      case 'caps_filter':
        return this.checkCapsFilter(rule, message);
      case 'custom':
        return this.checkCustomRule(rule, message);
      default:
        return null;
    }
  }

  private checkWordFilter(rule: ModerationRule, message: string): string | null {
    // In a real implementation, this would check against a comprehensive profanity list
    const bannedWords = ['spam', 'scam', 'fake']; // Simplified example
    
    const lowerMessage = message.toLowerCase();
    for (const word of bannedWords) {
      if (lowerMessage.includes(word)) {
        return `Contains banned word: ${word}`;
      }
    }

    return null;
  }

  private checkSpamDetection(rule: ModerationRule, userId: string, message: string): string | null {
    const history = this.userMessageHistory.get(userId) || [];
    
    // Check for duplicate messages
    const duplicateCount = history.filter(msg => msg === message).length;
    if (duplicateCount >= this.config.spamDetection.duplicateMessageThreshold) {
      return `Duplicate message detected (${duplicateCount} times)`;
    }

    // Check for similar messages
    const similarMessages = history.filter(msg => 
      this.calculateSimilarity(msg, message) > this.config.spamDetection.similarityThreshold
    );
    
    if (similarMessages.length >= 3) {
      return 'Similar messages detected (spam pattern)';
    }

    return null;
  }

  private checkLinkFilter(rule: ModerationRule, message: string): string | null {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = message.match(urlRegex);
    
    if (!urls) return null;

    for (const url of urls) {
      try {
        const domain = new URL(url).hostname;
        
        if (this.config.linkFilter.allowWhitelisted && 
            this.config.linkFilter.whitelistedDomains.includes(domain)) {
          continue;
        }

        if (this.config.linkFilter.blockSuspicious && this.isSuspiciousDomain(domain)) {
          return `Suspicious link detected: ${domain}`;
        }

        return `Link not allowed: ${domain}`;
      } catch {
        return `Invalid URL detected: ${url}`;
      }
    }

    return null;
  }

  private checkCapsFilter(rule: ModerationRule, message: string): string | null {
    if (message.length < this.config.capsFilter.minMessageLength) {
      return null;
    }

    const capsCount = (message.match(/[A-Z]/g) || []).length;
    const totalLetters = (message.match(/[A-Za-z]/g) || []).length;
    
    if (totalLetters === 0) return null;

    const capsRatio = capsCount / totalLetters;
    
    if (capsRatio > this.config.capsFilter.maxCapsRatio) {
      return `Excessive caps detected (${Math.round(capsRatio * 100)}%)`;
    }

    return null;
  }

  private checkCustomRule(rule: ModerationRule, message: string): string | null {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, message)) {
        continue;
      }

      return `Custom rule violation: ${rule.name}`;
    }

    return null;
  }

  private evaluateCondition(condition: ModerationCondition, message: string): boolean {
    const value = this.getFieldValue(condition.field, message);
    
    switch (condition.operator) {
      case 'contains':
        return typeof value === 'string' && 
               value.toLowerCase().includes(condition.value.toString().toLowerCase());
      case 'equals':
        return value === condition.value;
      case 'greater_than':
        return typeof value === 'number' && value > Number(condition.value);
      case 'less_than':
        return typeof value === 'number' && value < Number(condition.value);
      case 'regex':
        return typeof value === 'string' && 
               new RegExp(condition.value.toString()).test(value);
      case 'starts_with':
        return typeof value === 'string' && 
               value.toLowerCase().startsWith(condition.value.toString().toLowerCase());
      case 'ends_with':
        return typeof value === 'string' && 
               value.toLowerCase().endsWith(condition.value.toString().toLowerCase());
      default:
        return false;
    }
  }

  private getFieldValue(field: string, message: string): string | number {
    switch (field) {
      case 'message':
        return message;
      case 'caps_ratio':
        const capsCount = (message.match(/[A-Z]/g) || []).length;
        const totalLetters = (message.match(/[A-Za-z]/g) || []).length;
        return totalLetters > 0 ? capsCount / totalLetters : 0;
      default:
        return '';
    }
  }

  private async executeAction(
    streamId: string, 
    rule: ModerationRule, 
    userId: string, 
    username: string, 
    message: string, 
    reason: string
  ): Promise<void> {
    const event: ModerationEvent = {
      id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      streamId,
      userId,
      username,
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      originalMessage: message,
      reason,
      timestamp: new Date(),
      appealed: false,
      resolved: false
    };

    // Record violation
    this.recordUserViolation(userId, username, rule.severity);

    // Execute the action
    switch (rule.action.type) {
      case 'warn':
        this.emit('userWarned', userId, rule.action.message || reason);
        break;
      case 'timeout':
        this.emit('userTimedOut', userId, rule.action.duration || 300, rule.action.message);
        break;
      case 'ban':
        this.emit('userBanned', userId, rule.action.message);
        break;
      case 'delete':
        this.emit('messageDeleted', streamId, message, rule.action.message);
        break;
      case 'flag':
        this.emit('messageFlagged', streamId, message, reason);
        break;
    }

    this.emit('moderationAction', event);
  }

  private recordUserViolation(userId: string, username: string, severity: string): void {
    if (!this.userViolations.has(userId)) {
      this.userViolations.set(userId, {
        userId,
        username,
        violationCount: 0,
        lastViolation: new Date(),
        severity: 'low'
      });
    }

    const violation = this.userViolations.get(userId)!;
    violation.violationCount++;
    violation.lastViolation = new Date();
    
    // Update severity to highest level
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const currentLevel = severityLevels[violation.severity as keyof typeof severityLevels];
    const newLevel = severityLevels[severity as keyof typeof severityLevels];
    
    if (newLevel > currentLevel) {
      violation.severity = severity as 'low' | 'medium' | 'high' | 'critical';
    }
  }

  private recordModerationEvent(event: ModerationEvent): void {
    this.events.push(event);
    
    // Keep only last 10000 events for performance
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private isSuspiciousDomain(domain: string): boolean {
    // Simple suspicious domain detection
    const suspiciousPatterns = [
      /bit\.ly/i,
      /tinyurl/i,
      /t\.co/i,
      /goo\.gl/i,
      /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/, // IP addresses
      /[a-z0-9]{10,}\.com/i // Random character domains
    ];

    return suspiciousPatterns.some(pattern => pattern.test(domain));
  }

  // Public methods
  addRule(rule: ModerationRule): void {
    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
  }

  updateRule(ruleId: string, updates: Partial<ModerationRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates, { updatedAt: new Date() });
      this.emit('ruleUpdated', rule);
    }
  }

  deleteRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      this.emit('ruleDeleted', ruleId);
    }
  }

  getRules(): ModerationRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): ModerationRule | undefined {
    return this.rules.get(ruleId);
  }

  updateConfig(config: Partial<AutoModerationConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  getConfig(): AutoModerationConfig {
    return { ...this.config };
  }

  getModerationEvents(streamId?: string): ModerationEvent[] {
    if (streamId) {
      return this.events.filter(event => event.streamId === streamId);
    }
    return [...this.events];
  }

  getModerationStats(streamId?: string): ModerationStats {
    const events = this.getModerationEvents(streamId);
    
    const actionsByType: { [key: string]: number } = {};
    const actionsByRule: { [key: string]: number } = {};
    const timeDistribution: { [hour: number]: number } = {};

    events.forEach(event => {
      // Count by action type
      actionsByType[event.action.type] = (actionsByType[event.action.type] || 0) + 1;
      
      // Count by rule
      actionsByRule[event.ruleName] = (actionsByRule[event.ruleName] || 0) + 1;
      
      // Count by hour
      const hour = event.timestamp.getHours();
      timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
    });

    const topViolators = Array.from(this.userViolations.values())
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 10);

    return {
      totalActions: events.length,
      actionsByType,
      actionsByRule,
      falsePositives: events.filter(e => e.appealed && e.resolved).length,
      appeals: events.filter(e => e.appealed).length,
      resolvedAppeals: events.filter(e => e.appealed && e.resolved).length,
      topViolators,
      timeDistribution
    };
  }

  appealModerationAction(eventId: string, reason: string): void {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.appealed = true;
      this.emit('moderationAppealed', event, reason);
    }
  }

  resolveModerationAppeal(eventId: string, approved: boolean, reason: string): void {
    const event = this.events.find(e => e.id === eventId);
    if (event && event.appealed) {
      event.resolved = true;
      this.emit('moderationAppealResolved', event, approved, reason);
    }
  }
}

export default new StreamModerationService();