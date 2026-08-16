import type { FxBus } from './useFxBus';
import type { RenderBackendCapabilities } from '../renderPipeline/types';

export interface FxBackendHost {
  element: HTMLElement;
}

export interface FxCellBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type FxCellPositionResolver = (row: number, col: number) => FxCellBox;

export interface FxBackendRuntime {
  bus: FxBus;
  getCellPosition: FxCellPositionResolver;
  completeEffect: (id: string, cue: string) => void;
  fireImpact: (id: string, cue: string) => void;
}

export interface FxRenderBackendInstance {
  update?: (runtime: FxBackendRuntime) => void;
  destroy: () => void;
}

export interface FxRenderBackend {
  kind: 'canvas2d' | 'webgl' | 'pixi' | 'phaser' | 'cocos' | 'custom';
  capabilities?: RenderBackendCapabilities;
  mount: (host: FxBackendHost, runtime: FxBackendRuntime) => FxRenderBackendInstance;
}
