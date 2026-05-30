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
    options?: {
        deckQueryEnabled?: boolean;
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
            deck: [
                { uid: 'opp-deck-ninja-a', defId: 'ninja_shinobi', type: 'minion', owner: '1' },
                { uid: 'opp-deck-dino-a', defId: 'dinosaur_king_rex', type: 'minion', owner: '1' },
                { uid: 'opp-deck-ninja-b', defId: 'ninja_shinobi', type: 'minion', owner: '1' },
            ],
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
        extra: {
            core: {
                deckQueryEnabled: options?.deckQueryEnabled ?? false,
            },
        },
    });

    await expect(page.getByTestId('su-deck-stack')).toBeVisible({ timeout: 10000 });
}

test.describe('SmashUp 牌库查看', () => {
    test('余牌查询关闭时仍显示数量，但不能点开牌库详情', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openDeckViewScene(page, game, { deckQueryEnabled: false });

        await expect(page.getByTestId('su-deck-count-badge')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('su-deck-count-badge')).toHaveText('5');

        await page.getByTestId('su-deck-stack').click();

        const deckPanel = page.locator('[data-card-view-panel]');
        await expect(deckPanel).toHaveCount(0);

        await game.screenshot('smashup-deck-view-disabled', testInfo);
    });

    test('余牌查询开启后应按固定顺序展示剩余卡牌并显示聚合数量', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openDeckViewScene(page, game, { deckQueryEnabled: true });

        await expect(page.getByTestId('su-deck-count-badge')).toBeVisible({ timeout: 5000 });
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

    test('余牌查询开启后切到对手视角也能查看对方牌库', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await openDeckViewScene(page, game, { deckQueryEnabled: true });

        await page.getByTestId('su-score-vp-1').click();
        await expect(page.getByText('对手视角')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('su-deck-count-badge')).toHaveText('3');

        await page.getByTestId('su-deck-stack').click();

        const deckPanel = page.locator('[data-card-view-panel]');
        await expect(deckPanel).toBeVisible({ timeout: 5000 });
        await expect(deckPanel.getByText('牌库 (3)')).toBeVisible({ timeout: 5000 });

        const orderedDefIds = await deckPanel.locator('[data-card-def-id]').evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('data-card-def-id')),
        );

        expect(orderedDefIds).toEqual([
            'ninja_shinobi',
            'dinosaur_king_rex',
        ]);

        await expect(deckPanel.locator('[data-card-uid="deck-ninja_shinobi"] [data-card-count]')).toHaveText('×2');
        await expect(deckPanel.locator('[data-card-uid="deck-dinosaur_king_rex"] [data-card-count]')).toHaveCount(0);

        await game.screenshot('smashup-deck-view-opponent-grouped', testInfo);
    });
});
