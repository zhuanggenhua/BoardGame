/**
 * useIsInteractionBusy - 判断当前是否有活跃的引擎交互
 *
 * 面向100个游戏的通用 Hook：所有"等待玩家输入"的状态必须走 sys.interaction，
 * 游戏层通过此 Hook 判断是否应该阻止其他操作（如打出手牌、点击格子等）。
 *
 * 使用方式：
 * ```tsx
 * const isBusy = useIsInteractionBusy(G, playerID);
 * <HandArea disableInteraction={isBusy} />
 * ```
 *
 * 历史债务说明：
 * summonerwars 有部分 UI 状态机（abilityMode/hasActiveEventMode）尚未迁移到
 * sys.interaction，需在 Board 层额外 || 合并：
 * ```tsx
 * const engineBusy = useIsInteractionBusy(G, playerID);
 * const isBusy = engineBusy || !!abilityMode || interaction.hasActiveEventMode;
 * ```
 * 迁移完成后可直接使用 useIsInteractionBusy，删除手动合并逻辑。
 */

import { useMemo } from 'react';
import type { MatchState } from '../../../../engine/types';

/**
 * 判断当前是否有活跃的引擎交互（sys.interaction.current）属于指定玩家。
 *
 * @param G - 游戏状态
 * @param playerID - 当前玩家 ID（null 表示本地模式，视为无交互拦截）
 * @returns 是否有活跃交互需要响应
 */
export function useIsInteractionBusy<TCore>(
    G: MatchState<TCore>,
    playerID: string | null,
): boolean {
    return useMemo(() => {
        if (!playerID) return false;
        const current = G.sys.interaction?.current;
        if (!current) return false;
        return current.playerId === playerID;
    }, [G.sys.interaction?.current, playerID]);
}
