import { describe, expect, it } from 'vitest';
import type { InteractionDescriptor } from '../../../../engine/systems/InteractionSystem';
import { rebuildClientDiceMultistepInteraction } from '../clientDiceMultistepInteraction';

describe('rebuildClientDiceMultistepInteraction', () => {
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
});
