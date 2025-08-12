
import React, { useState, useEffect, useRef } from 'react';
import Icon from '../components/Icon';
import Button from '../components/Button';

interface LiveStream {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    status: 'scheduled' | 'live' | 'ended';
    startTime: Date;
    viewers: number;
    duration: string;
    category: string;
}

interface ChatMessage {
    id: string;
    user: {
        name: string;
        avatar: string;
        badges: string[];
        color: string;
    };
    message: string;
    timestamp: Date;
    type: 'message' | 'super_chat' | 'subscription' | 'donation';
    amount?: number;
}

interface StreamMetrics {
    viewers: number;
    peakViewers: number;
    chatMessages: number;
    likes: number;
    shares: number;
    superChats: number;
    donations: number;
    newSubscribers: number;
}

const LivePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'analytics'>('dashboard');
    const [isLive, setIsLive] = useState(false);
    const [streamSettings, setStreamSettings] = useState({
        title: 'Web3 Development Live Session',
        description: 'Building the future of decentralized applications',
        category: 'Technology',
        privacy: 'public' as 'public' | 'unlisted' | 'private',
        chatEnabled: true,
        donationsEnabled: true,
        recording: true
    });
    
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Mock live stream data
    const currentStream: LiveStream = {
        id: 'live_1',
        title: streamSettings.title,
        description: streamSettings.description,
        thumbnail: 'https://picsum.photos/seed/livestream/640/360',
        status: isLive ? 'live' : 'scheduled',
        startTime: new Date(),
        viewers: 1247,
        duration: '2:34:15',
        category: streamSettings.category
    };

    // Mock stream metrics
    const metrics: StreamMetrics = {
        viewers: 1247,
        peakViewers: 1856,
        chatMessages: 3421,
        likes: 892,
        shares: 156,
        superChats: 23,
        donations: 1840,
        newSubscribers: 47
    };

    // Mock chat messages
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            user: { name: 'TechEnthusiast', avatar: 'https://picsum.photos/seed/user1/32/32', badges: ['subscriber'], color: '#ff6b6b' },
            message: 'Great stream! Learning so much about Web3 development 🚀',
            timestamp: new Date(Date.now() - 30000),
            type: 'message'
        },
        {
            id: '2',
            user: { name: 'CryptoBuilder', avatar: 'https://picsum.photos/seed/user2/32/32', badges: ['moderator'], color: '#4ecdc4' },
            message: 'Thanks for the detailed explanation of smart contracts!',
            timestamp: new Date(Date.now() - 25000),
            type: 'message'
        },
        {
            id: '3',
            user: { name: 'Web3Learner', avatar: 'https://picsum.photos/seed/user3/32/32', badges: ['new'], color: '#45b7d1' },
            message: 'Just subscribed! Love the content 💜',
            timestamp: new Date(Date.now() - 20000),
            type: 'subscription'
        },
        {
            id: '4',
            user: { name: 'DevMaster', avatar: 'https://picsum.photos/seed/user4/32/32', badges: ['verified'], color: '#f9ca24' },
            message: 'Amazing tutorial on DeFi protocols!',
            timestamp: new Date(Date.now() - 15000),
            type: 'super_chat',
            amount: 5
        },
        {
            id: '5',
            user: { name: 'BlockchainFan', avatar: 'https://picsum.photos/seed/user5/32/32', badges: ['subscriber'], color: '#6c5ce7' },
            message: 'Can you explain more about gas optimization?',
            timestamp: new Date(Date.now() - 10000),
            type: 'message'
        }
    ]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    const handleSendMessage = () => {
        if (chatInput.trim()) {
            const newMessage: ChatMessage = {
                id: Date.now().toString(),
                user: { name: 'You', avatar: 'https://picsum.photos/seed/you/32/32', badges: ['creator'], color: '#e17055' },
                message: chatInput,
                timestamp: new Date(),
                type: 'message'
            };
            setChatMessages(prev => [...prev, newMessage]);
            setChatInput('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getBadgeColor = (badge: string) => {
        switch (badge) {
            case 'moderator': return 'bg-green-500';
            case 'subscriber': return 'bg-purple-500';
            case 'verified': return 'bg-blue-500';
            case 'creator': return 'bg-red-500';
            case 'new': return 'bg-yellow-500';
            default: return 'bg-gray-500';
        }
    };

    const renderDashboard = () => (
        <div className="space-y-6">
            {/* Stream Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                        <img 
                            src={currentStream.thumbnail}
                            alt="Stream preview"
                            className="w-full h-full object-cover"
                        />
                        {isLive && (
                            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                LIVE
                            </div>
                        )}
                        <div className="absolute bottom-4 right-4 bg-black/80 text-white px-3 py-1 rounded-full text-sm">
                            {isLive ? currentStream.duration : 'Not streaming'}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Button
                                onClick={() => setIsLive(!isLive)}
                                className={`w-20 h-20 rounded-full ${isLive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                            >
                                <Icon name={isLive ? 'square' : 'play'} size={32} className="text-white" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stream Controls */}
                <div className="space-y-4">
                    <div className="bg-secondary rounded-xl p-4">
                        <h3 className="font-semibold mb-3">Stream Status</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    isLive ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-500'
                                }`}>
                                    {isLive ? 'Live' : 'Offline'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Viewers</span>
                                <span className="font-semibold">{metrics.viewers.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Duration</span>
                                <span className="font-semibold">{isLive ? currentStream.duration : '0:00:00'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-secondary rounded-xl p-4">
                        <h3 className="font-semibold mb-3">Quick Actions</h3>
                        <div className="space-y-2">
                            <Button variant="outline" className="w-full justify-start">
                                <Icon name="settings" className="mr-2" size={16} />
                                Stream Settings
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                <Icon name="users" className="mr-2" size={16} />
                                Moderate Chat
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                <Icon name="video" className="mr-2" size={16} />
                                Recording: {streamSettings.recording ? 'On' : 'Off'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stream Settings */}
            <div className="bg-secondary rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Stream Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Stream Title</label>
                        <input
                            type="text"
                            value={streamSettings.title}
                            onChange={(e) => setStreamSettings(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full p-3 bg-background border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Category</label>
                        <select
                            value={streamSettings.category}
                            onChange={(e) => setStreamSettings(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full p-3 bg-background border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                        >
                            <option value="Technology">Technology</option>
                            <option value="Gaming">Gaming</option>
                            <option value="Education">Education</option>
                            <option value="Music">Music</option>
                            <option value="Art">Art</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <textarea
                            value={streamSettings.description}
                            onChange={(e) => setStreamSettings(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full p-3 bg-background border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    const renderChat = () => (
        <div className="h-[600px] bg-secondary rounded-xl flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Live Chat</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{metrics.chatMessages} messages</span>
                        <Button variant="ghost" size="sm">
                            <Icon name="settings" size={16} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((message) => (
                    <div key={message.id} className="flex items-start gap-3">
                        <img 
                            src={message.user.avatar}
                            alt={message.user.name}
                            className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span 
                                    className="font-medium text-sm"
                                    style={{ color: message.user.color }}
                                >
                                    {message.user.name}
                                </span>
                                {message.user.badges.map((badge, index) => (
                                    <span 
                                        key={index}
                                        className={`px-1.5 py-0.5 rounded text-xs text-white font-medium ${getBadgeColor(badge)}`}
                                    >
                                        {badge}
                                    </span>
                                ))}
                                <span className="text-xs text-muted-foreground">
                                    {formatTime(message.timestamp)}
                                </span>
                            </div>
                            
                            {message.type === 'super_chat' && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 mb-2">
                                    <div className="flex items-center gap-2 text-yellow-600 text-sm font-medium">
                                        <Icon name="star" size={14} />
                                        Super Chat ${message.amount}
                                    </div>
                                </div>
                            )}
                            
                            {message.type === 'subscription' && (
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 mb-2">
                                    <div className="flex items-center gap-2 text-purple-600 text-sm font-medium">
                                        <Icon name="heart" size={14} />
                                        New Subscriber!
                                    </div>
                                </div>
                            )}
                            
                            <p className="text-sm">{message.message}</p>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Say something..."
                            className="w-full p-3 bg-background border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                    <Button onClick={handleSendMessage} disabled={!chatInput.trim()}>
                        <Icon name="send" size={16} />
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderAnalytics = () => (
        <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Current Viewers', value: metrics.viewers.toLocaleString(), icon: 'eye', color: 'text-blue-500' },
                    { label: 'Peak Viewers', value: metrics.peakViewers.toLocaleString(), icon: 'trending-up', color: 'text-green-500' },
                    { label: 'Chat Messages', value: metrics.chatMessages.toLocaleString(), icon: 'message-circle', color: 'text-purple-500' },
                    { label: 'New Subscribers', value: metrics.newSubscribers.toString(), icon: 'users', color: 'text-red-500' },
                ].map((metric, index) => (
                    <div key={index} className="bg-secondary rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <Icon name={metric.icon as any} size={20} className={metric.color} />
                            <span className="text-sm text-muted-foreground">{metric.label}</span>
                        </div>
                        <div className="text-2xl font-bold">{metric.value}</div>
                    </div>
                ))}
            </div>

            {/* Engagement Metrics */}
            <div className="bg-secondary rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Engagement</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-red-500 mb-2">{metrics.likes}</div>
                        <div className="text-sm text-muted-foreground">Likes</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-500 mb-2">{metrics.shares}</div>
                        <div className="text-sm text-muted-foreground">Shares</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-500 mb-2">{metrics.superChats}</div>
                        <div className="text-sm text-muted-foreground">Super Chats</div>
                    </div>
                </div>
            </div>

            {/* Revenue */}
            <div className="bg-secondary rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Revenue</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="text-2xl font-bold text-green-500 mb-2">${metrics.donations}</div>
                        <div className="text-sm text-muted-foreground">Total Donations</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-purple-500 mb-2">{metrics.newSubscribers}</div>
                        <div className="text-sm text-muted-foreground">New Subscribers</div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Icon name="broadcast" size={24} className="text-red-500" />
                                Live Studio
                            </h1>
                            <p className="text-muted-foreground">Manage your live streams and engage with your audience</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline">
                                <Icon name="settings" className="mr-2" size={16} />
                                Settings
                            </Button>
                            <Button variant={isLive ? "destructive" : "default"}>
                                <Icon name={isLive ? "square" : "broadcast"} className="mr-2" size={16} />
                                {isLive ? 'End Stream' : 'Go Live'}
                            </Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                        {(['dashboard', 'chat', 'analytics'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                                    activeTab === tab
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                <div className="max-w-7xl mx-auto">
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'chat' && renderChat()}
                    {activeTab === 'analytics' && renderAnalytics()}
                </div>
            </div>
        </div>
    );
};

export default LivePage;
