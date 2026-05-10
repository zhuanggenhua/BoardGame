import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

const DISCARD_OVERFLOW_HAND = [
    'alien_invader',
    'alien_invader',
    'alien_collector',
    'pirate_first_mate',
    'alien_invader',
    'pirate_first_mate',
    'alien_invader',
    'alien_collector',
    'pirate_first_mate',
    'alien_invader',
    'alien_collector',
    'pirate_buccaneer',
    'alien_invader',
    'pirate_first_mate',
];

const OVERFLOW_SCENE = {
    gameId: 'smashup',
    currentPlayer: '0',
    bases: [
        { defId: 'base_the_jungle' },
        { defId: 'base_dread_lookout' },
        { defId: 'base_tsars_palace' },
    ],
    player0: {
        factions: ['aliens', 'pirates'],
        hand: DISCARD_OVERFLOW_HAND,
        deck: ['alien_invader'],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 3,
    },
    player1: {
        factions: ['dinosaurs', 'ninjas'],
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 2,
    },
} as const;

async function readHandLayoutMetrics(page: import('@playwright/test').Page) {
    const handArea = page.getByTestId('su-hand-area');
    const handContainer = handArea.locator('[data-tutorial-id="su-hand-area"]');
    await expect(handArea.locator('[data-card-uid]')).toHaveCount(DISCARD_OVERFLOW_HAND.length);

    return handContainer.evaluate((el) => {
        const cardEls = Array.from(el.querySelectorAll<HTMLElement>('[data-card-uid]'));
        const margins = cardEls.slice(1).map((card) => Number.parseFloat(card.style.marginLeft));
        return {
            className: el.className,
            margins,
        };
    });
}

test.describe('SmashUp 弃牌阶段手牌溢出布局', () => {
    test.beforeEach(async ({ page: _page }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
    });

    test('弃牌阶段多手牌布局与普通手牌状态一致', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene({
            ...OVERFLOW_SCENE,
            phase: 'draw',
        });

        const handArea = page.getByTestId('su-hand-area');
        const cards = handArea.locator('[data-card-uid]');
        await expect(handArea).toBeVisible({ timeout: 10000 });
        await expect(cards).toHaveCount(DISCARD_OVERFLOW_HAND.length);
        await expect(page.getByText(/丢弃|Discard|Too Many Cards|手牌过多/i)).toBeVisible({ timeout: 10000 });

        const discardMetrics = await readHandLayoutMetrics(page);

        const discardShot = getEvidenceScreenshotPath(testInfo, 'discard-hand-overflow-draw-phase', {
            filename: 'discard-hand-overflow-draw-phase.png',
        });
        await page.screenshot({ path: discardShot, fullPage: true });

        await game.setupScene({
            ...OVERFLOW_SCENE,
            phase: 'playCards',
        });
        await expect(page.getByText(/丢弃|Discard|Too Many Cards|手牌过多/i)).toBeHidden({ timeout: 10000 });

        const normalMetrics = await readHandLayoutMetrics(page);

        expect(discardMetrics.className).toBe(normalMetrics.className);
        expect(discardMetrics.margins).toEqual(normalMetrics.margins);
        expect(discardMetrics.margins.some((margin) => margin < 0)).toBe(true);

        const normalShot = getEvidenceScreenshotPath(testInfo, 'discard-hand-overflow-normal-phase', {
            filename: 'discard-hand-overflow-normal-phase.png',
        });
        await page.screenshot({ path: normalShot, fullPage: true });

        console.log('SmashUp 弃牌阶段手牌布局一致性截图:', { discardShot, normalShot });
    });
});
