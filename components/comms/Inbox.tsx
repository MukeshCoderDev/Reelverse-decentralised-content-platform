import React, { useState, useRef, useEffect } from 'react';
import Icon from '../Icon';
import Button from '../Button';

interface Conversation {
    id: string;
    participants: User[];
    lastMessage: Message;
    unreadCount: number;
    type: 'direct' | 'group' | 'creator';
    timestamp: string;
    online?: boolean;
}

interface User {
    id: string;
    name: string;
    username: string;
    avatar: string;
    verified?: boolean;
    online?: boolean;
}

interface Message {
    id: string;
    content: string;
    author: User;
    timestamp: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'link';
    media?: MediaAttachment[];
    reactions?: Reaction[];
    replyTo?: Message;
    readBy: string[];
    edited?: boolean;
}

interface MediaAttachment {
    id: string;
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    thumbnail?: string;
    name?: string;
    size?: number;
}

interface Reaction {
    emoji: string;
    users: string[];
    count: number;
}

interface InboxProps {
    threads: any[];
}

export function Inbox({ threads }: InboxProps) {
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread' | 'creators'>('all');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Mock conversations data
    const conversations: Conversation[] = [
        {
            id: '1',
            participants: [
                { id: '1', name: 'TechGuru', username: '@techguru', avatar: 'https://picsum.photos/seed/techguru/40/40', verified: true, online: true }
            ],
            lastMessage: {
                id: '1',
                content: 'Thanks for the collaboration! The video turned out great 🎬',
                author: { id: '1', name: 'TechGuru', username: '@techguru', avatar: 'https://picsum.photos/seed/techguru/40/40' },
                timestamp: '2m ago',
                type: 'text',
                readBy: ['current-user']
            },
            unreadCount: 0,
            type: 'creator',
            timestamp: '2m ago'
        },
        {
            id: '2',
            participants: [
                { id: '2', name: 'PixelPlays', username: '@pixelplays', avatar: 'https://picsum.photos/seed/pixelplays/40/40', online: true }
            ],
            lastMessage: {
                id: '2',
                content: 'Hey! Loved your latest video on Web3. Would love to collab sometime!',
                author: { id: '2', name: 'PixelPlays', username: '@pixelplays', avatar: 'https://picsum.photos/seed/pixelplays/40/40' },
                timestamp: '1h ago',
                type: 'text',
                readBy: []
            },
            unreadCount: 2,
            type: 'creator',
            timestamp: '1h ago'
        },
        {
            id: '3',
            participants: [
                { id: '3', name: 'CryptoFan42', username: '@cryptofan42', avatar: 'https://picsum.photos/seed/cryptofan/40/40', online: false }
            ],
            lastMessage: {
                id: '3',
                content: 'Amazing tutorial! Can you make one about DeFi next?',
                author: { id: '3', name: 'CryptoFan42', username: '@cryptofan42', avatar: 'https://picsum.photos/seed/cryptofan/40/40' },
                timestamp: '3h ago',
                type: 'text',
                readBy: []
            },
            unreadCount: 1,
            type: 'direct',
            timestamp: '3h ago'
        },
        {
            id: '4',
            participants: [
                { id: '4', name: 'DIYDebi', username: '@diydebi', avatar: 'https://picsum.photos/seed/diydebi/40/40', verified: true, online: true }
            ],
            lastMessage: {
                id: '4',
                content: '📸 Image',
                author: { id: '4', name: 'DIYDebi', username: '@diydebi', avatar: 'https://picsum.photos/seed/diydebi/40/40' },
                timestamp: '1 day ago',
                type: 'image',
                media: [{ id: '1', type: 'image', url: 'https://picsum.photos/seed/media1/300/200', thumbnail: 'https://picsum.photos/seed/media1/60/40' }],
                readBy: ['current-user']
            },
            unreadCount: 0,
            type: 'creator',
            timestamp: '1 day ago'
        }
    ];

    // Mock messages for selected conversation
    const getMessagesForConversation = (conversationId: string): Message[] => {
        const baseMessages: Message[] = [
            {
                id: '1',
                content: 'Hey! How are you doing?',
                author: conversations.find(c => c.id === conversationId)?.participants[0] || conversations[0].participants[0],
                timestamp: '10:30 AM',
                type: 'text',
                readBy: ['current-user']
            },
            {
                id: '2',
                content: 'I\'m doing great! Just finished editing my latest video 🎬',
                author: { id: 'current', name: 'You', username: '@you', avatar: 'https://picsum.photos/seed/you/40/40' },
                timestamp: '10:32 AM',
                type: 'text',
                readBy: ['other-user']
            },
            {
                id: '3',
                content: 'That sounds awesome! What\'s it about?',
                author: conversations.find(c => c.id === conversationId)?.participants[0] || conversations[0].participants[0],
                timestamp: '10:33 AM',
                type: 'text',
                readBy: ['current-user']
            },
            {
                id: '4',
                content: 'It\'s a deep dive into Web3 development. I think you\'ll love it!',
                author: { id: 'current', name: 'You', username: '@you', avatar: 'https://picsum.photos/seed/you/40/40' },
                timestamp: '10:35 AM',
                type: 'text',
                readBy: ['other-user'],
                reactions: [{ emoji: '🔥', users: ['other-user'], count: 1 }]
            }
        ];

        if (conversationId === '4') {
            baseMessages.push({
                id: '5',
                content: 'Check out this behind-the-scenes shot!',
                author: conversations[3].participants[0],
                timestamp: '10:40 AM',
                type: 'image',
                media: [{ id: '1', type: 'image', url: 'https://picsum.photos/seed/media1/400/300', thumbnail: 'https://picsum.photos/seed/media1/100/75' }],
                readBy: ['current-user']
            });
        }

        return baseMessages;
    };

    const filteredConversations = conversations.filter(conv => {
        if (filter === 'unread') return conv.unreadCount > 0;
        if (filter === 'creators') return conv.type === 'creator';
        return true;
    });

    const selectedConv = conversations.find(c => c.id === selectedConversation);
    const messages = selectedConversation ? getMessagesForConversation(selectedConversation) : [];

    const handleSendMessage = () => {
        if (messageInput.trim() && selectedConversation) {
            // In a real app, this would send via WebSocket
            console.log('Sending message:', messageInput);
            setMessageInput('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const formatTime = (timestamp: string) => {
        // Simple time formatting - in real app would use proper date library
        return timestamp;
    };

    return (
        <div className="h-[calc(100vh-8rem)] bg-background rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 h-full">
                {/* Instagram-style Conversation List */}
                <div className="col-span-1 border-r border-border flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Messages</h2>
                            <Button variant="ghost" size="sm">
                                <Icon name="plus" size={16} />
                            </Button>
                        </div>
                        
                        {/* TikTok-style Filter Tabs */}
                        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                            {(['all', 'unread', 'creators'] as const).map((filterOption) => (
                                <button
                                    key={filterOption}
                                    onClick={() => setFilter(filterOption)}
                                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                                        filter === filterOption
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {filterOption}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredConversations.map((conversation) => (
                            <button
                                key={conversation.id}
                                onClick={() => setSelectedConversation(conversation.id)}
                                className={`w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left ${
                                    selectedConversation === conversation.id ? 'bg-secondary' : ''
                                }`}
                            >
                                <div className="relative">
                                    <img 
                                        src={conversation.participants[0].avatar}
                                        alt={conversation.participants[0].name}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                    {conversation.participants[0].online && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
                                    )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium truncate">{conversation.participants[0].name}</span>
                                        {conversation.participants[0].verified && (
                                            <Icon name="shield-check" size={14} className="text-blue-500" />
                                        )}
                                        {conversation.type === 'creator' && (
                                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                                Creator
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground truncate">
                                            {conversation.lastMessage.type === 'image' ? '📸 Photo' :
                                             conversation.lastMessage.type === 'video' ? '🎥 Video' :
                                             conversation.lastMessage.content}
                                        </p>
                                        <div className="flex items-center gap-2 ml-2">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {conversation.timestamp}
                                            </span>
                                            {conversation.unreadCount > 0 && (
                                                <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-xs text-primary-foreground font-bold">
                                                    {conversation.unreadCount}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Message Area */}
                <div className="col-span-1 md:col-span-2 flex flex-col">
                    {selectedConv ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-border">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img 
                                                src={selectedConv.participants[0].avatar}
                                                alt={selectedConv.participants[0].name}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                            {selectedConv.participants[0].online && (
                                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold">{selectedConv.participants[0].name}</h3>
                                                {selectedConv.participants[0].verified && (
                                                    <Icon name="shield-check" size={16} className="text-blue-500" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {selectedConv.participants[0].online ? 'Active now' : 'Last seen recently'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm">
                                            <Icon name="video" size={16} />
                                        </Button>
                                        <Button variant="ghost" size="sm">
                                            <Icon name="info" size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((message, index) => {
                                    const isCurrentUser = message.author.id === 'current';
                                    const showAvatar = !isCurrentUser && (index === 0 || messages[index - 1].author.id !== message.author.id);
                                    
                                    return (
                                        <div key={message.id} className={`flex items-end gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                                            {!isCurrentUser && (
                                                <img 
                                                    src={message.author.avatar}
                                                    alt={message.author.name}
                                                    className={`w-6 h-6 rounded-full ${showAvatar ? 'opacity-100' : 'opacity-0'}`}
                                                />
                                            )}
                                            
                                            <div className={`max-w-xs lg:max-w-md ${isCurrentUser ? 'order-1' : 'order-2'}`}>
                                                <div className={`rounded-2xl px-4 py-2 ${
                                                    isCurrentUser 
                                                        ? 'bg-primary text-primary-foreground' 
                                                        : 'bg-secondary text-foreground'
                                                }`}>
                                                    {message.type === 'text' ? (
                                                        <p className="text-sm">{message.content}</p>
                                                    ) : message.type === 'image' && message.media ? (
                                                        <div className="space-y-2">
                                                            <img 
                                                                src={message.media[0].url}
                                                                alt="Shared image"
                                                                className="rounded-lg max-w-full h-auto"
                                                            />
                                                            {message.content && (
                                                                <p className="text-sm">{message.content}</p>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                
                                                {/* Message reactions */}
                                                {message.reactions && message.reactions.length > 0 && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {message.reactions.map((reaction, reactionIndex) => (
                                                            <button
                                                                key={reactionIndex}
                                                                className="flex items-center gap-1 px-2 py-1 bg-secondary hover:bg-secondary/80 rounded-full text-xs transition-colors"
                                                            >
                                                                <span>{reaction.emoji}</span>
                                                                <span>{reaction.count}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                <p className={`text-xs text-muted-foreground mt-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                                                    {formatTime(message.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="p-4 border-t border-border">
                                <div className="flex items-end gap-3">
                                    <Button variant="ghost" size="sm">
                                        <Icon name="image" size={16} />
                                    </Button>
                                    
                                    <div className="flex-1">
                                        <textarea
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Type a message..."
                                            className="w-full p-3 bg-secondary border border-border rounded-2xl resize-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                            rows={1}
                                        />
                                    </div>
                                    
                                    <Button 
                                        onClick={handleSendMessage} 
                                        disabled={!messageInput.trim()}
                                        size="sm"
                                    >
                                        <Icon name="send" size={16} />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon name="message-circle" size={32} className="text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
                                <p className="text-muted-foreground">
                                    Choose a conversation from the list to start messaging
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
