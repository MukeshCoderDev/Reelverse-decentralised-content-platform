
import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import Icon from '../../components/Icon';
import Button from '../../components/Button';

const StudioDashboardPage: React.FC = () => {
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

    // YouTube Studio-style analytics data
    const analyticsData = {
        '7d': {
            views: { value: '12.4K', change: '+15.2%', trend: 'up' },
            watchTime: { value: '2.1K hrs', change: '+8.7%', trend: 'up' },
            subscribers: { value: '118', change: '+12.3%', trend: 'up' },
            earnings: { value: 'Ξ 0.42', change: '+23.1%', trend: 'up' },
            engagement: { value: '4.2%', change: '+0.8%', trend: 'up' },
            revenue: { value: '$127.50', change: '+18.9%', trend: 'up' }
        }
    };

    const currentData = analyticsData[timeRange];

    // TikTok Creator Center-style content performance
    const topContent = [
        { title: 'Web3 Explained Simply', views: '45.2K', engagement: '8.7%', thumbnail: 'https://picsum.photos/seed/web3/120/68' },
        { title: 'DeFi for Beginners', views: '32.1K', engagement: '6.4%', thumbnail: 'https://picsum.photos/seed/defi/120/68' },
        { title: 'NFT Creation Guide', views: '28.9K', engagement: '7.2%', thumbnail: 'https://picsum.photos/seed/nft/120/68' },
    ];

    // Patreon-style monetization breakdown
    const revenueBreakdown = [
        { source: 'Subscriptions', amount: '$89.20', percentage: 70, color: 'bg-blue-500' },
        { source: 'Tips', amount: '$23.40', percentage: 18, color: 'bg-green-500' },
        { source: 'NFT Sales', amount: '$14.90', percentage: 12, color: 'bg-purple-500' },
    ];

    return (
        <div className="space-y-6">
            {/* YouTube Studio-style header */}
            <div className="flex items-center justify-between">
                <PageHeader id="studio" title="Creator Dashboard" />
                <div className="flex items-center gap-2">
                    <select 
                        value={timeRange} 
                        onChange={(e) => setTimeRange(e.target.value as any)}
                        className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                    </select>
                    <Button variant="outline" size="sm">
                        <Icon name="chart" className="mr-2" size={16} />
                        Advanced Analytics
                    </Button>
                </div>
            </div>

            {/* YouTube Studio-style key metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(currentData).map(([key, data]) => (
                    <div key={key} className="bg-secondary rounded-xl p-6 border border-border hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm text-muted-foreground capitalize font-medium">
                                {key === 'watchTime' ? 'Watch Time' : key}
                            </div>
                            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                data.trend === 'up' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                                <Icon name={data.trend === 'up' ? 'trending-up' : 'trending-down'} size={12} />
                                {data.change}
                            </div>
                        </div>
                        <div className="text-3xl font-bold mb-1">{data.value}</div>
                        <div className="text-xs text-muted-foreground">vs previous {timeRange}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* TikTok Creator Center-style top content */}
                <div className="bg-secondary rounded-xl p-6 border border-border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Icon name="flame" size={20} className="text-red-500" />
                            Top Performing Content
                        </h3>
                        <Button variant="ghost" size="sm">
                            <Icon name="eye" size={16} />
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {topContent.map((content, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 bg-background rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="relative">
                                    <img 
                                        src={content.thumbnail} 
                                        alt={content.title}
                                        className="w-16 h-9 rounded object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Icon name="play" size={12} className="text-white" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{content.title}</p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                        <span>{content.views} views</span>
                                        <span>{content.engagement} engagement</span>
                                    </div>
                                </div>
                                <Icon name="chevron-right" size={16} className="text-muted-foreground" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Patreon-style revenue breakdown */}
                <div className="bg-secondary rounded-xl p-6 border border-border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Icon name="coins" size={20} className="text-yellow-500" />
                            Revenue Breakdown
                        </h3>
                        <Button variant="ghost" size="sm">
                            <Icon name="banknote" size={16} />
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {revenueBreakdown.map((item, index) => (
                            <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{item.source}</span>
                                    <span className="font-semibold">{item.amount}</span>
                                </div>
                                <div className="w-full bg-background rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full ${item.color} transition-all duration-500`}
                                        style={{ width: `${item.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        <div className="pt-2 border-t border-border">
                            <div className="flex items-center justify-between font-semibold">
                                <span>Total Revenue</span>
                                <span className="text-green-500">$127.50</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* YouTube Studio-style recent activity */}
            <div className="bg-secondary rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Icon name="activity" size={20} />
                    Recent Activity
                </h3>
                <div className="space-y-3">
                    {[
                        { action: 'New subscriber', detail: 'CryptoEnthusiast42 subscribed', time: '2 minutes ago', icon: 'users' },
                        { action: 'Comment received', detail: 'Great explanation of DeFi!', time: '15 minutes ago', icon: 'message-circle' },
                        { action: 'Tip received', detail: 'Received 0.01 ETH tip', time: '1 hour ago', icon: 'coins' },
                        { action: 'Video published', detail: 'Web3 Explained Simply went live', time: '3 hours ago', icon: 'video' },
                    ].map((activity, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <Icon name={activity.icon as any} size={14} className="text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">{activity.action}</p>
                                <p className="text-xs text-muted-foreground">{activity.detail}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{activity.time}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudioDashboardPage;
