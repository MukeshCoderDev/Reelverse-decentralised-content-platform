# YouTube-style Watch Page Components

This directory contains all the components for the YouTube-style watch page implementation.

## Components

### Core Components

- **[PlayerShell.tsx](PlayerShell.tsx)** - Main video player with HLS support, keyboard shortcuts, autoplay countdown, and mini-player
- **[TitleRow.tsx](TitleRow.tsx)** - Video title and channel information with subscribe button
- **[ActionsBar.tsx](ActionsBar.tsx)** - Engagement actions (Like, Dislike, Share, Save, Tip)
- **[DescriptionBox.tsx](DescriptionBox.tsx)** - Collapsible video description
- **[UpNextRail.tsx](UpNextRail.tsx)** - Right rail with filter chips and up next videos
- **[UpNextItem.tsx](UpNextItem.tsx)** - Individual up next video item
- **[Comments.tsx](Comments.tsx)** - Comments section stub

### Skeletons

- **[SkeletonVideo.tsx](SkeletonVideo.tsx)** - Loading skeleton for video player
- **[SkeletonListItem.tsx](SkeletonListItem.tsx)** - Loading skeleton for up next items

## Hooks

- **[usePlayerShortcuts.ts](../../hooks/usePlayerShortcuts.ts)** - Keyboard shortcuts for video player
- **[useHlsPlayer.ts](../../hooks/useHlsPlayer.ts)** - Enhanced HLS player with all features (enhanced version)

## Utilities

- **[time.ts](../../utils/time.ts)** - Time parsing and formatting functions
- **[share.ts](../../utils/share.ts)** - Share URL generation functions

## Features Implemented

1. **Autoplay Next** - Countdown overlay with cancel option
2. **Mini-player** - Docked player when scrolling out of view
3. **Watch Progress Resume** - Prompt to resume from last position
4. **Preload Next Video** - Prefetch at 75% progress
5. **Keyboard Shortcuts** - Comprehensive shortcut system
6. **SEO Meta Tags** - Dynamic meta tag updates
7. **Error Handling** - Graceful error recovery
8. **Accessibility** - Proper ARIA labels and focus management
9. **Analytics** - Throttled event tracking
10. **Optimistic Updates** - Immediate UI feedback for actions

## Usage

The components are designed to work together in the [WatchPage.tsx](../../pages/WatchPage.tsx) page component, but can also be used independently if needed.