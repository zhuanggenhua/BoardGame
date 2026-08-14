import type { GameEvent, MatchState, ResolutionBlocker } from '../../../engine/types';
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

/**
 * Legacy/compatibility view of scoring progress.
 *
 * New production code must not persist this as the semantic scoring state.
 * It is derived from `ruleStep + blocker` so older Flow/recovery checks and
 * tests can migrate incrementally.
 */
export type SmashUpScoringStep =
    | 'idle'
    | 'resolving-base'
    | 'awaiting-interactions'
    | 'awaiting-response-window'
    | 'awaiting-post-scoring-delay'
    | 'awaiting-post-reduce';

/** Where the game is in the Smash Up scoring rules. */
export type SmashUpScoringRuleStep =
    | 'select-base'
    | 'before-scoring'
    | 'when-scoring'
    | 'award-vp'
    | 'after-scoring'
    | 'finalize-base'
    | 'complete-base';

/**
 * Why the current semantic rule step cannot advance yet.
 *
 * Interaction/response/child-frame blockers are normally owned by the generic
 * resolution stack. Smash Up persists only its own internal waits
 * (post-scoring reveal delay / post-reduce) plus legacy compatibility input.
 */
export type SmashUpScoringBlocker = ResolutionBlocker;

export const SMASHUP_SCORE_BASES_FRAME_ID = 'smashup:score-bases';
export const SMASHUP_POST_SCORING_REVEAL_DELAY_REASON = 'smashup:post-scoring-reveal-delay';
export const SMASHUP_SCORING_POST_REDUCE_REASON = 'smashup:score-bases-post-reduce';
const SMASHUP_LEGACY_SCORING_BLOCKER_REASON = 'legacy-smashup-scoring-step';

export interface SmashUpScoringSession {
    frameId: string;
    lockedBaseRefs: SmashUpScoringBaseRef[];
    completedBaseRefs: SmashUpScoringBaseRef[];
    currentBaseRef?: SmashUpScoringBaseRef;
    /** Authoritative semantic scoring position. */
    ruleStep: SmashUpScoringRuleStep;
    /** Read model of the current blocker; not a second progression state. */
    blocker?: SmashUpScoringBlocker;
    /** @deprecated Derived compatibility view. */
    currentStep: SmashUpScoringStep;
}

function isScoringRuleStep(value: unknown): value is SmashUpScoringRuleStep {
    return value === 'select-base'
        || value === 'before-scoring'
        || value === 'when-scoring'
        || value === 'award-vp'
        || value === 'after-scoring'
        || value === 'finalize-base'
        || value === 'complete-base';
}

function isPersistedScoringInternalBlocker(
    blocker: SmashUpScoringBlocker | undefined,
): boolean {
    if (!blocker) return false;
    if (blocker.type === 'post-reduce') return true;
    if (
        blocker.type === 'external'
        && blocker.reason === SMASHUP_POST_SCORING_REVEAL_DELAY_REASON
    ) {
        return true;
    }
    return blocker.reason === SMASHUP_LEGACY_SCORING_BLOCKER_REASON;
}

function deriveCompatibilityScoringStep(
    ruleStep: SmashUpScoringRuleStep,
    blocker: SmashUpScoringBlocker | undefined,
): SmashUpScoringStep {
    if (blocker?.type === 'post-reduce') {
        return 'awaiting-post-reduce';
    }
    if (
        blocker?.type === 'external'
        && blocker.reason === SMASHUP_POST_SCORING_REVEAL_DELAY_REASON
    ) {
        return 'awaiting-post-scoring-delay';
    }
    if (blocker?.type === 'interaction') {
        return 'awaiting-interactions';
    }
    if (blocker?.type === 'response-window' || blocker?.type === 'child-frame') {
        return 'awaiting-response-window';
    }
    if (ruleStep === 'select-base' || ruleStep === 'complete-base') {
        return 'idle';
    }
    return 'resolving-base';
}

function progressFromLegacyStep(
    currentStep: SmashUpScoringStep,
    currentBaseRef: SmashUpScoringBaseRef | undefined,
): Pick<SmashUpScoringSession, 'ruleStep' | 'blocker'> {
    switch (currentStep) {
        case 'awaiting-interactions':
            return {
                ruleStep: currentBaseRef ? 'after-scoring' : 'select-base',
                blocker: {
                    type: 'interaction',
                    reason: SMASHUP_LEGACY_SCORING_BLOCKER_REASON,
                },
            };
        case 'awaiting-response-window':
            return {
                ruleStep: currentBaseRef ? 'after-scoring' : 'select-base',
                blocker: {
                    type: 'response-window',
                    reason: SMASHUP_LEGACY_SCORING_BLOCKER_REASON,
                },
            };
        case 'awaiting-post-scoring-delay':
            return {
                ruleStep: 'finalize-base',
                blocker: {
                    type: 'external',
                    reason: SMASHUP_POST_SCORING_REVEAL_DELAY_REASON,
                },
            };
        case 'awaiting-post-reduce':
            return {
                ruleStep: 'complete-base',
                blocker: {
                    type: 'post-reduce',
                    reason: SMASHUP_SCORING_POST_REDUCE_REASON,
                },
            };
        case 'resolving-base':
            return {
                ruleStep: currentBaseRef ? 'before-scoring' : 'select-base',
                blocker: undefined,
            };
        case 'idle':
        default:
            return {
                ruleStep: 'select-base',
                blocker: undefined,
            };
    }
}

function normalizeScoringSessionForWrite(session: SmashUpScoringSession): SmashUpScoringSession {
    const derivedCurrentStep = deriveCompatibilityScoringStep(session.ruleStep, session.blocker);
    if (session.currentStep === derivedCurrentStep) {
        return {
            ...session,
            currentStep: derivedCurrentStep,
        };
    }

    // Transitional compatibility only. Some existing tests/callers still
    // override currentStep directly. Translate that at the write boundary;
    // the resolution frame itself stores the semantic rule step instead.
    const legacyProgress = progressFromLegacyStep(session.currentStep, session.currentBaseRef);
    return {
        ...session,
        ...legacyProgress,
        currentStep: deriveCompatibilityScoringStep(
            legacyProgress.ruleStep,
            legacyProgress.blocker,
        ),
    };
}

export function withScoringSessionProgress(
    session: SmashUpScoringSession,
    ruleStep: SmashUpScoringRuleStep,
    blocker?: SmashUpScoringBlocker,
): SmashUpScoringSession {
    return {
        ...session,
        ruleStep,
        blocker,
        currentStep: deriveCompatibilityScoringStep(ruleStep, blocker),
    };
}

export function createPostScoringRevealDelayBlocker(): SmashUpScoringBlocker {
    return {
        type: 'external',
        reason: SMASHUP_POST_SCORING_REVEAL_DELAY_REASON,
    };
}

export function createScoringPostReduceBlocker(): SmashUpScoringBlocker {
    return {
        type: 'post-reduce',
        reason: SMASHUP_SCORING_POST_REDUCE_REASON,
    };
}

export function isScoringSessionWaitingForPostScoringRevealDelay(
    session: Pick<SmashUpScoringSession, 'ruleStep' | 'blocker'> | undefined,
): boolean {
    return session?.ruleStep === 'finalize-base'
        && session.blocker?.type === 'external'
        && session.blocker.reason === SMASHUP_POST_SCORING_REVEAL_DELAY_REASON;
}

export function isScoringSessionWaitingForPostReduce(
    session: Pick<SmashUpScoringSession, 'ruleStep' | 'blocker'> | undefined,
): boolean {
    return session?.ruleStep === 'complete-base'
        && session.blocker?.type === 'post-reduce'
        && session.blocker.reason === SMASHUP_SCORING_POST_REDUCE_REASON;
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
        scoringBlocker?: SmashUpScoringBlocker;
    };

    const legacyStep = (frame.step as SmashUpScoringStep | undefined) ?? 'idle';
    const legacyProgress = isScoringRuleStep(frame.step)
        ? undefined
        : progressFromLegacyStep(legacyStep, metadata.currentBaseRef);
    const ruleStep = isScoringRuleStep(frame.step)
        ? frame.step
        : legacyProgress?.ruleStep ?? 'select-base';
    const blocker = frame.blockedBy
        ?? metadata.scoringBlocker
        ?? legacyProgress?.blocker;

    return {
        frameId: frame.id,
        lockedBaseRefs: metadata.lockedBaseRefs ?? [],
        completedBaseRefs: metadata.completedBaseRefs ?? [],
        currentBaseRef: metadata.currentBaseRef,
        ruleStep,
        blocker,
        currentStep: deriveCompatibilityScoringStep(ruleStep, blocker),
    };
}

function buildScoringResolutionFrame(session: SmashUpScoringSession) {
    const persistedScoringBlocker = isPersistedScoringInternalBlocker(session.blocker)
        ? session.blocker
        : undefined;
    return {
        id: session.frameId,
        kind: 'smashup:score-bases',
        ownerGame: 'smashup',
        ownerSystem: 'smashup-scoring',
        ownerToken: session.frameId,
        ordering: 'explicit-order' as const,
        status: 'running' as const,
        // `step` is now semantic. Generic interaction/reaction blocking remains
        // in ResolutionFrame.blockedBy and is not mirrored here.
        step: session.ruleStep,
        phase: 'scoreBases',
        phaseGate: 'block-advance-when-blocked' as const,
        metadata: {
            lockedBaseRefs: session.lockedBaseRefs,
            completedBaseRefs: session.completedBaseRefs,
            currentBaseRef: session.currentBaseRef,
            scoringBlocker: persistedScoringBlocker,
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
        ruleStep: 'select-base',
        blocker: undefined,
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

    const normalizedSession = normalizeScoringSessionForWrite(session);
    const existingFrame = getResolutionFrameById(nextState, normalizedSession.frameId);
    nextState = upsertResolutionFrame(nextState, {
        ...(existingFrame ?? {}),
        ...buildScoringResolutionFrame(normalizedSession),
        // Generic resolution-stack ownership remains authoritative for live
        // interaction/response/child-frame blocking.
        status: existingFrame?.status === 'suspended'
            ? 'suspended'
            : (existingFrame?.status ?? 'running'),
        blockedBy: existingFrame?.blockedBy,
        suspendedByFrameId: existingFrame?.suspendedByFrameId,
        deferredEvents: existingFrame?.deferredEvents,
        deferredActions: existingFrame?.deferredActions,
    }, {
        setActive: !nextState.sys.resolution?.activeFrameId || nextState.sys.resolution?.activeFrameId === normalizedSession.frameId,
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

    // Deferred BASE_CLEARED / BASE_REPLACED payload belongs to the scoring
    // transaction from the moment scoreOneBase has prepared post-scoring
    // finalization until finalizeCurrentScoringBase consumes it.
    //
    // A child interaction/reaction may temporarily add and later clear a
    // blocker while the transaction is still in `after-scoring`. Therefore
    // blocker presence is NOT evidence of ownership. The semantic rule step is.
    //
    // Once we reach `complete-base`, finalization must already have consumed
    // the payload; treating that step as an owner would hide a real leak.
    return session.ruleStep === 'after-scoring'
        || session.ruleStep === 'finalize-base';
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
    const selectedBaseAlreadyMovedToDeck = state.core.baseDeck.includes(newBaseDefId);
    const nextDeferredEvents = deferredEvents.flatMap((event) => {
        if (
            selectedBaseAlreadyMovedToDeck
            && event.type === SU_EVENT_TYPES.BASE_DECK_SHUFFLED
            && (event.payload as { reason?: string } | undefined)?.reason === 'base_deck_empty_reshuffle_discard'
        ) {
            changed = true;
            return [];
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
