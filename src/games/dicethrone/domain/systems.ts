/**
 * DiceThrone 专用系统扩展
 * 处理领域事件到系统状态的映射
 */

import type { GameEvent } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { INTERACTION_EVENTS, queueInteraction, resolveInteraction, createSimpleChoice, createMultistepChoice } from '../../../engine/systems/InteractionSystem';
import type { InteractionDescriptor as EngineInteractionDescriptor, SimpleChoiceData, PromptOption, MultistepChoiceData } from '../../../engine/systems/InteractionSystem';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    ChoiceRequestedEvent,
    ChoiceResolvedEvent,
    InteractionRequestedEvent,
    TokenResponseRequestedEvent,
    BonusDiceRerollRequestedEvent,
    CpChangedEvent,
    InteractionDescriptor as DtInteractionDescriptor,
} from './types';
import { getPlayerPassiveAbilities } from './passiveAbility';
import { findPlayerAbility } from './abilityLookup';
import { RESOURCE_IDS } from './resources';
import { CP_MAX } from './core-types';

// ============================================================================
// 多步交互类型定义（骰子修改 / 骰子选择）
// ============================================================================

/** 骰子修改累积结果 */
export interface DiceModifyResult {
    /** 骰子修改映射：dieId → newValue */
    modifications: Record<number, number>;
    /** 已修改的骰子数量 */
    modCount: number;
    /** adjust 模式累计调整量 */
    totalAdjustment: number;
}

/** 骰子修改步骤 */
export type DiceModifyStep =
    | { action: 'select'; dieId: number; dieValue: number }
    | { action: 'adjust'; dieId: number; delta: number; currentValue: number }
    | { action: 'setAny'; dieId: number; newValue: number };

/** 骰子选择（重掷）累积结果 */
export interface DiceSelectResult {
    /** 选中的骰子 ID 列表 */
    selectedDiceIds: number[];
}

/** 骰子选择步骤 */
export type DiceSelectStep = { action: 'toggle'; dieId: number };

/**
 * 骰子修改 localReducer
 * 根据模式处理不同的步骤类型
 * 导出供客户端在序列化边界后重新注入（函数无法通过 JSON 传输）
 */
export function diceModifyReducer(
    current: DiceModifyResult,
    step: DiceModifyStep,
    config: DtInteractionDescriptor['dieModifyConfig'],
): DiceModifyResult {
    const mode = config?.mode;

    if (step.action === 'select') {
        // set 模式：选中骰子，记录目标值
        if (mode === 'set') {
            const targetValue = config?.targetValue ?? step.dieValue;
            return {
                ...current,
                modifications: { ...current.modifications, [step.dieId]: targetValue },
                modCount: current.modCount + 1,
            };
        }
        // copy 模式：第一颗记录源值，第二颗复制源值
        if (mode === 'copy') {
            const entries = Object.entries(current.modifications);
            if (entries.length === 0) {
                // 第一颗：记录源骰子（值不变）
                return {
                    ...current,
                    modifications: { [step.dieId]: step.dieValue },
                    modCount: 1,
                };
            }
            // 第二颗：复制第一颗的值
            const sourceValue = Number(entries[0][1]);
            return {
                ...current,
                modifications: { ...current.modifications, [step.dieId]: sourceValue },
                modCount: 2,
            };
        }
        return current;
    }

    if (step.action === 'adjust') {
        // adjust 模式：累加调整量
        const prevValue = current.modifications[step.dieId] ?? step.currentValue;
        const newValue = prevValue + step.delta;
        if (newValue < 1 || newValue > 6) return current;
        return {
            ...current,
            modifications: { ...current.modifications, [step.dieId]: newValue },
            modCount: Object.keys(current.modifications).includes(String(step.dieId))
                ? current.modCount
                : current.modCount + 1,
            totalAdjustment: current.totalAdjustment + step.delta,
        };
    }

    if (step.action === 'setAny') {
        // any 模式：直接设置值
        if (step.newValue < 1 || step.newValue > 6) return current;
        return {
            ...current,
            modifications: { ...current.modifications, [step.dieId]: step.newValue },
            modCount: Object.keys(current.modifications).includes(String(step.dieId))
                ? current.modCount
                : current.modCount + 1,
        };
    }

    return current;
}

/**
 * 骰子修改 toCommands：将累积结果转换为 MODIFY_DIE 命令列表
 * 导出供客户端在序列化边界后重新注入
 */
export function diceModifyToCommands(result: DiceModifyResult): Array<{ type: string; payload: unknown }> {
    return Object.entries(result.modifications)
        .filter(([, newValue]) => newValue !== undefined)
        .map(([dieId, newValue]) => ({
            type: 'MODIFY_DIE',
            payload: { dieId: Number(dieId), newValue },
        }));
}

/**
 * 骰子选择 localReducer（重掷）
 * 导出供客户端在序列化边界后重新注入
 */
export function diceSelectReducer(current: DiceSelectResult, step: DiceSelectStep): DiceSelectResult {
    if (step.action === 'toggle') {
        const idx = current.selectedDiceIds.indexOf(step.dieId);
        if (idx >= 0) {
            return { selectedDiceIds: current.selectedDiceIds.filter(id => id !== step.dieId) };
        }
        return { selectedDiceIds: [...current.selectedDiceIds, step.dieId] };
    }
    return current;
}

/**
 * 骰子选择 toCommands：将选中骰子转换为 REROLL_DIE 命令列表
 * 导出供客户端在序列化边界后重新注入
 */
export function diceSelectToCommands(result: DiceSelectResult): Array<{ type: string; payload: unknown }> {
    return result.selectedDiceIds.map(dieId => ({
        type: 'REROLL_DIE',
        payload: { dieId },
    }));
}

// ============================================================================
// DiceThrone 事件处理系统
// ============================================================================

/**
 * 创建 DiceThrone 事件处理系统
 * 负责将领域事件转换为系统状态更新（如 Prompt）
 */
export function createDiceThroneEventSystem(): EngineSystem<DiceThroneCore> {
    return {
        id: 'dicethrone-events',
        name: 'DiceThrone 事件处理',
        priority: 22, // 在 InteractionSystem(20) 之后、FlowSystem(25) 之前，确保 interaction 状态对 autoContinue 可见

        afterEvents: ({ state, events }): HookResult<DiceThroneCore> | void => {
            let newState = state;
            const nextEvents: GameEvent[] = [];
            // 防止同一批事件中多个 STATUS_REMOVED 重复 resolve
            let statusInteractionCompleted = false;

            for (const event of events) {
                const dtEvent = event as DiceThroneEvent;
                
                // 处理 CHOICE_REQUESTED 事件 -> 创建 Prompt
                if (dtEvent.type === 'CHOICE_REQUESTED') {
                    const payload = (dtEvent as ChoiceRequestedEvent).payload;
                    const eventTimestamp = typeof dtEvent.timestamp === 'number' ? dtEvent.timestamp : 0;
                    
                    // 将 DiceThrone 的选择选项转换为 PromptOption
                    const promptOptions: PromptOption<{
                        statusId?: string;
                        tokenId?: string;
                        value: number;
                        customId?: string;
                        labelKey?: string;
                    }>[] = payload.options.map((opt, index) => {
                        const label = opt.labelKey
                            ?? (opt.tokenId ? `tokens.${opt.tokenId}.name`
                                : opt.statusId ? `statusEffects.${opt.statusId}.name`
                                    : `choices.option-${index}`);
                        return {
                            id: `option-${index}`,
                            label,
                            value: opt,
                        };
                    });
                    
                    const interaction = createSimpleChoice(
                        `choice-${payload.sourceAbilityId}-${eventTimestamp}`,
                        payload.playerId,
                        payload.titleKey,
                        promptOptions,
                        payload.sourceAbilityId
                    );
                    // 透传 slider 配置到 interaction data
                    if (payload.slider) {
                        (interaction.data as SimpleChoiceData & { slider?: unknown }).slider = payload.slider;
                    }
                    
                    newState = queueInteraction(newState, interaction);
                }

                // ---- INTERACTION_REQUESTED → 根据类型创建不同交互 ----
                if (dtEvent.type === 'INTERACTION_REQUESTED') {
                    const payload = (dtEvent as InteractionRequestedEvent).payload;
                    const pendingInteraction = payload.interaction;
                    
                    // 骰子修改类交互 → multistep-choice
                    if (pendingInteraction.type === 'modifyDie') {
                        const config = pendingInteraction.dieModifyConfig;
                        const selectCount = pendingInteraction.selectCount ?? 1;
                        const mode = config?.mode;

                        // any/adjust 模式：用户需要反复 +/- 调整骰子值，禁用 auto-confirm，由用户手动确认
                        // set/copy 模式：每次点击选中一颗骰子，选满后自动 confirm
                        const isManualConfirmMode = mode === 'any' || mode === 'adjust';
                        const maxSteps = isManualConfirmMode ? undefined : selectCount;

                        const multistepData: MultistepChoiceData<DiceModifyStep, DiceModifyResult> = {
                            title: pendingInteraction.titleKey,
                            sourceId: pendingInteraction.sourceCardId,
                            maxSteps,
                            minSteps: isManualConfirmMode ? 1 : undefined,
                            initialResult: { modifications: {}, modCount: 0, totalAdjustment: 0 },
                            localReducer: (current, step) => diceModifyReducer(current, step, config),
                            toCommands: diceModifyToCommands,
                            meta: {
                                dtType: 'modifyDie',
                                dieModifyConfig: config,
                                selectCount,
                                targetOpponentDice: pendingInteraction.targetOpponentDice ?? false,
                            },
                        };

                        const interaction = createMultistepChoice(
                            `dt-dice-modify-${pendingInteraction.id}`,
                            pendingInteraction.playerId,
                            multistepData,
                        );
                        newState = queueInteraction(newState, interaction);
                        continue;
                    }

                    // 骰子选择（重掷）类交互 → multistep-choice
                    if (pendingInteraction.type === 'selectDie') {
                        const selectCount = pendingInteraction.selectCount ?? 1;

                        const multistepData: MultistepChoiceData<DiceSelectStep, DiceSelectResult> = {
                            title: pendingInteraction.titleKey,
                            sourceId: pendingInteraction.sourceCardId,
                            maxSteps: selectCount,
                            minSteps: 1,
                            initialResult: { selectedDiceIds: [] },
                            localReducer: diceSelectReducer,
                            toCommands: diceSelectToCommands,
                            meta: {
                                dtType: 'selectDie',
                                selectCount,
                                targetOpponentDice: pendingInteraction.targetOpponentDice ?? false,
                            },
                        };

                        const interaction = createMultistepChoice(
                            `dt-dice-select-${pendingInteraction.id}`,
                            pendingInteraction.playerId,
                            multistepData,
                        );
                        newState = queueInteraction(newState, interaction);
                        continue;
                    }

                    // 状态选择类交互 → 保持 dt:card-interaction
                    const isStatusType = pendingInteraction.type === 'selectStatus'
                        || pendingInteraction.type === 'selectPlayer'
                        || pendingInteraction.type === 'selectTargetStatus';

                    if (isStatusType) {
                        const targetPlayerIds = pendingInteraction.targetPlayerIds || Object.keys(newState.core.players);
                        // 只有明确要求目标有状态的交互（如"移除所有状态"）才检查并跳过
                        const needsTargetWithStatus = pendingInteraction.requiresTargetWithStatus === true
                            || pendingInteraction.type === 'selectStatus'
                            || pendingInteraction.type === 'selectTargetStatus';
                        if (needsTargetWithStatus) {
                            const hasAnyStatus = targetPlayerIds.some(pid => {
                                const player = newState.core.players[pid];
                                if (!player) return false;
                                const hasEffects = Object.values(player.statusEffects).some(v => v > 0);
                                const hasTokens = Object.values(player.tokens ?? {}).some(v => v > 0);
                                return hasEffects || hasTokens;
                            });
                            if (!hasAnyStatus) {
                                // 无可选项，自动跳过交互（直接 resolve，不生成事件）
                                newState = resolveInteraction(newState);
                                continue;
                            }
                        }
                    }

                    // 创建 dt:card-interaction，data 直接存储 PendingInteraction
                    // 加上 sourceId 字段，让 InteractionSystem 在取消时能正确提取到 payload.sourceId
                    const interaction: EngineInteractionDescriptor = {
                        id: `dt-interaction-${pendingInteraction.id}`,
                        kind: 'dt:card-interaction',
                        playerId: pendingInteraction.playerId,
                        data: { ...pendingInteraction, sourceId: pendingInteraction.sourceCardId },
                    };
                    newState = queueInteraction(newState, interaction);
                }

                // ---- 状态交互自动完成：STATUS_REMOVED / TOKEN_CONSUMED 触发时直接 resolve ----
                // 注意：REMOVE_STATUS 移除所有状态时会生成多个 STATUS_REMOVED 事件，
                // 使用 statusInteractionCompleted 标记防止重复 resolve
                if (!statusInteractionCompleted && (dtEvent.type === 'STATUS_REMOVED' || dtEvent.type === 'TOKEN_CONSUMED'
                    || dtEvent.type === 'STATUS_APPLIED' || dtEvent.type === 'TOKEN_GRANTED')) {
                    const current = newState.sys.interaction.current;
                    if (current?.kind === 'dt:card-interaction') {
                        const interactionData = current.data as DtInteractionDescriptor;
                        const isStatusType = interactionData.type === 'selectStatus'
                            || interactionData.type === 'selectPlayer'
                            || interactionData.type === 'selectTargetStatus';
                        if (isStatusType) {
                            statusInteractionCompleted = true;
                            // 状态交互完成：直接 resolve，不生成事件
                            newState = resolveInteraction(newState);
                        }
                    }
                }

                // ---- TOKEN_RESPONSE_REQUESTED → queue/update dt:token-response ----
                // 业务数据仅存 core.pendingDamage；sys.interaction 只做阻塞标记
                if (dtEvent.type === 'TOKEN_RESPONSE_REQUESTED') {
                    const payload = (dtEvent as TokenResponseRequestedEvent).payload;
                    const current = newState.sys.interaction.current;
                    if (current && current.kind === 'dt:token-response') {
                        // 同一伤害响应内的阶段切换（攻击方加伤 → 防御方减伤），原地更新 playerId
                        newState = {
                            ...newState,
                            sys: {
                                ...newState.sys,
                                interaction: {
                                    ...newState.sys.interaction,
                                    current: {
                                        ...current,
                                        id: `dt-token-response-${payload.pendingDamage.id}`,
                                        playerId: payload.pendingDamage.responderId,
                                        data: null,
                                    },
                                },
                            },
                        };
                    } else {
                        const interaction: EngineInteractionDescriptor = {
                            id: `dt-token-response-${payload.pendingDamage.id}`,
                            kind: 'dt:token-response',
                            playerId: payload.pendingDamage.responderId,
                            data: null,
                        };
                        newState = queueInteraction(newState, interaction);
                    }
                }

                // ---- TOKEN_RESPONSE_CLOSED → resolve ----
                if (dtEvent.type === 'TOKEN_RESPONSE_CLOSED') {
                    newState = resolveInteraction(newState);
                }

                // ---- BONUS_DICE_REROLL_REQUESTED → queue dt:bonus-dice ----
                // 业务数据仅存 core.pendingBonusDiceSettlement；sys.interaction 只做阻塞标记
                // displayOnly 模式（如正义冲击 rollDie 多骰展示）也创建交互阻塞，
                // 确保 autoContinue 不会在用户看到 overlay 前推进阶段。
                // 用户点击 Continue → SKIP_BONUS_DICE_REROLL → BONUS_DICE_SETTLED → resolveInteraction
                if (dtEvent.type === 'BONUS_DICE_REROLL_REQUESTED') {
                    const payload = (dtEvent as BonusDiceRerollRequestedEvent).payload;
                    const interaction: EngineInteractionDescriptor = {
                        id: `dt-bonus-dice-${payload.settlement.id}`,
                        kind: 'dt:bonus-dice',
                        playerId: payload.settlement.attackerId,
                        data: null,
                    };
                    newState = queueInteraction(newState, interaction);
                }

                // ---- BONUS_DICE_SETTLED → resolve ----
                if (dtEvent.type === 'BONUS_DICE_SETTLED') {
                    newState = resolveInteraction(newState);
                }

                // ---- SYS_INTERACTION_CANCELLED → 生成领域 INTERACTION_CANCELLED 事件（返还卡牌） ----
                if (event.type === INTERACTION_EVENTS.CANCELLED) {
                    const payload = event.payload as {
                        interactionId: string;
                        playerId: string;
                        sourceId?: string;
                        interactionData?: any;
                    };

                    // InteractionSystem 已从 current.data.sourceId 提取到 payload.sourceId，
                    // 直接使用，无需再挖 interactionData（兼容 dt:card-interaction 和 multistep-choice）
                    const sourceCardId = payload.sourceId ?? '';
                    let cpCost = 0;
                    if (sourceCardId) {
                        const player = newState.core.players[payload.playerId];
                        const card = player?.discard.find((c: any) => c.id === sourceCardId);
                        cpCost = card?.cpCost ?? 0;
                    }

                    // 始终生成领域 INTERACTION_CANCELLED 事件：
                    // 1. 有 sourceCardId 时：reducer 返还卡牌和 CP
                    // 2. 无 sourceCardId 时：仍需 interactionId 用于 ResponseWindowSystem 解锁 interactionLock
                    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
                    nextEvents.push({
                        type: 'INTERACTION_CANCELLED',
                        payload: {
                            playerId: payload.playerId,
                            sourceCardId,
                            cpCost,
                            interactionId: payload.interactionId,
                        },
                        sourceCommandType: 'SYS_INTERACTION_CANCEL',
                        timestamp: eventTimestamp,
                    } as DiceThroneEvent);
                }

                // 处理 Prompt 响应 -> 生成 CHOICE_RESOLVED 领域事件
                const resolvedEvent = handlePromptResolved(event);
                if (resolvedEvent) {
                    nextEvents.push(resolvedEvent);
                }

                // ---- 被动能力触发器：ABILITY_ACTIVATED + pray 面 → 获得 CP ----
                if (dtEvent.type === 'ABILITY_ACTIVATED') {
                    const { abilityId, playerId, isDefense } = dtEvent.payload;
                    // 仅在自己的进攻阶段触发（非防御技能）
                    const phase = newState.sys.phase as string;
                    if (!isDefense && phase === 'offensiveRoll' && playerId === newState.core.activePlayerId) {
                        const passives = getPlayerPassiveAbilities(newState.core, playerId);
                        for (const passive of passives) {
                            if (!passive.trigger || passive.trigger.on !== 'abilityActivatedWithFace') continue;
                            // 检查激活的技能是否使用了所需骰面
                            const match = findPlayerAbility(newState.core, playerId, abilityId);
                            if (!match) continue;
                            const trigger = match.variant?.trigger ?? match.ability.trigger;
                            if (!trigger) continue;
                            // 检查 trigger 中是否包含所需骰面
                            let hasFace = false;
                            if (trigger.type === 'diceSet' && trigger.faces) {
                                hasFace = (trigger.faces[passive.trigger.requiredFace] ?? 0) > 0;
                            } else if (trigger.type === 'allSymbolsPresent' && trigger.symbols) {
                                hasFace = trigger.symbols.includes(passive.trigger.requiredFace);
                            } else if (trigger.type === 'smallStraight' || trigger.type === 'largeStraight') {
                                // 顺子不声明骰面，需要检查实际骰面中是否包含所需面
                                const activeDice = newState.core.dice.slice(0, newState.core.rollDiceCount);
                                hasFace = activeDice.some(d => d.symbol === passive.trigger!.requiredFace);
                            }
                            if (hasFace) {
                                const player = newState.core.players[playerId];
                                const currentCp = player?.resources[RESOURCE_IDS.CP] ?? 0;
                                const newCp = Math.min(currentCp + passive.trigger.grantCp, CP_MAX);
                                nextEvents.push({
                                    type: 'CP_CHANGED',
                                    payload: {
                                        playerId,
                                        delta: passive.trigger.grantCp,
                                        newValue: newCp,
                                        sourceAbilityId: passive.id,
                                    },
                                    sourceCommandType: 'PASSIVE_TRIGGER',
                                    timestamp: typeof dtEvent.timestamp === 'number' ? dtEvent.timestamp + 1 : 1,
                                } as CpChangedEvent);
                            }
                        }
                    }
                }
            }

            // ---- multistep-choice 自动确认（引擎层）----
            // UI 层的 useMultistepInteraction 也有此逻辑，但测试环境无 React，
            // 需要在引擎层处理：通过 data.completedSteps 追踪累计步骤数，
            // 每次有 DIE_MODIFIED/DIE_REROLLED 事件时递增，达到 maxSteps 时自动 resolve。
            // 注意：每个命令是独立的 pipeline 调用，不能靠单次 afterEvents 的事件数量判断。
            const current = newState.sys.interaction.current;
            if (current?.kind === 'multistep-choice') {
                const data = current.data as MultistepChoiceData & { completedSteps?: number };
                if (data.maxSteps !== undefined) {
                    const dieModifiedCount = events.filter(e => e.type === 'DIE_MODIFIED').length;
                    const dieRerolledCount = events.filter(e => e.type === 'DIE_REROLLED').length;
                    const newSteps = dieModifiedCount + dieRerolledCount;
                    if (newSteps > 0) {
                        const completedSteps = (data.completedSteps ?? 0) + newSteps;
                        if (completedSteps >= data.maxSteps) {
                            // 达到最大步骤数，自动 resolve
                            newState = resolveInteraction(newState);
                            nextEvents.push({
                                type: INTERACTION_EVENTS.CONFIRMED,
                                payload: {
                                    interactionId: current.id,
                                    playerId: current.playerId,
                                    sourceId: (current.data as any)?.sourceId,
                                },
                                timestamp: events[events.length - 1]?.timestamp ?? 0,
                            });
                        } else {
                            // 未达到最大步骤数，更新累计步骤数
                            newState = {
                                ...newState,
                                sys: {
                                    ...newState.sys,
                                    interaction: {
                                        ...newState.sys.interaction,
                                        current: {
                                            ...current,
                                            data: { ...data, completedSteps },
                                        },
                                    },
                                },
                            };
                        }
                    }
                }
            }

            if (newState !== state || nextEvents.length > 0) {
                return {
                    state: newState,
                    events: nextEvents.length > 0 ? nextEvents : undefined,
                };
            }
        },
    };
}

/**
 * 处理 Prompt 响应事件，生成领域事件
 * 在 pipeline 层通过 domain.execute 处理 RESOLVE_CHOICE 命令时调用
 */
export function handlePromptResolved(
    event: GameEvent
): ChoiceResolvedEvent | null {
    if (event.type !== INTERACTION_EVENTS.RESOLVED) return null;
    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
    
    const payload = event.payload as {
        interactionId: string;
        playerId: string;
        optionId: string | null;
        value: { statusId?: string; tokenId?: string; value: number; customId?: string };
        sourceId?: string;
    };
    
    return {
        type: 'CHOICE_RESOLVED',
        payload: {
            playerId: payload.playerId,
            statusId: payload.value.statusId,
            tokenId: payload.value.tokenId,
            value: payload.value.value,
            customId: payload.value.customId,
            sourceAbilityId: payload.sourceId,
        },
        sourceCommandType: 'RESOLVE_CHOICE',
        timestamp: eventTimestamp,
    };
}
