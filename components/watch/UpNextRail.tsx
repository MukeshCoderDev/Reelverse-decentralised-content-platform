import React, { useState } from 'react';
import UpNextItem from './UpNextItem';
import SkeletonListItem from './SkeletonListItem';

interface UpNextRailProps {
  currentId: string;
  channelId?: string;
  items?: any[];
  loading?: boolean;
}

/**
 * Up next rail component with filter chips
 */
export default function UpNextRail({ currentId, channelId, items = [], loading = false }: UpNextRailProps) {
  const [activeFilter, setActiveFilter] = useState(0);
  
  const filters = [
    'All',
    'From this channel',
    'Related',
    'Recently uploaded'
  ];
  
  // Filter items based on active filter
  const filteredItems = items.filter(item => {
    if (item.id === currentId) return false;
    
    switch (activeFilter) {
      case 1: // From this channel
        return channelId && item.channel?.id === channelId;
      default:
        return true;
    }
  });
  
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map((filter, i) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(i)}
            className={`px-3 py-1.5 rounded-full border text-[13px] whitespace-nowrap ${
              i === activeFilter
                ? 'text-white border-transparent'
                : 'text-text border-border'
            }`}
            style={{
              background: i === activeFilter ? 'var(--text)' : 'var(--chip)'
            }}
          >
            {filter}
          </button>
        ))}
      </div>
      
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <SkeletonListItem key={i} />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map(item => (
            <UpNextItem key={item.id} item={item} />
          ))
        ) : (
          <div className="text-center py-4 text-text-2">
            No more videos available
          </div>
        )}
      </div>
    </div>
  );
}