/**
 * 玩家面板骨架组件
 *
 * 纯逻辑组件，无默认样式。通过 render 函数渲染资源和状态效果。
 */

import { memo } from 'react';
import type { PlayerPanelSkeletonProps } from './types';

/**
 * 玩家面板骨架
 *
 * @example
 * ```tsx
 * <PlayerPanelSkeleton
 *   player={{
 *     playerId: '0',
 *     displayName: 'Player 1',
 *     resources: { health: 50, energy: 3 },
 *     statusEffects: { poison: 2 },
 *   }}
 *   isCurrentPlayer={true}
 *   renderResource={(key, value) => (
 *     <div className="flex gap-1">
 *       <span>{key}:</span>
 *       <span>{value}</span>
 *     </div>
 *   )}
 *   renderStatusEffect={(effectId, stacks) => (
 *     <div className="badge">{effectId} x{stacks}</div>
 *   )}
 * />
 * ```
 */
export const PlayerPanelSkeleton = memo(function PlayerPanelSkeleton({
    player,
    isCurrentPlayer = false,
    className,
    renderResource,
    renderStatusEffect,
    renderPlayerInfo,
}: PlayerPanelSkeletonProps) {
    const resourceEntries = Object.entries(player.resources);
    const statusEntries = Object.entries(player.statusEffects ?? {}).filter(
        ([, stacks]) => stacks > 0
    );

    return (
        <div
            className={className}
            data-player-id={player.playerId}
            data-current-player={isCurrentPlayer}
            role="region"
            aria-label={`Player ${player.displayName ?? player.playerId} panel`}
        >
            {/* 玩家信息区域 */}
            {renderPlayerInfo && (
                <div data-section="player-info">
                    {renderPlayerInfo(player)}
                </div>
            )}

            {/* 资源区域 */}
            {resourceEntries.length > 0 && renderResource && (
                <div data-section="resources" className="flex flex-col gap-[0.5vw]" role="list" aria-label="Resources">
                    {resourceEntries.map(([key, value]) => (
                        <div key={key} role="listitem" data-resource={key}>
                            {renderResource(key, value)}
                        </div>
                    ))}
                </div>
            )}

            {/* 状态效果区域 */}
            {statusEntries.length > 0 && renderStatusEffect && (
                <div data-section="status-effects" role="list" aria-label="Status effects">
                    {statusEntries.map(([effectId, stacks]) => (
                        <div key={effectId} role="listitem" data-effect={effectId}>
                            {renderStatusEffect(effectId, stacks)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default PlayerPanelSkeleton;
