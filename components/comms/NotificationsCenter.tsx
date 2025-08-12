import React, { useState } from 'react';
import Icon from '../Icon';
import Button from '../Button';

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

interface NotificationsCenterProps {
    items: Notification[];
    onMarkAsRead?: (id: string) => void;
    onMarkAllAsRead?: () => void;
    onNotificationClick?: (notification: Notification) => void;
}

export function NotificationsCenter({ 
    items, 
    onMarkAsRead, 
    onMarkAllAsRead, 
    onNotificationClick 
}: NotificationsCenterProps) {
    const [filter, setFilter] = useState<'all' | 'unread' | 'mentions'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const categories = [
        { id: 'all', label: 'All', icon: 'bell' },
        { id: 'upload', label: 'Uploads', icon: 'video' },
        { id: 'comment', label: 'Comments', icon: 'message-circle' },
        { id: 'mention', label: 'Mentions', icon: 'user' },
        { id: 'like', label: 'Likes', icon: 'heart' },
        { id: 'subscribe', label: 'Subscriptions', icon: 'users' },
        { id: 'live', label: 'Live', icon: 'broadcast' },
    ];

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'upload': return 'video';
            case 'comment': return 'message-circle';
            case 'mention': return 'user';
            case 'like': return 'heart';
            case 'subscribe': return 'users';
            case 'live': return 'broadcast';
            case 'system': return 'info';
            default: return 'bell';
        }
    };

    const getNotificationColor = (type: Notification['type']) => {
        switch (type) {
            case 'upload': return 'text-blue-500';
            case 'comment': return 'text-green-500';
            case 'mention': return 'text-purple-500';
            case 'like': return 'text-red-500';
            case 'subscribe': return 'text-orange-500';
            case 'live': return 'text-red-600';
            case 'system': return 'text-gray-500';
            default: return 'text-muted-foreground';
        }
    };

    const filteredItems = items.filter(item => {
        if (selectedCategory !== 'all' && item.type !== selectedCategory) return false;
        if (filter === 'unread' && item.read) return false;
        if (filter === 'mentions' && item.type !== 'mention') return false;
        return true;
    });

    const unreadCount = items.filter(item => !item.read).length;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold">Notifications</h2>
                    {unreadCount > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onMarkAllAsRead}>
                        <Icon name="shield-check" className="mr-2" size={16} />
                        Mark all as read
                    </Button>
                    <Button variant="outline" size="sm">
                        <Icon name="settings" size={16} />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Categories Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-secondary rounded-xl p-4 sticky top-6">
                        <h3 className="font-semibold mb-3">Categories</h3>
                        <div className="space-y-1">
                            {categories.map((category) => {
                                const categoryCount = category.id === 'all' 
                                    ? items.length 
                                    : items.filter(item => item.type === category.id).length;
                                
                                return (
                                    <button
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.id)}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                                            selectedCategory === category.id
                                                ? 'bg-primary/10 text-primary'
                                                : 'hover:bg-background'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon name={category.icon as any} size={16} />
                                            <span className="text-sm font-medium">{category.label}</span>
                                        </div>
                                        {categoryCount > 0 && (
                                            <span className="text-xs bg-muted px-2 py-1 rounded-full">
                                                {categoryCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Filter Options */}
                        <div className="mt-6 pt-4 border-t border-border">
                            <h4 className="font-medium mb-3 text-sm">Filter</h4>
                            <div className="space-y-1">
                                {(['all', 'unread', 'mentions'] as const).map((filterOption) => (
                                    <button
                                        key={filterOption}
                                        onClick={() => setFilter(filterOption)}
                                        className={`w-full text-left p-2 rounded-lg text-sm transition-colors capitalize ${
                                            filter === filterOption
                                                ? 'bg-primary/10 text-primary'
                                                : 'hover:bg-background'
                                        }`}
                                    >
                                        {filterOption}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="lg:col-span-3">
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-12">
                            <Icon name="bell" size={48} className="mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-medium mb-2">No notifications</h3>
                            <p className="text-muted-foreground">
                                {filter === 'unread' 
                                    ? "You're all caught up!" 
                                    : "New notifications will appear here"}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredItems.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => onNotificationClick?.(notification)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer hover:bg-secondary/50 ${
                                        !notification.read 
                                            ? 'bg-primary/5 border-primary/20' 
                                            : 'bg-background border-border hover:border-border/80'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Notification Icon */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            !notification.read ? 'bg-primary/10' : 'bg-secondary'
                                        }`}>
                                            <Icon 
                                                name={getNotificationIcon(notification.type)} 
                                                size={16} 
                                                className={getNotificationColor(notification.type)}
                                            />
                                        </div>

                                        {/* Thumbnail (if available) */}
                                        {notification.thumbnail && (
                                            <img 
                                                src={notification.thumbnail}
                                                alt=""
                                                className="w-16 h-9 rounded object-cover"
                                            />
                                        )}

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-sm mb-1">
                                                        {notification.title}
                                                    </h4>
                                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                    {notification.creator && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            from {notification.creator}
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {notification.time}
                                                    </span>
                                                    {!notification.read && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onMarkAsRead?.(notification.id);
                                                            }}
                                                            className="w-2 h-2 bg-primary rounded-full"
                                                            title="Mark as read"
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Priority indicator */}
                                            {notification.priority === 'high' && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    <Icon name="flame" size={12} className="text-red-500" />
                                                    <span className="text-xs text-red-500 font-medium">High priority</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
