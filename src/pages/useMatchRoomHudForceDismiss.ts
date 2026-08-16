import { useCallback, useEffect, useRef } from 'react';
import type { MatchState } from '../engine/types';
import { INTERACTION_COMMANDS } from '../engine/systems';
import type { OnlineAiRecoveryEngineConfig } from '../engine/transport/onlineAiRecovery';
import { buildAiProgressMarker, resolveOnlineAiCurrentPlayerId } from '../engine/transport/onlineAiRecovery';
import {
    isOnlineAiWatchdogPublicPregameLegalActionPhase,
    resolveOnlineAiWatchdogFallbackAdvancePhaseCommandType,
} from '../engine/transport/onlineAiWatchdogGameSemantics';
import { tryHandleGameHudForceDismiss } from '../games/gameHudRuntimeAdapter';
import { dismissGamePageTransientUi } from '../games/pageRuntimeTransientUi';

const FORCE_END_TURN_MAX_COMMAND_STEPS = 16;

type PendingForceEndTurnSequence = {
    targetPlayerId: string;
    lastIssuedMarker: string;
    advancePhaseCommandType: string | null;
    remainingSteps: number;
};

function hasSystemLockSurface(state: MatchState<unknown> | null | undefined): boolean {
    const interaction = state?.sys?.interaction;
    const responseWindow = state?.sys?.responseWindow;
    const resolution = state?.sys?.resolution;
    const activeFrame = resolution?.frames?.find((frame) => frame.id === resolution.activeFrameId);
    return Boolean(
        interaction?.current
        || interaction?.isBlocked
        || (interaction?.queue?.length ?? 0) > 0
        || responseWindow?.current
        || activeFrame?.status === 'blocked'
        || activeFrame?.blockedBy,
    );
}

export function useMatchRoomHudForceDismiss(args: {
    gameId?: string;
    state?: MatchState<unknown> | null;
    dispatch: (type: string, payload?: Record<string, unknown>) => void;
    myPlayerId?: string | null;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): () => Promise<boolean> {
    const {
        gameId,
        state,
        dispatch,
        myPlayerId,
        engineConfig,
    } = args;
    const pendingSequenceRef = useRef<PendingForceEndTurnSequence | null>(null);

    useEffect(() => {
        const pending = pendingSequenceRef.current;
        if (!pending || !state) {
            return;
        }

        const currentPlayerId = resolveOnlineAiCurrentPlayerId(state, {
            engineConfig,
            gameId,
        });
        if (currentPlayerId !== pending.targetPlayerId) {
            pendingSequenceRef.current = null;
            return;
        }

        if (pending.remainingSteps <= 0) {
            pendingSequenceRef.current = null;
            return;
        }

        const currentMarker = buildAiProgressMarker(state, { engineConfig, gameId });
        if (currentMarker === pending.lastIssuedMarker) {
            return;
        }

        const commandType = hasSystemLockSurface(state)
            ? INTERACTION_COMMANDS.FORCE_UNLOCK
            : pending.advancePhaseCommandType;
        if (!commandType) {
            pendingSequenceRef.current = null;
            return;
        }

        pendingSequenceRef.current = {
            ...pending,
            lastIssuedMarker: currentMarker,
            remainingSteps: pending.remainingSteps - 1,
        };

        dispatch(commandType, {});
        dismissGamePageTransientUi(gameId);
    }, [dispatch, engineConfig, gameId, state]);

    return useCallback(async (): Promise<boolean> => {
        if (tryHandleGameHudForceDismiss({
            gameId,
            state,
            dispatch,
            playerId: myPlayerId,
        })) {
            return true;
        }

        const matchState = state as MatchState<unknown> | null | undefined;
        const hasSystemLock = hasSystemLockSurface(matchState);
        if (hasSystemLock && matchState) {
            const currentPlayerId = resolveOnlineAiCurrentPlayerId(matchState, {
                engineConfig,
                gameId,
            });
            const shouldAttemptForceEndTurn = Boolean(
                currentPlayerId
                && myPlayerId
                && currentPlayerId === myPlayerId
                && !isOnlineAiWatchdogPublicPregameLegalActionPhase({
                    state: matchState,
                    engineConfig,
                }),
            );

            pendingSequenceRef.current = shouldAttemptForceEndTurn && currentPlayerId
                ? {
                    targetPlayerId: currentPlayerId,
                    lastIssuedMarker: buildAiProgressMarker(matchState, { engineConfig, gameId }),
                    advancePhaseCommandType: resolveOnlineAiWatchdogFallbackAdvancePhaseCommandType({
                        engineConfig,
                    }),
                    remainingSteps: FORCE_END_TURN_MAX_COMMAND_STEPS,
                }
                : null;
            dispatch(INTERACTION_COMMANDS.FORCE_UNLOCK, {});
            dismissGamePageTransientUi(gameId);
            return true;
        }

        pendingSequenceRef.current = null;
        if (dismissGamePageTransientUi(gameId)) {
            return true;
        }

        return false;
    }, [dispatch, engineConfig, gameId, myPlayerId, state]);
}
