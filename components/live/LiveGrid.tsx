import { LiveCard, LiveCardProps, LiveCardCompact } from './LiveCard';

/**
 * Layout options for the live grid
 */
export type GridLayout = 'grid' | 'horizontal-scroll' | 'list' | 'featured';

/**
 * Live grid properties
 */
export interface LiveGridProps {
  /** Array of stream data to display */
  streams: LiveCardProps[];
  /** Section title */
  title?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Layout variant to use */
  layout?: GridLayout;
  /** Number of columns for grid layout (auto-responsive by default) */
  columns?: number;
  /** Whether to show category filtering */
  showCategories?: boolean;
  /** Maximum number of items to show */
  maxItems?: number;
  /** Whether to show "See All" link */
  showSeeAll?: boolean;
  /** See all link destination */
  seeAllHref?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * LiveGrid component for displaying streams in various responsive layouts
 */
export function LiveGrid({
  streams,
  title,
  subtitle,
  layout = 'grid',
  columns,
  showCategories = false,
  maxItems,
  showSeeAll = false,
  seeAllHref,
  isLoading = false,
  emptyMessage = 'No streams available',
  className = ''
}: LiveGridProps) {
  // Limit streams if maxItems is specified
  const displayStreams = maxItems ? streams.slice(0, maxItems) : streams;

  // Extract unique categories for filtering
  const categories = showCategories 
    ? Array.from(new Set(streams.map(stream => stream.category).filter(Boolean)))
    : [];

  // Grid layout classes based on layout type
  const getGridClasses = () => {
    switch (layout) {
      case 'horizontal-scroll':
        return 'flex gap-4 overflow-x-auto pb-2 scrollbar-hide';
      case 'list':
        return 'space-y-4';
      case 'featured':
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
      case 'grid':
      default:
        if (columns) {
          return `grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(columns, 4)} 2xl:grid-cols-${Math.min(columns + 1, 5)}`;
        }
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6';
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <section className={`space-y-4 ${className}`}>
        {title && (
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-32 bg-slate-800 rounded animate-pulse" />
              {subtitle && <div className="h-4 w-48 bg-slate-800 rounded animate-pulse mt-1" />}
            </div>
          </div>
        )}
        <div className={getGridClasses()}>
          {Array.from({ length: layout === 'horizontal-scroll' ? 5 : 8 }).map((_, i) => (
            <div key={i} className={layout === 'horizontal-scroll' ? 'w-64 flex-shrink-0' : ''}>
              <div className="aspect-video bg-slate-800 rounded-xl animate-pulse" />
              <div className="mt-2 space-y-2">
                <div className="h-4 bg-slate-800 rounded animate-pulse" />
                <div className="h-3 w-24 bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Empty state
  if (displayStreams.length === 0) {
    return (
      <section className={`space-y-4 ${className}`}>
        {title && (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
              {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
            </div>
          </div>
        )}
        <div className="text-center py-12">
          <div className="mx-auto h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-400">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`space-y-4 ${className}`} role="region" aria-label={title}>
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
          </div>
          
          {/* See All link */}
          {showSeeAll && seeAllHref && streams.length > (maxItems || 0) && (
            <a 
              href={seeAllHref}
              className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
            >
              See all
            </a>
          )}
        </div>
      )}

      {/* Category filters */}
      {showCategories && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button className="px-3 py-1 rounded-full bg-violet-600 text-white text-sm font-medium whitespace-nowrap">
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Grid content */}
      <div className={getGridClasses()} role="list">
        {displayStreams.map((stream) => (
          <div key={stream.id} role="listitem">
            {layout === 'horizontal-scroll' ? (
              <LiveCardCompact {...stream} />
            ) : (
              <LiveCard {...stream} />
            )}
          </div>
        ))}
      </div>

      {/* Show more indicator for horizontal scroll */}
      {layout === 'horizontal-scroll' && streams.length > displayStreams.length && (
        <div className="text-center">
          <p className="text-sm text-slate-400">
            Showing {displayStreams.length} of {streams.length} streams
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Specialized grid variants for common use cases
 */
export const LiveGridVariants = {
  /**
   * Following section with horizontal scroll
   */
  Following: ({ streams, ...props }: Omit<LiveGridProps, 'layout'>) => (
    <LiveGrid
      {...props}
      streams={streams}
      layout="horizontal-scroll"
      title="Following Live"
      subtitle="Creators you follow who are streaming now"
      maxItems={10}
      showSeeAll={true}
      seeAllHref="/live?filter=following"
    />
  ),

  /**
   * Trending section with standard grid
   */
  Trending: ({ streams, ...props }: Omit<LiveGridProps, 'layout'>) => (
    <LiveGrid
      {...props}
      streams={streams}
      layout="grid"
      title="Trending Live"
      subtitle="Most popular streams right now"
      showCategories={true}
      showSeeAll={true}
      seeAllHref="/live?sort=trending"
    />
  ),

  /**
   * Upcoming section with grid layout
   */
  Upcoming: ({ streams, ...props }: Omit<LiveGridProps, 'layout'>) => (
    <LiveGrid
      {...props}
      streams={streams}
      layout="grid"
      title="Starting Soon"
      subtitle="Scheduled streams you won't want to miss"
      maxItems={8}
      showSeeAll={true}
      seeAllHref="/live?filter=upcoming"
    />
  ),

  /**
   * Featured section with larger cards
   */
  Featured: ({ streams, ...props }: Omit<LiveGridProps, 'layout'>) => (
    <LiveGrid
      {...props}
      streams={streams}
      layout="featured"
      title="Featured Live"
      subtitle="Hand-picked streams from top creators"
      maxItems={6}
    />
  )
};