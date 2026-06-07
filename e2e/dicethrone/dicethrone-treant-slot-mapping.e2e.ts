import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../framework';

const evidenceRoot = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    'dicethrone',
    'dicethrone-treant-slot-mapping.e2e',
);

const screenshot = async (page: Page, testName: string, fileName: string) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, fileName);
    await page.screenshot({ path, fullPage: false });
    return path;
};

test.describe('DiceThrone Treant 玩家板槽位映射', () => {
    test('Treant 被动槽不应混入普通技能高亮，扎根应落在真实防御槽', async ({ page, game }) => {
        const testName = 'Treant 被动槽不应混入普通技能高亮，扎根应落在真实防御槽';

        await game.openTestGame('dicethrone');
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'treant', '1': 'ninja' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'treant');

        const skySlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="sky"]').first();
        const comboSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]').first();
        const calmSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="calm"]').first();
        const meditateSlot = page.locator('[data-testid="player-board-surface"] [data-ability-slot="meditate"]').first();

        await expect(skySlot).toHaveAttribute('data-passive-ability', 'true');
        await expect(comboSlot).toHaveAttribute('data-resolved-ability-id', 'vengeful-vines');
        await expect(comboSlot).toHaveAttribute('data-base-ability-id', 'vengeful-vines');
        await expect(calmSlot).toHaveAttribute('data-base-ability-id', '');
        await expect(calmSlot).toHaveAttribute('data-resolved-ability-id', '');
        await expect(meditateSlot).toHaveAttribute('data-base-ability-id', 'rooted');

        await screenshot(page, testName, '01-treant-board-slot-contract.png');
    });
});
