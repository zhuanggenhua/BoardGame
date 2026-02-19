/**
 * 通用 Custom Action 处理器
 * 用于跨英雄共享的骰子操作、状态操作等
 */

import type {
    DiceThroneEvent,
    CpChangedEvent,
    PendingInteraction,
    InteractionRequestedEvent,
} from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';

// ============================================================================
// 资源处理器
// ============================================================================

/** 通用 CP 获取：params.amount 指定数量 */
function handleGainCp({ attackerId, sourceAbilityId, state, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const params = (action as any).params;
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

// ============================================================================
// 骰子目标解析辅助函数
// ============================================================================

/**
 * 根据 EffectAction.target 解析 targetOpponentDice 标志
 * - 'select' / 'opponent' → true（可选择对手骰子）
 * - 'self' / 默认 → false（只能选择自己骰子）
 */
export function resolveTargetOpponentDice(action: CustomActionContext['action']): boolean {
    return action.target === 'opponent' || action.target === 'select';
}

// ============================================================================
// 骰子修改处理器
// ============================================================================

/** 将1颗骰子改至6 */
function handleModifyDieTo6({ attackerId, sourceAbilityId, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToModify',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'set', targetValue: 6 },
        targetOpponentDice: resolveTargetOpponentDice(action),
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
function handleModifyDieCopy({ attackerId, sourceAbilityId, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToCopy',
        selectCount: 2,
        selected: [],
        dieModifyConfig: { mode: 'copy' },
        targetOpponentDice: resolveTargetOpponentDice(action),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 改变任意1颗骰子的数值 */
function handleModifyDieAny1({ attackerId, sourceAbilityId, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToChange',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'any' },
        targetOpponentDice: resolveTargetOpponentDice(action),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 改变任意2颗骰子的数值 */
function handleModifyDieAny2({ attackerId, sourceAbilityId, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDiceToChange',
        selectCount: 2,
        selected: [],
        dieModifyConfig: { mode: 'any' },
        targetOpponentDice: resolveTargetOpponentDice(action),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 增/减1颗骰子数值1点 */
function handleModifyDieAdjust1({ attackerId, sourceAbilityId, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: 'interaction.selectDieToAdjust',
        selectCount: 1,
        selected: [],
        dieModifyConfig: { mode: 'adjust', adjustRange: { min: -1, max: 1 } },
        targetOpponentDice: resolveTargetOpponentDice(action),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

// ============================================================================
// 骰子重掷处理器
// ============================================================================

/** 强制对手重掷1颗骰子 */
function handleRerollOpponentDie1({ attackerId, sourceAbilityId, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectOpponentDieToReroll',
        selectCount: 1,
        selected: [],
        targetOpponentDice: resolveTargetOpponentDice(action),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 重掷至多2颗骰子 */
function handleRerollDie2({ attackerId, sourceAbilityId, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectDiceToReroll',
        selectCount: 2,
        selected: [],
        targetOpponentDice: resolveTargetOpponentDice(action),
    };
    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

/** 重掷至多5颗骰子（我又行了！/ 就这？） */
function handleRerollDie5({ attackerId, sourceAbilityId, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectDiceToReroll',
        selectCount: 5,
        selected: [],
        targetOpponentDice: resolveTargetOpponentDice(action),
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

// ============================================================================
// 注册所有通用 Custom Action 处理器
// ============================================================================

export function registerCommonCustomActions(): void {
    // --- 资源相关 ---
    registerCustomActionHandler('gain-cp', handleGainCp, { categories: ['resource'] });

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
}
