import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerTrigger, type TriggerContext, type TriggerResult } from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { createEffectProgram, executeAbilityProgram } from '../domain/abilityRuntime';
import {
    addPowerCounter,
    addTempPower,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    emitSpecialLimitUsed,
    findMinionByAttachedCard,
    findMinionOnBases,
    grantExtraAction,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import type { CardInstance, CardsDrawnEvent, MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type LocatedMinion = { minion: MinionOnBase; baseIndex: number };
type GoblinAfterCoinEffect =
    | { kind: 'chaos_lord'; sourceCardUid: string; sourceBaseIndex: number }
    | { kind: 'diviner_draw'; sourceCardUid: string; sourceBaseIndex: number }
    | { kind: 'recruiters'; sourceCardUid: string; sourceBaseIndex: number };
type GoblinCoinStage = 'start' | 'after-change' | 'after-effects' | 'post-coin';
type GoblinCoinPurpose =
    | { kind: 'a_little_help' }
    | { kind: 'blaster'; sourceCardUid: string; targetBaseIndex?: number }
    | { kind: 'bushwhacking'; sourceCardUid: string; sourceDefId: string; sourceBaseIndex: number; targetMinionUid?: string; targetBaseIndex?: number }
    | { kind: 'goblin_town'; minionUid: string; baseIndex: number }
    | { kind: 'magic_helmet'; sourceCardUid: string; sourceControllerId: PlayerId; sourceBaseIndex: number }
    | { kind: 'gobbo'; targetMinionUid: string; remainingFlips: number; headsCount: number }
    | { kind: 'demolition'; sourceCardUid: string; sourceDefId: string; sourceBaseIndex: number; remainingFlips: number; targetMinionUid?: string; targetBaseIndex?: number }
    | { kind: 'he_who_smelt_it'; flipIndex: number; targetMinionUid?: string }
    | { kind: 'revving_up'; minionUids: string[]; baseIndex: number; index: number }
    | { kind: 'goblin_caves'; playerIds: PlayerId[]; baseIndex: number; index: number };
type GoblinCoinProgramContext = {
    matchState?: MatchState<SmashUpCore>;
    random?: RandomFn;
    playerId: PlayerId;
    now: number;
    reason: string;
    preferredResult?: CoinPreference;
    stage?: GoblinCoinStage;
    heads?: boolean;
    initialEvents?: SmashUpEvent[];
    afterEffects?: GoblinAfterCoinEffect[];
    purpose: GoblinCoinPurpose;
};

const CHAOS_LORD = 'goblins_chaos_lord';
const DIVINER = 'goblins_diviner';
const BLASTER = 'goblins_blaster';
const GOBBO = 'goblins_gobbo';
const MAGIC_HELMET = 'goblins_magic_helmet';
const RECRUITERS = 'goblins_recruiters';
const MAKE_YOUR_OWN_LUCK = 'goblins_make_your_own_luck';

type CoinPreference = 'heads' | 'tails' | undefined;

function flip(random: AbilityContext['random'] | BaseAbilityContext['random'] | TriggerContext['random']): boolean {
    return (random?.random?.() ?? 0.5) >= 0.5;
}

function allMinions(state: SmashUpCore, predicate: (minion: MinionOnBase, baseIndex: number) => boolean): LocatedMinion[] {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => predicate(minion, baseIndex))
            .map(minion => ({ minion, baseIndex })),
    );
}

function firstOwnMinion(state: SmashUpCore, playerId: PlayerId, baseIndex?: number): LocatedMinion | undefined {
    return allMinions(state, (minion, index) =>
        minion.controller === playerId && (baseIndex === undefined || index === baseIndex),
    )[0];
}

function firstOtherBaseIndex(state: SmashUpCore, fromBaseIndex: number): number | undefined {
    const index = state.bases.findIndex((_, candidateIndex) => candidateIndex !== fromBaseIndex);
    return index >= 0 ? index : undefined;
}

function discardFirstHandCards(state: SmashUpCore, playerId: PlayerId, count: number, now: number): SmashUpEvent[] {
    const cards = state.players[playerId]?.hand.slice(0, count) ?? [];
    if (cards.length === 0) return [];
    return [{
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids: cards.map(card => card.uid) },
        timestamp: now,
    } as SmashUpEvent];
}

function drawThenDiscard(state: SmashUpCore, playerId: PlayerId, count: number, random: AbilityContext['random'], now: number): SmashUpEvent[] {
    const drawEvents = buildStandardDrawEvents(state, playerId, count, random, now);
    const existingHandUids = state.players[playerId]?.hand.map(card => card.uid) ?? [];
    const drawnUids = drawEvents.flatMap(event =>
        event.type === SU_EVENTS.CARDS_DRAWN ? (event as CardsDrawnEvent).payload.cardUids : [],
    );
    const discardUids = [...existingHandUids, ...drawnUids].slice(0, count);
    if (discardUids.length === 0) return drawEvents;
    return [
        ...drawEvents,
        {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: discardUids },
            timestamp: now,
        } as SmashUpEvent,
    ];
}

function actionPlayedFromHand(card: CardInstance, playerId: PlayerId, now: number): SmashUpEvent {
    return buildActionPlayedEvent({
        playerId,
        cardUid: card.uid,
        defId: card.defId,
        ownerId: card.owner,
        isExtraAction: true,
        consumesNormalLimit: false,
        timestamp: now,
    });
}

function shuffleDiscardCardIntoDeck(
    state: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    random: AbilityContext['random'] | BaseAbilityContext['random'] | TriggerContext['random'],
    reason: string,
    now: number,
): SmashUpEvent {
    const deckUids = state.players[playerId]?.deck.map(deckCard => deckCard.uid) ?? [];
    const insertion = Math.floor((random?.random?.() ?? 0.5) * (deckUids.length + 1));
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: [
                ...deckUids.slice(0, insertion),
                card.uid,
                ...deckUids.slice(insertion),
            ],
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function markDivinerChangeUsed(source: LocatedMinion, turnNumber: number, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
            minionUid: source.minion.uid,
            baseIndex: source.baseIndex,
            metadataUpdate: { goblinsDivinerChangeTurn: turnNumber },
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function requireGoblinMatchState(context: GoblinCoinProgramContext): MatchState<SmashUpCore> {
    if (!context.matchState) {
        throw new Error('goblins coin continuation 缺少正式 matchState');
    }
    return context.matchState;
}

function requireGoblinRandom(context: GoblinCoinProgramContext): RandomFn {
    if (!context.random) {
        throw new Error('goblins coin continuation 缺少随机源');
    }
    return context.random;
}

function continueGoblinCoin(
    context: GoblinCoinProgramContext,
    events: SmashUpEvent[],
    nextContext?: GoblinCoinProgramContext,
) {
    return {
        events,
        ...(nextContext ? { context: nextContext, nextProgram: goblinCoinProgram } : {}),
    };
}

function buildCoinResultChangeEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    heads: boolean,
    now: number,
    reason: string,
    preferredResult?: CoinPreference,
): { heads: boolean; events: SmashUpEvent[] } {
    if (preferredResult === undefined) return { heads, events: [] };
    const preferredHeads = preferredResult === 'heads';
    if (heads === preferredHeads) return { heads, events: [] };

    const events: SmashUpEvent[] = [];
    const luckCard = state.players[playerId]?.hand.find(card => card.defId === MAKE_YOUR_OWN_LUCK);
    if (luckCard) {
        const play = actionPlayedFromHand(luckCard, playerId, now);
        events.push(play, {
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId,
                messageKey: 'feedback.goblins_make_your_own_luck_changed',
                level: 'info',
                metadata: { from: heads ? 'heads' : 'tails', to: preferredResult, reason },
            },
            timestamp: now,
        } as SmashUpEvent);
        return { heads: preferredHeads, events };
    }

    const diviner = allMinions(state, minion => minion.defId === DIVINER && minion.controller === playerId)
        .find(source => source.minion.metadata?.goblinsDivinerChangeTurn !== state.turnNumber);
    const discardCard = state.players[playerId]?.hand[0];
    if (diviner && discardCard) {
        const discard = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [discardCard.uid] },
            timestamp: now,
        } as SmashUpEvent;
        const mark = markDivinerChangeUsed(diviner, state.turnNumber, reason + '_diviner_change', now);
        events.push(discard, mark);
        return { heads: preferredHeads, events };
    }

    return { heads, events };
}

function buildAfterOwnCoinFlipQueue(
    state: SmashUpCore,
    playerId: PlayerId,
): GoblinAfterCoinEffect[] {
    const effects: GoblinAfterCoinEffect[] = [];
    for (const source of allMinions(state, minion => minion.defId === CHAOS_LORD && minion.controller === playerId)) {
        effects.push({ kind: 'chaos_lord', sourceCardUid: source.minion.uid, sourceBaseIndex: source.baseIndex });
    }
    for (const source of allMinions(state, minion => minion.defId === DIVINER && minion.controller === playerId)) {
        if (source.minion.metadata?.goblinsDivinerDrawTurn === state.turnNumber) continue;
        effects.push({ kind: 'diviner_draw', sourceCardUid: source.minion.uid, sourceBaseIndex: source.baseIndex });
    }
    for (const [baseIndex, base] of state.bases.entries()) {
        for (const action of base.ongoingActions) {
            if (action.defId !== RECRUITERS || action.ownerId !== playerId) continue;
            effects.push({ kind: 'recruiters', sourceCardUid: action.uid, sourceBaseIndex: baseIndex });
        }
    }
    return effects;
}

function buildAfterOwnCoinFlipEffectEvents(
    state: SmashUpCore,
    effect: GoblinAfterCoinEffect,
    playerId: PlayerId,
    heads: boolean,
    random: RandomFn,
    now: number,
    reason: string,
): SmashUpEvent[] {
    switch (effect.kind) {
        case 'chaos_lord': {
            if (!state.bases[effect.sourceBaseIndex]?.minions.some(minion => minion.uid === effect.sourceCardUid && minion.defId === CHAOS_LORD)) return [];
            if (heads) {
                const target = firstOwnMinion(state, playerId);
                return target ? [addPowerCounter(target.minion.uid, target.baseIndex, 1, reason + '_chaos_lord', now)] : [];
            }
            return drawThenDiscard(state, playerId, 1, random, now);
        }
        case 'diviner_draw': {
            const source = state.bases[effect.sourceBaseIndex]?.minions.find(minion => minion.uid === effect.sourceCardUid && minion.defId === DIVINER);
            if (!source || source.metadata?.goblinsDivinerDrawTurn === state.turnNumber) return [];
            return [
                ...buildStandardDrawEvents(state, playerId, 1, random, now),
                {
                    type: SU_EVENTS.MINION_METADATA_UPDATED,
                    payload: {
                        minionUid: source.uid,
                        baseIndex: effect.sourceBaseIndex,
                        metadataUpdate: { goblinsDivinerDrawTurn: state.turnNumber },
                        reason: reason + '_diviner_first_coin',
                    },
                    timestamp: now,
                } as SmashUpEvent,
            ];
        }
        case 'recruiters': {
            const active = state.bases[effect.sourceBaseIndex]?.ongoingActions.some(action => action.uid === effect.sourceCardUid && action.defId === RECRUITERS && action.ownerId === playerId);
            if (!active) return [];
            if (heads) return buildStandardDrawEvents(state, playerId, 1, random, now);
            const discardCard = state.players[playerId]?.discard[0];
            return discardCard ? [shuffleDiscardCardIntoDeck(state, playerId, discardCard, random, reason + '_goblin_recruiters', now)] : [];
        }
        default:
            return [];
    }
}

function executeGoblinPostCoinPurpose(context: GoblinCoinProgramContext, state: SmashUpCore): ReturnType<typeof continueGoblinCoin> {
    const heads = context.heads === true;
    const purpose = context.purpose;
    switch (purpose.kind) {
        case 'a_little_help':
            return continueGoblinCoin(context, [
                heads
                    ? grantExtraMinion(context.playerId, 'goblins_a_little_help_heads', context.now)
                    : grantExtraAction(context.playerId, 'goblins_a_little_help_tails', context.now),
                ...(heads ? [] : [grantExtraAction(context.playerId, 'goblins_a_little_help_tails_second', context.now)]),
            ]);
        case 'blaster': {
            const source = findMinionOnBases(state, purpose.sourceCardUid);
            if (!source) return continueGoblinCoin(context, []);
            if (heads) {
                return continueGoblinCoin(context, [addTempPower(source.minion.uid, source.baseIndex, 2, 'goblins_blaster_heads', context.now, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: BLASTER,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: source.baseIndex,
                })]);
            }
            const toBaseIndex = purpose.targetBaseIndex !== undefined && purpose.targetBaseIndex !== source.baseIndex && state.bases[purpose.targetBaseIndex]
                ? purpose.targetBaseIndex
                : firstOtherBaseIndex(state, source.baseIndex);
            return continueGoblinCoin(context, toBaseIndex === undefined ? [] : buildValidatedMoveEvents(state, {
                minionUid: source.minion.uid,
                minionDefId: source.minion.defId,
                fromBaseIndex: source.baseIndex,
                toBaseIndex,
                reason: 'goblins_blaster_tails',
                now: context.now,
                sourcePlayerId: context.playerId,
                sourceDefId: BLASTER,
                sourceControllerId: context.playerId,
                sourceBaseIndex: source.baseIndex,
                sourceKind: 'nonAction',
            }));
        }
        case 'bushwhacking': {
            const target = findMinionOnBases(state, purpose.targetMinionUid ?? '');
            if (!target) return continueGoblinCoin(context, []);
            if (heads) {
                return continueGoblinCoin(context, buildValidatedDestroyEvents(state, {
                    minionUid: target.minion.uid,
                    minionDefId: target.minion.defId,
                    fromBaseIndex: target.baseIndex,
                    destroyerId: context.playerId,
                    reason: 'goblins_bushwhacking_heads',
                    now: context.now,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: purpose.sourceCardUid,
                    sourceDefId: purpose.sourceDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: purpose.sourceBaseIndex,
                    sourceKind: 'action',
                }));
            }
            const toBaseIndex = purpose.targetBaseIndex !== undefined && purpose.targetBaseIndex !== target.baseIndex && state.bases[purpose.targetBaseIndex]
                ? purpose.targetBaseIndex
                : firstOtherBaseIndex(state, target.baseIndex);
            return continueGoblinCoin(context, toBaseIndex === undefined ? [] : buildValidatedMoveEvents(state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                toBaseIndex,
                reason: 'goblins_bushwhacking_tails',
                now: context.now,
                sourcePlayerId: context.playerId,
                sourceCardUid: purpose.sourceCardUid,
                sourceDefId: purpose.sourceDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: purpose.sourceBaseIndex,
                sourceKind: 'action',
            }));
        }
        case 'goblin_town': {
            const minion = findMinionOnBases(state, purpose.minionUid);
            return continueGoblinCoin(context, heads && minion
                ? [addPowerCounter(minion.minion.uid, minion.baseIndex, 1, 'base_goblin_town_heads', context.now)]
                : []);
        }
        case 'magic_helmet':
            return continueGoblinCoin(context, heads ? [] : buildValidatedOngoingDetachEvents(state, {
                cardUid: purpose.sourceCardUid,
                reason: 'goblins_magic_helmet_tails',
                now: context.now,
                expectedLocation: 'minion',
                sourcePlayerId: purpose.sourceControllerId,
                sourceDefId: MAGIC_HELMET,
                sourceControllerId: purpose.sourceControllerId,
                sourceBaseIndex: purpose.sourceBaseIndex,
            }));
        case 'gobbo': {
            const headsCount = purpose.headsCount + (heads ? 1 : 0);
            if (purpose.remainingFlips > 1) {
                return continueGoblinCoin(context, [], {
                    ...context,
                    stage: 'start',
                    heads: undefined,
                    afterEffects: undefined,
                    purpose: { ...purpose, remainingFlips: purpose.remainingFlips - 1, headsCount },
                });
            }
            const target = findMinionOnBases(state, purpose.targetMinionUid);
            return continueGoblinCoin(context, headsCount > 0 && target
                ? [addPowerCounter(target.minion.uid, target.baseIndex, headsCount, 'goblins_gobbo', context.now)]
                : []);
        }
        case 'demolition': {
            const events = (() => {
                if (heads) {
                    const explicitTarget = purpose.targetMinionUid ? findMinionOnBases(state, purpose.targetMinionUid) : undefined;
                    const target = explicitTarget?.minion.controller === context.playerId ? explicitTarget : firstOwnMinion(state, context.playerId);
                    return target ? [addPowerCounter(target.minion.uid, target.baseIndex, 1, 'goblins_demolition_heads', context.now)] : [];
                }
                const target = firstOngoingAction(state, purpose.targetBaseIndex);
                return target ? buildValidatedOngoingDetachEvents(state, {
                    cardUid: target.uid,
                    reason: 'goblins_demolition_tails',
                    now: context.now,
                    expectedLocation: 'any',
                    sourcePlayerId: context.playerId,
                    sourceCardUid: purpose.sourceCardUid,
                    sourceDefId: purpose.sourceDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: purpose.sourceBaseIndex,
                }) : [];
            })();
            return continueGoblinCoin(context, events, purpose.remainingFlips > 1 ? {
                ...context,
                stage: 'start',
                heads: undefined,
                afterEffects: undefined,
                purpose: { ...purpose, remainingFlips: purpose.remainingFlips - 1 },
            } : undefined);
        }
        case 'he_who_smelt_it':
            if (!heads) {
                return continueGoblinCoin(context, [grantExtraAction(context.playerId, 'goblins_he_who_smelt_it_tails', context.now)]);
            }
            if (purpose.flipIndex >= 50) return continueGoblinCoin(context, []);
            {
                const targets = allMinions(state, () => true);
                const target = (purpose.targetMinionUid
                    ? targets.find(candidate => candidate.minion.uid === purpose.targetMinionUid)
                    : targets[purpose.flipIndex % targets.length]) ?? targets[0];
                if (!target) return continueGoblinCoin(context, []);
                return continueGoblinCoin(context, [addPowerCounter(target.minion.uid, target.baseIndex, 1, 'goblins_he_who_smelt_it_heads', context.now)], {
                    ...context,
                    stage: 'start',
                    heads: undefined,
                    afterEffects: undefined,
                    purpose: { ...purpose, flipIndex: purpose.flipIndex + 1 },
                });
            }
        case 'revving_up': {
            const minionUid = purpose.minionUids[purpose.index];
            const events = minionUid
                ? [heads
                    ? addPowerCounter(minionUid, purpose.baseIndex, 1, 'goblins_revving_up_heads', context.now)
                    : addTempPower(minionUid, purpose.baseIndex, 2, 'goblins_revving_up_tails', context.now)]
                : [];
            return continueGoblinCoin(context, events, purpose.index + 1 < purpose.minionUids.length ? {
                ...context,
                stage: 'start',
                heads: undefined,
                afterEffects: undefined,
                purpose: { ...purpose, index: purpose.index + 1 },
            } : undefined);
        }
        case 'goblin_caves': {
            const playerId = purpose.playerIds[purpose.index];
            const events = !playerId
                ? []
                : heads
                ? [{
                    type: SU_EVENTS.VP_AWARDED,
                    payload: { playerId, amount: 1, reason: 'base_goblin_caves_heads' },
                    timestamp: context.now,
                } as SmashUpEvent]
                : discardFirstHandCards(state, playerId, 2, context.now);
            return continueGoblinCoin(context, events, purpose.index + 1 < purpose.playerIds.length ? {
                ...context,
                stage: 'start',
                playerId: purpose.playerIds[purpose.index + 1],
                heads: undefined,
                afterEffects: undefined,
                purpose: { ...purpose, index: purpose.index + 1 },
            } : undefined);
        }
        default:
            return continueGoblinCoin(context, []);
    }
}

const goblinCoinProgram = createEffectProgram<
    GoblinCoinProgramContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    const matchState = requireGoblinMatchState(context);
    const random = requireGoblinRandom(context);
    const stage = context.stage ?? 'start';
    if (stage === 'start') {
        if (context.initialEvents && context.initialEvents.length > 0) {
            return continueGoblinCoin(context, context.initialEvents, {
                ...context,
                initialEvents: undefined,
            });
        }
        const rawHeads = flip(random);
        const changed = buildCoinResultChangeEvents(matchState.core, context.playerId, rawHeads, context.now, context.reason, context.preferredResult);
        return continueGoblinCoin(context, changed.events, {
            ...context,
            stage: 'after-change',
            heads: changed.heads,
            initialEvents: undefined,
        });
    }
    if (stage === 'after-change') {
        return continueGoblinCoin(context, [], {
            ...context,
            stage: 'after-effects',
            afterEffects: buildAfterOwnCoinFlipQueue(matchState.core, context.playerId),
        });
    }
    if (stage === 'after-effects') {
        const [effect, ...remainingEffects] = context.afterEffects ?? [];
        if (!effect) {
            return continueGoblinCoin(context, [], { ...context, stage: 'post-coin' });
        }
        return continueGoblinCoin(
            context,
            buildAfterOwnCoinFlipEffectEvents(matchState.core, effect, context.playerId, context.heads === true, random, context.now, context.reason),
            {
                ...context,
                afterEffects: remainingEffects,
            },
        );
    }
    return executeGoblinPostCoinPurpose(context, matchState.core);
});

function runGoblinCoin(context: GoblinCoinProgramContext): AbilityResult {
    const result = executeAbilityProgram(goblinCoinProgram, context);
    return {
        events: result.events as SmashUpEvent[],
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function gobboOnPlay(ctx: AbilityContext): AbilityResult {
    const target = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!target) return { events: [] };
    const gobboCount = allMinions(ctx.state, minion => minion.defId === GOBBO).length;
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_gobbo',
        preferredResult: 'heads',
        purpose: { kind: 'gobbo', targetMinionUid: target.minion.uid, remainingFlips: gobboCount, headsCount: 0 },
    });
}

function blasterBeforeScoring(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const limitEvent = emitSpecialLimitUsed(ctx.playerId, BLASTER, source.baseIndex, ctx.now);
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_blaster',
        preferredResult: ctx.targetBaseIndex !== undefined ? 'tails' : 'heads',
        initialEvents: limitEvent ? [limitEvent] : undefined,
        purpose: { kind: 'blaster', sourceCardUid: source.minion.uid, targetBaseIndex: ctx.targetBaseIndex },
    });
}

function aLittleHelp(ctx: AbilityContext): AbilityResult {
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_a_little_help',
        purpose: { kind: 'a_little_help' },
    });
}

function findTargetMinion(ctx: AbilityContext): LocatedMinion | undefined {
    if (ctx.targetMinionUid) return findMinionOnBases(ctx.state, ctx.targetMinionUid);
    return allMinions(ctx.state, () => true)[0];
}

function bushwhacking(ctx: AbilityContext): AbilityResult {
    const target = findTargetMinion(ctx);
    if (!target) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_bushwhacking',
        preferredResult: target.minion.controller === ctx.playerId ? 'tails' : 'heads',
        purpose: {
            kind: 'bushwhacking',
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            targetMinionUid: target.minion.uid,
            targetBaseIndex: ctx.targetBaseIndex,
        },
    });
}

function firstOngoingAction(state: SmashUpCore, baseIndex?: number): { uid: string } | undefined {
    for (const [index, base] of state.bases.entries()) {
        if (baseIndex !== undefined && index !== baseIndex) continue;
        const baseAction = base.ongoingActions[0];
        if (baseAction) return { uid: baseAction.uid };
        for (const minion of base.minions) {
            const attached = minion.attachedActions[0];
            if (attached) return { uid: attached.uid };
        }
    }
    return undefined;
}

function demolition(ctx: AbilityContext): AbilityResult {
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_demolition',
        purpose: {
            kind: 'demolition',
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            remainingFlips: 3,
            targetMinionUid: ctx.targetMinionUid,
            targetBaseIndex: ctx.targetBaseIndex,
        },
    });
}

function heWhoSmeltIt(ctx: AbilityContext): AbilityResult {
    const targets = allMinions(ctx.state, () => true);
    if (targets.length === 0) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_he_who_smelt_it',
        purpose: { kind: 'he_who_smelt_it', flipIndex: 0, targetMinionUid: ctx.targetMinionUid },
    });
}

function makeYourOwnLuck(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: { playerId: ctx.playerId, messageKey: 'feedback.goblins_make_your_own_luck_ready', level: 'info' },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function revvingUp(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const minionUids = base.minions.filter(candidate => candidate.controller === ctx.playerId).map(minion => minion.uid);
    if (minionUids.length === 0) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_revving_up',
        purpose: { kind: 'revving_up', minionUids, baseIndex, index: 0 },
    });
}

function magicHelmetBeforeScoring(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId) return { events: [] };
    const host = findMinionByAttachedCard(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.baseIndex) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        reason: 'goblins_magic_helmet',
        preferredResult: 'heads',
        purpose: {
            kind: 'magic_helmet',
            sourceCardUid: ctx.sourceCardUid,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: host.baseIndex,
        },
    });
}

function goblinTownOnMinionPlayed(ctx: BaseAbilityContext) {
    if (!ctx.minionUid || ctx.baseDefId !== 'base_goblin_town') return { events: [] };
    const minion = ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.minionUid);
    if (!minion) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: minion.controller,
        now: ctx.now,
        reason: 'base_goblin_town',
        preferredResult: 'heads',
        purpose: { kind: 'goblin_town', minionUid: minion.uid, baseIndex: ctx.baseIndex },
    });
}

function goblinCavesAfterScoring(ctx: BaseAbilityContext) {
    const playerIds = [...new Set((ctx.state.bases[ctx.baseIndex]?.minions ?? []).map(minion => minion.controller))];
    if (playerIds.length === 0) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: playerIds[0],
        now: ctx.now,
        reason: 'base_goblin_caves',
        purpose: { kind: 'goblin_caves', playerIds, baseIndex: ctx.baseIndex, index: 0 },
    });
}

export function registerGoblinAbilities(): void {
    registerAbility(CHAOS_LORD, 'ongoing', () => ({ events: [] }));
    registerAbility(DIVINER, 'ongoing', () => ({ events: [] }));
    registerAbility(BLASTER, 'special', blasterBeforeScoring);
    registerAbility(GOBBO, 'onPlay', gobboOnPlay);
    registerAbility('goblins_a_little_help', 'onPlay', aLittleHelp);
    registerAbility('goblins_bushwhacking', 'onPlay', bushwhacking);
    registerAbility('goblins_demolition', 'onPlay', demolition);
    registerAbility(RECRUITERS, 'ongoing', () => ({ events: [] }));
    registerAbility('goblins_he_who_smelt_it', 'onPlay', heWhoSmeltIt);
    registerAbility('goblins_make_your_own_luck', 'special', makeYourOwnLuck);
    registerAbility('goblins_revving_up', 'onPlay', revvingUp);

    registerTrigger(MAGIC_HELMET, 'beforeScoring', magicHelmetBeforeScoring, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerBaseAbility('base_goblin_town', 'onMinionPlayed', goblinTownOnMinionPlayed);
    registerBaseAbility('base_goblin_caves', 'afterScoring', goblinCavesAfterScoring, {
        mandatory: false,
        canTrigger: ctx => (ctx.state.bases[ctx.baseIndex]?.minions ?? []).length > 0,
    });
}
