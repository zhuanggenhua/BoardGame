/**
 * 阶段指示器骨架组件
 *
 * 纯逻辑组件，无默认样式。通过 renderPhaseItem 函数渲染各阶段样式。
 */

import { memo } from 'react';
import type { PhaseIndicatorSkeletonProps } from './types';

/**
 * 阶段指示器骨架
 *
 * @example
 * ```tsx
 * <PhaseIndicatorSkeleton
 *   phases={[
 *     { id: 'upkeep', label: '维护阶段' },
 *     { id: 'main', label: '主阶段' },
 *   ]}
 *   currentPhaseId="main"
 *   renderPhaseItem={(phase, isActive) => (
 *     <div className={isActive ? 'bg-amber-500' : 'bg-gray-500'}>
 *       {phase.label}
 *     </div>
 *   )}
 * />
 * ```
 */
export const PhaseIndicatorSkeleton = memo(function PhaseIndicatorSkeleton({
    phases,
    currentPhaseId,
    orientation = 'vertical',
    className,
    renderPhaseItem,
}: PhaseIndicatorSkeletonProps) {
    // 默认渲染函数（仅用于调试，生产中应总是提供 renderPhaseItem）
    const defaultRenderPhaseItem = (phase: typeof phases[0], isActive: boolean) => (
        <div data-phase-id={phase.id} data-active={isActive}>
            {phase.label}
        </div>
    );

    const render = renderPhaseItem ?? defaultRenderPhaseItem;

    return (
        <div
            className={className}
            data-orientation={orientation}
            role="list"
            aria-label="游戏阶段"
        >
            {phases.map((phase, index) => {
                const isActive = phase.id === currentPhaseId;
                return (
                    <div
                        key={phase.id}
                        role="listitem"
                        aria-current={isActive ? 'step' : undefined}
                    >
                        {render(phase, isActive, index)}
                    </div>
                );
            })}
        </div>
    );
});

export default PhaseIndicatorSkeleton;
