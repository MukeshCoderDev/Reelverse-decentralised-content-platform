import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { WalletUtils } from '../../utils/walletUtils';
import { WALLET_INFO } from '../../constants/wallet';
import Button from '../Button';
import Icon from '../Icon';

interface WalletInfoProps {
  className?: string;
  showBalance?: boolean;
  showNetwork?: boolean;
  showDisconnect?: boolean;
  compact?: boolean;
}

export const WalletInfo: React.FC<WalletInfoProps> = ({
  className,
  showBalance = true,
  showNetwork = true,
  showDisconnect = true,
  compact = false
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
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  if (!isConnected || !account) {
    return null;
  }

  const handleCopyAddress = async () => {
    if (account) {
      const success = await WalletUtils.copyToClipboard(account);
      if (success) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await disconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const walletInfo = walletType ? WALLET_INFO[walletType] : null;
  const networkIcon = chainId ? WalletUtils.getNetworkIcon(chainId) : '🔷';
  const networkSymbol = chainId ? WalletUtils.getNetworkSymbol(chainId) : 'ETH';

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 bg-secondary rounded-lg ${className}`}>
        {/* Wallet Icon */}
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Icon name="wallet" size={16} className="text-white" />
        </div>

        {/* Account Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">
              {WalletUtils.formatAddress(account)}
            </span>
            <button
              onClick={handleCopyAddress}
              className="p-1 hover:bg-background rounded transition-colors"
              title="Copy address"
            >
              <Icon 
                name={copySuccess ? "check" : "copy"} 
                size={12} 
                className={copySuccess ? "text-green-500" : "text-muted-foreground"} 
              />
            </button>
          </div>
          
          {showNetwork && networkName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{networkIcon}</span>
              <span>{networkName}</span>
            </div>
          )}
        </div>

        {/* Balance */}
        {showBalance && (
          <div className="text-right">
            {balanceLoading ? (
              <Icon name="loader" size={14} className="animate-spin text-muted-foreground" />
            ) : balance ? (
              <span className="text-sm font-medium">
                {WalletUtils.formatBalance(balance)} {networkSymbol}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-secondary rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Wallet Information</h3>
        {showDisconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
          >
            {isDisconnecting ? (
              <Icon name="loader" className="mr-2 animate-spin" size={14} />
            ) : (
              <Icon name="unlink" className="mr-2" size={14} />
            )}
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        )}
      </div>

      {/* Wallet Details */}
      <div className="space-y-4">
        {/* Wallet Type */}
        {walletInfo && (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${walletInfo.color}`}>
              {walletInfo.icon.length === 1 ? (
                <span className="text-xl">{walletInfo.icon}</span>
              ) : (
                <span className="text-xs font-bold text-white">{walletInfo.icon}</span>
              )}
            </div>
            <div>
              <p className="font-medium">{walletInfo.name}</p>
              <p className="text-xs text-muted-foreground">Connected Wallet</p>
            </div>
          </div>
        )}

        {/* Account Address */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Account Address</label>
          <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
            <span className="font-mono text-sm flex-1">
              {WalletUtils.formatAddress(account)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className="h-8 w-8 p-0"
            >
              <Icon 
                name={copySuccess ? "check-circle" : "copy"} 
                size={14} 
                className={copySuccess ? "text-green-500" : "text-muted-foreground"} 
              />
            </Button>
          </div>
          {copySuccess && (
            <p className="text-xs text-green-500 flex items-center gap-1">
              <Icon name="check" size={12} />
              Address copied to clipboard
            </p>
          )}
        </div>

        {/* Network Information */}
        {showNetwork && chainId && networkName && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Current Network</label>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${WalletUtils.getNetworkColor(chainId)}`}>
                <span className="text-white text-lg">{networkIcon}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">{networkName}</p>
                <p className="text-xs text-muted-foreground">Chain ID: {chainId}</p>
              </div>
            </div>
          </div>
        )}

        {/* Balance Information */}
        {showBalance && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Balance</label>
            <div className="p-3 bg-background rounded-lg">
              {balanceLoading ? (
                <div className="flex items-center gap-2">
                  <Icon name="loader" size={16} className="animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading balance...</span>
                </div>
              ) : balance ? (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-medium">
                    {WalletUtils.formatBalance(balance)}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    {networkSymbol}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Icon name="alert-circle" size={16} className="text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Unable to fetch balance</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="ml-auto h-6 px-2 text-xs"
                  >
                    <Icon name="refresh-cw" size={12} className="mr-1" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://etherscan.io/address/${account}`, '_blank')}
            className="flex-1"
          >
            <Icon name="external-link" className="mr-2" size={14} />
            View on Explorer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.hash = '#/wallet'}
            className="flex-1"
          >
            <Icon name="wallet" className="mr-2" size={14} />
            Manage Wallet
          </Button>
        </div>
      </div>
    </div>
  );
};