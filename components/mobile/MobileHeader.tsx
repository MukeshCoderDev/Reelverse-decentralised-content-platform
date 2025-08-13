import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import { WalletButton } from '../wallet/WalletButton';

interface MobileHeaderProps {
    onMenuClick: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onMenuClick }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const getPageTitle = (pathname: string) => {
        switch (pathname) {
            case '/':
                return 'Home';
            case '/following':
                return 'Following';
            case '/trending':
                return 'Trending';
            case '/explore':
                return 'Explore';
            case '/notifications':
                return 'Notifications';
            case '/inbox':
                return 'Inbox';
            case '/u/me':
                return 'Profile';
            case '/library/liked':
                return 'Liked Videos';
            case '/library/history':
                return 'History';
            case '/create':
                return 'Create';
            case '/live':
                return 'Go Live';
            case '/status':
                return 'System Status';
            default:
                if (pathname.startsWith('/studio')) return 'Creator Studio';
                if (pathname.startsWith('/library')) return 'Library';
                if (pathname.startsWith('/settings')) return 'Settings';
                return 'Reelverse';
        }
    };

    const showBackButton = () => {
        const noBackRoutes = ['/', '/following', '/explore', '/notifications', '/u/me'];
        return !noBackRoutes.includes(location.pathname);
    };

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    return (
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border">
            <div className="flex items-center justify-between px-4 py-3">
                {/* Left side */}
                <div className="flex items-center gap-3">
                    {showBackButton() ? (
                        <button
                            onClick={handleBack}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                            aria-label="Go back"
                        >
                            <Icon name="chevron-left" size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={onMenuClick}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                            aria-label="Open menu"
                        >
                            <Icon name="menu" size={20} />
                        </button>
                    )}
                    
                    {/* Page title */}
                    <h1 className="text-lg font-semibold truncate">
                        {getPageTitle(location.pathname)}
                    </h1>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2">
                    {/* Wallet Button */}
                    <WalletButton size="sm" />
                    
                    {/* Search button */}
                    <button
                        onClick={() => navigate('/explore')}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                        aria-label="Search"
                    >
                        <Icon name="search" size={20} />
                    </button>
                    
                    {/* Notifications with badge */}
                    <button
                        onClick={() => navigate('/notifications')}
                        className="relative p-2 hover:bg-muted rounded-full transition-colors"
                        aria-label="Notifications"
                    >
                        <Icon name="bell" size={20} />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    </button>
                </div>
            </div>
            
            {/* Progress bar for certain pages */}
            {(location.pathname === '/create' || location.pathname.startsWith('/studio')) && (
                <div className="h-1 bg-muted">
                    <div className="h-full bg-primary w-1/3 transition-all duration-300"></div>
                </div>
            )}
        </header>
    );
};