import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    queueMinionPlayEffect,
} from '../domain/abilityHelpers';
import { createEffectProgram } from '../domain/abilityRuntime';
import { registerActiveBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import type { BaseMetadataUpdatedEvent, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getCardDef } from '../data/cards';
import {
    discardFirstHandAny,
    firstOwnMinionAtBase,
    isMinionCard,
    ownMinionsAtBase,
    shuffleFirstDiscardCardsIntoDeck,
    wasHandDiscard,
} from './disney_shared';

const BELLE = 'beauty_and_the_beast_belle';
const BEAST = 'beauty_and_the_beast_beast';
const ENCHANTED_OBJECTS = 'beauty_and_the_beast_enchanted_objects';
const ENCHANTED_OBJECTS_USAGE = 'beauty_and_the_beast_enchanted_objects';
const BREAK_THE_CURSE = 'beauty_and_the_beast_break_the_curse';
const DISCOVER_THE_LIBRARY = 'beauty_and_the_beast_discover_the_library';
const EVER_A_SURPRISE = 'beauty_and_the_beast_ever_a_surprise';
const PETALS_OF_THE_ROSE = 'beauty_and_the_beast_petals_of_the_rose';
const GASTON = 'beauty_and_the_beast_gaston';
const BASE_ENCHANTED_CASTLE = 'base_enchanted_castle';
const BASE_GASTONS_TAVERN = 'base_gastons_tavern';

function source(ctx: AbilityContext) {
    return {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    };
}

function discardCost(ctx: AbilityContext): SmashUpEvent[] | undefined {
    const event = discardFirstHandAny(ctx);
    return event ? [event] : undefined;
}

function hasDiscardedFromHandThisTurn(ctx: AbilityContext | BaseAbilityContext): boolean {
    return ((ctx.state.cardsDiscardedFromHandThisTurn ?? {})[ctx.playerId] ?? 0) > 0;
}

function discardFirstHandCards(ctx: AbilityContext | BaseAbilityContext, count: number): SmashUpEvent[] | undefined {
    const cardUids = (ctx.state.players[ctx.playerId]?.hand ?? [])
        .filter(card => ('cardUid' in ctx ? card.uid !== ctx.cardUid : true))
        .slice(0, count)
        .map(card => card.uid);
    if (cardUids.length < count) return undefined;
    return [{
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: ctx.playerId, cardUids },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function belleOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const hasBeast = base?.minions.some(minion =>
        minion.controller === ctx.playerId && minion.defId === BEAST,
    ) ?? false;
    return {
        events: hasBeast
            ? buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now)
            : [],
    };
}

function belleTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
    };
}

function beastOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const self = base.minions.find(minion => minion.uid === ctx.cardUid && minion.controller === ctx.playerId);
    const belle = base.minions.find(minion => minion.defId === BELLE && minion.controller === ctx.playerId);
    if (!self || !belle) return { events: [] };
    return {
        events: [
            addPowerCounter(self.uid, ctx.baseIndex, 1, BEAST, ctx.now, source(ctx)),
            addPowerCounter(belle.uid, ctx.baseIndex, 1, BEAST, ctx.now, source(ctx)),
        ],
    };
}

function beastTalent(ctx: AbilityContext): AbilityResult {
    const self = firstOwnMinionAtBase(ctx.state, ctx.playerId, ctx.baseIndex);
    if (!self || self.minion.uid !== ctx.cardUid) return { events: [] };
    const cost = discardCost(ctx);
    if (!cost) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [
            ...cost,
            addPowerCounter(self.minion.uid, self.baseIndex, 1, BEAST, ctx.now, source(ctx)),
        ],
    };
}

function cogsworthTalent(ctx: AbilityContext): AbilityResult {
    const cost = discardCost(ctx);
    if (!cost) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return { events: [...cost, grantContextualExtraAction(ctx, 'beauty_and_the_beast_cogsworth')] };
}

function lumiereTalent(ctx: AbilityContext): AbilityResult {
    const cost = discardCost(ctx);
    if (!cost) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [
            ...cost,
            grantContextualExtraMinion(ctx, 'beauty_and_the_beast_lumiere', ctx.baseIndex, { powerMax: 3 }),
        ],
    };
}

function mrsPottsTalent(ctx: AbilityContext): AbilityResult {
    const cost = discardCost(ctx);
    if (!cost) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [
            ...cost,
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        ],
    };
}

function beOurGuestTalent(ctx: AbilityContext): AbilityResult {
    if (!hasDiscardedFromHandThisTurn(ctx)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
    };
}

function gastonTalent(ctx: AbilityContext): AbilityResult {
    const cost = discardFirstHandCards(ctx, 2);
    if (!cost) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [
            ...cost,
            ...buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: ctx.cardUid,
                defId: ctx.defId,
                ownerId: ctx.playerId,
                reason: GASTON,
                now: ctx.now,
                expectedLocation: 'base',
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
        ],
    };
}

function breakTheCurse(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    return {
        events: ownMinionsAtBase(ctx.state, ctx.playerId, baseIndex)
            .map(minion => addTempPower(minion.uid, baseIndex, 1, BREAK_THE_CURSE, ctx.now, source(ctx))),
    };
}

function discoverTheLibrary(ctx: AbilityContext): AbilityResult {
    const discard = discardFirstHandAny(ctx);
    return {
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now),
            ...(discard ? [discard] : []),
        ],
    };
}

function everASurprise(ctx: AbilityContext): AbilityResult {
    return {
        events: shuffleFirstDiscardCardsIntoDeck(ctx, card => isMinionCard(card.defId), 2, EVER_A_SURPRISE),
    };
}

function thisProvincialTown(ctx: AbilityContext): AbilityResult {
    const cost = discardFirstHandAny(ctx);
    return {
        events: [
            grantContextualExtraMinion(ctx, 'beauty_and_the_beast_this_provincial_town', ctx.baseIndex, { powerMax: 3 }),
            ...(cost ? [cost, queueMinionPlayEffect(ctx.playerId, 'addPowerCounter', 1, ctx.now, 'beauty_and_the_beast_this_provincial_town')] : []),
        ],
    };
}

function playDiscardedEnchantedObject(ctx: TriggerContext): SmashUpEvent[] {
    if (!wasHandDiscard(ctx) || !ctx.sourceCardUid || ctx.sourceControllerId !== ctx.playerId) return [];
    if (ctx.state.players[ctx.playerId]?.usedDiscardPlayAbilities?.includes(ENCHANTED_OBJECTS_USAGE)) return [];
    if (!(ctx.discardedCards ?? []).some(card => card.uid === ctx.sourceCardUid && card.defId === ENCHANTED_OBJECTS)) return [];
    const baseIndex = ctx.state.bases.findIndex(base => base.minions.some(minion => minion.controller === ctx.playerId));
    const targetBaseIndex = baseIndex >= 0 ? baseIndex : 0;
    const def = getCardDef(ENCHANTED_OBJECTS);
    return [{
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId: ctx.playerId,
            cardUid: ctx.sourceCardUid,
            defId: ENCHANTED_OBJECTS,
            baseIndex: targetBaseIndex,
            ownerId: ctx.sourceOwnerPlayerId ?? ctx.playerId,
            baseDefId: ctx.state.bases[targetBaseIndex]?.defId,
            power: def?.type === 'minion' ? def.power ?? 0 : 0,
            fromDiscard: true,
            consumesNormalLimit: false,
            discardPlaySourceId: ENCHANTED_OBJECTS_USAGE,
        },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function discardedActionSpecial(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraAction(ctx, ctx.defId, { restrictToCardUid: ctx.cardUid }),
        ],
    };
}

function petalsOfTheRose(ctx: TriggerContext): SmashUpEvent[] {
    if (!wasHandDiscard(ctx) || ctx.playerId !== ctx.sourceControllerId) return [];
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.deck.length === 0) return [];
    return [{
        type: SU_EVENTS.DECK_INSPECTED,
        payload: {
            targetPlayerId: ctx.playerId,
            inspectorPlayerId: ctx.playerId,
            count: Math.min(2, player.deck.length),
            reason: PETALS_OF_THE_ROSE,
        },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function enchantedCastle(ctx: TriggerContext): SmashUpEvent[] {
    if (!wasHandDiscard(ctx)) return [];
    if (ctx.state.turnOrder[ctx.state.currentPlayerIndex] !== ctx.playerId) return [];
    if (ctx.sourceBaseIndex === undefined) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base || base.metadata?.enchantedCastleDiscardTurn === ctx.state.turnNumber) return [];
    const target = base.minions.find(minion => minion.controller === ctx.playerId);
    if (!target) return [];
    return [
        addPowerCounter(target.uid, ctx.sourceBaseIndex, 1, BASE_ENCHANTED_CASTLE, ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: BASE_ENCHANTED_CASTLE,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
        }),
        {
            type: SU_EVENTS.BASE_METADATA_UPDATED,
            payload: {
                baseIndex: ctx.sourceBaseIndex,
                metadataUpdate: { enchantedCastleDiscardTurn: ctx.state.turnNumber },
                reason: BASE_ENCHANTED_CASTLE,
            },
            timestamp: ctx.now,
        } as BaseMetadataUpdatedEvent,
    ];
}

function gastonsTavern(ctx: BaseAbilityContext): AbilityResult {
    const cost = discardFirstHandCards(ctx, 1);
    if (!cost) return { events: [] };
    return {
        events: [
            ...cost,
            grantContextualExtraMinion({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState }, BASE_GASTONS_TAVERN, ctx.baseIndex, { powerMax: 3 }),
        ],
    };
}

export function registerBeautyAndTheBeastAbilities(): void {
    registerAbilityProgram(BELLE, 'onPlay', { program: createEffectProgram(belleOnPlay) });
    registerAbilityProgram(BELLE, 'talent', { program: createEffectProgram(belleTalent) });
    registerAbilityProgram(BEAST, 'onPlay', { program: createEffectProgram(beastOnPlay) });
    registerAbilityProgram(BEAST, 'talent', { program: createEffectProgram(beastTalent) });
    registerAbilityProgram('beauty_and_the_beast_cogsworth', 'talent', { program: createEffectProgram(cogsworthTalent) });
    registerAbilityProgram('beauty_and_the_beast_lumiere', 'talent', { program: createEffectProgram(lumiereTalent) });
    registerAbilityProgram('beauty_and_the_beast_mrs_potts_and_chip', 'talent', { program: createEffectProgram(mrsPottsTalent) });
    registerAbilityProgram('beauty_and_the_beast_be_our_guest', 'talent', { program: createEffectProgram(beOurGuestTalent) });
    registerAbilityProgram(GASTON, 'talent', { program: createEffectProgram(gastonTalent) });
    registerAbilityProgram(BREAK_THE_CURSE, 'onPlay', { program: createEffectProgram(breakTheCurse) });
    registerAbilityProgram(BREAK_THE_CURSE, 'special', { program: createEffectProgram(discardedActionSpecial) });
    registerAbilityProgram(DISCOVER_THE_LIBRARY, 'onPlay', { program: createEffectProgram(discoverTheLibrary) });
    registerAbilityProgram(DISCOVER_THE_LIBRARY, 'special', { program: createEffectProgram(discardedActionSpecial) });
    registerAbilityProgram(EVER_A_SURPRISE, 'onPlay', { program: createEffectProgram(everASurprise) });
    registerAbilityProgram(EVER_A_SURPRISE, 'special', { program: createEffectProgram(discardedActionSpecial) });
    registerAbilityProgram('beauty_and_the_beast_this_provincial_town', 'onPlay', { program: createEffectProgram(thisProvincialTown) });

    registerTrigger(ENCHANTED_OBJECTS, 'onCardsDiscarded', playDiscardedEnchantedObject, {
        global: true,
        globalZones: ['hand'],
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => wasHandDiscard(ctx)
            && !!ctx.sourceCardUid
            && (ctx.discardedCards ?? []).some(card => card.uid === ctx.sourceCardUid && card.defId === ENCHANTED_OBJECTS),
    });
    registerTrigger(PETALS_OF_THE_ROSE, 'onCardsDiscarded', petalsOfTheRose, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => wasHandDiscard(ctx) && ctx.playerId === ctx.sourceControllerId,
    });
    registerTrigger(BASE_ENCHANTED_CASTLE, 'onCardsDiscarded', enchantedCastle, {
        perInstance: true,
        optional: true,
        playerContext: 'eventPlayer',
        baseScoped: false,
        canTrigger: ctx => wasHandDiscard(ctx)
            && ctx.state.turnOrder[ctx.state.currentPlayerIndex] === ctx.playerId,
    });
    registerActiveBaseAbility(BASE_GASTONS_TAVERN, gastonsTavern, {
        oncePerTurn: false,
        canUse: ctx => (ctx.state.players[ctx.playerId]?.hand.length ?? 0) > 0,
    });
}
