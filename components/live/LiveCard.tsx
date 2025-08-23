import { Link } from 'react-router-dom';
import { LiveBadge } from './LiveBadge';
import { useNumberFormat } from '../../hooks/useNumberFormat';

/**
 * Creator information interface
 */
export interface CreatorInfo {
  /** Creator's unique identifier */
  id: string;
  /** Creator's display name */
  name: string;
  /** Creator's username/handle */
  username: string;
  /** Creator's avatar image URL */
  avatarUrl: string;
  /** Whether the creator is verified */
  verified?: boolean;
  /** Creator's follower count */
  followerCount?: number;
}

/**
 * Live stream card properties
 */
export interface LiveCardProps {
  /** Stream unique identifier */
  id: string;
  /** Stream title */
  title: string;
  /** Stream description */
  description?: string;
  /** Creator information */
  creator: CreatorInfo;
  /** Stream thumbnail/poster image URL */
  posterUrl: string;
  /** Current viewer count */
  viewers: number;
  /** Stream category */
  category?: string;
  /** Stream tags */
  tags?: string[];
  /** Whether the stream is currently live */
  isLive: boolean;
  /** Scheduled start time for upcoming streams */
  scheduledAt?: string;
  /** Whether the current user follows this creator */
  isFollowing?: boolean;
  /** Stream language */
  language?: string;
  /** Additional CSS classes */
  className?: string;
  /** Click handler override */
  onClick?: () => void;
}

/**
 * LiveCard component for displaying stream information in grids and lists
 * Features responsive design with gradient overlays and hover animations
 */
export function LiveCard({
  id,
  title,
  description,
  creator,
  posterUrl,
  viewers,
  category,
  tags,
  isLive,
  scheduledAt,
  isFollowing,
  language,
  className = '',
  onClick
}: LiveCardProps) {
  const { formatCount } = useNumberFormat();

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const cardContent = (
    <div 
      className={`
        group block cursor-pointer transition-transform duration-200 hover:scale-[1.02]
        ${className}
      `}
      onClick={handleClick}
    >
      {/* Thumbnail container with 16:9 aspect ratio */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
        {/* Thumbnail image */}
        <img 
          src={posterUrl} 
          alt={`${title} - Stream by ${creator.name}`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        
        {/* Top overlays */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          {/* Live badge */}
          <LiveBadge 
            variant={isLive ? 'live' : scheduledAt ? 'upcoming' : 'ended'}
            text={isLive ? 'LIVE' : scheduledAt ? 'SOON' : 'ENDED'}
          />
          
          {/* Viewer count chip */}
          <div className="rounded-full bg-black/60 backdrop-blur-sm px-2 py-1 text-white text-xs font-semibold">
            {isLive ? formatCount(viewers) : scheduledAt ? 'Scheduled' : 'Replay'}
            {isLive && <span className="ml-1 text-slate-300">watching</span>}
          </div>
        </div>

        {/* Category and language badges */}
        {(category || language) && (
          <div className="absolute top-2 right-2 mt-8 flex flex-col gap-1">
            {category && (
              <span className="rounded bg-violet-600/80 px-2 py-0.5 text-xs font-medium text-white">
                {category}
              </span>
            )}
            {language && language !== 'en' && (
              <span className="rounded bg-slate-600/80 px-2 py-0.5 text-xs font-medium text-white uppercase">
                {language}
              </span>
            )}
          </div>
        )}

        {/* Bottom overlay with creator and title info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {/* Creator info */}
          <div className="mb-2 flex items-center gap-2">
            <img 
              src={creator.avatarUrl} 
              alt={creator.name}
              className="h-6 w-6 rounded-full border border-white/20"
            />
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs text-slate-200 font-medium truncate">
                {creator.name}
              </span>
              {creator.verified && (
                <svg 
                  className="h-3 w-3 text-blue-400 flex-shrink-0" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                  aria-label="Verified creator"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                    clipRule="evenodd" 
                  />
                </svg>
              )}
              {isFollowing && (
                <span className="text-xs text-green-400 font-medium">Following</span>
              )}
            </div>
          </div>

          {/* Stream title */}
          <h3 className="text-sm font-medium text-white line-clamp-2 leading-tight">
            {title}
          </h3>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span 
                  key={tag}
                  className="rounded bg-slate-800/60 px-1.5 py-0.5 text-xs text-slate-300"
                >
                  #{tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-slate-400">+{tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Scheduled time for upcoming streams */}
          {scheduledAt && !isLive && (
            <div className="mt-2 text-xs text-orange-400">
              Starts {new Date(scheduledAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Hover overlay for additional actions */}
        <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
      </div>
    </div>
  );

  // Wrap with Link if no custom onClick handler
  if (!onClick) {
    return (
      <Link to={`/live/${id}`} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

/**
 * Compact variant of LiveCard for horizontal scrolling lists
 */
export function LiveCardCompact(props: LiveCardProps) {
  return (
    <LiveCard 
      {...props} 
      className={`w-64 flex-shrink-0 ${props.className || ''}`}
    />
  );
}

/**
 * Featured variant of LiveCard with larger sizing
 */
export function LiveCardFeatured(props: LiveCardProps) {
  return (
    <div className="col-span-2">
      <LiveCard {...props} />
    </div>
  );
}