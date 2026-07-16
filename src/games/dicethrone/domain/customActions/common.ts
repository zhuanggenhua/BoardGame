/**
 * 通用 Custom Action 处理器
 * 用于跨英雄共享的骰子操作、状态操作等
 */

import type {
    DiceThroneCore,
    DiceThroneEvent,
    BonusDamageAddedEvent,
    CpChangedEvent,
    PendingInteraction,
    InteractionRequestedEvent,
} from '../types';
import type { PlayerId } from '../../../../engine/types';
import { registerCustomActionHandler, resolveEffectsToEvents, type CustomActionContext } from '../effects';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import {
    getActiveDice,
    getAttackSnapshotDieIds,
    getPendingBonusSettlementDice,
    getRollerId,
} from '../rules';
import { findHeroCard } from '../../heroes';

// ============================================================================
// 资源处理器
// ============================================================================

/** 通用 CP 获取：params.amount 指定数量 */
function handleGainCp({ attackerId, sourceAbilityId, state, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const params = action.params as Record<string, unknown> | undefined;
    const amount = (params?.amount as number) || 0;
    if (amount <= 0) return [];

    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const newCp = Math.min(currentCp + amount, CP_MAX);

    return [{
        type: 'CP_CHANGED',
        payload: { playerId: attackerId, delta: amount, newValue: newCp, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as CpChangedEvent];
}

function handleAddAttackBonus({
    attackerId,
    sourceAbilityId,
    timestamp,
    action,
}: CustomActionContext): DiceThroneEvent[] {
    const params = action.params as Record<string, unknown> | undefined;
    const amount = Math.max(0, Math.trunc((params?.amount as number) ?? 0));
    if (amount <= 0 || !sourceAbilityId) return [];

    return [{
        type: 'BONUS_DAMAGE_ADDED',
        payload: {
            playerId: attackerId,
            amount,
            sourceCardId: sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDamageAddedEvent];
}

// ============================================================================
// 骰子目标解析辅助函数
// ============================================================================

const isDefenderSelectingAnyDiceDuringDefense = (
    action: CustomActionContext['action'],
    attackerId?: PlayerId,
    state?: DiceThroneCore,
): boolean => (
    action.target === 'select'
    && !!attackerId
    && state?.pendingAttack?.defenderId === attackerId
    && Array.isArray(state.pendingAttack.attackDiceValues)
    && state.pendingAttack.attackDiceValues.length > 0
);

/**
 * 根据 EffectAction.target 解析 targetOpponentDice 标志
 * - 'opponent' → true（明确指定对手骰子）
 * - 'select' → 非投掷者是在修改对手骰子；防御方在防御阶段也可选择攻击快照骰
 * - 'self' / 默认 → false（只能选择自己骰子）
 */
export function resolveTargetOpponentDice(action: CustomActionContext['action'], attackerId?: PlayerId, state?: DiceThroneCore): boolean {
    if (action.target === 'opponent') return true;
    if (isDefenderSelectingAnyDiceDuringDefense(action, attackerId, state)) return true;
    if (action.target === 'select' && attackerId && state) {
        // select 模式：判断 attackerId 是否是 rollerId
        const rollerId = getRollerId(state);
        return attackerId !== rollerId; // 如果不是 rollerId，则是在修改对手骰子
    }
    return false;
}

export function resolveDiceOwnerId(
    state?: DiceThroneCore,
    action?: CustomActionContext['action'],
    attackerId?: PlayerId,
): PlayerId | undefined {
    if (!state) return undefined;
    if (action && isDefenderSelectingAnyDiceDuringDefense(action, attackerId, state)) {
        return undefined;
    }
    return getRollerId(state);
}

function resolveAllowedDieIdsForDiceInteraction(
    state?: DiceThroneCore,
    action?: CustomActionContext['action'],
    attackerId?: PlayerId,
): number[] | undefined {
    if (!state) return undefined;
    if (state.pendingBonusDiceSettlement?.allowDiceModification) {
        return getPendingBonusSettlementDice(state.pendingBonusDiceSettlement).map(die => die.index);
    }
    if (state.pendingAttack?.defenseAbilityId === 'duel') {
        return [0, 1];
    }
    if (action && isDefenderSelectingAnyDiceDuringDefense(action, attackerId, state)) {
        return [
            ...getActiveDice(state).map(die => die.id),
            ...getAttackSnapshotDieIds(state),
        ];
    }
    return undefined;
}

// ============================================================================
// 骰子修改处理器
// ============================================================================

/** 将1颗骰子改至6 */
function handleModifyDieTo6({ attackerId, sourceAbilityId, timestamp, action, state }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToModify',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'set', targetValue: 6 },
        diceOwnerId: resolveDiceOwnerId(state, action, attackerId),
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
        allowedDieIds: resolveAllowedDieIdsForDiceInteraction(state, action, attackerId),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 移除自身1个状态效果 */
function handleRemoveSelfStatus({ attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectStatus',
        titleKey: 'interaction.selectStatusToRemove',
        selectCount: 1,
        selected: [],
        targetPlayerIds: [attackerId],
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 将1颗骰子改为另1颗的值 */
function handleModifyDieCopy({ attackerId, sourceAbilityId, timestamp, action, state }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToCopy',
        selectCount: 2,
        selected: [],
        dieModifyConfig: { mode: 'copy' },
        diceOwnerId: resolveDiceOwnerId(state, action, attackerId),
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
        allowedDieIds: resolveAllowedDieIdsForDiceInteraction(state, action, attackerId),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 改变任意1颗骰子的数值 */
function handleModifyDieAny1({ attackerId, sourceAbilityId, timestamp, action, state }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToChange',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'any' },
        diceOwnerId: resolveDiceOwnerId(state, action, attackerId),
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
        allowedDieIds: resolveAllowedDieIdsForDiceInteraction(state, action, attackerId),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 改变任意2颗骰子的数值 */
function handleModifyDieAny2({ attackerId, sourceAbilityId, timestamp, action, state }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDiceToChange',
        selectCount: 2,
        selected: [],
        dieModifyConfig: { mode: 'any' },
        diceOwnerId: resolveDiceOwnerId(state, action, attackerId),
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
        allowedDieIds: resolveAllowedDieIdsForDiceInteraction(state, action, attackerId),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 增/减1颗骰子数值1点 */
function handleModifyDieAdjust1({ attackerId, sourceAbilityId, timestamp, action, state }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToAdjust',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'adjust', adjustRange: { min: -1, max: 1 } },
        diceOwnerId: resolveDiceOwnerId(state, action, attackerId),
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
        allowedDieIds: resolveAllowedDieIdsForDiceInteraction(state, action, attackerId),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

// ============================================================================
// 骰子重掷处理器
// ============================================================================

/** 强制对手重掷1颗骰子 */
function handleRerollOpponentDie1({ attackerId, sourceAbilityId, timestamp, action, state }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectOpponentDieToReroll',
        selectCount: 1,
        selected: [],
        diceOwnerId: resolveDiceOwnerId(state, action, attackerId),
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
        allowedDieIds: resolveAllowedDieIdsForDiceInteraction(state, action, attackerId),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 重掷至多2颗骰子 */
function handleRerollDie2({ attackerId, sourceAbilityId, timestamp, action, state }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectDiceToReroll',
        selectCount: 2,
        selected: [],
        diceOwnerId: resolveDiceOwnerId(state, action, attackerId),
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
        allowedDieIds: resolveAllowedDieIdsForDiceInteraction(state, action, attackerId),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 重掷至多5颗骰子（我又行了！/ 就这？） */
function handleRerollDie5({ attackerId, sourceAbilityId, timestamp, action, state }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectDiceToReroll',
        selectCount: 5,
        selected: [],
        diceOwnerId: resolveDiceOwnerId(state, action, attackerId),
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
        allowedDieIds: resolveAllowedDieIdsForDiceInteraction(state, action, attackerId),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

// ============================================================================
// 状态效果处理器
// ============================================================================

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
        requiresTargetWithStatus: true,
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

/** 四人模式下选定敌方目标后，继续结算原卡牌效果。 */
function handleResolveCardEffectsOnSelectedOpponent({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
    random,
}: CustomActionContext): DiceThroneEvent[] {
    const card = findHeroCard(sourceAbilityId);
    if (!card?.effects?.length) {
        return [];
    }

    const events: DiceThroneEvent[] = [];

    if (
        card.isAttackModifier
        && state.pendingAttack
        && state.pendingAttack.attackerId === attackerId
        && !state.pendingAttack.defenderId
    ) {
        events.push({
            type: 'PENDING_ATTACK_UPDATED',
            payload: {
                attackerId,
                patch: {
                    defenderId: targetId,
                    settlementStage: 'preDamage',
                    targetingSelectionPending: false,
                    targetingSelectionResolved: true,
                },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DiceThroneEvent);
    }

    events.push(...resolveEffectsToEvents(card.effects, 'immediate', {
        attackerId,
        defenderId: targetId,
        sourceAbilityId,
        state,
        damageDealt: 0,
        timestamp,
    }, { random }));

    return events;
}

// ============================================================================
// 注册所有通用 Custom Action 处理器
// ============================================================================

export function registerCommonCustomActions(): void {
    // --- 资源相关 ---
    registerCustomActionHandler('gain-cp', handleGainCp, { categories: ['resource'] });
    registerCustomActionHandler('common-add-attack-bonus', handleAddAttackBonus, {
        categories: ['damage'],
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
    registerCustomActionHandler('remove-status-self', handleRemoveSelfStatus, {
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
    registerCustomActionHandler('resolve-card-effects-on-selected-opponent', handleResolveCardEffectsOnSelectedOpponent, {
        categories: ['card'],
    });
}
