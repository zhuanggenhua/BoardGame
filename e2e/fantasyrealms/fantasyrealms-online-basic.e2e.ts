import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { MatchState } from '../../src/engine/types';
import { FantasyRealmsDomain, evaluateFantasyRealmsScore } from '../../src/games/fantasyrealms/domain';
import { getDeckDrawCount, requiresDiscardAfterTakingDiscard } from '../../src/games/fantasyrealms/domain/commands';
import type { FantasyRealmsCore } from '../../src/games/fantasyrealms/domain';
import { OFFICIAL_FANTASY_REALMS_CARDS } from '../../src/games/fantasyrealms/data/cards';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForMatchAvailable,
} from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';

const GAME_NAME = 'fantasyrealms';
type FantasyRealmsMatchState = MatchState<FantasyRealmsCore>;

type FantasyRealmsCreateRoomResult = {
    matchID: string;
    ownerPlayerID?: string;
    ownerCredentials?: string;
    ownerGuestId: string;
};

type FantasyRealmsOnlinePlayer = {
    context: BrowserContext;
    page: Page;
    playerId: string;
    playerName: string;
    guestId: string;
    role: 'host' | 'guest';
};

type FinalStanding = {
    rank: number;
    playerName: string;
    score: number;
};

type FantasyRealmsTurnSnapshot = {
    currentPlayer: string;
    turn: number;
    stage: FantasyRealmsCore['stage'];
    handCount: number;
    discardCount: number;
};

async function createFantasyRealmsRoom(
    page: Page,
    numPlayers = 2,
): Promise<FantasyRealmsCreateRoomResult | null> {
    const gameServerBaseURL = getGameServerBaseURL();
    const ownerGuestId = `fr-owner-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const response = await page.request.post(`${gameServerBaseURL}/games/${GAME_NAME}/create`, {
        data: {
            numPlayers,
            setupData: {
                guestId: ownerGuestId,
                ownerKey: `guest:${ownerGuestId}`,
                ownerType: 'guest',
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
        matchID: data.matchID,
        ownerPlayerID: data.ownerPlayerID,
        ownerCredentials: data.ownerCredentials,
        ownerGuestId,
    };
}

async function claimSeatViaApi(args: {
    page: Page;
    gameName: string;
    matchId: string;
    playerId: string;
    guestId: string;
    playerName: string;
}): Promise<string | null> {
    const base = getGameServerBaseURL();
    const response = await args.page.request.post(`${base}/games/${args.gameName}/${args.matchId}/claim-seat`, {
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

const random = {
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
};

const applyCommand = (core: FantasyRealmsCore, command: { type: 'DISCARD_CARD'; playerId: string; payload: { cardId: string }; timestamp: number }) => {
    const events = FantasyRealmsDomain.execute({ core, sys: {} as Record<string, never> }, command, random);
    return events.reduce((nextCore, event) => FantasyRealmsDomain.reduce(nextCore, event), core);
};

const byId = (cardId: string) => {
    const card = OFFICIAL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`Unknown Fantasy Realms card: ${cardId}`);
    }
    return { ...card };
};

const nearEndDiscardCore = (): FantasyRealmsCore => {
    const baseCore = FantasyRealmsDomain.setup(['0', '1'], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 11);
    const playerZeroHand = cards.slice(11, 19);
    const playerOneHand = cards.slice(19, 26);
    const currentFocusCard = playerZeroHand[0]!;
    const core: FantasyRealmsCore = {
        ...baseCore,
        currentPlayer: '0',
        turn: 12,
        stage: 'discard',
        drawPile: cards.slice(26),
        discardPile,
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: playerZeroHand,
                score: 0,
                scoreBreakdown: [],
            },
            '1': {
                ...baseCore.players['1']!,
                hand: playerOneHand,
                score: 0,
                scoreBreakdown: [],
            },
        },
        focusCardId: currentFocusCard.id,
    };

    const recalculated = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const evaluation = evaluateFantasyRealmsScore(player.hand, discardPile);
            return [playerId, {
                ...player,
                score: evaluation.totalScore,
                scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
            }];
        }),
    ) as FantasyRealmsCore['players'];

    return {
        ...core,
        players: recalculated,
    };
};

const multiplayerTakeDiscardCore = (): FantasyRealmsCore => {
    const baseCore = FantasyRealmsDomain.setup(['0', '1', '2'], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 2);
    const playerZeroHand = cards.slice(2, 9);
    const playerOneHand = cards.slice(9, 16);
    const playerTwoHand = cards.slice(16, 23);
    const currentFocusCard = discardPile[discardPile.length - 1]!;

    const core: FantasyRealmsCore = {
        ...baseCore,
        currentPlayer: '0',
        turn: 3,
        stage: 'draw',
        drawPile: cards.slice(23),
        discardPile,
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: playerZeroHand,
                score: 0,
                scoreBreakdown: [],
            },
            '1': {
                ...baseCore.players['1']!,
                hand: playerOneHand,
                score: 0,
                scoreBreakdown: [],
            },
            '2': {
                ...baseCore.players['2']!,
                hand: playerTwoHand,
                score: 0,
                scoreBreakdown: [],
            },
        },
        focusCardId: currentFocusCard.id,
    };

    const recalculated = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const evaluation = evaluateFantasyRealmsScore(player.hand, discardPile);
            return [playerId, {
                ...player,
                score: evaluation.totalScore,
                scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
            }];
        }),
    ) as FantasyRealmsCore['players'];

    return {
        ...core,
        players: recalculated,
    };
};

const duelTakeDiscardRequiresDiscardCore = (): FantasyRealmsCore => {
    const baseCore = FantasyRealmsDomain.setup(['0', '1'], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 2);
    const playerZeroHand = cards.slice(2, 9);
    const playerOneHand = cards.slice(9, 16);
    const currentFocusCard = discardPile[discardPile.length - 1]!;

    const core: FantasyRealmsCore = {
        ...baseCore,
        currentPlayer: '0',
        turn: 5,
        stage: 'draw',
        drawPile: cards.slice(16),
        discardPile,
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: playerZeroHand,
                score: 0,
                scoreBreakdown: [],
            },
            '1': {
                ...baseCore.players['1']!,
                hand: playerOneHand,
                score: 0,
                scoreBreakdown: [],
            },
        },
        focusCardId: currentFocusCard.id,
    };

    const recalculated = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const evaluation = evaluateFantasyRealmsScore(player.hand, discardPile);
            return [playerId, {
                ...player,
                score: evaluation.totalScore,
                scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
            }];
        }),
    ) as FantasyRealmsCore['players'];

    return {
        ...core,
        players: recalculated,
    };
};

const duelFullHandDrawCore = (): FantasyRealmsCore => {
    const baseCore = FantasyRealmsDomain.setup(['0', '1'], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const playerZeroHand = cards.slice(0, 7);
    const playerOneHand = cards.slice(7, 14);
    const currentFocusCard = playerZeroHand[0]!;

    const core: FantasyRealmsCore = {
        ...baseCore,
        currentPlayer: '0',
        turn: 5,
        stage: 'draw',
        drawPile: cards.slice(14),
        discardPile: [],
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: playerZeroHand,
                score: 0,
                scoreBreakdown: [],
            },
            '1': {
                ...baseCore.players['1']!,
                hand: playerOneHand,
                score: 0,
                scoreBreakdown: [],
            },
        },
        focusCardId: currentFocusCard.id,
    };

    const recalculated = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const evaluation = evaluateFantasyRealmsScore(player.hand, []);
            return [playerId, {
                ...player,
                score: evaluation.totalScore,
                scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
            }];
        }),
    ) as FantasyRealmsCore['players'];

    return {
        ...core,
        players: recalculated,
    };
};

const spectatorLiveCore = (): FantasyRealmsCore => {
    const baseCore = FantasyRealmsDomain.setup(['0', '1', '2'], random);
    const discardPile = [
        byId('army-elven-archers'),
        byId('artifact-gem-of-order'),
    ];
    const core: FantasyRealmsCore = {
        ...baseCore,
        currentPlayer: '1',
        turn: 4,
        stage: 'draw',
        discardPile,
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: [
                    byId('weather-blizzard'),
                    byId('flood-great-flood'),
                    byId('flame-wildfire'),
                    byId('weapon-warship'),
                ],
                score: 29,
                scoreBreakdown: [],
            },
            '1': {
                ...baseCore.players['1']!,
                hand: [
                    byId('land-forest'),
                    byId('flame-forge'),
                    byId('weapon-sword-of-keth'),
                    byId('leader-king'),
                    byId('artifact-book-of-changes'),
                    byId('wizard-collector'),
                    byId('wild-shapeshifter'),
                ],
                score: 35,
                scoreBreakdown: [],
            },
            '2': {
                ...baseCore.players['2']!,
                hand: [
                    byId('beast-unicorn'),
                    byId('leader-princess'),
                    byId('flood-island'),
                    byId('weather-rainstorm'),
                    byId('weapon-magic-wand'),
                ],
                score: 33,
                scoreBreakdown: [],
            },
        },
        focusCardId: 'land-forest',
    };

    const recalculated = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const evaluation = evaluateFantasyRealmsScore(player.hand, discardPile);
            return [playerId, {
                ...player,
                score: evaluation.totalScore,
                scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
            }];
        }),
    ) as FantasyRealmsCore['players'];

    return {
        ...core,
        players: recalculated,
    };
};

const multiplayerOpeningCore = (): FantasyRealmsCore => FantasyRealmsDomain.setup(['0', '1', '2'], random);

const nearEndMultiplayerDiscardCore = (): FantasyRealmsCore => {
    const baseCore = FantasyRealmsDomain.setup(['0', '1', '2'], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 9);
    const playerZeroHand = cards.slice(9, 17);
    const playerOneHand = cards.slice(17, 24);
    const playerTwoHand = cards.slice(24, 31);
    const currentFocusCard = playerZeroHand[0]!;

    const core: FantasyRealmsCore = {
        ...baseCore,
        currentPlayer: '0',
        turn: 9,
        stage: 'discard',
        drawPile: cards.slice(31),
        discardPile,
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: playerZeroHand,
                score: 0,
                scoreBreakdown: [],
            },
            '1': {
                ...baseCore.players['1']!,
                hand: playerOneHand,
                score: 0,
                scoreBreakdown: [],
            },
            '2': {
                ...baseCore.players['2']!,
                hand: playerTwoHand,
                score: 0,
                scoreBreakdown: [],
            },
        },
        focusCardId: currentFocusCard.id,
    };

    const recalculated = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const evaluation = evaluateFantasyRealmsScore(player.hand, discardPile);
            return [playerId, {
                ...player,
                score: evaluation.totalScore,
                scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
            }];
        }),
    ) as FantasyRealmsCore['players'];

    return {
        ...core,
        players: recalculated,
    };
};

const nearEndSixPlayerDiscardCore = (): FantasyRealmsCore => {
    const playerIds = ['0', '1', '2', '3', '4', '5'] as const;
    const baseCore = FantasyRealmsDomain.setup([...playerIds], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 9);
    const currentPlayerHand = cards.slice(9, 17);
    const playerHands = [
        currentPlayerHand,
        cards.slice(17, 24),
        cards.slice(24, 31),
        cards.slice(31, 38),
        cards.slice(38, 45),
        cards.slice(45, 52),
    ];
    const currentFocusCard = currentPlayerHand[0]!;

    const players = Object.fromEntries(
        playerIds.map((playerId, index) => [playerId, {
            ...baseCore.players[playerId]!,
            hand: playerHands[index]!,
            score: 0,
            scoreBreakdown: [],
        }]),
    ) as FantasyRealmsCore['players'];

    const core: FantasyRealmsCore = {
        ...baseCore,
        currentPlayer: '0',
        turn: 11,
        stage: 'discard',
        drawPile: cards.slice(52),
        discardPile,
        players,
        focusCardId: currentFocusCard.id,
    };

    const recalculated = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const evaluation = evaluateFantasyRealmsScore(player.hand, discardPile);
            return [playerId, {
                ...player,
                score: evaluation.totalScore,
                scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
            }];
        }),
    ) as FantasyRealmsCore['players'];

    return {
        ...core,
        players: recalculated,
    };
};

async function createPlayerContext(
    browser: NonNullable<BrowserContext['browser']>,
    baseURL: string | undefined,
    storageKey: string,
) {
    const context = await browser.newContext({ baseURL });
    await initContext(context, {
        storageKey,
        skipImageGate: true,
    });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    return { context, page };
}

async function waitForFantasyRealmsBoard(page: Page, expectedPlayerId: string) {
    await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/.+\\?playerID=${expectedPlayerId}`), { timeout: 15000 });
    await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('fantasyrealms-live-topbar')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('fantasyrealms-live-score-strip')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('fantasyrealms-hand-row')).toBeVisible({ timeout: 10000 });
}

async function waitForFantasyRealmsReviewBoard(page: Page, expectedPlayerId: string) {
    await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/.+\\?playerID=${expectedPlayerId}`), { timeout: 15000 });
    await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.fr-endgame-list')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('fantasyrealms-focus-preview')).toBeVisible({ timeout: 10000 });
}

async function waitForFantasyRealmsSpectatorBoard(page: Page, matchId: string) {
    await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/${matchId}\\?spectate=1$`), { timeout: 15000 });
    await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('fantasyrealms-live-topbar')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('fantasyrealms-hand-row')).toBeVisible({ timeout: 10000 });
}

async function waitForFantasyRealmsSpectatorReviewBoard(page: Page, matchId: string) {
    await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/${matchId}\\?spectate=1$`), { timeout: 15000 });
    await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.fr-endgame-list')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('fantasyrealms-focus-preview')).toBeVisible({ timeout: 10000 });
}

async function expectFantasyRealmsSpectatorLiveNoLeak(page: Page) {
    await expect(page.getByText('你的回合')).toHaveCount(0);
    await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
    await expect(page.getByTestId('fantasyrealms-live-score-strip')).toContainText('??');
    await expect(page.getByTestId('fantasyrealms-live-score-strip')).toContainText('终局揭示');
    await expect(page.getByRole('button', { name: /查看手牌|弃置手牌/ })).toHaveCount(0);
}

async function switchFantasyRealmsPageToStackedLayout(page: Page) {
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('fantasyrealms-stacked-layout')).toBeVisible({ timeout: 10000 });
}

async function expectWaitingPageKeepsOpponentFocusHidden(args: {
    page: Page;
    hiddenCardName: string;
}) {
    await expect(args.page.getByText('你当前正在等待。这里仍可查看自己的手牌与公开弃牌，其他玩家的隐藏手牌不会在此展开。')).toHaveCount(0);
    await expect(args.page.getByText('多人局进行中：这里只公开你的官方总分，其他玩家分数会在终局统一揭示。')).toHaveCount(0);
    await expect(args.page.getByText('你的回合')).toHaveCount(0);
    await expect(args.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
    await expectHiddenFocusPreviewNoLeak({
        page: args.page,
        hiddenCardName: args.hiddenCardName,
    });
}

async function expectHiddenFocusPreviewNoLeak(args: {
    page: Page;
    hiddenCardName: string;
}) {
    await expect(args.page.getByText('焦点暂不可见')).toBeVisible();
    await expect(args.page.getByText('--')).toBeVisible();
    await expect(args.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'back');
    await expect(args.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('style', /fantasyrealms-base-card-back/);
    await expect(args.page.getByText(args.hiddenCardName)).toHaveCount(0);
}

async function expectLiveWaitingScoreSummary(args: {
    page: Page;
    currentPlayerName: string;
    hiddenOtherName: string;
    expectedScore: number;
}) {
    const summaryRegion = args.page.getByLabel('玩家分数总览');
    await expect(summaryRegion).toBeVisible();
    await expect(args.page.getByText(args.currentPlayerName)).toBeVisible();
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
        await expect(args.page.getByText('官方总分')).toHaveCount(0);
        await expect(args.page.getByText('终局揭示')).toHaveCount(0);
        await expect(args.page.getByText('当前行动')).toHaveCount(0);
    } else {
        await expect(summaryRegion.locator('.fr-score-row-total strong').filter({ hasText: String(args.expectedScore) }).first()).toBeVisible();
    }
}

async function expectFinalStandingsVisible(
    page: Page,
    standings: FinalStanding[],
) {
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

async function readFantasyRealmsCore(matchId: string, page: Page): Promise<FantasyRealmsCore> {
    const state = await getMatchState(matchId, page);
    const record = state as { core?: FantasyRealmsCore; G?: { core?: FantasyRealmsCore } };
    const core = record.core ?? record.G?.core;
    if (!core) {
        throw new Error(`Failed to read Fantasy Realms core for match ${matchId}`);
    }
    return core;
}

async function readFantasyRealmsMatchState(matchId: string, page: Page): Promise<FantasyRealmsMatchState> {
    return await getMatchState(matchId, page) as FantasyRealmsMatchState;
}

async function expectFantasyRealmsTurnSnapshot(
    matchId: string,
    page: Page,
    playerId: string,
    expected: FantasyRealmsTurnSnapshot,
    message: string,
) {
    await expect.poll(async () => {
        const core = await readFantasyRealmsCore(matchId, page);
        return {
            currentPlayer: core.currentPlayer,
            turn: core.turn,
            stage: core.stage,
            handCount: core.players[playerId]?.hand.length ?? -1,
            discardCount: core.discardPile.length,
        };
    }, {
        timeout: 15000,
        message,
    }).toEqual(expected);
}

async function completeOnlineDeckTurn(args: {
    matchId: string;
    actingPlayer: FantasyRealmsOnlinePlayer;
    nextPlayer: FantasyRealmsOnlinePlayer;
    observerPage?: Page;
}) {
    const observerPage = args.observerPage ?? args.actingPlayer.page;
    await expect(args.actingPlayer.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });

    const beforeCore = await readFantasyRealmsCore(args.matchId, observerPage);
    const beforeTurn = beforeCore.turn;
    const beforeHandCount = beforeCore.players[args.actingPlayer.playerId]?.hand.length ?? 0;
    const beforeDiscardCount = beforeCore.discardPile.length;
    const drawCount = getDeckDrawCount(beforeCore);

    const deckButton = args.actingPlayer.page.getByRole('button', { name: /从牌库摸 2 张并弃 1 张|从牌库摸 1 张/ });
    const liveActionButton = args.actingPlayer.page.getByTestId('fantasyrealms-live-action-button');
    await expect(liveActionButton).toContainText('抓一张牌');

    await deckButton.click();

    await expectFantasyRealmsTurnSnapshot(
        args.matchId,
        observerPage,
        args.actingPlayer.playerId,
        {
            currentPlayer: args.actingPlayer.playerId,
            turn: beforeTurn,
            stage: 'discard',
            handCount: beforeHandCount + drawCount,
            discardCount: beforeDiscardCount,
        },
        `等待玩家 ${args.actingPlayer.playerId} 从牌库摸牌后进入弃牌阶段`,
    );

    const firstHandDiscardButton = args.actingPlayer.page.getByRole('button', { name: /弃置手牌/ }).first();
    await firstHandDiscardButton.click();
    await expect(liveActionButton).toContainText('确认弃置');
    await liveActionButton.click();

    await expectFantasyRealmsTurnSnapshot(
        args.matchId,
        observerPage,
        args.actingPlayer.playerId,
        {
            currentPlayer: args.nextPlayer.playerId,
            turn: beforeTurn + 1,
            stage: 'draw',
            handCount: beforeHandCount + drawCount - 1,
            discardCount: beforeDiscardCount + 1,
        },
        `等待玩家 ${args.actingPlayer.playerId} 完成从牌库摸牌并弃牌后结束回合`,
    );

    await expect(args.nextPlayer.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
}

async function completeOnlineTakeDiscardTurn(args: {
    matchId: string;
    actingPlayer: FantasyRealmsOnlinePlayer;
    nextPlayer: FantasyRealmsOnlinePlayer;
    observerPage?: Page;
}) {
    const observerPage = args.observerPage ?? args.actingPlayer.page;
    await expect(args.actingPlayer.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });

    const beforeCore = await readFantasyRealmsCore(args.matchId, observerPage);
    const beforeTurn = beforeCore.turn;
    const beforeHandCount = beforeCore.players[args.actingPlayer.playerId]?.hand.length ?? 0;
    const beforeDiscardCount = beforeCore.discardPile.length;
    const requiresDiscardAfterTake = requiresDiscardAfterTakingDiscard(beforeCore);

    const discardTakeButton = args.actingPlayer.page.getByRole('button', { name: /拿取弃牌/ }).first();
    const liveActionButton = args.actingPlayer.page.getByTestId('fantasyrealms-live-action-button');

    await discardTakeButton.click();
    await expect(liveActionButton).toContainText('确认选择');
    await liveActionButton.click();

    if (requiresDiscardAfterTake) {
        await expectFantasyRealmsTurnSnapshot(
            args.matchId,
            observerPage,
            args.actingPlayer.playerId,
            {
                currentPlayer: args.actingPlayer.playerId,
                turn: beforeTurn,
                stage: 'discard',
                handCount: beforeHandCount + 1,
                discardCount: Math.max(0, beforeDiscardCount - 1),
            },
            `等待玩家 ${args.actingPlayer.playerId} 真实拿取公开弃牌后停在弃牌阶段`,
        );

        const firstHandDiscardButton = args.actingPlayer.page.getByRole('button', { name: /弃置手牌/ }).first();
        await firstHandDiscardButton.click();
        await expect(liveActionButton).toContainText('确认弃置');
        await liveActionButton.click();

        await expectFantasyRealmsTurnSnapshot(
            args.matchId,
            observerPage,
            args.actingPlayer.playerId,
            {
                currentPlayer: args.nextPlayer.playerId,
                turn: beforeTurn + 1,
                stage: 'draw',
                handCount: beforeHandCount,
                discardCount: beforeDiscardCount,
            },
            `等待玩家 ${args.actingPlayer.playerId} 真实拿弃牌后继续弃1并结束回合`,
        );
    } else {
        await expectFantasyRealmsTurnSnapshot(
            args.matchId,
            observerPage,
            args.actingPlayer.playerId,
            {
                currentPlayer: args.nextPlayer.playerId,
                turn: beforeTurn + 1,
                stage: 'draw',
                handCount: beforeHandCount + 1,
                discardCount: Math.max(0, beforeDiscardCount - 1),
            },
            `等待玩家 ${args.actingPlayer.playerId} 在 duel 变体里真实拿弃牌后直接结束回合`,
        );
    }

    await expect(args.nextPlayer.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
}

async function completeOnlineDeckTurnToGameOver(args: {
    matchId: string;
    actingPlayer: FantasyRealmsOnlinePlayer;
    observerPage?: Page;
}) {
    const observerPage = args.observerPage ?? args.actingPlayer.page;
    await expect(args.actingPlayer.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });

    const beforeCore = await readFantasyRealmsCore(args.matchId, observerPage);
    const beforeHandCount = beforeCore.players[args.actingPlayer.playerId]?.hand.length ?? 0;
    const beforeDiscardCount = beforeCore.discardPile.length;
    const drawCount = getDeckDrawCount(beforeCore);

    const deckButton = args.actingPlayer.page.getByRole('button', { name: /从牌库摸 2 张并弃 1 张|从牌库摸 1 张/ });
    const liveActionButton = args.actingPlayer.page.getByTestId('fantasyrealms-live-action-button');
    await expect(liveActionButton).toContainText('抓一张牌');

    await deckButton.click();

    await expectFantasyRealmsTurnSnapshot(
        args.matchId,
        observerPage,
        args.actingPlayer.playerId,
        {
            currentPlayer: args.actingPlayer.playerId,
            turn: beforeCore.turn,
            stage: 'discard',
            handCount: beforeHandCount + drawCount,
            discardCount: beforeDiscardCount,
        },
        `等待玩家 ${args.actingPlayer.playerId} 在终局前一回合从牌库摸牌后进入弃牌阶段`,
    );

    const firstHandDiscardButton = args.actingPlayer.page.getByRole('button', { name: /弃置手牌/ }).first();
    await firstHandDiscardButton.click();
    await expect(liveActionButton).toContainText('确认弃置');
    await liveActionButton.click();

    await expect.poll(async () => {
        const state = await readFantasyRealmsMatchState(args.matchId, observerPage);
        const record = state as { core?: FantasyRealmsCore; G?: { core?: FantasyRealmsCore }; sys?: { gameover?: unknown } };
        const core = record.core ?? record.G?.core;
        return {
            gameover: Boolean(record.sys?.gameover),
            handCount: core?.players?.[args.actingPlayer.playerId]?.hand.length ?? -1,
            discardCount: core?.discardPile?.length ?? -1,
        };
    }, {
        timeout: 15000,
        message: `等待玩家 ${args.actingPlayer.playerId} 的最后一弃真实触发终局`,
    }).toEqual({
        gameover: true,
        handCount: beforeHandCount + drawCount - 1,
        discardCount: beforeDiscardCount + 1,
    });
}

async function openOnlineFantasyRealmsMatch(
    browser: NonNullable<BrowserContext['browser']>,
    baseURL: string | undefined,
    numPlayers = 2,
) {
    const players = await Promise.all(
        Array.from({ length: numPlayers }, (_, index) => createPlayerContext(
            browser,
            baseURL,
            index === 0
                ? '__fantasyrealms_online_host__'
                : `__fantasyrealms_online_guest_${index}__`,
        )),
    );
    const [host, ...guests] = players;

    if (!(await ensureGameServerAvailable(host.page))) {
        await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        return null;
    }

    const room = await createFantasyRealmsRoom(host.page, numPlayers);
    if (!room) {
        throw new Error('Failed to create Fantasy Realms room');
    }
    const matchId = room.matchID;

    if (!(await waitForMatchAvailable(host.page, GAME_NAME, matchId, 20000))) {
        throw new Error(`Fantasy Realms match not available: ${matchId}`);
    }

    const hostPlayerId = room.ownerPlayerID ?? '0';
    const hostPlayerName = `Host-FR-${Date.now()}`;
    const hostCredentials = room.ownerCredentials ?? await claimSeatViaApi({
        page: host.page,
        gameName: GAME_NAME,
        matchId,
        playerId: hostPlayerId,
        guestId: room.ownerGuestId,
        playerName: hostPlayerName,
    });
    if (!hostCredentials) {
        throw new Error('Host failed to claim Fantasy Realms seat');
    }
    await seedMatchCredentials(host.context, GAME_NAME, matchId, hostPlayerId, hostCredentials);
    await host.page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=${hostPlayerId}`, { waitUntil: 'domcontentloaded' });

    await waitForFantasyRealmsBoard(host.page, hostPlayerId);
    const onlinePlayers: FantasyRealmsOnlinePlayer[] = [{
        ...host,
        playerId: hostPlayerId,
        playerName: hostPlayerName,
        guestId: room.ownerGuestId,
        role: 'host',
    }];

    for (const [guestIndex, guest] of guests.entries()) {
        const playerId = String(guestIndex + 1);
        const playerName = `Guest${guestIndex + 1}-FR-${Date.now()}`;
        const guestId = `fr-guest-${guestIndex + 1}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const guestCredentials = await joinMatchViaAPI(
            guest.page,
            GAME_NAME,
            matchId,
            playerId,
            playerName,
            guestId,
        );
        if (!guestCredentials) {
            throw new Error(`Guest ${playerId} failed to join Fantasy Realms match`);
        }
        await seedMatchCredentials(guest.context, GAME_NAME, matchId, playerId, guestCredentials);
        await guest.page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=${playerId}`, { waitUntil: 'domcontentloaded' });
        await waitForFantasyRealmsBoard(guest.page, playerId);
        onlinePlayers.push({
            ...guest,
            playerId,
            playerName,
            guestId,
            role: 'guest',
        });
    }

    return {
        players: onlinePlayers,
        host: onlinePlayers[0]!,
        guest: onlinePlayers[1]!,
        matchId,
        hostPlayerId,
        hostPlayerName,
        guestPlayerName: onlinePlayers[1]?.playerName,
    };
}

test.describe('FantasyRealms online basic flow', () => {
    test('2人在线房间可创建，host 首轮摸弃后 guest 可真实拿弃牌并结束回合', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { host, guest, matchId, hostPlayerId } = match;

        try {
            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(guest.page.getByText('你的回合')).toHaveCount(0);
            await expect(guest.page.getByRole('button', { name: /从牌库摸 2 张并弃 1 张|从牌库摸 1 张/ })).toBeVisible({ timeout: 10000 });

            const initialCore = await readFantasyRealmsCore(matchId, host.page);
            const initialHostHandCount = initialCore.players[hostPlayerId]?.hand.length ?? 0;
            const initialDiscardCount = initialCore.discardPile.length;
            const initialTurn = initialCore.turn;

            const drawDeckButton = host.page.getByRole('button', { name: /从牌库摸 2 张并弃 1 张|从牌库摸 1 张/ });
            await drawDeckButton.click();

            await expect.poll(async () => {
                const core = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: core.currentPlayer,
                    stage: core.stage,
                    hostHand: core.players[hostPlayerId]?.hand.length ?? -1,
                    discardCount: core.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待房主真实摸牌后进入弃牌阶段',
            }).toEqual({
                currentPlayer: hostPlayerId,
                stage: 'discard',
                hostHand: initialHostHandCount + 2,
                discardCount: initialDiscardCount,
            });

            const liveActionButton = host.page.getByTestId('fantasyrealms-live-action-button');
            await expect(liveActionButton).toContainText('弃一张牌');
            const firstHandDiscardButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandDiscardButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await expect.poll(async () => {
                const core = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: core.currentPlayer,
                    turn: core.turn,
                    stage: core.stage,
                    hostHand: core.players[hostPlayerId]?.hand.length ?? -1,
                    discardCount: core.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待房主真实弃牌后结束回合',
            }).toEqual({
                currentPlayer: '1',
                turn: initialTurn + 1,
                stage: 'draw',
                hostHand: initialHostHandCount + 1,
                discardCount: initialDiscardCount + 1,
            });

            await expect(guest.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });

            const guestCoreBeforeTake = await readFantasyRealmsCore(matchId, guest.page);
            const guestHandBeforeTake = guestCoreBeforeTake.players['1']?.hand.length ?? 0;
            const discardCountBeforeTake = guestCoreBeforeTake.discardPile.length;
            const turnBeforeTake = guestCoreBeforeTake.turn;

            const guestDiscardButton = guest.page.getByRole('button', { name: /拿取弃牌/ }).first();
            await guestDiscardButton.click();

            const guestActionButton = guest.page.getByTestId('fantasyrealms-live-action-button');
            await expect(guestActionButton).toContainText('确认选择');
            await guestActionButton.click();

            await expect.poll(async () => {
                const core = await readFantasyRealmsCore(matchId, guest.page);
                return {
                    currentPlayer: core.currentPlayer,
                    turn: core.turn,
                    stage: core.stage,
                    guestHand: core.players['1']?.hand.length ?? -1,
                    discardCount: core.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待 guest 真实拿弃牌后结束回合',
            }).toEqual({
                currentPlayer: hostPlayerId,
                turn: turnBeforeTake + 1,
                stage: 'draw',
                guestHand: guestHandBeforeTake + 1,
                discardCount: Math.max(0, discardCountBeforeTake - 1),
            });

            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
        } finally {
            await host.context.close().catch(() => {});
            await guest.context.close().catch(() => {});
        }
    });

    test('2人在线房间可在真实 /match/ 近终局态触发最后一弃并进入终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { host, guest, matchId, hostPlayerName, guestPlayerName } = match;

        try {
            const core = nearEndDiscardCore();
            const discardCardId = core.players['0']!.hand[0]!.id;
            const postDiscardCore = applyCommand(core, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: discardCardId },
                timestamp: 900,
            });
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(postDiscardCore);
            if (!gameOverResult) {
                throw new Error('Expected online final discard to trigger Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0' ? hostPlayerName : guestPlayerName,
                    score,
                }));

            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            const liveActionButton = host.page.getByTestId('fantasyrealms-live-action-button');
            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(liveActionButton).toContainText('弃一张牌');
            await expect(liveActionButton).toBeDisabled();

            const firstHandButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await expect.poll(async () => {
                const state = await readFantasyRealmsMatchState(matchId, host.page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 15000,
                message: '等待真实在线房间最后一弃触发终局',
            }).toBe(true);

            await expect(host.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(guest.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expectFinalStandingsVisible(host.page, sortedStandings);
            await expectFinalStandingsVisible(guest.page, sortedStandings);
        } finally {
            await host.context.close().catch(() => {});
            await guest.context.close().catch(() => {});
        }
    });

    test('2人在线房间终局刷新后仍保持最终排名与公开手牌焦点', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { host, guest, matchId, hostPlayerName, guestPlayerName } = match;

        try {
            const baseCore = nearEndDiscardCore();
            const revealedOpponentCard = baseCore.players['1']!.hand[0]!;
            const core: FantasyRealmsCore = {
                ...baseCore,
                focusCardId: revealedOpponentCard.id,
            };
            const discardCardId = core.players['0']!.hand[0]!.id;
            const postDiscardCore = applyCommand(core, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: discardCardId },
                timestamp: 950,
            });
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(postDiscardCore);
            if (!gameOverResult) {
                throw new Error('Expected online final discard to trigger Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0' ? hostPlayerName : guestPlayerName,
                    score,
                }));

            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            const liveActionButton = host.page.getByTestId('fantasyrealms-live-action-button');
            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(liveActionButton).toContainText('弃一张牌');

            const firstHandButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await expect.poll(async () => {
                const state = await readFantasyRealmsMatchState(matchId, host.page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 15000,
                message: '等待真实在线房间最后一弃触发终局',
            }).toBe(true);

            await expect(host.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(guest.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expectFinalStandingsVisible(host.page, sortedStandings);
            await expectFinalStandingsVisible(guest.page, sortedStandings);

            const focusNameBeforeReload = (await host.page.locator('.fr-focus-name').textContent())?.trim() ?? '';
            const focusAtlasCardIdBeforeReload = await host.page.getByTestId('fantasyrealms-focus-preview').getAttribute('data-atlas-card-id') ?? '';
            expect(focusNameBeforeReload).not.toBe('');
            expect(focusAtlasCardIdBeforeReload).not.toBe('');

            await host.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsReviewBoard(host.page, host.playerId);
            await guest.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsReviewBoard(guest.page, guest.playerId);

            await expect(host.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(guest.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expectFinalStandingsVisible(host.page, sortedStandings);
            await expectFinalStandingsVisible(guest.page, sortedStandings);

            await expect(host.page.locator('.fr-focus-name')).toHaveText(focusNameBeforeReload);
            await expect(host.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(host.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-atlas-card-id', focusAtlasCardIdBeforeReload);

            await expect(guest.page.locator('.fr-focus-name')).toHaveText(focusNameBeforeReload);
            await expect(guest.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(guest.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-atlas-card-id', focusAtlasCardIdBeforeReload);
        } finally {
            await host.context.close().catch(() => {});
            await guest.context.close().catch(() => {});
        }
    });

    test('2人在线房间可经过自然拿公开弃牌分支并最终真实进入终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 2);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { host, guest, matchId } = match;

        try {
            for (let round = 0; round < 6; round += 1) {
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer: host,
                    nextPlayer: guest,
                    observerPage: host.page,
                });
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer: guest,
                    nextPlayer: host,
                    observerPage: host.page,
                });
            }

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                host.page,
                host.playerId,
                {
                    currentPlayer: host.playerId,
                    turn: 13,
                    stage: 'draw',
                    handCount: 6,
                    discardCount: 12,
                },
                '等待双人真实对局在双方手牌未满前自然到达 12 张公开弃牌',
            );

            await completeOnlineTakeDiscardTurn({
                matchId,
                actingPlayer: host,
                nextPlayer: guest,
                observerPage: host.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                host.page,
                guest.playerId,
                {
                    currentPlayer: guest.playerId,
                    turn: 14,
                    stage: 'draw',
                    handCount: 6,
                    discardCount: 11,
                },
                '等待双人 duel 变体自然拿公开弃牌后直接切到对手回合',
            );

            await completeOnlineDeckTurnToGameOver({
                matchId,
                actingPlayer: guest,
                observerPage: host.page,
            });

            const finalCore = await readFantasyRealmsCore(matchId, host.page);
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected real 2-player online mixed branch game to end in Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === host.playerId ? host.playerName : guest.playerName,
                    score,
                }));

            await expect(host.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(guest.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expectFinalStandingsVisible(host.page, sortedStandings);
            await expectFinalStandingsVisible(guest.page, sortedStandings);
        } finally {
            await host.context.close().catch(() => {});
            await guest.context.close().catch(() => {});
        }
    });

    test('2人在线房间手牌已满7时，从公开弃牌拿牌后仍必须继续弃1才会结束回合', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 2);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { host, guest, matchId } = match;

        try {
            const core = duelTakeDiscardRequiresDiscardCore();
            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            await expect.poll(async () => {
                const nextCore = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: nextCore.currentPlayer,
                    turn: nextCore.turn,
                    stage: nextCore.stage,
                    hostHand: nextCore.players['0']?.hand.length ?? -1,
                    discardCount: nextCore.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待双人 duel 变体切到手牌已满 7 的拿弃牌代表态',
            }).toEqual({
                currentPlayer: '0',
                turn: 5,
                stage: 'draw',
                hostHand: 7,
                discardCount: 2,
            });

            await completeOnlineTakeDiscardTurn({
                matchId,
                actingPlayer: host,
                nextPlayer: guest,
                observerPage: host.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                host.page,
                guest.playerId,
                {
                    currentPlayer: guest.playerId,
                    turn: 6,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 2,
                },
                '等待双人 duel 变体在手牌已满 7 时真实拿弃牌后继续弃1并切到对手回合',
            );
        } finally {
            await host.context.close().catch(() => {});
            await guest.context.close().catch(() => {});
        }
    });

    test('2人在线房间手牌已满7时，从牌库只摸1并继续弃1才会结束回合', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 2);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { host, guest, matchId } = match;

        try {
            const core = duelFullHandDrawCore();
            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            await expect.poll(async () => {
                const nextCore = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: nextCore.currentPlayer,
                    turn: nextCore.turn,
                    stage: nextCore.stage,
                    hostHand: nextCore.players['0']?.hand.length ?? -1,
                    discardCount: nextCore.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待双人 duel 变体切到手牌已满 7 的摸牌代表态',
            }).toEqual({
                currentPlayer: '0',
                turn: 5,
                stage: 'draw',
                hostHand: 7,
                discardCount: 0,
            });

            await expect(host.page.getByRole('button', { name: '从牌库摸 1 张' })).toBeVisible({ timeout: 10000 });

            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: host,
                nextPlayer: guest,
                observerPage: host.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                host.page,
                guest.playerId,
                {
                    currentPlayer: guest.playerId,
                    turn: 6,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 1,
                },
                '等待双人 duel 变体在手牌已满 7 时真实摸1弃1并切到对手回合',
            );
        } finally {
            await host.context.close().catch(() => {});
            await guest.context.close().catch(() => {});
        }
    });

    test('4人在线房间可经过自然拿公开弃牌分支并最终真实进入终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(420000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 4);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2, player3] = players;

        try {
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player3,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player3,
                nextPlayer: player0,
                observerPage: player0.page,
            });

            await completeOnlineTakeDiscardTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player3,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player3,
                nextPlayer: player0,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player2.playerId,
                {
                    currentPlayer: player2.playerId,
                    turn: 11,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 9,
                },
                '等待 4 人带自然拿公开弃牌分支的真实对局进入终局前最后一手',
            );

            await completeOnlineDeckTurnToGameOver({
                matchId,
                actingPlayer: player2,
                observerPage: player0.page,
            });

            const finalCore = await readFantasyRealmsCore(matchId, player0.page);
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected real 4-player online mixed branch game to end in Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: players.find((player) => player.playerId === playerId)?.playerName ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await Promise.all(players.map(async (player) => {
                await expect(player.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
                await expectFinalStandingsVisible(player.page, sortedStandings);
            }));
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('5人在线房间可经过自然拿公开弃牌分支并最终真实进入终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(450000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 5);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2, player3, player4] = players;

        try {
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player3,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player3,
                nextPlayer: player4,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player4,
                nextPlayer: player0,
                observerPage: player0.page,
            });

            await completeOnlineTakeDiscardTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player3,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player3,
                nextPlayer: player4,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player4,
                nextPlayer: player0,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player0.playerId,
                {
                    currentPlayer: player0.playerId,
                    turn: 11,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 9,
                },
                '等待 5 人带自然拿公开弃牌分支的真实对局进入终局前最后一手',
            );

            await completeOnlineDeckTurnToGameOver({
                matchId,
                actingPlayer: player0,
                observerPage: player0.page,
            });

            const finalCore = await readFantasyRealmsCore(matchId, player0.page);
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected real 5-player online mixed branch game to end in Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: players.find((player) => player.playerId === playerId)?.playerName ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await Promise.all(players.map(async (player) => {
                await expect(player.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
                await expectFinalStandingsVisible(player.page, sortedStandings);
            }));
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间从公开弃牌拿牌后，当前玩家必须继续弃1才会结束回合', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [host] = players;

        try {
            const core = multiplayerTakeDiscardCore();
            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            await expect.poll(async () => {
                const nextCore = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: nextCore.currentPlayer,
                    turn: nextCore.turn,
                    stage: nextCore.stage,
                    hostHand: nextCore.players['0']?.hand.length ?? -1,
                    discardCount: nextCore.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待 3 人基础版在线房间切到多人拿弃牌代表态',
            }).toEqual({
                currentPlayer: '0',
                turn: 3,
                stage: 'draw',
                hostHand: 7,
                discardCount: 2,
            });

            const guestActionButton = host.page.getByTestId('fantasyrealms-live-action-button');
            const discardButton = host.page.getByRole('button', { name: /拿取弃牌/ }).first();
            await discardButton.click();
            await expect(guestActionButton).toContainText('确认选择');
            await guestActionButton.click();

            await expect.poll(async () => {
                const nextCore = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: nextCore.currentPlayer,
                    turn: nextCore.turn,
                    stage: nextCore.stage,
                    hostHand: nextCore.players['0']?.hand.length ?? -1,
                    discardCount: nextCore.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待 3 人基础版在线房间拿弃牌后停在弃牌阶段',
            }).toEqual({
                currentPlayer: '0',
                turn: 3,
                stage: 'discard',
                hostHand: 8,
                discardCount: 1,
            });

            await expect(host.page.getByTestId('fantasyrealms-hand-row')).toHaveAttribute('data-slot-count', '8');

            const handDiscardButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await handDiscardButton.click();
            await expect(guestActionButton).toContainText('确认弃置');
            await guestActionButton.click();

            await expect.poll(async () => {
                const nextCore = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: nextCore.currentPlayer,
                    turn: nextCore.turn,
                    stage: nextCore.stage,
                    hostHand: nextCore.players['0']?.hand.length ?? -1,
                    discardCount: nextCore.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待 3 人基础版在线房间弃1后真实结束回合',
            }).toEqual({
                currentPlayer: '1',
                turn: 4,
                stage: 'draw',
                hostHand: 7,
                discardCount: 2,
            });
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间当前玩家选中自己手牌准备弃置时，其他在线页不会泄露隐藏手牌焦点', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2] = players;

        try {
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            await switchFantasyRealmsPageToStackedLayout(player0.page);
            await switchFantasyRealmsPageToStackedLayout(player2.page);

            const deckButton = player1.page.getByRole('button', { name: /从牌库摸 2 张并弃 1 张|从牌库摸 1 张/ });
            const liveActionButton = player1.page.getByTestId('fantasyrealms-live-action-button');
            await expect(liveActionButton).toContainText('抓一张牌');
            await deckButton.click();

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player1.page,
                player1.playerId,
                {
                    currentPlayer: player1.playerId,
                    turn: 2,
                    stage: 'discard',
                    handCount: 8,
                    discardCount: 1,
                },
                '等待玩家1真实摸牌后进入弃牌阶段并持有8张手牌',
            );

            const handDiscardButton = player1.page.getByRole('button', { name: /弃置手牌/ }).nth(1);
            const handDiscardLabel = await handDiscardButton.getAttribute('aria-label');
            const hiddenCardName = handDiscardLabel?.replace(/^弃置手牌\s*/, '').trim() ?? '';
            expect(hiddenCardName).not.toBe('');

            await handDiscardButton.click();
            await expect(liveActionButton).toContainText('确认弃置');

            await expectWaitingPageKeepsOpponentFocusHidden({
                page: player0.page,
                hiddenCardName,
            });
            await expectWaitingPageKeepsOpponentFocusHidden({
                page: player2.page,
                hiddenCardName,
            });
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间等待玩家查看自己的隐藏手牌时，其他在线页也不会泄露该焦点', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2] = players;

        try {
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            await switchFantasyRealmsPageToStackedLayout(player0.page);
            await switchFantasyRealmsPageToStackedLayout(player1.page);
            await switchFantasyRealmsPageToStackedLayout(player2.page);

            const ownHandInspectButton = player0.page.getByRole('button', { name: /查看手牌/ }).nth(1);
            const ownHandInspectLabel = await ownHandInspectButton.getAttribute('aria-label');
            const hiddenCardName = ownHandInspectLabel?.replace(/^查看手牌\s*/, '').trim() ?? '';
            expect(hiddenCardName).not.toBe('');

            await ownHandInspectButton.click();
            await expect(player0.page.locator('.fr-focus-name')).toHaveText(hiddenCardName);
            await expect(player0.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');

            await expectHiddenFocusPreviewNoLeak({
                page: player1.page,
                hiddenCardName,
            });
            await expectHiddenFocusPreviewNoLeak({
                page: player2.page,
                hiddenCardName,
            });
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2] = players;

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            const core = await readFantasyRealmsCore(matchId, player0.page);
            const playerScores = players.map((player) => ({
                id: player.playerId,
                score: core.players[player.playerId]?.score ?? 0,
            }));
            const hostScore = core.players[player0.playerId]?.score ?? 0;
            const player2Score = core.players[player2.playerId]?.score ?? 0;
            expect(hostScore).not.toBe(player2Score);

            const getRank = (playerId: string) => {
                const playerScore = core.players[playerId]?.score ?? 0;
                return playerScores.filter((player) => player.score > playerScore).length + 1;
            };

            await expect(player0.page.getByText('你的回合')).toHaveCount(0);
            await expect(player2.page.getByText('你的回合')).toHaveCount(0);

            await expectLiveWaitingScoreSummary({
                page: player0.page,
                currentPlayerName: player1.playerName,
                hiddenOtherName: player2.playerName,
                expectedScore: hostScore,
            });
            await expectLiveWaitingScoreSummary({
                page: player2.page,
                currentPlayerName: player1.playerName,
                hiddenOtherName: player0.playerName,
                expectedScore: player2Score,
            });

            const hostWaitingScorePath = getEvidenceScreenshotPath(testInfo, 'host-waiting-score-summary');
            await mkdir(dirname(hostWaitingScorePath), { recursive: true });
            await player0.page.screenshot({ path: hostWaitingScorePath, fullPage: false });

            const player2WaitingScorePath = getEvidenceScreenshotPath(testInfo, 'player3-waiting-score-summary');
            await mkdir(dirname(player2WaitingScorePath), { recursive: true });
            await player2.page.screenshot({ path: player2WaitingScorePath, fullPage: false });
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间等待页刷新后仍只公开当前观察者信息，并保持隐藏手牌不泄露', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2] = players;

        try {
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            const core = await readFantasyRealmsCore(matchId, player0.page);
            const playerScores = players.map((player) => ({
                id: player.playerId,
                score: core.players[player.playerId]?.score ?? 0,
            }));
            const player0Score = core.players[player0.playerId]?.score ?? 0;
            const player2Score = core.players[player2.playerId]?.score ?? 0;
            const getRank = (playerId: string) => {
                const playerScore = core.players[playerId]?.score ?? 0;
                return playerScores.filter((player) => player.score > playerScore).length + 1;
            };

            await player0.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(player0.page, player0.playerId);
            await player2.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsBoard(player2.page, player2.playerId);

            await expect(player0.page.getByText('你的回合')).toHaveCount(0);
            await expect(player2.page.getByText('你的回合')).toHaveCount(0);
            await expect(player0.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);
            await expect(player2.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            await expectLiveWaitingScoreSummary({
                page: player0.page,
                currentPlayerName: player1.playerName,
                hiddenOtherName: player2.playerName,
                expectedScore: player0Score,
            });
            await expectLiveWaitingScoreSummary({
                page: player2.page,
                currentPlayerName: player1.playerName,
                hiddenOtherName: player0.playerName,
                expectedScore: player2Score,
            });

            await switchFantasyRealmsPageToStackedLayout(player0.page);
            await switchFantasyRealmsPageToStackedLayout(player2.page);

            const ownHandInspectButton = player0.page.getByRole('button', { name: /查看手牌/ }).nth(1);
            const ownHandInspectLabel = await ownHandInspectButton.getAttribute('aria-label');
            const hiddenCardName = ownHandInspectLabel?.replace(/^查看手牌\s*/, '').trim() ?? '';
            expect(hiddenCardName).not.toBe('');

            await ownHandInspectButton.click();
            await expect(player0.page.locator('.fr-focus-name')).toHaveText(hiddenCardName);
            await expect(player0.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');

            await expectWaitingPageKeepsOpponentFocusHidden({
                page: player2.page,
                hiddenCardName,
            });
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('spectator 路由不会借用当前玩家身份，也不会泄露隐藏手牌与实时分数', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [host] = players;
        const spectator = await createPlayerContext(browser, baseURL, '__fantasyrealms_online_spectator__');

        try {
            const core = spectatorLiveCore();
            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            await spectator.page.goto(`/play/${GAME_NAME}/match/${matchId}?spectate=1`, { waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorBoard(spectator.page, matchId);

            await expectFantasyRealmsSpectatorLiveNoLeak(spectator.page);

            await switchFantasyRealmsPageToStackedLayout(spectator.page);
            await expect(spectator.page.getByText('你当前正在旁观。这里不会展开任何玩家的隐藏手牌，只保留公开弃牌与终局结果。')).toHaveCount(0);
            await expect(spectator.page.getByText('多人局进行中：旁观视角不会展示任何玩家的实时总分，所有结果会在终局统一揭示。')).toHaveCount(0);
            await expect(spectator.page.getByText('隐藏手牌区')).toBeVisible();
            await expect(spectator.page.getByText('暂无手牌')).toBeVisible();
            await expect(spectator.page.getByText(core.players['1']!.hand[0]!.name)).toHaveCount(0);
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'back');
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('style', /fantasyrealms-base-card-back/);
        } finally {
            await spectator.context.close().catch(() => {});
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('spectator 刷新后仍不会借用当前玩家身份，也不会泄露隐藏手牌与实时分数', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [host] = players;
        const spectator = await createPlayerContext(browser, baseURL, '__fantasyrealms_online_spectator_reload__');

        try {
            const core = spectatorLiveCore();
            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            await spectator.page.goto(`/play/${GAME_NAME}/match/${matchId}?spectate=1`, { waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorBoard(spectator.page, matchId);
            await expectFantasyRealmsSpectatorLiveNoLeak(spectator.page);

            await spectator.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorBoard(spectator.page, matchId);
            await expectFantasyRealmsSpectatorLiveNoLeak(spectator.page);

            await switchFantasyRealmsPageToStackedLayout(spectator.page);
            await expect(spectator.page.getByText('你当前正在旁观。这里不会展开任何玩家的隐藏手牌，只保留公开弃牌与终局结果。')).toHaveCount(0);
            await expect(spectator.page.getByText('多人局进行中：旁观视角不会展示任何玩家的实时总分，所有结果会在终局统一揭示。')).toHaveCount(0);
            await expect(spectator.page.getByText('隐藏手牌区')).toBeVisible();
            await expect(spectator.page.getByText('暂无手牌')).toBeVisible();
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'back');
        } finally {
            await spectator.context.close().catch(() => {});
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('spectator 在终局后进入并刷新同一 match，仍保持最终排名与公开焦点', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 2);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { host, guest, matchId, hostPlayerName, guestPlayerName } = match;
        const spectator = await createPlayerContext(browser, baseURL, '__fantasyrealms_online_spectator_review__');

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            const baseCore = nearEndDiscardCore();
            const revealedOpponentCard = baseCore.players['1']!.hand[0]!;
            const core: FantasyRealmsCore = {
                ...baseCore,
                focusCardId: revealedOpponentCard.id,
            };
            const discardCardId = core.players['0']!.hand[0]!.id;
            const postDiscardCore = applyCommand(core, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: discardCardId },
                timestamp: 980,
            });
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(postDiscardCore);
            if (!gameOverResult) {
                throw new Error('Expected spectator review test to reach Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0' ? hostPlayerName : guestPlayerName,
                    score,
                }));

            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            const liveActionButton = host.page.getByTestId('fantasyrealms-live-action-button');
            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(liveActionButton).toContainText('弃一张牌');

            const firstHandButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await expect.poll(async () => {
                const state = await readFantasyRealmsMatchState(matchId, host.page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 15000,
                message: '等待 spectator review 用例里的真实在线房间最后一弃触发终局',
            }).toBe(true);

            await expect(host.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(guest.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });

            await spectator.page.goto(`/play/${GAME_NAME}/match/${matchId}?spectate=1`, { waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorReviewBoard(spectator.page, matchId);
            await expectFinalStandingsVisible(spectator.page, sortedStandings);

            const spectatorFocusNameBeforeReload = (await spectator.page.locator('.fr-focus-name').textContent())?.trim() ?? '';
            const spectatorFocusAtlasCardIdBeforeReload = await spectator.page.getByTestId('fantasyrealms-focus-preview').getAttribute('data-atlas-card-id') ?? '';
            expect(spectatorFocusNameBeforeReload).not.toBe('');
            expect(spectatorFocusAtlasCardIdBeforeReload).not.toBe('');

            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(spectator.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const spectatorReviewPath = getEvidenceScreenshotPath(testInfo, 'spectator-review-after-gameover');
            await mkdir(dirname(spectatorReviewPath), { recursive: true });
            await spectator.page.screenshot({ path: spectatorReviewPath, fullPage: false });

            await spectator.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorReviewBoard(spectator.page, matchId);
            await expectFinalStandingsVisible(spectator.page, sortedStandings);
            await expect(spectator.page.locator('.fr-focus-name')).toHaveText(spectatorFocusNameBeforeReload);
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-atlas-card-id', spectatorFocusAtlasCardIdBeforeReload);
        } finally {
            await spectator.context.close().catch(() => {});
            await host.context.close().catch(() => {});
            await guest.context.close().catch(() => {});
        }
    });

    test('3人在线房间可从真实开局连续跑完一整轮并回到玩家0', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2] = players;

        try {
            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player0.playerId,
                {
                    currentPlayer: player0.playerId,
                    turn: 1,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 0,
                },
                '等待 3 人在线房间真实开局稳定到玩家0回合',
            );

            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player1.playerId,
                {
                    currentPlayer: player1.playerId,
                    turn: 2,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 1,
                },
                '等待玩家0首轮结束后切到玩家1',
            );

            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player2.playerId,
                {
                    currentPlayer: player2.playerId,
                    turn: 3,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 2,
                },
                '等待玩家1首轮结束后切到玩家2',
            );

            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player0,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player0.playerId,
                {
                    currentPlayer: player0.playerId,
                    turn: 4,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 3,
                },
                '等待 3 人在线房间完整一轮后回到玩家0',
            );

            await expect(player0.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间可从真实开局推进到第二轮并自然完成拿公开弃牌链', async ({ browser }, testInfo) => {
        test.setTimeout(210000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2] = players;

        try {
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player0,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player0.playerId,
                {
                    currentPlayer: player0.playerId,
                    turn: 4,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 3,
                },
                '等待 3 人在线房间首轮结束后自然回到玩家0第二轮',
            );

            await completeOnlineTakeDiscardTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player1.playerId,
                {
                    currentPlayer: player1.playerId,
                    turn: 5,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 3,
                },
                '等待玩家0在第二轮真实拿公开弃牌后完成回合并切到玩家1',
            );
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('6人在线房间可从真实开局连续跑完一整轮并回到玩家0', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 6);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0] = players;

        try {
            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player0.playerId,
                {
                    currentPlayer: player0.playerId,
                    turn: 1,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 0,
                },
                '等待 6 人在线房间真实开局稳定到玩家0回合',
            );

            for (let index = 0; index < players.length; index += 1) {
                const actingPlayer = players[index]!;
                const nextPlayer = players[(index + 1) % players.length]!;
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer,
                    nextPlayer,
                    observerPage: player0.page,
                });
            }

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player0.playerId,
                {
                    currentPlayer: player0.playerId,
                    turn: 7,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 6,
                },
                '等待 6 人在线房间完整一轮后回到玩家0',
            );

            await expect(player0.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('6人在线房间可从真实开局推进到第二轮并自然完成拿公开弃牌链', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 6);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0] = players;

        try {
            for (let index = 0; index < players.length; index += 1) {
                const actingPlayer = players[index]!;
                const nextPlayer = players[(index + 1) % players.length]!;
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer,
                    nextPlayer,
                    observerPage: player0.page,
                });
            }

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player0.playerId,
                {
                    currentPlayer: player0.playerId,
                    turn: 7,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 6,
                },
                '等待 6 人在线房间首轮结束后自然回到玩家0第二轮',
            );

            await completeOnlineTakeDiscardTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: players[1]!,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                players[1]!.playerId,
                {
                    currentPlayer: players[1]!.playerId,
                    turn: 8,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 6,
                },
                '等待玩家0在 6 人第二轮真实拿公开弃牌后完成回合并切到玩家1',
            );
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间可从真实开局一路推进到真实终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2] = players;

        try {
            for (let round = 0; round < 3; round += 1) {
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer: player0,
                    nextPlayer: player1,
                    observerPage: player0.page,
                });
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer: player1,
                    nextPlayer: player2,
                    observerPage: player0.page,
                });
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer: player2,
                    nextPlayer: player0,
                    observerPage: player0.page,
                });
            }

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player0.playerId,
                {
                    currentPlayer: player0.playerId,
                    turn: 10,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 9,
                },
                '等待 3 人在线房间真实完整三轮后进入终局前最后一手',
            );

            await completeOnlineDeckTurnToGameOver({
                matchId,
                actingPlayer: player0,
                observerPage: player0.page,
            });

            const finalCore = await readFantasyRealmsCore(matchId, player0.page);
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected real 3-player online full game to end in Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: players.find((player) => player.playerId === playerId)?.playerName ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await Promise.all(players.map(async (player) => {
                await expect(player.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
                await expectFinalStandingsVisible(player.page, sortedStandings);
            }));
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('6人在线房间可从真实开局一路推进到真实终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(420000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 6);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0] = players;

        try {
            for (let index = 0; index < players.length; index += 1) {
                const actingPlayer = players[index]!;
                const nextPlayer = players[(index + 1) % players.length]!;
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer,
                    nextPlayer,
                    observerPage: player0.page,
                });
            }

            for (let index = 0; index < 3; index += 1) {
                const actingPlayer = players[index]!;
                const nextPlayer = players[index + 1]!;
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer,
                    nextPlayer,
                    observerPage: player0.page,
                });
            }

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                players[3]!.playerId,
                {
                    currentPlayer: players[3]!.playerId,
                    turn: 10,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 9,
                },
                '等待 6 人在线房间真实对局进入终局前最后一手',
            );

            await completeOnlineDeckTurnToGameOver({
                matchId,
                actingPlayer: players[3]!,
                observerPage: player0.page,
            });

            const finalCore = await readFantasyRealmsCore(matchId, player0.page);
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected real 6-player online full game to end in Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: players.find((player) => player.playerId === playerId)?.playerName ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await Promise.all(players.map(async (player) => {
                await expect(player.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
                await expectFinalStandingsVisible(player.page, sortedStandings);
            }));
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('6人在线房间可经过自然拿公开弃牌分支并最终真实进入终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(480000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 6);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0] = players;

        try {
            for (let index = 0; index < players.length; index += 1) {
                const actingPlayer = players[index]!;
                const nextPlayer = players[(index + 1) % players.length]!;
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer,
                    nextPlayer,
                    observerPage: player0.page,
                });
            }

            await completeOnlineTakeDiscardTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: players[1]!,
                observerPage: player0.page,
            });

            for (let index = 1; index <= 3; index += 1) {
                const actingPlayer = players[index]!;
                const nextPlayer = players[index + 1]!;
                await completeOnlineDeckTurn({
                    matchId,
                    actingPlayer,
                    nextPlayer,
                    observerPage: player0.page,
                });
            }

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                players[4]!.playerId,
                {
                    currentPlayer: players[4]!.playerId,
                    turn: 11,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 9,
                },
                '等待 6 人带自然拿公开弃牌分支的真实对局进入终局前最后一手',
            );

            await completeOnlineDeckTurnToGameOver({
                matchId,
                actingPlayer: players[4]!,
                observerPage: player0.page,
            });

            const finalCore = await readFantasyRealmsCore(matchId, player0.page);
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected real 6-player online mixed branch game to end in Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: players.find((player) => player.playerId === playerId)?.playerName ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await Promise.all(players.map(async (player) => {
                await expect(player.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
                await expectFinalStandingsVisible(player.page, sortedStandings);
            }));
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间可经过自然拿公开弃牌分支并最终真实进入终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(360000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [player0, player1, player2] = players;

        try {
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player0,
                observerPage: player0.page,
            });

            await completeOnlineTakeDiscardTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player0,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player1,
                nextPlayer: player2,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player2,
                nextPlayer: player0,
                observerPage: player0.page,
            });
            await completeOnlineDeckTurn({
                matchId,
                actingPlayer: player0,
                nextPlayer: player1,
                observerPage: player0.page,
            });

            await expectFantasyRealmsTurnSnapshot(
                matchId,
                player0.page,
                player1.playerId,
                {
                    currentPlayer: player1.playerId,
                    turn: 11,
                    stage: 'draw',
                    handCount: 7,
                    discardCount: 9,
                },
                '等待带自然拿公开弃牌分支的 3 人在线对局进入终局前最后一手',
            );

            await completeOnlineDeckTurnToGameOver({
                matchId,
                actingPlayer: player1,
                observerPage: player0.page,
            });

            const finalCore = await readFantasyRealmsCore(matchId, player0.page);
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected real 3-player online mixed branch game to end in Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: players.find((player) => player.playerId === playerId)?.playerName ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await Promise.all(players.map(async (player) => {
                await expect(player.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
                await expectFinalStandingsVisible(player.page, sortedStandings);
            }));
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间首回合公开弃牌为空时，只允许摸1并进入弃牌阶段', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [host] = players;

        try {
            const core = multiplayerOpeningCore();
            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            await expect.poll(async () => {
                const nextCore = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: nextCore.currentPlayer,
                    turn: nextCore.turn,
                    stage: nextCore.stage,
                    hostHand: nextCore.players['0']?.hand.length ?? -1,
                    discardCount: nextCore.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待 3 人基础版在线房间切到开局空弃牌代表态',
            }).toEqual({
                currentPlayer: '0',
                turn: 1,
                stage: 'draw',
                hostHand: 7,
                discardCount: 0,
            });

            const liveActionButton = host.page.getByTestId('fantasyrealms-live-action-button');
            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(host.page.getByText('0/10')).toBeVisible({ timeout: 10000 });
            await expect(host.page.getByRole('button', { name: /从牌库摸 1 张/ })).toBeVisible({ timeout: 10000 });
            await expect(liveActionButton).toContainText('抓一张牌');
            await expect(host.page.getByRole('button', { name: /拿取弃牌/ })).toHaveCount(0);

            await liveActionButton.click();

            await expect.poll(async () => {
                const nextCore = await readFantasyRealmsCore(matchId, host.page);
                return {
                    currentPlayer: nextCore.currentPlayer,
                    turn: nextCore.turn,
                    stage: nextCore.stage,
                    hostHand: nextCore.players['0']?.hand.length ?? -1,
                    discardCount: nextCore.discardPile.length,
                };
            }, {
                timeout: 15000,
                message: '等待 3 人基础版在线房间首回合摸1后进入弃牌阶段',
            }).toEqual({
                currentPlayer: '0',
                turn: 1,
                stage: 'discard',
                hostHand: 8,
                discardCount: 0,
            });

            await expect(host.page.getByTestId('fantasyrealms-hand-row')).toHaveAttribute('data-slot-count', '8');
            await expect(liveActionButton).toContainText('弃一张牌');
            await expect(liveActionButton).toBeDisabled();
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('3人在线房间临近结束时，最后一次真实弃牌会按10张阈值自动结算', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 3);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [host] = players;

        try {
            const core = nearEndMultiplayerDiscardCore();
            const discardCardId = core.players['0']!.hand[0]!.id;
            const postDiscardCore = applyCommand(core, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: discardCardId },
                timestamp: 950,
            });
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(postDiscardCore);
            if (!gameOverResult) {
                throw new Error('Expected multiplayer online final discard to trigger Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: players.find((player) => player.playerId === playerId)?.playerName ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));

            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            const liveActionButton = host.page.getByTestId('fantasyrealms-live-action-button');
            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(host.page.getByText('9/10')).toBeVisible({ timeout: 10000 });
            await expect(liveActionButton).toContainText('弃一张牌');
            await expect(liveActionButton).toBeDisabled();

            const firstHandButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await expect.poll(async () => {
                const state = await readFantasyRealmsMatchState(matchId, host.page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 15000,
                message: '等待 3 人在线房间最后一弃触发终局',
            }).toBe(true);

            await Promise.all(players.map(async (player) => {
                await expect(player.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
                await expectFinalStandingsVisible(player.page, sortedStandings);
            }));
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });

    test('6人在线房间临近结束时，最后一次真实弃牌会同步进入终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openOnlineFantasyRealmsMatch(browser, baseURL, 6);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online test.');
        }
        const { players, matchId } = match;
        const [host] = players;

        try {
            const core = nearEndSixPlayerDiscardCore();
            const discardCardId = core.players['0']!.hand[0]!.id;
            const postDiscardCore = applyCommand(core, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: discardCardId },
                timestamp: 980,
            });
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(postDiscardCore);
            if (!gameOverResult) {
                throw new Error('Expected six-player online final discard to trigger Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: players.find((player) => player.playerId === playerId)?.playerName ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));

            const currentState = await readFantasyRealmsMatchState(matchId, host.page);
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    turnOrder: [...core.playerIds],
                    currentPlayerIndex: core.playerIds.indexOf(core.currentPlayer),
                },
                core,
            }, host.page);

            const liveActionButton = host.page.getByTestId('fantasyrealms-live-action-button');
            await expect(host.page.getByText('你的回合')).toBeVisible({ timeout: 10000 });
            await expect(host.page.getByText('9/10')).toBeVisible({ timeout: 10000 });
            await expect(liveActionButton).toContainText('弃一张牌');
            await expect(liveActionButton).toBeDisabled();

            const firstHandButton = host.page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await liveActionButton.click();

            await expect.poll(async () => {
                const state = await readFantasyRealmsMatchState(matchId, host.page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 15000,
                message: '等待 6 人在线房间最后一弃触发终局',
            }).toBe(true);

            await Promise.all(players.map(async (player) => {
                await expect(player.page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
                await expectFinalStandingsVisible(player.page, sortedStandings);
            }));
        } finally {
            await Promise.all(players.map((player) => player.context.close().catch(() => {})));
        }
    });
});
