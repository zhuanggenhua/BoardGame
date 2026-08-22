import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerActiveBaseAbility, registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEventsFromRuntimeContext,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    canControllerPlayTitan,
    createSkipOption,
    getMinionPower,
    playTitan,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { getBaseDef, getCardDef } from '../data/cards';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import type {
    CardInstance,
    DeckReorderedEvent,
    MinionCardDef,
    MinionMetadataUpdatedEvent,
    MinionPlayedEvent,
    SmashUpCore,
    SmashUpEvent,
    TitanState,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import {
    SHAYU_TRIGGER_CONTRACT,
    type BaseChoice,
    type ButtonChoice,
    type CardChoice,
    type MinionChoice,
    type MinionTarget,
    type PromptContext,
    collectBaseTargets,
    collectMinionTargets,
} from './shayu_common';

type OptionalMinionEffect = 'counter' | 'temp_power' | 'destroy';

type OptionalMinionContext = PromptContext & {
    sourceId: string;
    title: string;
    targets: MinionTarget[];
    effect: OptionalMinionEffect;
    optional?: boolean;
};

type MoveMinionContext = PromptContext & {
    sourceId: string;
    title: string;
    targets: MinionTarget[];
};

type MoveDestinationContext = PromptContext & {
    sourceId: string;
    sourceDefId: string;
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    destinations: Array<{ baseIndex: number; label: string }>;
};

type DrawChoiceContext = PromptContext & {
    canDraw: boolean;
};

type LeafarooContext = PromptContext & {
    cards: Array<{ uid: string; defId: string; label: string }>;
};

type SuperEffectiveContext = PromptContext & {
    actions: Array<{ uid: string; defId: string; ownerId: string; label: string }>;
};

type TemporaryMinionCard = {
    uid: string;
    defId: string;
    power: number;
    label: string;
    from: 'hand' | 'deck' | 'discard';
};

type TemporaryMinionChoiceContext = PromptContext & {
    sourceId: string;
    title: string;
    cards: TemporaryMinionCard[];
    fixedBaseIndex?: number;
    optional?: boolean;
};

type TemporaryMinionBaseContext = PromptContext & {
    sourceId: string;
    card: TemporaryMinionCard;
    destinations: Array<{ baseIndex: number; label: string }>;
};

type EvolutionChoice = {
    cardUid?: string;
    titanUid?: string;
    defId?: string;
    choice?: 'deck_minion' | 'rainboroc';
};

type EvolutionContext = PromptContext & {
    sourceMinionUid: string;
    sourceMinionDefId: string;
    sourceBaseIndex: number;
    cards: TemporaryMinionCard[];
    rainboroc?: TitanState;
};

type BaseExtraMinionContext = PromptContext & {
    baseIndex: number;
    cards: TemporaryMinionCard[];
};

type IttyCityContext = PromptContext & {
    baseIndex: number;
    cards: CardInstance[];
};

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseLabel(state: SmashUpCore, baseIndex: number): string {
    return getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
}

function collectOtherMinionsHere(ctx: AbilityContext, predicate: (target: MinionTarget) => boolean = () => true): MinionTarget[] {
    return collectMinionTargets(ctx.state, (minion, baseIndex) => {
        if (baseIndex !== ctx.baseIndex) return false;
        if (minion.uid === ctx.cardUid) return false;
        return predicate({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${cardLabel(minion.defId)} @ ${baseLabel(ctx.state, baseIndex)}（力量 ${getMinionPower(ctx.state, minion, baseIndex)}）`,
        });
    });
}

function noTargets(ctx: AbilityContext): AbilityResult {
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
}

function minionCardPower(defId: string): number | undefined {
    const def = getCardDef(defId);
    return def?.type === 'minion' ? (def as MinionCardDef).power : undefined;
}

function buildTemporaryMinionEvents(
    state: SmashUpCore,
    playerId: string,
    card: TemporaryMinionCard,
    baseIndex: number,
    timestamp: number,
): SmashUpEvent[] {
    if (!state.bases[baseIndex]) return [];
    return [
        {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: card.uid,
                defId: card.defId,
                baseIndex,
                baseDefId: state.bases[baseIndex].defId,
                power: card.power,
                ...(card.from === 'deck' ? { fromDeck: true } : {}),
                ...(card.from === 'discard' ? { fromDiscard: true } : {}),
                consumesNormalLimit: false,
            },
            timestamp,
        } as MinionPlayedEvent,
        {
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: {
                minionUid: card.uid,
                baseIndex,
                metadataUpdate: { ittyCrittersReturnToDeckBottomPlayerId: playerId },
                reason: 'itty_critters_temporary_minion',
            },
            timestamp,
        } as MinionMetadataUpdatedEvent,
    ];
}

function collectDeckMinions(ctx: AbilityContext, powerMax: number): TemporaryMinionCard[] {
    const player = ctx.state.players[ctx.playerId];
    return (player?.deck ?? [])
        .map(card => ({ card, power: minionCardPower(card.defId) }))
        .filter((entry): entry is { card: CardInstance; power: number } => entry.power !== undefined && entry.power <= powerMax)
        .map(({ card, power }) => ({
            uid: card.uid,
            defId: card.defId,
            power,
            label: `${cardLabel(card.defId)}（力量 ${power}）`,
            from: 'deck' as const,
        }));
}

function collectHandMinionsFromBaseContext(ctx: BaseAbilityContext, powerMax: number): TemporaryMinionCard[] {
    const player = ctx.state.players[ctx.playerId];
    return (player?.hand ?? [])
        .map(card => ({ card, power: minionCardPower(card.defId) }))
        .filter((entry): entry is { card: CardInstance; power: number } => entry.power !== undefined && entry.power <= powerMax)
        .map(({ card, power }) => ({
            uid: card.uid,
            defId: card.defId,
            power,
            label: `${cardLabel(card.defId)}（力量 ${power}）`,
            from: 'hand' as const,
        }));
}

function collectDiscardMinions(ctx: AbilityContext, powerMax: number): TemporaryMinionCard[] {
    const player = ctx.state.players[ctx.playerId];
    return (player?.discard ?? [])
        .map(card => ({ card, power: minionCardPower(card.defId) }))
        .filter((entry): entry is { card: CardInstance; power: number } => entry.power !== undefined && entry.power <= powerMax)
        .map(({ card, power }) => ({
            uid: card.uid,
            defId: card.defId,
            power,
            label: `${cardLabel(card.defId)}（力量 ${power}）`,
            from: 'discard' as const,
        }));
}

function findMinionOnBoard(state: SmashUpCore, minionUid?: string): { minion: SmashUpCore['bases'][number]['minions'][number]; baseIndex: number } | undefined {
    if (!minionUid) return undefined;
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const minion = state.bases[baseIndex]?.minions.find(candidate => candidate.uid === minionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function buildDeckShuffleWithCardEvent(
    state: SmashUpCore,
    playerId: string,
    card: CardInstance,
    random: AbilityContext['random'],
    timestamp: number,
): DeckReorderedEvent {
    const player = state.players[playerId];
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: random.shuffle([...(player?.deck ?? []), card]).map(candidate => candidate.uid),
        },
        timestamp,
    };
}

const temporaryMinionBasePromptProgram = createPromptProgram<TemporaryMinionBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_temporary_minion_base',
    interactionSourceIds: [
        'itty_critters_i_select_you_base',
        'itty_critters_recall_critter_base',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        '选择额外随从打出的基地',
        buildBaseTargetOptions(context.destinations, context.matchState.core),
        {
            sourceId: context.sourceId,
            titleKey: 'ui.itty_critters_temporary_minion_base_title',
            targetType: 'base',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        return {
            events: buildTemporaryMinionEvents(state.core, playerId, context.card, choice.baseIndex, timestamp),
        };
    },
});

const baseExtraMinionPromptProgram = createPromptProgram<BaseExtraMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_critter_combat_club',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `base_critter_combat_club_${context.now}`,
        context.playerId,
        '宠物战斗俱乐部：选择力量≤2的额外随从打到这里',
        context.cards.map((card, index) => ({
            id: `hand-minion-${index}`,
            label: card.label,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
            _source: 'hand' as const,
        })),
        {
            sourceId: 'base_critter_combat_club',
            titleKey: 'ui.itty_critters_critter_combat_club_title',
            targetType: 'hand',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as CardChoice;
        if (!choice.cardUid) return { events: [] };
        const card = context.cards.find(candidate => candidate.uid === choice.cardUid);
        if (!card) return { events: [] };
        return {
            events: buildTemporaryMinionEvents(state.core, playerId, card, context.baseIndex, timestamp),
        };
    },
});

const ittyCityPromptProgram = createPromptProgram<IttyCityContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_itty_city',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `base_itty_city_${context.now}`,
        context.playerId,
        '小城市：你可以随机将弃牌堆一个随从洗入牌库',
        [
            createSkipOption(),
            {
                id: 'shuffle',
                label: '随机洗回一个随从',
                labelKey: 'ui.itty_critters_itty_city_shuffle_option',
                value: { choice: 'shuffle' },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'base_itty_city',
            titleKey: 'ui.itty_critters_itty_city_title',
            targetType: 'button',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const choice = value as ButtonChoice<'shuffle'>;
        if (choice.skip || choice.choice !== 'shuffle') return { events: [] };
        const player = state.core.players[playerId];
        if (!player) return { events: [] };
        const discardMinions = context.cards.filter(card => player.discard.some(candidate => candidate.uid === card.uid));
        const selected = random.shuffle([...discardMinions])[0];
        if (!selected) return { events: [] };
        return {
            events: [buildDeckShuffleWithCardEvent(state.core, playerId, selected, random, timestamp)],
        };
    },
});

const temporaryMinionChoicePromptProgram = createPromptProgram<TemporaryMinionChoiceContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_temporary_minion_choice',
    interactionSourceIds: [
        'itty_critters_i_select_you',
        'itty_critters_recall_critter',
        'itty_critters_critter_coach',
        'itty_critters_critter_champion',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...context.cards.map((card, index) => ({
                id: `card-${index}`,
                label: card.label,
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: context.sourceId, targetType: 'button', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as CardChoice;
        if (choice.skip || !choice.cardUid) return { events: [] };
        const card = context.cards.find(candidate => candidate.uid === choice.cardUid);
        if (!card) return { events: [] };
        if (context.fixedBaseIndex !== undefined) {
            return {
                events: buildTemporaryMinionEvents(state.core, playerId, card, context.fixedBaseIndex, timestamp),
            };
        }
        const destinations = collectBaseTargets(state.core);
        if (destinations.length === 0) return { events: [] };
        if (destinations.length === 1) {
            return {
                events: buildTemporaryMinionEvents(state.core, playerId, card, destinations[0].baseIndex, timestamp),
            };
        }
        return executeAbilityProgram(temporaryMinionBasePromptProgram, {
            matchState: state,
            playerId,
            now: timestamp,
            sourceId: `${context.sourceId}_base`,
            card,
            destinations,
        });
    },
});

const evolutionPromptProgram = createPromptProgram<EvolutionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_evolution',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `itty_critters_evolution_${context.now}`,
        context.playerId,
        '进化论：选择进化结果',
        [
            ...(context.rainboroc ? [{
                id: 'rainboroc',
                label: '打出彩虹鸟到这里',
                labelKey: 'ui.itty_critters_evolution_rainboroc_option',
                value: { choice: 'rainboroc', titanUid: context.rainboroc.uid, defId: context.rainboroc.defId },
                displayMode: 'card' as const,
            }] : []),
            ...context.cards.map((card, index) => ({
                id: `deck-minion-${index}`,
                label: card.label,
                value: { choice: 'deck_minion', cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: 'itty_critters_evolution',
            titleKey: 'ui.itty_critters_evolution_title',
            targetType: 'button',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as EvolutionChoice;
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion => minion.uid === context.sourceMinionUid);
        if (!source || source.controller !== playerId) return { events: [] };

        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: context.sourceMinionUid,
            minionDefId: context.sourceMinionDefId,
            fromBaseIndex: context.sourceBaseIndex,
            destroyerId: playerId,
            sourcePlayerId: playerId,
            sourceCardUid: context.sourceMinionUid,
            sourceDefId: context.sourceMinionDefId,
            sourceControllerId: playerId,
            sourceBaseIndex: context.sourceBaseIndex,
            reason: 'itty_critters_evolution',
            now: timestamp,
        });
        if (destroyEvents.length === 0) return { events: [] };

        if (choice.choice === 'rainboroc' && choice.titanUid && context.rainboroc?.uid === choice.titanUid) {
            const titan = state.core.titans?.find(candidate =>
                candidate.uid === choice.titanUid
                && candidate.defId === 'itty_critters_rainboroc'
                && candidate.controllerId === playerId
                && candidate.location.zone === 'setaside',
            );
            if (!titan || !canControllerPlayTitan(state.core, playerId, titan.uid)) return { events: [] };
            return {
                events: [
                    ...destroyEvents,
                    playTitan(
                        titan,
                        playerId,
                        context.sourceBaseIndex,
                        'itty_critters_evolution',
                        timestamp,
                        state.core.bases[context.sourceBaseIndex]?.defId,
                    ),
                ],
            };
        }

        if (choice.choice === 'deck_minion' && choice.cardUid) {
            const card = context.cards.find(candidate => candidate.uid === choice.cardUid);
            if (!card) return { events: [] };
            return {
                events: [
                    ...destroyEvents,
                    ...buildTemporaryMinionEvents(state.core, playerId, card, context.sourceBaseIndex, timestamp),
                ],
            };
        }

        return { events: [] };
    },
});

const optionalMinionPromptProgram = createPromptProgram<OptionalMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_optional_minion',
    interactionSourceIds: [
        'itty_critters_calicoin',
        'itty_critters_krakatoad',
        'itty_critters_shellshock',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...buildMinionTargetOptions(context.targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceId,
                effectType: context.effect === 'destroy' ? 'destroy' : 'buff',
            }),
        ],
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const choice = value as MinionChoice;
        if (choice.skip || !choice.minionUid || choice.baseIndex === undefined || !choice.defId) return { events: [] };

        if (context.effect === 'counter') {
            return { events: [addPowerCounter(choice.minionUid, choice.baseIndex, 1, context.sourceId, timestamp)] };
        }
        if (context.effect === 'temp_power') {
            return { events: [addTempPower(choice.minionUid, choice.baseIndex, 2, context.sourceId, timestamp)] };
        }
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: choice.minionUid,
                minionDefId: choice.defId,
                fromBaseIndex: choice.baseIndex,
                destroyerId: playerId,
                sourcePlayerId: playerId,
                sourceDefId: context.sourceId,
                sourceControllerId: playerId,
                reason: context.sourceId,
                now: timestamp,
            }),
        };
    },
});

function runOptionalMinionEffect(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    targets: MinionTarget[],
    effect: OptionalMinionEffect,
    optional = true,
): AbilityResult {
    if (targets.length === 0) return noTargets(ctx);
    return executeAbilityProgram(optionalMinionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        targets,
        effect,
        optional,
    });
}

const tadpourChooseMinionProgram = createPromptProgram<MoveMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_tadpour',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            createSkipOption(),
            ...buildMinionTargetOptions(context.targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceKind: 'nonAction',
                effectType: 'move',
            }),
        ],
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice;
        if (choice.skip || !choice.minionUid || choice.baseIndex === undefined || !choice.defId) return { events: [] };
        const destinations = collectBaseTargets(state.core, baseIndex => baseIndex !== choice.baseIndex);
        if (destinations.length === 0) return { events: [] };
        return executeAbilityProgram(tadpourDestinationProgram, {
            matchState: state,
            playerId,
            now: timestamp,
            sourceId: 'itty_critters_tadpour_dest',
            sourceDefId: 'itty_critters_tadpour',
            minionUid: choice.minionUid,
            minionDefId: choice.defId,
            fromBaseIndex: choice.baseIndex,
            destinations,
        });
    },
});

const tadpourDestinationProgram = createPromptProgram<MoveDestinationContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_tadpour_dest',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        'Tadpour：选择移动目标基地',
        buildBaseTargetOptions(context.destinations, context.matchState.core),
        {
            sourceId: context.sourceId,
            titleKey: 'ui.itty_critters_tadpour_dest_title',
            targetType: 'base',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        return {
            events: buildValidatedMoveEvents(state, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: choice.baseIndex,
                toBaseDefId: choice.baseDefId,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.fromBaseIndex,
                reason: context.sourceId,
                now: timestamp,
            }),
        };
    },
});

const flooffairyPromptProgram = createPromptProgram<DrawChoiceContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_flooffairy',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `itty_critters_flooffairy_${context.now}`,
        context.playerId,
        'Flooffairy：你可以抽一张牌',
        [
            createSkipOption(),
            {
                id: 'draw',
                label: '抽一张牌',
                labelKey: 'ui.itty_critters_flooffairy_draw_option',
                value: { choice: 'draw' },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'itty_critters_flooffairy',
            titleKey: 'ui.itty_critters_flooffairy_title',
            targetType: 'button',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: (args) => {
        const choice = args.value as ButtonChoice<'draw'>;
        if (choice.skip || choice.choice !== 'draw') return { events: [] };
        return { events: buildStandardDrawEventsFromRuntimeContext(args, args.playerId, 1) };
    },
});

const leafarooPromptProgram = createPromptProgram<LeafarooContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_leafaroo',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `itty_critters_leafaroo_${context.now}`,
        context.playerId,
        'Leafaroo：你可以将弃牌堆一张牌洗入牌库',
        [
            createSkipOption(),
            ...context.cards.map((card, index) => ({
                id: `discard-${index}`,
                label: card.label,
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
                _source: 'discard' as const,
            })),
        ],
        {
            sourceId: 'itty_critters_leafaroo',
            titleKey: 'ui.itty_critters_leafaroo_title',
            targetType: 'discard',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = value as CardChoice;
        if (choice.skip || !choice.cardUid) return { events: [] };
        const player = state.core.players[context.playerId];
        const selected = player?.discard.find(card => card.uid === choice.cardUid);
        if (!player || !selected) return { events: [] };
        const nextDeck = random.shuffle([...player.deck, selected]);
        return {
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId: context.playerId, deckUids: nextDeck.map(card => card.uid) },
                timestamp,
            } as DeckReorderedEvent],
        };
    },
});

const superEffectivePromptProgram = createPromptProgram<SuperEffectiveContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'itty_critters_super_effective',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `itty_critters_super_effective_${context.now}`,
        context.playerId,
        '超级有效！：选择一个行动牌消灭',
        context.actions.map((action, index) => ({
            id: `action-${index}`,
            label: action.label,
            value: { cardUid: action.uid, defId: action.defId, ownerId: action.ownerId },
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'itty_critters_super_effective',
            titleKey: 'ui.itty_critters_super_effective_title',
            targetType: 'ongoing',
        },
    ),
    onResolve: ({ state, value, timestamp }) => {
        const choice = value as CardChoice;
        if (!choice.cardUid || !choice.defId || !choice.ownerId) return { events: [] };
        return {
            events: buildValidatedOngoingDetachEvents(state, {
                cardUid: choice.cardUid,
                defId: choice.defId,
                ownerId: choice.ownerId,
                reason: 'itty_critters_super_effective',
                now: timestamp,
            }),
        };
    },
});

function flooffairy(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.deck.length + player.discard.length === 0) return { events: [] };
    return executeAbilityProgram(flooffairyPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        canDraw: true,
    });
}

function runTemporaryDeckMinionSearch(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    powerMax: number,
    fixedBaseIndex?: number,
    optional = false,
): AbilityResult {
    const cards = collectDeckMinions(ctx, powerMax);
    if (cards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    return executeAbilityProgram(temporaryMinionChoicePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        cards,
        ...(fixedBaseIndex !== undefined ? { fixedBaseIndex } : {}),
        optional,
    });
}

function runTemporaryDiscardMinionSearch(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    powerMax: number,
): AbilityResult {
    const cards = collectDiscardMinions(ctx, powerMax);
    if (cards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    return executeAbilityProgram(temporaryMinionChoicePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        cards,
    });
}

function iSelectYou(ctx: AbilityContext): AbilityResult {
    return runTemporaryDeckMinionSearch(
        ctx,
        'itty_critters_i_select_you',
        '我选择你！：从牌库选择力量≤3的随从作为额外随从打出',
        3,
    );
}

function recallCritter(ctx: AbilityContext): AbilityResult {
    return runTemporaryDiscardMinionSearch(
        ctx,
        'itty_critters_recall_critter',
        '召回萌宠：从弃牌堆选择力量≤2的随从作为额外随从打出',
        2,
    );
}

function evolution(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBoard(ctx.state, ctx.targetMinionUid);
    if (!source || source.minion.controller !== ctx.playerId) return noTargets(ctx);

    const sourcePower = getMinionPower(ctx.state, source.minion, source.baseIndex);
    const cards = collectDeckMinions(ctx, sourcePower + 1);
    const rainboroc = ctx.state.titans?.find(candidate =>
        candidate.defId === 'itty_critters_rainboroc'
        && candidate.controllerId === ctx.playerId
        && candidate.location.zone === 'setaside'
        && canControllerPlayTitan(ctx.state, ctx.playerId, candidate.uid),
    );

    if (!rainboroc && cards.length === 0) return noTargets(ctx);
    return executeAbilityProgram(evolutionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceMinionUid: source.minion.uid,
        sourceMinionDefId: source.minion.defId,
        sourceBaseIndex: source.baseIndex,
        cards,
        ...(rainboroc ? { rainboroc } : {}),
    });
}

function critterCube(ctx: AbilityContext): AbilityResult {
    const target = findMinionOnBoard(ctx.state, ctx.targetMinionUid);
    if (!target || getMinionPower(ctx.state, target.minion, target.baseIndex) > 3) return noTargets(ctx);

    const returnedCard: CardInstance = {
        uid: target.minion.uid,
        defId: target.minion.defId,
        type: 'minion',
        owner: target.minion.owner,
    };
    const toDeckEvents = buildValidatedCardToDeckBottomEvents(ctx.state, {
        cardUid: target.minion.uid,
        defId: target.minion.defId,
        ownerId: ctx.playerId,
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
        reason: 'itty_critters_critter_cube',
        now: ctx.now,
        expectedLocation: 'bases',
    });
    if (toDeckEvents.length === 0) return noTargets(ctx);

    return {
        events: [
            ...toDeckEvents,
            buildDeckShuffleWithCardEvent(ctx.state, ctx.playerId, returnedCard, ctx.random, ctx.now),
        ],
    };
}

function critterCoach(ctx: AbilityContext): AbilityResult {
    return runTemporaryDeckMinionSearch(
        ctx,
        'itty_critters_critter_coach',
        '导师：你可以从牌库选择力量≤2的随从作为额外随从打到这里',
        2,
        ctx.baseIndex,
        true,
    );
}

function critterChampion(ctx: AbilityContext): AbilityResult {
    return runTemporaryDeckMinionSearch(
        ctx,
        'itty_critters_critter_champion',
        '萌宠冠军：从牌库选择力量≤2的随从作为额外随从打到这里',
        2,
        ctx.baseIndex,
    );
}

function leafaroo(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const cards = (player?.discard ?? []).map(card => ({
        uid: card.uid,
        defId: card.defId,
        label: cardLabel(card.defId),
    }));
    if (cards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    return executeAbilityProgram(leafarooPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cards,
    });
}

function calicoin(ctx: AbilityContext): AbilityResult {
    return runOptionalMinionEffect(
        ctx,
        'itty_critters_calicoin',
        'Calicoin：你可以给这里另一个随从放置 +1 指示物',
        collectOtherMinionsHere(ctx),
        'counter',
    );
}

function krakatoad(ctx: AbilityContext): AbilityResult {
    return runOptionalMinionEffect(
        ctx,
        'itty_critters_krakatoad',
        'Krakatoad：你可以使这里另一个随从直到回合结束 +2 力量',
        collectOtherMinionsHere(ctx),
        'temp_power',
    );
}

function shellshock(ctx: AbilityContext): AbilityResult {
    return runOptionalMinionEffect(
        ctx,
        'itty_critters_shellshock',
        'Shellshock：你可以消灭这里另一个力量≤2的随从',
        collectOtherMinionsHere(ctx, target => {
            const minion = ctx.state.bases[target.baseIndex]?.minions.find(candidate => candidate.uid === target.uid);
            return !!minion && getMinionPower(ctx.state, minion, target.baseIndex) <= 2;
        }),
        'destroy',
    );
}

function tadpour(ctx: AbilityContext): AbilityResult {
    const targets = collectOtherMinionsHere(ctx).filter(target => ctx.state.bases.some((_base, index) => index !== target.baseIndex));
    if (targets.length === 0) return noTargets(ctx);
    return executeAbilityProgram(tadpourChooseMinionProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'itty_critters_tadpour',
        title: 'Tadpour：你可以将这里另一个随从移动到另一个基地',
        targets,
    });
}

function gottaGetEmAll(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const selectedByDef = new Map<string, typeof player.discard[number]>();
    for (const card of player.discard) {
        if (card.type !== 'minion') continue;
        if (!selectedByDef.has(card.defId)) {
            selectedByDef.set(card.defId, card);
        }
    }
    if (selectedByDef.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const nextDeck = ctx.random.shuffle([...player.deck, ...selectedByDef.values()]);
    return {
        events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId: ctx.playerId, deckUids: nextDeck.map(card => card.uid) },
            timestamp: ctx.now,
        } as DeckReorderedEvent],
    };
}

function superEffective(ctx: AbilityContext): AbilityResult {
    const actions: SuperEffectiveContext['actions'] = [];
    for (const base of ctx.state.bases) {
        for (const action of base.ongoingActions) {
            actions.push({
                uid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                label: cardLabel(action.defId),
            });
        }
        for (const minion of base.minions) {
            for (const action of minion.attachedActions) {
                actions.push({
                    uid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    label: `${cardLabel(action.defId)} @ ${cardLabel(minion.defId)}`,
                });
            }
        }
    }
    if (actions.length === 0) return noTargets(ctx);
    return executeAbilityProgram(superEffectivePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        actions,
    });
}

function coachCombat(ctx: AbilityContext): AbilityResult {
    const source = ctx.targetMinionUid
        ? collectMinionTargets(ctx.state, minion => minion.uid === ctx.targetMinionUid && minion.controller === ctx.playerId)[0]
        : undefined;
    if (!source) return noTargets(ctx);
    const sourceMinion = ctx.state.bases[source.baseIndex]?.minions.find(minion => minion.uid === source.uid);
    if (!sourceMinion) return noTargets(ctx);
    return runOptionalMinionEffect(
        ctx,
        'itty_critters_coach_combat',
        '战斗训练：消灭该随从所在基地上一个力量更低的随从',
        collectMinionTargets(ctx.state, (minion, baseIndex) => {
            if (baseIndex !== source.baseIndex || minion.uid === source.uid) return false;
            return getMinionPower(ctx.state, minion, baseIndex) < getMinionPower(ctx.state, sourceMinion, source.baseIndex);
        }),
        'destroy',
        false,
    );
}

function ittypediaTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || ctx.sourceBaseIndex === undefined) return [];
    if (ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    if (!ctx.triggerMinionUid || ctx.triggerMinionDefId === undefined) return [];
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    return [addTempPower(ctx.triggerMinionUid, ctx.baseIndex, 1, 'itty_critters_ittypedia', ctx.now)];
}

function critterCombatClub(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const cards = collectHandMinionsFromBaseContext(ctx, 2);
    if (cards.length === 0) return { events: [] };
    return executeAbilityProgram(baseExtraMinionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        cards,
    });
}

function canUseCritterCombatClub(ctx: BaseAbilityContext): boolean {
    return collectHandMinionsFromBaseContext(ctx, 2).length > 0;
}

function ittyCity(ctx: BaseAbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || !ctx.matchState) return { events: [] };
    if ((player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) !== 1) return { events: [] };

    const cards = player.discard.filter(card => card.type === 'minion');
    if (cards.length === 0) return { events: [] };
    return executeAbilityProgram(ittyCityPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        cards,
    });
}

function canTriggerIttyCity(ctx: BaseAbilityContext): boolean {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return false;
    return (player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1
        && player.discard.some(card => card.type === 'minion');
}

export function registerIttyCrittersAbilities(): void {
    registerSimpleAbility('itty_critters_i_select_you', 'onPlay', iSelectYou);
    registerSimpleAbility('itty_critters_recall_critter', 'onPlay', recallCritter);
    registerSimpleAbility('itty_critters_evolution', 'onPlay', evolution);
    registerSimpleAbility('itty_critters_leafaroo', 'onPlay', leafaroo);
    registerSimpleAbility('itty_critters_flooffairy', 'onPlay', flooffairy);
    registerSimpleAbility('itty_critters_calicoin', 'onPlay', calicoin);
    registerSimpleAbility('itty_critters_tadpour', 'onPlay', tadpour);
    registerSimpleAbility('itty_critters_krakatoad', 'onPlay', krakatoad);
    registerSimpleAbility('itty_critters_critter_coach', 'onPlay', critterCoach);
    registerSimpleAbility('itty_critters_shellshock', 'onPlay', shellshock);
    registerSimpleAbility('itty_critters_gotta_get_em_all', 'onPlay', gottaGetEmAll);
    registerSimpleAbility('itty_critters_critter_cube', 'onPlay', critterCube);
    registerSimpleAbility('itty_critters_super_effective', 'onPlay', superEffective);
    registerAbilityProgram('itty_critters_coach_combat', 'onPlay', { program: createEffectProgram(coachCombat) });
    registerAbilityProgram('itty_critters_critter_champion', 'talent', { program: createEffectProgram(critterChampion) });
    registerTrigger('itty_critters_ittypedia', 'onMinionPlayed', ittypediaTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerActiveBaseAbility('base_critter_combat_club', critterCombatClub, {
        oncePerTurn: true,
        canUse: canUseCritterCombatClub,
    });
    registerBaseAbility('base_itty_city', 'onMinionPlayed', ittyCity, {
        mandatory: false,
        canTrigger: canTriggerIttyCity,
    });
}
