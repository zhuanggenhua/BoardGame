import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { canStartDuel, startDuelWithEvents } from '../domain/duel';
import {
    addPowerCounter,
    addTempPower,
    applySemanticMinionEffectBatch,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    createSkipOption,
    findMinionOnBases,
    getMinionPower,
    grantExtraAction,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import type { CardInstance, MinionMetadataUpdatedEvent, MinionOnBase, SmashUpCore, SmashUpEvent, VpAwardedEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type BaseChoice = { baseIndex?: number; baseDefId?: string };
type MinionChoice = { minionUid?: string; baseIndex?: number; defId?: string };
type RoninContinuation = {
    minionUid: string;
    baseIndex: number;
    counterAmount?: number;
    sourceId?: 'samurai_ronin' | 'samurai_ronin_pod';
};
type HonorAncestorsContinuation = { maxShuffle: number };
type CombatContinuation = {
    sourceId: string;
    casterPlayerId: PlayerId;
    outcome: 'vp_to_winner' | 'draw2_to_winner' | 'destroy_loser';
    destroyReason?: string;
    friendlyMinionUid?: string;
};
type SamuraiPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};
type SamuraiRoninContext = SamuraiPromptContext & RoninContinuation;
type SamuraiCombatRootContext = SamuraiPromptContext & Pick<CombatContinuation, 'sourceId' | 'outcome' | 'destroyReason'>;
type SamuraiCombatPromptContext = SamuraiCombatRootContext & { baseIndex: number; friendlyMinionUid?: string };
type SamuraiCodeOfBushidoContext = SamuraiPromptContext & { remaining: number };
type SamuraiHonorAncestorsContext = SamuraiPromptContext & HonorAncestorsContinuation;

function createSamuraiPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): SamuraiPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function attachOptionsGenerator<T>(
    interaction: T,
    optionsGenerator: (state: MatchState<SmashUpCore>) => unknown[],
): T & { data: Record<string, unknown> } {
    const descriptor = interaction as T & { data?: Record<string, unknown> };
    return {
        ...descriptor,
        data: {
            ...(descriptor.data ?? {}),
            optionsGenerator,
        },
    };
}

export function registerSamuraiAbilities(): void {
    registerAbilityProgram('samurai_ronin', 'onPlay', { program: samuraiRoninOnPlayProgram });
    registerAbilityProgram('samurai_ronin_pod', 'onPlay', { program: samuraiRoninPodOnPlayProgram });
    registerAbilityProgram('samurai_yokai_attack', 'onPlay', { program: samuraiYokaiAttackOnPlayProgram });
    registerAbilityProgram('samurai_honorable_combat', 'onPlay', { program: samuraiHonorableCombatOnPlayProgram });
    registerAbilityProgram('samurai_code_of_bushido', 'onPlay', { program: samuraiCodeOfBushidoOnPlayProgram });
    registerAbilityProgram('samurai_honor_the_ancestors', 'onPlay', { program: samuraiHonorTheAncestorsOnPlayProgram });
    registerSimpleAbility('samurai_way_of_the_warrior', 'onPlay', samuraiWayOfTheWarriorOnPlay);
    registerSimpleAbility('samurai_way_of_the_warrior_pod', 'onPlay', samuraiWayOfTheWarriorOnPlay);
    registerAbilityProgram('samurai_heart_of_the_battle', 'special', { program: samuraiHeartOfTheBattleSpecialProgram });

    registerTrigger('samurai_samurai_chan', 'onMinionDestroyed', samuraiChanTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_samurai_chan', 'onMinionDiscardedFromBase', samuraiChanTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_samurai_chan_pod', 'onMinionDestroyed', samuraiChanTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_samurai_chan_pod', 'onMinionDiscardedFromBase', samuraiChanTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_bushi', 'onMinionDestroyed', samuraiBushiTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_bushi', 'onMinionDiscardedFromBase', samuraiBushiTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_bushi_pod', 'onMinionDestroyed', samuraiBushiTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_bushi_pod', 'onMinionDiscardedFromBase', samuraiBushiTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_shogun', 'onMinionDestroyed', samuraiShogunTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_shogun', 'onMinionDiscardedFromBase', samuraiShogunTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_shogun_pod', 'onMinionDestroyed', samuraiShogunTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_shogun_pod', 'onMinionDiscardedFromBase', samuraiShogunTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_final_haiku', 'onMinionDestroyed', samuraiFinalHaikuTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_final_haiku', 'onMinionDiscardedFromBase', samuraiFinalHaikuTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_final_haiku_pod', 'onMinionDestroyed', samuraiFinalHaikuTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_final_haiku_pod', 'onMinionDiscardedFromBase', samuraiFinalHaikuTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_way_of_the_warrior', 'onMinionDestroyed', samuraiWayOfTheWarriorTrigger, {
        global: true,
        canTrigger: canTriggerSamuraiWayOfTheWarrior,
    });
    registerTrigger('samurai_way_of_the_warrior', 'onMinionDiscardedFromBase', samuraiWayOfTheWarriorTrigger, {
        global: true,
        canTrigger: canTriggerSamuraiWayOfTheWarrior,
    });
    registerTrigger('samurai_way_of_the_warrior_pod', 'onMinionDestroyed', samuraiWayOfTheWarriorTrigger, {
        global: true,
        canTrigger: canTriggerSamuraiWayOfTheWarrior,
    });
    registerTrigger('samurai_way_of_the_warrior_pod', 'onMinionDiscardedFromBase', samuraiWayOfTheWarriorTrigger, {
        global: true,
        canTrigger: canTriggerSamuraiWayOfTheWarrior,
    });
    registerTrigger('samurai_honor_the_fallen', 'onMinionDestroyed', samuraiHonorTheFallenTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_honor_the_fallen', 'onMinionDiscardedFromBase', samuraiHonorTheFallenTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_honor_the_fallen_pod', 'onMinionDestroyed', samuraiHonorTheFallenTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger('samurai_honor_the_fallen_pod', 'onMinionDiscardedFromBase', samuraiHonorTheFallenTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger('base_sakura_garden', 'onMinionDestroyed', samuraiSakuraGardenTrigger, {
        sourceScope: 'triggerBase',
    });
    registerTrigger('base_sakura_garden', 'onMinionDiscardedFromBase', samuraiSakuraGardenTrigger, {
        sourceScope: 'triggerBase',
    });

    registerBaseAbility('base_shoguns_palace', 'onMinionPlayed', samuraiBaseShogunsPalaceOnMinionPlayed, {
        mandatory: false,
    });
}

export function registerSamuraiInteractionHandlers(): void {
}

function resolveSamuraiRoninPrompt(
    context: SamuraiRoninContext,
    value: unknown,
    timestamp: number,
): AbilityResult {
    if (!(value as { apply?: boolean } | undefined)?.apply) return { events: [] };
    return {
        events: [
            addPowerCounter(
                context.minionUid,
                context.baseIndex,
                context.counterAmount ?? 1,
                context.sourceId ?? 'samurai_ronin',
                timestamp,
            ),
        ],
    };
}

const samuraiRoninPromptProgram = createPromptProgram<SamuraiRoninContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'samurai_ronin',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `samurai_ronin_${context.now}`,
        context.playerId,
        '浪人：你可以在此随从上放置一个 +1 力量指示物',
        [
            {
                id: 'yes',
                label: '放置一个指示物',
                labelKey: 'ui.samurai_ronin_apply_option',
                value: { apply: true },
                displayMode: 'button' as const,
            },
            {
                id: 'no',
                label: '跳过',
                labelKey: 'ui.skip',
                value: { apply: false },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'samurai_ronin',
            titleKey: 'ui.samurai_ronin_title',
            targetType: 'button',
        },
    ),
    onResolve: ({ context, value, timestamp }) => resolveSamuraiRoninPrompt(context, value, timestamp),
});

const samuraiRoninPodPromptProgram = createPromptProgram<SamuraiRoninContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'samurai_ronin_pod',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `samurai_ronin_pod_${context.now}`,
        context.playerId,
        '浪人（POD）：若这是你在此基地唯一的随从，你可以在此随从上放置两个 +1 力量指示物',
        [
            {
                id: 'yes',
                label: '放置两个指示物',
                labelKey: 'ui.samurai_ronin_pod_apply_option',
                value: { apply: true },
                displayMode: 'button' as const,
            },
            {
                id: 'no',
                label: '跳过',
                labelKey: 'ui.skip',
                value: { apply: false },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'samurai_ronin_pod',
            titleKey: 'ui.samurai_ronin_pod_title',
            targetType: 'button',
        },
    ),
    onResolve: ({ context, value, timestamp }) => resolveSamuraiRoninPrompt(context, value, timestamp),
});

const samuraiRoninOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const ownMinions = ctx.state.bases[source.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    if (ownMinions.length !== 1) return { events: [] };
    return {
        events: [],
        context: createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            minionUid: source.minion.uid,
            baseIndex: source.baseIndex,
            counterAmount: 1,
            sourceId: 'samurai_ronin',
        } satisfies RoninContinuation),
        nextProgram: samuraiRoninPromptProgram,
    };
});

const samuraiRoninPodOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const ownMinions = ctx.state.bases[source.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    if (ownMinions.length !== 1) return { events: [] };
    return {
        events: [],
        context: createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            minionUid: source.minion.uid,
            baseIndex: source.baseIndex,
            counterAmount: 2,
            sourceId: 'samurai_ronin_pod',
        } satisfies RoninContinuation),
        nextProgram: samuraiRoninPodPromptProgram,
    };
});

const samuraiYokaiAttackPromptProgram = createPromptProgram<SamuraiPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'samurai_yokai_attack_prompt',
    interactionSourceIds: ['samurai_yokai_attack'],
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `samurai_yokai_attack_${context.now}`,
            context.playerId,
            '妖怪来袭！：你可以消灭一个自己的随从，以额外打出一个随从和一个行动',
            [
                createSkipOption('跳过（不消灭随从）', 'ui.samurai_yokai_attack_skip_option') as any,
                ...buildMinionTargetOptions(
                    collectOwnMinions(context.matchState.core, context.playerId),
                    {
                        state: context.matchState.core,
                        sourcePlayerId: context.playerId,
                        sourceKind: 'action',
                        semanticRole: 'reference',
                    },
                ) as any[],
            ],
            {
                sourceId: 'samurai_yokai_attack',
                titleKey: 'ui.samurai_yokai_attack_title',
                targetType: 'minion',
                responseValidationMode: 'live',
            },
        ),
        (state) => [
            createSkipOption('跳过（不消灭随从）', 'ui.samurai_yokai_attack_skip_option') as any,
            ...buildMinionTargetOptions(
                collectOwnMinions(state.core, context.playerId),
                {
                    state: state.core,
                    sourcePlayerId: context.playerId,
                    sourceKind: 'action',
                    semanticRole: 'reference',
                },
            ) as any[],
        ],
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        const result = applySemanticMinionEffectBatch(
            state,
            [{ minion: target, baseIndex: selected.baseIndex }],
            {
                sourcePlayerId: playerId,
                sourceKind: 'action',
                effectType: 'destroy',
                mode: 'apply',
                feedbackPlayerId: playerId,
                now: timestamp,
                allBlockedMessageKey: 'feedback.target_protected',
                buildEvents: ({ minion, baseIndex }) => buildValidatedDestroyEvents(state, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: baseIndex,
                    destroyerId: playerId,
                    reason: 'samurai_yokai_attack',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceDefId: 'samurai_yokai_attack',
                    sourceControllerId: playerId,
                    sourceKind: 'action',
                }),
            },
        );
        return {
            events: [
                ...result.events,
                ...(result.allowed.length > 0
                    ? [
                        grantExtraMinion(playerId, 'samurai_yokai_attack', timestamp),
                        grantExtraAction(playerId, 'samurai_yokai_attack', timestamp),
                    ]
                    : []),
            ],
        };
    },
});

const samuraiYokaiAttackOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now),
        nextProgram: samuraiYokaiAttackPromptProgram,
    };
});

const samuraiCombatEnemyPromptProgram = createPromptProgram<SamuraiCombatPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'samurai_combat_enemy_prompt',
    interactionSourceIds: ['samurai_honorable_combat_enemy', 'samurai_heart_of_the_battle_enemy', 'base_shoguns_palace'],
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `samurai_combat_enemy_${context.now}`,
            context.playerId,
            context.sourceId === 'base_shoguns_palace'
                ? '天守阁：此随从可以与这里另一位玩家的一个随从决斗'
                : '选择对手要决斗的随从',
            buildCombatEnemyOptions(
                context.matchState.core,
                context.baseIndex,
                context.playerId,
                context.sourceId === 'samurai_honorable_combat',
                true,
            ),
            {
                sourceId: context.sourceId === 'samurai_heart_of_the_battle'
                    ? 'samurai_heart_of_the_battle_enemy'
                    : context.sourceId === 'base_shoguns_palace'
                        ? 'base_shoguns_palace'
                    : 'samurai_honorable_combat_enemy',
                targetType: 'minion',
                responseValidationMode: 'live',
                autoCancelOption: true,
            },
        ),
        (state) => buildCombatEnemyOptions(
            state.core,
            context.baseIndex,
            context.playerId,
            context.sourceId === 'samurai_honorable_combat',
            true,
        ),
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) return { events: [] };
        const selected = value as MinionChoice | undefined;
        if (!context.friendlyMinionUid || !selected?.minionUid) return { events: [] };
        const duelStarted = startDuelWithEvents(state, {
            sourceId: context.sourceId,
            sourcePlayerId: context.playerId,
            challengerMinionUid: context.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: context.outcome,
            destroyReason: context.destroyReason,
        }, timestamp);
        return {
            events: duelStarted.events,
            matchState: duelStarted.state,
        };
    },
});

const samuraiCombatFriendlyPromptProgram = createPromptProgram<SamuraiCombatPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'samurai_combat_friendly_prompt',
    interactionSourceIds: ['samurai_honorable_combat_friendly', 'samurai_heart_of_the_battle_friendly'],
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `samurai_combat_friendly_${context.now}_${context.baseIndex}`,
            context.playerId,
            context.sourceId === 'samurai_heart_of_the_battle' ? '战斗之心：选择你要决斗的随从' : '荣誉决斗：选择你要决斗的随从',
            buildMinionTargetOptions(
                collectOwnMinionsOnBase(context.matchState.core, context.playerId, context.baseIndex),
                { state: context.matchState.core, sourcePlayerId: context.playerId },
            ) as any[],
            {
                sourceId: context.sourceId === 'samurai_heart_of_the_battle'
                    ? 'samurai_heart_of_the_battle_friendly'
                    : 'samurai_honorable_combat_friendly',
                targetType: 'minion',
                responseValidationMode: 'live',
                autoCancelOption: true,
            },
        ),
        (state) => buildMinionTargetOptions(
            collectOwnMinionsOnBase(state.core, context.playerId, context.baseIndex),
            { state: state.core, sourcePlayerId: context.playerId },
        ) as any[],
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) return { events: [] };
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        if (buildCombatEnemyOptions(
            state.core,
            context.baseIndex,
            context.playerId,
            context.sourceId === 'samurai_honorable_combat',
            true,
        ).length === 0) {
            return { events: [] };
        }
        return {
            events: [],
            context: createSamuraiPromptContext(state, context.playerId, timestamp, {
                sourceId: context.sourceId,
                outcome: context.outcome,
                destroyReason: context.destroyReason,
                baseIndex: context.baseIndex,
                friendlyMinionUid: selected.minionUid,
            }),
            nextProgram: samuraiCombatEnemyPromptProgram,
        };
    },
});

const samuraiCombatBasePromptProgram = createPromptProgram<SamuraiCombatRootContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'samurai_combat_base_prompt',
    interactionSourceIds: ['samurai_honorable_combat_base'],
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `samurai_combat_base_${context.now}`,
            context.playerId,
            '荣誉决斗：选择一个有对手力量高于你的基地',
            buildBaseTargetOptions(collectHonorableCombatBases(context.matchState.core, context.playerId), context.matchState.core),
            {
                sourceId: 'samurai_honorable_combat_base',
                titleKey: 'ui.samurai_honorable_combat_base_title',
                targetType: 'base',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildBaseTargetOptions(collectHonorableCombatBases(state.core, context.playerId), state.core),
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        return {
            events: [],
            context: createSamuraiPromptContext(state, context.playerId, timestamp, {
                sourceId: context.sourceId,
                outcome: context.outcome,
                destroyReason: context.destroyReason,
                baseIndex: selected.baseIndex,
            }),
            nextProgram: samuraiCombatFriendlyPromptProgram,
        };
    },
});

const samuraiHonorableCombatOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    const baseOptions = collectHonorableCombatBases(ctx.state, ctx.playerId);
    if (baseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (baseOptions.length === 1) {
        return {
            events: [],
            context: createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                sourceId: 'samurai_honorable_combat',
                outcome: 'vp_to_winner',
                baseIndex: baseOptions[0].baseIndex,
            }),
            nextProgram: samuraiCombatFriendlyPromptProgram,
        };
    }
    return {
        events: [],
        context: createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'samurai_honorable_combat',
            outcome: 'vp_to_winner',
        }),
        nextProgram: samuraiCombatBasePromptProgram,
    };
});

const samuraiCodeOfBushidoPromptProgram = createPromptProgram<SamuraiCodeOfBushidoContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'samurai_code_of_bushido_prompt',
    interactionSourceIds: ['samurai_code_of_bushido'],
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `samurai_code_of_bushido_${context.now}_${context.remaining}`,
            context.playerId,
            `武士道：选择一个你的随从放置 +1 力量指示物（还需 ${context.remaining} 次）`,
            buildMinionTargetOptions(
                collectOwnMinions(context.matchState.core, context.playerId),
                { state: context.matchState.core, sourcePlayerId: context.playerId },
            ) as any[],
            { sourceId: 'samurai_code_of_bushido', targetType: 'minion', responseValidationMode: 'live' },
        ),
        (state) => buildMinionTargetOptions(
            collectOwnMinions(state.core, context.playerId),
            { state: state.core, sourcePlayerId: context.playerId },
        ) as any[],
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || context.remaining <= 0) return { events: [] };
        const nextRemaining = context.remaining - 1;
        return {
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'samurai_code_of_bushido', timestamp)],
            ...(nextRemaining > 0 ? {
                context: createSamuraiPromptContext(state, context.playerId, timestamp, { remaining: nextRemaining }),
                nextProgram: samuraiCodeOfBushidoPromptProgram,
            } : {}),
        };
    },
});

const samuraiCodeOfBushidoOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (ownMinions.length === 1) {
        const target = ownMinions[0];
        return {
            events: [
                addPowerCounter(target.uid, target.baseIndex, 1, 'samurai_code_of_bushido', ctx.now),
                addPowerCounter(target.uid, target.baseIndex, 1, 'samurai_code_of_bushido', ctx.now),
                addPowerCounter(target.uid, target.baseIndex, 1, 'samurai_code_of_bushido', ctx.now),
            ],
        };
    }
    return {
        events: [],
        context: createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now, { remaining: 3 }),
        nextProgram: samuraiCodeOfBushidoPromptProgram,
    };
});

const samuraiHonorTheAncestorsPromptProgram = createPromptProgram<SamuraiHonorAncestorsContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'samurai_honor_the_ancestors_prompt',
    interactionSourceIds: ['samurai_honor_the_ancestors'],
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `samurai_honor_the_ancestors_${context.now}`,
            context.playerId,
            '致敬先祖：选择一个你的随从放置 +1 力量指示物',
            buildMinionTargetOptions(
                collectOwnMinions(context.matchState.core, context.playerId),
                { state: context.matchState.core, sourcePlayerId: context.playerId },
            ) as any[],
            {
                sourceId: 'samurai_honor_the_ancestors',
                titleKey: 'ui.samurai_honor_the_ancestors_title',
                targetType: 'minion',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildMinionTargetOptions(
            collectOwnMinions(state.core, context.playerId),
            { state: state.core, sourcePlayerId: context.playerId },
        ) as any[],
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: buildHonorAncestorsEvents(state.core, context.playerId, selected.minionUid, selected.baseIndex, context.maxShuffle, random, timestamp),
        };
    },
});

const samuraiHonorTheAncestorsOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const maxShuffle = Math.max(Object.keys(ctx.state.players).length - 1, 0);
    if (ownMinions.length === 1) {
        const target = ownMinions[0];
        return {
            events: buildHonorAncestorsEvents(ctx.state, ctx.playerId, target.uid, target.baseIndex, maxShuffle, ctx.random, ctx.now),
        };
    }
    return {
        events: [],
        context: createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now, { maxShuffle }),
        nextProgram: samuraiHonorTheAncestorsPromptProgram,
    };
});

const samuraiHeartOfTheBattleSpecialProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    if (collectOwnMinionsOnBase(ctx.state, ctx.playerId, ctx.baseIndex).length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'samurai_heart_of_the_battle',
            outcome: 'destroy_loser',
            destroyReason: 'samurai_heart_of_the_battle',
            baseIndex: ctx.baseIndex,
        }),
        nextProgram: samuraiCombatFriendlyPromptProgram,
    };
});

function samuraiWayOfTheWarriorOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [
            addTempPower(target.uid, ctx.baseIndex, 3, 'samurai_way_of_the_warrior', ctx.now),
            {
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: target.uid,
                    baseIndex: ctx.baseIndex,
                    metadataUpdate: {
                        samuraiWayOfTheWarriorDrawUntilTurnNumber: (ctx.state.turnNumber ?? 0) + 1,
                        samuraiWayOfTheWarriorDrawPlayerId: ctx.playerId,
                        samuraiWayOfTheWarriorSourceCardUid: ctx.cardUid,
                    },
                    reason: 'samurai_way_of_the_warrior',
                },
                timestamp: ctx.now,
            } as MinionMetadataUpdatedEvent,
        ],
    };
}

function isDestroyPipelineDiscardTrigger(ctx: TriggerContext): boolean {
    return typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('minion-discarded-from-base:');
}

function samuraiChanTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return [];
    if (!ctx.sourceControllerId || ctx.triggerMinionUid !== ctx.sourceCardUid) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function samuraiBushiTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return [];
    if (!ctx.sourceControllerId || ctx.triggerMinionUid !== ctx.sourceCardUid) return [];
    const power = ctx.triggerMinionPower
        ?? ctx.triggerMinion?.basePower
        ?? 0;
    if (power < 5) return [];
    return [{
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'samurai_bushi' },
        timestamp: ctx.now,
    } as VpAwardedEvent];
}

function samuraiShogunTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return [];
    if (!ctx.sourceControllerId || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    if (!ctx.triggerMinion || ctx.triggerMinionUid === ctx.sourceCardUid) return [];
    if (ctx.triggerMinion.controller !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base?.minions.some(minion => minion.uid === ctx.sourceCardUid)) return [];
    return [addPowerCounter(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'samurai_shogun', ctx.now)];
}

function samuraiHonorTheFallenTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return [];
    if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    if (ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function samuraiFinalHaikuTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return [];
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || !ctx.triggerMinion) return [];
    const host = ctx.triggerMinion.attachedActions.some(action => action.uid === ctx.sourceCardUid)
        ? ctx.triggerMinion
        : findAttachedActionHost(ctx.state, ctx.sourceCardUid, ctx.sourceBaseIndex);
    if (!host || host.uid !== ctx.triggerMinionUid) return [];
    const events: SmashUpEvent[] = [];
    ctx.state.bases.forEach((base, baseIndex) => {
        base.minions.forEach(minion => {
            if (minion.controller !== ctx.sourceControllerId) return;
            if (minion.uid === ctx.triggerMinionUid) return;
            events.push(addTempPower(minion.uid, baseIndex, 2, 'samurai_final_haiku', ctx.now));
        });
    });
    return events;
}

function samuraiWayOfTheWarriorTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return [];
    const metadata = ctx.triggerMinion?.metadata ?? {};
    const drawUntilTurnNumber = typeof metadata.samuraiWayOfTheWarriorDrawUntilTurnNumber === 'number'
        ? metadata.samuraiWayOfTheWarriorDrawUntilTurnNumber
        : undefined;
    const drawPlayerId = typeof metadata.samuraiWayOfTheWarriorDrawPlayerId === 'string'
        ? metadata.samuraiWayOfTheWarriorDrawPlayerId as PlayerId
        : undefined;
    if (!drawPlayerId || typeof drawUntilTurnNumber !== 'number') return [];

    const currentTurnNumber = ctx.state.turnNumber ?? 0;
    const currentPlayerId = ctx.state.currentPlayerId ?? ctx.state.turnOrder?.[ctx.state.currentPlayerIndex ?? 0];
    const isWindowActive = currentTurnNumber < drawUntilTurnNumber
        || (currentTurnNumber === drawUntilTurnNumber && currentPlayerId !== drawPlayerId);
    if (!isWindowActive) return [];

    if (ctx.timing === 'onMinionDestroyed' && ctx.baseIndex !== undefined) {
        const base = ctx.state.bases[ctx.baseIndex];
        const destroyedAtBaseThisTurnCount = (ctx.state.turnDestroyedMinions ?? [])
            .filter(record => record.baseIndex === ctx.baseIndex)
            .length;
        if (base?.defId === 'base_temple_of_goju_pod') return [];
        if (base?.defId === 'base_tar_pits' && destroyedAtBaseThisTurnCount === 0) return [];
    }

    return buildStandardDrawEvents(ctx.state, drawPlayerId, 2, ctx.random, ctx.now);
}

function canTriggerSamuraiWayOfTheWarrior(ctx: TriggerContext): boolean {
    const metadata = ctx.triggerMinion?.metadata ?? {};
    const sourceCardUid = typeof metadata.samuraiWayOfTheWarriorSourceCardUid === 'string'
        ? metadata.samuraiWayOfTheWarriorSourceCardUid
        : undefined;
    return !sourceCardUid || ctx.sourceCardUid === sourceCardUid;
}

function samuraiSakuraGardenTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex || !ctx.triggerMinion) return [];
    const controllerId = ctx.triggerMinion.controller;
    const alreadyTriggered = (ctx.state.turnDestroyedMinions ?? []).some(record => (
        record.baseIndex === ctx.baseIndex
        && (record.controller ?? record.owner) === controllerId
    ));
    if (alreadyTriggered) return [];
    return buildStandardDrawEvents(ctx.state, controllerId, 1, ctx.random, ctx.now);
}

function samuraiBaseShogunsPalaceOnMinionPlayed(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.matchState || ctx.minionUid == null) return { events: [] };
    if (!canStartDuel(ctx.state)) return { events: [] };
    if (getTurnMinionsPlayedAtBase(ctx.state, ctx.baseIndex) !== 1) return { events: [] };
    const enemyOptions = buildEnemyOptions(ctx.state, ctx.baseIndex, ctx.playerId);
    if (enemyOptions.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        samuraiCombatEnemyPromptProgram,
        createSamuraiPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceId: 'base_shoguns_palace',
            outcome: 'draw2_to_winner',
            baseIndex: ctx.baseIndex,
            friendlyMinionUid: ctx.minionUid,
        }) satisfies SamuraiCombatPromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

function buildHonorAncestorsEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    minionUid: string,
    baseIndex: number,
    maxShuffle: number,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [addPowerCounter(minionUid, baseIndex, 1, 'samurai_honor_the_ancestors', now)];
    if (maxShuffle <= 0) return events;

    const player = state.players[playerId];
    const discardMinions = player?.discard.filter(card => card.type === 'minion') ?? [];
    if (discardMinions.length === 0) return events;

    const selectedCards = discardMinions.slice(0, maxShuffle);
    const cardsByOwner = new Map<PlayerId, CardInstance[]>();
    for (const card of selectedCards) {
        const ownerId = state.players[card.owner] ? card.owner : playerId;
        cardsByOwner.set(ownerId, [...(cardsByOwner.get(ownerId) ?? []), card]);
    }
    for (const [ownerId, cards] of cardsByOwner) {
        const owner = state.players[ownerId] ?? player;
        const shuffledDeck = random.shuffle([...owner.deck, ...cards]);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ownerId,
                deckUids: shuffledDeck.map(card => card.uid),
                ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
            },
            timestamp: now,
        } as SmashUpEvent);
    }
    return events;
}

function collectOwnMinions(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const results: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach(minion => {
            if (minion.controller !== playerId) return;
            results.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            });
        });
    });
    return results;
}

function collectOwnMinionsOnBase(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return base.minions
        .filter(minion => minion.controller === playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
        }));
}

function collectHonorableCombatBases(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<{ baseIndex: number; label: string }> {
    return state.bases.flatMap((base, baseIndex) => {
        const ownPower = base.minions
            .filter(minion => minion.controller === playerId)
            .reduce((sum, minion) => sum + getMinionPower(state, minion, baseIndex), 0);
        if (ownPower <= 0) return [];
        const hasValidOpponent = Array.from(new Set(base.minions.map(minion => minion.controller)))
            .some(controller => (
                controller !== playerId
                && base.minions.some(minion => minion.controller === controller)
                && base.minions
                    .filter(minion => minion.controller === controller)
                    .reduce((sum, minion) => sum + getMinionPower(state, minion, baseIndex), 0) > ownPower
            ));
        if (!hasValidOpponent) return [];
        if (buildCombatEnemyOptions(state, baseIndex, playerId, true, true).length === 0) return [];
        return [{
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? base.defId,
        }];
    });
}

function buildEnemyOptions(state: SmashUpCore, baseIndex: number, sourcePlayerId: PlayerId): any[] {
    return buildCombatEnemyOptions(state, baseIndex, sourcePlayerId, false);
}

function buildCombatEnemyOptions(
    state: SmashUpCore,
    baseIndex: number,
    sourcePlayerId: PlayerId,
    requireMorePowerController: boolean,
    respectActionProtection: boolean = false,
): any[] {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const ownPower = base.minions
        .filter(minion => minion.controller === sourcePlayerId)
        .reduce((sum, minion) => sum + getMinionPower(state, minion, baseIndex), 0);
    const validControllers = new Set(
        base.minions
            .filter(minion => minion.controller !== sourcePlayerId)
            .map(minion => minion.controller)
            .filter(controller => !requireMorePowerController || (
                base.minions
                    .filter(minion => minion.controller === controller)
                    .reduce((sum, minion) => sum + getMinionPower(state, minion, baseIndex), 0) > ownPower
            )),
    );
    return buildMinionTargetOptions(
        base.minions
            .filter(minion => minion.controller !== sourcePlayerId && validControllers.has(minion.controller))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
            })),
        {
            state,
            sourcePlayerId,
            sourceKind: respectActionProtection ? 'action' : undefined,
            effectType: 'destroy',
            respectActionProtection,
        },
    );
}

function getTurnMinionsPlayedAtBase(state: SmashUpCore, baseIndex: number): number {
    return Object.values(state.players).reduce(
        (total, player) => total + (player.minionsPlayedPerBase?.[baseIndex] ?? 0),
        0,
    );
}

function findAttachedActionHost(
    state: SmashUpCore,
    actionUid: string,
    baseIndex?: number,
): MinionOnBase | undefined {
    if (baseIndex !== undefined) {
        const base = state.bases[baseIndex];
        const host = base?.minions.find(minion => minion.attachedActions?.some(action => action.uid === actionUid));
        if (host) return host;
    }

    for (const base of state.bases) {
        const host = base.minions.find(minion => minion.attachedActions?.some(action => action.uid === actionUid));
        if (host) return host;
    }
    return undefined;
}
