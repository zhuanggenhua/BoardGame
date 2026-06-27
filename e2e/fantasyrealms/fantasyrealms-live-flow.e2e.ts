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

const _discardStageCore = () => applyCommand(FantasyRealmsDomain.setup(['0', '1'], random), {
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

const fullTenDiscardCore = (): FantasyRealmsCore => {
    const baseCore = FantasyRealmsDomain.setup(['0', '1'], random);
    const cards = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
    const discardPile = cards.slice(0, 10);
    const playerZeroHand = cards.slice(10, 17);
    const playerOneHand = cards.slice(17, 24);
    const currentFocusCard = discardPile[discardPile.length - 1]!;

    const core: FantasyRealmsCore = {
        ...baseCore,
        currentPlayer: '0',
        turn: 6,
        stage: 'draw',
        drawPile: cards.slice(24),
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

async function readHarnessCore(page: Page): Promise<FantasyRealmsCore> {
    return await page.evaluate(() => {
        const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        if (!state?.core) {
            throw new Error('Fantasy Realms harness core not ready');
        }
        return state.core;
    });
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

async function getLocatorRect(page: Page, selector: string) {
    return page.locator(selector).first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        };
    });
}

function getRectGroupCenter(rects: Array<{ x: number; width: number }>) {
    const left = Math.min(...rects.map((rect) => rect.x));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    return left + ((right - left) / 2);
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

async function expectTurnChipPrimaryReadable(page: Page) {
    const turnChip = page.locator('.fr-live-chip--turn').first();
    const metrics = await turnChip.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fontSize: Math.round(Number.parseFloat(style.fontSize)),
            borderTopWidth: Math.round(Number.parseFloat(style.borderTopWidth)),
            boxShadow: style.boxShadow,
        };
    });
    expect(metrics.width).toBeGreaterThanOrEqual(168);
    expect(metrics.height).toBeGreaterThanOrEqual(52);
    expect(metrics.fontSize).toBeGreaterThanOrEqual(32);
    expect(metrics.borderTopWidth).toBe(0);
    expect(metrics.boxShadow).toBe('none');
}

async function expectDrawButtonClearOfHand(page: Page) {
    const drawButtonRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-action-draw"]');
    const handRowRect = await getLocatorRect(page, '[data-testid="fantasyrealms-hand-row"]');
    expect(drawButtonRect.y + drawButtonRect.height).toBeLessThanOrEqual(handRowRect.y - 24);
}

async function expectStableHandRegion(page: Page) {
    const handRects = await getLocatorRects(page, '.fr-card-button--live-hand');
    expect(handRects.length).toBeGreaterThanOrEqual(7);
    const firstCard = handRects[0]!;
    expect(firstCard.width).toBeGreaterThanOrEqual(110);
    expect(firstCard.height).toBeGreaterThanOrEqual(160);
}

async function expectHandRowUsesStableHandSlotGrid(page: Page, expectedSlotCount: number) {
    const metrics = await page.getByTestId('fantasyrealms-hand-row').evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
            slotCount: element.getAttribute('data-slot-count'),
            density: element.getAttribute('data-hand-density'),
            gridTemplateColumns: style.gridTemplateColumns.split(' ').length,
        };
    });
    expect(metrics.slotCount).toBe(String(expectedSlotCount));
    expect(metrics.density).toBe('default');
    expect(metrics.gridTemplateColumns).toBe(expectedSlotCount);
}

async function getFirstHandCardSize(page: Page) {
    const rect = await page.locator('.fr-card-button--live-hand').first().evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
            width: Math.round(box.width),
            height: Math.round(box.height),
        };
    });
    return {
        width: rect.width,
        height: rect.height,
    };
}

async function clearHandCardHoverState(page: Page) {
    await page.mouse.move(8, 8);
    await expect.poll(async () => page.locator('.fr-card-magnify-button').evaluateAll((elements) => (
        elements.every((element) => {
            const style = window.getComputedStyle(element);
            return style.display === 'none' || style.opacity === '0';
        })
    )), {
        message: '截图前必须清掉手牌 hover 态，避免默认图残留放大镜',
    }).toBe(true);
}

async function _expectMagnifyOnlyAppearsOnHover(page: Page) {
    const handCard = page.locator('.fr-card-button--live-hand').first();
    const magnifyButton = handCard.locator('.fr-card-magnify-button');
    await expect(magnifyButton).toHaveCount(1);
    await page.mouse.move(8, 8);
    await expect.poll(async () => magnifyButton.evaluate((element) => window.getComputedStyle(element).opacity), {
        message: '放大镜默认不应常驻显示',
    }).toBe('0');
    await handCard.hover();
    await expect.poll(async () => magnifyButton.evaluate((element) => window.getComputedStyle(element).opacity), {
        message: '放大镜只在悬浮手牌时显示',
    }).toBe('1');
    await page.mouse.move(8, 8);
    await expect.poll(async () => magnifyButton.evaluate((element) => window.getComputedStyle(element).opacity), {
        message: '放大镜离开悬浮后必须退场，不能污染截图',
    }).toBe('0');
}

async function expectSingleCenterCardUsesStableTableSize(page: Page) {
    const centerRects = await getLocatorRects(page, '.fr-card-button--live-center');
    if (centerRects.length !== 1) {
        return;
    }
    const onlyCard = centerRects[0]!;
    expect(onlyCard.width).toBeGreaterThanOrEqual(188);
    expect(onlyCard.width).toBeLessThanOrEqual(212);
    expect(onlyCard.height).toBeGreaterThanOrEqual(284);
    expect(onlyCard.height).toBeLessThanOrEqual(308);
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

    test('抓牌弃牌关键阶段截图链保持同一套正式 UI', async ({ browser }, testInfo) => {
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

            await injectCore(page, FantasyRealmsDomain.setup(['0', '1'], random));
            await expect.poll(async () => {
                const core = await readHarnessCore(page);
                return {
                    currentPlayer: core.currentPlayer,
                    stage: core.stage,
                    handCount: core.players['0']?.hand.length ?? -1,
                    discardCount: core.discardPile.length,
                };
            }, {
                timeout: 10000,
                message: '等待双人开局空弃牌自动从牌库摸2张后进入弃牌阶段',
            }).toEqual({
                currentPlayer: '0',
                stage: 'discard',
                handCount: 2,
                discardCount: 0,
            });
            await expect(page.getByTestId('fantasyrealms-live-action-draw')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();
            await expectTurnChipPrimaryReadable(page);
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expectHandRowUsesStableHandSlotGrid(page, 7);
            await expect(page.locator('.fr-card-slot--live-center-placeholder')).toHaveCount(0);
            await clearHandCardHoverState(page);
            const autoDrawPath = getEvidenceScreenshotPath(testInfo, '01-开局自动摸牌后-待弃牌');
            await mkdir(dirname(autoDrawPath), { recursive: true });
            await page.screenshot({ path: autoDrawPath, fullPage: false });

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();
            await expect.poll(async () => {
                const core = await readHarnessCore(page);
                return {
                    currentPlayer: core.currentPlayer,
                    stage: core.stage,
                    player0Hand: core.players['0']?.hand.length ?? -1,
                    discardCount: core.discardPile.length,
                };
            }, {
                timeout: 10000,
                message: '等待直接点击手牌后切到对手回合',
            }).toEqual({
                currentPlayer: '1',
                stage: 'draw',
                player0Hand: 1,
                discardCount: 1,
            });
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toHaveCount(0);

            const waitingPath = getEvidenceScreenshotPath(testInfo, '02-点击手牌直接弃牌后-等待对手回合');
            await mkdir(dirname(waitingPath), { recursive: true });
            await page.screenshot({ path: waitingPath, fullPage: false });

            await injectCore(page, duelTakeDiscardRequiresDiscardCore());
            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-draw')).toBeVisible();
            await expectTurnChipPrimaryReadable(page);
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expectDrawButtonClearOfHand(page);
            await expectHandRowUsesStableHandSlotGrid(page, 7);
            await clearHandCardHoverState(page);
            const handSizeBeforeTake = await getFirstHandCardSize(page);

            const midgameChoicePath = getEvidenceScreenshotPath(testInfo, '03-中盘公开弃牌存在-摸牌按钮与中央牌直点');
            await mkdir(dirname(midgameChoicePath), { recursive: true });
            await page.screenshot({ path: midgameChoicePath, fullPage: false });

            await page.locator('.fr-card-button--live-center[data-action-state="take"]').first().click();
            await expect.poll(async () => {
                const core = await readHarnessCore(page);
                return {
                    currentPlayer: core.currentPlayer,
                    stage: core.stage,
                    player0Hand: core.players['0']?.hand.length ?? -1,
                    discardCount: core.discardPile.length,
                };
            }, {
                timeout: 10000,
                message: '等待中央公开牌直点拿取后进入弃牌阶段',
            }).toEqual({
                currentPlayer: '0',
                stage: 'discard',
                player0Hand: 8,
                discardCount: 1,
            });
            await expect(page.getByTestId('fantasyrealms-live-hand-zone')).toHaveAttribute('data-motion', 'idle');
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expectStableHandRegion(page);
            await expectSingleCenterCardUsesStableTableSize(page);
            await expectHandRowUsesStableHandSlotGrid(page, 8);
            await clearHandCardHoverState(page);
            const handSizeAfterTake = await getFirstHandCardSize(page);
            expect(Math.abs(handSizeAfterTake.width - handSizeBeforeTake.width)).toBeLessThanOrEqual(2);
            expect(Math.abs(handSizeAfterTake.height - handSizeBeforeTake.height)).toBeLessThanOrEqual(2);

            const takeDiscardSelectionPath = getEvidenceScreenshotPath(testInfo, '04-点击中央牌拿取后-待弃牌');
            await mkdir(dirname(takeDiscardSelectionPath), { recursive: true });
            await page.screenshot({ path: takeDiscardSelectionPath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('右侧偏下主按钮只承接摸牌，拿中央牌与弃牌由卡牌本体承接', async ({ browser }, testInfo) => {
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

            const liveActionZoneSelector = '[data-testid="fantasyrealms-live-action-zone"]';
            const liveStatusStripSelector = '[data-testid="fantasyrealms-live-status-strip"]';
            const liveTableSelector = '[data-testid="fantasyrealms-live-table"]';
            const drawCore = drawStageCore();
            await injectCore(page, drawCore);
            await expect(page.getByText('你的回合')).toBeVisible();
            const drawButton = page.getByTestId('fantasyrealms-live-action-draw');
            await expect(drawButton).toBeVisible();
            await expect(drawButton).toContainText('摸牌');
            await expect(drawButton).toHaveAttribute('data-action-mode', 'draw');
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            const initialStatusStripRect = await getLocatorRect(page, liveStatusStripSelector);
            const initialLiveTableRect = await getLocatorRect(page, liveTableSelector);
            const selectRequiredEvidencePath = getEvidenceScreenshotPath(testInfo, 'live-action-right-dock-draw-only');
            await mkdir(dirname(selectRequiredEvidencePath), { recursive: true });
            await page.screenshot({ path: selectRequiredEvidencePath, fullPage: false });

            const initialActionZoneRect = await getLocatorRect(page, liveActionZoneSelector);
            const initialActionButtonRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-action-draw"]');
            const statusStripBottom = initialStatusStripRect.y + initialStatusStripRect.height;
            const statusStripRight = initialStatusStripRect.x + initialStatusStripRect.width;
            const liveTableRightThreshold = initialLiveTableRect.x + Math.round(initialLiveTableRect.width * 0.72);
            expect(initialActionZoneRect.x).toBeGreaterThanOrEqual(liveTableRightThreshold);
            expect(initialActionZoneRect.x).toBeGreaterThan(statusStripRight);
            expect(initialActionZoneRect.y).toBeGreaterThan(statusStripBottom + 120);
            expect(initialActionButtonRect.width).toBeGreaterThan(initialActionButtonRect.height);
            expect(initialActionButtonRect.x).toBeGreaterThanOrEqual(initialActionZoneRect.x);
            expect(initialActionButtonRect.y).toBeGreaterThanOrEqual(initialActionZoneRect.y - 4);

            const firstDiscardButton = page.getByRole('button', { name: /拿取弃牌/ }).first();
            await firstDiscardButton.click();
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'live-action-center-card-direct-take');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '1'
                    && state?.core?.stage === 'draw'
                    && state?.core?.players?.['0']?.hand?.length === 2
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
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
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

            expect(deckRect.x).toBeGreaterThanOrEqual(liveTableRect.x + 12);
            expect(deckRect.x).toBeLessThanOrEqual(liveTableRect.x + 84);
            expect(deckRect.y).toBeGreaterThanOrEqual(liveTableRect.y);
            expect(Math.abs(statusCenterX - tableCenterX)).toBeLessThanOrEqual(36);
            expect(statusRect.x).toBeGreaterThan(deckRight + 40);
            expect(scoreLeft).toBeGreaterThan(statusRect.x + statusRect.width + 80);
            expect(scoreBandRect.width).toBeGreaterThanOrEqual(118);
            expect(scoreBandRect.width).toBeLessThanOrEqual(160);
            expect(scoreBandRect.height).toBeGreaterThanOrEqual(24);
            expect(scoreBandRect.height).toBeLessThanOrEqual(46);
            expect(scoreRightInset).toBeGreaterThanOrEqual(36);
            expect(scoreRightInset).toBeLessThanOrEqual(104);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'live-hud-three-anchor-topbar');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('手牌区贴住桌面底边，弃牌阶段由手牌本体直接承接', async ({ browser }, testInfo) => {
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

            const liveTableRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-table"]');
            const handZoneRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-hand-zone"]');
            const handRowRect = await getLocatorRect(page, '[data-testid="fantasyrealms-hand-row"]');

            const liveTableBottom = liveTableRect.y + liveTableRect.height;
            const handRowBottom = handRowRect.y + handRowRect.height;
            const handZoneBottom = handZoneRect.y + handZoneRect.height;

            expect(handZoneRect.y).toBeGreaterThan(liveTableRect.y + Math.round(liveTableRect.height * 0.62));
            expect(handZoneBottom).toBeGreaterThanOrEqual(liveTableBottom - 28);
            expect(handRowBottom).toBeGreaterThanOrEqual(liveTableBottom - 28);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'live-hand-zone-bottom-docked');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('开局空弃牌会自动摸2，弃牌阶段直接点击手牌推进', async ({ browser }, testInfo) => {
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
            await injectCore(page, FantasyRealmsDomain.setup(['0', '1'], random));

            await expect.poll(async () => {
                const core = await readHarnessCore(page);
                return {
                    currentPlayer: core.currentPlayer,
                    stage: core.stage,
                    handCount: core.players['0']?.hand.length ?? -1,
                    discardCount: core.discardPile.length,
                };
            }, {
                timeout: 10000,
                message: '等待开局空弃牌自动从牌库摸2张后进入弃牌阶段',
            }).toEqual({
                currentPlayer: '0',
                stage: 'discard',
                handCount: 2,
                discardCount: 0,
            });
            await expect(page.getByTestId('fantasyrealms-live-action-draw')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expect(page.getByRole('button', { name: /弃置手牌/ }).first()).toBeVisible();

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();

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

    test('双人自动开局进入弃牌后，静置时中央牌与手牌不会持续重排或缩放漂移', async ({ browser }, testInfo) => {
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
            await injectCore(page, FantasyRealmsDomain.setup(['0', '1'], random));

            await expect.poll(async () => {
                const core = await readHarnessCore(page);
                return {
                    currentPlayer: core.currentPlayer,
                    stage: core.stage,
                    handCount: core.players['0']?.hand.length ?? -1,
                    discardCount: core.discardPile.length,
                };
            }, {
                timeout: 10000,
                message: '等待双人自动开局进入弃牌静置态',
            }).toEqual({
                currentPlayer: '0',
                stage: 'discard',
                handCount: 2,
                discardCount: 0,
            });

            const liveHandZone = page.getByTestId('fantasyrealms-live-hand-zone');
            const liveCenterRow = page.getByTestId('fantasyrealms-live-center-row');
            await expect(liveHandZone).toHaveAttribute('data-motion', 'idle');
            await expect(liveCenterRow).toHaveAttribute('data-motion', 'idle');

            const sampleRects = async () => {
                const handRects = await getLocatorRects(page, '.fr-card-button--live-hand');
                const centerRects = await getLocatorRects(page, '.fr-card-button--live-center');
                return { handRects, centerRects };
            };

            const firstSample = await sampleRects();
            await page.waitForTimeout(900);
            await expect(liveHandZone).toHaveAttribute('data-motion', 'idle');
            await expect(liveCenterRow).toHaveAttribute('data-motion', 'idle');
            const secondSample = await sampleRects();

            expect(firstSample.handRects).toHaveLength(2);
            expect(secondSample.handRects).toHaveLength(2);
            expect(firstSample.centerRects).toHaveLength(0);
            expect(secondSample.centerRects).toHaveLength(0);

            firstSample.handRects.forEach((firstRect, index) => {
                const secondRect = secondSample.handRects[index]!;
                expect(Math.abs(firstRect.x - secondRect.x)).toBeLessThanOrEqual(1);
                expect(Math.abs(firstRect.y - secondRect.y)).toBeLessThanOrEqual(1);
                expect(Math.abs(firstRect.width - secondRect.width)).toBeLessThanOrEqual(1);
                expect(Math.abs(firstRect.height - secondRect.height)).toBeLessThanOrEqual(1);
            });

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'opening-idle-layout-stable');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('2人 duel 变体手牌已满7且无公开弃牌时，会自动摸1并继续弃1', async ({ browser }, testInfo) => {
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

            await expect(page.getByText('你的回合')).toBeVisible();
            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && state?.core?.players?.['0']?.hand?.length === 8
                    && state?.core?.discardPile?.length === 0;
            }, { timeout: 10000 });

            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();

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
            const handZone = page.getByTestId('fantasyrealms-live-hand-zone');
            await expect(handZone).toHaveAttribute('data-motion', 'draw-to-hand', { timeout: 1000 });

            const drawStartPath = getEvidenceScreenshotPath(testInfo, 'motion-draw-start');
            await mkdir(dirname(drawStartPath), { recursive: true });
            const drawStartFrame = await getFirstCardMotionFrame(page, '.fr-card-button--motion-hand-draw .fr-card');
            await page.screenshot({ path: drawStartPath, fullPage: false });

            await page.waitForTimeout(220);
            const drawMidPath = getEvidenceScreenshotPath(testInfo, 'motion-draw-mid');
            const drawMidFrame = await getFirstCardMotionFrame(page, '.fr-card-button--motion-hand-draw .fr-card');
            await page.screenshot({ path: drawMidPath, fullPage: false });

            await expect(handZone).toHaveAttribute('data-motion', 'idle', { timeout: 1600 });
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
            const centerRow = page.getByTestId('fantasyrealms-live-center-row');
            await expect(centerRow).toHaveAttribute('data-motion', 'hand-to-center', { timeout: 1000 });

            const discardStartPath = getEvidenceScreenshotPath(testInfo, 'motion-discard-start');
            const discardStartFrame = await getFirstCardMotionFrame(page, '.fr-card-button--motion-center-receive .fr-card');
            await page.screenshot({ path: discardStartPath, fullPage: false });

            await page.waitForTimeout(220);
            const discardMidPath = getEvidenceScreenshotPath(testInfo, 'motion-discard-mid');
            const discardMidFrame = await getFirstCardMotionFrame(page, '.fr-card-button--motion-center-receive .fr-card');
            await page.screenshot({ path: discardMidPath, fullPage: false });

            await expect(centerRow).toHaveAttribute('data-motion', 'idle', { timeout: 2400 });
            const discardEndPath = getEvidenceScreenshotPath(testInfo, 'motion-discard-end');
            await page.screenshot({ path: discardEndPath, fullPage: false });
            const discardEndFrame = await getFirstCardMotionFrame(page, '.fr-card-button--live-center .fr-card');

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
                    playerId,
                    rank: index + 1,
                    playerName: `玩家${Number(playerId) + 1}`,
                    score,
                    isWinner: gameOverResult.winner === playerId,
                }));

            await injectCore(page, core, { gameover: gameOverResult });

            await expect(page.getByTestId('fantasyrealms-live-topbar')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('fantasyrealms-live-score-strip')).toBeVisible();
            const standingsRegion = page.getByLabel('最终排名');
            await expect(standingsRegion).toBeVisible({ timeout: 10000 });
            const winnerStanding = sortedStandings.find((standing) => standing.isWinner) ?? sortedStandings[0];
            if (!winnerStanding) {
                throw new Error('Expected at least one Fantasy Realms final standing');
            }
            const winnerRow = page.getByTestId(`fantasyrealms-endgame-rank-${winnerStanding.playerId}`);
            await expect(winnerRow).toBeVisible();
            await expect(winnerRow).toHaveAttribute('data-rank-tone', 'gold');
            await expect(winnerRow.getByLabel('胜者')).toBeVisible();
            await expect(winnerRow.locator('.fr-live-endgame-rank-order').getByLabel('胜者')).toBeVisible();
            await expect(winnerRow.locator('[data-score-role="final-score"]')).toHaveText(String(winnerStanding.score));
            const liveScoreTotal = page.getByTestId('fantasyrealms-live-score-total');
            await expect(liveScoreTotal).toHaveAttribute('data-score-animation', 'settlement-sequence');
            await expect(liveScoreTotal).toHaveAttribute('data-score-target', String(winnerStanding.score));
            await page.waitForTimeout(260);
            await expect(page.getByTestId('fantasyrealms-live-score-step')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-endgame-card-delta')).toBeVisible();
            const animatedTotalValue = Number(await liveScoreTotal.getAttribute('data-score-current'));
            expect(animatedTotalValue).toBeGreaterThan(0);
            expect(animatedTotalValue).toBeLessThan(winnerStanding.score);
            const animationEvidencePath = getEvidenceScreenshotPath(testInfo, '计分动画进行中');
            await mkdir(dirname(animationEvidencePath), { recursive: true });
            await page.screenshot({ path: animationEvidencePath, fullPage: false });
            const handZonePosition = await page.getByTestId('fantasyrealms-live-hand-zone').evaluate((element) => (
                window.getComputedStyle(element).position
            ));
            expect(handZonePosition).not.toBe('fixed');
            const endgameRect = await getLocatorRect(page, '[data-testid="fantasyrealms-live-endgame"]');
            const overlappingCenterCardRight = await page.locator('.fr-card-button--live-center').evaluateAll((elements, railRect) => {
                const rect = railRect as { top: number; bottom: number };
                const overlappingCards = elements
                    .map((element) => element.getBoundingClientRect())
                    .filter((cardRect) => cardRect.top < rect.bottom && cardRect.bottom > rect.top);
                return overlappingCards.length > 0
                    ? Math.max(...overlappingCards.map((cardRect) => cardRect.right))
                    : 0;
            }, { top: endgameRect.y, bottom: endgameRect.y + endgameRect.height });
            expect(overlappingCenterCardRight).toBeLessThanOrEqual(endgameRect.x - 8);
            await expect(page.getByTestId('fantasyrealms-endgame-reviewed-player')).toBeVisible();
            const rows = standingsRegion.locator('button[data-testid^="fantasyrealms-endgame-rank-"]');
            await expect(rows).toHaveCount(sortedStandings.length);
            for (const standing of sortedStandings) {
                const row = page.getByTestId(`fantasyrealms-endgame-rank-${standing.playerId}`);
                await expect(row).toBeVisible();
                await expect(row).toContainText(`第 ${standing.rank} 名`);
                if (standing.rank <= 3) {
                    const rankTone = standing.rank === 1 ? 'gold' : standing.rank === 2 ? 'silver' : 'bronze';
                    await expect(row).toHaveAttribute('data-rank-tone', rankTone);
                }
                await expect(row.locator('.fr-live-endgame-rank-score')).toHaveText(String(standing.score));
                await expect(row.locator('[data-score-role="final-score"]')).toHaveText(String(standing.score));
            }
            await expect(liveScoreTotal).toHaveAttribute('data-score-current', String(winnerStanding.score));
            await expect(liveScoreTotal).toHaveAttribute('data-score-running', 'false');
            const evidencePath = getEvidenceScreenshotPath(testInfo, '终局最终排名');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });
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
                    playerId,
                    rank: index + 1,
                    playerName: `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await injectCore(page, core);

            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return Boolean(state?.sys?.gameover);
            }, { timeout: 10000 });

            const standingsRegion = page.getByLabel('最终排名');
            await expect(standingsRegion).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-endgame-reviewed-player')).toBeVisible();
            const rows = standingsRegion.locator('button[data-testid^="fantasyrealms-endgame-rank-"]');
            await expect(rows).toHaveCount(sortedStandings.length);
            for (const standing of sortedStandings) {
                const row = page.getByTestId(`fantasyrealms-endgame-rank-${standing.playerId}`);
                await expect(row).toBeVisible();
                await expect(row).toContainText(`第 ${standing.rank} 名`);
                await expect(row.locator('.fr-live-endgame-rank-score')).toHaveText(String(standing.score));
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
                    playerId,
                    rank: index + 1,
                    playerName: `玩家${Number(playerId) + 1}`,
                    score,
                }));

            await injectCore(page, core);

            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByText('9/10')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return Boolean(state?.sys?.gameover);
            }, { timeout: 10000 });

            const standingsRegion = page.getByLabel('最终排名');
            await expect(standingsRegion).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-endgame-reviewed-player')).toBeVisible();
            const rows = standingsRegion.locator('button[data-testid^="fantasyrealms-endgame-rank-"]');
            await expect(rows).toHaveCount(sortedStandings.length);
            for (const standing of sortedStandings) {
                const row = page.getByTestId(`fantasyrealms-endgame-rank-${standing.playerId}`);
                await expect(row).toBeVisible();
                await expect(row).toContainText(`第 ${standing.rank} 名`);
                await expect(row.locator('.fr-live-endgame-rank-score')).toHaveText(String(standing.score));
            }
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('低张数公开弃牌保持前缀槽位一致，并使用更大的重叠双排牌河', async ({ browser }, testInfo) => {
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

            await injectCore(page, fullTenDiscardCore());
            await expect(page.getByText('你的回合')).toBeVisible();

            const fullRowRects = await waitForLocatorRectsToSettle(page, '.fr-card-button--live-center');
            expect(fullRowRects).toHaveLength(10);

            const topRowRects = fullRowRects.slice(0, 5);
            const secondRowRects = fullRowRects.slice(5);
            const topRowStride = topRowRects[1]!.x - topRowRects[0]!.x;
            const secondRowStride = secondRowRects[1]!.x - secondRowRects[0]!.x;
            const secondRowOffset = secondRowRects[0]!.x - topRowRects[0]!.x;
            const rowTopDelta = secondRowRects[0]!.y - topRowRects[0]!.y;

            expect(topRowStride).toBeGreaterThan(topRowRects[0]!.width);
            expect(topRowStride).toBeLessThan(topRowRects[0]!.width * 1.3);
            expect(Math.abs(topRowStride - secondRowStride)).toBeLessThanOrEqual(2);
            expect(secondRowOffset).toBeLessThan(0);
            expect(Math.abs(secondRowOffset)).toBeGreaterThanOrEqual(Math.round(topRowRects[0]!.width * 0.35));
            expect(Math.abs(secondRowOffset)).toBeLessThanOrEqual(Math.round(topRowRects[0]!.width * 0.65));
            expect(Math.abs(secondRowRects[0]!.width - topRowRects[0]!.width)).toBeLessThanOrEqual(2);
            expect(Math.abs(secondRowRects[0]!.height - topRowRects[0]!.height)).toBeLessThanOrEqual(2);
            expect(rowTopDelta).toBeGreaterThan(Math.round(topRowRects[0]!.height * 0.45));
            expect(rowTopDelta).toBeLessThan(Math.round(topRowRects[0]!.height * 0.8));

            await injectCore(page, {
                ...drawStageCore(),
                discardPile: fullTenDiscardCore().discardPile.slice(0, 1),
            });
            await expect(page.locator('.fr-card-button--live-center')).toHaveCount(1);
            const oneCardRects = await waitForLocatorRectsToSettle(page, '.fr-card-button--live-center');
            expect(oneCardRects).toHaveLength(1);
            expect(Math.abs(oneCardRects[0]!.x - topRowRects[0]!.x)).toBeLessThanOrEqual(2);
            expect(Math.abs(oneCardRects[0]!.y - topRowRects[0]!.y)).toBeLessThanOrEqual(2);
            expect(Math.abs(oneCardRects[0]!.width - topRowRects[0]!.width)).toBeLessThanOrEqual(2);
            expect(Math.abs(oneCardRects[0]!.height - topRowRects[0]!.height)).toBeLessThanOrEqual(2);
            await expect(page.locator('.fr-card-slot--live-center-placeholder')).toHaveCount(0);

            await injectCore(page, drawStageCore());
            await expect(page.getByText('你的回合')).toBeVisible();
            const lowCountRects = await waitForLocatorRectsToSettle(page, '.fr-card-button--live-center');
            expect(lowCountRects).toHaveLength(2);

            expect(Math.abs(lowCountRects[0]!.width - topRowRects[0]!.width)).toBeLessThanOrEqual(2);
            expect(Math.abs(lowCountRects[0]!.height - topRowRects[0]!.height)).toBeLessThanOrEqual(2);
            expect(Math.abs(lowCountRects[0]!.x - topRowRects[0]!.x)).toBeLessThanOrEqual(2);
            expect(Math.abs(lowCountRects[0]!.y - topRowRects[0]!.y)).toBeLessThanOrEqual(2);
            expect(Math.abs(lowCountRects[1]!.x - topRowRects[1]!.x)).toBeLessThanOrEqual(2);
            expect(Math.abs(lowCountRects[1]!.y - topRowRects[1]!.y)).toBeLessThanOrEqual(2);
            await expect(page.locator('.fr-card-slot--live-center-placeholder')).toHaveCount(0);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'low-count-prefix-slots');
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

            const centerCardsSelector = '.fr-card-button--live-center';
            const centerCards = page.locator(centerCardsSelector);
            await expect(page.getByText('9/10')).toBeVisible();
            await expect(centerCards).toHaveCount(9);

            const rects = await getLocatorRects(page, centerCardsSelector);
            const topRow = rects.slice(0, 5);
            const bottomRow = rects.slice(5);

            expect(bottomRow).toHaveLength(4);
            const topRowY = topRow[0]!.y;
            const bottomRowY = bottomRow[0]!.y;

            for (const rect of topRow) {
                expect(rect.y).toBe(topRowY);
                expect(rect.width).toBeGreaterThanOrEqual(188);
                expect(rect.width).toBeLessThanOrEqual(212);
            }
            for (const rect of bottomRow) {
                expect(rect.y).toBe(bottomRowY);
                expect(rect.width).toBeGreaterThanOrEqual(188);
                expect(rect.width).toBeLessThanOrEqual(212);
            }

            expect(bottomRowY).toBeGreaterThan(topRowY + 120);
            expect(bottomRowY).toBeLessThan(topRowY + topRow[0]!.height - 20);

            for (let index = 0; index < bottomRow.length; index += 1) {
                const previousTop = topRow[index]!;
                const bottom = bottomRow[index]!;
                const leftShift = previousTop.x - bottom.x;
                expect(leftShift).toBeGreaterThan(80);
                expect(leftShift).toBeLessThan(130);
            }

            await page.waitForTimeout(1400);
            const evidencePath = getEvidenceScreenshotPath(testInfo, 'near-end-interleaved-center-row');
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

            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-draw')).toBeVisible();
            const firstDiscardButton = page.getByRole('button', { name: /拿取弃牌/ }).first();
            await firstDiscardButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && state?.core?.players?.['0']?.hand?.length === 8
                    && state?.core?.discardPile?.length === 1;
            }, { timeout: 10000 });

            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();

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

            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-draw')).toBeVisible();
            const firstDiscardButton = page.getByRole('button', { name: /拿取弃牌/ }).first();
            await firstDiscardButton.click();

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && state?.core?.players?.['0']?.hand?.length === 8
                    && state?.core?.discardPile?.length === 1;
            }, { timeout: 10000 });

            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();

            const firstHandButton = page.getByRole('button', { name: /弃置手牌/ }).first();
            await firstHandButton.click();

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

    test('3人基础版首回合公开弃牌为空时，自动摸1并进入弃牌阶段', async ({ browser }, testInfo) => {
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

            await expect(page.getByText('你的回合')).toBeVisible();
            await expect(page.getByText('0/10')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-draw')).toHaveCount(0);
            await expect(page.getByRole('button', { name: /拿取弃牌/ })).toHaveCount(0);

            await page.waitForFunction(() => {
                const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.currentPlayer === '0'
                    && state?.core?.stage === 'discard'
                    && state?.core?.players?.['0']?.hand?.length === 8
                    && state?.core?.discardPile?.length === 0;
            }, { timeout: 10000 });

            await expect(page.getByTestId('fantasyrealms-live-status-banner')).toHaveCount(0);
            await expect(page.getByTestId('fantasyrealms-live-action-zone')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-discard')).toBeDisabled();
        } finally {
            await context.close().catch(() => {});
        }
    });
});
