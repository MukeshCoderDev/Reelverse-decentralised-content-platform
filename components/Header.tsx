import React from 'react';
import Button from './Button';
import Icon from './Icon';
import { WalletButton } from './wallet/WalletButton';
import { useWallet } from '../contexts/WalletContext';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { isConnected, isAuthenticated, account } = useWallet();
  const [ageVerified, setAgeVerified] = React.useState(false);
  const [isLoadingAge, setIsLoadingAge] = React.useState(false);

  // Load age verification status when account changes
  React.useEffect(() => {
    if (isConnected && account) {
      loadAgeVerificationStatus();
    } else {
      setAgeVerified(false);
    }
  }, [isConnected, account]);

  const loadAgeVerificationStatus = async () => {
    if (!account) return;

    try {
      setIsLoadingAge(true);
      // Import the service dynamically to avoid circular dependencies
      const { AgeVerificationService } = await import('../services/ageVerificationService');
      const ageVerificationService = AgeVerificationService.getInstance();
      const status = await ageVerificationService.getVerificationStatus(account);
      setAgeVerified(status.status === 'verified');
    } catch (error) {
      console.error('Failed to load age verification status:', error);
      setAgeVerified(false);
    } finally {
      setIsLoadingAge(false);
    }
  };

  return (
    <header className="flex-shrink-0 h-16 bg-background/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center space-x-4">
        {/* Verification Badges */}
        {isConnected && account && (
          <div className="flex items-center space-x-2">
            {isAuthenticated && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <Icon name="shield-check" size={12} />
                <span>Authenticated</span>
              </div>
            )}
            
            {/* Age Verification Badge */}
            {isLoadingAge ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                <Icon name="loader" size={12} className="animate-spin" />
                <span>Checking...</span>
              </div>
            ) : ageVerified ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                <Icon name="shield-check" size={12} />
                <span>Age Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                <Icon name="shield-alert" size={12} />
                <span>Verify Age</span>
              </div>
            )}
            
            {/* Placeholder for talent verification badge - will be implemented in task 26 */}
          </div>
        )}
        <WalletButton />
      </div>
    </header>
  );
};

export default Header;