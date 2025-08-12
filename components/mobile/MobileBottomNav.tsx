import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import { IconName } from '../../types';

interface NavItem {
    id: string;
    label: string;
    icon: IconName;
    activeIcon?: IconName;
    route: string;
    badge?: number;
    isSpecial?: boolean;
}

export const MobileBottomNav: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('');
    const [showCreateMenu, setShowCreateMenu] = useState(false);

    // TikTok-style navigation items
    const navItems: NavItem[] = [
        {
            id: 'home',
            label: 'Home',
            icon: 'home',
            route: '/'
        },
        {
            id: 'following',
            label: 'Following',
            icon: 'users',
            route: '/following'
        },
        {
            id: 'create',
            label: 'Create',
            icon: 'plus',
            route: '/create',
            isSpecial: true
        },
        {
            id: 'inbox',
            label: 'Inbox',
            icon: 'mail',
            route: '/inbox',
            badge: 3
        },
        {
            id: 'profile',
            label: 'Profile',
            icon: 'user',
            route: '/u/me'
        }
    ];

    // Update active tab based on current route
    useEffect(() => {
        const currentPath = location.pathname;
        const activeItem = navItems.find(item => {
            if (item.route === '/' && currentPath === '/') return true;
            if (item.route !== '/' && currentPath.startsWith(item.route)) return true;
            return false;
        });
        setActiveTab(activeItem?.id || '');
    }, [location.pathname]);

    const handleNavClick = (item: NavItem) => {
        if (item.id === 'create') {
            setShowCreateMenu(!showCreateMenu);
            return;
        }
        
        setActiveTab(item.id);
        navigate(item.route);
        
        // TikTok-style haptic feedback (if supported)
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    };

    const createMenuItems = [
        { icon: 'video' as IconName, label: 'Video', route: '/create?type=video' },
        { icon: 'image' as IconName, label: 'Photo', route: '/create?type=photo' },
        { icon: 'broadcast' as IconName, label: 'Live', route: '/live' },
        { icon: 'music' as IconName, label: 'Audio', route: '/create?type=audio' }
    ];

    return (
        <>
            {/* Create Menu Overlay */}
            {showCreateMenu && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setShowCreateMenu(false)}
                >
                    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
                        <div className="bg-background border border-border rounded-2xl p-4 shadow-2xl">
                            <div className="grid grid-cols-2 gap-4">
                                {createMenuItems.map((item) => (
                                    <button
                                        key={item.label}
                                        onClick={() => {
                                            navigate(item.route);
                                            setShowCreateMenu(false);
                                        }}
                                        className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-muted transition-colors"
                                    >
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Icon name={item.icon} size={24} className="text-primary" />
                                        </div>
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation Bar - TikTok Style */}
            <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden">
                {/* Background with blur effect */}
                <div className="bg-background/95 backdrop-blur-lg border-t border-border">
                    <div className="flex items-center justify-around px-2 py-2">
                        {navItems.map((item) => {
                            const isActive = activeTab === item.id;
                            
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavClick(item)}
                                    className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
                                        item.isSpecial
                                            ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                                            : isActive
                                            ? 'text-primary scale-105'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    style={{
                                        minWidth: '60px',
                                        minHeight: '60px'
                                    }}
                                >
                                    {/* Icon with animation */}
                                    <div className={`relative transition-transform duration-200 ${
                                        isActive && !item.isSpecial ? 'scale-110' : ''
                                    }`}>
                                        <Icon 
                                            name={item.icon} 
                                            size={item.isSpecial ? 28 : 24} 
                                            className={item.isSpecial ? 'text-primary-foreground' : ''}
                                        />
                                        
                                        {/* Badge for notifications */}
                                        {item.badge && item.badge > 0 && (
                                            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center animate-pulse">
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Label */}
                                    <span className={`text-xs mt-1 font-medium transition-all duration-200 ${
                                        item.isSpecial 
                                            ? 'text-primary-foreground' 
                                            : isActive 
                                            ? 'text-primary font-semibold' 
                                            : 'text-muted-foreground'
                                    }`}>
                                        {item.label}
                                    </span>
                                    
                                    {/* Active indicator - TikTok style */}
                                    {isActive && !item.isSpecial && (
                                        <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full animate-pulse"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                
                {/* Safe area padding for devices with home indicator */}
                <div className="h-safe-area-inset-bottom bg-background/95 backdrop-blur-lg"></div>
            </div>
        </>
    );
};