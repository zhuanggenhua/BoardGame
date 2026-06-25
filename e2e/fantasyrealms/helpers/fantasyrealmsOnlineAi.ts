import { expect, type BrowserContext, type Page } from '@playwright/test';
import type { MatchState } from '../../../src/engine/types';
import { FantasyRealmsDomain, evaluateFantasyRealmsScore } from '../../../src/games/fantasyrealms/domain';
import type { FantasyRealmsCore } from '../../../src/games/fantasyrealms/domain';
import { OFFICIAL_FANTASY_REALMS_CARDS } from '../../../src/games/fantasyrealms/data/cards';
import {
    FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE,
    FANTASY_REALMS_DUEL_SETUP_VALUE,
    FANTASY_REALMS_EXPANSION_SETUP_FIELD,
    FANTASY_REALMS_VARIANT_SETUP_FIELD,
} from '../../../src/games/fantasyrealms/roomSetup';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../../framework/evidenceScreenshots';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForMatchAvailable,
} from '../../helpers/common';
import { getMatchState, injectMatchState } from '../../helpers/state-injection';

export const GAME_NAME = 'fantasyrealms';
const FANTASY_REALMS_DECK_DRAW_BUTTON_NAME = /摸牌/;
export type FantasyRealmsMatchState = MatchState<FantasyRealmsCore>;

export type OnlineAiSummary = {
    currentPlayer: string | null;
    turn: number | null;
    stage: string | null;
    drawPileCount: number;
    discardCount: number;
    discardSignature: string;
    handCounts: Record<string, number>;
    eventStreamNextId: number | null;
};

export type FinalStanding = {
    rank: number;
    playerName: string;
    score: number;
};

export type OnlineAiRoomSetup = {
    context: BrowserContext;
    page: Page;
    matchId: string;
    hostPlayerName: string;
    aiPlayerName: string;
    aiPlayerNames: Record<string, string>;
};

export type OnlineAiRoomOptions = {
    aiMinimumActionDelayMs?: number;
    numPlayers?: number;
    aiSeatIds?: string[];
};

export type OnlineAiHumanSeat = {
    context: BrowserContext;
    page: Page;
    playerId: string;
    playerName: string;
};

export type OnlineAiMixedRoomSetup = {
    matchId: string;
    host: OnlineAiHumanSeat;
    humansBySeat: Record<string, OnlineAiHumanSeat>;
    aiPlayerNames: Record<string, string>;
};

export const random = {
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
};

export const byId = (cardId: string) => {
    const card = OFFICIAL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`Unknown Fantasy Realms card: ${cardId}`);
    }
    return { ...card };
};

export const summarize = (hand: ReturnType<typeof byId>[], discardPile: ReturnType<typeof byId>[]) => {
    const evaluation = evaluateFantasyRealmsScore(hand, discardPile);
    return {
        score: evaluation.totalScore,
        scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
    };
};

export function createAiTakeDiscardBranchCore(): FantasyRealmsCore {
    const baseCore = FantasyRealmsDomain.setup(['0', '1'], random);
    const aiLongbow = byId('weapon-elven-longbow');
    const aiNecromancer = byId('wizard-necromancer');
    const aiBellTower = byId('land-bell-tower');
    const aiSword = byId('weapon-sword-of-keth');
    const aiMirage = byId('wild-mirage');
    const aiCollector = byId('wizard-collector');
    const aiRainstorm = byId('weather-rainstorm');
    const hostDragon = byId('beast-dragon');
    const hostRangers = byId('army-rangers');
    const hostForge = byId('flame-forge');
    const hostKing = byId('leader-king');
    const hostQueen = byId('leader-queen');
    const hostUnicorn = byId('beast-unicorn');
    const hostBellTower = byId('land-bell-tower');
    const airElemental = byId('weather-air-elemental');
    const bookOfChanges = byId('artifact-book-of-changes');
    const worldTree = byId('artifact-world-tree');
    const warlockLord = byId('wizard-warlock-lord');
    const warship = byId('weapon-warship');

    const discardPile = [airElemental, bookOfChanges];
    const hostHand = [hostDragon, hostRangers, hostForge, hostKing, hostQueen, hostUnicorn, hostBellTower];
    const aiHand = [aiLongbow, aiNecromancer, aiBellTower, aiSword, aiMirage, aiCollector, aiRainstorm];
    const drawPile = [worldTree, warlockLord, warship];
    const currentFocusCard = airElemental;

    return {
        ...baseCore,
        currentPlayer: '1',
        turn: 4,
        stage: 'draw',
        drawPile,
        discardPile,
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: hostHand,
                ...summarize(hostHand, discardPile),
            },
            '1': {
                ...baseCore.players['1']!,
                hand: aiHand,
                ...summarize(aiHand, discardPile),
            },
        },
        focusCardId: currentFocusCard.id,
    };
}

export function createAiDiscardToGameOverCore(): FantasyRealmsCore {
    const baseCore = FantasyRealmsDomain.setup(['0', '1'], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 11);
    const hostHand = cards.slice(11, 18);
    const aiHand = cards.slice(18, 26);
    const drawPile = cards.slice(26);
    const currentFocusCard = aiHand[0]!;

    return {
        ...baseCore,
        currentPlayer: '1',
        turn: 8,
        stage: 'discard',
        drawPile,
        discardPile,
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: hostHand,
                ...summarize(hostHand, discardPile),
            },
            '1': {
                ...baseCore.players['1']!,
                hand: aiHand,
                ...summarize(aiHand, discardPile),
            },
        },
        focusCardId: currentFocusCard.id,
    };
}

export function createSixPlayerMixedWaitingToReviewCore(): FantasyRealmsCore {
    const baseCore = FantasyRealmsDomain.setup(['0', '1', '2', '3', '4', '5'], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 9);
    const hands = {
        '0': cards.slice(9, 16),
        '1': cards.slice(16, 23),
        '2': cards.slice(23, 30),
        '3': cards.slice(30, 37),
        '4': cards.slice(37, 45),
        '5': cards.slice(45, 52),
    } satisfies Record<string, ReturnType<typeof byId>[]>;
    const drawPile = cards.slice(52);
    const focusCard = discardPile[discardPile.length - 1]!;

    return {
        ...baseCore,
        currentPlayer: '4',
        turn: 8,
        stage: 'discard',
        drawPile,
        discardPile,
        players: Object.fromEntries(
            Object.entries(baseCore.players).map(([playerId, player]) => {
                const hand = hands[playerId as keyof typeof hands] ?? [];
                return [playerId, {
                    ...player!,
                    hand,
                    ...summarize(hand, discardPile),
                }];
            }),
        ) as FantasyRealmsCore['players'],
        focusCardId: focusCard.id,
    };
}

export function createOnlineAiNearReviewCore(playerIds: string[], currentPlayer: string, turn = 8): FantasyRealmsCore {
    const baseCore = FantasyRealmsDomain.setup(playerIds, random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 9);
    let cursor = discardPile.length;
    const hands = Object.fromEntries(
        playerIds.map((playerId) => {
            const handSize = playerId === currentPlayer ? 8 : 7;
            const hand = cards.slice(cursor, cursor + handSize);
            cursor += handSize;
            return [playerId, hand];
        }),
    ) as Record<string, ReturnType<typeof byId>[]>;
    const drawPile = cards.slice(cursor);
    const focusCard = discardPile[discardPile.length - 1]!;

    return {
        ...baseCore,
        currentPlayer,
        turn,
        stage: 'discard',
        drawPile,
        discardPile,
        players: Object.fromEntries(
            Object.entries(baseCore.players).map(([playerId, player]) => {
                const hand = hands[playerId] ?? [];
                return [playerId, {
                    ...player!,
                    hand,
                    ...summarize(hand, discardPile),
                }];
            }),
        ) as FantasyRealmsCore['players'],
        focusCardId: focusCard.id,
    };
}

export async function injectOnlineAiCore(matchId: string, page: Page, core: FantasyRealmsCore) {
    const currentState = await readOnlineAiMatchState(matchId, page);
    await injectMatchState(matchId, {
        ...currentState,
        sys: {
            ...(currentState.sys ?? {}),
            matchId,
            gameover: null,
            turnOrder: [...core.playerIds],
            currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
        },
        core,
    }, page);
}

export async function createFantasyRealmsAiRoom(
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
    const setupSelections: Record<string, string> = {
        [FANTASY_REALMS_EXPANSION_SETUP_FIELD]: FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE,
        ...(numPlayers === 2
            ? { [FANTASY_REALMS_VARIANT_SETUP_FIELD]: FANTASY_REALMS_DUEL_SETUP_VALUE }
            : {}),
    };
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
                ...setupSelections,
                setupSelections,
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

export async function claimSeatViaApi(args: {
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

export async function seedAiSeatCredentials(
    page: Page,
    matchId: string,
    credentials: Record<string, string>,
) {
    await page.evaluate(({ targetMatchId, nextCredentials }) => {
        localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(nextCredentials));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { targetMatchId: matchId, nextCredentials: credentials });
}

export async function createPlayerContext(
    browser: NonNullable<BrowserContext['browser']>,
    baseURL: string | undefined,
    storageKey: string,
) {
    const context = await browser.newContext({ baseURL });
    await initContext(context, {
        storageKey,
        skipImageGate: true,
        gameServerBaseURL: getGameServerBaseURL(),
    });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    return { context, page };
}

async function rescueFantasyRealmsRenderError(page: Page): Promise<boolean> {
    const reloadButton = page.getByRole('button', { name: /刷新页面 Reload|刷新|Reload|重试|Retry/i }).first();
    const errorHeading = page.getByText('页面出了点问题').first();
    const shouldRescue = await errorHeading.isVisible({ timeout: 500 }).catch(() => false)
        || await reloadButton.isVisible({ timeout: 500 }).catch(() => false);
    if (!shouldRescue) {
        return false;
    }

    if (await reloadButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await reloadButton.click().catch(() => page.reload({ waitUntil: 'domcontentloaded' }));
    } else {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    }

    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await page.locator('body').waitFor({ state: 'visible', timeout: 1000 }).catch(() => undefined);
    return true;
}

async function waitForFantasyRealmsLiveOrCompactShell(page: Page, args: {
    urlPattern: RegExp;
    shellLabel: string;
    requireHandRow?: boolean;
}) {
    const deadline = Date.now() + 30000;
    let rescueCount = 0;
    const maxRescues = 2;
    let lastBodyText = '';
    const liveTable = page.getByTestId('fantasyrealms-live-table');
    const compactLayout = page.getByTestId('fantasyrealms-compact-layout');
    const handRow = page.getByTestId('fantasyrealms-hand-row');

    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        await expect(page).toHaveURL(args.urlPattern, { timeout: Math.min(remaining, 5000) });

        if (await liveTable.count() > 0 && await liveTable.first().isVisible().catch(() => false)) {
            await expect(page.getByTestId('fantasyrealms-live-topbar')).toBeVisible({ timeout: 10000 });
            const liveScoreStrip = page.getByTestId('fantasyrealms-live-score-strip');
            if (await liveScoreStrip.count() > 0) {
                await expect(liveScoreStrip).toBeVisible({ timeout: 10000 });
            }
            if (args.requireHandRow !== false) {
                await expect(handRow).toBeVisible({ timeout: 10000 });
            }
            return;
        }

        if (await compactLayout.count() > 0 && await compactLayout.first().isVisible().catch(() => false)) {
            if (args.requireHandRow !== false) {
                await expect(handRow).toBeVisible({ timeout: 10000 });
            }
            return;
        }

        if (rescueCount < maxRescues && await rescueFantasyRealmsRenderError(page)) {
            rescueCount += 1;
            continue;
        }

        lastBodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
        await page.waitForTimeout(200);
    }

    throw new Error(`等待 ${args.shellLabel} 超时，最后页面文本: ${lastBodyText.slice(0, 500)}`);
}

export async function waitForFantasyRealmsBoard(page: Page, expectedPlayerId: string) {
    await waitForFantasyRealmsLiveOrCompactShell(page, {
        urlPattern: new RegExp(`/play/${GAME_NAME}/match/.+\\?playerID=${expectedPlayerId}`),
        shellLabel: `Fantasy Realms 玩家页棋盘壳（playerID=${expectedPlayerId}）`,
        requireHandRow: false,
    });
}

export async function waitForFantasyRealmsSpectatorBoard(page: Page, matchId: string) {
    await waitForFantasyRealmsLiveOrCompactShell(page, {
        urlPattern: new RegExp(`/play/${GAME_NAME}/match/${matchId}\\?spectate=1$`),
        shellLabel: `Fantasy Realms spectator 棋盘壳（matchId=${matchId}）`,
        requireHandRow: false,
    });
}

export async function waitForFantasyRealmsSpectatorReviewBoard(page: Page, matchId: string) {
    await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/${matchId}\\?spectate=1$`), { timeout: 15000 });
    await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('fantasyrealms-live-endgame')).toBeVisible({ timeout: 10000 });
}

export async function waitForFantasyRealmsPlayerReviewBoard(page: Page, matchId: string, playerId: string) {
    await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/${matchId}\\?playerID=${playerId}$`), { timeout: 15000 });
    await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('fantasyrealms-live-endgame')).toBeVisible({ timeout: 10000 });
}

export async function expectFantasyRealmsSpectatorLiveNoLeak(page: Page) {
    await expect(page.getByText('你的回合')).toHaveCount(0);
    await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
    const liveScoreStrip = page.getByTestId('fantasyrealms-live-score-strip');
    if (await liveScoreStrip.count() > 0) {
        await expect(liveScoreStrip).toContainText('??');
        await expect(liveScoreStrip).toContainText('终局揭示');
    } else {
        await expect(page.getByText('??').first()).toBeVisible();
            await expect(page.getByText('终局揭示').first()).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /查看手牌|弃置手牌/ })).toHaveCount(0);
    await expect(page.locator('.fr-card-button--live-hand:visible')).toHaveCount(0);
}

export async function switchFantasyRealmsPageToCompactLandscapeLayout(page: Page) {
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('fantasyrealms-compact-layout')).toBeVisible({ timeout: 10000 });
}

export async function expectWaitingPageKeepsOpponentFocusHidden(args: {
    page: Page;
    hiddenCardName: string;
}) {
    await expect(args.page.getByText('你的回合')).toHaveCount(0);
    await expect(args.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
    await expectHiddenFocusPreviewNoLeak({
        page: args.page,
        hiddenCardName: args.hiddenCardName,
    });
}

export async function expectHiddenFocusPreviewNoLeak(args: {
    page: Page;
    hiddenCardName: string;
}) {
    await expect(args.page.getByText('焦点暂不可见')).toBeVisible();
    await expect(args.page.getByText('--')).toBeVisible();
    await expect(args.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'back');
    await expect(args.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('style', /fantasyrealms-base-card-back/);
    await expect(args.page.getByText(args.hiddenCardName)).toHaveCount(0);
}

export async function expectLiveWaitingScoreSummary(args: {
    page: Page;
    currentPlayerName: string;
    hiddenOtherName: string;
    expectedScore: number;
}) {
    const summaryRegion = args.page.getByLabel('玩家分数总览');
    await expect(args.page.getByText(args.currentPlayerName).first()).toBeVisible();
    await expect(summaryRegion).toBeVisible();
    const hiddenOtherRows = summaryRegion.locator('.fr-score-row').filter({
        has: summaryRegion.getByText(args.hiddenOtherName, { exact: true }),
    });
    const hiddenOtherRowCount = await hiddenOtherRows.count();
    if (hiddenOtherRowCount > 0) {
        const hiddenOtherRow = hiddenOtherRows.first();
        await expect(hiddenOtherRow.locator('.fr-score-row-total strong')).toHaveText('??');
        await expect(hiddenOtherRow.locator('.fr-score-badge')).not.toContainText('你');
    }
    const liveScoreBandTotal = args.page.locator('.fr-live-score-band-total');
    if (await liveScoreBandTotal.count() > 0) {
        await expect(liveScoreBandTotal).toHaveText(String(args.expectedScore));
    } else {
        await expect(summaryRegion.locator('.fr-score-row-total strong').filter({ hasText: String(args.expectedScore) }).first()).toBeVisible();
    }
}

export async function readOnlineAiStateSummary(matchId: string, page: Page): Promise<OnlineAiSummary> {
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

export async function waitForOnlineAiDrawTurnAfterEvent(args: {
    matchId: string;
    page: Page;
    playerId: string;
    afterEventStreamNextId: number | null;
    message: string;
    timeoutMs?: number;
}) {
    await expect.poll(async () => {
        const summary = await readOnlineAiStateSummary(args.matchId, args.page);
        return summary.currentPlayer === args.playerId
            && summary.stage === 'draw'
            && (summary.eventStreamNextId ?? 0) > (args.afterEventStreamNextId ?? 0);
    }, {
        timeout: args.timeoutMs ?? 120000,
        message: args.message,
    }).toBe(true);

    return await readOnlineAiStateSummary(args.matchId, args.page);
}

export async function waitForSingleOnlineAiRoundtrip(args: {
    matchId: string;
    page: Page;
    humanPlayerId: string;
    aiTurnSummary: OnlineAiSummary;
    roundLabel: string;
    timeoutMs?: number;
}) {
    const deckButton = args.page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME });

    await expect.poll(async () => {
        const summary = await readOnlineAiStateSummary(args.matchId, args.page);
        const handCount = summary.handCounts[args.humanPlayerId] ?? 0;
        const returnedToHumanDraw = summary.currentPlayer === args.humanPlayerId
            && summary.stage === 'draw'
            && (summary.turn ?? 0) > (args.aiTurnSummary.turn ?? 0)
            && handCount === (args.aiTurnSummary.handCounts[args.humanPlayerId] ?? 0);
        const returnedToHumanDiscard = summary.currentPlayer === args.humanPlayerId
            && summary.stage === 'discard'
            && (summary.turn ?? 0) > (args.aiTurnSummary.turn ?? 0)
            && handCount > (args.aiTurnSummary.handCounts[args.humanPlayerId] ?? 0);
        return returnedToHumanDraw || returnedToHumanDiscard;
    }, {
        timeout: args.timeoutMs ?? 35000,
        message: `${args.roundLabel}: 等待 seat1 local AI 完成一轮并把回合交回 human`,
    }).toBe(true);

    const afterAiSummary = await readOnlineAiStateSummary(args.matchId, args.page);
    expect(afterAiSummary.eventStreamNextId).not.toBeNull();
    expect(args.aiTurnSummary.eventStreamNextId).not.toBeNull();
    expect(afterAiSummary.eventStreamNextId!).toBeGreaterThan(args.aiTurnSummary.eventStreamNextId!);
    expect(
        afterAiSummary.drawPileCount !== args.aiTurnSummary.drawPileCount
        || afterAiSummary.discardSignature !== args.aiTurnSummary.discardSignature,
    ).toBe(true);
    await expect(args.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
    if (afterAiSummary.stage === 'draw') {
        await expect(deckButton).toBeVisible({ timeout: 10000 });
    } else {
        await expect(args.page.getByRole('button', { name: /弃置手牌/ }).first()).toBeVisible({ timeout: 10000 });
        await expect(args.page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
        await expect(deckButton).toHaveCount(0);
    }
    return afterAiSummary;
}

export async function completeNaturalHumanDeckTurn(args: {
    matchId: string;
    page: Page;
    playerId: string;
    roundLabel: string;
}) {
    const deckButton = args.page.getByRole('button', { name: FANTASY_REALMS_DECK_DRAW_BUTTON_NAME });
    const beforeSummary = await readOnlineAiStateSummary(args.matchId, args.page);
    const beforeHandCount = beforeSummary.handCounts[args.playerId] ?? 0;
    const beforeTurn = beforeSummary.turn ?? 0;
    const beforeDiscardCount = beforeSummary.discardCount;
    const alreadyInDiscardStage = beforeSummary.currentPlayer === args.playerId && beforeSummary.stage === 'discard';

    await expect(args.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
    if (alreadyInDiscardStage) {
        await expect(deckButton).toHaveCount(0);
    } else if (beforeDiscardCount === 0) {
        await expect(deckButton).toHaveCount(0);
    } else {
        await expect(deckButton).toBeVisible({ timeout: 10000 });
        await deckButton.click();
    }

    if (!alreadyInDiscardStage) {
        await expect.poll(async () => {
            const summary = await readOnlineAiStateSummary(args.matchId, args.page);
            return summary.currentPlayer === args.playerId
                && summary.stage === 'discard'
                && (summary.turn ?? 0) === beforeTurn
                && (summary.handCounts[args.playerId] ?? 0) > beforeHandCount;
        }, {
            timeout: 10000,
            message: `${args.roundLabel}: 等待 human 从 draw 进入 discard`,
        }).toBe(true);
    }

    const afterDrawSummary = await readOnlineAiStateSummary(args.matchId, args.page);
    await expect(args.page.getByRole('button', { name: /弃置手牌/ }).first()).toBeVisible({ timeout: 10000 });
    await expect(args.page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
    const discardHandButton = args.page.getByRole('button', { name: /弃置手牌/ }).first();
    await discardHandButton.click();

    await expect.poll(async () => {
        const summary = await readOnlineAiStateSummary(args.matchId, args.page);
        return summary.currentPlayer !== args.playerId
            && summary.discardCount >= beforeDiscardCount + 1
            && (summary.handCounts[args.playerId] ?? 0) === (afterDrawSummary.handCounts[args.playerId] ?? 0) - 1;
    }, {
        timeout: 10000,
        message: `${args.roundLabel}: 等待 human 完成弃牌并把回合交给下一位玩家`,
    }).toBe(true);

    return await readOnlineAiStateSummary(args.matchId, args.page);
}

export async function bridgeMixedRoomToSecondHumanDrawTurn(args: {
    matchId: string;
    hostPage: Page;
    waitingHumanPage: Page;
    waitingHumanPlayerId: string;
    timeoutMs?: number;
}) {
    const afterHostFirstTurn = await completeNaturalHumanDeckTurn({
        matchId: args.matchId,
        page: args.hostPage,
        playerId: '0',
        roundLabel: '6人 mixed-room 真实开局第 1 手 host',
    });

    await waitForOnlineAiDrawTurnAfterEvent({
        matchId: args.matchId,
        page: args.waitingHumanPage,
        playerId: args.waitingHumanPlayerId,
        afterEventStreamNextId: afterHostFirstTurn.eventStreamNextId,
        timeoutMs: args.timeoutMs,
        message: '等待 seat1 local AI 在真实开局后把回合交给 waiting 人类第 1 手',
    });

    const afterWaitingHumanFirstTurn = await completeNaturalHumanDeckTurn({
        matchId: args.matchId,
        page: args.waitingHumanPage,
        playerId: args.waitingHumanPlayerId,
        roundLabel: `6人 mixed-room 真实开局第 1 手 seat${args.waitingHumanPlayerId}`,
    });

    await waitForOnlineAiDrawTurnAfterEvent({
        matchId: args.matchId,
        page: args.hostPage,
        playerId: '0',
        afterEventStreamNextId: afterWaitingHumanFirstTurn.eventStreamNextId,
        timeoutMs: args.timeoutMs,
        message: '等待后半段 local AI 完成首轮托管，并把回合交回 host 第 2 手',
    });

    const afterHostSecondTurn = await completeNaturalHumanDeckTurn({
        matchId: args.matchId,
        page: args.hostPage,
        playerId: '0',
        roundLabel: '6人 mixed-room 真实开局第 2 手 host',
    });

    const secondWaitingHumanDrawTurn = await waitForOnlineAiDrawTurnAfterEvent({
        matchId: args.matchId,
        page: args.waitingHumanPage,
        playerId: args.waitingHumanPlayerId,
        afterEventStreamNextId: afterHostSecondTurn.eventStreamNextId,
        timeoutMs: args.timeoutMs,
        message: '等待第二轮 local AI 完成托管，并把回合交回 waiting 人类第 2 手',
    });

    return {
        afterHostFirstTurn,
        afterWaitingHumanFirstTurn,
        afterHostSecondTurn,
        secondWaitingHumanDrawTurn,
    };
}

export async function readOnlineAiMatchState(matchId: string, page: Page): Promise<FantasyRealmsMatchState> {
    return await getMatchState(matchId, page) as FantasyRealmsMatchState;
}

export async function readOnlineAiCore(matchId: string, page: Page): Promise<FantasyRealmsCore> {
    const state = await readOnlineAiMatchState(matchId, page);
    const record = state as { core?: FantasyRealmsCore; G?: { core?: FantasyRealmsCore } };
    const core = record.core ?? record.G?.core;
    if (!core) {
        throw new Error(`Failed to read Fantasy Realms online AI core for match ${matchId}`);
    }
    return core;
}

export async function waitForNearReviewInjectionOrImmediateGameOver(args: {
    matchId: string;
    page: Page;
    currentPlayer: string;
    turn: number;
    discardCount: number;
    currentHandCount: number;
    message: string;
}) {
    await expect.poll(async () => {
        const [summary, state] = await Promise.all([
            readOnlineAiStateSummary(args.matchId, args.page),
            readOnlineAiMatchState(args.matchId, args.page),
        ]);
        if (state.sys?.gameover) {
            return true;
        }
        return summary.currentPlayer === args.currentPlayer
            && summary.turn === args.turn
            && summary.stage === 'discard'
            && summary.discardCount === args.discardCount
            && (summary.handCounts[args.currentPlayer] ?? 0) === args.currentHandCount;
    }, {
        timeout: 10000,
        message: args.message,
    }).toBe(true);
}

export async function expectFinalStandingsVisible(page: Page, standings: FinalStanding[]) {
    const standingsRegion = page.getByTestId('fantasyrealms-live-endgame');
    await expect(standingsRegion).toBeVisible();
    const rows = standingsRegion.locator('.fr-live-endgame-rank-button');
    await expect(rows).toHaveCount(standings.length);
    for (const [index, standing] of standings.entries()) {
        const row = rows.nth(index);
        await expect(row).toBeVisible();
        await expect(row).toContainText(`第 ${standing.rank} 名`);
        await expect(row).toContainText(standing.playerName);
        await expect(row.locator('[data-score-role="final-score"]')).toHaveText(String(standing.score));
    }
}

export async function openFantasyRealmsOnlineAiRoom(
    browser: NonNullable<BrowserContext['browser']>,
    baseURL: string | undefined,
    options?: OnlineAiRoomOptions,
): Promise<OnlineAiRoomSetup | null> {
    const context = await browser.newContext({ baseURL });
    await initContext(context, {
        storageKey: '__fantasyrealms_online_ai__',
        skipImageGate: true,
        gameServerBaseURL: getGameServerBaseURL(),
    });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90000 });

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

    await page.goto(`/play/${GAME_NAME}/match/${room.matchId}?playerID=${room.ownerPlayerId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
    });
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

export async function openFantasyRealmsOnlineAiMixedRoom(
    browser: NonNullable<BrowserContext['browser']>,
    baseURL: string | undefined,
    options: OnlineAiRoomOptions & { humanSeatIds: string[] },
): Promise<OnlineAiMixedRoomSetup | null> {
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, {
        storageKey: '__fantasyrealms_online_ai_mixed_host__',
        skipImageGate: true,
        gameServerBaseURL: getGameServerBaseURL(),
    });
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 90000 });

    if (!(await ensureGameServerAvailable(hostPage, getGameServerBaseURL()))) {
        await hostContext.close();
        return null;
    }

    const aiSeatIds = options.aiSeatIds ?? [];
    const room = await createFantasyRealmsAiRoom(hostPage, options);
    if (!room) {
        throw new Error('Failed to create Fantasy Realms mixed online AI room');
    }

    if (!(await waitForMatchAvailable(hostPage, GAME_NAME, room.matchId, 20000))) {
        throw new Error(`Fantasy Realms mixed online AI match not available: ${room.matchId}`);
    }

    const hostPlayerName = `Host-FR-AI-Mixed-${Date.now()}`;
    const hostCredentials = room.ownerCredentials ?? await claimSeatViaApi({
        page: hostPage,
        matchId: room.matchId,
        playerId: room.ownerPlayerId,
        guestId: room.ownerGuestId,
        playerName: hostPlayerName,
    });
    if (!hostCredentials) {
        throw new Error('Host failed to claim Fantasy Realms mixed online AI seat');
    }

    const aiPlayerNames: Record<string, string> = {};
    const aiCredentialsBySeat: Record<string, string> = {};
    for (const seatId of aiSeatIds) {
        const aiGuestId = `fr-online-ai-mixed-seat${seatId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const aiPlayerName = `AI-FR-Mixed-${seatId}-${Date.now()}`;
        const aiCredentials = await joinMatchViaAPI(
            hostPage,
            GAME_NAME,
            room.matchId,
            seatId,
            aiPlayerName,
            aiGuestId,
        );
        if (!aiCredentials) {
            throw new Error(`AI seat ${seatId} failed to claim Fantasy Realms mixed online AI seat`);
        }
        aiPlayerNames[seatId] = aiPlayerName;
        aiCredentialsBySeat[seatId] = aiCredentials;
    }

    await seedMatchCredentials(hostContext, GAME_NAME, room.matchId, room.ownerPlayerId, hostCredentials);
    await hostContext.addInitScript(({ targetMatchId, targetCredentials }) => {
        localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(targetCredentials));
    }, { targetMatchId: room.matchId, targetCredentials: aiCredentialsBySeat });

    await hostPage.goto(`/play/${GAME_NAME}/match/${room.matchId}?playerID=${room.ownerPlayerId}`, { waitUntil: 'domcontentloaded' });
    await waitForFantasyRealmsBoard(hostPage, room.ownerPlayerId);
    await seedAiSeatCredentials(hostPage, room.matchId, aiCredentialsBySeat);

    const humansBySeat: Record<string, OnlineAiHumanSeat> = {};
    for (const seatId of options.humanSeatIds) {
        const human = await createPlayerContext(
            browser,
            baseURL,
            `__fantasyrealms_online_ai_mixed_human_${seatId}__`,
        );
        const playerName = `Human-FR-Mixed-${seatId}-${Date.now()}`;
        const guestId = `fr-online-ai-mixed-human-${seatId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const credentials = await joinMatchViaAPI(
            human.page,
            GAME_NAME,
            room.matchId,
            seatId,
            playerName,
            guestId,
        );
        if (!credentials) {
            throw new Error(`Human seat ${seatId} failed to claim Fantasy Realms mixed online AI seat`);
        }
        await seedMatchCredentials(human.context, GAME_NAME, room.matchId, seatId, credentials);
        await human.page.goto(`/play/${GAME_NAME}/match/${room.matchId}?playerID=${seatId}`, { waitUntil: 'domcontentloaded' });
        await waitForFantasyRealmsBoard(human.page, seatId);
        humansBySeat[seatId] = {
            context: human.context,
            page: human.page,
            playerId: seatId,
            playerName,
        };
    }

    return {
        matchId: room.matchId,
        host: {
            context: hostContext,
            page: hostPage,
            playerId: room.ownerPlayerId,
            playerName: hostPlayerName,
        },
        humansBySeat,
        aiPlayerNames,
    };
}


export {
    FantasyRealmsDomain,
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    injectMatchState,
};
