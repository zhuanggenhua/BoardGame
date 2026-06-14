import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { MatchState } from '../../src/engine/types';
import { evaluateFantasyRealmsScore, FantasyRealmsDomain } from '../../src/games/fantasyrealms/domain';
import type { FantasyRealmsCommand, FantasyRealmsCore } from '../../src/games/fantasyrealms/domain';
import { OFFICIAL_FANTASY_REALMS_CARDS } from '../../src/games/fantasyrealms/data/cards';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { initContext, waitForTestHarness } from '../helpers/common';

type FantasyRealmsMatchState = MatchState<FantasyRealmsCore>;
type TestHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => FantasyRealmsMatchState;
            set?: (state: FantasyRealmsMatchState) => void;
            isRegistered?: () => boolean;
        };
        command?: {
            isRegistered?: () => boolean;
        };
    };
};

const random = {
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
};

const applyCommand = (core: FantasyRealmsCore, command: FantasyRealmsCommand) => {
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

const drawStageCore = () => {
    let core = FantasyRealmsDomain.setup(['0', '1'], random);
    core = applyCommand(core, {
        type: 'DRAW_FROM_DECK',
        playerId: '0',
        payload: {},
        timestamp: 1,
    });
    core = applyCommand(core, {
        type: 'DISCARD_CARD',
        playerId: '0',
        payload: { cardId: core.players['0']!.hand[0]!.id },
        timestamp: 2,
    });
    core = applyCommand(core, {
        type: 'DRAW_FROM_DECK',
        playerId: '1',
        payload: {},
        timestamp: 3,
    });
    core = applyCommand(core, {
        type: 'DISCARD_CARD',
        playerId: '1',
        payload: { cardId: core.players['1']!.hand[0]!.id },
        timestamp: 4,
    });
    return core;
};

const discardStageCore = () => applyCommand(FantasyRealmsDomain.setup(['0', '1'], random), {
    type: 'DRAW_FROM_DECK',
    playerId: '0',
    payload: {},
    timestamp: 10,
});

const gameOverCore = (): FantasyRealmsCore => {
    const baseCore = FantasyRealmsDomain.setup(['0', '1', '2'], random);
    return {
        ...baseCore,
        turn: 8,
        stage: 'draw',
        drawPile: [],
        discardPile: [
            byId('army-elven-archers'),
            byId('army-dwarvish-infantry'),
            byId('army-light-cavalry'),
            byId('army-celestial-knights'),
            byId('artifact-shield-of-keth'),
            byId('artifact-gem-of-order'),
            byId('beast-unicorn'),
            byId('beast-hydra'),
            byId('flood-island'),
            byId('flood-water-elemental'),
        ],
        players: {
            ...baseCore.players,
            '0': {
                ...baseCore.players['0']!,
                hand: [
                    byId('flame-candle'),
                    byId('artifact-book-of-changes'),
                    byId('land-bell-tower'),
                    byId('artifact-protection-rune'),
                    byId('weapon-magic-wand'),
                    byId('land-earth-elemental'),
                    byId('wizard-necromancer'),
                ],
            },
            '1': {
                ...baseCore.players['1']!,
                hand: [
                    byId('weather-blizzard'),
                    byId('flood-great-flood'),
                    byId('flame-wildfire'),
                    byId('land-underground-caverns'),
                    byId('flood-swamp'),
                    byId('leader-princess'),
                    byId('wizard-warlock-lord'),
                ],
            },
            '2': {
                ...baseCore.players['2']!,
                hand: [
                    byId('army-rangers'),
                    byId('land-forest'),
                    byId('beast-warhorse'),
                    byId('leader-king'),
                    byId('weapon-sword-of-keth'),
                    byId('artifact-world-tree'),
                    byId('weather-air-elemental'),
                ],
            },
        },
    };
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

const multiplayerOpeningCore = (): FantasyRealmsCore => FantasyRealmsDomain.setup(['0', '1', '2'], random);

async function injectCore(
    page: Page,
    core: FantasyRealmsCore,
    sysPatch?: Partial<FantasyRealmsMatchState['sys']>,
) {
    await page.waitForFunction(() => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        return harness?.state?.isRegistered?.() === true;
    }, { timeout: 15000 });

    await page.evaluate(({ nextCore, nextSysPatch }) => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.state?.get || !harness?.state?.set) {
            throw new Error('TestHarness not ready');
        }

        const current = harness.state.get();
        const nextState: FantasyRealmsMatchState = {
            ...current,
            core: nextCore,
            sys: {
                ...(current.sys ?? {}),
                ...(nextSysPatch ?? {}),
            },
        };
        harness.state.set(nextState);
    }, { nextCore: core, nextSysPatch: sysPatch });
    await page.waitForTimeout(150);
}

async function openFantasyRealmsTestPage(page: Page, baseURL?: string, query = '?playerID=0') {
    await page.goto(`${baseURL ?? ''}/play/fantasyrealms${query}`, { waitUntil: 'domcontentloaded' });
    await waitForTestHarness(page, 15000);
    await page.waitForFunction(() => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        return harness?.state?.isRegistered?.() === true
            && harness?.command?.isRegistered?.() === true;
    }, { timeout: 15000 });
}

async function getLocatorRect(page: Page, selector: string) {
    return page.locator(selector).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        };
    });
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

async function getFirstCardMotionFrame(page: Page, selector: string) {
    return page.locator(selector).first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            opacity: style.opacity,
            transform: style.transform,
        };
    });
}

test.describe('FantasyRealms live flow', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('右下固定主按钮会在拿牌确认与弃牌确认之间复用，且不侵入手牌主热区', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            const liveActionZoneSelector = '[data-testid="fantasyrealms-live-action-zone"]';
            const liveActionButtonSelector = '[data-testid="fantasyrealms-live-action-button"]';
            const liveHandbandSelector = '[data-testid="fantasyrealms-hand-row"]';
            const hudFabButtonSelector = '[data-testid="fab-menu"] button';

            const drawCore = drawStageCore();
            await injectCore(page, drawCore);
            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(liveActionButton).toHaveCount(0);
            const initialHandbandRect = await getLocatorRect(page, liveHandbandSelector);
            const initialHudFabRect = await getLocatorRect(page, hudFabButtonSelector);
            const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };

            const firstDiscardButton = page.getByRole('button', { name: /拿取弃牌/ }).first();
            await firstDiscardButton.click();
            await expect(liveActionButton).toContainText('确认选择');
            await expect(page.locator('.fr-card-button--live-river.fr-card-button--armed .fr-live-card-state')).toHaveText('已选');

            const initialActionZoneRect = await getLocatorRect(page, liveActionZoneSelector);
            const initialActionButtonRect = await getLocatorRect(page, liveActionButtonSelector);
            const actionZoneRightInset = viewport.width - (initialActionZoneRect.x + initialActionZoneRect.width);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toHaveAttribute('data-anchor', 'bottom-right');
            expect(initialActionZoneRect.x).toBeGreaterThanOrEqual(Math.floor(viewport.width * 0.8));
            expect(initialActionZoneRect.x).toBeLessThanOrEqual(Math.floor(viewport.width * 0.88));
            expect(actionZoneRightInset).toBeGreaterThanOrEqual(88);
            expect(actionZoneRightInset).toBeLessThanOrEqual(150);
            expect(initialActionButtonRect.y).toBeGreaterThanOrEqual(Math.floor(viewport.height * 0.68));
            expect(initialActionButtonRect.y).toBeLessThanOrEqual(Math.floor(viewport.height * 0.79));
            expect(initialActionButtonRect.width).toBeGreaterThanOrEqual(168);
            expect(initialActionButtonRect.width).toBeLessThanOrEqual(182);
            expect(initialActionButtonRect.height).toBeGreaterThanOrEqual(64);
            expect(initialActionButtonRect.height).toBeLessThanOrEqual(72);
            expect(initialActionButtonRect.width).toBeGreaterThan(initialActionButtonRect.height);
            expect(initialActionButtonRect.x).toBeGreaterThanOrEqual(Math.floor(viewport.width * 0.8));
            expect(initialActionButtonRect.x).toBeGreaterThanOrEqual(initialHandbandRect.x + initialHandbandRect.width - 260);
            expect(initialActionButtonRect.y + initialActionButtonRect.height).toBeLessThanOrEqual(initialHudFabRect.y - 72);

            const confirmTakeActionZoneRect = await getLocatorRect(page, liveActionZoneSelector);
            const confirmTakeActionButtonRect = await getLocatorRect(page, liveActionButtonSelector);
            expect(confirmTakeActionZoneRect).toEqual(initialActionZoneRect);
            expect(confirmTakeActionButtonRect).toEqual(initialActionButtonRect);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'live-action-bottom-right-confirm-take');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '1'
                    && state?.core?.stage === 'draw'
                    && state?.core?.players?.['0']?.hand?.length === 2
                    && state?.core?.discardPile?.length === 1;
            }, { timeout: 10000 });

            const discardCore = discardStageCore();
            await injectCore(page, discardCore);
            await expect(liveActionButton).toHaveCount(0);

            const secondHandButton = page.getByRole('button', { name: /弃置手牌/ }).nth(1);
            await secondHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await expect(liveActionButton).toBeEnabled();
            await expect(page.locator('.fr-card-button--live-hand.fr-card-button--armed .fr-live-card-state')).toHaveText('已选');
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toHaveAttribute('data-anchor', 'bottom-right');

            const confirmDiscardActionZoneRect = await getLocatorRect(page, liveActionZoneSelector);
            const confirmDiscardActionButtonRect = await getLocatorRect(page, liveActionButtonSelector);
            expect(confirmDiscardActionZoneRect).toEqual(initialActionZoneRect);
            expect(confirmDiscardActionButtonRect).toEqual(initialActionButtonRect);

            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '1'
                    && state?.core?.stage === 'draw'
                    && state?.core?.players?.['0']?.hand?.length === 1
                    && state?.core?.discardPile?.length === 1;
            }, { timeout: 10000 });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('顶部 live HUD 保持左上牌库、居中状态轴与右上分数窄带三段锚点', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            await injectCore(page, nearEndMultiplayerDiscardCore());
            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByText('9/10')).toBeVisible();

            const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
            const liveTableRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-table"]');
            const deckRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-deck"]');
            const statusRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-status-strip"]');
            const scoreBandRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-score-band"]');

            const tableCenterX = liveTableRect.x + (liveTableRect.width / 2);
            const statusCenterX = statusRect.x + (statusRect.width / 2);
            const deckRight = deckRect.x + deckRect.width;
            const scoreLeft = scoreBandRect.x;
            const scoreRightInset = viewport.width - (scoreBandRect.x + scoreBandRect.width);

            expect(deckRect.x).toBeGreaterThanOrEqual(liveTableRect.x + 48);
            expect(deckRect.x).toBeLessThanOrEqual(liveTableRect.x + 96);
            expect(deckRect.y).toBeGreaterThanOrEqual(liveTableRect.y + 24);
            expect(Math.abs(statusCenterX - tableCenterX)).toBeLessThanOrEqual(36);
            expect(statusRect.x).toBeGreaterThan(deckRight + 40);
            expect(scoreLeft).toBeGreaterThan(statusRect.x + statusRect.width + 80);
            expect(scoreBandRect.width).toBeGreaterThanOrEqual(144);
            expect(scoreBandRect.width).toBeLessThanOrEqual(172);
            expect(scoreBandRect.height).toBeGreaterThanOrEqual(38);
            expect(scoreBandRect.height).toBeLessThanOrEqual(50);
            expect(scoreRightInset).toBeGreaterThanOrEqual(54);
            expect(scoreRightInset).toBeLessThanOrEqual(104);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'live-hud-three-anchor-topbar');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('左上牌库可真实完成摸2弃1链路', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const deckButton = page.getByRole('button', { name: /从牌库摸 2 张并弃 1 张/ });
            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            const liveActionZone = page.getByTestId('fantasyrealms-live-action-zone');

            await expect(liveActionButton).toHaveCount(0);
            await deckButton.click();

            await expect(liveActionButton).toHaveCount(0);
            await expect(page.getByRole('button', { name: /弃置手牌/ }).first()).toBeVisible();

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await expect(liveActionZone).toHaveAttribute('data-anchor', 'bottom-right');
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '1'
                    && state?.core?.stage === 'draw'
                    && state?.core?.players?.['0']?.hand?.length === 1
                    && state?.core?.discardPile?.length === 1;
            }, { timeout: 10000 });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('2人 duel 变体手牌已满7时，左上牌库只摸1并继续弃1', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const core = duelFullHandDrawCore();
            await injectCore(page, core);

            const deckButton = page.getByRole('button', { name: '从牌库摸 1 张' });
            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            const liveActionZone = page.getByTestId('fantasyrealms-live-action-zone');

            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(liveActionButton).toHaveCount(0);
            await deckButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && state?.core?.players?.['0']?.hand?.length === 8
                    && state?.core?.discardPile?.length === 0;
            }, { timeout: 10000 });

            await expect(liveActionButton).toHaveCount(0);

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await expect(liveActionButton).toBeEnabled();
            await expect(liveActionZone).toHaveAttribute('data-anchor', 'bottom-right');
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '1'
                    && state?.core?.stage === 'draw'
                    && state?.core?.players?.['0']?.hand?.length === 7
                    && state?.core?.discardPile?.length === 1;
            }, { timeout: 10000 });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('摸牌和弃牌会在真实状态变化后播放位置过渡关键帧', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await openFantasyRealmsTestPage(page, baseURL, '?playerID=0&players=3&seat1=human&seat2=human');
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            await injectCore(page, multiplayerOpeningCore());
            await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const deckButton = page.getByRole('button', { name: '从牌库摸 1 张' });
            await deckButton.click();
            const handband = page.getByTestId('fantasyrealms-live-handband');
            await expect(handband).toHaveAttribute('data-motion', 'draw-to-hand', { timeout: 1000 });

            const drawStartPath = getEvidenceScreenshotPath(testInfo, 'motion-draw-start');
            await mkdir(dirname(drawStartPath), { recursive: true });
            const drawStartFrame = await getFirstCardMotionFrame(page, '.fr-card-button--live-hand .fr-card');
            await page.screenshot({ path: drawStartPath, fullPage: false });

            await page.waitForTimeout(220);
            const drawMidPath = getEvidenceScreenshotPath(testInfo, 'motion-draw-mid');
            const drawMidFrame = await getFirstCardMotionFrame(page, '.fr-card-button--live-hand .fr-card');
            await page.screenshot({ path: drawMidPath, fullPage: false });

            await expect(handband).toHaveAttribute('data-motion', 'idle', { timeout: 1600 });
            const drawEndPath = getEvidenceScreenshotPath(testInfo, 'motion-draw-end');
            await page.screenshot({ path: drawEndPath, fullPage: false });
            const drawEndFrame = await getFirstCardMotionFrame(page, '.fr-card-button--live-hand .fr-card');

            expect(drawStartFrame.transform).not.toBe('none');
            expect(drawMidFrame.transform).not.toBe('none');
            expect(drawStartFrame.transform).not.toEqual(drawEndFrame.transform);
            expect(Number(drawStartFrame.opacity)).toBeLessThanOrEqual(1);
            expect(drawEndFrame.transform === 'none' || drawEndFrame.transform.includes('1, 0, 0, 1')).toBe(true);

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            const discardConfirmButton = page.getByTestId('fantasyrealms-live-action-button');
            await expect(discardConfirmButton).toContainText('确认弃置');
            await expect(discardConfirmButton).toBeEnabled();
            await discardConfirmButton.click();
            const river = page.getByTestId('fantasyrealms-live-river');
            await expect(river).toHaveAttribute('data-motion', 'hand-to-river', { timeout: 1000 });

            const discardStartPath = getEvidenceScreenshotPath(testInfo, 'motion-discard-start');
            const discardStartFrame = await getFirstCardMotionFrame(page, '.fr-card-button--live-river .fr-card');
            await page.screenshot({ path: discardStartPath, fullPage: false });

            await page.waitForTimeout(220);
            const discardMidPath = getEvidenceScreenshotPath(testInfo, 'motion-discard-mid');
            const discardMidFrame = await getFirstCardMotionFrame(page, '.fr-card-button--live-river .fr-card');
            await page.screenshot({ path: discardMidPath, fullPage: false });

            await expect(river).toHaveAttribute('data-motion', 'idle', { timeout: 2400 });
            const discardEndPath = getEvidenceScreenshotPath(testInfo, 'motion-discard-end');
            await page.screenshot({ path: discardEndPath, fullPage: false });
            const discardEndFrame = await getFirstCardMotionFrame(page, '.fr-card-button--live-river .fr-card');

            expect(discardStartFrame.transform).not.toBe('none');
            expect(discardMidFrame.transform).not.toBe('none');
            expect(discardStartFrame.transform).not.toEqual(discardEndFrame.transform);
            expect(discardEndFrame.transform === 'none' || discardEndFrame.transform.includes('1, 0, 0, 1')).toBe(true);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('终局会展示胜者与最终排名', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openFantasyRealmsTestPage(page, baseURL);
            const core = gameOverCore();
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(core);
            if (!gameOverResult) {
                throw new Error('Expected injected Fantasy Realms endgame state to produce gameOver result');
            }
            const sortedStandings = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: `玩家${Number(playerId) + 1}`,
                    score,
                    isWinner: gameOverResult.winner === playerId,
                }));

            await injectCore(page, core, { gameover: gameOverResult });

            await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(page.getByText('最终排名')).toBeVisible();
            const standingsRegion = page.locator('.fr-endgame-list');
            await expect(standingsRegion).toBeVisible();
            for (const standing of sortedStandings) {
                await expect(standingsRegion.getByText(`第 ${standing.rank} 名`)).toBeVisible();
                await expect(standingsRegion.getByText(standing.playerName)).toBeVisible();
                await expect(standingsRegion.getByText(String(standing.score))).toBeVisible();
            }
            await expect(standingsRegion.getByText('胜者')).toBeVisible();
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('临近结束时，最后一次真实弃牌会自动触发终局结算', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const core = nearEndDiscardCore();
            const discardCardId = core.players['0']!.hand[0]!.id;
            const postDiscardCore = applyCommand(core, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: discardCardId },
                timestamp: 500,
            });
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(postDiscardCore);
            if (!gameOverResult) {
                throw new Error('Expected final discard to trigger Fantasy Realms gameOver');
            }
            const sortedStandings = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await injectCore(page, core);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(liveActionButton).toHaveCount(0);

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await expect(liveActionButton).toBeEnabled();
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return Boolean(state?.sys?.gameover);
            }, { timeout: 10000 });

            await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            const standingsRegion = page.locator('.fr-endgame-list');
            await expect(standingsRegion).toBeVisible();
            for (const standing of sortedStandings) {
                await expect(standingsRegion.getByText(`第 ${standing.rank} 名`)).toBeVisible();
                await expect(standingsRegion.getByText(standing.playerName)).toBeVisible();
                await expect(standingsRegion.getByText(String(standing.score))).toBeVisible();
            }
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人基础版临近结束时，最后一次真实弃牌会按 10 张阈值自动结算', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const core = nearEndMultiplayerDiscardCore();
            const discardCardId = core.players['0']!.hand[0]!.id;
            const postDiscardCore = applyCommand(core, {
                type: 'DISCARD_CARD',
                playerId: '0',
                payload: { cardId: discardCardId },
                timestamp: 800,
            });
            const gameOverResult = FantasyRealmsDomain.isGameOver?.(postDiscardCore);
            if (!gameOverResult) {
                throw new Error('Expected multiplayer final discard to trigger Fantasy Realms gameOver');
            }
            const sortedStandings = Object.entries(gameOverResult.scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await injectCore(page, core);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByText('9/10')).toBeVisible();
            await expect(liveActionButton).toHaveCount(0);

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await expect(liveActionButton).toBeEnabled();
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return Boolean(state?.sys?.gameover);
            }, { timeout: 10000 });

            await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            const standingsRegion = page.locator('.fr-endgame-list');
            await expect(standingsRegion).toBeVisible();
            for (const standing of sortedStandings) {
                await expect(standingsRegion.getByText(`第 ${standing.rank} 名`)).toBeVisible();
                await expect(standingsRegion.getByText(standing.playerName)).toBeVisible();
                await expect(standingsRegion.getByText(String(standing.score))).toBeVisible();
            }
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('低张数公开弃牌会按当前张数重新居中，不沿用 5 槽顶排固定槽位', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            await injectCore(page, drawStageCore());

            const liveTableRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-table"]');
            const riverCardRects = await getLocatorRects(page, '.fr-card-button--live-river');
            expect(riverCardRects).toHaveLength(2);

            const tableCenterX = liveTableRect.x + (liveTableRect.width / 2);
            const pairCenterX = (
                (riverCardRects[0]!.x + (riverCardRects[0]!.width / 2))
                + (riverCardRects[1]!.x + (riverCardRects[1]!.width / 2))
            ) / 2;
            const horizontalGap = riverCardRects[1]!.x - (riverCardRects[0]!.x + riverCardRects[0]!.width);

            expect(Math.abs(pairCenterX - tableCenterX)).toBeLessThanOrEqual(80);
            expect(riverCardRects[0]!.y).toBe(riverCardRects[1]!.y);
            expect(horizontalGap).toBeGreaterThanOrEqual(90);
            expect(horizontalGap).toBeLessThanOrEqual(130);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'low-count-centered-river');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人基础版 9/10 代表态的公开弃牌保持两排交错牌河，而不是死板矩阵', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            await injectCore(page, nearEndMultiplayerDiscardCore());

            const riverCardsSelector = '.fr-card-button--live-river';
            const riverCards = page.locator(riverCardsSelector);
            await expect(page.getByText('9/10')).toBeVisible();
            await expect(riverCards).toHaveCount(9);

            const rects = await getLocatorRects(page, riverCardsSelector);
            const topRow = rects.slice(0, 5);
            const bottomRow = rects.slice(5);

            expect(bottomRow).toHaveLength(4);
            const topRowY = topRow[0]!.y;
            const bottomRowY = bottomRow[0]!.y;

            for (const rect of topRow) {
                expect(rect.y).toBe(topRowY);
                expect(rect.width).toBeGreaterThanOrEqual(188);
                expect(rect.width).toBeLessThanOrEqual(198);
            }
            for (const rect of bottomRow) {
                expect(rect.y).toBe(bottomRowY);
                expect(rect.width).toBeGreaterThanOrEqual(188);
                expect(rect.width).toBeLessThanOrEqual(198);
            }

            expect(bottomRowY).toBeGreaterThan(topRowY + 120);
            expect(bottomRowY).toBeLessThan(topRowY + topRow[0]!.height - 20);

            for (let index = 0; index < bottomRow.length; index += 1) {
                const previousTop = topRow[index]!;
                const nextTop = topRow[index + 1]!;
                const bottom = bottomRow[index]!;
                expect(bottom.x).toBeGreaterThan(previousTop.x + 60);
                expect(bottom.x).toBeLessThan(nextTop.x - 60);
            }

            await page.waitForTimeout(1400);
            const evidencePath = getEvidenceScreenshotPath(testInfo, 'near-end-interleaved-river');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人基础版从公开弃牌拿牌后，必须继续弃1才会结束回合', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const core = multiplayerTakeDiscardCore();
            await injectCore(page, core);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(liveActionButton).toHaveCount(0);

            const firstDiscardButton = page.getByRole('button', { name: /拿取弃牌/ }).first();
            await firstDiscardButton.click();
            await expect(liveActionButton).toContainText('确认选择');
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && state?.core?.players?.['0']?.hand?.length === 8
                    && state?.core?.discardPile?.length === 1;
            }, { timeout: 10000 });

            await expect(liveActionButton).toHaveCount(0);

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await expect(liveActionButton).toBeEnabled();
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '1'
                    && state?.core?.stage === 'draw'
                    && state?.core?.players?.['0']?.hand?.length === 7
                    && state?.core?.discardPile?.length === 2;
            }, { timeout: 10000 });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('2人 duel 变体手牌已满7时，从公开弃牌拿牌后必须继续弃1才会结束回合', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const core = duelTakeDiscardRequiresDiscardCore();
            await injectCore(page, core);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(liveActionButton).toHaveCount(0);

            const firstDiscardButton = page.getByRole('button', { name: /拿取弃牌/ }).first();
            await firstDiscardButton.click();
            await expect(liveActionButton).toContainText('确认选择');
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && state?.core?.players?.['0']?.hand?.length === 8
                    && state?.core?.discardPile?.length === 1;
            }, { timeout: 10000 });

            await expect(liveActionButton).toHaveCount(0);

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect(liveActionButton).toContainText('确认弃置');
            await expect(liveActionButton).toBeEnabled();
            await liveActionButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '1'
                    && state?.core?.stage === 'draw'
                    && state?.core?.players?.['0']?.hand?.length === 7
                    && state?.core?.discardPile?.length === 2;
            }, { timeout: 10000 });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人基础版首回合公开弃牌为空时，只允许摸1并进入弃牌阶段', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext();
        await initContext(context, {
            gameServerBaseURL: process.env.PW_GAME_SERVER_URL,
            apiServerBaseURL: process.env.PW_API_SERVER_URL,
            skipImageGate: true,
        });
        const page = await context.newPage();

        try {
            await openFantasyRealmsTestPage(page, baseURL);
            await expect(page.getByTestId('fantasyrealms-live-table')).toBeVisible({ timeout: 15000 });

            const core = multiplayerOpeningCore();
            await injectCore(page, core);

            const liveActionButton = page.getByTestId('fantasyrealms-live-action-button');
            const deckButton = page.getByRole('button', { name: '从牌库摸 1 张' });
            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByText('0/10')).toBeVisible();
            await expect(liveActionButton).toHaveCount(0);
            await expect(page.getByRole('button', { name: /拿取弃牌/ })).toHaveCount(0);

            await deckButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && state?.core?.players?.['0']?.hand?.length === 8
                    && state?.core?.discardPile?.length === 0;
            }, { timeout: 10000 });

            await expect(liveActionButton).toHaveCount(0);
        } finally {
            await context.close().catch(() => {});
        }
    });
});
