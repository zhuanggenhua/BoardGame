import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    setChineseLocale,
} from '../helpers/common';

const CLOSEOUT_DIR = 'test-results/evidence-screenshots/_shared/qidahen-新游戏收口';
const TUTORIAL_DIR = 'test-results/evidence-screenshots/_shared/qidahen-教程完成';
const TUTORIAL_STEP_01 = `${TUTORIAL_DIR}/01-教程第1步-点下一步开始基础回合.png`;
const TUTORIAL_STEP_02 = `${TUTORIAL_DIR}/02-教程第2步-点击地图上的皮岛.png`;
const TUTORIAL_STEP_03 = `${TUTORIAL_DIR}/03-教程第3步-点击右侧赐印招安.png`;
const TUTORIAL_STEP_04 = `${TUTORIAL_DIR}/04-教程第4步-点击底部手牌支付3张.png`;
const TUTORIAL_STEP_05 = `${TUTORIAL_DIR}/05-教程第5步-点击轮盘免费走1.png`;
const TUTORIAL_STEP_06 = `${TUTORIAL_DIR}/06-教程第6步-点击完成关闭教程.png`;
const ENDGAME_SCREENSHOT = `${CLOSEOUT_DIR}/02-终局遮罩-注入胜利后显示.png`;

type HarnessWindow = Window & {
    __E2E_TEST_MODE__?: boolean;
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => { core: unknown; sys: Record<string, unknown> };
            set?: (state: { core: unknown; sys: Record<string, unknown> }) => Promise<void> | void;
            isRegistered?: () => boolean;
        };
    };
};

const saveScreenshot = async (page: Page, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false, animations: 'disabled' });
};

const MAP_REGION_POINTS = {
    songjin: { x: 0.6522, y: 0.5913 },
} as const;

const clickMapRegion = async (
    page: Page,
    regionId: keyof typeof MAP_REGION_POINTS,
) => {
    const point = MAP_REGION_POINTS[regionId];
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.evaluate((element, targetPoint) => {
        const rect = element.getBoundingClientRect();
        const init: PointerEventInit = {
            clientX: rect.left + rect.width * targetPoint.x,
            clientY: rect.top + rect.height * targetPoint.y,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
        };
        element.dispatchEvent(new PointerEvent('pointermove', init));
        element.dispatchEvent(new PointerEvent('pointerdown', init));
        element.dispatchEvent(new PointerEvent('pointerup', {
            ...init,
            buttons: 0,
        }));
    }, point);
};

test.describe('七大恨新游戏收口', () => {
    test('教程模式会带玩家走完一个最基本的真实回合片段，并在每步留下可指认操作点的截图', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('最基本的七大恨回合片段');
        await saveScreenshot(page, TUTORIAL_STEP_01);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="select-region"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-action-hint"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先点地图上的皮岛');
        await saveScreenshot(page, TUTORIAL_STEP_02);

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-tutorial-step="pick-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点右侧的“赐印招安”');
        await saveScreenshot(page, TUTORIAL_STEP_03);

        await page.getByRole('button', { name: /赐印招安/ }).click();
        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('选满 3 张牌');
        await saveScreenshot(page, TUTORIAL_STEP_04);

        const handCards = page.locator('[data-testid^="qidahen-hand-card-"]');
        await expect(handCards.nth(0)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(1)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(2)).toBeVisible({ timeout: 15000 });
        await handCards.nth(0).click();
        await handCards.nth(1).click();
        await handCards.nth(2).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('轮盘行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘行动本来就是独立可选的一笔');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先点左上轮盘里的“免费走 1”选中');
        await saveScreenshot(page, TUTORIAL_STEP_05);

        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图选区、弃牌行动、轮盘推进');
        await saveScreenshot(page, TUTORIAL_STEP_06);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
        assertNoFatalFrontendErrors([{ label: 'qidahen-tutorial-complete', diagnostics }]);
    });

    test('注入终局状态后会真实显示终局遮罩', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="endgame-overlay"]')).toHaveCount(0);
        await page.waitForFunction(() => (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);

        await page.evaluate(async () => {
            const stateApi = (window as HarnessWindow).__BG_TEST_HARNESS__?.state;
            const snapshot = stateApi?.get?.();
            if (!snapshot || !stateApi?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.sys = {
                ...next.sys,
                phase: 'end',
                gameover: { winner: '0' },
            };
            await stateApi.set(next);
        });

        await expect(page.locator('[data-testid="endgame-overlay"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="endgame-overlay-content"]')).toContainText('胜利');
        await saveScreenshot(page, ENDGAME_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-closeout-endgame-overlay', diagnostics }]);
    });
});
