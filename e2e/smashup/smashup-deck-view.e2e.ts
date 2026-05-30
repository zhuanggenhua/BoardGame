import type { Page } from '@playwright/test';
import { test, expect } from '../framework';

async function warmSmashUpTestRoute(page: Page) {
    await page.goto('/play/smashup', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(
        () => !!(window as Window & { __BG_TEST_HARNESS__?: unknown }).__BG_TEST_HARNESS__,
        { timeout: 60000 },
    );
    // SmashUp 冷启动时模块图和 game namespace 首次加载较慢，先完成一轮预热再走正式状态注入链路。
    await page.waitForTimeout(12000);
}

async function openDeckViewScene(
    page: Page,
    game: {
        openTestGame: (gameId: string, query?: Record<string, unknown>, timeout?: number) => Promise<void>;
        setupScene: (config: unknown) => Promise<void>;
    },
) {
    await warmSmashUpTestRoute(page);
    await game.openTestGame('smashup', {}, 60000);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['aliens', 'pirates'],
            hand: [],
            deck: [
                { uid: 'deck-pirate-a', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                { uid: 'deck-alien-a', defId: 'alien_scout', type: 'minion', owner: '0' },
                { uid: 'deck-alien-b', defId: 'alien_invader', type: 'minion', owner: '0' },
                { uid: 'deck-pirate-b', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                { uid: 'deck-alien-c', defId: 'alien_scout', type: 'minion', owner: '0' },
            ],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['ninjas', 'dinosaurs'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        currentPlayer: '0',
        phase: 'playCards',
    });

    await expect(page.getByTestId('su-deck-stack')).toBeVisible({ timeout: 10000 });
}

test.describe('SmashUp 牌库查看', () => {
    test('点击牌库后应按固定顺序展示剩余卡牌并显示聚合数量', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openDeckViewScene(page, game);

        await page.getByTestId('su-deck-stack').click();

        const deckPanel = page.locator('[data-card-view-panel]');
        await expect(deckPanel).toBeVisible({ timeout: 5000 });
        await expect(deckPanel.getByText('牌库 (5)')).toBeVisible({ timeout: 5000 });

        const orderedDefIds = await deckPanel.locator('[data-card-def-id]').evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('data-card-def-id')),
        );

        expect(orderedDefIds).toEqual([
            'alien_invader',
            'alien_scout',
            'pirate_first_mate',
        ]);

        await expect(deckPanel.locator('[data-card-uid="deck-alien_scout"] [data-card-count]')).toHaveText('×2');
        await expect(deckPanel.locator('[data-card-uid="deck-pirate_first_mate"] [data-card-count]')).toHaveText('×2');
        await expect(deckPanel.locator('[data-card-uid="deck-alien_invader"] [data-card-count]')).toHaveCount(0);

        await game.screenshot('smashup-deck-view-grouped', testInfo);
    });
});
