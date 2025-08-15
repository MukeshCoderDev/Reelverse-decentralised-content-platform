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
  const { 
    connect, 
    isConnecting, 
    error, 
    clearError,
    isConnected,
    account,
    isAuthenticated,
    isAuthenticating,
    authError,
    authenticate,
    clearAuthError
  } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [showSiweStep, setShowSiweStep] = useState(false);

  if (!isOpen) return null;

  const handleWalletSelect = async (walletType: WalletType) => {
    try {
      setSelectedWallet(walletType);
      clearError();
      
      // Debug wallet providers for MetaMask
      if (walletType === WalletType.METAMASK) {
        WalletUtils.debugWalletProviders();
      }
      
      await connect(walletType);
      // After successful connection, show SIWE authentication step
      setShowSiweStep(true);
    } catch (error) {
      console.error('Connection failed:', error);
      // Error is handled by the context
    } finally {
      setSelectedWallet(null);
    }
  };

  const handleSiweAuthenticate = async () => {
    try {
      await authenticate();
      onClose();
    } catch (error) {
      console.error('SIWE authentication failed:', error);
      // Error is handled by the context
    }
  };

  const handleSkipSiwe = () => {
    onClose();
  };

  const handleClose = () => {
    if (!isConnecting && !isAuthenticating) {
      clearError();
      clearAuthError();
      setSelectedWallet(null);
      setShowSiweStep(false);
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md mx-4 my-4 bg-background rounded-xl border border-border shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
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
        <div className="p-6 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
          {/* SIWE Authentication Step */}
          {showSiweStep && isConnected && account ? (
            <>
              {/* SIWE Description */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <Icon name="shield-check" size={24} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Authenticate with Ethereum</h3>
                <p className="text-muted-foreground">
                  Sign a message to prove you own this wallet address. This enables secure access to platform features.
                </p>
              </div>

              {/* Connected Wallet Info */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <Icon name="wallet" size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-800">Wallet Connected</p>
                    <p className="text-sm text-green-600 font-mono">{WalletUtils.formatAddress(account)}</p>
                  </div>
                </div>
              </div>

              {/* Auth Error Display */}
              {authError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Icon name="alert-circle" size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm flex-1">
                      <p className="font-medium text-red-500 mb-1">Authentication Failed</p>
                      <p className="text-red-400 mb-2">{authError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAuthError}
                        className="h-6 px-2 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10"
                      >
                        <Icon name="x" size={12} className="mr-1" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* SIWE Actions */}
              <div className="space-y-3">
                <Button
                  onClick={handleSiweAuthenticate}
                  disabled={isAuthenticating}
                  className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                >
                  {isAuthenticating ? (
                    <>
                      <Icon name="loader" className="mr-2 animate-spin" size={16} />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Icon name="shield-check" className="mr-2" size={16} />
                      Sign Message to Authenticate
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSkipSiwe}
                  variant="outline"
                  disabled={isAuthenticating}
                  className="w-full"
                >
                  Skip for Now
                </Button>
              </div>

              {/* SIWE Info */}
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon name="info" size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-500 mb-1">About Sign-In with Ethereum</p>
                    <p className="text-muted-foreground">
                      SIWE is a secure authentication method that proves wallet ownership without exposing private keys. 
                      It enables access to premium features and personalized content.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Original Wallet Selection Content */}
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
                    <div className="text-sm flex-1">
                      <p className="font-medium text-red-500 mb-1">Connection Failed</p>
                      <p className="text-red-400 mb-2">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          clearError();
                          // Retry the last selected wallet if available
                          if (selectedWallet) {
                            handleWalletSelect(selectedWallet);
                          }
                        }}
                        className="h-6 px-2 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10"
                      >
                        <Icon name="refresh-cw" size={12} className="mr-1" />
                        Retry
                      </Button>
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

              {/* Debug Section (only in development) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="bug" size={14} className="text-yellow-500" />
                    <span className="text-xs font-medium text-yellow-500">Debug Tools</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      WalletUtils.debugWalletProviders();
                      // Also check if MetaMask is actually available
                      const ethereum = (window as any).ethereum;
                      if (ethereum) {
                        console.log('Attempting direct MetaMask test...');
                        ethereum.request({ method: 'eth_requestAccounts' })
                          .then((accounts: string[]) => {
                            console.log('Direct MetaMask test successful:', accounts);
                          })
                          .catch((error: any) => {
                            console.error('Direct MetaMask test failed:', error);
                          });
                      }
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    <Icon name="terminal" size={12} className="mr-1" />
                    Debug Providers
                  </Button>
                </div>
              )}

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
            </>
          )}
        </div>
      </div>
    </div>
  );
};