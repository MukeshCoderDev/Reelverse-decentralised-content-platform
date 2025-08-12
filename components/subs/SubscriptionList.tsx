
import React, { useState } from 'react';
import Button from '../Button';
import Icon from '../Icon';

interface Subscription {
    id: string;
    creator: {
        name: string;
        username: string;
        avatar: string;
        verified: boolean;
    };
    tier: {
        name: string;
        price: number;
        currency: string;
        color: string;
    };
    benefits: string[];
    renewsAt: string;
    status: 'active' | 'cancelled' | 'expired';
    joinedAt: string;
    totalSpent: number;
}

interface SubscriptionListProps {
    items: any[];
}

export function SubscriptionList({ items }: SubscriptionListProps) {
    const [filter, setFilter] = useState<'all' | 'active' | 'cancelled'>('all');
    const [selectedSub, setSelectedSub] = useState<string | null>(null);

    // Enhanced mock subscription data
    const subscriptions: Subscription[] = [
        {
            id: '1',
            creator: {
                name: 'TechGuru',
                username: '@techguru',
                avatar: 'https://picsum.photos/seed/techguru/64/64',
                verified: true
            },
            tier: {
                name: 'Pro Supporter',
                price: 9.99,
                currency: 'USD',
                color: '#8b5cf6'
            },
            benefits: [
                'Exclusive live streams',
                'Early access to content',
                'Custom emotes',
                'Discord access',
                'Monthly Q&A sessions'
            ],
            renewsAt: 'in 15 days',
            status: 'active',
            joinedAt: '3 months ago',
            totalSpent: 29.97
        },
        {
            id: '2',
            creator: {
                name: 'PixelPlays',
                username: '@pixelplays',
                avatar: 'https://picsum.photos/seed/pixelplays/64/64',
                verified: false
            },
            tier: {
                name: 'Gaming Insider',
                price: 4.99,
                currency: 'USD',
                color: '#10b981'
            },
            benefits: [
                'Behind-the-scenes content',
                'Game recommendations',
                'Monthly gaming sessions',
                'Exclusive Discord channel'
            ],
            renewsAt: 'in 8 days',
            status: 'active',
            joinedAt: '2 months ago',
            totalSpent: 14.97
        },
        {
            id: '3',
            creator: {
                name: 'CryptoCadet',
                username: '@cryptocadet',
                avatar: 'https://picsum.photos/seed/cryptocadet/64/64',
                verified: true
            },
            tier: {
                name: 'Crypto Enthusiast',
                price: 14.99,
                currency: 'USD',
                color: '#f59e0b'
            },
            benefits: [
                'Daily market analysis',
                'Trading signals',
                'Portfolio reviews',
                'Private Telegram group',
                'Weekly AMA sessions'
            ],
            renewsAt: 'expired 2 days ago',
            status: 'expired',
            joinedAt: '6 months ago',
            totalSpent: 89.94
        }
    ];

    const filteredSubscriptions = subscriptions.filter(sub => {
        if (filter === 'all') return true;
        if (filter === 'active') return sub.status === 'active';
        if (filter === 'cancelled') return sub.status === 'cancelled' || sub.status === 'expired';
        return true;
    });

    const totalMonthlySpend = subscriptions
        .filter(sub => sub.status === 'active')
        .reduce((total, sub) => total + sub.tier.price, 0);

    const handleManageSubscription = (subId: string) => {
        setSelectedSub(selectedSub === subId ? null : subId);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-secondary rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Icon name="badge-dollar" size={20} className="text-green-500" />
                        <span className="text-sm text-muted-foreground">Monthly Spend</span>
                    </div>
                    <div className="text-2xl font-bold">${totalMonthlySpend.toFixed(2)}</div>
                </div>
                
                <div className="bg-secondary rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Icon name="users" size={20} className="text-blue-500" />
                        <span className="text-sm text-muted-foreground">Active Subscriptions</span>
                    </div>
                    <div className="text-2xl font-bold">
                        {subscriptions.filter(sub => sub.status === 'active').length}
                    </div>
                </div>
                
                <div className="bg-secondary rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Icon name="heart" size={20} className="text-red-500" />
                        <span className="text-sm text-muted-foreground">Total Supported</span>
                    </div>
                    <div className="text-2xl font-bold">${subscriptions.reduce((total, sub) => total + sub.totalSpent, 0).toFixed(2)}</div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                    {(['all', 'active', 'cancelled'] as const).map((filterOption) => (
                        <button
                            key={filterOption}
                            onClick={() => setFilter(filterOption)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                                filter === filterOption
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {filterOption}
                        </button>
                    ))}
                </div>
                
                <Button variant="outline">
                    <Icon name="search" className="mr-2" size={16} />
                    Find Creators
                </Button>
            </div>

            {/* Subscription List */}
            <div className="space-y-4">
                {filteredSubscriptions.map((subscription) => (
                    <div key={subscription.id} className="bg-secondary rounded-xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                {/* Creator Avatar */}
                                <div className="relative">
                                    <img 
                                        src={subscription.creator.avatar}
                                        alt={subscription.creator.name}
                                        className="w-16 h-16 rounded-full object-cover"
                                    />
                                    {subscription.creator.verified && (
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                            <Icon name="shield-check" size={12} className="text-white" />
                                        </div>
                                    )}
                                </div>

                                {/* Subscription Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-lg">{subscription.creator.name}</h3>
                                        <span className="text-muted-foreground">{subscription.creator.username}</span>
                                        <span 
                                            className="px-3 py-1 rounded-full text-sm font-medium text-white"
                                            style={{ backgroundColor: subscription.tier.color }}
                                        >
                                            {subscription.tier.name}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
                                        <span>${subscription.tier.price}/{subscription.tier.currency === 'USD' ? 'month' : subscription.tier.currency}</span>
                                        <span>Joined {subscription.joinedAt}</span>
                                        <span>Total spent: ${subscription.totalSpent}</span>
                                    </div>

                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            subscription.status === 'active' ? 'bg-green-500/10 text-green-500' :
                                            subscription.status === 'expired' ? 'bg-red-500/10 text-red-500' :
                                            'bg-gray-500/10 text-gray-500'
                                        }`}>
                                            {subscription.status === 'active' ? `Renews ${subscription.renewsAt}` :
                                             subscription.status === 'expired' ? `Expired ${subscription.renewsAt.replace('expired ', '')}` :
                                             'Cancelled'}
                                        </span>
                                    </div>

                                    {/* Benefits Preview */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {subscription.benefits.slice(0, 3).map((benefit, index) => (
                                            <span key={index} className="px-2 py-1 bg-background rounded-full text-xs">
                                                {benefit}
                                            </span>
                                        ))}
                                        {subscription.benefits.length > 3 && (
                                            <span className="px-2 py-1 bg-background rounded-full text-xs text-muted-foreground">
                                                +{subscription.benefits.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleManageSubscription(subscription.id)}
                                    >
                                        <Icon name="settings" className="mr-2" size={16} />
                                        Manage
                                    </Button>
                                    
                                    {subscription.status === 'active' && (
                                        <Button variant="outline" size="sm">
                                            <Icon name="message-circle" className="mr-2" size={16} />
                                            Message
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Management Panel */}
                            {selectedSub === subscription.id && (
                                <div className="mt-6 pt-6 border-t border-border">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* All Benefits */}
                                        <div>
                                            <h4 className="font-semibold mb-3">Your Benefits</h4>
                                            <div className="space-y-2">
                                                {subscription.benefits.map((benefit, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <Icon name="shield-check" size={14} className="text-green-500" />
                                                        <span className="text-sm">{benefit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Management Actions */}
                                        <div>
                                            <h4 className="font-semibold mb-3">Manage Subscription</h4>
                                            <div className="space-y-3">
                                                {subscription.status === 'active' && (
                                                    <>
                                                        <Button variant="outline" className="w-full justify-start">
                                                            <Icon name="credit-card" className="mr-2" size={16} />
                                                            Update Payment Method
                                                        </Button>
                                                        <Button variant="outline" className="w-full justify-start">
                                                            <Icon name="calendar" className="mr-2" size={16} />
                                                            Change Renewal Date
                                                        </Button>
                                                        <Button variant="destructive" className="w-full justify-start">
                                                            <Icon name="slash-circle" className="mr-2" size={16} />
                                                            Cancel Subscription
                                                        </Button>
                                                    </>
                                                )}
                                                
                                                {subscription.status === 'expired' && (
                                                    <Button className="w-full justify-start">
                                                        <Icon name="refresh-cw" className="mr-2" size={16} />
                                                        Resubscribe
                                                    </Button>
                                                )}
                                                
                                                <Button variant="outline" className="w-full justify-start">
                                                    <Icon name="download" className="mr-2" size={16} />
                                                    Download Receipts
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredSubscriptions.length === 0 && (
                <div className="text-center py-12">
                    <Icon name="badge-dollar" size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">
                        {filter === 'all' ? 'No subscriptions yet' : `No ${filter} subscriptions`}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                        {filter === 'all' 
                            ? 'Support your favorite creators to unlock exclusive content and perks'
                            : `You don't have any ${filter} subscriptions`
                        }
                    </p>
                    <Button>
                        <Icon name="search" className="mr-2" size={16} />
                        Discover Creators
                    </Button>
                </div>
            )}
        </div>
    );
}
