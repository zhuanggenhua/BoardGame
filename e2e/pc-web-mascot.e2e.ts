import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './framework';
import { setChineseLocale, waitForFrontendAssets } from './helpers/common';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

async function ensureDirForScreenshot(path: string) {
    await mkdir(dirname(path), { recursive: true });
}

async function screenshotEvidence(testInfo: TestInfo, page: Page, name: string) {
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await ensureDirForScreenshot(path);
    await page.screenshot({ path, fullPage: false });
    return path;
}

async function expectMascotBubbleOnTop(page: Page) {
    const hits = await page.getByTestId('pc-web-mascot-bubble').evaluate((bubble) => {
        const element = bubble as HTMLElement;
        const rect = element.getBoundingClientRect();
        const samplePoints = [
            { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 },
            { x: rect.left + 12, y: rect.top + rect.height * 0.5 },
            { x: rect.right - 12, y: rect.top + rect.height * 0.5 },
            { x: rect.left + rect.width * 0.5, y: rect.top + 12 },
            { x: rect.left + rect.width * 0.5, y: rect.bottom - 12 },
        ];

        return samplePoints.map((point) => {
            const topElement = document.elementFromPoint(point.x, point.y);
            return {
                x: Math.round(point.x),
                y: Math.round(point.y),
                hitBubble: topElement ? element.contains(topElement) : false,
                topTestId: topElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
                topClassName: topElement instanceof HTMLElement ? topElement.className : null,
            };
        });
    });

    expect(hits.every((hit) => hit.hitBubble), JSON.stringify(hits)).toBe(true);
}

async function expectMascotBubbleTextAdaptive(page: Page) {
    const metrics = await page.getByTestId('pc-web-mascot-bubble').evaluate((bubble) => {
        const text = bubble.querySelector('[data-testid="pc-web-mascot-tip"]') as HTMLElement | null;
        const groupButton = bubble.querySelector('[data-testid="pc-web-mascot-group-copy"]') as HTMLElement | null;
        if (!text) {
            throw new Error('看板娘气泡正文不存在');
        }

        const bubbleRect = bubble.getBoundingClientRect();
        const textStyle = window.getComputedStyle(text);
        const groupButtonStyle = groupButton ? window.getComputedStyle(groupButton) : null;

        return {
            bubbleWidth: bubbleRect.width,
            fontSize: Number.parseFloat(textStyle.fontSize),
            textClientWidth: text.clientWidth,
            textScrollWidth: text.scrollWidth,
            textWhiteSpace: textStyle.whiteSpace,
            textOverflowWrap: textStyle.overflowWrap,
            groupButtonWhiteSpace: groupButtonStyle?.whiteSpace ?? null,
        };
    });

    expect(metrics.bubbleWidth).toBeLessThanOrEqual(300);
    expect(metrics.fontSize).toBeGreaterThanOrEqual(12);
    expect(metrics.fontSize).toBeLessThanOrEqual(14.1);
    expect(metrics.textWhiteSpace).toBe('normal');
    expect(metrics.textOverflowWrap).toBe('anywhere');
    expect(metrics.textScrollWidth).toBeLessThanOrEqual(metrics.textClientWidth + 1);
    if (metrics.groupButtonWhiteSpace !== null) {
        expect(metrics.groupButtonWhiteSpace).toBe('nowrap');
    }
}

test('PC Web 首页右下角显示看板娘且游戏页不显示', async ({ page, context }, testInfo) => {
    await clearEvidenceScreenshotsForTest(testInfo);
    await setChineseLocale(context);
    await page.setViewportSize(DESKTOP_VIEWPORT);

    await page.goto('/?homeStyle=classic', { waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45000);

    const mascot = page.getByTestId('pc-web-mascot');
    await expect(mascot).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => mascot.locator('img').evaluate((img) => {
        const element = img as HTMLImageElement;
        return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
    }), {
        timeout: 15000,
        message: '看板娘图片未完成加载',
    }).toBe(true);

    const mascotBox = await mascot.boundingBox();
    expect(mascotBox).not.toBeNull();
    expect(mascotBox!.x).toBeGreaterThan(DESKTOP_VIEWPORT.width * 0.78);
    expect(mascotBox!.y + mascotBox!.height).toBeLessThanOrEqual(DESKTOP_VIEWPORT.height);
    expect(mascotBox!.width).toBeGreaterThan(120);
    expect(mascotBox!.height).toBeGreaterThan(240);

    await screenshotEvidence(testInfo, page, '首页看板娘-右下角静置状态');

    await page.getByTestId('pc-web-mascot-button').click();
    await page.waitForTimeout(120);
    await expect(page.locator('.pc-web-mascot__scale')).toHaveCSS('animation-name', 'pc-web-mascot-scale');
    await expect(page.getByTestId('pc-web-mascot-tip')).toHaveText('欢迎进群交流：');
    await expect(page.getByTestId('pc-web-mascot-group-copy')).toHaveText('1081373485');
    await expect(page.locator('[data-testid^="game-list-status-ribbon-"]').first()).toContainText('实施中');
    await expectMascotBubbleOnTop(page);
    await expectMascotBubbleTextAdaptive(page);
    await screenshotEvidence(testInfo, page, '首页看板娘-第一次点击显示QQ群气泡且未被实施中横幅遮挡');

    await page.waitForTimeout(2500);
    await expect(page.getByTestId('pc-web-mascot-tip')).toHaveText('欢迎进群交流：');

    await page.getByTestId('pc-web-mascot-button').click();
    await expect(page.getByTestId('pc-web-mascot-tip')).toHaveText('遇到卡死时，悬浮球可以强制结束阶段。');
    await expect(page.getByTestId('pc-web-mascot-group-copy')).toHaveCount(0);
    await expectMascotBubbleOnTop(page);
    await screenshotEvidence(testInfo, page, '首页看板娘-第二次点击切到卡死提示');

    await page.getByTestId('pc-web-mascot-button').click();
    await expect(page.getByTestId('pc-web-mascot-tip')).toHaveText('点击对手分数/头像可以切换视角，可以看弃牌堆。');
    await expect(page.getByTestId('pc-web-mascot-group-copy')).toHaveCount(0);
    await expectMascotBubbleOnTop(page);
    await expectMascotBubbleTextAdaptive(page);
    await screenshotEvidence(testInfo, page, '首页看板娘-第三次点击切到视角提示且文本自适应换行');

    await page.waitForTimeout(5200);
    await expect(page.getByTestId('pc-web-mascot-bubble')).toHaveCount(0);
    await screenshotEvidence(testInfo, page, '首页看板娘-气泡5秒后自动隐藏');

    await page.goto('/play/tictactoe?skipInitialization=true', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('pc-web-mascot')).toHaveCount(0);

    await screenshotEvidence(testInfo, page, '游戏页看板娘隐藏');
});
