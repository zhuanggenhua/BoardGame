import {
    createContext,
    useContext,
    useMemo,
    type ComponentType,
    type ReactNode,
} from 'react';
import { getGameImplementation } from '../games/registry';
import type { GameBoardProps } from '../engine/transport/protocol';
import { CriticalImageGate } from '../components/game/framework';

type MatchRoomBoardGateRuntime = {
    locale: string;
    loadingDescription: string;
    shouldBlockBoardOnImagePreload: boolean;
    onReady: () => void;
};

export type MatchRoomBoardShell = {
    Provider: ComponentType<{ children?: ReactNode }>;
};

export const MatchRoomBoardGateRuntimeContext = createContext<MatchRoomBoardGateRuntime | null>(null);

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
        onReady: args.onInitialOnlinePreloadReady,
    }), [
        args.locale,
        args.loadingDescription,
        args.onInitialOnlinePreloadReady,
        args.shouldBlockBoardOnImagePreload,
    ]);
    const boardShell = useMemo<MatchRoomBoardShell>(() => ({
        Provider: function MatchRoomBoardRuntimeProvider({ children }) {
            return (
                <MatchRoomBoardGateRuntimeContext.Provider value={boardGateRuntime}>
                    {children}
                </MatchRoomBoardGateRuntimeContext.Provider>
            );
        },
    }), [boardGateRuntime]);

    const wrappedBoardComponent = useMemo<ComponentType<GameBoardProps> | null>(() => {
        if (!args.gameId || !args.gameImplReady) {
            return null;
        }
        const impl = getGameImplementation(args.gameId);
        if (!impl) {
            return null;
        }
        const Board = impl.board as unknown as ComponentType<GameBoardProps>;

        const WrappedBoardWithGate = (props: GameBoardProps) => {
            const runtime = useContext(MatchRoomBoardGateRuntimeContext);
            if (!runtime) {
                return <Board {...props} />;
            }
            return (
                <CriticalImageGate
                    gameId={args.gameId}
                    gameState={props?.G}
                    locale={runtime.locale}
                    playerID={props?.playerID}
                    enabled={true}
                    blockRendering={runtime.shouldBlockBoardOnImagePreload}
                    loadingDescription={runtime.loadingDescription}
                    onReady={runtime.onReady}
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
