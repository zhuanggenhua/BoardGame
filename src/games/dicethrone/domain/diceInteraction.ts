/** 骰子交互的纯状态累积与正式命令转换，不加载事件系统或效果注册。 */
import type { InteractionDescriptor as DtInteractionDescriptor } from './core-types';

/** 骰子修改累积结果 */
export interface DiceModifyResult {
    /** 固定结果有多个候选时，当前选择的结果；尚未修改任何骰子。 */
    targetValue?: number;
    /** 骰子修改映射：dieId → newValue */
    modifications: Record<number, number>;
    /** 已修改的骰子数量 */
    modCount: number;
    /** adjust 模式累计调整量 */
    totalAdjustment: number;
}

/** 骰子修改步骤 */
export type DiceModifyStep =
    | { action: 'chooseValue'; value: number }
    | { action: 'select'; dieId: number; dieValue: number }
    | { action: 'adjust'; dieId: number; delta: number; currentValue: number }
    | { action: 'setAny'; dieId: number; newValue: number };

/** 骰子选择（重掷）累积结果 */
export interface DiceSelectResult {
    /** 选中的骰子 ID 列表 */
    selectedDiceIds: number[];
}

/** 骰子选择步骤 */
export type DiceSelectStep = { action: 'toggle'; dieId: number };

/**
 * 骰子修改 localReducer
 * 根据模式处理不同的步骤类型
 * 导出供客户端在序列化边界后重新注入（函数无法通过 JSON 传输）
 */
export function diceModifyReducer(
    current: DiceModifyResult,
    step: DiceModifyStep,
    config: DtInteractionDescriptor['dieModifyConfig'],
    maxSelectCount?: number,
): DiceModifyResult {
    const mode = config?.mode;
    if (step.action === 'chooseValue') {
        if (config?.mode !== 'set' || !config.allowedValues?.includes(step.value) || current.modCount > 0) return current;
        return { ...current, targetValue: step.value };
    }
    const hasReachedSelectionLimit = (dieId: number): boolean => {
        if (typeof maxSelectCount !== 'number' || maxSelectCount <= 0) return false;
        const alreadyTracked = Object.prototype.hasOwnProperty.call(current.modifications, String(dieId));
        return !alreadyTracked && current.modCount >= maxSelectCount;
    };

    if (step.action === 'select') {
        // set 模式：选中骰子，记录目标值
        if (mode === 'set') {
            if (Object.prototype.hasOwnProperty.call(current.modifications, String(step.dieId))) return current;
            if (hasReachedSelectionLimit(step.dieId)) return current;
            const targetValue = config?.targetValue ?? current.targetValue;
            if (targetValue === undefined || (config?.allowedValues && !config.allowedValues.includes(targetValue))) return current;
            return {
                ...current,
                modifications: { ...current.modifications, [step.dieId]: targetValue },
                modCount: current.modCount + 1,
            };
        }
        // copy 模式：第一颗记录源值，第二颗复制源值
        if (mode === 'copy') {
            const entries = Object.entries(current.modifications);
            if (Object.prototype.hasOwnProperty.call(current.modifications, String(step.dieId))) return current;
            if (entries.length === 0) {
                if (hasReachedSelectionLimit(step.dieId)) return current;
                // 第一颗：记录源骰子（值不变）
                return {
                    ...current,
                    modifications: { [step.dieId]: step.dieValue },
                    modCount: 1,
                };
            }
            if (hasReachedSelectionLimit(step.dieId)) return current;
            // 第二颗：复制第一颗的值
            const sourceValue = Number(entries[0][1]);
            return {
                ...current,
                modifications: { ...current.modifications, [step.dieId]: sourceValue },
                modCount: current.modCount + 1,
            };
        }
        return current;
    }

    if (step.action === 'adjust') {
        if (mode !== 'adjust') return current;
        // adjust 模式：累加调整量
        if (hasReachedSelectionLimit(step.dieId)) return current;
        const prevValue = current.modifications[step.dieId] ?? step.currentValue;
        const newValue = prevValue + step.delta;
        if (newValue < 1 || newValue > 6) return current;
        return {
            ...current,
            modifications: { ...current.modifications, [step.dieId]: newValue },
            modCount: Object.keys(current.modifications).includes(String(step.dieId))
                ? current.modCount
                : current.modCount + 1,
            totalAdjustment: current.totalAdjustment + step.delta,
        };
    }

    if (step.action === 'setAny') {
        if (mode !== 'any') return current;
        // any 模式：直接设置值
        if (hasReachedSelectionLimit(step.dieId)) return current;
        if (step.newValue < 1 || step.newValue > 6) return current;
        return {
            ...current,
            modifications: { ...current.modifications, [step.dieId]: step.newValue },
            modCount: Object.keys(current.modifications).includes(String(step.dieId))
                ? current.modCount
                : current.modCount + 1,
        };
    }

    return current;
}

/**
 * 骰子修改 toCommands：将累积结果转换为 MODIFY_DIE 命令列表
 * 导出供客户端在序列化边界后重新注入
 */
export function diceModifyToCommands(
    result: DiceModifyResult,
    maxSelectCount?: number,
): Array<{ type: string; payload: unknown }> {
    const modificationEntries = Object.entries(result.modifications)
        .filter(([, newValue]) => newValue !== undefined)
        .slice(0, typeof maxSelectCount === 'number' && maxSelectCount > 0 ? maxSelectCount : undefined);

    return modificationEntries
        .map(([dieId, newValue]) => ({
            type: 'MODIFY_DIE',
            payload: { dieId: Number(dieId), newValue },
        }));
}

/**
 * 骰子选择 localReducer（重掷）
 * 导出供客户端在序列化边界后重新注入
 */
export function diceSelectReducer(
    current: DiceSelectResult,
    step: DiceSelectStep,
    maxSelectCount?: number,
    allowRepeatedDieSelection = false,
): DiceSelectResult {
    if (step.action === 'toggle') {
        const idx = current.selectedDiceIds.indexOf(step.dieId);
        if (idx >= 0 && !allowRepeatedDieSelection) {
            return { selectedDiceIds: current.selectedDiceIds.filter(id => id !== step.dieId) };
        }
        if (typeof maxSelectCount === 'number' && maxSelectCount > 0 && current.selectedDiceIds.length >= maxSelectCount) {
            return current;
        }
        return { selectedDiceIds: [...current.selectedDiceIds, step.dieId] };
    }
    return current;
}

/**
 * 骰子选择 toCommands：将选中骰子转换为 REROLL_DIE 命令列表
 * 导出供客户端在序列化边界后重新注入
 */
export function diceSelectToCommands(
    result: DiceSelectResult,
    maxSelectCount?: number,
): Array<{ type: string; payload: unknown }> {
    const selectedDiceIds = result.selectedDiceIds
        .slice(0, typeof maxSelectCount === 'number' && maxSelectCount > 0 ? maxSelectCount : undefined);

    return selectedDiceIds.map(dieId => ({
        type: 'REROLL_DIE',
        payload: { dieId },
    }));
}
