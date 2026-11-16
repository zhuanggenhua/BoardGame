import { test, expect } from '../framework';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('圣骑士旧卡放大保持原有尺寸', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    const output = resolve('temp/doctor-legacy-magnify-20261111');
    mkdirSync(output, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await game.openTestGame('dicethrone');
    await game.setupScene({ gameId: 'dicethrone',
        player0: { hand: ['card-righteous-combat-2'], discard: [], resources: { cp: 3, hp: 50 } },
        player1: { hand: [], discard: [], resources: { cp: 3, hp: 50 } },
        currentPlayer: '0', phase: 'main1',
        extra: { selectedCharacters: { '0': 'paladin', '1': 'monk' }, hostStarted: true },
    });
    await game.waitForPhase('main1', 15000);
    const card = page.getByTestId('hand-area').locator('[data-card-id="card-righteous-combat-2"]').first();
    await expect(card).toBeVisible();
    await card.click();
    const overlay = page.getByTestId('board-magnify-overlay');
    await expect(overlay).toBeVisible();
    const close = page.getByTestId('board-magnify-overlay-close');
    await expect(close).toHaveCSS('opacity', '0');
    await page.screenshot({path:testInfo.outputPath('卡牌放大初始.png')});
    const cardBox = await overlay.locator('[data-card-atlas-frame="true"]').boundingBox();
    expect(cardBox).not.toBeNull();
    await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
    await expect(close).toHaveCSS('opacity', '1');
    const closeBackgroundAlpha = await close.evaluate(element => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d')!;
        context.fillStyle = getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data[3];
    });
    expect(closeBackgroundAlpha).toBeGreaterThan(0);
    expect(closeBackgroundAlpha).toBeLessThan(255);
    await page.screenshot({path:testInfo.outputPath('卡牌放大悬浮.png')});
    const frame = overlay.locator('[data-card-atlas-frame="true"]');
    await expect(frame).toBeVisible();
    for (const { width, height, expectedWidth } of [
        { width: 1440, height: 900, expectedWidth: 396 },
        { width: 812, height: 375, expectedWidth: 205.875 },
    ]) {
        await page.setViewportSize({ width, height });
        await expect.poll(async () => (await frame.boundingBox())?.width).toBeCloseTo(expectedWidth, 0);
        const bounds = await frame.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.height).toBeCloseTo(expectedWidth / 0.61, 0);
        await page.screenshot({ path: resolve(output, `旧卡放大-${width}.png`) });
    }
});

test.describe('触控放大', () => {
    test.use({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true });
    test('触控设备始终可以看到并关闭卡牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);
        await game.openTestGame('dicethrone');
        await game.setupScene({ gameId: 'dicethrone',
            player0: { hand: ['card-righteous-combat-2'], discard: [], resources: { cp: 3, hp: 50 } },
            player1: { hand: [], discard: [], resources: { cp: 3, hp: 50 } },
            currentPlayer: '0', phase: 'main1',
            extra: { selectedCharacters: { '0': 'paladin', '1': 'monk' }, hostStarted: true },
        });
        await game.waitForPhase('main1', 15000);
        await page.getByTestId('hand-area').locator('[data-card-id="card-righteous-combat-2"]').first().tap();
        const close = page.getByTestId('board-magnify-overlay-close');
        await expect(close).toBeVisible();
        await expect(close).toHaveCSS('opacity', '1');
        await page.screenshot({path:testInfo.outputPath('触控卡牌放大.png')});
        await close.tap();
        await expect(page.getByTestId('board-magnify-overlay')).toHaveCount(0);
    });
});
