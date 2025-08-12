import React, { useState, useRef } from 'react';
import { useGestures } from '../../hooks/useGestures';

interface SwipeAction {
  icon: string;
  label: string;
  color: string;
  action: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
  disabled?: boolean;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeLeft,
  onSwipeRight,
  className = '',
  disabled = false
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedSide, setRevealedSide] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const maxSwipeDistance = 120;
  const revealThreshold = 60;

  const handleSwipeMove = (direction: 'left' | 'right', distance: number) => {
    if (disabled) return;

    const maxDistance = direction === 'left' ? 
      (rightActions.length > 0 ? maxSwipeDistance : 0) :
      (leftActions.length > 0 ? maxSwipeDistance : 0);

    if (maxDistance === 0) return;

    const offset = direction === 'left' ? -Math.min(distance, maxDistance) : Math.min(distance, maxDistance);
    setSwipeOffset(offset);

    const shouldReveal = Math.abs(offset) > revealThreshold;
    if (shouldReveal !== isRevealed) {
      setIsRevealed(shouldReveal);
      setRevealedSide(shouldReveal ? direction : null);
      
      // Haptic feedback
      if ('vibrate' in navigator && shouldReveal) {
        navigator.vibrate(10);
      }
    }
  };

  const handleSwipeEnd = () => {
    if (disabled) return;

    if (Math.abs(swipeOffset) > revealThreshold) {
      // Keep revealed
      const side = swipeOffset < 0 ? 'right' : 'left';
      setSwipeOffset(swipeOffset < 0 ? -maxSwipeDistance : maxSwipeDistance);
      setIsRevealed(true);
      setRevealedSide(side);
    } else {
      // Snap back
      setSwipeOffset(0);
      setIsRevealed(false);
      setRevealedSide(null);
    }
  };

  const handleActionClick = (action: SwipeAction) => {
    action.action();
    // Reset card position
    setSwipeOffset(0);
    setIsRevealed(false);
    setRevealedSide(null);
  };

  const { elementRef, gestureState } = useGestures({
    onSwipeLeft: () => {
      if (rightActions.length > 0) {
        handleSwipeMove('left', maxSwipeDistance);
      } else {
        onSwipeLeft?.();
      }
    },
    onSwipeRight: () => {
      if (leftActions.length > 0) {
        handleSwipeMove('right', maxSwipeDistance);
      } else {
        onSwipeRight?.();
      }
    }
  });

  // Handle gesture state changes
  React.useEffect(() => {
    if (gestureState.isSwipeActive && gestureState.swipeDirection) {
      handleSwipeMove(
        gestureState.swipeDirection === 'left' ? 'left' : 'right',
        gestureState.swipeDistance
      );
    } else if (!gestureState.isSwipeActive && swipeOffset !== 0) {
      handleSwipeEnd();
    }
  }, [gestureState.isSwipeActive, gestureState.swipeDirection, gestureState.swipeDistance]);

  // Combine refs
  React.useEffect(() => {
    if (cardRef.current && elementRef.current !== cardRef.current) {
      (elementRef as any).current = cardRef.current;
    }
  }, [elementRef]);

  return (
    <div className={`swipeable-card-container ${className}`}>
      {/* Left Actions */}
      {leftActions.length > 0 && (
        <div 
          className="swipe-actions left-actions"
          style={{
            transform: `translateX(${Math.max(0, swipeOffset - maxSwipeDistance)}px)`,
            opacity: revealedSide === 'left' ? 1 : 0
          }}
        >
          {leftActions.map((action, index) => (
            <button
              key={index}
              className="swipe-action"
              style={{ backgroundColor: action.color }}
              onClick={() => handleActionClick(action)}
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Card Content */}
      <div
        ref={cardRef}
        className={`swipeable-card ${disabled ? 'disabled' : ''} ${isRevealed ? 'revealed' : ''}`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: gestureState.isSwipeActive ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>

      {/* Right Actions */}
      {rightActions.length > 0 && (
        <div 
          className="swipe-actions right-actions"
          style={{
            transform: `translateX(${Math.min(0, swipeOffset + maxSwipeDistance)}px)`,
            opacity: revealedSide === 'right' ? 1 : 0
          }}
        >
          {rightActions.map((action, index) => (
            <button
              key={index}
              className="swipe-action"
              style={{ backgroundColor: action.color }}
              onClick={() => handleActionClick(action)}
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};