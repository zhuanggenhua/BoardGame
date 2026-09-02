/**
 * DiceThrone Token / 奖励骰 / 击倒移除命令执行
 * 从 execute.ts 提取
 */

import type { RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneCommand,
    DiceThroneEvent,
    TurnPhase,
    CpChangedEvent,
    StatusRemovedEvent,
    PendingDamage,
    DamageDealtEvent,
    StatusAppliedEvent,
} from './types';
import { getPendingBonusSettlementDice, getPlayerDieFace, getRollerId, getTokenStackLimit } from './rules';
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
    applyExistingDamagePreventionToPendingDamage,
} from './tokenResponse';
import { getTokenUseOptions } from './tokenTypes';
import { getCustomActionHandler, resolveRollDieSettlement } from './effects';
import { getBonusDiceSettlementHandler } from './bonusDiceSettlement';
import { applyEvents } from './utils';
import { findCurrentRollDie, isCurrentBonusRollSettlement, resolveCurrentRollContext } from './rollContext';
import { rollDieValue } from './reroll';
import type { DiceThroneTokenResponseChoiceCommandSource } from './tokenResponseChoiceContract';

const normalizeBonusDiceFollowupEvents = (
    state: DiceThroneCore,
    settlement: NonNullable<DiceThroneCore['pendingBonusDiceSettlement']>,
    events: DiceThroneEvent[],
): DiceThroneEvent[] => events.flatMap((event) => {
    if (event.type !== 'DAMAGE_DEALT') {
        return [event];
    }

    // 奖励骰处理器产生的伤害仍属于当前临时骰的来源玩家；
    // 统一补齐归属，避免 ActionLog、响应窗口和攻击归账各自猜来源。
    const damageEvent = event.payload.sourcePlayerId
        ? event
        : {
            ...event,
            payload: {
                ...event.payload,
                sourcePlayerId: settlement.attackerId,
            },
        };

    const damageScope = damageEvent.payload.damageScope
        ?? (state.pendingAttack ? 'attack' : 'direct');
    const responseEvent = maybeCreateDamageResponseEvent({
        state,
        damageEvent,
        attackerId: settlement.attackerId,
        sourceAbilityId: damageEvent.payload.sourceAbilityId ?? settlement.sourceAbilityId,
        timestamp: typeof damageEvent.timestamp === 'number' ? damageEvent.timestamp : 0,
        allowAttackerBoost: damageScope === 'attack',
    });
    return responseEvent ? [responseEvent] : [damageEvent];
});

/**
 * 按当前奖励骰面生成最终结算事件。
 *
 * 奖励骰只在骰主通过右侧 2D 骰盘普通确认时结算。
 * 响应窗口、内置重投和调试改骰都只负责更新同一份 pending 骰面；
 * 最终副作用必须统一从这里按确认后的骰面生成。
 */
export function buildBonusDiceSettlementEvents({
    state,
    settlement,
    random,
    timestamp,
    sourceCommandType,
}: {
    state: DiceThroneCore;
    settlement: NonNullable<DiceThroneCore['pendingBonusDiceSettlement']>;
    random: RandomFn;
    timestamp: number;
    sourceCommandType: string;
}): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const settlementDice = getPendingBonusSettlementDice(settlement);
    const defaultTotalDamage = settlementDice.reduce((sum, d) => sum + d.value, 0);
    const settlementHandler = settlement.customResolutionId
        ? getBonusDiceSettlementHandler(settlement.customResolutionId)
        : undefined;
    const settlementResult = settlementHandler?.({ state, settlement, timestamp, random });
    const rollDieFollowupEvents = settlement.rollDieResolution
        ? resolveRollDieSettlement({ state, settlement, random, timestamp })
        : [];
    const totalDamage = settlementResult?.totalDamage ?? defaultTotalDamage;
    const thresholdTriggered = settlementResult?.thresholdTriggered
        ?? (settlement.threshold ? totalDamage >= settlement.threshold : false);
    const followupEvents = normalizeBonusDiceFollowupEvents(state, settlement, [
        ...(settlementResult?.followupEvents ?? []),
        ...rollDieFollowupEvents,
    ]);
    const singleFinalDie = settlementDice.length === 1 ? settlementDice[0] : undefined;
    const effectKey = settlement.summaryEffectKey ?? singleFinalDie?.effectKey;
    const effectParams = settlement.summaryEffectParams ?? singleFinalDie?.effectParams;

    events.push({
        type: 'BONUS_DICE_SETTLED',
        payload: {
            settlementId: settlement.id,
            finalDice: settlementDice,
            totalDamage,
            thresholdTriggered,
            attackerId: settlement.attackerId,
            targetId: settlement.targetId,
            sourceAbilityId: settlement.sourceAbilityId,
            ...(settlement.displayOnly ? { displayOnly: true } : {}),
            allowDiceModification: true,
            ...(effectKey ? { effectKey } : {}),
            ...(effectParams ? { effectParams } : {}),
        },
        sourceCommandType,
        timestamp,
    } as import('./types').BonusDiceSettledEvent);

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
            sourceCommandType,
            timestamp,
        } as DiceThroneEvent);

        if (settlement.postSettleBonusDamageAdds?.length) {
            for (const [idx, add] of settlement.postSettleBonusDamageAdds.entries()) {
                events.push({
                    type: 'BONUS_DAMAGE_ADDED',
                    payload: {
                        playerId: settlement.attackerId,
                        amount: add.amount,
                        sourceCardId: add.sourceCardId,
                    },
                    sourceCommandType,
                    timestamp: timestamp + 1 + idx,
                } as DiceThroneEvent);
            }
        }
        events.push(...followupEvents);
        return events;
    }

    if (settlement.resolutionMode === 'none') {
        events.push(...followupEvents);
        return events;
    }

    // displayOnly 只负责展示临时骰；最终副作用必须由专属 settlement handler
    // 按确认后的骰面生成，不能再落入默认“骰面总和造成伤害”的分支。
    if (settlement.displayOnly) {
        events.push(...followupEvents);
        return events;
    }

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
        sourceCommandType,
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
            sourceCommandType,
            timestamp,
        } as StatusAppliedEvent);
    }
    events.push(...followupEvents);
    return events;
}

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

function commandTargetsCurrentPendingDamage(
    command: DiceThroneCommand,
    pendingDamage: PendingDamage | undefined,
    requirePendingDamageId = false,
): boolean {
    const payload = command.payload as { pendingDamageId?: unknown } | undefined;
    if (typeof payload?.pendingDamageId !== 'string') {
        return !requirePendingDamageId;
    }
    return pendingDamage?.id === payload.pendingDamageId;
}

/**
 * 执行 Token / 奖励骰 / 击倒移除相关命令
 */
export function executeTokenCommand(
    state: DiceThroneCore,
    command: DiceThroneCommand,
    random: RandomFn,
    timestamp: number,
    phase: TurnPhase = 'setup',
    choiceSource?: DiceThroneTokenResponseChoiceCommandSource | null,
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    switch (command.type) {
        case 'USE_TOKEN': {
            const { tokenId, amount } = command.payload as { tokenId: string; amount: number };
            const pendingDamage = state.pendingDamage;
            const deferredDamageEvents: NonNullable<PendingDamage['deferredDamageEvents']> = [];
            if (!commandTargetsCurrentPendingDamage(command, pendingDamage, Boolean(choiceSource))) {
                console.warn('[DiceThrone] USE_TOKEN: pending damage mismatch');
                break;
            }

            if (tokenId === TOKEN_IDS.NYRAS_BOND && !pendingDamage) {
                const player = state.players[command.playerId];
                if (
                    player?.characterId !== 'lieren'
                    || !player.companion
                    || (player.tokens[TOKEN_IDS.NYRAS_BOND] ?? 0) < 1
                    || player.companion.hp >= player.companion.maxHp
                    || amount !== 1
                ) break;
                events.push({
                    type: 'TOKEN_CONSUMED',
                    payload: { playerId: command.playerId, tokenId: TOKEN_IDS.NYRAS_BOND, amount: 1, newTotal: 0, sourceAbilityId: TOKEN_IDS.NYRAS_BOND },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
                events.push({
                    type: 'COMPANION_HEALTH_CHANGED',
                    payload: { playerId: command.playerId, companionId: 'nyra', delta: 2, sourceAbilityId: TOKEN_IDS.NYRAS_BOND },
                    sourceCommandType: command.type,
                    timestamp: timestamp + 0.001,
                } as DiceThroneEvent);
                break;
            }

            if (tokenId === TOKEN_IDS.NYRA_REDIRECT && pendingDamage) {
                const player = state.players[command.playerId];
                if (
                    command.playerId !== pendingDamage.responderId
                    || state.pendingAttack?.isUltimate
                    || player?.characterId !== 'lieren'
                    || (player.companion?.hp ?? 0) <= 0
                    || amount !== pendingDamage.currentDamage
                ) break;
                events.push({
                    type: 'COMPANION_HEALTH_CHANGED',
                    payload: { playerId: command.playerId, companionId: 'nyra', delta: -pendingDamage.currentDamage, sourceAbilityId: pendingDamage.sourceAbilityId },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
                events.push({
                    type: 'TOKEN_RESPONSE_CLOSED',
                    payload: {
                        pendingDamageId: pendingDamage.id,
                        ...(choiceSource
                            ? {
                                choiceRequestId: choiceSource.requestId,
                                choiceCandidateId: choiceSource.candidateId,
                                ...(choiceSource.opportunityId ? { opportunityId: choiceSource.opportunityId } : {}),
                                ...(choiceSource.resolutionFrameId ? { resolutionFrameId: choiceSource.resolutionFrameId } : {}),
                            }
                            : {}),
                        finalDamage: 0,
                        fullyEvaded: true,
                        sourceAbilityId: pendingDamage.sourceAbilityId,
                    },
                    sourceCommandType: command.type,
                    timestamp: timestamp + 0.001,
                } as DiceThroneEvent);
                break;
            }

            if (tokenId === TOKEN_IDS.NYRAS_BOND && pendingDamage) {
                const player = state.players[command.playerId];
                const canAssignDamage = command.playerId === pendingDamage.responderId
                    && !state.pendingAttack?.isUltimate
                    && player?.characterId === 'lieren'
                    && (player.companion?.hp ?? 0) > 0
                    && (player.tokens[TOKEN_IDS.NYRAS_BOND] ?? 0) >= 1
                    && Number.isInteger(amount)
                    && amount >= 1
                    && amount <= Math.max(0, pendingDamage.currentDamage - 1);
                if (!canAssignDamage) break;

                const heroDamage = pendingDamage.currentDamage - amount;
                const heroHp = player.resources[RESOURCE_IDS.HP] ?? 0;
                events.push({
                    type: 'TOKEN_CONSUMED',
                    payload: { playerId: command.playerId, tokenId: TOKEN_IDS.NYRAS_BOND, amount: 1, newTotal: 0, sourceAbilityId: TOKEN_IDS.NYRAS_BOND },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
                events.push({
                    type: 'COMPANION_HEALTH_CHANGED',
                    payload: { playerId: command.playerId, companionId: 'nyra', delta: -amount, sourceAbilityId: pendingDamage.sourceAbilityId },
                    sourceCommandType: command.type,
                    timestamp: timestamp + 0.001,
                } as DiceThroneEvent);
                events.push({
                    type: 'TOKEN_RESPONSE_CLOSED',
                    payload: {
                        pendingDamageId: pendingDamage.id,
                        ...(choiceSource
                            ? {
                                choiceRequestId: choiceSource.requestId,
                                choiceCandidateId: choiceSource.candidateId,
                                ...(choiceSource.opportunityId ? { opportunityId: choiceSource.opportunityId } : {}),
                                ...(choiceSource.resolutionFrameId ? { resolutionFrameId: choiceSource.resolutionFrameId } : {}),
                            }
                            : {}),
                        finalDamage: heroDamage,
                        fullyEvaded: heroDamage === 0,
                        sourceAbilityId: pendingDamage.sourceAbilityId,
                    },
                    sourceCommandType: command.type,
                    timestamp: timestamp + 0.002,
                } as DiceThroneEvent);
                if (heroDamage > 0) {
                    events.push({
                        type: 'DAMAGE_DEALT',
                        payload: {
                            targetId: command.playerId,
                            amount: heroDamage,
                            actualDamage: Math.min(heroDamage, heroHp),
                            sourceAbilityId: pendingDamage.sourceAbilityId,
                            damageScope: pendingDamage.damageScope,
                            unblockable: pendingDamage.unblockable,
                            ...(choiceSource?.resolutionFrameId ? { resolutionFrameId: choiceSource.resolutionFrameId } : {}),
                        },
                        sourceCommandType: command.type,
                        timestamp: timestamp + 0.003,
                    } as DiceThroneEvent);
                }
                break;
            }

            if (!pendingDamage) {
                const tokenDef = state.tokenDefinitions.find(t => t.id === tokenId);
                const isRollPhase = phase === 'offensiveRoll' || phase === 'defensiveRoll';
                if (
                    !tokenDef
                    || !isRollPhase
                    || !tokenDef.activeUse?.timing?.includes('duringRoll')
                    || getRollerId(state, phase) !== command.playerId
                    || !state.pendingAttack
                    || !Number.isInteger(amount)
                    || amount <= 0
                ) {
                    console.warn('[DiceThrone] USE_TOKEN: no pending damage or invalid roll timing');
                    break;
                }

                const availableAmount = state.players[command.playerId]?.tokens[tokenId] ?? 0;
                if (!getTokenUseOptions(tokenDef, availableAmount).includes(amount)) {
                    console.warn('[DiceThrone] USE_TOKEN: invalid roll token amount');
                    break;
                }

                const { events: tokenEvents, result } = processTokenUsage(
                    state,
                    tokenDef,
                    command.playerId,
                    amount,
                    random,
                    undefined,
                    timestamp,
                );
                events.push(...tokenEvents);

                if (result.success && tokenDef.activeUse.customActionId) {
                    const targetId = phase === 'defensiveRoll'
                        ? state.pendingAttack.attackerId
                        : (state.pendingAttack.defenderId ?? state.pendingAttack.attackerId);
                    const handler = getCustomActionHandler(tokenDef.activeUse.customActionId);
                    if (handler) {
                        events.push(...handler({
                            ctx: {
                                attackerId: command.playerId,
                                defenderId: targetId,
                                sourceAbilityId: tokenId,
                                state,
                                damageDealt: 0,
                                timestamp,
                            },
                            targetId,
                            attackerId: command.playerId,
                            sourceAbilityId: tokenId,
                            state,
                            timestamp,
                            random,
                            action: {
                                type: 'custom',
                                target: 'self',
                                customActionId: tokenDef.activeUse.customActionId,
                                params: { phase },
                            },
                        }));
                    }
                }
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
                timestamp,
                choiceSource ?? undefined,
            );
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
            // 这类反伤必须等响应窗口收口后再播，否则会在 Token/奖励骰右侧骰盘结算尚未结束时提前播完。
            if (result.success && tokenDef.id === TOKEN_IDS.RETRIBUTION) {
                deferredDamageEvents.push({
                    targetId: pendingDamage.sourcePlayerId,
                    amount: 0,
                    actualDamage: 0,
                    sourceAbilityId: 'retribution-reflect',
                    sourcePlayerId: pendingDamage.targetPlayerId,
                    reflectFromPendingDamage: true,
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
                    const isFlightToken = tokenDef.id === TOKEN_IDS.FLIGHT;
                    const customActionActorId = isFlightToken
                        ? playerId
                        : pendingDamage.sourcePlayerId;
                    const customActionTargetId = isFlightToken
                        ? (playerId === pendingDamage.sourcePlayerId
                            ? pendingDamage.targetPlayerId
                            : pendingDamage.sourcePlayerId)
                        : pendingDamage.targetPlayerId;
                    const customActionSourceAbilityId = isFlightToken
                        ? tokenId
                        : (pendingDamage.sourceAbilityId ?? 'token-use');
                    const customCtx: import('../domain/effects').CustomActionContext = {
                        ctx: {
                            attackerId: customActionActorId,
                            defenderId: customActionTargetId,
                            sourceAbilityId: customActionSourceAbilityId,
                            state,
                            damageDealt: 0,
                            timestamp,
                        },
                        targetId: customActionTargetId,
                        attackerId: customActionActorId,
                        sourceAbilityId: customActionSourceAbilityId,
                        state,
                        timestamp,
                        random,
                        action: {
                            type: 'custom',
                            target: 'opponent',
                            customActionId: resolvedCustomActionId,
                            params: { phase },
                        },
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
            
            // 闪避结果进入 currentRollContext，允许改骰/重掷后再由 SKIP_TOKEN_RESPONSE 收口。
            // 其它立即完成的 Token 仍保持原有自动关闭行为。
            const stateAfterToken = applyEvents(state, events, reduce);
            if (stateAfterToken.pendingDamage?.isFullyEvaded && !result.rollResult) {
                const updatedPendingDamage: PendingDamage = {
                    ...(stateAfterToken.pendingDamage ?? pendingDamage),
                    currentDamage: 0,
                    isFullyEvaded: true,
                };
                const closeEvents = finalizeTokenResponse(
                    updatedPendingDamage,
                    stateAfterToken,
                    timestamp,
                    choiceSource ?? undefined,
                );
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
            if (!commandTargetsCurrentPendingDamage(command, pendingDamage, Boolean(choiceSource))) {
                console.warn('[DiceThrone] SKIP_TOKEN_RESPONSE: pending damage mismatch');
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
                const defender = state.players[pendingDamage.targetPlayerId];
                const hasNyraRedirect = defender?.characterId === 'lieren' && (defender.companion?.hp ?? 0) > 0;
                const hasDefenderResponse = hasDefensiveTokens(
                    state,
                    pendingDamage.targetPlayerId,
                    pendingDamage.damageScope,
                ) || hasBeforeDamageReceivedCard(state, pendingDamage.targetPlayerId) || hasNyraRedirect;
                if (hasDefenderResponse) {
                    // 切换到防御方响应
                    const newPendingDamage: PendingDamage = applyExistingDamagePreventionToPendingDamage(state, {
                        ...pendingDamage,
                        responseType: 'beforeDamageReceived',
                        responderId: pendingDamage.targetPlayerId,
                    }, {
                        bypassShields: pendingDamage.unblockable,
                        isUltimateDamage: state.pendingAttack?.isUltimate === true,
                    });
                    const tokenResponseEvent = createTokenResponseRequestedEvent(newPendingDamage, timestamp);
                    events.push(tokenResponseEvent);
                    break;
                }
            }
            
            // 关闭响应窗口，应用最终伤害
            const closeEvents = finalizeTokenResponse(
                pendingDamage,
                state,
                timestamp,
                choiceSource ?? undefined,
            );
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
            const currentRollContext = resolveCurrentRollContext(state, phase);
            const currentDie = findCurrentRollDie(state, dieIndex, phase)?.die;
            
            if (!playerId
                || !settlement
                || !isCurrentBonusRollSettlement(state, settlement)
                || currentRollContext?.kind !== 'bonus'
                || !currentDie) {
                console.warn('[DiceThrone] REROLL_BONUS_DIE: invalid state');
                break;
            }
            
            // 重掷骰子
            const newValue = rollDieValue(random);
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
                    oldValue: currentDie.value,
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
            
            if (!playerId || !settlement || !isCurrentBonusRollSettlement(state, settlement)) {
                console.warn('[DiceThrone] SKIP_BONUS_DICE_REROLL: invalid state');
                break;
            }
            
            events.push(...buildBonusDiceSettlementEvents({
                state,
                settlement,
                random,
                timestamp,
                sourceCommandType: command.type,
            }));
            break;
        }
    }

    return events;
}
