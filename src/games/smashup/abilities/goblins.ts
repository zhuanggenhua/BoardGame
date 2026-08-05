import type { PlayerId } from '../../../engine/types';
import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { reduce } from '../domain/reduce';
import {
    addPowerCounter,
    addTempPower,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    findMinionByAttachedCard,
    findMinionOnBases,
    grantExtraAction,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import type { CardInstance, MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type LocatedMinion = { minion: MinionOnBase; baseIndex: number };

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

function applyEvents(core: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((next, event) => reduce(next, event), core);
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
    const projected = applyEvents(state, drawEvents);
    return [...drawEvents, ...discardFirstHandCards(projected, playerId, count, now)];
}

function actionPlayedFromHand(card: CardInstance, playerId: PlayerId, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.ACTION_PLAYED,
        payload: { playerId, cardUid: card.uid, isExtraAction: true, consumesNormalLimit: false },
        timestamp: now,
    } as SmashUpEvent;
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

function applyCoinResultChanges(
    state: SmashUpCore,
    playerId: PlayerId,
    heads: boolean,
    random: AbilityContext['random'] | BaseAbilityContext['random'] | TriggerContext['random'],
    now: number,
    reason: string,
    preferredResult?: CoinPreference,
): { heads: boolean; events: SmashUpEvent[]; state: SmashUpCore } {
    if (preferredResult === undefined) return { heads, events: [], state };
    const preferredHeads = preferredResult === 'heads';
    if (heads === preferredHeads) return { heads, events: [], state };

    let current = state;
    const events: SmashUpEvent[] = [];
    const luckCard = current.players[playerId]?.hand.find(card => card.defId === MAKE_YOUR_OWN_LUCK);
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
        current = applyEvents(current, [play]);
        return { heads: preferredHeads, events, state: current };
    }

    const diviner = allMinions(current, minion => minion.defId === DIVINER && minion.controller === playerId)
        .find(source => source.minion.metadata?.goblinsDivinerChangeTurn !== current.turnNumber);
    const discardCard = current.players[playerId]?.hand[0];
    if (diviner && discardCard) {
        const discard = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [discardCard.uid] },
            timestamp: now,
        } as SmashUpEvent;
        const mark = markDivinerChangeUsed(diviner, current.turnNumber, reason + '_diviner_change', now);
        events.push(discard, mark);
        current = applyEvents(current, [discard, mark]);
        return { heads: preferredHeads, events, state: current };
    }

    return { heads, events, state };
}

function afterOwnCoinFlip(
    state: SmashUpCore,
    playerId: PlayerId,
    heads: boolean,
    random: AbilityContext['random'],
    now: number,
    reason: string,
): SmashUpEvent[] {
    let current = state;
    const events: SmashUpEvent[] = [];

    for (const _source of allMinions(current, minion => minion.defId === CHAOS_LORD && minion.controller === playerId)) {
        if (heads) {
            const target = firstOwnMinion(current, playerId);
            if (target) events.push(addPowerCounter(target.minion.uid, target.baseIndex, 1, reason + '_chaos_lord', now));
        } else {
            events.push(...drawThenDiscard(current, playerId, 1, random, now));
        }
        current = applyEvents(current, events);
    }

    for (const source of allMinions(current, minion => minion.defId === DIVINER && minion.controller === playerId)) {
        if (source.minion.metadata?.goblinsDivinerDrawTurn === current.turnNumber) continue;
        const drawEvents = buildStandardDrawEvents(current, playerId, 1, random, now);
        events.push(...drawEvents, {
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: {
                minionUid: source.minion.uid,
                baseIndex: source.baseIndex,
                metadataUpdate: { goblinsDivinerDrawTurn: current.turnNumber },
                reason: reason + '_diviner_first_coin',
            },
            timestamp: now,
        } as SmashUpEvent);
        current = applyEvents(current, drawEvents);
    }

    for (const base of current.bases) {
        for (const action of base.ongoingActions) {
            if (action.defId !== RECRUITERS || action.ownerId !== playerId) continue;
            if (heads) {
                events.push(...buildStandardDrawEvents(current, playerId, 1, random, now));
            } else {
                const discardCard = current.players[playerId]?.discard[0];
                if (discardCard) {
                    const shuffle = shuffleDiscardCardIntoDeck(current, playerId, discardCard, random, reason + '_goblin_recruiters', now);
                    events.push(shuffle);
                    current = reduce(current, shuffle);
                }
            }
        }
    }

    return events;
}

function flipWithTriggers(
    state: SmashUpCore,
    playerId: PlayerId,
    random: AbilityContext['random'],
    now: number,
    reason: string,
    preferredResult?: CoinPreference,
): { heads: boolean; events: SmashUpEvent[] } {
    const rawHeads = flip(random);
    const changed = applyCoinResultChanges(state, playerId, rawHeads, random, now, reason, preferredResult);
    const triggerEvents = afterOwnCoinFlip(changed.state, playerId, changed.heads, random, now, reason);
    return { heads: changed.heads, events: [...changed.events, ...triggerEvents] };
}

function gobboOnPlay(ctx: AbilityContext): AbilityResult {
    const target = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!target) return { events: [] };
    const gobboCount = allMinions(ctx.state, minion => minion.defId === GOBBO).length;
    let current = ctx.state;
    const events: SmashUpEvent[] = [];
    let headsCount = 0;
    for (let index = 0; index < gobboCount; index += 1) {
        const result = flipWithTriggers(current, ctx.playerId, ctx.random, ctx.now, 'goblins_gobbo', 'heads');
        if (result.heads) headsCount += 1;
        events.push(...result.events);
        current = applyEvents(current, result.events);
    }
    if (headsCount > 0) events.push(addPowerCounter(target.minion.uid, target.baseIndex, headsCount, 'goblins_gobbo', ctx.now));
    return { events };
}

function blasterBeforeScoring(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const result = flipWithTriggers(ctx.state, ctx.playerId, ctx.random, ctx.now, 'goblins_blaster', ctx.targetBaseIndex !== undefined ? 'tails' : 'heads');
    const events = [...result.events];
    if (result.heads) {
        events.push(addTempPower(source.minion.uid, source.baseIndex, 2, 'goblins_blaster_heads', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: BLASTER,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: source.baseIndex,
        }));
    } else {
        const toBaseIndex = ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== source.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
            ? ctx.targetBaseIndex
            : firstOtherBaseIndex(ctx.state, source.baseIndex);
        if (toBaseIndex !== undefined) {
            events.push(...buildValidatedMoveEvents(ctx.state, {
                minionUid: source.minion.uid,
                minionDefId: source.minion.defId,
                fromBaseIndex: source.baseIndex,
                toBaseIndex,
                reason: 'goblins_blaster_tails',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: BLASTER,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: source.baseIndex,
                sourceKind: 'nonAction',
            }));
        }
    }
    return { events };
}

function aLittleHelp(ctx: AbilityContext): AbilityResult {
    const result = flipWithTriggers(ctx.state, ctx.playerId, ctx.random, ctx.now, 'goblins_a_little_help');
    return {
        events: [
            ...result.events,
            result.heads
                ? grantExtraMinion(ctx.playerId, 'goblins_a_little_help_heads', ctx.now)
                : grantExtraAction(ctx.playerId, 'goblins_a_little_help_tails', ctx.now),
            ...(result.heads ? [] : [grantExtraAction(ctx.playerId, 'goblins_a_little_help_tails_second', ctx.now)]),
        ],
    };
}

function findTargetMinion(ctx: AbilityContext): LocatedMinion | undefined {
    if (ctx.targetMinionUid) return findMinionOnBases(ctx.state, ctx.targetMinionUid);
    return allMinions(ctx.state, () => true)[0];
}

function bushwhacking(ctx: AbilityContext): AbilityResult {
    const target = findTargetMinion(ctx);
    if (!target) return { events: [] };
    const result = flipWithTriggers(
        ctx.state,
        ctx.playerId,
        ctx.random,
        ctx.now,
        'goblins_bushwhacking',
        target.minion.controller === ctx.playerId ? 'tails' : 'heads',
    );
    const events = [...result.events];
    if (result.heads) {
        events.push(...buildValidatedDestroyEvents(ctx.state, {
            minionUid: target.minion.uid,
            minionDefId: target.minion.defId,
            fromBaseIndex: target.baseIndex,
            destroyerId: ctx.playerId,
            reason: 'goblins_bushwhacking_heads',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'action',
        }));
    } else {
        const toBaseIndex = ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== target.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
            ? ctx.targetBaseIndex
            : firstOtherBaseIndex(ctx.state, target.baseIndex);
        if (toBaseIndex !== undefined) {
            events.push(...buildValidatedMoveEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                toBaseIndex,
                reason: 'goblins_bushwhacking_tails',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'action',
            }));
        }
    }
    return { events };
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
    let current = ctx.state;
    const events: SmashUpEvent[] = [];
    for (let index = 0; index < 3; index += 1) {
        const result = flipWithTriggers(current, ctx.playerId, ctx.random, ctx.now, 'goblins_demolition');
        events.push(...result.events);
        current = applyEvents(current, result.events);
        if (result.heads) {
            const explicitTarget = ctx.targetMinionUid ? findMinionOnBases(current, ctx.targetMinionUid) : undefined;
            const target = explicitTarget?.minion.controller === ctx.playerId ? explicitTarget : firstOwnMinion(current, ctx.playerId);
            if (target) {
                const counter = addPowerCounter(target.minion.uid, target.baseIndex, 1, 'goblins_demolition_heads', ctx.now);
                events.push(counter);
                current = reduce(current, counter);
            }
        } else {
            const target = firstOngoingAction(current, ctx.targetBaseIndex);
            if (target) {
                const detach = buildValidatedOngoingDetachEvents(current, {
                    cardUid: target.uid,
                    reason: 'goblins_demolition_tails',
                    now: ctx.now,
                    expectedLocation: 'any',
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                });
                events.push(...detach);
                current = applyEvents(current, detach);
            }
        }
    }
    return { events };
}

function heWhoSmeltIt(ctx: AbilityContext): AbilityResult {
    let current = ctx.state;
    const events: SmashUpEvent[] = [];
    const targets = allMinions(current, () => true);
    if (targets.length === 0) return { events: [] };

    for (let flipIndex = 0; flipIndex < 50; flipIndex += 1) {
        const result = flipWithTriggers(current, ctx.playerId, ctx.random, ctx.now, 'goblins_he_who_smelt_it');
        events.push(...result.events);
        current = applyEvents(current, result.events);
        if (!result.heads) {
            const extra = grantExtraAction(ctx.playerId, 'goblins_he_who_smelt_it_tails', ctx.now);
            events.push(extra);
            break;
        }
        const refreshedTargets = allMinions(current, () => true);
        const target = (ctx.targetMinionUid
            ? refreshedTargets.find(candidate => candidate.minion.uid === ctx.targetMinionUid)
            : refreshedTargets[flipIndex % refreshedTargets.length]) ?? refreshedTargets[0];
        if (!target) break;
        const counter = addPowerCounter(target.minion.uid, target.baseIndex, 1, 'goblins_he_who_smelt_it_heads', ctx.now);
        events.push(counter);
        current = reduce(current, counter);
    }
    return { events };
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
    let current = ctx.state;
    const events: SmashUpEvent[] = [];
    for (const minion of base.minions.filter(candidate => candidate.controller === ctx.playerId)) {
        const result = flipWithTriggers(current, ctx.playerId, ctx.random, ctx.now, 'goblins_revving_up');
        events.push(...result.events);
        current = applyEvents(current, result.events);
        events.push(result.heads
            ? addPowerCounter(minion.uid, baseIndex, 1, 'goblins_revving_up_heads', ctx.now)
            : addTempPower(minion.uid, baseIndex, 2, 'goblins_revving_up_tails', ctx.now));
    }
    return { events };
}

function magicHelmetBeforeScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    const host = findMinionByAttachedCard(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.baseIndex) return [];
    const result = flipWithTriggers(ctx.state, ctx.sourceControllerId, ctx.random, ctx.now, 'goblins_magic_helmet', 'heads');
    if (result.heads) return result.events;
    return [
        ...result.events,
        ...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: ctx.sourceCardUid,
            reason: 'goblins_magic_helmet_tails',
            now: ctx.now,
            expectedLocation: 'minion',
            sourcePlayerId: ctx.sourceControllerId,
            sourceDefId: MAGIC_HELMET,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: host.baseIndex,
        }),
    ];
}

function goblinTownOnMinionPlayed(ctx: BaseAbilityContext): SmashUpEvent[] {
    if (!ctx.minionUid || ctx.baseDefId !== 'base_goblin_town') return [];
    const minion = ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.minionUid);
    if (!minion) return [];
    const result = flipWithTriggers(ctx.state, minion.controller, ctx.random, ctx.now, 'base_goblin_town', 'heads');
    return result.heads
        ? [...result.events, addPowerCounter(minion.uid, ctx.baseIndex, 1, 'base_goblin_town_heads', ctx.now)]
        : result.events;
}

function goblinCavesAfterScoring(ctx: BaseAbilityContext): SmashUpEvent[] {
    const controllers = new Set((ctx.state.bases[ctx.baseIndex]?.minions ?? []).map(minion => minion.controller));
    let current = ctx.state;
    const events: SmashUpEvent[] = [];
    for (const playerId of controllers) {
        const result = flipWithTriggers(current, playerId, ctx.random, ctx.now, 'base_goblin_caves');
        events.push(...result.events);
        current = applyEvents(current, result.events);
        if (result.heads) {
            events.push({
                type: SU_EVENTS.VP_AWARDED,
                payload: { playerId, amount: 1, reason: 'base_goblin_caves_heads' },
                timestamp: ctx.now,
            } as SmashUpEvent);
        } else {
            events.push(...discardFirstHandCards(current, playerId, 2, ctx.now));
        }
    }
    return events;
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
    registerBaseAbility('base_goblin_town', 'onMinionPlayed', ctx => ({ events: goblinTownOnMinionPlayed(ctx) }));
    registerBaseAbility('base_goblin_caves', 'afterScoring', ctx => ({ events: goblinCavesAfterScoring(ctx) }), {
        mandatory: false,
        canTrigger: ctx => (ctx.state.bases[ctx.baseIndex]?.minions ?? []).length > 0,
    });
}
