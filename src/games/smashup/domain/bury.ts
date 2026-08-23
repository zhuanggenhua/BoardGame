import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, SmashUpEvent, BuriedCardOnBase, MinionPlayedEvent, OngoingAttachedEvent } from './types';
import { SU_EVENTS } from './types';
import { registerInteractionHandler, type InteractionHandler } from './abilityInteractionHandlers';
import { getBaseDef, getCardDef } from '../data/cards';
import { resolveOnUncover } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import { buildActionPlayedEvent } from './actionPlayEvent';
import { collectTriggers } from './ongoingEffects';
import { buildMinionTargetOptions, buildSemanticOngoingAttachEvents } from './abilityHelpers';
import { appendResolvedActionAbility } from './externalActionPlay';

type UncoverChoiceValue = { cardUid: string; baseIndex: number } | { skip: true };

type BuildBuryCardEventsParams = {
    core: SmashUpCore;
    matchState?: MatchState<SmashUpCore>;
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    baseIndex: number;
    trueOwnerId: PlayerId;
    buriedFrom: 'hand' | 'discard' | 'play' | 'deck';
    reason: string;
    random: RandomFn;
    now: number;
};

type UncoverBuriedCardParams = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    cardUid: string;
    baseIndex: number;
    random: RandomFn;
    now: number;
    reason: string;
};

type ExecuteUncoveredActionParams = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    buried: BuriedCardOnBase;
    baseIndex: number;
    random: RandomFn;
    now: number;
    targetMinionUid?: string;
    targetBaseIndex?: number;
};

type BuildBuriedCardReturnedToHandEventParams = {
    core: SmashUpCore;
    playerId: PlayerId;
    cardUid: string;
    baseIndex: number;
    source: 'sphinx-start-turn' | 'sphinx-after-scoring';
    now: number;
};

export function registerBuryInteractionHandlers(): void {
    registerInteractionHandler('bury_uncover_start_turn', handleUncoverAtStartTurn);
    registerInteractionHandler('bury_uncover_ongoing_target', handleUncoverOngoingPickTargetMinion);
}

export function buildBuryCardEvents(params: BuildBuryCardEventsParams): SmashUpEvent[] {
    if (params.buriedFrom === 'play' && isImmediateReburyOfUncoveredMinion(params)) {
        return [];
    }

    const buriedEvt: SmashUpEvent = {
        type: SU_EVENTS.CARD_BURIED,
        payload: {
            playerId: params.playerId,
            cardUid: params.cardUid,
            defId: params.defId,
            baseIndex: params.baseIndex,
            trueOwnerId: params.trueOwnerId,
            buriedFrom: params.buriedFrom,
            reason: params.reason,
        },
        timestamp: params.now,
    } as any;

    const events: SmashUpEvent[] = [buriedEvt];
    const queued = collectTriggers(params.core, 'onCardBuried', {
        state: params.core,
        matchState: params.matchState,
        playerId: params.playerId,
        baseIndex: params.baseIndex,
        buriedCardUid: params.cardUid,
        buriedCardDefId: params.defId,
        buriedCardControllerId: params.playerId,
        buriedFrom: params.buriedFrom,
        random: params.random,
        now: params.now,
    });
    if (queued) events.push(queued);
    return events;
}

function isImmediateReburyOfUncoveredMinion(params: BuildBuryCardEventsParams): boolean {
    return params.core.bases.some((base) =>
        base.minions.some((minion) =>
            minion.uid === params.cardUid
            && minion.defId === params.defId
            && minion.metadata?.playedFrom === 'buried',
        ),
    );
}

export function buildBuriedCardReturnedToHandEvent(
    params: BuildBuriedCardReturnedToHandEventParams,
): SmashUpEvent | undefined {
    const base = params.core.bases[params.baseIndex];
    const buried = (base?.buriedCards ?? []).find(card => card.uid === params.cardUid);
    if (!base || !buried) return undefined;

    return {
        type: SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND,
        payload: {
            playerId: params.playerId,
            cardUid: buried.uid,
            defId: buried.defId,
            baseIndex: params.baseIndex,
            baseDefId: base.defId,
            source: params.source,
        },
        timestamp: params.now,
    } as SmashUpEvent;
}

export function uncoverBuriedCard(params: UncoverBuriedCardParams): {
    state: MatchState<SmashUpCore>;
    events: SmashUpEvent[];
} {
    const { matchState, playerId, cardUid, baseIndex, random, now, reason } = params;
    const base = matchState.core.bases[baseIndex];
    const buried = (base?.buriedCards ?? []).find(card => card.uid === cardUid);
    if (!base || !buried) return { state: matchState, events: [] };

    const def = getCardDef(buried.defId);
    if (!def) {
        return {
            state: matchState,
            events: [{
                type: SU_EVENTS.BURIED_CARD_UNCOVERED,
                payload: { playerId, cardUid, baseIndex, reason, discardWithoutPlay: true },
                timestamp: now,
            } as SmashUpEvent],
        };
    }

    const uncoverEvent: SmashUpEvent = {
        type: SU_EVENTS.BURIED_CARD_UNCOVERED,
        payload: { playerId, cardUid, baseIndex, reason },
        timestamp: now,
    } as any;
    const uncoverTriggers = collectTriggers(matchState.core, 'onBuriedCardUncovered', {
        state: matchState.core,
        matchState,
        playerId,
        baseIndex,
        buriedCardUid: buried.uid,
        buriedCardDefId: buried.defId,
        buriedCardControllerId: buried.controllerId,
        buriedFrom: buried.buriedFrom,
        random,
        now,
    });

    const onUncoverExecutor = resolveOnUncover(buried.defId);
    if (onUncoverExecutor) {
        const events: SmashUpEvent[] = [{
            type: SU_EVENTS.BURIED_CARD_UNCOVERED,
            payload: { playerId, cardUid, baseIndex, reason, discardWithoutPlay: true },
            timestamp: now,
        } as SmashUpEvent];
        const ctx: AbilityContext = {
            state: matchState.core,
            matchState,
            playerId,
            cardUid,
            defId: buried.defId,
            baseIndex,
            random,
            now,
        };
        const result = onUncoverExecutor(ctx);
        events.push(...result.events);
        if (uncoverTriggers) events.push(uncoverTriggers);
        return { state: result.matchState ?? matchState, events };
    }

    if (def.type === 'minion') {
        const played: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid,
                defId: buried.defId,
                ownerId: buried.trueOwnerId,
                baseIndex,
                baseDefId: base.defId,
                power: (def as any).power ?? 0,
                fromBuried: true,
                consumesNormalLimit: false,
            },
            timestamp: now,
        };
        const events: SmashUpEvent[] = [uncoverEvent, played];
        if (uncoverTriggers) events.push(uncoverTriggers);
        return { state: matchState, events };
    }

    if (def.type === 'action') {
        const executeResult = executeUncoveredAction({
            matchState,
            playerId,
            buried,
            baseIndex,
            random,
            now,
        });
        const uncoveredEvents: SmashUpEvent[] = [{
            type: SU_EVENTS.BURIED_CARD_UNCOVERED,
            payload: {
                playerId,
                cardUid,
                baseIndex,
                reason,
                ...(executeResult.discardWithoutPlay ? { discardWithoutPlay: true } : {}),
            },
            timestamp: now,
        } as SmashUpEvent, ...executeResult.events];
        if (uncoverTriggers) uncoveredEvents.push(uncoverTriggers);
        return { state: executeResult.state, events: uncoveredEvents };
    }

    return { state: matchState, events: [uncoverEvent] };
}

function executeUncoveredAction(params: ExecuteUncoveredActionParams): {
    state: MatchState<SmashUpCore>;
    events: SmashUpEvent[];
    discardWithoutPlay?: boolean;
} {
    const { matchState, playerId, buried, baseIndex, random, now, targetMinionUid, targetBaseIndex } = params;
    const base = matchState.core.bases[baseIndex];
    if (!base) return { state: matchState, events: [], discardWithoutPlay: true };

    const actionDef = getCardDef(buried.defId) as any;
    if (!actionDef || actionDef.type !== 'action') return { state: matchState, events: [], discardWithoutPlay: true };

    const events: SmashUpEvent[] = [];
    const subtype = actionDef.subtype as string;
    const isOngoing = subtype === 'ongoing';

    let resolvedActionTargetMinionUid = targetMinionUid;
    let resolvedActionTargetBaseIndex = targetBaseIndex ?? baseIndex;

    if (isOngoing) {
        const ongoingTarget = actionDef.ongoingTarget ?? 'base';
        if (ongoingTarget === 'base') {
            events.push({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: buried.uid,
                    defId: buried.defId,
                    ownerId: buried.trueOwnerId,
                    ...(buried.trueOwnerId !== playerId ? { sourcePlayerId: playerId } : {}),
                    targetType: 'base',
                    targetBaseIndex: baseIndex,
                },
                timestamp: now,
            } as OngoingAttachedEvent);
        } else {
            const minionCandidates = matchState.core.bases.flatMap((entry, candidateBaseIndex) => {
                const baseName = getBaseDef(entry.defId)?.name ?? `基地 ${candidateBaseIndex + 1}`;
                return entry.minions.map((minion) => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: candidateBaseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseName}`,
                }));
            });
            const options = buildMinionTargetOptions(minionCandidates, {
                state: matchState.core,
                sourcePlayerId: playerId,
                sourceDefId: buried.defId,
            }).map(option => ({ ...option, displayMode: 'card' as const }));
            if (!targetMinionUid && options.length === 0) {
                return { state: matchState, events: [], discardWithoutPlay: true };
            }
            if (!targetMinionUid && options.length > 0) {
                const interaction = createSimpleChoice(
                    `bury_uncover_ongoing_target_${now}`,
                    playerId,
                    '选择要附着的随从',
                    options as any[],
                    {
                        sourceId: 'bury_uncover_ongoing_target',
                        targetType: 'minion',
                        titleKey: 'ui.bury_uncover_ongoing_target_title',
                        autoResolveIfSingle: false,
                    },
                );
                (interaction.data as any).continuationContext = { cardUid: buried.uid, defId: buried.defId, baseIndex };
                return { state: queueInteraction(matchState, interaction), events };
            }

            const resolvedTarget = targetMinionUid
                ? {
                    targetMinionUid,
                    targetBaseIndex: targetBaseIndex
                        ?? matchState.core.bases.findIndex(entry => entry.minions.some(minion => minion.uid === targetMinionUid)),
                }
                : undefined;
            if (!resolvedTarget || resolvedTarget.targetBaseIndex === undefined || resolvedTarget.targetBaseIndex < 0) {
                return { state: matchState, events: [], discardWithoutPlay: true };
            }
            resolvedActionTargetMinionUid = resolvedTarget.targetMinionUid;
            resolvedActionTargetBaseIndex = resolvedTarget.targetBaseIndex;
            events.push(...buildSemanticOngoingAttachEvents(matchState, {
                cardUid: buried.uid,
                defId: buried.defId,
                ownerId: buried.trueOwnerId,
                ...(buried.trueOwnerId !== playerId ? { sourcePlayerId: playerId } : {}),
                targetBaseIndex: resolvedActionTargetBaseIndex,
                targetMinionUid: resolvedActionTargetMinionUid,
                onBlockedSourceDestination: 'discard',
                now,
            }));
        }
    }

    events.unshift(buildActionPlayedEvent({
        playerId,
        cardUid: buried.uid,
        defId: buried.defId,
        ownerId: buried.trueOwnerId,
        isExtraAction: true,
        fromBuried: true,
        targetBaseIndex: isOngoing ? resolvedActionTargetBaseIndex : targetBaseIndex,
        targetMinionUid: isOngoing ? resolvedActionTargetMinionUid : targetMinionUid,
        timestamp: now,
        }));

    return appendResolvedActionAbility({
        state: matchState,
        events,
        playerId,
        cardUid: buried.uid,
        defId: buried.defId,
        random,
        timestamp: now,
        baseIndex: resolvedActionTargetBaseIndex,
        targetBaseIndex: isOngoing ? resolvedActionTargetBaseIndex : targetBaseIndex,
        targetMinionUid: isOngoing ? resolvedActionTargetMinionUid : targetMinionUid,
        fromBuried: true,
        abilityRequirementContext: 'bury.executeUncoveredAction',
    });
}

function isStandardActionTimingAllowed(matchState: MatchState<SmashUpCore>): boolean {
    const startTurnWindowActive = matchState.sys.phase === 'startTurn'
        || Boolean((matchState.sys as any)._smashupStartTurnWindowActive);
    return startTurnWindowActive || matchState.sys.phase === 'playCards';
}

const handleUncoverAtStartTurn: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const resolved = value as UncoverChoiceValue;
    if ((resolved as any)?.skip) return { state, events: [] };
    return uncoverBuriedCard({
        matchState: state,
        playerId,
        cardUid: (resolved as any).cardUid,
        baseIndex: (resolved as any).baseIndex,
        random,
        now,
        reason: 'bury_uncover_start_turn',
    });
};

const handleUncoverOngoingPickTargetMinion: InteractionHandler = (state, playerId, value, data, random, now) => {
    const ctx = data?.continuationContext as { cardUid: string; defId: string; baseIndex: number } | undefined;
    if (!ctx) return { state, events: [] };
    const targetMinionUid = ((value as any)?.targetMinionUid ?? (value as any)?.minionUid) as string | undefined;
    const targetBaseIndex = (value as any)?.baseIndex as number | undefined ?? ctx.baseIndex;
    if (!targetMinionUid || targetBaseIndex === undefined) return { state, events: [] };

    const buried = (state.core.bases[ctx.baseIndex]?.buriedCards ?? []).find(card => card.uid === ctx.cardUid);
    if (!buried) return { state, events: [] };

    const events: SmashUpEvent[] = [
        buildActionPlayedEvent({
            playerId,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            ownerId: buried.trueOwnerId,
            isExtraAction: true,
            fromBuried: true,
            targetBaseIndex,
            targetMinionUid,
            timestamp: now,
        }),
        ...buildSemanticOngoingAttachEvents(state, {
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            ownerId: buried.trueOwnerId,
            ...(buried.trueOwnerId !== playerId ? { sourcePlayerId: playerId } : {}),
            targetBaseIndex,
            targetMinionUid,
            onBlockedSourceDestination: 'discard',
            now,
        }),
    ];

    return appendResolvedActionAbility({
        state,
        events,
        playerId,
        cardUid: ctx.cardUid,
        defId: ctx.defId,
        random,
        timestamp: now,
        baseIndex: targetBaseIndex,
        targetBaseIndex,
        targetMinionUid,
        fromBuried: true,
    });
};


