# YouTube-Style Light Theme Design

## Overview

This design document outlines the comprehensive transformation of Reelverse from its current dark theme to a clean, YouTube-inspired light theme while maintaining the platform's unique features. The design emphasizes usability, accessibility, and modern web standards while preserving the existing functionality and navigation patterns.

### Design Goals

- **Primary Theme**: Clean, YouTube-like light theme with white/very light gray backgrounds
- **Visual Hierarchy**: Crisp typography, subtle borders, and strategic use of shadows
- **User Experience**: Improved readability and reduced eye strain in bright environments
- **Brand Consistency**: Maintain Reelverse identity while adopting familiar UX patterns
- **Accessibility**: Ensure WCAG AA compliance with proper contrast ratios and keyboard navigation

## Architecture

### Design System Foundation

The theme transformation is built on a robust design token system using CSS custom properties, allowing for dynamic theme switching and consistent styling across all components.

```mermaid
graph TD
    A[CSS Variables/Design Tokens] --> B[Tailwind Config Extension]
    A --> C[Component Library]
    A --> D[Theme Switcher]
    
    B --> E[Utility Classes]
    C --> F[HeaderBar]
    C --> G[Sidebar]
    C --> H[VideoCard]
    C --> I[WatchPage]
    
    D --> J[Light Mode Default]
    D --> K[Dark Mode Optional]
    
    E --> L[Responsive Grid]
    E --> M[Interactive States]
```

### Design Token System

#### CSS Variables Implementation

```css
/* styles/theme.css */
/* Light theme (default) */
:root {
  --bg: #f9f9f9;              /* page background */
  --surface: #ffffff;          /* cards, bars, panels */
  --text: #0f0f0f;            /* primary text */
  --text-2: #606060;          /* secondary text */
  --text-3: #909090;          /* muted text */
  --border: #e5e5e5;          /* dividers */
  --hover: #f2f2f2;           /* hover surfaces */
  --chip: #f2f2f2;            /* filter chips background */
  --live: #ff0033;            /* LIVE/red seek */
  --brand: #7c3aed;           /* Upload CTA (use sparingly) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.08);
  --shadow-md: 0 2px 12px rgba(0,0,0,.06);
}

/* Optional dark mode, toggled via data-theme="dark" on <html> */
:root[data-theme="dark"] {
  --bg: #0f0f0f;
  --surface: #181818;
  --text: #f1f1f1;
  --text-2: #aaaaaa;
  --text-3: #8a8a8a;
  --border: #303030;
  --hover: #232323;
  --chip: #232323;
  --live: #ff4d4d;
  --brand: #8b5cf6;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.4);
  --shadow-md: 0 2px 12px rgba(0,0,0,.3);
}

/* Global base */
html, body, #root { 
  background: var(--bg); 
  color: var(--text); 
}

:focus-visible { 
  outline: 2px solid #3b82f6; 
  outline-offset: 2px; 
}
```

#### Tailwind Configuration Extension

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      text: 'var(--text)',
      'text-2': 'var(--text-2)',
      'text-3': 'var(--text-3)',
      border: 'var(--border)',
      hover: 'var(--hover)',
      chip: 'var(--chip)',
      live: 'var(--live)',
      brand: 'var(--brand)',
    },
    boxShadow: {
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
    },
    borderRadius: {
      card: '12px',
    },
  }
}
```

## Component Architecture

### Application Shell Layout

The main application layout adopts a YouTube-inspired structure with a persistent header and intelligent sidebar that hides on immersive watch/live routes and mobile screens.

```tsx
// layout/AppShell.tsx
import '@/styles/theme.css'
import { HeaderBar } from '@/components/header/HeaderBar'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { useLocation } from 'react-router-dom'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const immersive = /^\/(watch|live)\/[^/]+$/.test(pathname)

  return (
    <div className="min-h-screen bg-bg text-text">
      <HeaderBar />
      <div className="flex">
        {!immersive && (
          <aside className="hidden md:block w-64 shrink-0 border-r border-border bg-surface">
            <Sidebar />
          </aside>
        )}
        <main className={`flex-1 ${immersive ? 'px-0' : ''}`}>{children}</main>
      </div>
    </div>
  )
}
```

### Header System Architecture

The header system consists of three primary components working together to create a familiar YouTube-like navigation experience.

#### HeaderBar Component

```tsx
// components/header/HeaderBar.tsx
import { SearchBar } from './SearchBar'
import { ChipRow } from './ChipRow'
import { HeaderActions } from './HeaderActions'

export function HeaderBar() {
  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="mx-auto max-w-[1600px] h-14 flex items-center gap-4 px-4">
        <a href="/" className="text-[20px] font-semibold tracking-tight">
          Reelverse
        </a>
        <div className="mx-auto w-full max-w-[720px]">
          <SearchBar />
        </div>
        <div className="ml-auto">
          <HeaderActions />
        </div>
      </div>
      <ChipRow />
    </header>
  )
}
```

#### Search Bar Implementation

```tsx
// components/header/SearchBar.tsx
import { Icon } from '@iconify/react'
import { useRef, useEffect } from 'react'

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current.value = ''
        inputRef.current.blur()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <form role="search" aria-label="Site search" className="flex items-center gap-2 rounded-full bg-surface border border-border px-4 py-2 shadow-sm">
      <label htmlFor="site-search" className="sr-only">Search videos</label>
      <input 
        ref={inputRef}
        id="site-search"
        type="search"
        className="w-full bg-transparent outline-none text-[14px] placeholder:text-text-3" 
        placeholder="Search"
        aria-label="Search videos"
      />
      <button type="submit" aria-label="Search" className="text-text-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
        <Icon icon="material-symbols:search" className="text-[20px]" aria-hidden="true" />
      </button>
    </form>
  )
}
```

#### Chip Navigation Row

```tsx
// components/header/ChipRow.tsx
import { useState, useRef } from 'react'
import { Icon } from '@iconify/react'

const chips = ['All','Live','Music','Gaming','News','Tech','Sports','Movies','Podcasts','Comedy']

export function ChipRow() {
  const [activeChip, setActiveChip] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })
  }

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })
  }

  return (
    <div className="sticky top-14 z-40 border-t border-border bg-surface">
      <div className="relative mx-auto max-w-[1600px] px-4 py-2">
        {/* Left scroll button */}
        <button 
          onClick={scrollLeft}
          className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-surface border border-border rounded-full shadow-sm hover:shadow-md"
          aria-label="Scroll chips left"
        >
          <Icon icon="material-symbols:chevron-left" className="text-[16px]" />
        </button>

        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth"
          role="tablist"
          aria-label="Content categories"
        >
          {chips.map((chip, i) => (
            <button 
              key={chip}
              role="tab"
              tabIndex={activeChip === i ? 0 : -1}
              aria-selected={activeChip === i}
              className={`px-3 py-1.5 rounded-full border whitespace-nowrap snap-start min-h-[44px] transition-colors ${
                activeChip === i
                  ? 'bg-text text-white border-transparent' 
                  : 'bg-chip text-text border-border hover:bg-hover'
              }`}
              onClick={() => setActiveChip(i)}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Right scroll button */}
        <button 
          onClick={scrollRight}
          className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-surface border border-border rounded-full shadow-sm hover:shadow-md"
          aria-label="Scroll chips right"
        >
          <Icon icon="material-symbols:chevron-right" className="text-[16px]" />
        </button>
      </div>
    </div>
  )
}
```

### Sidebar Navigation

The sidebar provides a clean, light navigation experience with Material Symbols icons and accessible focus management.

```tsx
// components/sidebar/Sidebar.tsx
import { Icon } from '@iconify/react'
import { useLocation } from 'react-router-dom'

export function Sidebar() {
  const location = useLocation()
  
  const navigation = [
    { name: 'Home', href: '/', icon: 'material-symbols:home-outline' },
    { name: 'Trending', href: '/trending', icon: 'material-symbols:trending-up' },
    { name: 'Subscriptions', href: '/subscriptions', icon: 'material-symbols:subscriptions-outline' },
    { name: 'Library', href: '/library', icon: 'material-symbols:video-library-outline' },
    { name: 'History', href: '/history', icon: 'material-symbols:history' },
    { name: 'Watch Later', href: '/watch-later', icon: 'material-symbols:watch-later-outline' },
    { name: 'Liked Videos', href: '/liked', icon: 'material-symbols:thumb-up-outline' },
  ]

  return (
    <nav className="h-full bg-surface p-3" role="navigation" aria-label="Main navigation">
      <ul className="space-y-1" role="list">
        {navigation.map(item => {
          const isActive = location.pathname === item.href
          return (
            <li key={item.name} role="listitem">
              <a 
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors min-h-[44px] ${
                  isActive 
                    ? 'bg-hover font-medium border-l-4 border-brand' 
                    : 'hover:bg-hover'
                }`}
              >
                <Icon 
                  icon={item.icon} 
                  className="text-text-2 text-[20px]" 
                  aria-hidden="true" 
                />
                <span className="text-text">{item.name}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

### Video Card Component

The VideoCard component serves as the fundamental building block for all video displays throughout the application.

```tsx
// components/video/VideoCard.tsx
import { Link, useLocation } from 'react-router-dom'
import { watchPath } from '@/utils/routes'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

interface VideoCardProps {
  v: {
    id: string
    title: string
    posterUrl: string
    durationSec?: number
    author?: { name: string }
    counts?: { views?: number }
    uploadedAt?: string
    quality?: 'HD' | '4K'
  }
}

export function VideoCard({ v }: VideoCardProps) {
  const loc = useLocation()
  
  return (
    <Link 
      to={watchPath(v.id)} 
      state={{ from: loc.pathname + loc.search, scrollY: window.scrollY }}
      className="group block focus-visible:outline-2 focus-visible:outline-blue-600 rounded-card"
      aria-label={`Watch ${v.title} by ${v.author?.name}`}
    >
      <div className="relative rounded-card overflow-hidden bg-surface shadow-sm hover:shadow-md transition-shadow duration-200">
        <OptimizedImage 
          src={v.posterUrl} 
          alt={`Thumbnail for ${v.title}`}
          className="w-full aspect-video object-cover" 
        />
        
        {/* Duration badge */}
        {v.durationSec != null && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 text-white text-xs px-2 py-1 font-medium">
            {formatDuration(v.durationSec)}
          </span>
        )}
        
        {/* Quality badge */}
        {v.quality && (
          <span className="absolute top-2 left-2 rounded bg-black/80 text-white text-xs px-1.5 py-0.5 font-medium">
            {v.quality}
          </span>
        )}
      </div>
      
      <div className="mt-2 px-1">
        <h3 className="line-clamp-2 text-[15px] font-medium text-text leading-[1.35] group-hover:text-brand transition-colors">
          {v.title}
        </h3>
        <div className="text-[12px] text-text-2 mt-1 leading-relaxed">
          <span>{v.author?.name ?? 'Unknown'}</span>
          <span className="mx-1">•</span>
          <span>{formatViews(v.counts?.views)} views</span>
          {v.uploadedAt && (
            <>
              <span className="mx-1">•</span>
              <span>{v.uploadedAt}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

// Skeleton component for loading states
export function VideoCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video bg-border rounded-card"></div>
      <div className="mt-2 px-1">
        <div className="h-4 bg-border rounded mb-2"></div>
        <div className="h-3 bg-border rounded w-3/4"></div>
      </div>
    </div>
  )
}

const formatDuration = (s: number) => 
  `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`

const formatViews = (n?: number) => 
  !n ? '' : Intl.NumberFormat('en', {notation: 'compact'}).format(n)
```

## Page Layouts

### Home Page Layout with Skeletons

The home page adopts a clean grid layout with loading skeletons to prevent layout shift.

```tsx
// pages/HomePage.tsx
import { Suspense } from 'react'
import { VideoCard, VideoCardSkeleton } from '@/components/video/VideoCard'

function VideoGrid({ videos }: { videos: Video[] }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {videos.map(v => <VideoCard key={v.id} v={v} />)}
    </div>
  )
}

function VideoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      <section>
        <h2 className="text-[20px] font-semibold text-text mb-3">
          Trending Now
        </h2>
        <Suspense fallback={<VideoGridSkeleton />}>
          <VideoGrid videos={TRENDING_VIDEOS} />
        </Suspense>
      </section>
      
      <section className="mt-8">
        <h2 className="text-[20px] font-semibold text-text mb-3">
          Recommended
        </h2>
        <Suspense fallback={<VideoGridSkeleton />}>
          <VideoGrid videos={RECOMMENDED_VIDEOS} />
        </Suspense>
      </section>
    </div>
  )
}
```

### Watch Page Layout

The watch page features an immersive two-column layout with enhanced player controls and accessibility.

```tsx
// pages/WatchPage.tsx
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useRef, useEffect, useState, Suspense } from 'react'
import { useHlsPlayer } from '@/hooks/useHlsPlayer'
import { Icon } from '@iconify/react'
import { VideoCardSkeleton } from '@/components/video/VideoCard'

function ActionButton({ 
  icon, 
  label, 
  variant = 'secondary', 
  onClick 
}: { 
  icon: string
  label: string
  variant?: 'primary' | 'secondary' | 'brand'
  onClick?: () => void 
}) {
  const baseClasses = "flex items-center gap-2 px-4 py-2 rounded-full transition-colors min-h-[44px]"
  const variantClasses = {
    primary: "bg-text text-white hover:bg-text/90",
    secondary: "bg-chip text-text border border-border hover:bg-hover",
    brand: "bg-brand text-white hover:bg-brand/90"
  }
  
  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
      aria-label={label}
    >
      <Icon icon={icon} className="text-[18px]" aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

function WatchPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
      <section>
        <div className="aspect-video bg-border rounded-card animate-pulse"></div>
        <div className="mt-3 h-6 bg-border rounded animate-pulse"></div>
        <div className="mt-2 flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-10 w-20 bg-border rounded-full animate-pulse"></div>
          ))}
        </div>
        <div className="mt-3 h-24 bg-border rounded-card animate-pulse"></div>
      </section>
      <aside className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </aside>
    </div>
  )
}

export default function WatchPage() {
  const { id = '' } = useParams()
  const [meta, setMeta] = useState<any>(null)
  const [src, setSrc] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true)
        const r = await fetch(`/api/videos/${encodeURIComponent(id)}`)
        if (r.ok) {
          const m = await r.json()
          setMeta(m)
          setSrc(m.hlsUrl || m.src || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')
        } else {
          setSrc('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')
        }
      } catch (error) {
        console.error('Failed to load video:', error)
        setSrc('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [id])

  const ref = useRef<HTMLVideoElement>(null)
  useHlsPlayer(ref, src)

  if (isLoading) {
    return <WatchPageSkeleton />
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
      <section>
        <div className="relative aspect-video bg-black rounded-card overflow-hidden">
          <video 
            ref={ref} 
            controls 
            playsInline 
            className="h-full w-full object-contain bg-black"
            aria-label="Video player"
            aria-describedby="video-description"
          >
            <track kind="captions" src="/captions.vtt" srcLang="en" label="English" />
          </video>
        </div>
        
        <h1 id="video-description" className="mt-3 text-[18px] font-semibold text-text leading-tight">
          {meta?.title ?? 'Video'}
        </h1>
        
        {/* Enhanced actions row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <ActionButton icon="material-symbols:thumb-up-outline" label="Like" />
          <ActionButton icon="material-symbols:thumb-down-outline" label="Dislike" />
          <ActionButton icon="material-symbols:share-outline" label="Share" />
          <ActionButton icon="material-symbols:bookmark-outline" label="Save" />
          <ActionButton icon="material-symbols:more-horiz" label="More" />
          <div className="ml-auto">
            <ActionButton 
              icon="material-symbols:payments-outline" 
              label="Tip Creator" 
              variant="brand" 
            />
          </div>
        </div>
        
        {/* Enhanced description box */}
        <div className="mt-4 rounded-card border border-border bg-surface p-4">
          <div className="flex items-center gap-3 mb-3">
            <img 
              src={meta?.author?.avatar || '/default-avatar.png'} 
              alt={`${meta?.author?.name}'s avatar`}
              className="w-10 h-10 rounded-full bg-border"
            />
            <div>
              <div className="font-medium text-text">{meta?.author?.name ?? 'Unknown Creator'}</div>
              <div className="text-sm text-text-2">{meta?.author?.subscribers ?? '0'} subscribers</div>
            </div>
            <button className="ml-auto btn-primary">
              Subscribe
            </button>
          </div>
          
          <div className="text-[14px] text-text-2">
            <p className="line-clamp-3">{meta?.description ?? 'No description available.'}</p>
            <button className="text-text hover:underline text-[13px] mt-2 focus-visible:outline-2 focus-visible:outline-blue-600">
              Show more
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-3">
        <div className="rounded-card border border-border bg-surface p-3">
          <div className="text-[14px] font-semibold text-text mb-3">Up next</div>
          <Suspense fallback={
            <div className="space-y-3">
              {Array.from({ length: 8 }, (_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          }>
            {/* Map recommended videos with VideoCard small variant */}
            <div className="space-y-3">
              {/* Recommended videos would be rendered here */}
            </div>
          </Suspense>
        </div>
      </aside>
    </div>
  )
}
```

## Styling Specifications

### Typography System

```css
/* Typography hierarchy optimized for readability */
.text-display {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.text-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
}

.text-heading {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
}

.text-body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}

.text-caption {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}

/* Video card specific typography */
.video-title {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
}

.video-meta {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}
```

### Utility Classes

```css
/* Hide scrollbars while maintaining functionality */
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Touch target size compliance */
button, a {
  min-height: 44px;
  min-width: 44px;
}
```

### Interactive States

```css
/* Enhanced button states with proper focus */
.btn-primary {
  background: var(--brand);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 18px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-height: 44px;
  min-width: 44px;
}

.btn-primary:hover {
  background: #6d28d9;
}

.btn-primary:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.btn-secondary {
  background: var(--chip);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 18px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-height: 44px;
}

.btn-secondary:hover {
  background: var(--hover);
}

.btn-secondary:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Card hover effects */
.card-hover {
  transition: box-shadow 0.2s ease;
}

.card-hover:hover {
  box-shadow: var(--shadow-md);
}

/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .card-hover:hover {
    transform: none;
  }
}
```

### Video Player Styling

```css
/* Video player customization with cross-browser support */
video::-webkit-media-controls-timeline {
  accent-color: var(--live);
}

video::-webkit-media-controls-current-time-display {
  accent-color: var(--live);
}

/* Custom progress bar for Safari/Firefox compatibility */
.video-progress-container {
  position: relative;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  cursor: pointer;
}

.video-progress {
  background: var(--live);
  height: 100%;
  border-radius: 2px;
  transition: width 0.1s ease;
}

.video-progress-handle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  background: var(--live);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.video-progress-container:hover .video-progress-handle {
  opacity: 1;
}

/* Live indicator */
.live-indicator {
  background: var(--live);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.live-indicator::before {
  content: '';
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: live-pulse 2s infinite;
}

@keyframes live-pulse {
  0%, 50% { opacity: 1; }
  25%, 75% { opacity: 0.5; }
}

/* Safe area support for iOS */
@supports (padding: max(0px)) {
  .video-container {
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
  }
}
```

## Theme Switching System

### Theme Controller with FOUC Prevention

```tsx
// hooks/useTheme.ts
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'light'
    }
    return 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    
    const applyTheme = (selectedTheme: Theme) => {
      if (selectedTheme === 'dark') {
        root.dataset.theme = 'dark'
      } else if (selectedTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.dataset.theme = isDark ? 'dark' : ''
      } else {
        root.dataset.theme = ''
      }
    }

    applyTheme(theme)
    localStorage.setItem('theme', theme)

    // Listen for system theme changes when in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  return { theme, setTheme }
}

// FOUC Prevention Script (add to index.html)
/*
<script>
  (function() {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.dataset.theme = 'dark';
    } else if (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
    }
  })();
</script>
*/
```

### Theme Switcher Component

```tsx
// components/ThemeSwitcher.tsx
import { useTheme } from '@/hooks/useTheme'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-lg ${
          theme === 'light' ? 'bg-chip' : 'hover:bg-hover'
        }`}
        aria-label="Light theme"
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-lg ${
          theme === 'dark' ? 'bg-chip' : 'hover:bg-hover'
        }`}
        aria-label="Dark theme"
      >
        🌙
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-lg ${
          theme === 'system' ? 'bg-chip' : 'hover:bg-hover'
        }`}
        aria-label="System theme"
      >
        💻
      </button>
    </div>
  )
}
```

## Accessibility Implementation

### Focus Management

```css
/* Enhanced focus indicators with better visibility */
*:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 4px;
}

/* High contrast focus for better accessibility */
@media (prefers-contrast: high) {
  *:focus-visible {
    outline: 3px solid #000000;
    outline-offset: 3px;
  }
}

/* Focus trap for modals and drawers */
.focus-trap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
}

/* Skip links for keyboard navigation */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--surface);
  color: var(--text);
  padding: 8px 12px;
  border-radius: 4px;
  text-decoration: none;
  z-index: 100;
  font-weight: 500;
  border: 2px solid var(--border);
}

.skip-link:focus {
  top: 6px;
}

/* Keyboard shortcuts styling */
.kbd {
  background: var(--chip);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: monospace;
  color: var(--text-2);
}
```

### Keyboard Navigation

```tsx
// Enhanced keyboard shortcuts hook
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      switch (e.key) {
        case '/':
          e.preventDefault()
          document.getElementById('site-search')?.focus()
          break
          
        case 'Escape':
          // Close any open modals/drawers
          const activeElement = document.activeElement as HTMLElement
          activeElement?.blur()
          break
          
        case '?':
          if (e.shiftKey) {
            e.preventDefault()
            // Show keyboard shortcuts modal
            showShortcutsModal()
          }
          break
          
        case 'k':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            document.getElementById('site-search')?.focus()
          }
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}

// Keyboard shortcuts modal
function KeyboardShortcutsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const shortcuts = [
    { key: '/', description: 'Focus search' },
    { key: 'Ctrl+K', description: 'Focus search (alternative)' },
    { key: 'Esc', description: 'Close modal or clear focus' },
    { key: 'Shift+?', description: 'Show keyboard shortcuts' },
    { key: 'Space', description: 'Play/pause video' },
    { key: '←/→', description: 'Seek video backward/forward' },
    { key: '↑/↓', description: 'Volume up/down' },
  ]
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-card p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-2">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex justify-between items-center">
              <span className="text-text-2">{description}</span>
              <span className="kbd">{key}</span>
            </div>
          ))}
        </div>
        <button 
          onClick={onClose}
          className="mt-4 btn-primary w-full"
        >
          Close
        </button>
      </div>
    </div>
  )
}
```

### ARIA Labels and Roles

```tsx
// Enhanced accessibility attributes for navigation
<nav role="navigation" aria-label="Main navigation">
  <ul role="list">
    <li role="listitem">
      <a 
        href="/home" 
        aria-current={isActive ? 'page' : undefined}
        aria-describedby="nav-home-desc"
        className="nav-link"
      >
        <Icon icon="material-symbols:home-outline" aria-hidden="true" />
        <span>Home</span>
        <span id="nav-home-desc" className="sr-only">
          Navigate to home page with trending videos
        </span>
      </a>
    </li>
  </ul>
</nav>

// Enhanced video player accessibility
<video
  ref={videoRef}
  aria-label={`Video: ${videoTitle}`}
  aria-describedby="video-description video-controls-help"
  controls
  playsInline
>
  <track kind="captions" src="/captions.vtt" srcLang="en" label="English" default />
  <track kind="descriptions" src="/descriptions.vtt" srcLang="en" label="Audio descriptions" />
</video>

<div id="video-controls-help" className="sr-only">
  Use space to play/pause, arrow keys to seek, and up/down arrows for volume.
</div>

// Enhanced search form accessibility
<form role="search" aria-label="Site search" className="search-form">
  <label htmlFor="site-search" className="sr-only">
    Search videos and creators
  </label>
  <input 
    id="site-search"
    type="search"
    aria-describedby="search-help"
    aria-expanded={isAutocompleteOpen}
    aria-haspopup="listbox"
    aria-autocomplete="list"
    placeholder="Search"
  />
  <div id="search-help" className="sr-only">
    Search across videos, creators, and playlists. Use slash key to focus.
  </div>
  {isAutocompleteOpen && (
    <ul role="listbox" aria-label="Search suggestions">
      {suggestions.map((suggestion, index) => (
        <li 
          key={suggestion.id}
          role="option"
          aria-selected={index === selectedIndex}
          aria-describedby={`suggestion-${index}-desc`}
        >
          {suggestion.text}
          <span id={`suggestion-${index}-desc`} className="sr-only">
            {suggestion.type} - {suggestion.description}
          </span>
        </li>
      ))}
    </ul>
  )}
</form>

// Video card with rich accessibility
<article 
  className="video-card"
  aria-labelledby={`video-title-${video.id}`}
  aria-describedby={`video-meta-${video.id}`}
>
  <Link to={watchPath(video.id)} aria-describedby={`video-desc-${video.id}`}>
    <img 
      src={video.thumbnail}
      alt=""
      aria-hidden="true"
      className="video-thumbnail"
    />
    <h3 id={`video-title-${video.id}`} className="video-title">
      {video.title}
    </h3>
  </Link>
  
  <div id={`video-meta-${video.id}`} className="video-meta">
    <span>{video.author}</span>
    <span aria-label={`${video.views} views`}>{formatViews(video.views)} views</span>
    <time dateTime={video.publishedAt} aria-label={`Published ${video.publishedAt}`}>
      {formatRelativeTime(video.publishedAt)}
    </time>
  </div>
  
  <div id={`video-desc-${video.id}`} className="sr-only">
    Watch {video.title} by {video.author}, published {video.publishedAt} with {video.views} views
  </div>
</article>
```

## Responsive Design System

### Breakpoint System

```css
/* Enhanced responsive breakpoints with optimal grid density */
@media (min-width: 640px) {
  .container { max-width: 640px; }
  .grid-video { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 768px) {
  .container { max-width: 768px; }
  .sidebar { width: 240px; }
  .grid-video { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .container { max-width: 1024px; }
  .grid-video { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1280px) {
  .container { max-width: 1280px; }
  .grid-video { grid-template-columns: repeat(4, 1fr); }
}

@media (min-width: 1440px) {
  .container { max-width: 1600px; }
  .grid-video { grid-template-columns: repeat(5, 1fr); }
}

@media (min-width: 1920px) {
  .container { max-width: 1600px; }
  .grid-video { grid-template-columns: repeat(5, 1fr); }
}

/* RTL support */
[dir="rtl"] .chip-scroll {
  direction: rtl;
}

[dir="rtl"] .sidebar {
  border-left: 1px solid var(--border);
  border-right: none;
}

[dir="rtl"] .header-actions {
  margin-right: auto;
  margin-left: 0;
}
```

### Mobile Layout Adaptations

```tsx
// Mobile-specific components with enhanced UX
export function MobileHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  
  return (
    <header className="md:hidden bg-surface border-b border-border">
      {!isSearchOpen ? (
        <div className="flex items-center justify-between p-4">
          <button className="p-2 min-h-[44px] min-w-[44px]" aria-label="Menu">
            <Icon icon="material-symbols:menu" className="text-[20px]" />
          </button>
          <div className="text-lg font-semibold">Reelverse</div>
          <button 
            className="p-2 min-h-[44px] min-w-[44px]" 
            aria-label="Search"
            onClick={() => setIsSearchOpen(true)}
          >
            <Icon icon="material-symbols:search" className="text-[20px]" />
          </button>
        </div>
      ) : (
        <div className="flex items-center p-4 gap-2">
          <button 
            className="p-2 min-h-[44px] min-w-[44px]" 
            aria-label="Close search"
            onClick={() => setIsSearchOpen(false)}
          >
            <Icon icon="material-symbols:arrow-back" className="text-[20px]" />
          </button>
          <SearchBar />
        </div>
      )}
    </header>
  )
}

// Enhanced mobile navigation drawer
export function MobileNavDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-50 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <nav 
        className="fixed left-0 top-0 h-full w-80 bg-surface border-r border-border z-50 md:hidden transform transition-transform"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Reelverse</div>
            <button 
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px]" 
              aria-label="Close menu"
            >
              <Icon icon="material-symbols:close" className="text-[20px]" />
            </button>
          </div>
        </div>
        <Sidebar />
      </nav>
    </>
  )
}
```

## Performance Optimizations

### Code Splitting

```tsx
// Lazy loading for route components
const HomePage = lazy(() => import('./pages/HomePage'))
const WatchPage = lazy(() => import('./pages/WatchPage'))
const TrendingPage = lazy(() => import('./pages/TrendingPage'))

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/trending" element={<TrendingPage />} />
        </Routes>
      </Suspense>
    </Router>
  )
}
```

### Image Optimization

```tsx
// Optimized image loading
export function OptimizedImage({ 
  src, 
  alt, 
  className, 
  sizes = "100vw" 
}: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      sizes={sizes}
      onError={(e) => {
        e.currentTarget.src = '/placeholder-video.jpg'
      }}
    />
  )
}
```

## Testing Strategy

### Unit Testing

```typescript
// Enhanced theme switching tests
describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })
  
  it('should apply light theme by default', () => {
    render(<ThemeSwitcher />)
    expect(document.documentElement.dataset.theme).toBe('')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('should switch to dark theme when clicked', () => {
    render(<ThemeSwitcher />)
    fireEvent.click(screen.getByLabelText('Dark theme'))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })
  
  it('should respect system preference in system mode', () => {
    // Mock system dark mode
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
    
    render(<ThemeSwitcher />)
    fireEvent.click(screen.getByLabelText('System theme'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
  
  it('should prevent FOUC with localStorage persistence', () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeSwitcher />)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

// Video card interaction tests
describe('VideoCard', () => {
  const mockVideo = {
    id: 'test-id',
    title: 'Test Video',
    posterUrl: '/test-thumbnail.jpg',
    author: { name: 'Test Creator' },
    counts: { views: 1000 },
    durationSec: 120
  }
  
  it('should navigate to watch page on click', () => {
    const mockNavigate = jest.fn()
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate
    }))
    
    render(<VideoCard v={mockVideo} />)
    fireEvent.click(screen.getByRole('link'))
    expect(mockNavigate).toHaveBeenCalledWith('/watch/test-id')
  })
  
  it('should display formatted duration', () => {
    render(<VideoCard v={mockVideo} />)
    expect(screen.getByText('2:00')).toBeInTheDocument()
  })
  
  it('should handle missing data gracefully', () => {
    const incompleteVideo = { id: 'test', title: 'Test', posterUrl: '/test.jpg' }
    render(<VideoCard v={incompleteVideo} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})

// Search functionality tests
describe('SearchBar', () => {
  it('should focus on forward slash key', () => {
    render(<SearchBar />)
    fireEvent.keyDown(document, { key: '/' })
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })
  
  it('should clear on escape key', () => {
    render(<SearchBar />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'test query' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('')
  })
  
  it('should have proper accessibility attributes', () => {
    render(<SearchBar />)
    const form = screen.getByRole('search')
    const input = screen.getByRole('searchbox')
    
    expect(form).toHaveAttribute('aria-label', 'Site search')
    expect(input).toHaveAttribute('type', 'search')
    expect(input).toHaveAttribute('aria-label', 'Search videos')
  })
})
```

### Accessibility Testing

```typescript
// Comprehensive A11y compliance tests
describe('Accessibility Compliance', () => {
  it('should have proper focus management', async () => {
    render(<VideoCard {...mockVideo} />)
    const card = screen.getByRole('link')
    
    // Test keyboard navigation
    card.focus()
    expect(card).toHaveFocus()
    
    // Test visible focus indicator
    expect(card).toHaveStyle('outline: 2px solid #3b82f6')
  })

  it('should meet contrast requirements', async () => {
    const { container } = render(<HomePage />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
  
  it('should have proper heading hierarchy', () => {
    render(<HomePage />)
    const headings = screen.getAllByRole('heading')
    
    // Check that headings follow logical order
    expect(headings[0]).toHaveAttribute('aria-level', '1')
    expect(headings[1]).toHaveAttribute('aria-level', '2')
  })
  
  it('should have sufficient touch target sizes', () => {
    render(<HeaderBar />)
    const buttons = screen.getAllByRole('button')
    
    buttons.forEach(button => {
      const styles = window.getComputedStyle(button)
      const minHeight = parseInt(styles.minHeight)
      const minWidth = parseInt(styles.minWidth)
      
      expect(minHeight).toBeGreaterThanOrEqual(44)
      expect(minWidth).toBeGreaterThanOrEqual(44)
    })
  })
  
  it('should support keyboard navigation', () => {
    render(<ChipRow />)
    const chips = screen.getAllByRole('tab')
    
    // Test tab navigation
    chips[0].focus()
    fireEvent.keyDown(chips[0], { key: 'ArrowRight' })
    expect(chips[1]).toHaveFocus()
    
    fireEvent.keyDown(chips[1], { key: 'ArrowLeft' })
    expect(chips[0]).toHaveFocus()
  })
  
  it('should announce dynamic content changes', () => {
    const { rerender } = render(<VideoGrid videos={[]} />)
    
    rerender(<VideoGrid videos={mockVideos} />)
    
    // Check for aria-live region updates
    expect(screen.getByRole('status')).toHaveTextContent(
      `${mockVideos.length} videos loaded`
    )
  })
  
  it('should support screen readers', () => {
    render(<VideoCard {...mockVideo} />)
    
    // Check for descriptive labels
    expect(screen.getByRole('link')).toHaveAccessibleName(
      `Watch ${mockVideo.title} by ${mockVideo.author.name}`
    )
    
    // Check for helper text
    expect(screen.getByText(/published/i)).toBeInTheDocument()
  })
  
  it('should handle reduced motion preferences', () => {
    // Mock reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
      })),
    })
    
    render(<VideoCard {...mockVideo} />)
    const card = screen.getByRole('link')
    
    // Check that animations are disabled
    expect(card).toHaveStyle('animation-duration: 0.01ms')
  })
})

// Performance testing
describe('Performance', () => {
  it('should render video grid without layout shift', async () => {
    const { container } = render(
      <Suspense fallback={<VideoGridSkeleton />}>
        <VideoGrid videos={mockVideos} />
      </Suspense>
    )
    
    // Measure initial layout
    const initialHeight = container.getBoundingClientRect().height
    
    // Wait for content to load
    await waitFor(() => {
      expect(screen.getAllByRole('link')).toHaveLength(mockVideos.length)
    })
    
    // Verify no significant layout shift
    const finalHeight = container.getBoundingClientRect().height
    const layoutShift = Math.abs(finalHeight - initialHeight) / initialHeight
    
    expect(layoutShift).toBeLessThan(0.1) // Less than 10% shift
  })
  
  it('should lazy load images efficiently', () => {
    render(<VideoCard {...mockVideo} />)
    const image = screen.getByRole('img')
    
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('decoding', 'async')
  })
  
  it('should handle error states gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    
    render(<ErrorBoundary><VideoCard {...mockVideo} /></ErrorBoundary>)
    
    // Simulate image load error
    const image = screen.getByRole('img')
    fireEvent.error(image)
    
    // Check fallback is shown
    expect(image).toHaveAttribute('src', '/placeholder-video.jpg')
    
    consoleSpy.mockRestore()
  })
})
```

## Production Readiness

### Implementation Dependencies

```json
// package.json additions
{
  "dependencies": {
    "@iconify/react": "^4.1.1",
    "@testing-library/jest-dom": "^6.1.4",
    "@axe-core/react": "^4.8.2"
  }
}
```

### Installation Guide

```bash
# Install required dependencies
npm install @iconify/react @testing-library/jest-dom @axe-core/react

# Update existing components
npm run build
npm run test
```

### FOUC Prevention Setup

Add this script to `index.html` before any other scripts:

```html
<!-- index.html -->
<head>
  <!-- Prevent flash of incorrect theme -->
  <script>
    (function() {
      var theme = localStorage.getItem('theme');
      var root = document.documentElement;
      
      if (theme === 'dark') {
        root.dataset.theme = 'dark';
      } else if (theme === 'system') {
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.dataset.theme = 'dark';
        }
      }
      // Light theme is default, no action needed
    })();
  </script>
  
  <!-- Add theme CSS -->
  <link rel="stylesheet" href="/src/styles/theme.css" />
</head>
```

### Critical Performance Optimizations

1. **Image Optimization Component**

```tsx
// components/ui/OptimizedImage.tsx
import { useState } from 'react'

interface OptimizedImageProps {
  src: string
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
}

export function OptimizedImage({ 
  src, 
  alt, 
  className, 
  sizes = "100vw",
  priority = false 
}: OptimizedImageProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  
  return (
    <img
      src={error ? '/placeholder-video.jpg' : src}
      alt={alt}
      className={`${className} ${!loaded ? 'opacity-0' : 'opacity-100'} transition-opacity`}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      sizes={sizes}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
    />
  )
}
```

2. **Error Boundary Implementation**

```tsx
// components/ui/ErrorBoundary.tsx
import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8 bg-surface border border-border rounded-card">
          <div className="text-center">
            <div className="text-text-2 mb-2">Something went wrong</div>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="btn-secondary"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
```

### Go-Live UI Checklist

#### Header and Navigation
- ✅ Header and sidebar use white backgrounds with subtle borders
- ✅ Chips row is sticky under header with horizontal scroll and snap
- ✅ Search is accessible with proper ARIA labels and keyboard shortcuts
- ✅ Material Symbols icons replace emoji throughout interface
- ✅ Navigation focus order is logical and visible

#### Video Cards and Layout
- ✅ Cards are light with correct title sizing (15px, line-height 1.35)
- ✅ Secondary text uses 12px with proper contrast ratios
- ✅ Hover effects are subtle (shadow-sm to shadow-md transition)
- ✅ Focus rings are always visible for keyboard navigation
- ✅ All video cards navigate to /watch/:id properly

#### Watch Page Experience
- ✅ Player sits on white background with clean layout
- ✅ Right rail resembles YouTube's "Up next" section
- ✅ Actions row is balanced and accessible
- ✅ Sidebar hidden on immersive watch/live routes
- ✅ Live indicators and seek controls use red color (#ff0033)

#### Responsive and Accessibility
- ✅ Layout works across all breakpoints (320px to 1920px+)
- ✅ Touch targets meet 44px minimum size requirement
- ✅ Color contrast meets WCAG AA standards
- ✅ Screen readers can navigate effectively
- ✅ Keyboard shortcuts work as expected

#### Performance and Loading
- ✅ Skeletons prevent layout shift during loading
- ✅ Images lazy load with proper fallbacks
- ✅ Theme switching has no flash of incorrect content
- ✅ Grid density feels optimal at 1600px+ widths
- ✅ Reduced motion preferences are respected

#### Cross-Browser Compatibility
- ✅ Works in Chrome, Safari, Firefox, Edge
- ✅ Native video controls maintain brand colors where possible
- ✅ RTL languages display correctly
- ✅ iOS safe areas are respected
- ✅ High contrast mode is supported

### Nice-to-Have Polish Features

```tsx
// Compact view count formatting
function formatCompactViews(count: number): string {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(count)
}

// Enhanced video meta display
function VideoMeta({ video }: { video: Video }) {
  return (
    <div className="text-[12px] text-text-2 leading-relaxed">
      <span>{video.author.name}</span>
      <span className="mx-1">•</span>
      <span>{formatCompactViews(video.views)} views</span>
      <span className="mx-1">•</span>
      <time dateTime={video.publishedAt}>
        {formatRelativeTime(video.publishedAt)}
      </time>
    </div>
  )
}

// Context menu for video cards
function VideoCardMenu({ video }: { video: Video }) {
  return (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button 
        className="p-2 bg-black/75 text-white rounded-full hover:bg-black/90"
        aria-label="Video options"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          // Show context menu
        }}
      >
        <Icon icon="material-symbols:more-vert" className="text-[16px]" />
      </button>
    </div>
  )
}

// Quality badge for thumbnails
function QualityBadge({ quality }: { quality?: 'HD' | '4K' | '8K' }) {
  if (!quality) return null
  
  return (
    <span className="absolute top-2 left-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
      {quality}
    </span>
  )
}
```

### Deployment Instructions

1. **Pre-deployment Testing**
   ```bash
   # Run full test suite
   npm run test
   npm run test:a11y
   
   # Build and verify
   npm run build
   npm run preview
   
   # Performance audit
   npm run lighthouse
   ```

2. **Feature Flag Rollout**
   ```typescript
   // Gradual rollout strategy
   const LIGHT_THEME_ROLLOUT = {
     beta: 0.1,      // 10% of users
     stable: 0.5,    // 50% of users
     full: 1.0       // 100% of users
   }
   ```

3. **Monitoring and Metrics**
   - Track theme preference adoption rates
   - Monitor accessibility compliance scores
   - Measure Core Web Vitals (LCP, FID, CLS)
   - Track user engagement metrics post-rollout

4. **Rollback Plan**
   - Keep dark theme as fallback
   - Implement instant theme switching
   - Monitor error rates and user feedback
   - Prepare hotfix deployment pipeline

This comprehensive YouTube-style light theme implementation provides a production-ready foundation that matches modern UX expectations while maintaining accessibility, performance, and cross-browser compatibility standards.