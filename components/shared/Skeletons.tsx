
import React from 'react';

export function CardSkeleton() {
    return (
        <div className="flex-shrink-0 w-72 space-y-3">
            {/* YouTube-style thumbnail skeleton */}
            <div className="relative">
                <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
                {/* Duration placeholder */}
                <div className="absolute bottom-2 right-2 h-4 w-8 animate-pulse rounded bg-muted/80" />
            </div>
            
            {/* Title skeleton */}
            <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
            
            {/* Creator and metadata skeleton */}
            <div className="space-y-1">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
        </div>
    );
}

export function RowSkeleton() {
    return (
        <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, shelfIndex) => (
                <div key={shelfIndex} className="space-y-4">
                    {/* YouTube-style shelf title skeleton */}
                    <div className="flex items-center justify-between">
                        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
                        <div className="flex gap-2">
                            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                        </div>
                    </div>
                    
                    {/* YouTube-style horizontal scrolling skeleton */}
                    <div className="flex gap-4 overflow-hidden">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <CardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
