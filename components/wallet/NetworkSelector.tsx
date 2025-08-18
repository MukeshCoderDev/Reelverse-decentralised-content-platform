import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { NetworkService } from '../../services/wallet/NetworkService';
import { WalletUtils } from '../../utils/walletUtils';
import Button from '../Button';
import Icon from '../Icon';

interface NetworkSelectorProps {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showIcon?: boolean;
  showName?: boolean;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  className,
  variant = 'outline',
  size = 'default',
  showIcon = true,
  showName = true
}) => {
  const { chainId, networkName, switchNetwork, isConnected, error } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingToChainId, setSwitchingToChainId] = useState<number | null>(null);

  const networkService = NetworkService.getInstance();
  const supportedNetworks = networkService.getSupportedNetworks();

  const handleNetworkSwitch = async (targetChainId: number) => {
    if (!isConnected || targetChainId === chainId) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      setSwitchingToChainId(targetChainId);
      await switchNetwork(targetChainId);
      setIsOpen(false);
    } catch (error) {
      console.error('Network switch failed:', error);
      // Error is handled by the context
    } finally {
      setIsSwitching(false);
      setSwitchingToChainId(null);
    }
  };

  const handleToggle = () => {
    if (isConnected && !isSwitching) {
      setIsOpen(!isOpen);
    }
  };

  const currentNetwork = chainId ? networkService.getNetworkConfig(chainId) : null;

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
        className={`${className} ${error ? 'border-red-500' : ''}`}
      >
        {showIcon && currentNetwork && (
          <span className="mr-2 text-lg">
            {currentNetwork.iconUrl}
          </span>
        )}
        
        {showName && (
          <span className="mr-2">
            {networkName || 'Unknown Network'}
          </span>
        )}

        {isSwitching ? (
          <Icon name="loader" className="animate-spin" size={14} />
        ) : (
          <Icon name="chevron-right" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} size={14} />
        )}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-background border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="p-3 border-b border-border">
              <h3 className="font-medium text-sm">Select Network</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a blockchain network to interact with
              </p>
            </div>

            <div className="p-2">
              {supportedNetworks.map((network) => {
                const isCurrentNetwork = network.chainId === chainId;
                const isSwitchingToThis = switchingToChainId === network.chainId;
                const networkStatus = networkService.getNetworkStatus(network.chainId);

                return (
                  <button
                    key={network.chainId}
                    onClick={() => handleNetworkSwitch(network.chainId)}
                    disabled={isSwitching}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-sm rounded-md transition-colors ${
                      isCurrentNetwork
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'hover:bg-secondary'
                    } ${isSwitching && !isSwitchingToThis ? 'opacity-50' : ''}`}
                  >
                    {/* Network Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${network.color} flex-shrink-0`}>
                      <span className="text-white text-lg">
                        {network.iconUrl}
                      </span>
                    </div>

                    {/* Network Info */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{network.name}</span>
                        {networkStatus.isMainnet && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-500 rounded">
                            Mainnet
                          </span>
                        )}
                        {networkStatus.isTestnet && (
                          <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-500 rounded">
                            {network.chainId === 31337 ? 'Local' : 'Testnet'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {network.symbol} • Chain ID: {network.chainId}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0">
                      {isSwitchingToThis ? (
                        <Icon name="loader" size={16} className="animate-spin text-primary" />
                      ) : isCurrentNetwork ? (
                        <Icon name="check-circle" size={16} className="text-primary" />
                      ) : (
                        <Icon name="chevron-right" size={14} className="text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer Info */}
            <div className="p-3 border-t border-border bg-secondary/30">
              <div className="flex items-start gap-2">
                <Icon name="info" size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-blue-500 mb-1">Development Networks</p>
                  <p>
                    🏠 <strong>Localhost</strong>: For Hardhat/Ganache local testing<br/>
                    🧪 <strong>Sepolia</strong>: Ethereum testnet with free ETH<br/>
                    Other networks may require adding to your wallet first.
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