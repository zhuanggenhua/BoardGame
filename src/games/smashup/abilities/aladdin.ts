import type { PlayerId } from '../../../engine/types';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    buildValidatedCardToDeckBottomEvents,
    createSkipOption,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    revealHand,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerActiveBaseAbility, registerBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import type {
    CardInstance,
    CardTransferredEvent,
    CardsDiscardedEvent,
    RevealHandEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import {
    collectMinions,
    discardFirstHandAction,
    firstOtherBaseIndex,
    isActionCard,
    moveMinionToBase,
    ownMinionsAtBase,
    placeDiscardCardOnDeckTop,
    recoverFirstDiscardCard,
    revealTopAndDrawMatches,
    runtimeToAbilityResult,
    searchDeckOrDiscardToHand,
} from './disney_shared';

type WishMode = 'extraCards' | 'power' | 'draw';
type WishChoice = { mode?: WishMode; skip?: boolean };

const FALLBACK_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function transferCardToSelf(card: CardInstance, fromPlayerId: PlayerId, toPlayerId: PlayerId, reason: string, now: number): CardTransferredEvent {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            fromPlayerId,
            toPlayerId,
            ownerId: card.owner,
            reason,
        },
        timestamp: now,
    };
}

function discardActionCost(ctx: AbilityContext): SmashUpEvent[] | undefined {
    const discard = discardFirstHandAction(ctx);
    return discard ? [discard] : undefined;
}

function aladdinOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: searchDeckOrDiscardToHand(ctx, 'aladdin_the_lamp', 'aladdin_aladdin').events };
}

function aladdinTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: revealTopAndDrawMatches({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            untilFirst: true,
            maxPick: 1,
            predicate: card => isActionCard(card.defId),
            reason: 'aladdin_aladdin',
            now: ctx.now,
        }).events,
    };
}

function jasmineTalent(ctx: AbilityContext): AbilityResult {
    const cost = discardActionCost(ctx);
    if (!cost) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [
            ...cost,
            grantContextualExtraAction(ctx, 'aladdin_jasmine'),
        ],
    };
}

function rajahTalent(ctx: AbilityContext): AbilityResult {
    const self = ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex).find(minion => minion.uid === ctx.cardUid);
    const cost = discardActionCost(ctx);
    if (!self || !cost) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [
            ...cost,
            addTempPower(self.uid, ctx.baseIndex, 2, 'aladdin_rajah', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
        ],
    };
}

function palaceGuardTalent(ctx: AbilityContext): AbilityResult {
    const cost = discardActionCost(ctx);
    if (!cost) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    const guards = ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex)
        .filter(minion => minion.defId === 'aladdin_palace_guard');
    return {
        events: [
            ...cost,
            ...guards.map(guard => addPowerCounter(guard.uid, ctx.baseIndex, 1, 'aladdin_palace_guard', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            })),
        ],
    };
}

function abuOnPlay(ctx: AbilityContext): AbilityResult {
    const event = placeDiscardCardOnDeckTop(ctx, card => isActionCard(card.defId), 'aladdin_abu');
    return { events: event ? [event] : [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
}

function genieTalent(ctx: AbilityContext): AbilityResult {
    return { events: searchDeckOrDiscardToHand(ctx, 'aladdin_wish', 'aladdin_genie').events };
}

function carpetTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (!base || toBaseIndex === undefined) return { events: [] };
    const self = base.minions.find(minion => minion.uid === ctx.cardUid && minion.controller === ctx.playerId);
    if (!self) return { events: [] };
    const companions = base.minions
        .filter(minion => minion.controller === ctx.playerId && minion.uid !== self.uid)
        .slice(0, 2);
    const batch = [self, ...companions];
    return {
        events: batch.flatMap(minion =>
            moveMinionToBase(ctx.matchState, minion, ctx.baseIndex, toBaseIndex, ctx.playerId, 'aladdin_carpet', ctx.now)),
    };
}

function aFriendLikeMe(ctx: AbilityContext): AbilityResult {
    return {
        events: revealTopAndDrawMatches({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            count: 4,
            predicate: card => isActionCard(card.defId),
            reason: 'aladdin_a_friend_like_me',
            now: ctx.now,
        }).events,
    };
}

function caveOfWonders(ctx: AbilityContext): AbilityResult {
    return { events: recoverFirstDiscardCard(ctx, card => isActionCard(card.defId), 'aladdin_cave_of_wonders') };
}

function jafar(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const discardedActions: Array<{ card: CardInstance; playerId: PlayerId }> = [];
    for (const [otherPlayerId, player] of Object.entries(ctx.state.players)) {
        if (otherPlayerId === ctx.playerId) continue;
        const action = player.hand.find(card => isActionCard(card.defId));
        if (action) {
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: otherPlayerId, cardUids: [action.uid] },
                timestamp: ctx.now,
            } as CardsDiscardedEvent);
            discardedActions.push({ card: action, playerId: otherPlayerId });
        } else {
            events.push(revealHand(
                otherPlayerId,
                ctx.playerId,
                player.hand.map(card => ({ uid: card.uid, defId: card.defId })),
                'aladdin_jafar',
                ctx.now,
                ctx.playerId,
            ) as RevealHandEvent);
        }
    }

    const stolen = discardedActions[0];
    if (stolen) {
        events.push(transferCardToSelf(stolen.card, stolen.playerId, ctx.playerId, 'aladdin_jafar', ctx.now));
        events.push(grantContextualExtraAction(ctx, 'aladdin_jafar', { restrictToCardUid: stolen.card.uid }));
        return { events };
    }

    const ownAction = ctx.state.players[ctx.playerId]?.hand.find(card => card.uid !== ctx.cardUid && isActionCard(card.defId));
    if (ownAction) {
        events.push(grantContextualExtraAction(ctx, 'aladdin_jafar', { restrictToCardUid: ownAction.uid }));
    }
    return { events };
}

function magicCarpetRide(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const handCarpet = player.hand.find(card => card.defId === 'aladdin_carpet');
    if (handCarpet) {
        return { events: [grantContextualExtraMinion(ctx, 'aladdin_magic_carpet_ride', undefined, { specificCardUid: handCarpet.uid })] };
    }
    const search = searchDeckOrDiscardToHand(ctx, 'aladdin_carpet', 'aladdin_magic_carpet_ride');
    return {
        events: [
            ...search.events,
            ...(search.card
                ? [grantContextualExtraMinion(ctx, 'aladdin_magic_carpet_ride', undefined, { specificCardUid: search.card.uid })]
                : []),
        ],
    };
}

function streetRat(ctx: AbilityContext): AbilityResult {
    for (const [otherPlayerId, player] of Object.entries(ctx.state.players)) {
        if (otherPlayerId === ctx.playerId) continue;
        const action = player.discard.find(card => isActionCard(card.defId));
        if (!action) continue;
        return {
            events: [
                transferCardToSelf(action, otherPlayerId, ctx.playerId, 'aladdin_street_rat', ctx.now),
                grantContextualExtraAction(ctx, 'aladdin_street_rat', { restrictToCardUid: action.uid }),
            ],
        };
    }
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
}

function theLamp(ctx: AbilityContext): AbilityResult {
    const search = searchDeckOrDiscardToHand(ctx, 'aladdin_genie', 'aladdin_the_lamp');
    return {
        events: [
            ...search.events,
            ...buildValidatedCardToDeckBottomEvents(ctx.state, {
                cardUid: ctx.cardUid,
                defId: ctx.defId,
                ownerId: ctx.playerId,
                reason: 'aladdin_the_lamp',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
        ],
    };
}

const wishPromptProgram = createPromptProgram<AbilityContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_wish',
    buildInteraction: (ctx) => createAbilityRuntimeSimpleChoice(
        `aladdin_wish_${ctx.now}`,
        ctx.playerId,
        '许愿：选择一个效果',
        [
            createSkipOption('不使用许愿', 'ui.aladdin_wish_skip_option'),
            { id: 'extra-cards', label: '额外打出一张角色和一张战术', labelKey: 'ui.aladdin_wish_extra_cards_option', value: { mode: 'extraCards' } satisfies WishChoice, displayMode: 'button' },
            { id: 'power', label: '一个角色本回合 +5 力量', labelKey: 'ui.aladdin_wish_power_option', value: { mode: 'power' } satisfies WishChoice, displayMode: 'button' },
            { id: 'draw', label: '抽四张牌', labelKey: 'ui.aladdin_wish_draw_option', value: { mode: 'draw' } satisfies WishChoice, displayMode: 'button' },
        ],
        {
            sourceId: 'aladdin_wish',
            targetType: 'button',
            autoResolveIfSingle: false,
            titleKey: 'ui.aladdin_wish_title',
        },
    ),
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        const choice = value as WishChoice;
        if (choice.skip || !choice.mode) return { events: [] };
        const events: SmashUpEvent[] = [{
            type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
            payload: {
                playerId: context.playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                reason: 'aladdin_wish',
            },
            timestamp,
        } as SmashUpEvent];
        if (choice.mode === 'draw') {
            events.push(...buildStandardDrawEventsFromRuntimeContext(args, context.playerId, 4));
        } else if (choice.mode === 'extraCards') {
            events.push(grantContextualExtraMinion(context, 'aladdin_wish'));
            events.push(grantContextualExtraAction(context, 'aladdin_wish'));
        } else {
            const target = collectMinions(state.core, () => true)[0];
            if (target) {
                events.push(addTempPower(target.minion.uid, target.baseIndex, 5, 'aladdin_wish', timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: context.defId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                }));
            }
        }
        return { events };
    },
});

function wish(ctx: AbilityContext): AbilityResult {
    const hasGenie = ctx.state.bases.some(base =>
        base.minions.some(minion => minion.controller === ctx.playerId && minion.defId === 'aladdin_genie'));
    if (!hasGenie) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(wishPromptProgram, ctx));
}

function agrabahBazaar(ctx: BaseAbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const action = player.hand.find(card => isActionCard(card.defId));
    const targets = ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex);
    if (!action || targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    return {
        events: [
            {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: ctx.playerId, cardUids: [action.uid] },
                timestamp: ctx.now,
            } as CardsDiscardedEvent,
            addPowerCounter(targets[0].uid, ctx.baseIndex, 2, 'base_agrabah_bazaar', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'base_agrabah_bazaar',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
        ],
    };
}

function sultansPalace(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.minionUid || ctx.playerId === undefined) return { events: [] };
    const playedHereCount = ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
    if (playedHereCount !== 1) return { events: [] };
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random ?? FALLBACK_RANDOM, ctx.now),
    };
}

export function registerAladdinAbilities(): void {
    registerAbilityProgram('aladdin_aladdin', 'onPlay', { program: createEffectProgram(aladdinOnPlay) });
    registerAbilityProgram('aladdin_aladdin', 'talent', { program: createEffectProgram(aladdinTalent) });
    registerAbilityProgram('aladdin_jasmine', 'talent', { program: createEffectProgram(jasmineTalent) });
    registerAbilityProgram('aladdin_rajah', 'talent', { program: createEffectProgram(rajahTalent) });
    registerAbilityProgram('aladdin_rajah', 'special', { program: createEffectProgram(rajahTalent) });
    registerAbilityProgram('aladdin_palace_guard', 'talent', { program: createEffectProgram(palaceGuardTalent) });
    registerAbilityProgram('aladdin_abu', 'onPlay', { program: createEffectProgram(abuOnPlay) });
    registerAbilityProgram('aladdin_genie', 'talent', { program: createEffectProgram(genieTalent) });
    registerAbilityProgram('aladdin_carpet', 'talent', { program: createEffectProgram(carpetTalent) });
    registerAbilityProgram('aladdin_a_friend_like_me', 'onPlay', { program: createEffectProgram(aFriendLikeMe) });
    registerAbilityProgram('aladdin_cave_of_wonders', 'onPlay', { program: createEffectProgram(caveOfWonders) });
    registerAbilityProgram('aladdin_jafar', 'onPlay', { program: createEffectProgram(jafar) });
    registerAbilityProgram('aladdin_magic_carpet_ride', 'onPlay', { program: createEffectProgram(magicCarpetRide) });
    registerAbilityProgram('aladdin_street_rat', 'onPlay', { program: createEffectProgram(streetRat) });
    registerAbilityProgram('aladdin_the_lamp', 'onPlay', { program: createEffectProgram(theLamp) });
    registerAbilityProgram('aladdin_wish', 'onPlay', { program: createEffectProgram(wish) });
    registerActiveBaseAbility('base_agrabah_bazaar', agrabahBazaar, {
        oncePerTurn: false,
        canUse: ctx => (ctx.state.players[ctx.playerId]?.hand.some(card => isActionCard(card.defId)) ?? false)
            && ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex).length > 0,
    });
    registerBaseAbility('base_sultans_palace', 'onMinionPlayed', sultansPalace, {
        mandatory: false,
        canTrigger: ctx => (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1,
    });
}
