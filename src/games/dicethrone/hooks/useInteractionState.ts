/**
 * useInteractionState Hook
 * 
 * 统一管理所有交互相关的本地状态（骰子选择、修改、状态选择等）
 * 自动在 pendingInteraction 变化时重置状态，避免状态不一致问题。
 * 
 * @example
 * ```typescript
 * const { localState, handlers } = useInteractionState(G.pendingInteraction);
 * 
 * // 使用状态
 * console.log(localState.selectedDice); // ['1', '3']
 * 
 * // 使用处理器
 * handlers.selectDie(1);
 * handlers.modifyDie(2, 5);
 * handlers.selectStatus('0', 'poison');
 * ```
 */

import { useState, useCallback, useEffect } from 'react';
import type { InteractionDescriptor } from '../domain/types';
import type { Die } from '../domain/types';

/**
 * 本地交互状态
 */
export interface LocalInteractionState {
    /** 已选择的骰子 ID（字符串数组） */
    selectedDice: string[];
    /** 已修改的骰子 ID 列表（用于 any 模式追踪） */
    modifiedDice: string[];
    /** 累计调整量（用于 adjust 模式） */
    totalAdjustment: number;
    /** 已选择的状态 */
    selectedStatus?: { playerId: string; statusId: string };
    /** 已选择的玩家 ID 列表 */
    selectedPlayers: string[];
    /** 已选择的手牌 ID 列表 */
    selectedCardIds: string[];
}

/**
 * 交互处理器
 */
export interface InteractionHandlers {
    /** 选择骰子 */
    selectDie: (dieId: number) => void;
    /** 修改骰子数值 */
    modifyDie: (dieId: number, newValue: number, currentDice: Die[]) => void;
    /** 选择状态效果 */
    selectStatus: (playerId: string, statusId: string) => void;
    /** 选择玩家 */
    selectPlayer: (playerId: string) => void;
    /** 选择手牌 */
    selectHandCard: (cardId: string) => void;
    /** 重置状态 */
    reset: () => void;
}

/**
 * 初始交互状态
 */
const INITIAL_STATE: LocalInteractionState = {
    selectedDice: [],
    modifiedDice: [],
    totalAdjustment: 0,
    selectedStatus: undefined,
    selectedPlayers: [],
    selectedCardIds: [],
};

function buildInteractionResetSignature(pendingInteraction?: InteractionDescriptor): string {
    if (!pendingInteraction) return 'none';

    return JSON.stringify({
        id: pendingInteraction.id,
        playerId: pendingInteraction.playerId,
        sourceCardId: pendingInteraction.sourceCardId,
        type: pendingInteraction.type,
        titleKey: pendingInteraction.titleKey,
        selectCount: pendingInteraction.selectCount,
        selected: pendingInteraction.selected,
        skipAbilityReselection: pendingInteraction.skipAbilityReselection,
        targetPlayerIds: pendingInteraction.targetPlayerIds,
        dieModifyConfig: pendingInteraction.dieModifyConfig,
        transferConfig: pendingInteraction.transferConfig,
        tokenGrantConfig: pendingInteraction.tokenGrantConfig,
        tokenGrantConfigs: pendingInteraction.tokenGrantConfigs,
        statusGrantConfig: pendingInteraction.statusGrantConfig,
        statusGrantConfigs: pendingInteraction.statusGrantConfigs,
        resolveCustomActionId: pendingInteraction.resolveCustomActionId,
        diceOwnerId: pendingInteraction.diceOwnerId,
        targetOpponentDice: pendingInteraction.targetOpponentDice,
        allowedDieIds: pendingInteraction.allowedDieIds,
        completedDieIds: pendingInteraction.completedDieIds,
        requiresTargetWithStatus: pendingInteraction.requiresTargetWithStatus,
    });
}

/**
 * 管理交互状态的 Hook
 * 
 * @param pendingInteraction - 当前待处理的交互（来自游戏状态）
 * @returns 本地状态和处理器
 */
export function useInteractionState(pendingInteraction?: InteractionDescriptor) {
    const [localState, setLocalState] = useState<LocalInteractionState>(INITIAL_STATE);
    const interactionResetSignature = buildInteractionResetSignature(pendingInteraction);

    // 当交互语义变化时自动重置状态，避免同 id 下候选/上下文漂移时残留旧选择
    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) {
                setLocalState(INITIAL_STATE);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [interactionResetSignature]);

    /**
     * 选择骰子（支持单选和多选）
     */
    const selectDie = useCallback((dieId: number) => {
        if (!pendingInteraction) return;
        
        const dieIdStr = String(dieId);
        const maxSelectCount = pendingInteraction.selectCount ?? 1;
        
        setLocalState(prev => {
            const isSelected = prev.selectedDice.includes(dieIdStr);
            
            // 如果已选中，则取消选择
            if (isSelected) {
                return {
                    ...prev,
                    selectedDice: prev.selectedDice.filter(id => id !== dieIdStr)
                };
            }
            
            // 如果未达到上限，添加选择
            if (prev.selectedDice.length < maxSelectCount) {
                return {
                    ...prev,
                    selectedDice: [...prev.selectedDice, dieIdStr]
                };
            }
            
            // 如果已达到上限，替换最后一个
            return {
                ...prev,
                selectedDice: [...prev.selectedDice.slice(0, -1), dieIdStr]
            };
        });
    }, [pendingInteraction]);

    /**
     * 修改骰子数值
     */
    const modifyDie = useCallback((dieId: number, newValue: number, currentDice: Die[]) => {
        if (!pendingInteraction) return;
        
        const dieIdStr = String(dieId);
        const currentDie = currentDice.find(d => d.id === dieId);
        if (!currentDie) return;
        
        const delta = newValue - currentDie.value;
        const isAdjustMode = pendingInteraction.dieModifyConfig?.mode === 'adjust';
        
        setLocalState(prev => {
            // 追踪已修改的骰子（用于 any 模式）
            const newModifiedDice = prev.modifiedDice.includes(dieIdStr)
                ? prev.modifiedDice
                : [...prev.modifiedDice, dieIdStr];
            
            // 累计调整量（用于 adjust 模式）
            const newTotalAdjustment = isAdjustMode 
                ? prev.totalAdjustment + delta 
                : prev.totalAdjustment;
            
            return {
                ...prev,
                modifiedDice: newModifiedDice,
                totalAdjustment: newTotalAdjustment
            };
        });
    }, [pendingInteraction]);

    /**
     * 选择状态效果
     */
    const selectStatus = useCallback((playerId: string, statusId: string) => {
        setLocalState(prev => ({
            ...prev,
            selectedStatus: { playerId, statusId }
        }));
    }, []);

    /**
     * 选择玩家
     */
    const selectPlayer = useCallback((playerId: string) => {
        const maxSelectCount = pendingInteraction?.selectCount ?? 1;
        setLocalState(prev => ({
            ...prev,
            selectedPlayers: prev.selectedPlayers.includes(playerId)
                ? prev.selectedPlayers.filter(id => id !== playerId)
                : (prev.selectedPlayers.length < maxSelectCount
                    ? [...prev.selectedPlayers, playerId]
                    : prev.selectedPlayers),
        }));
    }, [pendingInteraction?.selectCount]);

    /**
     * 选择手牌（用于由持有者自行弃牌的交互）
     */
    const selectHandCard = useCallback((cardId: string) => {
        const maxSelectCount = pendingInteraction?.selectCount ?? 1;
        setLocalState(prev => ({
            ...prev,
            selectedCardIds: prev.selectedCardIds.includes(cardId)
                ? prev.selectedCardIds.filter(id => id !== cardId)
                : (prev.selectedCardIds.length < maxSelectCount
                    ? [...prev.selectedCardIds, cardId]
                    : prev.selectedCardIds),
        }));
    }, [pendingInteraction?.selectCount]);

    /**
     * 手动重置状态
     */
    const reset = useCallback(() => {
        setLocalState(INITIAL_STATE);
    }, []);

    return {
        localState,
        handlers: {
            selectDie,
            modifyDie,
            selectStatus,
            selectPlayer,
            selectHandCard,
            reset
        }
    };
}
