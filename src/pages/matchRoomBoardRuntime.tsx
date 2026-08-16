import {
    createContext,
    useContext,
    useMemo,
    useRef,
    type ComponentType,
    type MutableRefObject,
    type ReactNode,
} from 'react';
import { getGameImplementation } from '../games/registry';
import type { GameBoardProps } from '../engine/transport/protocol';
import type { GameBoardRenderer } from '../engine/boardRenderer';
import { CriticalImageGate } from '../components/game/framework';
import type { SoundKey } from '../lib/audio/types';

type MatchRoomBoardGateRuntime = {
    locale: string;
    loadingDescription: string;
    shouldBlockBoardOnImagePreload: boolean;
    blockingAudioKeys: SoundKey[];
    onReady: () => void;
    onBlockingChange: (blocking: boolean) => void;
};

export type MatchRoomBoardShell = {
    Provider: ComponentType<{ children?: ReactNode }>;
};

export const MatchRoomBoardGateRuntimeContext = createContext<MutableRefObject<MatchRoomBoardGateRuntime> | null>(null);

export function useMatchRoomBoardRuntime(args: {
    gameId?: string;
    gameImplReady: boolean;
    locale: string;
    loadingDescription: string;
    shouldBlockBoardOnImagePreload: boolean;
    onInitialOnlinePreloadReady: () => void;
    onBoardPreloadBlockingChange: (blocking: boolean) => void;
}) {
    const boardGateRuntime = useMemo<MatchRoomBoardGateRuntime>(() => ({
        locale: args.locale,
        loadingDescription: args.loadingDescription,
        shouldBlockBoardOnImagePreload: args.shouldBlockBoardOnImagePreload,
        blockingAudioKeys: [],
        onReady: args.onInitialOnlinePreloadReady,
        onBlockingChange: args.onBoardPreloadBlockingChange,
    }), [
        args.locale,
        args.loadingDescription,
        args.onBoardPreloadBlockingChange,
        args.onInitialOnlinePreloadReady,
        args.shouldBlockBoardOnImagePreload,
    ]);
    const boardGateRuntimeRef = useRef(boardGateRuntime);
    boardGateRuntimeRef.current = boardGateRuntime;
    const boardShell = useMemo<MatchRoomBoardShell>(() => ({
        Provider: function MatchRoomBoardRuntimeProvider({ children }) {
            return (
                <MatchRoomBoardGateRuntimeContext.Provider value={boardGateRuntimeRef}>
                    {children}
                </MatchRoomBoardGateRuntimeContext.Provider>
            );
        },
    }), []);

    const blockingAudioKeys = useMemo<SoundKey[]>(() => {
        if (!args.gameId || !args.gameImplReady) {
            return [];
        }
        const impl = getGameImplementation(args.gameId);
        return Array.from(new Set(impl?.audioConfig?.blockingSounds ?? []));
    }, [args.gameId, args.gameImplReady]);

    const createWrappedBoardWithGate = (
        Board: ComponentType<GameBoardProps>,
        displayName: string,
    ): ComponentType<GameBoardProps> => {
        const WrappedBoardWithGate = (props: GameBoardProps) => {
            const runtimeRef = useContext(MatchRoomBoardGateRuntimeContext);
            const effectiveRuntime: MatchRoomBoardGateRuntime = runtimeRef
                ? { ...runtimeRef.current, blockingAudioKeys }
                : { ...boardGateRuntimeRef.current, blockingAudioKeys };
            return (
                <CriticalImageGate
                    gameId={args.gameId}
                    gameState={props?.G}
                    locale={effectiveRuntime.locale}
                    playerID={props?.playerID}
                    enabled={true}
                    blockRendering={effectiveRuntime.shouldBlockBoardOnImagePreload}
                    loadingDescription={effectiveRuntime.loadingDescription}
                    blockingAudioKeys={effectiveRuntime.blockingAudioKeys}
                    onReady={effectiveRuntime.onReady}
                    onBlockingChange={effectiveRuntime.onBlockingChange}
                >
                    <Board {...props} />
                </CriticalImageGate>
            );
        };

        WrappedBoardWithGate.displayName = displayName;
        return WrappedBoardWithGate;
    };

    const wrappedBoardComponent = useMemo<ComponentType<GameBoardProps> | null>(() => {
        if (!args.gameId || !args.gameImplReady) {
            return null;
        }
        const impl = getGameImplementation(args.gameId);
        if (!impl) {
            return null;
        }
        const Board = impl.board as unknown as ComponentType<GameBoardProps>;

        return createWrappedBoardWithGate(Board, 'WrappedOnlineBoard');
    }, [args.gameId, args.gameImplReady, blockingAudioKeys]);

    const wrappedBoardRenderer = useMemo<GameBoardRenderer | null>(() => {
        if (!args.gameId || !args.gameImplReady) {
            return null;
        }
        const impl = getGameImplementation(args.gameId);
        const renderer = impl?.boardRenderer;
        if (!renderer) {
            return null;
        }

        if (renderer.kind === 'react') {
            const RendererBoard = renderer.component as unknown as ComponentType<GameBoardProps>;
            return {
                kind: 'react',
                component: createWrappedBoardWithGate(RendererBoard, 'WrappedOnlineBoardRenderer'),
            };
        }

        return {
            kind: 'imperative',
            engine: renderer.engine,
            mount: (host, props) => {
                boardGateRuntimeRef.current.onBlockingChange(false);
                boardGateRuntimeRef.current.onReady();
                return renderer.mount(host, props);
            },
        };
    }, [args.gameId, args.gameImplReady, blockingAudioKeys]);

    return {
        board: wrappedBoardComponent,
        boardRenderer: wrappedBoardRenderer,
        boardShell,
    };
}
