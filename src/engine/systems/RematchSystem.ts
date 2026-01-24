/**
 * 重赛系统
 * 
 * 双方投票同房重开机制
 */

import type { MatchState, PlayerId, RematchState } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

// ============================================================================
// 重赛系统配置
// ============================================================================

export interface RematchSystemConfig {
    /** 是否允许取消投票（toggle 行为） */
    allowToggle?: boolean;
}

// ============================================================================
// 重赛命令类型
// ============================================================================

export const REMATCH_COMMANDS = {
    VOTE_REMATCH: 'SYS_VOTE_REMATCH',
} as const;

// ============================================================================
// 创建重赛系统
// ============================================================================

export function createRematchSystem<TCore>(
    config: RematchSystemConfig = {}
): EngineSystem<TCore> {
    const { allowToggle = true } = config;

    return {
        id: SYSTEM_IDS.REMATCH,
        name: '重赛系统',
        priority: 5, // 高优先级

        setup: (): Partial<{ rematch: RematchState }> => ({
            rematch: {
                votes: {},
                ready: false,
            },
        }),

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            if (command.type === REMATCH_COMMANDS.VOTE_REMATCH) {
                return handleVoteRematch(state, command.playerId, allowToggle);
            }
        },
    };
}

// ============================================================================
// 投票处理函数
// ============================================================================

function handleVoteRematch<TCore>(
    state: MatchState<TCore>,
    playerId: PlayerId,
    allowToggle: boolean
): HookResult<TCore> {
    const { rematch } = state.sys;

    // 已经准备好，不再接受投票
    if (rematch.ready) {
        return { halt: true, error: '双方已确认，即将重开' };
    }

    const currentVote = rematch.votes[playerId] ?? false;
    const newVote = allowToggle ? !currentVote : true;

    const newVotes = {
        ...rematch.votes,
        [playerId]: newVote,
    };

    // 检查是否双方都已投票
    const votedPlayers = Object.entries(newVotes).filter(([, v]) => v).map(([p]) => p);
    const ready = votedPlayers.length >= 2;

    return {
        halt: true,
        state: {
            ...state,
            sys: {
                ...state.sys,
                rematch: {
                    votes: newVotes,
                    ready,
                },
            },
        },
    };
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 重置重赛状态（用于 reset 后清理）
 */
export function resetRematchState<TCore>(state: MatchState<TCore>): MatchState<TCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            rematch: {
                votes: {},
                ready: false,
            },
        },
    };
}

/**
 * 获取玩家投票状态
 */
export function getPlayerVote(state: MatchState<unknown>, playerId: PlayerId): boolean {
    return state.sys.rematch?.votes?.[playerId] ?? false;
}

/**
 * 检查是否准备重开
 */
export function isRematchReady(state: MatchState<unknown>): boolean {
    return state.sys.rematch?.ready ?? false;
}

/**
 * 获取已投票的玩家列表
 */
export function getVotedPlayers(state: MatchState<unknown>): PlayerId[] {
    const votes = state.sys.rematch?.votes ?? {};
    return Object.entries(votes).filter(([, v]) => v).map(([p]) => p);
}
