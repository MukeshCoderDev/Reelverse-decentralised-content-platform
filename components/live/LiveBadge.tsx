/**
 * LiveBadge component for indicating live stream status
 * Features a pulsing dot animation and configurable text
 */

export interface LiveBadgeProps {
  /** Text to display in the badge */
  text?: string;
  /** Size variant of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant for different states */
  variant?: 'live' | 'upcoming' | 'ended';
  /** Additional CSS classes */
  className?: string;
}

export function LiveBadge({ 
  text = 'LIVE', 
  size = 'md', 
  variant = 'live',
  className = '' 
}: LiveBadgeProps) {
  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'px-1.5 py-0.5 text-[10px]',
      dot: 'h-1.5 w-1.5',
      gap: 'gap-0.5'
    },
    md: {
      container: 'px-2 py-1 text-[11px]',
      dot: 'h-2.5 w-2.5',
      gap: 'gap-1'
    },
    lg: {
      container: 'px-3 py-1.5 text-xs',
      dot: 'h-3 w-3',
      gap: 'gap-1.5'
    }
  };

  // Variant configurations
  const variantConfig = {
    live: {
      background: 'bg-red-600/90',
      text: 'text-white',
      dotColor: 'bg-white',
      pingColor: 'bg-white'
    },
    upcoming: {
      background: 'bg-orange-600/90',
      text: 'text-white',
      dotColor: 'bg-white',
      pingColor: 'bg-white'
    },
    ended: {
      background: 'bg-slate-600/90',
      text: 'text-slate-200',
      dotColor: 'bg-slate-300',
      pingColor: 'bg-slate-300'
    }
  };

  const currentSize = sizeConfig[size];
  const currentVariant = variantConfig[variant];

  return (
    <span
      className={`
        inline-flex items-center rounded-md font-bold uppercase
        ${currentSize.container}
        ${currentSize.gap}
        ${currentVariant.background}
        ${currentVariant.text}
        ${className}
      `}
      role="status"
      aria-label={`Stream status: ${text}`}
    >
      {/* Pulsing dot animation */}
      <span className={`relative flex ${currentSize.dot}`}>
        {/* Ping animation (only for live streams) */}
        {variant === 'live' && (
          <span
            className={`
              absolute inline-flex h-full w-full rounded-full opacity-60
              animate-ping
              ${currentVariant.pingColor}
            `}
            aria-hidden="true"
          />
        )}
        {/* Static dot */}
        <span
          className={`
            relative inline-flex rounded-full
            ${currentSize.dot}
            ${currentVariant.dotColor}
          `}
          aria-hidden="true"
        />
      </span>
      
      {/* Badge text */}
      <span>{text}</span>
    </span>
  );
}

/**
 * Specialized live badge variants for common use cases
 */
export const LiveBadgeVariants = {
  /**
   * Standard live badge for active streams
   */
  Live: () => <LiveBadge text="LIVE" variant="live" />,
  
  /**
   * Badge for streams starting soon
   */
  Upcoming: ({ startsIn }: { startsIn?: string }) => (
    <LiveBadge 
      text={startsIn ? `${startsIn}` : 'SOON'} 
      variant="upcoming" 
    />
  ),
  
  /**
   * Badge for ended streams
   */
  Ended: () => <LiveBadge text="ENDED" variant="ended" />,
  
  /**
   * Compact badge for mobile/small contexts
   */
  Compact: ({ variant = 'live' }: { variant?: LiveBadgeProps['variant'] }) => (
    <LiveBadge 
      text="●" 
      size="sm" 
      variant={variant}
      className="font-normal"
    />
  )
};