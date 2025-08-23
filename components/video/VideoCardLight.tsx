import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { watchPath } from '../../utils/routes'

export interface VideoCardProps {
  v: {
    id: string
    title: string
    posterUrl: string
    durationSec?: number
    author?: { name: string; avatarUrl?: string }
    counts?: { views?: number }
    uploadedAt?: string
    quality?: 'HD' | '4K'
    isLive?: boolean
  }
  className?: string
}

export interface WatchPageState {
  from: string
  scrollY: number
}

/**
 * YouTube-style VideoCard Component
 * Features light theme design, proper typography, and accessible navigation
 */
export function VideoCard({ v, className = '' }: VideoCardProps) {
  const loc = useLocation()
  
  return (
    <Link 
      to={watchPath(v.id)} 
      state={{ 
        from: loc.pathname + loc.search, 
        scrollY: window.scrollY 
      } as WatchPageState}
      className={`group block focus-visible:outline-2 focus-visible:outline-blue-600 rounded-card ${className}`}
      aria-label={`Watch ${v.title} by ${v.author?.name}`}
    >
      {/* Thumbnail container */}
      <div className="relative rounded-card overflow-hidden bg-surface shadow-sm hover:shadow-md transition-shadow duration-200">
        <img 
          src={v.posterUrl} 
          alt={`Thumbnail for ${v.title}`}
          className="w-full aspect-video object-cover" 
          loading="lazy"
        />
        
        {/* Live indicator badge */}
        {v.isLive && (
          <div className="absolute top-2 left-2 live-indicator">
            LIVE
          </div>
        )}
        
        {/* Duration badge */}
        {v.durationSec != null && !v.isLive && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 text-white text-xs px-2 py-1 font-medium">
            {formatDuration(v.durationSec)}
          </span>
        )}
        
        {/* Quality badge */}
        {v.quality && (
          <span className="absolute top-2 right-2 rounded bg-black/80 text-white text-xs px-1.5 py-0.5 font-medium">
            {v.quality}
          </span>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
      
      {/* Content area */}
      <div className="mt-3 px-1">
        {/* Author avatar and title */}
        <div className="flex gap-3">
          {/* Author avatar */}
          {v.author?.avatarUrl && (
            <div className="flex-shrink-0">
              <img 
                src={v.author.avatarUrl} 
                alt={v.author.name}
                className="w-9 h-9 rounded-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          
          {/* Title and metadata */}
          <div className="flex-1 min-w-0">
            <h3 className="line-clamp-2 text-video-title font-medium text-text leading-[1.35] group-hover:text-brand transition-colors">
              {v.title}
            </h3>
            
            <div className="text-video-meta text-text-2 mt-1 leading-relaxed">
              <div className="truncate">
                <span>{v.author?.name ?? 'Unknown'}</span>
              </div>
              <div className="flex items-center text-text-3">
                <span>{formatViews(v.counts?.views)} views</span>
                {v.uploadedAt && (
                  <>
                    <span className="mx-1">•</span>
                    <span>{v.uploadedAt}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

/**
 * Compact VideoCard variant for sidebars and small layouts
 */
export function VideoCardCompact({ v, className = '' }: VideoCardProps) {
  const loc = useLocation()
  
  return (
    <Link 
      to={watchPath(v.id)} 
      state={{ 
        from: loc.pathname + loc.search, 
        scrollY: window.scrollY 
      } as WatchPageState}
      className={`group flex gap-3 p-2 rounded-lg hover:bg-hover focus-visible:outline-2 focus-visible:outline-blue-600 transition-colors ${className}`}
      aria-label={`Watch ${v.title} by ${v.author?.name}`}
    >
      {/* Compact thumbnail */}
      <div className="relative w-24 h-16 flex-shrink-0 rounded overflow-hidden bg-surface">
        <img 
          src={v.posterUrl} 
          alt={`Thumbnail for ${v.title}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Duration badge */}
        {v.durationSec != null && (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 text-white text-xs px-1 py-0.5">
            {formatDuration(v.durationSec)}
          </span>
        )}
      </div>
      
      {/* Compact content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-text font-medium text-sm line-clamp-2 leading-tight">
          {v.title}
        </h4>
        
        {v.author?.name && (
          <p className="text-text-2 text-xs mt-1 truncate">
            {v.author.name}
          </p>
        )}
        
        {v.counts?.views != null && (
          <p className="text-text-3 text-xs mt-1">
            {formatViews(v.counts.views)} views
          </p>
        )}
      </div>
    </Link>
  )
}

/**
 * Skeleton component for loading states
 */
export function VideoCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="aspect-video bg-border rounded-card"></div>
      <div className="mt-3 px-1">
        <div className="flex gap-3">
          <div className="w-9 h-9 bg-border rounded-full flex-shrink-0"></div>
          <div className="flex-1">
            <div className="h-4 bg-border rounded mb-2"></div>
            <div className="h-3 bg-border rounded w-3/4 mb-1"></div>
            <div className="h-3 bg-border rounded w-1/2"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Grid of VideoCard skeletons for loading states
 */
export function VideoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Helper functions
const formatDuration = (s: number): string => {
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = Math.floor(s % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatViews = (n?: number): string => {
  if (!n) return '0'
  return Intl.NumberFormat('en', { notation: 'compact' }).format(n)
}

// Export for backward compatibility
export default VideoCard