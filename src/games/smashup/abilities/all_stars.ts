import { registerAbility, requireAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
} from '../domain/abilityHelpers';
import { killerPlantSproutTrigger } from './killer_plants';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { registerPowerModifier, type PowerModifierContext } from '../domain/ongoingModifiers';
import type { SmashUpEvent } from '../domain/types';

const ALL_STARS_ABILITY_ALIASES = [
    ['all_stars_seeing_stars_pod', 'onPlay', 'ninja_seeing_stars'],
    ['all_stars_begin_the_summoning_pod', 'onPlay', 'elder_thing_begin_the_summoning_pod'],
    ['all_stars_non_infinite_loop_pod', 'onPlay', 'geeks_non_infinite_loop'],
    ['all_stars_ghostly_arrival_pod', 'onPlay', 'ghost_ghostly_arrival'],
    ['all_stars_favor_of_dionysus_pod', 'onPlay', 'mythic_greeks_favor_of_dionysus'],
    ['all_stars_servitor_of_cthulhu_pod', 'talent', 'cthulhu_servitor'],
    ['all_stars_fan_pod', 'special', 'geeks_fan'],
    ['all_stars_puck_pod', 'onPlay', 'fairies_puck'],
    ['all_stars_lab_assistant_pod', 'onPlay', 'frankenstein_lab_assistant'],
] as const;

function registerAbilityAlias(targetDefId: string, tag: Parameters<typeof requireAbility>[1], sourceDefId: string): void {
    registerAbility(targetDefId, tag, requireAbility(sourceDefId, tag, `All-Stars POD reprint ${targetDefId}`));
}

function allStarsItsAstounding(ctx: AbilityContext): AbilityResult {
    const baseAbility = requireAbility('time_travelers_its_astounding', 'onPlay', 'All-Stars POD reprint');
    return baseAbility({ ...ctx, defId: 'time_travelers_its_astounding' });
}

function allStarsFriendshipPower(ctx: AbilityContext): AbilityResult {
    const baseAbility = requireAbility('mythic_horses_friendship_power', 'onPlay', 'All-Stars POD reprint');
    return baseAbility({ ...ctx, defId: 'mythic_horses_friendship_power' });
}

function allStarsSquareDeal(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };

    const otherHandSizes = Object.entries(ctx.state.players)
        .filter(([playerId]) => playerId !== ctx.playerId)
        .map(([, otherPlayer]) => otherPlayer.hand.length);
    let drawCount = 0;
    let simulatedHandSize = player.hand.length;
    let simulatedDeckSize = player.deck.length;
    let simulatedDiscardSize = player.discard.length;
    const hasOtherPlayerWithFewerCards = () => otherHandSizes.some(handSize => handSize < simulatedHandSize);

    while (!hasOtherPlayerWithFewerCards() && (simulatedDeckSize > 0 || simulatedDiscardSize > 0)) {
        drawCount += 1;
        simulatedHandSize += 1;
        if (simulatedDeckSize > 0) {
            simulatedDeckSize -= 1;
        } else {
            simulatedDeckSize = Math.max(0, simulatedDiscardSize - 1);
            simulatedDiscardSize = 0;
        }
    }

    if (drawCount === 0) return { events: [] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now) };
}

function allStarsPrepareForBattle(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const topCards = player.deck.slice(0, 3);
    if (topCards.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }

    const drawCount = Math.min(2, topCards.length);
    const events: SmashUpEvent[] = buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now);
    const returnedCard = topCards[drawCount];
    if (returnedCard) {
        events.push(...buildValidatedCardToDeckBottomEvents(ctx.state, {
            cardUid: returnedCard.uid,
            defId: returnedCard.defId,
            ownerId: returnedCard.owner,
            sourcePlayerId: ctx.playerId,
            reason: 'all_stars_prepare_for_battle_pod',
            now: ctx.now,
            expectedLocation: 'deck',
        }));
    }
    return { events };
}

function allStarsGelf(ctx: AbilityContext): AbilityResult {
    const baseAbility = requireAbility('shapeshifters_gelf', 'talent', 'All-Stars POD reprint');
    return baseAbility({ ...ctx, defId: 'shapeshifters_gelf' });
}

function allStarsGranny(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const topCard = player?.deck[0];
    if (!topCard) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    return {
        events: buildValidatedCardToDeckBottomEvents(ctx.state, {
            cardUid: topCard.uid,
            defId: topCard.defId,
            ownerId: topCard.owner,
            sourcePlayerId: ctx.playerId,
            reason: 'all_stars_granny_pod',
            now: ctx.now,
            expectedLocation: 'deck',
        }),
    };
}

function allStarsFullMoonModifier(ctx: PowerModifierContext): number {
    if (ctx.base.ongoingActions.some(action => action.defId === 'all_stars_full_moon_pod' && action.ownerId === ctx.minion.controller)) {
        return 1;
    }
    return 0;
}

function allStarsImperialDragonTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function allStarsSproutTrigger(ctx: TriggerContext): SmashUpEvent[] {
    return killerPlantSproutTrigger(ctx);
}

export function registerAllStarsAbilities(): void {
    for (const [targetDefId, tag, sourceDefId] of ALL_STARS_ABILITY_ALIASES) {
        registerAbilityAlias(targetDefId, tag, sourceDefId);
    }

    registerAbility('all_stars_its_astounding_pod', 'onPlay', allStarsItsAstounding);
    registerAbility('all_stars_friendship_power_pod', 'onPlay', allStarsFriendshipPower);
    registerAbility('all_stars_square_deal_pod', 'onPlay', allStarsSquareDeal);
    registerAbility('all_stars_prepare_for_battle_pod', 'onPlay', allStarsPrepareForBattle);
    registerAbility('all_stars_gelf_pod', 'talent', allStarsGelf);
    registerAbility('all_stars_granny_pod', 'talent', allStarsGranny);

    registerPowerModifier('all_stars_full_moon_pod', allStarsFullMoonModifier, { podStrategy: 'override' });
    registerTrigger('all_stars_sprout_pod', 'onTurnStart', allStarsSproutTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('all_stars_imperial_dragon_pod', 'onMinionPlayed', allStarsImperialDragonTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: ctx => !!ctx.sourceControllerId && ctx.playerId !== ctx.sourceControllerId,
    });
    registerTrigger('all_stars_imperial_dragon_pod', 'onMinionMoved', allStarsImperialDragonTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: ctx => (
            !!ctx.sourceControllerId
            && ctx.playerId !== ctx.sourceControllerId
            && ctx.baseIndex !== undefined
            && ctx.moveToBaseIndex !== undefined
            && ctx.baseIndex === ctx.moveToBaseIndex
        ),
    });
}
