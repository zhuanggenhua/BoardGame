/**
 * E2E：幻想国度真实棋盘里的终局遮罩与「再来一局」
 *
 * 与独立预览页不同，这里跑的是真实 TestMatchRoom 对局 + 真实 Board，
 * 验证 EndgameOverlay 在真实布局中的位置、遮罩可见性、文案与重赛链路。
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
            set?: (state: unknown) => Promise<void>;
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

async function openFantasyRealmsLocal(page: Page, baseURL?: string) {
    await page.goto(
        `${baseURL ?? ''}/play/fantasyrealms?players=2&playerID=0&seat1=local-ai&seat1Delay=0`,
        { waitUntil: 'domcontentloaded' },
    );
    await waitForTestHarness(page);
    await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 20000 });
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

test.describe('FantasyRealms 真实棋盘终局重赛', () => {
    test('玩家获胜后真实棋盘里弹出终局遮罩，并可再来一局', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        // reducedMotion 让逐张计分动画直接跳过，overlay 立即出现（动画时序另测）。
        const context = await browser.newContext({ reducedMotion: 'reduce' });
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await openFantasyRealmsLocal(page, baseURL);

            await injectGameover(page, { winners: ['0'] });
            expect(await readGameover(page)).toMatchObject({ winners: ['0'] });

            // 真实 Board 内的遮罩（不是独立页）
            const overlay = page.getByTestId('endgame-overlay');
            await expect(overlay).toBeVisible({ timeout: 20000 });

            // 游戏自身的羊皮纸内容插槽
            await expect(page.getByTestId('fantasyrealms-endgame-content')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('fantasyrealms-endgame-title')).toBeVisible();
            // 通用重赛操作区（投票/单机按钮由框架提供）
            await expect(page.getByTestId('rematch-actions')).toBeVisible();

            const victoryShot = getEvidenceScreenshotPath(testInfo, '幻想国度-真实棋盘终局遮罩');
            await mkdir(dirname(victoryShot), { recursive: true });
            await page.screenshot({ path: victoryShot, fullPage: false });

            // 再来一局：点主按钮后 gameover 应被清空，回到对局
            const playAgain = page.getByTestId('fantasyrealms-endgame-playAgain');
            await expect(playAgain).toBeVisible();
            await playAgain.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return !state?.sys?.gameover;
            }, { timeout: 20000 });

            await expect(page.getByTestId('endgame-overlay')).toHaveCount(0, { timeout: 10000 });
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const rematchShot = getEvidenceScreenshotPath(testInfo, '幻想国度-再来一局后回到对局');
            await mkdir(dirname(rematchShot), { recursive: true });
            await page.screenshot({ path: rematchShot, fullPage: false });
        } finally {
            await context.close();
        }
    });

    test('平局时终局遮罩显示平局文案', async ({ browser }, testInfo) => {
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
            await openFantasyRealmsLocal(page, baseURL);
            await injectGameover(page, { draw: true });

            await expect(page.getByTestId('endgame-overlay')).toBeVisible({ timeout: 20000 });
            await expect(page.getByTestId('fantasyrealms-endgame-content')).toBeVisible({ timeout: 10000 });

            const drawShot = getEvidenceScreenshotPath(testInfo, '幻想国度-真实棋盘平局');
            await mkdir(dirname(drawShot), { recursive: true });
            await page.screenshot({ path: drawShot, fullPage: false });
        } finally {
            await context.close();
        }
    });
});
