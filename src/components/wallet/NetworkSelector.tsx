import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { NetworkService } from '../../services/wallet/NetworkService';
import { WalletUtils } from '../../utils/walletUtils';
import { NETWORK_CONFIGS } from '../../constants/wallet';
import Button from '../Button';
import Icon from '../Icon';

interface NetworkSelectorProps {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  variant = 'outline',
  size = 'default',
  className,
  showLabel = true
}) => {
  const { chainId, switchNetwork, isConnected, error } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const networkService = NetworkService.getInstance();

  const currentNetwork = chainId ? networkService.getNetworkConfig(chainId) : null;
  const supportedNetworks = networkService.getSupportedNetworks();

  const handleNetworkSwitch = async (targetChainId: number) => {
    if (targetChainId === chainId) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      await switchNetwork(targetChainId);
      setIsOpen(false);
    } catch (error) {
      console.error('Network switch failed:', error);
      // Error is handled by the context
    } finally {
      setIsSwitching(false);
    }
  };

  const handleToggle = () => {
    if (!isConnected) return;
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Don't render if not connected
  if (!isConnected) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant={variant}
        size={size}
        onClick={handleToggle}
        disabled={isSwitching}
        className={`${className || ''} min-w-0`}
      >
        {/* Current network indicator */}
        {currentNetwork ? (
          <>
            <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${currentNetwork.color} flex items-center justify-center mr-2 text-xs`}>
              {currentNetwork.iconUrl}
            </div>
            {showLabel && (
              <span className="truncate">
                {currentNetwork.name}
              </span>
            )}
          </>
        ) : (
          <>
            <div className="w-4 h-4 rounded-full bg-gray-400 mr-2" />
            {showLabel && <span>Unknown Network</span>}
          </>
        )}
        
        {isSwitching ? (
          <Icon name="loader" size={14} className="ml-2 animate-spin" />
        ) : (
          <Icon name="chevron-right" size={14} className={`ml-2 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        )}
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={handleClose}
          />
          
          {/* Dropdown content */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-background border border-border rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
            {/* Header */}
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-medium">Select Network</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a blockchain network to interact with
              </p>
            </div>

            {/* Network list */}
            <div className="p-2">
              {supportedNetworks.map((network) => {
                const isActive = network.chainId === chainId;
                const networkStatus = networkService.getNetworkStatus(network.chainId);

                return (
                  <button
                    key={network.chainId}
                    onClick={() => handleNetworkSwitch(network.chainId)}
                    disabled={isSwitching}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'hover:bg-secondary'
                    } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {/* Network icon */}
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${network.color} flex items-center justify-center text-sm flex-shrink-0`}>
                      {network.iconUrl}
                    </div>

                    {/* Network info */}
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{network.name}</span>
                        {isActive && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {network.symbol}
                        </span>
                        {networkStatus.isMainnet && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-500 rounded">
                            Mainnet
                          </span>
                        )}
                        {networkStatus.requiresAddition && !isActive && (
                          <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 rounded">
                            Add Network
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className="flex-shrink-0">
                      {isActive ? (
                        <Icon name="check-circle" size={16} className="text-green-500" />
                      ) : (
                        <Icon name="chevron-right" size={16} className="text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer info */}
            <div className="p-3 border-t border-border">
              <div className="flex items-start gap-2">
                <Icon name="info" size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-blue-500 mb-1">Network Switching</p>
                  <p>
                    Some networks may need to be added to your wallet before switching.
                    We'll guide you through the process.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};