import { NavLink } from 'react-router-dom';
import { useLivePresenceCount } from '../../hooks/useLivePresenceCount';
import { FEATURES } from '../../config/featureFlags';

/**
 * Navigation item interface
 */
export interface NavItem {
  /** Route path */
  to: string;
  /** Display label */
  label: string;
  /** Whether this is the live section */
  live?: boolean;
  /** Whether to show a notification badge */
  badge?: boolean;
  /** Icon component for the nav item */
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Center navigation component properties
 */
export interface CenterNavProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show mobile variant */
  mobile?: boolean;
  /** Navigation alignment - left or center */
  align?: 'left' | 'center';
}

/**
 * Navigation items configuration
 */
const navigationItems: NavItem[] = [
  { 
    to: '/', 
    label: 'Videos'
  },
  { 
    to: '/live', 
    label: 'Live', 
    live: true 
  },
  { 
    to: '/shorts', 
    label: 'Shorts' 
  },
  { 
    to: '/explore', 
    label: 'Explore' 
  }
];

/**
 * CenterNav component for header navigation
 * Provides segmented navigation with special handling for Live section
 * Features sticky positioning and dynamic live count indicators
 */
export function CenterNav({ className = '', mobile = false, align = 'left' }: CenterNavProps) {
  const liveCount = useLivePresenceCount();
  
  if (mobile) {
    return (
      <nav className={`md:hidden ${className}`} aria-label="Main navigation">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center rounded-full border p-1" style={{ borderColor: 'var(--header-border)', background: 'var(--header-bg)' }}>
            <ul className="flex items-center gap-1" role="tablist">
              {navigationItems.map((item) => (
                <li key={item.to} role="presentation">
                  <NavLink
                    to={item.to}
                    role="tab"
                    className={({ isActive }) =>
                      `
                        relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium 
                        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-950
                        ${
                          isActive
                            ? item.live
                              ? 'bg-red-600/20 text-red-400 shadow-lg shadow-red-500/20'
                              : 'bg-hover text-text shadow-lg'
                            : 'text-text-2 hover:text-text hover:bg-hover'
                        }
                      `
                    }
                    aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
                  >
                    <span>{item.label}</span>
                    {item.live && liveCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                        </span>
                        LIVE
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav 
      className={`sticky z-40 hidden md:flex w-full ${align === 'left' ? 'justify-start' : 'justify-center'} ${className}`}
      aria-label="Primary navigation"
      style={{ top: 'var(--header-h)', background: 'transparent' }}
    >
      <div className="my-2 ml-4 md:ml-6 rounded-full border px-1 shadow-sm" style={{ borderColor: 'var(--header-border)', background: 'var(--header-bg)' }}>
        <ul className="flex items-center gap-1 px-1" role="tablist">
          {navigationItems.map((item) => (
            <li key={item.to} role="presentation">
              <NavLink
                to={item.to}
                role="tab"
                className={({ isActive }) =>
                  `
                    px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 
                    focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-950
                    ${
                      isActive
                        ? item.live
                          ? 'bg-red-600/20 text-red-400 shadow-lg shadow-red-500/20'
                          : 'bg-hover text-text shadow-lg'
                        : 'text-text-2 hover:text-text hover:bg-hover'
                    }
                  `
                }
                aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
              >
                {({ isActive }) => (
                  <span className="inline-flex items-center gap-2">
                    <span className="relative">
                      {item.label}
                      {/* Active indicator line for Live section */}
                      {isActive && item.live && (
                        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-red-500 rounded-full" />
                      )}
                    </span>
                    
                    {/* Live indicator - only show when there are active streams */}
                    {item.live && liveCount > 0 && (
                      <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-400">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        </span>
                        LIVE
                      </span>
                    )}

                    {/* Notification badge */}
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-violet-500 rounded-full border-2 border-surface" />
                    )}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/**
 * Mobile-specific center navigation component
 */
export function MobileCenterNav({ className = '' }: { className?: string }) {
  return <CenterNav mobile={true} className={className} />;
}

/**
 * Hook to get current navigation state
 */
export function useNavigationState() {
  const currentPath = window.location.pathname;
  
  const activeItem = navigationItems.find(item => {
    if (item.to === '/' && currentPath === '/') return true;
    if (item.to !== '/' && currentPath.startsWith(item.to)) return true;
    return false;
  });

  return {
    activeItem,
    isLiveSection: activeItem?.live || false,
    navigationItems
  };
}