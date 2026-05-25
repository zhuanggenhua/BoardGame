import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import { setChineseLocale } from '../helpers/common';

const evidenceRoot = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    '_shared',
    'tool-routes-mobile.e2e',
);

const screenshot = async (page: Page, testName: string, fileName: string) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, fileName);
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
};

const toolCases = [
    {
        id: 'assetslicer',
        route: '/dev/slicer',
        titlePattern: /素材切片机/,
        screenshotName: 'assetslicer-mobile.png',
    },
    {
        id: 'fxpreview',
        route: '/dev/fx',
        titlePattern: /特效预览/,
        screenshotName: 'fxpreview-mobile.png',
    },
    {
        id: 'audiobrowser',
        route: '/dev/audio',
        titlePattern: /音效浏览器/,
        screenshotName: 'audiobrowser-mobile.png',
    },
    {
        id: 'archview',
        route: '/dev/arch',
        titlePattern: /架构全景|完整架构图/,
        screenshotName: 'archview-mobile.png',
    },
] as const;

const assertCoreContentVisible = async (page: Page, toolId: (typeof toolCases)[number]['id']) => {
    switch (toolId) {
        case 'assetslicer': {
            await expect(page.getByText('Splendor 映射')).toBeVisible();
            await expect(page.getByText('无图片')).toBeVisible();
            await expect(page.getByText(/更换图片/).first()).toBeVisible();
            await expect(page.getByTestId('asset-slicer-sidebar-toggle')).toBeVisible();
            break;
        }
        case 'fxpreview': {
            await expect(page.getByTestId('fx-preview-sidebar-toggle')).toBeVisible();
            await expect(page.locator('main').first().getByRole('button', { name: /粒子|光华/ }).first()).toBeVisible();
            await expect(page.locator('main').first()).toBeVisible();
            break;
        }
        case 'audiobrowser': {
            await expect(page.getByPlaceholder('搜索键名 / 文件名...')).toBeVisible();
            await expect(page.getByText('分类').first()).toBeVisible();
            await expect(page.locator('table').first()).toBeVisible();
            await expect(page.getByTestId('audio-browser-history-panel')).toBeVisible();
            await expect(page.getByTestId('audio-browser-history-surface')).toBeVisible();
            break;
        }
        case 'archview': {
            await expect(page.getByRole('button', { name: /完整架构图/ })).toBeVisible();
            await expect(page.getByRole('button', { name: /C4 全景/ })).toBeVisible();
            await expect(page.locator('svg').first()).toBeVisible();
            break;
        }
    }
};

const assertInteractiveFlowStable = async (page: Page, toolId: (typeof toolCases)[number]['id']) => {
    switch (toolId) {
        case 'assetslicer': {
            const sidebarToggle = page.getByTestId('asset-slicer-sidebar-toggle');
            await expect(sidebarToggle).toBeVisible();
            const sidebarToggleBox = await sidebarToggle.boundingBox();
            expect(sidebarToggleBox).not.toBeNull();

            if (!sidebarToggleBox) {
                throw new Error('AssetSlicer 收起侧栏拉手未正确渲染，无法校验移动端命中区');
            }

            expect(sidebarToggleBox.x).toBeGreaterThanOrEqual(0);
            await sidebarToggle.click();
            await expect(page.getByTestId('asset-slicer-sidebar-backdrop')).toBeVisible();
            await expect(page.getByTestId('asset-slicer-sidebar')).toBeVisible();
            await page.getByTestId('asset-slicer-sidebar').getByRole('button', { name: 'Splendor 映射' }).click();
            await expect(page.getByText('Splendor 映射校对')).toBeVisible();
            await expect(page.getByTestId('splendor-mapping-frame-grid')).toBeVisible();
            await page.getByRole('button', { name: '切回切片模式' }).click();
            await expect(page.getByTestId('asset-slicer-sidebar-backdrop')).toHaveCount(0);
            await expect
                .poll(async () => (await page.getByTestId('asset-slicer-sidebar').boundingBox())?.width ?? 0, {
                    timeout: 3000,
                    message: '手机竖屏下切回切片模式后，侧栏应收口完成再进入主工作区截图',
                })
                .toBeLessThanOrEqual(1);
            await expect(page.getByText('无图片')).toBeVisible();
            break;
        }
        case 'fxpreview': {
            await page.getByTestId('fx-preview-sidebar-toggle').click();
            await expect(page.getByTestId('fx-preview-sidebar-backdrop')).toBeVisible();
            await expect(page.getByTestId('fx-preview-sidebar')).toBeVisible();
            await page.getByTestId('fx-preview-sidebar-close').click();
            await expect(page.getByTestId('fx-preview-sidebar-backdrop')).toHaveCount(0);
            await expect(page.getByTestId('fx-preview-sidebar')).toHaveCount(0);
            const mainRegion = page.locator('main').first();
            await mainRegion.getByRole('button', { name: /粒子|光华/ }).first().click();
            await expect(mainRegion.getByRole('button', { name: /粒子|光华/ }).first()).toBeVisible();
            await expect(mainRegion).toBeVisible();
            const toolbar = mainRegion.getByTestId('effect-card-toolbar').first();
            const titleBlock = mainRegion.getByTestId('effect-card-title-block').first();
            const perfBar = mainRegion.getByTestId('effect-card-perf-bar').first();
            await expect(toolbar).toBeVisible();
            await expect(titleBlock).toBeVisible();
            await expect(perfBar).toBeVisible();

            const toolbarBox = await toolbar.boundingBox();
            const titleBlockBox = await titleBlock.boundingBox();
            const perfBarBox = await perfBar.boundingBox();
            const sidebarToggle = page.getByTestId('fx-preview-sidebar-toggle');
            const sidebarToggleBox = await sidebarToggle.boundingBox();
            expect(toolbarBox).not.toBeNull();
            expect(titleBlockBox).not.toBeNull();
            expect(perfBarBox).not.toBeNull();
            expect(sidebarToggleBox).not.toBeNull();
            if (!toolbarBox || !titleBlockBox || !perfBarBox || !sidebarToggleBox) {
                throw new Error('FxPreview 工具栏未正确渲染，无法校验移动端标题区排布');
            }

            expect(titleBlockBox.x + titleBlockBox.width).toBeLessThanOrEqual(toolbarBox.x + toolbarBox.width + 1);
            expect(perfBarBox.x + perfBarBox.width).toBeLessThanOrEqual(toolbarBox.x + toolbarBox.width + 1);
            const titleAndPerfSeparated = perfBarBox.y >= titleBlockBox.y + titleBlockBox.height - 2
                || titleBlockBox.x + titleBlockBox.width <= perfBarBox.x - 4;
            expect(titleAndPerfSeparated).toBeTruthy();
            expect(toolbarBox.y).toBeGreaterThanOrEqual(sidebarToggleBox.y + sidebarToggleBox.height - 2);
            break;
        }
        case 'archview': {
            await page.getByRole('button', { name: '完整架构图' }).click();
            await expect(page.getByText('完整架构图').first()).toBeVisible();
            await expect(page.locator('svg').first()).toBeVisible();
            await page.getByRole('button', { name: '← 返回' }).first().click();
            await expect(page.getByText('架构全景').first()).toBeVisible();
            await page.getByRole('button', { name: '用户故事' }).click();
            await expect(page.getByText('用户故事').first()).toBeVisible();
            const storyBackButton = page.getByTestId('arch-story-back-button');
            await expect(storyBackButton).toBeVisible();
            const storyLayoutMetrics = await page.evaluate(() => {
                const readRect = (testId: string) => {
                    const node = document.querySelector(`[data-testid="${testId}"]`);
                    if (!(node instanceof SVGGraphicsElement) && !(node instanceof HTMLElement)) {
                        return null;
                    }
                    const rect = node.getBoundingClientRect();
                    return {
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                    };
                };

                const svg = document.querySelector('svg');
                const svgRect = svg?.getBoundingClientRect();
                const scrollTop = window.scrollY;
                const scrollHeight = document.documentElement.scrollHeight;

                return {
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    scrollTop,
                    scrollHeight,
                    svgRect: svgRect
                        ? {
                            left: svgRect.left,
                            top: svgRect.top,
                            right: svgRect.right,
                            bottom: svgRect.bottom,
                            width: svgRect.width,
                            height: svgRect.height,
                        }
                        : null,
                    storyStepRects: Array.from({ length: 6 }, (_, i) => readRect(`arch-story-step-${i}`)),
                    firstStoryStepRect: readRect('arch-story-step-0'),
                    lastStoryStepRect: readRect('arch-story-step-5'),
                    storyBackButtonRect: readRect('arch-story-back-button'),
                };
            });

            expect(storyLayoutMetrics.firstStoryStepRect).not.toBeNull();
            expect(storyLayoutMetrics.lastStoryStepRect).not.toBeNull();
            expect(storyLayoutMetrics.storyBackButtonRect).not.toBeNull();

            if (!storyLayoutMetrics.firstStoryStepRect || !storyLayoutMetrics.lastStoryStepRect || !storyLayoutMetrics.storyBackButtonRect) {
                throw new Error('ArchView 用户故事阶段卡未正确渲染，无法校验移动端默认构图');
            }

            expect(storyLayoutMetrics.scrollTop).toBeLessThanOrEqual(1);
            expect(storyLayoutMetrics.firstStoryStepRect.width).toBeGreaterThanOrEqual(290);
            expect(storyLayoutMetrics.firstStoryStepRect.height).toBeGreaterThanOrEqual(70);
            expect(storyLayoutMetrics.lastStoryStepRect.bottom).toBeLessThanOrEqual(storyLayoutMetrics.viewportHeight - 48);
            expect(storyLayoutMetrics.storyBackButtonRect.height).toBeLessThanOrEqual(28);
            expect(storyLayoutMetrics.storyBackButtonRect.right).toBeLessThanOrEqual(storyLayoutMetrics.viewportWidth - 12);
            expect(storyLayoutMetrics.storyStepRects).toHaveLength(6);
            storyLayoutMetrics.storyStepRects.forEach((rect, index) => {
                expect(rect, `ArchView 第 ${index + 1} 张阶段卡缺失`).not.toBeNull();
                expect(rect?.left ?? -9999, `ArchView 第 ${index + 1} 张阶段卡左边越界`).toBeGreaterThanOrEqual(0);
                expect(rect?.right ?? 99999, `ArchView 第 ${index + 1} 张阶段卡右边越界`).toBeLessThanOrEqual(storyLayoutMetrics.viewportWidth - 12);
                expect(rect?.bottom ?? 99999, `ArchView 第 ${index + 1} 张阶段卡底边越界`).toBeLessThanOrEqual(storyLayoutMetrics.viewportHeight - 48);
                if (index > 0) {
                    const prevRect = storyLayoutMetrics.storyStepRects[index - 1];
                    expect(rect && prevRect).toBeTruthy();
                    expect((rect?.top ?? 0) - (prevRect?.bottom ?? 0), `ArchView 第 ${index} / ${index + 1} 张阶段卡不应重叠`).toBeGreaterThanOrEqual(8);
                }
            });
            break;
        }
        case 'audiobrowser': {
            const historySurface = page.getByTestId('audio-browser-history-surface');
            await expect(historySurface).toBeVisible();
            const historySurfaceBox = await historySurface.boundingBox();
            expect(historySurfaceBox).not.toBeNull();

            if (!historySurfaceBox) {
                throw new Error('AudioBrowser 历史面板主体未正确渲染，无法校验移动端底部安全区');
            }

            const viewportSize = page.viewportSize();
            expect(viewportSize).not.toBeNull();
            if (!viewportSize) {
                throw new Error('AudioBrowser 无法获取当前视口尺寸');
            }

            const settingsFab = page.getByRole('button', { name: '设置' });
            await expect(settingsFab).toBeVisible();
            const settingsFabBox = await settingsFab.boundingBox();
            expect(settingsFabBox).not.toBeNull();

            if (!settingsFabBox) {
                throw new Error('AudioBrowser 无法定位右下角设置悬浮球，无法校验移动端遮挡');
            }

            const overlapsSettingsFab = !(
                historySurfaceBox.x + historySurfaceBox.width <= settingsFabBox.x
                || settingsFabBox.x + settingsFabBox.width <= historySurfaceBox.x
                || historySurfaceBox.y + historySurfaceBox.height <= settingsFabBox.y
                || settingsFabBox.y + settingsFabBox.height <= historySurfaceBox.y
            );

            expect(overlapsSettingsFab).toBeFalsy();
            expect(historySurfaceBox.y + historySurfaceBox.height).toBeLessThanOrEqual(viewportSize.height - 12);
            break;
        }
    }
};

test.describe('工具页移动端基本兼容', () => {
    for (const toolCase of toolCases) {
        test(`${toolCase.id} 在手机竖屏下应可打开且不出现顶层横向溢出`, async ({ page }) => {
            await setChineseLocale(page.context());
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto(toolCase.route, { waitUntil: 'domcontentloaded' });

            if (toolCase.id === 'fxpreview') {
                await expect(page.getByTestId('fx-preview-sidebar-toggle')).toBeVisible({ timeout: 15000 });
            } else {
                await expect(page.getByText(toolCase.titlePattern).first()).toBeVisible({ timeout: 15000 });
            }
            await assertCoreContentVisible(page, toolCase.id);
            await assertInteractiveFlowStable(page, toolCase.id);

            const metrics = await page.evaluate(() => ({
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                docScrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                docOverflowX: window.getComputedStyle(document.documentElement).overflowX,
                bodyOverflowX: window.getComputedStyle(document.body).overflowX,
            }));

            expect(metrics.docScrollWidth, '工具页 documentElement 不应横向溢出视口').toBeLessThanOrEqual(metrics.innerWidth + 1);
            expect(metrics.bodyScrollWidth, '工具页 body 不应横向溢出视口').toBeLessThanOrEqual(metrics.innerWidth + 1);
            expect(['hidden', 'clip', 'visible', 'auto']).toContain(metrics.docOverflowX);
            expect(['hidden', 'clip', 'visible', 'auto']).toContain(metrics.bodyOverflowX);

            await screenshot(page, `${toolCase.id} 在手机竖屏下应可打开且不出现顶层横向溢出`, toolCase.screenshotName);
        });
    }
});
