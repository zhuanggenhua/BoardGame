import { test, expect } from '../framework';
import { expectRightTrayBonusDiceConfirmation, getRightTrayDiceTray } from './bonus-dice-flow';

test.describe('DiceThrone Volley 5 Dice Display', () => {
    test('displayOnly 奖励骰结算会展示 5 颗骰子面板', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 3, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main2',
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
                hostStarted: true,
                pendingBonusDiceSettlement: {
                    id: 'volley-display-only',
                    attackerId: '0',
                    targetId: '1',
                    dice: [
                        { index: 0, value: 1, face: 'bow' },
                        { index: 1, value: 2, face: 'moon' },
                        { index: 2, value: 3, face: 'arrow' },
                        { index: 3, value: 4, face: 'bow' },
                        { index: 4, value: 5, face: 'moon' },
                    ],
                    rerollCostTokenId: '',
                    rerollCostAmount: 0,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    displayOnly: true,
                    showTotal: false,
                },
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                diceCount: settlement?.dice?.length ?? 0,
                displayOnly: settlement?.displayOnly ?? false,
                rerollCount: settlement?.rerollCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            diceCount: 5,
            displayOnly: true,
            rerollCount: 0,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState());
        const diceTray = getRightTrayDiceTray(page);

        const bonusDice = diceTray.getByTestId('dice-2d');
        await expect(bonusDice).toHaveCount(5, { timeout: 5000 });
        await expect(
            page.getByRole('button', { name: /Confirm Damage|Continue|确认伤害|继续/i }),
        ).toHaveCount(0);

        const state = await game.getState();
        const settlement = state?.core?.pendingBonusDiceSettlement;
        const finalState = {
            diceCount: settlement?.dice?.length ?? 0,
            displayOnly: settlement?.displayOnly ?? false,
            rerollCount: settlement?.rerollCount ?? null,
        };

        expect(finalState.diceCount).toBe(5);
        expect(finalState.displayOnly).toBe(true);
        expect(finalState.rerollCount).toBe(0);
    });
});
