
import React, { useRef } from 'react';
import { ContentCard } from "./ContentCard";
import { Content } from '../../types';
import Icon from '../Icon';

interface ShelfRowProps {
    title: string;
    items: Content[];
    showScrollButtons?: boolean;
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
                            <ContentCard {...item} />
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
