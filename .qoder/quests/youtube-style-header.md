# YouTube-Style Header Implementation Design

## 1. Overview

This document outlines the design for implementing a YouTube-style header for the Reelverse platform. The new header will feature:
- A 56px tall sticky header bar with centered search functionality
- A filter chip row directly below the header (hidden on immersive routes)
- Right-aligned action buttons (Upload, Balance, Sign in/Profile)
- Theme-aware styling (white in light mode, dark in dark mode)
- Removal of duplicate "Reelverse" page headings
- Collapsed sidebar on immersive routes (/watch/:id and /live/:id)
- Safe-area support for iOS devices
- Enhanced keyboard UX for search
- Proper FOUC prevention

## 2. Component Architecture

### 2.1 HeaderBar Component
The main header component that contains the brand, search bar, and action buttons.

### 2.2 SearchBar Component
A YouTube-style search bar with keyboard shortcuts and accessibility features.

### 2.3 ChipRow Component
A horizontally scrollable row of category filter chips that sticks directly under the header.

### 2.4 HeaderActions Component
Contains the right-aligned action buttons including Upload, Balance, and Authentication.

## 3. UI/UX Design

### 3.1 Visual Design
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HeaderBar (56px height)                                                     │
│ ┌──────────┬─────────────────────────────────┬─────────────────────────────┐ │
│ │ Reelverse│           SearchBar             │ Upload Balance Sign in      │ │
│ └──────────┴─────────────────────────────────┴─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ ChipRow (variable height, sticky)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ All Live Music Gaming News Tech Sports Movies Podcasts Comedy ...       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Route-Aware Behavior
- Chip row is visible on Home/Listing pages
- Chip row is hidden on immersive routes (/watch/:id and /live/:id)
- Sidebar is collapsed on immersive routes to maximize focus
- Proper safe-area padding for iOS devices with notches

### 3.2 Theme Support
The header will automatically adapt to light/dark themes using CSS variables:

**Light Theme:**
- Background: #ffffff
- Border: #e5e5e5

**Dark Theme:**
- Background: #0f0f0f
- Border: #303030

### 3.3 Responsive Design
- Header height: 56px on all screen sizes (including mobile)
- Search bar: Centered with responsive width
- Action buttons: Right-aligned with responsive behavior
- Chip row: Horizontally scrollable on small screens

## 4. Technical Implementation

### 4.1 CSS Variables
Add the following CSS variables to `styles/theme.css`:

```css
:root {
  --header-h: 56px;
  --header-bg: #ffffff;
  --header-border: #e5e5e5;
}

:root[data-theme="dark"] {
  --header-bg: #0f0f0f;
  --header-border: #303030;
}

/* Add safe-area padding to body for iOS notch */
body {
  padding-top: env(safe-area-inset-top, 0);
}

/* In dark mode use a soft shadow; in light keep border */
.header-shadow-light {
  box-shadow: none;
}

.header-shadow-dark {
  box-shadow: 0 1px 2px rgba(0,0,0,.3);
}
```

### 4.2 HeaderBar Component
```tsx
// components/header/HeaderBar.tsx
import { useLocation } from 'react-router-dom'
import { SearchBar } from './SearchBar'
import { ChipRow } from './ChipRow'
import { HeaderActions } from './HeaderActions'

export function HeaderBar() {
  const { pathname } = useLocation()
  const immersive = /^/(watch|live)/[^/]+$/.test(pathname)

  return (
    <header className="sticky top-0 z-50" style={{ background: 'var(--header-bg)' }}>
      <div
        className="w-full border-b"
        style={{ borderColor: 'var(--header-border)', height: 'var(--header-h)' }}
      >
        <div className="mx-auto max-w-[1600px] h-full flex items-center gap-4 px-4">
          {/* Brand (no duplicate below) */}
          <a href="/" className="text-[20px] font-semibold tracking-tight text-text">
            Reelverse
          </a>

          {/* Centered search */}
          <div className="mx-auto w-full max-w-[720px]">
            <SearchBar />
          </div>

          {/* Right actions */}
          <div className="ml-auto">
            <HeaderActions />
          </div>
        </div>
      </div>

      {/* Sticky chip row directly under header (hidden on immersive routes) */}
      {!immersive && <ChipRow />}
    </header>
  )
}
```

### 4.3 SearchBar Component
```tsx
// components/header/SearchBar.tsx
import { useEffect, useRef } from 'react'

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); inputRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current!.value = ''
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <form role="search" aria-label="Site search">
      <label htmlFor="site-search" className="sr-only">Search</label>
      <div 
        className="flex items-center gap-2 rounded-full border px-4" 
        style={{ height: '40px', background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <input 
          ref={inputRef}
          id="site-search" 
          type="search" 
          placeholder="Search" 
          className="w-full bg-transparent outline-none text-[14px] placeholder:text-text-3"
          aria-keyshortcuts="/"
        />
        <button type="submit" aria-label="Search" className="text-text-2">🔍</button>
      </div>
    </form>
  )
}
```

### 4.4 ChipRow Component
```tsx
// components/header/ChipRow.tsx
const chips = ['All','Live','Music','Gaming','News','Tech','Sports']

export function ChipRow() {
  return (
    <div 
      className="sticky z-40" 
      style={{ 
        top: 'var(--header-h)', 
        background: 'var(--header-bg)', 
        borderBottom: `1px solid var(--header-border)` 
      }}
    >
      <div className="mx-auto max-w-[1600px] px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
        {chips.map((c, i) => (
          <button 
            key={c} 
            className={`px-3 py-1.5 rounded-full border text-[14px] ${
              i === 0 
                ? 'text-white border-transparent' 
                : 'text-text border-border'
            }`}
            style={{ 
              background: i === 0 ? 'var(--text)' : 'var(--chip)' 
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}
```

Note: The `no-scrollbar` class is already defined in the existing CSS utilities.

### 4.5 AppShell Component
```tsx
// layout/AppShell.tsx
import { useLocation } from 'react-router-dom'
import { HeaderBar } from '@/components/header/HeaderBar'
import { Sidebar } from '@/components/sidebar/Sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const immersive = /^/(watch|live)/[^/]+$/.test(pathname)

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

### 4.6 CSS Utility Classes
```css
/* Optional: hide scrollbar utility */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

## 5. Page Heading Cleanup

### 5.1 Removal Process
Search and remove any page-level H1/H2 that prints "Reelverse" under the header:
- Home page
- Live page
- Shorts page
- Watch page
- Finance page
- Other content pages

### 5.2 Example Replacement
Before:
```tsx
<h1 className="text-3xl font-bold">Reelverse</h1>
```

After:
```tsx
{/* no brand title here; header already shows brand */}
<h2 className="text-[20px] font-semibold text-text mb-3">Trending Now</h2>
```

Keep only section headings ("Trending Now", "Recommended", etc.)

## 6. Content Spacing Adjustments

### 6.1 Top-Level Page Containers
Each top-level page container should start with:
```tsx
<div className="mx-auto max-w-[1600px] px-4 py-4">
  {/* content */}
</div>
```

### 6.2 Spacing Considerations
- Because the chip row is sticky under the header, pages should not add extra top margins
- Content should start directly below the chip row without gaps
- Grid and watch layouts should render cleanly with proper alignment

## 7. Icon Replacement (Optional Polish)

Replace emoji icons with @iconify/react or lucide-react for consistent sizing:

```bash
npm i @iconify/react
```

```tsx
import { Icon } from '@iconify/react'
<Icon icon="material-symbols:home-outline" className="text-text-2 text-[20px]" aria-hidden="true" />
```

## 8. Accessibility Features

### 8.1 Keyboard Navigation
- Tab order: Brand → Search → Upload → Sign in
- Focus rings visible on all interactive elements
- Proper ARIA labels for screen readers

### 8.2 Screen Reader Support
- Search form with appropriate labels
- Chip row with tablist role
- Action buttons with descriptive aria-labels

## 9. Testing Requirements

### 9.1 QA Checklist

1. **Header Height**
   - Header height = 56px (use DevTools ruler)
   - Search is centered; right actions vertically centered

2. **Light/Dark Mode**
   - Light mode: header bg #fff, border #e5e5e5
   - Dark mode: bg #0f0f0f, border #303030

3. **Route-Aware Behavior**
   - Chip row is visible on Home/Listing pages
   - Chip row is hidden on /watch/:id and /live/:id
   - No duplicate "Reelverse" headings in content
   - Sidebar hidden on watch/live; visible elsewhere

4. **Keyboard Navigation**
   - "/" focuses search, ESC clears, Enter submits
   - Tab order brand → search → upload → sign in
   - Focus rings visible

### 9.2 Browser Compatibility
- Chrome DevTools ruler to confirm header area = 56px
- Chip row sticks exactly under it
- Responsive behavior on all screen sizes
- iOS safe-area support for notched devices

## 10. Implementation Steps

1. Add CSS variables to theme.css with safe-area support
2. Update HeaderBar component with route-aware chip row implementation
3. Update SearchBar component with keyboard UX enhancements
4. Update ChipRow component (ensure no-scrollbar class is present)
5. Update AppShell component to collapse sidebar on immersive routes
6. Remove duplicate "Reelverse" headings from pages
7. Adjust content spacing in pages
8. Verify theme switching functionality with FOUC prevention
9. Test accessibility features
10. Perform cross-browser testing
11. Test on iOS devices with notches for safe-area support

## 11. FOUC Prevention

To prevent Flash of Unstyled Content (FOUC) on theme switching, add the following script to `index.html` before hydration:

```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'dark') document.documentElement.dataset.theme = 'dark';
    else if (t === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
    }
  })();
</script>
```

## 12. Performance Considerations

- Use CSS variables for theme-aware styling to avoid JavaScript-based theme switching
- Optimize component re-renders with React.memo where appropriate
- Ensure smooth scrolling for chip row on mobile devices
- Maintain 60fps scrolling performance with sticky positioning
- Use efficient regex matching for route detection
