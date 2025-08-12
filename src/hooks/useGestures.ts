import { useEffect, useRef, useState, useCallback } from 'react';

interface GestureState {
  isSwipeActive: boolean;
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null;
  swipeDistance: number;
  isPinching: boolean;
  pinchScale: number;
  isLongPress: boolean;
  isPulling: boolean;
  pullDistance: number;
}

interface GestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinchStart?: () => void;
  onPinchMove?: (scale: number) => void;
  onPinchEnd?: (scale: number) => void;
  onLongPress?: () => void;
  onPullToRefresh?: () => void;
  onDoubleTap?: () => void;
}

interface GestureOptions {
  swipeThreshold?: number;
  longPressDelay?: number;
  pullThreshold?: number;
  pinchThreshold?: number;
  doubleTapDelay?: number;
}

export const useGestures = (
  handlers: GestureHandlers,
  options: GestureOptions = {}
) => {
  const {
    swipeThreshold = 50,
    longPressDelay = 500,
    pullThreshold = 100,
    pinchThreshold = 0.1,
    doubleTapDelay = 300
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const [gestureState, setGestureState] = useState<GestureState>({
    isSwipeActive: false,
    swipeDirection: null,
    swipeDistance: 0,
    isPinching: false,
    pinchScale: 1,
    isLongPress: false,
    isPulling: false,
    pullDistance: 0
  });

  // Touch tracking
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchCurrent = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTap = useRef<number>(0);
  const initialPinchDistance = useRef<number>(0);
  const currentPinchDistance = useRef<number>(0);

  // Utility functions
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getSwipeDirection = (startX: number, startY: number, endX: number, endY: number): 'left' | 'right' | 'up' | 'down' | null => {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (Math.max(absDeltaX, absDeltaY) < swipeThreshold) {
      return null;
    }

    if (absDeltaX > absDeltaY) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  };

  // Touch event handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();

    // Handle double tap
    if (now - lastTap.current < doubleTapDelay) {
      handlers.onDoubleTap?.();
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;

    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now
    };
    touchCurrent.current = {
      x: touch.clientX,
      y: touch.clientY
    };

    // Handle pinch start
    if (e.touches.length === 2) {
      initialPinchDistance.current = getDistance(e.touches[0], e.touches[1]);
      currentPinchDistance.current = initialPinchDistance.current;
      setGestureState(prev => ({ ...prev, isPinching: true }));
      handlers.onPinchStart?.();
    } else {
      // Start long press timer
      longPressTimer.current = setTimeout(() => {
        setGestureState(prev => ({ ...prev, isLongPress: true }));
        handlers.onLongPress?.();
        
        // Add haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, longPressDelay);
    }
  }, [handlers, doubleTapDelay, longPressDelay]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.touches[0];
    touchCurrent.current = {
      x: touch.clientX,
      y: touch.clientY
    };

    // Handle pinch
    if (e.touches.length === 2 && gestureState.isPinching) {
      currentPinchDistance.current = getDistance(e.touches[0], e.touches[1]);
      const scale = currentPinchDistance.current / initialPinchDistance.current;
      
      setGestureState(prev => ({ ...prev, pinchScale: scale }));
      handlers.onPinchMove?.(scale);
      return;
    }

    // Clear long press if moving
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Handle pull to refresh (only if at top of page and pulling down)
    if (deltaY > 0 && window.scrollY === 0) {
      setGestureState(prev => ({
        ...prev,
        isPulling: true,
        pullDistance: deltaY
      }));
    }

    // Handle swipe
    const direction = getSwipeDirection(
      touchStart.current.x,
      touchStart.current.y,
      touch.clientX,
      touch.clientY
    );

    if (direction && distance > swipeThreshold) {
      setGestureState(prev => ({
        ...prev,
        isSwipeActive: true,
        swipeDirection: direction,
        swipeDistance: distance
      }));
    }
  }, [gestureState.isPinching, handlers, swipeThreshold]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart.current || !touchCurrent.current) return;

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Handle pinch end
    if (gestureState.isPinching) {
      handlers.onPinchEnd?.(gestureState.pinchScale);
      setGestureState(prev => ({
        ...prev,
        isPinching: false,
        pinchScale: 1
      }));
      return;
    }

    // Handle pull to refresh
    if (gestureState.isPulling && gestureState.pullDistance > pullThreshold) {
      handlers.onPullToRefresh?.();
    }

    // Handle swipe
    if (gestureState.isSwipeActive && gestureState.swipeDirection) {
      switch (gestureState.swipeDirection) {
        case 'left':
          handlers.onSwipeLeft?.();
          break;
        case 'right':
          handlers.onSwipeRight?.();
          break;
        case 'up':
          handlers.onSwipeUp?.();
          break;
        case 'down':
          handlers.onSwipeDown?.();
          break;
      }
    }

    // Reset state
    setGestureState({
      isSwipeActive: false,
      swipeDirection: null,
      swipeDistance: 0,
      isPinching: false,
      pinchScale: 1,
      isLongPress: false,
      isPulling: false,
      pullDistance: 0
    });

    touchStart.current = null;
    touchCurrent.current = null;
  }, [gestureState, handlers, pullThreshold]);

  // Prevent default behaviors
  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    setGestureState({
      isSwipeActive: false,
      swipeDirection: null,
      swipeDistance: 0,
      isPinching: false,
      pinchScale: 1,
      isLongPress: false,
      isPulling: false,
      pullDistance: 0
    });

    touchStart.current = null;
    touchCurrent.current = null;
  }, []);

  // Set up event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add passive listeners for better performance
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return {
    elementRef,
    gestureState
  };
};