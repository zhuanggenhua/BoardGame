import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';
import type { GameEngineConfig } from '../engine/transport/server';
import type { MatchState } from '../engine/types';
import type { AiSeatController } from '../engine/ai';
import {
    resolveManualBlockedOnlineAiSeatResync,
    resolveManualOnlineAiRecovery,
} from './onlineAiRecovery';
import {
    submitForceEndTurnRecoverySequence,
    submitOnlineAiResolution,
} from './onlineAiForceSkip';
import type { OnlineAiSeatTransportRuntime } from './useOnlineAiSeatTransportRuntime';

const MANUAL_FORCE_END_TURN_FOLLOW_UP_STEPS = 16;

type UseOnlineAiSeatManualRecoveryArgs = {
    state: MatchState<unknown> | null;
    engineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
    matchId: string;
    seatControllers: Record<string, AiSeatController>;
    lastAiAttemptKeyRef: { current: string | null };
    runtime: OnlineAiSeatTransportRuntime;
    onForceEndAiPhaseReady?: (handler: (() => Promise<boolean>) | null) => void;
};

export function useOnlineAiSeatManualRecovery(args: UseOnlineAiSeatManualRecoveryArgs): void {
    const {
        state,
        engineConfig,
        matchId,
        seatControllers,
        lastAiAttemptKeyRef,
        runtime,
        onForceEndAiPhaseReady,
    } = args;
    const {
        getEffectiveSeatStates,
        getSeatClient,
        requestSeatResync,
        scheduleAiRetry,
    } = runtime;
    const toast = useToast();
    const { t: tGame } = useTranslation('game');

    const forceEndAiPhase = useCallback(async (): Promise<boolean> => {
        if (!state) {
            toast.info(tGame('hud.ai.forceEndPhaseNotReady', { ns: 'game' }));
            return false;
        }

        const seatStates = getEffectiveSeatStates();
        const recovery = await resolveManualOnlineAiRecovery({
            engineConfig,
            matchId,
            sharedState: state,
            seatControllers,
            seatStates,
        });

        if (recovery.kind === 'unavailable') {
            toast.info(tGame('hud.ai.forceEndPhaseUnavailable', { ns: 'game' }));
            return false;
        }

        if (recovery.kind === 'blocked') {
            const blockedClient = getSeatClient(recovery.playerId);
            const blockedSeatResync = resolveManualBlockedOnlineAiSeatResync({
                playerId: recovery.playerId,
                blockedKey: recovery.blockedKey,
                blockedReason: recovery.blockedReason,
            });
            if (blockedClient && blockedSeatResync) {
                requestSeatResync({
                    playerId: blockedSeatResync.playerId,
                    client: blockedClient,
                    reason: blockedSeatResync.reason,
                    meta: blockedSeatResync.meta,
                });
            }
            toast.info(tGame('hud.ai.forceEndPhaseUnavailable', { ns: 'game' }));
            return false;
        }

        const candidate = recovery.kind === 'force-end-turn' ? recovery.candidate : null;
        const resolution = recovery.kind === 'legal-action' ? recovery.resolution : candidate.resolution;
        const targetClient = getSeatClient(resolution.playerId);
        if (!targetClient?.isConnected) {
            toast.warning(tGame('hud.ai.forceEndPhaseSeatOffline', { ns: 'game' }));
            return false;
        }

        const attemptKey = resolution.attemptKey;
        toast.info(tGame('hud.ai.forceEndPhaseSubmitting', { ns: 'game' }), undefined, {
            dedupeKey: `game.ai-force-end-turn.manual.submitting.${attemptKey}`,
        });

        return await new Promise<boolean>((resolve) => {
            let settled = false;
            const finish = (value: boolean) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };

            if (recovery.kind === 'force-end-turn') {
                submitForceEndTurnRecoverySequence({
                    client: targetClient,
                    candidate,
                    lastAiAttemptKeyRef,
                    scheduleRetry: scheduleAiRetry,
                    followUpSteps: MANUAL_FORCE_END_TURN_FOLLOW_UP_STEPS,
                    seatControllers,
                    engineConfig,
                    gameId: engineConfig.gameId,
                    onCompleted: () => {
                        toast.warning(
                            tGame('hud.ai.forceEndPhaseSuccess', { ns: 'game' }),
                            tGame('hud.ai.forceEndPhaseTitle', { ns: 'game' }),
                            { dedupeKey: `game.ai-force-end-turn.manual.${attemptKey}` },
                        );
                        finish(true);
                    },
                    onRejected: (reason) => {
                        toast.warning(
                            tGame('hud.ai.forceEndPhaseFailed', { ns: 'game', reason }),
                            tGame('hud.ai.forceEndPhaseTitle', { ns: 'game' }),
                            { dedupeKey: `game.ai-force-end-turn.manual.${attemptKey}.${reason}` },
                        );
                        finish(false);
                    },
                });
                return;
            }

            submitOnlineAiResolution({
                client: targetClient,
                resolution,
                lastAiAttemptKeyRef,
                scheduleRetry: scheduleAiRetry,
                engineConfig,
                onConfirmed: () => {
                    toast.warning(
                        tGame('hud.ai.forceEndPhaseSuccess', { ns: 'game' }),
                        tGame('hud.ai.forceEndPhaseTitle', { ns: 'game' }),
                        { dedupeKey: `game.ai-force-end-turn.manual.${attemptKey}` },
                    );
                    finish(true);
                },
                onRejected: (reason) => {
                    toast.warning(
                        tGame('hud.ai.forceEndPhaseFailed', { ns: 'game', reason }),
                        tGame('hud.ai.forceEndPhaseTitle', { ns: 'game' }),
                        { dedupeKey: `game.ai-force-end-turn.manual.${attemptKey}.${reason}` },
                    );
                    finish(false);
                },
            });
        });
    }, [
        engineConfig,
        getEffectiveSeatStates,
        getSeatClient,
        lastAiAttemptKeyRef,
        matchId,
        requestSeatResync,
        scheduleAiRetry,
        seatControllers,
        state,
        tGame,
        toast,
    ]);

    useEffect(() => {
        if (!onForceEndAiPhaseReady) return;
        onForceEndAiPhaseReady(forceEndAiPhase);
        return () => onForceEndAiPhaseReady(null);
    }, [forceEndAiPhase, onForceEndAiPhaseReady]);
}
