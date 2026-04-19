import type { MatchState } from '../types';
import type { GameAiRuntime } from './types';

export type OnlineAiDecisionVisibility = 'shared' | 'private-required';

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
    const core = state?.core as {
        activePlayerId?: unknown;
        currentPlayer?: unknown;
        currentPlayerId?: unknown;
    } | undefined;
    if (!core) return null;
    if (typeof core.activePlayerId === 'string') return core.activePlayerId;
    if (typeof core.currentPlayerId === 'string') return core.currentPlayerId;
    if (typeof core.currentPlayer === 'string') return core.currentPlayer;
    return null;
}

export function resolveEventStreamNextIdFromState(state: MatchState<unknown> | null | undefined): number | null {
    if (!state || typeof state !== 'object') return null;
    const nextId = (state.sys as { eventStream?: { nextId?: unknown } } | undefined)?.eventStream?.nextId;
    return typeof nextId === 'number' ? nextId : null;
}

function resolveVisibilityByDefault(args: {
    sharedState: MatchState<unknown>;
    privateOverlay: MatchState<unknown> | null;
    playerId: string;
}): OnlineAiDecisionVisibility {
    const sharedPhase = resolveStatePhase(args.sharedState);
    const sharedCurrentPlayerId = resolveCurrentPlayerIdFromState(args.sharedState);
    const setupLikePhases = new Set(['setup', 'characterSelection', 'characterSelect', 'factionSelect']);
    const isSetupLikePhase = typeof sharedPhase === 'string' && setupLikePhases.has(sharedPhase);

    // 非 setup 阶段轮到 AI 主动执行时，默认要求 private overlay，避免共享态直推导致 stale seat 误决策。
    if (sharedCurrentPlayerId === args.playerId && !isSetupLikePhase) {
        return 'private-required';
    }

    const sharedInteraction = args.sharedState.sys?.interaction as {
        current?: {
            playerId?: unknown;
        } | null;
        isBlocked?: unknown;
    } | undefined;
    const sharedInteractionPlayerId = typeof sharedInteraction?.current?.playerId === 'string'
        ? sharedInteraction.current.playerId
        : null;
    const hasSharedHiddenInteractionBlocker = sharedInteractionPlayerId !== args.playerId
        && sharedInteraction?.current == null
        && sharedInteraction?.isBlocked === true;
    if (sharedInteractionPlayerId === args.playerId || hasSharedHiddenInteractionBlocker) {
        return 'private-required';
    }

    const sharedResponseWindow = args.sharedState.sys?.responseWindow as {
        current?: unknown;
    } | undefined;
    if (sharedResponseWindow?.current) {
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

    const privateResponseWindow = args.privateOverlay?.sys?.responseWindow as {
        current?: {
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        } | null;
    } | undefined;
    const responderQueue = Array.isArray(privateResponseWindow?.current?.responderQueue)
        ? privateResponseWindow.current.responderQueue
        : [];
    const responderIndex = typeof privateResponseWindow?.current?.currentResponderIndex === 'number'
        ? privateResponseWindow.current.currentResponderIndex
        : 0;
    if (responderQueue[responderIndex] === args.playerId) {
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

function resolveResponseWindowCurrent(state: MatchState<unknown> | null | undefined): {
    id: string | null;
    windowType: string | null;
    sourceId: string | null;
    currentResponderId: string | null;
} | null {
    const current = (state?.sys?.responseWindow as {
        current?: {
            id?: unknown;
            windowType?: unknown;
            sourceId?: unknown;
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        } | null;
    } | undefined)?.current;
    if (!current) {
        return null;
    }

    const responderQueue = Array.isArray(current.responderQueue) ? current.responderQueue : [];
    const responderIndex = typeof current.currentResponderIndex === 'number'
        ? current.currentResponderIndex
        : 0;
    const currentResponderId = typeof responderQueue[responderIndex] === 'string'
        ? responderQueue[responderIndex]
        : null;

    return {
        id: typeof current.id === 'string' ? current.id : null,
        windowType: typeof current.windowType === 'string' ? current.windowType : null,
        sourceId: typeof current.sourceId === 'string' ? current.sourceId : null,
        currentResponderId,
    };
}

function isPrivateOverlayFreshEnough(args: {
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
    const sharedResponseWindow = resolveResponseWindowCurrent(args.sharedState);
    const privateResponseWindow = resolveResponseWindowCurrent(args.privateOverlay);
    const isResponseWindowDecision = !!sharedResponseWindow || !!privateResponseWindow;

    if (isResponseWindowDecision) {
        if (!sharedResponseWindow || !privateResponseWindow) {
            return false;
        }
        if (sharedResponseWindow.currentResponderId !== privateResponseWindow.currentResponderId) {
            return false;
        }
        if (sharedResponseWindow.id !== privateResponseWindow.id) {
            return false;
        }
        if (sharedResponseWindow.windowType !== privateResponseWindow.windowType) {
            return false;
        }
        if (sharedResponseWindow.sourceId !== privateResponseWindow.sourceId) {
            return false;
        }
    }

    const sharedInteractionPlayerId = resolveInteractionPlayerId(args.sharedState);
    const privateInteractionPlayerId = resolveInteractionPlayerId(args.privateOverlay);
    const isInteractionDecision = sharedInteractionPlayerId === args.playerId
        || privateInteractionPlayerId === args.playerId;

    if (isInteractionDecision) {
        const sharedInteractionId = resolveInteractionId(args.sharedState);
        const privateInteractionId = resolveInteractionId(args.privateOverlay);
        if (sharedHasHiddenInteractionBlocker) {
            if (privateInteractionPlayerId !== args.playerId || !privateInteractionId) {
                return false;
            }
        } else {
            if (sharedInteractionPlayerId !== privateInteractionPlayerId) {
                return false;
            }
            if (sharedInteractionId !== privateInteractionId) {
                return false;
            }
        }
    }

    const sharedCurrentPlayerId = resolveCurrentPlayerIdFromState(args.sharedState);
    const privateCurrentPlayerId = resolveCurrentPlayerIdFromState(args.privateOverlay);
    if (!isResponseWindowDecision && !isInteractionDecision
        && (sharedCurrentPlayerId !== args.playerId || privateCurrentPlayerId !== args.playerId)) {
        return false;
    }

    const sharedPhase = resolveStatePhase(args.sharedState);
    const privatePhase = resolveStatePhase(args.privateOverlay);
    if (!sharedPhase || !privatePhase || sharedPhase !== privatePhase) {
        return false;
    }

    const sharedTurnNumber = resolveStateTurnNumber(args.sharedState);
    const privateTurnNumber = resolveStateTurnNumber(args.privateOverlay);
    if (sharedTurnNumber !== null && privateTurnNumber !== null && sharedTurnNumber !== privateTurnNumber) {
        return false;
    }

    return true;
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
        return {
            kind: 'online-ai-decision-view',
            visibility,
            sharedState: args.sharedState,
            privateOverlay,
            visibleState: args.sharedState,
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
