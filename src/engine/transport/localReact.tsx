import type { ReactNode } from 'react';
import type { GameEngineConfig } from './engineConfig';
import type { AiSeatController } from '../ai/types';
import type { LocalMatchSnapshot } from './localSession';
import { useLocalGameProviderRuntime } from './useLocalGameProviderRuntime';
import { GameClientContext } from './reactContext';
import { LocalSessionNotice } from './LocalSessionNotice';

export {
    BoardBridge,
    BOARD_ERROR_BOUNDARY_MAX_RETRIES,
    isBoardRenderErrorRecoverable,
    shouldShowBoardRenderFallback,
    type BoardBridgeProps,
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
    persistGameId?: string;
    shouldRestorePersistedSession?: (snapshot: LocalMatchSnapshot) => boolean;
}

export function LocalGameProvider(props: LocalGameProviderProps) {
    const identity = `${props.config.gameId}:${props.persistGameId ?? ''}:${props.seed}:${props.numPlayers}`;
    return <LocalGameProviderSession key={identity} {...props} />;
}

function LocalGameProviderSession({
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
    persistGameId,
    shouldRestorePersistedSession,
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
        persistGameId,
        shouldRestorePersistedSession,
    });

    return (
        <GameClientContext.Provider value={value}>
            <LocalSessionNotice status={value.localSession} onRestart={value.reset} />
            {value.localSession?.restoreError ? null : children}
        </GameClientContext.Provider>
    );
}
