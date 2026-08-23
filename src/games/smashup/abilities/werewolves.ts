/**
 * 大杀四方 - 狼人派系能力
 *
 * 主题：临时力量增益（回合结束清零）、消灭低力量随从
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    grantExtraAction, buildActionMinionTargetOptions, buildMinionTargetOptions,
    findMinionOnBases, findMinionByAttachedCard, buildAbilityFeedback,
    modifyBreakpoint,
    buildValidatedDestroyEvents,
    buildStandardDrawEvents,
} from '../domain/abilityHelpers';
import type { SmashUpEvent, SmashUpCore } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { getEffectivePower, getEffectiveBreakpoint } from '../domain/ongoingModifiers';
import {
    createAbilityRuntimeSimpleChoice,
    createBranchProgram,
    createEffectProgram,
    createPromptProgram,
} from '../domain/abilityRuntime';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { matchesDefId } from '../domain/utils';
import type { MatchState, PlayerId } from '../../../engine/types';

// ============================================================================
// 注册入口
// ============================================================================

type WerewolfPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceCardUid?: string;
    sourceDefId?: string;
};

type WerewolfCandidate = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type WerewolfChewToyContext = WerewolfPromptContext & {
    ownMinions: WerewolfCandidate[];
};

type WerewolfChewToyTargetContext = WerewolfPromptContext & {
    sourceUid: string;
    baseIndex: number;
};

type WerewolfLetTheDogOutContext = WerewolfPromptContext & {
    ownMinions: WerewolfCandidate[];
};

type WerewolfLetTheDogOutTargetsContext = WerewolfPromptContext & {
    budget: number;
    sourceUid: string;
    sourceBaseIndex: number;
    destroyedUids: string[];
};

type WerewolfChoice = {
    minionUid?: string;
    minionDefId?: string;
    baseIndex?: number;
    defId?: string;
    done?: boolean;
    budget?: number;
    sourceUid?: string;
};

function attachOptionsGenerator<T>(
    interaction: InteractionDescriptor<T>,
    optionsGenerator: (state: MatchState<SmashUpCore>) => unknown[],
): InteractionDescriptor<T> {
    return {
        ...interaction,
        data: {
            ...(interaction.data ?? {}),
            optionsGenerator,
        },
    };
}

function buildWerewolfOwnMinionCandidates(state: SmashUpCore, playerId: string): WerewolfCandidate[] {
    const ownMinions: WerewolfCandidate[] = [];
    for (let i = 0; i < state.bases.length; i += 1) {
        for (const minion of state.bases[i].minions) {
            if (minion.controller !== playerId) continue;
            const def = getCardDef(minion.defId);
            const power = getEffectivePower(state, minion, i);
            ownMinions.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: i,
                label: `${def?.name ?? minion.defId} (力量 ${power})`,
            });
        }
    }
    return ownMinions;
}

function buildWerewolfChewToyRawTargets(
    state: SmashUpCore,
    baseIndex: number,
    sourceUid: string,
): WerewolfCandidate[] {
    const source = state.bases[baseIndex]?.minions.find((minion) => minion.uid === sourceUid);
    if (!source) return [];
    const myPower = getEffectivePower(state, source, baseIndex);
    const targets: WerewolfCandidate[] = [];
    for (const minion of state.bases[baseIndex].minions) {
        if (minion.uid === sourceUid) continue;
        const power = getEffectivePower(state, minion, baseIndex);
        if (power >= myPower) continue;
        const def = getCardDef(minion.defId);
        targets.push({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${def?.name ?? minion.defId} (力量 ${power})`,
        });
    }
    return targets;
}

function resolveWerewolfChewToySourceSelection(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    choice: WerewolfChoice,
    timestamp: number,
    source?: { cardUid?: string; defId?: string },
) {
    if (!choice.minionUid || choice.baseIndex === undefined) return { events: [] };
    const rawTargets = buildWerewolfChewToyRawTargets(state.core, choice.baseIndex, choice.minionUid);
    if (rawTargets.length === 0) {
        return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
    }
    const options = buildActionMinionTargetOptions(rawTargets, {
        state: state.core,
        sourcePlayerId: playerId,
        effectType: 'destroy',
    });
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(playerId, 'feedback.all_protected', timestamp)] };
    }
    return {
        events: [],
        context: {
            matchState: state,
            playerId,
            now: timestamp,
            sourceUid: choice.minionUid,
            baseIndex: choice.baseIndex,
        },
        nextProgram: werewolfChewToyTargetPromptProgram,
    };
}

function collectWerewolfLetTheDogOutTargets(
    state: SmashUpCore,
    budget: number,
    sourceUid: string,
    destroyedUids: string[] = [],
) {
    const destroyed = new Set(destroyedUids);
    const results: WerewolfCandidate[] = [];
    for (let i = 0; i < state.bases.length; i += 1) {
        for (const minion of state.bases[i].minions) {
            if (minion.uid === sourceUid || destroyed.has(minion.uid)) continue;
            const power = getEffectivePower(state, minion, i);
            if (power > budget) continue;
            const def = getCardDef(minion.defId);
            results.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: i,
                label: `${def?.name ?? minion.defId} (力量 ${power})`,
            });
        }
    }
    return results;
}

function buildWerewolfLetTheDogOutPromptOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    budget: number,
    sourceUid: string,
    destroyedUids: string[] = [],
) {
    return buildActionMinionTargetOptions(
        collectWerewolfLetTheDogOutTargets(state, budget, sourceUid, destroyedUids),
        { state, sourcePlayerId: playerId, effectType: 'destroy' },
    ).map((option) => ({
        ...option,
        value: { ...(option.value as object), budget, sourceUid },
    }));
}

function resolveWerewolfLetTheDogOutSourceSelection(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    choice: WerewolfChoice,
    timestamp: number,
) {
    if (!choice.minionUid || choice.baseIndex === undefined) return { events: [] };
    const source = state.core.bases[choice.baseIndex]?.minions.find((minion) => minion.uid === choice.minionUid);
    if (!source) return { events: [] };
    const budget = getEffectivePower(state.core, source, choice.baseIndex);
    const rawTargets = collectWerewolfLetTheDogOutTargets(state.core, budget, choice.minionUid);
    if (rawTargets.length === 0) return { events: [] };
    const options = buildWerewolfLetTheDogOutPromptOptions(state.core, playerId, budget, choice.minionUid);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(playerId, 'feedback.all_protected', timestamp)] };
    }
    return {
        events: [],
        context: {
            matchState: state,
            playerId,
            now: timestamp,
            budget,
            sourceUid: choice.minionUid,
            sourceBaseIndex: choice.baseIndex,
            destroyedUids: [],
        },
        nextProgram: werewolfLetTheDogOutTargetsPromptProgram,
    };
}

export function registerWerewolfAbilities(): void {
    // 随从 talent
    registerSimpleAbility('werewolf_howler', 'onPlay', werewolfHowler);
    registerSimpleAbility('werewolf_teenage_wolf', 'talent', werewolfTeenageWolf);
    // loup_garou 和 pack_alpha 是异能（Special），在 beforeScoring 自动触发
    // 注册在 registerWerewolfOngoingEffects 中

    // 行动卡
    registerSimpleAbility('werewolf_frenzy', 'onPlay', werewolfFrenzy);
    registerAbilityProgram('werewolf_chew_toy', 'onPlay', {
        program: werewolfChewToyProgram,
        createContext: createWerewolfChewToyContext,
    });
    registerAbilityProgram('werewolf_let_the_dog_out', 'onPlay', {
        program: werewolfLetTheDogOutProgram,
        createContext: createWerewolfLetTheDogOutContext,
    });

    // ongoing 效果
    registerWerewolfOngoingEffects();
}

// ============================================================================
// 随从 talent
// ============================================================================

/** 咆哮者 talent：本随从+2力量直到回合结束 */
function werewolfHowler(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    return { events: [addTempPower(found.minion.uid, found.baseIndex, 2, 'werewolf_howler', ctx.now)] };
}

/** 青年狼人 talent：本随从+1力量直到回合结束 */
function werewolfTeenageWolf(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    return { events: [addTempPower(found.minion.uid, found.baseIndex, 1, 'werewolf_teenage_wolf', ctx.now)] };
}

// loup_garou 和 pack_alpha 异能在 registerWerewolfOngoingEffects 中注册为 beforeScoring 触发器

// ============================================================================
// 行动卡能力
// ============================================================================

/** 狂怒 onPlay：每个己方力量≥4的随从+1力量直到回合结束 */
function werewolfFrenzy(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const power = getEffectivePower(ctx.state, m, i);
                if (power >= 4) {
                    events.push(addTempPower(m.uid, i, 1, 'werewolf_frenzy', ctx.now));
                }
            }
        }
    }
    return { events };
}

function createWerewolfChewToyContext(ctx: AbilityContext): WerewolfChewToyContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        ownMinions: buildWerewolfOwnMinionCandidates(ctx.state, ctx.playerId),
    };
}

function buildWerewolfOwnMinionPromptOptions(
    state: SmashUpCore,
    playerId: PlayerId,
): ReturnType<typeof buildMinionTargetOptions> {
    return buildMinionTargetOptions(buildWerewolfOwnMinionCandidates(state, playerId), {
        state,
        sourcePlayerId: playerId,
    });
}

function createWerewolfLetTheDogOutContext(ctx: AbilityContext): WerewolfLetTheDogOutContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        ownMinions: buildWerewolfOwnMinionCandidates(ctx.state, ctx.playerId),
    };
}

function buildWerewolfChewToyTargetOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
    sourceUid: string,
) {
    return buildActionMinionTargetOptions(
        buildWerewolfChewToyRawTargets(state, baseIndex, sourceUid),
        { state, sourcePlayerId: playerId, effectType: 'destroy' },
    );
}

function buildWerewolfLetTheDogOutTargetOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    budget: number,
    sourceUid: string,
    destroyedUids: string[] = [],
) {
    const options = buildWerewolfLetTheDogOutPromptOptions(
        state,
        playerId,
        budget,
        sourceUid,
        destroyedUids,
    );
    return [
        ...options,
        {
            id: 'done',
            label: `完成选择（剩余预算 ${budget}）`,
            value: { done: true, budget, sourceUid },
            displayMode: 'button' as const,
        },
    ];
}

const werewolfChewToyTargetPromptProgram = createPromptProgram<
    WerewolfChewToyTargetContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'werewolf_chew_toy_target',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `werewolf_chew_toy_target_${context.now}`,
            context.playerId,
            '选择要消灭的随从',
            buildWerewolfChewToyTargetOptions(
                context.matchState.core,
                context.playerId,
                context.baseIndex,
                context.sourceUid,
            ),
            {
                sourceId: 'werewolf_chew_toy_target',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.werewolf_chew_toy_target_title',
                autoResolveIfSingle: false,
            },
        ),
        (state) => buildWerewolfChewToyTargetOptions(
            state.core,
            context.playerId,
            context.baseIndex,
            context.sourceUid,
        ),
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as WerewolfChoice;
        if (!choice.minionUid || !choice.defId || choice.baseIndex === undefined) {
            return { events: [] };
        }
        const stillValid = buildWerewolfChewToyTargetOptions(
            state.core,
            playerId,
            context.baseIndex,
            context.sourceUid,
        );
        const selected = stillValid.find((option) => (option.value as WerewolfChoice).minionUid === choice.minionUid);
        if (!selected) {
            return { events: [] };
        }
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: choice.minionUid,
                minionDefId: choice.defId,
                fromBaseIndex: choice.baseIndex,
                destroyerId: playerId,
                reason: 'werewolf_chew_toy',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex: context.baseIndex,
            }),
        };
    },
});

const werewolfChewToyPromptProgram = createPromptProgram<WerewolfChewToyContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'werewolf_chew_toy',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `werewolf_chew_toy_${context.now}`,
            context.playerId,
            '选择你的一个随从（消灭同基地比它力量低的随从）',
            buildWerewolfOwnMinionPromptOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'werewolf_chew_toy',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.werewolf_chew_toy_title',
                autoResolveIfSingle: false,
            },
        ),
        (state) => buildWerewolfOwnMinionPromptOptions(state.core, context.playerId),
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as WerewolfChoice;
        if (!choice.minionUid || choice.baseIndex === undefined) {
            return { events: [] };
        }
        const ownMinions = buildWerewolfOwnMinionCandidates(state.core, playerId);
        const selected = ownMinions.find((minion) => minion.uid === choice.minionUid && minion.baseIndex === choice.baseIndex);
        if (!selected) {
            return { events: [] };
        }
        return resolveWerewolfChewToySourceSelection(
            state,
            playerId,
            {
                minionUid: selected.uid,
                minionDefId: selected.defId,
                baseIndex: selected.baseIndex,
                defId: selected.defId,
            },
            timestamp,
            {
                cardUid: context.sourceCardUid,
                defId: context.sourceDefId,
            },
        );
    },
});

const werewolfChewToyProgram = createBranchProgram<WerewolfChewToyContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.ownMinions.length === 0,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => context.ownMinions.length === 1 && !context.matchState,
        then: createEffectProgram((context) => {
            const [selected] = context.ownMinions;
            return resolveWerewolfChewToySourceSelection(
                context.matchState,
                context.playerId,
                {
                    minionUid: selected.uid,
                    minionDefId: selected.defId,
                    baseIndex: selected.baseIndex,
                    defId: selected.defId,
                },
                context.now,
                {
                    cardUid: context.sourceCardUid,
                    defId: context.sourceDefId,
                },
            );
        }),
        else: werewolfChewToyPromptProgram,
    }),
});

const werewolfLetTheDogOutTargetsPromptProgram = createPromptProgram<
    WerewolfLetTheDogOutTargetsContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'werewolf_let_the_dog_out_targets',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `werewolf_let_the_dog_out_targets_${context.now}`,
            context.playerId,
            `选择要消灭的随从（力量预算剩余 ${context.budget}）`,
            buildWerewolfLetTheDogOutTargetOptions(
                context.matchState.core,
                context.playerId,
                context.budget,
                context.sourceUid,
                context.destroyedUids,
            ),
            {
                sourceId: 'werewolf_let_the_dog_out_targets',
                targetType: 'minion',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildWerewolfLetTheDogOutTargetOptions(
            state.core,
            context.playerId,
            context.budget,
            context.sourceUid,
            context.destroyedUids,
        ),
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as WerewolfChoice;
        if (choice.done) {
            return { events: [] };
        }
        if (!choice.minionUid || !choice.defId || choice.baseIndex === undefined) {
            return { events: [] };
        }
        const stillValid = buildWerewolfLetTheDogOutPromptOptions(
            state.core,
            playerId,
            context.budget,
            context.sourceUid,
            context.destroyedUids,
        );
        const selected = stillValid.find((option) => (option.value as WerewolfChoice).minionUid === choice.minionUid);
        if (!selected) {
            return { events: [] };
        }
        const target = state.core.bases[choice.baseIndex]?.minions.find((minion) => minion.uid === choice.minionUid);
        if (!target) {
            return { events: [] };
        }
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: choice.minionUid,
            minionDefId: choice.defId,
            fromBaseIndex: choice.baseIndex,
            destroyerId: playerId,
            reason: 'werewolf_let_the_dog_out',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceCardUid: context.sourceCardUid,
            sourceDefId: context.sourceDefId,
            sourceControllerId: playerId,
            sourceBaseIndex: context.sourceBaseIndex,
        });
        if (destroyEvents.length === 0) {
            return { events: [] };
        }
        const targetPower = getEffectivePower(state.core, target, choice.baseIndex);
        const newBudget = context.budget - targetPower;
        if (newBudget <= 0) {
            return { events: destroyEvents };
        }
        const destroyedUids = [...context.destroyedUids, choice.minionUid];
        const remainingRawTargets = collectWerewolfLetTheDogOutTargets(
            state.core,
            newBudget,
            context.sourceUid,
            destroyedUids,
        );
        if (remainingRawTargets.length === 0) {
            return { events: destroyEvents };
        }
        const remainingLegalTargets = buildWerewolfLetTheDogOutPromptOptions(
            state.core,
            playerId,
            newBudget,
            context.sourceUid,
            destroyedUids,
        );
        if (remainingLegalTargets.length === 0) {
            return {
                events: [
                    ...destroyEvents,
                    buildAbilityFeedback(playerId, 'feedback.all_protected', timestamp),
                ],
            };
        }
        return {
            events: destroyEvents,
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                budget: newBudget,
                sourceUid: context.sourceUid,
                destroyedUids,
            },
            nextProgram: werewolfLetTheDogOutTargetsPromptProgram,
        };
    },
});

const werewolfLetTheDogOutPromptProgram = createPromptProgram<
    WerewolfLetTheDogOutContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'werewolf_let_the_dog_out',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `werewolf_let_the_dog_out_${context.now}`,
            context.playerId,
            '选择你的一个随从（消灭力量总和≤其力量的随从们）',
            buildWerewolfOwnMinionPromptOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'werewolf_let_the_dog_out',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.werewolf_let_the_dog_out_title',
                autoResolveIfSingle: false,
            },
        ),
        (state) => buildWerewolfOwnMinionPromptOptions(state.core, context.playerId),
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as WerewolfChoice;
        if (!choice.minionUid || choice.baseIndex === undefined) {
            return { events: [] };
        }
        const ownMinions = buildWerewolfOwnMinionCandidates(state.core, playerId);
        const selected = ownMinions.find((minion) => minion.uid === choice.minionUid && minion.baseIndex === choice.baseIndex);
        if (!selected) {
            return { events: [] };
        }
        return resolveWerewolfLetTheDogOutSourceSelection(
            state,
            playerId,
            {
                minionUid: selected.uid,
                minionDefId: selected.defId,
                baseIndex: selected.baseIndex,
                defId: selected.defId,
            },
            timestamp,
        );
    },
});

const werewolfLetTheDogOutProgram = createBranchProgram<
    WerewolfLetTheDogOutContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.ownMinions.length === 0,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => context.ownMinions.length === 1 && !context.matchState,
        then: createEffectProgram((context) => {
            const [selected] = context.ownMinions;
            return resolveWerewolfLetTheDogOutSourceSelection(
                context.matchState,
                context.playerId,
                {
                    minionUid: selected.uid,
                    minionDefId: selected.defId,
                    baseIndex: selected.baseIndex,
                    defId: selected.defId,
                },
                context.now,
            );
        }),
        else: werewolfLetTheDogOutPromptProgram,
    }),
});

// ============================================================================
// Ongoing 效果注册
// ============================================================================

function registerWerewolfOngoingEffects(): void {
    // 狼人 异能（Special）：基地计分前自身+2力量直到回合结束
    registerTrigger('werewolf_loup_garou', 'beforeScoring', (ctx: TriggerContext) => {
        const { state, baseIndex, sourceCardUid, now } = ctx;
        if (baseIndex === undefined) return [];
        const source = sourceCardUid
            ? state.bases[baseIndex].minions.find(m => m.uid === sourceCardUid)
            : state.bases[baseIndex].minions.find(m => matchesDefId(m.defId, 'werewolf_loup_garou'));
        if (!source || !matchesDefId(source.defId, 'werewolf_loup_garou')) return [];
        return [addTempPower(source.uid, baseIndex, 2, 'werewolf_loup_garou', now)];
    }, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });

    // 阿尔法狼群 异能（Special）：基地计分前同基地己方所有随从+1力量直到回合结束
    registerTrigger('werewolf_pack_alpha', 'beforeScoring', (ctx: TriggerContext) => {
        const { state, baseIndex, sourceCardUid, now } = ctx;
        if (baseIndex === undefined) return [];
        const source = sourceCardUid
            ? state.bases[baseIndex].minions.find(m => m.uid === sourceCardUid)
            : state.bases[baseIndex].minions.find(m => matchesDefId(m.defId, 'werewolf_pack_alpha'));
        if (!source || !matchesDefId(source.defId, 'werewolf_pack_alpha')) return [];
        const controller = source.controller;
        const events: SmashUpEvent[] = [];
        for (const ally of state.bases[baseIndex].minions) {
            if (ally.controller === controller) {
                events.push(addTempPower(ally.uid, baseIndex, 1, 'werewolf_pack_alpha', now));
            }
        }
        return events;
    }, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });

    // 制造恐慌 ongoing：回合开始时若你力量最高，爆破点降到0
    registerTrigger('werewolf_marking_territory', 'onTurnStart', (ctx: TriggerContext) => {
        const { state, playerId, now } = ctx;
        if (ctx.sourceCardUid) {
            const candidateBases = ctx.sourceBaseIndex !== undefined
                ? [{ base: state.bases[ctx.sourceBaseIndex], baseIndex: ctx.sourceBaseIndex }]
                : state.bases.map((base, baseIndex) => ({ base, baseIndex }));
            for (const { base, baseIndex } of candidateBases) {
                if (!base) continue;
                const source = base.ongoingActions.find(a =>
                    a.uid === ctx.sourceCardUid && matchesDefId(a.defId, 'werewolf_marking_territory'));
                if (!source) continue;
                const controllerId = (source.metadata?.sourceControllerId as PlayerId | undefined) ?? source.ownerId;
                if (controllerId !== playerId) return [];

                let myTotal = 0;
                const opponentTotals = new Map<string, number>();
                for (const m of base.minions) {
                    const power = getEffectivePower(state, m, baseIndex);
                    if (m.controller === playerId) myTotal += power;
                    else opponentTotals.set(m.controller, (opponentTotals.get(m.controller) ?? 0) + power);
                }
                let isHighest = myTotal > 0;
                for (const total of opponentTotals.values()) {
                    if (total >= myTotal) { isHighest = false; break; }
                }
                if (!isHighest) return [];
                const currentBp = getEffectiveBreakpoint(state, baseIndex);
                return currentBp > 0
                    ? [modifyBreakpoint(baseIndex, -currentBp, 'werewolf_marking_territory', now)]
                    : [];
            }
            return [];
        }

        for (let i = 0; i < state.bases.length; i++) {
            const base = state.bases[i];
            const hasMT = base.ongoingActions.some(a =>
                matchesDefId(a.defId, 'werewolf_marking_territory')
                && (((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === playerId),
            );
            if (!hasMT) continue;
            let myTotal = 0;
            let maxOther = 0;
            for (const m of base.minions) {
                const power = getEffectivePower(state, m, i);
                if (m.controller === playerId) myTotal += power;
                else maxOther = Math.max(maxOther, power);
            }
            // 需要"比其他玩家有更高的总力量"
            // 计算各对手在此基地的总力量
            const opponentTotals = new Map<string, number>();
            for (const m of base.minions) {
                if (m.controller === playerId) continue;
                opponentTotals.set(m.controller, (opponentTotals.get(m.controller) ?? 0) + getEffectivePower(state, m, i));
            }
            let isHighest = true;
            for (const total of opponentTotals.values()) {
                if (total >= myTotal) { isHighest = false; break; }
            }
            if (isHighest && myTotal > 0) {
                const currentBp = getEffectiveBreakpoint(state, i);
                if (currentBp > 0) {
                    return [modifyBreakpoint(i, -currentBp, 'werewolf_marking_territory', now)];
                }
            }
        }
        return [];
    }, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    // 势不可挡 ongoing(minion)：本随从不可被消灭
    registerProtection('werewolf_unstoppable', 'destroy', (ctx) => {
        return ctx.targetMinion.attachedActions.some(a => matchesDefId(a.defId, 'werewolf_unstoppable'));
    });

    // 狼群领袖 ongoing(minion)+talent：如果本随从力量最高，额外打出行动
    registerSimpleAbility('werewolf_leader_of_the_pack', 'talent', (ctx: AbilityContext): AbilityResult => {
        const found = findMinionByAttachedCard(ctx.state, ctx.cardUid);
        if (!found) return { events: [] };
        const myPower = getEffectivePower(ctx.state, found.minion, found.baseIndex);
        let isHighest = true;
        for (const m of ctx.state.bases[found.baseIndex].minions) {
            if (m.uid === found.minion.uid) continue;
            if (getEffectivePower(ctx.state, m, found.baseIndex) >= myPower) {
                isHighest = false; break;
            }
        }
        if (!isHighest) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.not_highest_power', ctx.now)] };
        return { events: [grantExtraAction(ctx.playerId, 'werewolf_leader_of_the_pack', ctx.now)] };
    });

    // 月之触 ongoing(minion)+talent：如果本随从力量最高，抽一张牌
    registerSimpleAbility('werewolf_moontouched', 'talent', (ctx: AbilityContext): AbilityResult => {
        const found = findMinionByAttachedCard(ctx.state, ctx.cardUid);
        if (!found) return { events: [] };
        const myPower = getEffectivePower(ctx.state, found.minion, found.baseIndex);
        let isHighest = true;
        for (const m of ctx.state.bases[found.baseIndex].minions) {
            if (m.uid === found.minion.uid) continue;
            if (getEffectivePower(ctx.state, m, found.baseIndex) >= myPower) {
                isHighest = false; break;
            }
        }
        if (!isHighest) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.not_highest_power', ctx.now)] };
        const events = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
        if (events.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
        return { events };
    });
}
