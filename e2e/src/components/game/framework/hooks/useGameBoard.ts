/**
 * useGameBoard - 游戏 Board 基础状态管理 Hook
 *
 * 封装游戏常用状态判断逻辑。
 */

import { useMemo } from 'react';
import type { UseGameBoardReturn } from '../../../../core/ui/hooks';
import type { MatchState } from '../../../../engine/types';

export interface UseGameBoardConfig<G> {
    /** 游戏状态（MatchState） */
    G: MatchState<G>;
    /** 当前玩家 ID */
    playerID: string | null | undefined;
    /** 是否是多人模式 */
    isMultiplayer?: boolean;
}

/**
 * 游戏 Board 基础状态管理
 *
 * @example
 * ```tsx
 * const { isMyTurn, currentPhase, canInteract } = useGameBoard({
 *   G, playerID, isMultiplayer
 * });
 * ```
 */
export function useGameBoard<G>({
    G,
    playerID,
    isMultiplayer = false,
}: UseGameBoardConfig<G>): UseGameBoardReturn<MatchState<G>> {
    return useMemo(() => {
        const currentPlayer = (G.core as { currentPlayer?: string | number } | undefined)?.currentPlayer;
        const normalizedPlayerID = playerID ?? null;

        // 判断是否是当前玩家的回合
        const isMyTurn = isMultiplayer
            ? normalizedPlayerID !== null && String(currentPlayer) === normalizedPlayerID
            : true; // 本地模式下始终可操作

        // 获取当前阶段
        const currentPhase = G.sys?.phase ?? '';

        // 判断是否可以进行交互
        const canInteract = !G.sys?.gameover && isMyTurn;

        return {
            G,
            isMyTurn,
            currentPhase,
            canInteract,
            playerID: normalizedPlayerID,
        };
    }, [G, playerID, isMultiplayer]);
}

export default useGameBoard;
