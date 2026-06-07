import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    cleanupTwoPlayerMatch,
    completeFactionSelection,
    setupTwoPlayerMatch,
    waitForHandArea,
} from './smashup-helpers';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

type __ThreeAxeGameMarker = {
    openTestGame: (gameId: string) => Promise<void>;
    setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
    await game.openTestGame('smashup');
    await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

const EMOTE_ID = 'dicethrone.barbarian.thumbs-up-v1';

const expectSeatEmoteNearAnchor = async (page: Page, playerId: string) => {
    const anchor = page.locator(`[data-player-seat-anchor="${playerId}"]`).first();
    const emote = page.getByTestId(`seat-emote-${playerId}`);

    await expect(anchor).toBeVisible({ timeout: 10_000 });
    await expect(emote).toBeVisible({ timeout: 8_000 });

    const [anchorBox, emoteBox] = await Promise.all([
        anchor.boundingBox(),
        emote.boundingBox(),
    ]);
    if (!anchorBox || !emoteBox) {
        throw new Error(`无法读取 SmashUp player ${playerId} 的座位锚点或表情位置`);
    }

    const anchorCenterX = anchorBox.x + anchorBox.width / 2;
    const emoteCenterX = emoteBox.x + emoteBox.width / 2;
    expect(Math.abs(anchorCenterX - emoteCenterX)).toBeLessThan(160);

    const gapToAnchorTop = Math.abs(emoteBox.y + emoteBox.height - anchorBox.y);
    const gapToAnchorBottom = Math.abs(emoteBox.y - (anchorBox.y + anchorBox.height));
    expect(Math.min(gapToAnchorTop, gapToAnchorBottom)).toBeLessThan(48);

    const viewport = page.viewportSize();
    if (!viewport) {
        throw new Error(`无法读取 SmashUp player ${playerId} 的视口尺寸`);
    }
    expect(emoteBox.x).toBeGreaterThanOrEqual(0);
    expect(emoteBox.y).toBeGreaterThanOrEqual(0);
    expect(emoteBox.x + emoteBox.width).toBeLessThanOrEqual(viewport.width);
    expect(emoteBox.y + emoteBox.height).toBeLessThanOrEqual(viewport.height);
};

test.describe('大杀四方座位表情', () => {
    test.setTimeout(120_000);

    test('接收方视角能在对手座位看到表情弹出', async ({ browser, baseURL }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const setup = await setupTwoPlayerMatch(browser, baseURL, {
            skipImageGate: true,
            blockLobbySocket: false,
        });
        if (!setup) {
            test.skip(true, 'SmashUp online match setup failed.');
            return;
        }

        const { hostPage, guestPage } = setup;

        try {
            await hostPage.setViewportSize({ width: 1280, height: 800 });
            await guestPage.setViewportSize({ width: 1280, height: 800 });

            await completeFactionSelection(hostPage, guestPage);
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);
            await expect(hostPage.locator('[data-player-seat-anchor="1"]').first()).toBeVisible({ timeout: 10_000 });
            await hostPage.waitForTimeout(300);
            await guestPage.waitForTimeout(300);
            await hostPage.waitForTimeout(2_000);
            await guestPage.waitForTimeout(2_000);

            await guestPage.locator('[data-fab-id="chat"]').click();
            await expect(guestPage.getByTestId('hud-chat-emote-toggle')).toBeVisible({ timeout: 10_000 });
            await guestPage.getByTestId('hud-chat-emote-toggle').click();
            await expect(guestPage.getByTestId('hud-emote-picker')).toBeVisible({ timeout: 5_000 });
            await expect(guestPage.getByTestId(`hud-emote-option-${EMOTE_ID}`)).toBeVisible({ timeout: 5_000 });
            await guestPage.getByTestId(`hud-emote-option-${EMOTE_ID}`).click();

            await expect(guestPage.getByTestId('seat-emote-1')).toHaveCount(0);
            await expectSeatEmoteNearAnchor(hostPage, '1');
            await hostPage.waitForTimeout(350);

            const hostScreenshotPath = getEvidenceScreenshotPath(testInfo, 'recipient-sees-opponent-seat-emote');
            mkdirSync(dirname(hostScreenshotPath), { recursive: true });
            await hostPage.screenshot({
                path: hostScreenshotPath,
                fullPage: false,
            });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
