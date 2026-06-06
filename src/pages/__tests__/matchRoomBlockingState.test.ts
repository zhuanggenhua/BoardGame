import { describe, expect, it, vi } from 'vitest';
import { resolveMatchRoomBlockingState } from '../matchRoomBlockingResolver';

const noop = () => {};

function buildArgs(overrides: Partial<Parameters<typeof resolveMatchRoomBlockingState>[0]> = {}) {
    return {
        gameId: 'smashup',
        gameNamespaceError: null,
        retryGameNamespaceLoad: noop,
        gameImplementationError: null,
        retryGameImplementationLoad: noop,
        isGameNamespaceReady: true,
        gameImplReady: true,
        isAutoJoining: false,
        shouldAutoJoin: false,
        credentials: 'cred-0',
        autoJoinError: null,
        preparingMatchText: '准备中',
        loadingGameModuleText: '加载模块中',
        joiningRoomText: '加入房间中',
        joiningRoomProgressText: '正在加入',
        backToLobbyText: '返回大厅',
        navigateBackToLobby: noop,
        ...overrides,
    };
}

describe('resolveMatchRoomBlockingState', () => {
    it('优先返回 namespace error，避免后续状态掩盖模块加载失败', () => {
        const retry = vi.fn();
        const state = resolveMatchRoomBlockingState(buildArgs({
            gameNamespaceError: 'namespace_failed',
            retryGameNamespaceLoad: retry,
            isGameNamespaceReady: false,
        }));

        expect(state).toEqual({
            kind: 'namespace-error',
            gameId: 'smashup',
            error: 'namespace_failed',
            onRetry: retry,
        });
    });

    it('namespace 已就绪但 implementation 未就绪时，应返回统一 loading state', () => {
        const state = resolveMatchRoomBlockingState(buildArgs({
            gameImplReady: false,
        }));

        expect(state).toEqual({
            kind: 'loading',
            description: '准备中',
            progressText: '加载模块中',
        });
    });

    it('implementation 加载失败时，应返回明确错误态而不是继续显示 loading', () => {
        const retry = vi.fn();
        const state = resolveMatchRoomBlockingState(buildArgs({
            gameImplementationError: 'impl_failed',
            retryGameImplementationLoad: retry,
            gameImplReady: false,
        }));

        expect(state).toEqual({
            kind: 'implementation-error',
            gameId: 'smashup',
            error: 'impl_failed',
            onRetry: retry,
        });
    });

    it('auto join 失败时，应返回错误态而不是继续显示 joining loading', () => {
        const back = vi.fn();
        const state = resolveMatchRoomBlockingState(buildArgs({
            shouldAutoJoin: true,
            credentials: undefined,
            autoJoinError: 'join_failed',
            navigateBackToLobby: back,
        }));

        expect(state).toEqual({
            kind: 'autojoin-error',
            message: 'join_failed',
            onBack: back,
            backLabel: '返回大厅',
        });
    });

    it('无阻塞条件时，应返回 ready', () => {
        const state = resolveMatchRoomBlockingState(buildArgs());
        expect(state).toEqual({ kind: 'ready' });
    });
});
