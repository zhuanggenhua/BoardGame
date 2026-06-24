import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    bridgeMixedRoomToSecondHumanDrawTurn,
    clearEvidenceScreenshotsForTest,
    completeNaturalHumanDeckTurn,
    createAiTakeDiscardBranchCore,
    createOnlineAiNearReviewCore,
    createPlayerContext,
    createSixPlayerMixedWaitingToReviewCore,
    expectFantasyRealmsSpectatorLiveNoLeak,
    expectFinalStandingsVisible,
    expectLiveWaitingScoreSummary,
    GAME_NAME,
    expectWaitingPageKeepsOpponentFocusHidden,
    getEvidenceScreenshotPath,
    injectOnlineAiCore,
    injectMatchState,
    openFantasyRealmsOnlineAiMixedRoom,
    openFantasyRealmsOnlineAiRoom,
    readOnlineAiCore,
    readOnlineAiMatchState,
    readOnlineAiStateSummary,
    switchFantasyRealmsPageToCompactLandscapeLayout,
    waitForFantasyRealmsBoard,
    waitForSingleOnlineAiRoundtrip,
    waitForFantasyRealmsPlayerReviewBoard,
    waitForFantasyRealmsSpectatorBoard,
} from './helpers/fantasyrealmsOnlineAi';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FANTASY_REALMS_DECK_DRAW_BUTTON_NAME = /摸牌/;
const getFantasyRealmsDeckDrawButton = (page: Page) => page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME });
const getFantasyRealmsFocusName = (page: Page) => page.locator('.fr-focus-name, .fr-compact-focus-name').first();

async function clickFantasyRealmsDeckDrawButtonIfVisible(page: Page) {
    const deckButton = getFantasyRealmsDeckDrawButton(page);
    if (await deckButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deckButton.click();
    }
}

async function getLocatorRects(page: Page, selector: string) {
    return page.locator(selector).evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        };
    }));
}

async function waitForLocatorRectsToSettle(page: Page, selector: string, timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    let previousSignature: string | null = null;
    while (Date.now() < deadline) {
        const rects = await getLocatorRects(page, selector);
        const signature = JSON.stringify(rects);
        if (rects.length > 0 && signature === previousSignature) {
            return rects;
        }
        previousSignature = signature;
        await page.waitForTimeout(120);
    }
    return getLocatorRects(page, selector);
}

test.describe('FantasyRealms online AI flow', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

test('在线房里 human 完成一轮后，seat1 local AI 会自动推进并把回合交回 human', async ({ browser }, testInfo) => {
        test.setTimeout(120000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online AI test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const initialSummary = await readOnlineAiStateSummary(matchId, page);
            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            const aiTurnSummary = await completeNaturalHumanDeckTurn({
                matchId,
                page,
                playerId: '0',
                roundLabel: '2人在线 AI 房间首轮 human',
            });
            await waitForSingleOnlineAiRoundtrip({
                matchId,
                page,
                humanPlayerId: '0',
                aiTurnSummary,
                roundLabel: '2人在线 AI 房间首轮',
            });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-human-roundtrip');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('真实在线房间低张数公开弃牌保持固定槽位，不因少牌重新居中放大', async ({ browser }, testInfo) => {
        test.setTimeout(120000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online center layout test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);
        const centerCardsSelector = '.fr-card-button--live-center';

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await injectOnlineAiCore(matchId, page, createOnlineAiNearReviewCore(['0', '1'], '0', 6));
            await expect(page.locator(centerCardsSelector)).toHaveCount(9, { timeout: 10000 });
            const fullRowRects = await waitForLocatorRectsToSettle(page, centerCardsSelector);
            expect(fullRowRects).toHaveLength(9);
            const topRowRects = fullRowRects.slice(0, 5);
            const fullEvidencePath = getEvidenceScreenshotPath(testInfo, 'real-online-center-slots-nine-cards');
            await mkdir(dirname(fullEvidencePath), { recursive: true });
            await page.screenshot({ path: fullEvidencePath, fullPage: false });

            await injectOnlineAiCore(matchId, page, {
                ...createAiTakeDiscardBranchCore(),
                currentPlayer: '0',
            });
            await expect(page.locator(centerCardsSelector)).toHaveCount(2, { timeout: 10000 });
            const lowCountRects = await waitForLocatorRectsToSettle(page, centerCardsSelector);
            expect(lowCountRects).toHaveLength(2);

            expect(Math.abs(lowCountRects[0]!.x - topRowRects[0]!.x)).toBeLessThanOrEqual(2);
            expect(Math.abs(lowCountRects[1]!.x - topRowRects[1]!.x)).toBeLessThanOrEqual(2);
            expect(Math.abs(lowCountRects[0]!.width - topRowRects[0]!.width)).toBeLessThanOrEqual(2);
            expect(Math.abs(lowCountRects[0]!.height - topRowRects[0]!.height)).toBeLessThanOrEqual(2);
            expect(lowCountRects[0]!.y).toBe(topRowRects[0]!.y);
            expect(lowCountRects[1]!.y).toBe(topRowRects[1]!.y);

            const lowEvidencePath = getEvidenceScreenshotPath(testInfo, 'real-online-center-slots-two-cards');
            await mkdir(dirname(lowEvidencePath), { recursive: true });
            await page.screenshot({ path: lowEvidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-center-layout', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人在线房里 host 完成首轮后，seat1 与 seat2 local AI 会依次推进并把回合交回 host', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 3,
            aiSeatIds: ['1', '2'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 3-player online AI test.');
        }

        const { context, page, matchId, aiPlayerNames } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const initialSummary = await readOnlineAiStateSummary(matchId, page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;

            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);
            expect(initialSummary.stage).toBe('draw');
            expect(initialSummary.discardCount).toBe(0);

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await clickFantasyRealmsDeckDrawButtonIfVisible(page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.turn === 1
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 3 人在线 AI 房间里 host 从 draw 进入 discard',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
            const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.turn === 4
                    && summary.stage === 'draw'
                    && summary.discardCount >= 1
                    && summary.discardCount <= 3
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.handCounts['1'] ?? 0) === 7
                    && (summary.handCounts['2'] ?? 0) === 7;
            }, {
                timeout: 50000,
                message: '等待 3 人在线 AI 房间里 seat1 与 seat2 依次完成首轮并把回合交回 host',
            }).toBe(true);

            const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
            expect(afterAiSummary.eventStreamNextId).not.toBeNull();
            expect(initialSummary.eventStreamNextId).not.toBeNull();
            expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(initialSummary.eventStreamNextId!);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(getFantasyRealmsDeckDrawButton(page)).toBeVisible({ timeout: 10000 });
            await expect(page.getByText(aiPlayerNames['1']!)).toHaveCount(0);
            await expect(page.getByText(aiPlayerNames['2']!)).toHaveCount(0);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-three-player-first-round');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-three-player-first-round', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人在线房里 host 在 seat2 local AI 回合中刷新后，seat1 与 seat2 仍会继续推进并把回合交回 host', async ({ browser }, testInfo) => {
        test.setTimeout(210000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 3,
            aiSeatIds: ['1', '2'],
            aiMinimumActionDelayMs: 2000,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 3-player online AI refresh test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const initialSummary = await readOnlineAiStateSummary(matchId, page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;

            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);
            expect(initialSummary.stage).toBe('draw');

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await clickFantasyRealmsDeckDrawButtonIfVisible(page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.turn === 1
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 3 人在线 AI 房间里 host 从 draw 进入 discard，再准备把回合交给 AI 链',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
            const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '2'
                    && (summary.turn ?? 0) >= 3
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.stage === 'draw' || summary.stage === 'discard');
            }, {
                timeout: 30000,
                message: '等待 3 人在线 AI 房间里 seat1 先完成推进，并真实轮到 seat2 local AI，再在 seat2 回合中刷新',
            }).toBe(true);

            const seat2TurnSummary = await readOnlineAiStateSummary(matchId, page);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(page, '0');

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) === 4
                    && (summary.handCounts['0'] ?? 0) === (seat2TurnSummary.handCounts['0'] ?? 0)
                    && (summary.handCounts['1'] ?? 0) === 7
                    && (summary.handCounts['2'] ?? 0) === 7;
            }, {
                timeout: 45000,
                message: '等待刷新后的 host 页面看到 seat2 local AI 继续推进，并让整条 3 人 AI 链把回合交回 host',
            }).toBe(true);

            const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
            expect(afterAiSummary.eventStreamNextId).not.toBeNull();
            expect(seat2TurnSummary.eventStreamNextId).not.toBeNull();
            expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(seat2TurnSummary.eventStreamNextId!);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(getFantasyRealmsDeckDrawButton(page)).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-three-player-refresh-during-seat2-turn');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-three-player-refresh-during-seat2-turn', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人在线房里 spectator 在 seat2 local AI 实时托管与刷新前后，仍不会借用玩家身份，也不会泄露隐藏手牌与实时分数', async ({ browser }, testInfo) => {
        test.setTimeout(210000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 3,
            aiSeatIds: ['1', '2'],
            aiMinimumActionDelayMs: 2000,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 3-player online AI spectator test.');
        }

        const { context, page, matchId } = match!;
        const spectator = await createPlayerContext(browser, baseURL, '__fantasyrealms_online_ai_spectator__');
        const diagnostics = attachPageDiagnostics(page);
        const spectatorDiagnostics = attachPageDiagnostics(spectator.page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const initialSummary = await readOnlineAiStateSummary(matchId, page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;

            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);
            expect(initialSummary.stage).toBe('draw');

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await clickFantasyRealmsDeckDrawButtonIfVisible(page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.turn === 1
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 3 人在线 AI spectator 用例里 host 从 draw 进入 discard，再准备把回合交给 AI 链',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
            const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '2'
                    && (summary.turn ?? 0) >= 3
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.stage === 'draw' || summary.stage === 'discard');
            }, {
                timeout: 30000,
                message: '等待 spectator 用例里的 3 人在线 AI 房间先经过 seat1，并真实进入 seat2 local AI 回合',
            }).toBe(true);

            const seat2TurnCore = await readOnlineAiCore(matchId, page);
            const hiddenCardName = seat2TurnCore.players['2']?.hand[0]?.name ?? seat2TurnCore.players['1']?.hand[0]?.name ?? '';
            expect(hiddenCardName).not.toBe('');

            await spectator.page.goto(`/play/${GAME_NAME}/match/${matchId}?spectate=1`, { waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorBoard(spectator.page, matchId);
            await expectFantasyRealmsSpectatorLiveNoLeak(spectator.page);

            await spectator.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorBoard(spectator.page, matchId);
            await expectFantasyRealmsSpectatorLiveNoLeak(spectator.page);

            await switchFantasyRealmsPageToCompactLandscapeLayout(spectator.page);
            await expect(spectator.page.getByTestId('fantasyrealms-compact-focus-rail')).toBeVisible();
            await expect(spectator.page.getByTestId('fantasyrealms-live-score-strip')).toContainText('??');
            await expect(spectator.page.getByTestId('fantasyrealms-live-score-strip')).toContainText('终局揭示');
            await expect(spectator.page.locator('.fr-card-button--live-hand:visible')).toHaveCount(0);
            await expect(spectator.page.getByText(hiddenCardName)).toHaveCount(0);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) === 4;
            }, {
                timeout: 45000,
                message: '等待 spectator 用例里的 seat2 local AI 继续完成托管链，并把回合交回 host',
            }).toBe(true);

            await expect(spectator.page.getByText('你的回合')).toHaveCount(0);
            await expect(spectator.page.getByRole('button', { name: /查看手牌|弃置手牌/ })).toHaveCount(0);
            await expect(spectator.page.getByText(hiddenCardName)).toHaveCount(0);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-three-player-spectator-no-leak-during-seat2-turn');
            await mkdir(dirname(evidencePath), { recursive: true });
            await spectator.page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([
                { label: 'fantasyrealms-online-ai-three-player-spectator-host', diagnostics },
                { label: 'fantasyrealms-online-ai-three-player-spectator-page', diagnostics: spectatorDiagnostics },
            ]);
        } finally {
            await spectator.context.close().catch(() => {});
            await context.close().catch(() => {});
        }
    });

    test('6人在线房里 spectator 在 seat5 local AI 高人数托管与刷新前后，仍不会借用玩家身份，也不会泄露隐藏手牌与实时分数', async ({ browser }, testInfo) => {
        test.setTimeout(360000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '2', '3', '4', '5'],
            aiMinimumActionDelayMs: 1500,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player online AI spectator test.');
        }

        const { context, page, matchId } = match!;
        const spectator = await createPlayerContext(browser, baseURL, '__fantasyrealms_online_ai_spectator_high_player__');
        const diagnostics = attachPageDiagnostics(page);
        const spectatorDiagnostics = attachPageDiagnostics(spectator.page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const initialSummary = await readOnlineAiStateSummary(matchId, page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;

            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);
            expect(initialSummary.stage).toBe('draw');

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await clickFantasyRealmsDeckDrawButtonIfVisible(page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.turn === 1
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 6 人在线 AI spectator 用例里 host 从 draw 进入 discard，再准备把回合交给高人数 AI 链',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
            const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '5'
                    && (summary.turn ?? 0) >= 6
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.stage === 'draw' || summary.stage === 'discard');
            }, {
                timeout: 90000,
                message: '等待 6 人在线 AI spectator 用例里的房间先经过 seat1 到 seat4，并真实进入 seat5 local AI 回合',
            }).toBe(true);

            const seat5TurnCore = await readOnlineAiCore(matchId, page);
            const hiddenCardName = seat5TurnCore.players['5']?.hand[0]?.name
                ?? seat5TurnCore.players['4']?.hand[0]?.name
                ?? seat5TurnCore.players['3']?.hand[0]?.name
                ?? '';
            expect(hiddenCardName).not.toBe('');

            await spectator.page.goto(`/play/${GAME_NAME}/match/${matchId}?spectate=1`, { waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorBoard(spectator.page, matchId);
            await expectFantasyRealmsSpectatorLiveNoLeak(spectator.page);

            await spectator.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorBoard(spectator.page, matchId);
            await expectFantasyRealmsSpectatorLiveNoLeak(spectator.page);

            await switchFantasyRealmsPageToCompactLandscapeLayout(spectator.page);
            await expect(spectator.page.getByTestId('fantasyrealms-compact-focus-rail')).toBeVisible();
            await expect(spectator.page.getByTestId('fantasyrealms-live-score-strip')).toContainText('??');
            await expect(spectator.page.getByTestId('fantasyrealms-live-score-strip')).toContainText('终局揭示');
            await expect(spectator.page.locator('.fr-card-button--live-hand:visible')).toHaveCount(0);
            await expect(spectator.page.getByText(hiddenCardName)).toHaveCount(0);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) >= 7;
            }, {
                timeout: 120000,
                message: '等待 6 人在线 AI spectator 用例里的 seat5 local AI 继续完成托管链，并把回合交回 host',
            }).toBe(true);

            await expectFantasyRealmsSpectatorLiveNoLeak(spectator.page);
            await expect(spectator.page.getByText('你的回合')).toHaveCount(0);
            await expect(spectator.page.getByRole('button', { name: /查看手牌|弃置手牌/ })).toHaveCount(0);
            await expect(spectator.page.getByText(hiddenCardName)).toHaveCount(0);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-spectator-no-leak-during-seat5-turn');
            await mkdir(dirname(evidencePath), { recursive: true });
            await spectator.page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([
                { label: 'fantasyrealms-online-ai-six-player-spectator-host', diagnostics },
                { label: 'fantasyrealms-online-ai-six-player-spectator-page', diagnostics: spectatorDiagnostics },
            ]);
        } finally {
            await spectator.context.close().catch(() => {});
            await context.close().catch(() => {});
        }
    });

    test('6人在线房里 host 在 seat5 local AI 回合中刷新后，整条高人数 AI 链仍会继续推进并把回合交回 host', async ({ browser }, testInfo) => {
        test.setTimeout(360000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '2', '3', '4', '5'],
            aiMinimumActionDelayMs: 1500,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player online AI refresh test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const initialSummary = await readOnlineAiStateSummary(matchId, page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;

            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);
            expect(initialSummary.stage).toBe('draw');

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await clickFantasyRealmsDeckDrawButtonIfVisible(page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.turn === 1
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 6 人在线 AI 房间里 host 从 draw 进入 discard，再准备把回合交给高人数 AI 链',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
            const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '5'
                    && (summary.turn ?? 0) >= 6
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.stage === 'draw' || summary.stage === 'discard');
            }, {
                timeout: 90000,
                message: '等待 6 人在线 AI 房间里 seat1 到 seat4 先完成推进，并真实轮到 seat5 local AI，再在 seat5 回合中刷新',
            }).toBe(true);

            const seat5TurnSummary = await readOnlineAiStateSummary(matchId, page);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(page, '0');

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) === 7
                    && (summary.handCounts['0'] ?? 0) === (seat5TurnSummary.handCounts['0'] ?? 0)
                    && (summary.handCounts['1'] ?? 0) === 7
                    && (summary.handCounts['2'] ?? 0) === 7
                    && (summary.handCounts['3'] ?? 0) === 7
                    && (summary.handCounts['4'] ?? 0) === 7
                    && (summary.handCounts['5'] ?? 0) === 7;
            }, {
                timeout: 120000,
                message: '等待刷新后的 host 页面看到 seat5 local AI 继续推进，并让整条 6 人 AI 链把回合交回 host',
            }).toBe(true);

            const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
            expect(afterAiSummary.eventStreamNextId).not.toBeNull();
            expect(seat5TurnSummary.eventStreamNextId).not.toBeNull();
            expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(seat5TurnSummary.eventStreamNextId!);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(getFantasyRealmsDeckDrawButton(page)).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-refresh-during-seat5-turn');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-six-player-refresh-during-seat5-turn', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('6人混合房里等待页在高人数 AI 链与刷新前后仍只公开当前观察者信息，并保持隐藏手牌不泄露', async ({ browser }, testInfo) => {
        test.setTimeout(420000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiMixedRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '3', '4', '5'],
            humanSeatIds: ['2'],
            aiMinimumActionDelayMs: 4000,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player mixed online AI waiting-page test.');
        }

        const { matchId, host, humansBySeat, aiPlayerNames } = match!;
        const waitingPlayer = humansBySeat['2']!;
        const hostDiagnostics = attachPageDiagnostics(host.page);
        const waitingDiagnostics = attachPageDiagnostics(waitingPlayer.page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const initialSummary = await readOnlineAiStateSummary(matchId, host.page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;
            const initialDiscardCount = initialSummary.discardCount;
            const initialTurn = initialSummary.turn ?? 1;

            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);
            expect(initialSummary.stage).toBe('draw');

            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await clickFantasyRealmsDeckDrawButtonIfVisible(host.page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, host.page);
                return summary.currentPlayer === '0'
                    && summary.turn === 1
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 6 人混合房里的 host 从 draw 进入 discard，再准备把回合交给高人数 AI 链',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, host.page);
            const discardHandButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, host.page);
                return summary.currentPlayer === '1'
                    && (summary.turn ?? 0) >= initialTurn + 1
                    && summary.discardCount >= initialDiscardCount + 1
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.stage === 'draw' || summary.stage === 'discard');
            }, {
                timeout: 45000,
                message: '等待 6 人混合房在 host 结束回合后真实进入 seat1 local AI 回合',
            }).toBe(true);

            const waitingCore = await readOnlineAiCore(matchId, host.page);
            const waitingPlayerScore = waitingCore.players['2']?.score ?? 0;
            const hostScore = waitingCore.players['0']?.score ?? 0;
            await expect(host.page.getByText('你的回合')).toHaveCount(0);
            await expect(waitingPlayer.page.getByText('你的回合')).toHaveCount(0);

            await expectLiveWaitingScoreSummary({
                page: host.page,
                currentPlayerName: aiPlayerNames['1']!,
                hiddenOtherName: waitingPlayer.playerName,
                expectedScore: hostScore,
            });
            await expectLiveWaitingScoreSummary({
                page: waitingPlayer.page,
                currentPlayerName: aiPlayerNames['1']!,
                hiddenOtherName: host.playerName,
                expectedScore: waitingPlayerScore,
            });

            await waitingPlayer.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(waitingPlayer.page, '2');
            await expect(waitingPlayer.page.getByText('你的回合')).toHaveCount(0);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
            await expectLiveWaitingScoreSummary({
                page: waitingPlayer.page,
                currentPlayerName: aiPlayerNames['1']!,
                hiddenOtherName: host.playerName,
                expectedScore: waitingPlayerScore,
            });

            await switchFantasyRealmsPageToCompactLandscapeLayout(host.page);
            await switchFantasyRealmsPageToCompactLandscapeLayout(waitingPlayer.page);

            const ownHandInspectButton = waitingPlayer.page.getByRole('button', { name: /查看手牌/ }).nth(1);
            const ownHandInspectLabel = await ownHandInspectButton.getAttribute('aria-label');
            const hiddenCardName = ownHandInspectLabel?.replace(/^查看手牌\s*/, '').trim() ?? '';
            expect(hiddenCardName).not.toBe('');

            await ownHandInspectButton.click();
            await expect(getFantasyRealmsFocusName(waitingPlayer.page)).toHaveText(hiddenCardName);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');

            await expectWaitingPageKeepsOpponentFocusHidden({
                page: host.page,
                hiddenCardName,
            });

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, host.page);
                return summary.currentPlayer === '2'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) >= 3;
            }, {
                timeout: 30000,
                message: '等待 seat1 local AI 完成这一轮，并把回合真实交给 seat2 人类玩家',
            }).toBe(true);

            await waitingPlayer.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(waitingPlayer.page, '2');

            const reloadedLiveActionButton = waitingPlayer.page.getByTestId('fantasyrealms-live-action-button');
            if (await reloadedLiveActionButton.count() > 0) {
                await expect(waitingPlayer.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
                await expect(getFantasyRealmsDeckDrawButton(waitingPlayer.page)).toBeVisible({ timeout: 10000 });
            } else {
                await expect(waitingPlayer.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
                await expect(getFantasyRealmsDeckDrawButton(waitingPlayer.page)).toBeVisible({ timeout: 10000 });
            }

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-mixed-waiting-page-no-leak-during-ai-chain');
            await mkdir(dirname(evidencePath), { recursive: true });
            await waitingPlayer.page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([
                { label: 'fantasyrealms-online-ai-six-player-mixed-waiting-host', diagnostics: hostDiagnostics },
                { label: 'fantasyrealms-online-ai-six-player-mixed-waiting-seat4', diagnostics: waitingDiagnostics },
            ]);
        } finally {
            await waitingPlayer.context.close().catch(() => {});
            await host.context.close().catch(() => {});
        }
    });

    test('6人混合房里 waiting 人类在紧凑横屏 inspect 壳中刷新后，仍保持 waiting 身份、可继续查看自己的隐藏手牌且不向 host 泄露', async ({ browser }, testInfo) => {
        test.setTimeout(300000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiMixedRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '3', '4', '5'],
            humanSeatIds: ['2'],
            aiMinimumActionDelayMs: 4000,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player mixed online AI waiting inspect reload test.');
        }

        const { matchId, host, humansBySeat, aiPlayerNames } = match!;
        const waitingPlayer = humansBySeat['2']!;
        const hostDiagnostics = attachPageDiagnostics(host.page);
        const waitingDiagnostics = attachPageDiagnostics(waitingPlayer.page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const initialSummary = await readOnlineAiStateSummary(matchId, host.page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;
            const initialDiscardCount = initialSummary.discardCount;
            const initialTurn = initialSummary.turn ?? 1;

            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);
            expect(initialSummary.stage).toBe('draw');

            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await clickFantasyRealmsDeckDrawButtonIfVisible(host.page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, host.page);
                return summary.currentPlayer === '0'
                    && summary.turn === 1
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 6 人混合房里的 host 从 draw 进入 discard，准备把回合交给 waiting 链前段 AI',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, host.page);
            const discardHandButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, host.page);
                return summary.currentPlayer === '1'
                    && (summary.turn ?? 0) >= initialTurn + 1
                    && summary.discardCount >= initialDiscardCount + 1
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.stage === 'draw' || summary.stage === 'discard');
            }, {
                timeout: 45000,
                message: '等待 6 人 mixed-room 在 host 结束回合后真实进入 seat1 local AI 回合',
            }).toBe(true);

            const waitingCore = await readOnlineAiCore(matchId, waitingPlayer.page);
            const waitingPlayerScore = waitingCore.players['2']?.score ?? 0;
            const getCurrentPlayerName = async (page = waitingPlayer.page) => {
                const core = await readOnlineAiCore(matchId, page);
                const playerId = core.currentPlayer;
                if (playerId === '0') {
                    return host.playerName;
                }
                if (playerId === '2') {
                    return waitingPlayer.playerName;
                }
                return aiPlayerNames[playerId] ?? core.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`;
            };

            await expect(waitingPlayer.page.getByText('你的回合')).toHaveCount(0);
            await expectLiveWaitingScoreSummary({
                page: waitingPlayer.page,
                currentPlayerName: await getCurrentPlayerName(),
                hiddenOtherName: host.playerName,
                expectedScore: waitingPlayerScore,
            });

            await switchFantasyRealmsPageToCompactLandscapeLayout(host.page);
            await switchFantasyRealmsPageToCompactLandscapeLayout(waitingPlayer.page);
            const ownHandInspectButton = waitingPlayer.page.getByRole('button', { name: /查看手牌/ }).nth(1);
            const ownHandInspectLabel = await ownHandInspectButton.getAttribute('aria-label');
            const hiddenCardName = ownHandInspectLabel?.replace(/^查看手牌\s*/, '').trim() ?? '';
            expect(hiddenCardName).not.toBe('');

            await ownHandInspectButton.click();
            await expect(getFantasyRealmsFocusName(waitingPlayer.page)).toHaveText(hiddenCardName);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expectWaitingPageKeepsOpponentFocusHidden({
                page: host.page,
                hiddenCardName,
            });

            await waitingPlayer.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(waitingPlayer.page, '2');
            await expect(waitingPlayer.page.getByText('你的回合')).toHaveCount(0);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
            await expectLiveWaitingScoreSummary({
                page: waitingPlayer.page,
                currentPlayerName: await getCurrentPlayerName(),
                hiddenOtherName: host.playerName,
                expectedScore: waitingPlayerScore,
            });

            await expect(waitingPlayer.page.getByTestId('fantasyrealms-compact-layout')).toBeVisible({ timeout: 10000 });
            const reloadedInspectButton = waitingPlayer.page
                .getByRole('button', { name: new RegExp(`查看手牌\\s*${escapeRegExp(hiddenCardName)}`) })
                .first();
            await expect(reloadedInspectButton).toBeVisible({ timeout: 10000 });
            await reloadedInspectButton.click();
            await expect(getFantasyRealmsFocusName(waitingPlayer.page)).toHaveText(hiddenCardName);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expectWaitingPageKeepsOpponentFocusHidden({
                page: host.page,
                hiddenCardName,
            });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-mixed-waiting-inspect-reload');
            await mkdir(dirname(evidencePath), { recursive: true });
            await waitingPlayer.page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([
                { label: 'fantasyrealms-online-ai-six-player-mixed-waiting-inspect-reload-host', diagnostics: hostDiagnostics },
                { label: 'fantasyrealms-online-ai-six-player-mixed-waiting-inspect-reload-seat2', diagnostics: waitingDiagnostics },
            ]);
        } finally {
            await waitingPlayer.context.close().catch(() => {});
            await host.context.close().catch(() => {});
        }
    });

    test('6人混合房里 waiting 人类若在紧凑横屏 inspect 壳里遇到高人数 AI 链直接打进终局，仍会切到 review 并在刷新后保持最终排名与公开焦点', async ({ browser }, testInfo) => {
        test.setTimeout(420000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiMixedRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '3', '4', '5'],
            humanSeatIds: ['2'],
            aiMinimumActionDelayMs: 2500,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player mixed online AI waiting-review test.');
        }

        const { matchId, host, humansBySeat, aiPlayerNames } = match!;
        const waitingPlayer = humansBySeat['2']!;
        const hostDiagnostics = attachPageDiagnostics(host.page);
        const waitingDiagnostics = attachPageDiagnostics(waitingPlayer.page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const currentState = await readOnlineAiMatchState(matchId, host.page);
            const injectedCore = createSixPlayerMixedWaitingToReviewCore();
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    gameover: null,
                    turnOrder: [...injectedCore.playerIds],
                    currentPlayerIndex: injectedCore.playerIds.indexOf(injectedCore.currentPlayer),
                },
                core: injectedCore,
            }, host.page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, waitingPlayer.page);
                return summary.currentPlayer === '4'
                    && summary.turn === 8
                    && summary.stage === 'discard'
                    && summary.discardCount === 9
                    && (summary.handCounts['4'] ?? 0) === 8;
            }, {
                timeout: 10000,
                message: '等待 mixed-room 的 waiting 人类页进入 seat4 local AI 终局前最后一弃的代表态',
            }).toBe(true);

            await switchFantasyRealmsPageToCompactLandscapeLayout(waitingPlayer.page);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-compact-layout')).toBeVisible({ timeout: 10000 });
            await expect(waitingPlayer.page.getByText('你的回合')).toHaveCount(0);
            await expect(waitingPlayer.page.getByText(aiPlayerNames['4']!)).toBeVisible({ timeout: 10000 });
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
            await expect(waitingPlayer.page.getByText('终局复盘')).toHaveCount(0);

            const ownHandInspectButton = waitingPlayer.page.getByRole('button', { name: /查看手牌/ }).nth(1);
            await ownHandInspectButton.click();
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');

            await expect.poll(async () => {
                const state = await readOnlineAiMatchState(matchId, waitingPlayer.page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 90000,
                message: '等待高人数 AI 链在 waiting 人类的紧凑横屏 inspect 壳期间直接打进终局',
            }).toBe(true);

            await waitForFantasyRealmsPlayerReviewBoard(waitingPlayer.page, matchId, '2');
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-compact-layout')).toBeVisible({ timeout: 10000 });
            await expect(waitingPlayer.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');

            const finalState = await readOnlineAiMatchState(matchId, waitingPlayer.page);
            const finalCore = await readOnlineAiCore(matchId, waitingPlayer.page);
            const gameOverResult = finalState.sys?.gameover ?? FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected mixed-room waiting-review online AI game to reach Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries((gameOverResult as { scores?: Record<string, number> }).scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0'
                        ? host.playerName
                        : playerId === '2'
                            ? waitingPlayer.playerName
                            : aiPlayerNames[playerId] ?? finalCore.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));
            await expectFinalStandingsVisible(waitingPlayer.page, sortedStandings);

            const focusAtlasCardIdBeforeReload = await waitingPlayer.page.getByTestId('fantasyrealms-focus-preview').getAttribute('data-atlas-card-id') ?? '';
            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-mixed-waiting-review-after-gameover');
            await mkdir(dirname(evidencePath), { recursive: true });
            await waitingPlayer.page.screenshot({ path: evidencePath, fullPage: false });

            await waitingPlayer.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsPlayerReviewBoard(waitingPlayer.page, matchId, '2');
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-compact-layout')).toBeVisible({ timeout: 10000 });
            await expectFinalStandingsVisible(waitingPlayer.page, sortedStandings);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-atlas-card-id', focusAtlasCardIdBeforeReload);

            assertNoFatalFrontendErrors([
                { label: 'fantasyrealms-online-ai-six-player-mixed-waiting-review-host', diagnostics: hostDiagnostics },
                { label: 'fantasyrealms-online-ai-six-player-mixed-waiting-review-seat2', diagnostics: waitingDiagnostics },
            ]);
        } finally {
            await waitingPlayer.context.close().catch(() => {});
            await host.context.close().catch(() => {});
        }
    });

    test('6人混合房里 waiting 人类可从真实开局进入第二轮，再在紧凑横屏 inspect 壳里接续终局前代表态并打进终局 review', async ({ browser }, testInfo) => {
        test.setTimeout(420000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiMixedRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '3', '4', '5'],
            humanSeatIds: ['2'],
            aiMinimumActionDelayMs: 1500,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player mixed online AI natural waiting-review test.');
        }

        const { matchId, host, humansBySeat, aiPlayerNames } = match!;
        const waitingPlayer = humansBySeat['2']!;
        const hostDiagnostics = attachPageDiagnostics(host.page);
        const waitingDiagnostics = attachPageDiagnostics(waitingPlayer.page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            await bridgeMixedRoomToSecondHumanDrawTurn({
                matchId,
                hostPage: host.page,
                waitingHumanPage: waitingPlayer.page,
                waitingHumanPlayerId: '2',
            });

            const currentState = await readOnlineAiMatchState(matchId, host.page);
            const injectedCore = createSixPlayerMixedWaitingToReviewCore();
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    gameover: null,
                    turnOrder: [...injectedCore.playerIds],
                    currentPlayerIndex: injectedCore.playerIds.indexOf(injectedCore.currentPlayer),
                },
                core: injectedCore,
            }, host.page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, waitingPlayer.page);
                return summary.currentPlayer === '4'
                    && summary.turn === 8
                    && summary.stage === 'discard'
                    && summary.discardCount === 9
                    && (summary.handCounts['4'] ?? 0) === 8;
            }, {
                timeout: 10000,
                message: '等待 mixed-room 第二轮后的 waiting 人类页接到 seat4 终局前最后一弃代表态',
            }).toBe(true);

            await switchFantasyRealmsPageToCompactLandscapeLayout(waitingPlayer.page);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-compact-layout')).toBeVisible({ timeout: 10000 });
            await expect(waitingPlayer.page.getByText('你的回合')).toHaveCount(0);
            await expect(waitingPlayer.page.getByText(aiPlayerNames['4']!)).toBeVisible({ timeout: 10000 });
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
            await expect(waitingPlayer.page.getByText('终局复盘')).toHaveCount(0);

            const ownHandInspectButton = waitingPlayer.page.getByRole('button', { name: /查看手牌/ }).nth(1);
            const ownHandInspectLabel = await ownHandInspectButton.getAttribute('aria-label');
            const hiddenCardName = ownHandInspectLabel?.replace(/^查看手牌\s*/, '').trim() ?? '';
            expect(hiddenCardName).not.toBe('');

            await ownHandInspectButton.click();
            await expect(getFantasyRealmsFocusName(waitingPlayer.page)).toHaveText(hiddenCardName);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');

            await expect.poll(async () => {
                const state = await readOnlineAiMatchState(matchId, waitingPlayer.page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 90000,
                message: '等待高人数 AI 链在第二轮 waiting human 的紧凑横屏 inspect 壳期间完成最后一弃并打进终局',
            }).toBe(true);

            await waitForFantasyRealmsPlayerReviewBoard(waitingPlayer.page, matchId, '2');
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-compact-layout')).toBeVisible({ timeout: 10000 });
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveCount(0);

            const finalState = await readOnlineAiMatchState(matchId, waitingPlayer.page);
            const finalCore = await readOnlineAiCore(matchId, waitingPlayer.page);
            const gameOverResult = finalState.sys?.gameover ?? FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected second-round mixed-room waiting-review online AI game to reach Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries((gameOverResult as { scores?: Record<string, number> }).scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0'
                        ? host.playerName
                        : playerId === '2'
                            ? waitingPlayer.playerName
                            : aiPlayerNames[playerId] ?? finalCore.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));
            await expectFinalStandingsVisible(waitingPlayer.page, sortedStandings);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-mixed-second-round-waiting-review-after-gameover');
            await mkdir(dirname(evidencePath), { recursive: true });
            await waitingPlayer.page.screenshot({ path: evidencePath, fullPage: false });

            await waitingPlayer.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsPlayerReviewBoard(waitingPlayer.page, matchId, '2');
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-compact-layout')).toBeVisible({ timeout: 10000 });
            await expectFinalStandingsVisible(waitingPlayer.page, sortedStandings);
            await expect(waitingPlayer.page.getByTestId('fantasyrealms-focus-preview')).toHaveCount(0);

            assertNoFatalFrontendErrors([
                { label: 'fantasyrealms-online-ai-six-player-mixed-second-round-waiting-review-host', diagnostics: hostDiagnostics },
                { label: 'fantasyrealms-online-ai-six-player-mixed-second-round-waiting-review-seat2', diagnostics: waitingDiagnostics },
            ]);
        } finally {
            await waitingPlayer.context.close().catch(() => {});
            await host.context.close().catch(() => {});
        }
    });


});
