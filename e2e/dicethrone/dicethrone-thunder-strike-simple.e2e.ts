import { test, expect } from '../framework';
import { expectRightTrayBonusDiceConfirmation, getRightTrayDiceTray } from './bonus-dice-flow';

test.describe('DiceThrone - 雷霆万钧（精简）', () => {
    test('奖励骰结算面板应展示 3 颗骰子与太极重掷成本', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 0, HP: 50 },
                tokens: { taiji: 3 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main2',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                pendingBonusDiceSettlement: {
                    id: 'thunder-strike-simple',
                    attackerId: '0',
                    targetId: '1',
                    dice: [
                        { index: 0, value: 2, face: 'palm' },
                        { index: 1, value: 4, face: 'taiji' },
                        { index: 2, value: 6, face: 'lotus' },
                    ],
                    rerollCostTokenId: 'taiji',
                    rerollCostAmount: 2,
                    rerollCount: 0,
                    maxRerollCount: 1,
                    readyToSettle: false,
                },
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                diceCount: settlement?.dice?.length ?? 0,
                rerollCostTokenId: settlement?.rerollCostTokenId ?? null,
                rerollCostAmount: settlement?.rerollCostAmount ?? null,
                tokenCount: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
            };
        }, { timeout: 5000 }).toMatchObject({
            diceCount: 3,
            rerollCostTokenId: 'taiji',
            rerollCostAmount: 2,
            tokenCount: 3,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
        const diceTray = getRightTrayDiceTray(page);
        await expect(diceTray.getByTestId('dice-2d')).toHaveCount(3, { timeout: 5000 });

        const state = await game.getState();
        const settlement = state?.core?.pendingBonusDiceSettlement;
        const finalState = {
            diceCount: settlement?.dice?.length ?? 0,
            rerollCostTokenId: settlement?.rerollCostTokenId ?? null,
            rerollCostAmount: settlement?.rerollCostAmount ?? null,
            tokenCount: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
        };

        expect(finalState.diceCount).toBe(3);
        expect(finalState.rerollCostTokenId).toBe('taiji');
        expect(finalState.rerollCostAmount).toBe(2);
        expect(finalState.tokenCount).toBe(3);
    });
});
