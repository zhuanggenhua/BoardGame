import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import type { InteractionDescriptor, PromptOption } from '../../../engine/systems/InteractionSystem';
import { queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildValidatedDestroyEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    grantContextualExtraMinion,
    grantExtraMinion,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { SU_EVENTS } from '../domain/types';
import type { CardInstance, CardSuppressedEvent, CardsDrawnEvent, DeckReorderedEvent, MinionPlayedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import { registerCardAbilitySuppression, registerProtection, registerTrigger, type ProtectionCheckContext, type TriggerContext } from '../domain/ongoingEffects';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { matchesDefId } from '../domain/utils';

type SuperheroesPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
};

type CardChoice = {
    cardUid?: string;
    defId?: string;
    skip?: boolean;
};

type BaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    skip?: boolean;
};

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    minionDefId?: string;
    baseDefId?: string;
    skip?: boolean;
};

type BurstMoveChoice = {
    move?: boolean;
};

type BurstContinuationContext = {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    toBaseIndex: number;
    toBaseDefId?: string;
    sourceControllerId: PlayerId;
};

type MildManneredCitizenPromptChoice = {
    destroy?: boolean;
};

type SuperheroesDeckSearchCandidate = {
    cardUid: string;
    defId: string;
    power: number;
    label: string;
};

type MildManneredCitizenPromptContext = SuperheroesPromptContext & {
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
};

type MildManneredCitizenSearchContext = SuperheroesPromptContext & {
    core: SmashUpCore;
    baseIndex: number;
    deck: CardInstance[];
    eligible: SuperheroesDeckSearchCandidate[];
};

type RadioactiveExposureSearchContext = SuperheroesPromptContext & {
    core: SmashUpCore;
    baseIndex: number;
    deck: CardInstance[];
    eligible: SuperheroesDeckSearchCandidate[];
    thresholdPower: number;
};

type MindLadyPromptContext = SuperheroesPromptContext;

function attachOptionsGenerator<T>(
    interaction: InteractionDescriptor<T>,
    generator: (state: MatchState<SmashUpCore>) => PromptOption<T>[],
): InteractionDescriptor<T> {
    interaction.data.optionsGenerator = generator as typeof interaction.data.optionsGenerator;
    return interaction;
}

function findMinionBaseIndexByUid(state: SmashUpCore, minionUid: string): number {
    return state.bases.findIndex((base) => base.minions.some((minion) => minion.uid === minionUid));
}

function getPrintedPower(defId: string): number {
    const def = getCardDef(defId);
    return def?.type === 'minion' ? (def.power ?? 0) : 0;
}

function buildSmallMinionDiscardOptions(
    state: SmashUpCore,
    playerId: PlayerId,
): PromptOption<CardChoice>[] {
    return state.players[playerId]?.discard
        .filter((card) => card.type === 'minion' && getPrintedPower(card.defId) <= 2)
        .map((card, index) => ({
            id: `card-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        })) ?? [];
}

function buildDiscardMinionOptions(
    state: SmashUpCore,
    playerId: PlayerId,
): PromptOption<CardChoice>[] {
    return state.players[playerId]?.discard
        .filter((card) => card.type === 'minion')
        .map((card, index) => ({
            id: `card-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        })) ?? [];
}

function buildDeckReorderEvent(
    deck: CardInstance[],
    playerId: PlayerId,
    removedCardUids: string[],
    now: number,
): DeckReorderedEvent {
    const removedSet = new Set(removedCardUids);
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: deck.filter((card) => !removedSet.has(card.uid)).map((card) => card.uid),
        },
        timestamp: now,
    };
}

function buildSuperheroesDeckSearchCandidates(
    deck: CardInstance[],
    predicate: (power: number) => boolean,
): SuperheroesDeckSearchCandidate[] {
    return deck
        .filter((card) => {
            if (card.type !== 'minion') return false;
            const power = getPrintedPower(card.defId);
            return predicate(power);
        })
        .map((card) => ({
            cardUid: card.uid,
            defId: card.defId,
            power: getPrintedPower(card.defId),
            label: `${getCardDef(card.defId)?.name ?? card.defId} (力量 ${getPrintedPower(card.defId)})`,
        }));
}

function buildSuperheroesDeckSearchOptions(
    eligible: SuperheroesDeckSearchCandidate[],
): PromptOption<CardChoice>[] {
    return eligible.map((card, index) => ({
        id: `card-${index}`,
        label: card.label,
        value: { cardUid: card.cardUid, defId: card.defId },
        displayMode: 'card' as const,
    }));
}

function buildSuperheroesDeckSearchResolutionEvents(params: {
    core: SmashUpCore;
    deck: CardInstance[];
    playerId: PlayerId;
    baseIndex: number;
    choice: { cardUid: string; defId: string };
    sourceId: string;
    timestamp: number;
}): SmashUpEvent[] {
    const { core, deck, playerId, baseIndex, choice, sourceId, timestamp } = params;
    const selected = deck.find((card) => card.uid === choice.cardUid && card.defId === choice.defId);
    if (!selected) {
        return [buildDeckReorderEvent(deck, playerId, [], timestamp)];
    }

    return [
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [selected.uid] },
            timestamp,
        } as CardsDrawnEvent,
        grantExtraMinion(playerId, sourceId, timestamp),
        {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: selected.uid,
                defId: selected.defId,
                baseIndex,
                baseDefId: core.bases[baseIndex]?.defId,
                power: getPrintedPower(selected.defId),
            },
            timestamp,
        } as MinionPlayedEvent,
        buildDeckReorderEvent(deck, playerId, [selected.uid], timestamp),
    ];
}

function buildSidekickBaseOptions(
    state: SmashUpCore,
    playerId: PlayerId,
): PromptOption<BaseChoice>[] {
    const targets = state.bases
        .map((base, baseIndex) => ({
            base,
            baseIndex,
            hasPowerFive: base.minions.some((minion) =>
                minion.controller === playerId && getEffectivePower(state, minion, baseIndex) >= 5),
        }))
        .filter((entry) => entry.hasPowerFive)
        .map((entry) => ({
            baseIndex: entry.baseIndex,
            label: getBaseDef(entry.base.defId)?.name ?? entry.base.defId,
        }));
    return buildBaseTargetOptions(targets, state).map((option) => ({
        ...option,
        displayMode: 'card' as const,
    }));
}

function buildMindLadyTargetOptions(
    state: SmashUpCore,
    playerId: PlayerId,
): PromptOption<MinionChoice>[] {
    const candidates = state.bases.flatMap((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        return base.minions
            .filter((minion) => minion.controller !== playerId)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseName}`,
            }));
    });

    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: playerId,
        sourceDefId: 'superheroes_mind_lady',
        sourceKind: 'nonAction',
        effectType: 'affect',
    }) as PromptOption<MinionChoice>[];
}

function buildCardSuppressedEvent(
    cardUid: string,
    baseIndex: number,
    suppressorPlayerId: PlayerId,
    cardType: CardSuppressedEvent['payload']['cardType'],
    reason: string,
    now: number,
): CardSuppressedEvent {
    return {
        type: SU_EVENTS.CARD_SUPPRESSED,
        payload: {
            cardUid,
            baseIndex,
            suppressorPlayerId,
            cardType,
            reason,
        },
        timestamp: now,
    };
}

const mindLadyPromptProgram = createPromptProgram<MindLadyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'superheroes_mind_lady',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `superheroes_mind_lady_${context.now}`,
            context.playerId,
            '心灵女士：选择另一名玩家的一个随从，其能力取消直到你下回合开始',
            buildMindLadyTargetOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'superheroes_mind_lady',
                titleKey: 'ui.superheroes_mind_lady_title',
                targetType: 'minion',
                autoResolveIfSingle: false,
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildMindLadyTargetOptions(state.core, context.playerId),
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (!choice?.minionUid || choice.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[choice.baseIndex]?.minions.find((minion) => minion.uid === choice.minionUid);
        if (!target || target.controller === playerId) return { events: [] };
        return {
            events: [
                buildCardSuppressedEvent(
                    target.uid,
                    choice.baseIndex,
                    playerId,
                    'minion',
                    'superheroes_mind_lady',
                    timestamp,
                ),
            ],
        };
    },
});

const notReallyDeadPromptProgram = createPromptProgram<SuperheroesPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'superheroes_not_really_dead',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `superheroes_not_really_dead_${context.now}`,
            context.playerId,
            '并没真死：选择最多 2 个力量 2 或以下的随从回手',
            [createSkipOption(), ...buildSmallMinionDiscardOptions(context.matchState.core, context.playerId)],
            {
                sourceId: 'superheroes_not_really_dead',
                titleKey: 'ui.superheroes_not_really_dead_title',
                targetType: 'generic',
                multi: {
                    min: 0,
                    max: Math.min(2, buildSmallMinionDiscardOptions(context.matchState.core, context.playerId).length),
                },
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        ),
        (state) => [createSkipOption(), ...buildSmallMinionDiscardOptions(state.core, context.playerId)],
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choices = Array.isArray(value) ? value as CardChoice[] : [];
        const selected = choices.filter((choice) => !choice.skip && choice.cardUid && choice.defId);
        if (selected.length === 0) return { events: [] };
        const player = state.core.players[playerId];
        if (!player) return { events: [] };
        const liveSelected = selected.filter((choice) =>
            player.discard.some((card) => card.uid === choice.cardUid && card.defId === choice.defId),
        );
        return {
            events: liveSelected.map((choice) =>
                recoverCardsFromDiscard(playerId, [choice.cardUid!], 'superheroes_not_really_dead', timestamp)),
        };
    },
});

const goldenAgePromptProgram = createPromptProgram<SuperheroesPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'superheroes_golden_age',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `superheroes_golden_age_${context.now}`,
            context.playerId,
            '黄金时代：选择最多 3 个随从放到牌库底',
            [createSkipOption(), ...buildDiscardMinionOptions(context.matchState.core, context.playerId)],
            {
                sourceId: 'superheroes_golden_age',
                titleKey: 'ui.superheroes_golden_age_title',
                targetType: 'generic',
                multi: {
                    min: 0,
                    max: Math.min(3, buildDiscardMinionOptions(context.matchState.core, context.playerId).length),
                },
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        ),
        (state) => [createSkipOption(), ...buildDiscardMinionOptions(state.core, context.playerId)],
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choices = Array.isArray(value) ? value as CardChoice[] : [];
        const selected = choices.filter((choice) => !choice.skip && choice.cardUid && choice.defId);
        if (selected.length === 0) return { events: [] };
        const player = state.core.players[playerId];
        if (!player) return { events: [] };

        const events: SmashUpEvent[] = [];
        for (const choice of selected) {
            if (!player.discard.some((card) => card.uid === choice.cardUid && card.defId === choice.defId)) {
                continue;
            }
            events.push(...buildValidatedCardToDeckBottomEvents(state, {
                cardUid: choice.cardUid!,
                defId: choice.defId!,
                ownerId: playerId,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'superheroes_golden_age',
                sourceControllerId: context.playerId,
                reason: 'superheroes_golden_age',
                now: timestamp,
                expectedLocation: 'discard',
            }));
        }
        return { events };
    },
});

const sidekickPromptProgram = createPromptProgram<SuperheroesPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'superheroes_sidekick',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `superheroes_sidekick_${context.now}`,
            context.playerId,
            '助手：选择要额外打出力量 2 或以下随从的基地',
            buildSidekickBaseOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'superheroes_sidekick',
                titleKey: 'ui.superheroes_sidekick_title',
                targetType: 'base',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        ),
        (state) => buildSidekickBaseOptions(state.core, context.playerId),
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.skip || choice?.baseIndex === undefined) return { events: [] };
        return {
            events: [grantContextualExtraMinion(
                { playerId, now: timestamp, matchState: state },
                'superheroes_sidekick',
                choice.baseIndex,
                { powerMax: 2 },
            )],
        };
    },
});

const mildManneredCitizenSearchPromptProgram = createPromptProgram<
    MildManneredCitizenSearchContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'superheroes_mild_mannered_citizen_search',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `superheroes_mild_mannered_citizen_search_${context.baseIndex}_${context.now}`,
            context.playerId,
            '温和市民：从牌库中选择一个力量 5 或以上的随从额外打到这里',
            buildSuperheroesDeckSearchOptions(context.eligible),
            {
                sourceId: 'superheroes_mild_mannered_citizen_search',
                titleKey: 'ui.superheroes_mild_mannered_citizen_search_title',
                targetType: 'generic',
                autoResolveIfSingle: false,
                autoRefresh: 'deck',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildSuperheroesDeckSearchOptions(
            buildSuperheroesDeckSearchCandidates(
                state.core.players[context.playerId]?.deck ?? [],
                (power) => power >= 5,
            ),
        ),
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as CardChoice | undefined;
        if (!choice?.cardUid || !choice.defId) return { events: [] };
        return {
            events: buildSuperheroesDeckSearchResolutionEvents({
                core: state.core,
                deck: state.core.players[playerId]?.deck ?? [],
                playerId,
                baseIndex: context.baseIndex,
                choice: { cardUid: choice.cardUid, defId: choice.defId },
                sourceId: 'superheroes_mild_mannered_citizen',
                timestamp,
            }),
        };
    },
});

function runMildManneredCitizenSearch(
    context: MildManneredCitizenSearchContext,
): AbilityResult {
    if (context.eligible.length === 0) {
        return {
            events: [
                buildDeckReorderEvent(context.deck, context.playerId, [], context.now),
                buildAbilityFeedback(context.playerId, 'feedback.deck_search_no_match', context.now),
            ],
        };
    }

    if (!context.matchState) {
        const [selected] = context.eligible;
        if (!selected) return { events: [] };
        return {
            events: buildSuperheroesDeckSearchResolutionEvents({
                core: context.core,
                deck: context.deck,
                playerId: context.playerId,
                baseIndex: context.baseIndex,
                choice: { cardUid: selected.cardUid, defId: selected.defId },
                sourceId: 'superheroes_mild_mannered_citizen',
                timestamp: context.now,
            }),
        };
    }

    const result = executeAbilityProgram(mildManneredCitizenSearchPromptProgram, context);
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

const radioactiveExposureSearchPromptProgram = createPromptProgram<
    RadioactiveExposureSearchContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'superheroes_radioactive_exposure_search',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `superheroes_radioactive_exposure_search_${context.baseIndex}_${context.now}`,
            context.playerId,
            `放射暴露：从牌库中选择一个力量大于 ${context.thresholdPower} 的随从额外打到这里`,
            buildSuperheroesDeckSearchOptions(context.eligible),
            {
                sourceId: 'superheroes_radioactive_exposure_search',
                targetType: 'generic',
                autoResolveIfSingle: false,
                autoRefresh: 'deck',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildSuperheroesDeckSearchOptions(
            buildSuperheroesDeckSearchCandidates(
                state.core.players[context.playerId]?.deck ?? [],
                (power) => power > context.thresholdPower,
            ),
        ),
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as CardChoice | undefined;
        if (!choice?.cardUid || !choice.defId) return { events: [] };
        return {
            events: buildSuperheroesDeckSearchResolutionEvents({
                core: state.core,
                deck: state.core.players[playerId]?.deck ?? [],
                playerId,
                baseIndex: context.baseIndex,
                choice: { cardUid: choice.cardUid, defId: choice.defId },
                sourceId: 'superheroes_radioactive_exposure',
                timestamp,
            }),
        };
    },
});

function runRadioactiveExposureSearch(
    context: RadioactiveExposureSearchContext,
): AbilityResult {
    if (context.eligible.length === 0) {
        return {
            events: [
                buildDeckReorderEvent(context.deck, context.playerId, [], context.now),
                buildAbilityFeedback(context.playerId, 'feedback.deck_search_no_match', context.now),
            ],
        };
    }

    if (!context.matchState) {
        const [selected] = context.eligible;
        if (!selected) return { events: [] };
        return {
            events: buildSuperheroesDeckSearchResolutionEvents({
                core: context.core,
                deck: context.deck,
                playerId: context.playerId,
                baseIndex: context.baseIndex,
                choice: { cardUid: selected.cardUid, defId: selected.defId },
                sourceId: 'superheroes_radioactive_exposure',
                timestamp: context.now,
            }),
        };
    }

    const result = executeAbilityProgram(radioactiveExposureSearchPromptProgram, context);
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

const mildManneredCitizenPromptProgram = createPromptProgram<
    MildManneredCitizenPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'superheroes_mild_mannered_citizen',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `superheroes_mild_mannered_citizen_${context.minionUid}_${context.now}`,
        context.playerId,
        '温和市民：你可以消灭此随从。若如此，从牌库中选择一个力量 5 或以上的随从额外打到这里。',
        [
            {
                id: 'destroy',
                label: '消灭并检索',
                labelKey: 'ui.superheroes_mild_mannered_citizen_destroy_option',
                value: { destroy: true },
                displayMode: 'button' as const,
            },
            {
                id: 'skip',
                label: '跳过',
                labelKey: 'ui.skip',
                value: { destroy: false },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'superheroes_mild_mannered_citizen',
            titleKey: 'ui.superheroes_mild_mannered_citizen_title',
            targetType: 'button',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as MildManneredCitizenPromptChoice | undefined;
        if (!choice?.destroy) return { events: [] };

        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: context.minionUid,
            minionDefId: context.minionDefId,
            fromBaseIndex: context.baseIndex,
            destroyerId: playerId,
            reason: 'superheroes_mild_mannered_citizen',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'superheroes_mild_mannered_citizen',
            sourceControllerId: playerId,
            sourceBaseIndex: context.baseIndex,
        });
        const destroySucceeded = destroyEvents.some((event) => event.type === SU_EVENTS.MINION_DESTROYED);
        const player = state.core.players[playerId];
        const deck = player?.deck ?? [];
        const eligible = buildSuperheroesDeckSearchCandidates(deck, (power) => power >= 5);
        const searchResult = destroySucceeded
            ? runMildManneredCitizenSearch({
                matchState: state,
                playerId,
                now: timestamp,
                core: state.core,
                baseIndex: context.baseIndex,
                deck,
                eligible,
            })
            : { events: [], matchState: state };
        return {
            events: [...destroyEvents, ...searchResult.events],
            matchState: searchResult.matchState,
        };
    },
});

function captainAmazingTalent(ctx: AbilityContext): AbilityResult {
    const baseIndex = findMinionBaseIndexByUid(ctx.state, ctx.cardUid);
    if (baseIndex < 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const base = ctx.state.bases[baseIndex];
    const ownMinions = base.minions.filter((minion) => minion.controller === ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: ownMinions.map((minion) => addTempPower(
            minion.uid,
            baseIndex,
            1,
            'superheroes_captain_amazing',
            ctx.now,
        )),
    };
}

function mindLadyTalent(ctx: AbilityContext): AbilityResult {
    const targets = buildMindLadyTargetOptions(ctx.state, ctx.playerId);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (!ctx.matchState) return { events: [] };

    const result = executeAbilityProgram(mindLadyPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    });
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function notReallyDeadOnPlay(ctx: AbilityContext): AbilityResult {
    const targets = buildSmallMinionDiscardOptions(ctx.state, ctx.playerId);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(notReallyDeadPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    });
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function goldenAgeOnPlay(ctx: AbilityContext): AbilityResult {
    const targets = buildDiscardMinionOptions(ctx.state, ctx.playerId);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(goldenAgePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
    });
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function sidekickOnPlay(ctx: AbilityContext): AbilityResult {
    const targets = buildSidekickBaseOptions(ctx.state, ctx.playerId);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!ctx.matchState) return { events: [] };
    const result = executeAbilityProgram(sidekickPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    });
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function radioactiveExposureOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find((minion) => minion.uid === ctx.targetMinionUid);
    if (!target || target.controller !== ctx.playerId) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const thresholdPower = getEffectivePower(ctx.state, target, ctx.baseIndex);
    const destroyEvents = buildValidatedDestroyEvents(ctx.matchState, {
        minionUid: target.uid,
        minionDefId: target.defId,
        fromBaseIndex: ctx.baseIndex,
        destroyerId: ctx.playerId,
        reason: 'superheroes_radioactive_exposure',
        now: ctx.now,
        sourcePlayerId: ctx.playerId,
        sourceDefId: 'superheroes_radioactive_exposure',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    });
    const destroySucceeded = destroyEvents.some((event) => event.type === SU_EVENTS.MINION_DESTROYED);
    const deck = ctx.state.players[ctx.playerId]?.deck ?? [];
    const eligible = buildSuperheroesDeckSearchCandidates(deck, (power) => power > thresholdPower);
    const searchResult = destroySucceeded
        ? runRadioactiveExposureSearch({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            core: ctx.state,
            baseIndex: ctx.baseIndex,
            deck,
            eligible,
            thresholdPower,
        })
        : { events: [], matchState: ctx.matchState };

    return {
        events: [...destroyEvents, ...searchResult.events],
        matchState: searchResult.matchState,
    };
}

function justiceFriendsOnPlay(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const base = ctx.state.bases[baseIndex];
        for (const minion of base.minions) {
            if (minion.controller !== ctx.playerId) continue;
            if (getEffectivePower(ctx.state, minion, baseIndex) < 5) continue;
            events.push(addTempPower(minion.uid, baseIndex, 2, 'superheroes_justice_friends', ctx.now));
        }
    }

    return { events };
}

function superheroesMildManneredCitizenTrigger(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    if (!ctx.sourceCardUid || !ctx.sourceDefId || ctx.sourceBaseIndex === undefined) return { events: [] };
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    const minion = base?.minions.find((candidate) => candidate.uid === ctx.sourceCardUid);
    if (!minion || minion.controller !== ctx.playerId) return { events: [] };

    const result = executeAbilityProgram(mildManneredCitizenPromptProgram, {
        matchState: ctx.matchState,
        playerId: minion.controller,
        now: ctx.now,
        minionUid: minion.uid,
        minionDefId: minion.defId,
        baseIndex: ctx.sourceBaseIndex,
    });
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function superheroesTheBurstTrigger(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    if (!ctx.sourceCardUid || !ctx.sourceDefId) return { events: [] };
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex === undefined) return { events: [] };
    if (ctx.sourceBaseIndex === ctx.baseIndex) return { events: [] };
    const promptPlayerId = ctx.sourceControllerId ?? ctx.playerId;

    const targetBaseDef = getBaseDef(ctx.state.bases[ctx.baseIndex]?.defId ?? '');
    const targetBaseName = targetBaseDef?.name ?? `基地 ${ctx.baseIndex + 1}`;
    const interaction = createSimpleChoice(
        `superheroes_the_burst_${ctx.sourceCardUid}_${ctx.now}`,
        promptPlayerId,
        `爆发：是否移动到「${targetBaseName}」？`,
        [
            {
                id: 'move',
                label: '移动到该基地',
                labelKey: 'ui.move_there',
                value: { move: true },
                displayMode: 'button' as const,
            },
            {
                id: 'stay',
                label: '留在原地',
                labelKey: 'ui.stay_here',
                value: { move: false },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'superheroes_the_burst',
            targetType: 'button',
        },
    );
    interaction.data.continuationContext = {
        minionUid: ctx.sourceCardUid,
        minionDefId: ctx.sourceDefId,
        fromBaseIndex: ctx.sourceBaseIndex,
        toBaseIndex: ctx.baseIndex,
        toBaseDefId: ctx.state.bases[ctx.baseIndex]?.defId,
        sourceControllerId: promptPlayerId,
    } satisfies BurstContinuationContext;

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function superheroesAwesomeGuyProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.minions.some((minion) =>
        matchesDefId(minion.defId, 'superheroes_awesome_guy')
        && minion.controller === ctx.targetMinion.controller,
    );
}

function superheroesExpandedPowerProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.targetMinion.attachedActions.some((action) =>
        matchesDefId(action.defId, 'superheroes_expanded_power')
        && (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === ctx.targetMinion.controller),
    );
}

function superheroesSecretBaseProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    if (getEffectivePower(ctx.state, ctx.targetMinion, ctx.targetBaseIndex) > 3) return false;
    return base.ongoingActions.some((action) =>
        matchesDefId(action.defId, 'superheroes_secret_base')
        && (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === ctx.targetMinion.controller),
    );
}

function superheroesConvertedCaveProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base || !matchesDefId(base.defId, 'base_converted_cave')) return false;
    return getEffectivePower(ctx.state, ctx.targetMinion, ctx.targetBaseIndex) <= 2;
}

function superheroesMyOnlyWeaknessSuppression(
    state: SmashUpCore,
    turnScopedSuppressedCardUids: ReadonlySet<string>,
): string[] {
    const suppressedMinionUids = new Set<string>();
    for (const base of state.bases) {
        for (const minion of base.minions) {
            const hasActiveWeakness = minion.attachedActions.some((action) => (
                matchesDefId(action.defId, 'superheroes_my_only_weakness')
                && !turnScopedSuppressedCardUids.has(action.uid)
            ));
            if (hasActiveWeakness) {
                suppressedMinionUids.add(minion.uid);
            }
        }
    }
    return Array.from(suppressedMinionUids);
}

export function registerSuperheroesAbilities(): void {
    registerAbilityProgram('superheroes_mind_lady', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mindLadyTalent),
    });
    registerAbilityProgram('superheroes_captain_amazing', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(captainAmazingTalent),
    });
    registerAbilityProgram('superheroes_not_really_dead', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(notReallyDeadOnPlay),
    });
    registerAbilityProgram('superheroes_golden_age', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(goldenAgeOnPlay),
    });
    registerAbilityProgram('superheroes_justice_friends', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(justiceFriendsOnPlay),
    });
    registerAbilityProgram('superheroes_sidekick', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(sidekickOnPlay),
    });
    registerAbilityProgram('superheroes_radioactive_exposure', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(radioactiveExposureOnPlay),
    });
    registerTrigger('superheroes_the_burst', 'onMinionPlayed', superheroesTheBurstTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: (ctx) =>
            ctx.sourceBaseIndex !== undefined
            && ctx.baseIndex !== undefined
            && ctx.sourceBaseIndex !== ctx.baseIndex,
    });
    registerTrigger('superheroes_mild_mannered_citizen', 'onTurnStart', superheroesMildManneredCitizenTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    registerProtection('superheroes_awesome_guy', 'destroy', superheroesAwesomeGuyProtection);
    registerProtection('superheroes_expanded_power', 'destroy', superheroesExpandedPowerProtection);
    registerProtection('superheroes_secret_base', 'destroy', superheroesSecretBaseProtection);
    registerProtection('base_converted_cave', 'destroy', superheroesConvertedCaveProtection);
    registerCardAbilitySuppression('superheroes_my_only_weakness', superheroesMyOnlyWeaknessSuppression);
}

export function registerSuperheroesInteractionHandlers(): void {
    registerInteractionHandler('superheroes_the_burst', (state, _playerId, value, interactionData, _random, timestamp) => {
        const choice = value as BurstMoveChoice | undefined;
        const continuation = interactionData?.continuationContext as BurstContinuationContext | undefined;
        if (!choice?.move || !continuation) {
            return { state, events: [] };
        }

        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: continuation.minionUid,
                minionDefId: continuation.minionDefId,
                fromBaseIndex: continuation.fromBaseIndex,
                toBaseIndex: continuation.toBaseIndex,
                toBaseDefId: continuation.toBaseDefId,
                reason: 'superheroes_the_burst',
                now: timestamp,
                sourcePlayerId: continuation.sourceControllerId,
                sourceDefId: continuation.minionDefId,
                sourceControllerId: continuation.sourceControllerId,
                sourceBaseIndex: continuation.fromBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });
}
