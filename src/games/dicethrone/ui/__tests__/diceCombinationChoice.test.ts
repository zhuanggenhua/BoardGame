import { describe, expect, it } from 'vitest';
import { describeDiceCombinationChoice } from '../diceCombinationChoice';

const pair = (id: string, first: number, firstValue: number, second: number, secondValue: number) => ({
    id,
    customId: 'thor-chain-pair',
    value: firstValue + secondValue,
    dicePreview: {
        characterId: 'thor',
        dice: [
            { index: first, value: firstValue },
            { index: second, value: secondValue },
        ],
    },
});

describe('describeDiceCombinationChoice', () => {
    it('maps every pair in a full combination set to its original choice option', () => {
        const choice = describeDiceCombinationChoice([
            pair('low', 0, 1, 1, 4),
            pair('middle', 0, 1, 2, 6),
            pair('high', 1, 4, 2, 6),
        ], 'thor');

        expect(choice).toEqual({
            characterId: 'thor',
            selectCount: 2,
            allowedDieIds: [0, 1, 2],
            dice: [
                { id: 0, value: 1 },
                { id: 1, value: 4 },
                { id: 2, value: 6 },
            ],
            options: [
                { id: 'low', dieIds: [0, 1] },
                { id: 'middle', dieIds: [0, 2] },
                { id: 'high', dieIds: [1, 2] },
            ],
        });
    });

    it('keeps incomplete or inconsistent choices on their existing choice flow', () => {
        expect(describeDiceCombinationChoice([
            pair('low', 0, 1, 1, 4),
            pair('middle', 0, 1, 2, 6),
        ], 'thor')).toBeUndefined();

        expect(describeDiceCombinationChoice([
            pair('low', 0, 1, 1, 4),
            { ...pair('middle', 0, 1, 2, 6), value: 8 },
            pair('high', 1, 4, 2, 6),
        ], 'thor')).toBeUndefined();
    });
});
