import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import Icon from './Icon';
import { WalletButton } from './wallet/WalletButton';
import AgencySwitcher from './AgencySwitcher';
import { useWallet } from '../contexts/WalletContext';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  const { isConnected, isAuthenticated, account } = useWallet();
  const [ageVerified, setAgeVerified] = React.useState(false);
  const [talentVerified, setTalentVerified] = React.useState(false);
  const [isLoadingAge, setIsLoadingAge] = React.useState(false);
  const [isLoadingTalent, setIsLoadingTalent] = React.useState(false);

  // Load verification statuses when account changes
  React.useEffect(() => {
    if (isConnected && account) {
      loadVerificationStatuses();
    } else {
      setAgeVerified(false);
      setTalentVerified(false);
    }
  }, [isConnected, account]);

  const loadVerificationStatuses = async () => {
    if (!account) return;

    try {
      // Load age verification status
      setIsLoadingAge(true);
      const { AgeVerificationService } = await import('../services/ageVerificationService');
      const ageVerificationService = AgeVerificationService.getInstance();
      const ageStatus = await ageVerificationService.getVerificationStatus(account);
      setAgeVerified(ageStatus.status === 'verified');

      // Load talent verification status
      setIsLoadingTalent(true);
      // TODO: Replace with actual talent verification service call
      // For now, mock the talent verification status
      const mockTalentVerified = false; // This will be replaced with actual service call
      setTalentVerified(mockTalentVerified);

    } catch (error) {
      console.error('Failed to load verification statuses:', error);
      setAgeVerified(false);
      setTalentVerified(false);
    } finally {
      setIsLoadingAge(false);
      setIsLoadingTalent(false);
    }
  };

  return (
    <header className="flex-shrink-0 h-16 bg-background/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center space-x-4">
        {/* Upload Button */}
        <Button variant="default" onClick={() => navigate('/upload')} className="flex items-center space-x-2">
          <Icon name="plus-circle" size={16} />
          <span>+ Upload</span>
        </Button>
        
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
            
            {/* Talent Verification Badge */}
            {isLoadingTalent ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                <Icon name="loader" size={12} className="animate-spin" />
                <span>Checking...</span>
              </div>
            ) : talentVerified ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                <Icon name="star" size={12} />
                <span>Verified Creator</span>
              </div>
            ) : ageVerified ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                <Icon name="star" size={12} />
                <span>Unverified</span>
              </div>
            ) : null}
          </div>
        )}
        
        {/* Agency Switcher */}
        <AgencySwitcher />
        
        <WalletButton />
      </div>
    </header>
  );
};

export default Header;