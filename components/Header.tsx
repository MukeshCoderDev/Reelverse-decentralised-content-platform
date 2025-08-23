import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { CenterNav, MobileCenterNav } from './header/CenterNav';
import { HeaderActions } from './header/HeaderActions';
import { useWallet } from '../contexts/WalletContext';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onMenuClick }) => {
  const navigate = useNavigate();
  const { isConnected, isAuthenticated, account } = useWallet();
  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile screen size
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <>
      <header className="flex-shrink-0 h-16 bg-background/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-6">
        {/* Left: Brand/Title with optional menu button */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          {isMobile && onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-2 hover:bg-muted rounded-full transition-colors md:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" size={20} />
            </button>
          )}
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        
        {/* Center: Navigation (Desktop) */}
        <CenterNav />
        
        {/* Right: Actions */}
        <HeaderActions />
      </header>
      
      {/* Mobile Navigation Pills */}
      <div className="md:hidden bg-background/80 backdrop-blur-sm border-b border-border px-4 py-2">
        <MobileCenterNav />
      </div>
    </>
  );
};

export default Header;