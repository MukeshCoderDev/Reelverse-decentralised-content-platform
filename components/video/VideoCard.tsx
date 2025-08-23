import { Link, useLocation } from 'react-router-dom';
import { watchPath } from '../../utils/routes';

export interface VideoCardProps {
  id: string;
  title: string;
  posterUrl: string;
  durationSec?: number;
  authorName?: string;
  views?: number;
  className?: string;
  isLive?: boolean;
}

export interface WatchPageState {
  from: string;
  scrollY: number;
}

/**
 * Reusable VideoCard component that navigates to /watch/:id
 * Uses Link wrapper with safe overlays that don't block clicks
 */
export default function VideoCard(props: VideoCardProps) {
  const location = useLocation();
  const to = watchPath(props.id);
  
  return (
    <Link
      to={to}
      state={{ 
        from: location.pathname + location.search, 
        scrollY: window.scrollY 
      } as WatchPageState}
      className={`group block relative rounded-card overflow-hidden bg-surface focus:outline-none focus:ring-2 focus:ring-violet-500 transition-transform hover:scale-[1.02] ${props.className ?? ''}`}
      aria-label={`Watch ${props.title}`}
    >
      {/* Thumbnail Image */}
      <div className="relative aspect-video w-full">
        <img 
          src={props.posterUrl} 
          alt={props.title} 
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Live indicator badge */}
        {props.isLive && (
          <div className="pointer-events-none absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-medium">
            🔴 LIVE
          </div>
        )}
        
        {/* Duration badge */}
        {props.durationSec != null && !props.isLive && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 text-white text-xs px-2 py-1 font-medium">
            {formatDuration(props.durationSec)}
          </span>
        )}
        
        {/* Hover overlay gradient - does not block clicks */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        
        {/* Play button - decorative only, does not block clicks */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="h-14 w-14 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm">
            <svg 
              className="w-6 h-6 ml-1" 
              fill="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Content area with title and metadata */}
      <div className="p-3 space-y-1">
        {/* Title */}
        <h3 className="text-text font-medium text-video-title line-clamp-2 leading-[1.35]">
          {props.title}
        </h3>
        
        {/* Author and view count */}
        <div className="flex items-center justify-between text-video-meta text-text-2">
          {props.authorName && (
            <span className="truncate">{props.authorName}</span>
          )}
          {props.views != null && (
            <span className="flex-shrink-0">
              {formatViews(props.views)} views
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Format duration from seconds to MM:SS or HH:MM:SS format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format view count with K/M suffixes
 */
function formatViews(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Simple VideoCard variant for grid layouts
 */
export function VideoCardGrid(props: VideoCardProps) {
  return (
    <VideoCard 
      {...props} 
      className={`w-full h-full ${props.className ?? ''}`}
    />
  );
}

/**
 * Compact VideoCard variant for sidebar or small layouts
 */
export function VideoCardCompact(props: VideoCardProps) {
  const location = useLocation();
  const to = watchPath(props.id);
  
  return (
    <Link
      to={to}
      state={{ 
        from: location.pathname + location.search, 
        scrollY: window.scrollY 
      } as WatchPageState}
      className={`group flex gap-3 p-2 rounded-lg hover:bg-hover focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors ${props.className ?? ''}`}
      aria-label={`Watch ${props.title}`}
    >
      {/* Compact thumbnail */}
      <div className="relative w-24 h-16 flex-shrink-0 rounded overflow-hidden bg-slate-700">
        <img 
          src={props.posterUrl} 
          alt={props.title} 
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Duration badge */}
        {props.durationSec != null && (
          <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 text-white text-xs px-1 py-0.5">
            {formatDuration(props.durationSec)}
          </span>
        )}
      </div>
      
      {/* Compact content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-text font-medium text-sm line-clamp-2 leading-tight">
          {props.title}
        </h4>
        
        {props.authorName && (
          <p className="text-text-2 text-xs mt-1 truncate">
            {props.authorName}
          </p>
        )}
        
        {props.views != null && (
          <p className="text-text-3 text-xs mt-1">
            {formatViews(props.views)} views
          </p>
        )}
      </div>
    </Link>
  );
}