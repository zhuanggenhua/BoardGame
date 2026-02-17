/**
 * 通用 Custom Action 处理器
 * 用于跨英雄共享的骰子操作、状态操作等
 */

import type {
    DiceThroneEvent,
    CpChangedEvent,
} from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import {
    createSelectDieInteraction,
    createModifyDieInteraction,
    createSelectStatusInteraction,
    createSelectPlayerInteraction,
    createTransferStatusInteraction,
} from '../interactions';

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
// 骰子修改处理器
// ============================================================================

/** 将1颗骰子改至6 */
function handleModifyDieTo6({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createModifyDieInteraction({
        playerId: attackerId,
        sourceAbilityId,
        dieId: -1, // UI will prompt to select which die
        allowedValues: [6],
        titleKey: 'interaction.selectDieToModify',
        onResolve: (newValue) => [{
            type: 'DIE_MODIFIED',
            payload: {
                dieId: -1, // Will be filled by UI
                oldValue: 0, // Will be filled by UI
                newValue,
                playerId: attackerId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        }],
    })];
}

/** 移除自身1个状态效果 */
/** 移除自身1个状态效果 */
function handleRemoveSelfStatus({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectStatusInteraction({
        playerId: attackerId,
        sourceAbilityId,
        state, // 传递 state
        targetPlayerIds: [attackerId],
        titleKey: 'interaction.selectStatusToRemove',
        onResolve: ({ playerId, statusId }) => [{
            type: 'STATUS_REMOVED',
            payload: {
                targetId: playerId,
                statusId,
                stacks: 1, // Remove 1 stack
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        }],
    })];
}

/** 将1颗骰子改为另1颗的值 */
function handleModifyDieCopy({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    // This requires selecting 2 dice: source and target
    // The new system doesn't support this complex mode directly
    // We need to use selectDie and handle the copy logic in onResolve
    return [createSelectDieInteraction({
        playerId: attackerId,
        sourceAbilityId,
        count: 2,
        titleKey: 'interaction.selectDieToCopy',
        onResolve: (selectedDiceIds) => {
            if (selectedDiceIds.length !== 2) return [];
            const [sourceDieId, targetDieId] = selectedDiceIds;
            const sourceDie = state.dice.find(d => d.id === sourceDieId);
            const targetDie = state.dice.find(d => d.id === targetDieId);
            if (!sourceDie || !targetDie) return [];
            
            return [{
                type: 'DIE_MODIFIED',
                payload: {
                    dieId: targetDieId,
                    oldValue: targetDie.value,
                    newValue: sourceDie.value,
                    playerId: attackerId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            }];
        },
    })];
}

/** 改变任意1颗骰子的数值 */
function handleModifyDieAny1({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectDieInteraction({
        playerId: attackerId,
        sourceAbilityId,
        count: 1,
        titleKey: 'interaction.selectDieToChange',
        onResolve: (selectedDiceIds) => {
            if (selectedDiceIds.length !== 1) return [];
            const dieId = selectedDiceIds[0];
            const die = state.dice.find(d => d.id === dieId);
            if (!die) return [];
            
            // Return a second interaction to select the new value
            return [createModifyDieInteraction({
                playerId: attackerId,
                sourceAbilityId,
                dieId,
                allowedValues: [1, 2, 3, 4, 5, 6],
                titleKey: 'interaction.selectNewDieValue',
                onResolve: (newValue) => [{
                    type: 'DIE_MODIFIED',
                    payload: {
                        dieId,
                        oldValue: die.value,
                        newValue,
                        playerId: attackerId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                }],
            })];
        },
    })];
}

/** 改变任意2颗骰子的数值 */
function handleModifyDieAny2({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectDieInteraction({
        playerId: attackerId,
        sourceAbilityId,
        count: 2,
        titleKey: 'interaction.selectDiceToChange',
        onResolve: (selectedDiceIds) => {
            if (selectedDiceIds.length === 0) return [];
            
            // Create a chain of interactions for each die
            // First die's interaction will return the second die's interaction in its onResolve
            const createDieModifyChain = (diceIds: number[], index: number): DiceThroneEvent[] => {
                if (index >= diceIds.length) return [];
                
                const dieId = diceIds[index];
                const die = state.dice.find(d => d.id === dieId);
                if (!die) return createDieModifyChain(diceIds, index + 1);
                
                return [createModifyDieInteraction({
                    playerId: attackerId,
                    sourceAbilityId,
                    dieId,
                    allowedValues: [1, 2, 3, 4, 5, 6],
                    titleKey: 'interaction.selectNewDieValue',
                    onResolve: (newValue) => {
                        const modifyEvent: DiceThroneEvent = {
                            type: 'DIE_MODIFIED',
                            payload: {
                                dieId,
                                oldValue: die.value,
                                newValue,
                                playerId: attackerId,
                            },
                            sourceCommandType: 'ABILITY_EFFECT',
                            timestamp,
                        };
                        
                        // If there are more dice to modify, return the next interaction
                        const nextInteractions = createDieModifyChain(diceIds, index + 1);
                        return [modifyEvent, ...nextInteractions];
                    },
                })];
            };
            
            return createDieModifyChain(selectedDiceIds, 0);
        },
    })];
}

/** 增/减1颗骰子数值1点 */
function handleModifyDieAdjust1({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectDieInteraction({
        playerId: attackerId,
        sourceAbilityId,
        count: 1,
        titleKey: 'interaction.selectDieToAdjust',
        onResolve: (selectedDiceIds) => {
            if (selectedDiceIds.length !== 1) return [];
            const dieId = selectedDiceIds[0];
            const die = state.dice.find(d => d.id === dieId);
            if (!die) return [];
            
            // Create a choice interaction to select +1 or -1
            // We'll use modifyDie with only the valid options (current value ±1)
            const allowedValues: number[] = [];
            if (die.value > 1) allowedValues.push(die.value - 1);
            if (die.value < 6) allowedValues.push(die.value + 1);
            
            if (allowedValues.length === 0) return []; // Edge case: can't adjust
            
            return [createModifyDieInteraction({
                playerId: attackerId,
                sourceAbilityId,
                dieId,
                allowedValues,
                titleKey: 'interaction.selectAdjustDirection',
                onResolve: (newValue) => [{
                    type: 'DIE_MODIFIED',
                    payload: {
                        dieId,
                        oldValue: die.value,
                        newValue,
                        playerId: attackerId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                }],
            })];
        },
    })];
}

// ============================================================================
// 骰子重掷处理器
// ============================================================================

/** 强制对手重掷1颗骰子 */
function handleRerollOpponentDie1({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    const opponentId = Object.keys(state.players).find(pid => pid !== attackerId);
    if (!opponentId) return [];
    
    const opponentDice = state.dice.filter(d => d.playerId === opponentId);
    
    return [createSelectDieInteraction({
        playerId: attackerId,
        sourceAbilityId,
        count: 1,
        allowedDiceIds: opponentDice.map(d => d.id),
        titleKey: 'interaction.selectOpponentDieToReroll',
        onResolve: (selectedDiceIds) => {
            if (!random || selectedDiceIds.length !== 1) return [];
            const dieId = selectedDiceIds[0];
            const die = state.dice.find(d => d.id === dieId);
            const newValue = random.d(6);
            
            return [{
                type: 'DIE_REROLLED',
                payload: {
                    dieId,
                    oldValue: die?.value ?? newValue,
                    newValue,
                    playerId: opponentId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            }];
        },
    })];
}

/** 重掷至多2颗骰子 */
function handleRerollDie2({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectDieInteraction({
        playerId: attackerId,
        sourceAbilityId,
        count: 2,
        titleKey: 'interaction.selectDiceToReroll',
        onResolve: (selectedDiceIds) => {
            if (!random) return [];
            return selectedDiceIds.map(dieId => {
                const die = state.dice.find(d => d.id === dieId);
                const newValue = random.d(6);
                return {
                    type: 'DIE_REROLLED',
                    payload: {
                        dieId,
                        oldValue: die?.value ?? newValue,
                        newValue,
                        playerId: attackerId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                };
            });
        },
    })];
}

/** 重掷至多5颗骰子（我又行了！/ 就这？） */
function handleRerollDie5({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectDieInteraction({
        playerId: attackerId,
        sourceAbilityId,
        count: 5,
        titleKey: 'interaction.selectDiceToReroll',
        onResolve: (selectedDiceIds) => {
            if (!random) return [];
            return selectedDiceIds.map(dieId => {
                const die = state.dice.find(d => d.id === dieId);
                const newValue = random.d(6);
                return {
                    type: 'DIE_REROLLED',
                    payload: {
                        dieId,
                        oldValue: die?.value ?? newValue,
                        newValue,
                        playerId: attackerId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                };
            });
        },
    })];
}

// ============================================================================
// 状态效果处理器
// ============================================================================

/** 移除1名玩家1个状态效果 */
function handleRemoveStatus1({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectStatusInteraction({
        playerId: attackerId,
        sourceAbilityId,
        state, // 传递 state
        targetPlayerIds: Object.keys(state.players),
        titleKey: 'interaction.selectStatusToRemove',
        onResolve: ({ playerId, statusId }) => [{
            type: 'STATUS_REMOVED',
            payload: {
                targetId: playerId,
                statusId,
                stacks: 1,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        }],
    })];
}

/** 移除1名玩家所有状态效果 */
function handleRemoveAllStatus({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectPlayerInteraction({
        playerId: attackerId,
        sourceAbilityId,
        count: 1,
        targetPlayerIds: Object.keys(state.players),
        titleKey: 'interaction.selectPlayerToRemoveAllStatus',
        onResolve: ([targetPlayerId]) => {
            const player = state.players[targetPlayerId];
            if (!player) return [];
            
            // Remove all status effects from the target player
            return Object.entries(player.statusEffects || {})
                .filter(([_, stacks]) => stacks > 0)
                .map(([statusId, stacks]) => ({
                    type: 'STATUS_REMOVED',
                    payload: {
                        targetId: targetPlayerId,
                        statusId,
                        stacks,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                }));
        },
    })];
}

/** 转移1个状态效果到另一玩家 */
function handleTransferStatus({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectStatusInteraction({
        playerId: attackerId,
        sourceAbilityId,
        state, // 传递 state
        targetPlayerIds: Object.keys(state.players),
        titleKey: 'interaction.selectStatusToTransfer',
        onResolve: ({ playerId: sourcePlayerId, statusId }) => {
            // After selecting the status, create a second interaction to select the target player
            return [createTransferStatusInteraction({
                playerId: attackerId,
                sourceAbilityId,
                sourcePlayerId,
                statusId,
                titleKey: 'interaction.selectPlayerToTransfer',
                onResolve: (targetPlayerId) => {
                    const sourcePlayer = state.players[sourcePlayerId];
                    if (!sourcePlayer) return [];
                    
                    const stacks = sourcePlayer.statusEffects?.[statusId] ?? 0;
                    if (stacks <= 0) return [];
                    
                    return [
                        {
                            type: 'STATUS_REMOVED',
                            payload: {
                                targetId: sourcePlayerId,
                                statusId,
                                stacks: 1,
                            },
                            sourceCommandType: 'ABILITY_EFFECT',
                            timestamp,
                        },
                        {
                            type: 'STATUS_APPLIED',
                            payload: {
                                targetId: targetPlayerId,
                                statusId,
                                stacks: 1,
                                newTotal: (state.players[targetPlayerId]?.statusEffects?.[statusId] ?? 0) + 1,
                                sourceAbilityId,
                            },
                            sourceCommandType: 'ABILITY_EFFECT',
                            timestamp: timestamp + 1,
                        },
                    ];
                },
            })];
        },
    })];
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
