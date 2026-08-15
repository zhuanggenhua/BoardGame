import type { GameEvent, MatchState } from '../../../engine/types';
import {
    appendResolutionFrameDeferredPayload,
    completeResolutionFrame,
    consumeResolutionFrameDeferredPayload,
    getResolutionFrameById,
    setResolutionFrameDeferredPayload,
    upsertResolutionFrame,
} from '../../../engine/systems/resolutionStack';
import type {
    MinionPlayedEvent,
    PendingPostScoringAction,
    SmashUpCore,
    SmashUpEvent,
    TitanPlayedEvent,
} from './types';
import { SU_EVENT_TYPES } from './types';
import { buildValidatedMoveEvents, getTitanByController } from './abilityHelpers';

export interface SmashUpScoringBaseRef {
    baseInstanceId?: string;
    slotIndex: number;
    baseDefId: string;
}

export type SerializedPostScoringEvent = {
    type: string;
    payload: unknown;
    timestamp: number;
};

export type SmashUpScoringStep =
    | 'idle'
    | 'resolving-base'
    | 'awaiting-before-scoring-reduce'
    | 'awaiting-before-reaction-reduce'
    | 'awaiting-before-response-window'
    | 'awaiting-when-scoring-reduce'
    | 'awaiting-when-reaction-reduce'
    | 'awaiting-score-award-reduce'
    | 'awaiting-after-scoring-reduce'
    | 'awaiting-after-reaction-reduce'
    | 'awaiting-interactions'
    | 'awaiting-response-window'
    | 'awaiting-post-scoring-finalize';

export const SMASHUP_SCORE_BASES_FRAME_ID = 'smashup:score-bases';

export interface SmashUpScoringSession {
    frameId: string;
    lockedBaseRefs: SmashUpScoringBaseRef[];
    completedBaseRefs: SmashUpScoringBaseRef[];
    currentBaseRef?: SmashUpScoringBaseRef;
    currentStep: SmashUpScoringStep;
}

function getScoringFrame(state: MatchState<SmashUpCore>) {
    return getResolutionFrameById(state, SMASHUP_SCORE_BASES_FRAME_ID);
}

function buildScoringSessionFromFrame(state: MatchState<SmashUpCore>): SmashUpScoringSession | undefined {
    const frame = getScoringFrame(state);
    if (!frame) {
        return undefined;
    }

    const metadata = (frame.metadata ?? {}) as {
        lockedBaseRefs?: SmashUpScoringBaseRef[];
        completedBaseRefs?: SmashUpScoringBaseRef[];
        currentBaseRef?: SmashUpScoringBaseRef;
    };

    return {
        frameId: frame.id,
        lockedBaseRefs: metadata.lockedBaseRefs ?? [],
        completedBaseRefs: metadata.completedBaseRefs ?? [],
        currentBaseRef: metadata.currentBaseRef,
        currentStep: (frame.step as SmashUpScoringStep | undefined) ?? 'idle',
    };
}

function buildScoringResolutionFrame(session: SmashUpScoringSession) {
    return {
        id: session.frameId,
        kind: 'smashup:score-bases',
        ownerGame: 'smashup',
        ownerSystem: 'smashup-scoring',
        ownerToken: session.frameId,
        ordering: 'explicit-order' as const,
        status: 'running' as const,
        step: session.currentStep,
        phase: 'scoreBases',
        phaseGate: 'block-advance-when-blocked' as const,
        metadata: {
            lockedBaseRefs: session.lockedBaseRefs,
            completedBaseRefs: session.completedBaseRefs,
            currentBaseRef: session.currentBaseRef,
        },
    };
}

export function createScoringBaseRef(core: SmashUpCore, slotIndex: number): SmashUpScoringBaseRef | undefined {
    const base = core.bases[slotIndex];
    if (!base) return undefined;
    return {
        baseInstanceId: base.instanceId,
        slotIndex,
        baseDefId: base.defId,
    };
}

export function isSameScoringBaseRef(
    left: SmashUpScoringBaseRef | undefined,
    right: SmashUpScoringBaseRef | undefined,
): boolean {
    if (!left || !right) return false;
    if (left.baseInstanceId || right.baseInstanceId) {
        return !!left.baseInstanceId && left.baseInstanceId === right.baseInstanceId;
    }
    return left.slotIndex === right.slotIndex && left.baseDefId === right.baseDefId;
}

export function createScoringSession(core: SmashUpCore, lockedBaseIndices: number[]): SmashUpScoringSession {
    return {
        frameId: SMASHUP_SCORE_BASES_FRAME_ID,
        lockedBaseRefs: lockedBaseIndices
            .map((slotIndex) => createScoringBaseRef(core, slotIndex))
            .filter((ref): ref is SmashUpScoringBaseRef => !!ref),
        completedBaseRefs: [],
        currentStep: 'idle',
    };
}

export function getScoringSession(state: MatchState<SmashUpCore>): SmashUpScoringSession | undefined {
    return buildScoringSessionFromFrame(state);
}

export function setScoringSession(
    state: MatchState<SmashUpCore>,
    session: SmashUpScoringSession | undefined,
): MatchState<SmashUpCore> {
    let nextState: MatchState<SmashUpCore> = state;

    if (!session) {
        return completeResolutionFrame(nextState, SMASHUP_SCORE_BASES_FRAME_ID);
    }

    const existingFrame = getResolutionFrameById(nextState, session.frameId);
    nextState = upsertResolutionFrame(nextState, {
        ...(existingFrame ?? {}),
        ...buildScoringResolutionFrame(session),
        status: existingFrame?.status === 'suspended' ? 'suspended' : (existingFrame?.status ?? 'running'),
        blockedBy: existingFrame?.blockedBy,
        suspendedByFrameId: existingFrame?.suspendedByFrameId,
        deferredEvents: existingFrame?.deferredEvents,
        deferredActions: existingFrame?.deferredActions,
    }, {
        setActive: !nextState.sys.resolution?.activeFrameId || nextState.sys.resolution?.activeFrameId === session.frameId,
    });

    return nextState;
}

export function updateScoringSession(
    state: MatchState<SmashUpCore>,
    updater: (session: SmashUpScoringSession | undefined) => SmashUpScoringSession | undefined,
): MatchState<SmashUpCore> {
    return setScoringSession(state, updater(getScoringSession(state)));
}

export function clearScoringSession(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    return setScoringSession(state, undefined);
}

export function getRemainingScoringBaseRefs(state: MatchState<SmashUpCore>): SmashUpScoringBaseRef[] {
    const session = getScoringSession(state);
    if (!session) return [];
    return session.lockedBaseRefs.filter((ref) =>
        !session.completedBaseRefs.some((completed) => isSameScoringBaseRef(completed, ref)),
    );
}

export function serializePostScoringEvents(events: SmashUpEvent[]): SerializedPostScoringEvent[] {
    return events.map((event) => ({
        type: event.type,
        payload: (event as GameEvent).payload,
        timestamp: typeof event.timestamp === 'number' ? event.timestamp : 0,
    }));
}

export function getDeferredPostScoringEvents(
    state: MatchState<SmashUpCore>,
    _interactionData?: Record<string, unknown>,
): SerializedPostScoringEvent[] | undefined {
    const session = getScoringSession(state);
    if (!session) {
        return undefined;
    }
    const frameDeferred = getResolutionFrameById(state, session.frameId)?.deferredEvents as
        | SerializedPostScoringEvent[]
        | undefined;
    return frameDeferred && frameDeferred.length > 0 ? frameDeferred : undefined;
}

export function getCurrentScoringBaseIndex(
    state: MatchState<SmashUpCore>,
): number | undefined {
    const session = getScoringSession(state);
    return resolveScoringBaseRefSlotIndex(state, session?.currentBaseRef);
}

export function isScoringSessionAwaitingDeferredResolution(
    state: MatchState<SmashUpCore>,
): boolean {
    const session = getScoringSession(state);
    if (!session?.currentBaseRef) {
        return false;
    }
    return session.currentStep === 'awaiting-before-scoring-reduce'
        || session.currentStep === 'awaiting-before-reaction-reduce'
        || session.currentStep === 'awaiting-before-response-window'
        || session.currentStep === 'awaiting-when-scoring-reduce'
        || session.currentStep === 'awaiting-when-reaction-reduce'
        || session.currentStep === 'awaiting-score-award-reduce'
        || session.currentStep === 'awaiting-after-scoring-reduce'
        || session.currentStep === 'awaiting-after-reaction-reduce'
        || session.currentStep === 'awaiting-interactions'
        || session.currentStep === 'awaiting-response-window'
        || session.currentStep === 'awaiting-post-scoring-finalize';
}

export function getDeferredReplacementBaseDefId(
    state: MatchState<SmashUpCore>,
    interactionData?: Record<string, unknown>,
): string | undefined {
    const replacementEvent = getDeferredPostScoringEvents(state, interactionData)?.find(
        (event) => event.type === 'su:base_replaced',
    );
    return (replacementEvent?.payload as { newBaseDefId?: string } | undefined)?.newBaseDefId;
}

const DEFERRED_REPLACEMENT_BASE_DECK_REORDER_REASONS = new Set([
    'base_the_nexus',
    'time_travelers_time_is_fleeting',
]);

function removeFirstBaseDefId(values: readonly string[], defId: string): string[] {
    const index = values.indexOf(defId);
    if (index < 0) return [...values];
    return [...values.slice(0, index), ...values.slice(index + 1)];
}

export function getDeferredReplacementBaseDefIdFromBaseDeckReorderEvents(
    events: readonly SmashUpEvent[],
): string | undefined {
    const reordered = events.find((event) => {
        if (event.type !== SU_EVENT_TYPES.BASE_DECK_REORDERED) return false;
        const payload = event.payload as { reason?: string } | undefined;
        return payload?.reason !== undefined && DEFERRED_REPLACEMENT_BASE_DECK_REORDER_REASONS.has(payload.reason);
    });
    const payload = reordered?.payload as { topDefIds?: unknown[] } | undefined;
    const selectedBaseDefId = payload?.topDefIds?.[0];
    return typeof selectedBaseDefId === 'string' ? selectedBaseDefId : undefined;
}

export function replaceDeferredPostScoringReplacementBase(
    state: MatchState<SmashUpCore>,
    newBaseDefId: string,
): MatchState<SmashUpCore> {
    const session = getScoringSession(state);
    if (!session) {
        return state;
    }
    const frame = getResolutionFrameById(state, session.frameId);
    const deferredEvents = frame?.deferredEvents as SerializedPostScoringEvent[] | undefined;
    if (!frame || !deferredEvents?.length) {
        return state;
    }

    let changed = false;
    const previousReplacementBaseDefIds = new Set<string>();
    const originalReplacementEvent = deferredEvents.find(event => event.type === SU_EVENT_TYPES.BASE_REPLACED);
    const originalReplacementPayload = originalReplacementEvent?.payload as { oldBaseDefId?: unknown } | undefined;
    const oldReplacementBaseDefId = typeof originalReplacementPayload?.oldBaseDefId === 'string'
        ? originalReplacementPayload.oldBaseDefId
        : undefined;
    const nextDeferredEvents = deferredEvents.flatMap((event) => {
        if (
            event.type === SU_EVENT_TYPES.BASE_DECK_SHUFFLED
            && (event.payload as { reason?: string } | undefined)?.reason === 'base_deck_empty_reshuffle_discard'
        ) {
            const payload = event.payload as {
                newBaseDeckDefIds?: unknown[];
                reason?: string;
                clearBaseDiscard?: boolean;
                newBaseDiscardDefIds?: string[];
            } | undefined;
            const shuffledDeck = payload?.newBaseDeckDefIds?.filter((defId): defId is string => typeof defId === 'string') ?? [];
            const remainingAfterSelected = removeFirstBaseDefId(shuffledDeck, newBaseDefId);
            const hasPreExistingDiscardRemainder = remainingAfterSelected.some(defId => defId !== oldReplacementBaseDefId);
            changed = true;
            if (!hasPreExistingDiscardRemainder) {
                return [];
            }
            return [{
                ...event,
                payload: {
                    ...payload,
                    newBaseDeckDefIds: [newBaseDefId, ...remainingAfterSelected],
                    clearBaseDiscard: true,
                },
            }];
        }
        if (event.type !== SU_EVENT_TYPES.BASE_REPLACED) {
            return [event];
        }
        const payload = event.payload as Record<string, unknown> | undefined;
        if (typeof payload?.newBaseDefId === 'string') {
            previousReplacementBaseDefIds.add(payload.newBaseDefId);
        }
        if (!payload || payload.newBaseDefId === newBaseDefId) {
            return [event];
        }
        changed = true;
        return [{
            ...event,
            payload: {
                ...payload,
                newBaseDefId,
            },
        }];
    });
    const deferredActions = frame.deferredActions as PendingPostScoringAction[] | undefined;
    const nextDeferredActions = deferredActions?.map((action) => {
        if (
            action.kind !== 'moveMinionToReplacementBase'
            && action.kind !== 'playMinionOnReplacementBase'
            && action.kind !== 'playTitanOnReplacementBase'
        ) {
            return action;
        }
        if (!previousReplacementBaseDefIds.has(action.targetBaseDefId) || action.targetBaseDefId === newBaseDefId) {
            return action;
        }
        changed = true;
        return {
            ...action,
            targetBaseDefId: newBaseDefId,
        };
    });

    if (!changed) {
        return state;
    }

    return upsertResolutionFrame(state, {
        ...frame,
        deferredEvents: nextDeferredEvents,
        deferredActions: nextDeferredActions,
    }, {
        setActive: state.sys.resolution?.activeFrameId === frame.id,
    });
}

export function appendPendingPostScoringActions(
    state: MatchState<SmashUpCore>,
    actions: PendingPostScoringAction[] | undefined,
): MatchState<SmashUpCore> {
    if (!actions?.length) {
        return state;
    }

    const session = getScoringSession(state);
    if (session) {
        return appendResolutionFrameDeferredPayload(state, session.frameId, {
            deferredActions: actions,
        });
    }
    return state;
}

export function resolveScoringBaseRefSlotIndex(
    state: MatchState<SmashUpCore>,
    baseRef: SmashUpScoringBaseRef | undefined,
): number | undefined {
    if (!baseRef) return undefined;
    if (baseRef.baseInstanceId) {
        const instanceIndex = state.core.bases.findIndex((candidate) => candidate?.instanceId === baseRef.baseInstanceId);
        return instanceIndex >= 0 ? instanceIndex : undefined;
    }
    const slotBase = state.core.bases[baseRef.slotIndex];
    if (slotBase?.defId === baseRef.baseDefId) {
        return baseRef.slotIndex;
    }
    return state.core.bases.findIndex((candidate) => candidate?.defId === baseRef.baseDefId) >= 0
        ? state.core.bases.findIndex((candidate) => candidate?.defId === baseRef.baseDefId)
        : undefined;
}

export function markScoringBaseCompleted(
    state: MatchState<SmashUpCore>,
    baseRef: SmashUpScoringBaseRef,
): MatchState<SmashUpCore> {
    return updateScoringSession(state, (session) => {
        if (!session) return session;
        const alreadyCompleted = session.completedBaseRefs.some((completed) => isSameScoringBaseRef(completed, baseRef));
        return {
            ...session,
            completedBaseRefs: alreadyCompleted
                ? session.completedBaseRefs
                : [...session.completedBaseRefs, baseRef],
            currentBaseRef: undefined,
        };
    });
}

export function consumeScoringFrameDeferredPayload(
    state: MatchState<SmashUpCore>,
): {
    state: MatchState<SmashUpCore>;
    deferredEvents: SerializedPostScoringEvent[];
    deferredActions: PendingPostScoringAction[];
} {
    const session = getScoringSession(state);
    if (!session) {
        return {
            state,
            deferredEvents: [],
            deferredActions: [],
        };
    }

    const consumed = consumeResolutionFrameDeferredPayload(state, session.frameId);
    return {
        state: consumed.state,
        deferredEvents: consumed.deferredEvents as SerializedPostScoringEvent[],
        deferredActions: consumed.deferredActions as PendingPostScoringAction[],
    };
}

export function appendScoringFrameDeferredPayload(
    state: MatchState<SmashUpCore>,
    payload: {
        deferredEvents?: SerializedPostScoringEvent[];
        deferredActions?: PendingPostScoringAction[];
    },
): MatchState<SmashUpCore> {
    const session = getScoringSession(state);
    if (!session) {
        return state;
    }
    return appendResolutionFrameDeferredPayload(state, session.frameId, payload);
}

export function updateDeferredPostScoringEvents(
    state: MatchState<SmashUpCore>,
    updater: (events: SerializedPostScoringEvent[]) => SerializedPostScoringEvent[],
): MatchState<SmashUpCore> {
    const session = getScoringSession(state);
    if (!session) {
        return state;
    }

    const currentEvents = getDeferredPostScoringEvents(state) ?? [];
    const nextEvents = updater(currentEvents);
    if (nextEvents === currentEvents) {
        return state;
    }

    return setResolutionFrameDeferredPayload(state, session.frameId, {
        deferredEvents: nextEvents,
    });
}

export function buildPendingPostScoringActionEvents(
    state: { core: SmashUpCore },
    actions: PendingPostScoringAction[] | undefined,
    timestamp: number,
): SmashUpEvent[] {
    if (!actions || actions.length === 0) {
        return [];
    }

    const events: SmashUpEvent[] = [];
    for (const action of actions) {
        if (action.kind === 'playMinionOnReplacementBase') {
            const player = state.core.players[action.playerId];
            const fromZone = action.fromZone ?? 'deck';
            const sourceCards = fromZone === 'hand' ? player?.hand : player?.deck;
            const sourceCard = sourceCards?.find(card =>
                card.uid === action.cardUid
                && card.defId === action.defId
                && card.type === 'minion',
            );
            if (!player || (!sourceCard && !action.allowImplicitSource)) {
                continue;
            }
            events.push({
                type: SU_EVENT_TYPES.MINION_PLAYED,
                payload: {
                    playerId: action.playerId,
                    cardUid: action.cardUid,
                    defId: action.defId,
                    baseIndex: action.baseIndex,
                    baseDefId: action.targetBaseDefId,
                    power: action.power,
                    ...(fromZone === 'deck' ? { fromDeck: true } : {}),
                    ownerId: action.ownerId ?? sourceCard?.owner ?? action.playerId,
                    ...(action.allowImplicitSource ? { allowImplicitSource: true } : {}),
                    consumesNormalLimit: false,
                },
                timestamp,
            } as MinionPlayedEvent);
            continue;
        }

        if (action.kind === 'playTitanOnReplacementBase') {
            const titan = (state.core.titans ?? []).find(candidate =>
                candidate.uid === action.titanUid
                && candidate.defId === action.defId
                && candidate.location.zone === 'setaside',
            );
            if (!titan || getTitanByController(state.core, action.controllerId)) {
                continue;
            }
            events.push({
                type: SU_EVENT_TYPES.TITAN_PLAYED,
                payload: {
                    titanUid: action.titanUid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    controllerId: action.controllerId,
                    baseIndex: action.baseIndex,
                    baseDefId: action.targetBaseDefId,
                    reason: action.reason,
                },
                timestamp,
            } as TitanPlayedEvent);
            continue;
        }

        events.push(...buildValidatedMoveEvents(state as MatchState<SmashUpCore>, {
            minionUid: action.minionUid,
            minionDefId: action.minionDefId,
            fromBaseIndex: action.fromBaseIndex,
            toBaseIndex: action.toBaseIndex,
            toBaseDefId: action.targetBaseDefId,
            reason: action.reason,
            now: timestamp,
            sourcePlayerId: action.sourcePlayerId,
            sourceDefId: action.sourceDefId,
            sourceControllerId: action.sourceControllerId,
            sourceBaseIndex: action.sourceBaseIndex,
            sourceKind: action.sourceKind,
        }));
    }

    return events;
}
