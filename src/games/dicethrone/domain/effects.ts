/**
 * DiceThrone 效果解析器
 * 将 AbilityEffect 转换为 DiceThroneEvent（事件驱动）
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type { EffectAction, RollDieConditionalEffect } from '../../../systems/StatusEffectSystem';
import type { AbilityEffect, EffectTiming, EffectResolutionContext } from '../../../systems/AbilitySystem';
import { abilityManager } from '../../../systems/AbilitySystem';
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
import type { AbilityDef } from '../../../systems/AbilitySystem';

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
    random?: RandomFn
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
            };
            events.push(event);
            break;
        }

        case 'grantStatus': {
            if (!action.statusId) break;
            const target = state.players[targetId];
            const currentStacks = target?.statusEffects[action.statusId] ?? 0;
            const def = state.statusDefinitions.find(e => e.id === action.statusId);
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
            };
            events.push(choiceEvent);
            break;
        }

        case 'rollDie': {
            // 投掷骰子效果：投掷并根据结果触发条件效果
            if (!random || !action.conditionalEffects) break;
            const diceCount = action.diceCount ?? 1;
            
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
};
                events.push(bonusDieEvent);
                
                // 触发匹配的条件效果
                if (matchedEffect) {
                    events.push(...resolveConditionalEffect(matchedEffect, ctx, targetId, sourceAbilityId, timestamp));
                }
            }
            break;
        }

        case 'custom': {
            const actionId = action.customActionId;
            console.log('[DiceThrone][resolveEffectAction] 处理 custom action', { customActionId: actionId });
            if (!actionId) {
                console.log('[DiceThrone][resolveEffectAction] customActionId 为空，跳过');
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
                events.push(...handler(handlerCtx));
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
    const amountToAdd = faceCounts.taiji;
    const target = state.players[targetId];
    const currentAmount = target?.tokens.taiji ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, 'taiji');
    const newTotal = Math.min(currentAmount + amountToAdd, maxStacks);
    return [{
        type: 'TOKEN_GRANTED',
        payload: { targetId, tokenId: 'taiji', amount: amountToAdd, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent];
}

/** 冥想：根据拳骰面数量造成伤害 */
function handleMeditationDamage({ ctx, targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const amount = faceCounts.fist;
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
    const isLotus = face === 'lotus';
events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: targetId, targetPlayerId: targetId, effectKey: isLotus ? 'bonusDie.effect.enlightenmentLotus' : 'bonusDie.effect.enlightenmentOther' },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);
    if (isLotus) {
        const target = state.players[targetId];
        const taijiMax = getTokenStackLimit(state, targetId, 'taiji');
        const taijiCurrent = target?.tokens.taiji ?? 0;
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: 'taiji', amount: 2, newTotal: Math.min(taijiCurrent + 2, taijiMax), sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
        const evasiveMax = getTokenStackLimit(state, targetId, 'evasive');
        const evasiveCurrent = target?.tokens.evasive ?? 0;
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: 'evasive', amount: 1, newTotal: Math.min(evasiveCurrent + 1, evasiveMax), sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
        const purifyMax = getTokenStackLimit(state, targetId, 'purify');
        const purifyCurrent = target?.tokens.purify ?? 0;
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: 'purify', amount: 1, newTotal: Math.min(purifyCurrent + 1, purifyMax), sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
    } else {
        events.push(...buildDrawEvents(state, targetId, 1, random, 'ABILITY_EFFECT', timestamp));
    }
    return events;
}

/** 莲花掌：可花费2太极令此次攻击不可防御 */
function handleLotusPalmUnblockableChoice({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const taijiCount = state.players[targetId]?.tokens?.taiji ?? 0;
    if (taijiCount < 2) return [];
    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: targetId,
            sourceAbilityId,
            titleKey: 'choices.lotusPalmUnblockable.title',
            options: [
                { tokenId: 'taiji', value: -2, customId: 'lotus-palm-unblockable-pay', labelKey: 'choices.lotusPalmUnblockable.pay2' },
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
    const currentLimitRaw = player.tokenStackLimits?.taiji;
    const currentLimit = typeof currentLimitRaw === 'number' ? (currentLimitRaw === 0 ? Infinity : currentLimitRaw) : getTokenStackLimit(state, targetId, 'taiji');
    if (currentLimit === Infinity) return [];
    const events: DiceThroneEvent[] = [];
    const newLimit = currentLimit + 1;
    events.push({ type: 'TOKEN_LIMIT_CHANGED', payload: { playerId: targetId, tokenId: 'taiji', delta: 1, newLimit, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenLimitChangedEvent);
    const currentAmount = player.tokens?.taiji ?? 0;
    const newTotal = Math.min(newLimit, Math.max(0, newLimit));
    const amountToAdd = Math.max(0, newTotal - currentAmount);
    if (amountToAdd > 0) {
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: 'taiji', amount: amountToAdd, newTotal, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
    }
    return events;
}

/** 雷霆一击 II: 投掷3骰，造成总和伤害，>=12施加倒地 */
function handleThunderStrike2RollDamage({ ctx, targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dieValues: number[] = [];
    for (let i = 0; i < 3; i++) {
        const value = random.d(6);
        dieValues.push(value);
        const face = getDieFace(value);
events.push({ type: 'BONUS_DIE_ROLLED', payload: { value, face, playerId: attackerId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.thunderStrike2Die', effectParams: { value } }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as BonusDieRolledEvent);
    }
    const totalDamage = dieValues.reduce((sum, v) => sum + v, 0);
    const target = state.players[targetId];
    const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
    const actualDamage = target ? Math.min(totalDamage, targetHp) : 0;
    events.push({ type: 'DAMAGE_DEALT', payload: { targetId, amount: totalDamage, actualDamage, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as DamageDealtEvent);
    ctx.damageDealt += actualDamage;
    if (totalDamage >= 12) {
        const currentStacks = target?.statusEffects['stun'] ?? 0;
        const def = state.statusDefinitions.find(e => e.id === 'stun');
        const maxStacks = def?.stackLimit || 99;
        const newTotal = Math.min(currentStacks + 1, maxStacks);
        events.push({ type: 'STATUS_APPLIED', payload: { targetId, statusId: 'stun', stacks: 1, newTotal, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as StatusAppliedEvent);
    }
    return events;
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
    console.log('[DiceThrone][handleGrantExtraRoll] 增加投掷次数', {
        targetId,
        sourceAbilityId,
        currentRollLimit: state.rollLimit,
        newLimit,
    });
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
    console.log('[DiceThrone][handleModifyDieCopy] 处理 modify-die-copy', { attackerId, sourceAbilityId });
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
    const event = { type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent;
    console.log('[DiceThrone][handleModifyDieCopy] 生成 INTERACTION_REQUESTED 事件', event.payload);
    return [event];
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
    timestamp: number
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
        const def = state.statusDefinitions.find(e => e.id === statusId);
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

    console.log('[DiceThrone][resolveEffectsToEvents] 开始解析效果:', JSON.stringify({
        sourceAbilityId: ctx.sourceAbilityId,
        timing,
        effectsCount: effects.length,
        effects: effects.map(e => ({ description: e.description, timing: e.timing, actionType: e.action?.type, customActionId: e.action?.customActionId })),
    }));

    // 构建 EffectResolutionContext 用于条件检查
    const resolutionCtx: EffectResolutionContext = {
        attackerId: ctx.attackerId,
        defenderId: ctx.defenderId,
        sourceAbilityId: ctx.sourceAbilityId,
        damageDealt: ctx.damageDealt,
        attackerStatusEffects: ctx.state.players[ctx.attackerId]?.statusEffects,
        defenderStatusEffects: ctx.state.players[ctx.defenderId]?.statusEffects,
    };

    const timedEffects = abilityManager.getEffectsByTiming(effects, timing);
    console.log('[DiceThrone][resolveEffectsToEvents] 过滤后的时机效果:', JSON.stringify({
        timedEffectsCount: timedEffects.length,
        timedEffects: timedEffects.map(e => ({ description: e.description, actionType: e.action?.type, customActionId: e.action?.customActionId })),
    }));

    for (const effect of timedEffects) {
        if (!effect.action) {
            console.log('[DiceThrone][resolveEffectsToEvents] 效果无 action，跳过:', effect.description);
            continue;
        }
        if (!abilityManager.checkEffectCondition(effect, resolutionCtx)) {
            console.log('[DiceThrone][resolveEffectsToEvents] 效果条件不满足，跳过:', effect.description);
            continue;
        }
        console.log('[DiceThrone][resolveEffectsToEvents] 执行效果:', JSON.stringify({ 
            description: effect.description, 
            actionType: effect.action.type,
            customActionId: effect.action.customActionId,
        }));

        // 计算额外伤害：包括配置的 bonusDamage + rollDie 累加的 accumulatedBonusDamage
        let totalBonus = 0;
        if (config && !bonusApplied && config.bonusDamage) {
            totalBonus += config.bonusDamage;
        }
        if (ctx.accumulatedBonusDamage) {
            totalBonus += ctx.accumulatedBonusDamage;
        }
        
        const effectEvents = resolveEffectAction(effect.action, ctx, totalBonus || undefined, config?.random);
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
