/**
 * DiceThrone Token / 奖励骰 / 击倒移除命令执行
 * 从 execute.ts 提取
 */

import type { RandomFn } from '../../../engine/types';
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
import { getPendingBonusSettlementDice, getPlayerDieFace, getTokenStackLimit } from './rules';
import { reduce } from './reducer';
import { RESOURCE_IDS } from './resources';
import { DICETHRONE_COMMANDS, STATUS_IDS, TOKEN_IDS } from './ids';
import {
    processTokenUsage,
    finalizeTokenResponse,
    hasDefensiveTokens,
    hasBeforeDamageReceivedCard,
    createTokenResponseRequestedEvent,
    getUsableTokenAmountForTiming,
    maybeCreateDamageResponseEvent,
} from './tokenResponse';
import { getTokenUseOptions } from './tokenTypes';
import { getCustomActionHandler } from './effects';
import { getBonusDiceSettlementHandler } from './bonusDiceSettlement';
import { applyEvents } from './utils';

/**
 * 旧 token 定义未显式声明 customActionId 时的兼容兜底。
 * 新定义必须优先使用 activeUse.customActionId。
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
            const deferredDamageEvents: NonNullable<PendingDamage['deferredDamageEvents']> = [];
            
            if (!pendingDamage) {
                console.warn('[DiceThrone] USE_TOKEN: no pending damage');
                break;
            }
            
            const playerId = pendingDamage.responderId;
            if (command.playerId !== playerId) {
                console.warn('[DiceThrone] USE_TOKEN: player mismatch');
                break;
            }
            
            // 获取 Token 定义（由 state.tokenDefinitions 驱动，避免与具体英雄耦合）
            const tokenDef = state.tokenDefinitions.find(t => t.id === tokenId);
            if (!tokenDef) {
                console.warn(`[DiceThrone] USE_TOKEN: unknown token ${tokenId}`);
                break;
            }
            if (!Number.isInteger(amount) || amount <= 0) {
                console.warn('[DiceThrone] USE_TOKEN: invalid amount');
                break;
            }
            if (!tokenDef.activeUse?.timing?.includes(pendingDamage.responseType)) {
                console.warn('[DiceThrone] USE_TOKEN: invalid token timing');
                break;
            }
            if (tokenDef.activeUse.requiresAttackDamage && !state.pendingAttack) {
                console.warn('[DiceThrone] USE_TOKEN: missing attack context');
                break;
            }
            if (
                typeof tokenDef.activeUse.minimumAttackDamage === 'number'
                && pendingDamage.originalDamage < tokenDef.activeUse.minimumAttackDamage
            ) {
                console.warn('[DiceThrone] USE_TOKEN: insufficient attack damage');
                break;
            }
            const availableAmount = getUsableTokenAmountForTiming(
                state,
                playerId,
                tokenId,
                pendingDamage.responseType,
                { damageScope: pendingDamage.damageScope },
            );
            const allowedConsumeAmounts = getTokenUseOptions(tokenDef, availableAmount);
            if (!allowedConsumeAmounts.includes(amount)) {
                console.warn('[DiceThrone] USE_TOKEN: amount not allowed');
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
            const reflectDamage = result.extra?.reflectDamage as number | undefined;

            // 精准 (accuracy)：使攻击不可防御
            if (result.extra?.makeUndefendable && state.pendingAttack) {
                events.push({
                    type: 'ATTACK_MADE_UNDEFENDABLE',
                    payload: { attackerId: pendingDamage.sourcePlayerId, tokenId },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
            }

            // 神罚 (retribution)：反弹伤害给攻击者。
            // 这类反伤必须等响应窗口收口后再播，否则会在 Token/奖励骰特写尚未结束时提前播完。
            if (reflectDamage && reflectDamage > 0) {
                const attackerPlayer = state.players[pendingDamage.sourcePlayerId];
                const attackerHp = attackerPlayer?.resources[RESOURCE_IDS.HP] ?? 0;
                const actualReflect = Math.min(reflectDamage, attackerHp);
                deferredDamageEvents.push({
                    targetId: pendingDamage.sourcePlayerId,
                    amount: reflectDamage,
                    actualDamage: actualReflect,
                    sourceAbilityId: 'retribution-reflect',
                    sourcePlayerId: pendingDamage.targetPlayerId,
                    sourceCommandType: command.type,
                });
            }

            // 伏击等 value=0 的 token：触发对应 custom action（如掷骰加伤）
            if (result.success && result.damageModifier === 0 && tokenDef.activeUse?.effect?.value === 0) {
                const customActionId =
                    tokenDef.activeUse?.customActionId
                    ?? `${tokenDef.id.replace(/_/g, '-')}-use`;
                // 新定义优先使用显式 customActionId；仅旧定义才回退到前缀推断
                let resolvedCustomActionId = customActionId;
                let handler = getCustomActionHandler(resolvedCustomActionId);
                if (!handler && !tokenDef.activeUse?.customActionId) {
                    const heroPrefix = findTokenHeroPrefix(state, tokenId);
                    if (heroPrefix) {
                        resolvedCustomActionId = `${heroPrefix}-${customActionId}`;
                        handler = getCustomActionHandler(resolvedCustomActionId);
                    }
                }
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
                        action: { type: 'custom', target: 'opponent', customActionId: resolvedCustomActionId },
                    };
                    const customEvents = handler(customCtx);
                    for (const customEvent of customEvents) {
                        if (customEvent.type !== 'DAMAGE_DEALT') {
                            events.push(customEvent);
                            continue;
                        }

                        const payload = customEvent.payload as DamageDealtEvent['payload'];
                        deferredDamageEvents.push({
                            targetId: payload.targetId,
                            amount: payload.amount,
                            actualDamage: payload.actualDamage ?? payload.amount,
                            sourceAbilityId: payload.sourceAbilityId,
                            sourcePlayerId: payload.sourcePlayerId,
                            damageScope: payload.damageScope,
                            unblockable: payload.unblockable,
                            sourceCommandType: customEvent.sourceCommandType,
                        });
                    }
                }
            }

            if (deferredDamageEvents.length > 0) {
                for (const tokenEvent of tokenEvents) {
                    if (tokenEvent.type === 'TOKEN_USED') {
                        (tokenEvent.payload as { deferredDamageEvents?: PendingDamage['deferredDamageEvents'] }).deferredDamageEvents = deferredDamageEvents;
                    }
                }
            }
            events.unshift(...tokenEvents);

            const usedTokenEvent = tokenEvents.find((event) => event.type === 'TOKEN_USED');
            const usedAmount = usedTokenEvent?.type === 'TOKEN_USED' ? usedTokenEvent.payload.amount : 0;
            if (usedAmount > 0 && pendingDamage.deferredTokenGrants?.length) {
                for (const deferredGrant of pendingDamage.deferredTokenGrants) {
                    if (deferredGrant.triggerTokenId !== tokenId) continue;
                    const targetPlayer = state.players[deferredGrant.targetId];
                    if (!targetPlayer) continue;
                    const currentAmount = targetPlayer.tokens[deferredGrant.tokenId] ?? 0;
                    const spentSameToken = deferredGrant.targetId === playerId && deferredGrant.tokenId === tokenId
                        ? usedAmount
                        : 0;
                    const amountAfterUse = Math.max(0, currentAmount - spentSameToken);
                    const limit = getTokenStackLimit(state, deferredGrant.targetId, deferredGrant.tokenId);
                    const newTotal = Math.min(amountAfterUse + deferredGrant.amount, limit);
                    const grantedAmount = Math.max(0, newTotal - amountAfterUse);
                    if (grantedAmount <= 0) continue;
                    events.push({
                        type: 'TOKEN_GRANTED',
                        payload: {
                            targetId: deferredGrant.targetId,
                            tokenId: deferredGrant.tokenId,
                            amount: grantedAmount,
                            newTotal,
                            sourceAbilityId: deferredGrant.sourceAbilityId,
                        },
                        sourceCommandType: deferredGrant.sourceCommandType ?? command.type,
                        timestamp: timestamp + 0.001,
                    } as DiceThroneEvent);
                }
            }
            
            // 如果完全闪避，关闭响应窗口
            if (result.fullyEvaded) {
                const stateAfterToken = applyEvents(state, events, reduce);
                const updatedPendingDamage: PendingDamage = {
                    ...(stateAfterToken.pendingDamage ?? pendingDamage),
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
            if (command.playerId !== pendingDamage.responderId) {
                console.warn('[DiceThrone] SKIP_TOKEN_RESPONSE: player mismatch');
                break;
            }
            
            // 检查是否需要切换到下一个响应者
            if (
                pendingDamage.responseType === 'beforeDamageDealt'
                && state.pendingAttack?.isUltimate !== true
            ) {
                // 攻击方结束增伤后，普通不可防御伤害仍允许符合条件的卡牌与状态 Token 响应。
                const hasDefenderResponse = hasDefensiveTokens(
                    state,
                    pendingDamage.targetPlayerId,
                    pendingDamage.damageScope,
                ) || hasBeforeDamageReceivedCard(state, pendingDamage.targetPlayerId);
                if (hasDefenderResponse) {
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
            } else {
                const currentTokens = player.tokens[statusId] ?? 0;
                if (currentTokens > 0) {
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: {
                            playerId,
                            tokenId: statusId,
                            amount: 1,
                            newTotal: Math.max(0, currentTokens - 1),
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
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
            
            const settlementDice = getPendingBonusSettlementDice(settlement);
            const die = settlementDice.find(d => d.index === dieIndex);
            if (!die) {
                console.warn('[DiceThrone] REROLL_BONUS_DIE: die not found');
                break;
            }
            
            // 重掷骰子
            const newValue = random.d(6);
            const newFace = getPlayerDieFace(state, settlement.attackerId, newValue) ?? '';
            
            // 发出 BONUS_DIE_REROLLED 事件（包含 UI 展示字段，避免 reducer 从 core 派生）
            const rerollEffectKey = settlement.rerollEffectKey ?? 'bonusDie.effect.thunderStrike2Reroll';
            const effectParams: Record<string, string | number> = { value: newValue, index: dieIndex };
            if (rerollEffectKey === 'bonusDie.effect.gunslingerLoadedReroll') {
                effectParams.bonusDamage = Math.ceil(newValue / 2);
            }
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
                    effectParams,
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
            
            // 计算最终伤害；特殊技能可覆盖“点数和即伤害”的默认收口。
            const settlementDice = getPendingBonusSettlementDice(settlement);
            const defaultTotalDamage = settlementDice.reduce((sum, d) => sum + d.value, 0);
            const settlementHandler = settlement.customResolutionId
                ? getBonusDiceSettlementHandler(settlement.customResolutionId)
                : undefined;
            const settlementResult = settlementHandler?.({ state, settlement, timestamp });
            const totalDamage = settlementResult?.totalDamage ?? defaultTotalDamage;
            const thresholdTriggered = settlementResult?.thresholdTriggered
                ?? (settlement.threshold ? totalDamage >= settlement.threshold : false);
            const followupEvents = settlementResult?.followupEvents ?? [];
            
            // 发出 BONUS_DICE_SETTLED 事件
            // displayOnly 标记传递给 systems.ts，避免误 resolve 其他活跃交互
            events.push({
                type: 'BONUS_DICE_SETTLED',
                payload: {
                    finalDice: settlementDice,
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
            
            // displayOnly 默认只负责展示；但可被改骰且没有自定义收口的奖励骰，
            // 必须在确认后用“改后的奖励骰”继续走默认伤害/阈值结算。
            const shouldResolveDisplayOnlyByCurrentDice =
                settlement.displayOnly === true
                && settlement.allowDiceModification === true
                && !settlement.customResolutionId
                && settlement.resolutionMode !== 'none';
            if (settlement.displayOnly && !shouldResolveDisplayOnlyByCurrentDice) {
                events.push(...followupEvents);
                break;
            }

            if (settlement.resolutionMode === 'attackBonus') {
                const attackBonus = settlement.attackBonusScale === 'halfUp'
                    ? Math.ceil(totalDamage / 2)
                    : totalDamage;
                events.push({
                    type: 'BONUS_DAMAGE_ADDED',
                    payload: {
                        playerId: settlement.attackerId,
                        amount: attackBonus,
                        sourceCardId: settlement.attackBonusSourceCardId,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);

                // 两段式：在奖励骰确定并收口后追加 bonus damage（例如 Wild West 的“然后 +1”）
                if (settlement.postSettleBonusDamageAdds?.length) {
                    for (const [idx, add] of settlement.postSettleBonusDamageAdds.entries()) {
                        events.push({
                            type: 'BONUS_DAMAGE_ADDED',
                            payload: {
                                playerId: settlement.attackerId,
                                amount: add.amount,
                                sourceCardId: add.sourceCardId,
                            },
                            sourceCommandType: command.type,
                            timestamp: timestamp + 1 + idx,
                        } as DiceThroneEvent);
                    }
                }
                events.push(...followupEvents);
                break;
            }

            if (settlement.resolutionMode === 'none') {
                events.push(...followupEvents);
                break;
            }

            // 应用伤害
            const target = state.players[settlement.targetId];
            const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
            const actualDamage = target ? Math.min(totalDamage, targetHp) : 0;
            const damageEvent: DamageDealtEvent = {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: settlement.targetId,
                    amount: totalDamage,
                    actualDamage,
                    sourceAbilityId: settlement.sourceAbilityId,
                    sourcePlayerId: settlement.attackerId,
                    damageScope: state.pendingAttack ? 'attack' : 'direct',
                },
                sourceCommandType: command.type,
                timestamp,
            };
            const tokenResponseEvent = maybeCreateDamageResponseEvent({
                state,
                damageEvent,
                attackerId: settlement.attackerId,
                sourceAbilityId: settlement.sourceAbilityId,
                timestamp,
                allowAttackerBoost: damageEvent.payload.damageScope === 'attack',
            });
            events.push(tokenResponseEvent ?? damageEvent);
            
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
            events.push(...followupEvents);
            break;
        }
    }

    return events;
}
