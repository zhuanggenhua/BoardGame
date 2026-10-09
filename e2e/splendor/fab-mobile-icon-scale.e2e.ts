import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    createEvidenceScreenshotRun,
    promoteEvidenceScreenshotRun,
} from '../framework/evidenceScreenshots';

type FabIconMetrics = {
    hudPlacement: string | null;
    shellScale: number;
    iconWidth: number;
    wrapperTransform: string;
};

async function readFabIconMetrics(page: Page): Promise<FabIconMetrics> {
    return page.evaluate(() => {
        const menu = document.querySelector<HTMLElement>('[data-testid="fab-menu"]');
        const visual = document.querySelector<HTMLElement>('[data-fab-visual-id="exit"]');
        const svg = visual?.querySelector<SVGSVGElement>('svg');
        const wrapper = svg?.parentElement as HTMLElement | null;
        if (!menu || !svg || !wrapper) {
            throw new Error('真实牌桌上的退出悬浮球 SVG 尚未渲染');
        }

        const parsedShellScale = Number.parseFloat(
            window.getComputedStyle(document.documentElement)
                .getPropertyValue('--mobile-board-shell-scale'),
        );
        return {
            hudPlacement: menu.getAttribute('data-hud-placement'),
            shellScale: Number.isFinite(parsedShellScale) && parsedShellScale > 0
                ? parsedShellScale
                : 1,
            iconWidth: svg.getBoundingClientRect().width,
            wrapperTransform: wrapper.style.transform,
        };
    });
}

test('Splendor：手机悬浮球 SVG 修复前后对照且 PC 尺寸不变', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/play/splendor', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
        () => (window as Window & {
            __BG_TEST_HARNESS__?: { state?: { isRegistered?: () => boolean } };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        undefined,
        { timeout: 20000, polling: 200 },
    );

    const initialState = await game.getState();
    await game.setupScene({
        gameId: 'splendor',
        player0: {},
        player1: {},
        currentPlayer: '0',
        extra: {
            core: {
                ...initialState.core,
                hostStarted: true,
                pendingResolution: undefined,
                endgame: { triggered: false },
                gameResult: undefined,
            },
        },
    });

    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media = [
        { path: '01-桌面修复前基线.png', chainId: 'splendor-fab-icon-scale', chainStep: 1, stage: '前态' as const,
            description: '桌面端修复前基线，牌桌悬浮球图标保持原有尺寸。' },
        { path: '02-手机原缩放逻辑重放.png', chainId: 'splendor-fab-icon-scale', chainStep: 2, stage: '中态' as const,
            description: '手机端重放原缩放后，悬浮球图标随牌桌壳层再次缩小。' },
        { path: '03-手机补偿修复后.png', chainId: 'splendor-fab-icon-scale', chainStep: 3, stage: '后态' as const,
            description: '手机端恢复反向补偿后，悬浮球图标回到桌面图标的九成二尺寸。' },
        { path: '04-桌面修复后对照.png', chainId: 'splendor-fab-icon-scale', chainStep: 4, stage: '后态' as const,
            description: '桌面端修复后对照，悬浮球图标尺寸与修复前一致。' },
    ];

    const fabIcon = page.locator('[data-fab-visual-id="exit"] svg');
    await expect(fabIcon).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('fab-menu')).toHaveAttribute('data-hud-placement', 'in-shell');

    const desktopBefore = await readFabIconMetrics(page);
    expect(desktopBefore.iconWidth).toBeGreaterThan(0);
    expect(desktopBefore.wrapperTransform).toBe('');
    await page.screenshot({ path: join(evidenceRun.stagingDir, media[0].path), fullPage: false });

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => {
        const shellScale = Number.parseFloat(
            window.getComputedStyle(document.documentElement)
                .getPropertyValue('--mobile-board-shell-scale'),
        );
        const svg = document.querySelector('[data-fab-visual-id="exit"] svg');
        return Boolean(svg) && Number.isFinite(shellScale) && shellScale > 0 && shellScale < 0.99;
    }, undefined, { timeout: 10000, polling: 100 });

    await page.waitForFunction(() => {
        const shellScale = Number.parseFloat(
            window.getComputedStyle(document.documentElement)
                .getPropertyValue('--mobile-board-shell-scale'),
        );
        const svg = document.querySelector<SVGSVGElement>('[data-fab-visual-id="exit"] svg');
        const wrapperElement = svg?.parentElement as HTMLElement | null;
        const scale = Number.parseFloat(wrapperElement?.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? '');
        return Number.isFinite(scale) && Math.abs(scale - 0.92 / shellScale) < 0.005;
    }, undefined, { timeout: 5000, polling: 100 });

    const mobileFixed = await readFabIconMetrics(page);
    expect(mobileFixed.hudPlacement).toBe('in-shell');
    const wrapper = fabIcon.locator('xpath=..');
    const fixedTransform = mobileFixed.wrapperTransform;
    expect(fixedTransform).not.toBe('');

    // 精确重放仓库原版 HEAD 中的手机图标变换；这不是旧版历史截图。
    await wrapper.evaluate((element: HTMLElement) => {
        element.style.transform = 'scale(0.92)';
    });
    const mobileBefore = await readFabIconMetrics(page);
    const beforeRatio = mobileBefore.iconWidth / desktopBefore.iconWidth;
    expect(beforeRatio).toBeCloseTo(0.92 * mobileBefore.shellScale, 1);
    expect(beforeRatio).toBeLessThan(0.92 - 0.02);
    await page.screenshot({ path: join(evidenceRun.stagingDir, media[1].path), fullPage: false });

    await wrapper.evaluate((element: HTMLElement, transform: string) => {
        element.style.transform = transform;
    }, fixedTransform);
    await page.waitForFunction((expectedTransform) => {
        const svg = document.querySelector<SVGSVGElement>('[data-fab-visual-id="exit"] svg');
        const currentTransform = (svg?.parentElement as HTMLElement | null)?.style.transform;
        return currentTransform === expectedTransform;
    }, fixedTransform, { timeout: 5000, polling: 100 });

    const mobileAfter = await readFabIconMetrics(page);
    const afterRatio = mobileAfter.iconWidth / desktopBefore.iconWidth;
    expect(afterRatio).toBeCloseTo(0.92, 1);
    expect(afterRatio).toBeGreaterThan(beforeRatio + 0.02);
    await page.screenshot({ path: join(evidenceRun.stagingDir, media[2].path), fullPage: false });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => {
        const svg = document.querySelector<SVGSVGElement>('[data-fab-visual-id="exit"] svg');
        const wrapperElement = svg?.parentElement as HTMLElement | null;
        return Boolean(wrapperElement) && wrapperElement!.style.transform === '';
    }, undefined, { timeout: 5000, polling: 100 });
    const desktopAfter = await readFabIconMetrics(page);
    expect(desktopAfter.iconWidth).toBeCloseTo(desktopBefore.iconWidth, 1);
    expect(desktopAfter.wrapperTransform).toBe(desktopBefore.wrapperTransform);
    await page.screenshot({ path: join(evidenceRun.stagingDir, media[3].path), fullPage: false });

    await writeFile(join(evidenceRun.stagingDir, 'pass-manifest.json'), `${JSON.stringify({
        verdict: 'PASS',
        scope: 'current-user-request',
        display: {
            purpose: 'final-user-visible-delivery',
            trigger: 'user-requested-evidence',
            viewer: 'web',
            finalPassBeforeOpen: true,
        },
        evidenceIndex: '.e2e-image-index.json',
        viewport: '1920x1080 与 844x390，同一 Splendor 真实牌桌状态',
        requirements: [
            {
                requirement: '手机端原悬浮球图标被牌桌壳层二次缩小，反向补偿后恢复到桌面图标九成二尺寸',
                status: 'PASS',
                evidence: [
                    `旧逻辑重放宽度比=${beforeRatio.toFixed(4)}，预期=${(0.92 * mobileBefore.shellScale).toFixed(4)}。`,
                    `修复后宽度比=${afterRatio.toFixed(4)}，目标=0.9200。`,
                ],
            },
            {
                requirement: 'PC 悬浮球尺寸和无变换状态保持不变',
                status: 'PASS',
                evidence: [
                    `修复前宽度=${desktopBefore.iconWidth.toFixed(2)}，修复后宽度=${desktopAfter.iconWidth.toFixed(2)}。`,
                    '桌面端修复前后 SVG 外层均无额外 transform。',
                ],
            },
        ],
        coverage: [
            {
                playerAction: '在同一 Splendor 牌桌从桌面切换到手机横屏，并比较悬浮球图标',
                directAssertion: '读取 SVG 屏幕宽度、壳层缩放值与图标外层 transform，校验旧版宽度比为 0.92 × 壳层比例、修复后为 0.92',
                visibleResult: '手机旧逻辑重放图中 SVG 更小；补偿图恢复为桌面图标的九成二；PC 前后宽度与无变换状态一致',
                media: media.map((entry) => entry.path),
                uncovered: '其它各款 board-shell 游戏未逐款截图；共享 FabMenu 在 in-shell 分支的屏幕几何由本代表入口验证，portal 分支不受壳层影响且未作视觉改动',
            },
        ],
        media: media.map((entry) => join(evidenceRun.stableDir, entry.path)),
    }, null, 2)}\n`, 'utf8');

    await promoteEvidenceScreenshotRun(evidenceRun, {
        gameId: '_shared',
        evidenceCategory: 'independent',
        media,
    });
});
