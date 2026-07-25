import type { PlayerId } from '../../../engine/types';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedReturnEvents,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { createEffectProgram } from '../domain/abilityRuntime';
import { registerBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    registerBaseVpModifier,
    registerCardAbilitySuppression,
    registerTrigger,
} from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import type { CardToDeckBottomEvent, DeckReorderedEvent, OngoingDetachedEvent, OngoingAttachedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import {
    collectCharacterModifiers,
    firstOtherBaseIndex,
    getActionControllerId,
    getActionOwnerId,
    isCharacterModifier,
    recoverFirstDiscardCard,
    revealTopAndDrawMatches,
} from './disney_shared';

const JACK = 'nightmare_before_christmas_jack_skellington';
const DR_FINKELSTEIN = 'nightmare_before_christmas_dr_finkelstein';
const SALLY = 'nightmare_before_christmas_sally';
const LOCK_SHOCK_BARREL = 'nightmare_before_christmas_lock_shock_and_barrel';
const ZERO = 'nightmare_before_christmas_zero';
const HALLOWEEN_TOWN_FOLKS = 'nightmare_before_christmas_halloween_town_folks';
const CHRISTMAS_WILL_BE_OURS = 'nightmare_before_christmas_christmas_will_be_ours';
const GHOSTLY_PRESENTS = 'nightmare_before_christmas_ghostly_presents';
const OOGIE_BOOGIE = 'nightmare_before_christmas_oogie_boogie';
const SANDY_CLAWS_COSTUME = 'nightmare_before_christmas_sandy_claws_costume';
const WINTER_SURPRISE = 'nightmare_before_christmas_winter_surprise';
const ZOMBIE_DUCK_TOY = 'nightmare_before_christmas_zombie_duck_toy';
const BASE_HALLOWEEN_TOWN = 'base_halloween_town';
const BASE_SPIRAL_HILL = 'base_spiral_hill';

function jackOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: recoverFirstDiscardCard(ctx, card => isCharacterModifier(card.defId), JACK),
    };
}

function jackOnCharacterModifierPlayed(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.triggerCardDefId === undefined || !isCharacterModifier(ctx.triggerCardDefId)) return [];
    if (ctx.playerId !== ctx.sourceControllerId || ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    const target = base?.minions.find(minion => minion.controller === ctx.sourceControllerId);
    if (!target) {
        return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
    }
    return [{
        type: SU_EVENTS.POWER_COUNTER_ADDED,
        payload: {
            minionUid: target.uid,
            baseIndex: ctx.sourceBaseIndex,
            amount: 1,
            reason: JACK,
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: JACK,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
        },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function drFinkelsteinTalent(ctx: AbilityContext): AbilityResult {
    const modifier = collectCharacterModifiers(ctx.state)[0];
    if (!modifier) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    const destination = ctx.state.bases
        .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
        .find(candidate => candidate.minion.uid !== modifier.host.uid);
    if (!destination) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [{
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: modifier.action.uid,
                defId: modifier.action.defId,
                ownerId: getActionOwnerId(modifier.action),
                sourcePlayerId: ctx.playerId,
                targetType: 'minion',
                targetBaseIndex: destination.baseIndex,
                targetMinionUid: destination.minion.uid,
                metadata: modifier.action.metadata,
                talentUsed: modifier.action.talentUsed,
            },
            timestamp: ctx.now,
        } as OngoingAttachedEvent],
    };
}

function sallyTalent(ctx: AbilityContext): AbilityResult {
    const card = ctx.state.players[ctx.playerId]?.hand.find(candidate => isCharacterModifier(candidate.defId));
    if (!card) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return { events: [grantContextualExtraAction(ctx, SALLY, { restrictToCardUid: card.uid })] };
}

function lockShockBarrelSpecial(ctx: AbilityContext): AbilityResult {
    const card = ctx.state.players[ctx.playerId]?.hand.find(candidate => isCharacterModifier(candidate.defId));
    if (!card) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [grantContextualExtraAction(ctx, LOCK_SHOCK_BARREL, {
            playTiming: 'immediate',
            restrictToBase: ctx.baseIndex,
            restrictToCardUid: card.uid,
        })],
    };
}

function zeroAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    return buildValidatedReturnEvents(ctx.state, {
        minionUid: ctx.sourceCardUid,
        minionDefId: ZERO,
        fromBaseIndex: ctx.sourceBaseIndex,
        toPlayerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
        reason: ZERO,
        now: ctx.now,
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: ZERO,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
        sourceKind: 'nonAction',
    });
}

function halloweenTownFolks(ctx: AbilityContext): AbilityResult {
    return {
        events: revealTopAndDrawMatches({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            count: 3,
            maxPick: 1,
            predicate: card => isCharacterModifier(card.defId),
            reason: HALLOWEEN_TOWN_FOLKS,
            now: ctx.now,
        }).events,
    };
}

function christmasWillBeOurs(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, CHRISTMAS_WILL_BE_OURS)] };
}

function ghostlyPresents(ctx: AbilityContext): AbilityResult {
    const target = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target || target.controller !== ctx.playerId) return { events: [] };
    return {
        events: [
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: ctx.cardUid,
                    defId: ctx.defId,
                    ownerId: ctx.playerId,
                    reason: GHOSTLY_PRESENTS,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                },
                timestamp: ctx.now,
            } as OngoingDetachedEvent,
            grantContextualExtraMinion(ctx, GHOSTLY_PRESENTS, undefined, { powerMax: 3 }),
        ],
    };
}

function oogieBoogie(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (!target || toBaseIndex === undefined) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: ctx.baseIndex,
                toBaseIndex,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                reason: OOGIE_BOOGIE,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function winterSurprise(ctx: AbilityContext): AbilityResult {
    const card = ctx.state.players[ctx.playerId]?.discard.find(candidate => isCharacterModifier(candidate.defId));
    return {
        events: [
            ...(card ? recoverCardsFromDiscard(ctx.playerId, [card.uid], WINTER_SURPRISE, ctx.now) : []),
            ...(card ? [grantContextualExtraAction(ctx, WINTER_SURPRISE, { restrictToCardUid: card.uid })] : []),
            ...buildValidatedCardToDeckBottomEvents(ctx.state, {
                cardUid: ctx.cardUid,
                defId: ctx.defId,
                ownerId: ctx.playerId,
                reason: WINTER_SURPRISE,
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                expectedLocation: 'any',
            }),
        ],
    };
}

function sandyClawsAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    const host = base?.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.sourceCardUid));
    if (!host) return [];
    return [
        ...buildValidatedReturnEvents(ctx.state, {
            minionUid: host.uid,
            minionDefId: host.defId,
            fromBaseIndex: ctx.sourceBaseIndex,
            toPlayerId: host.owner,
            reason: SANDY_CLAWS_COSTUME,
            now: ctx.now,
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: SANDY_CLAWS_COSTUME,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            sourceKind: 'action',
        }),
        ...buildValidatedCardToDeckBottomEvents(ctx.state, {
            cardUid: ctx.sourceCardUid,
            defId: SANDY_CLAWS_COSTUME,
            ownerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
            reason: SANDY_CLAWS_COSTUME,
            now: ctx.now,
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: SANDY_CLAWS_COSTUME,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            expectedLocation: 'bases',
        }).filter((event): event is CardToDeckBottomEvent => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM),
    ];
}

function halloweenTownAfterScoring(ctx: BaseAbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const selected = base.minions.flatMap(minion =>
        minion.attachedActions
            .filter(action => isCharacterModifier(action.defId))
            .map(action => ({ action, ownerId: getActionOwnerId(action) })));
    if (selected.length === 0) return { events: [] };

    const events: SmashUpEvent[] = [];
    const selectedByOwner = new Map<PlayerId, string[]>();
    for (const { action, ownerId } of selected) {
        events.push(...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: action.uid,
            defId: action.defId,
            ownerId,
            reason: BASE_HALLOWEEN_TOWN,
            now: ctx.now,
            expectedLocation: 'minion',
            sourcePlayerId: ctx.playerId,
            sourceDefId: BASE_HALLOWEEN_TOWN,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }));
        selectedByOwner.set(ownerId, [...(selectedByOwner.get(ownerId) ?? []), action.uid]);
    }
    for (const [ownerId, cardUids] of selectedByOwner) {
        const owner = ctx.state.players[ownerId];
        if (!owner) continue;
        const deckUids = [
            ...owner.deck.map(card => card.uid),
            ...cardUids,
        ];
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ownerId,
                deckUids: ctx.random ? ctx.random.shuffle(deckUids) : deckUids,
            },
            timestamp: ctx.now,
        } as DeckReorderedEvent);
    }
    return { events };
}

function spiralHillAfterScoring(ctx: BaseAbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const playerIds = Array.from(new Set(base.minions.map(minion => minion.controller)));
    const events: SmashUpEvent[] = [];
    for (const playerId of playerIds) {
        const discardCard = ctx.state.players[playerId]?.discard.find(card => isCharacterModifier(card.defId));
        if (discardCard) {
            events.push(recoverCardsFromDiscard(playerId, [discardCard.uid], BASE_SPIRAL_HILL, ctx.now));
            continue;
        }
        const attached = base.minions
            .flatMap(minion => minion.attachedActions)
            .find(action => isCharacterModifier(action.defId) && getActionOwnerId(action) === playerId);
        if (!attached) continue;
        events.push(...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: attached.uid,
            defId: attached.defId,
            ownerId: playerId,
            reason: BASE_SPIRAL_HILL,
            now: ctx.now,
            expectedLocation: 'minion',
            destination: 'hand',
            sourcePlayerId: playerId,
            sourceDefId: BASE_SPIRAL_HILL,
            sourceControllerId: playerId,
            sourceBaseIndex: ctx.baseIndex,
        }));
    }
    return { events };
}

function zombieDuckToyVp(state: SmashUpCore, baseIndex: number, playerId: PlayerId, currentVp: number): number {
    if (currentVp <= 0) return 0;
    const base = state.bases[baseIndex];
    if (!base) return 0;
    let delta = 0;
    for (const host of base.minions) {
        for (const action of host.attachedActions) {
            if (action.defId !== ZOMBIE_DUCK_TOY) continue;
            const controllerId = getActionControllerId(action);
            if (host.controller === controllerId && playerId === controllerId) delta += 1;
            if (host.controller !== controllerId && playerId === host.controller) delta -= 1;
        }
    }
    return delta;
}

export function registerNightmareBeforeChristmasAbilities(): void {
    registerAbilityProgram(JACK, 'onPlay', { program: createEffectProgram(jackOnPlay) });
    registerAbilityProgram(DR_FINKELSTEIN, 'talent', { program: createEffectProgram(drFinkelsteinTalent) });
    registerAbilityProgram(SALLY, 'talent', { program: createEffectProgram(sallyTalent) });
    registerAbilityProgram(LOCK_SHOCK_BARREL, 'special', { program: createEffectProgram(lockShockBarrelSpecial) });
    registerAbilityProgram(HALLOWEEN_TOWN_FOLKS, 'onPlay', { program: createEffectProgram(halloweenTownFolks) });
    registerAbilityProgram(CHRISTMAS_WILL_BE_OURS, 'onPlay', { program: createEffectProgram(christmasWillBeOurs) });
    registerAbilityProgram(GHOSTLY_PRESENTS, 'onPlay', { program: createEffectProgram(ghostlyPresents) });
    registerAbilityProgram(OOGIE_BOOGIE, 'onPlay', { program: createEffectProgram(oogieBoogie) });
    registerAbilityProgram(WINTER_SURPRISE, 'onPlay', { program: createEffectProgram(winterSurprise) });

    registerTrigger(JACK, 'onActionPlayed', jackOnCharacterModifierPlayed, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => ctx.playerId === ctx.sourceControllerId
            && !!ctx.triggerCardDefId
            && isCharacterModifier(ctx.triggerCardDefId),
    });
    registerTrigger(ZERO, 'afterScoring', zeroAfterScoring, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger(SANDY_CLAWS_COSTUME, 'afterScoring', sandyClawsAfterScoring, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerCardAbilitySuppression(OOGIE_BOOGIE, (state) => collectCharacterModifiers(state)
        .filter(entry => entry.action.defId === OOGIE_BOOGIE)
        .map(entry => entry.host.uid));
    registerBaseVpModifier(ZOMBIE_DUCK_TOY, zombieDuckToyVp);
    registerBaseAbility(BASE_HALLOWEEN_TOWN, 'afterScoring', halloweenTownAfterScoring, {
        mandatory: false,
        canTrigger: ctx => collectCharacterModifiers(ctx.state, ctx.baseIndex).length > 0,
    });
    registerBaseAbility(BASE_SPIRAL_HILL, 'afterScoring', spiralHillAfterScoring, {
        mandatory: false,
        canTrigger: ctx => {
            const base = ctx.state.bases[ctx.baseIndex];
            if (!base?.minions.length) return false;
            return collectCharacterModifiers(ctx.state, ctx.baseIndex).length > 0
                || Object.values(ctx.state.players).some(player => player.discard.some(card => isCharacterModifier(card.defId)));
        },
    });
}
