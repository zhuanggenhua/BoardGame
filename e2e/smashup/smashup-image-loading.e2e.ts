import { test, expect } from '../framework';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dismissViteOverlay, initContext } from '../helpers/common';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    setupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    cleanupTwoPlayerMatch,
} from './smashup-helpers';
import { readCoreState, applyCoreState } from '../helpers/smashup';
import type { Page, TestInfo } from '@playwright/test';


type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

const saveEvidenceScreenshot = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name);
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
    return path;
};

/**
 * SmashUp 图片加载测试
 * 验证所有卡牌图片是否正确加载（带 i18n/zh-CN/ 前缀）
 * 
 * 运行前需要启动开发服务器：npm run dev
 */
test.describe('SmashUp Image Loading', () => {
    test.use({ 
        baseURL: process.env.VITE_FRONTEND_URL
            || `http://localhost:${process.env.PW_PORT || process.env.E2E_PORT || '6174'}`, 
        timeout: 60000
    });

    const collectPreviewStats = async (page: Page, cardSelector: string) => {
        return page.evaluate((selector) => {
            const cards = Array.from(document.querySelectorAll<HTMLElement>(selector));
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;
            const visibleCards = cards.filter((card) => {
                const rect = card.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= viewportH && rect.left <= viewportW;
            });

            const hasLoadedPreview = (root: HTMLElement): boolean => {
                const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
                return nodes.some((node) => {
                    if (node instanceof HTMLImageElement) {
                        const rect = node.getBoundingClientRect();
                        const visible = rect.width > 0 && rect.height > 0;
                        return visible && node.complete && node.naturalWidth > 0;
                    }
                    const computed = window.getComputedStyle(node);
                    return typeof computed.backgroundImage === 'string'
                        && computed.backgroundImage.includes('url(')
                        && computed.backgroundImage !== 'none';
                });
            };

            const renderedCards = visibleCards.filter((card) => hasLoadedPreview(card));
            return {
                total: cards.length,
                visible: visibleCards.length,
                rendered: renderedCards.length,
            };
        }, cardSelector);
    };

    const closeDebugPanelIfPresent = async (page: Page) => {
        const panel = page.getByTestId('debug-panel');
        if (await panel.isVisible().catch(() => false)) {
            const toggle = page.getByTestId('debug-toggle');
            if (await toggle.isVisible().catch(() => false)) {
                await toggle.click();
                await expect(panel).toBeHidden({ timeout: 3000 }).catch(() => {});
            }
        }
    };

    test('首页应正常显示大杀四方入口图', async ({ page }, testInfo) => {
        await page.goto('/');
        const smashupEntry = page.locator('[data-game-id="smashup"]').first();
        await expect(smashupEntry).toBeVisible({ timeout: 20000 });

        const homePreviews = await collectPreviewStats(page, '[data-game-id="smashup"]');
        expect(homePreviews.visible).toBeGreaterThan(0);
        expect(homePreviews.rendered).toBeGreaterThan(0);

        await saveEvidenceScreenshot(page, testInfo, 'home-smashup-entry');
    });

    test('应该加载带 i18n/zh-CN/ 前缀的卡牌图片', async ({ page }) => {
        const imageRequests: string[] = [];
        const wrongPaths: string[] = [];

        page.on('request', request => {
            const url = request.url();
            if (url.includes('.webp') && url.includes('smashup')) {
                imageRequests.push(url);
                const hasCorrectPrefix = url.includes('/i18n/zh-CN/smashup/')
                    || url.includes('/official/i18n/zh-CN/smashup/');
                if (!hasCorrectPrefix) {
                    wrongPaths.push(url);
                }
            }
        });

        await page.goto('/play/smashup');
        await expect(page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i }))
            .toBeVisible({ timeout: 20000 });
        await page.waitForTimeout(3000);

        expect(imageRequests.length).toBeGreaterThan(0);
        expect(wrongPaths).toHaveLength(0);
    });

    test('应该成功加载派系选择界面的卡牌图片', async ({ page }, testInfo) => {
        await page.goto('/play/smashup');
        await expect(page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i }))
            .toBeVisible({ timeout: 20000 });
        await expect(page.locator('[data-testid^="faction-option-"]').first()).toBeVisible({ timeout: 10000 });

        const draftPreviews = await collectPreviewStats(page, '[data-testid^="faction-option-"]');
        expect(draftPreviews.visible).toBeGreaterThan(0);
        expect(draftPreviews.rendered).toBeGreaterThan(0);

        await saveEvidenceScreenshot(page, testInfo, 'draft-faction-previews');
    });

    test('巨蚁加海盗本地对局应正常显示关键卡图', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            p0: 'giant_ants,pirates',
            p1: 'robots,ninjas',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-ant-worker', defId: 'giant_ant_worker', type: 'minion', owner: '0' },
                    { uid: 'hand-first-mate', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                ],
                deck: [],
                discard: [],
                factions: ['giant_ants', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['robots', 'ninjas'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'board-ant-soldier', defId: 'giant_ant_soldier', baseIndex: 0, owner: '0', controller: '0', basePower: 3, powerCounters: 1 },
                        { uid: 'board-pirate-mate', defId: 'pirate_first_mate', baseIndex: 0, owner: '0', controller: '0', basePower: 2 },
                    ],
                },
                { defId: 'base_tortuga' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-card-uid="hand-ant-worker"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-uid="hand-first-mate"]')).toBeVisible({ timeout: 5000 });

        const handPreviews = await collectPreviewStats(
            page,
            '[data-card-uid="hand-ant-worker"], [data-card-uid="hand-first-mate"]',
        );
        expect(handPreviews.visible).toBe(2);
        expect(handPreviews.rendered).toBe(handPreviews.visible);

        const player0 = await game.getPlayerState('0');
        expect(player0?.factions).toEqual(['giant_ants', 'pirates']);

        await saveEvidenceScreenshot(page, testInfo, 'giant-ants-pirates-local-board');
    });

    test('Pretty Pretty POD 本地对局应正常显示 POD 图集与手牌卡图', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        const imageRequests: string[] = [];
        page.on('request', request => {
            const url = request.url();
            if (url.includes('.webp') && url.includes('smashup')) {
                imageRequests.push(url);
            }
        });

        await game.openTestGame('smashup', {
            p0: 'kitty_cats_pod,mythic_horses_pod',
            p1: 'fairies_pod,princesses_pod',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 20260708,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-kitty-muffin-pod', defId: 'kitty_cats_muffin_pod', type: 'minion', owner: '0' },
                    { uid: 'hand-horse-seastar-pod', defId: 'mythic_horses_seastar_pod', type: 'minion', owner: '0' },
                ],
                deck: [],
                discard: [],
                factions: ['kitty_cats_pod', 'mythic_horses_pod'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [
                    { uid: 'hand-fairy-titania-pod', defId: 'fairies_titania_pod', type: 'minion', owner: '1' },
                    { uid: 'hand-princess-griselda-pod', defId: 'princesses_griselda_pod', type: 'minion', owner: '1' },
                ],
                deck: [],
                discard: [],
                factions: ['fairies_pod', 'princesses_pod'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_house_of_nine_lives_pod' },
                { defId: 'base_pony_paradise_pod' },
                { defId: 'base_fairy_ring_pod' },
                { defId: 'base_beautiful_castle_pod' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-card-uid="hand-kitty-muffin-pod"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-uid="hand-horse-seastar-pod"]')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/The House of Nine Lives|九命|Pony Land|小马/i).first())
            .toBeVisible({ timeout: 5000 });

        const handPreviews = await collectPreviewStats(
            page,
            '[data-card-uid="hand-kitty-muffin-pod"], [data-card-uid="hand-horse-seastar-pod"]',
        );
        expect(handPreviews.visible).toBe(2);
        expect(handPreviews.rendered).toBe(handPreviews.visible);

        const podHoverTranslation = page.locator(
            '[data-card-uid="hand-kitty-muffin-pod"] [data-testid="su-card-text-overlay"]',
        );
        await expect(podHoverTranslation).toHaveAttribute('data-overlay-visibility', 'hover');
        await expect(podHoverTranslation).toContainText('松饼');
        await expect(podHoverTranslation).toContainText('控制一个力量为 3 或更低的仆从直到回合结束。');

        await page.locator('[data-card-uid="hand-kitty-muffin-pod"]').hover();
        await expect.poll(async () => podHoverTranslation.evaluate((node) =>
            window.getComputedStyle(node).opacity,
        )).toBe('1');

        const requestedPrettyPrettyPodAssets = imageRequests.filter((url) =>
            url.includes('kitty_cats_pod.webp')
            || url.includes('mythic_horses_pod.webp')
            || url.includes('pretty_pretty_pod.webp'),
        );
        expect(requestedPrettyPrettyPodAssets.length).toBeGreaterThan(0);

        const player0 = await game.getPlayerState('0');
        const player1 = await game.getPlayerState('1');
        expect(player0?.factions).toEqual(['kitty_cats_pod', 'mythic_horses_pod']);
        expect(player1?.factions).toEqual(['fairies_pod', 'princesses_pod']);

        await saveEvidenceScreenshot(page, testInfo, 'pretty-pretty-pod-local-board');
    });

    test('应该成功加载手牌区域的卡牌图片', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage } = setup;
        try {
            await completeFactionSelection(hostPage, guestPage);
            await waitForHandArea(hostPage);
            await hostPage.waitForTimeout(1200);

            const handPreviews = await collectPreviewStats(hostPage, '[data-testid="su-hand-area"] [data-card-uid]');
            expect(handPreviews.visible).toBeGreaterThan(0);
            expect(handPreviews.rendered).toBe(handPreviews.visible);
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });

    test('应该成功加载弃牌堆的卡牌图片', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage } = setup;
        try {
            await completeFactionSelection(hostPage, guestPage);
            await waitForHandArea(hostPage);

            const core = await readCoreState(hostPage) as {
                players?: Record<string, { discard?: unknown[] }>;
            };
            const player0 = core.players?.['0'];
            if (!player0) {
                throw new Error('缺少玩家0数据，无法注入弃牌场景');
            }
            player0.discard = [
                { uid: 'img-card-1', defId: 'zombie_walker', type: 'minion' },
                { uid: 'img-card-2', defId: 'wizard_neophyte', type: 'minion' },
            ];
            await applyCoreState(hostPage, core);
            await hostPage.waitForTimeout(800);
            await closeDebugPanelIfPresent(hostPage);

            await expect(hostPage.locator('[data-testid="su-discard-toggle"]')).toBeVisible({ timeout: 5000 });
            await hostPage.click('[data-testid="su-discard-toggle"]');
            await hostPage.waitForSelector('[data-discard-view-panel]', { timeout: 5000 });

            const discardPreviews = await collectPreviewStats(hostPage, '[data-discard-view-panel] [data-card-uid]');
            expect(discardPreviews.visible).toBeGreaterThan(0);
            expect(discardPreviews.rendered).toBe(discardPreviews.visible);
        } finally {
            await cleanupTwoPlayerMatch(setup).catch(() => {});
        }
    });
});

test.describe('SmashUp Critical Image Gate', () => {
    test.use({
        baseURL: process.env.VITE_FRONTEND_URL
            || `http://localhost:${process.env.PW_PORT || process.env.E2E_PORT || '6174'}`,
        timeout: 60000,
    });

    test('进入本地对局时先显示 LoadingScreen，再进入派系选择界面', async ({ browser }, testInfo) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'add-critical-image-preloading');
        mkdirSync(evidenceDir, { recursive: true });
        const loadingShotPath = join(evidenceDir, 'critical-image-gate-loading.png');
        const readyShotPath = join(evidenceDir, 'critical-image-gate-faction-selection.png');
        const context = await browser.newContext({
            baseURL: testInfo.project.use.baseURL as string | undefined,
        });
        const delayedPixelPng = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==',
            'base64',
        );

        await initContext(context, {
            storageKey: '__smashup_real_image_gate__',
            skipImageGate: false,
        });

        await context.route(/assets\.easyboardgame\.top\/.*\.(png|jpg|jpeg|webp|avif|gif|svg)(\?.*)?$/i, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 250));
            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: delayedPixelPng,
            });
        });

        const page = await context.newPage();

        try {
            await page.goto('/play/smashup', { waitUntil: 'domcontentloaded' });
            await dismissViteOverlay(page);

            const loadingText = page.getByText(/Loading match resources|正在加载对局资源/i).first();
            await expect(loadingText).toBeVisible({ timeout: 10000 });
            await page.screenshot({ path: loadingShotPath });

            const factionHeading = page.locator('h1').filter({
                hasText: /Draft Your Factions|选择你的派系/i,
            });
            await expect(factionHeading).toBeVisible({ timeout: 20000 });
            await expect(loadingText).toBeHidden({ timeout: 10000 });

            const visibleFactionNames = page.getByText(
                /Aliens|Pirates|Ninjas|Dinosaurs|外星人|海盗|忍者|恐龙/i,
            );
            await expect(visibleFactionNames.first()).toBeVisible({ timeout: 5000 });

            const brokenVisibleImages = await page.evaluate(() =>
                Array.from(document.querySelectorAll('img'))
                    .filter((img) => {
                        const rect = img.getBoundingClientRect();
                        const visible = rect.width > 0 && rect.height > 0;
                        return visible && (!img.complete || img.naturalWidth === 0);
                    })
                    .map((img) => img.getAttribute('src') ?? ''),
            );
            expect(brokenVisibleImages).toEqual([]);

            await page.screenshot({ path: readyShotPath });
        } finally {
            await context.close();
        }
    });
});
