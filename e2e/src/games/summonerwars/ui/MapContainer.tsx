/**
 * 召唤师战争 - 地图容器组件
 * 支持拖拽、滚轮/双指缩放，并兼容教程自动聚焦。
 */

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const DRAG_THRESHOLD = 5;
const SCALE_EPSILON = 0.02;
const SCALE_BADGE_HIDE_DELAY_MS = 1200;

interface TouchPoint {
  clientX: number;
  clientY: number;
}

interface ElementSize {
  width: number;
  height: number;
}

const getTouchDistance = (touchA: TouchPoint, touchB: TouchPoint) => {
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const measureElementSize = (element: HTMLElement | null): ElementSize => {
  if (!element) {
    return { width: 0, height: 0 };
  }

  const width = element.offsetWidth || element.clientWidth || element.getBoundingClientRect().width || 0;
  const height = element.offsetHeight || element.clientHeight || element.getBoundingClientRect().height || 0;

  return { width, height };
};

const updateSizeState = (
  setSize: React.Dispatch<React.SetStateAction<ElementSize>>,
  nextSize: ElementSize,
) => {
  setSize((currentSize) => (
    currentSize.width === nextSize.width && currentSize.height === nextSize.height
      ? currentSize
      : nextSize
  ));
};

export interface MapContainerProps {
  children: ReactNode;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  dragBoundsPaddingRatioY?: number;
  interactionDisabled?: boolean;
  panToTarget?: string | null;
  panToScale?: number;
  containerTestId?: string;
  contentTestId?: string;
  scaleTestId?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  children,
  initialScale = 0.6,
  minScale = 0.5,
  maxScale = 3,
  dragBoundsPaddingRatioY = 0,
  interactionDisabled = false,
  panToTarget,
  panToScale,
  containerTestId,
  contentTestId,
  scaleTestId,
  className = '',
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const pointerStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const isPointerDownRef = useRef(false);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number | null>(null);
  const scaleBadgeTimerRef = useRef<number | null>(null);
  const animationTimerRef = useRef<number | null>(null);

  const [zoomLevel, setZoomLevel] = useState(initialScale);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isScaleBadgeVisible, setIsScaleBadgeVisible] = useState(false);

  const syncContainerSize = useCallback(() => {
    updateSizeState(setContainerSize, measureElementSize(containerRef.current));
  }, []);

  const syncContentSize = useCallback(() => {
    updateSizeState(setContentSize, measureElementSize(contentRef.current));
  }, []);

  const baseScale = containerSize.width > 0
    && containerSize.height > 0
    && contentSize.width > 0
    && contentSize.height > 0
    ? Math.min(
      1,
      Math.min(
        containerSize.width / contentSize.width,
        containerSize.height / contentSize.height,
      ),
    )
    : 1;
  const scale = baseScale * zoomLevel;
  const isAtDefaultZoom = Math.abs(zoomLevel - initialScale) <= SCALE_EPSILON;
  const shouldShowScaleBadge = isScaleBadgeVisible || !isAtDefaultZoom;

  const clearScaleBadgeTimer = useCallback(() => {
    if (scaleBadgeTimerRef.current !== null) {
      window.clearTimeout(scaleBadgeTimerRef.current);
      scaleBadgeTimerRef.current = null;
    }
  }, []);

  const clearAnimationTimer = useCallback(() => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  }, []);

  const revealScaleBadge = useCallback((nextZoomLevel: number) => {
    clearScaleBadgeTimer();
    setIsScaleBadgeVisible(true);
    if (Math.abs(nextZoomLevel - initialScale) <= SCALE_EPSILON) {
      scaleBadgeTimerRef.current = window.setTimeout(() => {
        setIsScaleBadgeVisible(false);
        scaleBadgeTimerRef.current = null;
      }, SCALE_BADGE_HIDE_DELAY_MS);
    }
  }, [clearScaleBadgeTimer, initialScale]);

  const hideScaleBadge = useCallback(() => {
    clearScaleBadgeTimer();
    setIsScaleBadgeVisible(false);
  }, [clearScaleBadgeTimer]);

  useEffect(() => {
    return () => {
      clearScaleBadgeTimer();
      clearAnimationTimer();
    };
  }, [clearAnimationTimer, clearScaleBadgeTimer]);

  const clampPosition = useCallback((x: number, y: number, nextScale = scale) => {
    if (!containerSize.width || !containerSize.height || !contentSize.width || !contentSize.height) {
      return { x, y };
    }

    const scaledWidth = contentSize.width * nextScale;
    const scaledHeight = contentSize.height * nextScale;
    const maxOffsetX = Math.max(0, (scaledWidth - containerSize.width) / 2);
    const extraPaddingY = containerSize.height * dragBoundsPaddingRatioY;
    const maxOffsetY = Math.max(0, (scaledHeight - containerSize.height) / 2 + extraPaddingY);

    return {
      x: Math.min(maxOffsetX, Math.max(-maxOffsetX, x)),
      y: Math.min(maxOffsetY, Math.max(-maxOffsetY, y)),
    };
  }, [containerSize.height, containerSize.width, contentSize.height, contentSize.width, dragBoundsPaddingRatioY, scale]);
  const clampedPosition = clampPosition(position.x, position.y, scale);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    syncContainerSize();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        updateSizeState(setContainerSize, {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });
      observer.observe(container);
    }

    window.addEventListener('resize', syncContainerSize);
    window.addEventListener('orientationchange', syncContainerSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncContainerSize);
      window.removeEventListener('orientationchange', syncContainerSize);
    };
  }, [syncContainerSize]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;

    syncContentSize();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        updateSizeState(setContentSize, {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });
      observer.observe(content);
    }

    const images = Array.from(content.querySelectorAll('img'));
    images.forEach((image) => {
      image.addEventListener('load', syncContentSize);
      image.addEventListener('error', syncContentSize);
    });

    const frameId = window.requestAnimationFrame(syncContentSize);
    window.addEventListener('resize', syncContentSize);
    window.addEventListener('orientationchange', syncContentSize);

    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncContentSize);
      window.removeEventListener('orientationchange', syncContentSize);
      images.forEach((image) => {
        image.removeEventListener('load', syncContentSize);
        image.removeEventListener('error', syncContentSize);
      });
    };
  }, [syncContentSize]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0 || interactionDisabled) return;

    isPointerDownRef.current = true;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    positionStartRef.current = { x: clampedPosition.x, y: clampedPosition.y };
  }, [clampedPosition.x, clampedPosition.y, interactionDisabled]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (interactionDisabled) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      isPointerDownRef.current = true;
      pinchStartDistanceRef.current = null;
      pinchStartZoomRef.current = null;
      pointerStartRef.current = { x: touch.clientX, y: touch.clientY };
      positionStartRef.current = { x: clampedPosition.x, y: clampedPosition.y };
      return;
    }

    if (event.touches.length === 2) {
      isPointerDownRef.current = false;
      setIsDragging(false);
      pinchStartDistanceRef.current = getTouchDistance(event.touches[0], event.touches[1]);
      pinchStartZoomRef.current = zoomLevel;
    }
  }, [clampedPosition.x, clampedPosition.y, interactionDisabled, zoomLevel]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (interactionDisabled) return;

    if (event.touches.length === 2) {
      const startDistance = pinchStartDistanceRef.current;
      const startZoomLevel = pinchStartZoomRef.current;
      if (!startDistance || !startZoomLevel) return;

      event.preventDefault();
      clearAnimationTimer();
      setIsAnimating(false);

      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      const nextZoomLevel = Math.max(minScale, Math.min(maxScale, startZoomLevel * (distance / startDistance)));
      revealScaleBadge(nextZoomLevel);
      setZoomLevel(nextZoomLevel);
      setPosition((current) => clampPosition(current.x, current.y, baseScale * nextZoomLevel));
      return;
    }

    if (event.touches.length !== 1 || !isPointerDownRef.current) return;

    const touch = event.touches[0];
    const dx = touch.clientX - pointerStartRef.current.x;
    const dy = touch.clientY - pointerStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= DRAG_THRESHOLD) return;

    event.preventDefault();
    clearAnimationTimer();
    setIsDragging(true);
    setIsAnimating(false);

    const nextPosition = {
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy,
    };
    setPosition(clampPosition(nextPosition.x, nextPosition.y));
  }, [baseScale, clampPosition, clearAnimationTimer, interactionDisabled, maxScale, minScale, revealScaleBadge]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (event.touches.length >= 2) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      isPointerDownRef.current = true;
      pointerStartRef.current = { x: touch.clientX, y: touch.clientY };
      positionStartRef.current = { ...clampedPosition };
      pinchStartDistanceRef.current = null;
      pinchStartZoomRef.current = null;
      return;
    }

    isPointerDownRef.current = false;
    pinchStartDistanceRef.current = null;
    pinchStartZoomRef.current = null;
    setIsDragging(false);
  }, [clampedPosition]);

  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!isPointerDownRef.current) return;

      const dx = event.clientX - pointerStartRef.current.x;
      const dy = event.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= DRAG_THRESHOLD) return;

      clearAnimationTimer();
      setIsDragging(true);
      setIsAnimating(false);

      const nextPosition = {
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy,
      };
      setPosition(clampPosition(nextPosition.x, nextPosition.y));
    };

    const handleGlobalMouseUp = () => {
      isPointerDownRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [clampPosition, clearAnimationTimer]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (interactionDisabled) return;

    event.preventDefault();
    clearAnimationTimer();
    setIsAnimating(false);

    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoomLevel((currentZoomLevel) => {
      const nextZoomLevel = Math.max(minScale, Math.min(maxScale, currentZoomLevel + delta));
      revealScaleBadge(nextZoomLevel);
      setPosition((current) => clampPosition(current.x, current.y, baseScale * nextZoomLevel));
      return nextZoomLevel;
    });
  }, [baseScale, clampPosition, clearAnimationTimer, interactionDisabled, maxScale, minScale, revealScaleBadge]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    if (!interactionDisabled || panToTarget) return undefined;
    let frameId: number | null = window.requestAnimationFrame(() => {
      clearAnimationTimer();
      hideScaleBadge();
      setIsAnimating(true);
      setZoomLevel(initialScale);
      setPosition({ x: 0, y: 0 });
      animationTimerRef.current = window.setTimeout(() => {
        setIsAnimating(false);
        animationTimerRef.current = null;
      }, 400);
      frameId = null;
    });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      clearAnimationTimer();
    };
  }, [clearAnimationTimer, hideScaleBadge, initialScale, interactionDisabled, panToTarget]);

  useEffect(() => {
    if (!panToTarget || !contentRef.current || !containerRef.current) return undefined;
    if (!containerSize.width || !containerSize.height || !contentSize.width || !contentSize.height) return undefined;

    const rafId = requestAnimationFrame(() => {
      const contentEl = contentRef.current;
      const containerEl = containerRef.current;
      const targetEl = contentEl?.querySelector(`[data-tutorial-id="${panToTarget}"]`) as HTMLElement | null;
      if (!contentEl || !containerEl || !targetEl) return;

      const contentWidth = contentEl.offsetWidth;
      const contentHeight = contentEl.offsetHeight;
      if (!contentWidth || !contentHeight) return;

      const currentZoomLevel = zoomLevel;
      const targetZoomLevel = panToScale != null
        ? Math.max(minScale, Math.min(maxScale, panToScale))
        : currentZoomLevel;
      const targetScale = baseScale * targetZoomLevel;

      containerEl.scrollTop = 0;
      containerEl.scrollLeft = 0;

      const savedTransform = contentEl.style.transform;
      const savedTransition = contentEl.style.transition;
      contentEl.style.transition = 'none';
      contentEl.style.transform = 'translate(0px, 0px) scale(1)';
      contentEl.getBoundingClientRect();

      const contentRect = contentEl.getBoundingClientRect();
      const elementRect = targetEl.getBoundingClientRect();
      const targetCenterX = (elementRect.left + elementRect.right) / 2 - contentRect.left;
      const targetCenterY = (elementRect.top + elementRect.bottom) / 2 - contentRect.top;

      contentEl.style.transform = savedTransform;
      contentEl.getBoundingClientRect();
      contentEl.style.transition = savedTransition;

      const contentCenterX = contentWidth / 2;
      const contentCenterY = contentHeight / 2;
      const targetTx = (contentCenterX - targetCenterX) * targetScale;
      const targetTy = (contentCenterY - targetCenterY) * targetScale;
      const clampedPosition = clampPosition(targetTx, targetTy, targetScale);

      clearAnimationTimer();
      setIsAnimating(true);
      if (targetZoomLevel !== currentZoomLevel) {
        revealScaleBadge(targetZoomLevel);
        setZoomLevel(targetZoomLevel);
      }
      setPosition(clampedPosition);
      animationTimerRef.current = window.setTimeout(() => {
        setIsAnimating(false);
        animationTimerRef.current = null;
      }, 400);
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    baseScale,
    clampPosition,
    clearAnimationTimer,
    containerSize.height,
    containerSize.width,
    contentSize.height,
    contentSize.width,
    maxScale,
    minScale,
    panToScale,
    panToTarget,
    revealScaleBadge,
    zoomLevel,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDragStart={(event) => event.preventDefault()}
      data-testid={containerTestId}
      style={{
        ...style,
        cursor: interactionDisabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: interactionDisabled ? 'auto' : 'none',
      }}
    >
      <div
        className={`absolute top-3 left-3 z-20 rounded-lg border border-white/20 bg-black/70 px-3 py-1.5 text-sm font-bold text-white shadow-lg pointer-events-none transition-opacity duration-200 ${shouldShowScaleBadge ? 'opacity-100' : 'opacity-0'}`}
        data-testid={scaleTestId}
        aria-hidden={!shouldShowScaleBadge}
      >
        {Math.round(zoomLevel * 100)}%
      </div>

      <div
        ref={contentRef}
        className="origin-center"
        data-testid={contentTestId}
        style={{
          transform: `translate(${clampedPosition.x}px, ${clampedPosition.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : isAnimating ? 'transform 350ms ease-out' : 'transform 75ms',
          willChange: 'transform',
          pointerEvents: isDragging ? 'none' : 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default MapContainer;
