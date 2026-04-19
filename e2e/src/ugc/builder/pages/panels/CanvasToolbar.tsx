/**
 * 画布工具栏：对齐/分布/网格/吸附选项
 */

interface CanvasToolbarProps {
  selectedComponentIds: string[];
  alignSelection: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeSelection: (axis: 'horizontal' | 'vertical') => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  gridSize: number;
  setGridSize: (v: number) => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  snapToEdges: boolean;
  setSnapToEdges: (v: boolean) => void;
  snapToCenters: boolean;
  setSnapToCenters: (v: boolean) => void;
  snapThreshold: number;
  setSnapThreshold: (v: number) => void;
}

export function CanvasToolbar({
  selectedComponentIds,
  alignSelection,
  distributeSelection,
  showGrid,
  setShowGrid,
  gridSize,
  setGridSize,
  snapToGrid,
  setSnapToGrid,
  snapToEdges,
  setSnapToEdges,
  snapToCenters,
  setSnapToCenters,
  snapThreshold,
  setSnapThreshold,
}: CanvasToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/80 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-slate-400">对齐</span>
        <button
          type="button"
          onClick={() => alignSelection('left')}
          disabled={selectedComponentIds.length === 0}
          data-testid="align-left"
          className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
        >左</button>
        <button
          type="button"
          onClick={() => alignSelection('center')}
          disabled={selectedComponentIds.length === 0}
          data-testid="align-center"
          className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
        >中</button>
        <button
          type="button"
          onClick={() => alignSelection('right')}
          disabled={selectedComponentIds.length === 0}
          data-testid="align-right"
          className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
        >右</button>
        <button
          type="button"
          onClick={() => alignSelection('top')}
          disabled={selectedComponentIds.length === 0}
          data-testid="align-top"
          className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
        >上</button>
        <button
          type="button"
          onClick={() => alignSelection('middle')}
          disabled={selectedComponentIds.length === 0}
          data-testid="align-middle"
          className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
        >中</button>
        <button
          type="button"
          onClick={() => alignSelection('bottom')}
          disabled={selectedComponentIds.length === 0}
          data-testid="align-bottom"
          className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
        >下</button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-slate-400">分布</span>
        <button
          type="button"
          onClick={() => distributeSelection('horizontal')}
          disabled={selectedComponentIds.length < 3}
          data-testid="distribute-horizontal"
          className={`px-2 py-1 rounded ${selectedComponentIds.length < 3 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
        >水平</button>
        <button
          type="button"
          onClick={() => distributeSelection('vertical')}
          disabled={selectedComponentIds.length < 3}
          data-testid="distribute-vertical"
          className={`px-2 py-1 rounded ${selectedComponentIds.length < 3 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
        >垂直</button>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-slate-400">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={e => setShowGrid(e.target.checked)}
            data-testid="toggle-grid"
          />网格
        </label>
        <label className="flex items-center gap-1 text-slate-400">
          <span>网格</span>
          <input
            type="number"
            min={4}
            value={gridSize}
            onChange={e => setGridSize(Math.max(4, Number(e.target.value || 0)))}
            data-testid="grid-size-input"
            className="w-16 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-400">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={e => setSnapToGrid(e.target.checked)}
            data-testid="toggle-snap-grid"
          />吸附网格
        </label>
        <label className="flex items-center gap-1 text-slate-400">
          <input
            type="checkbox"
            checked={snapToEdges}
            onChange={e => setSnapToEdges(e.target.checked)}
            data-testid="toggle-snap-edges"
          />边缘
        </label>
        <label className="flex items-center gap-1 text-slate-400">
          <input
            type="checkbox"
            checked={snapToCenters}
            onChange={e => setSnapToCenters(e.target.checked)}
            data-testid="toggle-snap-centers"
          />中心
        </label>
        <label className="flex items-center gap-1 text-slate-400">
          <span>阈值</span>
          <input
            type="number"
            min={1}
            value={snapThreshold}
            onChange={e => setSnapThreshold(Math.max(1, Number(e.target.value || 0)))}
            data-testid="snap-threshold-input"
            className="w-14 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded"
          />
        </label>
      </div>
    </div>
  );
}
