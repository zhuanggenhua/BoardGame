import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { test, expect } from './framework';
import {
    ensureGameServerAvailable,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForMatchAvailable,
} from './helpers/common';

const SPLENDOR_GAME_NAME = 'splendor';
const SPLENDOR_EVIDENCE_DIR = join(process.cwd(), 'test-results', 'evidence-screenshots');

function getEvidenceScreenshotPath(filename: string) {
    mkdirSync(SPLENDOR_EVIDENCE_DIR, { recursive: true });
    return join(SPLENDOR_EVIDENCE_DIR, filename);
}

async function createSplendorRoomViaAPI(page: Page, guestId?: string): Promise<string | null> {
    try {
        const actualGuestId = guestId ?? `splendor_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const response = await page.request.post(`/games/${SPLENDOR_GAME_NAME}/create`, {
            data: { numPlayers: 2, setupData: { guestId: actualGuestId } },
        });
        if (!response.ok()) return null;
        const data = (await response.json().catch(() => null)) as { matchID?: string } | null;
        return data?.matchID ?? null;
    } catch {
        return null;
    }
}

async function createSplendorRoomViaUI(page: Page, startingPlayerId: string): Promise<string | null> {
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.getByRole('heading', { name: /Splendor|璀璨宝石/i }).click();
    await page.getByRole('button', { name: /Create Room|创建房间/i }).click();
    await expect(page.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible({ timeout: 10000 });
    await page.getByTestId('create-room-setup-startingPlayerId').selectOption(startingPlayerId);
    await page.getByRole('button', { name: /Confirm|确认/i }).click();

    try {
        await page.waitForURL(/\/play\/splendor\/match\//, { timeout: 15000 });
    } catch {
        return null;
    }

    return new URL(page.url()).pathname.split('/').pop() ?? null;
}

async function setupSplendorOnlineMatch(browser: Browser, baseURL: string | undefined) {
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__splendor_storage_reset_host', skipTutorial: false });
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) return null;

    const hostGuestId = `splendor_host_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const matchId = await createSplendorRoomViaAPI(hostPage, hostGuestId);
    if (!matchId) return null;

    const hostCredentials = await joinMatchViaAPI(hostPage, SPLENDOR_GAME_NAME, matchId, '0', `Host-${Date.now()}`, hostGuestId);
    if (!hostCredentials) return null;

    await seedMatchCredentials(hostContext, SPLENDOR_GAME_NAME, matchId, '0', hostCredentials);
    if (!(await waitForMatchAvailable(hostPage, SPLENDOR_GAME_NAME, matchId, 20000))) return null;
    await hostPage.goto(`/play/${SPLENDOR_GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

    const guestContext = await browser.newContext({ baseURL });
    await initContext(guestContext, { storageKey: '__splendor_storage_reset_guest', skipTutorial: false });
    const guestPage = await guestContext.newPage();
    await guestPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});

    const guestGuestId = `splendor_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const guestCredentials = await joinMatchViaAPI(guestPage, SPLENDOR_GAME_NAME, matchId, '1', `Guest-${Date.now()}`, guestGuestId);
    if (!guestCredentials) return null;

    await seedMatchCredentials(guestContext, SPLENDOR_GAME_NAME, matchId, '1', guestCredentials);
    await guestPage.goto(`/play/${SPLENDOR_GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
    await hostPage.reload({ waitUntil: 'domcontentloaded' });
    await guestPage.reload({ waitUntil: 'domcontentloaded' });

    return { hostContext, guestContext, hostPage, guestPage, matchId };
}

async function setupSplendorOnlineMatchViaUI(
    browser: Browser,
    baseURL: string | undefined,
    startingPlayerId: '0' | '1',
) {
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__splendor_storage_reset_host_ui', skipTutorial: false });
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) return null;

    const matchId = await createSplendorRoomViaUI(hostPage, startingPlayerId);
    if (!matchId) return null;
    if (!(await waitForMatchAvailable(hostPage, SPLENDOR_GAME_NAME, matchId, 20000))) return null;

    const guestContext = await browser.newContext({ baseURL });
    await initContext(guestContext, { storageKey: '__splendor_storage_reset_guest_ui', skipTutorial: false });
    const guestPage = await guestContext.newPage();
    await guestPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});

    const guestGuestId = `splendor_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const guestName = `Guest-${Date.now()}`;
    const guestCredentials = await joinMatchViaAPI(guestPage, SPLENDOR_GAME_NAME, matchId, '1', guestName, guestGuestId);
    if (!guestCredentials) return null;

    await seedMatchCredentials(guestContext, SPLENDOR_GAME_NAME, matchId, '1', guestCredentials);
    await guestPage.goto(`/play/${SPLENDOR_GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
    await hostPage.reload({ waitUntil: 'domcontentloaded' });
    await guestPage.reload({ waitUntil: 'domcontentloaded' });

    return { hostContext, guestContext, hostPage, guestPage, matchId, guestName };
}

test.describe('Splendor E2E', () => {
    test('Splendor：可通过 setupScene 购买公开牌并推进回合', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/splendor');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 20000, polling: 200 },
        );

        const initialState = await game.getState();

        await game.setupScene({
            gameId: 'splendor',
            player0: {
                tokens: {
                    blue: 1,
                    green: 1,
                    red: 1,
                    black: 1,
                },
            },
            player1: {},
            currentPlayer: '0',
            extra: {
                core: {
                    hostStarted: true,
                    market: {
                        ...initialState.core.market,
                        1: ['t1-white-1', 't1-blue-1', 't1-green-1', 't1-red-1'],
                    },
                    decks: {
                        ...initialState.core.decks,
                        1: [],
                    },
                    pendingResolution: undefined,
                    endgame: { triggered: false },
                    gameResult: undefined,
                },
            },
        });

        await expect(page.getByTestId('splendor-buy-t1-white-1')).toBeVisible({ timeout: 5000 });
        await game.screenshot('splendor-buy-open-before', testInfo);

        await page.getByTestId('splendor-buy-t1-white-1').click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                currentPlayer: state.core.currentPlayer,
                purchased: state.core.players['0'].purchasedCardIds,
                market: state.core.market[1],
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayer: '1',
            purchased: ['t1-white-1'],
            market: ['t1-blue-1', 't1-green-1', 't1-red-1'],
        });

        await expect(page.getByTestId('splendor-action-log-row').first()).toContainText('Guest 1');
        await expect(page.getByTestId('splendor-action-log-row').first()).toContainText('spends');
        await expect(page.getByTestId('splendor-action-log-row').first()).toContainText('I-1');

        await game.screenshot('splendor-buy-open-after', testInfo);
    });

    test('Splendor：可通过前端交互保留公开牌并自动补牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/splendor');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 20000, polling: 200 },
        );

        const initialState = await game.getState();
        const refillCard = initialState.core.decks[1][0];

        await game.setupScene({
            gameId: 'splendor',
            player0: {},
            player1: {},
            currentPlayer: '0',
            extra: {
                core: {
                    hostStarted: true,
                    market: {
                        ...initialState.core.market,
                        1: ['t1-white-1', 't1-blue-1', 't1-green-1', 't1-red-1'],
                    },
                    decks: {
                        ...initialState.core.decks,
                        1: [refillCard],
                    },
                    pendingResolution: undefined,
                    endgame: { triggered: false },
                    gameResult: undefined,
                },
            },
        });

        await expect(page.getByTestId('splendor-reserve-t1-white-1')).toBeVisible({ timeout: 5000 });
        await game.screenshot('splendor-reserve-open-before', testInfo);

        await page.getByTestId('splendor-reserve-t1-white-1').click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                currentPlayer: state.core.currentPlayer,
                reserved: state.core.players['0'].reservedCardIds,
                gold: state.core.players['0'].tokens.gold,
                market: state.core.market[1],
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayer: '1',
            reserved: ['t1-white-1'],
            gold: 1,
            market: ['t1-blue-1', 't1-green-1', 't1-red-1', refillCard],
        });

        await game.screenshot('splendor-reserve-open-after', testInfo);
    });

    test('Splendor：可通过前端交互保留牌库顶牌并获得黄金', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/splendor');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 20000, polling: 200 },
        );

        const initialState = await game.getState();
        const topCard = initialState.core.decks[1][0];

        await game.setupScene({
            gameId: 'splendor',
            player0: {},
            player1: {},
            currentPlayer: '0',
            extra: {
                core: {
                    hostStarted: true,
                    decks: {
                        ...initialState.core.decks,
                        1: [topCard],
                    },
                    pendingResolution: undefined,
                    endgame: { triggered: false },
                    gameResult: undefined,
                },
            },
        });

        const tierOneDeck = page.locator('[data-tutorial-id="sp-market-tier-1"]').first();
        await tierOneDeck.hover();
        await expect(page.getByTestId('splendor-reserve-deck-top-1')).toBeVisible({ timeout: 5000 });

        await game.screenshot('splendor-reserve-deck-top-before', testInfo);

        await page.getByTestId('splendor-reserve-deck-top-1').click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                currentPlayer: state.core.currentPlayer,
                reserved: state.core.players['0'].reservedCardIds,
                gold: state.core.players['0'].tokens.gold,
                tier1DeckCount: state.core.decks[1].length,
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayer: '1',
            reserved: [topCard],
            gold: 1,
            tier1DeckCount: 0,
        });

        await game.screenshot('splendor-reserve-deck-top-after', testInfo);
    });

    test('Splendor：可通过前端交互购买自己的保留牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/splendor');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 20000, polling: 200 },
        );

        await game.setupScene({
            gameId: 'splendor',
            player0: {
                tokens: {
                    blue: 1,
                    green: 1,
                    red: 1,
                    black: 1,
                },
                reservedCardIds: ['t1-white-1'],
            },
            player1: {},
            currentPlayer: '0',
            extra: {
                core: {
                    hostStarted: true,
                    pendingResolution: undefined,
                    endgame: { triggered: false },
                    gameResult: undefined,
                },
            },
        });

        await page.locator('button').filter({ hasText: /My Reserved Cards|我的保留牌/i }).click();
        await expect(page.getByTestId('splendor-buy-t1-white-1')).toBeVisible({ timeout: 5000 });

        await game.screenshot('splendor-buy-reserved-before', testInfo);

        await page.getByTestId('splendor-buy-t1-white-1').click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                currentPlayer: state.core.currentPlayer,
                reserved: state.core.players['0'].reservedCardIds,
                purchased: state.core.players['0'].purchasedCardIds,
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayer: '1',
            reserved: [],
            purchased: ['t1-white-1'],
        });

        await game.screenshot('splendor-buy-reserved-after', testInfo);
    });

    test('Splendor：可通过前端交互拿两枚同色宝石', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/splendor');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
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
                    hostStarted: true,
                    bank: {
                        ...initialState.core.bank,
                        white: 4,
                        blue: 0,
                        green: 0,
                        red: 0,
                        black: 0,
                    },
                    pendingResolution: undefined,
                    endgame: { triggered: false },
                    gameResult: undefined,
                },
            },
        });

        await page.getByTestId('splendor-bank-token-white').click();
        await expect(page.getByTestId('splendor-take-two-white')).toBeVisible({ timeout: 5000 });

        await game.screenshot('splendor-take-two-before', testInfo);

        await page.getByTestId('splendor-take-two-white').click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                currentPlayer: state.core.currentPlayer,
                whiteTokens: state.core.players['0'].tokens.white,
                bankWhite: state.core.bank.white,
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayer: '1',
            whiteTokens: 2,
            bankWhite: 2,
        });

        await expect(page.getByTestId('splendor-action-log-row').first()).toContainText(/same color|同色/i);

        await game.screenshot('splendor-take-two-after', testInfo);
    });

    test('Splendor：超过 10 宝石后应进入弃牌流程并在弃到上限后推进回合', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/splendor');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 20000, polling: 200 },
        );

        const initialState = await game.getState();

        await game.setupScene({
            gameId: 'splendor',
            player0: {
                tokens: {
                    white: 2,
                    blue: 2,
                    green: 2,
                    red: 2,
                    black: 2,
                },
            },
            player1: {},
            currentPlayer: '0',
            extra: {
                core: {
                    hostStarted: true,
                    bank: {
                        ...initialState.core.bank,
                        white: 1,
                        blue: 0,
                        green: 0,
                        red: 0,
                        black: 0,
                    },
                    pendingResolution: undefined,
                    endgame: { triggered: false },
                    gameResult: undefined,
                },
            },
        });

        await page.getByTestId('splendor-bank-token-white').click();
        await expect(page.getByTestId('splendor-bank-confirm-different')).toBeEnabled({ timeout: 3000 });
        await page.getByTestId('splendor-bank-confirm-different').click();

        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.pendingResolution?.type ?? null;
        }, { timeout: 10000 }).toBe('discardToLimit');

        await game.screenshot('splendor-discard-pending', testInfo);

        await page.getByTestId('splendor-bank-token-black').click();

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state.core.players['0'];
            const tokenTotal = Object.values(player0.tokens).reduce((sum: number, count: any) => sum + Number(count ?? 0), 0);
            return {
                currentPlayer: state.core.currentPlayer,
                pending: state.core.pendingResolution ?? null,
                tokenTotal,
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayer: '1',
            pending: null,
            tokenTotal: 10,
        });

        await game.screenshot('splendor-discard-resolved', testInfo);
    });

    test('Splendor：映射工具应保留其他查询参数并在清空草稿后回到默认映射', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/dev/slicer?foo=bar');
        await page.getByRole('button', { name: 'Splendor 映射' }).click();

        await expect.poll(() => page.url(), { timeout: 5000 }).toContain('/dev/slicer?foo=bar&mode=splendor-mapping');

        await expect(page.getByTestId('splendor-mapping-frame-grid')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('splendor-mapping-atlas-tier1')).toBeVisible();
        await expect(page.getByTestId('splendor-mapping-atlas-nobles')).toBeVisible();

        await page.getByTestId('splendor-mapping-atlas-nobles').click();
        await page.getByTestId('splendor-mapping-frame-0').click();
        await page.getByTestId('splendor-mapping-model-select').selectOption('noble-2');
        await expect(page.locator('textarea')).toContainText('export const NOBLE_CARD_ORDER');
        await expect(page.locator('textarea')).toContainText("'noble-2'");
        await expect(page.locator('textarea')).toContainText("'noble-1'");

        await expect.poll(async () => {
            const value = await page.locator('textarea').inputValue();
            return value.includes("export const NOBLE_CARD_ORDER = [\n    'noble-2',\n    'noble-1',");
        }, { timeout: 5000 }).toBe(true);

        await page.getByRole('button', { name: '清空本地草稿' }).click();

        await expect.poll(async () => {
            const value = await page.locator('textarea').inputValue();
            return value.includes("export const NOBLE_CARD_ORDER = [\n    'noble-1',\n    'noble-2',");
        }, { timeout: 5000 }).toBe(true);

        await expect.poll(async () => page.evaluate((key) => window.localStorage.getItem(key), 'splendor-sprite-mapping-draft-v1')).toBeNull();

        await page.getByRole('button', { name: '切回切片模式' }).click();
        await expect.poll(() => page.url(), { timeout: 5000 }).toContain('/dev/slicer?foo=bar');
        await expect.poll(() => page.url(), { timeout: 5000 }).not.toContain('mode=splendor-mapping');

        await page.getByRole('button', { name: 'Splendor 映射' }).click();
        await expect.poll(() => page.url(), { timeout: 5000 }).toContain('/dev/slicer?foo=bar&mode=splendor-mapping');

        await page.screenshot({
            path: getEvidenceScreenshotPath('splendor-mapping-tool-query-preserved.png'),
            fullPage: true,
        });
        await game.screenshot('splendor-mapping-tool', testInfo);
    });

    test('Splendor：教程应覆盖购买 贵族与终局说明步骤', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await page.goto('/play/splendor/tutorial');

        const waitStep = async (stepId: string, timeout = 30000) => {
            await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
        };

        const clickNext = async () => {
            await expect(page.getByTestId('tutorial-next-button')).toBeVisible({ timeout: 10000 });
            await page.getByTestId('tutorial-next-button').click();
        };

        await waitStep('intro', 40000);
        for (const stepId of ['intro', 'goal', 'nobles', 'actions', 'market', 'bank', 'bank-confirm']) {
            await waitStep(stepId, 10000);
            await clickNext();
        }

        await waitStep('take-gems-action', 10000);
        await page.getByTestId('splendor-bank-token-white').click();
        await expect(page.getByTestId('splendor-take-two-white')).toBeVisible({ timeout: 5000 });
        await page.getByTestId('splendor-take-two-white').click();

        await waitStep('player-status', 10000);
        await clickNext();

        await waitStep('reserve-action', 10000);
        await clickNext();

        await waitStep('buy-action', 10000);
        await game.screenshot('splendor-tutorial-buy-step', testInfo);
        await clickNext();

        await waitStep('noble-timing', 10000);
        await clickNext();

        await waitStep('token-limit', 10000);
        await clickNext();

        await waitStep('endgame-detail', 10000);
        await game.screenshot('splendor-tutorial-endgame-step', testInfo);
        await clickNext();

        await waitStep('finish', 10000);
    });

    test('Splendor：联机房间在房主开始前不可操作，开始后才可操作', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupSplendorOnlineMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, 'Splendor 联机房间创建失败');
            return;
        }

        const { hostContext, guestContext, hostPage, guestPage } = setup;

        try {
            await expect(hostPage.getByTestId('splendor-start-game')).toBeVisible({ timeout: 15000 });
            await expect(guestPage.getByText('Waiting for the host to start the game', { exact: true })).toBeVisible({ timeout: 15000 });

            const hostWhiteToken = hostPage.getByTestId('splendor-bank-token-white');
            await expect(hostWhiteToken).toBeDisabled();
            await expect(hostPage.getByText('All seats are ready. The host can start the game now.', { exact: true })).toBeVisible();

            await hostPage.screenshot({ path: testInfo.outputPath('splendor-online-before-start.png'), fullPage: true });

            await hostPage.getByTestId('splendor-start-game').click();

            await expect(hostPage.getByTestId('splendor-start-game')).toHaveCount(0, { timeout: 10000 });
            await expect(guestPage.getByText('Waiting for the host to start the game', { exact: true })).toHaveCount(0, { timeout: 10000 });
            await expect(hostWhiteToken).toBeEnabled({ timeout: 10000 });

            await hostPage.getByTestId('splendor-bank-token-white').click();
            await hostPage.getByTestId('splendor-bank-token-blue').click();
            await hostPage.getByTestId('splendor-bank-token-green').click();

            await expect(hostPage.getByText(/Waiting for opponent|等待对手操作/i)).toBeVisible({ timeout: 10000 });
            await expect(guestPage.getByText(/Your turn|轮到你行动/i)).toBeVisible({ timeout: 10000 });

            await hostPage.screenshot({ path: testInfo.outputPath('splendor-online-after-start.png'), fullPage: true });
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('Splendor：建房时选择先手后，联机对局应由指定玩家先行动', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupSplendorOnlineMatchViaUI(browser, baseURL, '1');
        if (!setup) {
            test.skip(true, 'Splendor 联机房间创建失败');
            return;
        }

        const { hostContext, guestContext, hostPage, guestPage, guestName } = setup;

        try {
            await expect(hostPage.getByTestId('splendor-starting-player')).toContainText(guestName, { timeout: 15000 });
            await expect(guestPage.getByTestId('splendor-starting-player')).toContainText(guestName, { timeout: 15000 });

            await hostPage.screenshot({
                path: getEvidenceScreenshotPath('splendor-starting-player-before-start.png'),
                fullPage: true,
            });

            await hostPage.getByTestId('splendor-start-game').click();

            await expect(guestPage.getByText(/Your turn|轮到你行动/i)).toBeVisible({ timeout: 10000 });
            await expect(hostPage.getByText(/Waiting for opponent|等待对手操作/i)).toBeVisible({ timeout: 10000 });
            await expect(guestPage.getByTestId('splendor-bank-token-white')).toBeEnabled({ timeout: 10000 });
            await expect(hostPage.getByTestId('splendor-bank-token-white')).toBeDisabled();

            await guestPage.screenshot({
                path: getEvidenceScreenshotPath('splendor-starting-player-after-start.png'),
                fullPage: true,
            });
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('Splendor：多贵族选择应只获得一个贵族并清除待处理状态', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/splendor');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 20000, polling: 200 },
        );

        await game.setupScene({
            gameId: 'splendor',
            player0: {},
            player1: {},
            currentPlayer: '0',
            extra: {
                core: {
                    hostStarted: true,
                    nobleIds: ['noble-1', 'noble-3'],
                    pendingResolution: {
                        type: 'chooseNoble',
                        nobleIds: ['noble-1', 'noble-3'],
                    },
                },
            },
        });

        await expect(page.getByTestId('splendor-choose-noble-noble-1')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('splendor-choose-noble-noble-3')).toBeVisible({ timeout: 10000 });

        await game.screenshot('splendor-choose-noble-pending', testInfo);

        await page.getByTestId('splendor-choose-noble-noble-1').click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                pending: state.core.pendingResolution ?? null,
                nobleIds: state.core.players['0'].nobleIds,
                marketNobles: state.core.nobleIds,
                currentPlayer: state.core.currentPlayer,
            };
        }, { timeout: 10000 }).toEqual({
            pending: null,
            nobleIds: ['noble-1'],
            marketNobles: ['noble-3'],
            currentPlayer: '1',
        });

        await game.screenshot('splendor-choose-noble-resolved', testInfo);
    });
});
