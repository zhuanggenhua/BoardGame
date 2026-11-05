import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath, withJpegEvidenceScreenshotOptions } from '../framework/evidenceScreenshots';
import {
    cleanupDTMatch,
    readyAndStartGame,
    selectCharacter,
    setupDTOnlineMatchWithPlayers,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';

const MOBILE_CONTEXT = {
    viewport: { width: 936, height: 432 },
    screen: { width: 936, height: 432 },
    deviceScaleFactor: 2.5,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

test('DiceThrone 手机横屏手牌拖拽应跟随手指位移', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
        numPlayers: 2,
        contextOptions: MOBILE_CONTEXT,
        skipImageGate: true,
        characterSelectionTimeout: 90000,
    });
    expect(setup, 'DiceThrone 手机横屏在线双人房创建失败').not.toBeNull();
    if (!setup || !setup.guestPage) throw new Error('DiceThrone 手机横屏在线双人房创建失败');

    try {
        await selectCharacter(setup.hostPage, 'monk');
        await selectCharacter(setup.guestPage, 'barbarian');
        await readyAndStartGame(setup.hostPage, setup.guestPage);
        await waitForGameBoard(setup.hostPage, 90000);
        await waitForDiceThroneHarness(setup.hostPage, 30000);

        const page = setup.hostPage;
        const handCard = page.locator('[data-testid="hand-area"] [data-can-drag="true"]').first();
        await expect(handCard).toBeVisible({ timeout: 15000 });
        const before = await handCard.boundingBox();
        if (!before) throw new Error('无法读取拖拽前手牌位置');

        const start = {
            x: before.x + before.width / 2,
            y: before.y + before.height * 0.78,
        };
        const delta = { x: 240, y: -40 };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 16 });
        await page.waitForTimeout(200);

        const during = await handCard.boundingBox();
        if (!during) throw new Error('无法读取拖拽中手牌位置');
        const metrics = await page.evaluate(() => {
            const rootStyle = window.getComputedStyle(document.documentElement);
            return {
                scale: Number.parseFloat(rootStyle.getPropertyValue('--mobile-board-shell-scale')),
                shellTransform: window.getComputedStyle(document.querySelector('.mobile-board-shell') as HTMLElement).transform,
            };
        });
        const screenshotPath = getEvidenceScreenshotPath(testInfo, '手机横屏手牌拖拽跟手-红点为手指位置', {
            requireChineseName: true,
        });
        await page.evaluate((point) => {
            const marker = document.createElement('div');
            marker.setAttribute('data-testid', 'dicethrone-drag-pointer-marker');
            Object.assign(marker.style, {
                position: 'fixed',
                left: `${point.x}px`,
                top: `${point.y}px`,
                width: '18px',
                height: '18px',
                borderRadius: '9999px',
                background: '#ef4444',
                border: '3px solid #ffffff',
                boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.28)',
                transform: 'translate(-50%, -50%)',
                zIndex: '2147483647',
                pointerEvents: 'none',
            });
            document.body.appendChild(marker);
        }, { x: start.x + delta.x, y: start.y + delta.y });
        await mkdir(dirname(screenshotPath), { recursive: true });
        await page.screenshot(withJpegEvidenceScreenshotOptions({
            path: screenshotPath,
            fullPage: false,
            timeout: 20000,
        }));
        console.log(`DICETHRONE_HAND_DRAG_FOLLOW_SCREENSHOT ${screenshotPath}`);
        await page.mouse.up();

        const cardDelta = {
            x: (during.x + during.width / 2) - (before.x + before.width / 2),
            y: (during.y + during.height / 2) - (before.y + before.height / 2),
        };
        const result = {
            scale: metrics.scale,
            shellTransform: metrics.shellTransform,
            pointerDelta: delta,
            cardDelta,
            ratioX: cardDelta.x / delta.x,
            ratioY: cardDelta.y / delta.y,
        };
        console.log(`DICETHRONE_HAND_DRAG_FOLLOW_DIAG ${JSON.stringify(result)}`);
        expect(metrics.scale, '测试必须命中手机 board-shell 缩放态，才能覆盖“不跟手”的真实入口').toBeLessThan(1);
        expect(Math.abs(cardDelta.x - delta.x), '手牌横向可见位移应贴合手指横向位移').toBeLessThanOrEqual(2);
        expect(Math.abs(cardDelta.y - delta.y), '手牌纵向可见位移应贴合手指纵向位移').toBeLessThanOrEqual(2);
    } finally {
        await cleanupDTMatch(setup);
    }
});
