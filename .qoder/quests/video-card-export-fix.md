# VideoCard Export Fix Design Document

## Overview

This document explains the import/export error occurring with the VideoCard component and provides a solution to fix it. The error message is:

```
Uncaught SyntaxError: The requested module '/components/video/VideoCard.tsx' does not provide an export named 'VideoCard' (at HomePage.tsx:6:10)
```

## Problem Analysis

### Current State

1. In `components/video/VideoCard.tsx`:
   - The main component is exported as `default`:
     ```tsx
     export default function VideoCard(props: VideoCardProps) { ... }
     ```
   - Additional variants are exported as named exports:
     ```tsx
     export function VideoCardGrid(props: VideoCardProps) { ... }
     export function VideoCardCompact(props: VideoCardProps) { ... }
     ```

2. In `pages/HomePage.tsx`, the component is imported as a named export:
   ```tsx
   import { VideoCard, VideoCardSkeleton, VideoGridSkeleton } from '../components/video/VideoCard';
   ```

### Root Cause

The error occurs because `VideoCard` is exported as a **default export**, but it's being imported as a **named export**. In ES6 modules:

- Default exports are imported without curly braces: `import VideoCard from './VideoCard'`
- Named exports are imported with curly braces: `import { VideoCard } from './VideoCard'`

Since `VideoCard` is a default export, importing it as a named export causes the module system to look for a named export called `VideoCard` which doesn't exist.

## Solution Design

### Option 1: Change Import Statement (Recommended)

Modify the import statement in `HomePage.tsx` to use default import syntax:

```tsx
// Current (incorrect)
import { VideoCard, VideoCardSkeleton, VideoGridSkeleton } from '../components/video/VideoCard';

// Fixed
import VideoCard, { VideoCardSkeleton, VideoGridSkeleton } from '../components/video/VideoCard';
```

### Option 2: Change Export Statement

Modify the export statement in `VideoCard.tsx` to use named export instead of default export:

```tsx
// Current (default export)
export default function VideoCard(props: VideoCardProps) { ... }

// Fixed (named export)
export function VideoCard(props: VideoCardProps) { ... }
```

### Recommendation

**Option 1 is recommended** because:
1. It requires minimal changes
2. It maintains consistency with React's common pattern of default-exporting main components
3. It doesn't affect other parts of the codebase that might be correctly importing VideoCard as a default export

## Implementation Plan

1. Modify the import statement in `pages/HomePage.tsx` on line 5:
   - Change from: `import { VideoCard, VideoCardSkeleton, VideoGridSkeleton } from '../components/video/VideoCard';`
   - Change to: `import VideoCard, { VideoCardSkeleton, VideoGridSkeleton } from '../components/video/VideoCard';`

2. Verify that no other files have the same incorrect import pattern
3. Test the application to ensure the error is resolved

## Verification

After implementing the fix:
1. The import/export error should be resolved
2. The HomePage should render correctly with VideoCard components
3. No other functionality should be affected

## Related Components

- `VideoCardGrid` and `VideoCardCompact` are correctly exported as named exports and imported where used
- The `VideoCardSkeleton` and `VideoGridSkeleton` are imported correctly as named exports from the same file