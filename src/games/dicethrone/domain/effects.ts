/**
 * DiceThrone 效果解析器
 * 将 AbilityEffect 转换为 DiceThroneEvent（事件驱动）
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type { EffectAction, RollDieConditionalEffect } from '../../../systems/TokenSystem/types';

export type { RollDieConditionalEffect };
import type { AbilityEffect, EffectTiming, EffectResolutionContext } from '../../../systems/presets/combat';
import { combatAbilityManager } from './combatAbility';
import { getActiveDice, getFaceCounts, getDieFace, getTokenStackLimit } from './rules';
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
} from './types';
import { CP_MAX } from './types';
import { buildDrawEvents } from './deckEvents';
import {
    shouldOpenTokenResponse,
    createPendingDamage,
    createTokenResponseRequestedEvent,
} from './tokenResponse';
import type { AbilityDef } from '../../../systems/presets/combat';

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
 * - resource: 资源相关（CP、Token）
 * - choice: 选择类效果
 * - other: 其他
 */
export type CustomActionCategory = 'dice' | 'status' | 'resource' | 'choice' | 'other';

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

// ============================================================================
// 效果解析器
// ============================================================================

/**
 * 处理 onDamageReceived 被动触发（基于 tokenDefinitions）
 * - 支持 modifyStat / removeStatus / custom
 * - custom 中的 PREVENT_DAMAGE 会即时折算到当前伤害，并标记 applyImmediately
 */
function applyOnDamageReceivedTriggers(
    ctx: EffectContext,
    targetId: PlayerId,
    baseDamage: number,
    options: { timestamp: number; random?: RandomFn; sfxKey?: string }
): { damage: number; events: DiceThroneEvent[] } {
    const events: DiceThroneEvent[] = [];
    const { state } = ctx;
    const target = state.players[targetId];
    if (!target) {
        return { damage: baseDamage, events };
    }

    const tokenDefinitions = state.tokenDefinitions ?? [];
    let nextDamage = baseDamage;

    for (const def of tokenDefinitions) {
        if (def.passiveTrigger?.timing !== 'onDamageReceived') {
            continue;
        }

        const stacks = def.category === 'debuff'
            ? (target.statusEffects[def.id] ?? 0)
            : (target.tokens[def.id] ?? 0);

        if (stacks <= 0) {
            continue;
        }

        const actions = def.passiveTrigger.actions ?? [];
        for (const action of actions) {
            switch (action.type) {
                case 'modifyStat': {
                    const delta = action.value ?? 0;
                    if (delta !== 0) {
                        nextDamage += delta * stacks;
                    }
                    break;
                }
                case 'removeStatus': {
                    if (!action.statusId) break;
                    const currentStacks = target.statusEffects[action.statusId] ?? 0;
                    if (currentStacks <= 0) break;
                    const removeStacks = Math.min(currentStacks, action.value ?? currentStacks);
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId, statusId: action.statusId, stacks: removeStacks },
                        sourceCommandType: 'ABILITY_EFFECT',
                        timestamp: options.timestamp,
                        sfxKey: options.sfxKey,
                    } as StatusRemovedEvent);
                    break;
                }
                case 'custom': {
                    const actionId = action.customActionId;
                    if (!actionId) break;
                    const handler = getCustomActionHandler(actionId);
                    if (!handler) {
                        console.warn(`[DiceThrone] 未注册的 customAction: ${actionId}`);
                        break;
                    }
                    const actionWithParams: EffectAction = {
                        ...action,
                        params: {
                            ...(action as any).params,
                            damageAmount: nextDamage,
                            tokenId: def.id,
                            tokenStacks: stacks,
                        },
                    };
                    const handlerCtx: CustomActionContext = {
                        ctx,
                        targetId,
                        attackerId: ctx.attackerId,
                        sourceAbilityId: ctx.sourceAbilityId,
                        state,
                        timestamp: options.timestamp,
                        random: options.random,
                        action: actionWithParams,
                    };
                    const handledEvents = handler(handlerCtx);
                    if (options.sfxKey) {
                        handledEvents.forEach(handledEvent => {
                            if (!handledEvent.sfxKey) {
                                handledEvent.sfxKey = options.sfxKey;
                            }
                        });
                    }
                    handledEvents.forEach(handledEvent => {
                        if (handledEvent.type === 'PREVENT_DAMAGE') {
                            const payload = (handledEvent as PreventDamageEvent).payload;
                            const preventAmount = payload.amount ?? 0;
                            if (preventAmount > 0) {
                                nextDamage = Math.max(0, nextDamage - preventAmount);
                            }
                            payload.applyImmediately = true;
                        }
                    });
                    events.push(...handledEvents);
                    break;
                }
                default:
                    break;
            }
        }
    }

    return { damage: Math.max(0, nextDamage), events };
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
    const timestamp = Date.now();
    const { attackerId, defenderId, sourceAbilityId, state } = ctx;
    const targetId = action.target === 'self' ? attackerId : defenderId;

    switch (action.type) {
        case 'damage': {
            let totalValue = (action.value ?? 0) + (bonusDamage ?? 0);

            if (totalValue > 0) {
                const passiveResult = applyOnDamageReceivedTriggers(ctx, targetId, totalValue, {
                    timestamp,
                    random,
                    sfxKey,
                });
                totalValue = passiveResult.damage;
                events.push(...passiveResult.events);
            }

            if (totalValue <= 0) break;

            // 检查是否需要打开 Token 响应窗口
            const tokenResponseType = shouldOpenTokenResponse(
                state,
                attackerId,
                targetId,
                totalValue
            );

            if (tokenResponseType) {
                // 创建待处理伤害，暂停伤害结算
                const responseType = tokenResponseType === 'attackerBoost'
                    ? 'beforeDamageDealt'
                    : 'beforeDamageReceived';
                const pendingDamage = createPendingDamage(
                    attackerId,
                    targetId,
                    totalValue,
                    responseType,
                    sourceAbilityId
                );
                const tokenResponseEvent = createTokenResponseRequestedEvent(pendingDamage);
                events.push(tokenResponseEvent);
                // 不在这里生成 DAMAGE_DEALT，等待 Token 响应完成后再生成
                break;
            }

            // 没有可用 Token，直接生成伤害事件
            const target = state.players[targetId];
            const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
            const actualDamage = target ? Math.min(totalValue, targetHp) : 0;

            const event: DamageDealtEvent = {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId,
                    amount: totalValue,
                    actualDamage,
                    sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
                sfxKey,
            };
            events.push(event);
            ctx.damageDealt += actualDamage;
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
            if (!random || !action.conditionalEffects) break;
            const diceCount = action.diceCount ?? 1;
            if (sourceAbilityId === 'taiji-combo') {
                const abilityLevel = state.players[attackerId]?.abilityLevels?.['taiji-combo'] ?? 'unknown';
                console.log(
                    `[DiceThrone][rollDie] abilityId=taiji-combo level=${abilityLevel} diceCount=${diceCount}`
                );
            }

            for (let i = 0; i < diceCount; i++) {
                const value = random.d(6);
                const face = getDieFace(value);

                // 查找匹配的条件效果
                const matchedEffect = action.conditionalEffects.find(e => e.face === face);

                // 生成 BONUS_DIE_ROLLED 事件（总是提供 effectKey）
                const bonusDieEvent: BonusDieRolledEvent = {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        value,
                        face,
                        playerId: targetId,
                        targetPlayerId: targetId,
                        // 骰面效果描述：使用通用的 bonusDie.effect.{face} key
                        effectKey: `bonusDie.effect.${face}`,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                    sfxKey,
                };
                events.push(bonusDieEvent);

                // 触发匹配的条件效果
                if (matchedEffect) {
                    events.push(...resolveConditionalEffect(matchedEffect, ctx, targetId, sourceAbilityId, timestamp, sfxKey));
                }
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
            events.push(...buildDrawEvents(state, targetId, count, random, 'ABILITY_EFFECT', timestamp));
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
    sfxKey?: string
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const { state } = ctx;

    // 处理 bonusDamage
    if (effect.bonusDamage) {
        ctx.accumulatedBonusDamage = (ctx.accumulatedBonusDamage ?? 0) + effect.bonusDamage;
    }

    // 处理 grantStatus
    if (effect.grantStatus) {
        const { statusId, value } = effect.grantStatus;
        const target = state.players[targetId];
        const currentStacks = target?.statusEffects[statusId] ?? 0;
        const def = state.tokenDefinitions.find(e => e.id === statusId);
        const maxStacks = def?.stackLimit || 99;
        const newTotal = Math.min(currentStacks + value, maxStacks);

        const event: StatusAppliedEvent = {
            type: 'STATUS_APPLIED',
            payload: {
                targetId,
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
        const { tokenId, value } = effect.grantToken;
        const target = state.players[targetId];
        const currentAmount = target?.tokens[tokenId] ?? 0;
        const maxStacks = getTokenStackLimit(state, targetId, tokenId);
        const newTotal = Math.min(currentAmount + value, maxStacks);

        const tokenEvent: TokenGrantedEvent = {
            type: 'TOKEN_GRANTED',
            payload: {
                targetId,
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

    if (typeof effect.heal === 'number' && effect.heal > 0) {
        const event: HealAppliedEvent = {
            type: 'HEAL_APPLIED',
            payload: {
                targetId,
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
        const currentCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newValue = Math.max(0, Math.min(currentCp + effect.cp, CP_MAX));
        const event: CpChangedEvent = {
            type: 'CP_CHANGED',
            payload: {
                playerId: targetId,
                delta: effect.cp,
                newValue,
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

    return events;
}

/**
 * 解析指定时切的所有效果，生成事件
 */
export function resolveEffectsToEvents(
    effects: AbilityEffect[],
    timing: EffectTiming,
    ctx: EffectContext,
    config?: { bonusDamage?: number; bonusDamageOnce?: boolean; random?: RandomFn }
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

    const timedEffects = combatAbilityManager.getEffectsByTiming(effects, timing);

    for (const effect of timedEffects) {
        if (!effect.action) {
            continue;
        }
        if (!combatAbilityManager.checkEffectCondition(effect, resolutionCtx)) {
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

        // 如果产生伤害且只允许一次加成
        if (effectEvents.some(e => e.type === 'DAMAGE_DEALT') && config?.bonusDamageOnce) {
            bonusApplied = true;
            // 伤害已应用，清空累加的额外伤害
            ctx.accumulatedBonusDamage = 0;
        }

        // 更新 resolutionCtx.damageDealt 用于后续条件检查
        resolutionCtx.damageDealt = ctx.damageDealt;
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
