﻿/**
 * DiceThrone 效果解析器
 * 将 AbilityEffect 转换为 DiceThroneEvent（事件驱动）
 */

import type { PlayerId, RandomFn, GameEvent } from '../../../engine/types';
import { createDamageCalculation, type PassiveTriggerHandler } from '../../../engine/primitives/damageCalculation';
import type { EffectAction, RollDieConditionalEffect, RollDieDefaultEffect } from './tokenTypes';

export type { RollDieConditionalEffect, RollDieDefaultEffect };
import type { AbilityEffect, EffectTiming, EffectResolutionContext } from './combat';
import { combatAbilityManager } from './combatAbility';
import { getActiveDice, getFaceCounts, getPlayerDieFace, getTokenStackLimit } from './rules';
import { RESOURCE_IDS } from './resources';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    DamageDealtEvent,
    HealAppliedEvent,
    StatusAppliedEvent,
    StatusRemovedEvent,
    TokenGrantedEvent,
    ChoiceRequestedEvent,
    BonusDieRolledEvent,
    AbilityReplacedEvent,
    DamageShieldGrantedEvent,
    PreventDamageEvent,
    CpChangedEvent,
    BonusDieInfo,
    BonusDiceRerollRequestedEvent,
    PendingBonusDiceSettlement,
} from './types';
import { CP_MAX } from './types';
import { buildDrawEvents } from './deckEvents';
import {
    shouldOpenTokenResponse,
    createPendingDamage,
    createTokenResponseRequestedEvent,
} from './tokenResponse';
import type { AbilityDef } from './combat';

// ============================================================================
// 效果上下文
// ============================================================================

export interface EffectContext {
    attackerId: PlayerId;
    defenderId: PlayerId;
    sourceAbilityId: string;
    state: DiceThroneCore;
    damageDealt: number;
    /** 额外伤害累加器（用于 rollDie 的 bonusDamage 累加） */
    accumulatedBonusDamage?: number;
    /** 事件时间戳（来自命令或阶段推进） */
    timestamp?: number;
    /** 是否为防御技能上下文（防御反击伤害不触发 Token 响应窗口） */
    isDefensiveContext?: boolean;
}

// ============================================================================
// Custom Action 处理器注册表
// ============================================================================

/**
 * Custom Action 处理器上下文
 */
export interface CustomActionContext {
    ctx: EffectContext;
    targetId: PlayerId;
    attackerId: PlayerId;
    sourceAbilityId: string;
    state: DiceThroneCore;
    timestamp: number;
    random?: RandomFn;
    /** 触发此 Custom Action 的原始 EffectAction 配置（包含 params 等额外参数） */
    action: EffectAction;
}

/**
 * Custom Action 处理器函数类型
 * 返回生成的事件数组
 */
export type CustomActionHandler = (context: CustomActionContext) => DiceThroneEvent[];

/**
 * Custom Action 效果分类
 * - dice: 骰子相关（修改、重掷、增加投掷次数）
 * - status: 状态效果相关（移除、转移）
 * - resource: 资源相关（CP）
 * - token: Token 相关
 * - damage: 伤害相关
 * - defense: 防御相关
 * - card: 卡牌相关
 * - choice: 选择类效果
 * - other: 其他
 */
export type CustomActionCategory =
    | 'dice'
    | 'status'
    | 'resource'
    | 'token'
    | 'damage'
    | 'defense'
    | 'card'
    | 'choice'
    | 'passive'
    | 'other';

/**
 * Custom Action 元数据
 * 用于效果分类、响应窗口过滤等
 */
export interface CustomActionMeta {
    /** 效果分类（支持多分类） */
    categories: CustomActionCategory[];
    /** 是否需要玩家交互 */
    requiresInteraction?: boolean;
    /** 可用阶段（不指定则不限制） */
    phases?: string[];
}

/**
 * Custom Action 注册项（处理器 + 元数据）
 */
interface CustomActionEntry {
    handler: CustomActionHandler;
    meta: CustomActionMeta;
}

/**
 * Custom Action 处理器注册表
 * 存储 handler 和 meta
 */
const customActionRegistry: Map<string, CustomActionEntry> = new Map();

/**
 * 注册 Custom Action 处理器及元数据
 * @param actionId 唯一标识
 * @param handler 处理器函数
 * @param meta 元数据（分类、交互等）
 */
export function registerCustomActionHandler(
    actionId: string,
    handler: CustomActionHandler,
    meta: CustomActionMeta
): void {
    if (customActionRegistry.has(actionId)) {
        console.warn(`[DiceThrone] CustomAction "${actionId}" 已存在，将被覆盖`);
    }
    customActionRegistry.set(actionId, { handler, meta });
}

/**
 * 获取 Custom Action 处理器
 */
export function getCustomActionHandler(actionId: string): CustomActionHandler | undefined {
    return customActionRegistry.get(actionId)?.handler;
}

/**
 * 获取 Custom Action 元数据
 * 用于效果分类查询（如 hasAnyDiceEffect）
 */
export function getCustomActionMeta(actionId: string): CustomActionMeta | undefined {
    return customActionRegistry.get(actionId)?.meta;
}

/**
 * 检查 Custom Action 是否属于指定分类
 */
export function isCustomActionCategory(actionId: string, category: CustomActionCategory): boolean {
    const meta = customActionRegistry.get(actionId)?.meta;
    return meta?.categories.includes(category) ?? false;
}

/**
 * 获取所有已注册的 Custom Action ID（用于完整性测试）
 */
export function getRegisteredCustomActionIds(): Set<string> {
    return new Set(customActionRegistry.keys());
}


// ============================================================================
// 多骰展示辅助函数
// ============================================================================

/**
 * 创建仅用于展示的多骰结算事件
 * 伤害/治疗/状态已由 custom action 处理，此事件仅触发 UI 展示多骰结果
 */
export function createDisplayOnlySettlement(
    sourceAbilityId: string,
    actingPlayerId: PlayerId,
    targetId: PlayerId,
    dice: BonusDieInfo[],
    timestamp: number,
): BonusDiceRerollRequestedEvent {
    return {
        type: 'BONUS_DICE_REROLL_REQUESTED',
        payload: {
            settlement: {
                id: `${sourceAbilityId}-display-${timestamp}`,
                sourceAbilityId,
                attackerId: actingPlayerId,
                targetId,
                dice,
                rerollCostTokenId: '',
                rerollCostAmount: 0,
                rerollCount: 0,
                maxRerollCount: 0,
                readyToSettle: false,
                displayOnly: true,
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDiceRerollRequestedEvent;
}

// ============================================================================
// 通用奖励骰投掷 + 可选重掷
// ============================================================================

/**
 * 奖励骰投掷配置
 * 封装"投掷多骰 + 检查 token → 可重掷 / displayOnly"的通用逻辑
 */
export interface BonusDiceRollConfig {
    /** 投掷骰子数量 */
    diceCount: number;
    /** 重掷消耗的 Token ID */
    rerollCostTokenId: string;
    /** 每次重掷消耗的 Token 数量 */
    rerollCostAmount: number;
    /** 最大可重掷次数 */
    maxRerollCount?: number;
    /** 骰子效果描述 key（用于 UI） */
    dieEffectKey: string;
    /** 重掷特写文案 key（用于 UI） */
    rerollEffectKey: string;
    /** 结算阈值（如 12，用于判断是否触发额外效果） */
    threshold?: number;
    /** 达到阈值时的额外效果 */
    thresholdEffect?: 'knockdown';
    /** displayOnly 模式下是否显示总伤害（默认 true） */
    showTotal?: boolean;
    /** 覆盖伤害/状态目标（默认使用 ctx.targetId） */
    damageTargetId?: PlayerId;
}

/**
 * 通用奖励骰投掷 + 可选重掷
 *
 * 投掷指定数量的骰子，检查攻击方是否有足够 token 进行重掷：
 * - 有 token → 创建可重掷的 settlement（UI 显示重掷按钮）
 * - 无 token → 创建 displayOnly settlement（UI 仅展示骰子结果）+ 调用 resolveNoToken 生成结算事件
 *
 * @param ctx custom action 上下文
 * @param config 投掷配置
 * @param resolveNoToken 无 token 时的结算回调，接收骰子列表，返回额外事件（伤害/状态等）
 */
export function createBonusDiceWithReroll(
    ctx: CustomActionContext,
    config: BonusDiceRollConfig,
    resolveNoToken: (dice: BonusDieInfo[]) => DiceThroneEvent[],
): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random } = ctx;
    const targetId = config.damageTargetId ?? ctx.targetId;
    if (!random) return [];

    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];

    // 投掷奖励骰
    for (let i = 0; i < config.diceCount; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: targetId,
                effectKey: config.dieEffectKey,
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    const attacker = state.players[attackerId];
    const hasToken = (attacker?.tokens?.[config.rerollCostTokenId] ?? 0) >= config.rerollCostAmount;

    if (hasToken) {
        // 有足够 token，创建可重掷的 settlement
        const settlement: PendingBonusDiceSettlement = {
            id: `${sourceAbilityId}-${timestamp}`,
            sourceAbilityId,
            attackerId,
            targetId,
            dice,
            rerollCostTokenId: config.rerollCostTokenId,
            rerollCostAmount: config.rerollCostAmount,
            rerollCount: 0,
            maxRerollCount: config.maxRerollCount,
            rerollEffectKey: config.rerollEffectKey,
            threshold: config.threshold,
            thresholdEffect: config.thresholdEffect,
            readyToSettle: false,
        };
        events.push({
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as BonusDiceRerollRequestedEvent);
    } else {
        // 无足够 token，创建 displayOnly settlement + 直接结算
        events.push({
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: {
                settlement: {
                    id: `${sourceAbilityId}-display-${timestamp}`,
                    sourceAbilityId,
                    attackerId,
                    targetId,
                    dice,
                    rerollCostTokenId: '',
                    rerollCostAmount: 0,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    displayOnly: true,
                    showTotal: config.showTotal ?? true,
                },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as BonusDiceRerollRequestedEvent);

        // 调用方提供的结算逻辑（伤害/状态等）
        events.push(...resolveNoToken(dice));
    }

    return events;
}

// ============================================================================
// 效果解析器
// ============================================================================

/**
 * 创建 DiceThrone 专用的 PassiveTriggerHandler
 *
 * 封装 custom action handler 的调用逻辑，实现引擎层 PassiveTriggerHandler 接口。
 * 将 getCustomActionHandler 查找、CustomActionContext 构建、PREVENT_DAMAGE 提取
 * 统一包装，供 createDamageCalculation 在 collectStatusModifiers 中调用。
 */
export function createDTPassiveTriggerHandler(
    ctx: EffectContext,
    random?: RandomFn,
): PassiveTriggerHandler {
    return {
        handleCustomAction(actionId, context) {
            const handler = getCustomActionHandler(actionId);
            if (!handler) {
                console.warn(`[DiceThrone] 未注册的 customAction: ${actionId}`);
                return { events: [], preventAmount: 0 };
            }

            // 构建 EffectAction，注入 damageAmount/tokenId/tokenStacks 参数
            const actionWithParams: EffectAction = {
                type: 'custom',
                customActionId: actionId,
                params: {
                    damageAmount: context.damageAmount,
                    tokenId: context.tokenId,
                    tokenStacks: context.tokenStacks,
                },
            };

            const handlerCtx: CustomActionContext = {
                ctx,
                targetId: context.targetId,
                attackerId: context.attackerId,
                sourceAbilityId: context.sourceAbilityId ?? ctx.sourceAbilityId,
                state: context.state,
                timestamp: context.timestamp,
                random: context.random ?? random,
                action: actionWithParams,
            };

            const handledEvents = handler(handlerCtx);

            // 提取 PREVENT_DAMAGE 事件的减免量，并标记 applyImmediately
            let preventAmount = 0;
            for (const evt of handledEvents) {
                if (evt.type === 'PREVENT_DAMAGE') {
                    const payload = (evt as PreventDamageEvent).payload;
                    const amount = payload.amount ?? 0;
                    if (amount > 0) {
                        preventAmount += amount;
                    }
                    payload.applyImmediately = true;
                }
            }

            return { events: handledEvents as GameEvent[], preventAmount };
        },
    };
}



/**
 * 将单个效果动作转换为事件
 */
function resolveEffectAction(
    action: EffectAction,
    ctx: EffectContext,
    bonusDamage?: number,
    random?: RandomFn,
    sfxKey?: string
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const timestamp = ctx.timestamp ?? 0;
    const { attackerId, defenderId, sourceAbilityId, state } = ctx;
    const targetId = action.target === 'self' ? attackerId : defenderId;

    switch (action.type) {
        case 'damage': {
            // target: 'all' → 对所有玩家（含自己）; 'allOpponents' → 除自己外所有玩家
            const damageTargets = action.target === 'all'
                ? Object.keys(state.players)
                : action.target === 'allOpponents'
                    ? Object.keys(state.players).filter(id => id !== attackerId)
                    : [targetId];

            for (const dmgTargetId of damageTargets) {
                const baseDamage = (action.value ?? 0) + (bonusDamage ?? 0);
                if (baseDamage <= 0) continue;

                // 统一使用 createDamageCalculation 引擎原语计算伤害
                const calc = createDamageCalculation({
                    baseDamage,
                    source: { playerId: attackerId, abilityId: sourceAbilityId },
                    target: { playerId: dmgTargetId },
                    state,
                    autoCollectTokens: true,
                    autoCollectStatus: true,
                    autoCollectShields: true,
                    passiveTriggerHandler: createDTPassiveTriggerHandler(ctx, random),
                    timestamp,
                });
                const result = calc.resolve();

                // 收集 PassiveTrigger 产生的副作用事件（removeStatus / custom handler）
                events.push(...result.sideEffectEvents);

                if (result.finalDamage <= 0) continue;

                // 将引擎层 modifiers 转为 DamageModifier 格式（用于 Token 响应窗口的 pendingDamage）
                const passiveModifiers: import('./events').DamageModifier[] = result.modifiers.map(m => ({
                    type: m.type as 'defense' | 'token' | 'shield' | 'status',
                    value: m.value,
                    sourceId: m.sourceId,
                    sourceName: m.sourceName,
                }));

                // target: 'all'/'allOpponents' 的全体伤害不触发 Token 响应窗口
                if (action.target !== 'all' && action.target !== 'allOpponents') {
                    // 检查是否需要打开 Token 响应窗口
                    const tokenResponseType = shouldOpenTokenResponse(
                        state,
                        attackerId,
                        dmgTargetId,
                        result.finalDamage
                    );

                    if (tokenResponseType) {
                        // 创建待处理伤害，暂停伤害结算
                        const responseType = tokenResponseType === 'attackerBoost'
                            ? 'beforeDamageDealt'
                            : 'beforeDamageReceived';
                        const pendingDamage = createPendingDamage(
                            attackerId,
                            dmgTargetId,
                            result.finalDamage,
                            responseType,
                            sourceAbilityId,
                            timestamp,
                            passiveModifiers.length > 0 ? passiveModifiers : undefined
                        );
                        const tokenResponseEvent = createTokenResponseRequestedEvent(pendingDamage, timestamp);
                        events.push(tokenResponseEvent);
                        // 不在这里生成 DAMAGE_DEALT，等待 Token 响应完成后再生成
                        continue;
                    }
                }

                // 没有可用 Token，直接生成伤害事件
                const dmgTarget = state.players[dmgTargetId];
                const dmgTargetHp = dmgTarget?.resources[RESOURCE_IDS.HP] ?? 0;
                const actualDamage = dmgTarget ? Math.min(result.finalDamage, dmgTargetHp) : 0;

                const event: DamageDealtEvent = {
                    type: 'DAMAGE_DEALT',
                    payload: {
                        targetId: dmgTargetId,
                        amount: result.finalDamage,
                        actualDamage,
                        sourceAbilityId,
                        ...(passiveModifiers.length > 0 ? { modifiers: passiveModifiers } : {}),
                        breakdown: result.breakdown,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                    sfxKey,
                };
                events.push(event);
                ctx.damageDealt += actualDamage;
            }
            break;
        }

        case 'heal': {
            const event: HealAppliedEvent = {
                type: 'HEAL_APPLIED',
                payload: {
                    targetId,
                    amount: action.value ?? 0,
                    sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            };
            events.push(event);
            break;
        }

        case 'grantStatus': {
            if (!action.statusId) break;
            const target = state.players[targetId];
            const currentStacks = target?.statusEffects[action.statusId] ?? 0;
            const def = state.tokenDefinitions.find(e => e.id === action.statusId);
            const maxStacks = def?.stackLimit || 99;
            const stacksToAdd = action.value ?? 1;
            const newTotal = Math.min(currentStacks + stacksToAdd, maxStacks);

            const event: StatusAppliedEvent = {
                type: 'STATUS_APPLIED',
                payload: {
                    targetId,
                    statusId: action.statusId,
                    stacks: stacksToAdd,
                    newTotal,
                    sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            };
            events.push(event);
            break;
        }

        case 'removeStatus': {
            if (!action.statusId) break;
            const event: StatusRemovedEvent = {
                type: 'STATUS_REMOVED',
                payload: {
                    targetId,
                    statusId: action.statusId,
                    stacks: action.value ?? 1,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            };
            events.push(event);
            break;
        }

        case 'grantToken': {
            if (!action.tokenId) break;
            const tokenId = action.tokenId;
            const target = state.players[targetId];
            const currentAmount = target?.tokens[tokenId] ?? 0;
            const maxStacks = getTokenStackLimit(state, targetId, tokenId);
            const amountToAdd = action.value ?? 1;
            const newTotal = Math.min(currentAmount + amountToAdd, maxStacks);

            const tokenEvent: TokenGrantedEvent = {
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId,
                    tokenId,
                    amount: amountToAdd,
                    newTotal,
                    sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            };
            events.push(tokenEvent);
            break;
        }

        case 'choice': {
            // 选择效果：生成 CHOICE_REQUESTED 事件
            if (!action.choiceOptions || action.choiceOptions.length === 0) break;
            const choiceEvent: ChoiceRequestedEvent = {
                type: 'CHOICE_REQUESTED',
                payload: {
                    playerId: targetId,
                    sourceAbilityId,
                    titleKey: action.choiceTitleKey || 'choices.default',
                    options: action.choiceOptions,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            };
            events.push(choiceEvent);
            break;
        }

        case 'rollDie': {
            // 投掷骰子效果：投掷并根据结果触发条件效果
            if (!random) break;
            if (!action.conditionalEffects && !action.defaultEffect) break;
            const diceCount = action.diceCount ?? 1;
            const rollDice: BonusDieInfo[] = [];

            for (let i = 0; i < diceCount; i++) {
                const value = random.d(6);
                const face = getPlayerDieFace(state, attackerId, value) ?? '';
                
                // 查找匹配的条件效果
                const matchedEffect = action.conditionalEffects?.find(e => e.face === face);
                
                // 确定 effectKey：
                // 1. 如果有匹配的 conditionalEffect，使用它的 effectKey
                // 2. 否则如果有 defaultEffect.effectKey，使用它
                // 3. 最后使用通用的 bonusDie.effect.${face}
                const effectKey = matchedEffect?.effectKey 
                    ?? action.defaultEffect?.effectKey 
                    ?? `bonusDie.effect.${face}`;
                
                rollDice.push({ index: i, value, face, effectKey });

                // 生成 BONUS_DIE_ROLLED 事件（总是提供 effectKey）
                const bonusDieEvent: BonusDieRolledEvent = {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        value,
                        face,
                        playerId: targetId,
                        targetPlayerId: targetId,
                        // 骰面效果描述：使用自定义 effectKey 或通用 key
                        effectKey,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                    sfxKey,
                };
                events.push(bonusDieEvent);

                // 触发匹配的条件效果，或 defaultEffect
                if (matchedEffect) {
                    events.push(...resolveConditionalEffect(matchedEffect, ctx, targetId, sourceAbilityId, timestamp, sfxKey, random));
                } else if (action.defaultEffect) {
                    events.push(...resolveDefaultEffect(action.defaultEffect, ctx, targetId, sourceAbilityId, timestamp, sfxKey, random));
                }
            }

            // 多骰展示
            if (diceCount > 1) {
                events.push(createDisplayOnlySettlement(sourceAbilityId, targetId, targetId, rollDice, timestamp));
            }
            break;
        }

        case 'custom': {
            const actionId = action.customActionId;
            if (!actionId) {
                break;
            }

            // 从注册表查找处理器
            const handler = getCustomActionHandler(actionId);
            if (handler) {
                const handlerCtx: CustomActionContext = {
                    ctx,
                    targetId,
                    attackerId,
                    sourceAbilityId,
                    state,
                    timestamp,
                    random,
                    action,
                };
                const handledEvents = handler(handlerCtx);
                if (sfxKey) {
                    handledEvents.forEach(handledEvent => {
                        if (!handledEvent.sfxKey) {
                            handledEvent.sfxKey = sfxKey;
                        }
                    });
                }

                // Token 响应窗口后处理：
                // 防御技能的反击伤害不是"攻击"（规则 §7.2），不触发 Token 响应窗口。
                // 进攻技能通过 custom action 产生的 DAMAGE_DEALT 需要经过 shouldOpenTokenResponse 检查。
                const shouldCheckTokenResponse = !ctx.isDefensiveContext;

                // custom action 统一伤害累计入口 + Token 响应窗口拦截：
                // 扫描 handler 产出的 DAMAGE_DEALT 事件，对符合条件的伤害替换为 TOKEN_RESPONSE_REQUESTED。
                for (let i = 0; i < handledEvents.length; i++) {
                    const handledEvent = handledEvents[i];
                    if (handledEvent.type === 'DAMAGE_DEALT') {
                        const dmgPayload = (handledEvent as DamageDealtEvent).payload;
                        const dmgAmount = dmgPayload.amount ?? 0;
                        const dmgTargetId = dmgPayload.targetId;

                        // 检查是否需要打开 Token 响应窗口
                        if (shouldCheckTokenResponse && dmgAmount > 0) {
                            const tokenResponseType = shouldOpenTokenResponse(
                                state,
                                attackerId,
                                dmgTargetId,
                                dmgAmount
                            );

                            if (tokenResponseType) {
                                // 替换 DAMAGE_DEALT 为 TOKEN_RESPONSE_REQUESTED
                                const responseType = tokenResponseType === 'attackerBoost'
                                    ? 'beforeDamageDealt'
                                    : 'beforeDamageReceived';
                                const pendingDamage = createPendingDamage(
                                    attackerId,
                                    dmgTargetId,
                                    dmgAmount,
                                    responseType,
                                    sourceAbilityId,
                                    timestamp
                                );
                                const tokenResponseEvent = createTokenResponseRequestedEvent(pendingDamage, timestamp);
                                handledEvents[i] = tokenResponseEvent;
                                // 不累计伤害（等待 Token 响应完成后再结算）
                                continue;
                            }
                        }

                        // 没有 Token 响应，正常累计伤害
                        const dealt = dmgPayload.actualDamage ?? 0;
                        if (dealt > 0) {
                            ctx.damageDealt += dealt;
                        }
                    }
                }

                events.push(...handledEvents);
            } else {
                console.warn(`[DiceThrone] 未注册的 customAction: ${actionId}`);
            }
            break;
        }

        case 'drawCard': {
            // 抽牌效果（牌库为空则洗弃牌堆）
            if (!random) break;
            const count = action.drawCount ?? 1;
            events.push(...buildDrawEvents(state, targetId, count, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId));
            break;
        }

        case 'replaceAbility': {
            // 替换技能效果（升级卡使用）
            const { targetAbilityId, newAbilityDef, newAbilityLevel } = action;
            if (!targetAbilityId || !newAbilityDef) break;

            const currentLevel = state.players[targetId]?.abilityLevels?.[targetAbilityId] ?? 1;
            let resolvedLevel = newAbilityLevel ?? Math.min(3, currentLevel + 1);
            resolvedLevel = Math.max(1, Math.min(3, Math.floor(resolvedLevel)));

            const replaceEvent: AbilityReplacedEvent = {
                type: 'ABILITY_REPLACED',
                payload: {
                    playerId: targetId,
                    oldAbilityId: targetAbilityId,
                    newAbilityDef: newAbilityDef as AbilityDef,
                    cardId: sourceAbilityId,
                    newLevel: resolvedLevel,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            };
            events.push(replaceEvent);
            break;
        }

        case 'grantDamageShield': {
            // 授予伤害护盾（下次受伤时消耗）
            const shieldValue = action.shieldValue ?? action.value ?? 0;
            if (shieldValue <= 0) break;
            const preventStatus = action.preventStatus === true;

            const shieldEvent: DamageShieldGrantedEvent = {
                type: 'DAMAGE_SHIELD_GRANTED',
                payload: {
                    targetId,
                    value: shieldValue,
                    sourceId: sourceAbilityId,
                    preventStatus,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            };
            events.push(shieldEvent);
            break;
        }
    }

    return events;
}

// ============================================================================
// 条件效果处理
// ============================================================================

/**
 * 处理 rollDie 的条件效果
 */
function resolveConditionalEffect(
    effect: RollDieConditionalEffect,
    ctx: EffectContext,
    targetId: PlayerId,
    sourceAbilityId: string,
    timestamp: number,
    sfxKey?: string,
    random?: RandomFn
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const { state } = ctx;

    // 处理 bonusDamage
    if (effect.bonusDamage) {
        ctx.accumulatedBonusDamage = (ctx.accumulatedBonusDamage ?? 0) + effect.bonusDamage;
    }

    // 处理 grantStatus
    if (effect.grantStatus) {
        const { statusId, value, target: targetSpec } = effect.grantStatus;
        
        // 优先使用显式 target，否则根据 category 自动推断
        let actualTargetId: PlayerId;
        if (targetSpec) {
            // 显式指定了 target
            actualTargetId = targetSpec === 'self' ? ctx.attackerId : ctx.defenderId;
        } else {
            // 未指定 target，根据 category 自动推断
            const def = state.tokenDefinitions.find(e => e.id === statusId);
            const isDebuff = def?.category === 'debuff';
            actualTargetId = isDebuff ? ctx.defenderId : ctx.attackerId;
        }
        
        const targetPlayer = state.players[actualTargetId];
        const currentStacks = targetPlayer?.statusEffects[statusId] ?? 0;
        const def = state.tokenDefinitions.find(e => e.id === statusId);
        const maxStacks = def?.stackLimit || 99;
        const newTotal = Math.min(currentStacks + value, maxStacks);

        const event: StatusAppliedEvent = {
            type: 'STATUS_APPLIED',
            payload: {
                targetId: actualTargetId,
                statusId,
                stacks: value,
                newTotal,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        };
        events.push(event);
    }

    // 处理 grantToken
    if (effect.grantToken) {
        const { tokenId, value, target: targetSpec } = effect.grantToken;
        
        // 优先使用显式 target，否则默认为 self
        const actualTargetId = targetSpec 
            ? (targetSpec === 'self' ? ctx.attackerId : ctx.defenderId)
            : ctx.attackerId;
        
        const targetPlayer = state.players[actualTargetId];
        const currentAmount = targetPlayer?.tokens[tokenId] ?? 0;
        const maxStacks = getTokenStackLimit(state, actualTargetId, tokenId);
        const newTotal = Math.min(currentAmount + value, maxStacks);

        const tokenEvent: TokenGrantedEvent = {
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: actualTargetId,
                tokenId,
                amount: value,
                newTotal,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        };
        events.push(tokenEvent);
    }

    // 处理 grantTokens（多 Token 授予）
    if (effect.grantTokens) {
        for (const tokenGrant of effect.grantTokens) {
            const actualTarget = tokenGrant.target
                ? (tokenGrant.target === 'self' ? ctx.attackerId : ctx.defenderId)
                : ctx.attackerId;
            const tp = state.players[actualTarget];
            const cur = tp?.tokens[tokenGrant.tokenId] ?? 0;
            const max = getTokenStackLimit(state, actualTarget, tokenGrant.tokenId);
            const nt = Math.min(cur + tokenGrant.value, max);
            events.push({
                type: 'TOKEN_GRANTED',
                payload: { targetId: actualTarget, tokenId: tokenGrant.tokenId, amount: tokenGrant.value, newTotal: nt, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            } as TokenGrantedEvent);
        }
    }

    if (typeof effect.heal === 'number' && effect.heal > 0) {
        // 治疗永远施加给自己，不受 rollDie.target 影响
        const event: HealAppliedEvent = {
            type: 'HEAL_APPLIED',
            payload: {
                targetId: ctx.attackerId,
                amount: effect.heal,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        };
        events.push(event);
    }

    if (typeof effect.cp === 'number' && effect.cp !== 0) {
        // CP 永远施加给自己，不受 rollDie.target 影响
        const currentCp = state.players[ctx.attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newValue = Math.max(0, Math.min(currentCp + effect.cp, CP_MAX));
        const event: CpChangedEvent = {
            type: 'CP_CHANGED',
            payload: {
                playerId: ctx.attackerId,
                delta: effect.cp,
                newValue,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        };
        events.push(event);
    }

    // 处理 triggerChoice
    if (effect.triggerChoice) {
        const choiceEvent: ChoiceRequestedEvent = {
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: targetId,
                sourceAbilityId,
                titleKey: effect.triggerChoice.titleKey,
                options: effect.triggerChoice.options,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        };
        events.push(choiceEvent);
    }

    // 处理 drawCard（抽牌）
    if (typeof effect.drawCard === 'number' && effect.drawCard > 0 && random) {
        events.push(...buildDrawEvents(state, ctx.attackerId, effect.drawCard, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId));
    }

    // 处理 grantDamageShield（伤害护盾）
    if (effect.grantDamageShield) {
        const shieldEvent: DamageShieldGrantedEvent = {
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId: ctx.attackerId,
                value: effect.grantDamageShield.value,
                sourceId: sourceAbilityId,
                preventStatus: effect.grantDamageShield.preventStatus ?? false,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        };
        events.push(shieldEvent);
    }

    return events;
}

/**
 * 处理 rollDie 的 defaultEffect（"否则"分支）
 * 当所有 conditionalEffects 都不匹配时触发
 */
function resolveDefaultEffect(
    effect: RollDieDefaultEffect,
    ctx: EffectContext,
    targetId: PlayerId,
    sourceAbilityId: string,
    timestamp: number,
    sfxKey?: string,
    random?: RandomFn
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const { state } = ctx;

    if (typeof effect.drawCard === 'number' && effect.drawCard > 0 && random) {
        events.push(...buildDrawEvents(state, ctx.attackerId, effect.drawCard, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId));
    }

    if (typeof effect.heal === 'number' && effect.heal > 0) {
        events.push({
            type: 'HEAL_APPLIED',
            payload: { targetId: ctx.attackerId, amount: effect.heal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        } as HealAppliedEvent);
    }

    if (typeof effect.cp === 'number' && effect.cp !== 0) {
        const currentCp = state.players[ctx.attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newValue = Math.max(0, Math.min(currentCp + effect.cp, CP_MAX));
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: ctx.attackerId, delta: effect.cp, newValue, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        } as CpChangedEvent);
    }

    if (effect.grantToken) {
        const { tokenId, value, target: targetSpec } = effect.grantToken;
        const actualTargetId = targetSpec
            ? (targetSpec === 'self' ? ctx.attackerId : ctx.defenderId)
            : ctx.attackerId;
        const targetPlayer = state.players[actualTargetId];
        const currentAmount = targetPlayer?.tokens[tokenId] ?? 0;
        const maxStacks = getTokenStackLimit(state, actualTargetId, tokenId);
        const newTotal = Math.min(currentAmount + value, maxStacks);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: actualTargetId, tokenId, amount: value, newTotal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        } as TokenGrantedEvent);
    }

    if (effect.grantStatus) {
        const { statusId, value, target: targetSpec } = effect.grantStatus;
        let actualTargetId: PlayerId;
        if (targetSpec) {
            actualTargetId = targetSpec === 'self' ? ctx.attackerId : ctx.defenderId;
        } else {
            const def = state.tokenDefinitions.find(e => e.id === statusId);
            actualTargetId = def?.category === 'debuff' ? ctx.defenderId : ctx.attackerId;
        }
        const targetPlayer = state.players[actualTargetId];
        const currentStacks = targetPlayer?.statusEffects[statusId] ?? 0;
        const def = state.tokenDefinitions.find(e => e.id === statusId);
        const maxStacks = def?.stackLimit || 99;
        const newTotal = Math.min(currentStacks + value, maxStacks);
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: actualTargetId, statusId, stacks: value, newTotal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
            sfxKey,
        } as StatusAppliedEvent);
    }

    return events;
}

/**
 * 解析指定时切的所有效果，生成事件
 */
export function resolveEffectsToEvents(
    effects: AbilityEffect[],
    timing: EffectTiming,
    ctx: EffectContext,
    config?: { bonusDamage?: number; bonusDamageOnce?: boolean; random?: RandomFn; skipDamage?: boolean }
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    let bonusApplied = false;

    // 构建 EffectResolutionContext 用于条件检查
    const activeDice = getActiveDice(ctx.state);
    const resolutionCtx: EffectResolutionContext = {
        attackerId: ctx.attackerId,
        defenderId: ctx.defenderId,
        sourceAbilityId: ctx.sourceAbilityId,
        damageDealt: ctx.damageDealt,
        attackerStatusEffects: ctx.state.players[ctx.attackerId]?.statusEffects,
        defenderStatusEffects: ctx.state.players[ctx.defenderId]?.statusEffects,
        diceValues: activeDice.map(die => die.value),
        faceCounts: getFaceCounts(activeDice),
    };

    const timedEffects = combatAbilityManager.instance.getEffectsByTiming(effects, timing);

    for (const effect of timedEffects) {
        if (!effect.action) {
            continue;
        }
        // skipDamage：Token 响应后重新执行 withDamage 时，跳过已结算的伤害效果
        // 同时跳过产生伤害的 custom action（如雷霆万钧的 thunder-strike-roll-damage），
        // 避免 custom action 被重复执行导致骰子二次投掷和 random 队列偏移
        if (config?.skipDamage) {
            if (effect.action.type === 'damage') {
                continue;
            }
            if (effect.action.type === 'custom' && effect.action.customActionId
                && isCustomActionCategory(effect.action.customActionId, 'damage')) {
                continue;
            }
        }
        if (!combatAbilityManager.instance.checkEffectCondition(effect, resolutionCtx)) {
            continue;
        }

        // 计算额外伤害：包括配置的 bonusDamage + rollDie 累加的 accumulatedBonusDamage
        let totalBonus = 0;
        if (config && !bonusApplied && config.bonusDamage) {
            totalBonus += config.bonusDamage;
        }
        if (ctx.accumulatedBonusDamage) {
            totalBonus += ctx.accumulatedBonusDamage;
        }

        const effectEvents = resolveEffectAction(effect.action, ctx, totalBonus || undefined, config?.random, effect.sfxKey);
        events.push(...effectEvents);

        // TOKEN_RESPONSE_REQUESTED 意味着伤害被挂起等待玩家响应，
        // 后续效果（如 rollDie）应在 Token 响应完成后由 resolvePostDamageEffects 执行。
        // 此处必须中断，否则 rollDie 会消耗 random 值，导致后续重新执行时 random 队列偏移。
        if (effectEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED')) {
            break;
        }

        // 如果产生伤害且只允许一次加成
        if (effectEvents.some(e => e.type === 'DAMAGE_DEALT') && config?.bonusDamageOnce) {
            bonusApplied = true;
            // 伤害已应用，清空累加的额外伤害
            ctx.accumulatedBonusDamage = 0;
        }

        // 更新 resolutionCtx.damageDealt 用于后续条件检查
        resolutionCtx.damageDealt = ctx.damageDealt;
    }

    // rollDie 累加的 bonusDamage 未被后续 damage 动作消费时，作为独立伤害事件发出
    // 场景：正义冲击 damage(5) 在 rollDie 之前，rollDie 的 bonusDamage 无后续 damage 消费
    if (ctx.accumulatedBonusDamage && ctx.accumulatedBonusDamage > 0) {
        const timestamp = ctx.timestamp ?? 0;
        const targetId = ctx.defenderId;
        const target = ctx.state.players[targetId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const bonusDmg = ctx.accumulatedBonusDamage;
        const actualDamage = target ? Math.min(bonusDmg, targetHp) : 0;

        // 直接发出 DAMAGE_DEALT，不经过 Token 响应检查
        // 因为 bonusDamage 是同一次攻击的附加伤害，Token 响应已在主伤害时处理
        const bonusDmgEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount: bonusDmg,
                actualDamage,
                sourceAbilityId: ctx.sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        };
        events.push(bonusDmgEvent);
        ctx.damageDealt += actualDamage;
        ctx.accumulatedBonusDamage = 0;
    }

    return events;
}

// ============================================================================
// 初始化 Custom Action 处理器
// 处理器实现已拆分到 customActions/ 目录
// ============================================================================

import { initializeCustomActions } from './customActions';

// 在模块加载时自动初始化所有处理器
initializeCustomActions();
