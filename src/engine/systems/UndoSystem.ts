/**
 * 撤销系统
 * 
 * 自动快照 + 多人握手撤销机制
 */

import type { MatchState, PlayerId, UndoState } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';
import {
    isCommandAllowlisted,
    normalizeCommandAllowlist,
    type CommandAllowlist,
} from './commandAllowlist';

// ============================================================================
// 撤销系统配置
// ============================================================================

export interface UndoSystemConfig {
    /** 最大快照数 */
    maxSnapshots?: number;
    /** 是否需要多人握手 */
    requireApproval?: boolean;
    /** 需要多少人批准 */
    requiredApprovals?: number;

    /**
     * 哪些命令需要进入撤回快照历史。
     * - 不传：默认对所有“非 SYS_/CHEAT_/UI_/DEV_”命令做快照（兼容旧行为，但更危险）。
     * - 传入：只对白名单命令做快照（推荐，最正确方案）。
     */
    snapshotCommandAllowlist?: CommandAllowlist;
}

function clearPendingRequest<TCore>(state: MatchState<TCore>): MatchState<TCore> {
    const { undo } = state.sys;
    return {
        ...state,
        sys: {
            ...state.sys,
            undo: {
                ...undo,
                pendingRequest: undefined,
            },
        },
    };
}

// ============================================================================
// 撤销命令类型
// ============================================================================

export const UNDO_COMMANDS = {
    REQUEST_UNDO: 'SYS_REQUEST_UNDO',
    APPROVE_UNDO: 'SYS_APPROVE_UNDO',
    REJECT_UNDO: 'SYS_REJECT_UNDO',
    CANCEL_UNDO: 'SYS_CANCEL_UNDO',
} as const;

const IS_SERVER = typeof window === 'undefined';

function logUndoServer(label: string, data: Record<string, unknown>): void {
    if (IS_SERVER) {
        console.log(`[UndoServer] ${label}`, data);
    }
}

// ============================================================================
// 创建撤销系统
// ============================================================================

export function createUndoSystem<TCore>(
    config: UndoSystemConfig = {}
): EngineSystem<TCore> {
    const {
        maxSnapshots = 1,
        requireApproval = true,
        requiredApprovals = 1,
        // 由具体游戏提供：哪些“领域命令”会产生可撤回快照。
        // 最正确方案：撤回语义属于游戏规则的一部分，必须在游戏目录内显式声明。
        snapshotCommandAllowlist,
    } = config;
    const normalizedAllowlist = normalizeCommandAllowlist(snapshotCommandAllowlist);

    let pendingSnapshot: MatchState<TCore> | null = null;
    let shouldClearPendingRequest = false;

    return {
        id: SYSTEM_IDS.UNDO,
        name: '撤销系统',
        priority: 10, // 高优先级，在其他系统之前执行

        setup: (): Partial<{ undo: UndoState }> => ({
            undo: {
                snapshots: [],
                maxSnapshots,
            },
        }),

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            pendingSnapshot = null;
            shouldClearPendingRequest = false;

            // 处理撤销相关命令
            if (command.type === UNDO_COMMANDS.REQUEST_UNDO) {
                return handleRequestUndo(state, command.playerId, requireApproval, requiredApprovals);
            }
            if (command.type === UNDO_COMMANDS.APPROVE_UNDO) {
                return handleApproveUndo(state, command.playerId);
            }
            if (command.type === UNDO_COMMANDS.REJECT_UNDO) {
                return handleRejectUndo(state);
            }
            if (command.type === UNDO_COMMANDS.CANCEL_UNDO) {
                return handleCancelUndo(state, command.playerId);
            }

            // 普通命令：准备快照/清理请求（成功后再落地）
            // 目标：只让“会改变对局领域状态”的命令进入撤回历史。
            // 约定：
            // - 系统命令："SYS_" 开头（永不快照）
            // - 作弊命令："CHEAT_" 开头（永不快照）
            // - 纯客户端/交互命令："UI_" / "DEV_" 开头（永不快照）
            const type = command.type;

            if (state.sys.undo.pendingRequest) {
                shouldClearPendingRequest = true;
            }

            // 最正确方案：由具体游戏提供白名单。
            // 不提供时保持兼容（对所有非系统命令快照），但这会导致 UI 高频动作也可能进入快照。
            if (!isCommandAllowlisted(type, normalizedAllowlist, { fallbackToAllowAll: true })) {
                return;
            }

            const snapshotSource = shouldClearPendingRequest
                ? clearPendingRequest(state)
                : state;
            pendingSnapshot = createSnapshot(snapshotSource);
        },

        afterEvents: ({ state, command }): HookResult<TCore> | void => {
            const type = command.type;
            const isUndoCommand = Object.values(UNDO_COMMANDS).includes(type as typeof UNDO_COMMANDS[keyof typeof UNDO_COMMANDS]);
            if (isUndoCommand) return;

            let nextState = state;

            if (shouldClearPendingRequest && nextState.sys.undo.pendingRequest) {
                nextState = clearPendingRequest(nextState);
            }

            if (pendingSnapshot) {
                const beforeCount = nextState.sys.undo.snapshots.length;
                nextState = appendSnapshot(nextState, pendingSnapshot, maxSnapshots);
                if (IS_SERVER) {
                    console.log(`[UndoServer] snapshot-saved command=${type} before=${beforeCount} after=${nextState.sys.undo.snapshots.length}`);
                }
            }

            pendingSnapshot = null;
            shouldClearPendingRequest = false;

            if (nextState !== state) {
                return { state: nextState };
            }
        },
    };
}

// ============================================================================
// 撤销处理函数
// ============================================================================

function createSnapshot<TCore>(
    state: MatchState<TCore>
): MatchState<TCore> {
    const actionLog = state.sys.actionLog ?? { entries: [], maxEntries: 0 };
    const actionLogMaxEntries = actionLog.maxEntries ?? 0;

    const stateToSave = {
        ...state,
        sys: {
            ...state.sys,
            undo: {
                ...state.sys.undo,
                snapshots: [], // 快照中不保存快照历史
            },
            log: {
                ...state.sys.log,
                entries: state.sys.log.entries.slice(-5), // 快照中只保留最近 5 条日志
            },
            eventStream: {
                ...state.sys.eventStream,
                entries: [], // 事件流用于实时触发，撤销时不回放历史
            },
            actionLog: {
                ...actionLog,
                maxEntries: actionLogMaxEntries,
                entries: actionLogMaxEntries > 0
                    ? actionLog.entries.slice(-actionLogMaxEntries)
                    : [],
            },
        },
    };

    return JSON.parse(JSON.stringify(stateToSave)) as MatchState<TCore>;
}

function appendSnapshot<TCore>(
    state: MatchState<TCore>,
    snapshot: MatchState<TCore>,
    maxSnapshots: number
): MatchState<TCore> {
    const snapshots = [...state.sys.undo.snapshots];
    snapshots.push(snapshot);
    
    // 限制快照数量
    while (snapshots.length > maxSnapshots) {
        snapshots.shift();
    }

    return {
        ...state,
        sys: {
            ...state.sys,
            undo: {
                ...state.sys.undo,
                snapshots,
            },
        },
    };
}

function handleRequestUndo<TCore>(
    state: MatchState<TCore>,
    requesterId: PlayerId,
    requireApproval: boolean,
    requiredApprovals: number
): HookResult<TCore> {
    const { undo } = state.sys;

    // 检查是否有可撤销的快照
    if (undo.snapshots.length === 0) {
        logUndoServer('request-rejected', { reason: 'no-snapshots', requesterId });
        return { halt: true, error: '没有可撤销的操作' };
    }

    // 检查是否已有撤销请求
    if (undo.pendingRequest) {
        logUndoServer('request-rejected', { reason: 'pending-exists', requesterId });
        return { halt: true, error: '已有撤销请求待处理' };
    }

    // 如果不需要批准，直接执行撤销
    if (!requireApproval || requiredApprovals === 0) {
        const previousState = undo.snapshots[undo.snapshots.length - 1] as MatchState<TCore>;
        const newSnapshots = undo.snapshots.slice(0, -1);

        logUndoServer('request-approved-direct', {
            requesterId,
            historyLen: undo.snapshots.length,
        });
        
        return {
            halt: true, // 阻止后续执行
            state: {
                ...previousState,
                sys: {
                    ...previousState.sys,
                    undo: {
                        maxSnapshots: undo.maxSnapshots,
                        snapshots: newSnapshots,
                        pendingRequest: undefined,
                    },
                },
            },
        };
    }

    // 创建撤销请求
    logUndoServer('request-created', {
        requesterId,
        requiredApprovals,
        historyLen: undo.snapshots.length,
    });
    return {
        halt: true,
        state: {
            ...state,
            sys: {
                ...state.sys,
                undo: {
                    ...undo,
                    pendingRequest: {
                        requesterId,
                        approvals: [],
                        requiredApprovals,
                    },
                },
            },
        },
    };
}

function handleApproveUndo<TCore>(
    state: MatchState<TCore>,
    approverId: PlayerId
): HookResult<TCore> {
    const { undo } = state.sys;

    if (!undo.pendingRequest) {
        logUndoServer('approve-rejected', { reason: 'no-pending', approverId });
        return { halt: true, error: '没有待处理的撤销请求' };
    }

    if (undo.pendingRequest.approvals.includes(approverId)) {
        logUndoServer('approve-rejected', { reason: 'already-approved', approverId });
        return { halt: true, error: '已批准过该撤销请求' };
    }

    // 添加批准
    const approvals = [...undo.pendingRequest.approvals, approverId];
    
    // 检查是否达到所需批准数
    if (approvals.length >= undo.pendingRequest.requiredApprovals) {
        // 执行撤销
        const previousState = undo.snapshots[undo.snapshots.length - 1] as MatchState<TCore>;
        const newSnapshots = undo.snapshots.slice(0, -1);

        logUndoServer('approve-applied', {
            approverId,
            requesterId: undo.pendingRequest.requesterId,
            approvals: approvals.length,
            beforeSnapshotLen: undo.snapshots.length,
            afterSnapshotLen: newSnapshots.length,
            restoredPhase: (previousState as any).sys?.phase,
        });
        
        return {
            halt: true,
            state: {
                ...previousState,
                sys: {
                    ...previousState.sys,
                    undo: {
                        maxSnapshots: undo.maxSnapshots,
                        snapshots: newSnapshots,
                        pendingRequest: undefined,
                    },
                },
            },
        };
    }

    // 更新批准列表
    logUndoServer('approve-progress', {
        approverId,
        requesterId: undo.pendingRequest.requesterId,
        approvals: approvals.length,
        requiredApprovals: undo.pendingRequest.requiredApprovals,
    });
    return {
        halt: true,
        state: {
            ...state,
            sys: {
                ...state.sys,
                undo: {
                    ...undo,
                    pendingRequest: {
                        ...undo.pendingRequest,
                        approvals,
                    },
                },
            },
        },
    };
}

function handleRejectUndo<TCore>(state: MatchState<TCore>): HookResult<TCore> {
    logUndoServer('request-rejected-by-review', {
        requesterId: state.sys.undo.pendingRequest?.requesterId,
    });
    return {
        halt: true,
        state: {
            ...state,
            sys: {
                ...state.sys,
                undo: {
                    ...state.sys.undo,
                    pendingRequest: undefined,
                },
            },
        },
    };
}

function handleCancelUndo<TCore>(
    state: MatchState<TCore>,
    playerId: PlayerId
): HookResult<TCore> {
    const { undo } = state.sys;

    if (!undo.pendingRequest || undo.pendingRequest.requesterId !== playerId) {
        logUndoServer('cancel-rejected', { reason: 'not-requester', playerId });
        return { halt: true, error: '只有请求者可以取消撤销请求' };
    }

    logUndoServer('request-canceled', { playerId });

    return handleRejectUndo(state);
}

// ============================================================================
// 导出
// ============================================================================

export { SYSTEM_IDS };
