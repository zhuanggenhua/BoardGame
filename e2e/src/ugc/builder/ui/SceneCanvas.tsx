/**
 * 场景画布组件
 * 
 * 用于放置和布局游戏组件（卡牌、Token、区域等）
 */

import { useState, useCallback, useRef, useEffect, type DragEvent, type MouseEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { resolveAnchorFromPosition, resolveLayoutRect } from '../../utils/layout';

// ============================================================================
// 类型定义
// ============================================================================

export interface SceneComponent {
  id: string;
  type: string;           // 组件类型（card, token, zone, text, render-component 等）
  anchor: { x: number; y: number };
  pivot: { x: number; y: number };
  offset: { x: number; y: number };
  width: number;          // 宽度
  height: number;         // 高度
  rotation?: number;      // 旋转角度
  data: Record<string, unknown>;  // 组件数据
  renderComponentId?: string;     // 关联的渲染组件ID（用于自定义渲染）
}

type SnapAxisCandidate = { diff: number; guide: number; distance: number };
type SnapResizeCandidate = { diff: number; guide: number; distance: number; factor: number };
type SnapAxisResult = { value: number; guide: number | null };
type SnapResizeResult = { size: number; guide: number | null };

export interface SceneCanvasProps {
  components: SceneComponent[];
  onChange: (components: SceneComponent[]) => void;
  selectedIds?: string[];
  primarySelectedId?: string;
  onSelectionChange?: (ids: string[]) => void;
  onNewRenderComponent?: (component: SceneComponent) => void;
  onCanvasSizeChange?: (size: { width: number; height: number }) => void;
  gridSize?: number;
  showGrid?: boolean;
  snapToGrid?: boolean;
  snapToEdges?: boolean;
  snapToCenters?: boolean;
  snapThreshold?: number;
  className?: string;
}

// ============================================================================
// 组件渲染器
// ============================================================================

function renderComponent(
  comp: SceneComponent,
  rect: { x: number; y: number; width: number; height: number; rotation?: number },
  isSelected: boolean,
  testId?: string
) {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    transform: rect.rotation ? `rotate(${rect.rotation}deg)` : undefined,
  };
  const baseProps = {
    style: baseStyle,
    'data-testid': testId,
    'data-layout-id': comp.id,
  };

  switch (comp.type) {
    // 模板类（定义外观样式）
    case 'card-template':
      return (
        <div
          {...baseProps}
          className={`
            bg-slate-800 border-2 rounded-lg shadow-lg flex flex-col p-1
            ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-500'}
          `}
        >
          <div className="text-[10px] font-bold text-white truncate px-1">卡牌</div>
          <div className="flex-1 bg-slate-700 rounded m-1" />
          <div className="text-[8px] text-slate-400 px-1 truncate">模板</div>
        </div>
      );

    case 'piece-template':
    case 'dice-template':
      return (
        <div
          {...baseProps}
          className={`
            rounded-full flex items-center justify-center bg-indigo-600 text-white font-bold
            ${isSelected ? 'ring-2 ring-amber-500' : ''}
          `}
        >
          {comp.type === 'dice-template' ? '🎲' : '●'}
        </div>
      );

    // 布局区域
    case 'hand-zone':
    case 'deck-zone':
    case 'play-zone':
    case 'grid-board':
    case 'hex-board':
    case 'dice-tray':
      return (
        <div
          {...baseProps}
          className={`
            border-2 border-dashed rounded-lg flex items-center justify-center
            ${isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-slate-500 bg-slate-800/30'}
          `}
        >
          <span className="text-slate-300 text-sm">
            {String(comp.data.name || comp.type)}
          </span>
        </div>
      );

    // 玩家信息
    case 'player-info':
    case 'resource-bar':
    case 'status-panel':
      return (
        <div
          {...baseProps}
          className={`
            bg-slate-800 border-2 rounded-lg flex flex-col p-2
            ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-600'}
          `}
        >
          <div className="text-xs font-bold text-white truncate">
            {String(comp.data.name || comp.type)}
          </div>
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            {String(comp.data.description || '')}
          </div>
        </div>
      );

    // UI 元素
    case 'action-bar':
    case 'message-log':
    case 'turn-indicator':
      return (
        <div
          {...baseProps}
          className={`
            bg-slate-700 border rounded-lg flex items-center justify-center
            ${isSelected ? 'border-amber-500' : 'border-slate-600'}
          `}
        >
          <span className="text-slate-200 text-xs">{String(comp.data.name || comp.type)}</span>
        </div>
      );

    // 自定义渲染组件
    case 'render-component':
      return (
        <div
          {...baseProps}
          className={`
            bg-gradient-to-br from-cyan-900/50 to-purple-900/50 border-2 rounded-lg flex flex-col items-center justify-center
            ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-cyan-500/50'}
          `}
        >
          <span className="text-cyan-300 text-xs font-medium">{String(comp.data.name || '渲染组件')}</span>
          <span className="text-slate-400 text-[10px] mt-1">点击预览查看效果</span>
        </div>
      );

    default:
      return (
        <div
          {...baseProps}
          className={`
            border-2 border-dashed rounded flex items-center justify-center
            ${isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-slate-600 bg-slate-800/30'}
          `}
        >
          <span className="text-slate-300 text-xs">{String(comp.data.name || comp.type)}</span>
        </div>
      );
  }
}

// ============================================================================
// 场景画布主组件
// ============================================================================

export function SceneCanvas({
  components,
  onChange,
  selectedIds = [],
  primarySelectedId,
  onSelectionChange,
  onNewRenderComponent,
  onCanvasSizeChange,
  gridSize = 20,
  showGrid = true,
  snapToGrid = true,
  snapToEdges = true,
  snapToCenters = true,
  snapThreshold = 6,
  className = '',
}: SceneCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; corner: string; startX: number; startY: number; startW: number; startH: number; startLeft: number; startTop: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [snapGuides, setSnapGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const nextSize = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      setCanvasSize(nextSize);
      onCanvasSizeChange?.(nextSize);
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [onCanvasSizeChange]);

  const resolveRect = useCallback((comp: SceneComponent) => {
    if (!canvasSize.width || !canvasSize.height) return null;
    return resolveLayoutRect(
      {
        anchor: comp.anchor,
        pivot: comp.pivot,
        offset: comp.offset,
        width: comp.width,
        height: comp.height,
        rotation: comp.rotation,
      },
      canvasSize
    );
  }, [canvasSize]);

  // 对齐到网格
  const snapToGridValue = useCallback((value: number) => {
    return Math.round(value / gridSize) * gridSize;
  }, [gridSize]);

  const buildSnapTargets = useCallback((excludeId?: string) => {
    const xTargets: number[] = [];
    const yTargets: number[] = [];
    if (!canvasSize.width || !canvasSize.height) return { xTargets, yTargets };

    if (snapToEdges) {
      xTargets.push(0, canvasSize.width);
      yTargets.push(0, canvasSize.height);
    }
    if (snapToCenters) {
      xTargets.push(canvasSize.width / 2);
      yTargets.push(canvasSize.height / 2);
    }

    components.forEach(comp => {
      if (excludeId && comp.id === excludeId) return;
      const rect = resolveRect(comp);
      if (!rect) return;
      if (snapToEdges) {
        xTargets.push(rect.x, rect.x + rect.width);
        yTargets.push(rect.y, rect.y + rect.height);
      }
      if (snapToCenters) {
        xTargets.push(rect.x + rect.width / 2);
        yTargets.push(rect.y + rect.height / 2);
      }
    });

    return { xTargets, yTargets };
  }, [canvasSize, components, resolveRect, snapToEdges, snapToCenters]);

  const snapAxis = useCallback((value: number, size: number, targets: number[]): SnapAxisResult => {
    let best: SnapAxisCandidate | null = null;
    const positions = [value, value + size / 2, value + size];
    targets.forEach(target => {
      positions.forEach(pos => {
        const diff = target - pos;
        const distance = Math.abs(diff);
        if (distance > snapThreshold) return;
        if (!best || distance < best.distance) {
          best = { diff, guide: target, distance };
        }
      });
    });
    if (!best) {
      return { value, guide: null };
    }
    const resolved: SnapAxisCandidate = best;
    return { value: value + resolved.diff, guide: resolved.guide };
  }, [snapThreshold]);

  const snapResizeAxis = useCallback((start: number, size: number, targets: number[]): SnapResizeResult => {
    let best: SnapResizeCandidate | null = null;
    const positions = [
      { pos: start + size, factor: 1 },
      { pos: start + size / 2, factor: 2 },
    ];
    targets.forEach(target => {
      positions.forEach(({ pos, factor }) => {
        const diff = target - pos;
        const distance = Math.abs(diff);
        if (distance > snapThreshold) return;
        if (!best || distance < best.distance) {
          best = { diff, guide: target, distance, factor };
        }
      });
    });
    if (!best) {
      return { size, guide: null };
    }
    const resolved: SnapResizeCandidate = best;
    return { size: size + resolved.diff * resolved.factor, guide: resolved.guide };
  }, [snapThreshold]);

  // 处理拖放（从组件面板拖入）
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const rawX = e.clientX - rect.left - (data.width || 80) / 2;
      const rawY = e.clientY - rect.top - (data.height || 100) / 2;
      const x = snapToGrid ? snapToGridValue(rawX) : rawX;
      const y = snapToGrid ? snapToGridValue(rawY) : rawY;
      const width = data.width || 80;
      const height = data.height || 100;
      const pivot = { x: 0, y: 0 };
      const offset = { x: 0, y: 0 };
      const anchor = resolveAnchorFromPosition({
        position: { x: Math.max(0, x), y: Math.max(0, y) },
        pivot,
        offset,
        size: { width, height },
        canvas: { width: rect.width, height: rect.height },
      });

      const newComponent: SceneComponent = {
        id: `comp-${Date.now()}`,
        type: data.type || 'card',
        anchor,
        pivot,
        offset,
        width,
        height,
        data: data.data || {},
      };

      onChange([...components, newComponent]);
      onSelectionChange?.([newComponent.id]);

      // 如果是新建渲染组件，触发回调
      if (data.type === 'render-component' && data.data?.isNew && onNewRenderComponent) {
        onNewRenderComponent(newComponent);
      }
    } catch (err) {
      console.error('Drop parse error:', err);
    }
  }, [components, onChange, onSelectionChange, onNewRenderComponent, snapToGrid, snapToGridValue]);

  // 处理组件拖动（在画布内移动）
  const handleComponentMouseDown = useCallback((e: MouseEvent, comp: SceneComponent) => {
    e.stopPropagation();
    const isMulti = e.metaKey || e.ctrlKey || e.shiftKey;
    const nextSelected = isMulti
      ? (selectedIds.includes(comp.id)
        ? selectedIds.filter(id => id !== comp.id)
        : [...selectedIds, comp.id])
      : [comp.id];
    onSelectionChange?.(nextSelected);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const resolved = resolveRect(comp);
    if (!resolved) return;

    setDraggedId(comp.id);
    setDragOffset({
      x: e.clientX - rect.left - resolved.x,
      y: e.clientY - rect.top - resolved.y,
    });
  }, [onSelectionChange, selectedIds, resolveRect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedId || !dragOffset) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const rawX = e.clientX - rect.left - dragOffset.x;
    const rawY = e.clientY - rect.top - dragOffset.y;
    let newX = snapToGrid ? snapToGridValue(rawX) : rawX;
    let newY = snapToGrid ? snapToGridValue(rawY) : rawY;
    const guides: { x: number[]; y: number[] } = { x: [], y: [] };

    if (snapToEdges || snapToCenters) {
      const { xTargets, yTargets } = buildSnapTargets(draggedId ?? undefined);
      const targetComp = components.find(c => c.id === draggedId);
      if (targetComp) {
        const snappedX = snapAxis(newX, targetComp.width, xTargets);
        const snappedY = snapAxis(newY, targetComp.height, yTargets);
        newX = snappedX.value;
        newY = snappedY.value;
        if (snappedX.guide !== null) guides.x.push(snappedX.guide);
        if (snappedY.guide !== null) guides.y.push(snappedY.guide);
      }
    }

    const canvas = { width: rect.width, height: rect.height };

    setSnapGuides(guides);
    onChange(components.map(c => 
      c.id === draggedId 
        ? {
            ...c,
            anchor: resolveAnchorFromPosition({
              position: { x: Math.max(0, newX), y: Math.max(0, newY) },
              pivot: c.pivot,
              offset: c.offset,
              size: { width: c.width, height: c.height },
              canvas,
            }),
          }
        : c
    ));
  }, [draggedId, dragOffset, components, onChange, snapToGrid, snapToGridValue, snapToEdges, snapToCenters, buildSnapTargets, snapAxis]);

  const handleMouseUp = useCallback(() => {
    setDraggedId(null);
    setDragOffset(null);
    setSnapGuides({ x: [], y: [] });
  }, []);

  // 点击空白处取消选中
  const handleCanvasClick = useCallback(() => {
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  // 删除选中组件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
      onChange(components.filter(c => !selectedIds.includes(c.id)));
      onSelectionChange?.([]);
    }
  }, [selectedIds, components, onChange, onSelectionChange]);

  // 删除组件
  const handleDeleteComponent = useCallback((id: string) => {
    const idsToRemove = selectedIds.includes(id) ? selectedIds : [id];
    onChange(components.filter(c => !idsToRemove.includes(c.id)));
    onSelectionChange?.([]);
  }, [components, onChange, selectedIds, onSelectionChange]);

  // 调整尺寸
  const handleResizeStart = useCallback((e: MouseEvent, comp: SceneComponent) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const resolved = resolveRect(comp);
    if (!resolved) return;
    setResizing({
      id: comp.id,
      corner: 'se',
      startX: e.clientX,
      startY: e.clientY,
      startW: comp.width,
      startH: comp.height,
      startLeft: resolved.x,
      startTop: resolved.y,
    });
  }, [resolveRect]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    
    const deltaX = e.clientX - resizing.startX;
    const deltaY = e.clientY - resizing.startY;
    const baseW = Math.max(40, resizing.startW + deltaX);
    const baseH = Math.max(40, resizing.startH + deltaY);
    let newW = snapToGrid ? snapToGridValue(baseW) : baseW;
    let newH = snapToGrid ? snapToGridValue(baseH) : baseH;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvas = { width: rect.width, height: rect.height };
    const guides: { x: number[]; y: number[] } = { x: [], y: [] };

    if (snapToEdges || snapToCenters) {
      const { xTargets, yTargets } = buildSnapTargets(resizing.id);
      const snappedW = snapResizeAxis(resizing.startLeft, newW, xTargets);
      const snappedH = snapResizeAxis(resizing.startTop, newH, yTargets);
      newW = Math.max(40, snappedW.size);
      newH = Math.max(40, snappedH.size);
      if (snappedW.guide !== null) guides.x.push(snappedW.guide);
      if (snappedH.guide !== null) guides.y.push(snappedH.guide);
    }

    setSnapGuides(guides);

    onChange(components.map(c => 
      c.id === resizing.id
        ? {
            ...c,
            width: newW,
            height: newH,
            anchor: resolveAnchorFromPosition({
              position: { x: resizing.startLeft, y: resizing.startTop },
              pivot: c.pivot,
              offset: c.offset,
              size: { width: newW, height: newH },
              canvas,
            }),
          }
        : c
    ));
  }, [resizing, components, onChange, snapToGrid, snapToGridValue, snapToEdges, snapToCenters, buildSnapTargets, snapResizeAxis]);

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
    setSnapGuides({ x: [], y: [] });
  }, []);

  return (
    <div
      ref={canvasRef}
      className={`relative overflow-auto bg-slate-950 border border-slate-700 ${className}`}
      data-testid="layout-canvas"
      data-canvas-width={Math.round(canvasSize.width)}
      data-canvas-height={Math.round(canvasSize.height)}
      style={{
        backgroundImage: showGrid
          ? `linear-gradient(to right, #334155 1px, transparent 1px),
             linear-gradient(to bottom, #334155 1px, transparent 1px)`
          : undefined,
        backgroundSize: showGrid ? `${gridSize}px ${gridSize}px` : undefined,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseMove={resizing ? handleResizeMove : handleMouseMove}
      onMouseUp={() => { handleMouseUp(); handleResizeEnd(); }}
      onMouseLeave={() => { handleMouseUp(); handleResizeEnd(); }}
      onClick={handleCanvasClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* 渲染所有组件 */}
      {components.map(comp => {
        const isSelected = selectedIds.includes(comp.id);
        const isPrimary = primarySelectedId ? comp.id === primarySelectedId : isSelected;
        const resolved = resolveRect(comp);
        if (!resolved) return null;
        return (
          <div
            key={comp.id}
            onMouseDown={e => handleComponentMouseDown(e, comp)}
            onClick={e => e.stopPropagation()}
            style={{ cursor: draggedId === comp.id ? 'grabbing' : 'grab' }}
          >
            {renderComponent(comp, resolved, isSelected, `layout-item-${comp.id}`)}
            
            {/* 选中时显示操作按钮和调整手柄 */}
            {isPrimary && (
              <>
                {/* 删除按钮 */}
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteComponent(comp.id); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-lg z-10"
                  style={{ left: resolved.x + resolved.width - 6, top: resolved.y - 6, position: 'absolute' }}
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
                
                {/* 调整尺寸手柄 (右下角) */}
                <div
                  onMouseDown={e => handleResizeStart(e, comp)}
                  className="absolute w-3 h-3 bg-amber-500 rounded-sm cursor-se-resize z-10"
                  style={{ left: resolved.x + resolved.width - 6, top: resolved.y + resolved.height - 6, position: 'absolute' }}
                />
              </>
            )}
          </div>
        );
      })}

      {/* 吸附参考线 */}
      {snapGuides.x.map((x, index) => (
        <div
          key={`guide-x-${index}`}
          className="absolute top-0 bottom-0 w-px bg-cyan-400/70 pointer-events-none"
          style={{ left: x }}
        />
      ))}
      {snapGuides.y.map((y, index) => (
        <div
          key={`guide-y-${index}`}
          className="absolute left-0 right-0 h-px bg-cyan-400/70 pointer-events-none"
          style={{ top: y }}
        />
      ))}

      {/* 空状态提示 */}
      {components.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 pointer-events-none">
          <div className="text-center">
            <div className="text-lg mb-1">点击左侧组件添加</div>
            <div className="text-sm">支持卡牌、棋盘、骰子等多种组件</div>
          </div>
        </div>
      )}
    </div>
  );
}
