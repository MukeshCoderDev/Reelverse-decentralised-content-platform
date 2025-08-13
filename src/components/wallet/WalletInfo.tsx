import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { WalletUtils } from '../../utils/walletUtils';
import { NetworkSelector } from './NetworkSelector';
import Button from '../Button';
import Icon from '../Icon';

interface WalletInfoProps {
  variant?: 'default' | 'card' | 'compact';
  showNetworkSelector?: boolean;
  showDisconnect?: boolean;
  className?: string;
}

export const WalletInfo: React.FC<WalletInfoProps> = ({
  variant = 'default',
  showNetworkSelector = true,
  showDisconnect = true,
  className
}) => {
  const {
    isConnected,
    account,
    chainId,
    networkName,
    balance,
    balanceLoading,
    walletType,
    disconnect
  } = useWallet();

  const [copySuccess, setCopySuccess] = useState(false);

  if (!isConnected || !account) {
    return null;
  }

  const handleCopyAddress = async () => {
    const success = await WalletUtils.copyToClipboard(account);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
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

  const formatWalletType = () => {
    if (!walletType) return 'Unknown Wallet';
    return walletType.charAt(0).toUpperCase() + walletType.slice(1) + ' Wallet';
  };

  // Compact variant - minimal display
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getNetworkColor()} flex items-center justify-center text-xs`}>
          {getNetworkIcon()}
        </div>
        <span className="font-mono text-sm">
          {WalletUtils.formatAddress(account)}
        </span>
        <button
          onClick={handleCopyAddress}
          className="p-1 hover:bg-secondary rounded transition-colors"
          title="Copy address"
        >
          <Icon name={copySuccess ? "check" : "copy"} size={14} />
        </button>
      </div>
    );
  }

  // Card variant - full card display
  if (variant === 'card') {
    return (
      <div className={`bg-secondary rounded-xl p-6 ${className || ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Wallet Info</h3>
          {showDisconnect && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              <Icon name="unlink" size={16} className="mr-2" />
              Disconnect
            </Button>
          )}
        </div>

        {/* Network Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getNetworkColor()} flex items-center justify-center text-lg`}>
            {getNetworkIcon()}
          </div>
          <div className="flex-1">
            <p className="font-medium">{networkName || 'Unknown Network'}</p>
            <p className="text-sm text-muted-foreground">{formatWalletType()}</p>
          </div>
          {showNetworkSelector && (
            <NetworkSelector variant="outline" size="sm" showLabel={false} />
          )}
        </div>

        {/* Account Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
              <p className="font-mono text-sm">{WalletUtils.formatAddress(account)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className="ml-2"
            >
              <Icon name={copySuccess ? "check-circle" : "copy"} size={16} />
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Balance</p>
              {balanceLoading ? (
                <div className="flex items-center gap-2">
                  <Icon name="loader" size={14} className="animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <p className="font-medium">
                  {balance ? `${WalletUtils.formatBalance(balance)} ${WalletUtils.getNetworkSymbol(chainId || 1)}` : 'Unable to fetch'}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              title="Refresh balance"
            >
              <Icon name="refresh-cw" size={16} />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.hash = '#/wallet'}
            className="flex-1"
          >
            <Icon name="wallet" size={16} className="mr-2" />
            View Wallet
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.hash = '#/buy-crypto'}
            className="flex-1"
          >
            <Icon name="credit-card" size={16} className="mr-2" />
            Buy Crypto
          </Button>
        </div>
      </div>
    );
  }

  // Default variant - standard display
  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Network and Wallet Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getNetworkColor()} flex items-center justify-center text-sm`}>
            {getNetworkIcon()}
          </div>
          <div>
            <p className="font-medium">{networkName || 'Unknown Network'}</p>
            <p className="text-sm text-muted-foreground">{formatWalletType()}</p>
          </div>
        </div>
        {showNetworkSelector && (
          <NetworkSelector variant="outline" size="sm" />
        )}
      </div>

      {/* Account Address */}
      <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
          <p className="font-mono text-sm truncate">{account}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyAddress}
          className="ml-2 flex-shrink-0"
        >
          <Icon name={copySuccess ? "check-circle" : "copy"} size={16} />
          {copySuccess ? "Copied!" : "Copy"}
        </Button>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          {balanceLoading ? (
            <div className="flex items-center gap-2">
              <Icon name="loader" size={14} className="animate-spin" />
              <span className="text-sm">Loading balance...</span>
            </div>
          ) : (
            <p className="font-medium">
              {balance 
                ? `${WalletUtils.formatBalance(balance)} ${WalletUtils.getNetworkSymbol(chainId || 1)}`
                : 'Unable to fetch balance'
              }
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          title="Refresh balance"
          disabled={balanceLoading}
        >
          <Icon name="refresh-cw" size={16} className={balanceLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Actions */}
      {showDisconnect && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
          >
            <Icon name="unlink" size={16} className="mr-2" />
            Disconnect Wallet
          </Button>
        </div>
      )}
    </div>
  );
};