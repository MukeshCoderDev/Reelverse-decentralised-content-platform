import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { FEATURES } from '../../config/featureFlags';
import Button from '../Button';
import { BalancePill } from '../earnings/BalancePill';
import { useAuth } from '../../src/auth/AuthProvider';
import { useTheme } from '../../hooks/useTheme';

/**
 * YouTube-style Header Actions Component
 * Contains the right-side action buttons in the header with light theme support
 */
export function HeaderActions() {
  const navigate = useNavigate();
  const { user, openSignInModal } = useAuth();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="flex items-center gap-3">
      {/* Go Live Button - only show when authenticated and feature enabled */}
      {FEATURES.GO_LIVE_ENABLED && user && (
        <Button 
          variant="outline" 
          onClick={() => navigate('/studio/go-live')} 
          className="hidden md:inline-flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-red-600 hover:from-violet-700 hover:to-red-700 text-white border-0 rounded-full px-4 py-2"
        >
          <Icon icon="material-symbols:video-camera-front-outline" size={16} />
          <span>Go Live</span>
        </Button>
      )}

      {/* Upload Button - primary CTA with YouTube-style design */}
      <Link 
        to="/upload" 
        className="inline-flex items-center space-x-2 bg-brand hover:bg-purple-700 text-white px-4 py-2 rounded-full font-medium transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-blue-600"
        aria-label="Upload content"
      >
        <Icon icon="material-symbols:add" size={16} />
        <span className="hidden sm:inline">Upload</span>
      </Link>

      {/* Balance Pill - show when earnings pill is enabled */}
      {FEATURES.EARNINGS_PILL_ENABLED && user && (
        <Link to="/finance">
          <BalancePill />
        </Link>
      )}

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-full hover:bg-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        <Icon 
          icon={theme === 'light' ? 'material-symbols:dark-mode-outline' : 'material-symbols:light-mode-outline'} 
          size={20} 
          className="text-text-2 hover:text-text transition-colors"
        />
      </button>

      {/* Notifications */}
      <button
        onClick={() => navigate('/notifications')}
        className="relative p-2 rounded-full hover:bg-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Notifications"
      >
        <Icon icon="material-symbols:notifications-outline" size={20} className="text-text-2 hover:text-text transition-colors" />
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-live rounded-full" />
      </button>

      {/* Authentication - Sign In or Profile */}
      {!user ? (
        <button
          onClick={() => openSignInModal()}
          className="inline-flex items-center space-x-2 border border-border hover:bg-hover text-text px-4 py-2 rounded-full font-medium transition-colors min-h-[44px]"
        >
          <Icon icon="material-symbols:account-circle-outline" size={16} />
          <span>Sign in</span>
        </button>
      ) : (
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center space-x-2 p-2 rounded-full hover:bg-hover transition-colors min-h-[44px]"
          aria-label="Profile menu"
        >
          <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center">
            <Icon icon="material-symbols:person-outline" size={18} className="text-white" />
          </div>
        </button>
      )}
    </div>
  );
}

/**
 * Earnings Pill Component
 * Shows current earnings with animated counters
 */
function EarningsPill() {
  const [earnings, setEarnings] = React.useState(127.89);

  // Simulate earnings updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      setEarnings(current => current + (Math.random() * 0.1));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      to="/earnings"
      className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-full bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-950"
    >
      <Icon name="dollar-sign" size={16} />
      <span>${earnings.toFixed(2)}</span>
    </Link>
  );
}

/**
 * Mobile-optimized header actions
 * Collapses some buttons into icons on smaller screens
 */
export function MobileHeaderActions() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {/* Upload - icon only on mobile */}
      <Link 
        to="/upload" 
        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand text-white hover:bg-purple-700 transition-colors"
        aria-label="Upload content"
      >
        <Icon icon="material-symbols:add" size={16} />
      </Link>

      {/* Notifications */}
      <button
        onClick={() => navigate('/notifications')}
        className="relative p-2 rounded-full hover:bg-hover transition-colors"
        aria-label="Notifications"
      >
        <Icon icon="material-symbols:notifications-outline" size={18} className="text-text-2" />
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-live rounded-full" />
      </button>
    </div>
  );
}