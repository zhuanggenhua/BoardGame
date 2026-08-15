import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type {
    BaseClearedEvent,
    BaseReplacedEvent,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
    TriggerInstance,
    TriggerQueuedEvent,
} from './types';
import { SU_EVENTS } from './types';
import { collectTriggers } from './ongoingEffects';
import { getEffectivePower, getRealtimeScoringEligibleBaseIndices } from './ongoingModifiers';
import { reduce } from './reducer';
import {
    buildPendingPostScoringActionEvents,
    consumeScoringFrameDeferredPayload,
    createScoringBaseRef,
    getScoringSession,
    isSameScoringBaseRef,
    markScoringBaseCompleted,
    resolveScoringBaseRefSlotIndex,
    type SmashUpScoringBaseRef,
    updateScoringSession,
} from './scoringSession';

export const EARLY_SCORING_CLEANUP_DISCARD_TRIGGER_UIDS_KEY = '_smashupEarlyScoringCleanupDiscardTriggerUids';

function materializeScoringFrameDeferredEvent(
    event: { type: string; payload: unknown; timestamp: number },
): SmashUpEvent {
    if (event.type !== SU_EVENTS.BASE_REPLACED) {
        return {
            type: event.type,
            payload: event.payload,
            timestamp: event.timestamp,
        } as SmashUpEvent;
    }

    const payload = event.payload as BaseReplacedEvent['payload'] | undefined;
    if (!payload || typeof payload.newBaseDefId !== 'string') {
        return {
            type: event.type,
            payload: event.payload,
            timestamp: event.timestamp,
        } as SmashUpEvent;
    }

    // Scoring frame 里的 BASE_REPLACED 已经由 scoreBases 事务选定替换基地。
    // 后处理会为了收集触发多次用前缀状态扫描同一批事件；此时基地牌库可能已经在前一次扫描中被消费。
    // 这里仅标记 scoring-frame materialization 事件，避免重复前缀扫描误报警；正式 reducer 仍会正常消费牌库。
    return {
        type: event.type,
        payload: {
            ...payload,
            allowMissingFromBaseDeck: true,
        },
        timestamp: event.timestamp,
    } as SmashUpEvent;
}

function createReactionQueueFallbackState(core: SmashUpCore): MatchState<SmashUpCore> {
    return {
        core,
        sys: {
            interaction: { current: undefined, queue: [] },
        } as MatchState<SmashUpCore>['sys'],
    };
}

function buildScoringBaseCleanupIdentity(baseRef: SmashUpScoringBaseRef, baseIndex: number, now: number) {
    const baseKey = baseRef.baseInstanceId ?? `${baseIndex}:${baseRef.baseDefId}`;
    const frameId = `onMinionDiscardedFromBase:base-clear-discard:${baseKey}:${now}`;
    return {
        frameId,
        sourceEventIdForMinion: (minionUid: string) => `base-clear-discard:${baseKey}:minion:${minionUid}:${now}`,
    };
}

export function collectScoringBaseDiscardTriggerEvents(args: {
    core: SmashUpCore;
    baseRef: SmashUpScoringBaseRef;
    now: number;
    random: RandomFn;
    matchState?: MatchState<SmashUpCore>;
    triggerFilter?: (trigger: TriggerInstance) => boolean;
}): {
    core: SmashUpCore;
    matchState?: MatchState<SmashUpCore>;
    events: SmashUpEvent[];
} {
    let updatedCore = args.core;
    let ms = args.matchState
        ? { ...args.matchState, core: updatedCore }
        : undefined;
    const events: SmashUpEvent[] = [];
    const baseState = ms ?? createReactionQueueFallbackState(updatedCore);
    const baseIndex = resolveScoringBaseRefSlotIndex(baseState, args.baseRef);
    if (baseIndex === undefined) {
        return { core: updatedCore, matchState: ms, events };
    }

    const scoringBase = updatedCore.bases[baseIndex];
    if (!scoringBase || scoringBase.defId !== args.baseRef.baseDefId) {
        return { core: updatedCore, matchState: ms, events };
    }

    // Only minions still on the scoring base at cleanup time are discarded by BASE_CLEARED.
    const minionsToDiscard: MinionOnBase[] = [...scoringBase.minions];
    const cleanupIdentity = buildScoringBaseCleanupIdentity(args.baseRef, baseIndex, args.now);
    for (const minion of minionsToDiscard) {
        const queued = collectTriggers(updatedCore, 'onMinionDiscardedFromBase', {
            state: updatedCore,
            matchState: ms,
            playerId: minion.controller as PlayerId,
            baseIndex,
            triggerMinionUid: minion.uid,
            triggerMinionDefId: minion.defId,
            triggerMinionPower: getEffectivePower(updatedCore, minion, baseIndex),
            triggerMinion: minion,
            frameId: cleanupIdentity.frameId,
            sourceEventId: cleanupIdentity.sourceEventIdForMinion(minion.uid),
            random: args.random,
            now: args.now,
        });
        if (!queued) {
            continue;
        }

        const queuedTriggers = ((queued as TriggerQueuedEvent).payload?.triggers ?? []);
        const filteredTriggers = args.triggerFilter
            ? queuedTriggers.filter(args.triggerFilter)
            : queuedTriggers;
        if (filteredTriggers.length === 0) {
            continue;
        }
        const filteredQueued = filteredTriggers.length === queuedTriggers.length
            ? queued
            : {
                ...queued,
                payload: {
                    ...(queued as TriggerQueuedEvent).payload,
                    triggers: filteredTriggers,
                },
            };

        events.push(filteredQueued);
        updatedCore = reduce(updatedCore, filteredQueued as unknown as SmashUpEvent);
        if (ms) {
            ms = { ...ms, core: updatedCore };
        }
    }

    return { core: updatedCore, matchState: ms, events };
}

export function isEarlyScoringCleanupSelfRecoveryTrigger(trigger: TriggerInstance): boolean {
    if (trigger.timing !== 'onMinionDiscardedFromBase') {
        return false;
    }
    if (!trigger.triggerMinionUid || trigger.sourceCardUid !== trigger.triggerMinionUid) {
        return false;
    }
    return trigger.sourceDefId === 'time_travelers_jumper'
        || (
            trigger.sourceDefId === 'shapeshifters_copycat'
            && trigger.triggerMinionDefId === 'shapeshifters_copycat'
        );
}

export function finalizeCurrentScoringBase(
    state: MatchState<SmashUpCore>,
    now: number,
    random: RandomFn,
): { updatedState: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const consumedDeferred = consumeScoringFrameDeferredPayload(state);
    const workingState = consumedDeferred.state;
    const session = getScoringSession(workingState);
    const currentBaseRef = session?.currentBaseRef;
    if (!session || !currentBaseRef) {
        return { updatedState: workingState, events: [] };
    }
    const events: SmashUpEvent[] = [];

    const deferredEvents = consumedDeferred.deferredEvents;
    const hydratedDeferredEvents = deferredEvents.map(materializeScoringFrameDeferredEvent);
    events.push(...hydratedDeferredEvents);
    const postDeferredCore = events.reduce(
        (core, event) => reduce(core, event),
        workingState.core,
    );

    events.push(
        ...buildPendingPostScoringActionEvents(
            { core: postDeferredCore },
            consumedDeferred.deferredActions,
            now,
        ),
    );

    let completedState = updateScoringSession(
        markScoringBaseCompleted(workingState, currentBaseRef),
        (currentSession) => currentSession
            ? {
                ...currentSession,
                currentStep: 'awaiting-post-reduce',
            }
            : currentSession,
    );
    const completedSession = getScoringSession(completedState);
    if (completedSession) {
        const liveEligibleRefs = getRealtimeScoringEligibleBaseIndices(postDeferredCore)
            .map((baseIndex) => createScoringBaseRef({ ...postDeferredCore }, baseIndex))
            .filter((baseRef): baseRef is SmashUpScoringBaseRef => !!baseRef)
            .filter((baseRef) => !completedSession.completedBaseRefs.some((completedRef) => isSameScoringBaseRef(completedRef, baseRef)));

        completedState = updateScoringSession(completedState, (currentSession) => currentSession
            ? {
                ...currentSession,
                lockedBaseRefs: liveEligibleRefs,
            }
            : currentSession);
    }
    const awaitingReduceState = {
        ...completedState,
        sys: {
            ...completedState.sys,
            [EARLY_SCORING_CLEANUP_DISCARD_TRIGGER_UIDS_KEY]: undefined,
        } as typeof completedState.sys,
    };

    return {
        updatedState: awaitingReduceState,
        events,
    };
}
