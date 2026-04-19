/**
 * 通用横向滚动增强 Hook
 *
 * 功能：
 * 1. 鼠标滚轮纵向 → 横向滚动转换（带惯性缓动）
 * 2. 鼠标拖拽左右滑动（按住拖动）
 *
 * 使用 callback ref 模式，支持条件渲染的容器（overlay/modal 内的滚动区域）。
 * 拖拽时自动添加 `data-dragging` 属性，可用于 CSS 控制光标样式。
 * 拖拽结束后短暂抑制 click 事件，防止误触卡牌选择。
 */
import { useRef, useCallback } from 'react';

export interface UseHorizontalDragScrollOptions {
  /** 是否启用滚轮转换，默认 true */
  wheel?: boolean;
  /** 是否启用拖拽滑动，默认 true */
  drag?: boolean;
  /** 拖拽灵敏度（像素倍率），默认 1 */
  dragSensitivity?: number;
}

export function useHorizontalDragScroll<T extends HTMLElement = HTMLDivElement>(
  options: UseHorizontalDragScrollOptions = {},
) {
  const { wheel = true, drag = true, dragSensitivity = 1 } = options;

  // 保存当前 DOM 元素引用，供拖拽事件使用
  const elRef = useRef<T | null>(null);

  // 拖拽状态用 ref 避免重渲染
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false,
  });

  // 清理函数引用，用于 callback ref 卸载时调用
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // 保存 click 抑制的 timeout ID，用于组件卸载时清理
  const clickSuppressTimeoutRef = useRef<number | null>(null);

  /**
   * Callback ref：元素挂载/卸载时自动绑定/解绑 wheel 监听。
   * 解决条件渲染容器中 useEffect + useRef 时序不匹配的问题。
   */
  const scrollRef = useCallback(
    (node: T | null) => {
      // 清理旧元素的监听
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      elRef.current = node;

      if (!node || !wheel) return;

      const el = node;

      const handleWheel = (e: WheelEvent) => {
        // 只在纵向滚动量大于横向时转换，避免干扰触控板原生横向滚动
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      };

      el.addEventListener('wheel', handleWheel, { passive: false });

      cleanupRef.current = () => {
        el.removeEventListener('wheel', handleWheel);
        // 清理可能存在的 click 抑制 timeout
        if (clickSuppressTimeoutRef.current !== null) {
          clearTimeout(clickSuppressTimeoutRef.current);
          clickSuppressTimeoutRef.current = null;
        }
      };
    },
    [wheel],
  );

  // 拖拽滑动
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      // 只响应鼠标主键（左键），触屏 touch 也走 pointerId=1
      if (e.button !== 0) return;
      const el = elRef.current;
      if (!el) return;

      dragState.current = {
        isDragging: true,
        startX: e.clientX,
        scrollLeft: el.scrollLeft,
        hasMoved: false,
      };

      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    },
    [drag],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current.isDragging) return;
      const el = elRef.current;
      if (!el) return;

      const dx = (e.clientX - dragState.current.startX) * dragSensitivity;
      // 超过 3px 视为真正拖拽（区分点击）
      if (Math.abs(dx) > 3 && !dragState.current.hasMoved) {
        dragState.current.hasMoved = true;
        el.setAttribute('data-dragging', '');
      }
      el.scrollLeft = dragState.current.scrollLeft - dx;
    },
    [dragSensitivity],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.isDragging) return;
    const el = elRef.current;
    if (!el) return;

    dragState.current.isDragging = false;
    el.releasePointerCapture(e.pointerId);
    el.style.cursor = '';
    el.style.userSelect = '';
    el.removeAttribute('data-dragging');

    // 拖拽后短暂抑制 click，防止误触
    if (dragState.current.hasMoved) {
      const suppress = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el.addEventListener('click', suppress, { capture: true });
      
      // 清理之前的 timeout（如果存在）
      if (clickSuppressTimeoutRef.current !== null) {
        clearTimeout(clickSuppressTimeoutRef.current);
      }
      
      // 200ms 后强制移除，不依赖 once（避免点击 pointer-events-none 元素时监听器永久存在）
      clickSuppressTimeoutRef.current = window.setTimeout(() => {
        el.removeEventListener('click', suppress, { capture: true });
        clickSuppressTimeoutRef.current = null;
      }, 200);
    }
  }, []);

  return {
    /** callback ref，绑定到需要横向滚动的容器元素 */
    ref: scrollRef,
    /** 绑定到容器的拖拽事件 props */
    dragProps: drag
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
          style: { cursor: 'grab' } as React.CSSProperties,
        }
      : {},
  };
}
