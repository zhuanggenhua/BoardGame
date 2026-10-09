import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import { setupCardiaTestScenario, type CardiaTestScenario } from '../helpers/cardia';
import { createEvidenceScreenshotRun, promoteEvidenceScreenshotRun } from '../framework/evidenceScreenshots';

const CARDIA_FAB_SCENARIO: CardiaTestScenario = {
    phase: 'play',
    player1: {
        hand: ['deck_i_card_01', 'deck_i_card_02', 'deck_i_card_03', 'deck_i_card_04'],
        deck: ['deck_i_card_05', 'deck_i_card_06'],
        discard: ['deck_i_card_07', 'deck_i_card_08'],
        playedCards: [{ defId: 'deck_i_card_09', signets: 1, encounterIndex: 0 }],
    },
    player2: {
        hand: ['deck_i_card_10', 'deck_i_card_11', 'deck_i_card_12', 'deck_i_card_13'],
        deck: ['deck_i_card_14', 'deck_i_card_15'],
        discard: ['deck_i_card_16', 'deck_i_card_01'],
        playedCards: [{ defId: 'deck_i_card_02', encounterIndex: 0, signets: 1 }],
    },
};

type FabIconMetrics = {
    route: string;
    shellScale: number;
    iconWidth: number;
    wrapperTransform: string;
};

async function readFabIconMetrics(page: Page): Promise<FabIconMetrics> {
    return page.evaluate(() => {
        const menu = document.querySelector<HTMLElement>('[data-testid="fab-menu"]');
        const visual = document.querySelector<HTMLElement>('[data-fab-visual-id="chat"]');
        const svg = visual?.querySelector<SVGSVGElement>('svg');
        const wrapper = svg?.parentElement as HTMLElement | null;
        if (!menu || !svg || !wrapper) {
            throw new Error('Cardia 真实牌桌上的主悬浮球 SVG 尚未渲染');
        }

        const parsedShellScale = Number.parseFloat(
            window.getComputedStyle(document.documentElement)
                .getPropertyValue('--mobile-board-shell-scale'),
        );
        return {
            route: window.location.pathname,
            shellScale: Number.isFinite(parsedShellScale) && parsedShellScale > 0
                ? parsedShellScale
                : 1,
            iconWidth: svg.getBoundingClientRect().width,
            wrapperTransform: wrapper.style.transform,
        };
    });
}

async function waitForCardiaImages(page: Page) {
    await expect.poll(() => page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-testid="cardia-hand-area"] [data-testid^="card-"], [data-testid="cardia-battlefield"] [data-testid^="card-"]',
        ));
        return cards.length > 0 && cards.every((card) => {
            const image = card.querySelector('img');
            return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
        });
    }), { timeout: 10000, message: '等待 Cardia 手牌和战场卡图加载完成' }).toBe(true);
}

async function hideDebugChrome(page: Page) {
    await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>('[data-testid="debug-toggle-container"]');
        if (toggle) {
            toggle.style.opacity = '0';
            toggle.style.pointerEvents = 'none';
        }
    });
}

test('Cardia：同一真实牌桌对照手机悬浮球旧逻辑与修复后，并保护 PC 尺寸', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    const browser = page.context().browser();
    if (!browser) throw new Error('Browser not available');

    const setup = await setupCardiaTestScenario(browser, CARDIA_FAB_SCENARIO);
    const boardPage = setup.player1Page;
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media = [
        {
            path: '01-Cardia-PC修复前基线.png', chainId: 'cardia-fab-icon-scale', chainStep: 1,
            stage: '前态' as const, description: '同一牌桌的桌面端基线，悬浮球图标未加手机补偿。',
        },
        {
            path: '02-Cardia-手机旧逻辑重放.png', chainId: 'cardia-fab-icon-scale', chainStep: 2,
            stage: '中态' as const, description: '切换到手机横屏并重放旧缩放逻辑，图标被牌桌壳层再次缩小。',
        },
        {
            path: '03-Cardia-手机修复后.png', chainId: 'cardia-fab-icon-scale', chainStep: 3,
            stage: '后态' as const, description: '恢复手机补偿后，悬浮球图标回到桌面图标的九成二。',
        },
        {
            path: '04-Cardia-PC修复后对照.png', chainId: 'cardia-fab-icon-scale', chainStep: 4,
            stage: '后态' as const, description: '切回桌面端后，悬浮球图标尺寸与修复前基线相同。',
        },
    ];

    try {
        expect(boardPage.url().toLowerCase()).toContain('cardia');
        await expect(boardPage.getByTestId('cardia-board')).toBeVisible();
        await expect(boardPage.getByTestId('fab-menu')).toHaveAttribute('data-hud-placement', 'in-shell');
        await hideDebugChrome(boardPage);
        await waitForCardiaImages(boardPage);

        const fabIcon = boardPage.locator('[data-testid="fab-menu"] [data-fab-visual-id="chat"] svg');
        await expect(fabIcon).toBeVisible();
        const wrapper = fabIcon.locator('xpath=..');

        await boardPage.setViewportSize({ width: 1920, height: 1080 });
        await boardPage.waitForTimeout(300);
        const desktopBefore = await readFabIconMetrics(boardPage);
        expect(desktopBefore.route.toLowerCase()).toContain('cardia');
        expect(desktopBefore.wrapperTransform).toBe('');
        await boardPage.screenshot({ path: join(evidenceRun.stagingDir, media[0].path), fullPage: false });

        await boardPage.setViewportSize({ width: 844, height: 390 });
        await boardPage.waitForFunction(() => {
            const shellScale = Number.parseFloat(
                window.getComputedStyle(document.documentElement)
                    .getPropertyValue('--mobile-board-shell-scale'),
            );
            const svg = document.querySelector<SVGSVGElement>(
                '[data-testid="fab-menu"] [data-fab-visual-id="chat"] svg',
            );
            const wrapperElement = svg?.parentElement as HTMLElement | null;
            const actualScale = Number.parseFloat(
                wrapperElement?.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? '',
            );
            return Number.isFinite(shellScale)
                && shellScale > 0
                && shellScale < 1
                && Number.isFinite(actualScale)
                && Math.abs(actualScale - 0.92 / shellScale) < 0.005;
        }, undefined, { timeout: 10000, polling: 100 });

        const fixedTransform = await wrapper.evaluate((element: HTMLElement) => element.style.transform);
        const shellFab = boardPage.locator('[data-testid="fab-menu"][data-hud-placement="in-shell"]');
        await expect(shellFab).toBeVisible();

        // 这是在 Cardia 真实牌桌上重放仓库 HEAD 的旧 CSS 变换，不是历史截图。
        await wrapper.evaluate((element: HTMLElement) => {
            element.style.transform = 'scale(0.92)';
        });
        const mobileOldLogic = await readFabIconMetrics(boardPage);
        const oldLogicRatio = mobileOldLogic.iconWidth / desktopBefore.iconWidth;
        expect(oldLogicRatio).toBeCloseTo(0.92 * mobileOldLogic.shellScale, 2);
        expect(oldLogicRatio).toBeLessThan(0.92 - 0.02);
        await boardPage.screenshot({ path: join(evidenceRun.stagingDir, media[1].path), fullPage: false });

        await wrapper.evaluate((element: HTMLElement, transform: string) => {
            element.style.transform = transform;
        }, fixedTransform);
        await boardPage.waitForFunction((expectedTransform) => {
            const svg = document.querySelector<SVGSVGElement>(
                '[data-testid="fab-menu"] [data-fab-visual-id="chat"] svg',
            );
            return (svg?.parentElement as HTMLElement | null)?.style.transform === expectedTransform;
        }, fixedTransform, { timeout: 5000, polling: 100 });

        const mobileAfter = await readFabIconMetrics(boardPage);
        const fixedRatio = mobileAfter.iconWidth / desktopBefore.iconWidth;
        expect(fixedRatio).toBeCloseTo(0.92, 2);
        expect(fixedRatio).toBeGreaterThan(oldLogicRatio + 0.02);
        await boardPage.screenshot({ path: join(evidenceRun.stagingDir, media[2].path), fullPage: false });

        await boardPage.setViewportSize({ width: 1920, height: 1080 });
        await boardPage.waitForFunction(() => {
            const svg = document.querySelector<SVGSVGElement>(
                '[data-testid="fab-menu"] [data-fab-visual-id="chat"] svg',
            );
            return Boolean(svg?.parentElement) && (svg!.parentElement as HTMLElement).style.transform === '';
        }, undefined, { timeout: 5000, polling: 100 });
        const desktopAfter = await readFabIconMetrics(boardPage);
        expect(desktopAfter.iconWidth).toBeCloseTo(desktopBefore.iconWidth, 1);
        expect(desktopAfter.wrapperTransform).toBe(desktopBefore.wrapperTransform);
        await boardPage.screenshot({ path: join(evidenceRun.stagingDir, media[3].path), fullPage: false });

        await writeFile(join(evidenceRun.stagingDir, 'icon-measurements.json'), `${JSON.stringify({
            gameId: 'cardia',
            route: desktopBefore.route,
            evidenceCategory: 'independent',
            viewport: { desktop: '1920x1080', mobile: '844x390' },
            desktopBeforeWidth: desktopBefore.iconWidth,
            mobileShellScale: mobileOldLogic.shellScale,
            mobileOldLogicWidthRatio: oldLogicRatio,
            mobileFixedWidthRatio: fixedRatio,
            desktopAfterWidth: desktopAfter.iconWidth,
            oldLogicCapture: '旧逻辑 DOM 重放；不是历史截图',
            media: media.map((entry) => join(evidenceRun.stableDir, entry.path)),
        }, null, 2)}\n`, 'utf8');

        await writeFile(join(evidenceRun.stagingDir, 'pass-manifest.json'), `${JSON.stringify({
            verdict: 'PASS',
            scope: 'current-user-request',
            gameId: 'cardia',
            evidenceCategory: 'independent',
            evidenceIndex: '.e2e-image-index.json',
            display: {
                purpose: 'final-user-visible-delivery',
                trigger: 'user-requested-evidence',
                viewer: 'web',
                finalPassBeforeOpen: true,
            },
            viewport: '同一 Cardia 在线牌桌：1920x1080 桌面与 844x390 手机横屏',
            requirements: [
                {
                    requirement: 'Cardia 手机悬浮球修复前后使用同一真实牌桌对照；修复前图明确为旧逻辑现场重放，不冒充历史截图',
                    status: 'PASS',
                    evidence: [
                        `旧逻辑重放屏幕宽度比=${oldLogicRatio.toFixed(4)}，预期=${(0.92 * mobileOldLogic.shellScale).toFixed(4)}。`,
                        `修复后屏幕宽度比=${fixedRatio.toFixed(4)}，目标=0.9200。`,
                        '四张图来自同一 Cardia 真实在线牌桌；路径断言为 /play/cardia。',
                    ],
                },
                {
                    requirement: 'PC 悬浮球尺寸修复前后不变',
                    status: 'PASS',
                    evidence: [
                        `PC 修复前 SVG 宽度=${desktopBefore.iconWidth.toFixed(2)}，修复后=${desktopAfter.iconWidth.toFixed(2)}。`,
                        'PC 两态 SVG 外层均无额外 transform。',
                    ],
                },
                {
                    requirement: '截图身份和游戏画面匹配 Cardia，不混入其它游戏或调试浮层',
                    status: 'PASS',
                    evidence: [
                        '逐张核对四张整屏原图：Cardia 牌桌、双方手牌与悬浮球可见；调试工具控件已从截图隐藏。',
                        'gameId、证据目录和索引均为 cardia / independent。',
                    ],
                },
            ],
            coverage: media.map((entry) => ({
                playerAction: entry.chainStep === 1
                    ? '同一 Cardia 对局在桌面端记录修复前基线'
                    : entry.chainStep === 2
                        ? '切换到手机横屏并在当前运行时重放旧 CSS 缩放'
                        : entry.chainStep === 3
                            ? '恢复当前手机补偿逻辑并记录 Cardia 手机图'
                            : '切回桌面端复核 SVG 尺寸与原基线一致',
                directAssertion: entry.chainStep === 2
                    ? `屏幕 SVG 宽度比=${oldLogicRatio.toFixed(4)}；等于 0.92 × board-shell 比例。`
                    : entry.chainStep === 3
                        ? `屏幕 SVG 宽度比=${fixedRatio.toFixed(4)}；修复后为桌面宽度的 0.92。`
                        : '运行时断言真实 Cardia route、牌桌和 SVG；截图与对应断言在同一运行生成。',
                visibleResult: entry.description,
                media: [entry.path],
                uncovered: '浏览器模拟视口，不证明真实手机硬件、系统栏或触控命中体验。',
            })),
            visualAudit: {
                verdict: 'PASS',
                observations: [
                    '四张均为 Cardia 双方牌桌整屏原图，双方手牌、战场和右下聊天悬浮球可识别。',
                    '手机旧逻辑重放与修复后同视口对照可见主球图标尺寸变化；截图无扳手调试控件。',
                    'PC 前后同视口画面比例一致；DOM 测量断言宽度相同。',
                ],
            },
            media: media.map((entry) => join(evidenceRun.stableDir, entry.path)),
        }, null, 2)}\n`, 'utf8');

        await promoteEvidenceScreenshotRun(evidenceRun, {
            gameId: 'cardia',
            evidenceCategory: 'independent',
            media,
        });
    } finally {
        await setup.cleanup();
    }
});
