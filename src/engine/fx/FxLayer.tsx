/**
 * FxLayer — 通用特效渲染层
 *
 * 职责：
 * - 遍历 FxBus 中的活跃特效
 * - 根据 cue 查注册表获取 FxRenderer
 * - 渲染 renderer 并传入标准化 props（含 onImpact）
 * - onImpact 自动触发反馈包中 timing='on-impact' 的音效和震动
 *
 * 替代原 `BoardEffectsLayer` 的 switch/case 分发逻辑。
 * 额外功能（如召唤暗角遮罩）由游戏侧在 FxLayer 外部自行处理。
 */

import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { FxBus } from './useFxBus';
import type { FxBackendRuntime, FxCellPositionResolver, FxRenderBackend } from './backend';

// ============================================================================
// Props
// ============================================================================

export interface FxLayerProps {
  /** FxBus 实例 */
  bus: FxBus;
  /** 格坐标 → 百分比定位转换 */
  getCellPosition: FxCellPositionResolver;
  /** 可替换 FX 后端。未传时走现有 React 渲染器注册表。 */
  backend?: FxRenderBackend;
  /** 特效完成回调（可选，用于游戏侧后续逻辑如 flush 摧毁特效） */
  onEffectComplete?: (id: string, cue: string) => void;
  /** 特效 impact 回调（可选，飞行动画到达目标时触发，用于释放视觉状态缓冲等） */
  onEffectImpact?: (id: string, cue: string) => void;
  /** 额外 className */
  className?: string;
  /** 测试语义标记，不参与视觉布局 */
  'data-testid'?: string;
}

// ============================================================================
// 组件
// ============================================================================

function useFxLayerEffects(bus: FxBus) {
  const subscribe = useCallback((listener: () => void) => {
    const unsubscribe = bus.subscribe?.(listener) ?? (() => {});
    listener();
    return unsubscribe;
  }, [bus]);
  const getSnapshot = useCallback(() => (
    bus.getSnapshot?.() ?? bus.activeEffects
  ), [bus]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useFxLayerLifecycle({
  bus,
  onEffectComplete,
  onEffectImpact,
}: Pick<FxLayerProps, 'bus' | 'onEffectComplete' | 'onEffectImpact'>) {
  const activeEffects = useFxLayerEffects(bus);
  const onCompleteRef = useRef(onEffectComplete);
  const onImpactRef = useRef(onEffectImpact);
  onCompleteRef.current = onEffectComplete;
  onImpactRef.current = onEffectImpact;

  const previousActiveEffectsRef = useRef(new Map<string, string>());
  const completedEffectIdsRef = useRef(new Set<string>());
  const impactedEffectIdsRef = useRef(new Set<string>());

  const fireImpact = useCallback((id: string, cue: string) => {
    if (completedEffectIdsRef.current.has(id)) return;
    if (impactedEffectIdsRef.current.has(id)) return;

    impactedEffectIdsRef.current.add(id);
    bus.fireImpact(id);
    onImpactRef.current?.(id, cue);
  }, [bus]);

  const completeEffect = useCallback((id: string, cue: string) => {
    if (completedEffectIdsRef.current.has(id)) return;

    if (!impactedEffectIdsRef.current.has(id)) {
      fireImpact(id, cue);
    }
    completedEffectIdsRef.current.add(id);
    impactedEffectIdsRef.current.delete(id);
    onCompleteRef.current?.(id, cue);
    bus.removeEffect(id);
  }, [bus, fireImpact]);

  useEffect(() => {
    const previousActiveEffects = previousActiveEffectsRef.current;
    const nextActiveEffects = new Map(activeEffects.map((effect) => [effect.id, effect.cue]));

    for (const [id, cue] of previousActiveEffects) {
      if (nextActiveEffects.has(id)) continue;

      const completedByRenderer = completedEffectIdsRef.current.delete(id);
      if (completedByRenderer) {
        impactedEffectIdsRef.current.delete(id);
        continue;
      }

      const impactedByRenderer = impactedEffectIdsRef.current.delete(id);
      if (!impactedByRenderer) {
        fireImpact(id, cue);
        impactedEffectIdsRef.current.delete(id);
      }
      onCompleteRef.current?.(id, cue);
    }

    previousActiveEffectsRef.current = nextActiveEffects;
  }, [activeEffects, fireImpact]);

  return {
    activeEffects,
    completeEffect,
    fireImpact,
  };
}

export const FxLayer: React.FC<FxLayerProps> = ({
  bus,
  getCellPosition,
  backend,
  onEffectComplete,
  onEffectImpact,
  className = '',
  'data-testid': testId,
}) => {
  if (backend) {
    return (
      <FxBackendLayer
        bus={bus}
        getCellPosition={getCellPosition}
        backend={backend}
        onEffectComplete={onEffectComplete}
        onEffectImpact={onEffectImpact}
        className={className}
        data-testid={testId}
      />
    );
  }

  return (
    <ReactFxLayer
      bus={bus}
      getCellPosition={getCellPosition}
      onEffectComplete={onEffectComplete}
      onEffectImpact={onEffectImpact}
      className={className}
      data-testid={testId}
    />
  );
};

const ReactFxLayer: React.FC<Omit<FxLayerProps, 'backend'>> = ({
  bus,
  getCellPosition,
  onEffectComplete,
  onEffectImpact,
  className = '',
  'data-testid': testId,
}) => {
  const { activeEffects, completeEffect, fireImpact } = useFxLayerLifecycle({
    bus,
    onEffectComplete,
    onEffectImpact,
  });
  const { registry } = bus;

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-20 ${className}`}
      data-testid={testId}
      data-fx-active-count={activeEffects.length}
      data-fx-active-cues={activeEffects.map(effect => effect.cue).join(',')}
      style={{ overflow: 'visible' }}
    >
      <AnimatePresence>
        {activeEffects.map(event => {
          const entry = registry.resolve(event.cue);
          if (!entry) {
            console.warn('[FxLayer] 未找到 cue 注册:', event.cue);
            return null;
          }

          const Renderer = entry.renderer;
          return (
            <Renderer
              key={event.id}
              event={event}
              getCellPosition={getCellPosition}
              onComplete={() => completeEffect(event.id, event.cue)}
              onImpact={() => fireImpact(event.id, event.cue)}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};

const FxBackendLayer: React.FC<Required<Pick<FxLayerProps, 'bus' | 'getCellPosition' | 'backend'>> & Pick<FxLayerProps, 'onEffectComplete' | 'onEffectImpact' | 'className' | 'data-testid'>> = ({
  bus,
  getCellPosition,
  backend,
  onEffectComplete,
  onEffectImpact,
  className = '',
  'data-testid': testId,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReturnType<FxRenderBackend['mount']> | null>(null);
  const { completeEffect, fireImpact } = useFxLayerLifecycle({
    bus,
    onEffectComplete,
    onEffectImpact,
  });

  const runtime: FxBackendRuntime = {
    bus,
    getCellPosition,
    completeEffect,
    fireImpact,
  };
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  React.useLayoutEffect(() => {
    const element = hostRef.current;
    if (!element) return undefined;

    const instance = backend.mount({ element }, runtimeRef.current);
    instanceRef.current = instance;

    return () => {
      instanceRef.current = null;
      try {
        instance.destroy();
      } catch (error) {
        console.error('[FxLayer] FX backend destroy failed:', error);
      }
    };
  }, [backend]);

  React.useLayoutEffect(() => {
    instanceRef.current?.update?.(runtime);
  }, [runtime]);

  return (
    <div
      ref={hostRef}
      className={`absolute inset-0 pointer-events-none z-20 ${className}`}
      data-testid={testId}
      data-fx-backend={backend.kind}
      style={{ overflow: 'visible' }}
    />
  );
};
