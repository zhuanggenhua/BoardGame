import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect } from '../framework';
import { expectRightTrayBonusDiceConfirmation, getRightTrayDiceTray } from './bonus-dice-flow';

test.describe('DiceThrone - 雷霆万钧', () => {
    test('重掷奖励骰会消耗太极并更新结算状态', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 0, HP: 50 },
                tokens: { taiji: 2 },
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
                    id: 'thunder-strike-reroll',
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
                rerollCount: settlement?.rerollCount ?? null,
                rerollCostTokenId: settlement?.rerollCostTokenId ?? null,
                rerollCostAmount: settlement?.rerollCostAmount ?? null,
                taiji: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
            };
        }, { timeout: 5000 }).toMatchObject({
            diceCount: 3,
            rerollCount: 0,
            rerollCostTokenId: 'taiji',
            rerollCostAmount: 2,
            taiji: 2,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState());

        const evidenceDir = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            'dicethrone',
            'bonus-reroll-targeted-animation',
        );
        mkdirSync(evidenceDir, { recursive: true });

        const diceTray = getRightTrayDiceTray(page);
        const bonusDice = diceTray.getByTestId('dice-2d');
        const bonusButtons = diceTray.locator('[data-testid^="die-button-"]');
        await expect(bonusDice).toHaveCount(3, { timeout: 5000 });
        await expect(bonusButtons).toHaveCount(3, { timeout: 5000 });
        await diceTray.screenshot({ path: join(evidenceDir, '01-before-reroll.png') });
        await expect.poll(async () => bonusDice.evaluateAll((nodes) => nodes.map((node) => (
            (node as HTMLElement).dataset.rollAnimation === 'rolling'
        ))), { timeout: 2000 }).toEqual([false, false, false]);

        await bonusButtons.first().click();
        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const eventTypes = (state?.sys?.eventStream?.entries ?? [])
                .slice(-6)
                .map((entry: { event?: { type?: string } }) => entry.event?.type);
            return {
                rerollCount: settlement?.rerollCount ?? null,
                lastRerolledDieIndex: settlement?.lastRerolledDieIndex ?? null,
                rerollAnimationKey: settlement?.rerollAnimationKey ?? null,
                taiji: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
                eventTypes,
            };
        }, { timeout: 5000 }).toMatchObject({
            rerollCount: 1,
            lastRerolledDieIndex: 0,
            rerollAnimationKey: 1,
            taiji: 0,
        });
        await expect.poll(async () => bonusButtons.evaluateAll((nodes) => nodes.map((node) =>
            (node as HTMLElement).dataset.clickable ?? ''
        )), { timeout: 2000 }).toEqual(['false', 'false', 'false']);
        await diceTray.screenshot({ path: join(evidenceDir, '02-after-first-die-reroll-result.png') });

        const finalState = await game.getState();
        const finalSettlement = finalState?.core?.pendingBonusDiceSettlement;
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-6)
            .map((entry: { event?: { type?: string } }) => entry.event?.type);

        expect(finalSettlement?.rerollCount ?? null).toBe(1);
        expect(finalSettlement?.lastRerolledDieIndex ?? null).toBe(0);
        expect(finalSettlement?.rerollAnimationKey ?? null).toBe(1);
        expect(finalState?.core?.players?.['0']?.tokens?.taiji ?? 0).toBe(0);
        expect(finalEventTypes).toContain('BONUS_DIE_REROLLED');
    });
});
