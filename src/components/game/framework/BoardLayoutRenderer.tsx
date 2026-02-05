/**
 * 通用棋盘布局渲染器
 * 根据配置渲染网格、区域、轨道高亮、堆叠卡牌
 * 坐标映射适配容器尺寸
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type {
  BoardLayoutConfig,
  CellCoord,
} from '../../../core/ui/board-layout.types';
import { getGridBounds } from '../../../core/ui/board-layout.types';

export interface BoardLayoutRendererProps {
  /** 布局配置 */
  config: BoardLayoutConfig;
  /** 背景图片 URL（覆盖配置中的 backgroundImage） */
  backgroundImage?: string;
  /** 容器类名 */
  className?: string;
  /** 网格格子点击回调 */
  onCellClick?: (cell: CellCoord) => void;
  /** 网格格子悬停回调 */
  onCellHover?: (cell: CellCoord | null) => void;
  /** 区域点击回调 */
  onZoneClick?: (zoneId: string) => void;
  /** 轨道点击回调 */
  onTrackPointClick?: (trackId: string, pointIndex: number) => void;
  /** 堆叠点点击回调 */
  onStackPointClick?: (stackPointId: string) => void;
  /** 高亮的格子列表 */
  highlightedCells?: CellCoord[];
  /** 高亮的轨道点 { trackId, pointIndex } */
  highlightedTrackPoint?: { trackId: string; pointIndex: number };
  /** 放置在格子上的内容渲染函数 */
  renderCellContent?: (cell: CellCoord) => React.ReactNode;
  /** 放置在堆叠点上的内容渲染函数 */
  renderStackContent?: (stackPointId: string) => React.ReactNode;
  /** 是否显示网格线 */
  showGrid?: boolean;
  /** 是否显示区域 */
  showZones?: boolean;
  /** 是否显示轨道 */
  showTracks?: boolean;
  /** 是否显示堆叠点 */
  showStackPoints?: boolean;
  /** 子元素（叠加在布局上方） */
  children?: React.ReactNode;
}

export const BoardLayoutRenderer: React.FC<BoardLayoutRendererProps> = ({
  config,
  backgroundImage,
  className = '',
  onCellClick,
  onCellHover,
  onZoneClick,
  onTrackPointClick,
  onStackPointClick,
  highlightedCells = [],
  highlightedTrackPoint,
  renderCellContent,
  renderStackContent,
  showGrid = true,
  showZones = true,
  showTracks = true,
  showStackPoints = true,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [_containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [hoveredCell, setHoveredCell] = useState<CellCoord | null>(null);

  // 监听容器尺寸变化
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 检查格子是否高亮
  const isCellHighlighted = useCallback((row: number, col: number) => {
    return highlightedCells.some(c => c.row === row && c.col === col);
  }, [highlightedCells]);

  // 渲染网格
  const renderGrid = () => {
    if (!config.grid || !showGrid) return null;
    const { rows, cols, gapX = 0, gapY = 0 } = config.grid;
    const bounds = getGridBounds(config.grid);
    const cells: React.ReactNode[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellWidthRatio = (1 - gapX * (cols - 1)) / cols;
        const cellHeightRatio = (1 - gapY * (rows - 1)) / rows;
        const cellX = bounds.x + bounds.width * (c * (cellWidthRatio + gapX));
        const cellY = bounds.y + bounds.height * (r * (cellHeightRatio + gapY));
        const cellW = bounds.width * cellWidthRatio;
        const cellH = bounds.height * cellHeightRatio;

        const isHighlighted = isCellHighlighted(r, c);
        const isHovered = hoveredCell?.row === r && hoveredCell?.col === c;
        const cellCoord: CellCoord = { row: r, col: c };

        cells.push(
          <div
            key={`cell-${r}-${c}`}
            className={`absolute border transition-all duration-150 cursor-pointer
              ${isHighlighted 
                ? 'border-amber-400 bg-amber-400/30 shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                : 'border-white/20 hover:border-cyan-400/50 hover:bg-cyan-400/10'}
              ${isHovered && !isHighlighted ? 'bg-white/10' : ''}
            `}
            style={{
              left: `${cellX * 100}%`,
              top: `${cellY * 100}%`,
              width: `${cellW * 100}%`,
              height: `${cellH * 100}%`,
            }}
            onClick={() => onCellClick?.(cellCoord)}
            onMouseEnter={() => {
              setHoveredCell(cellCoord);
              onCellHover?.(cellCoord);
            }}
            onMouseLeave={() => {
              setHoveredCell(null);
              onCellHover?.(null);
            }}
          >
            {renderCellContent?.(cellCoord)}
          </div>
        );
      }
    }
    return cells;
  };

  // 渲染区域
  const renderZones = () => {
    if (!showZones) return null;
    return config.zones.map(zone => (
      <div
        key={zone.id}
        className="absolute border-2 border-dashed border-green-500/50 bg-green-500/5 cursor-pointer hover:bg-green-500/15 transition-colors"
        style={{
          left: `${zone.bounds.x * 100}%`,
          top: `${zone.bounds.y * 100}%`,
          width: `${zone.bounds.width * 100}%`,
          height: `${zone.bounds.height * 100}%`,
        }}
        onClick={() => onZoneClick?.(zone.id)}
      >
        {zone.label && (
          <span className="absolute top-0 left-0 bg-green-600/80 text-white text-[10px] px-1 rounded-br">
            {zone.label}
          </span>
        )}
      </div>
    ));
  };

  // 渲染轨道
  const renderTracks = () => {
    if (!showTracks) return null;
    return config.tracks.map(track => (
      <React.Fragment key={track.id}>
        {track.points.map((point, i) => {
          const isHighlighted = 
            highlightedTrackPoint?.trackId === track.id && 
            highlightedTrackPoint?.pointIndex === i;
          return (
            <div
              key={`${track.id}-${i}`}
              className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full cursor-pointer transition-all
                ${isHighlighted 
                  ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] scale-125' 
                  : 'bg-purple-500/80 hover:bg-purple-400 hover:scale-110'}
                border-2 border-white/80
              `}
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
              }}
              onClick={() => onTrackPointClick?.(track.id, i)}
              title={`${track.label || track.id} [${i}]`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold">
                {i}
              </span>
            </div>
          );
        })}
      </React.Fragment>
    ));
  };

  // 渲染堆叠点
  const renderStackPoints = () => {
    if (!showStackPoints) return null;
    return config.stackPoints.map(sp => (
      <div
        key={sp.id}
        className="absolute cursor-pointer"
        style={{
          left: `${sp.position.x * 100}%`,
          top: `${sp.position.y * 100}%`,
          width: sp.cardSize ? `${sp.cardSize.width * 100}%` : '10%',
          height: sp.cardSize ? `${sp.cardSize.height * 100}%` : '15%',
          transform: 'translate(-50%, -50%)',
        }}
        onClick={() => onStackPointClick?.(sp.id)}
      >
        <div className="w-full h-full border-2 border-dashed border-orange-400/50 bg-orange-400/5 rounded hover:bg-orange-400/15 transition-colors flex items-center justify-center">
          {renderStackContent?.(sp.id) ?? (
            <span className="text-orange-400/70 text-xs">{sp.label || sp.id}</span>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
    >
      {/* 背景图片 */}
      {(backgroundImage || config.backgroundImage) && (
        <img
          src={backgroundImage || config.backgroundImage}
          alt="棋盘背景"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      )}

      {/* 网格 */}
      {renderGrid()}

      {/* 区域 */}
      {renderZones()}

      {/* 轨道 */}
      {renderTracks()}

      {/* 堆叠点 */}
      {renderStackPoints()}

      {/* 子元素 */}
      {children}
    </div>
  );
};

export default BoardLayoutRenderer;
