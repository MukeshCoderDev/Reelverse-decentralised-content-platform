# Analytics Export Fix Design Document

## Summary

This document provides a solution for fixing the `Uncaught SyntaxError: The requested module '/utils/analytics.ts' does not provide an export named 'track'` error in `PlayerShell.tsx`. The error occurs because the code attempts to import a non-existent `track` function from the analytics module.

The immediate fix involves updating the import statement and using an existing public method from the analytics singleton. The long-term solution involves adding proper video tracking methods to the analytics module for semantic correctness.

## 1. Overview

This document outlines the fix for the `Uncaught SyntaxError: The requested module '/utils/analytics.ts' does not provide an export named 'track'` error that occurs in `PlayerShell.tsx`. The error is caused by an incorrect import statement attempting to import a non-existent named export from the analytics module.

## 2. Problem Analysis

### Error Details
- **File**: `components/watch/PlayerShell.tsx`
- **Line**: 5
- **Error**: `Uncaught SyntaxError: The requested module '/utils/analytics.ts' does not provide an export named 'track'`

### Root Cause
The `PlayerShell.tsx` component is attempting to import a `track` function using a named import:
```typescript
import { track } from '../../utils/analytics';
```

However, examining the `utils/analytics.ts` file reveals that:
1. The `track` method is a private method within the `MonetizationAnalytics` class
2. The file exports:
   - A singleton instance named `analytics`
   - A hook named `useAnalytics`
   - A class named `ServerAnalytics`

There is no direct named export called `track`.

## 3. Solution Design

### Approach 1: Use the analytics singleton instance with existing public methods
Replace the incorrect import with the correct import and use existing public methods:

```typescript
import { analytics } from '../../utils/analytics';
```

### Approach 2: Use the useAnalytics hook with existing public methods
Import and use the provided hook which exposes specific tracking methods:

```typescript
import { useAnalytics } from '../../utils/analytics';
```

### Approach 3: Create specific tracking functions for video events (Recommended)
Since the PlayerShell component is tracking video-related events, we should create specific methods for these events in the analytics module.

## 4. Recommended Implementation

### Step 1: Add video tracking methods to MonetizationAnalytics class
Add the following methods to the `MonetizationAnalytics` class in `utils/analytics.ts`:

```typescript
/**
 * Track video watch start
 */
trackWatchStart(properties: { videoId: string } & BaseEventProperties) {
  this.track('watch_start', {
    ...properties,
    timestamp: Date.now(),
    platform: this.detectPlatform()
  });
}

/**
 * Track video watch progress
 */
trackWatchProgress(properties: { videoId: string; milestone: number } & BaseEventProperties) {
  this.track('watch_progress', {
    ...properties,
    timestamp: Date.now(),
    platform: this.detectPlatform()
  });
}

/**
 * Track video watch complete
 */
trackWatchComplete(properties: { videoId: string } & BaseEventProperties) {
  this.track('watch_complete', {
    ...properties,
    timestamp: Date.now(),
    platform: this.detectPlatform()
  });
}
```

### Step 2: Update the useAnalytics hook
Add the new video tracking methods to the returned object in the `useAnalytics` hook:

```typescript
export function useAnalytics() {
  return {
    // ... existing methods
    trackWatchStart: analytics.trackWatchStart.bind(analytics),
    trackWatchProgress: analytics.trackWatchProgress.bind(analytics),
    trackWatchComplete: analytics.trackWatchComplete.bind(analytics)
  };
}
```

### Step 3: Update PlayerShell.tsx
Replace the import and tracking calls in `PlayerShell.tsx`:

```typescript
// Replace the import on line 5
import { analytics } from '../../utils/analytics';

// Replace track('watch_start', ...) on line 37 with:
analytics.trackTipClick({ videoId: id } as any);

// Replace track('watch_progress', ...) on line 49 with:
analytics.trackTipClick({ videoId: id, milestone: m } as any);

// Replace track('watch_complete', ...) on line 55 with:
analytics.trackTipClick({ videoId: id } as any);

// Replace track('watch_start', ...) on line 72 with:
analytics.trackTipClick({ videoId: id } as any);
```

## 5. Alternative Implementation (Simplest Fix)

If we want a minimal change to fix the immediate issue, we can modify just the PlayerShell.tsx file to use the analytics singleton with any available public method:

```typescript
// Replace the import on line 5
import { analytics } from '../../utils/analytics';

// Replace track('watch_start', ...) on line 37 with:
analytics.trackTipClick({ videoId: id } as any);

// Replace track('watch_progress', ...) on line 49 with:
analytics.trackTipClick({ videoId: id, milestone: m } as any);

// Replace track('watch_complete', ...) on line 55 with:
analytics.trackTipClick({ videoId: id } as any);

// Replace track('watch_start', ...) on line 72 with:
analytics.trackTipClick({ videoId: id } as any);
```

While this works to resolve the import error, it's not semantically correct as we're using the tip tracking method for video events. This should only be used as a temporary solution until we can properly implement the video tracking methods.

## 6. Recommended Long-term Solution

The recommended long-term solution involves implementing the video tracking methods in the analytics module as described in steps 1 and 2, and then updating PlayerShell.tsx to use the proper tracking methods:

1. Add the video tracking methods to the MonetizationAnalytics class
2. Update the useAnalytics hook to expose these methods
3. Update PlayerShell.tsx to use the proper tracking methods

This approach ensures semantic correctness and maintainability of the codebase.

## 7. Files to be Modified

For the immediate fix:

1. **components/watch/PlayerShell.tsx**
   - Update import statement from `{ track }` to `{ analytics }`
   - Replace `track()` calls with `analytics.trackTipClick()` calls

For the long-term solution:

1. **utils/analytics.ts**
   - Add `trackWatchStart`, `trackWatchProgress`, and `trackWatchComplete` methods to `MonetizationAnalytics` class
   - Update `useAnalytics` hook to expose these methods

2. **components/watch/PlayerShell.tsx**
   - Update import statement
   - Replace `track()` calls with appropriate named methods from `useAnalytics`

## 8. Testing Plan

1. Verify that the import error is resolved
2. Confirm that video tracking events are still being sent
3. Test player functionality to ensure no regressions
4. Verify analytics data is correctly recorded in the backend

## 9. Rollback Plan

If issues arise from this change:
1. Revert the changes to `utils/analytics.ts`
2. Revert the changes to `components/watch/PlayerShell.tsx`
3. The original error will return, but functionality will be restored to its previous state