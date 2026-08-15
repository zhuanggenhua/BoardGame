import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    createSkipOption,
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

type BeautyDiscardEffect =
    | 'beast'
    | 'cogsworth'
    | 'lumiere'
    | 'mrs_potts'
    | 'gaston'
    | 'provincial_town'
    | 'gaston_tavern'
    | 'none';

type BeautyDiscardPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    baseIndex: number;
    cardUid?: string;
    defId?: string;
    discardCount: number;
    optional: boolean;
    excludeCardUid?: string;
    effect: BeautyDiscardEffect;
};

type BeautyDiscardChoice = {
    cardUid?: string;
    defId?: string;
    skip?: boolean;
};

type BeautyDiscardAfterCommittedContext = BeautyDiscardPromptContext & {
    random: RandomFn;
};

type DiscoverTheLibraryContext = BeautyDiscardPromptContext & {
    random: RandomFn;
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

function hasDiscardedFromHandThisTurn(ctx: AbilityContext | BaseAbilityContext): boolean {
    return ((ctx.state.cardsDiscardedFromHandThisTurn ?? {})[ctx.playerId] ?? 0) > 0;
}

function buildBeautyDiscardOptions(context: BeautyDiscardPromptContext): PromptOption<BeautyDiscardChoice>[] {
    const hand = context.matchState.core.players[context.playerId]?.hand ?? [];
    const options = hand
        .filter(card => card.uid !== context.excludeCardUid)
        .map(card => ({
            id: `discard:${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
        }));
    return context.optional
        ? [createSkipOption('不弃牌', 'ui.beauty_and_the_beast_skip_discard_option'), ...options]
        : options;
}

function resolveBeautyDiscardEffect(
    context: BeautyDiscardPromptContext,
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    timestamp: number,
): SmashUpEvent[] {
    const sourceContext = {
        state: state.core,
        matchState: state,
        playerId: context.playerId,
        cardUid: context.cardUid ?? '',
        defId: context.defId ?? '',
        baseIndex: context.baseIndex,
        random,
        now: timestamp,
    } satisfies AbilityContext;

    switch (context.effect) {
        case 'beast': {
            const self = state.core.bases[context.baseIndex]?.minions.find(minion =>
                minion.uid === context.cardUid && minion.controller === context.playerId,
            );
            return self ? [addPowerCounter(self.uid, context.baseIndex, 1, BEAST, timestamp, source(sourceContext))] : [];
        }
        case 'cogsworth':
            return [grantContextualExtraAction(sourceContext, 'beauty_and_the_beast_cogsworth')];
        case 'lumiere':
            return [grantContextualExtraMinion(sourceContext, 'beauty_and_the_beast_lumiere', context.baseIndex, { powerMax: 3 })];
        case 'mrs_potts':
            return buildStandardDrawEvents(state.core, context.playerId, 1, random, timestamp);
        case 'gaston':
            return buildValidatedOngoingDetachEvents(state.core, {
                cardUid: context.cardUid ?? '',
                defId: context.defId ?? '',
                ownerId: context.playerId,
                reason: GASTON,
                now: timestamp,
                expectedLocation: 'base',
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: context.defId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
            });
        case 'provincial_town':
            return [queueMinionPlayEffect(context.playerId, 'addPowerCounter', 1, timestamp, 'beauty_and_the_beast_this_provincial_town')];
        case 'gaston_tavern':
            return [grantContextualExtraMinion(sourceContext, BASE_GASTONS_TAVERN, context.baseIndex, { powerMax: 3 })];
        case 'none':
            return [];
    }
}

const beautyDiscardAfterCommittedProgram = createEffectProgram<BeautyDiscardAfterCommittedContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: resolveBeautyDiscardEffect(context, context.matchState, context.random, context.now),
    }),
);

const beautyDiscardPromptProgram = createPromptProgram<BeautyDiscardPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'beauty_and_the_beast_discard_hand',
    buildInteraction: context => {
        const options = buildBeautyDiscardOptions(context);
        const availableCount = options.filter(option => !option.value.skip).length;
        const requiredCount = Math.min(context.discardCount, availableCount);
        return createAbilityRuntimeSimpleChoice(
            `beauty_and_the_beast_discard_hand_${context.playerId}_${context.now}`,
            context.playerId,
            context.optional
                ? `选择至多 ${context.discardCount} 张手牌弃掉，或跳过`
                : `选择 ${context.discardCount} 张手牌弃掉`,
            options,
            {
                sourceId: 'beauty_and_the_beast_discard_hand',
                targetType: 'hand',
                multi: context.discardCount > 1 ? { min: context.optional ? 0 : requiredCount, max: requiredCount } : undefined,
                autoResolveIfSingle: !context.optional && requiredCount === 1,
                responseValidationMode: 'live',
                autoRefresh: 'hand',
            },
        );
    },
    onResolve: ({ context, state, random, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : [value]) as BeautyDiscardChoice[];
        if (choices.some(choice => choice?.skip)) return { events: [] };

        const liveHand = state.core.players[context.playerId]?.hand ?? [];
        const selectedUids = Array.from(new Set(
            choices
                .map(choice => choice?.cardUid)
                .filter((uid): uid is string => !!uid)
                .filter(uid => uid !== context.excludeCardUid && liveHand.some(card => card.uid === uid)),
        )).slice(0, context.discardCount);
        if (selectedUids.length !== context.discardCount) return { events: [] };

        const discardEvent = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: context.playerId, cardUids: selectedUids },
            timestamp,
        } as CardsDiscardedEvent;
        if (context.effect === 'none') return { events: [discardEvent] };
        return {
            events: [discardEvent],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                random,
            } satisfies BeautyDiscardAfterCommittedContext,
            nextProgram: beautyDiscardAfterCommittedProgram,
        };
    },
});

function runBeautyDiscardPrompt(
    context: Omit<BeautyDiscardPromptContext, 'matchState'> & { matchState?: MatchState<SmashUpCore> },
): AbilityResult {
    if (!context.matchState) return { events: [] };
    const availableCount = (context.matchState.core.players[context.playerId]?.hand ?? [])
        .filter(card => card.uid !== context.excludeCardUid).length;
    if (availableCount < context.discardCount) {
        return context.optional
            ? { events: [] }
            : { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_target', context.now)] };
    }
    return abilityFromRuntime(executeAbilityProgram(beautyDiscardPromptProgram, {
        ...context,
        matchState: context.matchState,
    }));
}

const discoverTheLibraryAfterCommittedDrawProgram = createEffectProgram<DiscoverTheLibraryContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        if ((context.matchState.core.players[context.playerId]?.hand.length ?? 0) === 0) return { events: [] };
        const prompt = runBeautyDiscardPrompt({
            ...context,
            matchState: context.matchState,
        });
        return {
            events: prompt.events,
            ...(prompt.matchState ? { matchState: prompt.matchState } : {}),
        };
    },
);

const discoverTheLibraryProgram = createEffectProgram<DiscoverTheLibraryContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: buildStandardDrawEvents(
            context.matchState.core,
            context.playerId,
            2,
            context.random,
            context.now,
        ),
        context,
        nextProgram: discoverTheLibraryAfterCommittedDrawProgram,
    }),
);

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
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion =>
        minion.uid === ctx.cardUid && minion.controller === ctx.playerId,
    );
    if (!self) return { events: [] };
    return runBeautyDiscardPrompt({
        ...ctx,
        discardCount: 1,
        optional: false,
        excludeCardUid: ctx.cardUid,
        effect: 'beast',
    });
}

function cogsworthTalent(ctx: AbilityContext): AbilityResult {
    return runBeautyDiscardPrompt({
        ...ctx,
        discardCount: 1,
        optional: false,
        excludeCardUid: ctx.cardUid,
        effect: 'cogsworth',
    });
}

function lumiereTalent(ctx: AbilityContext): AbilityResult {
    return runBeautyDiscardPrompt({
        ...ctx,
        discardCount: 1,
        optional: false,
        excludeCardUid: ctx.cardUid,
        effect: 'lumiere',
    });
}

function mrsPottsTalent(ctx: AbilityContext): AbilityResult {
    return runBeautyDiscardPrompt({
        ...ctx,
        discardCount: 1,
        optional: false,
        excludeCardUid: ctx.cardUid,
        effect: 'mrs_potts',
    });
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
    return runBeautyDiscardPrompt({
        ...ctx,
        discardCount: 2,
        optional: true,
        excludeCardUid: ctx.cardUid,
        effect: 'gaston',
    });
}

function breakTheCurse(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    return {
        events: ownMinionsAtBase(ctx.state, ctx.playerId, baseIndex)
            .map(minion => addTempPower(minion.uid, baseIndex, 1, BREAK_THE_CURSE, ctx.now, source(ctx))),
    };
}

function discoverTheLibrary(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState) {
        return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) };
    }
    return abilityFromRuntime(executeAbilityProgram(discoverTheLibraryProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        cardUid: ctx.cardUid,
        defId: ctx.defId,
        discardCount: 1,
        optional: false,
        excludeCardUid: ctx.cardUid,
        effect: 'none',
        random: ctx.random,
    }));
}

function everASurprise(ctx: AbilityContext): AbilityResult {
    return {
        events: shuffleFirstDiscardCardsIntoDeck(ctx, card => isMinionCard(card.defId), 2, EVER_A_SURPRISE),
    };
}

function thisProvincialTown(ctx: AbilityContext): AbilityResult {
    const extraMinion = grantContextualExtraMinion(ctx, 'beauty_and_the_beast_this_provincial_town', ctx.baseIndex, { powerMax: 3 });
    if (!ctx.matchState || (ctx.state.players[ctx.playerId]?.hand.length ?? 0) === 0) return { events: [extraMinion] };
    const prompt = runBeautyDiscardPrompt({
        ...ctx,
        discardCount: 1,
        optional: true,
        excludeCardUid: ctx.cardUid,
        effect: 'provincial_town',
    });
    return { events: [extraMinion, ...prompt.events], matchState: prompt.matchState };
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
    return runBeautyDiscardPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        discardCount: 1,
        optional: false,
        effect: 'gaston_tavern',
    });
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
