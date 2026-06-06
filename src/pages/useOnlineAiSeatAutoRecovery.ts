import { useEffect, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { buildAiProgressMarker } from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import type { MatchState } from '../engine/types';
import type { AiSeatController } from '../engine/ai';
import {
    buildOnlineAiForceEndTurnTrackerKey,
    buildOnlineAiForceSkipTrackerKey,
    buildOnlineAiSeamAwareProgressMarker,
} from './onlineAiRecovery';
import {
    applyAiAutoRecoveryRejection,
    resolveOnlineAiAutoRecoveryCompletionNotice,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
    submitForceEndTurnRecoverySequence,
    submitOnlineAiResolution,
    shouldSilentlyRetryOnlineAiBatchRejection,
    type ForceSkippableHiddenAiInteraction,
} from './onlineAiForceSkip';
import type { OnlineAiSeatTransportRuntime } from './useOnlineAiSeatTransportRuntime';

const FORCE_SKIP_GRACE_MS = 4000;
const FORCE_END_TURN_GRACE_MS = 8000;
const FORCE_END_TURN_FOLLOW_UP_STEPS = 16;

type ForceSkipTracker = {
    key: string;
    firstSeenAt: number;
    autoSubmittedAt: number | null;
    lastReportedFailureReason: string | null;
    candidate: ForceSkippableHiddenAiInteraction | null;
};

type ForceEndTurnTracker = {
    key: string;
    firstSeenAt: number;
    autoSubmittedAt: number | null;
    lastReportedFailureReason: string | null;
};

type OnlineAiSeatAutoRecoveryArgs = {
    state: MatchState<unknown> | null;
    engineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
    lastAiAttemptKeyRef: { current: string | null };
    seatControllers: Record<string, AiSeatController>;
    runtime: OnlineAiSeatTransportRuntime;
};

export function useOnlineAiSeatAutoRecovery(args: OnlineAiSeatAutoRecoveryArgs): void {
    const {
        state,
        engineConfig,
        lastAiAttemptKeyRef,
        seatControllers,
        runtime,
    } = args;
    const {
        aiRetryVersion,
        getEffectiveSeatStates,
        getSeatClient,
        scheduleRecoveryFailureNotice,
        scheduleAiRetry,
    } = runtime;
    const toast = useToast();
    const [forceSkipCheckVersion, setForceSkipCheckVersion] = useState(0);
    const forceSkipTrackerRef = useRef<ForceSkipTracker | null>(null);
    const forceEndTurnTrackerRef = useRef<ForceEndTurnTracker | null>(null);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const progressMarker = state && typeof state === 'object'
            ? buildOnlineAiSeamAwareProgressMarker({
                state: state as MatchState<unknown>,
                engineConfig,
            })
            : 'no-shared-state';
        const seatStates = getEffectiveSeatStates();

        const candidate = resolveForceSkippableHiddenAiInteraction({
            sharedState: state as MatchState<unknown> | null | undefined,
            seatControllers,
            seatStates,
            engineConfig,
            gameId: engineConfig.gameId,
        });
        const candidateKey = candidate ? buildOnlineAiForceSkipTrackerKey({ candidate }) : null;

        if (!candidateKey) {
            forceSkipTrackerRef.current = null;
            return;
        }

        const now = Date.now();
        const currentTracker = forceSkipTrackerRef.current;
        if (!currentTracker || currentTracker.key !== candidateKey) {
            forceSkipTrackerRef.current = {
                key: candidateKey,
                firstSeenAt: now,
                autoSubmittedAt: null,
                lastReportedFailureReason: null,
                candidate,
            };
            timer = setTimeout(() => {
                setForceSkipCheckVersion((version) => version + 1);
            }, FORCE_SKIP_GRACE_MS);
            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }

        currentTracker.candidate = candidate;
        if (currentTracker.autoSubmittedAt) {
            return;
        }

        const elapsed = now - currentTracker.firstSeenAt;
        if (elapsed < FORCE_SKIP_GRACE_MS) {
            timer = setTimeout(() => {
                setForceSkipCheckVersion((version) => version + 1);
            }, FORCE_SKIP_GRACE_MS - elapsed);
            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }

        const latestCandidate = forceSkipTrackerRef.current?.candidate;
        if (!latestCandidate) {
            return;
        }
        const targetClient = getSeatClient(latestCandidate.playerId);
        if (!targetClient?.isConnected) {
            timer = setTimeout(() => {
                setForceSkipCheckVersion((version) => version + 1);
            }, 1000);
            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }

        currentTracker.autoSubmittedAt = now;
        submitOnlineAiResolution({
            client: targetClient,
            resolution: latestCandidate.resolution,
            lastAiAttemptKeyRef,
            scheduleRetry: scheduleAiRetry,
            engineConfig,
            onConfirmed: () => {
                toast.warning(
                    'AI 自动跳过。',
                    'AI 响应超时',
                    { dedupeKey: `game.ai-force-skip.resolved.${candidateKey}` },
                );
            },
            onRejected: (reason) => {
                const tracker = forceSkipTrackerRef.current;
                let shouldNotify = true;
                if (tracker?.key === candidateKey) {
                    const rejection = applyAiAutoRecoveryRejection(tracker, reason, Date.now());
                    forceSkipTrackerRef.current = rejection.nextTracker;
                    shouldNotify = rejection.shouldNotify;
                }
                if (shouldSilentlyRetryOnlineAiBatchRejection(reason)) {
                    return;
                }
                if (!shouldNotify) {
                    return;
                }
                scheduleRecoveryFailureNotice({
                    targetClient,
                    playerId: latestCandidate.playerId,
                    markerBefore: progressMarker,
                    onStillStalled: () => {
                        toast.warning(
                            `AI 自动跳过失败（${reason}）`,
                            undefined,
                            { dedupeKey: `game.ai-force-skip.rejected.${candidateKey}.recover-interaction.${reason}` },
                        );
                    },
                });
            },
        });

        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [
        aiRetryVersion,
        engineConfig,
        forceSkipCheckVersion,
        getEffectiveSeatStates,
        getSeatClient,
        lastAiAttemptKeyRef,
        scheduleRecoveryFailureNotice,
        scheduleAiRetry,
        seatControllers,
        state,
        toast,
    ]);

    useEffect(() => {
        if (!state) {
            forceEndTurnTrackerRef.current = null;
            return;
        }

        let timer: ReturnType<typeof setTimeout> | null = null;
        const seatStates = getEffectiveSeatStates();
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: state as MatchState<unknown>,
            seatControllers,
            seatStates,
            engineConfig,
        });
        if (!candidate || candidate.legalActionOnly || candidate.reason === 'active-turn') {
            forceEndTurnTrackerRef.current = null;
            return;
        }

        const progressMarker = buildOnlineAiSeamAwareProgressMarker({
            state: state as MatchState<unknown>,
            engineConfig,
        });
        const turnNumber = (state as MatchState<unknown>).sys?.turnNumber ?? 'no-turn';
        const phase = (state as MatchState<unknown>).sys?.phase ?? 'no-phase';
        const trackerKey = buildOnlineAiForceEndTurnTrackerKey({
            candidate,
            turnNumber,
            phase,
        });
        const now = Date.now();
        const currentTracker = forceEndTurnTrackerRef.current;

        if (!currentTracker || currentTracker.key !== trackerKey) {
            forceEndTurnTrackerRef.current = {
                key: trackerKey,
                firstSeenAt: now,
                autoSubmittedAt: null,
                lastReportedFailureReason: null,
            };
            timer = setTimeout(() => {
                scheduleAiRetry();
            }, FORCE_END_TURN_GRACE_MS);
            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }

        if (currentTracker.autoSubmittedAt) {
            return;
        }

        const elapsed = now - currentTracker.firstSeenAt;
        if (elapsed < FORCE_END_TURN_GRACE_MS) {
            timer = setTimeout(() => {
                scheduleAiRetry();
            }, FORCE_END_TURN_GRACE_MS - elapsed);
            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }

        const targetClient = getSeatClient(candidate.playerId);
        if (!targetClient?.isConnected) {
            timer = setTimeout(() => {
                scheduleAiRetry();
            }, 1000);
            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }

        currentTracker.autoSubmittedAt = now;
                submitForceEndTurnRecoverySequence({
                    client: targetClient,
                    candidate,
                    lastAiAttemptKeyRef,
                    scheduleRetry: scheduleAiRetry,
                    followUpSteps: FORCE_END_TURN_FOLLOW_UP_STEPS,
                    seatControllers,
                    engineConfig,
                    onCompleted: (authoritativeState) => {
                const notice = resolveOnlineAiAutoRecoveryCompletionNotice({
                    candidateReason: candidate.reason,
                    authoritativeState: authoritativeState as MatchState<unknown> | null | undefined,
                    seatControllers,
                    engineConfig,
                });
                if (!notice) {
                    return;
                }
                const notify = notice.tone === 'warning' ? toast.warning : toast.info;
                notify(notice.message, notice.title, {
                    dedupeKey: `game.ai-force-end-turn.resolved.${trackerKey}`,
                });
            },
            onRejected: (reason, context) => {
                const tracker = forceEndTurnTrackerRef.current;
                let shouldNotify = true;
                if (tracker?.key === trackerKey) {
                    const rejection = applyAiAutoRecoveryRejection(tracker, reason, Date.now());
                    forceEndTurnTrackerRef.current = rejection.nextTracker;
                    shouldNotify = rejection.shouldNotify;
                }
                if (shouldSilentlyRetryOnlineAiBatchRejection(reason)) {
                    return;
                }
                if (!shouldNotify) {
                    return;
                }
                const actionLabel = context.stepIndex === 0 ? 'recover-interaction' : 'follow-up-advance';
                scheduleRecoveryFailureNotice({
                    targetClient,
                    playerId: candidate.playerId,
                    markerBefore: progressMarker,
                    onStillStalled: () => {
                        toast.warning(
                            `AI 强制结束失败（${reason}）`,
                            undefined,
                            { dedupeKey: `game.ai-force-end-turn.rejected.${trackerKey}.${actionLabel}.${reason}` },
                        );
                    },
                });
            },
        });

        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [
        aiRetryVersion,
        getEffectiveSeatStates,
        getSeatClient,
        lastAiAttemptKeyRef,
        scheduleRecoveryFailureNotice,
        scheduleAiRetry,
        seatControllers,
        state,
        engineConfig,
        toast,
    ]);
}
