import React, { useState, useRef, useEffect } from 'react';
import { useGestures } from '../../hooks/useGestures';

interface PinchZoomProps {
  children: React.ReactNode;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  disabled?: boolean;
  className?: string;
  onZoomChange?: (scale: number) => void;
}

export const PinchZoom: React.FC<PinchZoomProps> = ({
  children,
  minScale = 0.5,
  maxScale = 3,
  initialScale = 1,
  disabled = false,
  className = '',
  onZoomChange
}) => {
  const [scale, setScale] = useState(initialScale);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPinching, setIsPinching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const constrainScale = (newScale: number): number => {
    return Math.max(minScale, Math.min(maxScale, newScale));
  };

  const constrainTranslation = (x: number, y: number, currentScale: number) => {
    if (!containerRef.current || !contentRef.current) return { x, y };

    const containerRect = containerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    const scaledWidth = contentRect.width * currentScale;
    const scaledHeight = contentRect.height * currentScale;

    const maxX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const maxY = Math.max(0, (scaledHeight - containerRect.height) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y))
    };
  };

  const handlePinchStart = () => {
    if (disabled) return;
    setIsPinching(true);
  };

  const handlePinchMove = (newScale: number) => {
    if (disabled) return;
    
    const constrainedScale = constrainScale(newScale);
    setScale(constrainedScale);
    
    // Adjust translation to keep content centered
    const { x, y } = constrainTranslation(translateX, translateY, constrainedScale);
    setTranslateX(x);
    setTranslateY(y);
    
    onZoomChange?.(constrainedScale);
  };

  const handlePinchEnd = (finalScale: number) => {
    if (disabled) return;
    
    setIsPinching(false);
    const constrainedScale = constrainScale(finalScale);
    setScale(constrainedScale);
    
    // Snap to boundaries if needed
    const { x, y } = constrainTranslation(translateX, translateY, constrainedScale);
    setTranslateX(x);
    setTranslateY(y);
    
    onZoomChange?.(constrainedScale);
  };

  const handleDoubleTap = () => {
    if (disabled) return;
    
    const newScale = scale > 1 ? 1 : 2;
    const constrainedScale = constrainScale(newScale);
    
    setScale(constrainedScale);
    
    if (constrainedScale === 1) {
      setTranslateX(0);
      setTranslateY(0);
    }
    
    onZoomChange?.(constrainedScale);
  };

  const { elementRef, gestureState } = useGestures({
    onPinchStart: handlePinchStart,
    onPinchMove: handlePinchMove,
    onPinchEnd: handlePinchEnd,
    onDoubleTap: handleDoubleTap
  });

  // Handle pan gestures when zoomed in
  const handlePan = (deltaX: number, deltaY: number) => {
    if (disabled || scale <= 1) return;
    
    const { x, y } = constrainTranslation(
      translateX + deltaX,
      translateY + deltaY,
      scale
    );
    
    setTranslateX(x);
    setTranslateY(y);
  };

  // Combine refs
  useEffect(() => {
    if (containerRef.current && elementRef.current !== containerRef.current) {
      (elementRef as any).current = containerRef.current;
    }
  }, [elementRef]);

  // Reset to initial state
  const reset = () => {
    setScale(initialScale);
    setTranslateX(0);
    setTranslateY(0);
    onZoomChange?.(initialScale);
  };

  // Zoom to specific scale
  const zoomTo = (targetScale: number, centerX?: number, centerY?: number) => {
    const constrainedScale = constrainScale(targetScale);
    setScale(constrainedScale);
    
    if (centerX !== undefined && centerY !== undefined && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const offsetX = centerX - containerRect.width / 2;
      const offsetY = centerY - containerRect.height / 2;
      
      const { x, y } = constrainTranslation(-offsetX, -offsetY, constrainedScale);
      setTranslateX(x);
      setTranslateY(y);
    } else if (constrainedScale === 1) {
      setTranslateX(0);
      setTranslateY(0);
    }
    
    onZoomChange?.(constrainedScale);
  };

  return (
    <div
      ref={containerRef}
      className={`pinch-zoom-container ${className} ${disabled ? 'disabled' : ''}`}
    >
      <div
        ref={contentRef}
        className={`pinch-zoom-content ${isPinching ? 'pinching' : ''}`}
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transition: isPinching || gestureState.isPinching ? 'none' : 'transform 0.3s ease-out',
          transformOrigin: 'center center'
        }}
      >
        {children}
      </div>
      
      {/* Zoom Controls (optional) */}
      {scale !== 1 && (
        <div className="zoom-controls">
          <button
            className="zoom-control zoom-out"
            onClick={() => zoomTo(Math.max(minScale, scale - 0.5))}
            disabled={scale <= minScale}
          >
            −
          </button>
          
          <span className="zoom-level">
            {Math.round(scale * 100)}%
          </span>
          
          <button
            className="zoom-control zoom-in"
            onClick={() => zoomTo(Math.min(maxScale, scale + 0.5))}
            disabled={scale >= maxScale}
          >
            +
          </button>
          
          <button
            className="zoom-control zoom-reset"
            onClick={reset}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};