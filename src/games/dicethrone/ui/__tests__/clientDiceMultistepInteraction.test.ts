import { describe, expect, it } from 'vitest';
import type { InteractionDescriptor } from '../../../../engine/systems/InteractionSystem';
import { createClientBonusDiceGroupRerollInteraction, rebuildClientDiceMultistepInteraction } from '../clientDiceMultistepInteraction';
import type { PendingBonusDiceSettlement } from '../../domain/core-types';

const bonusDiceInteraction: InteractionDescriptor = {
    id: 'dt-bonus-dice-thor-odin-ii-22',
    kind: 'dt:bonus-dice',
    playerId: '0',
    data: null,
};

const groupRerollSettlement: PendingBonusDiceSettlement = {
    id: 'thor-odin-ii-22',
    sourceAbilityId: 'odin-power-2',
    attackerId: '0',
    targetId: '1',
    dice: [
        { index: 1, value: 2, face: 'hammer' },
        { index: 3, value: 4, face: 'lightning' },
    ],
    rerollCostTokenId: 'taiji',
    rerollCostAmount: 0,
    rerollCount: 0,
    maxRerollCount: 1,
    groupReroll: true,
    readyToSettle: true,
};

describe('rebuildClientDiceMultistepInteraction', () => {
    it.each([
        {
            id: 'missing-select-count',
            meta: { dtType: 'selectDie', selectionMode: 'reroll', targetOpponentDice: false },
        },
        {
            id: 'missing-selection-mode',
            meta: { dtType: 'selectDie', selectCount: 1, targetOpponentDice: false },
        },
        {
            id: 'missing-modify-config',
            meta: { dtType: 'modifyDie', selectCount: 1 },
        },
    ])('不会把缺失语义的 $id 多步骰子交互重建成默认操作', ({ id, meta }) => {
        const malformed: InteractionDescriptor = {
            id,
            kind: 'multistep-choice',
            playerId: '0',
            data: { meta },
        };

        expect(() => rebuildClientDiceMultistepInteraction(malformed))
            .toThrow(`Cannot rebuild invalid dice interaction: ${id}`);
    });

    it('历史完成骰由共享合同限制后续选择，重复重掷规则仍可再次选择同骰', () => {
        const interaction: InteractionDescriptor = {
            id: 'selection-with-completed-die',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                minSteps: 0,
                allowedDieIds: [0, 1],
                completedDieIds: [0],
                completedSteps: 1,
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'reroll',
                    selectCount: 2,
                    targetOpponentDice: false,
                },
            },
        };
        const rebuilt = rebuildClientDiceMultistepInteraction(interaction)!;

        expect(rebuilt.data.validateStep?.({ selectedDiceIds: [] }, { action: 'toggle', dieId: 0 })).toBe(false);
        expect(rebuilt.data.validateStep?.({ selectedDiceIds: [] }, { action: 'toggle', dieId: 1 })).toBe(true);
        expect(rebuilt.data.getCompletedSteps?.({ selectedDiceIds: [1] })).toBe(2);

        const repeatInteraction: InteractionDescriptor = {
            ...interaction,
            id: 'repeated-selection-with-completed-die',
            data: {
                ...interaction.data,
                allowRepeatedDieSelection: true,
                meta: {
                    ...interaction.data.meta,
                    allowRepeatedDieSelection: true,
                },
            },
        };
        const repeatRebuilt = rebuildClientDiceMultistepInteraction(repeatInteraction)!;
        expect(repeatRebuilt.data.validateStep?.({ selectedDiceIds: [] }, { action: 'toggle', dieId: 0 })).toBe(true);
    });

    it('线上 card-me-too copy 交互只有 minSteps 时，客户端按固定两步补 auto-confirm 上限', () => {
        const interaction: InteractionDescriptor = {
            id: 'dt-dice-modify-card-me-too-1787471579440',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                title: 'interaction.selectDieToCopy',
                sourceId: 'card-me-too',
                minSteps: 2,
                initialResult: { modifications: {}, modCount: 0, totalAdjustment: 0 },
                allowedDieIds: [0, 1, 2, 3, 4],
                completedDieIds: [],
                meta: {
                    dtType: 'modifyDie',
                    dieModifyConfig: { mode: 'copy' },
                    selectCount: 2,
                    diceOwnerId: '0',
                    targetOpponentDice: false,
                },
            },
        };

        const rebuilt = rebuildClientDiceMultistepInteraction(interaction);

        expect(rebuilt?.data.maxSteps).toBe(2);
        expect(rebuilt?.data.minSteps).toBe(2);
        const first = rebuilt!.data.localReducer(
            rebuilt!.data.initialResult,
            { action: 'select', dieId: 4, dieValue: 6 },
        );
        expect(rebuilt!.data.getCompletedSteps?.(first)).toBe(1);
        const second = rebuilt!.data.localReducer(
            first,
            { action: 'select', dieId: 1, dieValue: 1 },
        );
        expect(rebuilt!.data.getCompletedSteps?.(second)).toBe(2);
        expect(rebuilt!.data.toCommands(second)).toHaveLength(2);
        expect(rebuilt!.data.toCommands(second)).toEqual(expect.arrayContaining([
            { type: 'MODIFY_DIE', payload: { dieId: 4, newValue: 6 } },
            { type: 'MODIFY_DIE', payload: { dieId: 1, newValue: 6 } },
        ]));
    });

    it('any / adjust 模式仍保持手动确认，避免玩家加减时自动提交', () => {
        const interaction: InteractionDescriptor = {
            id: 'manual-adjust',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                title: 'interaction.selectDieToModify',
                minSteps: 1,
                initialResult: { modifications: {}, modCount: 0, totalAdjustment: 0 },
                meta: {
                    dtType: 'modifyDie',
                    dieModifyConfig: { mode: 'adjust', adjustRange: { min: -1, max: 1 } },
                    selectCount: 1,
                    diceOwnerId: '0',
                    targetOpponentDice: false,
                },
            },
        };

        expect(rebuildClientDiceMultistepInteraction(interaction)?.data.maxSteps).toBeUndefined();
    });

    it('奥丁II组重掷投影绑定真实结算owner、候选骰和同一批次合同', () => {
        const interaction = createClientBonusDiceGroupRerollInteraction(
            bonusDiceInteraction,
            groupRerollSettlement,
            true,
        )!;
        const data = interaction.data;

        expect(typeof data.localReducer).toBe('function');
        expect(typeof data.toCommands).toBe('function');
        expect(data.initialResult).toEqual({ selectedDiceIds: [] });
        expect(interaction.id).toBe('dt-bonus-dice-thor-odin-ii-22:group-reroll');
        expect(interaction.playerId).toBe('0');
        expect(data.meta).toMatchObject({
            dtType: 'selectDie',
            selectionMode: 'bonusGroupReroll',
            selectCount: 2,
            diceOwnerId: '0',
            targetOpponentDice: false,
            allowRepeatedDieSelection: false,
        });
        expect(data.allowedDieIds).toEqual([1, 3]);
        expect(data.minSteps).toBe(0);
        expect(data.maxSteps).toBeUndefined();
        expect(data.confirmationMode).toBe('submitBatch');
        expect(data.shouldResolveOnConfirm?.({ selectedDiceIds: [] })).toBe(false);
        expect(data.shouldResolveOnConfirm?.({ selectedDiceIds: [1] })).toBe(false);
        expect(data.localReducer({ selectedDiceIds: [] }, { action: 'toggle', dieId: 1 })).toEqual({ selectedDiceIds: [1] });
        expect(data.validateStep?.({ selectedDiceIds: [] }, { action: 'toggle', dieId: 0 })).toBe(false);
        expect(data.toCommands({ selectedDiceIds: [] })).toEqual([]);
        expect(data.toCommands({ selectedDiceIds: [1, 3] })).toEqual([
            { type: 'REROLL_BONUS_DIE', payload: { dieIndex: 1, dieIndices: [1, 3] } },
        ]);
        expect(data.toCommands({ selectedDiceIds: [1, 0] })).toEqual([]);
    });

    it('不会为普通确认、错位owner或不能重掷的结算创建组选择器', () => {
        expect(createClientBonusDiceGroupRerollInteraction(undefined, groupRerollSettlement, true)).toBeUndefined();
        expect(createClientBonusDiceGroupRerollInteraction(
            { ...bonusDiceInteraction, playerId: '1' },
            groupRerollSettlement,
            true,
        )).toBeUndefined();
        expect(createClientBonusDiceGroupRerollInteraction(
            bonusDiceInteraction,
            groupRerollSettlement,
            false,
        )).toBeUndefined();
    });
});
