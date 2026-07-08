import type { ReactNode } from 'react';
import type { GameEngineConfig } from './server';
import type { AiSeatController } from '../ai/types';
import { useLocalGameProviderRuntime } from './useLocalGameProviderRuntime';
import { GameClientContext } from './reactContext';

export {
    BoardBridge,
    BOARD_ERROR_BOUNDARY_MAX_RETRIES,
    isBoardRenderErrorRecoverable,
    shouldShowBoardRenderFallback,
} from './boardBridge';

export interface LocalGameProviderProps {
    config: GameEngineConfig;
    numPlayers: number;
    seed: string;
    setupData?: unknown;
    children: ReactNode;
    onCommandRejected?: (commandType: string, error: string) => void;
    seatControllers?: Record<string, AiSeatController>;
    playerNames?: Record<string, string>;
    playerId?: string;
    followCurrentTurnPlayer?: boolean;
    persistSession?: boolean;
}

export function LocalGameProvider({
    config,
    numPlayers,
    seed,
    setupData,
    children,
    onCommandRejected,
    seatControllers = {},
    playerNames,
    playerId: localPlayerId,
    followCurrentTurnPlayer = false,
    persistSession = false,
}: LocalGameProviderProps) {
    const value = useLocalGameProviderRuntime({
        config,
        numPlayers,
        seed,
        setupData,
        onCommandRejected,
        seatControllers,
        playerNames,
        localPlayerId: localPlayerId ?? null,
        followCurrentTurnPlayer,
        persistSession,
    });

    return (
        <GameClientContext.Provider value={value}>
            {children}
        </GameClientContext.Provider>
    );
}
