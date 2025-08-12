import React, { useEffect, useRef } from 'react';

interface MobileGesturesProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onPullToRefresh?: () => void;
    onLongPress?: () => void;
    className?: string;
}

export const MobileGestures: React.FC<MobileGesturesProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPullToRefresh,
    onLongPress,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pullToRefreshRef = useRef<{ startY: number; isRefreshing: boolean }>({ startY: 0, isRefreshing: false });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            touchStartRef.current = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now()
            };

            // Start long press timer
            if (onLongPress) {
                longPressTimerRef.current = setTimeout(() => {
                    onLongPress();
                    // Haptic feedback
                    if ('vibrate' in navigator) {
                        navigator.vibrate(100);
                    }
                }, 500);
            }

            // Pull to refresh setup
            if (onPullToRefresh && container.scrollTop === 0) {
                pullToRefreshRef.current.startY = touch.clientY;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            // Cancel long press on move
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }

            // Handle pull to refresh
            if (onPullToRefresh && container.scrollTop === 0 && !pullToRefreshRef.current.isRefreshing) {
                const touch = e.touches[0];
                const pullDistance = touch.clientY - pullToRefreshRef.current.startY;
                
                if (pullDistance > 100) {
                    pullToRefreshRef.current.isRefreshing = true;
                    onPullToRefresh();
                    // Haptic feedback
                    if ('vibrate' in navigator) {
                        navigator.vibrate(50);
                    }
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            // Clear long press timer
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }

            // Reset pull to refresh
            pullToRefreshRef.current.isRefreshing = false;

            if (!touchStartRef.current) return;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartRef.current.x;
            const deltaY = touch.clientY - touchStartRef.current.y;
            const deltaTime = Date.now() - touchStartRef.current.time;

            // Only process swipes that are fast enough and long enough
            if (deltaTime > 300 || (Math.abs(deltaX) < 50 && Math.abs(deltaY) < 50)) {
                touchStartRef.current = null;
                return;
            }

            // Determine swipe direction
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (deltaX > 0 && onSwipeRight) {
                    onSwipeRight();
                    // Haptic feedback
                    if ('vibrate' in navigator) {
                        navigator.vibrate(50);
                    }
                } else if (deltaX < 0 && onSwipeLeft) {
                    onSwipeLeft();
                    // Haptic feedback
                    if ('vibrate' in navigator) {
                        navigator.vibrate(50);
                    }
                }
            } else {
                // Vertical swipe
                if (deltaY > 0 && onSwipeDown) {
                    onSwipeDown();
                    // Haptic feedback
                    if ('vibrate' in navigator) {
                        navigator.vibrate(50);
                    }
                } else if (deltaY < 0 && onSwipeUp) {
                    onSwipeUp();
                    // Haptic feedback
                    if ('vibrate' in navigator) {
                        navigator.vibrate(50);
                    }
                }
            }

            touchStartRef.current = null;
        };

        // Add event listeners with passive option for better performance
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
        };
    }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onPullToRefresh, onLongPress]);

    return (
        <div ref={containerRef} className={className}>
            {children}
        </div>
    );
};