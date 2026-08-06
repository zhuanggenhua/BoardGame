/**
 * DiceThrone FlowHooks 实现
 * 从 game.ts 提取
 *
 * 符合 openspec/changes/add-flow-system/design.md Decision 3
 * sys.phase 是阶段的单一权威来源，所有阶段副作用通过 FlowHooks 实现
 */

import type { GameEvent, RandomFn } from '../../../engine/types';
import type { FlowHooks, PhaseExitResult } from '../../../engine';
import type {
    DiceThroneCore,
    TurnPhase,
    DiceThroneEvent,
    CpChangedEvent,
    TurnChangedEvent,
    StatusRemovedEvent,
    AbilityActivatedEvent,
    ExtraAttackTriggeredEvent,
    TokenConsumedEvent,
    ChoiceRequestedEvent,
    DefenderSelectionRequestedEvent,
    AttackResolvedEvent,
    DamageDealtEvent,
    DamageShieldGrantedEvent,
    BonusDieRolledEvent,
    PendingBonusDiceSettlement,
} from './types';
import { STATUS_IDS, TOKEN_IDS } from './ids';
import {
    canAdvancePhase,
    getActiveDice,
    getFaceCounts,
    hasRespondableContent,
    getNextPhase,
    getNextPlayerId,
    getOpponents,
    getPlayerDieFace,
    getResponderQueue,
    getRollerId,
    getTargetingRollAutoDefenderId,
    getTargetingRollChoiceOptions,
    getTargetingRollChoiceOwnerId,
    isTeamMode,
    getPendingBonusSettlementDice,
} from './rules';
import { resolveAttack, resolveAttackWithSneakImmunityAfterDefense, resolveOffensivePreDefenseEffects, resolvePostDamageEffects, resolveWithDamageAfterChoice } from './attack';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { buildDrawEvents } from './deckEvents';
import { reduce } from './reducer';
import {
    getGameMode,
    applyEvents,
    getPendingAttackExpectedDamage,
    buildPendingAttackResolvedEvent,
    getPendingAttackSettlementStage,
} from './utils';
import { createDTPassiveTriggerHandler, resolveEffectsToEvents } from './effects';
import type { ResponseWindowOpenedEvent } from './events';
import { createDamageCalculation } from '../../../engine/primitives';
import { getUsableTokensForOffensiveRollEnd } from './tokenResponse';
import { getPlayerAbilityBaseDamage, playerAbilityHasDamage, playerAbilityNeedsSingleOpponentTarget } from './abilityLookup';
import { evaluateTriggerCondition } from './combat';
import { findHeroCard } from '../heroes';
import { hasCurrentChoiceAnchor, registerChoiceEffectHandler } from './choiceEffects';
import { hasSpentTreantTreeSpiritThisTurn, hasUsablePassiveAction } from './passiveAbility';
import { registerBonusDiceSettlementHandler } from './bonusDiceSettlement';
import {
    POWDER_KEG_TRANSFER_CHOICE_ID,
    POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID,
    buildPowderKegExplosionEvents,
    buildStatusAppliedOrChoiceEvents,
    getPowderKegTransferTargetIds,
} from './statusEvents';

const TREANT_DIVINE_PREVENT_DEBUFF_CHOICE_ID = 'treant-divine-prevent-debuff';
const TREANT_DIVINE_SKIP_DEBUFF_CHOICE_ID = 'treant-divine-skip-debuff';
const POWDER_KEG_SETTLEMENT_ID = 'powder-keg-upkeep';
const BLINDED_CHECK_SETTLEMENT_ID = 'blinded-check';
const TIANSHi_DAZZLE_CHECK_SETTLEMENT_ID = 'tianshi-dazzle-check';

const formatSeatLabel = (playerId: string): string => {
    const seatNumber = Number.parseInt(playerId, 10) + 1;
    return Number.isFinite(seatNumber) ? `P${seatNumber}` : playerId;
};

registerChoiceEffectHandler(TREANT_DIVINE_PREVENT_DEBUFF_CHOICE_ID, ({ state, playerId, sourceAbilityId }) => {
    if (sourceAbilityId !== TOKEN_IDS.TREANT_DIVINE) return undefined;
    if (!hasCurrentChoiceAnchor(state, sourceAbilityId)) return undefined;
    if (!state.pendingAttack) return undefined;
    if (state.pendingAttack.defenderId !== playerId) return undefined;
    return {
        pendingAttack: {
            ...state.pendingAttack,
            treantDivinePreventDebuffChoice: 'prevent',
        },
    };
});

registerChoiceEffectHandler(TREANT_DIVINE_SKIP_DEBUFF_CHOICE_ID, ({ state, playerId, sourceAbilityId }) => {
    if (sourceAbilityId !== TOKEN_IDS.TREANT_DIVINE) return undefined;
    if (!hasCurrentChoiceAnchor(state, sourceAbilityId)) return undefined;
    if (!state.pendingAttack) return undefined;
    if (state.pendingAttack.defenderId !== playerId) return undefined;
    return {
        pendingAttack: {
            ...state.pendingAttack,
            treantDivinePreventDebuffChoice: 'skip',
        },
    };
});

const pendingAttackNeedsTargetingRoll = (core: DiceThroneCore): boolean => {
    const pendingAttack = core.pendingAttack;
    const sourceAbilityId = pendingAttack?.sourceAbilityId;
    if (!pendingAttack || !sourceAbilityId || pendingAttack.defenderId !== undefined || !isTeamMode(core)) {
        return false;
    }

    return playerAbilityHasDamage(core, pendingAttack.attackerId, sourceAbilityId)
        || playerAbilityNeedsSingleOpponentTarget(core, pendingAttack.attackerId, sourceAbilityId);
};

const isBlockingInteractionEvent = (event: DiceThroneEvent): boolean =>
    event.type === 'CHOICE_REQUESTED'
    || event.type === 'DEFENDER_SELECTION_REQUESTED'
    || event.type === 'COMPARE_ROLL_REQUESTED'
    || event.type === 'INTERACTION_REQUESTED';

const hasPendingBonusDiceSettlement = (core: DiceThroneCore): boolean =>
    core.pendingBonusDiceSettlement !== null
    && core.pendingBonusDiceSettlement !== undefined;

const hasInteractivePendingBonusDiceSettlement = (core: DiceThroneCore): boolean =>
    hasPendingBonusDiceSettlement(core)
    && (
        core.pendingBonusDiceSettlement?.displayOnly !== true
        || core.pendingBonusDiceSettlement?.allowDiceModification === true
    );

registerBonusDiceSettlementHandler(POWDER_KEG_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
    const playerId = settlement.attackerId;
    const value = Math.max(1, Math.min(6, Math.trunc(getPendingBonusSettlementDice(settlement)[0]?.value ?? 1)));
    const followupEvents: DiceThroneEvent[] = [];

    if (value <= 2) {
        followupEvents.push(...buildPowderKegExplosionEvents({
            state,
            targetId: playerId,
            sourceAbilityId: POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID,
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.01,
        }));
    } else if (value === 6) {
        const targetIds = getPowderKegTransferTargetIds(state, playerId);
        if (targetIds.length > 0) {
            followupEvents.push({
                type: 'CHOICE_REQUESTED',
                payload: {
                    playerId,
                    sourceAbilityId: POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID,
                    titleKey: 'choices.powderKegTransfer.title',
                    options: targetIds.map((targetId, index) => ({
                        value: index,
                        customId: POWDER_KEG_TRANSFER_CHOICE_ID,
                        labelKey: 'choices.powderKegTransfer.give',
                        labelParams: { target: formatSeatLabel(targetId) },
                    })),
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 0.01,
            } as ChoiceRequestedEvent);
        }
    }

    return { totalDamage: 0, followupEvents };
});

registerBonusDiceSettlementHandler(BLINDED_CHECK_SETTLEMENT_ID, ({ settlement, timestamp }) => {
    const value = Math.max(1, Math.min(6, Math.trunc(getPendingBonusSettlementDice(settlement)[0]?.value ?? 1)));
    return {
        totalDamage: 0,
        followupEvents: [{
            type: 'PENDING_ATTACK_UPDATED',
            payload: {
                attackerId: settlement.attackerId,
                patch: {
                    blindedCheckResolved: true,
                    blindedCheckMissed: value <= 2,
                },
            },
            sourceCommandType: 'SKIP_BONUS_DICE_REROLL',
            timestamp: timestamp + 0.01,
        } as DiceThroneEvent],
    };
});

registerBonusDiceSettlementHandler(TIANSHi_DAZZLE_CHECK_SETTLEMENT_ID, ({ settlement, timestamp }) => {
    const value = Math.max(1, Math.min(6, Math.trunc(getPendingBonusSettlementDice(settlement)[0]?.value ?? 1)));
    return {
        totalDamage: 0,
        followupEvents: [{
            type: 'PENDING_ATTACK_UPDATED',
            payload: {
                attackerId: settlement.attackerId,
                patch: {
                    dazzleCheckResolved: true,
                    dazzleCheckMissed: value === 1,
                    dazzleDamagePercent: value === 2 || value === 3 ? -50 : 0,
                },
            },
            sourceCommandType: 'SKIP_BONUS_DICE_REROLL',
            timestamp: timestamp + 0.01,
        } as DiceThroneEvent],
    };
});

function extractResolvedInteractionChoiceShape(event: GameEvent): { sourceId?: string; customIds: string[] } | null {
    if (event.type !== 'SYS_INTERACTION_RESOLVED') {
        return null;
    }

    const payload = event.payload as {
        sourceId?: unknown;
        interactionData?: {
            options?: Array<{
                value?: {
                    customId?: unknown;
                };
            }>;
        };
    } | undefined;

    const customIds = Array.isArray(payload?.interactionData?.options)
        ? payload.interactionData.options
            .map((option) => option?.value?.customId)
            .filter((customId): customId is string => typeof customId === 'string')
        : [];

    return {
        sourceId: typeof payload?.sourceId === 'string' ? payload.sourceId : undefined,
        customIds,
    };
}

function resolvedOffensiveRollEndTokenChoiceThisRound(events: GameEvent[]): boolean {
    return events.some((event) => {
        const resolvedChoice = extractResolvedInteractionChoiceShape(event);
        if (!resolvedChoice) {
            return false;
        }

        if (resolvedChoice.sourceId === 'offensive-roll-end-token') {
            return true;
        }

        return resolvedChoice.customIds.some((customId) => customId.startsWith('use-'))
            && resolvedChoice.customIds.includes('skip');
    });
}

function resolvedTreantDivinePreventDebuffChoiceThisRound(events: GameEvent[]): boolean {
    return events.some((event) => {
        const resolvedChoice = extractResolvedInteractionChoiceShape(event);
        if (!resolvedChoice) {
            return false;
        }

        return resolvedChoice.sourceId === TOKEN_IDS.TREANT_DIVINE
            && resolvedChoice.customIds.some((customId) =>
                customId === TREANT_DIVINE_PREVENT_DEBUFF_CHOICE_ID
                || customId === TREANT_DIVINE_SKIP_DEBUFF_CHOICE_ID
            );
    });
}

function createOffensiveRollEndTokenChoiceEvent(
    core: DiceThroneCore,
    attackerId: string,
    sourceCommandType: string,
    timestamp: number,
): ChoiceRequestedEvent | null {
    if (!core.pendingAttack) {
        return null;
    }

    if (hasInteractivePendingBonusDiceSettlement(core) || core.pendingAttack.offensiveRollEndTokenResolved) {
        return null;
    }

    const expectedDamage = getPendingAttackExpectedDamage(core, core.pendingAttack);
    const offensiveRollEndTokens = getUsableTokensForOffensiveRollEnd(core, attackerId, expectedDamage);
    if (offensiveRollEndTokens.length === 0) {
        return null;
    }

    const tokenOptions = offensiveRollEndTokens.map(def => ({
        tokenId: def.id,
        value: 1,
        customId: `use-${def.id}`,
        labelKey: `tokens.${def.id}.name`,
    }));
    tokenOptions.push({
        tokenId: undefined as any,
        value: 0,
        customId: 'skip',
        labelKey: 'tokenResponse.skip',
    });

    return {
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId: core.pendingAttack.sourceAbilityId ?? 'offensive-roll-end-token',
            titleKey: 'offensiveRollEndToken.title',
            options: tokenOptions,
        },
        sourceCommandType,
        timestamp,
    };
}


function isIncomingDebuffApplication(core: DiceThroneCore, defenderId: string, event: GameEvent): boolean {
    if (event.type !== 'STATUS_APPLIED' && event.type !== 'TOKEN_GRANTED') return false;

    const payload = event.payload as { targetId?: unknown; statusId?: unknown; tokenId?: unknown };
    if (payload.targetId !== defenderId) return false;

    const id = typeof payload.statusId === 'string'
        ? payload.statusId
        : typeof payload.tokenId === 'string'
            ? payload.tokenId
            : undefined;
    if (!id) return false;

    return core.tokenDefinitions.find(def => def.id === id)?.category === 'debuff';
}

function preventIncomingDebuffsWithTreantDivine(
    core: DiceThroneCore,
    generatedEvents: GameEvent[],
    sourceCommandType: string,
    timestamp: number,
): GameEvent[] {
    const pendingAttack = core.pendingAttack;
    const defenderId = pendingAttack?.defenderId;
    if (!defenderId) return generatedEvents;

    const defender = core.players[defenderId];
    const divineStacks = defender?.tokens?.[TOKEN_IDS.TREANT_DIVINE] ?? 0;
    if (divineStacks <= 0) return generatedEvents;
    if (hasSpentTreantTreeSpiritThisTurn(core, defenderId, TOKEN_IDS.TREANT_DIVINE)) return generatedEvents;

    const hasIncomingDebuff = generatedEvents.some(event => isIncomingDebuffApplication(core, defenderId, event));
    if (!hasIncomingDebuff) return generatedEvents;

    if (pendingAttack?.treantDivinePreventDebuffChoice === 'skip') {
        return generatedEvents;
    }

    if (pendingAttack?.treantDivinePreventDebuffChoice !== 'prevent') {
        return [{
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: defenderId,
                sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
                titleKey: 'choices.treantDivinePreventDebuff.title',
                options: [
                    {
                        value: 1,
                        customId: TREANT_DIVINE_PREVENT_DEBUFF_CHOICE_ID,
                        labelKey: 'choices.treantDivinePreventDebuff.prevent',
                    },
                    {
                        value: 0,
                        customId: TREANT_DIVINE_SKIP_DEBUFF_CHOICE_ID,
                        labelKey: 'choices.treantDivinePreventDebuff.skip',
                    },
                ],
            },
            sourceCommandType,
            timestamp,
        } as ChoiceRequestedEvent];
    }

    const filteredEvents = generatedEvents.filter(event => !isIncomingDebuffApplication(core, defenderId, event));
    return [
        {
            type: 'TOKEN_CONSUMED',
            payload: {
                playerId: defenderId,
                tokenId: TOKEN_IDS.TREANT_DIVINE,
                amount: 1,
                newTotal: Math.max(0, divineStacks - 1),
                sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
            },
            sourceCommandType,
            timestamp,
        } as DiceThroneEvent,
        {
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId: defenderId,
                value: 0,
                sourceId: TOKEN_IDS.TREANT_DIVINE,
                preventStatus: true,
            },
            sourceCommandType,
            timestamp: timestamp + 0.001,
        } as DamageShieldGrantedEvent,
        ...filteredEvents,
    ];
}

function resolvePassivePhaseTriggerEvents(args: {
    state: DiceThroneCore;
    playerId: string;
    phase: TurnPhase;
    triggerType: 'phaseStart' | 'phaseEnd';
    timestamp: number;
    random?: RandomFn;
}): DiceThroneEvent[] {
    const player = args.state.players[args.playerId];
    if (!player) return [];

    const activeDice = getActiveDice(args.state);
    const triggerCtx = {
        currentPhase: args.phase,
        resources: player.resources,
        statusEffects: player.statusEffects,
        diceValues: activeDice.map(die => die.value),
        faceCounts: getFaceCounts(activeDice),
    };

    const events: DiceThroneEvent[] = [];
    const resolvePassiveEffects = (sourceAbilityId: string, effects: typeof player.abilities[number]['effects']) => {
        if (!effects?.length) return;
        events.push(...resolveEffectsToEvents(
            effects,
            'immediate',
            {
                attackerId: args.playerId,
                defenderId: args.state.pendingAttack?.defenderId ?? args.playerId,
                sourceAbilityId,
                state: args.state,
                damageDealt: 0,
                timestamp: args.timestamp,
            },
            { random: args.random },
        ));
    };

    for (const ability of player.abilities) {
        if (ability.type !== 'passive') continue;

        if (ability.trigger?.type === args.triggerType && evaluateTriggerCondition(ability.trigger, triggerCtx)) {
            resolvePassiveEffects(ability.id, ability.effects);
        }

        for (const variant of ability.variants ?? []) {
            if (variant.trigger.type !== args.triggerType) continue;
            if (!evaluateTriggerCondition(variant.trigger, triggerCtx)) continue;
            resolvePassiveEffects(ability.id, variant.effects);
        }
    }

    return events;
}

/**
 * 计算玩家当前“额外攻击类眩晕”层数（包含 core 中的和 events 中的）
 * 
 * @param core - 当前游戏状态
 * @param playerId - 玩家 ID
 * @param events - 待处理的事件数组
 * @returns 眩晕总层数
 */
function getTotalImmediateExtraAttackStacksByStatus(
    core: DiceThroneCore,
    playerId: string,
    events: GameEvent[],
    statusId: string,
): number {
    const player = core.players[playerId];
    const statusInCore = player?.statusEffects[statusId] ?? 0;

    const appliedInEvents = events.filter(e =>
        e.type === 'STATUS_APPLIED' &&
        e.payload.targetId === playerId &&
        e.payload.statusId === statusId
    ).reduce((sum, e) => sum + (e.payload as any).stacks, 0);

    const removedInEvents = events.filter(e =>
        e.type === 'STATUS_REMOVED' && 
        e.payload.targetId === playerId && 
        e.payload.statusId === statusId
    ).reduce((sum, e) => sum + e.payload.stacks, 0);

    return statusInCore + appliedInEvents - removedInEvents;
}

/**
 * 检查防御方是否有“额外攻击类眩晕”（daze / legacy stun）
 * 规则：攻击结算后，如果防御方有这类眩晕，立即移除并让攻击方再次攻击
 * 
 * 正确理解：
 * - Player A 攻击 Player B，施加眩晕给 Player B
 * - 攻击结算后，立即检查 Player B 是否有眩晕
 * - 如果有，立即移除眩晕 + Player A 再次攻击（额外攻击）
 * 
 * @returns 额外攻击事件数组 + 是否触发了额外攻击
 */
function checkDazeExtraAttack(
    core: DiceThroneCore,
    events: GameEvent[],
    commandType: string,
    timestamp: number
): { dazeEvents: GameEvent[]; triggered: boolean } {
    // 从已生成的事件中找到 ATTACK_RESOLVED，获取攻击信息
    const attackResolved = events.find(e => e.type === 'ATTACK_RESOLVED') as
        Extract<DiceThroneEvent, { type: 'ATTACK_RESOLVED' }> | undefined;
    if (!attackResolved) return { dazeEvents: [], triggered: false };

    const { attackerId, defenderId } = attackResolved.payload;
    if (!defenderId) return { dazeEvents: [], triggered: false };
    
    const statusIds = [STATUS_IDS.DAZE, STATUS_IDS.STUN];
    const statusTotals = statusIds
        .map((statusId) => ({
            statusId,
            stacks: getTotalImmediateExtraAttackStacksByStatus(core, defenderId, events, statusId),
        }))
        .filter((entry) => entry.stacks > 0);

    const totalDaze = statusTotals.reduce((sum, entry) => sum + entry.stacks, 0);
    if (totalDaze <= 0) return { dazeEvents: [], triggered: false };

    const dazeEvents: GameEvent[] = [];

    for (const entry of statusTotals) {
        dazeEvents.push({
            type: 'STATUS_REMOVED',
            payload: { targetId: defenderId, statusId: entry.statusId, stacks: entry.stacks },
            sourceCommandType: commandType,
            timestamp,
        } as StatusRemovedEvent);
    }

    // 触发额外攻击：攻击方再次攻击防御方
    dazeEvents.push({
        type: 'EXTRA_ATTACK_TRIGGERED',
        payload: {
            attackerId: attackerId,  // 攻击方获得额外攻击
            targetId: defenderId,    // 攻击防御方（有眩晕的玩家）
            sourceStatusId: STATUS_IDS.DAZE,
        },
        sourceCommandType: commandType,
        timestamp,
    } as ExtraAttackTriggeredEvent);

    return { dazeEvents, triggered: true };
}

/**
 * 闪避后的 postDamage 状态修正
 *
 * 闪避（evasive）完全免除伤害时，resolvedDamage 为 0（因为没有 DAMAGE_DEALT 事件）。
 * 但攻击仍然"命中"了——伤害只是被闪避免除，非伤害效果（grantToken/inflictStatus 等）
 * 仍应执行。与潜行（sneak）语义一致：攻击成功但伤害被免除。
 *
 * 将 resolvedDamage 设为基础伤害值，让 onHit 条件正确判定为"命中"。
 * 调用方需要过滤掉 DAMAGE_DEALT 事件（伤害已被闪避免除）。
 */
function getCoreForPostDamageAfterEvasion(core: DiceThroneCore): DiceThroneCore {
    const pending = core.pendingAttack;
    if (!pending) return core;

    // 只在完全闪避（resolvedDamage 为 0 且 damageResolved 为 true）时修正
    // 非闪避场景（如正常减伤后 resolvedDamage > 0）不需要修正
    if ((pending.resolvedDamage ?? 0) > 0) return core;

    const baseDamage = getPendingAttackExpectedDamage(core, pending, 1);
    return {
        ...core,
        pendingAttack: {
            ...pending,
            resolvedDamage: baseDamage,
        },
    };
}

/**
 * 攻击结算后检查是否需要开响应窗口（如 card-dizzy：造成 ≥8 伤害后打出）
 * 需要先 applyEvents 得到含 lastResolvedAttackDamage 的状态再检查
 */
function checkAfterAttackResponseWindow(
    core: DiceThroneCore,
    allEvents: GameEvent[],
    commandType: string,
    timestamp: number,
    phase: TurnPhase
): ResponseWindowOpenedEvent | null {
    const attackResolved = allEvents.find(e => e.type === 'ATTACK_RESOLVED') as
        Extract<DiceThroneEvent, { type: 'ATTACK_RESOLVED' }> | undefined;

    // 先 apply 所有事件得到最新状态（含 lastResolvedAttackDamage）
    const stateAfterAttack = applyEvents(core, allEvents as DiceThroneEvent[], reduce);

    const attackSequence = stateAfterAttack.attackResolvedSequence ?? 0;
    if (!attackResolved && attackSequence === 0) {
        return null;
    }
    if (attackSequence > 0 && stateAfterAttack.afterAttackResponseWindowSequence === attackSequence) {
        return null;
    }

    const responsePhase: TurnPhase = 'main2';

    // 找到攻击方 ID
    if (!attackResolved) {
        // 兼容“攻击已结算但 ATTACK_RESOLVED 不在当前批次事件里”的真实链路。
        // 这类路径下 activePlayerId 仍是攻击方，而 afterAttackResolved 本就只允许攻击方响应。
        const attackerId = stateAfterAttack.activePlayerId;
        if (!attackerId) return null;

        if (!hasRespondableContent(stateAfterAttack, attackerId, 'afterAttackResolved', undefined, responsePhase)) {
            return null;
        }

        return {
            type: 'RESPONSE_WINDOW_OPENED',
            payload: {
                windowId: `afterAttackResolved-${timestamp}`,
                responderQueue: [attackerId],
                windowType: 'afterAttackResolved',
            },
            sourceCommandType: commandType,
            timestamp,
        } as ResponseWindowOpenedEvent;
    }

    const { attackerId, defenderId } = attackResolved.payload;
    if (!defenderId) return null;

    // 只允许进攻方响应（card-dizzy："如果你对对手造成至少8伤害"，只有进攻方才能触发）
    // excludeId = defenderId，防止防御方也进入响应队列
    const responderQueue = getResponderQueue(stateAfterAttack, 'afterAttackResolved', attackerId, undefined, defenderId, responsePhase);
    if (responderQueue.length === 0) return null;

    return {
        type: 'RESPONSE_WINDOW_OPENED',
        payload: {
            windowId: `afterAttackResolved-${timestamp}`,
            responderQueue,
            windowType: 'afterAttackResolved',
        },
        sourceCommandType: commandType,
        timestamp,
    } as ResponseWindowOpenedEvent;
}

function resolvePostAttackFollowUp(
    core: DiceThroneCore,
    events: GameEvent[],
    commandType: string,
    timestamp: number,
    phase: TurnPhase
): PhaseExitResult {
    const parleyStacks = core.players[core.activePlayerId]?.statusEffects[STATUS_IDS.PARLEY] ?? 0;
    if (parleyStacks > 0) {
        events.push({
            type: 'STATUS_REMOVED',
            payload: {
                targetId: core.activePlayerId,
                statusId: STATUS_IDS.PARLEY,
                stacks: parleyStacks,
            },
            sourceCommandType: commandType,
            timestamp,
        } as StatusRemovedEvent);
    }

    const { dazeEvents, triggered } = checkDazeExtraAttack(core, events, commandType, timestamp);
    if (triggered) {
        events.push(...dazeEvents);
        return { events, overrideNextPhase: 'offensiveRoll' };
    }

    const existingExtraAttack = events.find(e => e.type === 'EXTRA_ATTACK_TRIGGERED');
    const pendingExtraAttack = core.extraAttackInProgress;
    if (existingExtraAttack || (pendingExtraAttack && pendingExtraAttack.phaseEntered !== true)) {
        return { events, overrideNextPhase: 'offensiveRoll' };
    }

    const afterAttackWindow = checkAfterAttackResponseWindow(core, events, commandType, timestamp, phase);
    if (afterAttackWindow) {
        events.push(afterAttackWindow);
        return { events, halt: true };
    }

    return { events, overrideNextPhase: 'main2' };
}

function resolveNanobombUpkeepEvents(
    core: DiceThroneCore,
    playerId: string,
    sourceCommandType: string,
    timestamp: number,
    random?: RandomFn,
): DiceThroneEvent[] {
    const stacks = core.players[playerId]?.statusEffects[STATUS_IDS.NANOBOMB] ?? 0;
    if (stacks <= 0 || !random) return [];

    const events: DiceThroneEvent[] = [];
    let removedStacks = 0;

    for (let index = 0; index < stacks; index += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(core, playerId, value) ?? '';
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId,
                targetPlayerId: playerId,
                effectKey: 'bonusDie.effect.artificerNanobombUpkeep',
                effectParams: { value },
            },
            sourceCommandType,
            timestamp: timestamp + index * 0.001,
        } as BonusDieRolledEvent);
        if (value === 6) {
            removedStacks += 1;
        }
    }

    if (removedStacks > 0) {
        events.push({
            type: 'STATUS_REMOVED',
            payload: {
                targetId: playerId,
                statusId: STATUS_IDS.NANOBOMB,
                stacks: removedStacks,
            },
            sourceCommandType,
            timestamp: timestamp + stacks * 0.001,
        } as StatusRemovedEvent);
    }

    return events;
}

function appendPendingAttackResolvedEvent(
    pendingAttack: DiceThroneCore['pendingAttack'],
    events: GameEvent[],
    commandType: string,
    timestamp: number,
): boolean {
    if (!pendingAttack?.defenderId) {
        return false;
    }
    events.push(buildPendingAttackResolvedEvent(pendingAttack, commandType, timestamp));
    return true;
}

function resolveCursedPirateNoAttackPowderKegEvents(
    core: DiceThroneCore,
    commandType: string,
    timestamp: number,
): DiceThroneEvent[] {
    const activePlayerId = core.activePlayerId;
    if (!core.players[activePlayerId]) return [];
    if (core.offensiveRollAttackMadeThisTurn?.[activePlayerId]) return [];

    const hasOpposingCursedPirate = getOpponents(core, activePlayerId)
        .some((playerId) => {
            const player = core.players[playerId];
            return player?.characterId === 'cursed_pirate' && player.playerBoardFace === 'cursed';
        });
    if (!hasOpposingCursedPirate) return [];

    return buildStatusAppliedOrChoiceEvents({
        state: core,
        targetId: activePlayerId,
        statusId: STATUS_IDS.POWDER_KEG,
        stacks: 1,
        sourceAbilityId: 'cursed',
        sourceCommandType: commandType,
        timestamp,
    });
}

function resolvePowderKegUpkeepEvents(
    core: DiceThroneCore,
    playerId: string,
    commandType: string,
    timestamp: number,
    random: RandomFn,
): DiceThroneEvent[] {
    const player = core.players[playerId];
    if (!player || (player.statusEffects[STATUS_IDS.POWDER_KEG] ?? 0) <= 0) return [];

    const value = random.d(6);
    const die = {
        index: 0,
        value,
        face: String(value),
        effectKey: `bonusDie.effect.powderKeg.${value}`,
        effectParams: { value },
    };
    const settlement: PendingBonusDiceSettlement = {
        id: `${POWDER_KEG_SETTLEMENT_ID}-${timestamp}`,
        sourceAbilityId: POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID,
        attackerId: playerId,
        targetId: playerId,
        dice: [die],
        rerollCostTokenId: '',
        rerollCostAmount: 0,
        rerollCount: 0,
        maxRerollCount: 0,
        readyToSettle: false,
        displayOnly: true,
        showTotal: false,
        customResolutionId: POWDER_KEG_SETTLEMENT_ID,
        allowDiceModification: true,
        opensAfterRollConfirmedResponseWindow: value <= 2 || value === 6,
    };
    return [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face: String(value),
            playerId,
            targetPlayerId: playerId,
            effectKey: `bonusDie.effect.powderKeg.${value}`,
        },
        sourceCommandType: commandType,
        timestamp,
    } as DiceThroneEvent, {
        type: 'BONUS_DICE_REROLL_REQUESTED',
        payload: { settlement },
        sourceCommandType: commandType,
        timestamp,
    } as DiceThroneEvent];
}

function resolveBlindedCheckExitResult(
    core: DiceThroneCore,
    pendingAttack: NonNullable<DiceThroneCore['pendingAttack']>,
    sourceCommandType: string,
    timestamp: number,
    random?: RandomFn,
): PhaseExitResult | null {
    if (pendingAttack.blindedCheckResolved === true) {
        return pendingAttack.blindedCheckMissed === true
            ? { events: [], overrideNextPhase: 'main2' }
            : null;
    }

    const blindedStacks = core.players[pendingAttack.attackerId]?.statusEffects[STATUS_IDS.BLINDED] ?? 0;
    if (blindedStacks <= 0 || !random) {
        return null;
    }

    const value = random.d(6);
    const face = getPlayerDieFace(core, pendingAttack.attackerId, value) ?? '';
    const effectKey = value <= 2
        ? 'bonusDie.effect.blinded.miss'
        : 'bonusDie.effect.blinded.hit';
    const settlement: PendingBonusDiceSettlement = {
        id: `${BLINDED_CHECK_SETTLEMENT_ID}-${pendingAttack.attackerId}-${timestamp}`,
        sourceAbilityId: STATUS_IDS.BLINDED,
        attackerId: pendingAttack.attackerId,
        targetId: pendingAttack.attackerId,
        dice: [{
            index: 0,
            value,
            face,
            effectKey,
            effectParams: { value },
        }],
        rerollCostTokenId: '',
        rerollCostAmount: 0,
        rerollCount: 0,
        maxRerollCount: 0,
        readyToSettle: false,
        displayOnly: true,
        showTotal: false,
        resolutionMode: 'none',
        customResolutionId: BLINDED_CHECK_SETTLEMENT_ID,
        allowDiceModification: true,
        opensAfterRollConfirmedResponseWindow: value <= 2,
    };

    return {
        events: [{
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: pendingAttack.attackerId,
                targetPlayerId: pendingAttack.attackerId,
                effectKey,
                effectParams: { value },
            },
            sourceCommandType,
            timestamp,
        } as DiceThroneEvent, {
            type: 'STATUS_REMOVED',
            payload: {
                targetId: pendingAttack.attackerId,
                statusId: STATUS_IDS.BLINDED,
                stacks: blindedStacks,
            },
            sourceCommandType,
            timestamp,
        } as StatusRemovedEvent, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            sourceCommandType,
            timestamp,
        } as DiceThroneEvent],
        halt: true,
    };
}

function resolveDazzleCheckExitResult(
    core: DiceThroneCore,
    pendingAttack: NonNullable<DiceThroneCore['pendingAttack']>,
    sourceCommandType: string,
    timestamp: number,
    random?: RandomFn,
): PhaseExitResult | null {
    if (pendingAttack.dazzleCheckResolved === true) {
        return pendingAttack.dazzleCheckMissed === true
            ? { events: [], overrideNextPhase: 'main2' }
            : null;
    }

    const dazzleStacks = core.players[pendingAttack.attackerId]?.statusEffects[STATUS_IDS.DAZZLE] ?? 0;
    if (dazzleStacks <= 0 || !random) {
        return null;
    }

    const value = random.d(6);
    const face = getPlayerDieFace(core, pendingAttack.attackerId, value) ?? '';
    const settlement: PendingBonusDiceSettlement = {
        id: `${TIANSHi_DAZZLE_CHECK_SETTLEMENT_ID}-${pendingAttack.attackerId}-${timestamp}`,
        sourceAbilityId: STATUS_IDS.DAZZLE,
        attackerId: pendingAttack.attackerId,
        targetId: pendingAttack.defenderId ?? pendingAttack.attackerId,
        dice: [{
            index: 0,
            value,
            face,
            effectKey: 'bonusDie.effect.tianshi.dazzle',
            effectParams: { value },
        }],
        rerollCostTokenId: '',
        rerollCostAmount: 0,
        rerollCount: 0,
        maxRerollCount: 0,
        readyToSettle: false,
        displayOnly: true,
        showTotal: false,
        resolutionMode: 'none',
        customResolutionId: TIANSHi_DAZZLE_CHECK_SETTLEMENT_ID,
        allowDiceModification: false,
    };

    return {
        events: [{
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: pendingAttack.attackerId,
                targetPlayerId: pendingAttack.defenderId ?? pendingAttack.attackerId,
                effectKey: 'bonusDie.effect.tianshi.dazzle',
                effectParams: { value },
            },
            sourceCommandType,
            timestamp,
        } as BonusDieRolledEvent, {
            type: 'STATUS_REMOVED',
            payload: {
                targetId: pendingAttack.attackerId,
                statusId: STATUS_IDS.DAZZLE,
                stacks: 1,
            },
            sourceCommandType,
            timestamp: timestamp + 0.001,
        } as StatusRemovedEvent, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            sourceCommandType,
            timestamp: timestamp + 0.002,
        } as DiceThroneEvent],
        halt: true,
    };
}

function resolveTianshiDivineArrivalUpkeepEvents(
    core: DiceThroneCore,
    playerId: string,
    sourceCommandType: string,
    timestamp: number,
    random?: RandomFn,
): DiceThroneEvent[] {
    const stacks = core.players[playerId]?.tokens[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0;
    if (stacks <= 0) return [];

    return getOpponents(core, playerId).flatMap((targetId, index) => {
        const eventTimestamp = timestamp + index * 0.01;
        const result = createDamageCalculation({
            source: { playerId, abilityId: TOKEN_IDS.DIVINE_ARRIVAL },
            target: { playerId: targetId },
            baseDamage: stacks,
            damageScope: 'direct',
            state: core,
            timestamp: eventTimestamp,
            autoCollectShields: false,
            passiveTriggerHandler: createDTPassiveTriggerHandler({
                attackerId: playerId,
                defenderId: targetId,
                sourceAbilityId: TOKEN_IDS.DIVINE_ARRIVAL,
                state: core,
                damageDealt: 0,
                timestamp: eventTimestamp,
            }, random),
        }).resolve();
        const events: DiceThroneEvent[] = [...result.sideEffectEvents] as DiceThroneEvent[];
        if (result.finalDamage > 0) {
            events.push({
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId,
                    amount: result.finalDamage,
                    actualDamage: result.actualDamage,
                    sourceAbilityId: TOKEN_IDS.DIVINE_ARRIVAL,
                    sourcePlayerId: playerId,
                    damageScope: 'direct',
                    modifiers: result.modifiers.map(modifier => ({
                        type: modifier.type as 'flat' | 'percent' | 'token' | 'status' | 'shield',
                        value: modifier.value,
                        sourceId: modifier.sourceId,
                        sourceName: modifier.sourceName,
                    })),
                    breakdown: result.breakdown,
                },
                sourceCommandType,
                timestamp: eventTimestamp,
            } as DiceThroneEvent);
        }
        return events.map(event => ({
            ...event,
            sourceCommandType,
        }));
    });
}

export const diceThroneFlowHooks: FlowHooks<DiceThroneCore> = {
    initialPhase: 'setup',

    canAdvance: ({ state }) => {
        const phase = state.sys.phase as TurnPhase;
        const ok = canAdvancePhase(state.core, phase);
        
        return ok ? { ok: true } : { ok: false, error: 'cannot_advance_phase' };
    },

    getCurrentPlayerId: ({ state }) => {
        const phase = state.sys.phase as TurnPhase;
        // 防御阶段由防御方推进，其他阶段由回合拥有者推进
        return phase === 'defensiveRoll'
            ? getRollerId(state.core, phase)
            : state.core.activePlayerId;
    },

    getNextPhase: ({ state }) => getNextPhase(state.core, state.sys.phase as TurnPhase),

    getActivePlayerId: ({ state, from, to, exitEvents }) => {
        // 特殊处理：discard 阶段退出后切换回合，此时需要返回下一位玩家
        // 因为 TURN_CHANGED 事件还未被 reduce
        if (from === 'discard') {
            return getNextPlayerId(state.core);
        }
        // 额外攻击触发：检查 exitEvents 中是否有 EXTRA_ATTACK_TRIGGERED
        // 注意：exitEvents 尚未 reduce 进 core，所以需要直接检查事件
        const extraAttackEvent = exitEvents?.find(e => e.type === 'EXTRA_ATTACK_TRIGGERED') as
            ExtraAttackTriggeredEvent | undefined;
        if (extraAttackEvent) {
            return extraAttackEvent.payload.attackerId;
        }
        // 额外攻击进行中（已 reduce 进 core 的情况，如从 offensiveRoll 进入 main2）
        if (state.core.extraAttackInProgress) {
            // 额外攻击结束（进入 main2）：恢复原回合活跃玩家
            if (to === 'main2') {
                return state.core.extraAttackInProgress.originalActivePlayerId;
            }
            // 额外攻击进行中：活跃玩家是额外攻击方
            return state.core.extraAttackInProgress.attackerId;
        }
        return state.core.activePlayerId;
    },

    onPhaseExit: ({ state, from, to, command, random }): PhaseExitResult | GameEvent[] | void => {
        const core = state.core;
        const events: GameEvent[] = [];
        const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

        // ========== upkeep 阶段退出：检查脑震荡状态 ==========
        if (from === 'upkeep' && to === 'income') {
            const player = core.players[core.activePlayerId];
            // 脑震荡 (concussion) — 跳过收入阶段并移除
            // 注意：必须在 onPhaseExit 中处理，onPhaseEnter 返回 GameEvent[] 无法跳过阶段
            const concussionStacks = player?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
            if (concussionStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: core.activePlayerId, statusId: STATUS_IDS.CONCUSSION, stacks: concussionStacks },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
                return { events, overrideNextPhase: 'main1' };
            }
        }

        // ========== setup 阶段退出：初始化所有玩家角色数据 ==========
        if (from === 'setup') {
            const playerIds = Object.keys(core.players);
            const initEvents: GameEvent[] = [];

            // 教程/本地模式：自动为所有玩家选择默认角色
            const mode = getGameMode();
            const isTutorialMode = mode === 'tutorial';
            const isLocalMode = mode === 'local';

            if (isTutorialMode) {
                // 教学模式：双方默认选择僧侣（用于统一教程流程）
                if (!core.selectedCharacters['0'] || core.selectedCharacters['0'] === 'unselected') {
                    core.selectedCharacters['0'] = 'monk';
                }
                if (!core.selectedCharacters['1'] || core.selectedCharacters['1'] === 'unselected') {
                    core.selectedCharacters['1'] = 'monk';
                }
            }

            if (isLocalMode) {
                for (const pid of playerIds) {
                    const selected = core.selectedCharacters[pid];
                    if (!selected || selected === 'unselected') {
                        core.selectedCharacters[pid] = pid === '0' ? 'monk' : 'barbarian';
                    }
                }
            }

            for (const pid of playerIds) {
                const charId = core.selectedCharacters[pid];
                if (charId && charId !== 'unselected') {
                    initEvents.push({
                        type: 'HERO_INITIALIZED',
                        payload: {
                            playerId: pid,
                            characterId: charId as any,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as any);
                }
            }

            // 同时创建骰子（如果是首位玩家，通常使用他的角色骰子，或者由系统在 EnterRollPhase 时切换）
            // 初始骰子逻辑在进入 RollPhase 时会自动 resetDice
            
            if (initEvents.length > 0) {
                events.push(...initEvents);
            }
        }

        // ========== main1 阶段退出：检查击倒状态 ==========
        if (from === 'main1' && to === 'offensiveRoll') {
            const player = core.players[core.activePlayerId];
            const knockdownStacks = player?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
            if (knockdownStacks > 0) {
                // 有击倒状态，跳过 offensiveRoll 并移除击倒
                const statusRemovedEvent: StatusRemovedEvent = {
                    type: 'STATUS_REMOVED',
                    payload: {
                        targetId: core.activePlayerId,
                        statusId: STATUS_IDS.KNOCKDOWN,
                        stacks: knockdownStacks,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(statusRemovedEvent);
                return { events, overrideNextPhase: 'main2' };
            }
        }

        // ========== offensiveRoll 阶段退出：攻击前处理 ==========
        if (from === 'offensiveRoll') {
            if (core.offensiveRollAttemptsThisTurn !== core.rollCount) {
                events.push({
                    type: 'OFFENSIVE_ROLL_ATTEMPTS_RECORDED',
                    payload: {
                        playerId: core.activePlayerId,
                        attempts: core.rollCount,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
            }

            const activePlayer = core.players[core.activePlayerId];
            const thornStacks = activePlayer?.tokens?.[TOKEN_IDS.THORN] ?? 0;
            if (thornStacks > 0) {
                const extraRollAttempts = Math.min(Math.max(0, core.rollCount - 1), 2);
                events.push({
                    type: 'TOKEN_CONSUMED',
                    payload: {
                        playerId: core.activePlayerId,
                        tokenId: TOKEN_IDS.THORN,
                        amount: thornStacks,
                        newTotal: 0,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as TokenConsumedEvent);

                if (extraRollAttempts > 0) {
                    const hp = activePlayer?.resources[RESOURCE_IDS.HP] ?? 0;
                    events.push({
                        type: 'DAMAGE_DEALT',
                        payload: {
                            targetId: core.activePlayerId,
                            amount: extraRollAttempts,
                            actualDamage: Math.min(extraRollAttempts, hp),
                            sourceAbilityId: TOKEN_IDS.THORN,
                        },
                        sourceCommandType: command.type,
                        timestamp: timestamp + 0.001,
                    } as DamageDealtEvent);
                }
            }

            const bindStacks = activePlayer?.statusEffects[STATUS_IDS.BIND] ?? 0;
            if (bindStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: {
                        targetId: core.activePlayerId,
                        statusId: STATUS_IDS.BIND,
                        stacks: bindStacks,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as StatusRemovedEvent);
            }

            const parleyStacks = activePlayer?.statusEffects[STATUS_IDS.PARLEY] ?? 0;
            if (parleyStacks > 0 && !core.pendingAttack) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: {
                        targetId: core.activePlayerId,
                        statusId: STATUS_IDS.PARLEY,
                        stacks: parleyStacks,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as StatusRemovedEvent);
            }

            if (core.pendingAttack) {
                const pendingAttackStage = getPendingAttackSettlementStage(core.pendingAttack);
                if (pendingAttackNeedsTargetingRoll(core) && pendingAttackStage === 'targeting') {
                    return { events, overrideNextPhase: 'targetingRoll' };
                }

                // 伤害已通过 Token 响应结算（autoContinue 重入），继续执行后续 withDamage 效果。
                // resolvePostDamageEffects 会跳过已结算的 damage，但保留 rollDie 等后续效果。
                if (pendingAttackStage === 'postDamagePending') {
                    // 闪避修正：完全闪避时 resolvedDamage 为 0，但攻击仍视为命中
                    // 将 resolvedDamage 设为基础伤害让 onHit 效果正确触发
                    const coreForPostDamage = getCoreForPostDamageAfterEvasion(core);
                    const isFullyEvaded = coreForPostDamage !== core;
                    const postDamageEvents = resolvePostDamageEffects(coreForPostDamage, random, timestamp, {
                        includeWithDamage: coreForPostDamage.pendingAttack?.damageResolved === true,
                        continueWithDamageAfterFirstDamage: coreForPostDamage.pendingAttack?.damageResolved === true,
                    });
                    // 闪避免伤：过滤掉 DAMAGE_DEALT 事件（伤害已被闪避免除，非伤害效果仍生效）
                    const filteredPostDamageEvents = isFullyEvaded
                        ? postDamageEvents.filter(e => e.type !== 'DAMAGE_DEALT')
                        : postDamageEvents;
                    events.push(...filteredPostDamageEvents);

                    // rollDie 等效果可能产生 BONUS_DICE_REROLL_REQUESTED，需要暂停让 UI 展示
                    // displayOnly settlement 不需要 halt（伤害已在同批事件中处理）
                    const hasBonusDiceRerollOffDR = postDamageEvents.some(e => 
                        e.type === 'BONUS_DICE_REROLL_REQUESTED' && 
                        !(e as any).payload?.settlement?.displayOnly
                    );
                    if (hasBonusDiceRerollOffDR) {
                        return { events, halt: true };
                    }

                    if (postDamageEvents.some(isBlockingInteractionEvent)) {
                        return { events, halt: true };
                    }

                    if (!appendPendingAttackResolvedEvent(coreForPostDamage.pendingAttack, events, command.type, timestamp)) {
                        return { events, halt: true };
                    }
                    return resolvePostAttackFollowUp(core, events, command.type, timestamp, from as TurnPhase);
                }

                // 奖励骰收口、或 postDamage/withDamage 内挂起的后续选择已完成时，
                // 主伤害都已落地；这里只需生成 ATTACK_RESOLVED 并推进到 main2。
                if (pendingAttackStage === 'readyToResolve') {
                    if (!appendPendingAttackResolvedEvent(core.pendingAttack, events, command.type, timestamp)) {
                        return { events, halt: true };
                    }
                    return resolvePostAttackFollowUp(core, events, command.type, timestamp, from as TurnPhase);
                }

                const dazzleCheckResult = resolveDazzleCheckExitResult(
                    core,
                    core.pendingAttack,
                    command.type,
                    timestamp,
                    random,
                );
                if (dazzleCheckResult) {
                    return {
                        ...dazzleCheckResult,
                        events: [...events, ...(dazzleCheckResult.events ?? [])],
                    };
                }

                // ========== 致盲判定：攻击方有致盲时投掷1骰，确认前允许改骰牌修改 ==========
                const blindedCheckResult = resolveBlindedCheckExitResult(
                    core,
                    core.pendingAttack,
                    command.type,
                    timestamp,
                    random,
                );
                if (blindedCheckResult) {
                    return {
                        ...blindedCheckResult,
                        events: [...events, ...(blindedCheckResult.events ?? [])],
                    };
                }

                // ========== 潜行判定：防御方有潜行时跳过防御掷骰、免除伤害 ==========
                // Ultimate Damage 不可被防御方以状态效果回避；普通不可防御伤害不走这个封锁口径。
                // 规则：潜行触发时只免伤（跳过防御掷骰），不消耗标记
                // 标记的移除只在"经过一个完整的自己回合后，回合末清除"（见 discard 阶段退出逻辑）
                const defender = core.pendingAttack.defenderId
                    ? core.players[core.pendingAttack.defenderId]
                    : undefined;
                const sneakStacks = defender?.tokens[TOKEN_IDS.SNEAK] ?? 0;
                if (core.pendingAttack.defenderId && sneakStacks > 0 && !core.pendingAttack.isUltimate) {
                    // 不消耗潜行标记——潜行在回合末自动弃除，触发免伤时不移除

                    // 处理 preDefense 效果（攻击方的非伤害效果仍然生效）
                    let preDefenseEventsSneak = resolveOffensivePreDefenseEffects(core, random, timestamp);
                    preDefenseEventsSneak = preventIncomingDebuffsWithTreantDivine(core, preDefenseEventsSneak, command.type, timestamp) as DiceThroneEvent[];
                    events.push(...preDefenseEventsSneak);

                    const hasSneakChoice = preDefenseEventsSneak.some(isBlockingInteractionEvent);
                    const hasBonusDiceRerollPreDefenseSneak = preDefenseEventsSneak.some((event) => 
                        event.type === 'BONUS_DICE_REROLL_REQUESTED' && 
                        !(event as any).payload?.settlement?.displayOnly
                    );
                    if (hasSneakChoice || hasBonusDiceRerollPreDefenseSneak) {
                        return { events, halt: true };
                    }

                    const coreAfterPreDefenseSneak = preDefenseEventsSneak.length > 0
                        ? applyEvents(core, [...events] as DiceThroneEvent[], reduce)
                        : core;

                    // 潜行免伤但攻击成功：onHit 条件需要 damageDealt >= 1 才触发
                    // 将 resolvedDamage 设为基础伤害值，让 onHit 正确判定为"命中"
                    const sneakBaseDamage = getPendingAttackExpectedDamage(coreAfterPreDefenseSneak, core.pendingAttack, 1);
                    const coreForPostDamage = {
                        ...coreAfterPreDefenseSneak,
                        pendingAttack: {
                            ...coreAfterPreDefenseSneak.pendingAttack!,
                            resolvedDamage: sneakBaseDamage,
                        },
                    };
                    const postDamageEventsSneak = resolvePostDamageEffects(coreForPostDamage, random, timestamp);
                    // 潜行免伤：过滤掉所有 DAMAGE_DEALT 事件（包括 rollDie 的 bonusDamage 独立伤害）
                    events.push(...postDamageEventsSneak.filter(e => e.type !== 'DAMAGE_DEALT'));

                    // === 与非潜行路径对齐的 halt 检查 ===
                    const hasBonusDiceRerollSneak = postDamageEventsSneak.some(e => 
                        e.type === 'BONUS_DICE_REROLL_REQUESTED' && 
                        !(e as any).payload?.settlement?.displayOnly
                    );
                    const hasPostDamageChoiceSneak = postDamageEventsSneak.some(isBlockingInteractionEvent);
                    const hasTokenResponseSneak = postDamageEventsSneak.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
                    if (hasBonusDiceRerollSneak || hasPostDamageChoiceSneak || hasTokenResponseSneak) {
                        return { events, halt: true };
                    }

                    if (!appendPendingAttackResolvedEvent(coreForPostDamage.pendingAttack, events, command.type, timestamp)) {
                        return { events, halt: true };
                    }
                    return resolvePostAttackFollowUp(core, events, command.type, timestamp, from as TurnPhase);
                }

                // 处理进攻方的 preDefense 效果
                let preDefenseEvents = resolveOffensivePreDefenseEffects(core, random, timestamp);
                preDefenseEvents = preventIncomingDebuffsWithTreantDivine(core, preDefenseEvents, command.type, timestamp) as DiceThroneEvent[];
                events.push(...preDefenseEvents);

                const hasChoice = preDefenseEvents.some(isBlockingInteractionEvent);
                // 只有非 displayOnly 的 bonus dice reroll 才需要 halt（displayOnly 不需要用户交互）
                const hasBonusDiceRerollPreDefense = preDefenseEvents.some((event) => 
                    event.type === 'BONUS_DICE_REROLL_REQUESTED' && 
                    !(event as any).payload?.settlement?.displayOnly
                );
                if (hasChoice || hasBonusDiceRerollPreDefense) {
                    // 需要用户做选择或处理奖励骰重掷，阻止阶段切换
                    return { events, halt: true };
                }

                const coreAfterPreDefense = preDefenseEvents.length > 0
                    ? applyEvents(core, preDefenseEvents as DiceThroneEvent[], reduce)
                    : core;

                // ========== 攻击掷骰阶段结束时 Token 使用（暴击、精准） ==========
                // 检查攻击方是否有可用的 onOffensiveRollEnd 时机 Token
                const attackerId = core.pendingAttack.attackerId;
                const offensiveRollEndChoiceEvent = createOffensiveRollEndTokenChoiceEvent(
                    coreAfterPreDefense,
                    attackerId,
                    command.type,
                    timestamp,
                );
                if (offensiveRollEndChoiceEvent) {
                    events.push(offensiveRollEndChoiceEvent);
                    return { events, halt: true };
                }

                if (pendingAttackNeedsTargetingRoll(core)) {
                    return { events, overrideNextPhase: 'targetingRoll' };
                }

                if (coreAfterPreDefense.pendingAttack?.isDefendable) {
                    // 攻击可防御，切换到防御阶段
                    return { events, overrideNextPhase: 'defensiveRoll' };
                }

                // 攻击不可防御，直接结算
                const attackEvents = resolveAttack(coreAfterPreDefense, random, { includePreDefense: false }, timestamp);
                events.push(...attackEvents);

                const hasAttackChoice = attackEvents.some(isBlockingInteractionEvent);
                const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                const hasBonusDiceRerollOff = attackEvents.some((event) => 
                    event.type === 'BONUS_DICE_REROLL_REQUESTED' && 
                    !(event as any).payload?.settlement?.displayOnly
                );
                if (hasAttackChoice || hasTokenResponse || hasBonusDiceRerollOff) {
                    return { events, halt: true };
                }

                return resolvePostAttackFollowUp(core, events, command.type, timestamp, from as TurnPhase);
            }
            // 额外攻击可能先把首次攻击的 afterAttackResolved 窗口延后到空壳 offensiveRoll 之后。
            events.push(...resolveCursedPirateNoAttackPowderKegEvents(core, command.type, timestamp));
            return resolvePostAttackFollowUp(core, events, command.type, timestamp, from as TurnPhase);
        }

        // ========== targetingRoll 阶段退出：确定防御方后继续攻击流程 ==========
        if (from === 'targetingRoll') {
            if (!core.pendingAttack) {
                return { events, overrideNextPhase: 'main2' };
            }

            let targetingCore = core;
            const attackerId = core.pendingAttack.attackerId;
            const targetingValue = core.dice[0]?.value ?? 1;
            const autoDefenderId = getTargetingRollAutoDefenderId(core, attackerId, targetingValue);
            const selectedDefenderId = command.type === 'SELECT_DEFENDER_TARGET'
                ? ((command.payload as { defenderId?: unknown } | undefined)?.defenderId)
                : undefined;

            if (
                typeof selectedDefenderId === 'string'
                && !targetingCore.pendingAttack.defenderId
                && targetingCore.players[selectedDefenderId]
            ) {
                const localResolvedEvent: DiceThroneEvent = {
                    type: 'DEFENDER_SELECTION_RESOLVED',
                    payload: {
                        attackerId,
                        chooserPlayerId: getTargetingRollChoiceOwnerId(core, attackerId, targetingValue) ?? attackerId,
                        defenderId: selectedDefenderId,
                        sourceAbilityId: targetingCore.pendingAttack.sourceAbilityId ?? 'targeting-roll',
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                // 该事件已在 execute() 中正式产出；这里只做同拍本地推演，
                // 让 targetingRoll 退出逻辑能读到最新 defenderId 并继续收敛。
                targetingCore = applyEvents(targetingCore, [localResolvedEvent], reduce);
            }

            if (autoDefenderId && !targetingCore.pendingAttack.defenderId) {
                const targetResolvedEvent: DiceThroneEvent = {
                    type: 'DEFENDER_SELECTION_RESOLVED',
                    payload: {
                        attackerId,
                        chooserPlayerId: attackerId,
                        defenderId: autoDefenderId,
                        sourceAbilityId: targetingCore.pendingAttack.sourceAbilityId ?? 'targeting-roll',
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(targetResolvedEvent);
                targetingCore = applyEvents(core, [targetResolvedEvent], reduce);
            } else if (targetingValue === 5 || targetingValue === 6) {
                if (
                    targetingCore.pendingAttack.targetingSelectionPending
                    && state.sys.interaction?.current?.kind === 'dt:defender-choice'
                ) {
                    return { events, halt: true };
                }

                // 仅在“刚处理完 targeting 选择交互、等待 CHOICE_RESOLVED reduce 落地”的同一拍，
                // 才跳过重新建 prompt，避免出现交互已丢失却永久不再重开的卡死状态。
                const awaitingTargetingChoiceReduce = state.sys.flowHalted === true
                    && state.sys.interaction?.current === undefined
                    && targetingCore.pendingAttack.targetingSelectionPending !== true
                    && (command.type === 'SELECT_DEFENDER_TARGET' || command.type === 'SYS_INTERACTION_CANCEL');

                if (
                    targetingCore.pendingAttack.targetingSelectionResolved !== true
                    && !awaitingTargetingChoiceReduce
                ) {
                    const choiceOwnerId = getTargetingRollChoiceOwnerId(core, attackerId, targetingValue);
                    if (!choiceOwnerId) {
                        return { events, overrideNextPhase: targetingCore.pendingAttack.isDefendable ? 'defensiveRoll' : 'main2' };
                    }

                    const choiceEvent: DefenderSelectionRequestedEvent = {
                        type: 'DEFENDER_SELECTION_REQUESTED',
                        payload: {
                            attackerId,
                            chooserPlayerId: choiceOwnerId,
                            sourceAbilityId: targetingCore.pendingAttack.sourceAbilityId ?? 'targeting-roll',
                            titleKey: targetingValue === 5
                                ? 'interaction.targetingRollOpponentDecidesTarget'
                                : 'interaction.targetingRollSelectTarget',
                            targetRollValue: targetingValue,
                            allowedCommands: targetingValue === 6 ? ['PLAY_CARD'] : undefined,
                            options: getTargetingRollChoiceOptions(targetingCore, attackerId)
                                .map((option) => {
                                    const customId = option.customId;
                                    if (!customId?.startsWith('select-target:')) {
                                        return null;
                                    }
                                    const defenderId = customId.slice('select-target:'.length);
                                    if (!defenderId) {
                                        return null;
                                    }
                                    return {
                                        playerId: defenderId,
                                        customId,
                                        disabled: option.disabled,
                                    };
                                })
                                .filter((option): option is NonNullable<typeof option> => option !== null),
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };

                    events.push(choiceEvent);
                    return { events, halt: true };
                }

                // 5/6 分支的目标已由选择交互写回，继续后续攻击流程，避免重复弹窗。
            }

            if (!targetingCore.pendingAttack) {
                return { events, overrideNextPhase: 'main2' };
            }

            if (!targetingCore.pendingAttack.defenderId) {
                return { events, halt: true };
            }

            const deferredAttackModifierCardIds = targetingCore.pendingAttack.deferredAttackModifierCardIds ?? [];
            if (deferredAttackModifierCardIds.length > 0) {
                const resolvedDefenderId = targetingCore.pendingAttack.defenderId;
                let replayCore = targetingCore;

                deferredAttackModifierCardIds.forEach((cardId, index) => {
                    const card = findHeroCard(cardId);
                    if (!card?.effects?.length) {
                        return;
                    }

                    const replayTimestamp = timestamp + 0.01 + index * 0.01;
                    const replayEvents = resolveEffectsToEvents(
                        card.effects,
                        'immediate',
                        {
                            attackerId,
                            defenderId: resolvedDefenderId,
                            sourceAbilityId: cardId,
                            state: replayCore,
                            damageDealt: 0,
                            timestamp: replayTimestamp,
                        },
                        { random },
                    );

                    if (replayEvents.length > 0) {
                        events.push(...replayEvents);
                        replayCore = applyEvents(replayCore, replayEvents, reduce);
                    }
                });

                const clearDeferredEvent: DiceThroneEvent = {
                    type: 'PENDING_ATTACK_UPDATED',
                    payload: {
                        attackerId,
                        patch: {
                            deferredAttackModifierCardIds: [],
                        },
                    },
                    sourceCommandType: command.type,
                    timestamp: timestamp + 0.02 + deferredAttackModifierCardIds.length * 0.01,
                };
                events.push(clearDeferredEvent);
                targetingCore = applyEvents(replayCore, [clearDeferredEvent], reduce);
            }

            const pendingAttack = targetingCore.pendingAttack;
            if (!pendingAttack?.defenderId) {
                return { events, halt: true };
            }

            const pendingAttackStage = getPendingAttackSettlementStage(pendingAttack);

            if (pendingAttackStage === 'postDamagePending') {
                const coreForPostDamage = getCoreForPostDamageAfterEvasion(targetingCore);
                const isFullyEvaded = coreForPostDamage !== targetingCore;
                const postDamageEvents = resolvePostDamageEffects(coreForPostDamage, random, timestamp, {
                    includeWithDamage: coreForPostDamage.pendingAttack?.damageResolved === true,
                    continueWithDamageAfterFirstDamage: coreForPostDamage.pendingAttack?.damageResolved === true,
                });
                const filteredPostDamageEvents = isFullyEvaded
                    ? postDamageEvents.filter(e => e.type !== 'DAMAGE_DEALT')
                    : postDamageEvents;
                events.push(...filteredPostDamageEvents);

                const hasBonusDiceRerollPost = postDamageEvents.some(e =>
                    e.type === 'BONUS_DICE_REROLL_REQUESTED' &&
                    !(e as any).payload?.settlement?.displayOnly
                );
                if (hasBonusDiceRerollPost) {
                    return { events, halt: true };
                }

                if (postDamageEvents.some(isBlockingInteractionEvent)) {
                    return { events, halt: true };
                }

                if (!appendPendingAttackResolvedEvent(coreForPostDamage.pendingAttack, events, command.type, timestamp)) {
                    return { events, halt: true };
                }
                return resolvePostAttackFollowUp(targetingCore, events, command.type, timestamp, from as TurnPhase);
            }

            if (pendingAttackStage === 'readyToResolve') {
                if (!appendPendingAttackResolvedEvent(pendingAttack, events, command.type, timestamp)) {
                    return { events, halt: true };
                }
                return resolvePostAttackFollowUp(targetingCore, events, command.type, timestamp, from as TurnPhase);
            }

            const dazzleCheckResult = resolveDazzleCheckExitResult(
                targetingCore,
                pendingAttack,
                command.type,
                timestamp,
                random,
            );
            if (dazzleCheckResult) {
                return {
                    ...dazzleCheckResult,
                    events: [...events, ...(dazzleCheckResult.events ?? [])],
                };
            }

            const blindedCheckResult = resolveBlindedCheckExitResult(
                targetingCore,
                pendingAttack,
                command.type,
                timestamp,
                random,
            );
            if (blindedCheckResult) {
                return {
                    ...blindedCheckResult,
                    events: [...events, ...(blindedCheckResult.events ?? [])],
                };
            }

            const defender = pendingAttack.defenderId
                ? targetingCore.players[pendingAttack.defenderId]
                : undefined;
            const sneakStacks = defender?.tokens[TOKEN_IDS.SNEAK] ?? 0;
            if (sneakStacks > 0 && !pendingAttack.isUltimate) {
                let preDefenseEventsSneak = resolveOffensivePreDefenseEffects(targetingCore, random, timestamp);
                preDefenseEventsSneak = preventIncomingDebuffsWithTreantDivine(targetingCore, preDefenseEventsSneak, command.type, timestamp) as DiceThroneEvent[];
                events.push(...preDefenseEventsSneak);

                const hasSneakChoice = preDefenseEventsSneak.some(isBlockingInteractionEvent);
                const hasBonusDiceRerollPreDefenseSneak = preDefenseEventsSneak.some((event) =>
                    event.type === 'BONUS_DICE_REROLL_REQUESTED' &&
                    !(event as any).payload?.settlement?.displayOnly
                );
                if (hasSneakChoice || hasBonusDiceRerollPreDefenseSneak) {
                    return { events, halt: true };
                }

                const coreAfterPreDefenseSneak = preDefenseEventsSneak.length > 0
                    ? applyEvents(targetingCore, [...events] as DiceThroneEvent[], reduce)
                    : targetingCore;

                const sneakBaseDamage = getPendingAttackExpectedDamage(coreAfterPreDefenseSneak, pendingAttack, 1);
                const coreForPostDamage = {
                    ...coreAfterPreDefenseSneak,
                    pendingAttack: {
                        ...coreAfterPreDefenseSneak.pendingAttack!,
                        resolvedDamage: sneakBaseDamage,
                    },
                };
                const postDamageEventsSneak = resolvePostDamageEffects(coreForPostDamage, random, timestamp);
                events.push(...postDamageEventsSneak.filter(e => e.type !== 'DAMAGE_DEALT'));

                const hasBonusDiceRerollSneak = postDamageEventsSneak.some(e =>
                    e.type === 'BONUS_DICE_REROLL_REQUESTED' &&
                    !(e as any).payload?.settlement?.displayOnly
                );
                const hasPostDamageChoiceSneak = postDamageEventsSneak.some(isBlockingInteractionEvent);
                const hasTokenResponseSneak = postDamageEventsSneak.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
                if (hasBonusDiceRerollSneak || hasPostDamageChoiceSneak || hasTokenResponseSneak) {
                    return { events, halt: true };
                }

                if (!appendPendingAttackResolvedEvent(coreForPostDamage.pendingAttack, events, command.type, timestamp)) {
                    return { events, halt: true };
                }
                return resolvePostAttackFollowUp(targetingCore, events, command.type, timestamp, from as TurnPhase);
            }

            let preDefenseEvents = resolveOffensivePreDefenseEffects(targetingCore, random, timestamp);
            preDefenseEvents = preventIncomingDebuffsWithTreantDivine(targetingCore, preDefenseEvents, command.type, timestamp) as DiceThroneEvent[];
            events.push(...preDefenseEvents);

            const hasChoice = preDefenseEvents.some(isBlockingInteractionEvent);
            const hasBonusDiceRerollPreDefense = preDefenseEvents.some((event) =>
                event.type === 'BONUS_DICE_REROLL_REQUESTED' &&
                !(event as any).payload?.settlement?.displayOnly
            );
            if (hasChoice || hasBonusDiceRerollPreDefense) {
                return { events, halt: true };
            }

            const coreAfterPreDefense = preDefenseEvents.length > 0
                ? applyEvents(targetingCore, preDefenseEvents as DiceThroneEvent[], reduce)
                : targetingCore;

            const offensiveRollEndChoiceEvent = createOffensiveRollEndTokenChoiceEvent(
                coreAfterPreDefense,
                attackerId,
                command.type,
                timestamp,
            );
            if (offensiveRollEndChoiceEvent) {
                events.push(offensiveRollEndChoiceEvent);
                return { events, halt: true };
            }

            if (coreAfterPreDefense.pendingAttack?.isDefendable) {
                return { events, overrideNextPhase: 'defensiveRoll' };
            }

            const attackEvents = resolveAttack(coreAfterPreDefense, random, { includePreDefense: false }, timestamp);
            events.push(...attackEvents);

            const hasAttackChoice = attackEvents.some(isBlockingInteractionEvent);
            const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
            const hasBonusDiceRerollOff = attackEvents.some((event) =>
                event.type === 'BONUS_DICE_REROLL_REQUESTED' &&
                !(event as any).payload?.settlement?.displayOnly
            );
            if (hasAttackChoice || hasTokenResponse || hasBonusDiceRerollOff) {
                return { events, halt: true };
            }

            return resolvePostAttackFollowUp(coreAfterPreDefense, events, command.type, timestamp, from as TurnPhase);
        }

        // ========== defensiveRoll 阶段退出 ==========
        if (from === 'defensiveRoll') {
            if (core.pendingAttack) {
                const pendingAttackStage = getPendingAttackSettlementStage(core.pendingAttack);
                if (pendingAttackStage === 'withDamageChoicePending') {
                    const withDamageEvents = resolveWithDamageAfterChoice(core, random, timestamp);
                    events.push(...withDamageEvents);

                    const hasChoice = withDamageEvents.some(isBlockingInteractionEvent);
                    const hasTokenResponse = withDamageEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                    const hasBonusDiceReroll = withDamageEvents.some((event) =>
                        event.type === 'BONUS_DICE_REROLL_REQUESTED' &&
                        !(event as any).payload?.settlement?.displayOnly
                    );
                    if (hasChoice || hasTokenResponse || hasBonusDiceReroll) {
                        return { events, halt: true };
                    }

                    const coreAfterWithDamage = withDamageEvents.length > 0
                        ? applyEvents(core, withDamageEvents as DiceThroneEvent[], reduce)
                        : core;
                    const postDamageEvents = resolvePostDamageEffects(coreAfterWithDamage, random, timestamp);
                    events.push(...postDamageEvents);

                    const hasPostChoice = postDamageEvents.some(isBlockingInteractionEvent);
                    const hasPostTokenResponse = postDamageEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                    const hasPostBonusDiceReroll = postDamageEvents.some((event) =>
                        event.type === 'BONUS_DICE_REROLL_REQUESTED' &&
                        !(event as any).payload?.settlement?.displayOnly
                    );
                    if (hasPostChoice || hasPostTokenResponse || hasPostBonusDiceReroll) {
                        return { events, halt: true };
                    }

                    const coreAfterPostDamage = postDamageEvents.length > 0
                        ? applyEvents(coreAfterWithDamage, postDamageEvents as DiceThroneEvent[], reduce)
                        : coreAfterWithDamage;
                    if (!appendPendingAttackResolvedEvent(coreAfterPostDamage.pendingAttack, events, command.type, timestamp)) {
                        return { events, halt: true };
                    }
                    return resolvePostAttackFollowUp(coreAfterPostDamage, events, command.type, timestamp, from as TurnPhase);
                }
                // 如果伤害已通过 Token 响应结算，继续执行后续 withDamage 效果。
                // resolvePostDamageEffects 会跳过已结算的 damage，但保留 rollDie 等后续效果。
                if (pendingAttackStage === 'postDamagePending') {
                    // 闪避修正：完全闪避时 resolvedDamage 为 0，但攻击仍视为命中
                    // 将 resolvedDamage 设为基础伤害让 onHit 效果正确触发
                    const coreForPostDamage = getCoreForPostDamageAfterEvasion(core);
                    const isFullyEvaded = coreForPostDamage !== core;
                    const postDamageEvents = resolvePostDamageEffects(coreForPostDamage, random, timestamp, {
                        includeWithDamage: coreForPostDamage.pendingAttack?.damageResolved === true,
                        continueWithDamageAfterFirstDamage: coreForPostDamage.pendingAttack?.damageResolved === true,
                    });
                    // 闪避免伤：过滤掉 DAMAGE_DEALT 事件（伤害已被闪避免除，非伤害效果仍生效）
                    const filteredPostDamageEvents = isFullyEvaded
                        ? postDamageEvents.filter(e => e.type !== 'DAMAGE_DEALT')
                        : postDamageEvents;
                    events.push(...filteredPostDamageEvents);

                    // rollDie 等效果可能产生 BONUS_DICE_REROLL_REQUESTED，需要暂停让 UI 展示
                    // displayOnly settlement 不需要 halt（伤害已在同批事件中处理）
                    const hasBonusDiceRerollPost = postDamageEvents.some(e => 
                        e.type === 'BONUS_DICE_REROLL_REQUESTED' && 
                        !(e as any).payload?.settlement?.displayOnly
                    );
                    if (hasBonusDiceRerollPost) {
                        return { events, halt: true };
                    }

                    if (postDamageEvents.some(isBlockingInteractionEvent)) {
                        return { events, halt: true };
                    }

                    if (!appendPendingAttackResolvedEvent(coreForPostDamage.pendingAttack, events, command.type, timestamp)) {
                        return { events, halt: true };
                    }
                    return resolvePostAttackFollowUp(core, events, command.type, timestamp, from as TurnPhase);
                }

                // 奖励骰收口、或 postDamage/withDamage 内挂起的后续选择已完成时，
                // 主伤害都已落地；这里只需生成 ATTACK_RESOLVED 并推进到 main2。
                if (pendingAttackStage === 'readyToResolve') {
                    if (!appendPendingAttackResolvedEvent(core.pendingAttack, events, command.type, timestamp)) {
                        return { events, halt: true };
                    }
                    return resolvePostAttackFollowUp(core, events, command.type, timestamp, from as TurnPhase);
                }
                
                // 直接结算攻击
                if (!core.pendingAttack.defenderId) {
                    return { events, halt: true };
                }
                const defender = core.players[core.pendingAttack.defenderId];
                const sneakStacks = defender?.tokens[TOKEN_IDS.SNEAK] ?? 0;
                const attackEvents = sneakStacks > 0 && !core.pendingAttack.isUltimate
                    ? resolveAttackWithSneakImmunityAfterDefense(core, random, timestamp)
                    : resolveAttack(core, random, undefined, timestamp);
                events.push(...attackEvents);

                const hasAttackChoice = attackEvents.some(isBlockingInteractionEvent);
                const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                const hasBonusDiceReroll = attackEvents.some((event) => 
                    event.type === 'BONUS_DICE_REROLL_REQUESTED' && 
                    !(event as any).payload?.settlement?.displayOnly
                );
                
                if (hasAttackChoice || hasTokenResponse || hasBonusDiceReroll) {
                    return { events, halt: true };
                }

                return resolvePostAttackFollowUp(core, events, command.type, timestamp, from as TurnPhase);
            }
            // 显式指定下一阶段为 main2（无论是否有 pendingAttack）
            return { events, overrideNextPhase: 'main2' };
        }

        // ========== discard 阶段退出：潜行自动弃除 + 切换回合 ==========
        if (from === 'discard') {
            // 潜行自动弃除：经过一个完整的自己回合后，回合末弃除
            // 判定条件：sneakGainedTurn[playerId] < 当前 turnNumber（不是本回合获得的）
            const activeId = core.activePlayerId;
            const sneakStacks = core.players[activeId]?.tokens[TOKEN_IDS.SNEAK] ?? 0;
            if (sneakStacks > 0 && core.sneakGainedTurn?.[activeId] !== undefined) {
                const gainedTurn = core.sneakGainedTurn[activeId];
                if (gainedTurn < core.turnNumber) {
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: {
                            playerId: activeId,
                            tokenId: TOKEN_IDS.SNEAK,
                            amount: sneakStacks,
                            newTotal: 0,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
            }

            const delayedPoisonStacks = core.players[activeId]?.tokens?.[TOKEN_IDS.DELAYED_POISON] ?? 0;
            if (delayedPoisonStacks > 0) {
                events.push({
                    type: 'TOKEN_CONSUMED',
                    payload: {
                        playerId: activeId,
                        tokenId: TOKEN_IDS.DELAYED_POISON,
                        amount: delayedPoisonStacks,
                        newTotal: 0,
                    },
                    sourceCommandType: command.type,
                    timestamp: timestamp + 0.01,
                } as TokenConsumedEvent);

                const hp = core.players[activeId]?.resources[RESOURCE_IDS.HP] ?? 0;
                const damageAmount = delayedPoisonStacks * 3;
                events.push({
                    type: 'DAMAGE_DEALT',
                    payload: {
                        targetId: activeId,
                        amount: damageAmount,
                        actualDamage: Math.min(damageAmount, hp),
                        sourceAbilityId: TOKEN_IDS.DELAYED_POISON,
                    },
                    sourceCommandType: command.type,
                    timestamp: timestamp + 0.011,
                } as DamageDealtEvent);
            }

            events.push(...resolvePassivePhaseTriggerEvents({
                state: core,
                playerId: activeId,
                phase: 'discard',
                triggerType: 'phaseEnd',
                timestamp,
                random,
            }));

            const nextPlayerId = getNextPlayerId(core);
            const turnEvent: TurnChangedEvent = {
                type: 'TURN_CHANGED',
                payload: {
                    previousPlayerId: core.activePlayerId,
                    nextPlayerId,
                    turnNumber: core.turnNumber + 1,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(turnEvent);
        }

        if (events.length > 0) {
            return events;
        }
    },

    onAutoContinueCheck: ({ state, events }): { autoContinue: boolean; playerId: string } | void => {
        const core = state.core;
        const phase = state.sys.phase as TurnPhase;

        // ====== 1. setup 阶段：由特定事件门控（HOST_STARTED / PLAYER_READY） ======
        if (phase === 'setup') {
            const hasSetupGateEvent = events.some(e => e.type === 'HOST_STARTED' || e.type === 'PLAYER_READY');
            if (hasSetupGateEvent && canAdvancePhase(core, phase)) {
                return { autoContinue: true, playerId: core.activePlayerId };
            }
            return undefined;
        }

        // ====== 2. 纯自动阶段（upkeep/income）：进入后立即推进 ======
        // 通过 SYS_PHASE_CHANGED 事件检测刚进入该阶段，确保只在阶段切换时触发一次
        if (phase === 'upkeep' || phase === 'income') {
            const justEnteredPhase = events.some(
                e => e.type === 'SYS_PHASE_CHANGED' && (e as any).payload?.to === phase
            );
            const hasActiveInteraction = state.sys.interaction?.current !== undefined;
            const hasActiveResponseWindow = state.sys.responseWindow?.current !== undefined;
            const hasPendingDamage = core.pendingDamage !== null && core.pendingDamage !== undefined;
            const hasPendingBonusDice = hasInteractivePendingBonusDiceSettlement(core);
            const hasUsableUpkeepPassiveAction = phase === 'upkeep'
                && hasUsablePassiveAction(core, core.activePlayerId, 'upkeep');

            if (
                justEnteredPhase
                && canAdvancePhase(core, phase)
                && !hasActiveInteraction
                && !hasActiveResponseWindow
                && !hasPendingDamage
                && !hasPendingBonusDice
                && !hasUsableUpkeepPassiveAction
            ) {
                return { autoContinue: true, playerId: core.activePlayerId };
            }
            return undefined;
        }

        // ====== 3. 战斗阶段（offensiveRoll/targetingRoll/defensiveRoll）：仅在 flowHalted 时自动推进 ======
        // onPhaseExit 因 TOKEN_RESPONSE / CHOICE / BONUS_DICE 而 halt 时，
        // FlowSystem 会设置 sys.flowHalted = true。
        // 当阻塞全部清除后重新尝试 ADVANCE_PHASE。
        // 卡牌效果中的 BONUS_DICE_SETTLED / CHOICE_RESOLVED 等不会设置 flowHalted，
        // 因此不会误触发阶段推进。
        if (phase === 'offensiveRoll' || phase === 'targetingRoll' || phase === 'defensiveRoll') {
            // 确认所有阻塞已清除
            const hasActiveInteraction = state.sys.interaction?.current !== undefined;
            const hasActiveResponseWindow = state.sys.responseWindow?.current !== undefined;
            // Token 响应窗口通过 pendingDamage 管理，需要等待玩家 USE_TOKEN 或 SKIP_TOKEN_RESPONSE
            // 特殊处理：TOKEN_RESPONSE_CLOSED 事件会清理 pendingDamage，但事件尚未 reduce 时
            // core.pendingDamage 仍为旧值。检测到该事件时应忽略 pendingDamage 检查。
            const hasTokenResponseClosed = events.some(e => e.type === 'TOKEN_RESPONSE_CLOSED');
            const hasPendingDamage = !hasTokenResponseClosed && (core.pendingDamage !== null && core.pendingDamage !== undefined);
            
            // 检查是否有待处理的奖励骰结算（非 displayOnly）
            // displayOnly 的奖励骰不需要用户交互，不应阻塞阶段推进
            const hasPendingBonusDice = hasInteractivePendingBonusDiceSettlement(core);
            
            // 检查是否需要等待 offensiveRollEnd Token 选择的 CHOICE_RESOLVED 被 reduce 进 core。
            //
            // 时序问题：SYS_INTERACTION_RESPOND 命令执行后，afterEvents 多轮迭代中：
            //   round N：DiceThroneEventSystem 产生 CHOICE_RESOLVED，FlowSystem 看到 SYS_INTERACTION_RESOLVED
            //            但 CHOICE_RESOLVED 在 round N 结束时才 reduce 进 core
            //   round N+1：CHOICE_RESOLVED 已 reduce，offensiveRollEndTokenResolved=true
            //
            // 因此：当 SYS_INTERACTION_RESOLVED 在 events 里，且 offensiveRoll 阶段有
            // pendingAttack 但 offensiveRollEndTokenResolved 还是 false 时，
            // 说明 CHOICE_RESOLVED 还没有被 reduce，需要等待下一轮。
            // 例外：dt:token-response 的 resolveInteraction 也产生 SYS_INTERACTION_RESOLVED，
            // 但此时 pendingAttack 为 null（已结算），不会误阻塞。
            const hasSysInteractionResolved = events.some(e => e.type === 'SYS_INTERACTION_RESOLVED');
            const resolvedDefenderSelectionThisRound = events.some(e => e.type === 'DEFENDER_SELECTION_RESOLVED');
            const resolvedOffensiveRollEndChoice = resolvedOffensiveRollEndTokenChoiceThisRound(events);
            const resolvedTreantDivinePreventDebuffChoice = resolvedTreantDivinePreventDebuffChoiceThisRound(events);
            // 时序保护：当 SYS_INTERACTION_RESOLVED 在 events 里，且 offensiveRoll 阶段有
            // pendingAttack 时，说明本轮 DiceThroneEventSystem 可能产生了 CHOICE_RESOLVED，
            // 但该事件还没有被 reduce 进 core（reduce 在所有系统 afterEvents 执行完后才发生）。
            // 必须等待下一轮，确保 CHOICE_RESOLVED 的效果（如 isDefendable=false）已生效。
            //
            // 覆盖场景：
            //   - offensiveRollEnd Token 选择（CRIT/ACCURACY）→ offensiveRollEndTokenResolved=true
            //   - preDefense 选择（如花开见佛花费太极使攻击不可防御）→ isDefendable=false
            //
            // 例外：dt:token-response 的 resolveInteraction 也产生 SYS_INTERACTION_RESOLVED，
            // 但此时 pendingAttack 为 null（已结算），不会误阻塞。
            const pendingOffensiveTokenChoice = hasSysInteractionResolved
                && (phase === 'offensiveRoll' || (phase === 'targetingRoll' && resolvedOffensiveRollEndChoice))
                && core.pendingAttack !== null
                && core.pendingAttack !== undefined
                && core.pendingAttack.offensiveRollEndTokenResolved !== true;

            const pendingTargetingChoice = hasSysInteractionResolved
                && phase === 'targetingRoll'
                && core.pendingAttack !== null
                && core.pendingAttack !== undefined
                && core.pendingAttack.targetingSelectionPending === true;

            const pendingAttackFollowUpChoice = hasSysInteractionResolved
                && core.pendingAttack !== null
                && core.pendingAttack !== undefined
                && typeof core.pendingAttack.sourceAbilityId === 'string'
                && core.pendingAttack.sourceAbilityId.length > 0
                && core.currentChoiceSourceAbilityId === core.pendingAttack.sourceAbilityId;

            const pendingTreantDivinePreventDebuffChoice = hasSysInteractionResolved
                && phase === 'offensiveRoll'
                && resolvedTreantDivinePreventDebuffChoice
                && core.pendingAttack !== null
                && core.pendingAttack !== undefined;

            const shouldAttemptAutoContinue = state.sys.flowHalted
                || pendingOffensiveTokenChoice
                || pendingTargetingChoice
                || pendingAttackFollowUpChoice
                || pendingTreantDivinePreventDebuffChoice
                || resolvedDefenderSelectionThisRound
                || hasTokenResponseClosed;
            if (!shouldAttemptAutoContinue) return undefined;
            
            if (
                !hasActiveInteraction
                && !hasActiveResponseWindow
                && !hasPendingDamage
                && !hasPendingBonusDice
                && !pendingOffensiveTokenChoice
                && !pendingTargetingChoice
                && !pendingAttackFollowUpChoice
                && !pendingTreantDivinePreventDebuffChoice
            ) {
                // autoContinue 的 playerId 必须与 getCurrentPlayerId 返回值一致，
                // 否则 FlowSystem.afterEvents 中的 player_mismatch 校验会拒绝推进。
                // defensiveRoll 阶段由防御方（getRollerId）推进，offensiveRoll 由进攻方推进。
                const autoContinuePlayerId = getRollerId(core, phase);
                return { autoContinue: true, playerId: autoContinuePlayerId };
            }
            return undefined;
        }

        // ====== 4. 玩家操作阶段（main1/main2/discard）：永不自动推进 ======
        // 这些阶段中的 BONUS_DICE_SETTLED / CHOICE_RESOLVED 等事件仅是卡牌效果的一部分，
        // 不应触发阶段推进。玩家必须手动点击 ADVANCE_PHASE。
        return undefined;
    },

    onPhaseEnter: ({ state, from, to, command, random, exitEvents }): GameEvent[] | void => {
        const core = state.core;
        const events: GameEvent[] = [];
        const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

        // ========== 进入 upkeep 阶段：结算维持阶段触发的状态效果 ==========
        // 规则 §3.1：结算所有在"维持阶段"触发的状态效果或被动能力。
        // 注意：onPhaseEnter 收到的 state.core 尚未应用 exitEvents（如 TURN_CHANGED / HERO_INITIALIZED），
        // 因此这里先 apply exitEvents 得到真正的“进入 upkeep 时”状态，再做结算。
        if (to === 'upkeep') {
            const phaseEnterCore = exitEvents?.length
                ? applyEvents(core, exitEvents as DiceThroneEvent[], reduce)
                : core;
            const activeId = phaseEnterCore.activePlayerId;
            const player = phaseEnterCore.players[activeId];

            events.push(...resolvePassivePhaseTriggerEvents({
                state: phaseEnterCore,
                playerId: activeId,
                phase: 'upkeep',
                triggerType: 'phaseStart',
                timestamp,
                random,
            }));

            // 神圣降临只在持有者自己的维持阶段结算，并且只命中真实敌方玩家。
            events.push(...resolveTianshiDivineArrivalUpkeepEvents(
                phaseEnterCore,
                activeId,
                command.type,
                timestamp + 0.001,
                random,
            ));

            if (player?.statusEffects) {
                // 0. 火焰精通冷却 — 维持阶段移除 1 个火焰精通
                const fmCount = player.tokens?.[TOKEN_IDS.FIRE_MASTERY] ?? 0;
                if (fmCount > 0) {
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: {
                            playerId: activeId,
                            tokenId: TOKEN_IDS.FIRE_MASTERY,
                            amount: 1,
                            newTotal: fmCount - 1,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }

                // 1. 燃烧 (burn) — 持续效果，不可叠加，每回合固定造成 2 点不可防御伤害，不自动移除
                // 【已迁移到新伤害计算管线】
                const burnStacks = player.statusEffects[STATUS_IDS.BURN] ?? 0;
                if (burnStacks > 0) {
                    const damageCalc = createDamageCalculation({
                        source: { playerId: 'system', abilityId: 'upkeep-burn' },
                        target: { playerId: activeId },
                        baseDamage: 2,
                        state: phaseEnterCore,
                        timestamp,
                    });
                    const damageEvents = damageCalc.toEvents();
                    events.push(...damageEvents);
                    // 持续效果：合法的 1 个燃烧不自动移除；旧存档/旧测试注入的非法多层燃烧归一到 1。
                    if (burnStacks > 1) {
                        events.push({
                            type: 'STATUS_REMOVED',
                            payload: {
                                targetId: activeId,
                                statusId: STATUS_IDS.BURN,
                                stacks: burnStacks - 1,
                            },
                            sourceCommandType: command.type,
                            timestamp: timestamp + 0.01,
                        } as DiceThroneEvent);
                    }
                }

                // 2. 中毒 (poison) — 每层造成 1 点伤害，持续效果（不自动移除层数）
                // 【已迁移到新伤害计算管线】
                const poisonStacks = player.statusEffects[STATUS_IDS.POISON] ?? 0;
                if (poisonStacks > 0) {
                    const damageCalc = createDamageCalculation({
                        source: { playerId: 'system', abilityId: 'upkeep-poison' },
                        target: { playerId: activeId },
                        baseDamage: poisonStacks,
                        state: phaseEnterCore,
                        timestamp,
                    });
                    const damageEvents = damageCalc.toEvents();
                    events.push(...damageEvents);
                    // 持续效果：毒液层数不自动减少，只能通过净化等手段移除
                }

                // 3. 诅咒金币 (cursed_coin) — 每层在维持阶段造成 1 点伤害，不自动移除层数
                const cursedCoinStacks = player.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
                if (cursedCoinStacks > 0 && player.characterId !== 'cursed_pirate') {
                    const damageCalc = createDamageCalculation({
                        source: { playerId: 'system', abilityId: 'upkeep-cursed-coin' },
                        target: { playerId: activeId },
                        baseDamage: cursedCoinStacks,
                        damageScope: 'direct',
                        state: phaseEnterCore,
                        timestamp,
                    });
                    events.push(...damageCalc.toEvents());
                }

                // 4. 炸药桶 (powder_keg) — 维持阶段投 1 骰，1-2 爆炸，6 可转交。
                events.push(...resolvePowderKegUpkeepEvents(
                    phaseEnterCore,
                    activeId,
                    command.type,
                    timestamp + 0.02,
                    random,
                ));

                // 5. 工匠：纳米爆弹 — 每层投 1 骰，6 移除 1 层。
                events.push(...resolveNanobombUpkeepEvents(
                    phaseEnterCore,
                    activeId,
                    command.type,
                    timestamp + 0.03,
                    random,
                ));
            }
        }

        // ========== 状态修复：检测并修复缺失手牌的玩家 ==========
        // 原因：旧版本的游戏状态可能在 HERO_INITIALIZED 事件添加前保存
        // 症状：玩家已选择角色但 hand/deck 为空
        if (to === 'income' || to === 'main1') {
            const playerIds = Object.keys(core.players);
            for (const pid of playerIds) {
                const player = core.players[pid];
                const charId = core.selectedCharacters[pid];

                // 检测条件：已选角色 + 手牌和牌库都为空
                if (charId && charId !== 'unselected'
                    && player.hand.length === 0
                    && player.deck.length === 0) {
                    // 生成 HERO_INITIALIZED 事件来修复状态
                    events.push({
                        type: 'HERO_INITIALIZED',
                        payload: {
                            playerId: pid,
                            characterId: charId as any,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as any);
                }
            }

            if (events.length > 0) {
                return events;
            }
        }

        // ========== 进入 defensiveRoll 阶段：自动选择唯一防御技能 ==========
        // 规则 §3.6 步骤 2：如果有多个防御技能，必须在掷骰前选择
        // 如果只有 1 个防御技能，自动选择并设置 rollDiceCount
        if (to === 'defensiveRoll' && core.pendingAttack) {
            const phaseEnterCore = exitEvents?.length
                ? applyEvents(core, exitEvents as DiceThroneEvent[], reduce)
                : core;
            const defenderId = phaseEnterCore.pendingAttack?.defenderId;
            if (!defenderId) {
                return undefined;
            }
            const defender = phaseEnterCore.players[defenderId];
            if (defender) {
                const defensiveAbilities = defender.abilities.filter(a => a.type === 'defensive');
                if (defensiveAbilities.length === 1) {
                    // 唯一防御技能，自动选择
                    const ability = defensiveAbilities[0];
                    const abilityId = ability.id;
                    const autoAbilityEvent: AbilityActivatedEvent = {
                        type: 'ABILITY_ACTIVATED',
                        payload: {
                            abilityId,
                            playerId: defenderId,
                            isDefense: true,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    events.push(autoAbilityEvent);
                }
                // 多个防御技能：等待玩家 SELECT_ABILITY 命令
            }
        }

        // ========== 进入 offensiveRoll 阶段：检查缠绕状态 ==========
        if (to === 'offensiveRoll') {
            const player = core.players[core.activePlayerId];

            // 缠绕 (entangle) — 减少掷骰次数
            const entangleStacks = player?.statusEffects[STATUS_IDS.ENTANGLE] ?? 0;
            if (entangleStacks > 0) {
                // 缠绕：减少1次掷骰机会（3 -> 2）
                // 注意：onPhaseEnter 读到的 core.rollLimit 是旧阶段的值（如防御阶段的 1），
                // 而 PHASE_CHANGED 事件会在 reducer 中将 rollLimit 重置为 3。
                // 因此这里必须基于重置后的默认值 3 计算，而非读取旧的 core.rollLimit。
                const defaultOffensiveRollLimit = 3;
                const newLimit = defaultOffensiveRollLimit - 1; // 3 -> 2
                const delta = -1;
                events.push({
                    type: 'ROLL_LIMIT_CHANGED',
                    payload: { playerId: core.activePlayerId, delta, newLimit },
                    sourceCommandType: command.type,
                    timestamp,
                } as any);
                // 移除缠绕状态（一次性）
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: core.activePlayerId, statusId: STATUS_IDS.ENTANGLE, stacks: entangleStacks },
                    sourceCommandType: command.type,
                    timestamp,
                } as any);
            }
        }

        // ========== 进入 income 阶段：CP 和抽牌 ==========
        if (to === 'income') {
            const player = core.players[core.activePlayerId];
            if (player) {
                const cpDelta = 1;
                const cpResult = resourceSystem.modify(
                    player.resources,
                    RESOURCE_IDS.CP,
                    cpDelta
                );
                const cpEvent: CpChangedEvent = {
                    type: 'CP_CHANGED',
                    payload: {
                        playerId: core.activePlayerId,
                        delta: cpResult.actualDelta,
                        newValue: cpResult.newValue,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(cpEvent);

                // 抽牌（牌库为空则洗弃牌堆）
                events.push(
                    ...buildDrawEvents(core, core.activePlayerId, 1, random, command.type, timestamp)
                );
            }
        }

        if (events.length > 0) {
            return events;
        }
    },
};
