import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'super_chat' | 'subscription' | 'donation' | 'system';
  metadata?: {
    amount?: number;
    currency?: string;
    tier?: string;
    emotes?: EmoteUsage[];
    badges?: UserBadge[];
  };
}

export interface SuperChatMessage extends ChatMessage {
  type: 'super_chat';
  metadata: {
    amount: number;
    currency: string;
    color: string;
    duration: number;
  };
}

export interface EmoteUsage {
  name: string;
  id: string;
  positions: [number, number][];
}

export interface UserBadge {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface ChatSettings {
  slowMode: boolean;
  slowModeDelay: number;
  subscriberOnly: boolean;
  moderatorOnly: boolean;
  emoteOnly: boolean;
  maxMessageLength: number;
  allowLinks: boolean;
  autoModeration: {
    enabled: boolean;
    filterProfanity: boolean;
    filterSpam: boolean;
    filterCaps: boolean;
  };
}

export interface Moderator {
  userId: string;
  username: string;
  permissions: {
    deleteMessages: boolean;
    timeoutUsers: boolean;
    banUsers: boolean;
    manageEmotes: boolean;
    manageSettings: boolean;
  };
}

export interface ChatUser {
  id: string;
  username: string;
  avatar?: string;
  badges: UserBadge[];
  isSubscriber: boolean;
  isModerator: boolean;
  isOwner: boolean;
  subscriptionTier?: string;
  followDate?: Date;
}

export class LiveChatService extends EventEmitter {
  private socket: Socket | null = null;
  private streamId: string | null = null;
  private messages: ChatMessage[] = [];
  private users: Map<string, ChatUser> = new Map();
  private settings: ChatSettings;
  private moderators: Map<string, Moderator> = new Map();
  private messageQueue: ChatMessage[] = [];
  private isConnected = false;

  constructor() {
    super();
    this.settings = this.getDefaultSettings();
  }

  private getDefaultSettings(): ChatSettings {
    return {
      slowMode: false,
      slowModeDelay: 5,
      subscriberOnly: false,
      moderatorOnly: false,
      emoteOnly: false,
      maxMessageLength: 500,
      allowLinks: true,
      autoModeration: {
        enabled: true,
        filterProfanity: true,
        filterSpam: true,
        filterCaps: false
      }
    };
  }

  async connect(streamId: string, userId: string): Promise<void> {
    this.streamId = streamId;
    
    try {
      this.socket = io(process.env.REACT_APP_CHAT_SERVER_URL || 'ws://localhost:3001', {
        auth: {
          userId,
          streamId
        },
        transports: ['websocket']
      });

      this.setupSocketEventHandlers();
      
      await new Promise<void>((resolve, reject) => {
        this.socket!.on('connect', () => {
          this.isConnected = true;
          this.emit('connected');
          resolve();
        });
        
        this.socket!.on('connect_error', (error) => {
          this.emit('connectionError', error);
          reject(error);
        });
      });

      // Join the stream chat room
      this.socket.emit('join_stream', { streamId });
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.emit('disconnected');
    }
  }

  async sendMessage(content: string, userId: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Chat not connected');
    }

    // Validate message
    const validationResult = this.validateMessage(content, userId);
    if (!validationResult.valid) {
      throw new Error(validationResult.error);
    }

    const message: Partial<ChatMessage> = {
      id: this.generateMessageId(),
      userId,
      message: content,
      timestamp: new Date(),
      type: 'message'
    };

    // Process emotes
    message.metadata = {
      emotes: this.parseEmotes(content)
    };

    this.socket.emit('send_message', message);
  }

  async sendSuperChat(content: string, amount: number, currency: string, userId: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Chat not connected');
    }

    const superChatMessage: Partial<SuperChatMessage> = {
      id: this.generateMessageId(),
      userId,
      message: content,
      timestamp: new Date(),
      type: 'super_chat',
      metadata: {
        amount,
        currency,
        color: this.getSuperChatColor(amount),
        duration: this.getSuperChatDuration(amount)
      }
    };

    this.socket.emit('send_super_chat', superChatMessage);
  }

  async deleteMessage(messageId: string, moderatorId: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Chat not connected');
    }

    const moderator = this.moderators.get(moderatorId);
    if (!moderator || !moderator.permissions.deleteMessages) {
      throw new Error('Insufficient permissions');
    }

    this.socket.emit('delete_message', { messageId, moderatorId });
  }

  async timeoutUser(userId: string, duration: number, moderatorId: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Chat not connected');
    }

    const moderator = this.moderators.get(moderatorId);
    if (!moderator || !moderator.permissions.timeoutUsers) {
      throw new Error('Insufficient permissions');
    }

    this.socket.emit('timeout_user', { userId, duration, moderatorId });
  }

  async banUser(userId: string, moderatorId: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Chat not connected');
    }

    const moderator = this.moderators.get(moderatorId);
    if (!moderator || !moderator.permissions.banUsers) {
      throw new Error('Insufficient permissions');
    }

    this.socket.emit('ban_user', { userId, moderatorId });
  }

  updateSettings(newSettings: Partial<ChatSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    if (this.socket && this.isConnected) {
      this.socket.emit('update_settings', this.settings);
    }
    
    this.emit('settingsUpdated', this.settings);
  }

  addModerator(moderator: Moderator): void {
    this.moderators.set(moderator.userId, moderator);
    
    if (this.socket && this.isConnected) {
      this.socket.emit('add_moderator', moderator);
    }
    
    this.emit('moderatorAdded', moderator);
  }

  removeModerator(userId: string): void {
    this.moderators.delete(userId);
    
    if (this.socket && this.isConnected) {
      this.socket.emit('remove_moderator', { userId });
    }
    
    this.emit('moderatorRemoved', userId);
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getUsers(): ChatUser[] {
    return Array.from(this.users.values());
  }

  getSettings(): ChatSettings {
    return { ...this.settings };
  }

  getModerators(): Moderator[] {
    return Array.from(this.moderators.values());
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('message_received', (message: ChatMessage) => {
      this.messages.push(message);
      this.emit('messageReceived', message);
    });

    this.socket.on('super_chat_received', (superChat: SuperChatMessage) => {
      this.messages.push(superChat);
      this.emit('superChatReceived', superChat);
    });

    this.socket.on('message_deleted', (messageId: string) => {
      this.messages = this.messages.filter(msg => msg.id !== messageId);
      this.emit('messageDeleted', messageId);
    });

    this.socket.on('user_joined', (user: ChatUser) => {
      this.users.set(user.id, user);
      this.emit('userJoined', user);
    });

    this.socket.on('user_left', (userId: string) => {
      this.users.delete(userId);
      this.emit('userLeft', userId);
    });

    this.socket.on('user_timeout', (data: { userId: string; duration: number }) => {
      this.emit('userTimeout', data);
    });

    this.socket.on('user_banned', (userId: string) => {
      this.users.delete(userId);
      this.emit('userBanned', userId);
    });

    this.socket.on('settings_updated', (settings: ChatSettings) => {
      this.settings = settings;
      this.emit('settingsUpdated', settings);
    });

    this.socket.on('error', (error: any) => {
      this.emit('error', error);
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.emit('disconnected');
    });
  }

  private validateMessage(content: string, userId: string): { valid: boolean; error?: string } {
    // Check message length
    if (content.length > this.settings.maxMessageLength) {
      return { valid: false, error: 'Message too long' };
    }

    // Check if user is allowed to send messages
    const user = this.users.get(userId);
    if (!user) {
      return { valid: false, error: 'User not found' };
    }

    if (this.settings.subscriberOnly && !user.isSubscriber && !user.isModerator && !user.isOwner) {
      return { valid: false, error: 'Subscriber only mode enabled' };
    }

    if (this.settings.moderatorOnly && !user.isModerator && !user.isOwner) {
      return { valid: false, error: 'Moderator only mode enabled' };
    }

    // Check for links if not allowed
    if (!this.settings.allowLinks && this.containsLinks(content)) {
      return { valid: false, error: 'Links not allowed' };
    }

    // Auto-moderation checks
    if (this.settings.autoModeration.enabled) {
      if (this.settings.autoModeration.filterProfanity && this.containsProfanity(content)) {
        return { valid: false, error: 'Message contains inappropriate content' };
      }

      if (this.settings.autoModeration.filterSpam && this.isSpam(content, userId)) {
        return { valid: false, error: 'Message detected as spam' };
      }

      if (this.settings.autoModeration.filterCaps && this.isAllCaps(content)) {
        return { valid: false, error: 'Excessive caps not allowed' };
      }
    }

    return { valid: true };
  }

  private parseEmotes(content: string): EmoteUsage[] {
    // Simple emote parsing - in production, this would use a proper emote database
    const emoteRegex = /:(\w+):/g;
    const emotes: EmoteUsage[] = [];
    let match;

    while ((match = emoteRegex.exec(content)) !== null) {
      emotes.push({
        name: match[1],
        id: `emote_${match[1]}`,
        positions: [[match.index, match.index + match[0].length]]
      });
    }

    return emotes;
  }

  private getSuperChatColor(amount: number): string {
    if (amount >= 100) return '#FF0000';
    if (amount >= 50) return '#FF8C00';
    if (amount >= 20) return '#FFD700';
    if (amount >= 10) return '#32CD32';
    if (amount >= 5) return '#1E90FF';
    return '#9370DB';
  }

  private getSuperChatDuration(amount: number): number {
    if (amount >= 100) return 300; // 5 minutes
    if (amount >= 50) return 240;  // 4 minutes
    if (amount >= 20) return 180;  // 3 minutes
    if (amount >= 10) return 120;  // 2 minutes
    if (amount >= 5) return 60;    // 1 minute
    return 30; // 30 seconds
  }

  private containsLinks(content: string): boolean {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(content);
  }

  private containsProfanity(content: string): boolean {
    // Simple profanity filter - in production, use a comprehensive filter
    const profanityWords = ['spam', 'scam']; // Placeholder
    const lowerContent = content.toLowerCase();
    return profanityWords.some(word => lowerContent.includes(word));
  }

  private isSpam(content: string, userId: string): boolean {
    // Simple spam detection - check for repeated messages
    const recentMessages = this.messages
      .filter(msg => msg.userId === userId && Date.now() - msg.timestamp.getTime() < 30000)
      .slice(-5);
    
    return recentMessages.filter(msg => msg.message === content).length >= 3;
  }

  private isAllCaps(content: string): boolean {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    return letters.length > 10 && letters === letters.toUpperCase();
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Additional method for component integration
  clearChat(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Chat not connected');
    }

    this.messages = [];
    this.socket.emit('clear_chat');
    this.emit('chatCleared');
    return Promise.resolve();
  }
}