import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    dismissLobbyConfirmIfNeeded,
    dismissViteOverlay,
    ensureGameServerAvailable,
    initContext,
    joinMatchViaAPI,
    openSmashUpModal,
    seedMatchCredentials,
    waitForFactionSelection,
    waitForHandArea,
    waitForHomeGameList,
} from './smashup-helpers';

type FactionPick = {
    playerId: string;
    factionId: string;
    expectedCountAfterPick: number;
};

type FactionSelectionHarnessState = {
    core?: {
        turnOrder?: string[];
        currentPlayerIndex?: number;
        factionSelection?: {
            playerSelections?: Record<string, string[]>;
        };
        players?: Record<string, {
            factions?: string[];
        }>;
    };
};

type HarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => FactionSelectionHarnessState | null;
        };
    };
};

const SHARED_SCREENSHOT_DIR = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    '_shared',
);

const FACTION_DRAFT_SEQUENCE: FactionPick[] = [
    { playerId: '0', factionId: 'aliens', expectedCountAfterPick: 1 },
    { playerId: '1', factionId: 'ninjas', expectedCountAfterPick: 1 },
    { playerId: '2', factionId: 'robots', expectedCountAfterPick: 1 },
    { playerId: '3', factionId: 'wizards', expectedCountAfterPick: 1 },
    { playerId: '3', factionId: 'tricksters', expectedCountAfterPick: 2 },
    { playerId: '2', factionId: 'zombies', expectedCountAfterPick: 2 },
    { playerId: '1', factionId: 'dinosaurs', expectedCountAfterPick: 2 },
    { playerId: '0', factionId: 'pirates', expectedCountAfterPick: 2 },
];

async function createSmashUpPlayerContext(
    browser: { newContext: (options?: Record<string, unknown>) => Promise<BrowserContext> },
    baseURL: string | undefined,
) {
    const context = await browser.newContext({ baseURL });
    await initContext(context, {
        storageKey: '__smashup_storage_reset',
        skipImageGate: true,
    });
    const page = await context.newPage();
    return { context, page };
}

async function createFourPlayerRoom(hostPage: Page) {
    await openSmashUpModal(hostPage);
    await hostPage.getByRole('button', { name: /Create Room|创建房间/i }).first().click();

    const createHeading = hostPage.getByRole('heading', { name: /Create Room|创建房间/i }).first();
    await expect(createHeading).toBeVisible({ timeout: 10000 });

    const createModal = createHeading.locator('..').locator('..');
    const fourPlayersButton = createModal.getByRole('button', { name: /4\s*players|4\s*人/i });
    await expect(fourPlayersButton).toBeVisible({ timeout: 5000 });
    await fourPlayersButton.click();

    await createModal.getByRole('button', { name: /Confirm|确认/i }).click();
    await hostPage.waitForURL(/\/play\/smashup\/match\//, { timeout: 15000 });

    const hostUrl = new URL(hostPage.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) {
        throw new Error('未能从房主 URL 解析出 matchId');
    }

    if (!hostUrl.searchParams.get('playerID')) {
        hostUrl.searchParams.set('playerID', '0');
        await hostPage.goto(hostUrl.toString(), { waitUntil: 'domcontentloaded' });
    }

    await waitForFactionSelection(hostPage);
    return matchId;
}

async function joinAsSeat(
    browser: { newContext: (options?: Record<string, unknown>) => Promise<BrowserContext> },
    baseURL: string | undefined,
    matchId: string,
    playerId: string,
) {
    const { context, page } = await createSmashUpPlayerContext(browser, baseURL);
    const guestId = `e2e-smashup-4p-${playerId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const credentials = await joinMatchViaAPI(
        page,
        matchId,
        playerId,
        `Guest-${playerId}-${Date.now()}`,
        guestId,
    );
    if (!credentials) {
        throw new Error(`玩家 ${playerId} 加入房间失败`);
    }

    await seedMatchCredentials(context, matchId, playerId, credentials);
    await page.goto(`/play/smashup/match/${matchId}?playerID=${playerId}`, {
        waitUntil: 'domcontentloaded',
    });
    await waitForFactionSelection(page);

    return { context, page };
}

async function waitForFactionTurn(
    hostPage: Page,
    playerId: string,
    selectedCount: number,
) {
    await hostPage.waitForFunction(
        ({ playerId, selectedCount }) => {
            const state = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
            if (!state?.core?.turnOrder || !state?.core?.factionSelection) return false;

            const turnOrder = state.core.turnOrder;
            const currentIndex = state.core.currentPlayerIndex ?? -1;
            const currentPlayerId = turnOrder[currentIndex];
            const picks = state.core.factionSelection.playerSelections?.[playerId] ?? [];
            return currentPlayerId === playerId && picks.length === selectedCount;
        },
        { playerId, selectedCount },
        { timeout: 20000, polling: 200 },
    );
}

async function waitForFactionSelections(page: Page) {
    return page.evaluate(() => {
        const state = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        return {
            playerCount: state?.core?.turnOrder?.length ?? 0,
            factionSelectionCleared: state?.core?.factionSelection === undefined,
            factionsByPlayer: Object.fromEntries(
                Object.entries(state?.core?.players ?? {}).map(([playerId, player]) => [
                    playerId,
                    Array.isArray(player?.factions) ? [...player.factions].sort() : [],
                ]),
            ),
        };
    }) as Promise<{
        playerCount: number;
        factionSelectionCleared: boolean;
        factionsByPlayer: Record<string, string[]>;
    }>;
}

async function assertFactionCardsClearPlayerRail(page: Page) {
    const PLAYER_RAIL_CLEARANCE_PX = 12;
    const metrics = await page.evaluate(() => {
        const viewportHeight = window.innerHeight;
        const rail = document.querySelector('[data-testid="faction-selection-player-rail"]') as HTMLElement | null;
        const cards = Array.from(document.querySelectorAll('[data-testid^="faction-option-"]')) as HTMLElement[];
        const playerCards = Array.from(document.querySelectorAll('[data-testid^="faction-selection-player-card-"]')) as HTMLElement[];
        if (!rail || cards.length === 0) {
            return { skippedBecausePlayerRailNotVisible: true };
        }

        const railRect = rail.getBoundingClientRect();
        const railVisibleHeight = Math.min(railRect.bottom, viewportHeight) - Math.max(railRect.top, 0);
        if (railRect.bottom <= 0 || railRect.top >= viewportHeight || railVisibleHeight < 24) {
            return { skippedBecausePlayerRailNotVisible: true };
        }

        const cardRects = cards
            .map((card) => {
                const rect = card.getBoundingClientRect();
                const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
                const visibleHeightAboveRail = Math.min(rect.bottom, railRect.top) - Math.max(rect.top, 0);
                return { rect, visibleHeight, visibleHeightAboveRail };
            })
            .filter(({ rect, visibleHeight, visibleHeightAboveRail }) =>
                rect.bottom > 0
                && rect.top < railRect.top
                && rect.top < viewportHeight
                && visibleHeight >= Math.min(rect.height * 0.5, 24)
                && visibleHeightAboveRail >= Math.min(rect.height * 0.72, 96))
            .map(({ rect }) => rect);
        if (cardRects.length === 0) {
            return { skippedBecausePlayerRailNotVisible: true };
        }

        const playerCardRects = playerCards
            .map((card) => {
                const rect = card.getBoundingClientRect();
                const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
                return { rect, visibleHeight };
            })
            .filter(({ rect, visibleHeight }) => rect.bottom > 0 && rect.top < viewportHeight && visibleHeight >= Math.min(rect.height * 0.5, 24));
        if (playerCardRects.length === 0) {
            return { skippedBecausePlayerRailNotVisible: true };
        }

        const maxCardBottom = Math.max(...cardRects.map((rect) => rect.bottom));
        const bottomRowCount = cardRects.filter((rect) => maxCardBottom - rect.bottom <= 4).length;
        const minPlayerCardTop = Math.min(...playerCardRects.map(({ rect }) => rect.top));
        return {
            railTop: railRect.top,
            maxCardBottom,
            minPlayerCardTop,
            overlap: maxCardBottom - minPlayerCardTop,
            bottomRowCount,
        };
    });

    expect(metrics, '派系选择页必须能拿到候选卡与玩家状态条几何信息').not.toBeNull();
    if ('skippedBecausePlayerRailNotVisible' in metrics!) {
        return;
    }
    expect(metrics!.bottomRowCount, '应至少识别到底排候选卡').toBeGreaterThan(0);
    expect(metrics!.maxCardBottom, '候选卡底边必须位于玩家状态卡上方，不能被底部玩家状态卡遮挡').toBeLessThanOrEqual(metrics!.minPlayerCardTop + PLAYER_RAIL_CLEARANCE_PX);
}

async function selectFactionAndConfirm(
    hostPage: Page,
    page: Page,
    playerId: string,
    factionId: string,
    expectedCountAfterPick: number,
) {
    await waitForFactionTurn(hostPage, playerId, expectedCountAfterPick - 1);
    await page.getByTestId(`faction-option-${factionId}`).click();

    const detailPanel = page.getByTestId('faction-detail-panel');
    const confirmButton = page.getByTestId('faction-confirm-button');
    await expect(detailPanel).toBeVisible({ timeout: 10000 });
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await expect(confirmButton).toBeEnabled({ timeout: 10000 });
    await confirmButton.click();

    await hostPage.waitForFunction(
        ({ playerId, factionId, expectedCountAfterPick }) => {
            const state = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
            const picks = state?.core?.factionSelection?.playerSelections?.[playerId] ?? [];
            if (picks.length === expectedCountAfterPick && picks.includes(factionId)) {
                return true;
            }

            const finalFactions = state?.core?.players?.[playerId]?.factions ?? [];
            return state?.core?.factionSelection === undefined
                && finalFactions.length === 2
                && finalFactions.includes(factionId);
        },
        { playerId, factionId, expectedCountAfterPick },
        { timeout: 20000, polling: 200 },
    );
}

test.describe('大杀四方四人联机开局', () => {
    test('四人联机可完成全部派系选择并让四个页面都进入对局', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        mkdirSync(SHARED_SCREENSHOT_DIR, { recursive: true });

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const host = await createSmashUpPlayerContext(browser, baseURL);
        const guests: Array<{ context: BrowserContext; page: Page }> = [];

        try {
            await host.page.goto('/?game=smashup', { waitUntil: 'domcontentloaded' });
            await dismissViteOverlay(host.page);
            await dismissLobbyConfirmIfNeeded(host.page);
            await waitForHomeGameList(host.page);

            if (!(await ensureGameServerAvailable(host.page))) {
                test.skip(true, '游戏服务器不可用，无法执行四人联机 E2E');
            }

            const matchId = await createFourPlayerRoom(host.page);

            for (const playerId of ['1', '2', '3']) {
                guests.push(await joinAsSeat(browser, baseURL, matchId, playerId));
            }

            const pagesByPlayerId = new Map<string, Page>([
                ['0', host.page],
                ['1', guests[0].page],
                ['2', guests[1].page],
                ['3', guests[2].page],
            ]);

            for (const pick of FACTION_DRAFT_SEQUENCE) {
                const page = pagesByPlayerId.get(pick.playerId);
                if (!page) {
                    throw new Error(`未找到玩家 ${pick.playerId} 的页面上下文`);
                }

                await selectFactionAndConfirm(
                    host.page,
                    page,
                    pick.playerId,
                    pick.factionId,
                    pick.expectedCountAfterPick,
                );

                if (pick.playerId === '3' && pick.expectedCountAfterPick === 1) {
                    await assertFactionCardsClearPlayerRail(page);
                    await page.screenshot({
                        path: join(
                            SHARED_SCREENSHOT_DIR,
                            'smashup-4p-online-faction-last-player-first-pick.png',
                        ),
                        fullPage: false,
                    });
                }
            }

            await Promise.all(
                [host.page, ...guests.map((guest) => guest.page)].map((page) => waitForHandArea(page, 45000)),
            );

            await expect
                .poll(async () => waitForFactionSelections(host.page), {
                    timeout: 45000,
                    intervals: [200, 400, 800],
                })
                .toEqual({
                    playerCount: 4,
                    factionSelectionCleared: true,
                    factionsByPlayer: {
                        '0': ['aliens', 'pirates'].sort(),
                        '1': ['dinosaurs', 'ninjas'].sort(),
                        '2': ['robots', 'zombies'].sort(),
                        '3': ['tricksters', 'wizards'].sort(),
                    },
                });

            await host.page.screenshot({
                path: join(SHARED_SCREENSHOT_DIR, 'smashup-4p-online-faction-game-start-host.png'),
                fullPage: false,
            });
        } finally {
            await Promise.allSettled([
                ...guests.map((guest) => guest.context.close()),
                host.context.close(),
            ]);
        }
    });
});
