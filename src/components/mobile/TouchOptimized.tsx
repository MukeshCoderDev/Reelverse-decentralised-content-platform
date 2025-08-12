import React, { useState, useRef } from 'react';
import { useGestures } from '../../hooks/useGestures';

interface TouchOptimizedProps {
  children: React.ReactNode;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  hapticFeedback?: boolean;
  className?: string;
  disabled?: boolean;
  rippleEffect?: boolean;
}

export const TouchOptimized: React.FC<TouchOptimizedProps> = ({
  children,
  onTap,
  onDoubleTap,
  onLongPress,
  hapticFeedback = true,
  className = '',
  disabled = false,
  rippleEffect = true
}) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isPressed, setIsPressed] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const rippleId = useRef(0);

  const addRipple = (x: number, y: number) => {
    if (!rippleEffect || disabled) return;

    const id = rippleId.current++;
    setRipples(prev => [...prev, { id, x, y }]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;

    setIsPressed(true);

    if (rippleEffect && elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      addRipple(x, y);
    }
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    setIsPressed(false);
  };

  const handleTap = () => {
    if (disabled) return;
    
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    onTap?.();
  };

  const handleDoubleTap = () => {
    if (disabled) return;
    
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }
    
    onDoubleTap?.();
  };

  const handleLongPress = () => {
    if (disabled) return;
    
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    onLongPress?.();
  };

  const { elementRef: gestureRef } = useGestures({
    onDoubleTap: handleDoubleTap,
    onLongPress: handleLongPress
  });

  // Combine refs
  React.useEffect(() => {
    if (elementRef.current && gestureRef.current !== elementRef.current) {
      (gestureRef as any).current = elementRef.current;
    }
  }, [gestureRef]);

  return (
    <div
      ref={elementRef}
      className={`touch-optimized ${className} ${disabled ? 'disabled' : ''} ${isPressed ? 'pressed' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={onTap ? handleTap : undefined}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      {children}
      
      {/* Ripple Effects */}
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="touch-ripple"
          style={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            transform: 'translate(-50%, -50%)',
            animation: 'ripple-animation 0.6s ease-out',
            pointerEvents: 'none'
          }}
        />
      ))}
    </div>
  );
};

// Context Menu Component
interface ContextMenuItem {
  icon: string;
  label: string;
  action: () => void;
  destructive?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
  className?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  children,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLongPress = (e: React.TouchEvent) => {
    if (items.length === 0) return;

    const touch = e.touches[0];
    setPosition({ x: touch.clientX, y: touch.clientY });
    setIsOpen(true);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleItemClick = (item: ContextMenuItem) => {
    item.action();
    setIsOpen(false);
  };

  const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
      };
    }
  }, [isOpen]);

  return (
    <>
      <TouchOptimized
        onLongPress={() => handleLongPress}
        className={className}
      >
        {children}
      </TouchOptimized>

      {isOpen && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.9)',
            borderRadius: '8px',
            padding: '0.5rem',
            backdropFilter: 'blur(10px)',
            transform: 'translate(-50%, -100%)',
            minWidth: '200px'
          }}
        >
          {items.map((item, index) => (
            <button
              key={index}
              className={`context-menu-item ${item.destructive ? 'destructive' : ''}`}
              onClick={() => handleItemClick(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem',
                background: 'none',
                border: 'none',
                color: item.destructive ? '#ef4444' : '#fff',
                fontSize: '0.875rem',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'background-color 0.2s'
              }}
            >
              <span className="item-icon">{item.icon}</span>
              <span className="item-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};