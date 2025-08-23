import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useLocation } from 'react-router-dom';
import { sidebar } from '../config/sidebar';
import { SidebarGroup, SidebarItem, IconName } from '../types';
import Button from './Button';

const Sidebar: React.FC = () => {
  // In a real app, this would come from user state
  const userRole = 'creator';
  const location = useLocation();
  
  // YouTube-style navigation items with Material Symbols
  const navigation = [
    { name: 'Home', href: '/', icon: 'material-symbols:home-outline' },
    { name: 'Trending', href: '/trending', icon: 'material-symbols:trending-up' },
    { name: 'Subscriptions', href: '/subscriptions', icon: 'material-symbols:subscriptions-outline' },
    { name: 'Library', href: '/library', icon: 'material-symbols:video-library-outline' },
    { name: 'History', href: '/history', icon: 'material-symbols:history' },
    { name: 'Watch Later', href: '/watch-later', icon: 'material-symbols:watch-later-outline' },
    { name: 'Liked Videos', href: '/liked', icon: 'material-symbols:thumb-up-outline' },
    { name: 'Settings', href: '/settings', icon: 'material-symbols:settings-outline' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-surface border-r border-border p-3 flex flex-col space-y-2 overflow-y-auto h-full">
      {/* Brand/Logo section */}
      <div className="px-2 pb-4 mb-2 border-b border-border">
        <h1 className="text-2xl font-bold text-text">Reelverse</h1>
      </div>
      
      {/* Main navigation */}
      <nav className="flex-1" role="navigation" aria-label="Main navigation">
        <ul className="space-y-1" role="list">
          {navigation.map(item => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name} role="listitem">
                <NavLink
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    isActive 
                      ? 'bg-hover font-medium text-text border-l-4 border-brand' 
                      : 'hover:bg-hover text-text'
                  }`}
                >
                  <Icon 
                    icon={item.icon} 
                    className="text-text-2 text-[20px]" 
                    aria-hidden="true" 
                  />
                  <span className="text-text">{item.name}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
        
        {/* Divider */}
        <div className="my-4 border-t border-border" />
        
        {/* Secondary navigation from config */}
        {sidebar.map((group, index) => {
          if (group.featureFlag) return null;
          if (group.role && group.role !== userRole) return null;

          if (group.intent === 'primary') {
            const item = group.items[0];
            return (
              <NavLink to={item.route} key={item.id} className="w-full block mb-2">
                {({ isActive }) => (
                  <Button 
                    variant={isActive ? 'default' : 'secondary'} 
                    className="w-full justify-start text-base min-h-[44px]"
                  >
                    <Icon icon={getIconName(item.icon)} className="mr-3 text-[20px]" /> 
                    {item.label}
                  </Button>
                )}
              </NavLink>
            );
          }

          return (
            <div key={group.group || index} className="mb-4">
              {group.group && (
                <h3 className="px-4 py-2 text-xs font-semibold text-text-2 uppercase tracking-wider">
                  {group.group}
                </h3>
              )}
              <ul className="space-y-1">
                {group.items.map(item => {
                  if (item.role && item.role !== userRole) return null;
                  const isActive = location.pathname === item.route;
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.route}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-blue-600 ${
                          isActive 
                            ? 'bg-hover font-medium text-text' 
                            : 'hover:bg-hover text-text-2'
                        }`}
                      >
                        <Icon 
                          icon={getIconName(item.icon)} 
                          className="text-[20px]" 
                          aria-hidden="true" 
                        />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

// Helper function to map old icon names to Material Symbols
function getIconName(iconName: IconName): string {
  const iconMap: Record<string, string> = {
    'home': 'material-symbols:home-outline',
    'trending-up': 'material-symbols:trending-up',
    'video': 'material-symbols:video-library-outline',
    'settings': 'material-symbols:settings-outline',
    'user': 'material-symbols:person-outline',
    'users': 'material-symbols:group-outline',
    'upload': 'material-symbols:upload-outline',
    'analytics': 'material-symbols:analytics-outline',
    'bell': 'material-symbols:notifications-outline',
    'dollar-sign': 'material-symbols:monetization-on-outline',
    'shield': 'material-symbols:security-outline',
    'help-circle': 'material-symbols:help-outline',
    'book': 'material-symbols:menu-book-outline',
    'activity': 'material-symbols:monitoring-outline',
  };
  
  return iconMap[iconName] || `material-symbols:${iconName}-outline`;
}

export default Sidebar;