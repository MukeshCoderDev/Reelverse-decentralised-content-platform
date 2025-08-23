import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FEATURES } from '../../config/featureFlags';
import Button from '../Button';
import Icon from '../Icon';
import { WalletButton } from '../wallet/WalletButton';
import { useWallet } from '../../contexts/WalletContext';

/**
 * Header Actions Component
 * Contains the right-side action buttons in the header
 * Features Upload button, optional earnings pill, and conditional wallet connect
 */
export function HeaderActions() {
  const navigate = useNavigate();
  const { isConnected } = useWallet();

  return (
    <div className="flex items-center gap-3">
      {/* Go Live Button - only show when connected and feature enabled */}
      {FEATURES.GO_LIVE_ENABLED && isConnected && (
        <Button 
          variant="outline" 
          onClick={() => navigate('/studio/go-live')} 
          className="hidden md:inline-flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-red-600 hover:from-violet-700 hover:to-red-700 text-white border-0"
        >
          <Icon name="video" size={16} />
          <span>Go Live</span>
        </Button>
      )}

      {/* Upload Button - primary CTA */}
      <Link 
        to="/upload" 
        className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-950"
      >
        <span className="text-base font-normal">+</span> 
        <span className="hidden sm:inline">Upload</span>
        <span className="sm:hidden">
          <Icon name="upload" size={16} />
        </span>
      </Link>

      {/* Earnings Pill - show when feature enabled */}
      {FEATURES.EARNINGS_PILL_ENABLED && <EarningsPill />}

      {/* Wallet Connect - conditionally shown based on feature flag */}
      {FEATURES.WALLET_CONNECT_ENABLED && <WalletButton />}
      
      {/* Notifications - always show */}
      <button
        onClick={() => navigate('/notifications')}
        className="relative p-2 rounded-full hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        aria-label="Notifications"
      >
        <Icon name="bell" size={20} />
        {/* Notification badge */}
        <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
      </button>

      {/* User menu - placeholder for future avatar/profile */}
      <button
        onClick={() => navigate('/u/me')}
        className="p-2 rounded-full hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        aria-label="Profile menu"
      >
        <Icon name="user" size={20} />
      </button>
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
        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-violet-600 text-white hover:bg-violet-500 transition-colors"
        aria-label="Upload content"
      >
        <Icon name="plus" size={16} />
      </Link>

      {/* Notifications */}
      <button
        onClick={() => navigate('/notifications')}
        className="relative p-2 rounded-full hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <Icon name="bell" size={18} />
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
      </button>
    </div>
  );
}