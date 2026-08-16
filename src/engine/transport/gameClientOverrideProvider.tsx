import {
    useContext,
    useMemo,
} from 'react';
import type { ReactNode } from 'react';
import type { MatchState } from '../types';
import {
    GameClientContext,
} from './reactContext';
import type {
    GameClientContextValue,
} from './reactContext';

interface GameClientOverrideProviderProps {
    children: ReactNode;
    state?: MatchState<unknown> | null;
    playerId?: string | null;
    dispatch?: (type: string, payload: unknown) => void;
}

export function GameClientOverrideProvider({
    children,
    state,
    playerId,
    dispatch,
}: GameClientOverrideProviderProps) {
    const ctx = useContext(GameClientContext);
    if (!ctx) {
        throw new Error('GameClientOverrideProvider 必须在 GameProvider 或 LocalGameProvider 内部使用');
    }

    const value = useMemo<GameClientContextValue>(() => ({
        ...ctx,
        ...(state !== undefined ? { state } : {}),
        ...(playerId !== undefined ? { playerId } : {}),
        ...(dispatch ? { dispatch } : {}),
    }), [ctx, dispatch, playerId, state]);

    return (
        <GameClientContext.Provider value={value}>
            {children}
        </GameClientContext.Provider>
    );
}
