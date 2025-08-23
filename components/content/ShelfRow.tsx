
import React, { useRef } from 'react';
import VideoCard from "../video/VideoCard";
import { Content } from '../../types';
import Icon from '../Icon';

interface ShelfRowProps {
    title: string;
    items: Content[];
    showScrollButtons?: boolean;
}

// Helper function to convert Content to VideoCard props
function contentToVideoCardProps(content: Content) {
    return {
        id: content.id,
        title: content.title,
        posterUrl: content.thumbnail || '/placeholder.svg',
        durationSec: Math.floor(Math.random() * 600 + 60), // Mock duration for now
        authorName: content.creator,
        views: parseViewCount(content.views),
    };
}

// Parse view count string to number
function parseViewCount(viewsStr: string): number {
    if (!viewsStr) return 0;
    
    const cleaned = viewsStr.toLowerCase().replace(/[^0-9.kmb]/g, '');
    const num = parseFloat(cleaned);
    
    if (cleaned.includes('k')) return Math.floor(num * 1000);
    if (cleaned.includes('m')) return Math.floor(num * 1000000);
    if (cleaned.includes('b')) return Math.floor(num * 1000000000);
    
    return Math.floor(num) || 0;
}

export function ShelfRow({ title, items, showScrollButtons = true }: ShelfRowProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 320; // Width of approximately one card
            const currentScroll = scrollContainerRef.current.scrollLeft;
            const targetScroll = direction === 'left' 
                ? currentScroll - scrollAmount 
                : currentScroll + scrollAmount;
            
            scrollContainerRef.current.scrollTo({
                left: targetScroll,
                behavior: 'smooth'
            });
        }
    };

    return (
        <section className="mb-8">
            {/* YouTube-style shelf header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">{title}</h2>
                {showScrollButtons && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => scroll('left')}
                            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                            aria-label="Scroll left"
                        >
                            <Icon name="chevron-left" size={16} />
                        </button>
                        <button
                            onClick={() => scroll('right')}
                            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                            aria-label="Scroll right"
                        >
                            <Icon name="chevron-right" size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* YouTube-style horizontal scrolling container */}
            <div className="relative">
                <div 
                    ref={scrollContainerRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {items.map((item, i) => (
                        <div key={`${item.title}-${i}`} className="flex-shrink-0 w-72">
                            <VideoCard {...contentToVideoCardProps(item)} />
                        </div>
                    ))}
                </div>
                
                {/* Gradient fade effects */}
                <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-background to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-background to-transparent pointer-events-none" />
            </div>
        </section>
    );
}
