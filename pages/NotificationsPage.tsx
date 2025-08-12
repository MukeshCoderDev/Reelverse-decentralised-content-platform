
import React, { useState, useEffect } from 'react';
import { NotificationsCenter } from '../components/comms/NotificationsCenter';
import { fetchNotifications } from '../lib/fetchers';
import { EmptyState } from '../components/shared/EmptyState';

interface Notification {
    id: string;
    type: 'upload' | 'comment' | 'mention' | 'like' | 'subscribe' | 'live' | 'system';
    title: string;
    message: string;
    time: string;
    read: boolean;
    thumbnail?: string;
    actionUrl?: string;
    priority: 'low' | 'medium' | 'high';
    creator?: string;
}

const NotificationsPage: React.FC = () => {
    const [items, setItems] = useState<Notification[] | null>(null);
    const [loading, setLoading] = useState(true);

    // Enhanced mock notifications data
    const mockNotifications: Notification[] = [
        {
            id: '1',
            type: 'upload',
            title: 'New video from TechGuru',
            message: 'Web3 Explained: The Complete Beginner\'s Guide',
            time: '2 minutes ago',
            read: false,
            thumbnail: 'https://picsum.photos/seed/notif1/120/68',
            creator: 'TechGuru',
            priority: 'medium'
        },
        {
            id: '2',
            type: 'comment',
            title: 'New comment on your video',
            message: 'PixelPlays replied: "Great explanation of DeFi protocols! This really helped me understand..."',
            time: '15 minutes ago',
            read: false,
            thumbnail: 'https://picsum.photos/seed/notif2/120/68',
            creator: 'PixelPlays',
            priority: 'low'
        },
        {
            id: '3',
            type: 'mention',
            title: 'You were mentioned',
            message: 'LensExplorer mentioned you in a comment: "@techguru your tutorial was amazing!"',
            time: '1 hour ago',
            read: false,
            creator: 'LensExplorer',
            priority: 'high'
        },
        {
            id: '4',
            type: 'like',
            title: 'Your video was liked',
            message: 'CryptoCadet and 47 others liked your video "NFT Creation Guide"',
            time: '2 hours ago',
            read: true,
            thumbnail: 'https://picsum.photos/seed/notif4/120/68',
            priority: 'low'
        },
        {
            id: '5',
            type: 'subscribe',
            title: 'New subscriber',
            message: 'Web3Enthusiast42 subscribed to your channel',
            time: '3 hours ago',
            read: true,
            creator: 'Web3Enthusiast42',
            priority: 'medium'
        },
        {
            id: '6',
            type: 'live',
            title: 'Live stream starting',
            message: 'DIYDebi is going live: "Building Your First Smart Contract"',
            time: '5 hours ago',
            read: true,
            thumbnail: 'https://picsum.photos/seed/notif6/120/68',
            creator: 'DIYDebi',
            priority: 'high'
        },
        {
            id: '7',
            type: 'system',
            title: 'Platform update',
            message: 'New features available: Enhanced video player and improved search',
            time: '1 day ago',
            read: true,
            priority: 'low'
        },
        {
            id: '8',
            type: 'upload',
            title: 'New video from CryptoCadet',
            message: 'DeFi Yield Farming Strategies for 2024',
            time: '1 day ago',
            read: true,
            thumbnail: 'https://picsum.photos/seed/notif8/120/68',
            creator: 'CryptoCadet',
            priority: 'medium'
        }
    ];

    useEffect(() => {
        // Simulate API call
        setTimeout(() => {
            setItems(mockNotifications);
            setLoading(false);
        }, 1000);
    }, []);

    const handleMarkAsRead = (id: string) => {
        setItems(prev => prev?.map(item => 
            item.id === id ? { ...item, read: true } : item
        ) || null);
    };

    const handleMarkAllAsRead = () => {
        setItems(prev => prev?.map(item => ({ ...item, read: true })) || null);
    };

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read when clicked
        handleMarkAsRead(notification.id);
        
        // Navigate to content if actionUrl exists
        if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
        }
        
        console.log('Notification clicked:', notification);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="h-8 w-48 animate-pulse rounded bg-muted mb-6" />
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-1">
                            <div className="h-64 animate-pulse rounded-xl bg-muted" />
                        </div>
                        <div className="lg:col-span-3 space-y-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            {items && items.length > 0 ? (
                <NotificationsCenter 
                    items={items}
                    onMarkAsRead={handleMarkAsRead}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onNotificationClick={handleNotificationClick}
                />
            ) : (
                <div className="max-w-4xl mx-auto">
                    <EmptyState 
                        icon="bell" 
                        title="No Notifications Yet"
                        subtitle="Updates about your content and creators you follow will appear here."
                    />
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
