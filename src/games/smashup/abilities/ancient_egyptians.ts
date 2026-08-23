import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerActiveBaseAbility, registerBaseAbility } from '../domain/baseAbilities';
import {
    addTempPower,
    buildBaseTargetOptions,
    buildFieldSourceActionOptions,
    buildFieldSourceActionPromptConfig,
    buildFieldSourceTargetPromptConfig,
    buildFieldSourceToBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    createSkipOption,
    findMinionOnBases,
    getMinionPower,
    removePowerCounter,
} from '../domain/abilityHelpers';
import { buildBuryCardEvents, uncoverBuriedCard } from '../domain/bury';
import { SU_EVENTS } from '../domain/types';
import type { BaseAbilityUsedEvent, SmashUpCore, SmashUpEvent, BuriedCardOnBase } from '../domain/types';
import { registerTrigger } from '../domain/ongoingEffects';
import { getBaseDef, getCardDef } from '../data/cards';
import { resolveLiveBaseIndex } from '../domain/utils';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type BuriedChoice = { cardUid: string; baseIndex: number; defId?: string; baseDefId?: string };
type HandCardChoice = { cardUid: string; defId: string };
type SealTheTombUncoverContinuationContext = AncientEgyptiansPromptContext & {
    pendingChoices: BuriedChoice[];
    random: RandomFn;
};
type AncientEgyptiansPromptContext = {
    matchState: MatchState<SmashUpCore>;
    state: SmashUpCore;
    playerId: PlayerId;
    now: number;
};
const DEFAULT_RANDOM: any = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function createPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): AncientEgyptiansPromptContext & TExtra {
    return {
        matchState,
        state: matchState.core,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function runtimeResultToAbilityResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
): AbilityResult {
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

export function registerAncientEgyptiansAbilities(): void {
    registerAbilityProgram('ancient_egyptians_pyramid_engineer', 'onPlay', { program: ancientEgyptiansPyramidEngineerOnPlayProgram });
    registerAbilityProgram('ancient_egyptians_pyramid_engineer', 'talent', {
        program: ancientEgyptiansPyramidEngineerTalentProgram,
        validateUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return player && player.hand.length > 0 ? null : '手牌为空，无法发动此天赋';
        },
    });
    registerAbilityProgram('ancient_egyptians_lost_knowledge', 'onPlay', { program: ancientEgyptiansLostKnowledgeProgram });
    registerAbilityProgram('ancient_egyptians_lost_knowledge', 'special', { program: ancientEgyptiansLostKnowledgeProgram });
    registerSimpleAbility('ancient_egyptians_you_can_take_it_with_you', 'onPlay', ancientEgyptiansBurySelfOnPlay);
    registerSimpleAbility('ancient_egyptians_you_can_take_it_with_you', 'onUncover', ancientEgyptiansYouCanTakeItWithYouOnUncover);
    registerSimpleAbility('ancient_egyptians_tomb_trap', 'onPlay', ancientEgyptiansBurySelfOnPlay);
    registerAbilityProgram('ancient_egyptians_tomb_trap', 'onUncover', { program: ancientEgyptiansTombTrapOnUncoverProgram });
    registerAbilityProgram('ancient_egyptians_plague_of_locusts', 'onPlay', { program: ancientEgyptiansPlagueOfLocustsProgram });
    registerAbilityProgram('ancient_egyptians_plague_of_locusts', 'special', { program: ancientEgyptiansPlagueOfLocustsProgram });
    registerAbilityProgram('ancient_egyptians_mummy_strength', 'onPlay', { program: ancientEgyptiansMummyStrengthProgram });
    registerAbilityProgram('ancient_egyptians_ancient_curse', 'onPlay', { program: ancientEgyptiansAncientCurseProgram });
    registerSimpleAbility('ancient_egyptians_blessing_of_anubis', 'onPlay', ancientEgyptiansBurySelfOnPlay);
    registerSimpleAbility('ancient_egyptians_blessing_of_anubis', 'onUncover', ancientEgyptiansBlessingOfAnubisOnUncover);
    registerAbilityProgram('ancient_egyptians_seal_the_tomb', 'onPlay', { program: ancientEgyptiansSealTheTombProgram });

    registerTrigger('ancient_egyptians_mummy', 'afterScoring', ancientEgyptiansMummyAfterScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('ancient_egyptians_mummy_pod', 'afterScoring', ancientEgyptiansMummyAfterScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('ancient_egyptians_pharaoh', 'beforeScoring', ancientEgyptiansPharaohBeforeScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('ancient_egyptians_pharaoh_pod', 'beforeScoring', ancientEgyptiansPharaohBeforeScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('ancient_egyptians_pharaoh', 'onBuriedCardUncovered', ancientEgyptiansPharaohOnUncover, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('base_star_portal', 'onCardBuried', ancientEgyptiansStarPortalOnBuried, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });

    registerActiveBaseAbility('base_pyramids', ancientEgyptiansPyramidsDuringTurn, {
        oncePerTurn: true,
        canUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return !!player && player.hand.length > 0;
        },
    });
    registerBaseAbility('base_star_portal', 'onActionPlayed', ancientEgyptiansStarPortalOnActionPlayed, {
        mandatory: true,
    });
}

function ancientEgyptiansBurySelfOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: buildBuryCardEvents({
            core: ctx.state,
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            baseIndex: ctx.baseIndex,
            trueOwnerId: ctx.playerId,
            buriedFrom: 'play',
            reason: ctx.defId,
            random: ctx.random,
            now: ctx.now,
        }),
    };
}

function ancientEgyptiansYouCanTakeItWithYouOnUncover(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now) };
}

function ancientEgyptiansBlessingOfAnubisOnUncover(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => addTempPower(minion.uid, ctx.baseIndex, 2, 'ancient_egyptians_blessing_of_anubis', ctx.now)),
    };
}

function ancientEgyptiansMummyAfterScoring(ctx: any): AbilityResult {
    return runtimeResultToAbilityResult(
        executeAbilityProgram(
            ancientEgyptiansMummyAfterScoringProgram,
            ctx,
        ),
    );
}

function ancientEgyptiansPharaohOnUncover(ctx: any): SmashUpEvent[] {
    const pharaohController = ctx.sourceControllerId as PlayerId | undefined;
    if (!pharaohController) return [];
    return buildStandardDrawEvents(ctx.state, pharaohController, 1, ctx.random, ctx.now);
}

function ancientEgyptiansPharaohBeforeScoring(ctx: any): AbilityResult {
    return runtimeResultToAbilityResult(
        executeAbilityProgram(
            ancientEgyptiansPharaohBeforeScoringProgram,
            ctx,
        ),
    );
}

function ancientEgyptiansStarPortalOnBuried(ctx: any): SmashUpEvent[] {
    if (!ctx.buriedCardControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.buriedCardControllerId, 1, ctx.random, ctx.now);
}

function ancientEgyptiansPyramidsDuringTurn(ctx: any): AbilityResult {
    return runtimeResultToAbilityResult(
        executeAbilityProgram(
            ancientEgyptiansPyramidsDuringTurnProgram,
            ctx,
        ),
    );
}

function ancientEgyptiansStarPortalOnActionPlayed(ctx: any): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, DEFAULT_RANDOM, ctx.now) };
}

const ancientEgyptiansPyramidEngineerUncoverPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { baseIndex: number }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_pyramid_engineer_uncover',
    buildInteraction: (context) => {
        const base = context.state.bases[context.baseIndex];
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_pyramid_engineer_${context.now}`,
            context.playerId,
            '金字塔工程师：你可以翻开这里你的一张埋葬牌',
            [createSkipOption(), ...buildBuriedCardOptions(context.state, context.playerId, base?.buriedCards ?? [], true)] as any[],
            {
                sourceId: 'ancient_egyptians_pyramid_engineer_uncover',
                targetType: 'generic',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_pyramid_engineer_uncover_title',
            },
        );
        interaction.data.optionsGenerator = (state) => {
            const liveBase = (state.core as SmashUpCore).bases[context.baseIndex];
            return [createSkipOption(), ...buildBuriedCardOptions(state.core as SmashUpCore, context.playerId, liveBase?.buriedCards ?? [], true)] as any[];
        };
        return interaction;
    },
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const selected = value as BuriedChoice | { skip?: true } | undefined;
        if ((selected as any)?.skip || !(selected as BuriedChoice)?.cardUid) return { events: [] };
        const result = uncoverBuriedCard({
            matchState: state,
            playerId,
            cardUid: (selected as BuriedChoice).cardUid,
            baseIndex: (selected as BuriedChoice).baseIndex,
            random,
            now: timestamp,
            reason: 'ancient_egyptians_pyramid_engineer',
        });
        return { events: result.events, matchState: result.state };
    },
});

const ancientEgyptiansPyramidEngineerOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const base = ctx.state.bases[ctx.baseIndex];
    const options = buildBuriedCardOptions(ctx.state, ctx.playerId, base?.buriedCards ?? [], true);
    if (!base || options.length === 0) return { events: [] };
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, { baseIndex: ctx.baseIndex }),
        nextProgram: ancientEgyptiansPyramidEngineerUncoverPromptProgram,
    };
});

const ancientEgyptiansPyramidEngineerTalentProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { baseIndex: number }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_pyramid_engineer_talent',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_pyramid_engineer_talent_${context.now}`,
            context.playerId,
            '金字塔工程师：选择一张手牌埋葬在这里',
            buildHandCardOptions(context.state.players[context.playerId]?.hand ?? []),
            {
                sourceId: 'ancient_egyptians_pyramid_engineer_talent',
                targetType: 'hand',
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_pyramid_engineer_bury_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildHandCardOptions((state.core as SmashUpCore).players[context.playerId]?.hand ?? []);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = value as HandCardChoice | undefined;
        if (!selected?.cardUid) return { events: [] };
        return {
            events: buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                baseIndex: context.baseIndex,
                trueOwnerId: playerId,
                buriedFrom: 'hand',
                reason: 'ancient_egyptians_pyramid_engineer',
                random,
                now: timestamp,
            }),
        };
    },
});

const ancientEgyptiansLostKnowledgeBuryBasePromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & HandCardChoice
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_lost_knowledge_bury_base',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_lost_knowledge_bury_base_${context.now}`,
            context.playerId,
            '失落知识：选择要埋葬到的基地',
            buildBaseTargetOptions(
                context.state.bases.map((base, baseIndex) => ({
                    baseIndex,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                })),
                context.state,
            ),
            {
                sourceId: 'ancient_egyptians_lost_knowledge_bury_base',
                targetType: 'base',
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_lost_knowledge_bury_base_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildBaseTargetOptions(
                (state.core as SmashUpCore).bases.map((base, baseIndex) => ({
                    baseIndex,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                })),
                state.core as SmashUpCore,
            );
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const baseIndex = (value as any)?.baseIndex as number | undefined;
        if (baseIndex === undefined || !context.cardUid) return { events: [] };
        return {
            events: buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                baseIndex,
                trueOwnerId: playerId,
                buriedFrom: 'hand',
                reason: 'ancient_egyptians_lost_knowledge',
                random,
                now: timestamp,
            }),
        };
    },
});

const ancientEgyptiansLostKnowledgeBuryPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { playedCardUid: string }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_lost_knowledge_bury',
    buildInteraction: (context) => {
        const buriableHand = (context.state.players[context.playerId]?.hand ?? [])
            .filter(card => card.uid !== context.playedCardUid);
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_lost_knowledge_bury_${context.now}`,
            context.playerId,
            '失落知识：选择一张手牌埋葬',
            buildHandCardOptions(buriableHand),
            {
                sourceId: 'ancient_egyptians_lost_knowledge_bury',
                targetType: 'hand',
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_lost_knowledge_bury_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildHandCardOptions(
                ((state.core as SmashUpCore).players[context.playerId]?.hand ?? [])
                    .filter(card => card.uid !== context.playedCardUid),
            );
        return interaction;
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as HandCardChoice | undefined;
        if (!selected?.cardUid) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, selected),
            nextProgram: ancientEgyptiansLostKnowledgeBuryBasePromptProgram,
        };
    },
});

const ancientEgyptiansLostKnowledgeUncoverPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_lost_knowledge_uncover',
    buildInteraction: (context) => {
        const choices = getBuriedCardChoices(context.state, context.playerId);
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_lost_knowledge_uncover_${context.now}`,
            context.playerId,
            '失落知识：选择一张你的埋葬牌翻开',
            buildBuriedCardChoiceOptions(context.state, context.playerId, choices),
            {
                sourceId: 'ancient_egyptians_lost_knowledge_uncover',
                targetType: 'generic',
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_lost_knowledge_uncover_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildBuriedCardChoiceOptions(
                state.core as SmashUpCore,
                context.playerId,
                getBuriedCardChoices(state.core as SmashUpCore, context.playerId),
            );
        return interaction;
    },
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const selected = value as BuriedChoice | undefined;
        if (!selected?.cardUid) return { events: [] };
        const result = uncoverBuriedCard({
            matchState: state,
            playerId,
            cardUid: selected.cardUid,
            baseIndex: selected.baseIndex,
            random,
            now: timestamp,
            reason: 'ancient_egyptians_lost_knowledge',
        });
        return { events: result.events, matchState: result.state };
    },
});

const ancientEgyptiansLostKnowledgeModePromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { playedCardUid: string }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_lost_knowledge_mode',
    buildInteraction: (context) => {
        const player = context.state.players[context.playerId];
        const buriableHand = player?.hand.filter(card => card.uid !== context.playedCardUid) ?? [];
        const canBury = buriableHand.length > 0;
        const canUncover = getBuriedCardChoices(context.state, context.playerId).length > 0;
        const options = [];
        if (canBury) {
            options.push({
                id: 'bury',
                label: '埋葬一张手牌',
                labelKey: 'ui.ancient_egyptians_lost_knowledge_mode_bury_option',
                value: { mode: 'bury' },
                displayMode: 'button' as const,
            });
        }
        if (canUncover) {
            options.push({
                id: 'uncover',
                label: '翻开一张你的埋葬牌',
                labelKey: 'ui.ancient_egyptians_lost_knowledge_mode_uncover_option',
                value: { mode: 'uncover' },
                displayMode: 'button' as const,
            });
        }
        return createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_lost_knowledge_mode_${context.now}`,
            context.playerId,
            '失落知识：选择要执行的效果',
            options,
            {
                sourceId: 'ancient_egyptians_lost_knowledge_mode',
                targetType: 'button',
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_lost_knowledge_mode_title',
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const mode = (value as any)?.mode as 'bury' | 'uncover' | undefined;
        if (!mode) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, { playedCardUid: context.playedCardUid }),
            nextProgram: mode === 'bury'
                ? ancientEgyptiansLostKnowledgeBuryPromptProgram
                : ancientEgyptiansLostKnowledgeUncoverPromptProgram,
        };
    },
});

const ancientEgyptiansLostKnowledgeProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const buriableHand = player.hand.filter(card => card.uid !== ctx.cardUid);
    const canBury = buriableHand.length > 0;
    const canUncover = getBuriedCardChoices(ctx.state, ctx.playerId).length > 0;
    if (!canBury && !canUncover) return { events: [] };
    if (canBury && !canUncover) {
        return {
            events: [],
            context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, { playedCardUid: ctx.cardUid }),
            nextProgram: ancientEgyptiansLostKnowledgeBuryPromptProgram,
        };
    }
    if (!canBury && canUncover) {
        return {
            events: [],
            context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
            nextProgram: ancientEgyptiansLostKnowledgeUncoverPromptProgram,
        };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, { playedCardUid: ctx.cardUid }),
        nextProgram: ancientEgyptiansLostKnowledgeModePromptProgram,
    };
});

const ancientEgyptiansTombTrapOnUncoverProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { baseIndex: number }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_tomb_trap',
    buildInteraction: (context) => {
        const base = context.state.bases[context.baseIndex];
        const candidates = (base?.minions ?? [])
            .filter((minion) => getMinionPower(context.state, minion, context.baseIndex) <= 4)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}`,
            }));
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_tomb_trap_${context.now}`,
            context.playerId,
            '墓穴陷阱：你可以消灭这里一个力量4或以下的随从',
            [...buildMinionTargetOptions(candidates, {
                state: context.state,
                sourcePlayerId: context.playerId,
                sourceDefId: 'ancient_egyptians_tomb_trap',
                effectType: 'destroy',
            }), createSkipOption()] as any[],
            {
                sourceId: 'ancient_egyptians_tomb_trap',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_tomb_trap_title',
            },
        );
        interaction.data.optionsGenerator = (state) => {
            const liveBase = (state.core as SmashUpCore).bases[context.baseIndex];
            const liveCandidates = (liveBase?.minions ?? [])
                .filter((minion) => getMinionPower(state.core as SmashUpCore, minion, context.baseIndex) <= 4)
                .map((minion) => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: context.baseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId}`,
                }));
            return [...buildMinionTargetOptions(liveCandidates, {
                state: state.core as SmashUpCore,
                sourcePlayerId: context.playerId,
                sourceDefId: 'ancient_egyptians_tomb_trap',
                effectType: 'destroy',
            }), createSkipOption()] as any[];
        };
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number; skip?: boolean } | undefined;
        if (!selected || selected.skip || selected.baseIndex === undefined || !selected.minionUid || !selected.defId) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                sourcePlayerId: playerId,
                sourceDefId: 'ancient_egyptians_tomb_trap',
                sourceControllerId: playerId,
                sourceBaseIndex: context.baseIndex,
                reason: 'ancient_egyptians_tomb_trap',
                now: timestamp,
            }),
        };
    },
});

const ancientEgyptiansPlagueOfLocustsProgram = createPromptProgram<
    AncientEgyptiansPromptContext
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_plague_of_locusts',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ancient_egyptians_plague_of_locusts_${context.now}`,
        context.playerId,
        '蝗灾：选择一个基地',
        buildBaseTargetOptions(
            context.state.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            })),
            context.state,
        ),
        {
            sourceId: 'ancient_egyptians_plague_of_locusts',
            targetType: 'base',
            responseValidationMode: 'live',
            titleKey: 'ui.ancient_egyptians_plague_of_locusts_title',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const baseIndex = (value as any)?.baseIndex as number | undefined;
        const base = baseIndex === undefined ? undefined : state.core.bases[baseIndex];
        if (!base) return { events: [] };
        return {
            events: base.minions
                .filter(minion => minion.controller !== playerId)
                .map(minion => addTempPower(minion.uid, baseIndex, -1, 'ancient_egyptians_plague_of_locusts', timestamp)),
        };
    },
});

const ancientEgyptiansMummyStrengthTargetPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_mummy_strength_target',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_mummy_strength_target_${context.now}`,
            context.playerId,
            '木乃伊之力：选择一个你的随从',
            buildMinionTargetOptions(getOwnMinions(context.state, context.playerId), {
                state: context.state,
                sourcePlayerId: context.playerId,
            }) as any[],
            {
                sourceId: 'ancient_egyptians_mummy_strength_target',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_mummy_strength_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildMinionTargetOptions(getOwnMinions(state.core as SmashUpCore, context.playerId), {
                state: state.core as SmashUpCore,
                sourcePlayerId: context.playerId,
            }) as any[];
        return interaction;
    },
    onResolve: ({ state, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        const amount = (base?.buriedCards?.length ?? 0) > 0 ? 4 : 2;
        return {
            events: [addTempPower(selected.minionUid, selected.baseIndex, amount, 'ancient_egyptians_mummy_strength', timestamp)],
        };
    },
});

const ancientEgyptiansMummyStrengthProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (getOwnMinions(ctx.state, ctx.playerId).length === 0) return { events: [] };
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
        nextProgram: ancientEgyptiansMummyStrengthTargetPromptProgram,
    };
});

const ancientEgyptiansAncientCurseConfirmPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { targetMinionUid: string; baseIndex: number; baseDefId?: string }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_ancient_curse_confirm',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ancient_egyptians_ancient_curse_confirm_${context.now}_${context.targetMinionUid}`,
        context.playerId,
        '远古诅咒：是否移除该随从上的 1 个 +1 力量指示物？',
        [
            {
                id: 'apply',
                label: '移除 1 个 +1 力量指示物',
                labelKey: 'ui.ancient_egyptians_ancient_curse_confirm_option',
                value: {
                    apply: true,
                    targetMinionUid: context.targetMinionUid,
                    baseIndex: context.baseIndex,
                    ...(context.baseDefId ? { baseDefId: context.baseDefId } : {}),
                },
                displayMode: 'button' as const,
            },
            createSkipOption('跳过（不移除）', 'ui.ancient_egyptians_ancient_curse_skip_option'),
        ],
        {
            sourceId: 'ancient_egyptians_ancient_curse_confirm',
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            titleKey: 'ui.ancient_egyptians_ancient_curse_confirm_title',
        },
    ),
    onResolve: ({ state, value, timestamp }) => {
        const selected = value as { apply?: boolean; targetMinionUid?: string; baseIndex?: number; skip?: boolean } | undefined;
        if (!selected || selected.skip || !selected.apply || !selected.targetMinionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.targetMinionUid);
        if (!target || (target.powerCounters ?? 0) <= 0) return { events: [] };
        return {
            events: [removePowerCounter(target.uid, selected.baseIndex, 1, 'ancient_egyptians_ancient_curse', timestamp)],
        };
    },
});

const ancientEgyptiansAncientCurseProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (!ctx.targetMinionUid) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target) return { events: [] };
    const counters = target.powerCounters ?? 0;
    if (counters <= 0) return { events: [] };
    if (!ctx.matchState) return { events: [] };
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            targetMinionUid: target.uid,
            baseIndex: ctx.baseIndex,
            baseDefId: base?.defId,
        }),
        nextProgram: ancientEgyptiansAncientCurseConfirmPromptProgram,
    };
});

const ancientEgyptiansSealTheTombBuryPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { baseIndex: number; cardUid: string }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_seal_the_tomb_bury',
    buildInteraction: (context) => {
        const player = context.state.players[context.playerId];
        const buriableHand = player?.hand.filter(card => card.uid !== context.cardUid) ?? [];
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_seal_the_tomb_bury_${context.now}`,
            context.playerId,
            '封印墓穴：选择至多两张手牌埋葬到这里',
            buildHandCardOptions(buriableHand),
            {
                sourceId: 'ancient_egyptians_seal_the_tomb_bury',
                targetType: 'hand',
                multi: { min: 0, max: Math.min(2, buriableHand.length) },
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_seal_the_tomb_bury_title',
            },
        );
        interaction.data.optionsGenerator = (state) => {
            const liveHand = ((state.core as SmashUpCore).players[context.playerId]?.hand ?? [])
                .filter(card => card.uid !== context.cardUid);
            return buildHandCardOptions(liveHand);
        };
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = (Array.isArray(value) ? value : []) as HandCardChoice[];
        if (selected.length === 0) return { events: [] };
        return {
            events: selected.flatMap((card) => buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId,
                cardUid: card.cardUid,
                defId: card.defId,
                baseIndex: context.baseIndex,
                trueOwnerId: playerId,
                buriedFrom: 'hand',
                reason: 'ancient_egyptians_seal_the_tomb',
                random,
                now: timestamp,
            })),
        };
    },
});

const ancientEgyptiansSealTheTombUncoverNextProgram = createEffectProgram<
    SealTheTombUncoverContinuationContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    const [buried, ...remainingChoices] = context.pendingChoices;
    if (!buried) return { events: [] };

    const result = uncoverBuriedCard({
        matchState: context.matchState,
        playerId: context.playerId,
        cardUid: buried.cardUid,
        baseIndex: buried.baseIndex,
        random: context.random,
        now: context.now,
        reason: 'ancient_egyptians_seal_the_tomb',
    });

    return {
        events: result.events,
        matchState: result.state,
        ...(remainingChoices.length > 0
            ? {
                context: createPromptContext(result.state, context.playerId, context.now, {
                    pendingChoices: remainingChoices,
                    random: context.random,
                }),
                nextProgram: ancientEgyptiansSealTheTombUncoverNextProgram,
            }
            : {}),
    };
});

const ancientEgyptiansSealTheTombUncoverPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { baseIndex: number }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_seal_the_tomb_uncover',
    buildInteraction: (context) => {
        const choices = getBuriedCardChoices(context.state, context.playerId, context.baseIndex);
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_seal_the_tomb_uncover_${context.now}`,
            context.playerId,
            '封印墓穴：翻开同一基地至多两张你的埋葬牌',
            buildBuriedCardChoiceOptions(context.state, context.playerId, choices),
            {
                sourceId: 'ancient_egyptians_seal_the_tomb_uncover',
                targetType: 'generic',
                multi: { min: 0, max: Math.min(2, choices.length) },
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_seal_the_tomb_uncover_title',
            },
        );
        interaction.data.optionsGenerator = (state) => {
            const liveChoices = getBuriedCardChoices(state.core as SmashUpCore, context.playerId, context.baseIndex);
            return buildBuriedCardChoiceOptions(state.core as SmashUpCore, context.playerId, liveChoices);
        };
        return interaction;
    },
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const selected = (Array.isArray(value) ? value : []) as BuriedChoice[];
        if (selected.length === 0) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, {
                pendingChoices: selected,
                random,
            }),
            nextProgram: ancientEgyptiansSealTheTombUncoverNextProgram,
        };
    },
});

const ancientEgyptiansSealTheTombModePromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { baseIndex: number; cardUid: string }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_seal_the_tomb_mode',
    buildInteraction: (context) => {
        const player = context.state.players[context.playerId];
        const buriedChoices = getBuriedCardChoices(context.state, context.playerId, context.baseIndex);
        const buriableHand = player?.hand.filter(card => card.uid !== context.cardUid) ?? [];
        const options = [];
        if (buriableHand.length > 0) {
            options.push({
                id: 'bury',
                label: '埋葬至多两张手牌',
                labelKey: 'ui.ancient_egyptians_seal_the_tomb_mode_bury_option',
                value: { mode: 'bury' },
                displayMode: 'button' as const,
            });
        }
        if (buriedChoices.length > 0) {
            options.push({
                id: 'uncover',
                label: '翻开同一基地至多两张你的埋葬牌',
                labelKey: 'ui.ancient_egyptians_seal_the_tomb_mode_uncover_option',
                value: { mode: 'uncover' },
                displayMode: 'button' as const,
            });
        }
        return createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_seal_the_tomb_mode_${context.now}`,
            context.playerId,
            '封印墓穴：选择要执行的效果',
            options,
            {
                sourceId: 'ancient_egyptians_seal_the_tomb_mode',
                targetType: 'button',
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_seal_the_tomb_mode_title',
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const mode = (value as any)?.mode as 'bury' | 'uncover' | undefined;
        if (!mode) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, {
                baseIndex: context.baseIndex,
                cardUid: context.cardUid,
            }),
            nextProgram: mode === 'bury'
                ? ancientEgyptiansSealTheTombBuryPromptProgram
                : ancientEgyptiansSealTheTombUncoverPromptProgram,
        };
    },
});

const ancientEgyptiansSealTheTombProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const player = ctx.state.players[ctx.playerId];
    const buriedChoices = getBuriedCardChoices(ctx.state, ctx.playerId, ctx.baseIndex);
    const buriableHand = player?.hand.filter(card => card.uid !== ctx.cardUid) ?? [];
    if (buriableHand.length === 0 && buriedChoices.length === 0) return { events: [] };
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, { baseIndex: ctx.baseIndex, cardUid: ctx.cardUid }),
        nextProgram: ancientEgyptiansSealTheTombModePromptProgram,
    };
});

const ancientEgyptiansMummyAfterScoringPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { cardUid: string; defId: string; sourceBaseIndex: number }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_mummy_after_scoring',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ancient_egyptians_mummy_after_scoring_${context.now}_${context.cardUid}`,
        context.playerId,
        '木乃伊：你可以将此随从埋葬到另一个基地，而不是进入弃牌堆',
        [
            createSkipOption(),
            ...buildFieldSourceToBaseTargetOptions(
                {
                    type: 'minion',
                    uid: context.cardUid,
                    defId: context.defId,
                    fromBaseIndex: context.sourceBaseIndex,
                },
                context.state.bases
                    .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? base.defId }))
                    .filter((entry) => entry.baseIndex !== context.sourceBaseIndex),
                context.state,
            ),
        ] as any[],
        buildFieldSourceTargetPromptConfig({
            sourceId: 'ancient_egyptians_mummy_after_scoring',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            titleKey: 'ui.ancient_egyptians_mummy_after_scoring_title',
        }),
    ),
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const resolvedBaseIndex = resolveLiveBaseIndex(state.core, selected?.baseIndex, selected?.baseDefId);
        if (resolvedBaseIndex === undefined) return { events: [] };
        return {
            events: buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                baseIndex: resolvedBaseIndex,
                trueOwnerId: playerId,
                buriedFrom: 'play',
                reason: 'ancient_egyptians_mummy',
                random,
                now: timestamp,
            }),
        };
    },
});

const ancientEgyptiansMummyAfterScoringProgram = createEffectProgram<any, SmashUpCore, SmashUpEvent>((ctx) => {
    const sourceCardUid = ctx.sourceCardUid as string | undefined;
    const sourceControllerId = ctx.sourceControllerId as PlayerId | undefined;
    const sourceBaseIndex = ctx.sourceBaseIndex as number | undefined;
    if (!ctx.matchState || !sourceCardUid || sourceControllerId === undefined || sourceBaseIndex === undefined) {
        return { events: [] };
    }
    const sourceDefId = findMinionOnBases(ctx.state, sourceCardUid)?.minion.defId ?? 'ancient_egyptians_mummy';
    const baseOptions = buildBaseTargetOptions(
        ctx.state.bases
            .map((base: any, baseIndex: number) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? base.defId }))
            .filter((entry: any) => entry.baseIndex !== sourceBaseIndex),
        ctx.state,
    );
    if (baseOptions.length === 0) return { events: [] };
    return {
        events: [],
        context: createPromptContext(ctx.matchState, sourceControllerId, ctx.now, {
            cardUid: sourceCardUid,
            defId: sourceDefId,
            sourceBaseIndex,
        }),
        nextProgram: ancientEgyptiansMummyAfterScoringPromptProgram,
    };
});

const ancientEgyptiansPharaohBeforeScoringPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { baseIndex: number }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ancient_egyptians_pharaoh_before_scoring',
    buildInteraction: (context) => {
        const base = context.state.bases[context.baseIndex];
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_pharaoh_before_scoring_${context.now}`,
            context.playerId,
            '法老：你可以在计分前翻开这里你的一张埋葬牌',
            [createSkipOption(), ...buildBuriedCardOptions(context.state, context.playerId, base?.buriedCards ?? [], true)] as any[],
            {
                sourceId: 'ancient_egyptians_pharaoh_before_scoring',
                targetType: 'generic',
                genericIntent: 'buried-card',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_pharaoh_before_scoring_title',
            },
        );
        interaction.data.optionsGenerator = (state) => {
            const liveBase = (state.core as SmashUpCore).bases[context.baseIndex];
            return [createSkipOption(), ...buildBuriedCardOptions(state.core as SmashUpCore, context.playerId, liveBase?.buriedCards ?? [], true)] as any[];
        };
        return interaction;
    },
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const selected = value as BuriedChoice | { skip?: true } | undefined;
        if (!selected || (selected as any)?.skip || !(selected as BuriedChoice).cardUid) return { events: [] };
        const result = uncoverBuriedCard({
            matchState: state,
            playerId,
            cardUid: (selected as BuriedChoice).cardUid,
            baseIndex: (selected as BuriedChoice).baseIndex,
            random,
            now: timestamp,
            reason: 'ancient_egyptians_pharaoh',
        });
        return { events: result.events, matchState: result.state };
    },
});

const ancientEgyptiansPharaohBeforeScoringChooseSourcePromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & {
        baseIndex: number;
        sourceBaseIndex: number;
        sourceDefId: string;
        sourceMinionUid: string;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'ancient_egyptians_pharaoh_before_scoring_choose_source',
    buildInteraction: (context) => {
        const source = findMinionOnBases(context.matchState.core, context.sourceMinionUid);
        const sourceOptions = source && source.minion.controller === context.playerId
            ? buildFieldSourceActionOptions({
                type: 'minion',
                uid: source.minion.uid,
                defId: source.minion.defId,
                baseIndex: source.baseIndex,
                label: getCardDef(source.minion.defId)?.name ?? source.minion.defId,
            })
            : [];
        const interaction = createAbilityRuntimeSimpleChoice(
            `ancient_egyptians_pharaoh_before_scoring_source_${context.now}`,
            context.playerId,
            '法老：点击法老发动计分前翻开埋葬牌',
            [createSkipOption(), ...sourceOptions] as any[],
            buildFieldSourceActionPromptConfig({
                sourceId: 'ancient_egyptians_pharaoh_before_scoring_choose_source',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.ancient_egyptians_pharaoh_before_scoring_choose_source_title',
            }),
        );
        interaction.data.optionsGenerator = (state) => {
            const liveSource = findMinionOnBases(state.core as SmashUpCore, context.sourceMinionUid);
            const liveOptions = liveSource && liveSource.minion.controller === context.playerId
                ? buildFieldSourceActionOptions({
                    type: 'minion',
                    uid: liveSource.minion.uid,
                    defId: liveSource.minion.defId,
                    baseIndex: liveSource.baseIndex,
                    label: getCardDef(liveSource.minion.defId)?.name ?? liveSource.minion.defId,
                })
                : [];
            return [createSkipOption(), ...liveOptions] as any[];
        };
        return interaction;
    },
    onResolve: ({ state, context, value, playerId, timestamp }) => {
        const selected = value as { skip?: true; sourceUid?: string; minionUid?: string; baseIndex?: number } | undefined;
        if (!selected || selected.skip) return { events: [] };
        const sourceUid = selected.sourceUid ?? selected.minionUid;
        if (sourceUid !== context.sourceMinionUid) return { events: [] };
        const source = findMinionOnBases(state.core, sourceUid);
        if (!source || source.minion.controller !== playerId) return { events: [] };
        const liveBase = state.core.bases[context.baseIndex];
        const options = buildBuriedCardOptions(state.core, playerId, liveBase?.buriedCards ?? [], true);
        if (!liveBase || options.length === 0) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, { baseIndex: context.baseIndex }),
            nextProgram: ancientEgyptiansPharaohBeforeScoringPromptProgram,
        };
    },
});

const ancientEgyptiansPharaohBeforeScoringProgram = createEffectProgram<any, SmashUpCore, SmashUpEvent>((ctx) => {
    const sourceCardUid = ctx.sourceCardUid as string | undefined;
    const sourceControllerId = ctx.sourceControllerId as PlayerId | undefined;
    if (!ctx.matchState || ctx.baseIndex === undefined || !sourceCardUid || sourceControllerId === undefined) return { events: [] };
    const source = findMinionOnBases(ctx.state, sourceCardUid);
    if (!source || source.minion.controller !== sourceControllerId) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    const options = buildBuriedCardOptions(ctx.state, sourceControllerId, base?.buriedCards ?? [], true);
    if (!base || options.length === 0) return { events: [] };
    return {
        events: [],
        context: createPromptContext(ctx.matchState, sourceControllerId, ctx.now, {
            baseIndex: ctx.baseIndex,
            sourceBaseIndex: source.baseIndex,
            sourceDefId: source.minion.defId,
            sourceMinionUid: source.minion.uid,
        }),
        nextProgram: ancientEgyptiansPharaohBeforeScoringChooseSourcePromptProgram,
    };
});

const ancientEgyptiansPyramidsDuringTurnPromptProgram = createPromptProgram<
    AncientEgyptiansPromptContext & { baseIndex: number }
, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_pyramids',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `base_pyramids_${context.now}`,
            context.playerId,
            '金字塔：你可以将一张手牌埋葬在这里',
            [createSkipOption(), ...buildHandCardOptions(context.state.players[context.playerId]?.hand ?? [])] as any[],
            {
                sourceId: 'base_pyramids',
                targetType: 'hand',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.base_pyramids_bury_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            [createSkipOption(), ...buildHandCardOptions((state.core as SmashUpCore).players[context.playerId]?.hand ?? [])] as any[];
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as any)?.skip) return { events: [] };
        const selected = value as HandCardChoice | undefined;
        if (!selected?.cardUid) return { events: [] };
        const baseDefId = state.core.bases[context.baseIndex]?.defId ?? 'base_pyramids';
        const usedEvent: BaseAbilityUsedEvent = {
            type: SU_EVENTS.BASE_ABILITY_USED,
            payload: { playerId, baseIndex: context.baseIndex, baseDefId },
            timestamp,
        };
        return {
            events: [
                usedEvent,
                ...buildBuryCardEvents({
                    core: state.core,
                    matchState: state,
                    playerId,
                    cardUid: selected.cardUid,
                    defId: selected.defId,
                    baseIndex: context.baseIndex,
                    trueOwnerId: playerId,
                    buriedFrom: 'hand',
                    reason: 'base_pyramids',
                    random,
                    now: timestamp,
                }),
            ],
        };
    },
});

const ancientEgyptiansPyramidsDuringTurnProgram = createEffectProgram<any, SmashUpCore, SmashUpEvent>((ctx) => {
    const player = ctx.state.players[ctx.playerId];
    if (!ctx.matchState || !player || player.hand.length === 0) return { events: [] };
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, { baseIndex: ctx.baseIndex }),
        nextProgram: ancientEgyptiansPyramidsDuringTurnPromptProgram,
    };
});

function buildHandCardOptions(hand: Array<{ uid: string; defId: string }>): any[] {
    return hand.map((card, index) => ({
        id: `hand-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function buildBuriedCardOptions(
    state: SmashUpCore,
    viewerPlayerId: PlayerId,
    buriedCards: BuriedCardOnBase[],
    onlyOwned: boolean,
): any[] {
    const filtered = onlyOwned ? buriedCards.filter(card => card.controllerId === viewerPlayerId) : buriedCards;
    return filtered.map((buried, index) => {
        const baseIndex = state.bases.findIndex(base => (base.buriedCards ?? []).some(card => card.uid === buried.uid));
        const baseDefId = baseIndex >= 0 ? state.bases[baseIndex]?.defId : undefined;
        return {
            id: `buried-${buried.uid}`,
        label: buried.controllerId === viewerPlayerId
            ? (getCardDef(buried.defId)?.name ?? buried.defId)
            : `埋葬牌 ${index + 1}`,
        value: { cardUid: buried.uid, defId: buried.defId, baseIndex, baseDefId },
        displayMode: 'card' as const,
        };
    });
}

function getBuriedCardChoices(
    state: SmashUpCore,
    playerId: PlayerId,
    restrictedBaseIndex?: number,
): BuriedChoice[] {
    const choices: BuriedChoice[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex++) {
        if (restrictedBaseIndex !== undefined && baseIndex !== restrictedBaseIndex) continue;
        for (const buried of state.bases[baseIndex].buriedCards ?? []) {
            if (buried.controllerId !== playerId) continue;
            choices.push({ cardUid: buried.uid, baseIndex, defId: buried.defId, baseDefId: state.bases[baseIndex].defId });
        }
    }
    return choices;
}

function buildBuriedCardChoiceOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    choices: BuriedChoice[],
): any[] {
    return choices.map((choice) => {
        const buried = (state.bases[choice.baseIndex].buriedCards ?? []).find(card => card.uid === choice.cardUid);
        const baseName = getBaseDef(state.bases[choice.baseIndex].defId)?.name ?? state.bases[choice.baseIndex].defId;
        return {
            id: `buried-${choice.cardUid}`,
            label: `${getCardDef(buried?.defId ?? '')?.name ?? buried?.defId ?? '埋葬牌'} @ ${baseName}`,
            value: { ...choice, defId: choice.defId ?? buried?.defId, baseDefId: choice.baseDefId ?? state.bases[choice.baseIndex].defId },
            displayMode: 'card' as const,
        };
    });
}

function getOwnMinions(state: SmashUpCore, playerId: PlayerId): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const minions: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (minion.controller !== playerId) return;
            minions.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            });
        });
    });
    return minions;
}
