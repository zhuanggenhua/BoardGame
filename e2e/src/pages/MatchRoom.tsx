import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as matchApi from '../services/matchApi';
import { getGameImplementation, resolveGameTutorialManifest } from '../games/registry';
import {
    GameProvider,
    LocalGameProvider,
    BoardBridge,
    buildAiProgressMarker,
    releaseAiAttemptKeyIfMatches,
    tryReserveAiAttemptKey,
    useGameClient,
} from '../engine/transport/react';
import { GameTransportClient } from '../engine/transport/client';
import type { GameEngineConfig } from '../engine/transport/server';
import type { GameBoardProps } from '../engine/transport/protocol';
import type { MatchState } from '../engine/types';
import { useDebug } from '../contexts/DebugContext';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { useTutorial } from '../contexts/TutorialContext';
import { useGameMode } from '../contexts/GameModeContext';
import { RematchProvider } from '../contexts/RematchContext';
import {
    useMatchStatus,
    destroyMatch,
    leaveMatch,
    rejoinMatch,
    persistMatchCredentials,
    persistAiSeatCredentials,
    clearMatchCredentials,
    clearOwnerActiveMatch,
    suppressOwnerActiveMatch,
    isMatchNotFoundError,
    readStoredAiSeatCredentials,
    readStoredMatchCredentials,
    validateStoredMatchSeat,
} from '../hooks/match/useMatchStatus';
import { getGuestName, getOrCreateGuestId } from '../hooks/match/ownerIdentity';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/common/overlays/ConfirmModal';
import { useModalStack } from '../contexts/ModalStackContext';
import { useToast } from '../contexts/ToastContext';
import { getGameServerUrl } from '../config/server';
import { getGameById } from '../config/games.config';
import { getGamePageDataAttributes, syncGamePageDocumentAttributes } from '../games/mobileSupport';
import { useLobbyMatchPresence } from '../hooks/useLobbyMatchPresence';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { GameModeProvider } from '../contexts/GameModeContext';
import { SEO } from '../components/common/SEO';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { ConnectionLoadingScreen } from '../components/system/ConnectionLoadingScreen';
import { GameNamespaceLoadError } from '../components/system/GameNamespaceLoadError';
import { usePerformanceMonitor } from '../hooks/ui/usePerformanceMonitor';
import { CriticalImageGate, MobileBoardShell } from '../components/game/framework';
import { preloadWarmImages } from '../core';
import { resolveCriticalImages } from '../core/CriticalImageResolverRegistry';
import { UI_Z_INDEX, HudPortal } from '../core';
import { playDeniedSound } from '../lib/audio/useGameAudio';
import { appendMatchLoadTrace } from '../lib/matchLoadTrace';
import { logMobileRuntimeCritical } from '../lib/mobile/mobileRuntimeDebug';
import { isNativeAndroidRuntime } from '../lib/mobile/androidRuntime';
import { onAppVisible } from '../lib/mobile/appVisibility';
import { isUiHintOnlyError, resolveCommandError } from '../engine/transport/errorI18n';
import { GameCursorProvider } from '../core/cursor';
import { useGameNamespaceReady } from '../hooks/useGameNamespaceReady';
import { useGameImplementationReady } from '../hooks/useGameImplementationReady';
import { SmashUpOverlayProvider } from '../games/smashup/ui/SmashUpOverlayContext';
import { resolveGameDisplayName } from '../components/lobby/gameDetailsContent';
import { resolveOnlineHudPresence } from './matchHudPresence';
import { haveAiSeatCredentialsChanged, loadOnlineAiSeatState } from './onlineAiSeats';
import {
    applyAiAutoRecoveryRejection,
    finalizeOnlineAiResolutionConfirmation,
    resolveCurrentPlayerId,
    resolveManualForceEndAiPhase,
    resolveForceEndTurnRecoveryStep,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
    submitOnlineAiResolution,
    submitOnlineAiResolutionSequence,
    type ForceSkippableHiddenAiInteraction,
} from './onlineAiForceSkip';
import {
    resolveAiMinimumActionDelayMs,
    resolveNextAiDispatch,
    resolveOnlineAiDecisionView,
    type AiSeatController,
} from '../engine/ai';

// 系统级错误（连接/认证），不需要 toast 提示给玩家
const SYSTEM_ERRORS = new Set(['unauthorized', 'match_not_found', 'sync_timeout', 'command_failed']);
const ONLINE_TRANSPORT_ERRORS = new Set(['unauthorized', 'match_not_found', 'sync_timeout']);
// 教程系统正常拦截，不弹 toast（用户跟着教程走时的正常行为）
const TUTORIAL_SILENT_ERRORS = new Set(['tutorial_command_blocked', 'tutorial_step_locked']);

type OnlineAiDebugWindow = Window & {
    __BG_ONLINE_AI_DEBUG__?: {
        getSeatLatestState: (playerId: string) => MatchState<unknown> | null;
        setSeatLatestStateOverride: (playerId: string, state: MatchState<unknown> | null) => void;
        clearSeatLatestStateOverride: (playerId: string) => void;
        clearAllSeatLatestStateOverrides: () => void;
    };
};

/**
 * 教程 dispatch 桥接组件
 *
 * 放在 LocalGameProvider 内部、CriticalImageGate/BoardBridge 外部。
 * 作用：在 Board 渲染之前就调用 bindDispatch，让教程 START 命令可以在
 * CriticalImageGate 预加载期间执行。
 *
 * 问题背景：CriticalImageGate 阻塞 Board 渲染 → Board 中的 useTutorialBridge
 * 无法调用 bindDispatch → pending START 命令无法消费 → 教程卡在 setup 阶段
 * 的预加载上，完成后又要预加载 playing 阶段，导致双重延迟甚至卡死。
 *
 * 有了这个桥接组件，START 命令在预加载期间就执行，state 直接跳到 playing 阶段，
 * CriticalImageGate 只需预加载一次 playing 阶段的资源。
 */
const TutorialDispatchBridge = ({ children }: { children: ReactNode }) => {
    const { dispatch, state } = useGameClient();
    const { bindDispatch, unbindDispatch, syncTutorialState } = useTutorial();
    const gameMode = useGameMode();
    const isTutorialMode = gameMode?.mode === 'tutorial';
    const dispatchRef = useRef(dispatch);
    const contextRef = useRef({ bindDispatch, unbindDispatch, syncTutorialState });

    useEffect(() => {
        dispatchRef.current = dispatch;
    }, [dispatch]);

    useEffect(() => {
        contextRef.current = { bindDispatch, unbindDispatch, syncTutorialState };
    }, [bindDispatch, unbindDispatch, syncTutorialState]);

    // 提前 bindDispatch，不等 Board 渲染
    // 使用 useLayoutEffect 确保在 CriticalImageGate 的 useEffect 之前执行，
    // 这样 START 命令的 setState 会同步触发重新渲染，CriticalImageGate 直接看到
    // playing 阶段的 state，只需预加载一次。
    useLayoutEffect(() => {
        if (!isTutorialMode) return;
        const gen = contextRef.current.bindDispatch(
            (...args: [string, unknown?]) => dispatchRef.current(...args),
        );
        return () => {
            contextRef.current.unbindDispatch(gen);
        };
    }, [isTutorialMode]);

    // 提前同步教程状态（Board 被 CriticalImageGate 阻塞时也能同步）
    const lastSyncRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isTutorialMode || !state) return;
        const tutorial = (state as MatchState).sys.tutorial;
        if (!tutorial) return;
        const sig = `${tutorial.active}-${tutorial.stepIndex}-${tutorial.step?.id ?? ''}`;
        if (lastSyncRef.current === sig) return;
        lastSyncRef.current = sig;
        contextRef.current.syncTutorialState(tutorial);
    }, [isTutorialMode, state]);

    return <>{children}</>;
};

const MAX_FORCE_END_TURN_FOLLOW_UP_STEPS = 16;
const RECOVERY_FAILURE_SYNC_GRACE_MS = 700;
const STALE_SEAT_RECOVERY_RETRY_MS = 350;
const STALE_SEAT_RECOVERY_MIN_INTERVAL_MS = 1200;

function resolveLatestStateEventTimestamp(state: MatchState<unknown>): number | null {
    const eventStreamEntries = Array.isArray(state.sys?.eventStream?.entries)
        ? state.sys.eventStream.entries
        : [];
    for (let index = eventStreamEntries.length - 1; index >= 0; index -= 1) {
        const timestamp = (eventStreamEntries[index] as { event?: { timestamp?: unknown } })?.event?.timestamp;
        if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
            return timestamp;
        }
    }

    const actionLogEntries = Array.isArray(state.sys?.actionLog?.entries)
        ? state.sys.actionLog.entries
        : [];
    for (let index = actionLogEntries.length - 1; index >= 0; index -= 1) {
        const timestamp = (actionLogEntries[index] as { timestamp?: unknown })?.timestamp;
        if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
            return timestamp;
        }
    }

    return null;
}

function resolveObservedStateAgeMs(state: MatchState<unknown>, now: number): number {
    const latestTimestamp = resolveLatestStateEventTimestamp(state);
    if (latestTimestamp === null) {
        return 0;
    }
    return Math.max(0, now - latestTimestamp);
}

const OnlineAiSeatBridge = ({
    server,
    matchId,
    engineConfig,
    seatControllers,
    seatCredentials,
    onForceEndAiPhaseReady,
}: {
    server: string;
    matchId: string;
    engineConfig: GameEngineConfig;
    seatControllers: Record<string, AiSeatController>;
    seatCredentials: Record<string, string>;
    onForceEndAiPhaseReady?: (handler: (() => Promise<boolean>) | null) => void;
}) => {
    const { state } = useGameClient();
    const toast = useToast();
    const { t: tGame } = useTranslation('game');
    const clientsRef = useRef<Record<string, GameTransportClient>>({});
    const [connectionVersion, setConnectionVersion] = useState(0);
    const [aiRetryVersion, setAiRetryVersion] = useState(0);
    const [forceSkipCheckVersion, setForceSkipCheckVersion] = useState(0);
    const lastAiAttemptKeyRef = useRef<string | null>(null);
    const forceSkipTrackerRef = useRef<{
        key: string;
        firstSeenAt: number;
        autoSubmittedAt: number | null;
        lastReportedFailureReason: string | null;
        candidate: ForceSkippableHiddenAiInteraction | null;
    } | null>(null);
    const forceEndTurnTrackerRef = useRef<{
        key: string;
        firstSeenAt: number;
        autoSubmittedAt: number | null;
        lastReportedFailureReason: string | null;
    } | null>(null);
    const staleSeatDecisionKeyRef = useRef<string | null>(null);
    const staleSeatRecoveryRef = useRef<{
        key: string;
        lastRecoveryAt: number;
    } | null>(null);
    const latestSharedStateRef = useRef<MatchState<unknown> | null>(null);
    const pendingRecoveryCheckTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
    const aiSeatStateOverridesRef = useRef<Record<string, MatchState<unknown> | null>>({});

    useEffect(() => {
        latestSharedStateRef.current = state && typeof state === 'object'
            ? state as MatchState<unknown>
            : null;
    }, [state]);

    useEffect(() => {
        if (typeof window === 'undefined' || !import.meta.env.DEV) {
            return;
        }
        const debugWindow = window as OnlineAiDebugWindow;
        debugWindow.__BG_ONLINE_AI_DEBUG__ = {
            getSeatLatestState: (playerId: string) => {
                const override = aiSeatStateOverridesRef.current[playerId];
                if (override !== undefined) {
                    return override;
                }
                const seatState = clientsRef.current[playerId]?.latestState;
                return seatState && typeof seatState === 'object'
                    ? seatState as MatchState<unknown>
                    : null;
            },
            setSeatLatestStateOverride: (playerId: string, nextState: MatchState<unknown> | null) => {
                aiSeatStateOverridesRef.current[playerId] = nextState;
            },
            clearSeatLatestStateOverride: (playerId: string) => {
                delete aiSeatStateOverridesRef.current[playerId];
            },
            clearAllSeatLatestStateOverrides: () => {
                aiSeatStateOverridesRef.current = {};
            },
        };
        return () => {
            delete debugWindow.__BG_ONLINE_AI_DEBUG__;
        };
    }, []);

    useEffect(() => {
        const pendingTimers = pendingRecoveryCheckTimersRef.current;
        return () => {
            for (const timer of pendingTimers) {
                clearTimeout(timer);
            }
            pendingTimers.clear();
        };
    }, []);

    const scheduleRecoveryFailureNotice = useCallback((args: {
        targetClient: GameTransportClient;
        markerBefore: string;
        onStillStalled: () => void;
    }) => {
        const { targetClient, markerBefore, onStillStalled } = args;
        targetClient.resync();
        const timer = setTimeout(() => {
            pendingRecoveryCheckTimersRef.current.delete(timer);
            const sharedMarker = latestSharedStateRef.current
                ? buildAiProgressMarker(latestSharedStateRef.current)
                : markerBefore;
            const seatMarker = targetClient.latestState && typeof targetClient.latestState === 'object'
                ? buildAiProgressMarker(targetClient.latestState as MatchState<unknown>)
                : markerBefore;
            if (sharedMarker !== markerBefore || seatMarker !== markerBefore) {
                return;
            }
            onStillStalled();
        }, RECOVERY_FAILURE_SYNC_GRACE_MS);
        pendingRecoveryCheckTimersRef.current.add(timer);
    }, []);

    useEffect(() => {
        const nextClientKeys = new Set(
            Object.entries(seatControllers)
                .filter(([playerId, controller]) => controller.type !== 'human' && Boolean(seatCredentials[playerId]))
                .map(([playerId]) => playerId),
        );

        for (const [playerId, client] of Object.entries(clientsRef.current)) {
            if (nextClientKeys.has(playerId)) {
                continue;
            }
            client.disconnect();
            delete clientsRef.current[playerId];
        }

        for (const playerId of nextClientKeys) {
            if (clientsRef.current[playerId]) {
                continue;
            }
            const client = new GameTransportClient({
                server,
                matchID: matchId,
                playerID: playerId,
                credentials: seatCredentials[playerId],
                onStateUpdate: () => {
                    setAiRetryVersion((version) => version + 1);
                },
                onConnectionChange: () => {
                    setConnectionVersion((version) => version + 1);
                },
            });
            client.connect();
            clientsRef.current[playerId] = client;
        }

        return () => {
            for (const client of Object.values(clientsRef.current)) {
                client.disconnect();
            }
            clientsRef.current = {};
        };
    }, [matchId, seatControllers, seatCredentials, server]);

    useEffect(() => {
        return onAppVisible(() => {
            for (const client of Object.values(clientsRef.current)) {
                client.resync();
            }
            setAiRetryVersion((version) => version + 1);
        });
    }, []);

    useEffect(() => {
        const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
        if (!hasAiSeat || !state) {
            lastAiAttemptKeyRef.current = null;
            staleSeatRecoveryRef.current = null;

            return;
        }

        let cancelled = false;
        let delayTimer: ReturnType<typeof setTimeout> | null = null;

        const runAiTurn = async () => {
            const startedAt = Date.now();
            const aiDispatchResult = await resolveNextAiDispatch({
                engineConfig,
                state,
                matchId,
                seatControllers,
                visibleStateResolver: (playerId) => {
                    const overriddenSeatState = aiSeatStateOverridesRef.current[playerId];
                    const rawSeatState = overriddenSeatState !== undefined
                        ? overriddenSeatState
                        : clientsRef.current[playerId]?.latestState;
                    const sharedState = state as MatchState<unknown>;
                    const privateOverlay = rawSeatState && typeof rawSeatState === 'object'
                        ? rawSeatState as MatchState<unknown>
                        : null;
                    const decisionView = resolveOnlineAiDecisionView({
                        runtime: getGameImplementation(engineConfig.gameId).ai,
                        sharedState,
                        privateOverlay,
                        playerId,
                    });
                    return decisionView;
                },
            });

            if (cancelled) return;

            if (aiDispatchResult.kind === 'blocked') {
                // 已有 in-flight 尝试时，禁止并发恢复链触发重复派发。
                if (lastAiAttemptKeyRef.current) {
                    return;
                }
                const staleDecisionKey = aiDispatchResult.blockedKey;
                if (staleSeatDecisionKeyRef.current !== staleDecisionKey) {
                    staleSeatDecisionKeyRef.current = staleDecisionKey;
                    appendMatchLoadTrace({
                        stage: 'online-ai-seat-state-stale',
                        source: 'match-room',
                        gameId: engineConfig.gameId,
                        matchId,
                        payload: {
                            playerId: aiDispatchResult.playerId,
                            visibility: aiDispatchResult.visibility,
                            blockedReason: aiDispatchResult.blockedReason,
                            sharedTurnNumber: aiDispatchResult.diagnostics?.sharedTurnNumber ?? null,
                            sharedPhase: aiDispatchResult.diagnostics?.sharedPhase ?? null,
                            sharedCurrentPlayerId: aiDispatchResult.diagnostics?.sharedCurrentPlayerId ?? null,
                            seatTurnNumber: aiDispatchResult.diagnostics?.privateTurnNumber ?? null,
                            seatPhase: aiDispatchResult.diagnostics?.privatePhase ?? null,
                            seatCurrentPlayerId: aiDispatchResult.diagnostics?.privateCurrentPlayerId ?? null,
                        },
                    });
                    console.warn('[OnlineAiSeatBridge] blocked AI decision', {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId: aiDispatchResult.playerId,
                        visibility: aiDispatchResult.visibility,
                        blockedReason: aiDispatchResult.blockedReason,
                        sharedTurnNumber: aiDispatchResult.diagnostics?.sharedTurnNumber ?? null,
                        sharedPhase: aiDispatchResult.diagnostics?.sharedPhase ?? null,
                        sharedCurrentPlayerId: aiDispatchResult.diagnostics?.sharedCurrentPlayerId ?? null,
                        seatTurnNumber: aiDispatchResult.diagnostics?.privateTurnNumber ?? null,
                        seatPhase: aiDispatchResult.diagnostics?.privatePhase ?? null,
                        seatCurrentPlayerId: aiDispatchResult.diagnostics?.privateCurrentPlayerId ?? null,
                    });
                }
                if (staleDecisionKey) {
                    const now = Date.now();
                    const lastRecovery = staleSeatRecoveryRef.current;
                    const canRecover = !lastRecovery
                        || lastRecovery.key !== staleDecisionKey
                        || now - lastRecovery.lastRecoveryAt >= STALE_SEAT_RECOVERY_MIN_INTERVAL_MS;
                    if (canRecover) {
                        staleSeatRecoveryRef.current = {
                            key: staleDecisionKey,
                            lastRecoveryAt: now,
                        };
                        for (const seatClient of Object.values(clientsRef.current)) {
                            seatClient.resync();
                        }
                        delayTimer = setTimeout(() => {
                            delayTimer = null;
                            setAiRetryVersion((version) => version + 1);
                        }, STALE_SEAT_RECOVERY_RETRY_MS);
                    }
                } else {
                    staleSeatRecoveryRef.current = null;
                }
                return;
            }

            if (aiDispatchResult.kind === 'idle') {
                // 已有 in-flight 尝试时，等待确认回调释放锁，不并发拉起恢复链。
                if (lastAiAttemptKeyRef.current) {
                    return;
                }
                const sharedState = state as MatchState<unknown>;
                const currentPlayerId = resolveCurrentPlayerId(sharedState);
                const activeAiPlayerId = currentPlayerId && seatControllers[currentPlayerId]?.type !== 'human'
                    ? currentPlayerId
                    : null;
                if (activeAiPlayerId) {
                    const idleDecisionKey = [
                        'idle-active-ai',
                        activeAiPlayerId,
                        sharedState.sys?.turnNumber ?? 'no-shared-turn',
                        sharedState.sys?.phase ?? 'no-shared-phase',
                    ].join(':');
                    const now = Date.now();
                    const lastRecovery = staleSeatRecoveryRef.current;
                    const canRecover = !lastRecovery
                        || lastRecovery.key !== idleDecisionKey
                        || now - lastRecovery.lastRecoveryAt >= STALE_SEAT_RECOVERY_MIN_INTERVAL_MS;
                    if (canRecover) {
                        staleSeatRecoveryRef.current = {
                            key: idleDecisionKey,
                            lastRecoveryAt: now,
                        };
                        for (const seatClient of Object.values(clientsRef.current)) {
                            seatClient.resync();
                        }
                        delayTimer = setTimeout(() => {
                            delayTimer = null;
                            setAiRetryVersion((version) => version + 1);
                        }, STALE_SEAT_RECOVERY_RETRY_MS);
                    }
                } else {
                    staleSeatRecoveryRef.current = null;
                }
                staleSeatDecisionKeyRef.current = null;
                return;
            }

            staleSeatDecisionKeyRef.current = null;
            staleSeatRecoveryRef.current = null;
            const resolution = aiDispatchResult.resolution;
            if (!tryReserveAiAttemptKey(lastAiAttemptKeyRef, resolution.attemptKey)) {
                return;
            }

            const controller = seatControllers[resolution.playerId];
            const client = clientsRef.current[resolution.playerId];
            if (!controller || controller.type === 'human' || !client?.isConnected) {
                releaseAiAttemptKeyIfMatches(lastAiAttemptKeyRef, resolution.attemptKey);
                return;
            }

            const now = Date.now();
            const minimumDelayMs = resolveAiMinimumActionDelayMs(controller);
            const decisionElapsedMs = now - startedAt;
            const observedStateAgeMs = resolveObservedStateAgeMs(state as MatchState<unknown>, now);
            const remainingDelayMs = Math.max(
                0,
                minimumDelayMs - Math.max(decisionElapsedMs, observedStateAgeMs),
            );

            if (remainingDelayMs > 0) {
                await new Promise<void>((resolve) => {
                    delayTimer = setTimeout(() => {
                        delayTimer = null;
                        resolve();
                    }, remainingDelayMs);
                });
            }

            if (cancelled || !client.isConnected) {
                releaseAiAttemptKeyIfMatches(lastAiAttemptKeyRef, resolution.attemptKey);
                return;
            }

            submitOnlineAiResolution({
                client,
                resolution,
                lastAiAttemptKeyRef,
                scheduleRetry: () => {
                    setAiRetryVersion((version) => version + 1);
                },
                onConfirmed: () => {
                    finalizeOnlineAiResolutionConfirmation({
                        lastAiAttemptKeyRef,
                        resolutionAttemptKey: resolution.attemptKey,
                        scheduleRetry: () => {
                            setAiRetryVersion((version) => version + 1);
                        },
                    });
                },
            });
        };

        void runAiTurn();

        return () => {
            cancelled = true;
            if (delayTimer) {
                clearTimeout(delayTimer);
            }
        };
    }, [aiRetryVersion, connectionVersion, engineConfig, matchId, seatControllers, state]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const progressMarker = state && typeof state === 'object'
            ? buildAiProgressMarker(state as MatchState<unknown>)
            : 'no-shared-state';
        const seatStates = Object.fromEntries(
            Object.entries(clientsRef.current).map(([playerId, client]) => {
                const latestState = client.latestState;
                return [playerId, latestState && typeof latestState === 'object' ? latestState as MatchState<unknown> : null];
            }),
        );

        const candidate = resolveForceSkippableHiddenAiInteraction({
            sharedState: state as MatchState<unknown> | null | undefined,
            seatControllers,
            seatStates,
        });
        const candidateKey = candidate ? `${candidate.playerId}:${candidate.interactionId}` : null;

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
            }, 4000);
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
        if (elapsed < 4000) {
            timer = setTimeout(() => {
                setForceSkipCheckVersion((version) => version + 1);
            }, 4000 - elapsed);
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
        const targetClient = clientsRef.current[latestCandidate.playerId];
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
            scheduleRetry: () => {
                setAiRetryVersion((version) => version + 1);
            },
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
                if (!shouldNotify) {
                    return;
                }
                scheduleRecoveryFailureNotice({
                    targetClient,
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
    }, [aiRetryVersion, connectionVersion, forceSkipCheckVersion, scheduleRecoveryFailureNotice, seatControllers, state, toast]);

    useEffect(() => {
        if (!state) {
            forceEndTurnTrackerRef.current = null;
            return;
        }

        let timer: ReturnType<typeof setTimeout> | null = null;
        const seatStates = Object.fromEntries(
            Object.entries(clientsRef.current).map(([playerId, client]) => {
                const latestState = client.latestState;
                return [playerId, latestState && typeof latestState === 'object' ? latestState as MatchState<unknown> : null];
            }),
        );
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: state as MatchState<unknown>,
            seatControllers,
            seatStates,
        });
        if (!candidate || candidate.legalActionOnly || candidate.reason === 'active-turn') {
            forceEndTurnTrackerRef.current = null;
            return;
        }

        const progressMarker = buildAiProgressMarker(state as MatchState<unknown>);
        const turnNumber = (state as MatchState<unknown>).sys?.turnNumber ?? 'no-turn';
        const phase = (state as MatchState<unknown>).sys?.phase ?? 'no-phase';
        // 注意：trackerKey 用于“是否已尝试过该类卡死”的节流/去重，也会进入 toast dedupeKey。
        // 旧实现把 progressMarker（包含 responseWindowId/interactionId 等高度易变字段）拼进 key，
        // 会导致同一类卡死在“窗口反复重开但语义不变”时不断刷新 key，从而持续弹出失败提示。
        //
        // 强口径裁决：trackerKey 只应随“语义变化”或“回合/阶段变化”而变化。
        // - 优先使用 candidate.fingerprintHint（去除了 windowId 等噪音字段）
        // - 再用 attemptKey 作为回退
        // - 追加 turnNumber/phase，确保跨回合/跨阶段不会被错误地视为同一 incident
        const trackerSemanticKey = candidate.fingerprintHint ?? candidate.resolution.attemptKey;
        const trackerKey = `${candidate.playerId}:${candidate.reason}:${trackerSemanticKey}:${turnNumber}:${phase}`;
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
                setAiRetryVersion((version) => version + 1);
            }, 8000);
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
        if (elapsed < 8000) {
            timer = setTimeout(() => {
                setAiRetryVersion((version) => version + 1);
            }, 8000 - elapsed);
            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }

        const targetClient = clientsRef.current[candidate.playerId];
        if (!targetClient?.isConnected) {
            timer = setTimeout(() => {
                setAiRetryVersion((version) => version + 1);
            }, 1000);
            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }

        currentTracker.autoSubmittedAt = now;
        submitOnlineAiResolutionSequence({
            client: targetClient,
            initialResolution: candidate.resolution,
            lastAiAttemptKeyRef,
            scheduleRetry: () => {
                setAiRetryVersion((version) => version + 1);
            },
            maxSteps: MAX_FORCE_END_TURN_FOLLOW_UP_STEPS + 1,
            resolveNextResolution: ({ authoritativeState, stepIndex }) => {
                if (stepIndex >= MAX_FORCE_END_TURN_FOLLOW_UP_STEPS) {
                    return null;
                }
                return resolveForceEndTurnRecoveryStep({
                    authoritativeState,
                    seatControllers,
                    playerId: candidate.playerId,
                    allowAdvancePhase: candidate.requiresConfirmedAdvancePhase === true && stepIndex === 0,
                });
            },
            onCompleted: () => {
                toast.warning(
                    'AI 已强制结束回合。',
                    'AI 强制结束回合',
                    { dedupeKey: `game.ai-force-end-turn.resolved.${trackerKey}` },
                );
            },
            onRejected: (reason, context) => {
                const tracker = forceEndTurnTrackerRef.current;
                let shouldNotify = true;
                if (tracker?.key === trackerKey) {
                    const rejection = applyAiAutoRecoveryRejection(tracker, reason, Date.now());
                    forceEndTurnTrackerRef.current = rejection.nextTracker;
                    shouldNotify = rejection.shouldNotify;
                }
                if (!shouldNotify) {
                    return;
                }
                const actionLabel = context.stepIndex === 0 ? 'recover-interaction' : 'follow-up-advance';
                scheduleRecoveryFailureNotice({
                    targetClient,
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
    }, [aiRetryVersion, connectionVersion, scheduleRecoveryFailureNotice, seatControllers, state, toast]);

    const forceEndAiPhase = useCallback(async (): Promise<boolean> => {
        if (!state) {
            toast.info(tGame('hud.ai.forceEndPhaseNotReady', { ns: 'game' }));
            return false;
        }

        const seatStates = Object.fromEntries(
            Object.entries(clientsRef.current).map(([playerId, client]) => {
                const latestState = client.latestState;
                return [playerId, latestState && typeof latestState === 'object' ? latestState as MatchState<unknown> : null];
            }),
        );

        const candidate = resolveManualForceEndAiPhase({
            sharedState: state as MatchState<unknown>,
            seatControllers,
            seatStates,
        });

        if (!candidate) {
            toast.info(tGame('hud.ai.forceEndPhaseUnavailable', { ns: 'game' }));
            return false;
        }

        const targetClient = clientsRef.current[candidate.playerId];
        if (!targetClient?.isConnected) {
            toast.warning(tGame('hud.ai.forceEndPhaseSeatOffline', { ns: 'game' }));
            return false;
        }

        const attemptKey = candidate.resolution.attemptKey;
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

            submitOnlineAiResolutionSequence({
                client: targetClient,
                initialResolution: candidate.resolution,
                lastAiAttemptKeyRef,
                scheduleRetry: () => {
                    setAiRetryVersion((version) => version + 1);
                },
                maxSteps: MAX_FORCE_END_TURN_FOLLOW_UP_STEPS + 1,
                resolveNextResolution: ({ authoritativeState, stepIndex }) => {
                    if (stepIndex >= MAX_FORCE_END_TURN_FOLLOW_UP_STEPS) {
                        return null;
                    }
                    return resolveForceEndTurnRecoveryStep({
                        authoritativeState,
                        seatControllers,
                        playerId: candidate.playerId,
                        allowAdvancePhase: candidate.requiresConfirmedAdvancePhase === true && stepIndex === 0,
                    });
                },
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
        });
    }, [seatControllers, state, tGame, toast]);

    useEffect(() => {
        if (!onForceEndAiPhaseReady) return;
        onForceEndAiPhaseReady(forceEndAiPhase);
        return () => onForceEndAiPhaseReady(null);
    }, [forceEndAiPhase, onForceEndAiPhaseReady]);

    return null;
};

const OnlineRoomConnectionLoading = ({
    title,
    description,
    gameId,
    transportError,
    onRetry,
}: {
    title: string;
    description: string;
    gameId?: string;
    transportError?: string | null;
    onRetry?: () => void;
}) => {
    const { t: tLobbyConnection } = useTranslation('lobby');
    const navigate = useNavigate();
    const { state, isConnected, matchPlayers } = useGameClient();
    const core = state?.core as { turnNumber?: number; activePlayer?: number | string; phase?: string } | undefined;
    const activityKey = [
        isConnected ? 'connected' : 'connecting',
        matchPlayers.length,
        core?.turnNumber ?? 'no-turn',
        core?.activePlayer ?? 'no-player',
        core?.phase ?? 'no-phase',
    ].join(':');
    const progressText = state
        ? undefined
        : tLobbyConnection(isConnected
            ? 'matchRoom.loadingProgress.syncing'
            : 'matchRoom.loadingProgress.connecting');
    if (transportError) {
        const titleKey = transportError === 'match_not_found'
            ? 'matchRoom.connectionError.matchNotFoundTitle'
            : transportError === 'unauthorized'
                ? 'matchRoom.connectionError.unauthorizedTitle'
                : 'matchRoom.connectionError.syncTimeoutTitle';
        const descriptionKey = transportError === 'match_not_found'
            ? 'matchRoom.connectionError.matchNotFoundDescription'
            : transportError === 'unauthorized'
                ? 'matchRoom.connectionError.unauthorizedDescription'
                : 'matchRoom.connectionError.syncTimeoutDescription';

        const content = (
            <div className="fixed inset-0 flex items-center justify-center bg-black px-6 text-center">
                <div className="max-w-md">
                    <div className="text-white/85 text-xl font-semibold mb-3">{tLobbyConnection(titleKey)}</div>
                    <div className="text-white/60 text-sm leading-6 mb-6">{tLobbyConnection(descriptionKey)}</div>
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={() => {
                                if (onRetry) {
                                    onRetry();
                                    return;
                                }
                                navigate(0);
                            }}
                            className="px-5 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-500/90 text-white text-sm font-medium transition-colors"
                        >
                            {tLobbyConnection('matchRoom.connectionTimeout.retry')}
                        </button>
                        <button
                            onClick={() => {
                                if (gameId) {
                                    navigate(`/?game=${gameId}`, { replace: true });
                                } else {
                                    navigate('/', { replace: true });
                                }
                            }}
                            className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
                        >
                            {tLobbyConnection('matchRoom.connectionTimeout.backToLobby')}
                        </button>
                    </div>
                </div>
            </div>
        );

        return <HudPortal>{content}</HudPortal>;
    }

    const content = (
        <ConnectionLoadingScreen
            anchor="viewport"
            title={title}
            description={description}
            progressText={progressText}
            gameId={gameId}
            activityKey={activityKey}
            suppressTimeout={Boolean(state)}
        />
    );

    return <HudPortal>{content}</HudPortal>;
};

const OnlineGameHudBridge = ({
    matchId,
    gameId,
    isHost,
    credentials,
    myPlayerId,
    fallbackPlayers,
    fallbackOpponentName,
    onLeave,
    onDestroy,
    onForceExit,
    onForceEndAiPhase,
    showForceEndAiPhase,
    isLoading,
    seatControllers,
}: {
    matchId?: string;
    gameId?: string;
    isHost: boolean;
    credentials?: string;
    myPlayerId?: string | null;
    fallbackPlayers: Array<{ id: number; name?: string; isConnected?: boolean }>;
    fallbackOpponentName?: string | null;
    onLeave?: () => void;
    onDestroy?: () => void;
    onForceExit?: () => void;
    onForceEndAiPhase?: () => Promise<boolean>;
    showForceEndAiPhase?: boolean;
    isLoading?: boolean;
    seatControllers: Record<string, AiSeatController>;
}) => {
    const { matchPlayers, isConnected } = useGameClient();
    const hudPresence = useMemo(() => resolveOnlineHudPresence({
        fallbackPlayers,
        transportPlayers: matchPlayers,
        transportReady: isConnected && matchPlayers.length > 0,
        myPlayerId,
        seatControllers,
    }), [fallbackPlayers, isConnected, matchPlayers, myPlayerId, seatControllers]);
    const canForceEndAiPhase = Boolean(showForceEndAiPhase && onForceEndAiPhase);

    return (
        <GameHUD
            mode="online"
            matchId={matchId}
            gameId={gameId}
            isHost={isHost}
            credentials={credentials}
            myPlayerId={myPlayerId}
            opponentName={hudPresence.opponentName ?? fallbackOpponentName ?? null}
            opponentConnected={hudPresence.opponentConnected}
            presenceReady={hudPresence.presenceReady}
            players={hudPresence.players}
            onLeave={onLeave}
            onDestroy={onDestroy}
            onForceExit={onForceExit}
            showForceEndAiPhase={canForceEndAiPhase}
            onForceEndAiPhase={canForceEndAiPhase ? onForceEndAiPhase : undefined}
            isLoading={isLoading}
        />
    );
};

export const MatchRoom = () => {
    usePerformanceMonitor();
    const { playerID: debugPlayerID, setPlayerID } = useDebug();
    const { gameId, matchId, tutorialId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { startTutorial, closeTutorial, isActive, currentStep, isBoardMounted } = useTutorial();
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const { t: tLobby, i18n } = useTranslation('lobby');
    const { user, token } = useAuth();
    const [onlineTransportError, setOnlineTransportError] = useState<string | null>(null);
    const [hasEverReceivedOnlineState, setHasEverReceivedOnlineState] = useState(false);
    const renderLogKeyRef = useRef<string | null>(null);

    const renderLogKey = `${gameId ?? 'unknown'}:${matchId ?? 'unknown'}:${searchParams.get('playerID') ?? 'no-player'}`;
    if (isNativeAndroidRuntime() && renderLogKeyRef.current !== renderLogKey) {
        renderLogKeyRef.current = renderLogKey;
        logMobileRuntimeCritical('MatchRoom', 'render-enter', {
            gameId,
            matchId,
            playerID: searchParams.get('playerID'),
            spectate: searchParams.get('spectate'),
            userId: user?.id ?? null,
        });
    }

    const gameConfig = gameId ? getGameById(gameId) : undefined;
    const guestId = useMemo(() => getOrCreateGuestId(), []);
    const guestName = useMemo(() => getGuestName(tLobby, guestId), [guestId, tLobby]);
    const gameDisplayName = resolveGameDisplayName(gameConfig, tLobby, gameId ?? '');
    const gamePageDataAttributes = useMemo(
        () => getGamePageDataAttributes(gameId, gameConfig),
        [gameConfig, gameId],
    );
    const requiresGameNamespace = Boolean(gameConfig);
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const isTutorialRoute = /^\/play\/[^/]+\/tutorial(?:\/[^/]+)?\/?$/.test(pathname);
    useEffect(() => syncGamePageDocumentAttributes(gamePageDataAttributes), [gamePageDataAttributes]);
    useEffect(() => {
        appendMatchLoadTrace({
            stage: 'match-room-mounted',
            gameId,
            matchId,
            payload: {
                playerID: searchParams.get('playerID'),
                spectate: searchParams.get('spectate'),
                isTutorialRoute,
            },
        });
    }, [gameId, isTutorialRoute, matchId, searchParams]);
    useEffect(() => {
        setOnlineTransportError(null);
    }, [gameId, matchId, isTutorialRoute]);
    useEffect(() => {
        setHasEverReceivedOnlineState(false);
    }, [gameId, matchId, isTutorialRoute]);

    // 在线模式：命令被服务端拒绝时的统一反馈
    const handleGameError = useCallback((error: string) => {
        if (ONLINE_TRANSPORT_ERRORS.has(error)) {
            setOnlineTransportError(error);
            return;
        }
        if (SYSTEM_ERRORS.has(error)) return; // 其他系统错误由独立逻辑处理
        if (isUiHintOnlyError(error, i18n, gameId)) return;
        playDeniedSound();
        toast.warning(resolveCommandError(i18n, error, gameId), undefined, { dedupeKey: `game.error.${error}` });
    }, [toast, i18n, gameId]);

    // 本地/教学模式：命令被引擎拒绝时的统一反馈
    // tutorial_command_blocked / tutorial_step_locked 是教程系统的正常拦截，同样静默
    // AI 命令失败的静默已在 LocalGameProvider 层面通过 __tutorialAiCommand 标记处理
    const handleCommandRejected = useCallback((_type: string, error: string) => {
        if (TUTORIAL_SILENT_ERRORS.has(error)) return;
        if (isUiHintOnlyError(error, i18n, gameId)) return;
        playDeniedSound();
        toast.warning(resolveCommandError(i18n, error, gameId), undefined, { dedupeKey: `game.rejected.${error}` });
    }, [toast, i18n, gameId]);

    // 包装 Board 组件（注入 CriticalImageGate）
    // 注意：不能依赖 t 函数引用，否则 i18n namespace 加载完成时 t 变化
    // → WrappedBoard 重建 → Board 卸载重挂载 → CriticalImageGate 重新预加载 → 循环
    const tRef = useRef(tLobby);
    tRef.current = tLobby;
    const [hasCompletedInitialOnlinePreload, setHasCompletedInitialOnlinePreload] = useState(false);
    useEffect(() => {
        setHasCompletedInitialOnlinePreload(false);
    }, [gameId, matchId, isTutorialRoute]);

    const {
        isGameNamespaceReady,
        gameNamespaceError,
        retryGameNamespaceLoad,
    } = useGameNamespaceReady(gameId, i18n, { required: requiresGameNamespace });
    const {
        isGameImplementationReady,
        gameImplementationError,
        retryGameImplementationLoad,
    } = useGameImplementationReady(gameId, {
        enabled: Boolean(gameId),
        includeTutorial: isTutorialRoute,
        tutorialId,
    });
    const gameImplReady = isGameImplementationReady;
    const resolvedTutorialManifest = useMemo(() => {
        if (!gameId || !isTutorialRoute || !gameImplReady) {
            return null;
        }
        return resolveGameTutorialManifest(gameId, tutorialId);
    }, [gameId, gameImplReady, isTutorialRoute, tutorialId]);
    const tutorialLoadingProgressText = useMemo(() => {
        if (!isTutorialRoute) return undefined;
        if (!gameId || !isGameNamespaceReady) {
            return tLobby('matchRoom.loadingProgress.loadingGameModule');
        }
        return tLobby('tutorial.steps.setup', {
            ns: `game-${gameId}`,
            defaultValue: tLobby('matchRoom.loadingProgress.preparingRoom'),
        });
    }, [gameId, isGameNamespaceReady, isTutorialRoute, tLobby]);

    useEffect(() => {
        if (gameImplementationError) {
            appendMatchLoadTrace({
                stage: 'match-room-client-error',
                gameId,
                matchId,
                payload: {
                    error: gameImplementationError,
                    isTutorialRoute,
                },
            });
        }
    }, [gameId, gameImplementationError, isTutorialRoute, matchId]);

    useEffect(() => {
        if (gameImplReady) {
            appendMatchLoadTrace({
                stage: 'match-room-client-ready',
                gameId,
                matchId,
                payload: {
                    isTutorialRoute,
                },
            });
        }
    }, [gameId, gameImplReady, isTutorialRoute, matchId]);

    // 教程模式始终保留强门禁，避免首步引导和资源切阶段互相打架。
    // 联机模式仅在首次进入对局时阻塞并显示真实素材进度，首轮完成后恢复后台预加载，
    // 避免后续阶段切换反复盖住棋盘。
    const shouldBlockBoardOnImagePreload = isTutorialRoute || !hasCompletedInitialOnlinePreload;
    const WrappedBoard = useMemo<ComponentType<GameBoardProps> | null>(() => {
        if (!gameId || !gameImplReady) return null;
        const impl = getGameImplementation(gameId);
        if (!impl) return null;
        const Board = impl.board as unknown as ComponentType<GameBoardProps>;
        const Wrapped: ComponentType<GameBoardProps> = (props) => (
            <CriticalImageGate
                gameId={gameId}
                gameState={props?.G}
                locale={i18n.language}
                playerID={props?.playerID}
                enabled={true}
                blockRendering={shouldBlockBoardOnImagePreload}
                loadingDescription={tRef.current('matchRoom.loadingResources')}
                onReady={() => {
                    if (!isTutorialRoute) {
                        setHasCompletedInitialOnlinePreload(true);
                    }
                }}
            >
                <Board {...props} />
            </CriticalImageGate>
        );
        Wrapped.displayName = 'WrappedOnlineBoard';
        return Wrapped;
    }, [
        gameId,
        gameImplReady,
        i18n.language,
        isTutorialRoute,
        shouldBlockBoardOnImagePreload,
    ]);

    // 从游戏实现中获取引擎配置（教学模式用）
    const engineConfig = useMemo(() => {
        if (!gameId || !gameImplReady) return null;
        return getGameImplementation(gameId)?.engineConfig ?? null;
    }, [gameId, gameImplReady]);

    // 从游戏实现中获取延迟优化配置
    const latencyConfig = useMemo(() => {
        if (!gameId || !gameImplReady) return undefined;
        return getGameImplementation(gameId)?.latencyConfig;
    }, [gameId, gameImplReady]);

    // 在线模式是否就绪
    const hasOnlineBoard = Boolean(WrappedBoard && gameId);

    // 教程模式是否就绪
    const hasTutorialBoard = Boolean(WrappedBoard && engineConfig && gameId);

    const [isLeaving, setIsLeaving] = useState(false);
    const [destroyModalId, setDestroyModalId] = useState<string | null>(null);
    const [forceExitModalId, setForceExitModalId] = useState<string | null>(null);
    const [shouldShowMatchError, setShouldShowMatchError] = useState(false);
    const [localStorageTick, setLocalStorageTick] = useState(0);
    const [onlineAiSeatControllers, setOnlineAiSeatControllers] = useState<Record<string, AiSeatController>>({});
    const [onlineAiSeatCredentials, setOnlineAiSeatCredentials] = useState<Record<string, string>>({});
    const [forceEndAiPhaseHandler, setForceEndAiPhaseHandler] = useState<(() => Promise<boolean>) | null>(null);
    const tutorialStartedRef = useRef(false);
    const lastTutorialStepIdRef = useRef<string | null>(null);
    const tutorialModalIdRef = useRef<string | null>(null);
    const errorToastRef = useRef<{ key: string; timestamp: number } | null>(null);
    const handledMissingMatchRef = useRef<string | null>(null);
    const hasOnlineAiSeat = useMemo(
        () => Object.values(onlineAiSeatControllers).some((controller) => controller.type !== 'human'),
        [onlineAiSeatControllers],
    );
    const handleForceEndAiPhaseReady = useCallback((handler: (() => Promise<boolean>) | null) => {
        setForceEndAiPhaseHandler(() => handler);
    }, []);

    // 大厅阶段只预热 resolver 标记为 critical 的基础资源。
    // warm 资源保留到真正进入对局、拿到玩家视角后再排队，避免无关素材抢占连接池，
    // 打乱“自己 -> 对手 -> 其他”的进入对局加载顺序。
    // 使用 preloadWarmImages（requestIdleCallback）不阻塞主线程。
    const lobbyPreloadStartedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!gameId || !isGameNamespaceReady || isTutorialRoute) return;
        if (lobbyPreloadStartedRef.current === gameId) return;
        lobbyPreloadStartedRef.current = gameId;
        // resolver 无状态降级：返回该游戏在大厅里也值得抢先预热的基础资源列表
        const resolved = resolveCriticalImages(gameId, undefined, i18n.language);
        const criticalPaths = [...new Set(resolved.critical)];
        if (criticalPaths.length > 0) {
            preloadWarmImages(criticalPaths, i18n.language, gameId);
        }
    }, [gameId, isGameNamespaceReady, isTutorialRoute, i18n.language]);


    // 从地址查询参数中获取 playerID
    const urlPlayerID = searchParams.get('playerID');
    const shouldAutoJoin = searchParams.get('join') === 'true';
    const spectateParam = searchParams.get('spectate');
    const storedMatchCreds = useMemo(() => {
        void localStorageTick;
        // 教程模式不需要房间凭据
        if (isTutorialRoute || !matchId) return null;
        const raw = localStorage.getItem(`match_creds_${matchId}`);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as { playerID?: string; credentials?: string };
        } catch {
            return null;
        }
    }, [matchId, isTutorialRoute, localStorageTick]);
    const storedPlayerID = storedMatchCreds?.playerID;
    const hasStoredSeat = Boolean(storedPlayerID);
    const isSpectatorRoute = !isTutorialRoute
        && !shouldAutoJoin
        && !urlPlayerID
        && !hasStoredSeat
        && (spectateParam === null || spectateParam === '1' || spectateParam === 'true');
    useEffect(() => {
        // 日志已移除：Spectate 调试信息过于频繁
    }, [gameId, matchId, urlPlayerID, shouldAutoJoin, spectateParam, isSpectatorRoute]);

    // 自动加入逻辑（调试重置跳转）
    const [isAutoJoining, setIsAutoJoining] = useState(false);
    const [autoJoinError, setAutoJoinError] = useState<string | null>(null);
    const autoJoinStartedRef = useRef(false);
    // 自动加入完成后的宽限期（防止 validateStoredMatchSeat 在 matchStatus 刷新前清除凭据）
    const autoJoinGraceRef = useRef(false);
    useEffect(() => {
        if (!shouldAutoJoin || !gameId || !matchId || isTutorialRoute) return;
        if (autoJoinStartedRef.current) {
            return;
        }
        autoJoinStartedRef.current = true;
        setAutoJoinError(null);

        let cancelled = false;
        let retryTimer: number | undefined;

        // 如果已有凭据，直接触发 localStorageTick 让 navigate effect 处理跳转
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                if (data?.playerID) {
                    // 已有凭据，触发 tick 让 navigate effect 更新 URL
                    setLocalStorageTick((t) => t + 1);
                    return;
                }
            } catch {
                // 解析失败，继续自动加入
            }
        }

        setIsAutoJoining(true);
        const guestId = getOrCreateGuestId();
        const playerName = user?.username || tLobby('player.guest', { id: guestId, ns: 'lobby' });

        let retryCount = 0;
        const maxRetries = 5;

        const scheduleRetry = (delay: number) => {
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
            retryTimer = window.setTimeout(() => {
                if (!cancelled) {
                    void tryJoin();
                }
            }, delay);
        };

        const tryJoin = async () => {
            if (cancelled) return;
            try {
                const { success, error } = await rejoinMatch(
                    gameId,
                    matchId,
                    undefined,
                    playerName,
                    { guestId: user?.id ? undefined : guestId },
                );
                if (cancelled) return;
                if (success) {
                    // rejoinMatch 内部已调用 persistMatchCredentials，
                    // 会触发 match-credentials-changed 事件 → localStorageTick 更新
                    // → storedPlayerID 有值 → navigate effect 自动更新 URL
                    // 设置宽限期，防止 validateStoredMatchSeat 在 matchStatus 刷新前清除凭据
                    autoJoinGraceRef.current = true;
                    window.setTimeout(() => { autoJoinGraceRef.current = false; }, 5000);
                    // 显式触发 tick，确保 storedMatchCreds 立即重新计算
                    setLocalStorageTick((t) => t + 1);
                    setIsAutoJoining(false);
                } else {
                    if (error === 'room_full') {
                        setAutoJoinError(tLobby('error.roomFull'));
                        setIsAutoJoining(false);
                        return;
                    }
                    retryCount++;
                    if (retryCount < maxRetries) {
                        scheduleRetry(500);
                    } else {
                        if (!cancelled) {
                            setAutoJoinError(tLobby('error.joinRoomFailed'));
                            setIsAutoJoining(false);
                        }
                    }
                }
            } catch {
                if (cancelled) return;
                retryCount++;
                if (retryCount < maxRetries) {
                    scheduleRetry(500);
                } else {
                    if (!cancelled) {
                        setAutoJoinError(tLobby('error.joinRoomFailed'));
                        setIsAutoJoining(false);
                    }
                }
            }
        };

        // 创建房间已改为“建房即房主持有 seat 0 凭据”，无需再人为等待 1 秒。
        // 直接首试，失败时再按现有退避策略重试。
        void tryJoin();

        return () => {
            cancelled = true;
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
            autoJoinStartedRef.current = false;
        };
    }, [shouldAutoJoin, gameId, matchId, isTutorialRoute, tLobby, user]);

    // 获取凭据
    const credentials = useMemo(() => {
        if (!matchId) return undefined;
        const resolvedPlayerID = urlPlayerID ?? storedPlayerID;
        if (!resolvedPlayerID) return undefined;
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (stored) {
            try {
                const data = JSON.parse(stored) as { playerID?: string; credentials?: string };
                if (data.playerID === resolvedPlayerID) {
                    return data.credentials;
                }
            } catch {
                return undefined;
            }
        }
        return undefined;
    }, [matchId, urlPlayerID, storedPlayerID]);

    useEffect(() => {
        if (!matchId || !gameId) return;
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (!stored) return;
        try {
            const data = JSON.parse(stored);
            if (data.gameName !== gameId) {
                persistMatchCredentials(matchId, {
                    ...data,
                    matchID: data.matchID || matchId,
                    gameName: gameId,
                });
            }
        } catch {
            return;
        }
    }, [gameId, matchId]);

    const tutorialPlayerID = debugPlayerID ?? urlPlayerID ?? '0';

    // 进入联机对局时，调试面板自动切换到自己对应的玩家视角
    useEffect(() => {
        if (isTutorialRoute) return;
        if (!urlPlayerID) return;
        if (debugPlayerID === urlPlayerID) return;
        setPlayerID(urlPlayerID);
    }, [debugPlayerID, isTutorialRoute, setPlayerID, urlPlayerID]);

    // 联机对局始终使用地址中的玩家编号，缺失时回退到本地凭据
    const effectivePlayerID = isTutorialRoute
        ? tutorialPlayerID
        : (urlPlayerID ?? storedPlayerID ?? undefined);

    const statusPlayerID = isTutorialRoute
        ? (urlPlayerID ?? debugPlayerID ?? null)
        : (urlPlayerID ?? storedPlayerID ?? null);

    useEffect(() => {
        const handleStorage = () => setLocalStorageTick((t) => t + 1);
        const handleCredentialsChange = () => setLocalStorageTick((t) => t + 1);
        const handleOwnerActive = () => setLocalStorageTick((t) => t + 1);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('match-credentials-changed', handleCredentialsChange);
        window.addEventListener('owner-active-match-changed', handleOwnerActive);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('match-credentials-changed', handleCredentialsChange);
            window.removeEventListener('owner-active-match-changed', handleOwnerActive);
        };
    }, []);

    useEffect(() => {
        if (isTutorialRoute) return;
        if (urlPlayerID || !storedPlayerID) return;
        if (spectateParam === '1' || spectateParam === 'true') return;
        if (!gameId || !matchId) return;
        navigate(`/play/${gameId}/match/${matchId}?playerID=${storedPlayerID}`, { replace: true });
    }, [gameId, matchId, navigate, spectateParam, storedPlayerID, urlPlayerID, isTutorialRoute]);

    // 使用房间状态钩子（以真实玩家身份为准）
    // 教程模式不需要房间状态检查
    const matchStatus = useMatchStatus(
        isTutorialRoute ? undefined : gameId,
        isTutorialRoute ? undefined : matchId,
        isTutorialRoute ? null : statusPlayerID
    );
    useEffect(() => {
        if (isTutorialRoute) return;
        if (!matchId || !statusPlayerID) return;
        if (matchStatus.isLoading || matchStatus.players.length === 0) return;
        // 自动加入过程中或刚完成自动加入时跳过验证（matchStatus 可能还未反映新加入的玩家）
        if (shouldAutoJoin || isAutoJoining || autoJoinGraceRef.current) return;

        const stored = readStoredMatchCredentials(matchId);
        const validation = validateStoredMatchSeat(stored, matchStatus.players, statusPlayerID);
        if (!validation.shouldClear) return;

        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        setLocalStorageTick((t) => t + 1);
        toast.warning({ kind: 'i18n', key: 'error.localStateCleared', ns: 'lobby' });
    }, [isTutorialRoute, matchId, statusPlayerID, matchStatus.isLoading, matchStatus.players, toast, shouldAutoJoin, isAutoJoining]);

    useEffect(() => {
        if (isTutorialRoute || !matchId || !gameId || !gameConfig) {
            setOnlineAiSeatControllers({});
            setOnlineAiSeatCredentials({});
            return;
        }

        let cancelled = false;

        const loadOnlineAiSeatControllers = async () => {
            try {
                const matchInfo = await matchApi.getMatch(gameId, matchId);
                if (cancelled) return;

                const storedAiSeatCredentials = readStoredAiSeatCredentials(matchId);
                const nextAiSeatState = await loadOnlineAiSeatState({
                    gameConfig,
                    matchInfo,
                    storedAiSeatCredentials,
                    claimMissingSeatCredential: matchStatus.isHost
                        ? async (playerId) => {
                            const aiPlayerName = tLobby('createRoom.aiPlayerName', { seat: Number(playerId) + 1 });
                            const response = await matchApi.claimSeat(gameId, matchId, playerId, token
                                ? {
                                    token,
                                    playerName: aiPlayerName,
                                }
                                : {
                                    guestId,
                                    playerName: aiPlayerName,
                                });
                            return response.playerCredentials;
                        }
                        : undefined,
                    onClaimError: (playerId, error) => {
                        console.warn('[MatchRoom] AI 座位补领失败', {
                            matchId,
                            playerId,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    },
                });
                if (cancelled) return;

                if (matchStatus.isHost && haveAiSeatCredentialsChanged(storedAiSeatCredentials, nextAiSeatState.seatCredentials)) {
                    persistAiSeatCredentials(matchId, nextAiSeatState.seatCredentials);
                }

                setOnlineAiSeatControllers(nextAiSeatState.seatControllers);
                setOnlineAiSeatCredentials(nextAiSeatState.seatCredentials);
            } catch {
                if (!cancelled) {
                    setOnlineAiSeatControllers({});
                    setOnlineAiSeatCredentials({});
                }
            }
        };

        void loadOnlineAiSeatControllers();

        return () => {
            cancelled = true;
        };
    }, [gameConfig, gameId, guestId, guestName, isTutorialRoute, localStorageTick, matchId, matchStatus.isHost, tLobby, token]);
    // 教程启动 effect
    // 使用 useLayoutEffect 确保在 CriticalImageGate 的 useEffect 之前执行。
    // 配合 TutorialDispatchBridge 的 useLayoutEffect（先 bindDispatch），
    // startTutorial 可以直接通过 controller 执行 START 命令，
    // setState 在 useLayoutEffect 中同步触发重新渲染，
    // CriticalImageGate 直接看到 playing 阶段的 state，只需预加载一次。
    const gameImplReadyRef = useRef(gameImplReady);
    gameImplReadyRef.current = gameImplReady;

    useLayoutEffect(() => {
        if (!isTutorialRoute) return;
        // 等待 i18n 命名空间加载完成，避免在 namespace 加载期间启动教程
        // （namespace 加载会导致 Board 卸载重挂载，重置游戏状态）
        if (!isGameNamespaceReady) return;
        // 等待游戏实现加载完成，否则 getGameImplementation 返回 null
        if (!gameImplReadyRef.current) return;
        
        // 只在未激活且未启动过时调用 startTutorial
        // 不依赖 tutorial.manifestId/steps.length，避免 startTutorial 的 setTutorial 触发循环
        if (!isActive && !tutorialStartedRef.current) {
            if (resolvedTutorialManifest) {
                tutorialStartedRef.current = true;
                startTutorial(resolvedTutorialManifest);
            }
        }
    }, [startTutorial, isTutorialRoute, isActive, isGameNamespaceReady, resolvedTutorialManifest]);

    // gameImplReady 变为 true 时补触发一次教程启动
    // 场景：dev 模式首次加载时 i18n namespace 先于游戏实现加载完成，
    // 上面的 useLayoutEffect 执行时 gameImplReady 还是 false（通过 ref 读取），
    // 等游戏实现加载完后需要重新尝试启动教程。
    useEffect(() => {
        if (!gameImplReady) return;
        if (!isTutorialRoute) return;
        if (!isGameNamespaceReady) return;
        if (isActive || tutorialStartedRef.current) return;
        if (resolvedTutorialManifest) {
            tutorialStartedRef.current = true;
            startTutorial(resolvedTutorialManifest);
        }
    }, [gameImplReady, isTutorialRoute, isGameNamespaceReady, isActive, startTutorial, resolvedTutorialManifest]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!isBoardMounted) return;
        if (!gameImplReady) return;
        if (!isGameNamespaceReady) return;
        if (isActive) return;
        if (lastTutorialStepIdRef.current === 'finish') return;
        if (!resolvedTutorialManifest) return;

        tutorialStartedRef.current = true;
        startTutorial(resolvedTutorialManifest);
    }, [gameImplReady, isActive, isBoardMounted, isGameNamespaceReady, isTutorialRoute, resolvedTutorialManifest, startTutorial]);

    // 组件真正卸载时清理教程
    // 使用 setTimeout(0) 延迟执行：如果是 StrictMode 的 unmount→remount，
    // remount 会在同一微任务内发生，可以在 setTimeout 回调前取消清理。
    // 如果是真正卸载（路由切换），setTimeout 回调正常执行。
    const closeTutorialRef = useRef(closeTutorial);
    closeTutorialRef.current = closeTutorial;
    const cleanupTimerRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        // mount 时取消待执行的清理（StrictMode remount 场景）
        if (cleanupTimerRef.current !== undefined) {
            window.clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = undefined;
        }
        return () => {
            if (tutorialStartedRef.current) {
                // 延迟清理：给 StrictMode remount 一个取消的机会
                cleanupTimerRef.current = window.setTimeout(() => {
                    cleanupTimerRef.current = undefined;
                    if (tutorialStartedRef.current) {
                        tutorialStartedRef.current = false;
                        closeTutorialRef.current();
                    }
                }, 0);
            }
        };
    }, []);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!isActive) return;
        // 教程已激活时同步标记（兜底：如果 startTutorial 之外的路径激活了教程）
        tutorialStartedRef.current = true;
    }, [isTutorialRoute, isActive]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (currentStep?.id) {
            lastTutorialStepIdRef.current = currentStep.id;
        }
    }, [currentStep?.id, isTutorialRoute]);

    // 教程视角自动切换：步骤指定 viewAs 时切换到对应玩家视角，步骤结束后恢复到 '0'
    useEffect(() => {
        if (!isTutorialRoute) return;
        const targetView = currentStep?.viewAs ?? '0';
        setPlayerID(targetView);
    }, [currentStep?.viewAs, isTutorialRoute, setPlayerID]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!tutorialStartedRef.current) return;

        // 教程模式下，部分游戏会在初始化/重置时短暂触发 tutorial.active=false。
        // 这里避免把"瞬间失活"误判为"教程已结束"，导致刚进入就 navigate(-1) 退回首页。
        if (!isActive) {
            const timer = window.setTimeout(() => {
                if (!tutorialStartedRef.current) return;
                // 二次确认仍未激活，且已进入完成步骤时才认为教程结束并返回。
                if (!isActive && lastTutorialStepIdRef.current === 'finish') {
                    navigate(-1);
                }
            }, 600);
            return () => window.clearTimeout(timer);
        }
    }, [isTutorialRoute, isActive, navigate]);

    useEffect(() => {
        // 关键约束：教程提示层只允许在 /tutorial 路由出现。
        // 否则如果某个联机对局状态中残留了 sys.tutorial.active=true（例如历史教程状态被持久化），
        // 就会在联机模式下误弹出教程提示。
        if (!isTutorialRoute) {
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
            // 联机/非教程路由下，不主动 closeTutorial()，避免在用户确实处于教程流程但路由切换瞬间被误关。
            return;
        }

        if (isActive && !tutorialModalIdRef.current && isBoardMounted) {
            tutorialModalIdRef.current = openModal({
                closeOnBackdrop: false,
                closeOnEsc: false,
                lockScroll: true,
                allowPointerThrough: true,
                onClose: () => {
                    tutorialModalIdRef.current = null;
                },
                render: () => <TutorialOverlay />,
            });
        }

        // Board 被 CriticalImageGate 卸载（phaseKey 变化触发重新预加载）时，
        // 关闭教程弹窗，避免弹窗悬浮在 LoadingScreen 上方。
        // Board 重新挂载后 isBoardMounted 恢复为 true，弹窗会重新打开。
        if (tutorialModalIdRef.current && !isBoardMounted) {
            closeModal(tutorialModalIdRef.current);
            tutorialModalIdRef.current = null;
        }

        if (!isActive && tutorialModalIdRef.current) {
            closeModal(tutorialModalIdRef.current);
            tutorialModalIdRef.current = null;
        }
    }, [closeModal, closeTutorial, isActive, isBoardMounted, isTutorialRoute, openModal]);

    const navigateBackToLobby = useCallback(() => {
        if (gameId) {
            navigate(`/?game=${gameId}`, { replace: true });
            return;
        }
        navigate('/', { replace: true });
    }, [gameId, navigate]);

    const clearMatchLocalState = useCallback(() => {
        if (!matchId) return;
        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        // 关键：强制退出时，也要增加对当前房间的“主页活跃对局”抑制，
        // 确保即使在跨标签页同步延迟时，主页也能立即排除此房间。
        suppressOwnerActiveMatch(matchId);
    }, [matchId]);

    const lobbyPresence = useLobbyMatchPresence({
        gameId,
        matchId,
        enabled: !isTutorialRoute && Boolean(gameId && matchId),
        // 旧房间可能从未出现在当前大厅快照中，仍需判定为缺失。
        requireSeen: false,
    });

    useEffect(() => {
        if (isTutorialRoute || !matchId || !lobbyPresence.isMissing) return;
        if (hasEverReceivedOnlineState) return;
        // 自动加入过程中不检查房间是否缺失（lobby 快照可能尚未包含该房间）
        if (shouldAutoJoin || isAutoJoining || autoJoinGraceRef.current) return;
        // 如果 matchStatus 没有报错，说明房间仍然存在（可能只是游戏结束后从大厅列表移除了）
        // 此时不应该跳转，让玩家看到结果和再来一局按钮
        if (matchStatus.errorKind !== 'not_found') return;
        if (handledMissingMatchRef.current === matchId) return;
        handledMissingMatchRef.current = matchId;

        let cancelled = false;
        const confirmMissing = async () => {
            if (!gameId) {
                handledMissingMatchRef.current = null;
                return;
            }

            try {
                await matchApi.getMatch(gameId, matchId);
                if (cancelled) return;
                handledMissingMatchRef.current = null;
            } catch (err) {
                if (cancelled) return;
                if (!isMatchNotFoundError(err)) {
                    handledMissingMatchRef.current = null;
                    return;
                }
                clearMatchLocalState();
                toast.warning(
                    { kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' },
                    undefined,
                    { dedupeKey: `matchRoom.missing.${matchId}` }
                );
                navigateBackToLobby();
            }
        };

        void confirmMissing();

        return () => {
            cancelled = true;
        };
    }, [clearMatchLocalState, gameId, hasEverReceivedOnlineState, isAutoJoining, isTutorialRoute, lobbyPresence.isMissing, matchId, matchStatus.errorKind, navigateBackToLobby, shouldAutoJoin, toast]);

    const handleForceExitLocal = () => {
        clearMatchLocalState();
        navigateBackToLobby();
    };

    const openForceExitModal = () => {
        if (forceExitModalId) return;
        const modalId = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                setForceExitModalId(null);
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={tLobby('matchRoom.destroy.forceExitTitle')}
                    description={tLobby('matchRoom.destroy.forceExitDescription')}
                    confirmText={tLobby('matchRoom.destroy.forceExitConfirm')}
                    onConfirm={() => {
                        close();
                        handleForceExitLocal();
                    }}
                    onCancel={() => {
                        close();
                    }}
                    tone="cool"
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
        setForceExitModalId(modalId);
    };

    // 离开房间处理 - 主动离开时释放座位（房主/非房主一致）
    const handleLeaveRoom = async () => {
        if (!matchId) {
            navigateBackToLobby();
            return;
        }

        // 观战 / 未绑定身份：直接返回大厅
        if (!statusPlayerID || !credentials) {
            navigateBackToLobby();
            return;
        }

        setIsLeaving(true);
        const result = await leaveMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        setIsLeaving(false);
        if (!result.success) {
            toast.error({ kind: 'i18n', key: 'matchRoom.leaveFailed', ns: 'lobby' });
            return;
        }
        navigateBackToLobby();
    };

    const handleConfirmDestroy = async () => {
        if (!matchId || !statusPlayerID || !credentials || !matchStatus.isHost) {
            toast.warning({ kind: 'i18n', key: 'matchRoom.destroy.notAllowed', ns: 'lobby' });
            return;
        }

        setIsLeaving(true);
        const result = await destroyMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        if (!result.success) {
            // 关键：销毁失败时不要清理本地凭证，也不要跳转。
            // 否则会出现「后端房间仍存在 + 前端以为销毁了」的累加/脏数据问题。
            toast.error({ kind: 'i18n', key: 'matchRoom.destroy.failed', ns: 'lobby' });
            setIsLeaving(false);
            openForceExitModal();
            return;
        }

        clearMatchLocalState();
        navigateBackToLobby();
    };

    // 真正销毁房间（仅房主可用）
    const handleDestroyRoom = async () => {
        if (!matchId || !statusPlayerID || !credentials || !matchStatus.isHost) {
            if (!credentials) {
                toast.error({ kind: 'i18n', key: 'matchRoom.destroy.missingCredentials', ns: 'lobby' });
            }
            return;
        }

        if (destroyModalId) {
            closeModal(destroyModalId);
            setDestroyModalId(null);
        }
        const modalId = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                setDestroyModalId(null);
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={tLobby('matchRoom.destroy.title')}
                    description={tLobby('matchRoom.destroy.description')}
                    onConfirm={() => {
                        close();
                        handleConfirmDestroy();
                    }}
                    onCancel={() => {
                        close();
                    }}
                    tone="cool"
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
        setDestroyModalId(modalId);
    };

    useEffect(() => {
        if (isTutorialRoute) {
            setShouldShowMatchError(false);
            return;
        }
        if (hasEverReceivedOnlineState) {
            setShouldShowMatchError(false);
            return;
        }
        if (matchStatus.errorKind !== 'not_found') {
            setShouldShowMatchError(false);
            return;
        }
        // 404 错误立即显示，无需延迟
        setShouldShowMatchError(true);
    }, [hasEverReceivedOnlineState, isTutorialRoute, matchStatus.errorKind]);

    // 如果房间不存在，显示错误并自动跳转
    useEffect(() => {
        if (shouldShowMatchError) {
            const timer = setTimeout(() => {
                navigate('/');
            }, 1500); // 1.5 秒后自动跳转（从 2.5 秒缩短）

            return () => clearTimeout(timer);
        }
    }, [shouldShowMatchError, isTutorialRoute, navigate]);

    useEffect(() => {
        return () => {
            if (destroyModalId) {
                closeModal(destroyModalId);
                setDestroyModalId(null);
            }
            if (forceExitModalId) {
                closeModal(forceExitModalId);
                setForceExitModalId(null);
            }
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
        };
    }, [closeModal, destroyModalId, forceExitModalId]);

    useEffect(() => {
        if (!shouldShowMatchError) return;
        const key = `matchRoom.error.${gameId ?? 'unknown'}.${matchId ?? 'unknown'}`;
        const now = Date.now();
        const last = errorToastRef.current;
        if (last && last.key === key && now - last.timestamp < 3000) return;
        errorToastRef.current = { key, timestamp: now };
        toast.error(
            { kind: 'text', text: matchStatus.error ?? tLobby('matchRoom.error.matchMissing') },
            { kind: 'i18n', key: 'error.serviceUnavailable.title', ns: 'lobby' },
            { dedupeKey: key }
        );
    }, [gameId, matchId, matchStatus.error, shouldShowMatchError, tLobby, toast]);

    if (gameNamespaceError) {
        return (
            <GameNamespaceLoadError
                gameId={gameId}
                error={gameNamespaceError}
                onRetry={retryGameNamespaceLoad}
            />
        );
    }

    if (gameImplementationError) {
        return (
            <GameNamespaceLoadError
                gameId={gameId}
                error={gameImplementationError}
                onRetry={retryGameImplementationLoad}
                titleKey="matchRoom.clientLoadFailed"
                descriptionKey="matchRoom.clientLoadFailedDesc"
            />
        );
    }

    if (!isGameNamespaceReady) {
        return (
            <HudPortal>
                <LoadingScreen
                    description={tLobby('matchRoom.loadingResources')}
                    progressText={tLobby('matchRoom.loadingProgress.loadingGameModule')}
                />
            </HudPortal>
        );
    }

    if (!gameImplReady) {
        return (
            <HudPortal>
                <LoadingScreen
                    description={tLobby('matchRoom.loadingResources')}
                    progressText={tLobby('matchRoom.loadingProgress.loadingGameModule')}
                />
            </HudPortal>
        );
    }

    // 自动加入过程中显示加载状态
    if (isAutoJoining || (shouldAutoJoin && !credentials)) {
        if (autoJoinError) {
            return (
                <div className="w-full game-page-viewport bg-black flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-white/60 text-lg mb-4">{autoJoinError}</div>
                        <button
                            onClick={() => navigateBackToLobby()}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                        >
                            {tLobby('matchRoom.connectionTimeout.backToLobby')}
                        </button>
                    </div>
                </div>
            );
        }
        return (
            <HudPortal>
                <LoadingScreen
                    description={tLobby('matchRoom.joiningRoom')}
                    progressText={tLobby('matchRoom.loadingProgress.joiningRoom')}
                />
            </HudPortal>
        );
    }

    if (shouldShowMatchError) {
        return (
            <div className="w-full game-page-viewport bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="text-white/60 text-lg mb-4">{matchStatus.error}</div>
                    <div className="text-white/40 text-sm mb-6 animate-pulse">{tLobby('matchRoom.redirecting')}</div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                        {tLobby('matchRoom.returnHome')}
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="relative w-full game-page-viewport bg-black overflow-hidden font-sans" {...gamePageDataAttributes}>
            <SEO
                title={isTutorialRoute
                    ? tLobby('matchRoom.tutorialTitle', { game: gameDisplayName })
                    : tLobby('matchRoom.matchTitle', { game: gameDisplayName })}
                ogType="game"
                noIndex
            />
            <SmashUpOverlayProvider>
                {isTutorialRoute && (
                    <GameHUD
                        mode="tutorial"
                        matchId={matchId}
                        gameId={gameId}
                        isHost={matchStatus.isHost}
                        credentials={credentials}
                        myPlayerId={effectivePlayerID}
                        opponentName={matchStatus.opponentName}
                        opponentConnected={matchStatus.opponentConnected}
                        players={matchStatus.players}
                        onLeave={handleLeaveRoom}
                        onDestroy={handleDestroyRoom}
                        onForceExit={handleForceExitLocal}
                        isLoading={isLeaving}
                    />
                )}
                {isSpectatorRoute && !isTutorialRoute && (
                    <div
                        className="absolute inset-0 bg-transparent pointer-events-auto"
                        style={{ zIndex: UI_Z_INDEX.loading }}
                        aria-hidden="true"
                    />
                )}

                {/* 游戏棋盘 - 全屏 */}
                <MobileBoardShell battlefieldZoomMode={gameConfig?.mobileBattlefieldZoom}>
                    <div
                        className="w-full h-full"
                        style={{
                            '--font-game-display': gameConfig?.fontFamily?.display ? `'${gameConfig.fontFamily.display}', serif` : undefined,
                        } as React.CSSProperties}
                    >
                        <GameCursorProvider themeId={gameConfig?.cursorTheme} gameId={gameId} playerID={effectivePlayerID}>
                            {isTutorialRoute ? (
                                <GameModeProvider mode="tutorial">
                                    {!gameImplReady ? (
                                        <LoadingScreen
                                            anchor="container"
                                            title={tLobby('matchRoom.title.tutorial')}
                                            description={tLobby('matchRoom.loadingResources')}
                                            progressText={tLobby('matchRoom.loadingProgress.loadingGameModule')}
                                        />
                                    ) : hasTutorialBoard && engineConfig && WrappedBoard ? (
                                        <LocalGameProvider config={engineConfig} numPlayers={2} seed={`tutorial-${gameId}`} playerId="0" onCommandRejected={handleCommandRejected}>
                                            <TutorialDispatchBridge>
                                                <BoardBridge
                                                    board={WrappedBoard}
                                                    loading={(
                                                        <LoadingScreen
                                                            anchor="container"
                                                            title={tLobby('matchRoom.title.tutorial')}
                                                            description={tLobby('matchRoom.loadingResources')}
                                                            progressText={tutorialLoadingProgressText}
                                                        />
                                                    )}
                                                />
                                            </TutorialDispatchBridge>
                                        </LocalGameProvider>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/50">
                                            {tLobby('matchRoom.noTutorial')}
                                        </div>
                                    )}
                                </GameModeProvider>
                            ) : hasOnlineBoard && WrappedBoard && matchId ? (
                                    <GameModeProvider mode="online" isSpectator={isSpectatorRoute}>
                                        <RematchProvider
                                            matchId={matchId}
                                            playerId={effectivePlayerID ?? undefined}
                                            isMultiplayer={true}
                                        >
                                            <GameProvider
                                                server={getGameServerUrl()}
                                                matchId={matchId}
                                                playerId={isSpectatorRoute ? null : (effectivePlayerID ?? null)}
                                                credentials={credentials}
                                                engineConfig={engineConfig ?? undefined}
                                                latencyConfig={latencyConfig}
                                                onError={handleGameError}
                                                onStateReady={() => {
                                                    setHasEverReceivedOnlineState(true);
                                                    setOnlineTransportError(null);
                                                }}
                                                onConnectionChange={(connected) => {
                                                    if (connected) {
                                                        setOnlineTransportError(null);
                                                    }
                                                }}
                                            >
                                                <OnlineGameHudBridge
                                                    matchId={matchId}
                                                    gameId={gameId}
                                                    isHost={matchStatus.isHost}
                                                    credentials={credentials}
                                                    myPlayerId={effectivePlayerID}
                                                    fallbackPlayers={matchStatus.players}
                                                    fallbackOpponentName={matchStatus.opponentName}
                                                    onLeave={handleLeaveRoom}
                                                    onDestroy={handleDestroyRoom}
                                                    onForceExit={handleForceExitLocal}
                                                    onForceEndAiPhase={forceEndAiPhaseHandler ?? undefined}
                                                    showForceEndAiPhase={matchStatus.isHost && hasOnlineAiSeat}
                                                    isLoading={isLeaving}
                                                    seatControllers={onlineAiSeatControllers}
                                                />
                                                {matchStatus.isHost && engineConfig && Object.keys(onlineAiSeatControllers).length > 0 && (
                                                    <OnlineAiSeatBridge
                                                        server={getGameServerUrl()}
                                                        matchId={matchId}
                                                        engineConfig={engineConfig}
                                                        seatControllers={onlineAiSeatControllers}
                                                        seatCredentials={onlineAiSeatCredentials}
                                                        onForceEndAiPhaseReady={handleForceEndAiPhaseReady}
                                                    />
                                                )}
                                                <BoardBridge
                                                    board={WrappedBoard}
                                                    loading={(
                                                        <OnlineRoomConnectionLoading
                                                            title={tLobby('matchRoom.title.connecting')}
                                                            description={tLobby('matchRoom.loadingResources')}
                                                            gameId={gameId}
                                                            transportError={onlineTransportError}
                                                        />
                                                    )}
                                                />
                                            </GameProvider>
                                        </RematchProvider>
                                    </GameModeProvider>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/50">
                                        {tLobby('matchRoom.noClient')}
                                    </div>
                                )
                            }
                        </GameCursorProvider>
                    </div>
                </MobileBoardShell>
            </SmashUpOverlayProvider>

        </div>
    );
};
