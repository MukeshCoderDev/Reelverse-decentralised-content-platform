import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { WalletUtils } from '../../utils/walletUtils';
import Button from '../Button';
import Icon from '../Icon';
import { WalletConnectModal } from './WalletConnectModal';

interface WalletButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showBalance?: boolean;
  showNetwork?: boolean;
}

export const WalletButton: React.FC<WalletButtonProps> = ({
  className,
  variant = 'secondary',
  size = 'default',
  showBalance = false,
  showNetwork = false
}) => {
  const { 
    isConnected, 
    isConnecting, 
    account, 
    balance, 
    chainId, 
    networkName,
    error,
    disconnect
  } = useWallet();
  
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleClick = () => {
    if (isConnected) {
      setShowDropdown(!showDropdown);
    } else {
      setShowModal(true);
    }
  };

  const handleCopyAddress = async () => {
    if (account) {
      const success = await WalletUtils.copyToClipboard(account);
      if (success) {
        // Could add a toast notification here
        console.log('Address copied to clipboard');
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      setShowDropdown(false);
      await disconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Loading state
  if (isConnecting) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={className}
      >
        <Icon name="loader" className="mr-2 animate-spin" size={16} />
        Connecting...
      </Button>
    );
  }

  // Disconnecting state
  if (isDisconnecting) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={className}
      >
        <Icon name="loader" className="mr-2 animate-spin" size={16} />
        Disconnecting...
      </Button>
    );
  }

  // Connected state
  if (isConnected && account) {
    return (
      <div className="relative">
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          className={`${className} ${error ? 'border-red-500' : ''}`}
        >
          <Icon name="wallet" className="mr-2" size={16} />
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              {showNetwork && networkName && (
                <span className="text-xs text-muted-foreground">
                  {WalletUtils.getNetworkIcon(chainId || 1)} {networkName}
                </span>
              )}
              <span className="font-mono text-sm">
                {WalletUtils.formatAddress(account)}
              </span>
            </div>
            {showBalance && balance && (
              <span className="text-xs text-muted-foreground">
                {WalletUtils.formatBalance(balance)} {WalletUtils.getNetworkSymbol(chainId || 1)}
              </span>
            )}
          </div>
          <Icon name="chevron-right" className="ml-2" size={14} />
        </Button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowDropdown(false)}
            />
            
            {/* Dropdown Content */}
            <div className="absolute right-0 top-full mt-2 w-64 bg-background border border-border rounded-lg shadow-lg z-50">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Icon name="wallet" size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Connected Wallet</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {WalletUtils.formatAddress(account)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  onClick={handleCopyAddress}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary rounded-md transition-colors"
                >
                  <Icon name="copy" size={16} />
                  Copy Address
                </button>
                
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

                <div className="border-t border-border my-2" />

                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? (
                    <Icon name="loader" size={16} className="animate-spin" />
                  ) : (
                    <Icon name="unlink" size={16} />
                  )}
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Disconnected state
  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={`${className} bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0`}
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