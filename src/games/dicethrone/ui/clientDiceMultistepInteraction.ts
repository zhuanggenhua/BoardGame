import type { InteractionDescriptor, MultistepChoiceData } from '../../../engine/systems/InteractionSystem';
import {
    diceModifyReducer,
    diceModifyToCommands,
    diceSelectReducer,
    diceSelectToCommands,
    type DiceModifyResult,
    type DiceModifyStep,
    type DiceSelectResult,
    type DiceSelectStep,
} from '../domain/systems';

type DiceModifyConfig = Parameters<typeof diceModifyReducer>[2];

const readFiniteNumber = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const readNumberList = (value: unknown): number[] => (
    Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []
);

export function rebuildClientDiceMultistepInteraction(
    interaction: InteractionDescriptor | undefined,
): InteractionDescriptor<MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>> | undefined {
    if (interaction?.kind !== 'multistep-choice') return undefined;

    const originalData = (interaction.data ?? {}) as Record<string, unknown>;
    const meta = originalData.meta as Record<string, unknown> | undefined;
    if (!meta) return undefined;

    if (meta.dtType === 'modifyDie') {
        const config = meta.dieModifyConfig as DiceModifyConfig | undefined;
        const isManualConfirmMode = config?.mode === 'any' || config?.mode === 'adjust';
        const selectCount = Number(meta.selectCount) || 1;
        const completedDieIds = readNumberList(originalData.completedDieIds);
        const completedSteps = readFiniteNumber(originalData.completedSteps) !== undefined
            ? Math.max(0, Math.floor(readFiniteNumber(originalData.completedSteps)!))
            : undefined;
        const completedCount = completedSteps ?? Array.from(new Set(completedDieIds)).length;
        const remainingSelectCount = Math.max(0, selectCount - completedCount);
        const explicitMaxSteps = readFiniteNumber(originalData.maxSteps);
        const autoConfirmSteps = isManualConfirmMode ? undefined : (explicitMaxSteps ?? selectCount);

        return {
            ...interaction,
            data: {
                ...originalData,
                initialResult: (originalData.initialResult as DiceModifyResult | undefined)
                    ?? { modifications: {}, modCount: 0, totalAdjustment: 0 },
                localReducer: (current: unknown, step: unknown) =>
                    diceModifyReducer(current as DiceModifyResult, step as DiceModifyStep, config, remainingSelectCount),
                toCommands: (result: DiceModifyResult) => diceModifyToCommands(result, remainingSelectCount),
                getCompletedSteps: (result: DiceModifyResult) => completedCount + result.modCount,
                maxSteps: autoConfirmSteps,
                minSteps: isManualConfirmMode
                    ? (Number(originalData.minSteps) || 1)
                    : (originalData.minSteps ?? autoConfirmSteps),
                completedDieIds,
                completedSteps,
            },
        };
    }

    if (meta.dtType === 'selectDie') {
        const selectCount = Number(meta.selectCount) || 1;
        const allowRepeatedDieSelection = meta.allowRepeatedDieSelection === true;
        const isRepeatedReroll = allowRepeatedDieSelection;
        const completedDieIds = readNumberList(originalData.completedDieIds);
        const completedSteps = readFiniteNumber(originalData.completedSteps) !== undefined
            ? Math.max(0, Math.floor(readFiniteNumber(originalData.completedSteps)!))
            : undefined;
        const completedCount = allowRepeatedDieSelection
            ? (completedSteps ?? completedDieIds.length)
            : Array.from(new Set(completedDieIds)).length;
        const remainingSelectCount = Math.max(0, selectCount - completedCount);

        return {
            ...interaction,
            data: {
                ...originalData,
                initialResult: { selectedDiceIds: [] } as DiceSelectResult,
                localReducer: (current: unknown, step: unknown) =>
                    diceSelectReducer(current as DiceSelectResult, step as DiceSelectStep, remainingSelectCount, allowRepeatedDieSelection),
                toCommands: (result: DiceSelectResult) => diceSelectToCommands(result, remainingSelectCount),
                getCompletedSteps: (result: DiceSelectResult) => completedCount + result.selectedDiceIds.length,
                maxSteps: isRepeatedReroll
                    ? (readFiniteNumber(originalData.maxSteps) ?? selectCount)
                    : readFiniteNumber(originalData.maxSteps),
                minSteps: originalData.minSteps ?? 1,
                confirmationMode: isRepeatedReroll ? 'submitBatch' : originalData.confirmationMode,
                shouldResolveOnConfirm: isRepeatedReroll
                    ? (result: DiceSelectResult) => result.selectedDiceIds.length === 0
                    : undefined,
                allowedDieIds: originalData.allowedDieIds,
                completedDieIds,
                completedSteps,
                allowRepeatedDieSelection,
            },
        };
    }

    return undefined;
}
