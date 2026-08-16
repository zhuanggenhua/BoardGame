/* @vitest-environment happy-dom */
import { render, renderHook, screen } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useMatchRoomBoardRuntime } from '../matchRoomBoardRuntime';

const boardLifecycle = {
    mounts: 0,
    unmounts: 0,
    renders: 0,
};

function MockBoardComponent() {
    boardLifecycle.renders += 1;
    useEffect(() => {
        boardLifecycle.mounts += 1;
        return () => {
            boardLifecycle.unmounts += 1;
        };
    }, []);
    return <div data-testid="board-stub">board</div>;
}

vi.mock('../../components/game/framework', () => ({
    CriticalImageGate: ({
        blockRendering,
        loadingDescription,
        children,
    }: {
        blockRendering: boolean;
        loadingDescription: string;
        children?: ReactNode;
    }) => (
        <div
            data-testid="critical-image-gate"
            data-block-rendering={String(blockRendering)}
            data-loading-description={loadingDescription}
        >
            {children}
        </div>
    ),
}));

vi.mock('../../games/registry', () => ({
    getGameImplementation: () => ({
        board: MockBoardComponent,
        audioConfig: {
            blockingSounds: [],
        },
    }),
}));

describe('useMatchRoomBoardRuntime', () => {
    it('在线预加载门禁切换时，不应把普通 runtime 更新误记成真实卸载重挂', () => {
        boardLifecycle.mounts = 0;
        boardLifecycle.unmounts = 0;
        boardLifecycle.renders = 0;
        const args = {
            gameId: 'fantasyrealms',
            gameImplReady: true,
            locale: 'zh-CN',
            loadingDescription: 'loading',
            shouldBlockBoardOnImagePreload: true,
            onInitialOnlinePreloadReady: vi.fn(),
            onBoardPreloadBlockingChange: vi.fn(),
        };

        const { result, rerender } = renderHook((props: typeof args) => useMatchRoomBoardRuntime(props), {
            initialProps: args,
        });

        const Board = result.current.board;
        const Provider = result.current.boardShell.Provider;
        if (!Board) {
            throw new Error('expected board component');
        }

        const runtimeRender = render(
            <Provider>
                <Board
                    G={{ currentPlayer: '0', stage: 'draw' } as any}
                    ctx={{} as any}
                    moves={{} as any}
                    events={{} as any}
                    playerID="0"
                    matchData={[]}
                    isConnected
                    isActive
                    log={[]}
                    chatMessages={[]}
                    credentials=""
                    matchID="test-match"
                    gameMetadata={undefined}
                    sendChatMessage={vi.fn()}
                    sendChatTyping={vi.fn()}
                    dispatch={vi.fn()}
                />
            </Provider>,
        );

        rerender({
            ...args,
            shouldBlockBoardOnImagePreload: false,
        });
        runtimeRender.rerender(
            <result.current.boardShell.Provider>
                <result.current.board
                    G={{ currentPlayer: '0', stage: 'discard' } as any}
                    ctx={{} as any}
                    moves={{} as any}
                    events={{} as any}
                    playerID="0"
                    matchData={[]}
                    isConnected
                    isActive
                    log={[]}
                    chatMessages={[]}
                    credentials=""
                    matchID="test-match"
                    gameMetadata={undefined}
                    sendChatMessage={vi.fn()}
                    sendChatTyping={vi.fn()}
                    dispatch={vi.fn()}
                />
            </result.current.boardShell.Provider>,
        );

        expect(boardLifecycle.mounts).toBe(1);
        expect(boardLifecycle.unmounts).toBe(0);
        expect(boardLifecycle.renders).toBeGreaterThanOrEqual(2);

        runtimeRender.unmount();
        expect(boardLifecycle.unmounts).toBe(1);
    });

    it('在线预加载门禁切换时，不应重建包裹后的 Board 组件类型', () => {
        const args = {
            gameId: 'fantasyrealms',
            gameImplReady: true,
            locale: 'zh-CN',
            loadingDescription: 'loading',
            shouldBlockBoardOnImagePreload: true,
            onInitialOnlinePreloadReady: vi.fn(),
            onBoardPreloadBlockingChange: vi.fn(),
        };

        const { result, rerender } = renderHook((props: typeof args) => useMatchRoomBoardRuntime(props), {
            initialProps: args,
        });

        const firstBoard = result.current.board;
        expect(firstBoard).not.toBeNull();

        rerender({
            ...args,
            shouldBlockBoardOnImagePreload: false,
        });

        expect(result.current.board).toBe(firstBoard);
    });

    it('在线预加载门禁切换时，不应重建 BoardRuntimeProvider 组件类型', () => {
        const args = {
            gameId: 'fantasyrealms',
            gameImplReady: true,
            locale: 'zh-CN',
            loadingDescription: 'loading',
            shouldBlockBoardOnImagePreload: true,
            onInitialOnlinePreloadReady: vi.fn(),
            onBoardPreloadBlockingChange: vi.fn(),
        };

        const { result, rerender } = renderHook((props: typeof args) => useMatchRoomBoardRuntime(props), {
            initialProps: args,
        });

        const firstProvider = result.current.boardShell.Provider;
        rerender({
            ...args,
            shouldBlockBoardOnImagePreload: false,
        });

        expect(result.current.boardShell.Provider).toBe(firstProvider);
    });

    it('在线预加载门禁切换时，包裹层应在当次渲染拿到最新 blockRendering 值', () => {
        const args = {
            gameId: 'fantasyrealms',
            gameImplReady: true,
            locale: 'zh-CN',
            loadingDescription: 'loading',
            shouldBlockBoardOnImagePreload: true,
            onInitialOnlinePreloadReady: vi.fn(),
            onBoardPreloadBlockingChange: vi.fn(),
        };

        const { result, rerender } = renderHook((props: typeof args) => useMatchRoomBoardRuntime(props), {
            initialProps: args,
        });

        const renderRuntimeTree = () => {
            const Board = result.current.board;
            const Provider = result.current.boardShell.Provider;
            if (!Board) {
                throw new Error('expected board component');
            }
            return render(
                <Provider>
                    <Board
                        G={{} as any}
                        ctx={{} as any}
                        moves={{} as any}
                        events={{} as any}
                        playerID="0"
                        matchData={[]}
                        isConnected
                        isActive
                        log={[]}
                        chatMessages={[]}
                        credentials=""
                        matchID="test-match"
                        gameMetadata={undefined}
                        sendChatMessage={vi.fn()}
                        sendChatTyping={vi.fn()}
                        dispatch={vi.fn()}
                    />
                </Provider>,
            );
        };

        const runtimeRender = renderRuntimeTree();
        expect(screen.getByTestId('critical-image-gate')).toHaveAttribute('data-block-rendering', 'true');

        rerender({
            ...args,
            shouldBlockBoardOnImagePreload: false,
        });
        runtimeRender.rerender(
            <result.current.boardShell.Provider>
                <result.current.board
                    G={{} as any}
                    ctx={{} as any}
                    moves={{} as any}
                    events={{} as any}
                    playerID="0"
                    matchData={[]}
                    isConnected
                    isActive
                    log={[]}
                    chatMessages={[]}
                    credentials=""
                    matchID="test-match"
                    gameMetadata={undefined}
                    sendChatMessage={vi.fn()}
                    sendChatTyping={vi.fn()}
                    dispatch={vi.fn()}
                />
            </result.current.boardShell.Provider>,
        );

        expect(screen.getByTestId('critical-image-gate')).toHaveAttribute('data-block-rendering', 'false');
    });
});
