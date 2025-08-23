import React, { useState, useRef } from 'react'
import { Icon } from '@iconify/react'
import { useLivePresenceCount } from '../../hooks/useLivePresenceCount'

const chips = [
  'All',
  'Live', 
  'Music',
  'Gaming',
  'News',
  'Tech',
  'Sports',
  'Movies',
  'Podcasts',
  'Comedy',
  'Education',
  'DIY',
  'Travel',
  'Food'
]

/**
 * YouTube-style ChipRow Component
 * Features horizontal scrolling, sticky positioning, and live count integration
 */
export function ChipRow() {
  const [activeChip, setActiveChip] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const liveCount = useLivePresenceCount()

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })
  }

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })
  }

  const handleChipClick = (index: number) => {
    setActiveChip(index)
    // TODO: Filter content based on selected chip
    console.log('Selected chip:', chips[index])
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' && index < chips.length - 1) {
      e.preventDefault()
      const nextButton = e.currentTarget.parentElement?.nextElementSibling?.querySelector('button')
      nextButton?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      const prevButton = e.currentTarget.parentElement?.previousElementSibling?.querySelector('button')
      prevButton?.focus()
    }
  }

  return (
    <div 
      className="sticky z-40" 
      style={{ 
        top: 'var(--header-h)', 
        background: 'var(--header-bg)', 
        borderBottom: `1px solid var(--header-border)` 
      }}
    >
      <div className="relative mx-auto max-w-[1600px] px-4 py-2">
        {/* Left scroll button */}
        <button 
          onClick={scrollLeft}
          className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-surface border border-border rounded-full shadow-sm hover:shadow-md hover:bg-hover transition-all"
          aria-label="Scroll chips left"
        >
          <Icon icon="material-symbols:chevron-left" className="text-[16px] text-text-2" />
        </button>

        {/* Scrollable chips container */}
        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth"
          role="tablist"
          aria-label="Content categories"
        >
          {chips.map((chip, i) => (
            <div key={chip} className="snap-start">
              <button 
                role="tab"
                tabIndex={activeChip === i ? 0 : -1}
                aria-selected={activeChip === i}
                className={`px-3 py-1.5 rounded-full border whitespace-nowrap min-h-[44px] transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  activeChip === i
                    ? 'bg-text text-surface border-transparent font-medium' 
                    : 'bg-chip text-text border-border hover:bg-hover'
                }`}
                onClick={() => handleChipClick(i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
              >
                {chip}
                {chip === 'Live' && liveCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-live">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-70" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
                    </span>
                    {liveCount}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Right scroll button */}
        <button 
          onClick={scrollRight}
          className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-surface border border-border rounded-full shadow-sm hover:shadow-md hover:bg-hover transition-all"
          aria-label="Scroll chips right"
        >
          <Icon icon="material-symbols:chevron-right" className="text-[16px] text-text-2" />
        </button>
      </div>
    </div>
  )
}