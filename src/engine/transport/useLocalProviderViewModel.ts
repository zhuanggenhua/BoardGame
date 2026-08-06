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
    playerNames?: Record<string, string>;
    localPregameControlledPlayerId: string | null;
    followCurrentTurnPlayer: boolean;
    localPlayerId: string | null;
}): GameClientContextValue {
    const {
        state,
        dispatch: dispatchCommand,
        reset,
        playerIds,
        seatControllers,
        playerNames,
        localPregameControlledPlayerId,
        followCurrentTurnPlayer,
        localPlayerId,
    } = args;

    const matchPlayers = useMemo(() => (
        playerIds.map((id) => ({
            id: Number(id),
            name: resolveSeatPlayerDisplayName({
                playerId: id,
                name: playerNames?.[id],
                seatControllers,
            }),
            isConnected: true,
        }))
    ), [playerIds, playerNames, seatControllers]);

    const localBoardPlayerId = useMemo(() => {
        if (localPregameControlledPlayerId) {
            return localPregameControlledPlayerId;
        }
        if (followCurrentTurnPlayer) {
            const currentTurnPlayerId = resolveFollowCurrentTurnPlayerId(state.core);
            if (currentTurnPlayerId) {
                return currentTurnPlayerId;
            }
        }
        return localPlayerId ?? null;
    }, [
        followCurrentTurnPlayer,
        localPlayerId,
        localPregameControlledPlayerId,
        state.core,
    ]);

    const dispatch = useCallback((type: string, payload: unknown) => {
        if (!localBoardPlayerId) {
            dispatchCommand(type, payload);
            return;
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            dispatchCommand(type, payload);
            return;
        }

        const payloadRecord = payload as Record<string, unknown>;
        if (typeof payloadRecord.__internalPlayerId === 'string') {
            dispatchCommand(type, payload);
            return;
        }

        // 仅本地 Provider 用它表达“当前本地视角玩家”，不能当成跨 transport 的业务执行者真相。
        dispatchCommand(type, {
            ...payloadRecord,
            __internalPlayerId: localBoardPlayerId,
        });
    }, [dispatchCommand, localBoardPlayerId]);

    const sendUiEvent = useCallback(() => undefined, []);
    const subscribeUiEvent = useCallback(() => () => undefined, []);

    return useMemo<GameClientContextValue>(() => ({
        state,
        dispatch,
        playerId: localBoardPlayerId,
        matchPlayers,
        seatControllers,
        isConnected: true,
        isMultiplayer: false,
        reset,
        sendUiEvent,
        subscribeUiEvent,
    }), [dispatch, localBoardPlayerId, matchPlayers, reset, seatControllers, sendUiEvent, state, subscribeUiEvent]);
}
