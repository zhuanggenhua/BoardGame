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

import React, { useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { FxBus } from './useFxBus';

// ============================================================================
// Props
// ============================================================================

export interface FxLayerProps {
  /** FxBus 实例 */
  bus: FxBus;
  /** 格坐标 → 百分比定位转换 */
  getCellPosition: (row: number, col: number) => {
    left: number; top: number; width: number; height: number;
  };
  /** 特效完成回调（可选，用于游戏侧后续逻辑如 flush 摧毁特效） */
  onEffectComplete?: (id: string, cue: string) => void;
  /** 特效 impact 回调（可选，飞行动画到达目标时触发，用于释放视觉状态缓冲等） */
  onEffectImpact?: (id: string, cue: string) => void;
  /** 额外 className */
  className?: string;
}

// ============================================================================
// 组件
// ============================================================================

export const FxLayer: React.FC<FxLayerProps> = ({
  bus,
  getCellPosition,
  onEffectComplete,
  onEffectImpact,
  className = '',
}) => {
  const { activeEffects, removeEffect, registry, fireImpact } = bus;

  // 稳定化外部回调引用
  const onCompleteRef = useRef(onEffectComplete);
  onCompleteRef.current = onEffectComplete;
  const onImpactRef = useRef(onEffectImpact);
  onImpactRef.current = onEffectImpact;

  const handleComplete = useCallback((id: string, cue: string) => {
    onCompleteRef.current?.(id, cue);
    removeEffect(id);
  }, [removeEffect]);

  const handleImpact = useCallback((id: string, cue: string) => {
    fireImpact(id);
    onImpactRef.current?.(id, cue);
  }, [fireImpact]);

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-20 ${className}`}
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
              onComplete={() => handleComplete(event.id, event.cue)}
              onImpact={() => handleImpact(event.id, event.cue)}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};
