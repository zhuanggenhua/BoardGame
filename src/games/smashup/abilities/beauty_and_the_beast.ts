import type { MatchState, PlayerId } from '../../../engine/types';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    queueMinionPlayEffect,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerActiveBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import type { BaseMetadataUpdatedEvent, CardsDiscardedEvent, DeckInspectedEvent, DeckReorderedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
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

type BelleTalentChoice =
    | { mode: 'draw' }
    | { mode: 'discard'; cardUid: string; defId: string };

type BelleTalentContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type PetalsChoice = { mode: 'keep' } | { mode: 'swap' };

type PetalsContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

function abilityFromRuntime(result: { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> }): AbilityResult {
    return result.matchState ? { events: result.events, matchState: result.matchState } : { events: result.events };
}

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

const belleTalentPromptProgram = createPromptProgram<BelleTalentContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'beauty_and_the_beast_belle_talent',
    buildInteraction: (context) => {
        const hand = context.matchState.core.players[context.playerId]?.hand ?? [];
        const options: PromptOption<BelleTalentChoice>[] = [
            {
                id: 'draw',
                label: '摸 1 张牌',
                labelKey: 'ui.beauty_and_the_beast_belle_talent_draw',
                value: { mode: 'draw' },
                displayMode: 'button',
            },
            ...hand.map(card => ({
                id: `discard:${card.uid}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { mode: 'discard' as const, cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            })),
        ];
        return createAbilityRuntimeSimpleChoice(
            `beauty_and_the_beast_belle_talent_${context.playerId}_${context.now}`,
            context.playerId,
            '贝儿：选择摸 1 张牌或弃 1 张牌',
            options,
            {
                sourceId: 'beauty_and_the_beast_belle_talent',
                targetType: 'card',
                titleKey: 'ui.beauty_and_the_beast_belle_talent_title',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: (args) => {
        const { state, playerId, value, timestamp } = args;
        const choice = value as BelleTalentChoice | undefined;
        if (choice?.mode === 'discard') {
            const liveCard = state.core.players[playerId]?.hand.find(card => card.uid === choice.cardUid);
            if (!liveCard) return { events: [] };
            return {
                events: [{
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId, cardUids: [liveCard.uid] },
                    timestamp,
                } as CardsDiscardedEvent],
            };
        }
        return { events: buildStandardDrawEventsFromRuntimeContext(args, playerId, 1) };
    },
});

function belleTalent(ctx: AbilityContext): AbilityResult {
    return abilityFromRuntime(executeAbilityProgram(belleTalentPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    }));
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

const petalsPromptProgram = createPromptProgram<PetalsContext, SmashUpCore, SmashUpEvent>({
    sourceId: PETALS_OF_THE_ROSE,
    buildInteraction: (context) => {
        const deck = context.matchState.core.players[context.playerId]?.deck ?? [];
        const options: PromptOption<PetalsChoice>[] = [
            {
                id: 'keep',
                label: '保持当前顺序',
                labelKey: 'ui.beauty_and_the_beast_petals_keep',
                value: { mode: 'keep' },
                displayMode: 'button',
            },
            ...(deck.length >= 2
                ? [{
                    id: 'swap',
                    label: '交换前两张',
                    labelKey: 'ui.beauty_and_the_beast_petals_swap',
                    value: { mode: 'swap' as const },
                    displayMode: 'button' as const,
                }]
                : []),
        ];
        return createAbilityRuntimeSimpleChoice(
            `beauty_and_the_beast_petals_${context.playerId}_${context.now}`,
            context.playerId,
            '玫瑰花瓣：查看并重排牌库顶',
            options,
            {
                sourceId: PETALS_OF_THE_ROSE,
                targetType: 'generic',
                titleKey: 'ui.beauty_and_the_beast_petals_title',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const player = state.core.players[playerId];
        if (!player || player.deck.length === 0) return { events: [] };
        const choice = value as PetalsChoice | undefined;
        const top = player.deck.slice(0, 2);
        const rest = player.deck.slice(2);
        const deckUids = choice?.mode === 'swap' && top.length >= 2
            ? [top[1].uid, top[0].uid, ...rest.map(card => card.uid)]
            : player.deck.map(card => card.uid);
        return {
            events: [
                {
                    type: SU_EVENTS.DECK_INSPECTED,
                    payload: {
                        targetPlayerId: playerId,
                        inspectorPlayerId: playerId,
                        count: Math.min(2, player.deck.length),
                        reason: PETALS_OF_THE_ROSE,
                    },
                    timestamp,
                } as DeckInspectedEvent,
                {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids },
                    timestamp,
                } as DeckReorderedEvent,
            ],
        };
    },
});

function petalsOfTheRose(ctx: TriggerContext): TriggerResult {
    if (!wasHandDiscard(ctx) || ctx.playerId !== ctx.sourceControllerId) return [];
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.deck.length === 0) return [];
    if (!ctx.matchState) {
        return { events: [{
        type: SU_EVENTS.DECK_INSPECTED,
        payload: {
            targetPlayerId: ctx.playerId,
            inspectorPlayerId: ctx.playerId,
            count: Math.min(2, player.deck.length),
            reason: PETALS_OF_THE_ROSE,
        },
        timestamp: ctx.now,
        } as DeckInspectedEvent] };
    }
    return executeAbilityProgram(petalsPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    });
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
        globalZones: ['hand', 'discard'],
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => wasHandDiscard(ctx)
            && !!ctx.sourceCardUid
            && (ctx.discardedCards ?? []).some(card => card.uid === ctx.sourceCardUid && card.defId === ENCHANTED_OBJECTS),
    });
    registerTrigger(PETALS_OF_THE_ROSE, 'onCardsDiscarded', petalsOfTheRose, {
        perInstance: true,
        global: true,
        globalZones: ['hand', 'discard'],
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => wasHandDiscard(ctx)
            && ctx.playerId === ctx.sourceControllerId
            && !!ctx.sourceCardUid
            && (ctx.discardedCards ?? []).some(card => card.uid === ctx.sourceCardUid && card.defId === PETALS_OF_THE_ROSE),
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
