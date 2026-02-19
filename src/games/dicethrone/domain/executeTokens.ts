/**
 * DiceThrone Token / 奖励骰 / 击倒移除命令执行
 * 从 execute.ts 提取
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneCommand,
    DiceThroneEvent,
    CpChangedEvent,
    StatusRemovedEvent,
    PendingDamage,
    DamageDealtEvent,
    StatusAppliedEvent,
} from './types';
import { getPlayerDieFace } from './rules';
import { reduce } from './reducer';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { DICETHRONE_COMMANDS, STATUS_IDS, TOKEN_IDS } from './ids';
import {
    processTokenUsage,
    finalizeTokenResponse,
    hasDefensiveTokens,
    createTokenResponseRequestedEvent,
} from './tokenResponse';
import { getCustomActionHandler } from './effects';
import { applyEvents } from './utils';

/**
 * 根据 tokenId 查找该 token 所属英雄的前缀（用于拼接 custom action ID）
 * 例如 sneak_attack → shadow_thief
 */
function findTokenHeroPrefix(state: DiceThroneCore, tokenId: string): string | undefined {
    // 从 state 中查找持有该 token 的玩家的 characterId
    for (const [, player] of Object.entries(state.players)) {
        if (player.characterId && player.characterId !== 'unselected' && tokenId in (player.tokens ?? {})) {
            return player.characterId;
        }
    }
    return undefined;
}

/**
 * 执行 Token / 奖励骰 / 击倒移除相关命令
 */
export function executeTokenCommand(
    state: DiceThroneCore,
    command: DiceThroneCommand,
    random: RandomFn,
    timestamp: number
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    switch (command.type) {
        case 'USE_TOKEN': {
            const { tokenId, amount } = command.payload as { tokenId: string; amount: number };
            const pendingDamage = state.pendingDamage;
            
            if (!pendingDamage) {
                console.warn('[DiceThrone] USE_TOKEN: no pending damage');
                break;
            }
            
            const playerId = pendingDamage.responderId;
            
            // 获取 Token 定义（由 state.tokenDefinitions 驱动，避免与具体英雄耦合）
            const tokenDef = state.tokenDefinitions.find(t => t.id === tokenId);
            if (!tokenDef) {
                console.warn(`[DiceThrone] USE_TOKEN: unknown token ${tokenId}`);
                break;
            }
            
            // 使用通用处理器
            const { events: tokenEvents, result } = processTokenUsage(
                state,
                tokenDef,
                playerId,
                amount,
                random,
                pendingDamage.responseType,
                timestamp
            );
            events.push(...tokenEvents);

            // 精准 (accuracy)：使攻击不可防御
            if (result.extra?.makeUndefendable && state.pendingAttack) {
                events.push({
                    type: 'ATTACK_MADE_UNDEFENDABLE',
                    payload: { attackerId: pendingDamage.sourcePlayerId, tokenId },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
            }

            // 神罚 (retribution)：反弹伤害给攻击者
            const reflectDamage = result.extra?.reflectDamage as number | undefined;
            if (reflectDamage && reflectDamage > 0) {
                const attackerPlayer = state.players[pendingDamage.sourcePlayerId];
                const attackerHp = attackerPlayer?.resources[RESOURCE_IDS.HP] ?? 0;
                const actualReflect = Math.min(reflectDamage, attackerHp);
                events.push({
                    type: 'DAMAGE_DEALT',
                    payload: {
                        targetId: pendingDamage.sourcePlayerId,
                        amount: reflectDamage,
                        actualDamage: actualReflect,
                        sourceAbilityId: 'retribution-reflect',
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
            }

            // 伏击等 value=0 的 token：触发对应 custom action（如掷骰加伤）
            if (result.success && result.damageModifier === 0 && tokenDef.activeUse?.effect?.value === 0) {
                const customActionId = `${tokenDef.id.replace(/_/g, '-')}-use`;
                // 尝试查找 hero-prefixed custom action（如 shadow_thief-sneak-attack-use）
                const heroPrefix = findTokenHeroPrefix(state, tokenId);
                const prefixedActionId = heroPrefix ? `${heroPrefix}-${customActionId}` : customActionId;
                const handler = getCustomActionHandler(prefixedActionId) ?? getCustomActionHandler(customActionId);
                if (handler) {
                    const customCtx: import('../domain/effects').CustomActionContext = {
                        ctx: {
                            attackerId: pendingDamage.sourcePlayerId,
                            defenderId: pendingDamage.targetPlayerId,
                            sourceAbilityId: pendingDamage.sourceAbilityId ?? 'token-use',
                            state,
                            damageDealt: 0,
                            timestamp,
                        },
                        targetId: pendingDamage.targetPlayerId,
                        attackerId: pendingDamage.sourcePlayerId,
                        sourceAbilityId: pendingDamage.sourceAbilityId ?? 'token-use',
                        state,
                        timestamp,
                        random,
                        action: { type: 'custom', target: 'opponent', customActionId: prefixedActionId },
                    };
                    const customEvents = handler(customCtx);
                    events.push(...customEvents);
                }
            }
            
            // 如果完全闪避，关闭响应窗口
            if (result.fullyEvaded) {
                const stateAfterToken = applyEvents(state, events, reduce);
                const updatedPendingDamage: PendingDamage = {
                    ...pendingDamage,
                    currentDamage: 0,
                    isFullyEvaded: true,
                };
                const closeEvents = finalizeTokenResponse(updatedPendingDamage, stateAfterToken, timestamp);
                events.push(...closeEvents);
            }
            break;
        }

        case 'SKIP_TOKEN_RESPONSE': {
            const pendingDamage = state.pendingDamage;
            
            if (!pendingDamage) {
                console.warn('[DiceThrone] SKIP_TOKEN_RESPONSE: no pending damage');
                break;
            }
            
            // 检查是否需要切换到下一个响应者
            if (pendingDamage.responseType === 'beforeDamageDealt') {
                // 攻击方跳过加伤，检查防御方是否有可用 Token
                if (hasDefensiveTokens(state, pendingDamage.targetPlayerId)) {
                    // 切换到防御方响应
                    const newPendingDamage: PendingDamage = {
                        ...pendingDamage,
                        responseType: 'beforeDamageReceived',
                        responderId: pendingDamage.targetPlayerId,
                    };
                    const tokenResponseEvent = createTokenResponseRequestedEvent(newPendingDamage, timestamp);
                    events.push(tokenResponseEvent);
                    break;
                }
            }
            
            // 关闭响应窗口，应用最终伤害
            const closeEvents = finalizeTokenResponse(pendingDamage, state, timestamp);
            events.push(...closeEvents);
            break;
        }

        case 'USE_PURIFY': {
            const { statusId } = command.payload as { statusId: string };
            const playerId = command.playerId;
            
            if (!playerId) {
                console.warn('[DiceThrone] USE_PURIFY: no playerId');
                break;
            }
            
            const player = state.players[playerId];
            if (!player || (player.tokens[TOKEN_IDS.PURIFY] ?? 0) <= 0) {
                console.warn('[DiceThrone] USE_PURIFY: no purify token');
                break;
            }

            const tokenDef = state.tokenDefinitions.find(def => def.id === TOKEN_IDS.PURIFY);
            if (!tokenDef) {
                console.warn('[DiceThrone] USE_PURIFY: token definition not found');
                break;
            }
            if (!tokenDef.activeUse?.effect) {
                console.warn('[DiceThrone] USE_PURIFY: token effect not configured');
                break;
            }
            
            // 消耗净化 Token
            const { events: tokenEvents } = processTokenUsage(state, tokenDef, playerId, 1, undefined, undefined, timestamp);
            events.push(...tokenEvents);
            
            // 移除负面状态
            const currentStacks = player.statusEffects[statusId] ?? 0;
            if (currentStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: playerId, statusId, stacks: 1 },
                    sourceCommandType: command.type,
                    timestamp,
                } as StatusRemovedEvent);
            }
            break;
        }

        case DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN: {
            const playerId = command.playerId;
            
            if (!playerId) {
                console.warn('[DiceThrone] PAY_TO_REMOVE_KNOCKDOWN: no playerId');
                break;
            }
            
            const player = state.players[playerId];
            if (!player) {
                console.warn('[DiceThrone] PAY_TO_REMOVE_KNOCKDOWN: player not found');
                break;
            }
            
            // 扣除 2 CP
            const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
            const cpEvent: CpChangedEvent = {
                type: 'CP_CHANGED',
                payload: {
                    playerId,
                    delta: -2,
                    newValue: currentCp - 2,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(cpEvent);
            
            // 移除击倒状态
            const knockdownStacks = player.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
            if (knockdownStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: playerId, statusId: STATUS_IDS.KNOCKDOWN, stacks: knockdownStacks },
                    sourceCommandType: command.type,
                    timestamp,
                } as StatusRemovedEvent);
            }
            break;
        }

        case 'REROLL_BONUS_DIE': {
            const { dieIndex } = command.payload as { dieIndex: number };
            const playerId = command.playerId;
            const settlement = state.pendingBonusDiceSettlement;
            
            if (!playerId || !settlement) {
                console.warn('[DiceThrone] REROLL_BONUS_DIE: invalid state');
                break;
            }
            
            const die = settlement.dice.find(d => d.index === dieIndex);
            if (!die) {
                console.warn('[DiceThrone] REROLL_BONUS_DIE: die not found');
                break;
            }
            
            // 重掷骰子
            const newValue = random.d(6);
            const newFace = getPlayerDieFace(state, settlement.attackerId, newValue) ?? '';
            
            // 发出 BONUS_DIE_REROLLED 事件（包含 UI 展示字段，避免 reducer 从 core 派生）
            const rerollEffectKey = settlement.rerollEffectKey ?? 'bonusDie.effect.thunderStrike2Reroll';
            events.push({
                type: 'BONUS_DIE_REROLLED',
                payload: {
                    dieIndex,
                    oldValue: die.value,
                    newValue,
                    newFace,
                    costTokenId: settlement.rerollCostTokenId,
                    costAmount: settlement.rerollCostAmount,
                    playerId,
                    targetPlayerId: settlement.targetId,
                    effectKey: rerollEffectKey,
                    effectParams: { value: newValue, index: dieIndex },
                },
                sourceCommandType: command.type,
                timestamp,
            } as import('./types').BonusDieRerolledEvent);
            break;
        }

        case 'SKIP_BONUS_DICE_REROLL': {
            const playerId = command.playerId;
            const settlement = state.pendingBonusDiceSettlement;
            
            if (!playerId || !settlement) {
                console.warn('[DiceThrone] SKIP_BONUS_DICE_REROLL: invalid state');
                break;
            }
            
            // 计算最终伤害
            const totalDamage = settlement.dice.reduce((sum, d) => sum + d.value, 0);
            const thresholdTriggered = settlement.threshold ? totalDamage >= settlement.threshold : false;
            
            // 发出 BONUS_DICE_SETTLED 事件
            // displayOnly 标记传递给 systems.ts，避免误 resolve 其他活跃交互
            events.push({
                type: 'BONUS_DICE_SETTLED',
                payload: {
                    finalDice: settlement.dice,
                    totalDamage,
                    thresholdTriggered,
                    attackerId: settlement.attackerId,
                    targetId: settlement.targetId,
                    sourceAbilityId: settlement.sourceAbilityId,
                    ...(settlement.displayOnly ? { displayOnly: true } : {}),
                },
                sourceCommandType: command.type,
                timestamp,
            } as import('./types').BonusDiceSettledEvent);
            
            // displayOnly 模式：仅展示骰子结果，伤害/状态已由 custom action 处理
            if (settlement.displayOnly) {
                break;
            }

            // 应用伤害
            const target = state.players[settlement.targetId];
            const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
            const actualDamage = target ? Math.min(totalDamage, targetHp) : 0;
            events.push({
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: settlement.targetId,
                    amount: totalDamage,
                    actualDamage,
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: command.type,
                timestamp,
            } as DamageDealtEvent);
            
            // 如果触发阈值效果（倒地）
            if (thresholdTriggered && settlement.thresholdEffect === 'knockdown') {
                const currentStacks = target?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
                const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.KNOCKDOWN);
                const maxStacks = def?.stackLimit || 99;
                const newTotal = Math.min(currentStacks + 1, maxStacks);
                events.push({
                    type: 'STATUS_APPLIED',
                    payload: {
                        targetId: settlement.targetId,
                        statusId: STATUS_IDS.KNOCKDOWN,
                        stacks: 1,
                        newTotal,
                        sourceAbilityId: settlement.sourceAbilityId,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as StatusAppliedEvent);
            }
            break;
        }
    }

    return events;
}
