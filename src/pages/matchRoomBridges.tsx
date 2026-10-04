import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useGameClient } from '../engine/transport/react';
import type { MatchState, TutorialManifest, TutorialState } from '../engine/types';
import { TUTORIAL_COMMANDS } from '../engine/systems/TutorialSystem';
import { useTutorial, type TutorialSessionScope } from '../contexts/TutorialContext';
import { useGameMode } from '../contexts/GameModeContext';
import type { OnlineAiDebugWindow } from './onlineAiRuntimeSupport';

export type MatchRoomSeatValidationSnapshot = {
    players: Array<{ id: number; name?: string | null; isConnected?: boolean }>;
    revision?: number;
    transportReady: boolean;
    lastConfirmedAt: number | null;
};

type OnlineSeatValidationBridgeProps = {
    onSnapshotChange: (snapshot: MatchRoomSeatValidationSnapshot) => void;
};

type TutorialProgressView = {
    manifestId: string | null;
    manifestRevision?: number;
    stepIndex: number;
    stepId: string | null;
    totalSteps: number;
};

const getProjectedTutorialStepCount = (
    tutorial: TutorialState | undefined,
    manifest?: TutorialManifest | null,
): number => {
    if (!tutorial) return 0;
    const transportTotal = (tutorial as TutorialState & { totalSteps?: number }).totalSteps;
    if (typeof transportTotal === 'number' && transportTotal > 0) return transportTotal;
    if (tutorial.steps?.length) return tutorial.steps.length;
    if (manifest && tutorial.manifestId === manifest.id) return manifest.steps.length;
    return 0;
};

const isSameTutorialRevision = (
    manifest: TutorialManifest,
    progress: { manifestRevision?: number | null },
): boolean => (
    !Number.isInteger(manifest.revision)
    || progress.manifestRevision === manifest.revision
);

const snapshotTutorialProgress = (
    tutorial: TutorialState | undefined,
    manifest?: TutorialManifest | null,
): TutorialProgressView | null => {
    if (!tutorial?.active) return null;
    const totalSteps = getProjectedTutorialStepCount(tutorial, manifest);
    return {
        manifestId: tutorial.manifestId ?? null,
        manifestRevision: tutorial.manifestRevision,
        stepIndex: tutorial.stepIndex,
        stepId: tutorial.step?.id ?? null,
        totalSteps,
    };
};

const wasLastActiveTutorialStep = (
    progress: TutorialProgressView | null,
    manifest: TutorialManifest,
): boolean => Boolean(
    progress
    && progress.manifestId === manifest.id
    && isSameTutorialRevision(manifest, progress)
    && progress.totalSteps > 0
    && progress.stepIndex >= progress.totalSteps - 1
);

export type MatchRoomLiveDebugBridgeProps = {
    matchId?: string;
    gameId?: string;
    urlPlayerID: string | null;
    storedPlayerID: string | null;
    effectivePlayerID: string | undefined;
    statusPlayerID: string | null;
    isSpectatorRoute: boolean;
    transportSeatValidationSnapshot: MatchRoomSeatValidationSnapshot;
    shouldUseTransportSeatValidation: boolean;
    matchStatusPlayers: Array<{ id: number; name?: string | null; isConnected?: boolean }>;
    matchStatusLoading: boolean;
};

export type MatchRoomOnlineRuntimeDebugBridgeProps = {
    seatValidation: OnlineSeatValidationBridgeProps;
    live: MatchRoomLiveDebugBridgeProps;
};

export const TutorialDispatchBridge = ({
    children,
    tutorialManifest,
    sessionScope,
}: {
    children: ReactNode;
    tutorialManifest?: TutorialManifest | null;
    sessionScope?: TutorialSessionScope | null;
}) => {
    const { dispatch, state } = useGameClient();
    const { bindDispatch, unbindDispatch, syncTutorialState, tutorial: contextTutorial } = useTutorial();
    const gameMode = useGameMode();
    const isTutorialMode = gameMode?.mode === 'tutorial';
    const dispatchRef = useRef(dispatch);
    const contextRef = useRef({ bindDispatch, unbindDispatch, syncTutorialState });
    const boundManifestRef = useRef<{
        manifest: TutorialManifest | null;
        stateKey: string | null;
    }>({ manifest: null, stateKey: null });
    const lastActiveTutorialProgressRef = useRef<TutorialProgressView | null>(null);
    const sessionScopeKey = sessionScope?.key ?? '';
    const contextTutorialActive = contextTutorial.active;
    const contextTutorialManifestId = contextTutorial.manifestId;
    const contextTutorialManifestRevision = contextTutorial.manifestRevision;

    useLayoutEffect(() => {
        dispatchRef.current = dispatch;
    }, [dispatch]);

    useLayoutEffect(() => {
        contextRef.current = { bindDispatch, unbindDispatch, syncTutorialState };
    }, [bindDispatch, unbindDispatch, syncTutorialState]);

    // 提前 bindDispatch，不等 Board 渲染
    // 使用 useLayoutEffect 确保在 CriticalImageGate 的 useEffect 之前执行，
    // 这样 START 命令的 setState 会同步触发重新渲染，CriticalImageGate 直接看到
    // playing 阶段的 state，只需预加载一次。
    useLayoutEffect(() => {
        if (!isTutorialMode) return;
        const dispatchTutorialCommand = (...args: [string, unknown?]) => dispatchRef.current(...args);
        const gen = sessionScope
            ? contextRef.current.bindDispatch(dispatchTutorialCommand, sessionScope)
            : contextRef.current.bindDispatch(dispatchTutorialCommand);
        return () => {
            contextRef.current.unbindDispatch(gen);
        };
    }, [isTutorialMode, sessionScope]);

    useLayoutEffect(() => {
        if (!isTutorialMode || !tutorialManifest) {
            boundManifestRef.current = { manifest: null, stateKey: null };
            return;
        }

        const tutorial = (state as MatchState | undefined)?.sys?.tutorial;
        const activeProgress = snapshotTutorialProgress(tutorial, tutorialManifest);
        if (activeProgress?.manifestId === tutorialManifest.id) {
            lastActiveTutorialProgressRef.current = activeProgress;
        }
        const contextMatchesManifest = contextTutorialActive
            && contextTutorialManifestId === tutorialManifest.id
            && isSameTutorialRevision(tutorialManifest, {
                manifestRevision: contextTutorialManifestRevision,
            });
        if (
            contextMatchesManifest
            && (!tutorial?.active || tutorial.manifestId !== tutorialManifest.id)
        ) {
            if (wasLastActiveTutorialStep(lastActiveTutorialProgressRef.current, tutorialManifest)) {
                boundManifestRef.current = { manifest: tutorialManifest, stateKey: 'completed-local-tutorial' };
                return;
            }
            boundManifestRef.current = { manifest: tutorialManifest, stateKey: 'restart-local-tutorial' };
            dispatchRef.current(TUTORIAL_COMMANDS.START, { manifest: tutorialManifest });
            return;
        }
        if (!tutorial?.active || tutorial.manifestId !== tutorialManifest.id) {
            boundManifestRef.current = { manifest: null, stateKey: null };
            return;
        }
        if (
            Number.isInteger(tutorialManifest.revision)
            && Number.isInteger(tutorial.manifestRevision)
            && tutorial.manifestRevision !== tutorialManifest.revision
        ) {
            boundManifestRef.current = { manifest: tutorialManifest, stateKey: 'restart-version-mismatched-tutorial' };
            dispatchRef.current(TUTORIAL_COMMANDS.START, { manifest: tutorialManifest });
            return;
        }
        if (tutorial.stepIndex <= 0 && !tutorialManifest.stepValidator) {
            boundManifestRef.current = { manifest: tutorialManifest, stateKey: null };
            return;
        }

        const stateKey = [
            sessionScopeKey,
            tutorial.manifestId,
            tutorial.manifestRevision ?? '',
            tutorial.stepIndex,
            tutorial.step?.id ?? '',
            tutorial.step && tutorialManifest.stepValidator
                ? (tutorialManifest.stepValidator(state as MatchState, tutorial.step) ? 'valid' : 'stale')
                : 'no-validator',
        ].join(':');
        if (
            boundManifestRef.current.manifest === tutorialManifest
            && boundManifestRef.current.stateKey === stateKey
        ) {
            return;
        }

        boundManifestRef.current = { manifest: tutorialManifest, stateKey };
        dispatchRef.current(TUTORIAL_COMMANDS.BIND_MANIFEST, { manifest: tutorialManifest });
    }, [
        contextTutorialActive,
        contextTutorialManifestId,
        contextTutorialManifestRevision,
        isTutorialMode,
        sessionScopeKey,
        state,
        tutorialManifest,
    ]);

    // 提前同步教程状态（Board 被 CriticalImageGate 阻塞时也能同步）
    const lastSyncRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isTutorialMode || !state) return;
        const tutorial = (state as MatchState).sys.tutorial;
        if (!tutorial) return;
        const contextMatchesManifest = contextTutorialActive
            && tutorialManifest
            && contextTutorialManifestId === tutorialManifest.id
            && isSameTutorialRevision(tutorialManifest, {
                manifestRevision: contextTutorialManifestRevision,
            });
        const localCloseCompletesCurrentTutorial = Boolean(
            tutorialManifest
            && contextMatchesManifest
            && (!tutorial.active || tutorial.manifestId !== tutorialManifest.id)
            && wasLastActiveTutorialStep(lastActiveTutorialProgressRef.current, tutorialManifest)
        );
        if (
            contextMatchesManifest
            && (!tutorial.active || tutorial.manifestId !== tutorialManifest.id)
            && !localCloseCompletesCurrentTutorial
        ) {
            return;
        }
        const sig = [
            sessionScopeKey,
            tutorial.active,
            tutorial.stepIndex,
            tutorial.step?.id ?? '',
            tutorial.step?.aiActions?.length ?? 0,
            tutorial.aiActions?.length ?? 0,
            tutorial.pendingAnimationAdvance ?? false,
            // 教程 AI 批次可能连续执行多条命令，但教程步骤在批次结束前不变。
            // 等待条件必须覆盖领域状态，否则会在响应窗口仍打开时提前消费 AI。
            (state as MatchState).sys?.phase ?? '',
            (state as MatchState).sys?.flowHalted ?? false,
            (state as MatchState).sys?.interaction?.current?.id ?? '',
            (state as MatchState).sys?.responseWindow?.current?.id ?? '',
            (state as MatchState).core && typeof (state as MatchState).core === 'object'
                ? ((state as MatchState).core as { activePlayerId?: unknown }).activePlayerId ?? ''
                : '',
            (state as MatchState).sys?.eventStream?.nextId ?? 0,
        ].join('-');
        if (lastSyncRef.current === sig) return;
        lastSyncRef.current = sig;
        if (sessionScope) {
            contextRef.current.syncTutorialState(tutorial, undefined, sessionScope);
        } else {
            contextRef.current.syncTutorialState(tutorial);
        }
    }, [
        contextTutorialActive,
        contextTutorialManifestId,
        contextTutorialManifestRevision,
        isTutorialMode,
        sessionScope,
        sessionScopeKey,
        state,
        tutorialManifest,
    ]);

    return <>{children}</>;
};

export const OnlineSeatValidationBridge = ({
    onSnapshotChange,
}: OnlineSeatValidationBridgeProps) => {
    const { matchPlayers, isConnected } = useGameClient();
    const observationRef = useRef<{
        isConnected: boolean | null;
        matchPlayers: typeof matchPlayers | null;
        revision: number;
    }>({
        isConnected: null,
        matchPlayers: null,
        revision: 0,
    });

    useEffect(() => {
        const observation = observationRef.current;
        if (observation.isConnected === isConnected && observation.matchPlayers === matchPlayers) {
            return;
        }
        observation.isConnected = isConnected;
        observation.matchPlayers = matchPlayers;
        observation.revision += 1;

        const transportReady = isConnected && matchPlayers.length > 0;
        onSnapshotChange({
            players: matchPlayers.map((player) => ({
                id: player.id,
                name: player.name,
                isConnected: player.isConnected,
            })),
            revision: observation.revision,
            transportReady,
            lastConfirmedAt: transportReady ? Date.now() : null,
        });
    }, [isConnected, matchPlayers, onSnapshotChange]);

    return null;
};

export const MatchRoomLiveDebugBridge = ({
    matchId,
    gameId,
    urlPlayerID,
    storedPlayerID,
    effectivePlayerID,
    statusPlayerID,
    isSpectatorRoute,
    transportSeatValidationSnapshot,
    shouldUseTransportSeatValidation,
    matchStatusPlayers,
    matchStatusLoading,
}: MatchRoomLiveDebugBridgeProps) => {
    const { state, playerId, matchPlayers, isConnected } = useGameClient();

    useEffect(() => {
        if (typeof window === 'undefined' || !import.meta.env.DEV) {
            return;
        }
        const debugWindow = window as OnlineAiDebugWindow;
        const currentResponseWindow = state?.sys?.responseWindow?.current as {
            sourceId?: unknown;
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        } | undefined;
        const currentInteractionData = state?.sys?.interaction?.current?.data as {
            sourceId?: unknown;
        } | undefined;
        const responseWindowResponderQueue = Array.isArray(currentResponseWindow?.responderQueue)
            ? currentResponseWindow.responderQueue
            : [];
        const responseWindowResponderIndex = typeof currentResponseWindow?.currentResponderIndex === 'number'
            ? currentResponseWindow.currentResponderIndex
            : 0;
        const responseWindowResponderId = typeof responseWindowResponderQueue[responseWindowResponderIndex] === 'string'
            ? responseWindowResponderQueue[responseWindowResponderIndex]
            : null;
        debugWindow.__BG_MATCHROOM_DEBUG__ = {
            getLiveSnapshot: () => ({
                matchId: matchId ?? null,
                gameId: gameId ?? null,
                urlPlayerID,
                storedPlayerID,
                effectivePlayerID: effectivePlayerID ?? null,
                statusPlayerID,
                providerPlayerID: playerId,
                isSpectatorRoute,
                isConnected,
                matchPlayers: matchPlayers.map((entry) => ({
                    id: entry.id,
                    name: entry.name ?? null,
                    isConnected: entry.isConnected,
                })),
                transportSeatValidationSnapshot: {
                    transportReady: transportSeatValidationSnapshot.transportReady,
                    lastConfirmedAt: transportSeatValidationSnapshot.lastConfirmedAt,
                    players: transportSeatValidationSnapshot.players.map((entry) => ({
                        id: entry.id,
                        name: entry.name ?? null,
                        isConnected: entry.isConnected,
                    })),
                },
                shouldUseTransportSeatValidation,
                matchStatusLoading,
                matchStatusPlayers: matchStatusPlayers.map((entry) => ({
                    id: entry.id,
                    name: entry.name ?? null,
                    isConnected: entry.isConnected,
                })),
                stateView: {
                    phase: state?.sys?.phase ?? null,
                    currentPlayerIndex: (state?.core as { currentPlayerIndex?: number } | undefined)?.currentPlayerIndex ?? null,
                    interactionSourceId: typeof currentInteractionData?.sourceId === 'string'
                        ? currentInteractionData.sourceId
                        : null,
                    interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                    responseWindowSourceId: typeof currentResponseWindow?.sourceId === 'string'
                        ? currentResponseWindow.sourceId
                        : null,
                    responseWindowPlayerId: responseWindowResponderId,
                },
            }),
        };
        return () => {
            delete debugWindow.__BG_MATCHROOM_DEBUG__;
        };
    }, [
        effectivePlayerID,
        gameId,
        isConnected,
        isSpectatorRoute,
        matchId,
        matchPlayers,
        matchStatusLoading,
        matchStatusPlayers,
        playerId,
        state,
        statusPlayerID,
        storedPlayerID,
        shouldUseTransportSeatValidation,
        transportSeatValidationSnapshot,
        urlPlayerID,
    ]);

    return null;
};

export const MatchRoomOnlineRuntimeDebugBridge = ({
    debug,
}: {
    debug: MatchRoomOnlineRuntimeDebugBridgeProps;
}) => {
    return (
        <>
            <OnlineSeatValidationBridge onSnapshotChange={debug.seatValidation.onSnapshotChange} />
            <MatchRoomLiveDebugBridge {...debug.live} />
        </>
    );
};
