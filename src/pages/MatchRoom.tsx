import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as matchApi from '../services/matchApi';
import { getGameImplementation, resolveGameTutorialManifest } from '../games/registry';
import {
    GameProvider,
    LocalGameProvider,
    BoardBridge,
    buildAiProgressMarker,
    GameClientOverrideProvider,
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
import { GameHUD, resolveGameHudPhase } from '../components/game/framework/widgets/GameHUD';
import { GameModeProvider } from '../contexts/GameModeContext';
import { SEO } from '../components/common/SEO';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { ConnectionLoadingScreen } from '../components/system/ConnectionLoadingScreen';
import { GameNamespaceLoadError } from '../components/system/GameNamespaceLoadError';
import { usePerformanceMonitor } from '../hooks/ui/usePerformanceMonitor';
import { CriticalImageGate, MobileBoardShell, resolveMatchSeatSwapContext } from '../components/game/framework';
import { preloadWarmImages } from '../core';
import { resolveCriticalImages } from '../core/CriticalImageResolverRegistry';
import { UI_Z_INDEX, HudPortal } from '../core';
import { playDeniedSound } from '../lib/audio/useGameAudio';
import { appendMatchLoadTrace } from '../lib/matchLoadTrace';
import { logMobileRuntimeCritical } from '../lib/mobile/mobileRuntimeDebug';
import { isNativeAndroidRuntime } from '../lib/mobile/androidRuntime';
import { onAppVisible } from '../lib/mobile/appVisibility';
import { createScopedLogger } from '../lib/logger';
import { isUiHintOnlyError, resolveCommandError } from '../engine/transport/errorI18n';
import { GameCursorProvider } from '../core/cursor';
import { useGameNamespaceReady } from '../hooks/useGameNamespaceReady';
import { useGameImplementationReady } from '../hooks/useGameImplementationReady';
import { SmashUpOverlayProvider } from '../games/smashup/ui/SmashUpOverlayContext';
import { SMASHUP_FORCE_DISMISS_EVENT } from '../games/smashup/ui/CardMagnifyOverlay';
import { notifyExitMatchErrorToast } from '../components/lobby/roomActions';
import { resolveGameDisplayName } from '../components/lobby/gameDetailsContent';
import { resolveOnlineHudPresence } from './matchHudPresence';
import {
    haveAiSeatCredentialsChanged,
    loadOnlineAiSeatState,
    resolveOnlineAiSeatClaimOptions,
    resolveMissingOnlineAiSeatCredentialIds,
} from './onlineAiSeats';
import {
    applyAiAutoRecoveryRejection,
    finalizeOnlineAiResolutionConfirmation,
    resolveCurrentPlayerId,
    resolveManualForceEndAiPhase,
    resolveOnlineAiAutoRecoveryCompletionNotice,
    resolveForceEndTurnRecoveryStep,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
    submitOnlineAiResolution,
    submitOnlineAiResolutionSequence,
    shouldSilentlyRetryOnlineAiBatchRejection,
    type ForceSkippableHiddenAiInteraction,
} from './onlineAiForceSkip';
import {
    resolveLocalAiActionDelayPlan,
    resolveNextAiDispatch,
    getGameAiRuntime,
    resolveOnlineAiDecisionView,
    startCancelableAiDelay,
    type AiSeatController,
} from '../engine/ai';
import { resolveLocalAiActionVisibility } from '../engine/ai/actionVisibility';
import { INTERACTION_COMMANDS } from '../engine/systems';

// 系统级同步错误，不需要 toast 提示给玩家；命令执行失败必须展示具体原因。
const SYSTEM_ERRORS = new Set(['stale_state']);
const ONLINE_TRANSPORT_ERRORS = new Set(['unauthorized', 'match_not_found', 'sync_timeout']);
// 教程系统正常拦截，不弹 toast（用户跟着教程走时的正常行为）
const TUTORIAL_SILENT_ERRORS = new Set(['tutorial_command_blocked', 'tutorial_step_locked']);
const ONLINE_AI_SEAT_LOAD_RETRY_BASE_MS = 1_000;
const ONLINE_AI_SEAT_LOAD_RETRY_MAX_MS = 8_000;
const ONLINE_AI_SEAT_LOAD_RETRY_MAX_ATTEMPTS = 5;
const ONLINE_AI_SEAT_CLAIM_AUTH_ERROR_STATUSES = new Set([401, 403]);
const MANUAL_SETUP_SELECTION_ACTION_KINDS = new Set([
    'select-faction',
    'setup-select-faction',
    'setup-select-character',
]);

type ManualSetupSelectionActionKind =
    | 'select-faction'
    | 'setup-select-faction'
    | 'setup-select-character';

export const isTutorialRoutePath = (pathname: string): boolean => (
    /^\/play\/[^/]+\/tutorial(?:\/[^/]+)?\/?$/.test(pathname)
);

export function shouldShowOnlineGameErrorToast(error: string): boolean {
    if (ONLINE_TRANSPORT_ERRORS.has(error)) return false;
    if (SYSTEM_ERRORS.has(error)) return false;
    return true;
}

const getMatchApiErrorStatus = (error: unknown): number | undefined => {
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status === 'number') return status;
    }
    const message = error instanceof Error ? error.message : String(error);
    const statusMatch = message.match(/^(\d{3})\b/);
    return statusMatch ? Number(statusMatch[1]) : undefined;
};

export type MissingMatchConfirmationSignal = 'transport_not_found' | null;

export function resolveMissingMatchConfirmationSignal(args: {
    isTutorialRoute: boolean;
    matchId?: string | null;
    shouldAutoJoin: boolean;
    isAutoJoining: boolean;
    autoJoinGraceActive: boolean;
    onlineTransportError?: string | null;
}): MissingMatchConfirmationSignal {
    if (args.isTutorialRoute || !args.matchId) return null;
    if (args.shouldAutoJoin || args.isAutoJoining || args.autoJoinGraceActive) return null;
    if (args.onlineTransportError === 'match_not_found') return 'transport_not_found';
    return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function resolveMatchRoomRouteIdentity(args: {
    isTutorialRoute: boolean;
    debugPlayerID?: string | null;
    urlPlayerID: string | null;
    storedPlayerID?: string | null;
    shouldAutoJoin: boolean;
    spectateParam: string | null;
}): {
    hasStoredSeat: boolean;
    isSpectatorRoute: boolean;
    effectivePlayerID: string | undefined;
    statusPlayerID: string | null;
    transportPlayerID: string | null;
} {
    const hasStoredSeat = Boolean(args.storedPlayerID);
    const isSpectatorRoute = !args.isTutorialRoute
        && !args.shouldAutoJoin
        && !args.urlPlayerID
        && !hasStoredSeat
        && (args.spectateParam === null || args.spectateParam === '1' || args.spectateParam === 'true');
    const tutorialPlayerID = args.debugPlayerID ?? args.urlPlayerID ?? '0';
    const effectivePlayerID = args.isTutorialRoute
        ? tutorialPlayerID
        : (args.urlPlayerID ?? args.storedPlayerID ?? undefined);
    const statusPlayerID = args.isTutorialRoute
        ? (args.urlPlayerID ?? args.debugPlayerID ?? null)
        : (args.urlPlayerID ?? args.storedPlayerID ?? null);
    const transportPlayerID = isSpectatorRoute ? null : (effectivePlayerID ?? null);

    return {
        hasStoredSeat,
        isSpectatorRoute,
        effectivePlayerID,
        statusPlayerID,
        transportPlayerID,
    };
}

export async function resolveManualOnlineAiRecovery(args: {
    engineConfig: Pick<GameEngineConfig, 'gameId'>;
    matchId: string;
    sharedState: MatchState<unknown>;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
    resolveDispatchImpl?: typeof resolveNextAiDispatch;
}): Promise<
    | {
        kind: 'force-end-turn';
        candidate: NonNullable<ReturnType<typeof resolveManualForceEndAiPhase>>;
    }
    | {
        kind: 'legal-action';
        resolution: Awaited<ReturnType<typeof resolveNextAiDispatch>> extends { kind: 'action'; resolution: infer R } ? R : never;
    }
    | {
        kind: 'blocked';
        playerId: string;
        blockedKey: string | null;
        blockedReason: string;
    }
    | {
        kind: 'unavailable';
    }
> {
    const candidate = resolveManualForceEndAiPhase({
        sharedState: args.sharedState,
        seatControllers: args.seatControllers,
        seatStates: args.seatStates,
    });
    if (candidate && candidate.legalActionOnly !== true) {
        return {
            kind: 'force-end-turn',
            candidate,
        };
    }

    const dispatchImpl = args.resolveDispatchImpl ?? resolveNextAiDispatch;
    const aiDispatchResult = await dispatchImpl({
        engineConfig: args.engineConfig as GameEngineConfig,
        state: args.sharedState,
        matchId: args.matchId,
        seatControllers: args.seatControllers,
        visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
            runtime: getGameImplementation(args.engineConfig.gameId).ai,
            sharedState: args.sharedState,
            privateOverlay: args.seatStates[playerId],
            playerId,
        }),
    });

    if (aiDispatchResult.kind === 'action') {
        return {
            kind: 'legal-action',
            resolution: aiDispatchResult.resolution,
        };
    }

    if (aiDispatchResult.kind === 'blocked') {
        return {
            kind: 'blocked',
            playerId: aiDispatchResult.playerId,
            blockedKey: aiDispatchResult.blockedKey,
            blockedReason: aiDispatchResult.blockedReason,
        };
    }

    return { kind: 'unavailable' };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isManualSetupSelectionActionKind(kind: string): kind is ManualSetupSelectionActionKind {
    return MANUAL_SETUP_SELECTION_ACTION_KINDS.has(kind);
}

// eslint-disable-next-line react-refresh/only-export-components
export function shouldTakeOverManualSetupSelection(args: {
    sharedState: MatchState<unknown> | null | undefined;
    currentPlayerId: string | null;
    seatControllers: Record<string, AiSeatController>;
    hasManualDispatch: boolean;
}): boolean {
    return resolveManualSetupSelectionTakeoverPlayerId(args) !== null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function resolveManualSetupSelectionTakeoverPlayerId(args: {
    sharedState: MatchState<unknown> | null | undefined;
    currentPlayerId: string | null;
    seatControllers: Record<string, AiSeatController>;
    hasManualDispatch: boolean;
}): string | null {
    if (!args.hasManualDispatch || !args.sharedState || typeof args.sharedState !== 'object') {
        return null;
    }

    const manualAiSeatIds = Object.entries(args.seatControllers)
        .filter(([, controller]) => controller.type !== 'human' && controller.manualFactionSelection === true)
        .map(([playerId]) => playerId);
    if (manualAiSeatIds.length === 0) {
        return null;
    }

    const phase = typeof args.sharedState.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : null;
    if (phase === 'factionSelect' && args.currentPlayerId && manualAiSeatIds.includes(args.currentPlayerId)) {
        return args.currentPlayerId;
    }

    const core = isPlainRecord(args.sharedState.core) ? args.sharedState.core : null;
    if (core?.hostStarted !== false) {
        return null;
    }

    if (isPlainRecord(core.selectedFactions)) {
        if (args.currentPlayerId && args.seatControllers[args.currentPlayerId]?.type === 'human') {
            const currentPlayerFaction = core.selectedFactions?.[args.currentPlayerId];
            if (typeof currentPlayerFaction !== 'string' || currentPlayerFaction === 'unselected') {
                return null;
            }
        }
        return manualAiSeatIds.find((playerId) => {
            const selectedFaction = core.selectedFactions?.[playerId];
            return typeof selectedFaction !== 'string' || selectedFaction === 'unselected';
        }) ?? null;
    }

    if (isPlainRecord(core.selectedCharacters)) {
        if (args.currentPlayerId && args.seatControllers[args.currentPlayerId]?.type === 'human') {
            const currentPlayerCharacter = core.selectedCharacters?.[args.currentPlayerId];
            if (typeof currentPlayerCharacter !== 'string' || currentPlayerCharacter === 'unselected') {
                return null;
            }
        }
        return manualAiSeatIds.find((playerId) => {
            const selectedCharacter = core.selectedCharacters?.[playerId];
            return typeof selectedCharacter !== 'string' || selectedCharacter === 'unselected';
        }) ?? null;
    }

    return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function shouldReleaseManualSetupAttemptFromSharedState(args: {
    sharedState: MatchState<unknown> | null | undefined;
    playerId: string;
    actionKind: ManualSetupSelectionActionKind;
    selectionId: string | null | undefined;
}): boolean {
    const selectionId = typeof args.selectionId === 'string' ? args.selectionId : '';
    if (!selectionId || !args.sharedState || typeof args.sharedState !== 'object') {
        return false;
    }

    const phase = typeof args.sharedState.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : null;
    const core = args.sharedState.core as {
        hostStarted?: unknown;
        factionSelection?: {
            playerSelections?: Record<string, unknown>;
        };
        selectedFactions?: Record<string, unknown>;
        selectedCharacters?: Record<string, unknown>;
    } | undefined;

    if (args.actionKind === 'select-faction') {
        const selectedByPlayer = core?.factionSelection?.playerSelections?.[args.playerId];
        const selectedFactionIds = Array.isArray(selectedByPlayer)
            ? selectedByPlayer.filter((item): item is string => typeof item === 'string')
            : [];
        if (selectedFactionIds.includes(selectionId)) {
            return true;
        }
        // SmashUp 公开选派系一旦结束，shared state 已经进入后续阶段，也可以视为这条提交已被权威态吸收。
        return phase !== null && phase !== 'factionSelect';
    }

    if (args.actionKind === 'setup-select-faction') {
        if (core?.selectedFactions?.[args.playerId] === selectionId) {
            return true;
        }
        return core?.hostStarted === true;
    }

    if (core?.selectedCharacters?.[args.playerId] === selectionId) {
        return true;
    }
    return core?.hostStarted === true;
}

export function shouldReleaseFactionSelectAttemptFromSharedState(args: {
    sharedState: MatchState<unknown> | null | undefined;
    playerId: string;
    factionId: string | null | undefined;
}): boolean {
    return shouldReleaseManualSetupAttemptFromSharedState({
        sharedState: args.sharedState,
        playerId: args.playerId,
        actionKind: 'select-faction',
        selectionId: args.factionId,
    });
}

function resolveManualSetupSelectionId(args: {
    actionKind: string;
    payload: unknown;
}): string | null {
    if (!isManualSetupSelectionActionKind(args.actionKind) || !isPlainRecord(args.payload)) {
        return null;
    }

    if (args.actionKind === 'setup-select-character') {
        return typeof args.payload.characterId === 'string' ? args.payload.characterId : null;
    }

    return typeof args.payload.factionId === 'string' ? args.payload.factionId : null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt(actionKind: string): boolean {
    return isManualSetupSelectionActionKind(actionKind);
}

// eslint-disable-next-line react-refresh/only-export-components
export function resolveManualSetupAttemptReleaseSource(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatState: MatchState<unknown> | null | undefined;
    playerId: string;
    actionKind: ManualSetupSelectionActionKind;
    selectionId: string | null | undefined;
}): 'shared' | 'seat' | null {
    if (shouldReleaseManualSetupAttemptFromSharedState({
        sharedState: args.sharedState,
        playerId: args.playerId,
        actionKind: args.actionKind,
        selectionId: args.selectionId,
    })) {
        return 'shared';
    }

    if (shouldReleaseManualSetupAttemptFromSharedState({
        sharedState: args.seatState,
        playerId: args.playerId,
        actionKind: args.actionKind,
        selectionId: args.selectionId,
    })) {
        return 'seat';
    }

    return null;
}

type OnlineAiDebugWindow = Window & {
    __BG_ONLINE_AI_DEBUG__?: {
        getSeatLatestState: (playerId: string) => MatchState<unknown> | null;
        getSeatDecisionState: (playerId: string) => Record<string, unknown> | null;
        getTransportLog: () => Array<Record<string, unknown>>;
        getPerfLog: () => Array<Record<string, unknown>>;
        setSeatLatestStateOverride: (playerId: string, state: MatchState<unknown> | null) => void;
        clearSeatLatestStateOverride: (playerId: string) => void;
        clearAllSeatLatestStateOverrides: () => void;
    };
    __BG_ONLINE_AI_TRANSPORT_LOG__?: Array<Record<string, unknown>>;
    __BG_ONLINE_AI_PERF_LOG__?: Array<Record<string, unknown>>;
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
const STALE_ONLINE_AI_ATTEMPT_TIMEOUT_MS = 4000;
const onlineAiPerfLogger = createScopedLogger('ONLINE_AI_PERF');

type ManualAiSeatDispatch = (playerId: string, type: string, payload: unknown) => boolean;

type PendingManualSetupSelection = {
    playerId: string;
    actionKind: ManualSetupSelectionActionKind;
    selectionId: string;
};

function appendOnlineAiDevLog(kind: 'transport' | 'perf', event: Record<string, unknown>): void {
    if (typeof window === 'undefined' || !import.meta.env.DEV) {
        return;
    }
    const debugWindow = window as OnlineAiDebugWindow;
    const targetKey = kind === 'transport'
        ? '__BG_ONLINE_AI_TRANSPORT_LOG__'
        : '__BG_ONLINE_AI_PERF_LOG__';
    const nextLog = [...(debugWindow[targetKey] ?? []), event].slice(-80);
    debugWindow[targetKey] = nextLog;
}
function emitOnlineAiPerf(stage: string, payload: Record<string, unknown>): void {
    const event = { stage, ...payload };
    appendOnlineAiDevLog('perf', event);
    console.log('[ONLINE_AI_PERF]', event);
}
const onlineAiTransportLogger = createScopedLogger('ONLINE_AI_TRANSPORT');
function emitOnlineAiTransport(stage: string, payload: Record<string, unknown>): void {
    const event = { stage, ...payload };
    appendOnlineAiDevLog('transport', event);
    console.log('[ONLINE_AI_TRANSPORT]', event);
}
const aiRuntimeTruthLogger = createScopedLogger('AI_RUNTIME_TRUTH');
function emitAiRuntimeTruth(stage: string, payload: Record<string, unknown>): void {
    console.log('[AI_RUNTIME_TRUTH]', { stage, ...payload });
}

function summarizeSeatControllerTypes(seatControllers: Record<string, AiSeatController>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(seatControllers)
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([playerId, controller]) => [playerId, controller.type]),
    );
}

function resolveManualSetupSelectionActionKindFromCommand(args: {
    type: string;
    payload: unknown;
}): ManualSetupSelectionActionKind | null {
    if (!isPlainRecord(args.payload)) {
        return null;
    }
    if (typeof args.payload.characterId === 'string') {
        return 'setup-select-character';
    }
    if (typeof args.payload.factionId !== 'string') {
        return null;
    }
    return args.type === 'su:select_faction'
        ? 'select-faction'
        : 'setup-select-faction';
}

export const OnlineManualFactionSelectionBridge = ({
    children,
    seatControllers,
    dispatchManualAiCommand,
}: {
    children: ReactNode;
    seatControllers: Record<string, AiSeatController>;
    dispatchManualAiCommand: ManualAiSeatDispatch | null;
}) => {
    const { state, dispatch } = useGameClient();
    const sharedState = state as MatchState<unknown> | null;
    const currentPlayerId = resolveCurrentPlayerId(sharedState);
    const manualSetupPlayerId = resolveManualSetupSelectionTakeoverPlayerId({
        sharedState,
        currentPlayerId,
        seatControllers,
        hasManualDispatch: Boolean(dispatchManualAiCommand),
    });
    const shouldTakeOver = manualSetupPlayerId !== null;
    const latestSharedStateRef = useRef<MatchState<unknown> | null>(sharedState);
    const latestManualDispatchRef = useRef<ManualAiSeatDispatch | null>(dispatchManualAiCommand);
    const pendingManualSetupSelectionRef = useRef<PendingManualSetupSelection | null>(null);
    const [pendingManualSetupSelection, setPendingManualSetupSelectionState] = useState<PendingManualSetupSelection | null>(null);

    const setPendingManualSetupSelection = useCallback((next: PendingManualSetupSelection | null) => {
        pendingManualSetupSelectionRef.current = next;
        setPendingManualSetupSelectionState(next);
    }, []);

    const isManualSetupSelectionPending = pendingManualSetupSelection !== null
        && !shouldReleaseManualSetupAttemptFromSharedState({
            sharedState,
            playerId: pendingManualSetupSelection.playerId,
            actionKind: pendingManualSetupSelection.actionKind,
            selectionId: pendingManualSetupSelection.selectionId,
        });
    const shouldOverrideManualSetupSelection = shouldTakeOver && !isManualSetupSelectionPending;

    useEffect(() => {
        latestSharedStateRef.current = sharedState;
    }, [sharedState]);

    useEffect(() => {
        latestManualDispatchRef.current = dispatchManualAiCommand;
    }, [dispatchManualAiCommand]);

    const manualDispatch = useCallback((type: string, payload: unknown) => {
        const latestSharedState = latestSharedStateRef.current;
        const pending = pendingManualSetupSelectionRef.current;
        if (pending) {
            const pendingReleased = shouldReleaseManualSetupAttemptFromSharedState({
                sharedState: latestSharedState,
                playerId: pending.playerId,
                actionKind: pending.actionKind,
                selectionId: pending.selectionId,
            });
            if (!pendingReleased) {
                return;
            }
            setPendingManualSetupSelection(null);
        }

        const latestCurrentPlayerId = resolveCurrentPlayerId(latestSharedState);
        const latestManualSetupPlayerId = resolveManualSetupSelectionTakeoverPlayerId({
            sharedState: latestSharedState,
            currentPlayerId: latestCurrentPlayerId,
            seatControllers,
            hasManualDispatch: Boolean(latestManualDispatchRef.current),
        });
        if (latestManualSetupPlayerId) {
            const actionKind = resolveManualSetupSelectionActionKindFromCommand({ type, payload });
            const selectionId = actionKind
                ? resolveManualSetupSelectionId({ actionKind, payload })
                : null;
            if (actionKind && selectionId) {
                setPendingManualSetupSelection({
                    playerId: latestManualSetupPlayerId,
                    actionKind,
                    selectionId,
                });
            }
            const submitted = latestManualDispatchRef.current?.(latestManualSetupPlayerId, type, payload) === true;
            if (!submitted && pendingManualSetupSelectionRef.current?.playerId === latestManualSetupPlayerId) {
                setPendingManualSetupSelection(null);
            }
            return;
        }
        dispatch(type, payload);
    }, [dispatch, seatControllers, setPendingManualSetupSelection]);

    return (
        <GameClientOverrideProvider
            playerId={shouldOverrideManualSetupSelection ? manualSetupPlayerId : undefined}
            dispatch={shouldOverrideManualSetupSelection ? manualDispatch : undefined}
        >
            {children}
        </GameClientOverrideProvider>
    );
};

type OnlineAiSeatStateRecord = Record<string, MatchState<unknown> | null | undefined>;

export function resolveOnlineAiEffectiveSeatState(args: {
    playerId: string;
    seatStateOverrides: OnlineAiSeatStateRecord;
    seatLatestStates: OnlineAiSeatStateRecord;
}): MatchState<unknown> | null {
    const override = args.seatStateOverrides[args.playerId];
    const latestState = args.seatLatestStates[args.playerId] ?? null;
    if (override !== undefined) {
        if (!shouldRetainOnlineAiSeatOverrideAfterLatestState({
            seatStateOverride: override,
            latestSeatState: latestState,
        })) {
            return latestState;
        }
        return override ?? null;
    }
    return latestState;
}

export function resolveOnlineAiEffectiveSeatStates(args: {
    playerIds: string[];
    seatStateOverrides: OnlineAiSeatStateRecord;
    seatLatestStates: OnlineAiSeatStateRecord;
}): Record<string, MatchState<unknown> | null> {
    return Object.fromEntries(
        args.playerIds.map((playerId) => [
            playerId,
            resolveOnlineAiEffectiveSeatState({
                playerId,
                seatStateOverrides: args.seatStateOverrides,
                seatLatestStates: args.seatLatestStates,
            }),
        ]),
    );
}

export function shouldStageOnlineAiSeatOverrideFromConfirmedState(args: {
    authoritativeState: MatchState<unknown> | unknown;
    latestSeatState: MatchState<unknown> | null | undefined;
}): boolean {
    const authoritativeState = args.authoritativeState && typeof args.authoritativeState === 'object'
        ? args.authoritativeState as MatchState<unknown>
        : null;
    if (!authoritativeState) {
        return false;
    }
    const latestSeatState = args.latestSeatState ?? null;
    if (!latestSeatState) {
        return true;
    }
    return buildAiProgressMarker(latestSeatState) !== buildAiProgressMarker(authoritativeState);
}

function hasSeatScopedBlockingSurface(state: MatchState<unknown> | null): boolean {
    if (!state) {
        return false;
    }
    const currentInteraction = state.sys?.interaction?.current;
    const queuedInteractions = state.sys?.interaction?.queue;
    const responseWindow = state.sys?.responseWindow?.current;
    return Boolean(currentInteraction)
        || (Array.isArray(queuedInteractions) && queuedInteractions.length > 0)
        || Boolean(responseWindow);
}

export function shouldRetainOnlineAiSeatOverrideAfterLatestState(args: {
    seatStateOverride: MatchState<unknown> | null | undefined;
    latestSeatState: MatchState<unknown> | null | undefined;
}): boolean {
    const override = args.seatStateOverride ?? null;
    if (!override) {
        return false;
    }
    const latestSeatState = args.latestSeatState ?? null;
    if (!latestSeatState) {
        return true;
    }
    if (hasSeatScopedBlockingSurface(override) && !hasSeatScopedBlockingSurface(latestSeatState)) {
        return false;
    }
    return buildAiProgressMarker(latestSeatState) !== buildAiProgressMarker(override);
}

const OnlineAiSeatBridge = ({
    server,
    matchId,
    engineConfig,
    seatControllers,
    seatCredentials,
    onForceEndAiPhaseReady,
    onManualFactionDispatchReady,
}: {
    server: string;
    matchId: string;
    engineConfig: GameEngineConfig;
    seatControllers: Record<string, AiSeatController>;
    seatCredentials: Record<string, string>;
    onForceEndAiPhaseReady?: (handler: (() => Promise<boolean>) | null) => void;
    onManualFactionDispatchReady?: (handler: ManualAiSeatDispatch | null) => void;
}) => {
    const { state } = useGameClient();
    const toast = useToast();
    const { t: tGame } = useTranslation('game');
    const clientsRef = useRef<Record<string, GameTransportClient>>({});
    const [connectionVersion, setConnectionVersion] = useState(0);
    const [aiRetryVersion, setAiRetryVersion] = useState(0);
    const [forceSkipCheckVersion, setForceSkipCheckVersion] = useState(0);
    const lastAiAttemptKeyRef = useRef<string | null>(null);
    const lastVisibleAiActionAtRef = useRef<number | null>(null);
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
    const aiActivePhaseRef = useRef<{ key: string; startedAt: number } | null>(null);
    const aiRuntimeTruthKeyRef = useRef<string | null>(null);
    const latestSharedStateRef = useRef<MatchState<unknown> | null>(null);
    const pendingRecoveryCheckTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
    const aiSeatStateOverridesRef = useRef<Record<string, MatchState<unknown> | null>>({});
    const aiSeatDecisionDebugRef = useRef<Record<string, Record<string, unknown>>>({});
    const activeAiAttemptRef = useRef<{
        attemptKey: string;
        playerId: string;
        reservedAt: number;
        sharedMarker: string;
        seatMarker: string | null;
        actionKind: string;
        pendingSelectionId: string | null;
    } | null>(null);
    const pendingSeatResyncRef = useRef<Record<string, {
        requestedAt: number;
        reason: string;
        meta?: Record<string, unknown>;
    }>>({});

    useEffect(() => {
        if (!onManualFactionDispatchReady) {
            return;
        }

        const dispatchManualAiCommand: ManualAiSeatDispatch = (playerId, type, payload) => {
            const client = clientsRef.current[playerId];
            if (!client?.isConnected) {
                return false;
            }
            client.sendCommand(type, payload);
            return true;
        };

        onManualFactionDispatchReady(dispatchManualAiCommand);
        return () => {
            onManualFactionDispatchReady(null);
        };
    }, [onManualFactionDispatchReady]);

    const getSeatLatestState = useCallback((playerId: string): MatchState<unknown> | null => {
        const latestState = clientsRef.current[playerId]?.latestState;
        return latestState && typeof latestState === 'object'
            ? latestState as MatchState<unknown>
            : null;
    }, []);

    const getEffectiveSeatState = useCallback((playerId: string): MatchState<unknown> | null => (
        resolveOnlineAiEffectiveSeatState({
            playerId,
            seatStateOverrides: aiSeatStateOverridesRef.current,
            seatLatestStates: {
                [playerId]: getSeatLatestState(playerId),
            },
        })
    ), [getSeatLatestState]);

    const getEffectiveSeatStates = useCallback((): Record<string, MatchState<unknown> | null> => (
        resolveOnlineAiEffectiveSeatStates({
            playerIds: Object.keys(clientsRef.current),
            seatStateOverrides: aiSeatStateOverridesRef.current,
            seatLatestStates: Object.fromEntries(
                Object.keys(clientsRef.current).map((playerId) => [playerId, getSeatLatestState(playerId)]),
            ),
        })
    ), [getSeatLatestState]);

    const clearActiveAiAttemptIfMatches = useCallback((attemptKey: string) => {
        releaseAiAttemptKeyIfMatches(lastAiAttemptKeyRef, attemptKey);
        if (activeAiAttemptRef.current?.attemptKey === attemptKey) {
            activeAiAttemptRef.current = null;
        }
    }, []);

    useEffect(() => {
        latestSharedStateRef.current = state && typeof state === 'object'
            ? state as MatchState<unknown>
            : null;
    }, [state]);

    useEffect(() => {
        if (!state || typeof state !== 'object') {
            aiActivePhaseRef.current = null;
            return;
        }
        const sharedState = state as MatchState<unknown>;
        const currentPlayerId = resolveCurrentPlayerId(sharedState);
        if (!currentPlayerId || seatControllers[currentPlayerId]?.type === 'human') {
            aiActivePhaseRef.current = null;
            return;
        }
        const phase = sharedState.sys?.phase ?? 'unknown';
        const turnNumber = sharedState.sys?.turnNumber ?? 'no-turn';
        const nextId = sharedState.sys?.eventStream?.nextId ?? 'no-event';
        const key = `${currentPlayerId}:${turnNumber}:${phase}:${nextId}`;
        if (aiActivePhaseRef.current?.key !== key) {
            aiActivePhaseRef.current = { key, startedAt: Date.now() };
        }
    }, [seatControllers, state]);

    useEffect(() => {
        const sharedState = state && typeof state === 'object'
            ? state as MatchState<unknown>
            : null;
        const seatControllerTypes = summarizeSeatControllerTypes(seatControllers);
        const hasAiSeat = Object.values(seatControllerTypes).some((type) => type !== 'human');
        const currentPlayerId = sharedState ? resolveCurrentPlayerId(sharedState) : null;
        const currentControllerType = currentPlayerId
            ? (seatControllerTypes[currentPlayerId] ?? 'human')
            : null;
        const aiClientStates = Object.fromEntries(
            Object.entries(seatControllerTypes)
                .filter(([, type]) => type !== 'human')
                .map(([playerId]) => {
                    const client = clientsRef.current[playerId];
                    return [playerId, {
                        connected: Boolean(client?.isConnected),
                        hasCredential: Boolean(seatCredentials[playerId]),
                        hasSeatState: Boolean(client?.latestState),
                    }];
                }),
        );
        const payload = {
            mode: 'online',
            source: 'OnlineAiSeatBridge',
            gameId: engineConfig.gameId,
            matchId,
            hasAiSeat,
            currentPlayerId,
            currentControllerType,
            phase: sharedState?.sys?.phase ?? null,
            turnNumber: sharedState?.sys?.turnNumber ?? null,
            seatControllerTypes,
            aiClientStates,
        };
        const nextKey = JSON.stringify(payload);
        if (aiRuntimeTruthKeyRef.current === nextKey) {
            return;
        }
        aiRuntimeTruthKeyRef.current = nextKey;
        aiRuntimeTruthLogger.info('online-seat-bridge-state', payload);
        emitAiRuntimeTruth('online-seat-bridge-state', payload);
        if (!hasAiSeat) {
            const disabledPayload = {
                mode: 'online',
                source: 'OnlineAiSeatBridge',
                gameId: engineConfig.gameId,
                matchId,
                reason: 'all-human-seats',
                seatControllerTypes,
            };
            aiRuntimeTruthLogger.warn('online-ai-disabled', disabledPayload);
            emitAiRuntimeTruth('online-ai-disabled', disabledPayload);
        }
    }, [connectionVersion, engineConfig.gameId, matchId, seatControllers, seatCredentials, state]);

    useEffect(() => {
        if (typeof window === 'undefined' || !import.meta.env.DEV) {
            return;
        }
        const debugWindow = window as OnlineAiDebugWindow;
        debugWindow.__BG_ONLINE_AI_DEBUG__ = {
            getSeatLatestState: (playerId: string) => getEffectiveSeatState(playerId),
            getSeatDecisionState: (playerId: string) => aiSeatDecisionDebugRef.current[playerId] ?? null,
            getTransportLog: () => debugWindow.__BG_ONLINE_AI_TRANSPORT_LOG__ ?? [],
            getPerfLog: () => debugWindow.__BG_ONLINE_AI_PERF_LOG__ ?? [],
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
    }, [getEffectiveSeatState]);

    useEffect(() => {
        const pendingTimers = pendingRecoveryCheckTimersRef.current;
        return () => {
            for (const timer of pendingTimers) {
                clearTimeout(timer);
            }
            pendingTimers.clear();
        };
    }, []);

    const requestSeatResync = useCallback((args: {
        playerId: string;
        client: Pick<GameTransportClient, 'resync' | 'latestState' | 'isConnected'>;
        reason: string;
        meta?: Record<string, unknown>;
    }) => {
        const { playerId, client, reason, meta } = args;
        pendingSeatResyncRef.current[playerId] = {
            requestedAt: Date.now(),
            reason,
            meta,
        };
        const payload = {
            matchId,
            gameId: engineConfig.gameId,
            playerId,
            reason,
            clientConnected: client.isConnected,
            currentSeatMarker: getEffectiveSeatState(playerId)
                ? buildAiProgressMarker(getEffectiveSeatState(playerId) as MatchState<unknown>)
                : null,
            ...(meta ?? {}),
        };
        onlineAiTransportLogger.warn('resync-requested', payload);
        emitOnlineAiTransport('resync-requested', payload);
        client.resync();
    }, [engineConfig.gameId, getEffectiveSeatState, matchId]);

    const scheduleRecoveryFailureNotice = useCallback((args: {
        targetClient: GameTransportClient;
        playerId: string;
        markerBefore: string;
        onStillStalled: () => void;
    }) => {
        const { targetClient, playerId, markerBefore, onStillStalled } = args;
        requestSeatResync({
            playerId,
            client: targetClient,
            reason: 'recovery-failure-check',
            meta: { markerBefore },
        });
        const timer = setTimeout(() => {
            pendingRecoveryCheckTimersRef.current.delete(timer);
            const sharedMarker = latestSharedStateRef.current
                ? buildAiProgressMarker(latestSharedStateRef.current)
                : markerBefore;
            const seatState = getEffectiveSeatState(playerId);
            const seatMarker = seatState
                ? buildAiProgressMarker(seatState)
                : markerBefore;
            if (sharedMarker !== markerBefore || seatMarker !== markerBefore) {
                return;
            }
            onStillStalled();
        }, RECOVERY_FAILURE_SYNC_GRACE_MS);
        pendingRecoveryCheckTimersRef.current.add(timer);
    }, [getEffectiveSeatState, requestSeatResync]);

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
                onStateUpdate: (nextState) => {
                    const pendingResync = pendingSeatResyncRef.current[playerId];
                    const authoritativeState = nextState && typeof nextState === 'object'
                        ? nextState as MatchState<unknown>
                        : null;
                    const marker = authoritativeState ? buildAiProgressMarker(authoritativeState) : null;
                    const payload = {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId,
                        phase: authoritativeState?.sys?.phase ?? null,
                        turnNumber: authoritativeState?.sys?.turnNumber ?? null,
                        currentPlayerId: authoritativeState ? resolveCurrentPlayerId(authoritativeState) : null,
                        marker,
                        pendingResyncReason: pendingResync?.reason ?? null,
                        resyncElapsedMs: pendingResync ? Date.now() - pendingResync.requestedAt : null,
                    };
                    onlineAiTransportLogger.info('state-update', payload);
                    emitOnlineAiTransport('state-update', payload);
                    delete pendingSeatResyncRef.current[playerId];
                    const existingOverride = aiSeatStateOverridesRef.current[playerId];
                    if (!shouldRetainOnlineAiSeatOverrideAfterLatestState({
                        seatStateOverride: existingOverride,
                        latestSeatState: authoritativeState,
                    })) {
                        delete aiSeatStateOverridesRef.current[playerId];
                    }
                    setAiRetryVersion((version) => version + 1);
                },
                onConnectionChange: (connected) => {
                    const pendingResync = pendingSeatResyncRef.current[playerId];
                    const payload = {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId,
                        connected,
                        pendingResyncReason: pendingResync?.reason ?? null,
                        resyncElapsedMs: pendingResync ? Date.now() - pendingResync.requestedAt : null,
                    };
                    onlineAiTransportLogger.info('connection-change', payload);
                    emitOnlineAiTransport('connection-change', payload);
                    setConnectionVersion((version) => version + 1);
                },
                onError: (error) => {
                    const pendingResync = pendingSeatResyncRef.current[playerId];
                    const payload = {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId,
                        error,
                        pendingResyncReason: pendingResync?.reason ?? null,
                        resyncElapsedMs: pendingResync ? Date.now() - pendingResync.requestedAt : null,
                    };
                    onlineAiTransportLogger.warn('transport-error', payload);
                    emitOnlineAiTransport('transport-error', payload);
                },
                onDebugEvent: (event) => {
                    const payload = {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId,
                        ...event,
                    };
                    if (event.stage === 'sync-timeout'
                        || event.stage === 'patch-discontinuity'
                        || event.stage === 'patch-apply-failed') {
                        onlineAiTransportLogger.warn(event.stage, payload);
                    } else {
                        onlineAiTransportLogger.info(event.stage, payload);
                    }
                    emitOnlineAiTransport(event.stage, payload);
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
    }, [engineConfig.gameId, matchId, seatControllers, seatCredentials, server]);

    useEffect(() => {
        return onAppVisible(() => {
            for (const [playerId, client] of Object.entries(clientsRef.current)) {
                requestSeatResync({
                    playerId,
                    client,
                    reason: 'app-visible',
                });
            }
            setAiRetryVersion((version) => version + 1);
        });
    }, [requestSeatResync]);

    useEffect(() => {
        const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
        if (!hasAiSeat || !state) {
            lastAiAttemptKeyRef.current = null;
            activeAiAttemptRef.current = null;
            lastVisibleAiActionAtRef.current = null;
            staleSeatRecoveryRef.current = null;

            return;
        }

        let cancelled = false;
        let delayTimer: ReturnType<typeof setTimeout> | null = null;
        let pendingDelayHandle: ReturnType<typeof startCancelableAiDelay> | null = null;

        const runAiTurn = async () => {
            const activeAttempt = activeAiAttemptRef.current;
            if (activeAttempt) {
                const releaseSource = isManualSetupSelectionActionKind(activeAttempt.actionKind)
                    ? resolveManualSetupAttemptReleaseSource({
                        sharedState: state as MatchState<unknown>,
                        seatState: getEffectiveSeatState(activeAttempt.playerId),
                        playerId: activeAttempt.playerId,
                        actionKind: activeAttempt.actionKind,
                        selectionId: activeAttempt.pendingSelectionId,
                    })
                    : null;
                if (releaseSource) {
                    aiSeatDecisionDebugRef.current[activeAttempt.playerId] = {
                        stage: releaseSource === 'shared'
                            ? 'shared-faction-select-confirmed'
                            : 'seat-faction-select-confirmed',
                        attemptKey: activeAttempt.attemptKey,
                        selectionId: activeAttempt.pendingSelectionId,
                        updatedAt: Date.now(),
                    };
                    clearActiveAiAttemptIfMatches(activeAttempt.attemptKey);
                }
            }

            const latestActiveAttempt = activeAiAttemptRef.current;
            if (latestActiveAttempt) {
                const elapsedMs = Date.now() - latestActiveAttempt.reservedAt;
                const currentSharedMarker = buildAiProgressMarker(state as MatchState<unknown>);
                const currentSeatState = getEffectiveSeatState(latestActiveAttempt.playerId);
                const currentSeatMarker = currentSeatState ? buildAiProgressMarker(currentSeatState) : null;
                if (
                    elapsedMs >= STALE_ONLINE_AI_ATTEMPT_TIMEOUT_MS
                    && currentSharedMarker === latestActiveAttempt.sharedMarker
                    && currentSeatMarker === latestActiveAttempt.seatMarker
                ) {
                    aiSeatDecisionDebugRef.current[latestActiveAttempt.playerId] = {
                        stage: 'stale-attempt-released',
                        attemptKey: latestActiveAttempt.attemptKey,
                        elapsedMs,
                        sharedMarker: currentSharedMarker,
                        seatMarker: currentSeatMarker,
                        updatedAt: Date.now(),
                    };
                    clearActiveAiAttemptIfMatches(latestActiveAttempt.attemptKey);
                    const targetClient = clientsRef.current[latestActiveAttempt.playerId];
                    if (targetClient) {
                        requestSeatResync({
                            playerId: latestActiveAttempt.playerId,
                            client: targetClient,
                            reason: 'stale-inflight-attempt',
                            meta: {
                                attemptKey: latestActiveAttempt.attemptKey,
                                elapsedMs,
                            },
                        });
                    }
                }
            }

            const startedAt = Date.now();
            const aiDispatchResult = await resolveNextAiDispatch({
                engineConfig,
                state,
                matchId,
                seatControllers,
                visibleStateResolver: (playerId) => {
                    const sharedState = state as MatchState<unknown>;
                    const privateOverlay = getEffectiveSeatState(playerId);
                    const decisionView = resolveOnlineAiDecisionView({
                        runtime: getGameImplementation(engineConfig.gameId).ai,
                        sharedState,
                        privateOverlay,
                        playerId,
                    });
                    return decisionView;
                },
            });
            const decisionResolvedAt = Date.now();
            const decisionElapsedMs = decisionResolvedAt - startedAt;

            if (cancelled) return;

            if (aiDispatchResult.kind === 'blocked') {
                aiSeatDecisionDebugRef.current[aiDispatchResult.playerId] = {
                    stage: 'blocked',
                    blockedReason: aiDispatchResult.blockedReason,
                    visibility: aiDispatchResult.visibility,
                    diagnostics: aiDispatchResult.diagnostics,
                    updatedAt: Date.now(),
                };
                logMobileRuntimeCritical('MatchRoom', 'online-ai-dispatch-blocked', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: aiDispatchResult.playerId,
                    blockedReason: aiDispatchResult.blockedReason,
                    visibility: aiDispatchResult.visibility,
                    phase: (state as MatchState<unknown>).sys?.phase ?? null,
                    turnNumber: (state as MatchState<unknown>).sys?.turnNumber ?? null,
                    sharedCurrentPlayerId: resolveCurrentPlayerId(state as MatchState<unknown>),
                });
                onlineAiPerfLogger.debug('blocked', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: aiDispatchResult.playerId,
                    blockedReason: aiDispatchResult.blockedReason,
                    visibility: aiDispatchResult.visibility,
                    decisionElapsedMs,
                });
                emitOnlineAiPerf('blocked', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: aiDispatchResult.playerId,
                    blockedReason: aiDispatchResult.blockedReason,
                    visibility: aiDispatchResult.visibility,
                    decisionElapsedMs,
                });
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
                        for (const [seatPlayerId, seatClient] of Object.entries(clientsRef.current)) {
                            requestSeatResync({
                                playerId: seatPlayerId,
                                client: seatClient,
                                reason: 'blocked-stale-decision',
                                meta: {
                                    blockedKey: staleDecisionKey,
                                    blockedReason: aiDispatchResult.blockedReason,
                                },
                            });
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
                const sharedState = state as MatchState<unknown>;
                const currentPlayerId = resolveCurrentPlayerId(sharedState);
                const activeAiPlayerId = currentPlayerId && seatControllers[currentPlayerId]?.type !== 'human'
                    ? currentPlayerId
                    : null;
                if (activeAiPlayerId) {
                    aiSeatDecisionDebugRef.current[activeAiPlayerId] = {
                        stage: 'idle',
                        idleReason: aiDispatchResult.idleReason,
                        updatedAt: Date.now(),
                    };
                }
                logMobileRuntimeCritical('MatchRoom', 'online-ai-dispatch-idle', {
                    gameId: engineConfig.gameId,
                    matchId,
                    idleReason: aiDispatchResult.idleReason,
                    phase: (state as MatchState<unknown>).sys?.phase ?? null,
                    turnNumber: (state as MatchState<unknown>).sys?.turnNumber ?? null,
                    sharedCurrentPlayerId: resolveCurrentPlayerId(state as MatchState<unknown>),
                });
                onlineAiPerfLogger.debug('idle', {
                    gameId: engineConfig.gameId,
                    matchId,
                    idleReason: aiDispatchResult.idleReason,
                    decisionElapsedMs,
                });
                emitOnlineAiPerf('idle', {
                    gameId: engineConfig.gameId,
                    matchId,
                    idleReason: aiDispatchResult.idleReason,
                    decisionElapsedMs,
                });
                // 已有 in-flight 尝试时，等待确认回调释放锁，不并发拉起恢复链。
                if (lastAiAttemptKeyRef.current) {
                    return;
                }
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
                        for (const [seatPlayerId, seatClient] of Object.entries(clientsRef.current)) {
                            requestSeatResync({
                                playerId: seatPlayerId,
                                client: seatClient,
                                reason: 'idle-active-ai',
                                meta: {
                                    blockedKey: idleDecisionKey,
                                },
                            });
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
            aiSeatDecisionDebugRef.current[resolution.playerId] = {
                stage: 'action',
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes: resolution.action.commands.map((command) => command.type),
                updatedAt: Date.now(),
            };
            logMobileRuntimeCritical('MatchRoom', 'online-ai-dispatch-action', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes: resolution.action.commands.map((command) => command.type),
                phase: (state as MatchState<unknown>).sys?.phase ?? null,
                turnNumber: (state as MatchState<unknown>).sys?.turnNumber ?? null,
                sharedCurrentPlayerId: resolveCurrentPlayerId(state as MatchState<unknown>),
            });
            if (!tryReserveAiAttemptKey(lastAiAttemptKeyRef, resolution.attemptKey)) {
                aiSeatDecisionDebugRef.current[resolution.playerId] = {
                    stage: 'duplicate-attempt-suppressed',
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes: resolution.action.commands.map((command) => command.type),
                    attemptKey: resolution.attemptKey,
                    activeAttemptKey: lastAiAttemptKeyRef.current,
                    updatedAt: Date.now(),
                };
                return;
            }
            activeAiAttemptRef.current = {
                attemptKey: resolution.attemptKey,
                playerId: resolution.playerId,
                reservedAt: Date.now(),
                sharedMarker: buildAiProgressMarker(state as MatchState<unknown>),
                seatMarker: getEffectiveSeatState(resolution.playerId)
                    ? buildAiProgressMarker(getEffectiveSeatState(resolution.playerId) as MatchState<unknown>)
                    : null,
                actionKind: resolution.action.kind,
                pendingSelectionId: (() => {
                    const firstCommand = resolution.action.commands[0];
                    return resolveManualSetupSelectionId({
                        actionKind: resolution.action.kind,
                        payload: firstCommand?.payload,
                    });
                })(),
            };

            const controller = seatControllers[resolution.playerId];
            const client = clientsRef.current[resolution.playerId];
            if (!controller || controller.type === 'human' || !client?.isConnected) {
                logMobileRuntimeCritical('MatchRoom', 'online-ai-submit-blocked', {
                    gameId: engineConfig.gameId,
                    matchId,
                    resolutionPlayerId: resolution.playerId,
                    resolutionActionKind: resolution.action.kind,
                    resolutionCommandTypes: resolution.action.commands.map((command) => command.type),
                    hasController: Boolean(controller),
                    controllerType: controller?.type ?? null,
                    hasCredential: Boolean(seatCredentials[resolution.playerId]),
                    hasClient: Boolean(client),
                    clientConnected: Boolean(client?.isConnected),
                    clientHasSeatState: Boolean(client?.latestState),
                    currentPlayerId: resolveCurrentPlayerId(state as MatchState<unknown>),
                    phase: (state as MatchState<unknown>).sys?.phase ?? null,
                    turnNumber: (state as MatchState<unknown>).sys?.turnNumber ?? null,
                });
                if (controller && controller.type !== 'human' && client) {
                    const submitBlockedRecoveryKey = [
                        'submit-blocked-ai',
                        resolution.playerId,
                        resolution.action.kind,
                        (state as MatchState<unknown>).sys?.turnNumber ?? 'no-shared-turn',
                        (state as MatchState<unknown>).sys?.phase ?? 'no-shared-phase',
                    ].join(':');
                    const now = Date.now();
                    const lastRecovery = staleSeatRecoveryRef.current;
                    const canRecover = !lastRecovery
                        || lastRecovery.key !== submitBlockedRecoveryKey
                        || now - lastRecovery.lastRecoveryAt >= STALE_SEAT_RECOVERY_MIN_INTERVAL_MS;
                    if (canRecover) {
                        staleSeatRecoveryRef.current = {
                            key: submitBlockedRecoveryKey,
                            lastRecoveryAt: now,
                        };
                        requestSeatResync({
                            playerId: resolution.playerId,
                            client,
                            reason: 'submit-blocked',
                            meta: {
                                blockedKey: submitBlockedRecoveryKey,
                                actionKind: resolution.action.kind,
                                commandTypes: resolution.action.commands.map((command) => command.type),
                            },
                        });
                        delayTimer = setTimeout(() => {
                            delayTimer = null;
                            setAiRetryVersion((version) => version + 1);
                        }, STALE_SEAT_RECOVERY_RETRY_MS);
                    }
                }
                clearActiveAiAttemptIfMatches(resolution.attemptKey);
                return;
            }

            const now = Date.now();
            const runtime = getGameAiRuntime(engineConfig.gameId);
            const actionVisibility = resolveLocalAiActionVisibility(resolution.action, runtime);
            const preScheduleElapsedMs = now - startedAt;
            const delayPlan = resolveLocalAiActionDelayPlan({
                controller,
                actionVisibility,
                now,
                defaultMinimumActionDelayMs: runtime?.defaultMinimumActionDelayMs,
                lastVisibleActionAt: lastVisibleAiActionAtRef.current,
                observedState: state as MatchState<unknown>,
                extraElapsedBudgetMs: [preScheduleElapsedMs],
            });
            const commandTypes = resolution.action.commands.map((command) => command.type);
            const activePhaseElapsedMs = aiActivePhaseRef.current
                ? decisionResolvedAt - aiActivePhaseRef.current.startedAt
                : null;
            onlineAiPerfLogger.info('scheduled', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                controllerType: controller.type,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                activePhaseElapsedMs,
                ...delayPlan,
                clientConnected: client.isConnected,
            });
            emitOnlineAiPerf('scheduled', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                controllerType: controller.type,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                activePhaseElapsedMs,
                ...delayPlan,
                clientConnected: client.isConnected,
            });

            if (delayPlan.remainingDelayMs > 0) {
                pendingDelayHandle = startCancelableAiDelay(delayPlan.remainingDelayMs);
                const delayResult = await pendingDelayHandle.promise;
                pendingDelayHandle = null;
                if (delayResult.outcome === 'cancelled') {
                    onlineAiPerfLogger.warn('delay-cancelled', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        ...delayPlan,
                        waitedMs: delayResult.waitedMs,
                        cancelled,
                        clientConnected: client.isConnected,
                    });
                    emitOnlineAiPerf('delay-cancelled', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        ...delayPlan,
                        waitedMs: delayResult.waitedMs,
                        cancelled,
                        clientConnected: client.isConnected,
                    });
                    clearActiveAiAttemptIfMatches(resolution.attemptKey);
                    return;
                }
                onlineAiPerfLogger.info('delay-finished', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    ...delayPlan,
                    waitedMs: delayResult.waitedMs,
                });
                emitOnlineAiPerf('delay-finished', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    ...delayPlan,
                    waitedMs: delayResult.waitedMs,
                });
            }

            if (cancelled || !client.isConnected) {
                onlineAiPerfLogger.warn('submit-skipped', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    cancelled,
                    clientConnected: client.isConnected,
                    ...delayPlan,
                });
                emitOnlineAiPerf('submit-skipped', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    cancelled,
                    clientConnected: client.isConnected,
                    ...delayPlan,
                });
                clearActiveAiAttemptIfMatches(resolution.attemptKey);
                return;
            }

            const submittedAt = Date.now();
            const submitElapsedMs = submittedAt - startedAt;
            if (delayPlan.actionVisibility === 'visible') {
                lastVisibleAiActionAtRef.current = submittedAt;
            }
            onlineAiPerfLogger.info('submitted', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                activePhaseElapsedMs: aiActivePhaseRef.current
                    ? submittedAt - aiActivePhaseRef.current.startedAt
                    : null,
                ...delayPlan,
                submitElapsedMs,
            });
            emitOnlineAiPerf('submitted', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                activePhaseElapsedMs: aiActivePhaseRef.current
                    ? submittedAt - aiActivePhaseRef.current.startedAt
                    : null,
                ...delayPlan,
                submitElapsedMs,
            });
            if (submitElapsedMs >= 1200) {
                onlineAiPerfLogger.warn('slow-step', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    decisionElapsedMs,
                    activePhaseElapsedMs: aiActivePhaseRef.current
                        ? submittedAt - aiActivePhaseRef.current.startedAt
                        : null,
                    ...delayPlan,
                    submitElapsedMs,
                });
                emitOnlineAiPerf('slow-step', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    decisionElapsedMs,
                    activePhaseElapsedMs: aiActivePhaseRef.current
                        ? submittedAt - aiActivePhaseRef.current.startedAt
                        : null,
                    ...delayPlan,
                    submitElapsedMs,
                });
            }

            aiSeatDecisionDebugRef.current[resolution.playerId] = {
                stage: 'submitted',
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                updatedAt: Date.now(),
            };
            submitOnlineAiResolution({
                client,
                resolution,
                lastAiAttemptKeyRef,
                scheduleRetry: () => {
                    setAiRetryVersion((version) => version + 1);
                },
                onWillResync: (reason) => {
                    requestSeatResync({
                        playerId: resolution.playerId,
                        client,
                        reason: 'batch-rejected',
                        meta: {
                            rejectReason: reason,
                            actionKind: resolution.action.kind,
                            commandTypes,
                        },
                    });
                },
                onConfirmed: (authoritativeState) => {
                    aiSeatDecisionDebugRef.current[resolution.playerId] = {
                        stage: 'confirmed',
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        updatedAt: Date.now(),
                    };
                    const confirmedSeatState = authoritativeState && typeof authoritativeState === 'object'
                        ? authoritativeState as MatchState<unknown>
                        : null;
                    const shouldStageOverride = shouldStageOnlineAiSeatOverrideFromConfirmedState({
                        authoritativeState,
                        latestSeatState: getSeatLatestState(resolution.playerId),
                    });
                    if (shouldStageOverride && confirmedSeatState) {
                        aiSeatStateOverridesRef.current[resolution.playerId] = confirmedSeatState;
                    } else {
                        delete aiSeatStateOverridesRef.current[resolution.playerId];
                    }
                    logMobileRuntimeCritical('MatchRoom', 'online-ai-command-confirmed', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        confirmElapsedMs: Date.now() - submittedAt,
                    });
                    onlineAiPerfLogger.info('confirmed', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        confirmElapsedMs: Date.now() - submittedAt,
                    });
                    emitOnlineAiPerf('confirmed', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        confirmElapsedMs: Date.now() - submittedAt,
                    });
                    if (shouldStageOverride) {
                        requestSeatResync({
                            playerId: resolution.playerId,
                            client,
                            reason: 'batch-confirmed-follow-up',
                            meta: {
                                actionKind: resolution.action.kind,
                                commandTypes,
                            },
                        });
                    }
                    if (shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt(resolution.action.kind)) {
                        const releaseSource = isManualSetupSelectionActionKind(resolution.action.kind)
                            ? resolveManualSetupAttemptReleaseSource({
                                sharedState: state as MatchState<unknown>,
                                seatState: confirmedSeatState,
                                playerId: resolution.playerId,
                                actionKind: resolution.action.kind,
                                selectionId: resolveManualSetupSelectionId({
                                    actionKind: resolution.action.kind,
                                    payload: resolution.action.commands[0]?.payload,
                                }),
                            })
                            : null;
                        if (!releaseSource) {
                            return;
                        }
                        aiSeatDecisionDebugRef.current[resolution.playerId] = {
                            stage: releaseSource === 'shared'
                                ? 'shared-faction-select-confirmed'
                                : 'seat-faction-select-confirmed',
                            source: resolution.source,
                            actionKind: resolution.action.kind,
                            commandTypes,
                            updatedAt: Date.now(),
                        };
                    }
                    finalizeOnlineAiResolutionConfirmation({
                        lastAiAttemptKeyRef,
                        resolutionAttemptKey: resolution.attemptKey,
                        scheduleRetry: () => {
                            setAiRetryVersion((version) => version + 1);
                        },
                    });
                    if (activeAiAttemptRef.current?.attemptKey === resolution.attemptKey) {
                        activeAiAttemptRef.current = null;
                    }
                },
                onRejected: (reason) => {
                    aiSeatDecisionDebugRef.current[resolution.playerId] = {
                        stage: 'rejected',
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        rejectReason: reason,
                        updatedAt: Date.now(),
                    };
                    if (activeAiAttemptRef.current?.attemptKey === resolution.attemptKey) {
                        activeAiAttemptRef.current = null;
                    }
                    onlineAiPerfLogger.warn('rejected', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        rejectReason: reason,
                        rejectElapsedMs: Date.now() - submittedAt,
                    });
                    emitOnlineAiPerf('rejected', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        rejectReason: reason,
                        rejectElapsedMs: Date.now() - submittedAt,
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
            pendingDelayHandle?.cancel();
            pendingDelayHandle = null;
        };
    }, [aiRetryVersion, clearActiveAiAttemptIfMatches, connectionVersion, engineConfig, getEffectiveSeatState, getSeatLatestState, matchId, requestSeatResync, seatControllers, seatCredentials, state]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const progressMarker = state && typeof state === 'object'
            ? buildAiProgressMarker(state as MatchState<unknown>)
            : 'no-shared-state';
        const seatStates = getEffectiveSeatStates();

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
                if (shouldSilentlyRetryOnlineAiBatchRejection(reason)) {
                    return;
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
    }, [aiRetryVersion, connectionVersion, forceSkipCheckVersion, getEffectiveSeatStates, scheduleRecoveryFailureNotice, seatControllers, state, toast]);

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
        // 强口径裁决：trackerKey 只应随“恢复语义变化”或“回合/阶段变化”而变化。
        // - 优先使用 candidate.fingerprintHint
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
            onCompleted: (authoritativeState) => {
                const notice = resolveOnlineAiAutoRecoveryCompletionNotice({
                    candidateReason: candidate.reason,
                    authoritativeState: authoritativeState as MatchState<unknown> | null | undefined,
                    seatControllers,
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
    }, [aiRetryVersion, connectionVersion, getEffectiveSeatStates, scheduleRecoveryFailureNotice, seatControllers, state, toast]);

    const forceEndAiPhase = useCallback(async (): Promise<boolean> => {
        if (!state) {
            toast.info(tGame('hud.ai.forceEndPhaseNotReady', { ns: 'game' }));
            return false;
        }

        const seatStates = getEffectiveSeatStates();
        const recovery = await resolveManualOnlineAiRecovery({
            engineConfig: engineConfig as Pick<GameEngineConfig, 'gameId'>,
            matchId,
            sharedState: state as MatchState<unknown>,
            seatControllers,
            seatStates,
        });

        if (recovery.kind === 'unavailable') {
            toast.info(tGame('hud.ai.forceEndPhaseUnavailable', { ns: 'game' }));
            return false;
        }

        if (recovery.kind === 'blocked') {
            const blockedClient = clientsRef.current[recovery.playerId];
            if (blockedClient && recovery.blockedKey) {
                requestSeatResync({
                    playerId: recovery.playerId,
                    client: blockedClient,
                    reason: 'manual-force-end-blocked',
                    meta: {
                        blockedKey: recovery.blockedKey,
                        blockedReason: recovery.blockedReason,
                    },
                });
            }
            toast.info(tGame('hud.ai.forceEndPhaseUnavailable', { ns: 'game' }));
            return false;
        }

        const candidate = recovery.kind === 'force-end-turn' ? recovery.candidate : null;
        const resolution = recovery.kind === 'legal-action' ? recovery.resolution : candidate.resolution;
        const targetClient = clientsRef.current[resolution.playerId];
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
                submitOnlineAiResolutionSequence({
                    client: targetClient,
                    initialResolution: resolution,
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
                return;
            }

            submitOnlineAiResolution({
                client: targetClient,
                resolution,
                lastAiAttemptKeyRef,
                scheduleRetry: () => {
                    setAiRetryVersion((version) => version + 1);
                },
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
    }, [engineConfig, getEffectiveSeatStates, matchId, requestSeatResync, seatControllers, state, tGame, toast]);

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
    const { t: tGame } = useTranslation('game');
    const { state, dispatch, matchPlayers, isConnected } = useGameClient();
    const hudPresence = useMemo(() => resolveOnlineHudPresence({
        fallbackPlayers,
        transportPlayers: matchPlayers,
        transportReady: isConnected && matchPlayers.length > 0,
        myPlayerId,
        seatControllers,
    }), [fallbackPlayers, isConnected, matchPlayers, myPlayerId, seatControllers]);
    const canForceEndAiPhase = Boolean(showForceEndAiPhase && onForceEndAiPhase);
    const canForceDismissPopup = true;
    const isPregameSetupPhase = resolveGameHudPhase(state as { sys?: { phase?: unknown; flow?: { phase?: unknown } } } | null | undefined) === 'setup';
    const forceDismissPopup = useCallback(async (): Promise<boolean> => {
        if (gameId === 'dicethrone') {
            const pendingBonusDiceSettlement = (state as MatchState<{
                pendingBonusDiceSettlement?: { attackerId?: string | number };
            }> | null | undefined)?.core?.pendingBonusDiceSettlement;
            if (
                pendingBonusDiceSettlement
                && myPlayerId != null
                && String(pendingBonusDiceSettlement.attackerId) === String(myPlayerId)
            ) {
                dispatch('SKIP_BONUS_DICE_REROLL', {});
                return true;
            }
        }
        const matchState = state as MatchState<unknown> | null | undefined;
        const interaction = matchState?.sys?.interaction;
        const responseWindow = matchState?.sys?.responseWindow;
        const resolution = matchState?.sys?.resolution;
        const activeFrame = resolution?.frames?.find((frame) => frame.id === resolution.activeFrameId);
        const hasSystemLock = Boolean(
            interaction?.current
            || interaction?.isBlocked
            || (interaction?.queue?.length ?? 0) > 0
            || responseWindow?.current
            || activeFrame?.status === 'blocked'
            || activeFrame?.blockedBy,
        );
        if (hasSystemLock) {
            dispatch(INTERACTION_COMMANDS.FORCE_UNLOCK, {});
            if (gameId === 'smashup' && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(SMASHUP_FORCE_DISMISS_EVENT));
            }
            return true;
        }
        if (gameId === 'smashup' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(SMASHUP_FORCE_DISMISS_EVENT));
            return true;
        }
        return false;
    }, [dispatch, gameId, myPlayerId, state]);
    const normalizedMyPlayerId = myPlayerId != null ? String(myPlayerId) : null;
    const seatNameByPlayerId = useMemo(() => {
        const map = new Map<string, string>();
        for (const player of hudPresence.players) {
            const normalizedId = String(player.id);
            map.set(
                normalizedId,
                player.name?.trim()
                    ? player.name
                    : tGame('hud.status.player', { id: normalizedId }),
            );
        }
        return map;
    }, [hudPresence.players, tGame]);
    const seatSwapContext = useMemo(() => resolveMatchSeatSwapContext({
        gameId,
        state,
        myPlayerId: normalizedMyPlayerId,
        seatControllers,
    }), [gameId, normalizedMyPlayerId, seatControllers, state]);
    const seatSwapContent = useMemo(() => {
        if (!seatSwapContext || normalizedMyPlayerId == null) {
            return undefined;
        }
        const {
            seatSwapMode,
            seatingOrder,
            seatControllerTypeByPlayerId,
            pendingSeatSwapRequest,
            requestSeatSwapCommandType,
            respondSeatSwapCommandType,
            cancelSeatSwapCommandType,
        } = seatSwapContext;
        const isSeatSwapPending = seatSwapMode === 'request' && Boolean(pendingSeatSwapRequest);
        const isRequester = pendingSeatSwapRequest?.requesterId === normalizedMyPlayerId;
        const isTarget = pendingSeatSwapRequest?.targetPlayerId === normalizedMyPlayerId;
        const resolveSeatPlayerName = (playerId: string) => (
            seatNameByPlayerId.get(playerId)
            ?? tGame('hud.status.player', { id: playerId })
        );
        const pendingHintText = (() => {
            if (seatSwapMode !== 'request' || !pendingSeatSwapRequest) {
                return tGame('hud.seatSwap.hint');
            }
            if (isRequester) {
                return tGame('hud.seatSwap.waiting', {
                    player: resolveSeatPlayerName(pendingSeatSwapRequest.targetPlayerId),
                });
            }
            if (isTarget) {
                return tGame('hud.seatSwap.incoming', {
                    player: resolveSeatPlayerName(pendingSeatSwapRequest.requesterId),
                });
            }
            return tGame('hud.seatSwap.pendingOther', {
                requester: resolveSeatPlayerName(pendingSeatSwapRequest.requesterId),
                target: resolveSeatPlayerName(pendingSeatSwapRequest.targetPlayerId),
            });
        })();

        return ({ closePanel }: { closePanel: () => void }) => (
            <div className="space-y-3">
                <p className="text-xs text-white/70">{pendingHintText}</p>
                <div className="space-y-2">
                    {seatingOrder.map((seatPlayerId, seatIndex) => {
                        const isSelfSeat = seatPlayerId === normalizedMyPlayerId;
                        const isAiSeat = (seatControllerTypeByPlayerId[seatPlayerId] ?? 'human') !== 'human';
                        const isSeatRequester = pendingSeatSwapRequest?.requesterId === seatPlayerId;
                        const isSeatTarget = pendingSeatSwapRequest?.targetPlayerId === seatPlayerId;
                        return (
                            <button
                                key={`hud-seat-swap-seat-${seatPlayerId}`}
                                type="button"
                                disabled={isSeatSwapPending || isSelfSeat}
                                onClick={() => {
                                    dispatch(requestSeatSwapCommandType, { targetPlayerId: seatPlayerId });
                                    closePanel();
                                }}
                                className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                    isSeatRequester || isSeatTarget
                                        ? 'border-amber-400/45 bg-amber-500/12 text-amber-100'
                                        : 'border-white/12 bg-white/5 text-white/85 hover:bg-white/10'
                                } ${
                                    isSeatSwapPending || isSelfSeat
                                        ? 'cursor-default opacity-70'
                                        : ''
                                }`}
                                data-testid={`hud-seat-swap-seat-${seatPlayerId}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-white/88">
                                        {tGame('hud.seatSwap.seatNumber', { seat: seatIndex + 1 })}
                                    </span>
                                    {isAiSeat && (
                                        <span className="rounded-full border border-sky-300/45 bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                                            {tGame('hud.seatSwap.aiBadge')}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 truncate text-white/75">{resolveSeatPlayerName(seatPlayerId)}</div>
                            </button>
                        );
                    })}
                </div>

                {seatSwapMode === 'request' && isTarget && (
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (respondSeatSwapCommandType) {
                                    dispatch(respondSeatSwapCommandType, { approve: true });
                                }
                                closePanel();
                            }}
                            className="rounded-md border border-emerald-500/45 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-500/28"
                            data-testid="hud-seat-swap-approve"
                        >
                            {tGame('hud.seatSwap.approve')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (respondSeatSwapCommandType) {
                                    dispatch(respondSeatSwapCommandType, { approve: false });
                                }
                                closePanel();
                            }}
                            className="rounded-md border border-rose-500/45 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200 transition-colors hover:bg-rose-500/28"
                            data-testid="hud-seat-swap-reject"
                        >
                            {tGame('hud.seatSwap.reject')}
                        </button>
                    </div>
                )}

                {seatSwapMode === 'request' && isRequester && (
                    <button
                        type="button"
                        onClick={() => {
                            if (cancelSeatSwapCommandType) {
                                dispatch(cancelSeatSwapCommandType, {});
                            }
                            closePanel();
                        }}
                        className="w-full rounded-md border border-white/18 bg-white/8 px-3 py-2 text-xs font-bold text-white/85 transition-colors hover:bg-white/14"
                        data-testid="hud-seat-swap-cancel"
                    >
                        {tGame('hud.seatSwap.cancel')}
                    </button>
                )}
            </div>
        );
    }, [dispatch, normalizedMyPlayerId, seatNameByPlayerId, seatSwapContext, tGame]);

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
            showForceDismissPopup={canForceDismissPopup}
            onForceDismissPopup={forceDismissPopup}
            showSeatSwap={Boolean(seatSwapContext)}
            seatSwapActionActive={Boolean(seatSwapContext?.pendingSeatSwapRequest)}
            seatSwapContent={seatSwapContent}
            isPregameSetupPhase={isPregameSetupPhase}
            isLoading={isLoading}
        />
    );
};

export const MatchRoom = () => {
    usePerformanceMonitor();
    const { playerID: debugPlayerID, setPlayerID } = useDebug();
    const { gameId, matchId, tutorialId } = useParams();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { startTutorial, closeTutorial, isActive, currentStep, isBoardMounted } = useTutorial();
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const { t: tLobby, i18n } = useTranslation('lobby');
    const { user, token } = useAuth();
    const [onlineTransportError, setOnlineTransportError] = useState<string | null>(null);
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
    const isTutorialRoute = isTutorialRoutePath(location.pathname);
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
    // 在线模式：命令被服务端拒绝时的统一反馈
    const handleGameError = useCallback((error: string) => {
        if (ONLINE_TRANSPORT_ERRORS.has(error)) {
            setOnlineTransportError(error);
            return;
        }
        if (!shouldShowOnlineGameErrorToast(error)) return; // 其他系统错误由独立逻辑处理
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
    const boardGateRuntimeRef = useRef({
        isTutorialRoute,
        locale: i18n.language,
        shouldBlockBoardOnImagePreload,
    });
    boardGateRuntimeRef.current = {
        isTutorialRoute,
        locale: i18n.language,
        shouldBlockBoardOnImagePreload,
    };
    const WrappedBoard = useMemo<ComponentType<GameBoardProps> | null>(() => {
        if (!gameId || !gameImplReady) return null;
        const impl = getGameImplementation(gameId);
        if (!impl) return null;
        const Board = impl.board as unknown as ComponentType<GameBoardProps>;
        const Wrapped: ComponentType<GameBoardProps> = (props) => (
            <CriticalImageGate
                gameId={gameId}
                gameState={props?.G}
                locale={boardGateRuntimeRef.current.locale}
                playerID={props?.playerID}
                enabled={true}
                blockRendering={boardGateRuntimeRef.current.shouldBlockBoardOnImagePreload}
                loadingDescription={tRef.current('matchRoom.loadingResources')}
                onReady={() => {
                    if (!boardGateRuntimeRef.current.isTutorialRoute) {
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
    const [dispatchManualAiCommand, setDispatchManualAiCommand] = useState<ManualAiSeatDispatch | null>(null);
    const handleManualFactionDispatchReady = useCallback((handler: ManualAiSeatDispatch | null) => {
        setDispatchManualAiCommand(() => handler);
    }, []);
    const [localStorageTick, setLocalStorageTick] = useState(0);
    const [onlineAiSeatReloadTick, setOnlineAiSeatReloadTick] = useState(0);
    const [onlineAiSeatControllers, setOnlineAiSeatControllers] = useState<Record<string, AiSeatController>>({});
    const [onlineAiSeatCredentials, setOnlineAiSeatCredentials] = useState<Record<string, string>>({});
    const [forceEndAiPhaseHandler, setForceEndAiPhaseHandler] = useState<(() => Promise<boolean>) | null>(null);
    const tutorialStartedRef = useRef(false);
    const lastTutorialStepIdRef = useRef<string | null>(null);
    const tutorialModalIdRef = useRef<string | null>(null);
    const hasOnlineAiSeat = useMemo(
        () => Object.values(onlineAiSeatControllers).some((controller) => controller.type !== 'human'),
        [onlineAiSeatControllers],
    );
    const onlineAiRematchAutoAcceptedPlayerIds = useMemo(
        () => Object.entries(onlineAiSeatControllers)
            .filter(([, controller]) => controller.type !== 'human')
            .map(([playerId]) => playerId)
            .sort((leftId, rightId) => leftId.localeCompare(rightId)),
        [onlineAiSeatControllers],
    );
    const aiRuntimeTruthKeyRef = useRef<string | null>(null);
    const onlineAiSeatReloadAttemptRef = useRef(0);
    const onlineAiSeatFailureNoticeKeyRef = useRef<string | null>(null);
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
    const routeIdentity = resolveMatchRoomRouteIdentity({
        isTutorialRoute,
        debugPlayerID,
        urlPlayerID,
        storedPlayerID,
        shouldAutoJoin,
        spectateParam,
    });
    const { isSpectatorRoute, effectivePlayerID, statusPlayerID, transportPlayerID } = routeIdentity;
    useEffect(() => {
        // 日志已移除：Spectate 调试信息过于频繁
    }, [gameId, matchId, urlPlayerID, shouldAutoJoin, spectateParam, isSpectatorRoute]);

    // 自动加入逻辑（调试重置跳转）
    const [isAutoJoining, setIsAutoJoining] = useState(false);
    const [autoJoinError, setAutoJoinError] = useState<string | null>(null);
    const autoJoinStartedRef = useRef(false);
    // 自动加入完成后的宽限期（防止 validateStoredMatchSeat 在 matchStatus 刷新前清除凭据）
    const autoJoinGraceRef = useRef(false);
    const pendingSeatValidationClearKeyRef = useRef<string | null>(null);
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

    // 进入联机对局时，调试面板自动切换到自己对应的玩家视角
    useEffect(() => {
        if (isTutorialRoute) return;
        if (!urlPlayerID) return;
        if (debugPlayerID === urlPlayerID) return;
        setPlayerID(urlPlayerID);
    }, [debugPlayerID, isTutorialRoute, setPlayerID, urlPlayerID]);

    useEffect(() => {
        const seatControllerTypes = summarizeSeatControllerTypes(onlineAiSeatControllers);
        const aiSeatIds = Object.entries(seatControllerTypes)
            .filter(([, type]) => type !== 'human')
            .map(([playerId]) => playerId)
            .sort((leftId, rightId) => leftId.localeCompare(rightId));
        const aiCredentialSeatIds = Object.keys(onlineAiSeatCredentials)
            .sort((leftId, rightId) => leftId.localeCompare(rightId));
        const payload = {
            mode: isTutorialRoute ? 'tutorial-local' : 'online',
            source: 'MatchRoom',
            gameId: gameId ?? null,
            matchId: matchId ?? null,
            hasOnlineAiSeat,
            aiSeatIds,
            aiCredentialSeatIds,
            effectivePlayerID: effectivePlayerID ?? null,
            statusPlayerID: statusPlayerID ?? null,
            route: {
                isTutorialRoute,
                isSpectatorRoute,
                shouldAutoJoin,
            },
            seatControllerTypes,
        };
        const nextKey = JSON.stringify(payload);
        if (aiRuntimeTruthKeyRef.current === nextKey) {
            return;
        }
        aiRuntimeTruthKeyRef.current = nextKey;
        aiRuntimeTruthLogger.info('match-room-ai-runtime', payload);
        emitAiRuntimeTruth('match-room-ai-runtime', payload);
        if (!isTutorialRoute && !hasOnlineAiSeat) {
            const disabledPayload = {
                mode: 'online',
                source: 'MatchRoom',
                gameId: gameId ?? null,
                matchId: matchId ?? null,
                reason: 'all-human-seats-or-ai-seat-not-configured',
                seatControllerTypes,
            };
            aiRuntimeTruthLogger.warn('online-ai-not-enabled', disabledPayload);
            emitAiRuntimeTruth('online-ai-not-enabled', disabledPayload);
        }
    }, [
        effectivePlayerID,
        gameId,
        hasOnlineAiSeat,
        isSpectatorRoute,
        isTutorialRoute,
        matchId,
        onlineAiSeatControllers,
        onlineAiSeatCredentials,
        shouldAutoJoin,
        statusPlayerID,
    ]);

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
        if (isTutorialRoute) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }
        if (!matchId || !statusPlayerID) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }
        if (matchStatus.isLoading || matchStatus.players.length === 0) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }
        // 自动加入过程中或刚完成自动加入时跳过验证（matchStatus 可能还未反映新加入的玩家）
        if (shouldAutoJoin || isAutoJoining || autoJoinGraceRef.current) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }

        const stored = readStoredMatchCredentials(matchId);
        const validation = validateStoredMatchSeat(stored, matchStatus.players, statusPlayerID);
        if (!validation.shouldClear) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }

        const validationKey = `${matchId}:${statusPlayerID}:${validation.reason ?? 'unknown'}:${stored?.playerID ?? ''}`;
        if (pendingSeatValidationClearKeyRef.current !== validationKey) {
            pendingSeatValidationClearKeyRef.current = validationKey;
            return;
        }
        pendingSeatValidationClearKeyRef.current = null;

        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        setLocalStorageTick((t) => t + 1);
        toast.warning({ kind: 'i18n', key: 'error.localStateCleared', ns: 'lobby' });
    }, [isTutorialRoute, matchId, statusPlayerID, matchStatus.isLoading, matchStatus.players, toast, shouldAutoJoin, isAutoJoining]);

    const canClaimMissingAiSeatCredentials = !isTutorialRoute
        && (matchStatus.isHost || statusPlayerID === '0');

    useEffect(() => {
        onlineAiSeatReloadAttemptRef.current = 0;
        onlineAiSeatFailureNoticeKeyRef.current = null;
    }, [canClaimMissingAiSeatCredentials, gameId, guestId, matchId, statusPlayerID, token]);

    useEffect(() => {
        if (isTutorialRoute || !matchId || !gameId || !gameConfig) {
            onlineAiSeatReloadAttemptRef.current = 0;
            setOnlineAiSeatControllers({});
            setOnlineAiSeatCredentials({});
            return;
        }

        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        const notifyOnlineAiSeatFailure = (reason: string, extra?: Record<string, unknown>) => {
            const noticeKey = `${matchId}:${reason}`;
            if (onlineAiSeatFailureNoticeKeyRef.current === noticeKey) {
                return;
            }
            onlineAiSeatFailureNoticeKeyRef.current = noticeKey;
            logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-claim-toast', {
                gameId,
                matchId,
                reason,
                statusPlayerID: statusPlayerID ?? null,
                matchStatusIsHost: matchStatus.isHost,
                canClaimMissingAiSeatCredentials,
                ...(extra ?? {}),
            });
            toast.error(
                { kind: 'i18n', key: 'error.aiSeatClaimFailed', ns: 'lobby' },
                undefined,
                { dedupeKey: `match.ai-seat-claim-failed.${matchId}` },
            );
        };

        const scheduleOnlineAiSeatReload = (reason: string, extra?: Record<string, unknown>) => {
            if (cancelled) return;
            if (onlineAiSeatReloadAttemptRef.current >= ONLINE_AI_SEAT_LOAD_RETRY_MAX_ATTEMPTS) {
                logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-retry-gave-up', {
                    gameId,
                    matchId,
                    reason,
                    attempts: onlineAiSeatReloadAttemptRef.current,
                    statusPlayerID: statusPlayerID ?? null,
                    matchStatusIsHost: matchStatus.isHost,
                    canClaimMissingAiSeatCredentials,
                    ...(extra ?? {}),
                });
                notifyOnlineAiSeatFailure(reason, {
                    attempts: onlineAiSeatReloadAttemptRef.current,
                    ...(extra ?? {}),
                });
                return;
            }
            onlineAiSeatReloadAttemptRef.current += 1;
            const delayMs = Math.min(
                ONLINE_AI_SEAT_LOAD_RETRY_BASE_MS * (2 ** (onlineAiSeatReloadAttemptRef.current - 1)),
                ONLINE_AI_SEAT_LOAD_RETRY_MAX_MS,
            );
            logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-retry-scheduled', {
                gameId,
                matchId,
                reason,
                delayMs,
                attempt: onlineAiSeatReloadAttemptRef.current,
                statusPlayerID: statusPlayerID ?? null,
                matchStatusIsHost: matchStatus.isHost,
                canClaimMissingAiSeatCredentials,
                ...(extra ?? {}),
            });
            retryTimer = setTimeout(() => {
                retryTimer = null;
                if (cancelled) return;
                setOnlineAiSeatReloadTick((tick) => tick + 1);
            }, delayMs);
        };

        const loadOnlineAiSeatControllers = async () => {
            try {
                const matchInfo = await matchApi.getMatch(gameId, matchId);
                if (cancelled) return;

                const storedAiSeatCredentials = readStoredAiSeatCredentials(matchId);
                logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-load-start', {
                    gameId,
                    matchId,
                    statusPlayerID: statusPlayerID ?? null,
                    matchStatusIsHost: matchStatus.isHost,
                    canClaimMissingAiSeatCredentials,
                    storedAiSeatCredentialSeatIds: Object.keys(storedAiSeatCredentials).sort(),
                });
                const nextAiSeatState = await loadOnlineAiSeatState({
                    gameConfig,
                    matchInfo,
                    storedAiSeatCredentials,
                    claimMissingSeatCredential: canClaimMissingAiSeatCredentials
                        ? async (playerId) => {
                            const aiPlayerName = tLobby('createRoom.aiPlayerName', { seat: Number(playerId) + 1 });
                            const response = await matchApi.claimSeat(
                                gameId,
                                matchId,
                                playerId,
                                resolveOnlineAiSeatClaimOptions({
                                    matchInfo,
                                    token,
                                    guestId,
                                    playerName: aiPlayerName,
                                }),
                            );
                            return response.playerCredentials;
                        }
                        : undefined,
                    onClaimError: (playerId, error) => {
                        const status = getMatchApiErrorStatus(error);
                        logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-claim-failed', {
                            gameId,
                            matchId,
                            playerId,
                            statusPlayerID: statusPlayerID ?? null,
                            matchStatusIsHost: matchStatus.isHost,
                            canClaimMissingAiSeatCredentials,
                            status: status ?? null,
                            error,
                        });
                        if (status && ONLINE_AI_SEAT_CLAIM_AUTH_ERROR_STATUSES.has(status)) {
                            notifyOnlineAiSeatFailure('claim-auth-failed', {
                                playerId,
                                status,
                            });
                        }
                        console.warn('[MatchRoom] AI 座位补领失败', {
                            matchId,
                            playerId,
                            status,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    },
                });
                if (cancelled) return;

                logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-load-finished', {
                    gameId,
                    matchId,
                    statusPlayerID: statusPlayerID ?? null,
                    matchStatusIsHost: matchStatus.isHost,
                    canClaimMissingAiSeatCredentials,
                    aiSeatIds: Object.entries(nextAiSeatState.seatControllers)
                        .filter(([, controller]) => controller.type !== 'human')
                        .map(([playerId]) => playerId)
                        .sort(),
                    aiCredentialSeatIds: Object.keys(nextAiSeatState.seatCredentials).sort(),
                });

                if (canClaimMissingAiSeatCredentials && haveAiSeatCredentialsChanged(storedAiSeatCredentials, nextAiSeatState.seatCredentials)) {
                    persistAiSeatCredentials(matchId, nextAiSeatState.seatCredentials);
                }

                setOnlineAiSeatControllers(nextAiSeatState.seatControllers);
                setOnlineAiSeatCredentials(nextAiSeatState.seatCredentials);

                const missingAiSeatCredentialIds = canClaimMissingAiSeatCredentials
                    ? resolveMissingOnlineAiSeatCredentialIds(nextAiSeatState.seatControllers, nextAiSeatState.seatCredentials)
                    : [];
                if (missingAiSeatCredentialIds.length > 0) {
                    scheduleOnlineAiSeatReload('missing-ai-seat-credentials', {
                        missingAiSeatCredentialIds,
                    });
                } else {
                    onlineAiSeatReloadAttemptRef.current = 0;
                    onlineAiSeatFailureNoticeKeyRef.current = null;
                }
            } catch (error) {
                if (!cancelled) {
                    logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-load-failed', {
                        gameId,
                        matchId,
                        statusPlayerID: statusPlayerID ?? null,
                        matchStatusIsHost: matchStatus.isHost,
                        canClaimMissingAiSeatCredentials,
                        error,
                    });
                    if (isMatchNotFoundError(error)) {
                        onlineAiSeatReloadAttemptRef.current = 0;
                        setOnlineAiSeatControllers({});
                        setOnlineAiSeatCredentials({});
                        return;
                    }
                    scheduleOnlineAiSeatReload('load-failed');
                }
            }
        };

        void loadOnlineAiSeatControllers();

        return () => {
            cancelled = true;
            if (retryTimer) {
                clearTimeout(retryTimer);
            }
        };
    }, [canClaimMissingAiSeatCredentials, gameConfig, gameId, guestId, guestName, isTutorialRoute, localStorageTick, matchId, matchStatus.isHost, onlineAiSeatReloadTick, statusPlayerID, tLobby, toast, token]);
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

    const missingMatchConfirmationSignal = resolveMissingMatchConfirmationSignal({
        isTutorialRoute,
        matchId,
        shouldAutoJoin,
        isAutoJoining,
        autoJoinGraceActive: autoJoinGraceRef.current,
        onlineTransportError,
    });

    useEffect(() => {
        if (!missingMatchConfirmationSignal || !gameId || !matchId) return;
        clearMatchLocalState();
        toast.warning(
            { kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' },
            undefined,
            { dedupeKey: `matchRoom.missing.${matchId}` }
        );
        navigateBackToLobby();
    }, [clearMatchLocalState, gameId, matchId, missingMatchConfirmationSignal, navigateBackToLobby, toast]);

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
            notifyExitMatchErrorToast(toast.error, result.error, false);
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
                    description={tLobby('matchRoom.preparingMatch')}
                    progressText={tLobby('matchRoom.loadingProgress.loadingGameModule')}
                />
            </HudPortal>
        );
    }

    if (!gameImplReady) {
        return (
            <HudPortal>
                <LoadingScreen
                    description={tLobby('matchRoom.preparingMatch')}
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
                                            description={tLobby('matchRoom.preparingMatch')}
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
                                                            description={tLobby('matchRoom.preparingMatch')}
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
                                            autoAcceptedPlayerIds={onlineAiRematchAutoAcceptedPlayerIds}
                                        >
                                            <GameProvider
                                                server={getGameServerUrl()}
                                                matchId={matchId}
                                                playerId={transportPlayerID}
                                                credentials={credentials}
                                                engineConfig={engineConfig ?? undefined}
                                                latencyConfig={latencyConfig}
                                                onError={handleGameError}
                                                onStateReady={() => {
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
                                                        onManualFactionDispatchReady={handleManualFactionDispatchReady}
                                                    />
                                                )}
                                                <OnlineManualFactionSelectionBridge
                                                    seatControllers={onlineAiSeatControllers}
                                                    dispatchManualAiCommand={dispatchManualAiCommand}
                                                >
                                                    <BoardBridge
                                                        board={WrappedBoard}
                                                        remountKey={false}
                                                        loading={(
                                                            <OnlineRoomConnectionLoading
                                                                title={tLobby('matchRoom.title.connecting')}
                                                                description={tLobby('matchRoom.connectingRoom')}
                                                                gameId={gameId}
                                                                transportError={onlineTransportError}
                                                            />
                                                        )}
                                                    />
                                                </OnlineManualFactionSelectionBridge>
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
