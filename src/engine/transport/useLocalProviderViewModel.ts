import { useCallback, useMemo } from 'react';
import type { MatchState } from '../types';
import { resolveSeatPlayerDisplayName } from '../ai/seatDisplayName';
import type { AiSeatController } from '../ai/types';
import { resolveFollowCurrentTurnPlayerId } from './followCurrentTurnPlayer';
import type { GameClientContextValue } from './reactContext';

export function useLocalProviderViewModel(args: {
    state: MatchState<unknown>;
    dispatch: (type: string, payload: unknown) => void;
    reset: () => void;
    playerIds: string[];
    seatControllers: Record<string, AiSeatController>;
    localPregameControlledPlayerId: string | null;
    followCurrentTurnPlayer: boolean;
    localPlayerId: string | null;
}): GameClientContextValue {
    const matchPlayers = useMemo(() => (
        args.playerIds.map((id) => ({
            id: Number(id),
            name: resolveSeatPlayerDisplayName({
                playerId: id,
                seatControllers: args.seatControllers,
            }),
            isConnected: true,
        }))
    ), [args.playerIds, args.seatControllers]);

    const localBoardPlayerId = useMemo(() => {
        if (args.localPregameControlledPlayerId) {
            return args.localPregameControlledPlayerId;
        }
        if (args.followCurrentTurnPlayer) {
            const currentTurnPlayerId = resolveFollowCurrentTurnPlayerId(args.state.core);
            if (currentTurnPlayerId) {
                return currentTurnPlayerId;
            }
        }
        return args.localPlayerId ?? null;
    }, [
        args.followCurrentTurnPlayer,
        args.localPlayerId,
        args.localPregameControlledPlayerId,
        args.state.core,
    ]);

    const dispatch = useCallback((type: string, payload: unknown) => {
        if (!localBoardPlayerId) {
            args.dispatch(type, payload);
            return;
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            args.dispatch(type, payload);
            return;
        }

        const payloadRecord = payload as Record<string, unknown>;
        if (typeof payloadRecord.__internalPlayerId === 'string') {
            args.dispatch(type, payload);
            return;
        }

        args.dispatch(type, {
            ...payloadRecord,
            __internalPlayerId: localBoardPlayerId,
        });
    }, [args.dispatch, localBoardPlayerId]);

    return useMemo<GameClientContextValue>(() => ({
        state: args.state,
        dispatch,
        playerId: localBoardPlayerId,
        matchPlayers,
        isConnected: true,
        isMultiplayer: false,
        reset: args.reset,
    }), [args.reset, args.state, dispatch, localBoardPlayerId, matchPlayers]);
}
