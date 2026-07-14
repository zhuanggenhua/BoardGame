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
    const matchPlayers = useMemo(() => (
        args.playerIds.map((id) => ({
            id: Number(id),
            name: resolveSeatPlayerDisplayName({
                playerId: id,
                name: args.playerNames?.[id],
                seatControllers: args.seatControllers,
            }),
            isConnected: true,
        }))
    ), [args.playerIds, args.playerNames, args.seatControllers]);

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

        // 仅本地 Provider 用它表达“当前本地视角玩家”，不能当成跨 transport 的业务执行者真相。
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
        seatControllers: args.seatControllers,
        isConnected: true,
        isMultiplayer: false,
        reset: args.reset,
    }), [args.reset, args.state, dispatch, localBoardPlayerId, matchPlayers]);
}
