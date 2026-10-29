import type { InteractionDescriptor, MultistepChoiceData } from '../../../engine/systems/InteractionSystem';
import type { PendingBonusDiceSettlement } from '../domain/core-types';
import { parseDiceInteractionContract } from './diceInteractionContract';
import {
    diceModifyReducer,
    diceModifyToCommands,
    diceSelectReducer,
    diceSelectToCommands,
    type DiceModifyResult,
    type DiceModifyStep,
    type DiceSelectResult,
    type DiceSelectStep,
} from '../domain/diceInteraction';

type ClientDiceInteractionData = MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult> & {
    completedSteps?: number;
    completedDieIds?: number[];
    allowedDieIds?: number[];
    allowRepeatedDieSelection?: boolean;
};

export function rebuildClientDiceMultistepInteraction(
    interaction: InteractionDescriptor | undefined,
): InteractionDescriptor<ClientDiceInteractionData> | undefined {
    if (interaction?.kind !== 'multistep-choice') return undefined;

    const originalData = (interaction.data ?? {}) as ClientDiceInteractionData;
    const rawMeta = originalData.meta as Record<string, unknown> | undefined;
    if (!rawMeta || rawMeta.dtType === undefined) return undefined;
    const parsed = parseDiceInteractionContract(interaction);
    if (parsed.kind === 'invalid') {
        throw new Error(`[DiceThrone] Cannot rebuild invalid dice interaction: ${interaction.id} (${parsed.reason})`);
    }
    if (parsed.kind !== 'valid') return undefined;
    const { meta, allowedDieIds, completedDieIds, completedCount } = parsed;

    if (meta.dtType === 'modifyDie') {
        const config = meta.dieModifyConfig;
        const isManualConfirmMode = config?.mode === 'any' || config?.mode === 'adjust';
        const selectCount = meta.selectCount;
        const remainingSelectCount = Math.max(0, selectCount - completedCount);
        const allowedDieIdSet = allowedDieIds ? new Set(allowedDieIds) : undefined;
        const explicitMaxSteps = originalData.maxSteps;
        const autoConfirmSteps = isManualConfirmMode ? undefined : (explicitMaxSteps ?? selectCount);

        return {
            ...interaction,
            data: {
                ...originalData,
                initialResult: (originalData.initialResult as DiceModifyResult | undefined)
                    ?? { modifications: {}, modCount: 0, totalAdjustment: 0 },
                localReducer: (current: unknown, step: unknown) =>
                    diceModifyReducer(current as DiceModifyResult, step as DiceModifyStep, config, remainingSelectCount),
                toCommands: result => diceModifyToCommands(result as DiceModifyResult, remainingSelectCount),
                validateStep: (_current: unknown, step: unknown) => {
                    const candidate = step as DiceModifyStep;
                    if (!('dieId' in candidate)) return true;
                    return (!allowedDieIdSet || allowedDieIdSet.has(candidate.dieId))
                        && !completedDieIds.includes(candidate.dieId);
                },
                getCompletedSteps: result => completedCount + (result as DiceModifyResult).modCount,
                maxSteps: autoConfirmSteps,
                minSteps: isManualConfirmMode
                    ? (Number(originalData.minSteps) || 1)
                    : (originalData.minSteps ?? autoConfirmSteps),
                completedDieIds,
                completedSteps: originalData.completedSteps,
                allowedDieIds,
            },
        };
    }

    if (meta.dtType === 'selectDie') {
        const selectCount = meta.selectCount;
        const allowRepeatedDieSelection = meta.allowRepeatedDieSelection === true;
        const isBonusGroupReroll = meta.selectionMode === 'bonusGroupReroll';
        const isRepeatedReroll = allowRepeatedDieSelection;
        const allowedDieIdSet = allowedDieIds ? new Set(allowedDieIds) : undefined;
        const remainingSelectCount = Math.max(0, selectCount - completedCount);
        const completedDieIdSet = new Set(completedDieIds);

        return {
            ...interaction,
            data: {
                ...originalData,
                initialResult: { selectedDiceIds: [] } as DiceSelectResult,
                localReducer: (current: unknown, step: unknown) =>
                    diceSelectReducer(current as DiceSelectResult, step as DiceSelectStep, remainingSelectCount, allowRepeatedDieSelection),
                toCommands: result => {
                    const selection = result as DiceSelectResult;
                    if (isBonusGroupReroll) {
                        const dieIndices = selection.selectedDiceIds;
                        if (
                            dieIndices.length === 0
                            || !allowedDieIdSet
                            || new Set(dieIndices).size !== dieIndices.length
                            || dieIndices.length > remainingSelectCount
                            || dieIndices.some(dieId => !allowedDieIdSet.has(dieId))
                        ) return [];
                        return [{
                            type: 'REROLL_BONUS_DIE',
                            payload: { dieIndex: dieIndices[0], dieIndices },
                        }];
                    }
                    return diceSelectToCommands(selection, remainingSelectCount);
                },
                validateStep: (current: unknown, step: unknown) => {
                    const selection = current as DiceSelectResult;
                    const candidate = step as DiceSelectStep;
                    if (candidate.action !== 'toggle') return false;
                    if (isBonusGroupReroll && !allowedDieIdSet) return false;
                    if (allowedDieIdSet && !allowedDieIdSet.has(candidate.dieId)) return false;
                    if (!allowRepeatedDieSelection && completedDieIdSet.has(candidate.dieId)) return false;
                    return allowRepeatedDieSelection
                        || selection.selectedDiceIds.includes(candidate.dieId)
                        || selection.selectedDiceIds.length < remainingSelectCount;
                },
                getCompletedSteps: result => completedCount + (result as DiceSelectResult).selectedDiceIds.length,
                maxSteps: isRepeatedReroll
                    ? (originalData.maxSteps ?? selectCount)
                    : originalData.maxSteps,
                minSteps: originalData.minSteps ?? 1,
                confirmationMode: isRepeatedReroll || isBonusGroupReroll ? 'submitBatch' : originalData.confirmationMode,
                shouldResolveOnConfirm: isBonusGroupReroll
                    ? () => false
                    : isRepeatedReroll
                        ? result => (result as DiceSelectResult).selectedDiceIds.length === 0
                        : undefined,
                allowedDieIds,
                completedDieIds,
                completedSteps: originalData.completedSteps,
                allowRepeatedDieSelection,
            },
        };
    }

    return undefined;
}

/**
 * 把真实 bonus settlement 上的可选组重掷映射到既有多步骰子交互。
 * 这只是客户端投影；settlement、授权和结算仍由 dt:bonus-dice 与领域状态负责。
 */
export function createClientBonusDiceGroupRerollInteraction(
    interaction: InteractionDescriptor | undefined,
    settlement: PendingBonusDiceSettlement | undefined,
    canReroll: boolean,
): InteractionDescriptor<ClientDiceInteractionData> | undefined {
    if (
        interaction?.kind !== 'dt:bonus-dice'
        || !settlement?.groupReroll
        || !canReroll
        || interaction.id !== `dt-bonus-dice-${settlement.id}`
        || String(interaction.playerId) !== String(settlement.attackerId)
    ) {
        return undefined;
    }

    const allowedDieIds = Array.from(new Set(settlement.dice.map(die => die.index)));
    if (allowedDieIds.length === 0) return undefined;
    const projectedInteraction: InteractionDescriptor = {
        id: `${interaction.id}:group-reroll`,
        kind: 'multistep-choice',
        playerId: settlement.attackerId,
        data: {
            title: 'interaction.hint_group_reroll',
            minSteps: 0,
            confirmationMode: 'submitBatch',
            allowedDieIds,
            meta: {
                dtType: 'selectDie',
                selectionMode: 'bonusGroupReroll',
                selectCount: allowedDieIds.length,
                diceOwnerId: settlement.attackerId,
                targetOpponentDice: false,
                allowRepeatedDieSelection: false,
            },
        },
    };
    return rebuildClientDiceMultistepInteraction(projectedInteraction);
}
