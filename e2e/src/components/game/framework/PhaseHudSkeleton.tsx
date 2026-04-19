/**
 * 阶段提示 HUD 骨架组件
 *
 * 纯逻辑组件，无默认样式。通过 render 函数渲染阶段、状态与当前玩家信息。
 */

import { memo } from 'react';
import type { PhaseHudSkeletonProps } from './types';

export const PhaseHudSkeleton = memo(function PhaseHudSkeleton({
    phases,
    currentPhaseId,
    statusText,
    currentPlayerLabel,
    orientation = 'horizontal',
    className,
    renderPhaseItem,
    renderStatus,
    renderCurrentPlayer,
}: PhaseHudSkeletonProps) {
    const renderPhase = renderPhaseItem
        ?? ((phase, isActive) => (
            <div data-phase-id={phase.id} data-active={isActive}>
                {phase.label}
            </div>
        ));

    const renderStatusText = renderStatus
        ?? ((text?: string) => (text ? <span>{text}</span> : null));

    const renderPlayer = renderCurrentPlayer
        ?? ((label?: string) => (label ? <span>{label}</span> : null));

    return (
        <div
            className={className}
            data-component="phase-hud"
            data-orientation={orientation}
            role="region"
            aria-label="阶段提示"
        >
            <div data-section="phases" role="list">
                {phases.map((phase, index) => {
                    const isActive = phase.id === currentPhaseId;
                    return (
                        <div key={phase.id} role="listitem" aria-current={isActive ? 'step' : undefined}>
                            {renderPhase(phase, isActive, index)}
                        </div>
                    );
                })}
            </div>
            {(statusText || renderStatus) && (
                <div data-section="status">
                    {renderStatusText(statusText)}
                </div>
            )}
            {(currentPlayerLabel || renderCurrentPlayer) && (
                <div data-section="current-player">
                    {renderPlayer(currentPlayerLabel)}
                </div>
            )}
        </div>
    );
});

export default PhaseHudSkeleton;
