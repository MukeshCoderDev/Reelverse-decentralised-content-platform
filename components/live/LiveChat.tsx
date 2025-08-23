import { useEffect, useRef, useState, useCallback } from 'react';
import { useNumberFormat } from '../../hooks/useNumberFormat';

/**
 * Chat message types
 */
export type ChatMessageType = 'message' | 'tip' | 'subscription' | 'follow' | 'system';

/**
 * User badge types
 */
export type UserBadge = {
  type: 'subscriber' | 'moderator' | 'verified' | 'vip' | 'follower';
  level?: number;
  color: string;
  icon?: string;
};

/**
 * Chat message interface
 */
export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  message: string;
  timestamp: Date;
  type: ChatMessageType;
  badges: UserBadge[];
  color?: string;
  amount?: number; // for tips
  emotes?: { [key: string]: string }; // emote replacements
  isPinned?: boolean;
  isDeleted?: boolean;
}

/**
 * Chat permissions interface
 */
export interface ChatPermissions {
  canSendMessages: boolean;
  canUseEmotes: boolean;
  canSendTips: boolean;
  isSubscriber: boolean;
  isModerator: boolean;
  isOwner: boolean;
  slowModeDelay?: number;
}

/**
 * Live chat component properties
 */
export interface LiveChatProps {
  /** Stream ID for chat context */
  streamId: string;
  /** Whether the chat is enabled */
  enabled?: boolean;
  /** Whether slow mode is enabled */
  slowMode?: boolean;
  /** Slow mode delay in seconds */
  slowModeDelay?: number;
  /** Whether chat is subscriber-only */
  subscriberOnly?: boolean;
  /** Maximum message length */
  maxMessageLength?: number;
  /** Additional CSS classes */
  className?: string;
  /** Callback when message is sent */
  onMessageSent?: (message: string) => void;
  /** Callback when tip is initiated */
  onTipClick?: () => void;
}

/**
 * LiveChat component for real-time chat interaction
 */
export function LiveChat({
  streamId,
  enabled = true,
  slowMode = false,
  slowModeDelay = 5,
  subscriberOnly = false,
  maxMessageLength = 500,
  className = '',
  onMessageSent,
  onTipClick
}: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { formatCurrency } = useNumberFormat();

  // Mock user permissions
  const [userPermissions] = useState<ChatPermissions>({
    canSendMessages: true,
    canUseEmotes: true,
    canSendTips: true,
    isSubscriber: false,
    isModerator: false,
    isOwner: false,
    slowModeDelay: slowModeDelay
  });

  // Mock chat messages data
  const mockMessages: Omit<ChatMessage, 'id' | 'timestamp'>[] = [
    {
      userId: 'user1',
      username: 'techguru123',
      displayName: 'TechGuru',
      message: 'Great stream! Love the content 🔥',
      type: 'message',
      badges: [{ type: 'subscriber', level: 6, color: 'text-violet-400', icon: '★' }],
      color: 'text-blue-400'
    },
    {
      userId: 'user2',
      username: 'gamer_pro',
      displayName: 'GamerPro',
      message: 'First time here, amazing quality!',
      type: 'message',
      badges: [{ type: 'follower', color: 'text-green-400', icon: '♥' }],
      color: 'text-green-400'
    },
    {
      userId: 'user3',
      username: 'cryptowhale',
      displayName: 'CryptoWhale',
      message: 'Keep up the great work!',
      type: 'tip',
      badges: [{ type: 'vip', color: 'text-yellow-400', icon: '👑' }],
      color: 'text-yellow-400',
      amount: 10
    },
    {
      userId: 'user4',
      username: 'newviewer',
      displayName: 'NewViewer',
      message: 'Just followed! Excited for future streams',
      type: 'follow',
      badges: [],
      color: 'text-slate-300'
    }
  ];

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Simulate WebSocket connection and message updates
  useEffect(() => {
    setIsConnected(true);
    
    // Add initial messages
    const initialMessages = mockMessages.slice(0, 2).map(msg => ({
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date(Date.now() - Math.random() * 300000) // Random past timestamp
    }));
    setMessages(initialMessages);

    // Simulate periodic new messages
    const messageInterval = setInterval(() => {
      const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
      const newMessage: ChatMessage = {
        ...randomMessage,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        message: randomMessage.type === 'tip' 
          ? `Thanks for the stream! Here's ${formatCurrency(randomMessage.amount)} 💰`
          : randomMessage.message
      };

      setMessages(prev => [...prev.slice(-49), newMessage]); // Keep last 50 messages
    }, 3000 + Math.random() * 5000); // Random interval 3-8 seconds

    return () => {
      clearInterval(messageInterval);
      setIsConnected(false);
    };
  }, [streamId, formatCurrency]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle message submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputText.trim() || !enabled || !userPermissions.canSendMessages) return;

    // Check slow mode
    if (slowMode && lastMessageTime) {
      const timeSinceLastMessage = (Date.now() - lastMessageTime.getTime()) / 1000;
      if (timeSinceLastMessage < slowModeDelay) {
        return; // Still in slow mode cooldown
      }
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      userId: 'current_user',
      username: 'you',
      displayName: 'You',
      message: inputText.trim(),
      timestamp: new Date(),
      type: 'message',
      badges: userPermissions.isSubscriber 
        ? [{ type: 'subscriber', level: 1, color: 'text-violet-400', icon: '★' }]
        : [],
      color: 'text-white'
    };

    setMessages(prev => [...prev.slice(-49), userMessage]);
    setInputText('');
    setLastMessageTime(new Date());
    onMessageSent?.(inputText.trim());
  }, [inputText, enabled, userPermissions, slowMode, lastMessageTime, slowModeDelay, onMessageSent]);

  // Handle emoji insertion
  const insertEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Common emojis
  const commonEmojis = ['😀', '😂', '😍', '🔥', '👍', '❤️', '💯', '🎉', '👏', '😱'];

  // Get slow mode remaining time
  const getSlowModeRemaining = () => {
    if (!slowMode || !lastMessageTime) return 0;
    const elapsed = (Date.now() - lastMessageTime.getTime()) / 1000;
    return Math.max(0, slowModeDelay - elapsed);
  };

  // Render chat message
  const renderMessage = (message: ChatMessage) => {
    const isSystemMessage = message.type === 'system';
    const isTipMessage = message.type === 'tip';
    const isFollowMessage = message.type === 'follow';

    return (
      <div
        key={message.id}
        className={`
          flex flex-col gap-1 p-2 rounded-lg transition-colors
          ${message.isPinned ? 'bg-violet-900/20 border border-violet-700/30' : 'hover:bg-slate-800/30'}
          ${isSystemMessage ? 'bg-slate-800/50' : ''}
          ${isTipMessage ? 'bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-700/30' : ''}
          ${isFollowMessage ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/30' : ''}
          ${message.isDeleted ? 'opacity-50' : ''}
        `}
      >
        {/* Message header */}
        <div className="flex items-center gap-2 text-xs">
          {/* Badges */}
          {message.badges.map((badge, index) => (
            <span
              key={index}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${badge.color}`}
              title={`${badge.type}${badge.level ? ` (${badge.level} months)` : ''}`}
            >
              {badge.icon}
            </span>
          ))}
          
          {/* Username */}
          <span className={`font-semibold ${message.color || 'text-slate-300'}`}>
            {message.displayName || message.username}
          </span>
          
          {/* Timestamp */}
          <span className="text-slate-500 text-xs">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {/* Tip amount */}
          {isTipMessage && message.amount && (
            <span className="bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded text-xs font-semibold">
              {formatCurrency(message.amount)}
            </span>
          )}
        </div>

        {/* Message content */}
        <div className={`text-sm leading-relaxed ${message.isDeleted ? 'italic text-slate-500' : 'text-slate-100'}`}>
          {message.isDeleted ? '(Message deleted)' : message.message}
        </div>
      </div>
    );
  };

  // Chat disabled state
  if (!enabled) {
    return (
      <div className={`flex flex-col h-full border border-slate-800 rounded-xl bg-slate-900/50 ${className}`}>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <div className="h-12 w-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-slate-400">Chat is disabled</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full border border-slate-800 rounded-xl bg-slate-900/50 ${className}`}>
      {/* Chat header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-200">Live Chat</h3>
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        
        <div className="flex items-center gap-2">
          {slowMode && (
            <span className="text-xs text-orange-400 bg-orange-900/20 px-2 py-1 rounded">
              Slow {slowModeDelay}s
            </span>
          )}
          {subscriberOnly && (
            <span className="text-xs text-violet-400 bg-violet-900/20 px-2 py-1 rounded">
              Subs only
            </span>
          )}
          <button
            onClick={onTipClick}
            className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded transition-colors"
          >
            Tip
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-slate-800">
        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-slate-800 rounded-lg">
            <div className="flex flex-wrap gap-1">
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="p-1 hover:bg-slate-700 rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, maxMessageLength))}
              placeholder={
                subscriberOnly && !userPermissions.isSubscriber
                  ? 'Subscribe to chat'
                  : 'Say something...'
              }
              disabled={
                !userPermissions.canSendMessages ||
                (subscriberOnly && !userPermissions.isSubscriber) ||
                (slowMode && getSlowModeRemaining() > 0)
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={maxMessageLength}
            />
            
            {/* Character count */}
            {inputText.length > maxMessageLength * 0.8 && (
              <span className={`absolute right-2 top-2 text-xs ${
                inputText.length >= maxMessageLength ? 'text-red-400' : 'text-slate-400'
              }`}>
                {inputText.length}/{maxMessageLength}
              </span>
            )}
          </div>

          {/* Emoji button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
            disabled={!userPermissions.canUseEmotes}
          >
            😀
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={
              !inputText.trim() ||
              !userPermissions.canSendMessages ||
              (subscriberOnly && !userPermissions.isSubscriber) ||
              (slowMode && getSlowModeRemaining() > 0)
            }
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {slowMode && getSlowModeRemaining() > 0 
              ? Math.ceil(getSlowModeRemaining())
              : 'Send'
            }
          </button>
        </form>
      </div>
    </div>
  );
}