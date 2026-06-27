import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    type ComponentType,
    type ReactNode,
} from 'react';
import { getGameImplementation } from '../games/registry';
import type { GameBoardProps } from '../engine/transport/protocol';
import { CriticalImageGate } from '../components/game/framework';
import type { SoundKey } from '../lib/audio/types';

type MatchRoomBoardGateRuntime = {
    locale: string;
    loadingDescription: string;
    shouldBlockBoardOnImagePreload: boolean;
    blockingAudioKeys: SoundKey[];
    onReady: () => void;
};

export type MatchRoomBoardShell = {
    Provider: ComponentType<{ children?: ReactNode }>;
};

export const MatchRoomBoardGateRuntimeContext = createContext<MatchRoomBoardGateRuntime | null>(null);

function shouldDebugMatchRoomBoardRuntime(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage?.getItem('BG_DEBUG_FR_OPENING_LOOP') === '1';
    } catch {
        return false;
    }
}

function debugMatchRoomBoardRuntime(label: string, payload: Record<string, unknown>) {
    if (!shouldDebugMatchRoomBoardRuntime()) return;
    console.log('[DEBUG-fr-opening-loop]', label, payload);
}

export function useMatchRoomBoardRuntime(args: {
    gameId?: string;
    gameImplReady: boolean;
    locale: string;
    loadingDescription: string;
    shouldBlockBoardOnImagePreload: boolean;
    onInitialOnlinePreloadReady: () => void;
}) {
    const boardGateRuntime = useMemo<MatchRoomBoardGateRuntime>(() => ({
        locale: args.locale,
        loadingDescription: args.loadingDescription,
        shouldBlockBoardOnImagePreload: args.shouldBlockBoardOnImagePreload,
        blockingAudioKeys: [],
        onReady: args.onInitialOnlinePreloadReady,
    }), [
        args.locale,
        args.loadingDescription,
        args.onInitialOnlinePreloadReady,
        args.shouldBlockBoardOnImagePreload,
    ]);
    const boardGateRuntimeRef = useRef(boardGateRuntime);
    boardGateRuntimeRef.current = boardGateRuntime;
    useEffect(() => {
        debugMatchRoomBoardRuntime('runtime-gate-state', {
            gameId: args.gameId ?? null,
            gameImplReady: args.gameImplReady,
            locale: args.locale,
            shouldBlockBoardOnImagePreload: args.shouldBlockBoardOnImagePreload,
            loadingDescription: args.loadingDescription,
        });
    }, [
        args.gameId,
        args.gameImplReady,
        args.loadingDescription,
        args.locale,
        args.shouldBlockBoardOnImagePreload,
    ]);
    const boardShell = useMemo<MatchRoomBoardShell>(() => ({
        Provider: function MatchRoomBoardRuntimeProvider({ children }) {
            return (
                <MatchRoomBoardGateRuntimeContext.Provider value={boardGateRuntimeRef.current}>
                    {children}
                </MatchRoomBoardGateRuntimeContext.Provider>
            );
        },
    }), []);

    const wrappedBoardComponent = useMemo<ComponentType<GameBoardProps> | null>(() => {
        if (!args.gameId || !args.gameImplReady) {
            return null;
        }
        const impl = getGameImplementation(args.gameId);
        if (!impl) {
            return null;
        }
        const Board = impl.board as unknown as ComponentType<GameBoardProps>;
        const blockingAudioKeys = Array.from(new Set(impl.audioConfig?.blockingSounds ?? []));

        const WrappedBoardWithGate = (props: GameBoardProps) => {
            const runtime = useContext(MatchRoomBoardGateRuntimeContext);
            const effectiveRuntime: MatchRoomBoardGateRuntime = runtime
                ? { ...runtime, blockingAudioKeys }
                : { ...boardGateRuntimeRef.current, blockingAudioKeys };
            useEffect(() => {
                const boardState = props?.G as { currentPlayer?: unknown; stage?: unknown } | undefined;
                debugMatchRoomBoardRuntime('board-mount', {
                    gameId: args.gameId,
                    playerId: props?.playerID ?? null,
                    currentPlayer: boardState?.currentPlayer ?? null,
                    stage: boardState?.stage ?? null,
                    shouldBlockBoardOnImagePreload: effectiveRuntime.shouldBlockBoardOnImagePreload,
                });
                return () => {
                    debugMatchRoomBoardRuntime('board-unmount', {
                        gameId: args.gameId,
                        playerId: props?.playerID ?? null,
                        currentPlayer: boardState?.currentPlayer ?? null,
                        stage: boardState?.stage ?? null,
                        shouldBlockBoardOnImagePreload: effectiveRuntime.shouldBlockBoardOnImagePreload,
                    });
                };
            }, [
                effectiveRuntime.shouldBlockBoardOnImagePreload,
                props?.G,
                props?.playerID,
            ]);
            if (!runtime) {
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
                    >
                        <Board {...props} />
                    </CriticalImageGate>
                );
            }
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
                >
                    <Board {...props} />
                </CriticalImageGate>
            );
        };

        WrappedBoardWithGate.displayName = 'WrappedOnlineBoard';
        return WrappedBoardWithGate;
    }, [args.gameId, args.gameImplReady]);

    return {
        board: wrappedBoardComponent,
        boardShell,
    };
}
