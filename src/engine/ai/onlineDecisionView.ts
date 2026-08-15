import type { MatchState } from '../types';
import type { GameAiRuntime, OnlineAiDecisionVisibility } from './types';
import { resolveCurrentDecisionPlayerId, resolveCurrentTurnPlayerIdFromState } from '../sessionContext';
import {
    resolveResponseWindowCurrent,
    resolveResponseWindowPrivateInteractionLockConsistency,
} from '../responseWindowInteractionLock';

export type OnlineAiDecisionBlockedReason =
    | 'missing-private-overlay'
    | 'stale-private-overlay';

export interface ResolvedOnlineAiDecisionView {
    kind: 'online-ai-decision-view';
    visibility: OnlineAiDecisionVisibility;
    sharedState: MatchState<unknown>;
    privateOverlay: MatchState<unknown> | null;
    visibleState: MatchState<unknown>;
    canDecide: boolean;
    blockedReason: OnlineAiDecisionBlockedReason | null;
    diagnostics: {
        sharedPhase: string | null;
        privatePhase: string | null;
        sharedTurnNumber: number | null;
        privateTurnNumber: number | null;
        sharedCurrentPlayerId: string | null;
        privateCurrentPlayerId: string | null;
        sharedEventStreamNextId: number | null;
        privateEventStreamNextId: number | null;
    };
}

interface ResolveOnlineAiDecisionViewArgs {
    runtime?: GameAiRuntime | null;
    sharedState: MatchState<unknown>;
    privateOverlay?: MatchState<unknown> | null | undefined;
    playerId: string;
}

type PhaseCarrier = {
    phase?: unknown;
};

export function resolveStatePhase(state: MatchState<unknown> | null | undefined): string | null {
    if (!state || typeof state !== 'object') return null;
    const sysPhase = (state.sys as PhaseCarrier | undefined)?.phase;
    if (typeof sysPhase === 'string' && sysPhase.length > 0) return sysPhase;
    const corePhase = (state.core as PhaseCarrier | undefined)?.phase;
    if (typeof corePhase === 'string' && corePhase.length > 0) return corePhase;
    return null;
}

export function resolveStateTurnNumber(state: MatchState<unknown> | null | undefined): number | null {
    if (!state || typeof state !== 'object') return null;
    const sysTurnNumber = (state.sys as { turnNumber?: unknown } | undefined)?.turnNumber;
    if (typeof sysTurnNumber === 'number') return sysTurnNumber;
    const coreTurnNumber = (state.core as { turnNumber?: unknown } | undefined)?.turnNumber;
    if (typeof coreTurnNumber === 'number') return coreTurnNumber;
    return null;
}

export function resolveCurrentPlayerIdFromState(state: MatchState<unknown> | null | undefined): string | null {
    return resolveCurrentTurnPlayerIdFromState(state);
}

function resolveCurrentDecisionPlayerIdFromState(args: {
    runtime?: GameAiRuntime | null;
    state: MatchState<unknown> | null | undefined;
}): string | null {
    return resolveCurrentDecisionPlayerId({
        state: args.state,
        resolveCurrentDecisionPlayerId: args.runtime?.resolveCurrentDecisionPlayerId,
    });
}

export function resolveEventStreamNextIdFromState(state: MatchState<unknown> | null | undefined): number | null {
    if (!state || typeof state !== 'object') return null;
    const nextId = (state.sys as { eventStream?: { nextId?: unknown } } | undefined)?.eventStream?.nextId;
    return typeof nextId === 'number' ? nextId : null;
}

function resolveVisibilityByDefault(args: {
    runtime?: GameAiRuntime | null;
    sharedState: MatchState<unknown>;
    privateOverlay: MatchState<unknown> | null;
    playerId: string;
}): OnlineAiDecisionVisibility {
    const sharedInteraction = args.sharedState.sys?.interaction as {
        current?: {
            kind?: unknown;
            playerId?: unknown;
            data?: {
                contestants?: unknown;
            };
        } | null;
        isBlocked?: unknown;
    } | undefined;
    const compareRollContestants = Array.isArray(sharedInteraction?.current?.data?.contestants)
        ? sharedInteraction.current.data.contestants
        : [];
    const isSharedCompareRollVisible = sharedInteraction?.current?.kind === 'compare-roll-choice'
        && (
            typeof sharedInteraction.current?.playerId === 'string' && sharedInteraction.current.playerId === args.playerId
            || compareRollContestants.some((contestant) => (
                typeof (contestant as { playerId?: unknown } | null | undefined)?.playerId === 'string'
                && (contestant as { playerId?: string }).playerId === args.playerId
            ))
        );
    if (isSharedCompareRollVisible) {
        return 'shared';
    }

    const sharedPhase = resolveStatePhase(args.sharedState);
    const sharedCurrentPlayerId = resolveCurrentDecisionPlayerIdFromState({
        runtime: args.runtime,
        state: args.sharedState,
    });
    const setupLikePhases = new Set(['setup', 'characterSelection', 'characterSelect', 'factionSelect']);
    const isSetupLikePhase = typeof sharedPhase === 'string' && setupLikePhases.has(sharedPhase);

    // 非 setup 阶段轮到 AI 主动执行时，默认要求 private overlay，避免共享态直推导致 stale seat 误决策。
    if (sharedCurrentPlayerId === args.playerId && !isSetupLikePhase) {
        return 'private-required';
    }

    const sharedInteractionPlayerId = typeof sharedInteraction?.current?.playerId === 'string'
        ? sharedInteraction.current.playerId
        : null;
    const hasSharedHiddenInteractionBlocker = sharedInteractionPlayerId !== args.playerId
        && sharedInteraction?.current == null
        && sharedInteraction?.isBlocked === true;
    if (sharedInteractionPlayerId === args.playerId || hasSharedHiddenInteractionBlocker) {
        return 'private-required';
    }

    const sharedResponseWindow = resolveResponseWindowCurrent(args.sharedState);
    if (sharedResponseWindow) {
        return 'private-required';
    }

    const privateInteraction = args.privateOverlay?.sys?.interaction as {
        current?: {
            playerId?: unknown;
        } | null;
    } | undefined;
    const privateInteractionPlayerId = typeof privateInteraction?.current?.playerId === 'string'
        ? privateInteraction.current.playerId
        : null;
    if (privateInteractionPlayerId === args.playerId) {
        return 'private-required';
    }

    const privateResponseWindow = resolveResponseWindowCurrent(args.privateOverlay);
    if (privateResponseWindow?.currentResponderId === args.playerId) {
        return 'private-required';
    }

    return 'shared';
}

function resolveInteractionPlayerId(state: MatchState<unknown> | null | undefined): string | null {
    const interaction = state?.sys?.interaction as {
        current?: {
            playerId?: unknown;
        } | null;
    } | undefined;
    return typeof interaction?.current?.playerId === 'string'
        ? interaction.current.playerId
        : null;
}

function resolveInteractionId(state: MatchState<unknown> | null | undefined): string | null {
    const interaction = state?.sys?.interaction as {
        current?: {
            id?: unknown;
        } | null;
    } | undefined;
    return typeof interaction?.current?.id === 'string'
        ? interaction.current.id
        : null;
}

function hasSharedHiddenInteractionBlocker(state: MatchState<unknown> | null | undefined, playerId: string): boolean {
    const interaction = state?.sys?.interaction as {
        current?: {
            playerId?: unknown;
        } | null;
        isBlocked?: unknown;
    } | undefined;
    const interactionPlayerId = typeof interaction?.current?.playerId === 'string'
        ? interaction.current.playerId
        : null;
    return interactionPlayerId !== playerId
        && interaction?.current == null
        && interaction?.isBlocked === true;
}

function buildCurrentInteractionOptionSignature(
    state: MatchState<unknown> | null | undefined,
): string | null {
    const current = (state?.sys?.interaction as {
        current?: {
            data?: {
                options?: unknown;
            } | null;
        } | null;
    } | undefined)?.current;
    const options = Array.isArray(current?.data?.options)
        ? current.data.options
        : null;
    if (!options) {
        return null;
    }

    return options
        .map((option) => {
            const optionId = typeof (option as { id?: unknown } | null | undefined)?.id === 'string'
                ? (option as { id: string }).id
                : '';
            const disabledFlag = (option as { disabled?: unknown } | null | undefined)?.disabled === true
                ? '1'
                : '0';
            return `${optionId}:${disabledFlag}`;
        })
        .join(',');
}

function hasCompatibleCurrentInteractionOptions(args: {
    sharedState: MatchState<unknown>;
    privateOverlay: MatchState<unknown>;
}): boolean {
    const sharedSignature = buildCurrentInteractionOptionSignature(args.sharedState);
    const privateSignature = buildCurrentInteractionOptionSignature(args.privateOverlay);
    if (sharedSignature === null && privateSignature === null) {
        return true;
    }
    if (sharedSignature === null || privateSignature === null) {
        return false;
    }
    return sharedSignature === privateSignature;
}

function isPrivateOverlayFreshEnough(args: {
    runtime?: GameAiRuntime | null;
    sharedState: MatchState<unknown>;
    privateOverlay: MatchState<unknown>;
    playerId: string;
}): boolean {
    // 硬约束：private overlay 必须和 authoritative shared 指向同一 event-stream epoch。
    // 不再仅靠 phase/turn/currentPlayer 推断“可能新鲜”。
    const sharedEventStreamNextId = resolveEventStreamNextIdFromState(args.sharedState);
    const privateEventStreamNextId = resolveEventStreamNextIdFromState(args.privateOverlay);
    if (sharedEventStreamNextId === null || privateEventStreamNextId === null) {
        return false;
    }
    if (sharedEventStreamNextId !== privateEventStreamNextId) {
        return false;
    }

    const sharedHasHiddenInteractionBlocker = hasSharedHiddenInteractionBlocker(args.sharedState, args.playerId);
    const responseWindowLockConsistency = resolveResponseWindowPrivateInteractionLockConsistency({
        sharedState: args.sharedState,
        privateOverlay: args.privateOverlay,
        playerId: args.playerId,
    });
    const isResponseWindowDecision = responseWindowLockConsistency.isResponseWindowDecision;

    if (isResponseWindowDecision && !responseWindowLockConsistency.ok) {
        return false;
    }

    const sharedInteractionPlayerId = resolveInteractionPlayerId(args.sharedState);
    const privateInteractionPlayerId = responseWindowLockConsistency.privateInteractionPlayerId;
    const sharedInteractionId = resolveInteractionId(args.sharedState);
    const privateInteractionId = responseWindowLockConsistency.privateInteractionId;
    const isResponseWindowLockedPrivateInteraction = responseWindowLockConsistency.isLockedPrivateInteraction;
    const isInteractionDecision = sharedInteractionPlayerId === args.playerId
        || privateInteractionPlayerId === args.playerId
        || isResponseWindowLockedPrivateInteraction;

    if (isInteractionDecision) {
        if (sharedHasHiddenInteractionBlocker) {
            if (privateInteractionPlayerId !== args.playerId || !privateInteractionId) {
                return false;
            }
        } else if (isResponseWindowLockedPrivateInteraction) {
            // 共享态只公开“响应窗口被哪个交互锁住”，交互本体只存在于对应 seat 私有视图。
            // 上面的 pendingInteractionId 校验已经证明二者是同一个生命周期，不再要求 shared.current 也存在。
        } else {
            if (sharedInteractionPlayerId !== privateInteractionPlayerId) {
                return false;
            }
            if (sharedInteractionId !== privateInteractionId) {
                return false;
            }
        }
    }

    const sharedCurrentPlayerId = resolveCurrentDecisionPlayerIdFromState({
        runtime: args.runtime,
        state: args.sharedState,
    });
    const privateCurrentPlayerId = resolveCurrentDecisionPlayerIdFromState({
        runtime: args.runtime,
        state: args.privateOverlay,
    });
    if (!isResponseWindowDecision && !isInteractionDecision
        && (sharedCurrentPlayerId !== args.playerId || privateCurrentPlayerId !== args.playerId)) {
        return false;
    }

    const sharedPhase = resolveStatePhase(args.sharedState);
    const privatePhase = resolveStatePhase(args.privateOverlay);
    if (sharedPhase !== privatePhase) {
        return false;
    }

    const sharedTurnNumber = resolveStateTurnNumber(args.sharedState);
    const privateTurnNumber = resolveStateTurnNumber(args.privateOverlay);
    if (sharedTurnNumber !== null && privateTurnNumber !== null && sharedTurnNumber !== privateTurnNumber) {
        return false;
    }

    return true;
}

function shouldPreferSeatSnapshotForSharedVisibility(args: {
    runtime?: GameAiRuntime | null;
    sharedState: MatchState<unknown>;
    privateOverlay: MatchState<unknown> | null;
    playerId: string;
}): boolean {
    if (!args.privateOverlay) {
        return false;
    }

    const sharedInteractionId = resolveInteractionId(args.sharedState);
    const seatInteractionId = resolveInteractionId(args.privateOverlay);
    if (!sharedInteractionId || !seatInteractionId || sharedInteractionId !== seatInteractionId) {
        return false;
    }
    if (!hasCompatibleCurrentInteractionOptions({
        sharedState: args.sharedState,
        privateOverlay: args.privateOverlay,
    })) {
        return false;
    }

    return isPrivateOverlayFreshEnough({
        runtime: args.runtime,
        sharedState: args.sharedState,
        privateOverlay: args.privateOverlay,
        playerId: args.playerId,
    });
}

function shouldPreferSetupSeatSnapshotForSharedVisibility(args: {
    sharedState: MatchState<unknown>;
    privateOverlay: MatchState<unknown> | null;
}): boolean {
    if (!args.privateOverlay) {
        return false;
    }

    const setupLikePhases = new Set(['setup', 'characterSelection', 'characterSelect', 'factionSelect']);
    const sharedPhase = resolveStatePhase(args.sharedState);
    const privatePhase = resolveStatePhase(args.privateOverlay);
    if (!sharedPhase || !setupLikePhases.has(sharedPhase) || privatePhase !== sharedPhase) {
        return false;
    }

    const sharedEventStreamNextId = resolveEventStreamNextIdFromState(args.sharedState);
    const privateEventStreamNextId = resolveEventStreamNextIdFromState(args.privateOverlay);
    return sharedEventStreamNextId !== null
        && privateEventStreamNextId !== null
        && privateEventStreamNextId > sharedEventStreamNextId;
}

export function resolveOnlineAiDecisionView(
    args: ResolveOnlineAiDecisionViewArgs,
): ResolvedOnlineAiDecisionView {
    const privateOverlay = args.privateOverlay && typeof args.privateOverlay === 'object'
        ? args.privateOverlay
        : null;

    const runtimeVisibility = args.runtime?.resolveOnlineDecisionVisibility?.({
        playerId: args.playerId,
        sharedState: args.sharedState,
        privateOverlay,
    });

    const visibility = runtimeVisibility
        ?? resolveVisibilityByDefault({
            runtime: args.runtime,
            sharedState: args.sharedState,
            privateOverlay,
            playerId: args.playerId,
        });

    const diagnostics = {
        sharedPhase: resolveStatePhase(args.sharedState),
        privatePhase: resolveStatePhase(privateOverlay),
        sharedTurnNumber: resolveStateTurnNumber(args.sharedState),
        privateTurnNumber: resolveStateTurnNumber(privateOverlay),
        sharedCurrentPlayerId: resolveCurrentPlayerIdFromState(args.sharedState),
        privateCurrentPlayerId: resolveCurrentPlayerIdFromState(privateOverlay),
        sharedEventStreamNextId: resolveEventStreamNextIdFromState(args.sharedState),
        privateEventStreamNextId: resolveEventStreamNextIdFromState(privateOverlay),
    };

    if (visibility === 'shared') {
        const visibleState = shouldPreferSeatSnapshotForSharedVisibility({
            runtime: args.runtime,
            sharedState: args.sharedState,
            privateOverlay,
            playerId: args.playerId,
        }) || shouldPreferSetupSeatSnapshotForSharedVisibility({
            sharedState: args.sharedState,
            privateOverlay,
        })
            ? privateOverlay as MatchState<unknown>
            : args.sharedState;
        return {
            kind: 'online-ai-decision-view',
            visibility,
            sharedState: args.sharedState,
            privateOverlay,
            visibleState,
            canDecide: true,
            blockedReason: null,
            diagnostics,
        };
    }

    if (!privateOverlay) {
        return {
            kind: 'online-ai-decision-view',
            visibility,
            sharedState: args.sharedState,
            privateOverlay: null,
            visibleState: args.sharedState,
            canDecide: false,
            blockedReason: 'missing-private-overlay',
            diagnostics,
        };
    }

    if (!isPrivateOverlayFreshEnough({
        runtime: args.runtime,
        sharedState: args.sharedState,
        privateOverlay,
        playerId: args.playerId,
    })) {
        return {
            kind: 'online-ai-decision-view',
            visibility,
            sharedState: args.sharedState,
            privateOverlay,
            visibleState: args.sharedState,
            canDecide: false,
            blockedReason: 'stale-private-overlay',
            diagnostics,
        };
    }

    return {
        kind: 'online-ai-decision-view',
        visibility,
        sharedState: args.sharedState,
        privateOverlay,
        visibleState: privateOverlay,
        canDecide: true,
        blockedReason: null,
        diagnostics,
    };
}

export function isResolvedOnlineAiDecisionView(
    value: MatchState<unknown> | ResolvedOnlineAiDecisionView | null | undefined,
): value is ResolvedOnlineAiDecisionView {
    return !!value
        && typeof value === 'object'
        && 'kind' in value
        && value.kind === 'online-ai-decision-view';
}
