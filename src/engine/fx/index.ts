/**
 * 引擎级 FX 系统
 *
 * 提供 cue-based 的特效注册、调度与渲染框架。
 * 游戏侧通过 FxRegistry 注册渲染器，通过 FxBus push 事件触发特效。
 *
 * @example
 * ```tsx
 * // 1. 创建注册表并注册渲染器（游戏初始化时）
 * const registry = new FxRegistry();
 * registry.register('fx.summon', SummonRenderer);
 *
 * // 2. 创建 bus（React 组件内）
 * const fxBus = useFxBus(registry);
 *
 * // 3. 推入特效
 * fxBus.push('fx.summon', { cell: { row: 2, col: 3 }, intensity: 'strong' });
 *
 * // 4. 渲染
 * <FxLayer bus={fxBus} getCellPosition={getCellPosition} />
 * ```
 */

// 类型
export type {
  FxCue,
  FxSpace,
  FxCellCoord,
  FxSurfaceId,
  FxSurfaceKind,
  FxAnchorKind,
  FxAnchorMode,
  FxAnchorRef,
  FxSurfaceBox,
  FxAnchorSnapshot,
  FxAnchorRegistration,
  FxContext,
  FxQuality,
  FxAreaPolicy,
  FxEstimatedCost,
  FxPerformanceBudget,
  FxParams,
  FxEvent,
  FxEventInput,
  FxRendererProps,
  FxRenderer,
  FxRendererOptions,
  FxRegistryEntry,
  FxSoundConfig,
  FxShakeConfig,
  FeedbackPack,
} from './types';

export {
  useFxAnchorRegistry,
  fxAnchorRef,
  type FxAnchorRegistry,
} from './anchors';

export {
  resolveFxQuality,
  resolveFxDpr,
  setupCanvas2d,
  type FxDprOptions,
  type FxCanvasSize,
} from './performance';

export {
  createFxPathBox,
  createFxScaledCellBox,
  createFxScreenPathBox,
  type FxBox,
  type FxBoxStyle,
  type FxPathBox,
  type FxPercentPoint,
  type FxScreenPathBox,
  type FxScreenPoint,
} from './layout';

export {
  subscribeFxFrame,
  scheduleFxFrameCallback,
  getFxFrameSubscriberCount,
  resetFxFrameClockForTests,
  type FxFrame,
  type FxFrameCallback,
  type FxFrameScheduledCallback,
  type FxFrameSubscription,
} from './frameClock';

export type {
  FxBackendHost,
  FxBackendRuntime,
  FxCellBox,
  FxCellPositionResolver,
  FxRenderBackend,
  FxRenderBackendInstance,
} from './backend';

// 注册表
export { FxRegistry } from './FxRegistry';

// 调度 Hook
export { useFxBus, type FxBus, type FxBusOptions, type FxSoundPlayer, type FxShakeTrigger, type FxSequenceStep } from './useFxBus';

// 渲染层
export { FxLayer, type FxLayerProps } from './FxLayer';

// Shader 子模块
export * from './shader';
