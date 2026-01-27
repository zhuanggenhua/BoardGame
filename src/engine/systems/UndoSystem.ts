/**
 * 撤销系统
 * 
 * 自动快照 + 多人握手撤销机制
 */

import type { MatchState, PlayerId, UndoState } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

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
        maxSnapshots = 50,
        requireApproval = true,
        requiredApprovals = 1,
    } = config;

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

            // 普通命令：保存快照
            const newState = saveSnapshot(state, maxSnapshots);
            return { state: newState };
        },
    };
}

// ============================================================================
// 撤销处理函数
// ============================================================================

function saveSnapshot<TCore>(
    state: MatchState<TCore>,
    maxSnapshots: number
): MatchState<TCore> {
    const snapshots = [...state.sys.undo.snapshots];
    
    // 保存当前状态的深拷贝（排除已有快照，避免嵌套导致指数级膨胀）
    // 同时限制日志数量，避免快照过大
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
        },
    };
    snapshots.push(JSON.parse(JSON.stringify(stateToSave)));
    
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
