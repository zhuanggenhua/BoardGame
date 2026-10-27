import { describe, expect, it } from 'vitest';
import type { InteractionDescriptor } from '../../../../engine/systems/InteractionSystem';
import { diceModifyReducer, diceModifyToCommands } from '../../domain/diceInteraction';
import { getDiceInteractionHint } from '../diceInteractionContract';
import { rebuildClientDiceMultistepInteraction } from '../clientDiceMultistepInteraction';

// 预期来源：公共固定6旧流程；索尔原卡27只允许4/5；原卡22及FAQ为任选子集一次。
describe('固定结果与批量重掷的共享操作合同', () => {
    const config = { mode: 'set' as const, allowedValues: [4, 5] as [number, ...number[]] };
    const interaction: InteractionDescriptor = { id: 'fixed-results', kind: 'multistep-choice', playerId: '0', data: {
        minSteps: 1, meta: { dtType: 'modifyDie', dieModifyConfig: config, selectCount: 1, diceOwnerId: '0', targetOpponentDice: false },
    } };
    it.each([4, 5])('固定结果%s先选值再点骰，只有点骰才产生正式命令，沿旧set自动提交', value => {
        const initial = { modifications: {}, modCount: 0, totalAdjustment: 0 };
        const rebuilt = rebuildClientDiceMultistepInteraction(interaction)!;
        expect(rebuilt.data.maxSteps).toBe(1);
        expect(getDiceInteractionHint({ interaction, result: initial, rootPlayerId: '0' })?.key).toBe('interaction.hint_choose_value');
        const before = diceModifyReducer(initial, { action: 'select', dieId: 0, dieValue: 1 }, config, 1);
        expect(diceModifyToCommands(before)).toEqual([]);
        const chosen = diceModifyReducer(initial, { action: 'chooseValue', value }, config, 1);
        expect(chosen.modCount).toBe(0);
        expect(diceModifyToCommands(chosen)).toEqual([]);
        expect(getDiceInteractionHint({ interaction, result: chosen, rootPlayerId: '0' })).toEqual({ key: 'interaction.hint_set', params: { value } });
        const final = diceModifyReducer(chosen, { action: 'select', dieId: 0, dieValue: 1 }, config, 1);
        expect(diceModifyToCommands(final)).toEqual([{ type: 'MODIFY_DIE', payload: { dieId: 0, newValue: value } }]);
    });
    it('非候选值不能进入固定结果选择', () => {
        const initial = { modifications: {}, modCount: 0, totalAdjustment: 0 };
        expect(diceModifyReducer(initial, { action: 'chooseValue', value: 6 }, config, 1)).toEqual(initial);
    });
    it.each([{ selectedIds: [] }, { selectedIds: [0, 2] }])('子集状态$selectedIds必有当前提示，空选保留结果与已选批量重掷分别表达', ({ selectedIds }) => {
        const hint = getDiceInteractionHint({ rootPlayerId: '0', groupBonusReroll: { kind: 'selectSubset', selectedIds, onSubmit: () => {} } });
        expect(hint).toEqual({ key: selectedIds.length ? 'interaction.hint_group_reroll_selected' : 'interaction.hint_group_reroll', params: { count: selectedIds.length } });
    });
});
