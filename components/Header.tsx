import React from 'react';
import Button from './Button';
import Icon from './Icon';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className="flex-shrink-0 h-16 bg-background/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center space-x-4">
         <Button variant="secondary">
          <Icon name="wallet" className="mr-2" /> Connect Wallet
        </Button>
      </div>
    </header>
  );
};

export default Header;