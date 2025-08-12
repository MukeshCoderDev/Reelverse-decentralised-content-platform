
import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import Button from '../components/Button';

interface CommunityServer {
    id: string;
    name: string;
    icon: string;
    banner?: string;
    description: string;
    memberCount: number;
    channels: CommunityChannel[];
    roles: Role[];
    unreadCount?: number;
}

interface CommunityChannel {
    id: string;
    name: string;
    type: 'text' | 'voice' | 'announcement' | 'thread';
    description?: string;
    unreadCount?: number;
    lastMessage?: string;
    lastActivity?: string;
}

interface Role {
    id: string;
    name: string;
    color: string;
    permissions: string[];
}

interface Discussion {
    id: string;
    title: string;
    content: string;
    author: {
        name: string;
        avatar: string;
        role?: Role;
    };
    replies: number;
    votes: { up: number; down: number };
    tags: string[];
    pinned: boolean;
    locked: boolean;
    timestamp: string;
}

interface Message {
    id: string;
    content: string;
    author: {
        name: string;
        avatar: string;
        role?: Role;
    };
    timestamp: string;
    reactions?: { emoji: string; count: number; users: string[] }[];
    replyTo?: string;
}

const CommunitiesPage: React.FC = () => {
    const [selectedServer, setSelectedServer] = useState<string>('reelverse-main');
    const [selectedChannel, setSelectedChannel] = useState<string>('general');
    const [activeView, setActiveView] = useState<'chat' | 'threads'>('chat');
    const [isTyping, setIsTyping] = useState(false);
    const [messageInput, setMessageInput] = useState('');

    // Mock data
    const servers: CommunityServer[] = [
        {
            id: 'reelverse-main',
            name: 'Reelverse',
            icon: '🎬',
            banner: 'https://picsum.photos/seed/reelverse/800/200',
            description: 'Official Reelverse community for creators and viewers',
            memberCount: 12847,
            unreadCount: 3,
            channels: [
                { id: 'announcements', name: 'announcements', type: 'announcement', description: 'Official announcements', unreadCount: 1 },
                { id: 'general', name: 'general', type: 'text', description: 'General discussion', unreadCount: 2, lastMessage: 'Hey everyone! 👋', lastActivity: '2m ago' },
                { id: 'creators', name: 'creators', type: 'text', description: 'Creator discussions', lastMessage: 'New monetization features!', lastActivity: '5m ago' },
                { id: 'tech-talk', name: 'tech-talk', type: 'text', description: 'Technical discussions', lastMessage: 'Web3 integration update', lastActivity: '1h ago' },
                { id: 'voice-lounge', name: 'voice-lounge', type: 'voice', description: 'Voice chat' },
            ],
            roles: [
                { id: 'admin', name: 'Admin', color: '#ff4444', permissions: ['all'] },
                { id: 'moderator', name: 'Moderator', color: '#44ff44', permissions: ['moderate'] },
                { id: 'creator', name: 'Creator', color: '#4444ff', permissions: ['create'] },
                { id: 'member', name: 'Member', color: '#888888', permissions: ['read', 'write'] },
            ]
        },
        {
            id: 'web3-builders',
            name: 'Web3 Builders',
            icon: '⚡',
            description: 'Community for Web3 developers and builders',
            memberCount: 8234,
            channels: [
                { id: 'general', name: 'general', type: 'text', description: 'General discussion' },
                { id: 'dev-help', name: 'dev-help', type: 'text', description: 'Development help' },
                { id: 'showcase', name: 'showcase', type: 'text', description: 'Show your projects' },
            ],
            roles: []
        },
        {
            id: 'nft-creators',
            name: 'NFT Creators',
            icon: '🎨',
            description: 'Community for NFT artists and creators',
            memberCount: 5672,
            unreadCount: 1,
            channels: [
                { id: 'general', name: 'general', type: 'text', description: 'General discussion', unreadCount: 1 },
                { id: 'art-share', name: 'art-share', type: 'text', description: 'Share your art' },
                { id: 'marketplace', name: 'marketplace', type: 'text', description: 'Buy and sell NFTs' },
            ],
            roles: []
        }
    ];

    const discussions: Discussion[] = [
        {
            id: '1',
            title: 'Welcome to Reelverse Communities! 📢',
            content: 'This is our new community feature where you can connect with other creators and viewers. Feel free to introduce yourself!',
            author: { name: 'ReelverseTeam', avatar: 'https://picsum.photos/seed/team/32/32', role: servers[0].roles[0] },
            replies: 47,
            votes: { up: 156, down: 2 },
            tags: ['announcement', 'welcome'],
            pinned: true,
            locked: false,
            timestamp: '2 days ago'
        },
        {
            id: '2',
            title: 'New Monetization Features Coming Soon! 💰',
            content: 'We\'re excited to announce new ways for creators to monetize their content including tips, subscriptions, and NFT drops.',
            author: { name: 'TechGuru', avatar: 'https://picsum.photos/seed/techguru/32/32', role: servers[0].roles[2] },
            replies: 23,
            votes: { up: 89, down: 1 },
            tags: ['monetization', 'features'],
            pinned: false,
            locked: false,
            timestamp: '1 day ago'
        },
        {
            id: '3',
            title: 'How to optimize your content for discovery?',
            content: 'Looking for tips on how to make my videos more discoverable. What strategies work best on Reelverse?',
            author: { name: 'NewCreator42', avatar: 'https://picsum.photos/seed/newcreator/32/32' },
            replies: 15,
            votes: { up: 34, down: 0 },
            tags: ['tips', 'discovery'],
            pinned: false,
            locked: false,
            timestamp: '3 hours ago'
        }
    ];

    const messages: Message[] = [
        {
            id: '1',
            content: 'Hey everyone! Welcome to the general chat 👋',
            author: { name: 'CommunityMod', avatar: 'https://picsum.photos/seed/mod/32/32', role: servers[0].roles[1] },
            timestamp: '10:30 AM',
            reactions: [{ emoji: '👋', count: 12, users: ['user1', 'user2'] }]
        },
        {
            id: '2',
            content: 'Excited to be part of this community! Just uploaded my first video 🎬',
            author: { name: 'FirstTimeCreator', avatar: 'https://picsum.photos/seed/first/32/32' },
            timestamp: '10:32 AM',
            reactions: [
                { emoji: '🎉', count: 8, users: ['user1', 'user2'] },
                { emoji: '🔥', count: 5, users: ['user3', 'user4'] }
            ]
        },
        {
            id: '3',
            content: 'That\'s awesome! What\'s your video about?',
            author: { name: 'CuriousViewer', avatar: 'https://picsum.photos/seed/curious/32/32' },
            timestamp: '10:33 AM',
            replyTo: '2'
        },
        {
            id: '4',
            content: 'It\'s a Web3 tutorial for beginners. Took me weeks to make! 😅',
            author: { name: 'FirstTimeCreator', avatar: 'https://picsum.photos/seed/first/32/32' },
            timestamp: '10:35 AM',
            replyTo: '3'
        }
    ];

    const currentServer = servers.find(s => s.id === selectedServer);
    const currentChannel = currentServer?.channels.find(c => c.id === selectedChannel);

    const handleSendMessage = () => {
        if (messageInput.trim()) {
            // In a real app, this would send the message via WebSocket
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

    return (
        <div className="h-screen bg-background flex">
            {/* Discord-style Server List */}
            <div className="w-16 bg-secondary border-r border-border flex flex-col items-center py-3 gap-2">
                {servers.map((server) => (
                    <button
                        key={server.id}
                        onClick={() => setSelectedServer(server.id)}
                        className={`relative w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all hover:rounded-xl ${
                            selectedServer === server.id
                                ? 'bg-primary text-primary-foreground rounded-xl'
                                : 'bg-muted hover:bg-muted/80'
                        }`}
                        title={server.name}
                    >
                        {server.icon}
                        {server.unreadCount && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                                {server.unreadCount}
                            </div>
                        )}
                    </button>
                ))}
                
                <div className="w-8 h-px bg-border my-2" />
                
                <button className="w-12 h-12 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-2xl transition-all hover:rounded-xl">
                    +
                </button>
            </div>

            {/* Discord-style Channel List */}
            <div className="w-60 bg-secondary/50 border-r border-border flex flex-col">
                {/* Server Header */}
                {currentServer && (
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{currentServer.icon}</span>
                            <div className="flex-1">
                                <h2 className="font-semibold">{currentServer.name}</h2>
                                <p className="text-xs text-muted-foreground">
                                    {currentServer.memberCount.toLocaleString()} members
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Channel List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {currentServer?.channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => setSelectedChannel(channel.id)}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                                selectedChannel === channel.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-background text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Icon 
                                name={channel.type === 'voice' ? 'broadcast' : 'message-circle'} 
                                size={16} 
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">{channel.name}</span>
                                    {channel.unreadCount && (
                                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                                            {channel.unreadCount}
                                        </div>
                                    )}
                                </div>
                                {channel.lastMessage && (
                                    <p className="text-xs text-muted-foreground truncate">
                                        {channel.lastMessage}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                {/* User Info */}
                <div className="p-3 border-t border-border">
                    <div className="flex items-center gap-3">
                        <img 
                            src="https://picsum.photos/seed/user/32/32" 
                            alt="User" 
                            className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-medium">You</p>
                            <p className="text-xs text-muted-foreground">Online</p>
                        </div>
                        <Button variant="ghost" size="sm">
                            <Icon name="settings" size={16} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {/* Channel Header */}
                <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Icon name="message-circle" size={20} />
                            <div>
                                <h3 className="font-semibold">#{currentChannel?.name}</h3>
                                {currentChannel?.description && (
                                    <p className="text-sm text-muted-foreground">{currentChannel.description}</p>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Button
                                variant={activeView === 'chat' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveView('chat')}
                            >
                                <Icon name="message-circle" className="mr-2" size={16} />
                                Chat
                            </Button>
                            <Button
                                variant={activeView === 'threads' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveView('threads')}
                            >
                                <Icon name="users" className="mr-2" size={16} />
                                Threads
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    {activeView === 'chat' ? (
                        /* Discord-style Chat */
                        <div className="h-full flex flex-col">
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((message) => (
                                    <div key={message.id} className="flex items-start gap-3 group hover:bg-secondary/30 p-2 rounded-lg -m-2">
                                        <img 
                                            src={message.author.avatar} 
                                            alt={message.author.name}
                                            className="w-8 h-8 rounded-full"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm">{message.author.name}</span>
                                                {message.author.role && (
                                                    <span 
                                                        className="text-xs px-2 py-0.5 rounded-full"
                                                        style={{ backgroundColor: message.author.role.color + '20', color: message.author.role.color }}
                                                    >
                                                        {message.author.role.name}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">{message.timestamp}</span>
                                            </div>
                                            
                                            {message.replyTo && (
                                                <div className="text-xs text-muted-foreground mb-1 pl-4 border-l-2 border-muted">
                                                    Replying to previous message
                                                </div>
                                            )}
                                            
                                            <p className="text-sm">{message.content}</p>
                                            
                                            {message.reactions && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    {message.reactions.map((reaction, index) => (
                                                        <button
                                                            key={index}
                                                            className="flex items-center gap-1 px-2 py-1 bg-secondary hover:bg-secondary/80 rounded-full text-xs transition-colors"
                                                        >
                                                            <span>{reaction.emoji}</span>
                                                            <span>{reaction.count}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Message Input */}
                            <div className="p-4 border-t border-border">
                                <div className="flex items-end gap-3">
                                    <div className="flex-1">
                                        <textarea
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder={`Message #${currentChannel?.name}`}
                                            className="w-full p-3 bg-secondary border border-border rounded-lg resize-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                            rows={1}
                                        />
                                    </div>
                                    <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                                        <Icon name="send" size={16} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Reddit-style Threads */
                        <div className="h-full overflow-y-auto p-6">
                            <div className="max-w-4xl mx-auto space-y-4">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-semibold">Community Discussions</h2>
                                    <Button>
                                        <Icon name="plus" className="mr-2" size={16} />
                                        New Thread
                                    </Button>
                                </div>
                                
                                {discussions.map((discussion) => (
                                    <div key={discussion.id} className="bg-secondary rounded-xl p-6 hover:bg-secondary/80 transition-colors cursor-pointer">
                                        <div className="flex items-start gap-4">
                                            {/* Reddit-style Voting */}
                                            <div className="flex flex-col items-center gap-1">
                                                <button className="p-1 hover:bg-background rounded transition-colors">
                                                    <Icon name="chevron-up" size={16} className="text-muted-foreground hover:text-green-500" />
                                                </button>
                                                <span className="text-sm font-medium">
                                                    {discussion.votes.up - discussion.votes.down}
                                                </span>
                                                <button className="p-1 hover:bg-background rounded transition-colors">
                                                    <Icon name="chevron-down" size={16} className="text-muted-foreground hover:text-red-500" />
                                                </button>
                                            </div>
                                            
                                            {/* Discussion Content */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {discussion.pinned && (
                                                        <Icon name="pin" size={14} className="text-green-500" />
                                                    )}
                                                    {discussion.locked && (
                                                        <Icon name="lock" size={14} className="text-red-500" />
                                                    )}
                                                    <h3 className="font-semibold">{discussion.title}</h3>
                                                </div>
                                                
                                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                                    {discussion.content}
                                                </p>
                                                
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <img 
                                                            src={discussion.author.avatar} 
                                                            alt={discussion.author.name}
                                                            className="w-4 h-4 rounded-full"
                                                        />
                                                        <span>{discussion.author.name}</span>
                                                        {discussion.author.role && (
                                                            <span 
                                                                className="px-1.5 py-0.5 rounded-full text-xs"
                                                                style={{ backgroundColor: discussion.author.role.color + '20', color: discussion.author.role.color }}
                                                            >
                                                                {discussion.author.role.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span>{discussion.timestamp}</span>
                                                    <span>{discussion.replies} replies</span>
                                                </div>
                                                
                                                {discussion.tags.length > 0 && (
                                                    <div className="flex items-center gap-2 mt-3">
                                                        {discussion.tags.map((tag) => (
                                                            <span 
                                                                key={tag}
                                                                className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                                                            >
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Member List (Discord-style) */}
            <div className="w-60 bg-secondary/30 border-l border-border p-4">
                <h4 className="font-semibold mb-3 text-sm">Online — 234</h4>
                <div className="space-y-2">
                    {['Admin', 'Moderators', 'Creators', 'Members'].map((roleGroup, index) => (
                        <div key={roleGroup}>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                {roleGroup} — {Math.floor(Math.random() * 50 + 10)}
                            </h5>
                            <div className="space-y-1 mb-4">
                                {Array.from({ length: Math.floor(Math.random() * 5 + 2) }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-2 p-1 hover:bg-background rounded transition-colors">
                                        <div className="relative">
                                            <img 
                                                src={`https://picsum.photos/seed/member${index}${i}/24/24`} 
                                                alt="Member"
                                                className="w-6 h-6 rounded-full"
                                            />
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                                        </div>
                                        <span className="text-sm">Member{index}{i}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CommunitiesPage;
