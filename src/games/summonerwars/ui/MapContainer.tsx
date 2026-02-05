/**
 * 召唤师战争 - 地图容器组件
 * 支持拖拽和鼠标滚轮缩放，区分点击和拖拽
 */

import React, { useRef, useState, useCallback, useEffect, type ReactNode } from 'react';

/** 判定为拖拽的最小移动距离（像素） */
const DRAG_THRESHOLD = 5;

export interface MapContainerProps {
  /** 子元素（地图内容） */
  children: ReactNode;
  /** 初始缩放 */
  initialScale?: number;
  /** 最小缩放 */
  minScale?: number;
  /** 最大缩放 */
  maxScale?: number;
  /** 纵向拖拽边界放松比例（相对容器高度） */
  dragBoundsPaddingRatioY?: number;
  /** 测试标识（容器） */
  containerTestId?: string;
  /** 测试标识（地图内容） */
  contentTestId?: string;
  /** 测试标识（缩放倍率） */
  scaleTestId?: string;
  /** 额外类名 */
  className?: string;
}

/** 地图容器（支持拖拽和缩放，区分点击和拖拽） */
export const MapContainer: React.FC<MapContainerProps> = ({
  children,
  initialScale = 0.6,
  minScale = 0.5,
  maxScale = 3,
  dragBoundsPaddingRatioY = 0,
  containerTestId,
  contentTestId,
  scaleTestId,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(initialScale);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  // 拖拽状态 ref
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const isPointerDownRef = useRef(false);

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
  }, [containerSize, contentSize, scale, dragBoundsPaddingRatioY]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContentSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  // 鼠标按下（只在容器内触发）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    
    isPointerDownRef.current = true;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { x: position.x, y: position.y };
  }, [position]);

  // 全局鼠标移动和松开（使用 useEffect 注册）
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isPointerDownRef.current) return;
      
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 超过阈值才开始拖拽
      if (distance > DRAG_THRESHOLD) {
        setIsDragging(true);
        
        const nextPosition = {
          x: positionStartRef.current.x + dx,
          y: positionStartRef.current.y + dy,
        };
        setPosition(clampPosition(nextPosition.x, nextPosition.y));
      }
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
  }, [clampPosition]);

  // 滚轮缩放
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => {
      const nextScale = Math.max(minScale, Math.min(maxScale, prev + delta));
      setPosition(current => clampPosition(current.x, current.y, nextScale));
      return nextScale;
    });
  }, [minScale, maxScale, clampPosition]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    setPosition(prev => {
      const next = clampPosition(prev.x, prev.y);
      return next.x === prev.x && next.y === prev.y ? prev : next;
    });
  }, [clampPosition]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${className}`}
      onMouseDown={handleMouseDown}
      onDragStart={(e) => e.preventDefault()}
      data-testid={containerTestId}
      style={{ 
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* 左上角缩放倍率显示 */}
      <div
        className="absolute top-3 left-3 z-20 text-sm font-bold text-white bg-black/70 px-3 py-1.5 rounded-lg border border-white/20 pointer-events-none shadow-lg"
        data-testid={scaleTestId}
      >
        {Math.round(scale * 100)}%
      </div>

      {/* 地图内容 */}
      <div
        ref={contentRef}
        className="origin-center"
        data-testid={contentTestId}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 75ms',
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
