import { EventEmitter } from 'events';

// Chat interfaces
export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'super_chat' | 'donation' | 'subscription' | 'system';
  amount?: number;
  currency?: string;
  badges: UserBadge[];
  emotes: EmoteUsage[];
  isModerated: boolean;
  isModerator: boolean;
  isSubscriber: boolean;
  isOwner: boolean;
}

export interface UserBadge {
  id: string;
  name: string;
  icon: string;
  color: string;
  tier?: number;
}

export interface EmoteUsage {
  name: string;
  url: string;
  startIndex: number;
  endIndex: number;
}

export interface ChatSettings {
  slowMode: boolean;
  slowModeDelay: number; // seconds
  subscriberOnly: boolean;
  moderatorOnly: boolean;
  emoteOnly: boolean;
  maxMessageLength: number;
  autoModeration: boolean;
  bannedWords: string[];
  allowLinks: boolean;
}

export interface Moderator {
  userId: string;
  username: string;
  permissions: ModeratorPermission[];
  addedAt: Date;
}

export interface ModeratorPermission {
  action: 'timeout' | 'ban' | 'delete' | 'slow_mode' | 'subscriber_only';
  granted: boolean;
}

export interface SuperChatMessage extends ChatMessage {
  amount: number;
  currency: string;
  backgroundColor: string;
  textColor: string;
  duration: number; // seconds to pin
}

class LiveChatService extends EventEmitter {
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private streamId: string | null = null;
  private messages: ChatMessage[] = [];
  private moderators: Moderator[] = [];
  private bannedUsers: Set<string> = new Set();
  private timeoutUsers: Map<string, Date> = new Map();
  private messageQueue: ChatMessage[] = [];
  private settings: ChatSettings = {
    slowMode: false,
    slowModeDelay: 5,
    subscriberOnly: false,
    moderatorOnly: false,
    emoteOnly: false,
    maxMessageLength: 500,
    autoModeration: true,
    bannedWords: [],
    allowLinks: false
  };

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('messageReceived', (message: ChatMessage) => {
      this.processMessage(message);
    });

    this.on('userJoined', (userId: string, username: string) => {
      this.addSystemMessage(`${username} joined the chat`);
    });

    this.on('userLeft', (userId: string, username: string) => {
      this.addSystemMessage(`${username} left the chat`);
    });
  }

  async connect(streamId: string, wsUrl: string): Promise<void> {
    this.streamId = streamId;
    
    try {
      this.websocket = new WebSocket(`${wsUrl}/chat/${streamId}`);
      
      this.websocket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.processMessageQueue();
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.emit('disconnected');
        this.attemptReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to connect to chat:', error);
      throw new Error('Failed to connect to live chat');
    }
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'message':
        this.emit('messageReceived', data.message);
        break;
      case 'super_chat':
        this.handleSuperChat(data.message);
        break;
      case 'donation':
        this.handleDonation(data.message);
        break;
      case 'subscription':
        this.handleSubscription(data.message);
        break;
      case 'user_joined':
        this.emit('userJoined', data.userId, data.username);
        break;
      case 'user_left':
        this.emit('userLeft', data.userId, data.username);
        break;
      case 'moderation_action':
        this.handleModerationAction(data);
        break;
      case 'settings_update':
        this.updateSettings(data.settings);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private processMessage(message: ChatMessage): void {
    // Apply moderation filters
    if (this.shouldModerateMessage(message)) {
      message.isModerated = true;
      this.emit('messageModerated', message);
      return;
    }

    // Check slow mode
    if (this.settings.slowMode && !message.isModerator) {
      const lastMessage = this.messages
        .filter(m => m.userId === message.userId)
        .pop();
      
      if (lastMessage) {
        const timeDiff = (message.timestamp.getTime() - lastMessage.timestamp.getTime()) / 1000;
        if (timeDiff < this.settings.slowModeDelay) {
          this.emit('messageRejected', message, 'Slow mode active');
          return;
        }
      }
    }

    // Add message to chat
    this.messages.push(message);
    this.emit('messageAdded', message);

    // Keep only last 1000 messages for performance
    if (this.messages.length > 1000) {
      this.messages = this.messages.slice(-1000);
    }
  }

  private shouldModerateMessage(message: ChatMessage): boolean {
    // Check if user is banned
    if (this.bannedUsers.has(message.userId)) {
      return true;
    }

    // Check if user is timed out
    const timeoutEnd = this.timeoutUsers.get(message.userId);
    if (timeoutEnd && new Date() < timeoutEnd) {
      return true;
    }

    // Check subscriber only mode
    if (this.settings.subscriberOnly && !message.isSubscriber && !message.isModerator) {
      return true;
    }

    // Check moderator only mode
    if (this.settings.moderatorOnly && !message.isModerator) {
      return true;
    }

    // Auto moderation checks
    if (this.settings.autoModeration) {
      // Check banned words
      const messageText = message.message.toLowerCase();
      if (this.settings.bannedWords.some(word => messageText.includes(word.toLowerCase()))) {
        return true;
      }

      // Check links if not allowed
      if (!this.settings.allowLinks && this.containsLinks(message.message)) {
        return true;
      }

      // Check message length
      if (message.message.length > this.settings.maxMessageLength) {
        return true;
      }
    }

    return false;
  }

  private containsLinks(message: string): boolean {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(message);
  }

  async sendMessage(userId: string, username: string, message: string): Promise<void> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('Not connected to chat');
    }

    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username,
      message,
      timestamp: new Date(),
      type: 'message',
      badges: this.getUserBadges(userId),
      emotes: this.parseEmotes(message),
      isModerated: false,
      isModerator: this.isModerator(userId),
      isSubscriber: this.isSubscriber(userId),
      isOwner: this.isOwner(userId)
    };

    try {
      this.websocket.send(JSON.stringify({
        type: 'send_message',
        message: chatMessage
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error('Failed to send chat message');
    }
  }

  async sendSuperChat(userId: string, username: string, message: string, amount: number, currency: string): Promise<void> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('Not connected to chat');
    }

    const superChat: SuperChatMessage = {
      id: `super_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username,
      message,
      timestamp: new Date(),
      type: 'super_chat',
      amount,
      currency,
      badges: this.getUserBadges(userId),
      emotes: this.parseEmotes(message),
      isModerated: false,
      isModerator: this.isModerator(userId),
      isSubscriber: this.isSubscriber(userId),
      isOwner: this.isOwner(userId),
      backgroundColor: this.getSuperChatColor(amount),
      textColor: '#ffffff',
      duration: this.getSuperChatDuration(amount)
    };

    try {
      this.websocket.send(JSON.stringify({
        type: 'send_super_chat',
        message: superChat
      }));
    } catch (error) {
      console.error('Failed to send super chat:', error);
      throw new Error('Failed to send super chat');
    }
  }

  private getSuperChatColor(amount: number): string {
    if (amount >= 100) return '#e91e63'; // Pink for high amounts
    if (amount >= 50) return '#ff5722';  // Orange for medium amounts
    if (amount >= 20) return '#ff9800';  // Amber for low amounts
    return '#4caf50'; // Green for minimal amounts
  }

  private getSuperChatDuration(amount: number): number {
    if (amount >= 100) return 300; // 5 minutes
    if (amount >= 50) return 180;  // 3 minutes
    if (amount >= 20) return 120;  // 2 minutes
    return 60; // 1 minute
  }

  private handleSuperChat(message: SuperChatMessage): void {
    this.messages.push(message);
    this.emit('superChatReceived', message);
  }

  private handleDonation(message: ChatMessage): void {
    this.addSystemMessage(`${message.username} donated ${message.amount} ${message.currency}!`);
    this.emit('donationReceived', message);
  }

  private handleSubscription(message: ChatMessage): void {
    this.addSystemMessage(`${message.username} just subscribed!`);
    this.emit('subscriptionReceived', message);
  }

  private handleModerationAction(data: any): void {
    switch (data.action) {
      case 'timeout':
        this.timeoutUsers.set(data.userId, new Date(data.endTime));
        break;
      case 'ban':
        this.bannedUsers.add(data.userId);
        break;
      case 'unban':
        this.bannedUsers.delete(data.userId);
        this.timeoutUsers.delete(data.userId);
        break;
    }
    this.emit('moderationAction', data);
  }

  // Moderation methods
  async timeoutUser(userId: string, duration: number): Promise<void> {
    if (!this.websocket) return;

    const endTime = new Date(Date.now() + duration * 1000);
    this.timeoutUsers.set(userId, endTime);

    this.websocket.send(JSON.stringify({
      type: 'moderation_action',
      action: 'timeout',
      userId,
      duration
    }));
  }

  async banUser(userId: string): Promise<void> {
    if (!this.websocket) return;

    this.bannedUsers.add(userId);

    this.websocket.send(JSON.stringify({
      type: 'moderation_action',
      action: 'ban',
      userId
    }));
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (!this.websocket) return;

    this.messages = this.messages.filter(m => m.id !== messageId);

    this.websocket.send(JSON.stringify({
      type: 'moderation_action',
      action: 'delete_message',
      messageId
    }));

    this.emit('messageDeleted', messageId);
  }

  // Helper methods
  private getUserBadges(userId: string): UserBadge[] {
    const badges: UserBadge[] = [];
    
    if (this.isOwner(userId)) {
      badges.push({ id: 'owner', name: 'Owner', icon: '👑', color: '#ffd700' });
    }
    
    if (this.isModerator(userId)) {
      badges.push({ id: 'moderator', name: 'Moderator', icon: '🛡️', color: '#00ff00' });
    }
    
    if (this.isSubscriber(userId)) {
      badges.push({ id: 'subscriber', name: 'Subscriber', icon: '⭐', color: '#ff6b6b' });
    }

    return badges;
  }

  private parseEmotes(message: string): EmoteUsage[] {
    // Simple emote parsing - in real implementation, this would be more sophisticated
    const emotes: EmoteUsage[] = [];
    const emoteRegex = /:(\w+):/g;
    let match;

    while ((match = emoteRegex.exec(message)) !== null) {
      emotes.push({
        name: match[1],
        url: `/emotes/${match[1]}.png`,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    return emotes;
  }

  private isModerator(userId: string): boolean {
    return this.moderators.some(mod => mod.userId === userId);
  }

  private isSubscriber(userId: string): boolean {
    // This would check against subscription data
    return false; // Placeholder
  }

  private isOwner(userId: string): boolean {
    // This would check if user is the stream owner
    return false; // Placeholder
  }

  private addSystemMessage(message: string): void {
    const systemMessage: ChatMessage = {
      id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'system',
      username: 'System',
      message,
      timestamp: new Date(),
      type: 'system',
      badges: [],
      emotes: [],
      isModerated: false,
      isModerator: false,
      isSubscriber: false,
      isOwner: false
    };

    this.messages.push(systemMessage);
    this.emit('messageAdded', systemMessage);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnectFailed');
      return;
    }

    setTimeout(() => {
      this.reconnectAttempts++;
      if (this.streamId) {
        this.connect(this.streamId, 'ws://localhost:8080'); // Use appropriate WebSocket URL
      }
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.processMessage(message);
      }
    }
  }

  private updateSettings(newSettings: Partial<ChatSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsUpdated', this.settings);
  }

  // Public methods
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getSettings(): ChatSettings {
    return { ...this.settings };
  }

  updateChatSettings(settings: Partial<ChatSettings>): void {
    if (this.websocket && this.isConnected) {
      this.websocket.send(JSON.stringify({
        type: 'update_settings',
        settings
      }));
    }
  }

  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isConnected = false;
    this.streamId = null;
  }

  isConnectedToChat(): boolean {
    return this.isConnected;
  }
}

export default new LiveChatService();