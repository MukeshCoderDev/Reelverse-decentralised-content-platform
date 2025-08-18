import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { WalletUtils } from '../../utils/walletUtils';
import Button from '../Button';
import Icon from '../Icon';
import { WalletConnectModal } from './WalletConnectModal';
import { NetworkSelector } from './NetworkSelector';

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
    disconnect,
    // SIWE Authentication
    isAuthenticated,
    isAuthenticating,
    session,
    authError,
    authenticate,
    logout,
    clearAuthError
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

  const handleAuthenticate = async () => {
    try {
      setShowDropdown(false);
      await authenticate();
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      setShowDropdown(false);
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
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
          onClick={handleClick}
          className={`${className} ${error || authError ? 'border-red-500' : ''} ${isAuthenticated ? 'border-green-500' : ''}`}
        >
          <Icon name="wallet" className="mr-2" size={16} />
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">
                {WalletUtils.formatAddress(account)}
              </span>
              {/* Authentication status indicator */}
              {isAuthenticated && (
                <div className="w-2 h-2 bg-green-500 rounded-full" title="Authenticated with SIWE" />
              )}
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
                  <div className={`w-10 h-10 bg-gradient-to-br ${isAuthenticated ? 'from-green-500 to-emerald-600' : 'from-blue-500 to-purple-600'} rounded-full flex items-center justify-center relative`}>
                    <Icon name="wallet" size={20} className="text-white" />
                    {isAuthenticated && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <Icon name="check" size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm flex items-center gap-2">
                      Connected Wallet
                      {isAuthenticated && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Authenticated
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {WalletUtils.formatAddress(account)}
                    </p>
                  </div>
                </div>
                
                {/* Authentication Error Display */}
                {authError && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start gap-2">
                      <Icon name="alert-circle" size={14} className="text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-red-700 font-medium">Authentication Error</p>
                        <p className="text-xs text-red-600">{authError}</p>
                      </div>
                      <button
                        onClick={clearAuthError}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2">
                {/* SIWE Authentication Actions */}
                {!isAuthenticated ? (
                  <button
                    onClick={handleAuthenticate}
                    disabled={isAuthenticating}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50 mb-2"
                  >
                    {isAuthenticating ? (
                      <Icon name="loader" size={16} className="animate-spin" />
                    ) : (
                      <Icon name="shield-check" size={16} />
                    )}
                    {isAuthenticating ? 'Authenticating...' : 'Sign In with Ethereum'}
                  </button>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors mb-2"
                  >
                    <Icon name="log-out" size={16} />
                    Sign Out
                  </button>
                )}

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