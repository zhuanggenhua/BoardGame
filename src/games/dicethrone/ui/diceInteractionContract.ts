import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { DieModifyConfig } from '../domain/core-types';
import type { PlayerId } from '../../../engine/types';
import type { DiceModifyResult, DiceSelectResult } from '../domain/diceInteraction';

export type DiceInteractionMeta = {
    selectCount: number;
    diceOwnerId?: PlayerId;
    targetOpponentDice: boolean;
} & (
    | { dtType: 'modifyDie'; dieModifyConfig: DieModifyConfig }
    | { dtType: 'selectDie'; allowRepeatedDieSelection?: boolean }
);

/** 此分型同时授权选骰和当前提示，调用方不再另传可选提示。 */
export interface GroupBonusReroll {
    kind: 'selectSubset';
    selectedIds: number[];
    onSubmit: () => void;
}

export function getDiceInteractionMeta(interaction?: InteractionDescriptor): DiceInteractionMeta | undefined {
    if (interaction?.kind !== 'multistep-choice') return undefined;
    const meta = (interaction.data as { meta?: DiceInteractionMeta }).meta;
    return meta?.dtType ? meta : undefined;
}

export function getCompletedDiceStepCount(interaction?: InteractionDescriptor, meta?: DiceInteractionMeta): number {
    if (interaction?.kind !== 'multistep-choice') return 0;
    const data = interaction.data as { completedSteps?: number; completedDieIds?: number[] };
    if (typeof data.completedSteps === 'number' && Number.isFinite(data.completedSteps)) return Math.max(0, Math.floor(data.completedSteps));
    const ids = data.completedDieIds ?? [];
    return meta?.dtType === 'selectDie' && meta.allowRepeatedDieSelection ? ids.length : new Set(ids).size;
}

/** 提示投影与选骰/改骰消费同一份操作合同和当前进度。 */
export function getDiceInteractionHint(input: {
    interaction?: InteractionDescriptor;
    result?: DiceModifyResult | DiceSelectResult;
    groupBonusReroll?: GroupBonusReroll;
    rootPlayerId: PlayerId;
    teamIdByPlayerId?: Record<PlayerId, string>;
}): { key: string; params?: Record<string, string | number> } | undefined {
    if (input.groupBonusReroll) {
        switch (input.groupBonusReroll.kind) {
            case 'selectSubset': return {
                key: input.groupBonusReroll.selectedIds.length ? 'interaction.hint_group_reroll_selected' : 'interaction.hint_group_reroll',
                params: { count: input.groupBonusReroll.selectedIds.length },
            };
        }
    }
    const meta = getDiceInteractionMeta(input.interaction);
    if (!meta) return undefined;
    const modify = input.result as DiceModifyResult | undefined;
    const select = input.result as DiceSelectResult | undefined;
    const count = getCompletedDiceStepCount(input.interaction, meta)
        + (meta.dtType === 'modifyDie' ? modify?.modCount ?? 0 : select?.selectedDiceIds.length ?? 0);
    const done = count >= meta.selectCount;
    if (meta.dtType === 'modifyDie') {
        const config = meta.dieModifyConfig;
        switch (config.mode) {
            case 'set': {
                const value = config.targetValue ?? modify?.targetValue;
                return done ? { key: 'interaction.hint_done' }
                    : value === undefined ? { key: 'interaction.hint_choose_value' }
                    : { key: 'interaction.hint_set', params: { value } };
            }
            case 'copy': return count === 0 ? { key: 'interaction.hint_copy_step1' }
                : count === 1 ? { key: 'interaction.hint_copy_step2', params: { value: Object.values(modify?.modifications ?? {})[0] } }
                : { key: 'interaction.hint_done' };
            case 'adjust': return { key: 'interaction.hint_adjust' };
            case 'any': return { key: done ? 'interaction.hint_done' : 'interaction.hint_any' };
        }
    }
    let key = meta.targetOpponentDice ? 'interaction.hint_select_opponent' : 'interaction.hint_select';
    if (meta.diceOwnerId && meta.diceOwnerId !== input.rootPlayerId) {
        const ownerTeam = input.teamIdByPlayerId?.[meta.diceOwnerId];
        const rootTeam = input.teamIdByPlayerId?.[input.rootPlayerId];
        key = ownerTeam && ownerTeam === rootTeam ? 'interaction.hint_select_ally' : 'interaction.hint_select_opponent';
    }
    return { key: done ? 'interaction.hint_done' : key, params: { current: count, max: meta.selectCount } };
}
