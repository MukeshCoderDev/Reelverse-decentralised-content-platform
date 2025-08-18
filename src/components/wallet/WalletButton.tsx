import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { WalletUtils } from '../../utils/walletUtils';
import { WalletConnectModal } from './WalletConnectModal';
import { NetworkSelector } from './NetworkSelector';
import Button from '../Button';
import Icon from '../Icon';

interface WalletButtonProps {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export const WalletButton: React.FC<WalletButtonProps> = ({ 
  variant = 'secondary', 
  size = 'default',
  className 
}) => {
  const { 
    isConnected, 
    isConnecting, 
    account, 
    chainId, 
    balance, 
    walletType,
    error,
    disconnect 
  } = useWallet();
  
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = () => {
    setShowModal(true);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDropdown(false);
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const handleCopyAddress = async () => {
    if (account) {
      const success = await WalletUtils.copyToClipboard(account);
      if (success) {
        // You could add a toast notification here
        console.log('Address copied to clipboard');
      }
      setShowDropdown(false);
    }
  };

  const getNetworkIcon = () => {
    if (!chainId) return '🔷';
    return WalletUtils.getNetworkIcon(chainId);
  };

  const getNetworkColor = () => {
    if (!chainId) return 'from-blue-400 to-blue-600';
    return WalletUtils.getNetworkColor(chainId);
  };

  // Loading state
  if (isConnecting) {
    return (
      <Button 
        variant={variant} 
        size={size}
        disabled
        className={`${className || ''}`}
      >
        <Icon name="loader" className="mr-2 animate-spin" size={16} />
        Connecting...
      </Button>
    );
  }

  // Connected state
  if (isConnected && account) {
    return (
      <div className="relative flex items-center gap-2">
        {/* Network Selector - Shows multi-chain options */}
        <NetworkSelector 
          variant="outline" 
          size={size} 
          showLabel={false}
        />
        
        <Button
          variant={variant}
          size={size}
          onClick={() => setShowDropdown(!showDropdown)}
          className={`${className || ''} min-w-0`}
        >
          {/* Wallet info */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm truncate">
              {WalletUtils.formatAddress(account)}
            </span>
            {balance && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {WalletUtils.formatBalance(balance)} {WalletUtils.getNetworkSymbol(chainId || 1)}
              </span>
            )}
          </div>
          
          <Icon name="chevron-right" size={14} className={`ml-2 transition-transform ${showDropdown ? 'rotate-90' : ''}`} />
        </Button>

        {/* Dropdown menu */}
        {showDropdown && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowDropdown(false)}
            />
            
            {/* Dropdown content */}
            <div className="absolute right-0 top-full mt-2 w-64 bg-background border border-border rounded-lg shadow-lg z-20">
              {/* Account info */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getNetworkColor()} flex items-center justify-center text-sm`}>
                    {getNetworkIcon()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {WalletUtils.getNetworkName(chainId || 1)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {walletType?.charAt(0).toUpperCase()}{walletType?.slice(1)} Wallet
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Address</span>
                    <button
                      onClick={handleCopyAddress}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <span className="font-mono">{WalletUtils.formatAddress(account)}</span>
                      <Icon name="copy" size={12} />
                    </button>
                  </div>
                  
                  {balance && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Balance</span>
                      <span className="text-xs font-medium">
                        {WalletUtils.formatBalance(balance)} {WalletUtils.getNetworkSymbol(chainId || 1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    // Navigate to wallet page
                    window.location.hash = '#/wallet';
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary rounded-md transition-colors"
                >
                  <Icon name="wallet" size={16} />
                  View Wallet
                </button>
                
                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <Icon name="unlink" size={16} />
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}

        {/* Modal */}
        <WalletConnectModal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)} 
        />
      </div>
    );
  }

  // Disconnected state
  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        onClick={handleConnect}
        className={`${className || ''}`}
      >
        <Icon name="wallet" className="mr-2" size={16} />
        Connect Wallet
      </Button>

      <WalletConnectModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
      />
    </>
  );
};