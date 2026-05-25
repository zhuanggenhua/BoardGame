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
        sharedInteractionId: string | null;
        privateInteractionId: string | null;
        sharedInteractionKind: string | null;
        privateInteractionKind: string | null;
        sharedInteractionSourceId: string | null;
        privateInteractionSourceId: string | null;
        sharedInteractionTitle: string | null;
        privateInteractionTitle: string | null;
        sharedInteractionOptionSignature: string | null;
        privateInteractionOptionSignature: string | null;
        sharedResponseWindowId: string | null;
        privateResponseWindowId: string | null;
        sharedResponseWindowType: string | null;
        privateResponseWindowType: string | null;
        sharedResponseWindowSourceId: string | null;
        privateResponseWindowSourceId: string | null;
        sharedResponseWindowResponderId: string | null;
        privateResponseWindowResponderId: string | null;
        sharedResponseWindowQueueSignature: string | null;
        privateResponseWindowQueueSignature: string | null;
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
    const sharedCurrentPlayerId = resolveCurrentPlayerIdFromState(args.sharedState);
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

function resolveInteractionKind(state: MatchState<unknown> | null | undefined): string | null {
    const interaction = state?.sys?.interaction as {
        current?: {
            kind?: unknown;
        } | null;
    } | undefined;
    return typeof interaction?.current?.kind === 'string'
        ? interaction.current.kind
        : null;
}

function resolveInteractionSourceId(state: MatchState<unknown> | null | undefined): string | null {
    const interaction = state?.sys?.interaction as {
        current?: {
            data?: {
                sourceId?: unknown;
            };
        } | null;
    } | undefined;
    return typeof interaction?.current?.data?.sourceId === 'string'
        ? interaction.current.data.sourceId
        : null;
}

function resolveInteractionTitle(state: MatchState<unknown> | null | undefined): string | null {
    const interaction = state?.sys?.interaction as {
        current?: {
            data?: {
                title?: unknown;
            };
        } | null;
    } | undefined;
    return typeof interaction?.current?.data?.title === 'string'
        ? interaction.current.data.title
        : null;
}

function resolveInteractionOptionSignature(state: MatchState<unknown> | null | undefined): string | null {
    const options = (state?.sys?.interaction as {
        current?: {
            data?: {
                options?: unknown;
            };
        } | null;
    } | undefined)?.current?.data?.options;
    if (!Array.isArray(options)) {
        return null;
    }

    return options
        .map((option) => {
            const item = option as {
                id?: unknown;
                disabled?: unknown;
                value?: unknown;
            };
            const optionId = typeof item.id === 'string' ? item.id : '';
            const disabledFlag = item.disabled === true ? '1' : '0';
            const valueSignature = JSON.stringify(item.value ?? null);
            return `${optionId}:${disabledFlag}:${valueSignature}`;
        })
        .join(',');
}

function resolveCompareRollConfirmSignature(state: MatchState<unknown> | null | undefined): string | null {
    if (resolveInteractionKind(state) !== 'compare-roll-choice') {
        return null;
    }

    const confirmValue = (state?.sys?.interaction as {
        current?: {
            data?: {
                confirmValue?: unknown;
            };
        } | null;
    } | undefined)?.current?.data?.confirmValue;

    return JSON.stringify(confirmValue ?? null);
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
    queueSignature: string | null;
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
        queueSignature: responderQueue
            .map((value) => typeof value === 'string' ? value : '')
            .filter((value) => value.length > 0)
            .join('|') || null,
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
        if (sharedResponseWindow.queueSignature !== privateResponseWindow.queueSignature) {
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
        const sharedInteractionKind = resolveInteractionKind(args.sharedState);
        const privateInteractionKind = resolveInteractionKind(args.privateOverlay);
        const sharedInteractionSourceId = resolveInteractionSourceId(args.sharedState);
        const privateInteractionSourceId = resolveInteractionSourceId(args.privateOverlay);
        const sharedInteractionTitle = resolveInteractionTitle(args.sharedState);
        const privateInteractionTitle = resolveInteractionTitle(args.privateOverlay);
        const sharedInteractionOptionSignature = resolveInteractionOptionSignature(args.sharedState);
        const privateInteractionOptionSignature = resolveInteractionOptionSignature(args.privateOverlay);
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
            if (sharedInteractionKind !== privateInteractionKind) {
                return false;
            }
            if (sharedInteractionSourceId !== privateInteractionSourceId) {
                return false;
            }
            if (sharedInteractionTitle !== privateInteractionTitle) {
                return false;
            }
            if (sharedInteractionOptionSignature !== privateInteractionOptionSignature) {
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

function shouldPreferSeatSnapshotForSharedVisibility(args: {
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

    const sharedInteractionKind = resolveInteractionKind(args.sharedState);
    const seatInteractionKind = resolveInteractionKind(args.privateOverlay);
    if (!sharedInteractionKind || !seatInteractionKind || sharedInteractionKind !== seatInteractionKind) {
        return false;
    }

    const sharedInteractionSourceId = resolveInteractionSourceId(args.sharedState);
    const seatInteractionSourceId = resolveInteractionSourceId(args.privateOverlay);
    if (sharedInteractionSourceId !== seatInteractionSourceId) {
        return false;
    }

    const sharedInteractionTitle = resolveInteractionTitle(args.sharedState);
    const seatInteractionTitle = resolveInteractionTitle(args.privateOverlay);
    if (sharedInteractionTitle !== seatInteractionTitle) {
        return false;
    }

    const sharedInteractionOptionSignature = resolveInteractionOptionSignature(args.sharedState);
    const seatInteractionOptionSignature = resolveInteractionOptionSignature(args.privateOverlay);
    if (sharedInteractionOptionSignature !== seatInteractionOptionSignature) {
        return false;
    }

    if (sharedInteractionKind === 'compare-roll-choice') {
        const sharedConfirmSignature = resolveCompareRollConfirmSignature(args.sharedState);
        const seatConfirmSignature = resolveCompareRollConfirmSignature(args.privateOverlay);
        if (sharedConfirmSignature !== seatConfirmSignature) {
            return false;
        }
    }

    return isPrivateOverlayFreshEnough({
        sharedState: args.sharedState,
        privateOverlay: args.privateOverlay,
        playerId: args.playerId,
    });
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

    const sharedResponseWindow = resolveResponseWindowCurrent(args.sharedState);
    const privateResponseWindow = resolveResponseWindowCurrent(privateOverlay);
    const diagnostics = {
        sharedPhase: resolveStatePhase(args.sharedState),
        privatePhase: resolveStatePhase(privateOverlay),
        sharedTurnNumber: resolveStateTurnNumber(args.sharedState),
        privateTurnNumber: resolveStateTurnNumber(privateOverlay),
        sharedCurrentPlayerId: resolveCurrentPlayerIdFromState(args.sharedState),
        privateCurrentPlayerId: resolveCurrentPlayerIdFromState(privateOverlay),
        sharedEventStreamNextId: resolveEventStreamNextIdFromState(args.sharedState),
        privateEventStreamNextId: resolveEventStreamNextIdFromState(privateOverlay),
        sharedInteractionId: resolveInteractionId(args.sharedState),
        privateInteractionId: resolveInteractionId(privateOverlay),
        sharedInteractionKind: resolveInteractionKind(args.sharedState),
        privateInteractionKind: resolveInteractionKind(privateOverlay),
        sharedInteractionSourceId: resolveInteractionSourceId(args.sharedState),
        privateInteractionSourceId: resolveInteractionSourceId(privateOverlay),
        sharedInteractionTitle: resolveInteractionTitle(args.sharedState),
        privateInteractionTitle: resolveInteractionTitle(privateOverlay),
        sharedInteractionOptionSignature: resolveInteractionOptionSignature(args.sharedState),
        privateInteractionOptionSignature: resolveInteractionOptionSignature(privateOverlay),
        sharedResponseWindowId: sharedResponseWindow?.id ?? null,
        privateResponseWindowId: privateResponseWindow?.id ?? null,
        sharedResponseWindowType: sharedResponseWindow?.windowType ?? null,
        privateResponseWindowType: privateResponseWindow?.windowType ?? null,
        sharedResponseWindowSourceId: sharedResponseWindow?.sourceId ?? null,
        privateResponseWindowSourceId: privateResponseWindow?.sourceId ?? null,
        sharedResponseWindowResponderId: sharedResponseWindow?.currentResponderId ?? null,
        privateResponseWindowResponderId: privateResponseWindow?.currentResponderId ?? null,
        sharedResponseWindowQueueSignature: sharedResponseWindow?.queueSignature ?? null,
        privateResponseWindowQueueSignature: privateResponseWindow?.queueSignature ?? null,
    };

    if (visibility === 'shared') {
        const visibleState = shouldPreferSeatSnapshotForSharedVisibility({
            sharedState: args.sharedState,
            privateOverlay,
            playerId: args.playerId,
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
