# Header Theme Fix Design Document

## 1. Overview

This design document outlines the changes needed to fix header color and Sign in button visibility issues in the Reelverse decentralized content platform. The primary goals are to ensure the header uses proper theme variables, remove any dark/gradient wrappers, and make the Sign in button clearly visible in both light and dark modes.

### Objectives

- Force header to use theme variables (white in light mode, dark in dark mode)
- Remove any lingering dark/gradient wrappers in header or center tabs
- Make Sign in button an explicit, visible CTA in both light and dark modes
- Ensure z-index and overlay issues don't hide the Sign in button
- Add proper CTA variables and icon color tokens to the theme CSS
- Implement reusable CTA classes instead of inline styles
- Remove inline hover JS that can cause hydration/SSR mismatches
- Ensure proper z-index stacking for header elements
- Make a reusable CTA class (instead of inline styles) for consistency across Upload, Sign in, and future CTAs

## 2. Current State Analysis

### HeaderBar Component
The current `HeaderBar.tsx` component uses theme variables but has some inconsistencies:
- Uses `header-force` class with inline styles for background and border
- Contains a wrapper div with border-b class that might conflict with theme variables

### HeaderActions Component
The `HeaderActions.tsx` component currently:
- Uses inline styles for Sign in button with JavaScript-based hover effects
- Doesn't implement reusable CTA classes
- Uses inline hover JS that can cause hydration/SSR mismatches

### CenterNav Component
The `CenterNav.tsx` component:
- Uses theme variables for background and border
- Appears to be correctly implemented without dark wrappers

### SearchBar Component
The `SearchBar.tsx` component:
- Correctly uses theme variables for background and border
- Icons may not be using proper header icon color tokens

### Theme CSS
The `theme.css` file:
- Contains header variables but lacks dedicated CTA variables and icon color tokens
- Has proper light/dark mode definitions for header styling
- Missing reusable CTA classes for consistent styling

## 3. Proposed Changes

### 3.1 Add CTA Variables and Icon Color Tokens to Theme CSS

Add new CTA-specific CSS variables and icon color tokens to `styles/theme.css`:

```css
/* styles/theme.css */
:root {
  --cta-blue: #2563eb;
  --cta-blue-hover: #1e40af;
  --cta-text: #ffffff;
  --header-icon: #606060; /* icon color in header (light) */
  --header-icon-hover: #0f0f0f;
}

:root[data-theme="dark"] {
  --cta-blue: #2563eb;
  --cta-blue-hover: #1e3a8a;
  --cta-text: #ffffff;
  --header-icon: #aaaaaa; /* icon color in header (dark) */
  --header-icon-hover: #f1f1f1;
}

/* Reusable CTA classes */
.btn-cta {
  height: 36px;
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--cta-text);
  background: var(--cta-blue);
  box-shadow: 0 1px 2px rgba(0,0,0,.08);
}

.btn-cta:hover { 
  background: var(--cta-blue-hover); 
}

.btn-cta:focus-visible { 
  outline: 2px solid #3b82f6; 
  outline-offset: 2px; 
}

/* Upload violet variant (optional) */
.btn-upload {
  height: 36px;
  display: inline-flex; 
  align-items:center;
  border-radius: 9999px; 
  padding: 0 16px;
  font-size: 14px; 
  font-weight:500;
  color: #fff; 
  background: var(--brand);
}

.btn-upload:hover { 
  filter: brightness(1.1); 
}

/* Header stacking helpers */
.header-z { 
  z-index: 50; 
}
.chips-z { 
  z-index: 40; 
}
```

### 3.2 Update HeaderBar Component

Modify `components/header/HeaderBar.tsx` to apply z-index classes and remove any legacy "header-force" fallback:

```tsx
export function HeaderBar() {
  const { pathname } = useLocation()
  const immersive = /^\/(watch|live)\/[^\/]+$/.test(pathname)

  return (
    <header className="sticky top-0 header-z">
      <div
        className="w-full"
        style={{
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
          height: 'var(--header-h)',
        }}
      >
        <div className="mx-auto max-w-[1600px] h-full flex items-center gap-4 px-4">
          <a href="/" className="text-[20px] font-semibold tracking-tight text-text">Reelverse</a>
          <div className="mx-auto w-full max-w-[720px]"><SearchBar /></div>
          <div className="ml-auto"><HeaderActions /></div>
        </div>
      </div>
      {!immersive && <div className="chips-z"><ChipRow /></div>}
    </header>
  )
}
```

### 3.3 Update HeaderActions Component

Modify `components/header/HeaderActions.tsx` to use reusable CTA classes and remove inline hover JS:

```tsx
export function HeaderActions() {
  const { user } = useAuth()
  
  return (
    <div className="relative z-10 flex items-center gap-3">
      <Link to="/upload" className="btn-upload">+ Upload</Link>
      
      {!user ? (
        <Link to="/signin" className="btn-cta" aria-label="Sign in to Reelverse">
          Sign in
        </Link>
      ) : (
        <Link 
          to="/profile" 
          className="inline-flex h-9 items-center rounded-full bg-chip px-3 text-sm text-text border border-border hover:bg-hover" 
          aria-label="Profile"
        >
          Profile
        </Link>
      )}
    </div>
  )
}
```

### 3.4 Clean Up CenterNav and Other Header Components

Ensure `components/header/CenterNav.tsx` and other header components have no dark wrappers:

- Remove any classes: `bg-slate-950/80`, `bg-black`, `backdrop-blur`, `bg-gradient-to-*`, `border-slate-800`
- Ensure transparent background and proper theme variable usage
- Check all header dropdowns/menus for similar issues

Remove dark/gradient/blur classes from header globally by running:
```bash
grep -R "bg-slate-9|bg-black|bg-neutral-9|gradient|backdrop-blur" src/components/header
```
In CenterNav and any header dropdowns/menus, ensure wrapper backgrounds are either transparent or use `style={{ background:'var(--header-bg)' }}`. Borders should use `var(--header-border)`.

### 3.5 Update SearchBar Component

Update `components/header/SearchBar.tsx` to ensure it is light and icons use currentColor:

```
// components/header/SearchBar.tsx
<div 
  className="flex items-center gap-2 rounded-full border px-4" 
  style={{ 
    height: '40px', 
    background: 'var(--surface)', 
    borderColor: 'var(--border)' 
  }}
>
  <input ... className="w-full bg-transparent outline-none text-[14px] placeholder:text-text-3" />
  <button 
    aria-label="Search" 
    className="text-[18px]" 
    style={{ color: 'var(--header-icon)' }}
  >
    {/* Use an icon component; ensure it inherits currentColor */}
    
  </button>
</div>
```

### 3.6 Verify FOUC Guard in index.html

Ensure the existing script in `index.html` that sets data-theme before app mounts is preserved to ensure header appears white in light mode on first paint:

```html
<!-- index.html -->
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'dark') document.documentElement.dataset.theme = 'dark';
    else if (t === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
    } else {
      document.documentElement.dataset.theme = ''
    }
  })();
</script>
```

Keep FOUC guard (already good). Ensure `index.html` sets `data-theme` before hydration so header appears white in light mode on first paint.

## 4. Implementation Steps

### Step 1: Update Theme CSS
1. Add CTA variables and icon color tokens to `styles/theme.css`
2. Add reusable CTA classes and header stacking helpers
3. Verify header variables are properly defined

### Step 2: Update HeaderBar Component
1. Apply z-index classes (`header-z`, `chips-z`)
2. Ensure consistent use of theme variables
3. Remove any legacy "header-force" fallback class once verified

### Step 3: Update HeaderActions Component
1. Replace inline styles with reusable CTA classes (`btn-cta`, `btn-upload`)
2. Remove inline hover JS that can cause hydration/SSR mismatches
3. Ensure proper z-index stacking

### Step 4: Clean Up All Header Components
1. Remove any dark/gradient/blur classes globally in header using grep command
2. Ensure transparent backgrounds or proper theme variable usage
3. Check all header dropdowns/menus for similar issues

### Step 5: Update SearchBar Component
1. Ensure proper use of theme variables
2. Update icons to use currentColor with header icon tokens

### Step 6: Verify FOUC Guard
1. Ensure the script in `index.html` is preserved
2. Test that header renders correctly in light mode immediately
3. Keep legacy "header-force" class commented for 1-2 days as fallback

## 5. QA Checklist

### Light Mode Verification
- [ ] Header background is #ffffff
- [ ] Header bottom border is #e5e5e5
- [ ] Sign in button is blue (#2563eb) and readable
- [ ] Upload button is violet and visible
- [ ] Icons are legible
- [ ] No dark gradient overlays above the actions area

### Dark Mode Verification
- [ ] Header background is #0f0f0f
- [ ] Header border is #303030
- [ ] Sign in button is blue (#2563eb) and readable
- [ ] Upload button is violet and visible
- [ ] Icons are legible
- [ ] No dark gradient overlays above the actions area

### General Verification
- [ ] Chip row is hidden on /watch and /live routes
- [ ] Header maintains consistent height (56px)
- [ ] Sign in button is clearly visible and accessible
- [ ] No z-index issues hiding elements
- [ ] Theme switching works properly
- [ ] No hydration/SSR mismatches from inline hover JS
- [ ] Reusable CTA classes work consistently
- [ ] Header icon colors adapt to theme
- [ ] Legacy "header-force" class can be removed after verification
- [ ] Verify z-index: dropdowns/menus appear above header (use z-60+ for menus)
- [ ] Optional: disable any legacy "header-force" class after confirming everything reads from vars

## 6. Testing Strategy

### Unit Testing
- Test HeaderBar component renders with correct theme variables
- Test HeaderActions component shows proper Sign in button styling
- Test theme switching functionality
- Test reusable CTA classes render correctly

### Integration Testing
- Verify header appearance in both light and dark modes
- Check that Sign in button is visible and clickable
- Confirm chip row behavior on immersive routes
- Verify z-index stacking works correctly for dropdowns/menus

### Visual Regression Testing
- Compare screenshots before and after changes
- Verify consistent appearance across different screen sizes
- Check that no visual artifacts are introduced
- Verify CTA buttons maintain consistent styling across different components

### SSR/Hydration Testing
- Test that no hydration mismatches occur due to removal of inline hover JS
- Verify FOUC guard works correctly
- Confirm header renders correctly on first paint

## 7. Rollback Plan

If issues are discovered after deployment:
1. Revert changes to HeaderBar component
2. Revert changes to HeaderActions component
3. Revert changes to theme CSS
4. Re-add legacy "header-force" class if needed as fallback
5. Monitor application for any remaining display issues