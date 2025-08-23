# Header Theme Fix Design Document

## Overview

This document outlines the design and implementation plan for fixing the header color theme to ensure it uses consistent theme variables and follows a YouTube-style light/dark theme approach. The goal is to make the header white in light mode and dark in dark mode, removing all hard-coded dark backgrounds/gradients from header components.

## Goals

1. Header is white in light mode, dark in dark mode (YouTube style)
2. Remove all hard-coded dark backgrounds/gradients from header, nav tabs, and chip row
3. Ensure header uses theme variables consistently: `var(--header-bg)`, `var(--header-border)`
4. Keep chip row hidden on watch/live routes (unchanged)

## Current State Analysis

### Header Components Structure

The header consists of several components:
1. `HeaderBar.tsx` - Main header container with logo, search bar, and actions
2. `CenterNav.tsx` - Navigation tabs (Videos, Live, Shorts, Explore)
3. `ChipRow.tsx` - Category filter chips below the main header
4. `SearchBar.tsx` - Search input component
5. `HeaderActions.tsx` - Action buttons (Upload, Balance, Theme Toggle, etc.)

### Theme Variables

The project already has proper theme variables defined in `styles/theme.css`:

```css
:root {
  --header-h: 56px;
  --header-bg: #ffffff;
  --header-border: #e5e5e5;
}

:root[data-theme="dark"] {
  --header-h: 56px;
  --header-bg: #0f0f0f;
  --header-border: #303030;
}
```

### Issues Identified

1. `CenterNav.tsx` contains hard-coded dark classes:
   - `bg-slate-950/80`
   - `backdrop-blur`
   - `supports-[backdrop-filter]:bg-slate-950/60`
   - `bg-slate-900/80`
   - `border-slate-800`

2. The mobile version of `CenterNav` also uses dark backgrounds that should be removed:
   - `bg-slate-900/80`
   - `backdrop-blur-sm`
   - `border-slate-800`

3. CenterNav has `sticky top-0` which may overlay the header

4. Other header components may contain dark classes that need to be removed:
   - Search for `bg-slate-9`, `bg-black`, `bg-neutral-9`, `bg-gradient`, `from-`, `to-`, `backdrop-blur`

5. No FOUC issues identified - the theme initialization in `index.html` is correctly implemented.

## Design Solution

### 1. HeaderBar Component Updates

The `HeaderBar.tsx` component already uses theme variables correctly:
- `background: 'var(--header-bg)'` for the header background
- `borderColor: 'var(--header-border)'` for the bottom border

No changes needed for this component.

### 2. CenterNav Component Updates

The `CenterNav.tsx` component requires significant changes to remove dark backgrounds:

#### Desktop Version
Current classes:
```tsx
className={`sticky top-0 z-40 hidden md:flex w-full bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 ${align === 'left' ? 'justify-start' : 'justify-center'} ${className}`}
```

Updated classes (recommended approach - move inside HeaderBar):
```tsx
className={`sticky top-0 z-40 hidden md:flex w-full ${align === 'left' ? 'justify-start' : 'justify-center'} ${className}`}
```

Alternative approach (if CenterNav remains separate):
```tsx
className={`sticky z-40 hidden md:flex w-full ${align === 'left' ? 'justify-start' : 'justify-center'} ${className}`}
```
With style: `top: 'var(--header-h)', background: 'transparent'`

Current container div classes:
```tsx
<div className="my-2 ml-4 md:ml-6 rounded-full border border-slate-800 bg-slate-900/80 px-1 shadow-sm">
```

Updated container div:
```tsx
<div className="my-2 ml-4 md:ml-6 rounded-full border px-1 shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--header-bg)' }}>
```

#### Mobile Version
Current classes:
```tsx
<div className="inline-flex items-center rounded-full bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-1">
```

Updated classes:
```tsx
<div className="inline-flex items-center rounded-full border p-1" style={{ borderColor: 'var(--header-border)', background: 'var(--header-bg)' }}>
```

### 3. ChipRow Component Updates

The `ChipRow.tsx` component already uses theme variables correctly:
- `background: 'var(--header-bg)'`
- `borderBottom: '1px solid var(--header-border)'`

No changes needed for this component.

### 4. SearchBar Component Updates

The `SearchBar.tsx` component already uses theme variables correctly:
- `background: 'var(--surface)'`
- `borderColor: 'var(--border)'`

No changes needed for this component.

### 5. Theme FOUC Prevention

The `index.html` already has a script to prevent FOUC:
```js
(function() {
  var t = localStorage.getItem('theme');
  if (t === 'dark') document.documentElement.dataset.theme = 'dark';
  else if (t === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
```

This ensures the correct theme is applied on initial page load. No changes needed to this implementation.

## Implementation Plan

### Task 1: Update CenterNav Component

1. Fix positioning to prevent overlaying the header:
   - If CenterNav is separate from HeaderBar, set `top: 'var(--header-h)'` and `background: 'transparent'`
   - Recommended: Move CenterNav inside HeaderBar for better structure

2. Remove hard-coded dark background classes from the main nav element:
   - Remove `bg-slate-950/80`
   - Remove `backdrop-blur`
   - Remove `supports-[backdrop-filter]:bg-slate-950/60`

3. Replace hard-coded dark backgrounds with theme variables in the container div:
   - Replace `bg-slate-900/80` with `background: 'var(--header-bg)'`
   - Replace `border-slate-800` with `borderColor: 'var(--header-border)'`

4. Update both desktop and mobile versions with consistent theme variable usage

### Task 2: Remove All Dark Classes Across Header Components

1. Search for all dark/gradient classes across header components:
   - `bg-slate-9`, `bg-black`, `bg-neutral-9`, `bg-gradient`, `from-`, `to-`, `backdrop-blur`
2. Replace with transparent or theme variables:
   - `background: 'transparent'` for containers that should inherit header background
   - `background: 'var(--header-bg)'` for containers that need explicit header background
   - `borderColor: 'var(--header-border)'` for borders

### Task 3: Add Header Override Utility

1. Add a temporary override utility to ensure header stays white in light mode:
   ```css
   .header-force {
     background: var(--header-bg) !important;
     border-bottom: 1px solid var(--header-border) !important;
     box-shadow: none !important;
   }
   ```
2. Apply to HeaderBar component:
   ```tsx
   <header className="sticky top-0 z-50 header-force">...</header>
   ```

### Task 4: Add Dark Mode Shadow

1. Add subtle shadow for dark mode:
   ```css
   .header-shadow-dark { 
     box-shadow: 0 1px 2px rgba(0,0,0,.3) 
   }
   ```
2. Toggle this class when `data-theme="dark"`

### Task 5: Verify SearchBar Container

1. Ensure SearchBar container uses correct theme variables:
   - `height: 40px`
   - `background: var(--surface)`
   - `borderColor: var(--border)`

### Task 6: QA Testing

1. Set theme to light mode and verify header is white (#ffffff) with light border (#e5e5e5)
2. Toggle to dark mode and verify header becomes dark (#0f0f0f) with dark border (#303030)
3. Check that no dark gradients remain in the header region
4. Verify chip row is hidden on watch/live routes
5. Confirm search bar uses `var(--surface)` and looks appropriate in both themes
6. Inspect with DevTools to ensure no child inside header has dark classes or backdrop-blur

## Component Architecture Changes

### CenterNav Component Structure

The CenterNav component will be updated to remove all hard-coded dark background classes and use theme variables instead. The positioning will also be fixed to prevent it from overlaying the header.

**Before:**
```tsx
<nav 
  className={`sticky top-0 z-40 hidden md:flex w-full bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 ${align === 'left' ? 'justify-start' : 'justify-center'} ${className}`}
  aria-label="Primary navigation"
>
```

**After (recommended approach - move inside HeaderBar):**
```tsx
<nav 
  className={`sticky top-0 z-40 hidden md:flex w-full ${align === 'left' ? 'justify-start' : 'justify-center'} ${className}`}
  aria-label="Primary navigation"
>
```

**Alternative approach (if CenterNav remains separate):**
```tsx
<nav 
  className={`sticky z-40 hidden md:flex w-full ${align === 'left' ? 'justify-start' : 'justify-center'} ${className}`}
  aria-label="Primary navigation"
  style={{ top: 'var(--header-h)', background: 'transparent' }}
>
```

## CSS Variables Usage

All header components will consistently use these CSS variables:

| Variable | Light Mode | Dark Mode |
|----------|------------|-----------|
| `--header-bg` | `#ffffff` | `#0f0f0f` |
| `--header-border` | `#e5e5e5` | `#303030` |
| `--surface` | `#ffffff` | `#181818` |
| `--border` | `#e5e5e5` | `#303030` |

These variables are defined in `styles/theme.css` and provide a consistent theme experience across all header components.

Additional override utility for guaranteed white header in light mode:
```css
.header-force {
  background: var(--header-bg) !important;
  border-bottom: 1px solid var(--header-border) !important;
  box-shadow: none !important;
}

.header-shadow-dark { 
  box-shadow: 0 1px 2px rgba(0,0,0,.3) 
}
```

## Testing Strategy

### Visual Testing
1. Light mode verification:
   - Header background: white (#ffffff)
   - Header border: light gray (#e5e5e5)
   - No dark gradients or backgrounds

2. Dark mode verification:
   - Header background: dark (#0f0f0f)
   - Header border: dark gray (#303030)
   - Consistent styling with YouTube dark mode

### Functional Testing
1. Theme switching:
   - Verify seamless transition between light and dark modes
   - Confirm no visual artifacts during theme changes

2. Responsive behavior:
   - Check desktop and mobile header rendering
   - Verify chip row visibility logic on watch/live routes

### Code Quality Testing
1. grep searches to verify removal of dark classes:
   ```bash
   grep -R "bg-slate-9" src/components/header
   grep -R "bg-black" src/components/header
   grep -R "gradient" src/components/header
   ```

2. Browser Developer Tools verification:
   - Inspect header elements to confirm background is set to `var(--header-bg)`
   - Verify no hardcoded dark backgrounds remain
   - Check that all elements properly inherit theme colors
   - Confirm computed style is #ffffff in light mode with no dark overlays

### Sanity Checklist
1. Set theme to light → header bg computed style is #ffffff; no dark gradient layers above it
2. Toggle to dark → header bg is #0f0f0f; border #303030
3. Inspect with DevTools: no child inside header has bg-* dark classes or backdrop-blur
4. Chip row inherits the header bg and is not shown on /watch/:id or /live/:id
5. No duplicate "Reelverse" H1 under the header on any page

## Definition of Done

- [ ] Header is white in light mode on all pages
- [ ] Header is dark in dark mode on all pages
- [ ] No dark gradient bars remain in the header region
- [ ] Search bar uses `var(--surface)` and looks appropriate in both themes
- [ ] No duplicate brand "Reelverse" under the header
- [ ] Chip row remains hidden on watch/live routes
- [ ] All hard-coded dark backgrounds/gradients removed from header components
- [ ] Theme variables used consistently across all header elements
- [ ] No FOUC issues with theme initialization
- [ ] All QA steps pass successfully
- [ ] No hardcoded dark classes found in header components
- [ ] All header elements properly inherit theme colors
- [ ] Desktop and mobile headers render consistently
- [ ] CenterNav positioning fixed to prevent overlaying header
- [ ] Header override utility added for guaranteed white header in light mode
- [ ] Dark mode shadow added for better visual separation
- [ ] All sanity checklist items verified