import React from 'react';
import { Link } from 'react-router-dom';
import { watchPath } from '../../utils/routes';
import { formatDuration, formatViews } from '../../utils/time';

interface UpNextItemProps {
  item: any;
}

/**
 * Up next item component for individual videos in the rail
 */
export default function UpNextItem({ item }: UpNextItemProps) {
  return (
    <Link 
      to={watchPath(item.id)} 
      className="flex gap-2 group"
    >
      <div className="relative min-w-[168px] h-[94px] rounded-card overflow-hidden bg-surface border border-border">
        <img 
          src={item.posterUrl} 
          alt={item.title} 
          className="w-full h-full object-cover" 
          loading="lazy"
        />
        <span className="absolute bottom-1 right-1 rounded bg-black/70 text-white text-[11px] px-1 py-0.5">
          {formatDuration(item.durationSec)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium line-clamp-2 group-hover:text-brand transition-colors">
          {item.title}
        </div>
        <div className="text-[12px] text-text-2 mt-1">
          {item.channel?.name ?? '—'}
        </div>
        <div className="text-[12px] text-text-2">
          {item.views != null ? `${formatViews(item.views)} views` : ''} 
          {item.publishedAt ? ` • ${item.publishedAt}` : ''}
        </div>
      </div>
    </Link>
  );
}