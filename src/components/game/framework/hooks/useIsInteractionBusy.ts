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
 * 若某个游戏还有私有 UI 状态机尚未迁移到 sys.interaction，
 * 只能在该游戏 Board 层额外合并私有 busy 状态，不能写进框架 Hook：
 * ```tsx
 * const engineBusy = useIsInteractionBusy(G, playerID);
 * const isBusy = engineBusy || hasGamePrivateBusyState;
 * ```
 * 迁移完成后可直接使用 useIsInteractionBusy，删除手动合并逻辑。
 */

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
    if (!playerID) return false;
    const current = G.sys.interaction?.current;
    if (!current) return false;
    return current.playerId === playerID;
}
