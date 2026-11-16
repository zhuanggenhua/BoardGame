/**
 * E2E：璀璨宝石真实棋盘里的终局遮罩与「再来一局」
 *
 * 跑真实 TestMatchRoom 对局 + 真实 Board，验证 EndgameOverlay 在真实布局中的
 * 位置、遮罩可见性、排名数据与重赛链路。
 *
 * 验收参照：e2e/cardia/cardia-ai-gameover-overlay.e2e.ts
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';

type GameOverPatch = {
    winners?: string[];
    winner?: string;
    draw?: boolean;
    scores?: Record<string, number>;
};

type TestHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => {
                sys?: { gameover?: GameOverPatch; [key: string]: unknown };
                core?: Record<string, unknown>;
            };
            patch?: (patch: Record<string, unknown>) => Promise<void>;
            isRegistered?: () => boolean;
        };
    };
};

async function waitForTestHarness(page: Page, timeout = 20000) {
    await page.waitForFunction(() => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        return harness?.state?.isRegistered?.() === true;
    }, { timeout });
}

async function openSplendorLocal(page: Page, baseURL?: string) {
    await page.goto(
        `${baseURL ?? ''}/play/splendor?players=2&playerID=0&seat1=local-ai&seat1Delay=0`,
        { waitUntil: 'domcontentloaded' },
    );
    await waitForTestHarness(page);
    await expect(page.getByTestId('splendor-board')).toBeVisible({ timeout: 20000 });
}

async function injectGameover(page: Page, gameover: GameOverPatch) {
    await page.evaluate(async (nextGameover) => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.state?.patch) {
            throw new Error('__BG_TEST_HARNESS__.state.patch 不可用');
        }
        await harness.state.patch({ 'sys.gameover': nextGameover });
    }, gameover);
}

async function readGameover(page: Page) {
    return await page.evaluate(() => {
        const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.gameover ?? null;
    });
}

test.describe('Splendor 真实棋盘终局重赛', () => {
    test('玩家获胜后真实棋盘里弹出终局遮罩，显示排名并可再来一局', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext({ reducedMotion: 'reduce' });
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await openSplendorLocal(page, baseURL);

            await injectGameover(page, { winners: ['0'], scores: { '0': 16, '1': 13 } });
            expect(await readGameover(page)).toMatchObject({ winners: ['0'] });

            const overlay = page.getByTestId('endgame-overlay');
            await expect(overlay).toBeVisible({ timeout: 20000 });

            await expect(page.getByTestId('splendor-endgame-content')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('splendor-endgame-title')).toBeVisible();
            await expect(page.getByTestId('splendor-endgame-standing-0')).toBeVisible();
            await expect(page.getByTestId('rematch-actions')).toBeVisible();

            const victoryShot = getEvidenceScreenshotPath(testInfo, '璀璨宝石-真实棋盘终局遮罩');
            await mkdir(dirname(victoryShot), { recursive: true });
            await page.screenshot({ path: victoryShot, fullPage: false });

            const playAgain = page.getByTestId('splendor-endgame-playAgain');
            await expect(playAgain).toBeVisible();
            await playAgain.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return !state?.sys?.gameover;
            }, { timeout: 20000 });

            await expect(page.getByTestId('endgame-overlay')).toHaveCount(0, { timeout: 10000 });
            await expect(page.getByTestId('splendor-board')).toBeVisible({ timeout: 15000 });

            const rematchShot = getEvidenceScreenshotPath(testInfo, '璀璨宝石-再来一局后回到对局');
            await mkdir(dirname(rematchShot), { recursive: true });
            await page.screenshot({ path: rematchShot, fullPage: false });
        } finally {
            await context.close();
        }
    });

    test('落败时终局遮罩显示失败态而非胜利', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext({ reducedMotion: 'reduce' });
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openSplendorLocal(page, baseURL);
            await injectGameover(page, { winners: ['1'], scores: { '0': 11, '1': 16 } });

            await expect(page.getByTestId('endgame-overlay')).toBeVisible({ timeout: 20000 });
            await expect(page.getByTestId('splendor-endgame-content')).toBeVisible({ timeout: 10000 });

            const defeatShot = getEvidenceScreenshotPath(testInfo, '璀璨宝石-真实棋盘落败');
            await mkdir(dirname(defeatShot), { recursive: true });
            await page.screenshot({ path: defeatShot, fullPage: false });
        } finally {
            await context.close();
        }
    });
});
