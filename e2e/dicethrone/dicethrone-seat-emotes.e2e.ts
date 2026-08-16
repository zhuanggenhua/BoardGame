import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    cleanupDTMatch,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

type __ThreeAxeGameMarker = {
    openTestGame: (gameId: string) => Promise<void>;
    setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
    await game.openTestGame('dicethrone');
    await game.setupScene({ gameId: 'dicethrone' });
};
void __ensureThreeAxesMarker;

const EMOTE_ID = 'dicethrone.moon-elf.speechless-facepalm';

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
        throw new Error(`无法读取 player ${playerId} 的座位锚点或表情位置`);
    }

    const anchorCenterX = anchorBox.x + anchorBox.width / 2;
    const emoteCenterX = emoteBox.x + emoteBox.width / 2;
    expect(Math.abs(anchorCenterX - emoteCenterX)).toBeLessThan(160);
    const gapToAnchorTop = Math.abs(emoteBox.y + emoteBox.height - anchorBox.y);
    const gapToAnchorBottom = Math.abs(emoteBox.y - (anchorBox.y + anchorBox.height));
    expect(Math.min(gapToAnchorTop, gapToAnchorBottom)).toBeLessThan(48);

    const viewport = page.viewportSize();
    if (!viewport) {
        throw new Error(`无法读取 player ${playerId} 的视口尺寸，不能证明表情完整可见`);
    }
    expect(emoteBox.x).toBeGreaterThanOrEqual(0);
    expect(emoteBox.y).toBeGreaterThanOrEqual(0);
    expect(emoteBox.x + emoteBox.width).toBeLessThanOrEqual(viewport.width);
    expect(emoteBox.y + emoteBox.height).toBeLessThanOrEqual(viewport.height);
};

test.describe('DiceThrone 座位表情', () => {
    test.setTimeout(120_000);

    test('客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情', async ({ browser, baseURL }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
        const setup = await setupOnlineMatch(browser, baseURL, {
            skipImageGate: true,
            blockLobbySocket: false,
        });
        if (!setup) {
            test.skip(true, 'DiceThrone online match setup failed.');
            return;
        }

        const { hostPage, guestPage } = setup;

        try {
            await hostPage.setViewportSize({ width: 1280, height: 800 });
            await guestPage.setViewportSize({ width: 1280, height: 800 });

            await selectCharacter(hostPage, 'barbarian');
            await selectCharacter(guestPage, 'moon_elf');
            await readyAndStartGame(hostPage, guestPage);
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);

            await guestPage.locator('[data-fab-id="chat"]').click();
            await expect(guestPage.getByTestId('hud-chat-emote-toggle')).toBeVisible({ timeout: 10_000 });
            await expect(guestPage.locator('[data-fab-id="seat-emotes"]')).toHaveCount(0);
            await guestPage.getByTestId('hud-chat-emote-toggle').click();
            await expect(guestPage.getByTestId('hud-emote-picker')).toBeVisible({ timeout: 5_000 });
            await expect(guestPage.getByTestId(`hud-emote-option-${EMOTE_ID}`)).toBeVisible({ timeout: 5_000 });
            const pickerScreenshotPath = getEvidenceScreenshotPath(testInfo, 'guest-chat-emote-picker-open');
            mkdirSync(dirname(pickerScreenshotPath), { recursive: true });
            await guestPage.screenshot({
                path: pickerScreenshotPath,
                fullPage: false,
            });
            await guestPage.getByTestId(`hud-emote-option-${EMOTE_ID}`).click();

            await expect(guestPage.getByTestId(`hud-chat-local-emote-${EMOTE_ID}`)).toBeVisible({ timeout: 5_000 });
            await expect(guestPage.getByTestId('seat-emote-1')).toHaveCount(0);
            await expectSeatEmoteNearAnchor(hostPage, '1');
            await guestPage.waitForTimeout(350);
            await hostPage.waitForTimeout(350);

            const hostScreenshotPath = getEvidenceScreenshotPath(testInfo, 'host-sees-player-1-seat-emote');
            const guestScreenshotPath = getEvidenceScreenshotPath(testInfo, 'guest-chat-local-emote-no-seat-popup');
            mkdirSync(dirname(hostScreenshotPath), { recursive: true });
            await hostPage.screenshot({
                path: hostScreenshotPath,
                fullPage: false,
            });
            await guestPage.screenshot({
                path: guestScreenshotPath,
                fullPage: false,
            });
        } finally {
            await cleanupDTMatch(setup);
        }
    });
});
