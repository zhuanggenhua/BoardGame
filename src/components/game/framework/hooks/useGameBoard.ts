/**
 * useGameBoard - 游戏 Board 基础状态管理 Hook
 *
 * 封装 boardgame.io 的常用状态判断逻辑。
 */

import { useMemo } from 'react';
import type { Ctx } from 'boardgame.io';
import type { UseGameBoardReturn } from '../../../../core/ui/hooks';

export interface UseGameBoardConfig<G> {
    /** 游戏状态 */
    G: G;
    /** boardgame.io 上下文 */
    ctx: Ctx;
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
 *   G, ctx, playerID, isMultiplayer
 * });
 * ```
 */
export function useGameBoard<G>({
    G,
    ctx,
    playerID,
    isMultiplayer = false,
}: UseGameBoardConfig<G>): UseGameBoardReturn<G> {
    return useMemo(() => {
        const currentPlayer = ctx.currentPlayer;
        const normalizedPlayerID = playerID ?? null;

        // 判断是否是当前玩家的回合
        const isMyTurn = isMultiplayer
            ? normalizedPlayerID !== null && currentPlayer === normalizedPlayerID
            : true; // 本地模式下始终可操作

        // 获取当前阶段
        const currentPhase = ctx.phase ?? '';

        // 判断是否可以进行交互
        const canInteract = !ctx.gameover && isMyTurn;

        return {
            G,
            ctx,
            isMyTurn,
            currentPhase,
            canInteract,
            playerID: normalizedPlayerID,
        };
    }, [G, ctx, playerID, isMultiplayer]);
}

export default useGameBoard;
