import React, { useState } from 'react';
import { WalletType } from '../../types/wallet';
import { WALLET_INFO, SUPPORTED_WALLETS } from '../../constants/wallet';
import { WalletUtils } from '../../utils/walletUtils';
import { useWallet } from '../../contexts/WalletContext';
import Button from '../Button';
import Icon from '../Icon';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ isOpen, onClose }) => {
  const { connect, isConnecting, error, clearError } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  if (!isOpen) return null;

  const handleWalletSelect = async (walletType: WalletType) => {
    try {
      setSelectedWallet(walletType);
      clearError();
      await connect(walletType);
      onClose();
    } catch (error) {
      console.error('Connection failed:', error);
      // Error is handled by the context
    } finally {
      setSelectedWallet(null);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      clearError();
      setSelectedWallet(null);
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md mx-4 bg-background rounded-xl border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Connect Wallet</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={isConnecting}
            className="h-8 w-8"
          >
            <Icon name="x" size={16} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Description */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Icon name="wallet" size={24} className="text-white" />
            </div>
            <p className="text-muted-foreground">
              Connect your wallet to access Web3 features and manage your digital assets
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Icon name="alert-circle" size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-red-500 mb-1">Connection Failed</p>
                  <p className="text-red-400">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Options */}
          <div className="space-y-3">
            {SUPPORTED_WALLETS.map((walletType) => {
              const walletInfo = WALLET_INFO[walletType];
              const isInstalled = WalletUtils.isWalletInstalled(walletType);
              const isCurrentlyConnecting = isConnecting && selectedWallet === walletType;
              const isDisabled = isConnecting && selectedWallet !== walletType;

              return (
                <Button
                  key={walletType}
                  onClick={() => handleWalletSelect(walletType)}
                  disabled={isDisabled}
                  className={`w-full h-16 text-left justify-start relative ${
                    walletType === WalletType.METAMASK
                      ? 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {/* Wallet Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 ${
                    walletType === WalletType.METAMASK
                      ? 'bg-white text-orange-500'
                      : `bg-gradient-to-br ${walletInfo.color}`
                  }`}>
                    {walletInfo.icon.length === 1 ? (
                      <span className="text-xl">{walletInfo.icon}</span>
                    ) : (
                      <span className={`text-xs font-bold ${
                        walletType === WalletType.METAMASK ? 'text-orange-500' : 'text-white'
                      }`}>
                        {walletInfo.icon}
                      </span>
                    )}
                  </div>

                  {/* Wallet Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{walletInfo.name}</span>
                      {!isInstalled && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 rounded">
                          Not Installed
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${
                      walletType === WalletType.METAMASK ? 'text-white/80' : 'text-muted-foreground'
                    }`}>
                      {walletInfo.description}
                    </div>
                  </div>

                  {/* Loading or Status */}
                  <div className="ml-3 flex-shrink-0">
                    {isCurrentlyConnecting ? (
                      <Icon name="loader" size={16} className="animate-spin" />
                    ) : !isInstalled ? (
                      <Icon name="external-link" size={16} />
                    ) : (
                      <Icon name="chevron-right" size={16} />
                    )}
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Icon name="shield-check" size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-500 mb-1">Secure Connection</p>
                <p className="text-muted-foreground">
                  Your wallet connection is encrypted and secure. We never store your private keys.
                </p>
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Don't have a wallet?{' '}
              <a
                href="https://ethereum.org/en/wallets/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Learn more about wallets
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};