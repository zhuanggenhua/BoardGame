/**
 * 大杀四方 (Smash Up) - 本地模式 E2E 测试
 *
 * 直接进入 /play/smashup/local，跳过房间创建流程。
 * 通过调试面板注入状态来跳过派系选择，直接验证游戏核心流程。
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
    initContext,
    blockAudioRequests,
    dismissViteOverlay,
} from '../helpers/common';
import { GameTestContext } from '../framework/GameTestContext';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

// ============================================================================
// 本地模式入口
// ============================================================================

const gotoLocalSmashUp = async (page: Page) => {
    await page.goto('/play/smashup/local', { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(page);
    // 等待游戏加载（派系选择或游戏界面）
    await page.waitForFunction(
        () => {
            // 派系选择界面
            if (document.querySelector('h1')?.textContent?.match(/Draft Your Factions|选择你的派系/)) return true;
            // 游戏界面
            if (document.querySelector('[data-testid="su-hand-area"]')) return true;
            // 调试面板按钮（说明 Board 已渲染）
            if (document.querySelector('[data-testid="debug-toggle"]') || document.querySelector('[data-testid="debug-toggle-container"]')) return true;
            return false;
        },
        { timeout: 20000 },
    );
};

/**
 * 在本地模式下完成派系选择（两个玩家都是自己）。
 * 蛇形选秀：P0 选1个 → P1 选2个 → P0 选最后1个。
 * 流程：点击派系卡片 → 打开详情弹窗 → 点击确认按钮。
 */
const completeFactionSelectionLocal = async (page: Page) => {
    const factionHeading = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    if (!await factionHeading.isVisible().catch(() => false)) return; // 已经跳过了

    // 保持原本派系归属：P0 = Pirates + Aliens，P1 = Ninjas + Dinosaurs。
    const factionNames = [
        ['Pirates', '海盗'],
        ['Ninjas', '忍者'],
        ['Dinosaurs', '恐龙'],
        ['Aliens', '外星人'],
    ];

    for (let i = 0; i < factionNames.length; i++) {
        if (await page.getByTestId('su-hand-area').isVisible().catch(() => false)) {
            return;
        }

        const aliases = factionNames[i];

        // 等待派系网格可见且没有弹窗遮挡
        await page.waitForTimeout(600);

        // 通过派系名称文本找到对应派系列表项，避免命中错误的 group 父节点
        const factionPattern = new RegExp(`^(?:${aliases.join('|')})(?:\\s*\\((?:POD|POD版)\\))?$`, 'i');
        const factionCard = page.locator('h3')
            .filter({ hasText: factionPattern })
            .first()
            .locator('xpath=ancestor::*[starts-with(@data-testid,"faction-option-")]')
            .first();
        await expect(factionCard).toBeVisible({ timeout: 5000 });
        await factionCard.click({ force: true });

        const detailPanel = page.getByTestId('faction-detail-panel');
        await expect(detailPanel).toBeVisible({ timeout: 8000 });

        // 等待弹窗出现：确认按钮或已选/已被占用的状态
        const confirmBtn = page.getByTestId('faction-confirm-button');
        await expect(confirmBtn).toBeVisible({ timeout: 8000 });
        await expect(confirmBtn).toBeEnabled({ timeout: 3000 });
        await page.waitForTimeout(400);
        await confirmBtn.click({ force: true });

        // 等待弹窗关闭（focusedFactionId 被设为 null 后弹窗消失）
        await expect(detailPanel).toBeHidden({ timeout: 5000 });
    }
    // 等待派系选择完成，游戏界面加载
    await page.waitForTimeout(1500);
};

const waitForHandArea = async (page: Page, timeout = 30000) => {
    const handArea = page.getByTestId('su-hand-area');
    await expect(handArea).toBeVisible({ timeout });
    return handArea;
};

const saveEvidenceLocatorScreenshot = async (
    locator: Locator,
    name: string,
    testInfo: Parameters<GameTestContext['screenshot']>[1],
) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });
    await mkdir(dirname(path), { recursive: true });
    await locator.screenshot({ path });
};

const openFabSettingsPanel = async (page: Page) => {
    const mainFabButton = page.locator('[data-fab-id="exit"]');
    await expect(mainFabButton).toBeVisible({ timeout: 10000 });
    await mainFabButton.click();

    const settingsButton = page.locator('[data-fab-id="settings"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    const settingsPanel = page.getByTestId('fab-panel-settings');
    await expect(settingsPanel).toBeVisible({ timeout: 5000 });
    return settingsPanel;
};

const clickHandCard = async (page: Page, locator: Locator) => {
    await expect(locator).toBeVisible({ timeout: 10000 });
    await locator.click({ force: true });
    await page.waitForTimeout(300);
};

const captureLayoutMotionDuringMinionPlay = async (
    page: Page,
    options: {
        selector: string;
        cardUid: string;
        baseIndex: number;
        playerId?: string;
        durationMs?: number;
        dispatchDelayMs?: number;
    },
) => {
    return await page.evaluate(
        ({ selector, cardUid, baseIndex, playerId, durationMs, dispatchDelayMs }) =>
            new Promise<{
                found: boolean;
                dispatched: boolean;
                dispatchError: string | null;
                samples: Array<{ t: number; top: number }>;
            }>((resolve) => {
                const target = document.querySelector(selector) as HTMLElement | null;
                const harness = (window as Window & {
                    __BG_TEST_HARNESS__?: {
                        state?: { get?: () => any };
                        command?: { dispatch?: (command: unknown) => void };
                    };
                }).__BG_TEST_HARNESS__;

                if (!target || !harness?.state?.get || !harness?.command?.dispatch) {
                    resolve({
                        found: Boolean(target),
                        dispatched: false,
                        dispatchError: !target ? 'target-not-found' : 'harness-command-unavailable',
                        samples: [],
                    });
                    return;
                }

                const samples: Array<{ t: number; top: number }> = [];
                const startedAt = performance.now();
                let dispatched = false;
                let dispatchError: string | null = null;

                const tick = () => {
                    const now = performance.now();
                    samples.push({
                        t: now - startedAt,
                        top: target.getBoundingClientRect().top,
                    });

                    if (!dispatched && now - startedAt >= dispatchDelayMs) {
                        dispatched = true;
                        try {
                            const state = harness.state?.get?.();
                            const resolvedPlayerId = playerId ?? state?.core?.turnOrder?.[state?.core?.currentPlayerIndex ?? 0] ?? '0';
                            harness.command?.dispatch?.({
                                type: 'su:play_minion',
                                playerId: resolvedPlayerId,
                                payload: { cardUid, baseIndex, __tutorialPlayerId: resolvedPlayerId },
                            });
                        } catch (error) {
                            dispatchError = error instanceof Error ? error.message : String(error);
                        }
                    }

                    if (now - startedAt < durationMs) {
                        requestAnimationFrame(tick);
                        return;
                    }

                    resolve({
                        found: true,
                        dispatched,
                        dispatchError,
                        samples,
                    });
                };

                requestAnimationFrame(tick);
            }),
        {
            selector: options.selector,
            cardUid: options.cardUid,
            baseIndex: options.baseIndex,
            playerId: options.playerId,
            durationMs: options.durationMs ?? 700,
            dispatchDelayMs: options.dispatchDelayMs ?? 50,
        },
    );
};

const captureMinionEntryTimeline = async (
    page: Page,
    options: {
        cardUid: string;
        baseIndex: number;
        playerId?: string;
        durationMs?: number;
        dispatchDelayMs?: number;
    },
) => {
    return await page.evaluate(
        ({ cardUid, baseIndex, playerId, durationMs, dispatchDelayMs }) =>
            new Promise<{
                dispatched: boolean;
                dispatchError: string | null;
                samples: Array<{
                    t: number;
                    exists: boolean;
                    top: number | null;
                    hasAtlasShimmer: boolean;
                }>;
            }>((resolve) => {
                const harness = (window as Window & {
                    __BG_TEST_HARNESS__?: {
                        state?: { get?: () => unknown };
                        command?: { dispatch?: (command: unknown) => void };
                    };
                }).__BG_TEST_HARNESS__;

                if (!harness?.command?.dispatch) {
                    resolve({
                        dispatched: false,
                        dispatchError: 'harness-command-unavailable',
                        samples: [],
                    });
                    return;
                }

                const startedAt = performance.now();
                const samples: Array<{
                    t: number;
                    exists: boolean;
                    top: number | null;
                    hasAtlasShimmer: boolean;
                }> = [];
                let dispatched = false;
                let dispatchError: string | null = null;

                const tick = () => {
                    const now = performance.now();
                    const minion = document.querySelector(`[data-minion-uid="${cardUid}"]`) as HTMLElement | null;
                    samples.push({
                        t: now - startedAt,
                        exists: Boolean(minion),
                        top: minion ? minion.getBoundingClientRect().top : null,
                        hasAtlasShimmer: Boolean(minion?.querySelector('.atlas-shimmer')),
                    });

                    if (!dispatched && now - startedAt >= dispatchDelayMs) {
                        dispatched = true;
                        try {
                            const state = harness.state?.get?.() as {
                                core?: { currentPlayerIndex?: number; turnOrder?: string[] };
                            } | undefined;
                            const resolvedPlayerId = playerId ?? state?.core?.turnOrder?.[state?.core?.currentPlayerIndex ?? 0] ?? '0';
                            harness.command?.dispatch?.({
                                type: 'su:play_minion',
                                playerId: resolvedPlayerId,
                                payload: { cardUid, baseIndex, __tutorialPlayerId: resolvedPlayerId },
                            });
                        } catch (error) {
                            dispatchError = error instanceof Error ? error.message : String(error);
                        }
                    }

                    if (now - startedAt < durationMs) {
                        requestAnimationFrame(tick);
                        return;
                    }

                    resolve({
                        dispatched,
                        dispatchError,
                        samples,
                    });
                };

                requestAnimationFrame(tick);
            }),
        {
            cardUid: options.cardUid,
            baseIndex: options.baseIndex,
            playerId: options.playerId,
            durationMs: options.durationMs ?? 1200,
            dispatchDelayMs: options.dispatchDelayMs ?? 50,
        },
    );
};

const compressTopSamples = (tops: number[], minDelta = 1.5) => {
    const compressed: number[] = [];
    for (const top of tops) {
        if (compressed.length === 0 || Math.abs(top - compressed[compressed.length - 1]) >= minDelta) {
            compressed.push(top);
        }
    }
    return compressed;
};

const countDirectionChanges = (tops: number[], minDelta = 0.8) => {
    let previousSign = 0;
    let changes = 0;

    for (let i = 1; i < tops.length; i += 1) {
        const delta = tops[i] - tops[i - 1];
        const sign = delta > minDelta ? 1 : delta < -minDelta ? -1 : 0;
        if (sign === 0) continue;
        if (previousSign !== 0 && sign !== previousSign) {
            changes += 1;
        }
        previousSign = sign;
    }

    return changes;
};

const summarizeEntryTimeline = (
    timeline: Awaited<ReturnType<typeof captureMinionEntryTimeline>>,
) => {
    const firstVisible = timeline.samples.find((sample) => sample.exists);
    const lastShimmer = [...timeline.samples].reverse().find((sample) => sample.exists && sample.hasAtlasShimmer);
    const visibleTops = timeline.samples
        .map((sample) => sample.top)
        .filter((top): top is number => typeof top === 'number');
    const roundedTops = Array.from(new Set(visibleTops.map((top) => Math.round(top * 10) / 10)));
    const compressedTops = compressTopSamples(roundedTops);

    return {
        firstVisibleAt: firstVisible?.t ?? null,
        lastShimmerAt: lastShimmer?.t ?? null,
        distinctTops: roundedTops,
        compressedTops,
        directionChanges: countDirectionChanges(compressedTops),
    };
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('SmashUp 本地模式 E2E', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_local_reset' });
        await blockAudioRequests(context);
    });

    test('本地模式：派系选择 → 游戏界面加载', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page);

        // 验证游戏界面加载
        await waitForHandArea(page);

        // 验证有手牌
        const handArea = page.getByTestId('su-hand-area');
        const cards = handArea.locator('> div > div');
        await expect(cards.first()).toBeVisible({ timeout: 10000 });
        const cardCount = await cards.count();
        expect(cardCount).toBe(5);

        // 验证基地可见
        const bases = page.locator('.group\\/base');
        const baseCount = await bases.count();
        expect(baseCount).toBeGreaterThanOrEqual(3);

        // 验证结束回合按钮可见（P0 的回合）
        const finishBtn = page.getByRole('button', { name: /Finish Turn|结束回合/i });
        await expect(finishBtn).toBeVisible({ timeout: 5000 });

        await page.screenshot({ path: testInfo.outputPath('local-game-loaded.png') });
    });

    test('本地模式：出牌 → 结束回合 → 回合切换', async ({ page }, testInfo) => {
        await page.goto('/play/smashup?p0=pirates,aliens&p1=ninjas,dinosaurs&seed=24680', {
            waitUntil: 'domcontentloaded',
        });
        await dismissViteOverlay(page);
        await waitForHandArea(page);

        // P0 出第一张牌到第一个基地
        const handArea = page.getByTestId('su-hand-area');
        const firstCard = handArea.locator('> div > div').first();
        await clickHandCard(page, firstCard);
        await page.waitForTimeout(600);

        // 点击第一个基地
        const bases = page.locator('.group\\/base');
        await bases.first().locator('> div').first().click();
        await page.waitForTimeout(1000);

        // 处理可能出现的 Prompt
        const promptOverlay = page.locator('.fixed.inset-0.z-\\[100\\]');
        if (await promptOverlay.isVisible().catch(() => false)) {
            const options = promptOverlay.locator('button:not([disabled])');
            if (await options.first().isVisible().catch(() => false)) {
                await options.first().click();
                await page.waitForTimeout(600);
            }
        }

        // 结束回合
        const finishBtn = page.getByRole('button', { name: /Finish Turn|结束回合/i });
        if (await finishBtn.isVisible().catch(() => false)) {
            await finishBtn.click();
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: testInfo.outputPath('after-play-card.png') });
    });

    test('本地模式：游戏状态正确初始化', async ({ page }, testInfo) => {
        await page.goto('/play/smashup?p0=pirates,aliens&p1=ninjas,dinosaurs&seed=24680', {
            waitUntil: 'domcontentloaded',
        });
        await dismissViteOverlay(page);
        await waitForHandArea(page);

        // 验证游戏界面核心元素
        const handArea = page.getByTestId('su-hand-area');
        await expect(handArea).toBeVisible({ timeout: 5000 });

        // 验证有手牌
        const cards = handArea.locator('> div > div');
        await expect(cards.first()).toBeVisible({ timeout: 5000 });
        const cardCount = await cards.count();
        expect(cardCount).toBe(5);

        // 验证基地可见
        const bases = page.locator('.group\\/base');
        const baseCount = await bases.count();
        expect(baseCount).toBeGreaterThanOrEqual(3);

        // 验证结束回合按钮可见
        const finishBtn = page.getByRole('button', { name: /Finish Turn|结束回合/i });
        await expect(finishBtn).toBeVisible({ timeout: 5000 });

        await page.screenshot({ path: testInfo.outputPath('game-state-initialized.png') });
    });

    test('本地模式：多回合循环正常', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page);
        await waitForHandArea(page);

        // 连续 3 个回合：出牌 → 结束回合
        for (let round = 0; round < 3; round++) {
            const finishBtn = page.getByRole('button', { name: /Finish Turn|结束回合/i });
            const isTurn = await finishBtn.isVisible().catch(() => false);

            if (isTurn) {
                // 直接结束回合（不出牌）
                await finishBtn.click();
                await page.waitForTimeout(1500);

                // 处理弃牌
                const discardHeading = page.getByText(/Too Many Cards|手牌过多/i);
                if (await discardHeading.isVisible().catch(() => false)) {
                    const handCards = page.getByTestId('su-hand-area').locator('> div > div');
                    await handCards.first().click();
                    await page.waitForTimeout(200);
                    const throwBtn = page.getByRole('button', { name: /Throw Away|丢弃并继续/i });
                    if (await throwBtn.isEnabled().catch(() => false)) {
                        await throwBtn.click();
                        await page.waitForTimeout(600);
                    }
                }

                // 处理 Me First
                const meFirstPass = page.getByTestId('me-first-pass-button');
                if (await meFirstPass.isVisible().catch(() => false)) {
                    await meFirstPass.click();
                    await page.waitForTimeout(600);
                }
            }
        }

        // 验证游戏仍在运行（手牌区可见）
        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 5000 });

        await page.screenshot({ path: testInfo.outputPath('after-3-rounds.png') });
    });

    test('本地模式：拖拽出牌会显示拖拽命中 UI，并在松手后真正落到基地', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.addInitScript(() => {
            localStorage.setItem('smashup_interaction_mode', 'drag');
        });

        await game.openTestGame('smashup', {
            p0: 'pirates,aliens',
            p1: 'robots,zombies',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'drag-minion-1', defId: 'pirate_first_mate', type: 'minion' },
                ],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['robots', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => {
            return await page.evaluate(() => localStorage.getItem('smashup_interaction_mode'));
        }).toBe('drag');

        const card = page.locator('[data-card-uid="drag-minion-1"]');
        const base = page.locator('[data-base-index="0"]').first();
        await expect(card).toBeVisible({ timeout: 5000 });
        await expect(base).toBeVisible({ timeout: 5000 });

        const cardBox = await card.boundingBox();
        const baseBox = await base.boundingBox();
        expect(cardBox).not.toBeNull();
        expect(baseBox).not.toBeNull();
        if (!cardBox || !baseBox) {
            throw new Error('无法获取拖拽起点或基地落点的坐标');
        }

        const startX = cardBox.x + cardBox.width / 2;
        const startY = cardBox.y + cardBox.height / 2;
        const targetX = baseBox.x + baseBox.width / 2;
        const targetY = baseBox.y + Math.min(baseBox.height * 0.35, 120);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(targetX, targetY, { steps: 18 });

        await expect(page.getByTestId('su-drag-arrow')).toBeVisible({ timeout: 5000 });
        await game.screenshot('smashup-drag-selection-ui', testInfo);

        await page.mouse.up();

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'drag-minion-1');
            });
        }, { timeout: 5000 }).toBe(true);
        await expect(page.locator('[data-card-uid="drag-minion-1"]')).toHaveCount(0, { timeout: 5000 });

        await game.screenshot('smashup-drag-play-resolved-ui', testInfo);
    });

    test('本地模式：手机横屏下拖拽箭头起点应贴着手牌而不是漂到屏幕中部', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.setViewportSize({ width: 812, height: 375 });
        await page.addInitScript(() => {
            localStorage.setItem('smashup_interaction_mode', 'drag');
        });

        await game.openTestGame('smashup', {
            p0: 'robots,zombies',
            p1: 'pirates,aliens',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 54321,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'mobile-drag-minion-1', defId: 'robot_hoverbot', type: 'minion' },
                ],
                factions: ['robots', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => {
            return await page.evaluate(() => localStorage.getItem('smashup_interaction_mode'));
        }).toBe('drag');

        const card = page.locator('[data-card-uid="mobile-drag-minion-1"]');
        const base = page.locator('[data-base-index="0"]').first();
        await expect(card).toBeVisible({ timeout: 5000 });
        await expect(base).toBeVisible({ timeout: 5000 });

        const cardBox = await card.boundingBox();
        const baseBox = await base.boundingBox();
        expect(cardBox).not.toBeNull();
        expect(baseBox).not.toBeNull();
        if (!cardBox || !baseBox) {
            throw new Error('无法获取移动端拖拽所需的卡牌或基地坐标');
        }

        const startX = cardBox.x + cardBox.width / 2;
        const startY = cardBox.y + cardBox.height * 0.62;
        const targetX = baseBox.x + baseBox.width / 2;
        const targetY = baseBox.y + Math.min(baseBox.height * 0.35, 96);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(targetX, targetY, { steps: 18 });

        const dragArrow = page.getByTestId('su-drag-arrow');
        await expect(dragArrow).toBeVisible({ timeout: 5000 });

        const dragMetrics = await dragArrow.evaluate((node) => {
            const line = node.querySelector('path');
            const d = line?.getAttribute('d') ?? '';
            const match = d.match(/M\s*([0-9.+-]+)\s+([0-9.+-]+)/i);
            return {
                path: d,
                startX: match ? Number.parseFloat(match[1]) : Number.NaN,
                startY: match ? Number.parseFloat(match[2]) : Number.NaN,
            };
        });

        expect(Number.isFinite(dragMetrics.startX), `拖拽箭头路径缺少起点: ${dragMetrics.path}`).toBe(true);
        expect(Number.isFinite(dragMetrics.startY), `拖拽箭头路径缺少起点: ${dragMetrics.path}`).toBe(true);
        expect(
            dragMetrics.startX,
            `移动端拖拽箭头起点 X 应落在手牌附近，当前=${dragMetrics.startX}，卡牌范围=${cardBox.x}-${cardBox.x + cardBox.width}`,
        ).toBeGreaterThanOrEqual(cardBox.x - 24);
        expect(
            dragMetrics.startX,
            `移动端拖拽箭头起点 X 应落在手牌附近，当前=${dragMetrics.startX}，卡牌范围=${cardBox.x}-${cardBox.x + cardBox.width}`,
        ).toBeLessThanOrEqual(cardBox.x + cardBox.width + 24);
        expect(
            dragMetrics.startY,
            `移动端拖拽箭头起点 Y 应落在手牌附近，当前=${dragMetrics.startY}，卡牌范围=${cardBox.y}-${cardBox.y + cardBox.height}`,
        ).toBeGreaterThanOrEqual(cardBox.y - 24);
        expect(
            dragMetrics.startY,
            `移动端拖拽箭头起点 Y 应落在手牌附近，当前=${dragMetrics.startY}，卡牌范围=${cardBox.y}-${cardBox.y + cardBox.height}`,
        ).toBeLessThanOrEqual(cardBox.y + cardBox.height + 24);

        await game.screenshot('smashup-mobile-drag-origin-follows-hand', testInfo);
        await saveEvidenceLocatorScreenshot(dragArrow, 'smashup-mobile-drag-origin-arrow', testInfo);

        await page.mouse.up();

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'mobile-drag-minion-1');
            });
        }, { timeout: 5000 }).toBe(true);
    });

    test('本地模式：悬浮球设置面板显示 Smash Up 偏好设置', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.addInitScript(() => {
            localStorage.setItem('smashup_interaction_mode', 'drag');
            localStorage.setItem('smashup_overlay_zh_enabled', 'true');
            localStorage.setItem('hud_fab_position', JSON.stringify({
                leftPercent: 0.82,
                topPercent: 0.66,
            }));
        });

        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page);
        await waitForHandArea(page);

        const settingsPanel = await openFabSettingsPanel(page);
        await expect(settingsPanel.getByText(/大杀四方|Smash Up/i)).toBeVisible({ timeout: 5000 });
        await expect(settingsPanel.getByText(/交互模式|Interaction mode/i)).toBeVisible();
        await expect(settingsPanel.getByRole('button', { name: /点击|Click/i })).toBeVisible();
        await expect(settingsPanel.getByRole('button', { name: /拖拽|Drag/i })).toBeVisible();
        await expect(settingsPanel.getByText(/中文覆盖层|Chinese overlay/i)).toBeVisible();
        const overlayButton = settingsPanel.locator('button').filter({ hasText: /中文覆盖层|Chinese overlay/i }).first();
        await expect(overlayButton).toHaveAttribute('aria-pressed', 'true');
        await expect(overlayButton.locator('[aria-hidden="true"]')).toBeVisible();
        const overlayLayout = await overlayButton.evaluate((element) => {
            const button = element as HTMLElement;
            const toggle = button.querySelector('[aria-hidden="true"]') as HTMLElement | null;
            return {
                buttonClientWidth: button.clientWidth,
                buttonScrollWidth: button.scrollWidth,
                toggleWidth: toggle?.getBoundingClientRect().width ?? 0,
                toggleHeight: toggle?.getBoundingClientRect().height ?? 0,
            };
        });
        expect(overlayLayout.buttonScrollWidth, '中文覆盖层按钮不应出现横向溢出').toBeLessThanOrEqual(overlayLayout.buttonClientWidth);
        expect(overlayLayout.toggleWidth, '开启态应显示固定宽度 toggle').toBeGreaterThanOrEqual(40);
        expect(overlayLayout.toggleHeight, 'toggle 高度不应塌缩').toBeGreaterThanOrEqual(20);
        await expect.poll(async () => {
            return await page.evaluate(() => localStorage.getItem('smashup_interaction_mode'));
        }).toBe('drag');

        await game.screenshot('smashup-settings-panel-open', testInfo);
        await saveEvidenceLocatorScreenshot(settingsPanel, 'smashup-settings-preference-detail', testInfo);
    });

    test('本地模式：首个随从进入基地时分数条应平滑下移而不是单帧跳变', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await game.openTestGame('smashup', {
            p0: 'pirates,aliens',
            p1: 'robots,zombies',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'first-minion-motion-card', defId: 'pirate_first_mate', type: 'minion' },
                ],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['robots', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        const playerColumn = page.getByTestId('su-base-player-column-0-0');
        const emptySlot = page.getByTestId('su-base-empty-slot-0-0');
        const scoreBadge = page.getByTestId('su-base-score-0-0');
        await expect(playerColumn).toBeVisible({ timeout: 10000 });
        await expect(scoreBadge).toBeVisible({ timeout: 10000 });
        await expect(emptySlot).toBeVisible({ timeout: 10000 });
        await saveEvidenceLocatorScreenshot(playerColumn, 'smashup-first-minion-layout-before', testInfo);

        const motion = await captureLayoutMotionDuringMinionPlay(page, {
            selector: '[data-testid="su-base-score-0-0"]',
            cardUid: 'first-minion-motion-card',
            baseIndex: 0,
        });

        expect(motion.found, '未找到首列分数条观测点').toBe(true);
        expect(motion.dispatched, '未成功触发首个随从打出命令').toBe(true);
        expect(motion.dispatchError, `首个随从打出命令执行失败: ${motion.dispatchError}`).toBeNull();

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'first-minion-motion-card');
            });
        }, { timeout: 5000 }).toBe(true);

        await expect(page.locator('[data-minion-uid="first-minion-motion-card"]')).toBeVisible({ timeout: 5000 });
        await expect(emptySlot).toHaveCount(0);

        const sampledTops = motion.samples.map((sample) => Math.round(sample.top * 10) / 10);
        const distinctTops = Array.from(new Set(sampledTops));
        const intermediateTops = distinctTops.slice(1, -1);
        const totalTravel = Math.abs(distinctTops[distinctTops.length - 1] - distinctTops[0]);

        expect(motion.samples.length, '分数条采样帧数过少，无法判断是否发生平滑动画').toBeGreaterThanOrEqual(8);
        expect(totalTravel, '首个随从进入后分数条应发生可见位移').toBeGreaterThan(4);
        expect(
            intermediateTops.length,
            `期望分数条出现至少两个中间位置，实际采样序列: ${distinctTops.join(', ')}`,
        ).toBeGreaterThanOrEqual(2);

        console.log('[smashup-first-minion-layout-motion]', JSON.stringify({
            sampleCount: motion.samples.length,
            distinctTops,
            totalTravel,
        }));

        await saveEvidenceLocatorScreenshot(playerColumn, 'smashup-first-minion-layout-after', testInfo);
    });

    test('本地模式：自己与对手打出随从时都只应出现一次入场动画，不应像开头那样反复播放', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page);
        await waitForHandArea(page);

        const buildScene = async () => {
            await game.setupScene({
                gameId: 'smashup',
                player0: {
                    hand: [
                        { uid: 'self-minion-entry-card', defId: 'pirate_first_mate', type: 'minion' },
                    ],
                    factions: ['pirates', 'aliens'],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
                player1: {
                    hand: [
                        { uid: 'opponent-minion-entry-card', defId: 'robot_microbot_alpha', type: 'minion' },
                    ],
                    factions: ['robots', 'zombies'],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
                bases: [
                    { defId: 'base_the_homeworld' },
                ],
                currentPlayer: '0',
                phase: 'playCards',
            });
            await expect(page.getByTestId('su-base-player-column-0-0')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('su-base-player-column-0-1')).toBeVisible({ timeout: 10000 });
        };

        await buildScene();
        const selfTimeline = await captureMinionEntryTimeline(page, {
            cardUid: 'self-minion-entry-card',
            baseIndex: 0,
            playerId: '0',
        });

        expect(selfTimeline.dispatched, '自己打出随从的诊断命令未触发').toBe(true);
        expect(selfTimeline.dispatchError, `自己打出随从失败: ${selfTimeline.dispatchError}`).toBeNull();
        await expect(page.locator('[data-minion-uid="self-minion-entry-card"]')).toBeVisible({ timeout: 5000 });
        await saveEvidenceLocatorScreenshot(
            page.getByTestId('su-base-player-column-0-0'),
            'smashup-self-minion-entry-stable',
            testInfo,
        );

        await buildScene();
        const opponentTimeline = await captureMinionEntryTimeline(page, {
            cardUid: 'opponent-minion-entry-card',
            baseIndex: 0,
            playerId: '1',
        });

        expect(opponentTimeline.dispatched, '对手打出随从的诊断命令未触发').toBe(true);
        expect(opponentTimeline.dispatchError, `对手打出随从失败: ${opponentTimeline.dispatchError}`).toBeNull();
        await expect(page.locator('[data-minion-uid="opponent-minion-entry-card"]')).toBeVisible({ timeout: 5000 });
        await saveEvidenceLocatorScreenshot(
            page.getByTestId('su-base-player-column-0-1'),
            'smashup-opponent-minion-entry-stable',
            testInfo,
        );

        const selfSummary = summarizeEntryTimeline(selfTimeline);
        const opponentSummary = summarizeEntryTimeline(opponentTimeline);

        expect(selfSummary.firstVisibleAt, '自己打出的随从应快速进入可见态').not.toBeNull();
        expect(opponentSummary.firstVisibleAt, '对手打出的随从也应快速进入可见态').not.toBeNull();
        expect(selfSummary.lastShimmerAt, '自己打出的随从不应残留 atlas shimmer').toBeNull();
        expect(opponentSummary.lastShimmerAt, '对手打出的随从不应残留 atlas shimmer').toBeNull();
        expect(selfSummary.directionChanges, `自己打出的入场轨迹出现过多方向反转: ${selfSummary.compressedTops.join(', ')}`).toBeLessThanOrEqual(1);
        expect(opponentSummary.directionChanges, `对手打出的入场轨迹出现过多方向反转: ${opponentSummary.compressedTops.join(', ')}`).toBeLessThanOrEqual(1);
        expect(selfSummary.compressedTops.length, `自己打出的随从轨迹采样不足: ${selfSummary.distinctTops.join(', ')}`).toBeGreaterThanOrEqual(3);
        expect(opponentSummary.compressedTops.length, `对手打出的随从轨迹采样不足: ${opponentSummary.distinctTops.join(', ')}`).toBeGreaterThanOrEqual(3);

        console.log('[smashup-minion-entry-diagnostic]', JSON.stringify({
            self: selfSummary,
            opponent: opponentSummary,
        }));
    });

    test('本地模式：默认模式下点击随从会进入部署选择，点击基地后才真正打出', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.addInitScript(() => {
            localStorage.setItem('smashup_interaction_mode', 'click');
        });

        await game.openTestGame('smashup', {
            p0: 'pirates,aliens',
            p1: 'robots,zombies',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'click-preview-card', defId: 'pirate_first_mate', type: 'minion' },
                ],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['robots', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        const card = page.locator('[data-card-uid="click-preview-card"]');
        const cardFrame = card.locator('> div').first();
        const firstBase = page.locator('[data-base-index="0"]').first();
        await expect(card).toBeVisible({ timeout: 10000 });
        await clickHandCard(page, card);

        await expect(cardFrame).toHaveClass(/ring-purple-400/);
        await game.screenshot('smashup-click-mode-selection-state', testInfo);
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    baseMinionCount: state.core.bases[0].minions.length,
                    minionsPlayed: state.core.players['0'].minionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'click-preview-card'),
                };
            });
        }).toEqual({
            baseMinionCount: 0,
            minionsPlayed: 0,
            stillInHand: true,
        });

        await firstBase.click({ force: true });
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    playedToBase: state.core.bases[0].minions.some((minion: { uid: string }) => minion.uid === 'click-preview-card'),
                    minionsPlayed: state.core.players['0'].minionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'click-preview-card'),
                };
            });
        }).toEqual({
            playedToBase: true,
            minionsPlayed: 1,
            stillInHand: false,
        });

        await game.screenshot('smashup-click-minion-select-then-deploy', testInfo);
    });

    test('本地模式：手机横屏保留常驻放大按钮，点击按钮只放大不触发出牌', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.setViewportSize({ width: 812, height: 375 });
        await page.addInitScript(() => {
            (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;
            localStorage.setItem('smashup_interaction_mode', 'click');
        });

        await game.openTestGame('smashup', {
            p0: 'pirates,aliens',
            p1: 'robots,zombies',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'mobile-inspect-card', defId: 'pirate_first_mate', type: 'minion' },
                ],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['robots', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        const card = page.locator('[data-card-uid="mobile-inspect-card"]');
        const inspectButton = page.locator('[data-testid="su-hand-card-inspect-mobile-inspect-card"]');
        const magnifyOverlay = page.getByTestId('su-card-magnify-overlay');

        await expect(card).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => {
            return await page.evaluate(() => {
                return (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ === true;
            });
        }).toBe(true);
        await expect(inspectButton).toBeVisible({ timeout: 5000 });
        await expect(inspectButton).toHaveCSS('opacity', '1');

        await inspectButton.click();
        await expect(magnifyOverlay).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    baseMinionCount: state.core.bases[0].minions.length,
                    minionsPlayed: state.core.players['0'].minionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'mobile-inspect-card'),
                };
            });
        }).toEqual({
            baseMinionCount: 0,
            minionsPlayed: 0,
            stillInHand: true,
        });

        await game.screenshot('smashup-mobile-inspect-button-preview', testInfo);
    });

    test('本地模式：拖拽模式下无目标行动卡拖到场上才会释放', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.addInitScript(() => {
            localStorage.setItem('smashup_interaction_mode', 'drag');
        });

        await game.openTestGame('smashup', {
            p0: 'dinosaurs,pirates',
            p1: 'robots,zombies',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'drag-action-card', defId: 'dino_howl', type: 'action' },
                ],
                factions: ['dinosaurs', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['robots', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'ally-1', defId: 'pirate_first_mate', owner: '0', controller: '0' },
                    ],
                },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await expect.poll(async () => {
            return await page.evaluate(() => localStorage.getItem('smashup_interaction_mode'));
        }).toBe('drag');

        const card = page.locator('[data-card-uid="drag-action-card"]');
        const handArea = page.getByTestId('su-hand-area');
        await expect(card).toBeVisible({ timeout: 10000 });
        await expect(handArea).toBeVisible({ timeout: 10000 });

        const cardBox = await card.boundingBox();
        const handAreaBox = await handArea.boundingBox();
        expect(cardBox).not.toBeNull();
        expect(handAreaBox).not.toBeNull();
        if (!cardBox || !handAreaBox) {
            throw new Error('无法获取行动卡或手牌区坐标');
        }

        const startX = cardBox.x + cardBox.width / 2;
        const startY = cardBox.y + cardBox.height / 2;
        const targetY = Math.max(40, handAreaBox.y - 120);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, targetY, { steps: 18 });

        await expect(page.getByTestId('su-drag-arrow')).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    actionsPlayed: state.core.players['0'].actionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'drag-action-card'),
                };
            });
        }).toEqual({
            actionsPlayed: 0,
            stillInHand: true,
        });

        await page.mouse.up();

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                const ally = state.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'ally-1');
                return {
                    actionsPlayed: state.core.players['0'].actionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'drag-action-card'),
                    allyTempPowerModifier: ally?.tempPowerModifier ?? 0,
                };
            });
        }).toEqual({
            actionsPlayed: 1,
            stillInHand: false,
            allyTempPowerModifier: 1,
        });

        await game.screenshot('smashup-drag-action-release-to-board', testInfo);
    });

    test('本地模式：手牌额外交互应保持点击选择，正常拖拽箭头曲线应可见且更平顺', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.addInitScript(() => {
            localStorage.setItem('smashup_interaction_mode', 'drag');
        });

        await game.openTestGame('smashup', {
            p0: 'aliens,zombies',
            p1: 'ninjas,robots',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'prompt-extra-minion-1', defId: 'alien_invader', type: 'minion' },
                    { uid: 'prompt-extra-minion-2', defId: 'zombie_walker', type: 'minion' },
                ],
                factions: ['aliens', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['ninjas', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await expect.poll(async () => {
            return await page.evaluate(() => localStorage.getItem('smashup_interaction_mode'));
        }).toBe('drag');

        await page.evaluate(() => {
            const harness = window.__BG_TEST_HARNESS__;
            if (!harness?.state?.patch) {
                throw new Error('TestHarness state.patch 不可用');
            }
            return harness.state.patch({
                'sys.interaction.current': {
                    id: 'e2e-extra-minion-choice',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '选择要额外打出的随从',
                        sourceId: 'e2e_extra_minion_choice',
                        targetType: 'hand',
                        options: [
                            { id: 'extra-minion-1', label: '外星侵略者', value: { cardUid: 'prompt-extra-minion-1' } },
                            { id: 'extra-minion-2', label: '僵尸步兵', value: { cardUid: 'prompt-extra-minion-2' } },
                            { id: 'skip-extra', label: '跳过', value: { skip: true }, displayMode: 'button' },
                        ],
                    },
                },
                'sys.interaction.queue': [],
                'sys.interaction.isBlocked': false,
            });
        });

        const promptCard = page.locator('[data-card-uid="prompt-extra-minion-1"]');
        await expect(promptCard).toBeVisible({ timeout: 10000 });

        const promptCursor = await promptCard.evaluate((node) => window.getComputedStyle(node as HTMLElement).cursor);
        expect(promptCursor).not.toContain('grab');

        const promptBox = await promptCard.boundingBox();
        expect(promptBox).not.toBeNull();
        if (!promptBox) {
            throw new Error('无法获取额外随从交互卡牌坐标');
        }

        await page.mouse.move(promptBox.x + promptBox.width / 2, promptBox.y + promptBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(promptBox.x + promptBox.width / 2 + 100, promptBox.y + promptBox.height / 2 - 80, { steps: 12 });
        await page.waitForTimeout(250);
        await expect(page.getByTestId('su-drag-arrow')).toHaveCount(0);
        await page.mouse.up();

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    interactionId: state.sys.interaction?.current?.id ?? null,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'prompt-extra-minion-1'),
                    minionsPlayed: state.core.players['0'].minionsPlayed,
                };
            });
        }).toEqual({
            interactionId: 'e2e-extra-minion-choice',
            stillInHand: true,
            minionsPlayed: 0,
        });

        await game.screenshot('smashup-drag-prompt-click-mode', testInfo);

        await page.evaluate(() => {
            const harness = window.__BG_TEST_HARNESS__;
            if (!harness?.state?.patch) {
                throw new Error('TestHarness state.patch 不可用');
            }
            return harness.state.patch({
                'sys.interaction.current': {
                    id: 'e2e-base-choice',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '选择一个基地',
                        sourceId: 'e2e_base_choice',
                        targetType: 'base',
                        options: [
                            { id: 'base-0', label: '基地 0', value: { baseIndex: 0 } },
                            { id: 'base-1', label: '基地 1', value: { baseIndex: 1 } },
                            { id: 'skip-base', label: '跳过', value: { skip: true }, displayMode: 'button' },
                        ],
                    },
                },
            });
        });

        const boardPromptCard = page.locator('[data-card-uid="prompt-extra-minion-1"]');
        const base = page.locator('[data-base-index="0"]');
        await expect(boardPromptCard).toBeVisible({ timeout: 5000 });
        await expect(base).toBeVisible({ timeout: 5000 });

        const boardPromptCursor = await boardPromptCard.evaluate((node) => window.getComputedStyle(node as HTMLElement).cursor);
        expect(boardPromptCursor).not.toContain('grab');

        const cardBox = await boardPromptCard.boundingBox();
        const baseBox = await base.boundingBox();
        expect(cardBox).not.toBeNull();
        expect(baseBox).not.toBeNull();
        if (!cardBox || !baseBox) {
            throw new Error('无法获取正常拖拽场景坐标');
        }

        await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(baseBox.x + baseBox.width / 2, baseBox.y + baseBox.height / 2, { steps: 20 });
        await page.waitForTimeout(250);
        await expect(page.getByTestId('su-drag-arrow')).toHaveCount(0);
        await page.mouse.up();

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    interactionId: state.sys.interaction?.current?.id ?? null,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'prompt-extra-minion-1'),
                    baseMinionCount: state.core.bases[0].minions.length,
                };
            });
        }).toEqual({
            interactionId: 'e2e-base-choice',
            stillInHand: true,
            baseMinionCount: 0,
        });

        await game.screenshot('smashup-drag-board-prompt-lock-mode', testInfo);

        await page.evaluate(() => {
            const harness = window.__BG_TEST_HARNESS__;
            if (!harness?.state?.patch) {
                throw new Error('TestHarness state.patch 不可用');
            }
            return harness.state.patch({
                'sys.interaction.current': null,
            });
        });

        const normalDragCard = page.locator('[data-card-uid="prompt-extra-minion-1"]');
        await expect(normalDragCard).toBeVisible({ timeout: 5000 });

        const normalCardBox = await normalDragCard.boundingBox();
        expect(normalCardBox).not.toBeNull();
        if (!normalCardBox || !baseBox) {
            throw new Error('无法获取正常拖拽场景坐标');
        }

        await page.mouse.move(normalCardBox.x + normalCardBox.width / 2, normalCardBox.y + normalCardBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(baseBox.x + baseBox.width / 2, baseBox.y + baseBox.height / 2, { steps: 20 });
        const dragArrow = page.getByTestId('su-drag-arrow');
        await expect(dragArrow).toBeVisible({ timeout: 5000 });

        const dragCurveMetrics = await dragArrow.evaluate((node) => {
            const line = node.querySelector('path');
            const path = line?.getAttribute('d') ?? '';
            const match = path.match(
                /M\s*([0-9.+-]+)\s+([0-9.+-]+)\s+C\s*([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)/i,
            );
            if (!match) return null;

            const values = match.slice(1).map((value) => Number.parseFloat(value));
            const [startX, startY, control1X, control1Y, control2X, control2Y, endX, endY] = values;
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const lineLength = Math.hypot(deltaX, deltaY) || 1;
            const signedOffset = (pointX: number, pointY: number) => (
                ((pointX - startX) * deltaY - (pointY - startY) * deltaX) / lineLength
            );
            const progress = (pointX: number, pointY: number) => (
                ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / (lineLength * lineLength)
            );

            return {
                path,
                control1Offset: signedOffset(control1X, control1Y),
                control2Offset: signedOffset(control2X, control2Y),
                control1Progress: progress(control1X, control1Y),
                control2Progress: progress(control2X, control2Y),
            };
        });

        expect(dragCurveMetrics, '拖拽箭头路径应保持三次贝塞尔曲线').not.toBeNull();
        if (!dragCurveMetrics) {
            throw new Error('无法解析拖拽箭头路径');
        }

        expect(
            Math.abs(dragCurveMetrics.control1Offset),
            `拖拽箭头第一控制点抬升过小，路径=${dragCurveMetrics.path}`,
        ).toBeGreaterThan(16);
        expect(
            Math.abs(dragCurveMetrics.control2Offset),
            `拖拽箭头第二控制点不应塌成近似直线，路径=${dragCurveMetrics.path}`,
        ).toBeGreaterThan(8);
        expect(
            Math.sign(dragCurveMetrics.control1Offset),
            `拖拽箭头两段控制点必须位于同一侧，避免再次出现折返感，路径=${dragCurveMetrics.path}`,
        ).toBe(Math.sign(dragCurveMetrics.control2Offset));
        expect(
            Math.abs(dragCurveMetrics.control1Offset),
            `拖拽箭头尾段弧度不应反超前段，避免再次出现“前鼓后折”，路径=${dragCurveMetrics.path}`,
        ).toBeGreaterThanOrEqual(Math.abs(dragCurveMetrics.control2Offset));
        expect(dragCurveMetrics.control1Progress).toBeGreaterThan(0.1);
        expect(dragCurveMetrics.control1Progress).toBeLessThan(0.45);
        expect(dragCurveMetrics.control2Progress).toBeGreaterThan(0.55);
        expect(dragCurveMetrics.control2Progress).toBeLessThan(0.95);

        await game.screenshot('smashup-drag-arrow-curve-optimized', testInfo);
        await saveEvidenceLocatorScreenshot(dragArrow, 'smashup-drag-arrow-curve-optimized-arrow', testInfo);

        await page.mouse.up();

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    minionsPlayed: state.core.players['0'].minionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'prompt-extra-minion-1'),
                    baseMinionCount: state.core.bases[0].minions.length,
                };
            });
        }).toEqual({
            minionsPlayed: 1,
            stillInHand: false,
            baseMinionCount: 1,
        });
    });

    test('本地模式：默认模式下无目标行动卡需要二次点击确认', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.addInitScript(() => {
            localStorage.setItem('smashup_interaction_mode', 'click');
        });

        await game.openTestGame('smashup', {
            p0: 'pirates,aliens',
            p1: 'robots,zombies',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'double-click-action-card', defId: 'dino_howl', type: 'action' },
                ],
                factions: ['dinosaurs', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['robots', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'ally-1', defId: 'pirate_first_mate', owner: '0', controller: '0' },
                    ],
                },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        const card = page.locator('[data-card-uid="double-click-action-card"]');
        const cardFrame = card.locator('> div').first();
        await expect(card).toBeVisible({ timeout: 10000 });
        await clickHandCard(page, card);

        await expect(cardFrame).toHaveClass(/ring-purple-400/);
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    actionsPlayed: state.core.players['0'].actionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'double-click-action-card'),
                    allyTempPowerModifier: state.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'ally-1')?.tempPowerModifier ?? 0,
                };
            });
        }, { timeout: 5000 }).toEqual({
            actionsPlayed: 0,
            stillInHand: true,
            allyTempPowerModifier: 0,
        });

        await clickHandCard(page, card);

        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    actionsPlayed: state.core.players['0'].actionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'double-click-action-card'),
                    allyTempPowerModifier: state.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'ally-1')?.tempPowerModifier ?? 0,
                };
            });
        }, { timeout: 5000 }).toEqual({
            actionsPlayed: 1,
            stillInHand: false,
            allyTempPowerModifier: 1,
        });

        await game.screenshot('smashup-click-action-double-confirm', testInfo);
    });

    test('本地模式：无有效目标的无目标行动卡第一次点击就提示并且不会选中使用', async ({ page }, testInfo) => {
        const game = new GameTestContext(page);

        await page.addInitScript(() => {
            localStorage.setItem('smashup_interaction_mode', 'click');
        });

        await game.openTestGame('smashup', {
            p0: 'pirates,aliens',
            p1: 'robots,zombies',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'no-target-toast-action-card', defId: 'dino_howl', type: 'action' },
                ],
                factions: ['dinosaurs', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                factions: ['robots', 'zombies'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'enemy-1', defId: 'robot_microbot_alpha', owner: '1', controller: '1' },
                    ],
                },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        const card = page.locator('[data-card-uid="no-target-toast-action-card"]');
        const cardFrame = card.locator('> div').first();
        const toastMessage = page.getByText('场上没有符合条件的目标').last();

        await expect(card).toBeVisible({ timeout: 10000 });
        await clickHandCard(page, card);

        await expect(toastMessage).toBeVisible({ timeout: 5000 });
        await expect(cardFrame).not.toHaveClass(/ring-purple-400/);
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.get();
                return {
                    actionsPlayed: state.core.players['0'].actionsPlayed,
                    stillInHand: state.core.players['0'].hand.some((entry: { uid: string }) => entry.uid === 'no-target-toast-action-card'),
                    enemyTempPowerModifier: state.core.bases[0].minions.find((minion: { uid: string }) => minion.uid === 'enemy-1')?.tempPowerModifier ?? 0,
                };
            });
        }, { timeout: 5000 }).toEqual({
            actionsPlayed: 0,
            stillInHand: true,
            enemyTempPowerModifier: 0,
        });

        await game.screenshot('smashup-click-action-no-target-toast', testInfo);
    });
});
