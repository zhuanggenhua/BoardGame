import { useCallback, useMemo } from 'react';
import type { MatchState } from '../types';
import { resolveSeatPlayerDisplayName } from '../ai/seatDisplayName';
import type { AiSeatController } from '../ai/types';
import { getTransportBatchCommands, TRANSPORT_BATCH_COMMAND } from '../batchDispatchCommand';
import {
    resolveFollowCurrentTurnPlayerId,
    type LocalRuntimeControlResolver,
} from './followCurrentTurnPlayer';
import type { GameClientContextValue } from './reactContext';
import { recordGameFeedbackCommand } from '../../lib/feedback/gameFeedbackContext';

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
    resolveLocalRuntimeControlledPlayerId?: LocalRuntimeControlResolver;
    randomCursor?: number;
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
        resolveLocalRuntimeControlledPlayerId,
        randomCursor,
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
            const runtimeControlledPlayerId = resolveLocalRuntimeControlledPlayerId?.({
                state,
                fallbackPlayerId: currentTurnPlayerId,
            });
            if (runtimeControlledPlayerId) {
                return runtimeControlledPlayerId;
            }
            if (currentTurnPlayerId) {
                return currentTurnPlayerId;
            }
        }
        return localPlayerId ?? null;
    }, [
        followCurrentTurnPlayer,
        localPlayerId,
        localPregameControlledPlayerId,
        resolveLocalRuntimeControlledPlayerId,
        state.core,
        state,
    ]);

    const dispatchObservedCommand = useCallback((type: string, payload: unknown) => {
        const payloadPlayerId = payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as Record<string, unknown>).playerId
            : undefined;
        const stateId = (state.sys as unknown as { stateId?: unknown }).stateId;
        recordGameFeedbackCommand({
            commandType: type,
            payload,
            playerId: typeof payloadPlayerId === 'string' ? payloadPlayerId : localBoardPlayerId,
            stateId: typeof stateId === 'number' ? stateId : undefined,
            randomCursor,
        });
        dispatchCommand(type, payload);
    }, [dispatchCommand, localBoardPlayerId, randomCursor, state]);

    const dispatchSingleCommand = useCallback((type: string, payload: unknown) => {
        if (!localBoardPlayerId) {
            dispatchObservedCommand(type, payload);
            return;
        }

        // 交互系统命令的正式执行者是当前交互 owner，不一定等于本地正在跟随的视角席位。
        // 让 localDispatchCommand 根据 state.sys.interaction.current.playerId 解析，
        // 避免年中/新年等跨席位交互被误发成当前视角玩家。
        if (type.startsWith('SYS_INTERACTION_')) {
            dispatchObservedCommand(type, payload);
            return;
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            dispatchObservedCommand(type, payload);
            return;
        }

        const payloadRecord = payload as Record<string, unknown>;
        if (typeof payloadRecord.__internalPlayerId === 'string') {
            dispatchObservedCommand(type, payload);
            return;
        }

        // 仅本地 Provider 用它表达“当前本地视角玩家”，不能当成跨 transport 的业务执行者真相。
        dispatchObservedCommand(type, {
            ...payloadRecord,
            __internalPlayerId: localBoardPlayerId,
        });
    }, [dispatchObservedCommand, localBoardPlayerId]);

    const dispatch = useCallback((type: string, payload: unknown) => {
        if (type === TRANSPORT_BATCH_COMMAND) {
            const commands = getTransportBatchCommands(payload);
            for (const command of commands) {
                dispatchSingleCommand(command.type, command.payload);
            }
            return;
        }

        dispatchSingleCommand(type, payload);
    }, [dispatchSingleCommand]);

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
