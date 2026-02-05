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
import { STATUS_IDS, TOKEN_IDS, DICE_FACE_IDS } from './ids';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    DamageDealtEvent,
    HealAppliedEvent,
    StatusAppliedEvent,
    StatusRemovedEvent,
    TokenGrantedEvent,
    TokenLimitChangedEvent,
    ChoiceRequestedEvent,
    BonusDieRolledEvent,
    AbilityReplacedEvent,
    DamageShieldGrantedEvent,
    InteractionRequestedEvent,
    RollLimitChangedEvent,
    PendingInteraction,
} from './types';
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
            const totalValue = (action.value ?? 0) + (bonusDamage ?? 0);
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

            const shieldEvent: DamageShieldGrantedEvent = {
                type: 'DAMAGE_SHIELD_GRANTED',
                payload: {
                    targetId,
                    value: shieldValue,
                    sourceId: sourceAbilityId,
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
// Custom Action 处理器实现
// ============================================================================

/** 冥想：根据太极骰面数量获得太极 Token */
function handleMeditationTaiji({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const amountToAdd = faceCounts[DICE_FACE_IDS.TAIJI];
    const target = state.players[targetId];
    const currentAmount = target?.tokens[TOKEN_IDS.TAIJI] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
    const newTotal = Math.min(currentAmount + amountToAdd, maxStacks);
    return [{
        type: 'TOKEN_GRANTED',
        payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: amountToAdd, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent];
}

/** 清修 III：获得太极，若太极≥2则选择闪避或净化 */
function handleMeditation3Taiji({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const amountToAdd = faceCounts[DICE_FACE_IDS.TAIJI];
    const target = state.players[targetId];
    const currentAmount = target?.tokens[TOKEN_IDS.TAIJI] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
    const newTotal = Math.min(currentAmount + amountToAdd, maxStacks);
    const events: DiceThroneEvent[] = [{
        type: 'TOKEN_GRANTED',
        payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: amountToAdd, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent];

    if (faceCounts[DICE_FACE_IDS.TAIJI] >= 2) {
        events.push({
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: targetId,
                sourceAbilityId,
                titleKey: 'choices.evasiveOrPurifyToken',
                options: [
                    { tokenId: TOKEN_IDS.EVASIVE, value: 1 },
                    { tokenId: TOKEN_IDS.PURIFY, value: 1 },
                ],
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as ChoiceRequestedEvent);
    }

    return events;
}

/** 冥想：根据拳骰面数量造成伤害 */
function handleMeditationDamage({ ctx, targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const amount = faceCounts[DICE_FACE_IDS.FIST];
    const target = state.players[targetId];
    const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
    const actualDamage = target ? Math.min(amount, targetHp) : 0;
    ctx.damageDealt += actualDamage;
    return [{
        type: 'DAMAGE_DEALT',
        payload: { targetId, amount, actualDamage, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent];
}

/** 一掷千金：投掷1骰子，获得½数值的CP（向上取整） */
function handleOneThrowFortuneCp({ targetId, sourceAbilityId: _sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dieValue = random.d(6);
    const face = getDieFace(dieValue);
    const cpGain = Math.ceil(dieValue / 2);
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: targetId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.gainCp', effectParams: { cp: cpGain } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    events.push({
        type: 'CP_CHANGED',
        payload: { playerId: targetId, delta: cpGain, newValue: (state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0) + cpGain },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    });
    return events;
}

/** 顿悟：投掷1骰，莲花→获得2气+闪避+净化；否则抽1牌 */
function handleEnlightenmentRoll({ targetId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dieValue = random.d(6);
    const face = getDieFace(dieValue);
    const isLotus = face === DICE_FACE_IDS.LOTUS;
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: targetId, targetPlayerId: targetId, effectKey: isLotus ? 'bonusDie.effect.enlightenmentLotus' : 'bonusDie.effect.enlightenmentOther' },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);
    if (isLotus) {
        const target = state.players[targetId];
        const taijiMax = getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
        const taijiCurrent = target?.tokens[TOKEN_IDS.TAIJI] ?? 0;
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: 2, newTotal: Math.min(taijiCurrent + 2, taijiMax), sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
        const evasiveMax = getTokenStackLimit(state, targetId, TOKEN_IDS.EVASIVE);
        const evasiveCurrent = target?.tokens[TOKEN_IDS.EVASIVE] ?? 0;
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: TOKEN_IDS.EVASIVE, amount: 1, newTotal: Math.min(evasiveCurrent + 1, evasiveMax), sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
        const purifyMax = getTokenStackLimit(state, targetId, TOKEN_IDS.PURIFY);
        const purifyCurrent = target?.tokens[TOKEN_IDS.PURIFY] ?? 0;
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: TOKEN_IDS.PURIFY, amount: 1, newTotal: Math.min(purifyCurrent + 1, purifyMax), sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
    } else {
        events.push(...buildDrawEvents(state, targetId, 1, random, 'ABILITY_EFFECT', timestamp));
    }
    return events;
}

/** 莲花掌：可花费2太极令此次攻击不可防御 */
function handleLotusPalmUnblockableChoice({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const taijiCount = state.players[targetId]?.tokens?.[TOKEN_IDS.TAIJI] ?? 0;
    if (taijiCount < 2) return [];
    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: targetId,
            sourceAbilityId,
            titleKey: 'choices.lotusPalmUnblockable.title',
            options: [
                { tokenId: TOKEN_IDS.TAIJI, value: -2, customId: 'lotus-palm-unblockable-pay', labelKey: 'choices.lotusPalmUnblockable.pay2' },
                { value: 0, customId: 'lotus-palm-unblockable-skip', labelKey: 'choices.lotusPalmUnblockable.skip' },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

/** 莲花掌：太极上限+1，并立即补满太极 */
function handleLotusPalmTaijiCapUpAndFill({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[targetId];
    if (!player) return [];
    const currentLimitRaw = player.tokenStackLimits?.[TOKEN_IDS.TAIJI];
    const currentLimit = typeof currentLimitRaw === 'number' ? (currentLimitRaw === 0 ? Infinity : currentLimitRaw) : getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
    if (currentLimit === Infinity) return [];
    const events: DiceThroneEvent[] = [];
    const newLimit = currentLimit + 1;
    events.push({ type: 'TOKEN_LIMIT_CHANGED', payload: { playerId: targetId, tokenId: TOKEN_IDS.TAIJI, delta: 1, newLimit, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenLimitChangedEvent);
    const currentAmount = player.tokens?.[TOKEN_IDS.TAIJI] ?? 0;
    const newTotal = Math.min(newLimit, Math.max(0, newLimit));
    const amountToAdd = Math.max(0, newTotal - currentAmount);
    if (amountToAdd > 0) {
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: amountToAdd, newTotal, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
    }
    return events;
}

type ThunderStrikeBonusConfig = {
    diceCount: number;
    rerollCostTokenId: string;
    rerollCostAmount: number;
    maxRerollCount?: number;
    dieEffectKey: string;
    rerollEffectKey: string;
    threshold?: number;
    thresholdEffect?: 'knockdown';
};

const createThunderStrikeRollDamageEvents = (
    { targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext,
    config: ThunderStrikeBonusConfig
): DiceThroneEvent[] => {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: import('./types').BonusDieInfo[] = [];

    // 投掷奖励骰
    for (let i = 0; i < config.diceCount; i++) {
        const value = random.d(6);
        const face = getDieFace(value);
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
        const settlement: import('./types').PendingBonusDiceSettlement = {
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
        } as import('./types').BonusDiceRerollRequestedEvent);
    } else {
        const totalDamage = dice.reduce((sum, d) => sum + d.value, 0);
        const target = state.players[targetId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = target ? Math.min(totalDamage, targetHp) : 0;
        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId, amount: totalDamage, actualDamage, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
        if (config.threshold !== undefined && totalDamage >= config.threshold && config.thresholdEffect === 'knockdown') {
            const currentStacks = target?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
            const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.KNOCKDOWN);
            const maxStacks = def?.stackLimit || 99;
            const newTotal = Math.min(currentStacks + 1, maxStacks);
            events.push({
                type: 'STATUS_APPLIED',
                payload: { targetId, statusId: STATUS_IDS.KNOCKDOWN, stacks: 1, newTotal, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as StatusAppliedEvent);
        }
    }

    return events;
};

/**
 * 雷霆万钧: 投掷3骰，造成总和伤害，可花费2太极重掷其中1颗
 */
function handleThunderStrikeRollDamage(context: CustomActionContext): DiceThroneEvent[] {
    return createThunderStrikeRollDamageEvents(context, {
        diceCount: 3,
        rerollCostTokenId: TOKEN_IDS.TAIJI,
        rerollCostAmount: 2,
        maxRerollCount: 1,
        dieEffectKey: 'bonusDie.effect.thunderStrikeDie',
        rerollEffectKey: 'bonusDie.effect.thunderStrikeReroll',
    });
}

/**
 * 雷霆一击 II / 风暴突袭 II: 投掷3骰，造成总和伤害，>=12施加倒地
 * 实现延后结算：投掷完成后存储到 pendingBonusDiceSettlement，等待重掷交互完成后再结算伤害
 */
function handleThunderStrike2RollDamage(context: CustomActionContext): DiceThroneEvent[] {
    return createThunderStrikeRollDamageEvents(context, {
        diceCount: 3,
        rerollCostTokenId: TOKEN_IDS.TAIJI,
        rerollCostAmount: 1,
        dieEffectKey: 'bonusDie.effect.thunderStrike2Die',
        rerollEffectKey: 'bonusDie.effect.thunderStrike2Reroll',
        threshold: 12,
        thresholdEffect: 'knockdown',
    });
}

/** 获得2CP */
function handleGrantCp2({ targetId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [{
        type: 'CP_CHANGED',
        payload: { playerId: targetId, delta: 2, newValue: (state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0) + 2 },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    }];
}

/** 额外投掷次数 */
function handleGrantExtraRoll({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const newLimit = state.rollLimit + 1;
    return [{
        type: 'ROLL_LIMIT_CHANGED',
        payload: { playerId: targetId, delta: 1, newLimit, sourceCardId: sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as RollLimitChangedEvent];
}

/** 将1颗骰子改至6 */
function handleModifyDieTo6({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToModify',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'set', targetValue: 6 },
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 将1颗骰子改为另1颗的值 */
function handleModifyDieCopy({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToCopy',
        selectCount: 2,
        selected: [],
        dieModifyConfig: { mode: 'copy' },
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 改变任意1颗骰子的数值 */
function handleModifyDieAny1({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToChange',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'any' },
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 改变任意2颗骰子的数值 */
function handleModifyDieAny2({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDiceToChange',
        selectCount: 2,
        selected: [],
        dieModifyConfig: { mode: 'any' },
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 增/减1颗骰子数值1点 */
function handleModifyDieAdjust1({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToAdjust',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'adjust', adjustRange: { min: -1, max: 1 } },
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 强制对手重掷1颗骰子 */
function handleRerollOpponentDie1({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectOpponentDieToReroll',
        selectCount: 1,
        selected: [],
        targetOpponentDice: true,
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 重掷至多2颗骰子 */
function handleRerollDie2({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectDiceToReroll',
        selectCount: 2,
        selected: [],
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 重掷至多5颗骰子（我又行了！/ 就这？） */
function handleRerollDie5({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectDiceToReroll',
        selectCount: 5,
        selected: [],
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 移除1名玩家1个状态效果 */
function handleRemoveStatus1({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectStatus',
        titleKey: 'interaction.selectStatusToRemove',
        selectCount: 1,
        selected: [],
        targetPlayerIds: Object.keys(state.players),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 移除1名玩家所有状态效果 */
function handleRemoveAllStatus({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey: 'interaction.selectPlayerToRemoveAllStatus',
        selectCount: 1,
        selected: [],
        targetPlayerIds: Object.keys(state.players),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 转移1个状态效果到另一玩家 */
function handleTransferStatus({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectStatus',
        titleKey: 'interaction.selectStatusToTransfer',
        selectCount: 1,
        selected: [],
        targetPlayerIds: Object.keys(state.players),
        transferConfig: {},
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

// ============================================================================
// 注册所有 Custom Action 处理器
// 每个处理器都必须提供元数据（categories 必填）
// ============================================================================

// --- 防御技能相关 ---
registerCustomActionHandler('meditation-taiji', handleMeditationTaiji, {
    categories: ['resource'],
});
registerCustomActionHandler('meditation-damage', handleMeditationDamage, {
    categories: ['other'],
});
registerCustomActionHandler('meditation-2-taiji', handleMeditationTaiji, {
    categories: ['resource'],
});
registerCustomActionHandler('meditation-2-damage', handleMeditationDamage, {
    categories: ['other'],
});
registerCustomActionHandler('meditation-3-taiji', handleMeditation3Taiji, {
    categories: ['resource', 'choice'],
});
registerCustomActionHandler('meditation-3-damage', handleMeditationDamage, {
    categories: ['other'],
});

// --- 技能效果相关 ---
registerCustomActionHandler('one-throw-fortune-cp', handleOneThrowFortuneCp, {
    categories: ['resource', 'dice'],
});
registerCustomActionHandler('enlightenment-roll', handleEnlightenmentRoll, {
    categories: ['resource', 'dice'],
});
registerCustomActionHandler('lotus-palm-unblockable-choice', handleLotusPalmUnblockableChoice, {
    categories: ['choice'],
});
registerCustomActionHandler('lotus-palm-taiji-cap-up-and-fill', handleLotusPalmTaijiCapUpAndFill, {
    categories: ['resource'],
});
registerCustomActionHandler('thunder-strike-roll-damage', handleThunderStrikeRollDamage, {
    categories: ['dice', 'other'],
});
registerCustomActionHandler('thunder-strike-2-roll-damage', handleThunderStrike2RollDamage, {
    categories: ['dice', 'other'],
});

// --- 资源相关 ---
registerCustomActionHandler('grant-cp-2', handleGrantCp2, {
    categories: ['resource'],
});

// --- 骰子相关：增加投掷次数 ---
registerCustomActionHandler('grant-extra-roll-defense', handleGrantExtraRoll, {
    categories: ['dice'],
    phases: ['defensiveRoll'],
});
registerCustomActionHandler('grant-extra-roll-offense', handleGrantExtraRoll, {
    categories: ['dice'],
    phases: ['offensiveRoll'],
});

// --- 骰子相关：修改骰子数值 ---
registerCustomActionHandler('modify-die-to-6', handleModifyDieTo6, {
    categories: ['dice'],
    requiresInteraction: true,
});
registerCustomActionHandler('modify-die-copy', handleModifyDieCopy, {
    categories: ['dice'],
    requiresInteraction: true,
});
registerCustomActionHandler('modify-die-any-1', handleModifyDieAny1, {
    categories: ['dice'],
    requiresInteraction: true,
});
registerCustomActionHandler('modify-die-any-2', handleModifyDieAny2, {
    categories: ['dice'],
    requiresInteraction: true,
});
registerCustomActionHandler('modify-die-adjust-1', handleModifyDieAdjust1, {
    categories: ['dice'],
    requiresInteraction: true,
});

// --- 骰子相关：重掷骰子 ---
registerCustomActionHandler('reroll-opponent-die-1', handleRerollOpponentDie1, {
    categories: ['dice'],
    requiresInteraction: true,
});
registerCustomActionHandler('reroll-die-2', handleRerollDie2, {
    categories: ['dice'],
    requiresInteraction: true,
});
registerCustomActionHandler('reroll-die-5', handleRerollDie5, {
    categories: ['dice'],
    requiresInteraction: true,
});

// --- 状态效果相关 ---
registerCustomActionHandler('remove-status-1', handleRemoveStatus1, {
    categories: ['status'],
    requiresInteraction: true,
});
registerCustomActionHandler('remove-all-status', handleRemoveAllStatus, {
    categories: ['status'],
    requiresInteraction: true,
});
registerCustomActionHandler('transfer-status', handleTransferStatus, {
    categories: ['status'],
    requiresInteraction: true,
});

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
 * 解析指定时机的所有效果，生成事件
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
// 野蛮人 (Barbarian) Custom Action 处理器
// ============================================================================

// 注意：野蛮人骰子映射为 1-3=sword, 4-5=heart, 6=strength（见 diceConfig.ts）

/**
 * 压制 (Suppress)：投掷3骰，按剑骰面数造成伤害
 */
function handleBarbarianSuppressRoll({ ctx, targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    // 投掷3个骰子
    let swordCount = 0;
    for (let i = 0; i < 3; i++) {
        const value = random.d(6);
        const face = getDieFace(value);
        // 野蛮人骰子：1-3 = sword
        if (value <= 3) {
            swordCount++;
        }
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.barbarianSuppress',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    // 造成剑骰面数量的伤害
    if (swordCount > 0) {
        const target = state.players[targetId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = target ? Math.min(swordCount, targetHp) : 0;
        ctx.damageDealt += actualDamage;
        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId, amount: swordCount, actualDamage, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
    }

    return events;
}

/**
 * 压制 II (Suppress II)：投掷3骰，按剑骰面数造成伤害（与基础版相同）
 */
function handleBarbarianSuppress2Roll(context: CustomActionContext): DiceThroneEvent[] {
    // 压制 II 的力量变体与基础版机制相同
    return handleBarbarianSuppressRoll(context);
}

/**
 * 厚皮 (Thick Skin)：根据心骰面数治疗
 * 防御阶段投掷骰子后，每个心骰面治疗1点
 */
function handleBarbarianThickSkin({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    // 统计心骰面数量（野蛮人骰子：4-5 = heart）
    const activeDice = getActiveDice(state);
    let heartCount = 0;
    for (const die of activeDice) {
        if (die.value === 4 || die.value === 5) {
            heartCount++;
        }
    }

    if (heartCount > 0) {
        events.push({
            type: 'HEAL_APPLIED',
            payload: { targetId, amount: heartCount, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as HealAppliedEvent);
    }

    return events;
}

/**
 * 厚皮 II (Thick Skin II)：根据心骰面数治疗 + 防止1个状态效果
 * 防御阶段投掷骰子后，每个心骰面治疗1点，并防止1个即将受到的状态效果
 */
function handleBarbarianThickSkin2({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    // 统计心骰面数量
    const activeDice = getActiveDice(state);
    let heartCount = 0;
    for (const die of activeDice) {
        if (die.value === 4 || die.value === 5) {
            heartCount++;
        }
    }

    if (heartCount > 0) {
        events.push({
            type: 'HEAL_APPLIED',
            payload: { targetId, amount: heartCount, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as HealAppliedEvent);
    }

    // 授予伤害护盾（用于防止状态效果）
    // 注意：这里使用 grantDamageShield 的变体来实现"防止状态效果"
    // 实际实现中可能需要专用的 statusShield 机制，这里暂用护盾模拟
    events.push({
        type: 'DAMAGE_SHIELD_GRANTED',
        payload: { targetId, value: 1, sourceId: sourceAbilityId, preventStatus: true },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageShieldGrantedEvent);

    return events;
}

/**
 * 精力充沛！(Energetic)：投掷1骰
 * - 星(6) → 治疗2 + 对对手施加脑震荡
 * - 其他 → 抽1牌
 */
function handleEnergeticRoll({ targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const dieValue = random.d(6);
    const face = getDieFace(dieValue);
    const isStrength = dieValue === 6; // 野蛮人骰子：6 = strength (星)

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value: dieValue,
            face,
            playerId: attackerId,
            targetPlayerId: targetId,
            effectKey: isStrength ? 'bonusDie.effect.energeticStrength' : 'bonusDie.effect.energeticOther',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (isStrength) {
        // 治疗2点
        events.push({
            type: 'HEAL_APPLIED',
            payload: { targetId: attackerId, amount: 2, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as HealAppliedEvent);

        // 对对手施加脑震荡
        const opponentId = attackerId === '0' ? '1' : '0';
        const opponent = state.players[opponentId];
        const currentStacks = opponent?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
        const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.CONCUSSION);
        const maxStacks = def?.stackLimit || 1;
        const newTotal = Math.min(currentStacks + 1, maxStacks);

        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: STATUS_IDS.CONCUSSION, stacks: 1, newTotal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusAppliedEvent);
    } else {
        // 抽1牌
        events.push(...buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp));
    }

    return events;
}

/**
 * 大吉大利！(Lucky)：投掷3骰，治疗 1 + 2×心骰面数
 */
function handleLuckyRollHeal({ attackerId, sourceAbilityId, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    let heartCount = 0;
    for (let i = 0; i < 3; i++) {
        const value = random.d(6);
        const face = getDieFace(value);
        // 野蛮人骰子：4-5 = heart
        if (value === 4 || value === 5) {
            heartCount++;
        }
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: attackerId,
                effectKey: 'bonusDie.effect.luckyRoll',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    // 治疗 1 + 2×心骰面数
    const healAmount = 1 + 2 * heartCount;
    events.push({
        type: 'HEAL_APPLIED',
        payload: { targetId: attackerId, amount: healAmount, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as HealAppliedEvent);

    return events;
}

/**
 * 再来点儿！(More Please)：投掷5骰
 * - 增加 1×剑骰面数 伤害到当前攻击
 * - 施加脑震荡
 */
function handleMorePleaseRollDamage({ ctx, targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    let swordCount = 0;
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getDieFace(value);
        // 野蛮人骰子：1-3 = sword
        if (value <= 3) {
            swordCount++;
        }
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.morePleaseRoll',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    // 增加伤害到当前攻击（累加到上下文）
    if (swordCount > 0) {
        ctx.accumulatedBonusDamage = (ctx.accumulatedBonusDamage ?? 0) + swordCount;
    }

    // 对对手施加脑震荡
    const opponentId = attackerId === '0' ? '1' : '0';
    const opponent = state.players[opponentId];
    const currentStacks = opponent?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
    const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.CONCUSSION);
    const maxStacks = def?.stackLimit || 1;
    const newTotal = Math.min(currentStacks + 1, maxStacks);

    events.push({
        type: 'STATUS_APPLIED',
        payload: { targetId: opponentId, statusId: STATUS_IDS.CONCUSSION, stacks: 1, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent);

    return events;
}

// --- 野蛮人 Custom Action 注册 ---
registerCustomActionHandler('barbarian-suppress-roll', handleBarbarianSuppressRoll, {
    categories: ['dice', 'other'],
});
registerCustomActionHandler('barbarian-suppress-2-roll', handleBarbarianSuppress2Roll, {
    categories: ['dice', 'other'],
});
registerCustomActionHandler('barbarian-thick-skin', handleBarbarianThickSkin, {
    categories: ['other'],
});
registerCustomActionHandler('barbarian-thick-skin-2', handleBarbarianThickSkin2, {
    categories: ['other'],
});
registerCustomActionHandler('energetic-roll', handleEnergeticRoll, {
    categories: ['dice', 'resource'],
});
registerCustomActionHandler('lucky-roll-heal', handleLuckyRollHeal, {
    categories: ['dice', 'resource'],
});
registerCustomActionHandler('more-please-roll-damage', handleMorePleaseRollDamage, {
    categories: ['dice', 'other'],
});
