/**
 * 通用棋盘布局编辑器
 * 支持图片背景、网格校准、区域/轨道/堆叠点标注、JSON 导入导出
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BoardLayoutConfig,
  GridConfig,
  NormalizedPoint,
  NormalizedRect,
  ZoneType,
} from '../../../core/ui/board-layout.types';
import { createDefaultLayoutConfig, pixelToNormalized } from '../../../core/ui/board-layout.types';

export interface BoardLayoutEditorProps {
  /** 初始配置 */
  initialConfig?: BoardLayoutConfig;
  /** 背景图片 URL */
  backgroundImage?: string;
  /** 配置变更回调 */
  onChange?: (config: BoardLayoutConfig) => void;
  /** 保存回调 */
  onSave?: (config: BoardLayoutConfig) => Promise<unknown>;
  /** 保存按钮文本 */
  saveLabel?: string;
  /** 容器类名 */
  className?: string;
}

type EditTool = 'select' | 'grid' | 'zone' | 'track' | 'stackPoint';

export const BoardLayoutEditor: React.FC<BoardLayoutEditorProps> = ({
  initialConfig,
  backgroundImage,
  onChange,
  onSave,
  saveLabel,
  className = '',
}) => {
  const { t } = useTranslation('game');
  const [config, setConfig] = useState<BoardLayoutConfig>(
    initialConfig ?? createDefaultLayoutConfig()
  );
  const resolvedSaveLabel = saveLabel ?? t('layoutEditor.save');
  const [activeTool, setActiveTool] = useState<EditTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [trackPoints, setTrackPoints] = useState<NormalizedPoint[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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

  useEffect(() => {
    setImageAspectRatio(null);
  }, [backgroundImage]);

  const handleBackgroundImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = naturalWidth / naturalHeight;
    setImageAspectRatio(ratio);
    // TODO: 对齐坐标系后移除日志
    console.log(`[LayoutEditor] backgroundImage size=${naturalWidth}x${naturalHeight} ratio=${ratio.toFixed(4)}`);
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setIsSaving(true);
    setSaveHint(null);
    try {
      const grid = config.grid;
      // TODO: 调试布局保存后移除日志
      console.log(`[LayoutEditor] save rows=${grid?.rows ?? 'none'} cols=${grid?.cols ?? 'none'} bounds=${grid?.bounds ? `${grid.bounds.x},${grid.bounds.y},${grid.bounds.width},${grid.bounds.height}` : 'none'} gapX=${grid?.gapX ?? 0} gapY=${grid?.gapY ?? 0}`);
      const result = await onSave(config);
      const relativePath = typeof result === 'object' && result && 'relativePath' in result
        ? String((result as { relativePath?: string }).relativePath || '')
        : '';
      setSaveHint(relativePath
        ? t('layoutEditor.savedWithPath', { path: relativePath })
        : t('layoutEditor.saved'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('layoutEditor.saveFailed');
      setSaveHint(message);
    } finally {
      setIsSaving(false);
    }
  }, [config, onSave, t]);

  // 配置变更时通知外部
  useEffect(() => {
    onChange?.(config);
  }, [config, onChange]);

  // 获取鼠标相对于容器的归一化坐标
  const getMouseNormalized = useCallback((e: React.MouseEvent): NormalizedPoint | null => {
    if (!containerRef.current || containerSize.width === 0) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return pixelToNormalized(x, y, containerSize.width, containerSize.height);
  }, [containerSize]);

  // 处理鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const point = getMouseNormalized(e);
    if (!point) return;

    if (activeTool === 'zone') {
      setIsDrawing(true);
      setDrawStart({ x: point.x, y: point.y });
    } else if (activeTool === 'track') {
      setTrackPoints(prev => [...prev, point]);
    } else if (activeTool === 'stackPoint') {
      const id = `stack_${Date.now()}`;
      setConfig(prev => ({
        ...prev,
        stackPoints: [...prev.stackPoints, {
          id,
          position: point,
          direction: 'up',
        }],
      }));
      setSelectedId(id);
    }
  }, [activeTool, getMouseNormalized]);

  // 处理鼠标移动（绘制区域时）
  const handleMouseMove = useCallback((_e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    // 可以在这里添加预览效果
  }, [isDrawing, drawStart]);

  // 处理鼠标释放
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    const point = getMouseNormalized(e);
    if (!point) return;

    const bounds: NormalizedRect = {
      x: Math.min(drawStart.x, point.x),
      y: Math.min(drawStart.y, point.y),
      width: Math.abs(point.x - drawStart.x),
      height: Math.abs(point.y - drawStart.y),
    };

    if (bounds.width > 0.01 && bounds.height > 0.01) {
      const id = `zone_${Date.now()}`;
      setConfig(prev => ({
        ...prev,
        zones: [...prev.zones, {
          id,
          type: 'custom' as ZoneType,
          bounds,
        }],
      }));
      setSelectedId(id);
    }

    setIsDrawing(false);
    setDrawStart(null);
  }, [isDrawing, drawStart, getMouseNormalized]);

  // 完成轨道绘制
  const finishTrack = useCallback(() => {
    if (trackPoints.length < 2) {
      setTrackPoints([]);
      return;
    }
    const id = `track_${Date.now()}`;
    setConfig(prev => ({
      ...prev,
      tracks: [...prev.tracks, {
        id,
        points: trackPoints,
      }],
    }));
    setTrackPoints([]);
    setSelectedId(id);
  }, [trackPoints]);

  // 更新网格配置
  const updateGrid = useCallback((updates: Partial<GridConfig>) => {
    setConfig(prev => {
      const nextGrid = prev.grid ? { ...prev.grid, ...updates } : {
        rows: 6,
        cols: 8,
        bounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        ...updates,
      };
      // TODO: 调试布局保存后移除日志
      console.log(`[LayoutEditor] updateGrid rows=${nextGrid.rows} cols=${nextGrid.cols} bounds=${nextGrid.bounds.x},${nextGrid.bounds.y},${nextGrid.bounds.width},${nextGrid.bounds.height} gapX=${nextGrid.gapX ?? 0} gapY=${nextGrid.gapY ?? 0}`);
      return {
        ...prev,
        grid: nextGrid,
      };
    });
  }, []);

  // 删除选中元素
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setConfig(prev => ({
      ...prev,
      zones: prev.zones.filter(z => z.id !== selectedId),
      tracks: prev.tracks.filter(t => t.id !== selectedId),
      stackPoints: prev.stackPoints.filter(s => s.id !== selectedId),
    }));
    setSelectedId(null);
  }, [selectedId]);

  // 导出配置
  const exportConfig = useCallback(() => {
    const dataStr = JSON.stringify(config, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t('layoutEditor.exportFileName');
    a.click();
    URL.revokeObjectURL(url);
  }, [config, t]);

  // 导入配置
  const importConfig = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          setConfig(data);
        } catch (err) {
          console.error('导入配置失败:', err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  // 渲染网格预览
  const renderGridPreview = () => {
    if (!config.grid) return null;
    const { rows, cols, bounds, gapX = 0, gapY = 0 } = config.grid;
    const cells: React.ReactNode[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 计算单格尺寸（考虑间距）
        const cellWidthRatio = (1 - gapX * (cols - 1)) / cols;
        const cellHeightRatio = (1 - gapY * (rows - 1)) / rows;
        const cellX = bounds.x + bounds.width * (c * (cellWidthRatio + gapX));
        const cellY = bounds.y + bounds.height * (r * (cellHeightRatio + gapY));
        const cellW = bounds.width * cellWidthRatio;
        const cellH = bounds.height * cellHeightRatio;

        cells.push(
          <div
            key={`${r}-${c}`}
            className="absolute border border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/30 transition-colors cursor-pointer"
            style={{
              left: `${cellX * 100}%`,
              top: `${cellY * 100}%`,
              width: `${cellW * 100}%`,
              height: `${cellH * 100}%`,
            }}
            title={`(${r}, ${c})`}
          />
        );
      }
    }
    return cells;
  };

  // 渲染区域预览
  const renderZones = () => {
    return config.zones.map(zone => (
      <div
        key={zone.id}
        className={`absolute border-2 ${selectedId === zone.id ? 'border-yellow-400 bg-yellow-400/20' : 'border-green-500/70 bg-green-500/10'} cursor-pointer`}
        style={{
          left: `${zone.bounds.x * 100}%`,
          top: `${zone.bounds.y * 100}%`,
          width: `${zone.bounds.width * 100}%`,
          height: `${zone.bounds.height * 100}%`,
        }}
        onClick={() => setSelectedId(zone.id)}
      >
        <span className="absolute top-0 left-0 bg-green-600 text-white text-[10px] px-1">
          {zone.label || zone.type}
        </span>
      </div>
    ));
  };

  // 渲染轨道预览
  const renderTracks = () => {
    return config.tracks.map(track => (
      <React.Fragment key={track.id}>
        {track.points.map((point, i) => (
          <div
            key={`${track.id}-${i}`}
            className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full ${selectedId === track.id ? 'bg-yellow-400' : 'bg-purple-500'} border-2 border-white cursor-pointer`}
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
            }}
            onClick={() => setSelectedId(track.id)}
            title={`${track.label || track.id} [${i}]`}
          />
        ))}
      </React.Fragment>
    ));
  };

  // 渲染堆叠点预览
  const renderStackPoints = () => {
    return config.stackPoints.map(sp => (
      <div
        key={sp.id}
        className={`absolute w-6 h-6 -ml-3 -mt-3 ${selectedId === sp.id ? 'bg-yellow-400' : 'bg-orange-500'} border-2 border-white cursor-pointer flex items-center justify-center text-[10px] text-white font-bold`}
        style={{
          left: `${sp.position.x * 100}%`,
          top: `${sp.position.y * 100}%`,
        }}
        onClick={() => setSelectedId(sp.id)}
        title={sp.label || sp.id}
      >
        S
      </div>
    ));
  };

  // 渲染绘制中的轨道点
  const renderDrawingTrack = () => {
    return trackPoints.map((point, i) => (
      <div
        key={i}
        className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-purple-300 border-2 border-purple-600"
        style={{
          left: `${point.x * 100}%`,
          top: `${point.y * 100}%`,
        }}
      />
    ));
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-testid="layout-editor">
      {/* 工具栏 */}
      <div className="flex flex-wrap gap-2 p-2 bg-slate-800 rounded-lg">
        <div className="flex gap-1">
          {(['select', 'grid', 'zone', 'track', 'stackPoint'] as EditTool[]).map(tool => (
            <button
              key={tool}
              onClick={() => {
                setActiveTool(tool);
                if (tool === 'track') setTrackPoints([]);
              }}
              data-testid={`layout-tool-${tool}`}
              className={`px-2 py-1 text-xs rounded ${activeTool === tool ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {tool === 'select' && t('layoutEditor.tools.select')}
              {tool === 'grid' && t('layoutEditor.tools.grid')}
              {tool === 'zone' && t('layoutEditor.tools.zone')}
              {tool === 'track' && t('layoutEditor.tools.track')}
              {tool === 'stackPoint' && t('layoutEditor.tools.stackPoint')}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {activeTool === 'track' && trackPoints.length > 0 && (
            <button
              onClick={finishTrack}
              className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500"
            >
              {t('layoutEditor.finishTrack', { count: trackPoints.length })}
            </button>
          )}
          {selectedId && (
            <button
              onClick={deleteSelected}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500"
            >
              {t('layoutEditor.delete')}
            </button>
          )}
          <button
            onClick={importConfig}
            className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
          >
            {t('layoutEditor.import')}
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              data-testid="layout-save"
              className={`px-2 py-1 text-xs rounded ${isSaving ? 'bg-emerald-400 text-black/70' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
            >
              {isSaving ? t('layoutEditor.saving') : resolvedSaveLabel}
            </button>
          )}
          <button
            onClick={exportConfig}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            {t('layoutEditor.export')}
          </button>
        </div>
      </div>
      {saveHint && (
        <div className="text-xs text-emerald-200 px-2">
          {saveHint}
        </div>
      )}

      {/* 网格参数面板 */}
      {activeTool === 'grid' && (
        <div className="flex flex-wrap gap-3 p-2 bg-slate-800 rounded-lg text-xs text-white">
          <label className="flex items-center gap-1 font-medium">
            <span className="text-slate-200">{t('layoutEditor.grid.rows')}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={config.grid?.rows ?? 6}
              onChange={(e) => updateGrid({ rows: Number(e.target.value) })}
              data-testid="layout-grid-rows"
              className="w-12 px-1 py-0.5 bg-slate-700 rounded text-white"
            />
          </label>
          <label className="flex items-center gap-1 font-medium">
            <span className="text-slate-200">{t('layoutEditor.grid.cols')}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={config.grid?.cols ?? 8}
              onChange={(e) => updateGrid({ cols: Number(e.target.value) })}
              data-testid="layout-grid-cols"
              className="w-12 px-1 py-0.5 bg-slate-700 rounded text-white"
            />
          </label>
          <label className="flex items-center gap-1 font-medium">
            <span className="text-slate-200">{t('layoutEditor.grid.gapX')}</span>
            <input
              type="number"
              min={0}
              max={0.5}
              step={0.01}
              value={config.grid?.gapX ?? 0}
              onChange={(e) => updateGrid({ gapX: Number(e.target.value) })}
              data-testid="layout-grid-gapx"
              className="w-16 px-1 py-0.5 bg-slate-700 rounded text-white"
            />
          </label>
          <label className="flex items-center gap-1 font-medium">
            <span className="text-slate-200">{t('layoutEditor.grid.gapY')}</span>
            <input
              type="number"
              min={0}
              max={0.5}
              step={0.01}
              value={config.grid?.gapY ?? 0}
              onChange={(e) => updateGrid({ gapY: Number(e.target.value) })}
              data-testid="layout-grid-gapy"
              className="w-16 px-1 py-0.5 bg-slate-700 rounded text-white"
            />
          </label>
          <label className="flex items-center gap-1 font-medium">
            <span className="text-slate-200">{t('layoutEditor.grid.offsetX')}</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={config.grid?.bounds.x ?? 0.1}
              onChange={(e) => updateGrid({ bounds: { ...config.grid!.bounds, x: Number(e.target.value) } })}
              data-testid="layout-grid-bounds-x"
              className="w-16 px-1 py-0.5 bg-slate-700 rounded text-white"
            />
          </label>
          <label className="flex items-center gap-1 font-medium">
            <span className="text-slate-200">{t('layoutEditor.grid.offsetY')}</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={config.grid?.bounds.y ?? 0.1}
              onChange={(e) => updateGrid({ bounds: { ...config.grid!.bounds, y: Number(e.target.value) } })}
              data-testid="layout-grid-bounds-y"
              className="w-16 px-1 py-0.5 bg-slate-700 rounded text-white"
            />
          </label>
          <label className="flex items-center gap-1 font-medium">
            <span className="text-slate-200">{t('layoutEditor.grid.width')}</span>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.01}
              value={config.grid?.bounds.width ?? 0.8}
              onChange={(e) => updateGrid({ bounds: { ...config.grid!.bounds, width: Number(e.target.value) } })}
              data-testid="layout-grid-bounds-width"
              className="w-16 px-1 py-0.5 bg-slate-700 rounded text-white"
            />
          </label>
          <label className="flex items-center gap-1 font-medium">
            <span className="text-slate-200">{t('layoutEditor.grid.height')}</span>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.01}
              value={config.grid?.bounds.height ?? 0.8}
              onChange={(e) => updateGrid({ bounds: { ...config.grid!.bounds, height: Number(e.target.value) } })}
              data-testid="layout-grid-bounds-height"
              className="w-16 px-1 py-0.5 bg-slate-700 rounded text-white"
            />
          </label>
          {!config.grid && (
            <button
              onClick={() => updateGrid({})}
              className="px-2 py-1 bg-cyan-600 text-white rounded hover:bg-cyan-500"
            >
              {t('layoutEditor.grid.create')}
            </button>
          )}
        </div>
      )}

      {/* 画布区域 */}
      <div
        ref={containerRef}
        className="relative w-full bg-slate-900 rounded-lg overflow-hidden cursor-crosshair"
        style={{ aspectRatio: imageAspectRatio ?? '4 / 3' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setDrawStart(null);
          }
        }}
      >
        {/* 背景图片 */}
        {(backgroundImage || config.backgroundImage) && (
          <img
            src={backgroundImage || config.backgroundImage}
            alt={t('layoutEditor.backgroundAlt')}
            onLoad={handleBackgroundImageLoad}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        )}

        {/* 网格 */}
        {config.grid && renderGridPreview()}

        {/* 区域 */}
        {renderZones()}

        {/* 轨道 */}
        {renderTracks()}

        {/* 堆叠点 */}
        {renderStackPoints()}

        {/* 绘制中的轨道 */}
        {activeTool === 'track' && renderDrawingTrack()}

        {/* 绘制中的区域预览 */}
        {isDrawing && drawStart && (
          <div
            className="absolute border-2 border-dashed border-green-400 bg-green-400/20 pointer-events-none"
            style={{
              left: `${drawStart.x * 100}%`,
              top: `${drawStart.y * 100}%`,
            }}
          />
        )}
      </div>

      {/* 状态信息 */}
      <div className="text-xs text-slate-400 p-2 bg-slate-800 rounded-lg">
        <span>
          {t('layoutEditor.status.grid', {
            value: config.grid ? `${config.grid.rows}×${config.grid.cols}` : t('layoutEditor.status.unset'),
          })}
        </span>
        <span className="ml-4">{t('layoutEditor.status.zone', { count: config.zones.length })}</span>
        <span className="ml-4">{t('layoutEditor.status.track', { count: config.tracks.length })}</span>
        <span className="ml-4">{t('layoutEditor.status.stackPoint', { count: config.stackPoints.length })}</span>
        {selectedId && <span className="ml-4 text-yellow-400">{t('layoutEditor.status.selected', { id: selectedId })}</span>}
      </div>
    </div>
  );
};

export default BoardLayoutEditor;
