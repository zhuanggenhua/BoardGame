/**
 * 大杀四方 - 恐龙派系能力
 *
 * 主题：高力量、消灭低力量随从、力量增强
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    modifyBreakpoint,
    getMinionPower,
    buildMinionTargetOptions,
    buildBaseTargetOptions,
    buildAbilityFeedback,
    createSkipOption,
    buildValidatedDestroyEvents,
} from '../domain/abilityHelpers';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import type { SmashUpEvent, SmashUpCore, OngoingDetachedEvent, MinionDestroyedEvent, MinionReturnedEvent, CardToDeckBottomEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import type { MinionCardDef } from '../domain/types';
import { registerProtection, registerInterceptor } from '../domain/ongoingEffects';
import type { ProtectionCheckContext } from '../domain/ongoingEffects';
import type { MatchState, PlayerId } from '../../../engine/types';
import { matchesDefId } from '../domain/utils';
import { queueFortTitanosaurusOngoingChoice } from './titans';
import {
    createAbilityRuntimeSimpleChoice,
    createBranchProgram,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type DinoMinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
    __cancel__?: boolean;
};

type DinoBaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    __cancel__?: boolean;
};

type DinoMinionTarget = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type DinoPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type DinoLaserTriceratopsContext = DinoPromptContext & {
    targets: DinoMinionTarget[];
};

type DinoAugmentationContext = DinoPromptContext & {
    targets: DinoMinionTarget[];
};

type DinoNaturalSelectionMineContext = DinoPromptContext & {
    candidates: DinoMinionTarget[];
};

type DinoNaturalSelectionTargetContext = DinoPromptContext & {
    sourceMinionUid: string;
    baseIndex: number;
    targets: DinoMinionTarget[];
};

type DinoSurvivalTiebreakContext = DinoPromptContext & {
    remainingBases: Array<{
        baseIndex: number;
        minPower: number;
        candidates: Array<{
            uid: string;
            defId: string;
            owner: PlayerId;
            label: string;
        }>;
    }>;
};

type DinoRampageBaseContext = DinoPromptContext & {
    baseCandidates: Array<{ baseIndex: number; label: string }>;
};

type DinoRampageMinionCandidate = { uid: string; defId: string; baseIndex: number; power: number; label: string };

type DinoRampageMinionContext = DinoPromptContext & {
    baseIndex: number;
    candidates: DinoRampageMinionCandidate[];
};

function filterProtectedDestroyTargets(
    matchState: MatchState<SmashUpCore> | undefined,
    playerId: PlayerId,
    sourceDefId: string,
    targets: DinoMinionTarget[],
): DinoMinionTarget[] {
    if (targets.length === 0) return targets;
    if (!matchState) return [];
    const allowedKeys = new Set(
        buildMinionTargetOptions(targets, {
            state: matchState.core,
            sourcePlayerId: playerId,
            sourceDefId,
            sourceKind: 'nonAction',
            effectType: 'destroy',
        }).map((option) => `${option.value.minionUid}:${option.value.baseIndex}`),
    );
    return targets.filter((target) => allowedKeys.has(`${target.uid}:${target.baseIndex}`));
}

/** 注册恐龙派系所有能力 */
export function registerDinosaurAbilities(): void {
    registerAbilityProgram('dino_laser_triceratops', 'onPlay', {
        program: dinoLaserTriceratopsProgram,
        createContext: createDinoLaserTriceratopsContext,
    });
    registerAbilityProgram('dino_laser_triceratops_pod', 'onPlay', {
        program: dinoLaserTriceratopsPodProgram,
        createContext: createDinoLaserTriceratopsPodContext,
    }); // POD版: 看印制力量

    registerAbilityProgram('dino_augmentation', 'onPlay', {
        program: dinoAugmentationProgram,
        createContext: createDinoAugmentationContext,
    });
    registerAbilityProgram('dino_augmentation_pod', 'onPlay', {
        program: dinoAugmentationProgram,
        createContext: createDinoAugmentationContext,
    });
    registerSimpleAbility('dino_howl', 'onPlay', dinoHowl);
    registerSimpleAbility('dino_howl_pod', 'onPlay', dinoHowl);
    registerAbilityProgram('dino_natural_selection', 'onPlay', {
        program: dinoNaturalSelectionProgram,
        createContext: createDinoNaturalSelectionMineContext,
    });
    registerAbilityProgram('dino_natural_selection_pod', 'onPlay', {
        program: dinoNaturalSelectionProgram,
        createContext: createDinoNaturalSelectionMineContext,
    });
    registerAbilityProgram('dino_survival_of_the_fittest', 'onPlay', {
        program: dinoSurvivalOfTheFittestProgram,
    });
    registerAbilityProgram('dino_survival_of_the_fittest_pod', 'onPlay', {
        program: dinoSurvivalOfTheFittestProgram,
    });
    // 狂暴：降低基地爆破点
    registerAbilityProgram('dino_rampage', 'onPlay', {
        program: dinoRampageProgram,
        createContext: createDinoRampageBaseContext,
    });
    registerAbilityProgram('dino_rampage_pod', 'onPlay', {
        program: dinoRampageProgram,
        createContext: createDinoRampageBaseContext,
    });

    // POD独占的 Talent
    registerSimpleAbility('dino_armor_stego_pod', 'talent', dinoArmorStegoPodTalent);

    // === ongoing 效果注册 ===
    // 全副武装原版：拦截影响事件时自毁以保护附着随从
    registerInterceptor('dino_tooth_and_claw', dinoToothAndClawInterceptor);
    registerProtection('dino_tooth_and_claw', 'affect', dinoToothAndClawChecker, { consumable: true });

    // 全副武装 POD版：简单的 ongoing 保护效果，不受其他玩家卡牌影响，且不自毁
    registerProtection('dino_tooth_and_claw_pod', 'affect', dinoToothAndClawPodChecker);

    // 升级：+2力量（ongoingModifiers 中注册），无消灭保护
    // 野生保护区：保护你在此基地的随从不受其他玩家战术影响
    registerProtection('dino_wildlife_preserve', 'action', dinoWildlifePreserveChecker);
    registerProtection('dino_wildlife_preserve_pod', 'action', dinoWildlifePreserveChecker);
}
// ============================================================================
// 随从能力
// ============================================================================

/** 激光三角龙 onPlay：消灭本基地一个力量≤2的随从 */
function createDinoLaserTriceratopsContext(ctx: AbilityContext): DinoLaserTriceratopsContext {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) {
        return { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now, targets: [] };
    }
    const targets = filterProtectedDestroyTargets(ctx.matchState, ctx.playerId, 'dino_laser_triceratops', base.minions
        .filter((minion) => minion.uid !== ctx.cardUid && getMinionPower(ctx.state, minion, ctx.baseIndex) <= 2)
        .map((minion) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(ctx.state, minion, ctx.baseIndex);
            return {
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: ctx.baseIndex,
                label: `${name} (力量 ${power})`,
            };
        }));
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        targets,
    };
}

function createDinoLaserTriceratopsPodContext(ctx: AbilityContext): DinoLaserTriceratopsContext {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) {
        return { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now, targets: [] };
    }
    const targets = filterProtectedDestroyTargets(ctx.matchState, ctx.playerId, 'dino_laser_triceratops_pod', base.minions
        .filter((minion) => {
            if (minion.uid === ctx.cardUid) return false;
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            return (def?.power ?? 0) <= 2;
        })
        .map((minion) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const printedPower = def?.power ?? 0;
            return {
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: ctx.baseIndex,
                label: `${name} (印制力量 ${printedPower})`,
            };
        }));
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        targets,
    };
}

function createDinoAugmentationContext(ctx: AbilityContext): DinoAugmentationContext {
    const targets: DinoMinionTarget[] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const base = ctx.state.bases[baseIndex];
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(ctx.state, minion, baseIndex);
            targets.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${name} (力量 ${power}) @ ${baseName}`,
            });
        }
    }
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        targets,
    };
}

function createDinoNaturalSelectionMineContext(ctx: AbilityContext): DinoNaturalSelectionMineContext {
    const candidates: DinoMinionTarget[] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const base = ctx.state.bases[baseIndex];
        for (const minion of base.minions) {
            if (minion.controller !== ctx.playerId) continue;
            const power = getMinionPower(ctx.state, minion, baseIndex);
            const hasTarget = base.minions.some(
                (target) => target.uid !== minion.uid && getMinionPower(ctx.state, target, baseIndex) < power,
            );
            if (!hasTarget) continue;
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${name} (力量 ${power})`,
            });
        }
    }
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
    };
}

function createDinoNaturalSelectionTargetContext(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    baseIndex: number,
    sourceMinionUid: string,
): DinoNaturalSelectionTargetContext | undefined {
    const base = matchState.core.bases[baseIndex];
    if (!base) return undefined;
    const sourceMinion = base.minions.find((minion) => minion.uid === sourceMinionUid && minion.controller === playerId);
    if (!sourceMinion) return undefined;
    const sourcePower = getMinionPower(matchState.core, sourceMinion, baseIndex);
    const targets = base.minions
        .filter((minion) => minion.uid !== sourceMinion.uid && getMinionPower(matchState.core, minion, baseIndex) < sourcePower)
        .map((minion) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(matchState.core, minion, baseIndex);
            return {
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${name} (力量 ${power})`,
            };
        });
    if (targets.length === 0) return undefined;
    return {
        matchState,
        playerId,
        now,
        sourceMinionUid,
        baseIndex,
        targets,
    };
}

function collectDinoSurvivalTiebreakBases(state: SmashUpCore): Array<{
    baseIndex: number;
    minPower: number;
    candidates: Array<{ uid: string; defId: string; owner: PlayerId; label: string }>;
}> {
    const tieBreakBases: Array<{
        baseIndex: number;
        minPower: number;
        candidates: Array<{ uid: string; defId: string; owner: PlayerId; label: string }>;
    }> = [];

    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        if (base.minions.length < 2) continue;

        let minPower = Infinity;
        for (const minion of base.minions) {
            const power = getMinionPower(state, minion, baseIndex);
            if (power < minPower) minPower = power;
        }
        const hasHigher = base.minions.some((minion) => getMinionPower(state, minion, baseIndex) > minPower);
        if (!hasHigher) continue;

        const lowest = base.minions.filter((minion) => getMinionPower(state, minion, baseIndex) === minPower);
        if (lowest.length <= 1) continue;

        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${baseIndex + 1}`;
        tieBreakBases.push({
            baseIndex,
            minPower,
            candidates: lowest.map((minion) => {
                const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                const name = def?.name ?? minion.defId;
                return {
                    uid: minion.uid,
                    defId: minion.defId,
                    owner: minion.owner,
                    label: `${name} (力量 ${minPower}) @ ${baseName}`,
                };
            }),
        });
    }

    return tieBreakBases;
}

function collectDinoRampageMinions(state: SmashUpCore, playerId: PlayerId, baseIndex: number): DinoRampageMinionCandidate[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    const baseDef = getBaseDef(base.defId);
    const baseName = baseDef?.name ?? `基地 ${baseIndex + 1}`;

    return base.minions
        .filter((minion) => minion.controller === playerId)
        .map((minion) => {
            const power = getMinionPower(state, minion, baseIndex);
            const minionDef = getCardDef(minion.defId) as MinionCardDef | undefined;
            const minionName = minionDef?.name ?? minion.defId;
            return {
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                power,
                label: `${minionName} @ ${baseName} (力量 ${power})`,
            };
        })
        .filter((candidate) => candidate.power > 0);
}

function createDinoRampageBaseContext(ctx: AbilityContext): DinoRampageBaseContext {
    const baseCandidates: Array<{ baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const minionCandidates = collectDinoRampageMinions(ctx.state, ctx.playerId, baseIndex);
        if (minionCandidates.length === 0) continue;
        const baseDef = getBaseDef(ctx.state.bases[baseIndex].defId);
        const baseName = baseDef?.name ?? `基地 ${baseIndex + 1}`;
        baseCandidates.push({
            baseIndex,
            label: minionCandidates.length === 1
                ? `${baseName} (降低 ${minionCandidates[0].power} 爆破点)`
                : `${baseName} (选择一个己方随从的力量)`,
        });
    }
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseCandidates,
    };
}

function createDinoRampageMinionContext(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    baseIndex: number,
): DinoRampageMinionContext | undefined {
    const candidates = collectDinoRampageMinions(matchState.core, playerId, baseIndex);
    if (candidates.length === 0) return undefined;
    return {
        matchState,
        playerId,
        now,
        baseIndex,
        candidates,
    };
}

function buildDinoDestroyEvents(
    state: MatchState<SmashUpCore> | SmashUpCore,
    target: { uid: string; defId: string; baseIndex: number },
    reason: string,
    destroyerId: PlayerId | undefined,
    now: number,
): SmashUpEvent[] {
    return buildValidatedDestroyEvents(state, {
        minionUid: target.uid,
        minionDefId: target.defId,
        fromBaseIndex: target.baseIndex,
        destroyerId,
        sourcePlayerId: destroyerId,
        sourceDefId: reason,
        sourceControllerId: destroyerId,
        reason,
        now,
    });
}

const dinoLaserTriceratopsPromptProgram = createPromptProgram<
    DinoLaserTriceratopsContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'dino_laser_triceratops',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `dino_laser_triceratops_${context.now}`,
        context.playerId,
        '选择要消灭的力量≤2的随从',
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            effectType: 'destroy',
        }),
        {
            sourceId: 'dino_laser_triceratops',
            titleKey: 'ui.dino_laser_triceratops_title',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ playerId, value, timestamp, state }) => {
        const choice = value as DinoMinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) {
            return { events: [] };
        }
        return {
            events: buildDinoDestroyEvents(
                state,
                { uid: choice.minionUid, defId: choice.defId, baseIndex: choice.baseIndex },
                'dino_laser_triceratops',
                playerId,
                timestamp,
            ),
        };
    },
});

const dinoLaserTriceratopsProgram = createBranchProgram<
    DinoLaserTriceratopsContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.targets.length === 0,
    then: createEffectProgram(() => ({ events: [] })),
    else: createBranchProgram({
        when: (context) => context.targets.length === 1 && !context.matchState,
        then: createEffectProgram(() => ({ events: [] })),
        else: dinoLaserTriceratopsPromptProgram,
    }),
});

const dinoLaserTriceratopsPodProgram = createBranchProgram<
    DinoLaserTriceratopsContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.targets.length === 0,
    then: createEffectProgram(() => ({ events: [] })),
    else: createPromptProgram({
        sourceId: 'dino_laser_triceratops_pod',
        buildInteraction: (context) => {
            const title = '你可以消灭这里一个印制力量≤2的随从';
            const interaction = createAbilityRuntimeSimpleChoice(
                `dino_laser_triceratops_pod_${context.now}`,
                context.playerId,
                title,
                [
                    createSkipOption('跳过（不消灭随从）', 'ui.dino_laser_triceratops_pod_skip_option'),
                    ...buildMinionTargetOptions(context.targets, {
                        state: context.matchState.core,
                        sourcePlayerId: context.playerId,
                        effectType: 'destroy',
                    }),
                ],
                {
                    sourceId: 'dino_laser_triceratops_pod',
                    titleKey: 'ui.dino_laser_triceratops_pod_title',
                    targetType: 'minion',
                    subtitle: '按印制力量判断；+1/+2 等当前战力修正不影响可选范围。',
                    autoResolveIfSingle: false,
                },
            );
            return {
                ...interaction,
                data: {
                    ...interaction.data,
                    title,
                },
            };
        },
        onResolve: ({ playerId, value, timestamp, state }) => {
            const choice = value as DinoMinionChoice;
            if (choice.skip) return { events: [] };
            if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) {
                return { events: [] };
            }
            return {
                events: buildDinoDestroyEvents(
                    state,
                    { uid: choice.minionUid, defId: choice.defId, baseIndex: choice.baseIndex },
                    'dino_laser_triceratops_pod',
                    playerId,
                    timestamp,
                ),
            };
        },
    }),
});

/**
 * 装甲剑龙 POD版 Talent：直到下个你的回合开始前，此随从在其他玩家的回合拥有+2力量
 * 
 * 实现方式：天赋执行体为空操作（引擎层在处理 USE_TALENT 时已自动设置 talentUsed=true）。
 * +2 力量的实际判断在 ongoingModifiers 中，检查 talentUsed 标记 + 当前回合玩家。
 * talentUsed 标记在"自己的回合开始时"被重置为 false，正好匹配"直到你下个回合开始"的持续时间。
 */
function dinoArmorStegoPodTalent(_ctx: AbilityContext): AbilityResult {
    // 不需要发射任何事件。talentUsed 标记已由引擎 USE_TALENT 处理流程自动设置。
    // +2 力量加成由 ongoingModifiers 系统中的 dino_armor_stego modifier 根据 talentUsed 判断。
    return { events: [] };
}

// ============================================================================
// 行动卡能力
// ============================================================================

const dinoAugmentationProgram = createBranchProgram<
    DinoAugmentationContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.targets.length === 0,
    then: createEffectProgram(() => ({ events: [] })),
    else: createPromptProgram({
        sourceId: 'dino_augmentation',
        buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
            `dino_augmentation_${context.now}`,
            context.playerId,
            '选择一个随从获得+4力量（直到回合结束）',
            buildMinionTargetOptions(context.targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            }),
            {
                sourceId: 'dino_augmentation',
                titleKey: 'ui.dino_augmentation_title',
                targetType: 'minion',
            },
        ),
        onResolve: ({ playerId, value, timestamp, state }) => {
            const choice = value as DinoMinionChoice;
            if (!choice.minionUid || choice.baseIndex === undefined) {
                return { events: [] };
            }
            const nextState = queueFortTitanosaurusOngoingChoice(state, playerId, [choice.minionUid], timestamp);
            return {
                events: [addTempPower(choice.minionUid, choice.baseIndex, 4, 'dino_augmentation', timestamp)],
                matchState: nextState ?? state,
            };
        },
    }),
});

/** 嚎叫 onPlay：你的全部随从+1力量（直到回合结束） */
function dinoHowl(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const affectedMinionUids: string[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                affectedMinionUids.push(m.uid);
                events.push(addTempPower(m.uid, i, 1, 'dino_howl', ctx.now));
            }
        }
    }
    const nextMatchState = queueFortTitanosaurusOngoingChoice(
        ctx.matchState,
        ctx.playerId,
        affectedMinionUids,
        ctx.now,
    );
    return nextMatchState ? { events, matchState: nextMatchState } : { events };
}

const dinoNaturalSelectionTargetPromptProgram = createPromptProgram<
    DinoNaturalSelectionTargetContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'dino_natural_selection_choose_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `dino_natural_selection_target_${context.now}`,
        context.playerId,
        '选择要消灭的随从',
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            effectType: 'destroy',
        }),
        {
            sourceId: 'dino_natural_selection_choose_target',
            titleKey: 'ui.dino_natural_selection_target_title',
            targetType: 'minion',
        },
    ),
    onResolve: ({ playerId, value, timestamp, state }) => {
        const choice = value as DinoMinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) {
            return { events: [] };
        }
        const base = state.core.bases[choice.baseIndex];
        const target = base?.minions.find((minion) => minion.uid === choice.minionUid);
        if (!target) {
            return { events: [] };
        }
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: choice.minionUid,
                minionDefId: choice.defId,
                fromBaseIndex: choice.baseIndex,
                destroyerId: playerId,
                reason: 'dino_natural_selection',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'dino_natural_selection',
                sourceControllerId: playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const dinoNaturalSelectionProgram = createBranchProgram<
    DinoNaturalSelectionMineContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.candidates.length === 0,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: createPromptProgram({
        sourceId: 'dino_natural_selection_choose_mine',
        buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
            `dino_natural_selection_${context.now}`,
            context.playerId,
            '选择你的一个随从作为参照',
            buildMinionTargetOptions(context.candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            }),
            {
                sourceId: 'dino_natural_selection_choose_mine',
                titleKey: 'ui.dino_natural_selection_reference_title',
                targetType: 'minion',
                autoCancelOption: true,
            },
        ),
        onResolve: ({ state, playerId, value, timestamp }) => {
            const choice = value as DinoMinionChoice;
            if (choice.__cancel__) return { events: [] };
            if (!choice.minionUid || choice.baseIndex === undefined) {
                return { events: [] };
            }
            const nextContext = createDinoNaturalSelectionTargetContext(
                state,
                playerId,
                timestamp,
                choice.baseIndex,
                choice.minionUid,
            );
            if (!nextContext) {
                return { events: [] };
            }
            return {
                events: [],
                context: nextContext,
                nextProgram: dinoNaturalSelectionTargetPromptProgram,
            };
        },
    }),
});

const dinoSurvivalTiebreakPromptProgram = createPromptProgram<
    DinoSurvivalTiebreakContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'dino_survival_tiebreak',
    buildInteraction: (context) => {
        const [currentBase] = context.remainingBases;
        return createAbilityRuntimeSimpleChoice(
            `dino_sotf_tiebreak_${context.now}`,
            context.playerId,
            '选择要消灭的最低力量随从',
            buildMinionTargetOptions(currentBase.candidates.map((candidate) => ({
                uid: candidate.uid,
                defId: candidate.defId,
                baseIndex: currentBase.baseIndex,
                label: candidate.label,
            })), {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            {
                sourceId: 'dino_survival_tiebreak',
                titleKey: 'ui.dino_survival_tiebreak_title',
                targetType: 'minion',
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as DinoMinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) {
            return { events: [] };
        }
        const currentBase = context.remainingBases[0];
        const chosen = currentBase?.candidates.find((candidate) => candidate.uid === choice.minionUid);
        if (!chosen) {
            return { events: [] };
        }
        const events: SmashUpEvent[] = buildValidatedDestroyEvents(state, {
            minionUid: choice.minionUid,
            minionDefId: choice.defId,
            fromBaseIndex: choice.baseIndex,
            destroyerId: playerId,
            reason: 'dino_survival_of_the_fittest',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'dino_survival_of_the_fittest',
            sourceControllerId: playerId,
            sourceKind: 'action',
        });
        const remainingBases = context.remainingBases.slice(1);
        if (remainingBases.length === 0) {
            return { events };
        }
        return {
            events,
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                remainingBases,
            },
            nextProgram: dinoSurvivalTiebreakPromptProgram,
        };
    },
});

const dinoSurvivalOfTheFittestProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const events: SmashUpEvent[] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const base = ctx.state.bases[baseIndex];
        if (base.minions.length < 2) continue;
        let minPower = Infinity;
        for (const minion of base.minions) {
            const power = getMinionPower(ctx.state, minion, baseIndex);
            if (power < minPower) minPower = power;
        }
        const hasHigher = base.minions.some((minion) => getMinionPower(ctx.state, minion, baseIndex) > minPower);
        if (!hasHigher) continue;
        const lowest = base.minions.filter((minion) => getMinionPower(ctx.state, minion, baseIndex) === minPower);
        if (lowest.length === 1) {
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: lowest[0].uid,
                minionDefId: lowest[0].defId,
                fromBaseIndex: baseIndex,
                destroyerId: ctx.playerId,
                reason: 'dino_survival_of_the_fittest',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'dino_survival_of_the_fittest',
                sourceControllerId: ctx.playerId,
                sourceKind: 'action',
            }));
        }
    }

    const remainingBases = collectDinoSurvivalTiebreakBases(ctx.state);
    if (remainingBases.length === 0) {
        return { events };
    }

    const promptResult = executeAbilityProgram(dinoSurvivalTiebreakPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        remainingBases,
    });

    return {
        events: [...events, ...promptResult.events],
        matchState: promptResult.matchState,
        suspended: promptResult.suspended,
        continuationId: promptResult.continuationId,
    };
});

function resolveDinoRampageBaseSelection(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    baseIndex: number,
) {
    const candidates = collectDinoRampageMinions(matchState.core, playerId, baseIndex);
    if (candidates.length === 0) {
        return { events: [] as SmashUpEvent[] };
    }
    const minionContext = createDinoRampageMinionContext(matchState, playerId, now, baseIndex);
    if (!minionContext) {
        return { events: [] as SmashUpEvent[] };
    }
    return executeAbilityProgram(dinoRampageMinionPromptProgram, minionContext);
}

const dinoRampageMinionPromptProgram = createPromptProgram<
    DinoRampageMinionContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'dino_rampage_choose_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `dino_rampage_choose_minion_${context.now}`,
        context.playerId,
        '选择用于降低爆破点的随从',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
        }),
        {
            sourceId: 'dino_rampage_choose_minion',
            titleKey: 'ui.dino_rampage_minion_title',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as DinoMinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined) {
            return { events: [] };
        }
        const base = state.core.bases[choice.baseIndex];
        if (!base) return { events: [] };
        const minion = base.minions.find((candidate) => candidate.uid === choice.minionUid && candidate.controller === playerId);
        if (!minion) return { events: [] };
        const power = getMinionPower(state.core, minion, choice.baseIndex);
        if (power <= 0) return { events: [] };
        return {
            events: [modifyBreakpoint(choice.baseIndex, -power, 'dino_rampage', timestamp)],
        };
    },
});

const dinoRampageBasePromptProgram = createPromptProgram<
    DinoRampageBaseContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'dino_rampage',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `dino_rampage_${context.now}`,
        context.playerId,
        '选择要降低爆破点的基地',
        buildBaseTargetOptions(context.baseCandidates, context.matchState.core),
        {
            sourceId: 'dino_rampage',
            titleKey: 'ui.dino_rampage_base_title',
            targetType: 'base',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as DinoBaseChoice;
        if (choice.baseIndex === undefined) {
            return { events: [] };
        }
        return resolveDinoRampageBaseSelection(state, playerId, timestamp, choice.baseIndex);
    },
});

const dinoRampageProgram = createBranchProgram<
    DinoRampageBaseContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.baseCandidates.length === 0,
    then: createEffectProgram(() => ({ events: [] })),
    else: createBranchProgram({
        when: (context) => !context.matchState,
        then: createEffectProgram(() => ({ events: [] })),
        else: dinoRampageBasePromptProgram,
    }),
});
// ongoing 效果
// ============================================================================

// 雷克斯王：无能力（纯力量7）
// 装甲剑龙 (ongoing) - 已通过 ongoingModifiers 系统实现力量修正
// 战斗迅猛龙 (ongoing) - 已通过 ongoingModifiers 系统实现力量修正
// 升级 (ongoing) - 已通过 ongoingModifiers 系统实现 +2 力量修正

function dinoToothAndClawInterceptor(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    let targetUid: string | undefined;
    let fromBaseIndex: number | undefined;
    let sourcePlayerId: string | undefined;

    if (event.type === SU_EVENTS.MINION_DESTROYED) {
        const payload = (event as MinionDestroyedEvent).payload;
        targetUid = payload.minionUid;
        fromBaseIndex = payload.fromBaseIndex;
        sourcePlayerId = payload.destroyerId;
    } else if (event.type === SU_EVENTS.MINION_RETURNED) {
        const payload = (event as MinionReturnedEvent).payload;
        targetUid = payload.minionUid;
        fromBaseIndex = payload.fromBaseIndex;
        sourcePlayerId = payload.sourcePlayerId;
    } else if (event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM) {
        const payload = (event as CardToDeckBottomEvent).payload;
        // CARD_TO_DECK_BOTTOM 的 cardUid 可能是随从
        targetUid = payload.cardUid;
        sourcePlayerId = payload.sourcePlayerId ?? payload.ownerId;
        // 需要在所有基地中查找该随从
        for (let i = 0; i < state.bases.length; i++) {
            if (state.bases[i].minions.some(m => m.uid === targetUid)) {
                fromBaseIndex = i;
                break;
            }
        }
    } else {
        return undefined;
    }

    if (targetUid === undefined || fromBaseIndex === undefined) {
        return undefined;
    }
    const base = state.bases[fromBaseIndex];
    if (!base) {
        return undefined;
    }
    const target = base.minions.find(m => m.uid === targetUid);
    if (!target) {
        return undefined;
    }
    const toothCard = target.attachedActions.find(a =>
        a.defId === 'dino_tooth_and_claw'
        && (sourcePlayerId === undefined || (((a.metadata?.sourceControllerId as string | undefined) ?? a.ownerId) !== sourcePlayerId))
    );
    if (!toothCard) {
        return undefined;
    }
    // 自毁全副武装，阻止影响
    const detachEvt: OngoingDetachedEvent = buildOngoingDetachedEvent({
        cardUid: toothCard.uid,
        defId: toothCard.defId,
        ownerId: toothCard.ownerId,
        reason: 'dino_tooth_and_claw_self_destruct',
        now: event.timestamp,
    });
    return [detachEvt]; // 替换原事件为自毁事件，随从存活
}

/** 全副武装(原版) 保护检查：附着了此卡的随从不受其他玩家影响（affect 类型，触发拦截自毁） */
function dinoToothAndClawChecker(ctx: ProtectionCheckContext): boolean {
    return ctx.targetMinion.attachedActions.some(a =>
        a.defId === 'dino_tooth_and_claw'
        && (ctx.sourcePlayerId === undefined || (((a.metadata?.sourceControllerId as string | undefined) ?? a.ownerId) !== ctx.sourcePlayerId))
    );
}

/** 全副武装(POD版) 保护检查：This minion is not affected by other players' cards. (只有结界免影响，不发生自毁) */
function dinoToothAndClawPodChecker(ctx: ProtectionCheckContext): boolean {
    return ctx.targetMinion.attachedActions.some(a =>
        a.defId === 'dino_tooth_and_claw_pod'
        && (ctx.sourcePlayerId === undefined || (((a.metadata?.sourceControllerId as string | undefined) ?? a.ownerId) !== ctx.sourcePlayerId))
    );
}

/** 野生保护区保护检查：该基地上你的随从不受其他玩家战术影响 */
function dinoWildlifePreserveChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    // 检查该基地上是否有 wildlife_preserve ongoing 卡，且卡的拥有者是被保护随从的控制者
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(
        a => matchesDefId(a.defId, 'dino_wildlife_preserve')
            && (((a.metadata?.sourceControllerId as string | undefined) ?? a.ownerId) === ctx.targetMinion.controller)
    );
}
