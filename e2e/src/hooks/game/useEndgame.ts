/**
 * useEndgame — 统一结束页面逻辑 hook
 *
 * 封装 useRematch + registerReset + EndgameOverlay props 组装，
 * 消除每个游戏 Board 中的重复样板代码。
 *
 * 用法：
 * ```tsx
 * const endgame = useEndgame({ isGameOver, result, playerID, reset, matchData, isMultiplayer });
 * // ...
 * <EndgameOverlay {...endgame.overlayProps} renderContent={...} />
 * ```
 */

import { useEffect } from 'react';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';
import type { GameOverResult } from '../../engine/types';
import type { MatchPlayerInfo } from '../../engine/transport/protocol';
import type { EndgameOverlayProps } from '../../components/game/framework/widgets/EndgameOverlay';

export interface UseEndgameOptions {
    /** sys.gameover 结果 */
    result: GameOverResult | undefined;
    /** 当前玩家 ID */
    playerID: string | null;
    /** 重置回调（来自 BoardProps） */
    reset?: () => void;
    /** 对局玩家信息（来自 BoardProps） */
    matchData?: MatchPlayerInfo[];
    /** 是否多人模式（来自 BoardProps） */
    isMultiplayer?: boolean;
    /** 自定义 isGameOver 判定（如 SummonerWars 需要等动画播完） */
    isGameOverOverride?: boolean;
}

export interface UseEndgameReturn {
    /** 重赛投票状态 */
    rematchState: ReturnType<typeof useRematch>['state'];
    /** 投票函数 */
    vote: () => void;
    /** 是否旁观者 */
    isSpectator: boolean;
    /** 直接展开到 EndgameOverlay 的 props（不含 renderContent/renderActions） */
    overlayProps: Pick<
        EndgameOverlayProps,
        'isGameOver' | 'result' | 'playerID' | 'reset' | 'isMultiplayer' | 'totalPlayers' | 'rematchState' | 'onVote'
    >;
}

export function useEndgame(options: UseEndgameOptions): UseEndgameReturn {
    const { result, playerID, reset, matchData, isMultiplayer } = options;
    const { state: rematchState, vote, registerReset } = useRematch();
    const gameMode = useGameMode();
    const isSpectator = !!gameMode?.isSpectator;

    const isGameOver = options.isGameOverOverride !== undefined
        ? options.isGameOverOverride
        : !!result;

    // 注册 reset 回调（双方投票后由 socket 触发）
    useEffect(() => {
        if (!isSpectator && reset) {
            registerReset(reset);
        }
    }, [reset, registerReset, isSpectator]);

    return {
        rematchState,
        vote,
        isSpectator,
        overlayProps: {
            isGameOver,
            result,
            playerID,
            reset: isSpectator ? undefined : reset,
            isMultiplayer: isSpectator ? false : isMultiplayer,
            totalPlayers: matchData?.length,
            rematchState,
            onVote: isSpectator ? undefined : vote,
        },
    };
}
