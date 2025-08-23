import React from 'react';

/**
 * Skeleton component for up next list items
 */
export default function SkeletonListItem() {
  return (
    <div className="flex gap-2 animate-pulse">
      <div className="relative min-w-[168px] h-[94px] rounded-card bg-hover" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-hover rounded w-3/4" />
        <div className="h-3 bg-hover rounded w-1/2" />
        <div className="h-3 bg-hover rounded w-1/3" />
      </div>
    </div>
  );
}