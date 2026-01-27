/**
 * useDiceInteractionConfig Hook
 * 
 * 生成骰子交互配置对象，封装复杂的骰子选择、修改、确认逻辑。
 * 
 * @example
 * ```typescript
 * const diceInteractionConfig = useDiceInteractionConfig({
 *   pendingInteraction: G.pendingInteraction,
 *   isInteractionOwner: true,
 *   localState,
 *   G,
 *   engineMoves,
 *   onCancel: handleCancelInteraction,
 *   setRerollingDiceIds,
 *   onModifyDieLocal
 * });
 * 
 * // 传递给 DiceTray 组件
 * <DiceTray interactionConfig={diceInteractionConfig} />
 * ```
 */

import { useMemo, useCallback } from 'react';
import type { PendingInteraction, Die } from '../domain/types';
import type { DiceInteractionConfig } from '../ui/DiceTray';
import type { LocalInteractionState } from './useInteractionState';

/**
 * 骰子交互配置所需的参数
 */
export interface DiceInteractionConfigParams {
    /** 当前待处理的交互 */
    pendingInteraction?: PendingInteraction;
    /** 是否为交互所有者 */
    isInteractionOwner: boolean;
    /** 本地交互状态 */
    localState: LocalInteractionState;
    /** 当前骰子列表 */
    dice: Die[];
    /** 引擎 moves */
    engineMoves: {
        modifyDie: (dieId: number, newValue: number) => void;
        confirmInteraction: (interactionId: string, selectedDiceIds?: number[]) => void;
    };
    /** 取消交互回调 */
    onCancel: () => void;
    /** 设置重掷骰子 ID 列表（用于动画） */
    setRerollingDiceIds: (ids: number[]) => void;
    /** 本地骰子选择处理器 */
    onSelectDieLocal: (dieId: number) => void;
    /** 本地骰子修改处理器 */
    onModifyDieLocal: (dieId: number, newValue: number) => void;
}

/**
 * 生成骰子交互配置
 * 
 * @param params - 配置参数
 * @returns 骰子交互配置对象（传递给 DiceTray 组件）
 */
export function useDiceInteractionConfig(
    params: DiceInteractionConfigParams
): DiceInteractionConfig | undefined {
    const {
        pendingInteraction,
        isInteractionOwner,
        localState,
        dice,
        engineMoves,
        onCancel,
        setRerollingDiceIds,
        onSelectDieLocal,
        onModifyDieLocal
    } = params;

    // 判断是否为骰子交互
    const isDiceInteraction = pendingInteraction && (
        pendingInteraction.type === 'selectDie' || pendingInteraction.type === 'modifyDie'
    );

    /**
     * 确认交互处理器
     */
    const handleConfirm = useCallback(() => {
        if (!pendingInteraction) return;

        const mode = pendingInteraction.dieModifyConfig?.mode;
        const targetValue = pendingInteraction.dieModifyConfig?.targetValue;

        // set 模式：选择骰子后自动设为目标值（如 card-play-six 设为 6）
        if (mode === 'set' && targetValue !== undefined && localState.selectedDice.length > 0) {
            localState.selectedDice.forEach(dieIdStr => {
                engineMoves.modifyDie(Number(dieIdStr), targetValue);
            });
        }

        // copy 模式：将第二颗骰子的值设为第一颗骰子的值
        if (mode === 'copy' && localState.selectedDice.length === 2) {
            const sourceDieId = Number(localState.selectedDice[0]);
            const targetDieId = Number(localState.selectedDice[1]);
            const sourceDie = dice.find(d => d.id === sourceDieId);
            if (sourceDie) {
                engineMoves.modifyDie(targetDieId, sourceDie.value);
            }
        }

        // any 模式：修改已经在 onModifyDie 中实时完成，直接确认即可

        // selectDie 模式：把选中的骰子 ID 传给 confirmInteraction，由后端批量重掷
        if (pendingInteraction.type === 'selectDie' && localState.selectedDice.length > 0) {
            const selectedDiceIds = localState.selectedDice.map(id => Number(id));
            // 触发重掷动画
            setRerollingDiceIds(selectedDiceIds);
            // 动画结束后清除状态
            setTimeout(() => setRerollingDiceIds([]), 600);
            engineMoves.confirmInteraction(pendingInteraction.id, selectedDiceIds);
        } else {
            engineMoves.confirmInteraction(pendingInteraction.id);
        }
    }, [pendingInteraction, localState.selectedDice, dice, engineMoves, setRerollingDiceIds]);

    return useMemo(() => {
        // 只有当存在骰子交互且是交互所有者时才返回配置
        if (!isDiceInteraction || !pendingInteraction || !isInteractionOwner) {
            return undefined;
        }

        return {
            interaction: {
                ...pendingInteraction,
                selected: localState.selectedDice,
            },
            modifiedDice: localState.modifiedDice,
            totalAdjustment: localState.totalAdjustment,
            onSelectDie: onSelectDieLocal,
            onModifyDie: onModifyDieLocal,
            onConfirm: handleConfirm,
            onCancel,
        };
    }, [
        isDiceInteraction,
        pendingInteraction,
        isInteractionOwner,
        localState,
        onSelectDieLocal,
        onModifyDieLocal,
        handleConfirm,
        onCancel
    ]);
}
