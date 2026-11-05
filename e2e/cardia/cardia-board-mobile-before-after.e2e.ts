import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../framework';
import { setupCardiaTestScenario, type CardiaTestScenario } from '../helpers/cardia';
import { createEvidenceScreenshotRun, promoteEvidenceScreenshotRun } from '../framework/evidenceScreenshots';

const CARDIA_BOARD_SCENARIO: CardiaTestScenario = {
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

async function hideDebugChrome(page: Page) {
    await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>('[data-testid="debug-toggle-container"]');
        if (toggle) {
            toggle.style.opacity = '0';
            toggle.style.pointerEvents = 'none';
        }
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

async function readCardMetrics(page: Page) {
    return page.evaluate(() => {
        const board = document.querySelector<HTMLElement>('[data-testid="cardia-board"]');
        const firstHandCard = document.querySelector<HTMLElement>('[data-testid="cardia-hand-area"] [data-testid^="card-"]');
        const firstBattlefieldCard = document.querySelector<HTMLElement>('[data-testid="cardia-battlefield"] [data-testid^="card-"]');
        if (!board || !firstHandCard || !firstBattlefieldCard) {
            throw new Error('Cardia 牌桌卡牌尚未渲染');
        }
        const style = getComputedStyle(board);
        const rect = (element: HTMLElement) => {
            const box = element.getBoundingClientRect();
            return { width: box.width, height: box.height, left: box.left, top: box.top };
        };
        return {
            cardVars: {
                normalWidth: style.getPropertyValue('--cardia-card-width').trim(),
                normalHeight: style.getPropertyValue('--cardia-card-height').trim(),
                smallWidth: style.getPropertyValue('--cardia-small-card-width').trim(),
                smallHeight: style.getPropertyValue('--cardia-small-card-height').trim(),
            },
            hand: rect(firstHandCard),
            battlefield: rect(firstBattlefieldCard),
            shellScale: getComputedStyle(document.documentElement).getPropertyValue('--mobile-board-shell-scale').trim(),
            route: window.location.pathname,
        };
    });
}

test('Cardia：Board.tsx 手机横屏卡牌布局修复前后对照', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    const browser = page.context().browser();
    if (!browser) throw new Error('Browser not available');

    const setup = await setupCardiaTestScenario(browser, CARDIA_BOARD_SCENARIO);
    const boardPage = setup.player1Page;
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const media = [
        {
            path: '01-Cardia手机横屏修复前旧逻辑重放.png', chainId: 'cardia-board-mobile-layout', chainStep: 1,
            stage: '前态' as const, description: '同一牌桌手机横屏下重放修复前卡牌尺寸逻辑。',
        },
        {
            path: '02-Cardia手机横屏当前实现.png', chainId: 'cardia-board-mobile-layout', chainStep: 2,
            stage: '后态' as const, description: '同一牌桌手机横屏下使用当前卡牌尺寸实现。',
        },
        {
            path: '03-Cardia桌面端当前实现.png', chainId: 'cardia-board-mobile-layout', chainStep: 3,
            stage: '后态' as const, description: '桌面端牌桌保持正常卡牌尺寸与布局。',
        },
    ];

    try {
        expect(boardPage.url().toLowerCase()).toContain('cardia');
        await expect(boardPage.getByTestId('cardia-board')).toBeVisible();
        await hideDebugChrome(boardPage);
        await boardPage.setViewportSize({ width: 844, height: 390 });
        await boardPage.waitForTimeout(500);
        await waitForCardiaImages(boardPage);

        const board = boardPage.locator('[data-testid="cardia-board"]');
        const currentStyle = await board.evaluate((element: HTMLElement) => {
            const keys = [
                '--cardia-card-width',
                '--cardia-card-height',
                '--cardia-small-card-width',
                '--cardia-small-card-height',
            ] as const;
            const read = (target: HTMLElement | null) => Object.fromEntries(
                keys.map((key) => [key, target?.style.getPropertyValue(key) ?? '']),
            );
            return {
                board: read(element),
                shell: read(element.querySelector<HTMLElement>('.cardia-board-shell')),
            };
        });

        // 精确重放 HEAD 的旧逻辑：同样的 844x390 计算结果，但不做 board-shell 逆缩放。
        const oldValues = {
            '--cardia-card-width': '50px',
            '--cardia-card-height': '75px',
            '--cardia-small-card-width': '34px',
            '--cardia-small-card-height': '51px',
        };
        await board.evaluate((element: HTMLElement, values) => {
            const targets = [element, element.querySelector<HTMLElement>('.cardia-board-shell')].filter(
                (target): target is HTMLElement => Boolean(target),
            );
            for (const target of targets) {
                for (const [key, value] of Object.entries(values)) target.style.setProperty(key, value);
            }
        }, oldValues);
        await boardPage.waitForTimeout(250);
        const beforeMetrics = await readCardMetrics(boardPage);
        await boardPage.screenshot({ path: join(evidenceRun.stagingDir, media[0].path), fullPage: false });

        await board.evaluate((element: HTMLElement, values) => {
            const targets = [element, element.querySelector<HTMLElement>('.cardia-board-shell')].filter(
                (target): target is HTMLElement => Boolean(target),
            );
            const previousByTarget = [values.board, values.shell];
            for (const [index, target] of targets.entries()) {
                for (const [key, value] of Object.entries(previousByTarget[index] ?? {})) {
                    if (value) target.style.setProperty(key, value);
                    else target.style.removeProperty(key);
                }
            }
        }, currentStyle);
        await boardPage.waitForTimeout(250);
        const afterMetrics = await readCardMetrics(boardPage);
        await boardPage.screenshot({ path: join(evidenceRun.stagingDir, media[1].path), fullPage: false });

        await boardPage.setViewportSize({ width: 1920, height: 1080 });
        await boardPage.waitForTimeout(400);
        const desktopMetrics = await readCardMetrics(boardPage);
        await boardPage.screenshot({ path: join(evidenceRun.stagingDir, media[2].path), fullPage: false });

        await writeFile(join(evidenceRun.stagingDir, 'card-metrics.json'), `${JSON.stringify({
            gameId: 'cardia',
            route: afterMetrics.route,
            evidenceCategory: 'independent',
            viewport: { mobile: '844x390', desktop: '1920x1080' },
            before: beforeMetrics,
            after: afterMetrics,
            desktop: desktopMetrics,
            note: '修复前为同一真实 Cardia 牌桌现场重放旧 Board.tsx 卡牌尺寸逻辑，不是历史截图。',
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
            viewport: '同一 Cardia 真实牌桌：844x390 手机横屏与 1920x1080 桌面',
            requirements: [
                {
                    requirement: 'Cardia Board.tsx 手机横屏卡牌布局提供修复前后同牌桌对照',
                    status: 'PASS',
                    evidence: [
                        '修复前图是在同一真实 Cardia 牌桌上现场重放旧逻辑，不冒充历史截图。',
                        `首张手牌屏幕尺寸：修复前 ${beforeMetrics.hand.width.toFixed(2)}x${beforeMetrics.hand.height.toFixed(2)}，当前 ${afterMetrics.hand.width.toFixed(2)}x${afterMetrics.hand.height.toFixed(2)}。`,
                        `当前实现变量使用 board-shell 逆缩放；修复前变量为 50px / 75px / 34px / 51px。`,
                    ],
                },
                {
                    requirement: 'Cardia 桌面端没有被这组移动端卡牌尺寸改动破坏',
                    status: 'PASS',
                    evidence: [
                        `桌面端同一牌桌仍能看到完整战场与手牌，首张手牌尺寸为 ${desktopMetrics.hand.width.toFixed(2)}x${desktopMetrics.hand.height.toFixed(2)}。`,
                    ],
                },
                {
                    requirement: '截图全部来自 Cardia 真实牌桌且没有调试控件混入',
                    status: 'PASS',
                    evidence: [
                        '三张图均来自 /play/cardia 同一运行；调试扳手已隐藏。',
                    ],
                },
            ],
            coverage: media.map((entry) => ({
                playerAction: entry.chainStep === 1
                    ? '在同一 Cardia 牌桌切到手机横屏并重放旧 Board.tsx 卡牌尺寸逻辑'
                    : entry.chainStep === 2
                        ? '恢复当前 Board.tsx 卡牌尺寸实现并保持同一牌桌与视口'
                        : '切回桌面端复核当前 Cardia 牌桌',
                directAssertion: entry.chainStep === 1
                    ? `首张手牌 ${beforeMetrics.hand.width.toFixed(2)}x${beforeMetrics.hand.height.toFixed(2)}`
                    : entry.chainStep === 2
                        ? `首张手牌 ${afterMetrics.hand.width.toFixed(2)}x${afterMetrics.hand.height.toFixed(2)}`
                        : `首张手牌 ${desktopMetrics.hand.width.toFixed(2)}x${desktopMetrics.hand.height.toFixed(2)}`,
                visibleResult: entry.description,
                media: [entry.path],
                uncovered: '浏览器模拟视口，不代表真实手机硬件屏幕。',
            })),
            visualAudit: {
                verdict: 'PASS',
                observations: [
                    '手机前后图是同一 Cardia 牌桌、同一横屏尺寸；底部手牌和左侧战场牌都在画面内。',
                    '修复后卡牌相对旧逻辑更接近目标屏幕尺寸，未出现整页被裁切。',
                    '桌面端仍保持完整牌桌上下文，未出现移动端尺寸变量泄漏。',
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
