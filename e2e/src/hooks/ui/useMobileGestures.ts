import { useEffect, useRef, useState } from 'react';

interface GestureState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface UseMobileGesturesOptions {
  minScale?: number;
  maxScale?: number;
  enabled?: boolean;
}

/**
 * 移动端手势控制 Hook
 * 支持双指缩放和单指拖拽平移
 */
export function useMobileGestures(options: UseMobileGesturesOptions = {}) {
  const {
    minScale = 0.5,
    maxScale = 2,
    enabled = true,
  } = options;

  const [gesture, setGesture] = useState<GestureState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const touchStateRef = useRef({
    initialDistance: 0,
    initialScale: 1,
    initialTranslate: { x: 0, y: 0 },
    lastTouch: { x: 0, y: 0 },
    isPinching: false,
    isDragging: false,
  });

  useEffect(() => {
    if (!enabled) return;

    const container = document.getElementById('root');
    if (!container) return;

    // 计算两点间距离
    const getDistance = (touch1: Touch, touch2: Touch) => {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const state = touchStateRef.current;

      if (e.touches.length === 2) {
        // 双指缩放开始
        state.isPinching = true;
        state.isDragging = false;
        state.initialDistance = getDistance(e.touches[0], e.touches[1]);
        state.initialScale = gestureRef.current.scale;
      } else if (e.touches.length === 1) {
        // 单指拖拽开始
        state.isDragging = true;
        state.isPinching = false;
        state.lastTouch = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        state.initialTranslate = {
          x: gestureRef.current.translateX,
          y: gestureRef.current.translateY,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const state = touchStateRef.current;

      if (state.isPinching && e.touches.length === 2) {
        // 双指缩放
        e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scaleChange = currentDistance / state.initialDistance;
        const newScale = Math.max(minScale, Math.min(maxScale, state.initialScale * scaleChange));

        setGesture(prev => ({
          ...prev,
          scale: newScale,
        }));
      } else if (state.isDragging && e.touches.length === 1) {
        // 单指拖拽
        e.preventDefault();
        const deltaX = e.touches[0].clientX - state.lastTouch.x;
        const deltaY = e.touches[0].clientY - state.lastTouch.y;

        setGesture(prev => ({
          ...prev,
          translateX: state.initialTranslate.x + deltaX,
          translateY: state.initialTranslate.y + deltaY,
        }));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const state = touchStateRef.current;

      if (e.touches.length < 2) {
        state.isPinching = false;
      }
      if (e.touches.length === 0) {
        state.isDragging = false;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled, minScale, maxScale]);

  // 重置手势
  const reset = () => {
    setGesture({
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  };

  return {
    gesture,
    reset,
    transform: `translate(${gesture.translateX}px, ${gesture.translateY}px) scale(${gesture.scale})`,
  };
}
