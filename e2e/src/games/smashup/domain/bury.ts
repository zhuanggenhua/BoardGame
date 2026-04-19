import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, SmashUpEvent, BuriedCardOnBase, MinionPlayedEvent, OngoingAttachedEvent } from './types';
import { SU_EVENTS } from './types';
import { registerInteractionHandler, type InteractionHandler } from './abilityInteractionHandlers';
import { getBaseDef, getCardDef } from '../data/cards';
import { resolveOnPlay, resolveOnUncover, resolveSpecial } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import { buildActionPlayedEvent } from './actionPlayEvent';
import { collectTriggers } from './ongoingEffects';
import { buildMinionTargetOptions } from './abilityHelpers';
import { triggerBaseAbility } from './baseAbilities';

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

    const playedEvt: ActionPlayedEvent = {
        type: SU_EVENTS.ACTION_PLAYED,
        payload: { playerId, cardUid: buried.uid, defId: buried.defId, isExtraAction: true, fromBuried: true },
        timestamp: now,
    };

    const events: SmashUpEvent[] = [playedEvt];
    let currentState = matchState;
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
                    ownerId: playerId,
                    targetType: 'base',
                    targetBaseIndex: baseIndex,
                },
                timestamp: now,
            } as OngoingAttachedEvent);
        } else {
            const minionCandidates = currentState.core.bases.flatMap((entry, candidateBaseIndex) => {
                const baseName = getBaseDef(entry.defId)?.name ?? `基地 ${candidateBaseIndex + 1}`;
                return entry.minions.map((minion) => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: candidateBaseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseName}`,
                }));
            });
            const options = buildMinionTargetOptions(minionCandidates, {
                state: currentState.core,
                sourcePlayerId: playerId,
                sourceDefId: buried.defId,
            }).map(option => ({ ...option, displayMode: 'card' as const }));
            if (!targetMinionUid && options.length === 0) {
                return { state: currentState, events: [], discardWithoutPlay: true };
            }
            if (!targetMinionUid && options.length > 1) {
                const interaction = createSimpleChoice(
                    `bury_uncover_ongoing_target_${now}`,
                    playerId,
                    '选择要附着的随从',
                    options as any[],
                    { sourceId: 'bury_uncover_ongoing_target', targetType: 'minion' },
                );
                (interaction.data as any).continuationContext = { cardUid: buried.uid, defId: buried.defId, baseIndex };
                return { state: queueInteraction(currentState, interaction), events };
            }

            const resolvedTarget = targetMinionUid
                ? {
                    targetMinionUid,
                    targetBaseIndex: targetBaseIndex
                        ?? currentState.core.bases.findIndex(entry => entry.minions.some(minion => minion.uid === targetMinionUid)),
                }
                : (() => {
                    const singleValue = options[0]?.value as { minionUid?: string; baseIndex?: number } | undefined;
                    if (!singleValue?.minionUid || singleValue.baseIndex === undefined) return undefined;
                    return {
                        targetMinionUid: singleValue.minionUid,
                        targetBaseIndex: singleValue.baseIndex,
                    };
                })();
            if (!resolvedTarget || resolvedTarget.targetBaseIndex === undefined || resolvedTarget.targetBaseIndex < 0) {
                return { state: currentState, events: [], discardWithoutPlay: true };
            }
            resolvedActionTargetMinionUid = resolvedTarget.targetMinionUid;
            resolvedActionTargetBaseIndex = resolvedTarget.targetBaseIndex;
            events.push({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: buried.uid,
                    defId: buried.defId,
                    ownerId: playerId,
                    targetType: 'minion',
                    targetBaseIndex: resolvedActionTargetBaseIndex,
                    targetMinionUid: resolvedActionTargetMinionUid,
                },
                timestamp: now,
            } as OngoingAttachedEvent);
        }
    }

    const executor = subtype === 'special'
        ? (resolveSpecial(buried.defId) ?? resolveOnPlay(buried.defId))
        : resolveOnPlay(buried.defId);
    if (executor) {
        const ctx: AbilityContext = {
            state: currentState.core,
            matchState: currentState,
            playerId,
            cardUid: buried.uid,
            defId: buried.defId,
            baseIndex: resolvedActionTargetBaseIndex,
            targetMinionUid: resolvedActionTargetMinionUid,
            random,
            now,
        };
        const result = executor(ctx);
        events.push(...result.events);
        if (result.matchState) currentState = result.matchState;
    }

    const resolvedBase = currentState.core.bases[resolvedActionTargetBaseIndex] ?? base;
    const baseAbilityResult = triggerBaseAbility(resolvedBase.defId, 'onActionPlayed', {
        state: currentState.core,
        matchState: currentState,
        random,
        baseIndex: resolvedActionTargetBaseIndex,
        baseDefId: resolvedBase.defId,
        playerId,
        actionTargetBaseIndex: resolvedActionTargetBaseIndex,
        actionTargetType: resolvedActionTargetMinionUid ? 'minion' : 'base',
        actionTargetMinionUid: resolvedActionTargetMinionUid,
        now,
    });
    events.push(...baseAbilityResult.events);
    if (baseAbilityResult.matchState) currentState = baseAbilityResult.matchState;

    return { state: currentState, events };
}

function isSpecialTimingAllowed(
    matchState: MatchState<SmashUpCore>,
    specialTiming: 'beforeScoring' | 'afterScoring',
): boolean {
    const windowType = matchState.sys.responseWindow?.current?.windowType;
    if (specialTiming === 'beforeScoring') {
        return windowType === 'meFirst' || matchState.sys.phase === 'scoreBases';
    }
    return windowType === 'afterScoring';
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
    const targetMinionUid = (value as any)?.targetMinionUid as string | undefined;
    const targetBaseIndex = (value as any)?.baseIndex as number | undefined ?? ctx.baseIndex;
    if (!targetMinionUid || targetBaseIndex === undefined) return { state, events: [] };

    const buried = (state.core.bases[ctx.baseIndex]?.buriedCards ?? []).find(card => card.uid === ctx.cardUid);
    if (!buried) return { state, events: [] };

    const attach: OngoingAttachedEvent = {
        type: SU_EVENTS.ONGOING_ATTACHED,
        payload: {
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            ownerId: playerId,
            targetType: 'minion',
            targetBaseIndex,
            targetMinionUid,
        },
        timestamp: now,
    } as any;

    const events: SmashUpEvent[] = [
        buildActionPlayedEvent({
            playerId,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            isExtraAction: true,
            fromBuried: true,
            targetBaseIndex,
            targetMinionUid,
            timestamp: now,
        }),
        attach,
    ];

    let currentState = state;
    const executor = resolveOnPlay(ctx.defId);
    if (executor) {
        const abilityCtx: AbilityContext = {
            state: currentState.core,
            matchState: currentState,
            playerId,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            baseIndex: targetBaseIndex,
            targetMinionUid,
            random,
            now,
        };
        const result = executor(abilityCtx);
        events.push(...result.events);
        if (result.matchState) {
            currentState = result.matchState;
        }
    }

    const resolvedBase = currentState.core.bases[targetBaseIndex] ?? currentState.core.bases[ctx.baseIndex];
    if (resolvedBase) {
        const baseAbilityResult = triggerBaseAbility(resolvedBase.defId, 'onActionPlayed', {
            state: currentState.core,
            matchState: currentState,
            random,
            baseIndex: targetBaseIndex,
            baseDefId: resolvedBase.defId,
            playerId,
            actionTargetBaseIndex: targetBaseIndex,
            actionTargetType: 'minion',
            actionTargetMinionUid: targetMinionUid,
            now,
        });
        events.push(...baseAbilityResult.events);
        if (baseAbilityResult.matchState) {
            return { state: baseAbilityResult.matchState, events };
        }
    }

    return { state: currentState, events };
};


