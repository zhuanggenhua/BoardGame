import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import type { MatchState } from '../../src/engine/types';
import { FantasyRealmsDomain } from '../../src/games/fantasyrealms/domain';
import type { FantasyRealmsCore } from '../../src/games/fantasyrealms/domain';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForMatchAvailable,
} from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';

const GAME_NAME = 'fantasyrealms';
const FANTASY_REALMS_DECK_DRAW_BUTTON_NAME = /从牌库摸 2 张并弃 1 张|从牌库摸 1 张/;
type FantasyRealmsMatchState = MatchState<FantasyRealmsCore>;

type OnlineAiSummary = {
    currentPlayer: string | null;
    turn: number | null;
    stage: string | null;
    drawPileCount: number;
    discardCount: number;
    discardSignature: string;
    handCounts: Record<string, number>;
    eventStreamNextId: number | null;
};

type FinalStanding = {
    rank: number;
    playerName: string;
    score: number;
};

type OnlineAiRoomSetup = {
    context: BrowserContext;
    page: Page;
    matchId: string;
    hostPlayerName: string;
    aiPlayerName: string;
    aiPlayerNames: Record<string, string>;
};

type OnlineAiRoomOptions = {
    aiMinimumActionDelayMs?: number;
    numPlayers?: number;
    aiSeatIds?: string[];
};

type MultiSeatNaturalOnlineAiOptions = {
    numPlayers: number;
    aiSeatIds: string[];
    roundLabelPrefix: string;
    afterHostTurnTimeoutMs: number;
    aiRoundtripTimeoutMs: number;
    minCompletedAiRoundtrips: number;
    maxRounds: number;
    expectGameOver: boolean;
    evidenceName: string;
    diagnosticsLabel: string;
    settledAiSeatIds?: string[];
};

async function createFantasyRealmsAiRoom(
    page: Page,
    options?: OnlineAiRoomOptions,
): Promise<{
    matchId: string;
    ownerGuestId: string;
    ownerPlayerId: string;
    ownerCredentials: string | null;
} | null> {
    const numPlayers = options?.numPlayers ?? 2;
    const aiSeatIds = options?.aiSeatIds ?? ['1'];
    const seatControllers = Object.fromEntries(
        aiSeatIds.map((seatId) => [seatId, {
            type: 'local-ai',
            minimumActionDelayMs: options?.aiMinimumActionDelayMs ?? 0,
        }]),
    );
    const ownerGuestId = `fr-online-ai-owner-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const response = await page.request.post(`${getGameServerBaseURL()}/games/${GAME_NAME}/create`, {
        data: {
            numPlayers,
            setupData: {
                guestId: ownerGuestId,
                ownerKey: `guest:${ownerGuestId}`,
                ownerType: 'guest',
                enableAi: true,
                seatControllers,
            },
            unlisted: false,
        },
    });
    if (!response.ok()) {
        return null;
    }

    const data = (await response.json().catch(() => null)) as {
        matchID?: string;
        ownerPlayerID?: string;
        ownerCredentials?: string;
    } | null;
    if (!data?.matchID) {
        return null;
    }

    return {
        matchId: data.matchID,
        ownerGuestId,
        ownerPlayerId: data.ownerPlayerID ?? '0',
        ownerCredentials: data.ownerCredentials ?? null,
    };
}

async function claimSeatViaApi(args: {
    page: Page;
    matchId: string;
    playerId: string;
    guestId: string;
    playerName: string;
}): Promise<string | null> {
    const response = await args.page.request.post(`${getGameServerBaseURL()}/games/${GAME_NAME}/${args.matchId}/claim-seat`, {
        data: {
            playerID: args.playerId,
            playerName: args.playerName,
            guestId: args.guestId,
        },
    });
    if (!response.ok()) {
        return null;
    }

    const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
    return data?.playerCredentials ?? null;
}

async function seedAiSeatCredentials(
    page: Page,
    matchId: string,
    credentials: Record<string, string>,
) {
    await page.evaluate(({ targetMatchId, nextCredentials }) => {
        localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(nextCredentials));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { targetMatchId: matchId, nextCredentials: credentials });
}

async function waitForFantasyRealmsBoard(page: Page, expectedPlayerId: string) {
    await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/.+\\?playerID=${expectedPlayerId}`), { timeout: 15000 });
    const liveTable = page.getByTestId('fantasyrealms-live-table');
    const compactLayout = page.getByTestId('fantasyrealms-compact-layout');
    await expect.poll(async () => {
        if (await liveTable.count() > 0 && await liveTable.first().isVisible().catch(() => false)) {
            return 'live';
        }
        if (await compactLayout.count() > 0 && await compactLayout.first().isVisible().catch(() => false)) {
            return 'compact-landscape';
        }
        return null;
    }, {
        timeout: 20000,
        message: `等待 Fantasy Realms 玩家页进入 live 或紧凑横屏棋盘壳（playerID=${expectedPlayerId}）`,
    }).toBeTruthy();

    if (await liveTable.count() > 0 && await liveTable.first().isVisible().catch(() => false)) {
        await expect(page.getByTestId('fantasyrealms-live-topbar')).toBeVisible({ timeout: 10000 });
    } else {
        await expect(compactLayout).toBeVisible({ timeout: 10000 });
    }
}

async function readOnlineAiStateSummary(matchId: string, page: Page): Promise<OnlineAiSummary> {
    const state = await getMatchState(matchId, page) as FantasyRealmsMatchState;
    const record = state as FantasyRealmsMatchState & { G?: { core?: FantasyRealmsCore } };
    const core = record.core ?? record.G?.core;
    return {
        currentPlayer: typeof core?.currentPlayer === 'string' ? core.currentPlayer : null,
        turn: typeof core?.turn === 'number' ? core.turn : null,
        stage: typeof core?.stage === 'string' ? core.stage : null,
        drawPileCount: Array.isArray(core?.drawPile) ? core.drawPile.length : 0,
        discardCount: Array.isArray(core?.discardPile) ? core.discardPile.length : 0,
        discardSignature: Array.isArray(core?.discardPile)
            ? core.discardPile.map((card) => card.id).join('|')
            : '',
        handCounts: Object.fromEntries(
            Object.entries(core?.players ?? {}).map(([playerId, player]) => [
                playerId,
                Array.isArray(player?.hand) ? player.hand.length : 0,
            ]),
        ),
        eventStreamNextId: typeof record.sys?.eventStream?.nextId === 'number'
            ? record.sys.eventStream.nextId
            : null,
    };
}

async function readOnlineAiMatchState(matchId: string, page: Page): Promise<FantasyRealmsMatchState> {
    return await getMatchState(matchId, page) as FantasyRealmsMatchState;
}

async function readOnlineAiCore(matchId: string, page: Page): Promise<FantasyRealmsCore> {
    const state = await readOnlineAiMatchState(matchId, page);
    const record = state as { core?: FantasyRealmsCore; G?: { core?: FantasyRealmsCore } };
    const core = record.core ?? record.G?.core;
    if (!core) {
        throw new Error(`Failed to read Fantasy Realms online AI core for match ${matchId}`);
    }
    return core;
}

async function expectFinalStandingsVisible(page: Page, standings: FinalStanding[]) {
    const standingsRegion = page.locator('.fr-endgame-list');
    await expect(standingsRegion).toBeVisible();
    const rows = standingsRegion.locator('.fr-endgame-row');
    await expect(rows).toHaveCount(standings.length);
    for (const [index, standing] of standings.entries()) {
        const row = rows.nth(index);
        await expect(row).toContainText(`第 ${standing.rank} 名`);
        await expect(row).toContainText(standing.playerName);
        await expect(row.locator('.fr-endgame-score')).toHaveText(String(standing.score));
    }
}

async function openFantasyRealmsOnlineAiRoom(
    browser: NonNullable<BrowserContext['browser']>,
    baseURL: string | undefined,
    options?: OnlineAiRoomOptions,
): Promise<OnlineAiRoomSetup | null> {
    const context = await browser.newContext({ baseURL });
    await initContext(context, {
        storageKey: '__fantasyrealms_online_ai_golden__',
        skipImageGate: true,
        gameServerBaseURL: getGameServerBaseURL(),
    });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    if (!(await ensureGameServerAvailable(page, getGameServerBaseURL()))) {
        await context.close();
        return null;
    }

    const aiSeatIds = options?.aiSeatIds ?? ['1'];
    const room = await createFantasyRealmsAiRoom(page, options);
    if (!room) {
        throw new Error('Failed to create Fantasy Realms online AI room');
    }

    if (!(await waitForMatchAvailable(page, GAME_NAME, room.matchId, 20000))) {
        throw new Error(`Fantasy Realms online AI match not available: ${room.matchId}`);
    }

    const hostPlayerName = `Host-FR-AI-${Date.now()}`;
    const hostCredentials = room.ownerCredentials ?? await claimSeatViaApi({
        page,
        matchId: room.matchId,
        playerId: room.ownerPlayerId,
        guestId: room.ownerGuestId,
        playerName: hostPlayerName,
    });
    if (!hostCredentials) {
        throw new Error('Host failed to claim Fantasy Realms online AI seat');
    }

    const aiPlayerNames: Record<string, string> = {};
    const aiCredentialsBySeat: Record<string, string> = {};
    for (const seatId of aiSeatIds) {
        const aiGuestId = `fr-online-ai-seat${seatId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const aiPlayerName = `AI-FR-${seatId}-${Date.now()}`;
        const aiCredentials = await joinMatchViaAPI(
            page,
            GAME_NAME,
            room.matchId,
            seatId,
            aiPlayerName,
            aiGuestId,
        );
        if (!aiCredentials) {
            throw new Error(`AI seat ${seatId} failed to claim Fantasy Realms online AI seat`);
        }
        aiPlayerNames[seatId] = aiPlayerName;
        aiCredentialsBySeat[seatId] = aiCredentials;
    }

    await seedMatchCredentials(context, GAME_NAME, room.matchId, room.ownerPlayerId, hostCredentials);
    await context.addInitScript(({ targetMatchId, targetCredentials }) => {
        localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(targetCredentials));
    }, { targetMatchId: room.matchId, targetCredentials: aiCredentialsBySeat });

    await page.goto(`/play/${GAME_NAME}/match/${room.matchId}?playerID=${room.ownerPlayerId}`, { waitUntil: 'domcontentloaded' });
    await waitForFantasyRealmsBoard(page, room.ownerPlayerId);
    await seedAiSeatCredentials(page, room.matchId, aiCredentialsBySeat);

    return {
        context,
        page,
        matchId: room.matchId,
        hostPlayerName,
        aiPlayerName: aiPlayerNames[aiSeatIds[0]!] ?? '',
        aiPlayerNames,
    };
}

async function completeHostDeckTurnUntilAiOrGameOver(args: {
    matchId: string;
    page: Page;
    liveActionButton: ReturnType<Page['getByTestId']>;
    aiSeatIds: string[];
    roundLabel: string;
    afterHostTurnTimeoutMs: number;
}) {
    const beforeSummary = await readOnlineAiStateSummary(args.matchId, args.page);
    const beforeHandCount = beforeSummary.handCounts['0'] ?? 0;
    const beforeDiscardCount = beforeSummary.discardCount;
    const beforeTurn = beforeSummary.turn ?? 0;

    await expect(args.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
    await expect(args.page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
    await args.page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME }).click();

    await expect.poll(async () => {
        const summary = await readOnlineAiStateSummary(args.matchId, args.page);
        return summary.currentPlayer === '0'
            && summary.stage === 'discard'
            && (summary.turn ?? 0) === beforeTurn
            && (summary.handCounts['0'] ?? 0) > beforeHandCount;
    }, {
        timeout: 10000,
        message: `${args.roundLabel}: 等待 host 从真实开局链进入 discard`,
    }).toBe(true);

    const afterDrawSummary = await readOnlineAiStateSummary(args.matchId, args.page);
    const discardHandButton = args.page.getByRole('button', { name: /弃置手牌/ }).first();
    await discardHandButton.click();
    await expect(args.liveActionButton).toContainText('确认弃置');
    await args.liveActionButton.click();

    await expect.poll(async () => {
        const state = await readOnlineAiMatchState(args.matchId, args.page);
        const record = state as { core?: FantasyRealmsCore; G?: { core?: FantasyRealmsCore }; sys?: { gameover?: unknown } };
        const core = record.core ?? record.G?.core;
        if (!core) return false;
        return Boolean(record.sys?.gameover)
            || (
                args.aiSeatIds.includes(core.currentPlayer ?? '')
                && (core.stage === 'draw' || core.stage === 'discard')
                && core.discardPile.length >= beforeDiscardCount + 1
                && (core.players['0']?.hand.length ?? 0) === (afterDrawSummary.handCounts['0'] ?? 0) - 1
                && core.turn >= beforeTurn
            );
    }, {
        timeout: args.afterHostTurnTimeoutMs,
        message: `${args.roundLabel}: 等待 host 结束回合后要么轮到 ${args.aiSeatIds.map((seatId) => `seat${seatId}`).join('/')} local AI，要么直接触发终局`,
    }).toBe(true);

    const afterHostState = await readOnlineAiMatchState(args.matchId, args.page);
    if (afterHostState.sys?.gameover) {
        return { kind: 'gameover' as const };
    }

    return {
        kind: 'ai-turn' as const,
        summary: await readOnlineAiStateSummary(args.matchId, args.page),
    };
}

async function waitForMultiSeatAiRoundtripOrGameOver(args: {
    matchId: string;
    page: Page;
    liveActionButton: ReturnType<Page['getByTestId']>;
    aiTurnSummary: OnlineAiSummary;
    roundLabel: string;
    aiRoundtripTimeoutMs: number;
    settledAiSeatIds?: string[];
}) {
    await expect.poll(async () => {
        const state = await readOnlineAiMatchState(args.matchId, args.page);
        const record = state as { core?: FantasyRealmsCore; G?: { core?: FantasyRealmsCore }; sys?: { gameover?: unknown } };
        const core = record.core ?? record.G?.core;
        if (!core) return false;
        return Boolean(record.sys?.gameover)
            || (
                core.currentPlayer === '0'
                && core.stage === 'draw'
                && core.turn > (args.aiTurnSummary.turn ?? 0)
                && (core.players['0']?.hand.length ?? 0) === (args.aiTurnSummary.handCounts['0'] ?? 0)
                && (args.settledAiSeatIds ?? []).every((seatId) => (core.players[seatId]?.hand.length ?? 0) === 7)
            );
    }, {
        timeout: args.aiRoundtripTimeoutMs,
        message: `${args.roundLabel}: 等待 AI 串行托管链完成并把回合交回 host，或直接触发终局`,
    }).toBe(true);

    const finalState = await readOnlineAiMatchState(args.matchId, args.page);
    if (finalState.sys?.gameover) {
        return { kind: 'gameover' as const };
    }

    const afterAiSummary = await readOnlineAiStateSummary(args.matchId, args.page);
    expect(afterAiSummary.eventStreamNextId).not.toBeNull();
    expect(args.aiTurnSummary.eventStreamNextId).not.toBeNull();
    expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(args.aiTurnSummary.eventStreamNextId!);
    expect(
        afterAiSummary.drawPileCount !== args.aiTurnSummary.drawPileCount
        || afterAiSummary.discardSignature !== args.aiTurnSummary.discardSignature,
    ).toBe(true);
    await expect(args.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
    await expect(args.page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
    return {
        kind: 'human-turn' as const,
        summary: afterAiSummary,
    };
}

async function runMultiSeatNaturalOnlineAiScenario(
    match: OnlineAiRoomSetup,
    testInfo: TestInfo,
    options: MultiSeatNaturalOnlineAiOptions,
) {
    const { context, page, matchId, hostPlayerName, aiPlayerName, aiPlayerNames } = match;
    const diagnostics = attachPageDiagnostics(page);

    try {
        await clearEvidenceScreenshotsForTest(testInfo);

        const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
        let completedAiRoundtrips = 0;

        for (let round = 1; round <= options.maxRounds; round += 1) {
            const roundLabel = `${options.roundLabelPrefix}第${round}轮`;
            const afterHost = await completeHostDeckTurnUntilAiOrGameOver({
                matchId,
                page,
                liveActionButton,
                aiSeatIds: options.aiSeatIds,
                roundLabel,
                afterHostTurnTimeoutMs: options.afterHostTurnTimeoutMs,
            });
            if (afterHost.kind === 'gameover') {
                break;
            }

            const afterAi = await waitForMultiSeatAiRoundtripOrGameOver({
                matchId,
                page,
                liveActionButton,
                aiTurnSummary: afterHost.summary,
                roundLabel,
                aiRoundtripTimeoutMs: options.aiRoundtripTimeoutMs,
                settledAiSeatIds: options.settledAiSeatIds,
            });
            if (afterAi.kind === 'human-turn') {
                completedAiRoundtrips += 1;
                continue;
            }
            break;
        }

        expect(completedAiRoundtrips).toBeGreaterThanOrEqual(options.minCompletedAiRoundtrips);

        if (!options.expectGameOver) {
            const currentSummary = await readOnlineAiStateSummary(matchId, page);
            expect(currentSummary.currentPlayer).toBe('0');
            expect(currentSummary.stage).toBe('draw');
            await expect(page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME })).toBeVisible({ timeout: 10000 });
            await expect(page.getByText('终局复盘')).toHaveCount(0);

            const evidencePath = getEvidenceScreenshotPath(testInfo, options.evidenceName);
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: options.diagnosticsLabel, diagnostics }]);
            return;
        }

        const finalState = await readOnlineAiMatchState(matchId, page);
        const finalCore = await readOnlineAiCore(matchId, page);
        const gameOverResult = finalState.sys?.gameover ?? FantasyRealmsDomain.isGameOver?.(finalCore);
        if (!gameOverResult) {
            throw new Error(`Expected real ${options.numPlayers}-player online AI game from opening to reach Fantasy Realms gameOver`);
        }

        await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('最终排名')).toBeVisible();
        await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

        const sortedStandings: FinalStanding[] = Object.entries((gameOverResult as { scores?: Record<string, number> }).scores ?? {})
            .sort((left, right) => right[1] - left[1])
            .map(([playerId, score], index) => ({
                rank: index + 1,
                playerName: playerId === '0'
                    ? hostPlayerName
                    : playerId === '1'
                        ? aiPlayerName
                        : aiPlayerNames[playerId] ?? finalCore.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`,
                score,
            }));
        await expectFinalStandingsVisible(page, sortedStandings);

        const evidencePath = getEvidenceScreenshotPath(testInfo, options.evidenceName);
        await mkdir(dirname(evidencePath), { recursive: true });
        await page.screenshot({ path: evidencePath, fullPage: false });

        assertNoFatalFrontendErrors([{ label: options.diagnosticsLabel, diagnostics }]);
    } finally {
        await context.close().catch(() => {});
    }
}

test.describe('FantasyRealms online AI golden flows', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('在线房里 human 与 seat1 local AI 可从真实开局一路推进到自然终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(420000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms full online AI game test.');
        }

        await runMultiSeatNaturalOnlineAiScenario(match!, testInfo, {
            numPlayers: 2,
            aiSeatIds: ['1'],
            roundLabelPrefix: '自然对局',
            afterHostTurnTimeoutMs: 15000,
            aiRoundtripTimeoutMs: 35000,
            minCompletedAiRoundtrips: 3,
            maxRounds: 24,
            expectGameOver: true,
            evidenceName: 'online-ai-full-game-natural-gameover',
            diagnosticsLabel: 'fantasyrealms-online-ai-full-game-natural-gameover',
        });
    });

    test('3人在线房里 host 与 seat1 / seat2 local AI 可从真实开局一路推进到自然终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(600000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 3,
            aiSeatIds: ['1', '2'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 3-player full online AI game test.');
        }

        await runMultiSeatNaturalOnlineAiScenario(match!, testInfo, {
            numPlayers: 3,
            aiSeatIds: ['1', '2'],
            roundLabelPrefix: '3人自然对局',
            afterHostTurnTimeoutMs: 20000,
            aiRoundtripTimeoutMs: 50000,
            minCompletedAiRoundtrips: 2,
            maxRounds: 24,
            expectGameOver: true,
            evidenceName: 'online-ai-three-player-full-game-natural-gameover',
            diagnosticsLabel: 'fantasyrealms-online-ai-three-player-full-game-natural-gameover',
            settledAiSeatIds: ['1', '2'],
        });
    });

    test('4人在线房里 host 与 seat1 / seat2 / seat3 local AI 可从真实开局完成一整轮串行托管并把回合交回 host', async ({ browser }, testInfo) => {
        test.setTimeout(240000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 4,
            aiSeatIds: ['1', '2', '3'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 4-player online AI roundtrip test.');
        }

        await runMultiSeatNaturalOnlineAiScenario(match!, testInfo, {
            numPlayers: 4,
            aiSeatIds: ['1', '2', '3'],
            roundLabelPrefix: '4人自然对局',
            afterHostTurnTimeoutMs: 20000,
            aiRoundtripTimeoutMs: 60000,
            minCompletedAiRoundtrips: 1,
            maxRounds: 1,
            expectGameOver: false,
            evidenceName: 'online-ai-four-player-opening-roundtrip',
            diagnosticsLabel: 'fantasyrealms-online-ai-four-player-opening-roundtrip',
            settledAiSeatIds: ['1', '2', '3'],
        });
    });

    test('5人在线房里 host 与 seat1 / seat2 / seat3 / seat4 local AI 可从真实开局完成一整轮串行托管并把回合交回 host', async ({ browser }, testInfo) => {
        test.setTimeout(300000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 5,
            aiSeatIds: ['1', '2', '3', '4'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 5-player online AI roundtrip test.');
        }

        await runMultiSeatNaturalOnlineAiScenario(match!, testInfo, {
            numPlayers: 5,
            aiSeatIds: ['1', '2', '3', '4'],
            roundLabelPrefix: '5人自然对局',
            afterHostTurnTimeoutMs: 20000,
            aiRoundtripTimeoutMs: 100000,
            minCompletedAiRoundtrips: 1,
            maxRounds: 1,
            expectGameOver: false,
            evidenceName: 'online-ai-five-player-opening-roundtrip',
            diagnosticsLabel: 'fantasyrealms-online-ai-five-player-opening-roundtrip',
        });
    });

    test('6人在线房里 host 与 seat1 / seat2 / seat3 / seat4 / seat5 local AI 可从真实开局一路推进到自然终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(1200000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '2', '3', '4', '5'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player full online AI game test.');
        }

        await runMultiSeatNaturalOnlineAiScenario(match!, testInfo, {
            numPlayers: 6,
            aiSeatIds: ['1', '2', '3', '4', '5'],
            roundLabelPrefix: '6人自然对局',
            afterHostTurnTimeoutMs: 20000,
            aiRoundtripTimeoutMs: 130000,
            minCompletedAiRoundtrips: 2,
            maxRounds: 24,
            expectGameOver: true,
            evidenceName: 'online-ai-six-player-full-game-natural-gameover',
            diagnosticsLabel: 'fantasyrealms-online-ai-six-player-full-game-natural-gameover',
        });
    });
});
