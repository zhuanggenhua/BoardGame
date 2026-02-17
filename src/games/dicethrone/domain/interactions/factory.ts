/**
 * DiceThrone 交互工厂函数
 * 
 * 提供统一的交互创建接口，基于 InteractionSystem
 */

import type { DiceThroneEvent } from '../types';
import type {
    SelectPlayerInteractionConfig,
    SelectDieInteractionConfig,
    ModifyDieInteractionConfig,
    SelectStatusInteractionConfig,
    TransferStatusInteractionConfig,
} from './types';
import { createSimpleChoice, type PromptOption } from '../../../../engine/systems/InteractionSystem';

/**
 * 创建选择玩家交互
 * 
 * @example
 * // 圣骑士复仇 II：选择任意玩家授予反击 Token
 * return [createSelectPlayerInteraction({
 *     playerId: ctx.targetId,
 *     sourceAbilityId: 'vengeance-2',
 *     count: 1,
 *     titleKey: 'interaction.selectPlayerForRetribution',
 *     onResolve: ([targetPlayerId]) => [{
 *         type: 'TOKEN_GRANTED',
 *         payload: { targetId: targetPlayerId, tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 }
 *     }]
 * })];
 */
export function createSelectPlayerInteraction(config: SelectPlayerInteractionConfig): DiceThroneEvent {
    const {
        playerId,
        sourceAbilityId,
        count,
        targetPlayerIds,
        titleKey = 'interaction.selectPlayer',
        onResolve,
    } = config;

    return {
        type: 'INTERACTION_REQUESTED',
        payload: {
            id: `dt-select-player-${Date.now()}`,
            kind: 'dt:select-player',
            playerId,
            sourceId: sourceAbilityId,
            data: {
                count,
                targetPlayerIds,
                titleKey,
            },
            onResolve: (response: { selectedPlayerIds: string[] }) => {
                return onResolve(response.selectedPlayerIds);
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: Date.now(),
    } as DiceThroneEvent;
}

/**
 * 创建选择骰子交互
 * 
 * @example
 * // 强制重投：选择 2 个骰子重掷
 * return [createSelectDieInteraction({
 *     playerId: ctx.targetId,
 *     sourceAbilityId: 'force-reroll',
 *     count: 2,
 *     titleKey: 'interaction.selectDiceToReroll',
 *     onResolve: (selectedDiceIds) => selectedDiceIds.map(dieId => ({
 *         type: 'DIE_REROLLED',
 *         payload: { dieId, oldValue: state.dice.find(d => d.id === dieId)?.value ?? 1, newValue: random.d(6) }
 *     }))
 * })];
 */
export function createSelectDieInteraction(config: SelectDieInteractionConfig): DiceThroneEvent {
    const {
        playerId,
        sourceAbilityId,
        count,
        allowedDiceIds,
        titleKey = 'interaction.selectDice',
        onResolve,
    } = config;

    return {
        type: 'INTERACTION_REQUESTED',
        payload: {
            id: `dt-select-die-${Date.now()}`,
            kind: 'dt:select-die',
            playerId,
            sourceId: sourceAbilityId,
            data: {
                count,
                allowedDiceIds,
                titleKey,
            },
            onResolve: (response: { selectedDiceIds: number[] }) => {
                return onResolve(response.selectedDiceIds);
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: Date.now(),
    } as DiceThroneEvent;
}

/**
 * 创建修改骰子交互
 * 
 * @example
 * // 修改骰面：将骰子改为剑或盔
 * return [createModifyDieInteraction({
 *     playerId: ctx.targetId,
 *     sourceAbilityId: 'modify-die',
 *     dieId: 0,
 *     allowedValues: [1, 3], // 剑=1, 盔=3
 *     titleKey: 'interaction.modifyDie',
 *     onResolve: (newValue) => [{
 *         type: 'DIE_MODIFIED',
 *         payload: { dieId: 0, oldValue: state.dice[0].value, newValue }
 *     }]
 * })];
 */
export function createModifyDieInteraction(config: ModifyDieInteractionConfig): DiceThroneEvent {
    const {
        playerId,
        sourceAbilityId,
        dieId,
        allowedValues,
        titleKey = 'interaction.modifyDie',
        onResolve,
    } = config;

    // 为每个允许的值创建选项
    const options: PromptOption<number>[] = allowedValues.map((value, index) => ({
        id: `option-${index}`,
        label: `${value}`,
        value,
    }));

    // 使用 createSimpleChoice 创建标准交互
    const interaction = createSimpleChoice(
        `${sourceAbilityId}-modify-die`,
        playerId,
        titleKey,
        options,
        { sourceId: sourceAbilityId }
    );

    // 创建 INTERACTION_REQUESTED 事件
    return {
        type: 'INTERACTION_REQUESTED',
        payload: {
            ...interaction,
            onResolve: (selectedValue: number) => {
                return onResolve(selectedValue);
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: Date.now(),
    } as unknown as DiceThroneEvent;
}

/**
 * 创建选择状态交互
 * 
 * @example
 * // 净化：选择一个负面状态移除
 * return [createSelectStatusInteraction({
 *     playerId: ctx.targetId,
 *     sourceAbilityId: 'purify',
 *     filter: (statusId) => purifiableStatusIds.includes(statusId),
 *     titleKey: 'interaction.selectStatusToRemove',
 *     onResolve: ({ playerId, statusId }) => [{
 *         type: 'STATUS_REMOVED',
 *         payload: { targetId: playerId, statusId, stacks: state.players[playerId].statusEffects[statusId] }
 *     }]
 * })];
 */
export function createSelectStatusInteraction(config: SelectStatusInteractionConfig): DiceThroneEvent {
    const {
        playerId,
        sourceAbilityId,
        state,
        targetPlayerIds,
        filter,
        titleKey = 'interaction.selectStatus',
        onResolve,
    } = config;

    // 收集所有可选的状态
    const options: PromptOption<{ playerId: string; statusId: string }>[] = [];
    const players = targetPlayerIds || Object.keys(state.players);
    
    let optionIndex = 0;
    for (const pid of players) {
        const player = state.players[pid];
        if (!player || !player.statusEffects) continue;
        
        for (const [statusId, stacks] of Object.entries(player.statusEffects)) {
            const stackCount = stacks as number;
            if (stackCount <= 0) continue;
            if (filter && !filter(statusId)) continue;
            
            options.push({
                id: `option-${optionIndex}`,  // 使用标准格式
                label: `${pid === playerId ? '自己' : '对手'}: ${statusId} (${stackCount})`,
                value: { playerId: pid, statusId },
            });
            optionIndex++;
        }
    }

    // 使用 createSimpleChoice 创建标准交互
    const interaction = createSimpleChoice(
        `${sourceAbilityId}-select-status`,
        playerId,
        titleKey,
        options,
        { sourceId: sourceAbilityId }
    );

    // 创建 INTERACTION_REQUESTED 事件
    return {
        type: 'INTERACTION_REQUESTED',
        payload: {
            ...interaction,
            onResolve: (selectedValue: { playerId: string; statusId: string }) => {
                return onResolve(selectedValue);
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: Date.now(),
    } as unknown as DiceThroneEvent;
}

/**
 * 创建转移状态交互
 * 
 * @example
 * // 转移诅咒：将自己的诅咒转移给对手
 * return [createTransferStatusInteraction({
 *     playerId: ctx.targetId,
 *     sourceAbilityId: 'transfer-curse',
 *     sourcePlayerId: ctx.targetId,
 *     statusId: STATUS_IDS.CURSE,
 *     titleKey: 'interaction.selectPlayerToTransfer',
 *     onResolve: (targetPlayerId) => [
 *         { type: 'STATUS_REMOVED', payload: { targetId: ctx.targetId, statusId: STATUS_IDS.CURSE, stacks: 1 } },
 *         { type: 'STATUS_APPLIED', payload: { targetId: targetPlayerId, statusId: STATUS_IDS.CURSE, stacks: 1 } }
 *     ]
 * })];
 */
export function createTransferStatusInteraction(config: TransferStatusInteractionConfig): DiceThroneEvent {
    const {
        playerId,
        sourceAbilityId,
        sourcePlayerId,
        statusId,
        titleKey = 'interaction.transferStatus',
        onResolve,
    } = config;

    return {
        type: 'INTERACTION_REQUESTED',
        payload: {
            id: `dt-transfer-status-${Date.now()}`,
            kind: 'dt:transfer-status',
            playerId,
            sourceId: sourceAbilityId,
            data: {
                sourcePlayerId,
                statusId,
                titleKey,
            },
            onResolve: (response: { targetPlayerId: string }) => {
                return onResolve(response.targetPlayerId);
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: Date.now(),
    } as DiceThroneEvent;
}
