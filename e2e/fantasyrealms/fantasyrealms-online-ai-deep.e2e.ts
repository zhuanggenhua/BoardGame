import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    clearEvidenceScreenshotsForTest,
    createAiTakeDiscardBranchCore,
    getEvidenceScreenshotPath,
    injectMatchState,
    openFantasyRealmsOnlineAiRoom,
    readOnlineAiMatchState,
    readOnlineAiStateSummary,
    waitForFantasyRealmsBoard,
} from './helpers/fantasyrealmsOnlineAi';

const FANTASY_REALMS_DECK_DRAW_BUTTON_NAME = /从牌库摸 2 张并弃 1 张|从牌库摸 1 张/;

test.describe('FantasyRealms online AI flow', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

test('6人在线房里同一轮高人数 AI 链里连续刷新两次后，仍不会停在半回合残态', async ({ browser }, testInfo) => {
        test.setTimeout(420000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '2', '3', '4', '5'],
            aiMinimumActionDelayMs: 1500,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player repeated refresh test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            const initialSummary = await readOnlineAiStateSummary(matchId, page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;

            expect(initialSummary.currentPlayer).toBe('0');
            expect(initialSummary.turn).toBe(1);
            expect(initialSummary.stage).toBe('draw');

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
            await page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME }).click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.turn === 1
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 6 人在线 AI 房间里 host 从 draw 进入 discard，再准备交给高人数 AI 链',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
            const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '2'
                    && (summary.turn ?? 0) >= 3
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.stage === 'draw' || summary.stage === 'discard');
            }, {
                timeout: 45000,
                message: '等待 6 人在线 AI 房间里 seat1 已完成推进，并真实轮到 seat2 local AI，再执行第一次 refresh',
            }).toBe(true);

            const seat2TurnSummary = await readOnlineAiStateSummary(matchId, page);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(page, '0');

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '5'
                    && (summary.turn ?? 0) >= 6
                    && (summary.handCounts['0'] ?? 0) === (seat2TurnSummary.handCounts['0'] ?? 0)
                    && (summary.stage === 'draw' || summary.stage === 'discard');
            }, {
                timeout: 90000,
                message: '等待第一次 refresh 后的 host 页面看到 seat3 到 seat5 继续推进，并在 seat5 回合中再执行第二次 refresh',
            }).toBe(true);

            const seat5TurnSummary = await readOnlineAiStateSummary(matchId, page);
            expect(seat5TurnSummary.eventStreamNextId).not.toBeNull();
            expect(seat2TurnSummary.eventStreamNextId).not.toBeNull();
            expect(seat5TurnSummary.eventStreamNextId!).toBeGreaterThan(seat2TurnSummary.eventStreamNextId!);

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
                message: '等待第二次 refresh 后的 host 页面看到 seat5 local AI 完成最后一段高人数托管链，并把回合交回 host',
            }).toBe(true);

            const finalSummary = await readOnlineAiStateSummary(matchId, page);
            expect(finalSummary.eventStreamNextId).not.toBeNull();
            expect(finalSummary.eventStreamNextId!).toBeGreaterThan(seat5TurnSummary.eventStreamNextId!);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-two-refreshes-same-round');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-six-player-two-refreshes-same-round', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('在线房里 seat1 local AI 遇到更优公开弃牌且拿牌后必须继续弃1时，会走完整拿弃牌分支', async ({ browser }, testInfo) => {
        test.setTimeout(120000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online AI take-discard test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const currentState = await readOnlineAiMatchState(matchId, page);
            const injectedCore = createAiTakeDiscardBranchCore();
            const injectedSummary = {
                currentPlayer: injectedCore.currentPlayer,
                turn: injectedCore.turn,
                stage: injectedCore.stage,
                drawPileCount: injectedCore.drawPile.length,
                discardCount: injectedCore.discardPile.length,
                discardSignature: injectedCore.discardPile.map((card) => card.id).join('|'),
                hostHandCount: injectedCore.players['0']?.hand.length ?? 0,
                aiHandCount: injectedCore.players['1']?.hand.length ?? 0,
            };

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
            }, page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                const tookDiscardAndWaitingToDiscard = summary.currentPlayer === '1'
                    && summary.stage === 'discard'
                    && (summary.turn ?? 0) === injectedSummary.turn
                    && summary.drawPileCount === injectedSummary.drawPileCount
                    && summary.discardCount === injectedSummary.discardCount - 1
                    && (summary.handCounts['1'] ?? 0) === 8
                    && summary.discardSignature !== injectedSummary.discardSignature;
                const alreadyReturnedToHost = summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) > injectedSummary.turn
                    && summary.drawPileCount === injectedSummary.drawPileCount
                    && summary.discardCount === injectedSummary.discardCount
                    && summary.discardSignature !== injectedSummary.discardSignature
                    && (summary.handCounts['0'] ?? 0) === injectedSummary.hostHandCount
                    && (summary.handCounts['1'] ?? 0) === injectedSummary.aiHandCount;
                return tookDiscardAndWaitingToDiscard || alreadyReturnedToHost;
            }, {
                timeout: 35000,
                message: '等待 seat1 local AI 在更优公开弃牌代表态下先完成 TAKE_FROM_DISCARD 停在 discard，或已经整条分支收口回到 human',
            }).toBe(true);

            const afterTakeSummary = await readOnlineAiStateSummary(matchId, page);

            if (!(afterTakeSummary.currentPlayer === '0' && afterTakeSummary.stage === 'draw')) {
                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '0'
                        && summary.stage === 'draw'
                        && (summary.turn ?? 0) > injectedSummary.turn
                        && summary.drawPileCount === injectedSummary.drawPileCount
                        && summary.discardCount === injectedSummary.discardCount
                        && summary.discardSignature !== injectedSummary.discardSignature
                        && (summary.handCounts['0'] ?? 0) === injectedSummary.hostHandCount
                        && (summary.handCounts['1'] ?? 0) === (afterTakeSummary.handCounts['1'] ?? 0) - 1;
                }, {
                    timeout: 35000,
                    message: '等待 seat1 local AI 在更优公开弃牌代表态下完成 拿弃牌 -> 继续弃1 -> 把回合交回 human',
                }).toBe(true);
            }

            const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
            expect(afterAiSummary.eventStreamNextId).not.toBeNull();
            expect(currentState.sys?.eventStream?.nextId ?? 0).toBeLessThan(afterAiSummary.eventStreamNextId ?? 0);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-take-discard-branch');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-take-discard', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('在线房里 host 在 AI 回合中刷新后，seat1 local AI 仍会继续推进并把回合交回刷新后的 host', async ({ browser }, testInfo) => {
        test.setTimeout(150000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online AI refresh test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            const initialSummary = await readOnlineAiStateSummary(matchId, page);
            const initialHand0 = initialSummary.handCounts['0'] ?? 0;
            const initialDiscardCount = initialSummary.discardCount;
            const initialTurn = initialSummary.turn ?? 1;

            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
            await page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME }).click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.turn === initialTurn
                    && summary.stage === 'discard'
                    && (summary.handCounts['0'] ?? 0) > initialHand0;
            }, {
                timeout: 10000,
                message: '等待 human 从 draw 进入 discard，再准备把回合交给 AI',
            }).toBe(true);

            const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
            const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await discardHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '1'
                    && summary.discardCount >= initialDiscardCount + 1
                    && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                    && (summary.stage === 'draw' || summary.stage === 'discard')
                    && (summary.turn ?? 0) >= initialTurn;
            }, {
                timeout: 12000,
                message: '等待 human 结束首轮后真实轮到 AI，再在 AI 回合中刷新',
            }).toBe(true);

            const aiTurnSummary = await readOnlineAiStateSummary(matchId, page);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(page, '0');

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) > (aiTurnSummary.turn ?? 0)
                    && (summary.handCounts['0'] ?? 0) === (aiTurnSummary.handCounts['0'] ?? 0);
            }, {
                timeout: 35000,
                message: '等待刷新后的 host 页面看到 seat1 local AI 继续推进并把回合交回 human',
            }).toBe(true);

            const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
            expect(afterAiSummary.eventStreamNextId).not.toBeNull();
            expect(aiTurnSummary.eventStreamNextId).not.toBeNull();
            expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(aiTurnSummary.eventStreamNextId!);
            expect(
                afterAiSummary.drawPileCount !== aiTurnSummary.drawPileCount
                || afterAiSummary.discardSignature !== aiTurnSummary.discardSignature,
            ).toBe(true);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-refresh-during-ai-turn');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-refresh-during-ai-turn', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('在线房里 host 在 AI 的拿弃牌深分支中刷新后，seat1 local AI 仍会完成继续弃1并把回合交回刷新后的 host', async ({ browser }, testInfo) => {
        test.setTimeout(150000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online AI deep-branch refresh test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const currentState = await readOnlineAiMatchState(matchId, page);
            const injectedCore = createAiTakeDiscardBranchCore();
            const injectedSummary = {
                currentPlayer: injectedCore.currentPlayer,
                turn: injectedCore.turn,
                stage: injectedCore.stage,
                drawPileCount: injectedCore.drawPile.length,
                discardCount: injectedCore.discardPile.length,
                discardSignature: injectedCore.discardPile.map((card) => card.id).join('|'),
                hostHandCount: injectedCore.players['0']?.hand.length ?? 0,
            };

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
            }, page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '1'
                    && summary.stage === 'discard'
                    && (summary.turn ?? 0) === injectedSummary.turn
                    && summary.drawPileCount === injectedSummary.drawPileCount
                    && summary.discardCount === injectedSummary.discardCount - 1
                    && (summary.handCounts['1'] ?? 0) === 8
                    && summary.discardSignature !== injectedSummary.discardSignature;
            }, {
                timeout: 20000,
                message: '等待 seat1 local AI 在更优公开弃牌代表态下先完成 TAKE_FROM_DISCARD 并停在 discard，再在深分支中刷新',
            }).toBe(true);

            const afterTakeSummary = await readOnlineAiStateSummary(matchId, page);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(page, '0');

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) > injectedSummary.turn
                    && summary.drawPileCount === injectedSummary.drawPileCount
                    && summary.discardCount === injectedSummary.discardCount
                    && summary.discardSignature !== injectedSummary.discardSignature
                    && (summary.handCounts['0'] ?? 0) === injectedSummary.hostHandCount
                    && (summary.handCounts['1'] ?? 0) === (afterTakeSummary.handCounts['1'] ?? 0) - 1;
            }, {
                timeout: 35000,
                message: '等待刷新后的 host 页面看到 seat1 local AI 完成 拿弃牌 -> 继续弃1 -> 回合交回 human',
            }).toBe(true);

            const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
            expect(afterAiSummary.eventStreamNextId).not.toBeNull();
            expect(currentState.sys?.eventStream?.nextId ?? 0).toBeLessThan(afterAiSummary.eventStreamNextId ?? 0);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-refresh-during-take-discard-branch');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-refresh-during-take-discard-branch', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('在线房里 human 与 seat1 local AI 可连续完成两整轮交接，不会在第二次 AI 回合卡死', async ({ browser }, testInfo) => {
        test.setTimeout(150000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms multi-round online AI test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');

            const completeHumanDeckTurn = async (roundLabel: string) => {
                const beforeSummary = await readOnlineAiStateSummary(matchId, page);
                const beforeHandCount = beforeSummary.handCounts['0'] ?? 0;
                const beforeDiscardCount = beforeSummary.discardCount;
                const beforeTurn = beforeSummary.turn ?? 0;

                await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
                await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
                await page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME }).click();

                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '0'
                        && summary.stage === 'discard'
                        && (summary.turn ?? 0) === beforeTurn
                        && (summary.handCounts['0'] ?? 0) > beforeHandCount;
                }, {
                    timeout: 10000,
                    message: `${roundLabel}: 等待 human 从 draw 进入 discard`,
                }).toBe(true);

                const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
                const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
                await discardHandButton.click();
                await expect(liveActionButton).toContainText('确认弃置');
                await liveActionButton.click();

                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '1'
                        && summary.discardCount >= beforeDiscardCount + 1
                        && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                        && (summary.stage === 'draw' || summary.stage === 'discard')
                        && (summary.turn ?? 0) >= beforeTurn;
                }, {
                    timeout: 12000,
                    message: `${roundLabel}: 等待 human 结束回合并真实轮到 AI`,
                }).toBe(true);

                return readOnlineAiStateSummary(matchId, page);
            };

            const waitForAiRoundtrip = async (roundLabel: string, aiTurnSummary: OnlineAiSummary) => {
                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '0'
                        && summary.stage === 'draw'
                        && (summary.turn ?? 0) > (aiTurnSummary.turn ?? 0)
                        && (summary.handCounts['0'] ?? 0) === (aiTurnSummary.handCounts['0'] ?? 0);
                }, {
                    timeout: 35000,
                    message: `${roundLabel}: 等待 seat1 local AI 完成一轮并把回合交回 human`,
                }).toBe(true);

                const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
                expect(afterAiSummary.eventStreamNextId).not.toBeNull();
                expect(aiTurnSummary.eventStreamNextId).not.toBeNull();
                expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(aiTurnSummary.eventStreamNextId!);
                expect(
                    afterAiSummary.drawPileCount !== aiTurnSummary.drawPileCount
                    || afterAiSummary.discardSignature !== aiTurnSummary.discardSignature,
                ).toBe(true);
                await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
                await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
                return afterAiSummary;
            };

            const firstAiTurnSummary = await completeHumanDeckTurn('第1轮');
            const afterFirstAiSummary = await waitForAiRoundtrip('第1轮', firstAiTurnSummary);

            const secondAiTurnSummary = await completeHumanDeckTurn('第2轮');
            const afterSecondAiSummary = await waitForAiRoundtrip('第2轮', secondAiTurnSummary);

            expect(afterSecondAiSummary.turn).not.toBeNull();
            expect(afterFirstAiSummary.turn).not.toBeNull();
            expect(afterSecondAiSummary.turn!).toBeGreaterThan(afterFirstAiSummary.turn!);
            expect(afterSecondAiSummary.eventStreamNextId).not.toBeNull();
            expect(afterFirstAiSummary.eventStreamNextId).not.toBeNull();
            expect(afterSecondAiSummary.eventStreamNextId!).toBeGreaterThan(afterFirstAiSummary.eventStreamNextId!);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-two-round-roundtrip');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-two-round-roundtrip', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('在线房里第二次 AI 回合再入拿弃牌深分支时，host 刷新后仍不会停在半回合残态', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms second deep-branch refresh test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');

            const completeHumanDeckTurn = async (roundLabel: string) => {
                const beforeSummary = await readOnlineAiStateSummary(matchId, page);
                const beforeHandCount = beforeSummary.handCounts['0'] ?? 0;
                const beforeDiscardCount = beforeSummary.discardCount;
                const beforeTurn = beforeSummary.turn ?? 0;

                await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
                await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
                await page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME }).click();

                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '0'
                        && summary.stage === 'discard'
                        && (summary.turn ?? 0) === beforeTurn
                        && (summary.handCounts['0'] ?? 0) > beforeHandCount;
                }, {
                    timeout: 10000,
                    message: `${roundLabel}: 等待 human 从 draw 进入 discard`,
                }).toBe(true);

                const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
                const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
                await discardHandButton.click();
                await expect(liveActionButton).toContainText('确认弃置');
                await liveActionButton.click();

                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '1'
                        && summary.discardCount >= beforeDiscardCount + 1
                        && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                        && (summary.stage === 'draw' || summary.stage === 'discard')
                        && (summary.turn ?? 0) >= beforeTurn;
                }, {
                    timeout: 12000,
                    message: `${roundLabel}: 等待 human 结束回合并真实轮到 AI`,
                }).toBe(true);

                return readOnlineAiStateSummary(matchId, page);
            };

            const waitForAiRoundtrip = async (roundLabel: string, aiTurnSummary: OnlineAiSummary) => {
                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '0'
                        && summary.stage === 'draw'
                        && (summary.turn ?? 0) > (aiTurnSummary.turn ?? 0)
                        && (summary.handCounts['0'] ?? 0) === (aiTurnSummary.handCounts['0'] ?? 0);
                }, {
                    timeout: 35000,
                    message: `${roundLabel}: 等待 seat1 local AI 完成一轮并把回合交回 human`,
                }).toBe(true);

                const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
                expect(afterAiSummary.eventStreamNextId).not.toBeNull();
                expect(aiTurnSummary.eventStreamNextId).not.toBeNull();
                expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(aiTurnSummary.eventStreamNextId!);
                await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
                await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
                return afterAiSummary;
            };

            const firstAiTurnSummary = await completeHumanDeckTurn('预备轮');
            const afterFirstAiSummary = await waitForAiRoundtrip('预备轮', firstAiTurnSummary);

            const currentState = await readOnlineAiMatchState(matchId, page);
            const injectedCore = {
                ...createAiTakeDiscardBranchCore(),
                turn: Math.max((afterFirstAiSummary.turn ?? 0) + 1, 6),
            };
            const injectedSummary = {
                currentPlayer: injectedCore.currentPlayer,
                turn: injectedCore.turn,
                stage: injectedCore.stage,
                drawPileCount: injectedCore.drawPile.length,
                discardCount: injectedCore.discardPile.length,
                discardSignature: injectedCore.discardPile.map((card) => card.id).join('|'),
                hostHandCount: injectedCore.players['0']?.hand.length ?? 0,
            };

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
            }, page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '1'
                    && summary.stage === 'discard'
                    && (summary.turn ?? 0) === injectedSummary.turn
                    && summary.drawPileCount === injectedSummary.drawPileCount
                    && summary.discardCount === injectedSummary.discardCount - 1
                    && (summary.handCounts['1'] ?? 0) === 8
                    && summary.discardSignature !== injectedSummary.discardSignature;
            }, {
                timeout: 25000,
                message: '等待同一 match 的第二次 AI 深分支先完成 TAKE_FROM_DISCARD 并停在 discard，再刷新 host',
            }).toBe(true);

            const afterTakeSummary = await readOnlineAiStateSummary(matchId, page);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(page, '0');

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) > injectedSummary.turn
                    && summary.drawPileCount === injectedSummary.drawPileCount
                    && summary.discardCount === injectedSummary.discardCount
                    && summary.discardSignature !== injectedSummary.discardSignature
                    && (summary.handCounts['0'] ?? 0) === injectedSummary.hostHandCount
                    && (summary.handCounts['1'] ?? 0) === (afterTakeSummary.handCounts['1'] ?? 0) - 1;
            }, {
                timeout: 35000,
                message: '等待刷新后的 host 页面看到第二次 AI 深分支完成 拿弃牌 -> 继续弃1 -> 回合交回 human',
            }).toBe(true);

            const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
            expect(afterAiSummary.eventStreamNextId).not.toBeNull();
            expect(afterFirstAiSummary.eventStreamNextId).not.toBeNull();
            expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(afterFirstAiSummary.eventStreamNextId!);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-refresh-during-second-take-discard-branch');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-refresh-during-second-take-discard-branch', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('在线房里同一 match 连续完成两轮交接后，再在第二次深分支中刷新一次仍不会停在半回合残态', async ({ browser }, testInfo) => {
        test.setTimeout(240000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            aiMinimumActionDelayMs: 5000,
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms repeated-refresh online AI test.');
        }

        const { context, page, matchId } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');

            const completeHumanDeckTurn = async (roundLabel: string) => {
                const beforeSummary = await readOnlineAiStateSummary(matchId, page);
                const beforeHandCount = beforeSummary.handCounts['0'] ?? 0;
                const beforeDiscardCount = beforeSummary.discardCount;
                const beforeTurn = beforeSummary.turn ?? 0;

                await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
                await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
                await page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME }).click();

                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '0'
                        && summary.stage === 'discard'
                        && (summary.turn ?? 0) === beforeTurn
                        && (summary.handCounts['0'] ?? 0) > beforeHandCount;
                }, {
                    timeout: 10000,
                    message: `${roundLabel}: 等待 human 从 draw 进入 discard`,
                }).toBe(true);

                const afterDrawSummary = await readOnlineAiStateSummary(matchId, page);
                const discardHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
                await discardHandButton.click();
                await expect(liveActionButton).toContainText('确认弃置');
                await liveActionButton.click();

                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '1'
                        && summary.discardCount >= beforeDiscardCount + 1
                        && (summary.handCounts['0'] ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                        && (summary.stage === 'draw' || summary.stage === 'discard')
                        && (summary.turn ?? 0) >= beforeTurn;
                }, {
                    timeout: 12000,
                    message: `${roundLabel}: 等待 human 结束回合并真实轮到 AI`,
                }).toBe(true);

                return readOnlineAiStateSummary(matchId, page);
            };

            const waitForAiRoundtrip = async (roundLabel: string, aiTurnSummary: OnlineAiSummary) => {
                await expect.poll(async () => {
                    const summary = await readOnlineAiStateSummary(matchId, page);
                    return summary.currentPlayer === '0'
                        && summary.stage === 'draw'
                        && (summary.turn ?? 0) > (aiTurnSummary.turn ?? 0)
                        && (summary.handCounts['0'] ?? 0) === (aiTurnSummary.handCounts['0'] ?? 0);
                }, {
                    timeout: 35000,
                    message: `${roundLabel}: 等待 seat1 local AI 完成一轮并把回合交回 human`,
                }).toBe(true);

                const afterAiSummary = await readOnlineAiStateSummary(matchId, page);
                expect(afterAiSummary.eventStreamNextId).not.toBeNull();
                expect(aiTurnSummary.eventStreamNextId).not.toBeNull();
                expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(aiTurnSummary.eventStreamNextId!);
                await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
                await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
                return afterAiSummary;
            };

            const firstAiTurnSummary = await completeHumanDeckTurn('第1轮');
            await waitForAiRoundtrip('第1轮', firstAiTurnSummary);

            const secondAiTurnSummary = await completeHumanDeckTurn('第2轮');
            const afterSecondAiSummary = await waitForAiRoundtrip('第2轮', secondAiTurnSummary);

            const currentState = await readOnlineAiMatchState(matchId, page);
            const injectedCore = {
                ...createAiTakeDiscardBranchCore(),
                turn: Math.max((afterSecondAiSummary.turn ?? 0) + 1, 7),
            };
            const injectedSummary = {
                currentPlayer: injectedCore.currentPlayer,
                turn: injectedCore.turn,
                stage: injectedCore.stage,
                drawPileCount: injectedCore.drawPile.length,
                discardCount: injectedCore.discardPile.length,
                discardSignature: injectedCore.discardPile.map((card) => card.id).join('|'),
                hostHandCount: injectedCore.players['0']?.hand.length ?? 0,
            };

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
            }, page);

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '1'
                    && summary.stage === 'discard'
                    && (summary.turn ?? 0) === injectedSummary.turn
                    && summary.drawPileCount === injectedSummary.drawPileCount
                    && summary.discardCount === injectedSummary.discardCount - 1
                    && (summary.handCounts['1'] ?? 0) === 8
                    && summary.discardSignature !== injectedSummary.discardSignature;
            }, {
                timeout: 25000,
                message: '等待同一 match 的第二次 AI 深分支先完成 TAKE_FROM_DISCARD 并停在 discard，再执行 repeated refresh',
            }).toBe(true);

            const beforeDeepFirstReload = await readOnlineAiStateSummary(matchId, page);
            expect(beforeDeepFirstReload.currentPlayer).toBe('1');
            expect(beforeDeepFirstReload.stage).toBe('discard');

            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(page, '0');

            const beforeDeepCompleteSummary = await readOnlineAiStateSummary(matchId, page);
            expect(beforeDeepCompleteSummary.eventStreamNextId).not.toBeNull();

            await expect.poll(async () => {
                const summary = await readOnlineAiStateSummary(matchId, page);
                return summary.currentPlayer === '0'
                    && summary.stage === 'draw'
                    && (summary.turn ?? 0) > injectedSummary.turn
                    && summary.drawPileCount === injectedSummary.drawPileCount
                    && summary.discardCount === injectedSummary.discardCount
                    && summary.discardSignature !== injectedSummary.discardSignature
                    && (summary.handCounts['0'] ?? 0) === injectedSummary.hostHandCount
                    && (summary.handCounts['1'] ?? 0) === 7;
            }, {
                timeout: 35000,
                message: '等待同一 match 连续两轮交接后，第二次 AI 深分支在刷新后仍能完成继续弃1并把回合交回 human',
            }).toBe(true);

            const finalSummary = await readOnlineAiStateSummary(matchId, page);
            expect(finalSummary.eventStreamNextId).not.toBeNull();
            expect(beforeDeepCompleteSummary.eventStreamNextId).not.toBeNull();
            expect(finalSummary.eventStreamNextId!).toBeGreaterThanOrEqual(beforeDeepCompleteSummary.eventStreamNextId!);
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-refresh-after-two-rounds-second-branch');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-refresh-after-two-rounds-second-branch', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });


});
