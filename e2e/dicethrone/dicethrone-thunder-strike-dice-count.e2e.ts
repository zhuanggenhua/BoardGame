import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { expectRightTrayBonusDiceConfirmation } from './bonus-dice-flow';

async function setupThunderStrikeSettlement(game: GameTestContext): Promise<void> {
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
                dice: [
                    { index: 0, value: 2, face: 'palm' },
                    { index: 1, value: 4, face: 'taiji' },
                    { index: 2, value: 6, face: 'lotus' },
                ],
                sourceAbilityId: 'thunder-strike',
                sourcePlayerId: '0',
                canReroll: true,
                rerollCostTokenId: 'taiji',
                rerollCostAmount: 2,
            },
        },
    });
}

test.describe('雷霆万钧骰子数量验证', () => {
    test('应显示 3 个奖励骰和太极重掷信息', async ({ page, game }) => {
        await setupThunderStrikeSettlement(game);

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                diceCount: settlement?.dice?.length ?? 0,
                rerollCostTokenId: settlement?.rerollCostTokenId ?? null,
                rerollCostAmount: settlement?.rerollCostAmount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            diceCount: 3,
            rerollCostTokenId: 'taiji',
            rerollCostAmount: 2,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState(), { sourceAbilityId: 'thunder-strike' });

        const state = await game.getState();
        const settlement = state?.core?.pendingBonusDiceSettlement;

        expect(settlement?.dice?.length ?? 0).toBe(3);
        expect(settlement?.rerollCostTokenId ?? null).toBe('taiji');
        expect(settlement?.rerollCostAmount ?? null).toBe(2);
        expect(state?.core?.players?.['0']?.tokens?.taiji ?? 0).toBe(3);
    });
});
