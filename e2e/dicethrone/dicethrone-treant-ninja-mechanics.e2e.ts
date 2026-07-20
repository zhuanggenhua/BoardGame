
/**
 * DiceThrone Treant / Ninja 新英雄机制端到端证据。
 *
 * 目的：补足新增英雄不只“能选角进局”，而是关键 token/passive 能在真实在线对局入口触发、展示并收口。
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../framework';
import type { Browser, Page } from '@playwright/test';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import '../../src/games/dicethrone/domain';
import {
    closeDebugPanelIfOpen,
    dispatchDiceThroneCommand,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS, TREANT_DICE_FACE_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { BLINK_2 } from '../../src/games/dicethrone/heroes/ninja/abilities';
import { NINJA_CARDS } from '../../src/games/dicethrone/heroes/ninja/cards';
import { TREANT_CARDS } from '../../src/games/dicethrone/heroes/treant/cards';

type JsonRecord = Record<string, unknown>;

type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const asRecord = (value: unknown): JsonRecord =>
    value && typeof value === 'object' ? value as JsonRecord : {};

const asRecordMap = (value: unknown): Record<string, JsonRecord> =>
    value && typeof value === 'object' ? value as Record<string, JsonRecord> : {};

const evidenceRoot = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    'dicethrone',
    'dicethrone-treant-ninja-mechanics.e2e',
);

const screenshot = async (page: Page, testName: string, fileName: string) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, fileName);
    await page.screenshot({ path, fullPage: false });
    return path;
};

const screenshotLocator = async (
    locator: ReturnType<Page['locator']>,
    testName: string,
    fileName: string,
) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, fileName);
    await locator.screenshot({ path });
    return path;
};

const closeMatchContexts = async (match: MatchSetup) => {
    const closeWithTimeout = async (close: () => Promise<void>) => {
        await Promise.race([
            close().catch(() => undefined),
            new Promise<void>(resolve => setTimeout(resolve, 3000)),
        ]);
    };
    await Promise.all([
        closeWithTimeout(() => match.hostContext.close()),
        closeWithTimeout(() => match.guestContext.close()),
    ]);
};

const setupTreantNinjaMatch = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL);
    if (!match) {
        test.skip(true, '游戏服务器不可用');
        throw new Error('Game server unavailable');
    }
    await selectCharacter(match.hostPage, 'treant');
    await selectCharacter(match.guestPage, 'ninja');
    await readyAndStartGame(match.hostPage, match.guestPage);
    await waitForGameBoard(match.hostPage);
    await waitForGameBoard(match.guestPage);
    await waitForDiceThroneHarness(match.hostPage);
    await waitForDiceThroneHarness(match.guestPage);
    await match.hostPage.setViewportSize({ width: 1280, height: 720 });
    await match.guestPage.setViewportSize({ width: 1280, height: 720 });
    await match.hostPage.waitForTimeout(800);
    await match.guestPage.waitForTimeout(800);
    return match;
};

const applyOnlineMatchState = async (
    matchId: string,
    page: Page,
    updater: (state: JsonRecord) => JsonRecord,
    waitMs = 800,
) => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const next = updater(structuredClone(current));
    const root = asRecord(next.G ?? next);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(asRecordMap(core.players));

    root.core = {
        ...core,
        phase: typeof core.phase === 'string' ? core.phase : sys.phase,
    };
    root.sys = {
        ...sys,
        matchId,
        turnOrder,
        currentPlayerIndex: typeof sys.currentPlayerIndex === 'number' ? sys.currentPlayerIndex : 0,
    };

    await injectMatchState(matchId, next, page);
    await page.waitForTimeout(waitMs);
};

const setTutorialFixedDie = (sys: JsonRecord, value: number): JsonRecord => ({
    ...sys,
    tutorial: {
        ...asRecord(sys.tutorial),
        active: true,
        randomPolicy: { mode: 'fixed', values: [value] },
    },
});

const readHarnessCoreState = async (page: Page): Promise<JsonRecord> => {
    const state = await page.evaluate(() => (window as Window).__BG_TEST_HARNESS__!.state.get());
    return asRecord(state?.core ?? state?.G?.core);
};

const readHarnessState = async (page: Page): Promise<JsonRecord> => {
    const state = await page.evaluate(() => (window as Window).__BG_TEST_HARNESS__!.state.get());
    return asRecord(state?.G ?? state);
};

const clickAdvancePhase = async (page: Page, playerId: string) => {
    await closeDebugPanelIfOpen(page);
    await closeCardSpotlightIfOpen(page);
    const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
    if (
        await advanceButton.isVisible({ timeout: 2000 }).catch(() => false)
        && await advanceButton.isEnabled({ timeout: 500 }).catch(() => false)
    ) {
        const clicked = await advanceButton.click({ timeout: 2000 }).then(() => true).catch(() => false);
        if (clicked) return;
        await closeCardSpotlightIfOpen(page);
        const clickedAfterClose = await advanceButton.click({ timeout: 2000 }).then(() => true).catch(() => false);
        if (clickedAfterClose) return;
        // 真实按钮被瞬态特写/HUD 层遮挡时，仍通过同一对局命令路径推进，避免 E2E 卡死在测试 UI 遮挡。
        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId,
            payload: {},
        });
        return;
    }
    await dispatchDiceThroneCommand(page, {
        type: 'ADVANCE_PHASE',
        playerId,
        payload: {},
    });
};

const clickTokenUseButton = async (page: Page) => {
    await page.getByTestId('token-response-modal').getByRole('button', { name: /^使用/i }).first().click();
};

const closeTokenResponseIfOpen = async (page: Page) => {
    const modal = page.getByTestId('token-response-modal');
    if (!await modal.isVisible({ timeout: 1000 }).catch(() => false)) return;
    const closeButton = modal.getByRole('button', { name: /跳过|Skip|确认|Confirm/i }).last();
    await closeButton.click();
};

const closeCardSpotlightIfOpen = async (page: Page) => {
    const closeButton = page.getByRole('button', { name: /关闭特写|Close/i }).first();
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(200);
        return;
    }
    const cardSpotlight = page.getByTestId('card-spotlight-overlay');
    if (await cardSpotlight.isVisible({ timeout: 1000 }).catch(() => false)) {
        throw new Error('卡牌特写可见但没有明确关闭按钮');
    }
};

const screenshotCardSpotlightIfVisible = async (
    page: Page,
    testName: string,
    fileName: string,
    expectedDiceCount?: number,
) => {
    const cardSpotlight = page.getByTestId('card-spotlight-overlay');
    if (!await cardSpotlight.isVisible({ timeout: 1500 }).catch(() => false)) return false;
    if (typeof expectedDiceCount === 'number') {
        await expect(cardSpotlight.getByTestId('card-spotlight-die')).toHaveCount(expectedDiceCount);
    }
    await screenshot(page, testName, fileName);
    await closeCardSpotlightIfOpen(page);
    return true;
};

const closeBonusDieOverlay = async (page: Page) => {
    const confirmDamageButton = page.getByRole('button', { name: /^(确认伤害|Confirm Damage)$/i }).first();
    if (await confirmDamageButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmDamageButton.click();
        return;
    }
    const closeButton = page.getByLabel(/关闭|Close/i).first();
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();
};

const clickLifeSapPassive = async (page: Page) => {
    await closeDebugPanelIfOpen(page);
    const passiveButton = page.getByTestId('passive-action-treant-life-sap-0');
    if (
        await passiveButton.isVisible({ timeout: 2000 }).catch(() => false)
        && await passiveButton.isEnabled({ timeout: 500 }).catch(() => false)
    ) {
        await passiveButton.click();
        return;
    }
    await dispatchDiceThroneCommand(page, {
        type: 'USE_PASSIVE_ABILITY',
        playerId: '0',
        payload: { passiveId: 'treant-life-sap', actionIndex: 0 },
    });
};

const forceFixedDieQueue = (sys: JsonRecord, values: number[]): JsonRecord => ({
    ...sys,
    tutorial: {
        ...asRecord(sys.tutorial),
        active: true,
        randomPolicy: { mode: 'sequence', values, cursor: 0 },
    },
});

const clickPassiveAction = async (
    page: Page,
    testId: string,
    fallbackCommand: { passiveId: string; actionIndex: number },
) => {
    await closeDebugPanelIfOpen(page);
    const button = page.getByTestId(testId);
    if (
        await button.isVisible({ timeout: 2000 }).catch(() => false)
        && await button.isEnabled({ timeout: 500 }).catch(() => false)
    ) {
        await button.click();
        return;
    }
    await dispatchDiceThroneCommand(page, {
        type: 'USE_PASSIVE_ABILITY',
        playerId: '0',
        payload: fallbackCommand,
    });
};

const cloneNinjaCard = (cardId: string): JsonRecord => {
    const card = NINJA_CARDS.find(item => item.id === cardId);
    if (!card) throw new Error(`Unknown Ninja card: ${cardId}`);
    return structuredClone(card) as JsonRecord;
};

const cloneTreantCard = (cardId: string): JsonRecord => {
    const card = TREANT_CARDS.find(item => item.id === cardId);
    if (!card) throw new Error(`Unknown Treant card: ${cardId}`);
    return structuredClone(card) as JsonRecord;
};

const dragHandCardToPlay = async (page: Page, cardId: string): Promise<void> => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
};

test.describe('DiceThrone Treant / Ninja 新英雄机制', () => {
    test('树精生命源泉应在主阶段触发奖励骰治疗并收口', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精生命源泉应在主阶段触发奖励骰治疗并收口';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources);
                const tokens = asRecord(p0.tokens);

                players['0'] = {
                    ...p0,
                    resources: { ...resources, [RESOURCE_IDS.HP]: 35, [RESOURCE_IDS.CP]: 2 },
                    tokens: { ...tokens, [TOKEN_IDS.LIFE_SAP]: 1 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = setTutorialFixedDie({ ...sys, phase: 'main1', currentPlayerIndex: 0 }, 5);
                return state;
            });
            await expect.poll(async () => {
                const state = await match.hostPage.evaluate(() => (window as Window).__BG_TEST_HARNESS__!.state.get());
                const core = state?.core ?? state?.G?.core;
                const p0 = core?.players?.['0'];
                return {
                    phase: state?.sys?.phase ?? state?.G?.sys?.phase,
                    activePlayerId: core?.activePlayerId,
                    hp: p0?.resources?.hp,
                    cp: p0?.resources?.cp,
                    lifeSap: p0?.tokens?.life_sap,
                    tokens: p0?.tokens,
                };
            }, { timeout: 10000 }).toEqual({
                phase: 'main1',
                activePlayerId: '0',
                hp: 35,
                cp: 2,
                lifeSap: 1,
                tokens: expect.objectContaining({ life_sap: 1 }),
            });
            await closeDebugPanelIfOpen(match.hostPage);

            await expect(match.hostPage.getByTestId('player-board-surface')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('passive-action-treant-life-sap-0')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('passive-action-treant-seedling-cultivation-0')).toBeHidden();
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-0')).toBeHidden();
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-1')).toBeHidden();
            await screenshot(match.hostPage, testName, '01-life-sap-entry-before-use.png');

            await clickLifeSapPassive(match.hostPage);
            await expect(match.hostPage.getByTestId('bonus-die-overlay')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('bonus-die-reroll-option-0')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '02-life-sap-bonus-die-overlay.png');

            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                return resources[RESOURCE_IDS.HP];
            }, { timeout: 10000 }).toBe(38);

            await match.hostPage.getByLabel(/关闭|Close/i).first().click();
            await expect(match.hostPage.getByTestId('bonus-die-overlay')).toBeHidden({ timeout: 10000 });
            await expect(match.hostPage.getByText('38').first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '03-life-sap-after-close.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精木苗树灵主阶段按钮应短文案展示且同回合同类仅能花费一次', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精木苗树灵主阶段按钮应短文案展示且同回合同类仅能花费一次';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources);
                const tokens = asRecord(p0.tokens);

                players['0'] = {
                    ...p0,
                    resources: { ...resources, [RESOURCE_IDS.HP]: 35, [RESOURCE_IDS.CP]: 1 },
                    tokens: { ...tokens, [TOKEN_IDS.TREANT_SAPLING]: 2 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = { ...sys, phase: 'main1', currentPlayerIndex: 0 };
                return state;
            });

            await closeDebugPanelIfOpen(match.hostPage);
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-0')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-1')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-0')).toContainText(/治疗\+CP/);
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-1')).toContainText(/抽牌/);
            await expect(match.hostPage.getByTestId('passive-action-treant-seedling-cultivation-0')).toBeHidden();
            await expect(match.hostPage.getByTestId('passive-action-treant-life-sap-0')).toBeHidden();
            await screenshot(match.hostPage, testName, '01-sapling-short-buttons-before-use.png');

            await clickPassiveAction(match.hostPage, 'passive-action-treant-sapling-cultivation-0', {
                passiveId: 'treant-sapling-cultivation',
                actionIndex: 0,
            });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                return {
                    hp: resources[RESOURCE_IDS.HP],
                    cp: resources[RESOURCE_IDS.CP],
                    sapling: tokens[TOKEN_IDS.TREANT_SAPLING],
                    spentSapling: asRecord(asRecord(core.treantSpiritSpentThisTurn)['0'])?.[TOKEN_IDS.TREANT_SAPLING],
                };
            }, { timeout: 10000 }).toEqual({ hp: 36, cp: 2, sapling: 1, spentSapling: true });
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-0')).toBeHidden({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-1')).toBeHidden({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '02-sapling-after-one-use-same-type-hidden.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精幼种树灵应通过真实骰子按钮完成重掷', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精幼种树灵应通过真实骰子按钮完成重掷';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const tokens = asRecord(p0.tokens);
                const dice = Array.isArray(core.dice) ? [...core.dice] : [];

                players['0'] = {
                    ...p0,
                    tokens: { ...tokens, [TOKEN_IDS.TREANT_SEEDLING]: 1 },
                };
                dice[0] = { ...asRecord(dice[0]), id: 0, value: 1, isKept: false };
                root.core = {
                    ...core,
                    players,
                    dice,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: false,
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({ ...sys, phase: 'offensiveRoll', currentPlayerIndex: 0 }, [6]);
                return state;
            });

            await closeDebugPanelIfOpen(match.hostPage);
            await expect(match.hostPage.getByTestId('passive-action-treant-seedling-cultivation-0')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('passive-action-treant-seedling-cultivation-0')).toContainText(/重掷/);
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-0')).toBeHidden();
            await expect(match.hostPage.getByTestId('passive-action-treant-sapling-cultivation-1')).toBeHidden();
            await expect(match.hostPage.getByTestId('passive-action-treant-life-sap-0')).toBeHidden();
            await expect(match.hostPage.getByTestId('die-button-0')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '01-seedling-reroll-before-select.png');

            await match.hostPage.getByTestId('passive-action-treant-seedling-cultivation-0').click();
            await expect(match.hostPage.getByTestId('passive-action-treant-seedling-cultivation-0')).toContainText(/取消|Cancel/);
            await screenshot(match.hostPage, testName, '02-seedling-reroll-selection-mode.png');

            await match.hostPage.getByTestId('die-button-0').click();
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                const dice = Array.isArray(core.dice) ? core.dice as Array<{ id?: number; value?: number }> : [];
                return {
                    die0: dice.find(die => die.id === 0)?.value,
                    seedling: tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ die0: 6, seedling: 0 });
            await expect(match.hostPage.getByTestId('passive-action-treant-seedling-cultivation-0')).toBeHidden({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '03-seedling-reroll-after-die-click.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精小顺子高亮应落在复仇枝蔓而不是被动槽', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精小顺子高亮应落在复仇枝蔓而不是被动槽';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const dice = Array.isArray(core.dice) ? [...core.dice] : [];
                const values = [2, 3, 4, 5, 6];
                const symbols = [
                    TREANT_DICE_FACE_IDS.BRANCH,
                    TREANT_DICE_FACE_IDS.BRANCH,
                    TREANT_DICE_FACE_IDS.LEAF,
                    TREANT_DICE_FACE_IDS.LEAF,
                    TREANT_DICE_FACE_IDS.SPIRIT,
                ];

                for (let index = 0; index < 5; index += 1) {
                    dice[index] = {
                        ...asRecord(dice[index]),
                        id: index,
                        value: values[index],
                        symbol: symbols[index],
                        ownerId: '0',
                        isKept: false,
                    };
                }

                root.core = {
                    ...core,
                    dice,
                    activePlayerId: '0',
                    rollDiceCount: 5,
                    phase: 'offensiveRoll',
                    rollCount: 2,
                    rollConfirmed: false,
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                };
                return state;
            });

            await closeDebugPanelIfOpen(match.hostPage);
            const confirmButton = match.hostPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeVisible({ timeout: 10000 });
            await confirmButton.click();

            await expect.poll(async () => {
                const slots = await match.hostPage
                    .locator('[data-ability-slot]')
                    .filter({ has: match.hostPage.locator('div.animate-pulse[class*="border-"]') })
                    .evaluateAll(elements => elements.map(element => element.getAttribute('data-ability-slot')));
                return slots;
            }, { timeout: 10000 }).toEqual(['combo']);
            await expect(
                match.hostPage.locator('[data-ability-slot="sky"][data-passive-ability="true"]').locator('div.animate-pulse[class*="border-"]')
            ).toHaveCount(0);
            await screenshot(match.hostPage, testName, '01-vengeful-vines-highlight-on-combo-slot.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精神圣 +3 应在真实攻击方响应窗中结算', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精神圣 +3 应在真实攻击方响应窗中结算';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const tokens = asRecord(p0.tokens);

                players['0'] = { ...p0, tokens: { ...tokens, [TOKEN_IDS.TREANT_DIVINE]: 1 } };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist',
                        isDefendable: true,
                        damage: 6,
                    },
                    pendingDamage: {
                        id: 'e2e-treant-divine-before-damage',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 6,
                        currentDamage: 6,
                        sourceAbilityId: 'shattering-fist',
                        responseType: 'beforeDamageDealt',
                        responderId: '0',
                        isFullyEvaded: false,
                    },
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: {
                        ...asRecord(sys.interaction),
                        current: {
                            id: 'dt-token-response-e2e-treant-divine-before-damage',
                            kind: 'dt:token-response',
                            playerId: '0',
                            data: { pendingDamageId: 'e2e-treant-divine-before-damage' },
                        },
                    },
                };
                return state;
            });

            await expect(match.hostPage.getByTestId('token-response-modal')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '01-divine-token-response-before-use.png');

            await clickTokenUseButton(match.hostPage);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                const pendingDamage = asRecord(core.pendingDamage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    divine: tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0,
                    currentDamage: pendingDamage.currentDamage,
                    bonusDamage: pendingAttack.bonusDamage,
                };
            }, { timeout: 10000 }).toEqual({ divine: 0, currentDamage: 9, bonusDamage: 3 });
            await screenshot(match.hostPage, testName, '02-divine-after-use-damage-plus-three.png');

            await closeTokenResponseIfOpen(match.hostPage);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                return Boolean(core.pendingDamage);
            }, { timeout: 10000 }).toBe(false);
            await screenshot(match.hostPage, testName, '03-divine-after-response-close.png');

        } finally {
            await closeMatchContexts(match);
        }
    });


    test('树精神圣防负面应在阶段推进中弹出可选响应窗', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精神圣防负面应在阶段推进中弹出可选响应窗';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p0Tokens = asRecord(p0.tokens);
                const p1 = asRecord(players['1']);
                const p1Tokens = asRecord(p1.tokens);

                players['0'] = { ...p0, tokens: { ...p0Tokens, [TOKEN_IDS.TREANT_DIVINE]: 1, [TOKEN_IDS.DELAYED_POISON]: 0 } };
                players['1'] = { ...p1, tokens: { ...p1Tokens, [TOKEN_IDS.NINJUTSU]: 0 } };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'poison-blade',
                        isDefendable: true,
                        damage: 6,
                        offensiveRollEndTokenResolved: true,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = { ...sys, phase: 'offensiveRoll', currentPlayerIndex: 1, interaction: { ...asRecord(sys.interaction), current: undefined } };
                return state;
            });
            await screenshot(match.guestPage, testName, '01-divine-prevent-debuff-before-advance.png');

            await clickAdvancePhase(match.guestPage, '1');
            await expect(match.hostPage.getByText('神性树灵：是否防止即将受到的负面状态？')).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByRole('button', { name: /花费神性树灵/ })).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByRole('button', { name: /不花费/ })).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '02-divine-choice-modal-skip-branch.png');

            await match.hostPage.getByRole('button', { name: /不花费/ }).click();
            await expect(match.hostPage.getByText('神性树灵：是否防止即将受到的负面状态？')).toBeHidden({ timeout: 10000 });
            await clickAdvancePhase(match.guestPage, '1');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const root = await readHarnessState(match.guestPage);
                const players = asRecordMap(core.players);
                const defender = asRecord(players['0']);
                const tokens = asRecord(defender.tokens) as Record<string, number>;
                const sys = asRecord(root.sys);
                return {
                    phase: sys.phase,
                    divine: tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0,
                    poison: tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ phase: 'defensiveRoll', divine: 1, poison: 1 });
            await screenshot(match.hostPage, testName, '03-divine-skip-keeps-debuff-and-token.png');

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p0Tokens = asRecord(p0.tokens);
                const p1 = asRecord(players['1']);
                const p1Tokens = asRecord(p1.tokens);

                players['0'] = { ...p0, tokens: { ...p0Tokens, [TOKEN_IDS.TREANT_DIVINE]: 1, [TOKEN_IDS.DELAYED_POISON]: 0 } };
                players['1'] = { ...p1, tokens: { ...p1Tokens, [TOKEN_IDS.NINJUTSU]: 0 } };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'poison-blade',
                        isDefendable: true,
                        damage: 6,
                        offensiveRollEndTokenResolved: true,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                    treantSpiritSpentThisTurn: {},
                };
                root.sys = { ...sys, phase: 'offensiveRoll', currentPlayerIndex: 1, interaction: { ...asRecord(sys.interaction), current: undefined } };
                return state;
            });
            await screenshot(match.guestPage, testName, '04-divine-prevent-branch-before-advance.png');

            await clickAdvancePhase(match.guestPage, '1');
            await expect(match.hostPage.getByText('神性树灵：是否防止即将受到的负面状态？')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '05-divine-choice-modal-prevent-branch.png');

            await match.hostPage.getByRole('button', { name: /花费神性树灵/ }).click();
            await expect(match.hostPage.getByText('神性树灵：是否防止即将受到的负面状态？')).toBeHidden({ timeout: 10000 });
            await clickAdvancePhase(match.guestPage, '1');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const root = await readHarnessState(match.guestPage);
                const players = asRecordMap(core.players);
                const defender = asRecord(players['0']);
                const tokens = asRecord(defender.tokens) as Record<string, number>;
                const spent = asRecord(asRecord(core.treantSpiritSpentThisTurn)['0']);
                const sys = asRecord(root.sys);
                return {
                    phase: sys.phase,
                    divine: tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0,
                    poison: tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                    spentDivine: spent[TOKEN_IDS.TREANT_DIVINE],
                };
            }, { timeout: 10000 }).toEqual({ phase: 'defensiveRoll', divine: 0, poison: 0, spentDivine: true });
            await screenshot(match.hostPage, testName, '06-divine-prevent-consumes-token-and-blocks-debuff.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精刺藤应在阶段推进中真实反伤并消耗', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精刺藤应在阶段推进中真实反伤并消耗';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources);
                const tokens = asRecord(p0.tokens);

                players['0'] = {
                    ...p0,
                    resources: { ...resources, [RESOURCE_IDS.HP]: 30 },
                    tokens: { ...tokens, [TOKEN_IDS.THORN]: 1 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    rollCount: 3,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist',
                        isDefendable: false,
                        damage: 0,
                        offensiveRollEndTokenResolved: true,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = { ...sys, phase: 'offensiveRoll', currentPlayerIndex: 0, interaction: { ...asRecord(sys.interaction), current: undefined } };
                return state;
            });
            await screenshot(match.hostPage, testName, '01-thorn-before-resolve-attack.png');

            await clickAdvancePhase(match.hostPage, '0');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                return {
                    hp: resources[RESOURCE_IDS.HP],
                    thorn: tokens[TOKEN_IDS.THORN] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ hp: 28, thorn: 0 });
            await match.hostPage.waitForTimeout(1200);
            await screenshot(match.hostPage, testName, '02-thorn-after-resolve-attack.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精扎根防御应真实掷骰结算且不可防御时跳过', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精扎根防御应真实掷骰结算且不可防御时跳过';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p0Tokens = asRecord(p0.tokens);
                const p1 = asRecord(players['1']);
                const p1Resources = asRecord(p1.resources);

                players['0'] = {
                    ...p0,
                    tokens: {
                        ...p0Tokens,
                        [TOKEN_IDS.TREANT_SEEDLING]: 0,
                        [TOKEN_IDS.LIFE_SAP]: 0,
                    },
                };
                players['1'] = {
                    ...p1,
                    resources: { ...p1Resources, [RESOURCE_IDS.HP]: 30 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'defensiveRoll',
                    rollCount: 0,
                    rollConfirmed: false,
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'slash-3',
                        isDefendable: true,
                        damage: 0,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'defensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [4, 5, 1]);
                return state;
            });
            await screenshot(match.hostPage, testName, '01-rooted-before-defense-advance.png');

            await match.hostPage.getByRole('button', { name: '开始防御' }).click();
            await expect(match.hostPage.getByRole('button', { name: '开始防御' })).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const slots = await match.hostPage
                    .locator('[data-ability-slot]')
                    .filter({ has: match.hostPage.locator('div.border-red-500') })
                    .evaluateAll(elements => elements.map(element => element.getAttribute('data-ability-slot')));
                return slots;
            }, { timeout: 10000 }).toEqual(['meditate']);
            await expect(
                match.hostPage.locator('[data-ability-slot="sky"][data-passive-ability="true"]').locator('div.border-red-500, div.border-rose-400')
            ).toHaveCount(0);
            await expect(
                match.hostPage.locator('[data-ability-slot="calm"]').locator('div.border-red-500, div.border-rose-400')
            ).toHaveCount(0);
            await screenshot(match.hostPage, testName, '02-rooted-defense-slot-highlight-after-showcase-dismissed.png');

            await clickAdvancePhase(match.hostPage, '0');
            await expect(match.hostPage.getByText('扎根：选择额外效果')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '03-rooted-choice-modal-after-defense-roll.png');
            await match.hostPage.getByRole('button', { name: '养成后：幼种 1' }).click();
            await expect(match.hostPage.getByText('扎根：选择额外效果')).toBeHidden({ timeout: 10000 });
            await clickAdvancePhase(match.hostPage, '0');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const players = asRecordMap(core.players);
                const treant = asRecord(players['0']);
                const treantTokens = asRecord(treant.tokens) as Record<string, number>;
                const treantResources = asRecord(treant.resources) as Record<string, number>;
                const ninjaResources = asRecord(ninja.resources) as Record<string, number>;
                return {
                    attackerHp: ninjaResources[RESOURCE_IDS.HP],
                    defenderHp: treantResources[RESOURCE_IDS.HP],
                    seedling: treantTokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                    lifeSap: treantTokens[TOKEN_IDS.LIFE_SAP] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ attackerHp: 30, defenderHp: 46, seedling: 1, lifeSap: 0 });
            await screenshot(match.hostPage, testName, '04-rooted-after-choice-and-resolve.png');

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p0Tokens = asRecord(p0.tokens);
                const p1 = asRecord(players['1']);
                const p1Resources = asRecord(p1.resources);

                players['0'] = {
                    ...p0,
                    resources: {
                        ...asRecord(p0.resources),
                        [RESOURCE_IDS.HP]: 50,
                    },
                    tokens: {
                        ...p0Tokens,
                        [TOKEN_IDS.TREANT_SEEDLING]: 0,
                        [TOKEN_IDS.LIFE_SAP]: 0,
                    },
                };
                players['1'] = {
                    ...p1,
                    resources: { ...p1Resources, [RESOURCE_IDS.HP]: 30 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'defensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'slash-3',
                        defenseAbilityId: 'rooted',
                        isDefendable: false,
                        damage: 0,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'defensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [1, 4, 6]);
                return state;
            });
            await screenshot(match.hostPage, testName, '05-rooted-undefendable-before-advance.png');

            await clickAdvancePhase(match.hostPage, '0');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const players = asRecordMap(core.players);
                const treant = asRecord(players['0']);
                const treantTokens = asRecord(treant.tokens) as Record<string, number>;
                const treantResources = asRecord(treant.resources) as Record<string, number>;
                return {
                    defenderHp: treantResources[RESOURCE_IDS.HP],
                    seedling: treantTokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                    lifeSap: treantTokens[TOKEN_IDS.LIFE_SAP] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ defenderHp: 45, seedling: 0, lifeSap: 0 });
            await screenshot(match.hostPage, testName, '06-rooted-undefendable-after-advance.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精专属主阶段卡应通过真实手牌完成升级与选择结算代表链', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精专属主阶段卡应通过真实手牌完成升级与选择结算代表链';

        const prepareTreantMainCard = async (
            cardId: string,
            options: { cp?: number; seedling?: number; sapling?: number; divine?: number; lifeSap?: number } = {},
        ) => {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources);
                const tokens = asRecord(p0.tokens);

                players['0'] = {
                    ...p0,
                    resources: {
                        ...resources,
                        [RESOURCE_IDS.CP]: options.cp ?? 5,
                    },
                    tokens: {
                        ...tokens,
                        [TOKEN_IDS.TREANT_SEEDLING]: options.seedling ?? 0,
                        [TOKEN_IDS.TREANT_SAPLING]: options.sapling ?? 0,
                        [TOKEN_IDS.TREANT_DIVINE]: options.divine ?? 0,
                        [TOKEN_IDS.LIFE_SAP]: options.lifeSap ?? 0,
                    },
                    hand: [cloneTreantCard(cardId)],
                    discard: [],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                };
                return state;
            });
            await closeDebugPanelIfOpen(match.hostPage);
            await closeCardSpotlightIfOpen(match.hostPage);
            await expect(match.hostPage.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first()).toBeVisible({ timeout: 10000 });
        };

        try {
            await prepareTreantMainCard('upgrade-rooted-2', { cp: 5 });
            await screenshot(match.hostPage, testName, '01-upgrade-rooted-2-before-drag.png');
            await dragHandCardToPlay(match.hostPage, 'upgrade-rooted-2');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const abilityLevels = asRecord(p0.abilityLevels) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    rootedLevel: abilityLevels.rooted,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ cp: 2, rootedLevel: 2, handCount: 0 });
            await screenshot(match.hostPage, testName, '02-upgrade-rooted-2-after-play.png');

            await prepareTreantMainCard('treant-card-drink-deep', { cp: 5, lifeSap: 0 });
            await screenshot(match.hostPage, testName, '03-drink-deep-before-drag.png');
            await dragHandCardToPlay(match.hostPage, 'treant-card-drink-deep');
            await expect(match.hostPage.getByText('痛饮：选择获得生命源泉的玩家')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '04-drink-deep-choice-modal.png');
            await match.hostPage.getByRole('button', { name: /获得生命源泉/ }).first().click();
            await expect(match.hostPage.getByText('痛饮：选择获得生命源泉的玩家')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    lifeSap: tokens[TOKEN_IDS.LIFE_SAP] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ cp: 4, lifeSap: 1, handCount: 0 });
            await screenshot(match.hostPage, testName, '05-drink-deep-after-resolve.png');

            await prepareTreantMainCard('treant-card-cultivate', { cp: 5, seedling: 0, sapling: 0, divine: 0 });
            await screenshot(match.hostPage, testName, '06-cultivate-before-drag.png');
            await dragHandCardToPlay(match.hostPage, 'treant-card-cultivate');
            await expect(match.hostPage.getByText(/选择养成后的树灵/)).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '07-cultivate-choice-modal.png');
            await match.hostPage.getByRole('button', { name: '结算后：幼种 3' }).click();
            await expect(match.hostPage.getByText(/选择养成后的树灵/)).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    seedling: tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                    sapling: tokens[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                    divine: tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ cp: 2, seedling: 3, sapling: 0, divine: 0, handCount: 0 });
            await screenshot(match.hostPage, testName, '08-cultivate-after-resolve.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精践踏应通过真实手牌打出并在奖励骰收口后计入攻击修正', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精践踏应通过真实手牌打出并在奖励骰收口后计入攻击修正';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources);
                const p1Tokens = asRecord(p1.tokens);

                players['0'] = {
                    ...p0,
                    resources: { ...p0Resources, [RESOURCE_IDS.CP]: 3 },
                    hand: [cloneTreantCard('treant-card-trample')],
                };
                players['1'] = {
                    ...p1,
                    tokens: { ...p1Tokens, [TOKEN_IDS.THORN]: 0 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist-3',
                        isDefendable: true,
                        damage: 5,
                        bonusDamage: 0,
                        attackModifierBonusDamage: 0,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [1, 2, 3, 4, 5]);
                return state;
            });
            await closeDebugPanelIfOpen(match.hostPage);
            await closeCardSpotlightIfOpen(match.hostPage);
            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id="treant-card-trample"]').first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '01-trample-before-drag.png');

            await dragHandCardToPlay(match.hostPage, 'treant-card-trample');
            const trampleBonusDieOverlay = match.hostPage.getByTestId('bonus-die-overlay');
            await expect(trampleBonusDieOverlay).toBeVisible({ timeout: 10000 });
            await expect(match.hostPage.getByTestId('bonus-die-reroll-option-0')).toBeVisible({ timeout: 10000 });
            await screenshotLocator(trampleBonusDieOverlay, testName, '02-trample-bonus-dice-overlay-detail.png');
            await screenshot(match.hostPage, testName, '02-trample-bonus-dice-overlay.png');

            await closeBonusDieOverlay(match.hostPage);
            await expect(match.hostPage.getByTestId('bonus-die-overlay')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                const pendingAttack = asRecord(core.pendingAttack);
                const defenderTokens = asRecord(p1.tokens) as Record<string, number>;
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    handCount: hand.length,
                    bonusDamage: pendingAttack.bonusDamage ?? 0,
                    attackModifierBonusDamage: pendingAttack.attackModifierBonusDamage ?? 0,
                    thorn: defenderTokens[TOKEN_IDS.THORN] ?? 0,
                    pendingBonusOpen: Boolean(core.pendingBonusDiceSettlement),
                };
            }, { timeout: 10000 }).toEqual({
                cp: 2,
                handCount: 0,
                bonusDamage: 3,
                attackModifierBonusDamage: 3,
                thorn: 1,
                pendingBonusOpen: false,
            });
            await screenshot(match.hostPage, testName, '03-trample-after-closeout-bonus-damage-and-thorn.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精升级扎根后应在真实防御链路中发动 4 骰扎根 II', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精升级扎根后应在真实防御链路中发动4骰扎根II';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources);
                const tokens = asRecord(p0.tokens);

                players['0'] = {
                    ...p0,
                    resources: { ...resources, [RESOURCE_IDS.CP]: 5, [RESOURCE_IDS.HP]: 50 },
                    tokens: {
                        ...tokens,
                        [TOKEN_IDS.TREANT_SEEDLING]: 0,
                        [TOKEN_IDS.TREANT_SAPLING]: 0,
                        [TOKEN_IDS.TREANT_DIVINE]: 0,
                        [TOKEN_IDS.LIFE_SAP]: 0,
                    },
                    hand: [cloneTreantCard('upgrade-rooted-2')],
                    discard: [],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                };
                return state;
            });
            await closeDebugPanelIfOpen(match.hostPage);
            await closeCardSpotlightIfOpen(match.hostPage);
            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id="upgrade-rooted-2"]').first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '01-upgrade-rooted-2-before-drag.png');

            await dragHandCardToPlay(match.hostPage, 'upgrade-rooted-2');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const abilityLevels = asRecord(p0.abilityLevels) as Record<string, number>;
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    rootedLevel: abilityLevels.rooted,
                };
            }, { timeout: 10000 }).toEqual({ cp: 2, rootedLevel: 2 });
            await screenshot(match.hostPage, testName, '02-upgrade-rooted-2-after-play.png');

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);

                players['0'] = {
                    ...p0,
                    resources: { ...asRecord(p0.resources), [RESOURCE_IDS.HP]: 50 },
                    tokens: {
                        ...asRecord(p0.tokens),
                        [TOKEN_IDS.TREANT_SEEDLING]: 0,
                        [TOKEN_IDS.TREANT_SAPLING]: 0,
                        [TOKEN_IDS.TREANT_DIVINE]: 0,
                        [TOKEN_IDS.LIFE_SAP]: 0,
                    },
                };
                players['1'] = {
                    ...p1,
                    resources: { ...asRecord(p1.resources), [RESOURCE_IDS.HP]: 30 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'defensiveRoll',
                    rollLimit: 1,
                    rollDiceCount: 4,
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'slash-3',
                        defenseAbilityId: 'rooted',
                        isDefendable: true,
                        damage: 0,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'defensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [4, 5, 1, 2]);
                return state;
            });
            await screenshot(match.hostPage, testName, '03-rooted-2-before-defense-advance.png');

            await expect.poll(async () => {
                const root = await readHarnessState(match.hostPage);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                return {
                    phase: sys.phase ?? core.phase,
                    rollDiceCount: core.rollDiceCount,
                    defenseAbilityId: asRecord(core.pendingAttack).defenseAbilityId,
                };
            }, { timeout: 10000 }).toEqual({ phase: 'defensiveRoll', rollDiceCount: 4, defenseAbilityId: 'rooted' });
            await expect(match.hostPage.getByRole('button', { name: '开始防御' })).toBeVisible({ timeout: 10000 });
            await match.hostPage.getByRole('button', { name: '开始防御' }).click();
            await expect(match.hostPage.getByRole('button', { name: '开始防御' })).toBeHidden({ timeout: 10000 });
            await clickAdvancePhase(match.hostPage, '0');
            await expect(match.hostPage.getByText('扎根：选择额外效果')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '04-rooted-2-choice-modal-after-roll.png');

            await match.hostPage.getByRole('button', { name: '养成后：幼种 1' }).click();
            await expect(match.hostPage.getByText('扎根：选择额外效果')).toBeHidden({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '05-rooted-2-after-choice-selected.png');
            await clickAdvancePhase(match.hostPage, '0');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const players = asRecordMap(core.players);
                const treant = asRecord(players['0']);
                const treantTokens = asRecord(treant.tokens) as Record<string, number>;
                const treantResources = asRecord(treant.resources) as Record<string, number>;
                return {
                    hp: treantResources[RESOURCE_IDS.HP],
                    seedling: treantTokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                    lifeSap: treantTokens[TOKEN_IDS.LIFE_SAP] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ hp: 47, seedling: 1, lifeSap: 0 });
            await screenshot(match.hostPage, testName, '06-rooted-2-after-resolve.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精剩余升级卡应通过真实手牌逐张升级到正确技能', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精剩余升级卡应通过真实手牌逐张升级到正确技能';
        const upgradeCases = [
            { cardId: 'upgrade-tend-care-2', abilityId: 'tend-care', cpBefore: 5, cpAfter: 3, level: 2 },
            { cardId: 'upgrade-shattering-fist-3', abilityId: 'shattering-fist', cpBefore: 5, cpAfter: 3, level: 3 },
            { cardId: 'upgrade-nature-touch-2', abilityId: 'nature-touch', cpBefore: 5, cpAfter: 3, level: 2 },
            { cardId: 'upgrade-vengeful-vines-2', abilityId: 'vengeful-vines', cpBefore: 5, cpAfter: 3, level: 2 },
            { cardId: 'upgrade-wild-growth-2', abilityId: 'wild-growth', cpBefore: 5, cpAfter: 3, level: 2 },
            { cardId: 'upgrade-shattering-fist-2', abilityId: 'shattering-fist', cpBefore: 5, cpAfter: 4, level: 2 },
        ];

        try {
            const baselineCore = await readHarnessCoreState(match.hostPage);
            const baselineTreant = structuredClone(asRecord(asRecordMap(baselineCore.players)['0']));
            for (let index = 0; index < upgradeCases.length; index += 1) {
                const item = upgradeCases[index];
                await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                    const root = asRecord(state.G ?? state);
                    const core = asRecord(root.core);
                    const sys = asRecord(root.sys);
                    const players = asRecordMap(core.players);
                    const resources = asRecord(baselineTreant.resources);

                    players['0'] = {
                        ...baselineTreant,
                        resources: { ...resources, [RESOURCE_IDS.CP]: item.cpBefore },
                        hand: [cloneTreantCard(item.cardId)],
                    };
                    root.core = {
                        ...core,
                        players,
                        activePlayerId: '0',
                        phase: 'main1',
                        pendingAttack: null,
                        pendingDamage: null,
                        pendingBonusDiceSettlement: undefined,
                    };
                    root.sys = {
                        ...sys,
                        phase: 'main1',
                        currentPlayerIndex: 0,
                        interaction: { ...asRecord(sys.interaction), current: undefined },
                    };
                    return state;
                });
                await closeDebugPanelIfOpen(match.hostPage);
                await closeCardSpotlightIfOpen(match.hostPage);
                await expect(match.hostPage.locator(`[data-testid="hand-area"] [data-card-id="${item.cardId}"]`).first()).toBeVisible({ timeout: 10000 });
                await screenshot(match.hostPage, testName, `${String(index + 1).padStart(2, '0')}-${item.cardId}-before-drag.png`);

                await dragHandCardToPlay(match.hostPage, item.cardId);
                await expect.poll(async () => {
                    const core = await readHarnessCoreState(match.hostPage);
                    const p0 = asRecord(asRecordMap(core.players)['0']);
                    const resources = asRecord(p0.resources) as Record<string, number>;
                    const abilityLevels = asRecord(p0.abilityLevels) as Record<string, number>;
                    const hand = Array.isArray(p0.hand) ? p0.hand : [];
                    return {
                        cp: resources[RESOURCE_IDS.CP],
                        level: abilityLevels[item.abilityId],
                        handCount: hand.length,
                    };
                }, { timeout: 10000 }).toEqual({ cp: item.cpAfter, level: item.level, handCount: 0 });
                await screenshot(match.hostPage, testName, `${String(index + 1).padStart(2, '0')}-${item.cardId}-after-play.png`);
            }
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精剩余主阶段动作卡应通过真实手牌逐张结算', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精剩余主阶段动作卡应通过真实手牌逐张结算';

        const prepareMainAction = async (
            cardId: string,
            options: { cp?: number; seedling?: number; sapling?: number; divine?: number; lifeSap?: number } = {},
            fixedDice: number[] = [],
        ) => {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p0.resources);
                const tokens = asRecord(p0.tokens);
                const p1Tokens = asRecord(p1.tokens);
                const deck = Array.isArray(p0.deck) ? p0.deck : [];

                players['0'] = {
                    ...p0,
                    resources: { ...resources, [RESOURCE_IDS.CP]: options.cp ?? 5 },
                    tokens: {
                        ...tokens,
                        [TOKEN_IDS.TREANT_SEEDLING]: options.seedling ?? 0,
                        [TOKEN_IDS.TREANT_SAPLING]: options.sapling ?? 0,
                        [TOKEN_IDS.TREANT_DIVINE]: options.divine ?? 0,
                        [TOKEN_IDS.LIFE_SAP]: options.lifeSap ?? 0,
                    },
                    hand: [cloneTreantCard(cardId)],
                    deck,
                };
                players['1'] = {
                    ...p1,
                    tokens: { ...p1Tokens, [TOKEN_IDS.LIFE_SAP]: 0 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                const nextSys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                };
                root.sys = fixedDice.length > 0 ? forceFixedDieQueue(nextSys, fixedDice) : nextSys;
                return state;
            });
            await closeDebugPanelIfOpen(match.hostPage);
            await closeCardSpotlightIfOpen(match.hostPage);
            await expect(match.hostPage.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first()).toBeVisible({ timeout: 10000 });
        };

        try {
            await prepareMainAction('treant-card-harvest', { cp: 1, seedling: 2 });
            await screenshot(match.hostPage, testName, '01-harvest-before-drag.png');
            await dragHandCardToPlay(match.hostPage, 'treant-card-harvest');
            await expect(match.hostPage.getByText('丰收：选择移除树灵与生命源泉目标')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '02-harvest-choice-modal.png');
            await match.hostPage.getByRole('button', {
                name: '移除：幼种 2 / 木苗 0 / 神性 0；获得 2 CP；生命源泉目标：P1',
                exact: true,
            }).click();
            await expect(match.hostPage.getByText('丰收：选择移除树灵与生命源泉目标')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    seedling: tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                    lifeSap: tokens[TOKEN_IDS.LIFE_SAP] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ cp: 3, seedling: 0, lifeSap: 1, handCount: 0 });
            await screenshot(match.hostPage, testName, '03-harvest-after-resolve.png');

            await prepareMainAction('treant-card-downpour', { cp: 5, seedling: 2, sapling: 0, divine: 0 });
            await screenshot(match.hostPage, testName, '04-downpour-before-drag.png');
            await dragHandCardToPlay(match.hostPage, 'treant-card-downpour');
            await expect(match.hostPage.getByText('大雨倾盆：选择养成后的树灵')).toBeVisible({ timeout: 10000 });
            await match.hostPage.getByRole('button', { name: '结算后：木苗 2' }).click();
            await expect(match.hostPage.getByText('大雨倾盆：选择养成后的树灵')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    seedling: tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                    sapling: tokens[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                    divine: tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ cp: 3, seedling: 0, sapling: 2, divine: 0, handCount: 0 });
            await screenshot(match.hostPage, testName, '05-downpour-after-resolve.png');

            await prepareMainAction('treant-card-planting', { cp: 5, seedling: 0, sapling: 0, divine: 0 });
            await screenshot(match.hostPage, testName, '06-planting-before-drag.png');
            await dragHandCardToPlay(match.hostPage, 'treant-card-planting');
            await expect(match.hostPage.getByText(/选择养成后的树灵/)).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '07-planting-choice-modal.png');
            await match.hostPage.getByRole('button', { name: '结算后：幼种 3' }).click();
            await expect(match.hostPage.getByText(/选择养成后的树灵/)).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    seedling: tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ cp: 4, seedling: 3, handCount: 0 });
            await screenshot(match.hostPage, testName, '08-planting-after-resolve.png');

            await prepareMainAction('treant-card-mother-tree', { cp: 5, seedling: 0, sapling: 0, divine: 0 }, [6]);
            await screenshot(match.hostPage, testName, '09-mother-tree-spirit-before-drag.png');
            await dragHandCardToPlay(match.hostPage, 'treant-card-mother-tree');
            await screenshotCardSpotlightIfVisible(
                match.hostPage,
                testName,
                '10-mother-tree-spirit-die-result-spotlight.png',
                1,
            );
            await expect(match.hostPage.getByText('母树：选择养成后的树灵')).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '10-mother-tree-spirit-choice-modal.png');
            await match.hostPage.getByRole('button', { name: '结算后：幼种 2，木苗 1' }).click();
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                return {
                    seedling: tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                    sapling: tokens[TOKEN_IDS.TREANT_SAPLING] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ seedling: 2, sapling: 1, handCount: 0 });
            await screenshot(match.hostPage, testName, '11-mother-tree-spirit-after-resolve.png');

            await prepareMainAction('treant-card-mother-tree', { cp: 5, seedling: 0, sapling: 0, divine: 0 }, [1]);
            const beforeNonSpirit = await readHarnessCoreState(match.hostPage);
            const p0Before = asRecord(asRecordMap(beforeNonSpirit.players)['0']);
            const deckBefore = Array.isArray(p0Before.deck) ? p0Before.deck.length : 0;
            await screenshot(match.hostPage, testName, '12-mother-tree-non-spirit-before-drag.png');
            await dragHandCardToPlay(match.hostPage, 'treant-card-mother-tree');
            await screenshotCardSpotlightIfVisible(
                match.hostPage,
                testName,
                '13-mother-tree-non-spirit-die-result-spotlight.png',
                1,
            );
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                const deck = Array.isArray(p0.deck) ? p0.deck : [];
                return {
                    handCount: hand.length,
                    deckDelta: deckBefore - deck.length,
                };
            }, { timeout: 10000 }).toEqual({ handCount: 1, deckDelta: 1 });
            await screenshot(match.hostPage, testName, '14-mother-tree-non-spirit-after-draw.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('树精魂火应通过真实手牌打出并结算三种骰面分支', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '树精魂火应通过真实手牌打出并结算三种骰面分支';

        try {
            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources);
                const p0Tokens = asRecord(p0.tokens);
                const p1Resources = asRecord(p1.resources);

                players['0'] = {
                    ...p0,
                    resources: { ...p0Resources, [RESOURCE_IDS.CP]: 3 },
                    tokens: {
                        ...p0Tokens,
                        [TOKEN_IDS.TREANT_SEEDLING]: 0,
                        [TOKEN_IDS.TREANT_SAPLING]: 0,
                        [TOKEN_IDS.TREANT_DIVINE]: 0,
                        [TOKEN_IDS.LIFE_SAP]: 0,
                    },
                    hand: [cloneTreantCard('treant-card-soulfire')],
                };
                players['1'] = {
                    ...p1,
                    resources: { ...p1Resources, [RESOURCE_IDS.HP]: 50 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist-3',
                        isDefendable: true,
                        damage: 5,
                        bonusDamage: 0,
                        attackModifierBonusDamage: 0,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [1, 4, 6]);
                return state;
            });
            await closeDebugPanelIfOpen(match.hostPage);
            await closeCardSpotlightIfOpen(match.hostPage);
            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id="treant-card-soulfire"]').first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.hostPage, testName, '01-soulfire-before-drag.png');

            await dragHandCardToPlay(match.hostPage, 'treant-card-soulfire');
            const soulfireBonusDieOverlay = match.hostPage.getByTestId('bonus-die-overlay');
            await expect(soulfireBonusDieOverlay).toBeVisible({ timeout: 10000 });
            await expect(soulfireBonusDieOverlay).toContainText('魂火：1 树枝 / 1 树叶 / 1 树灵', { timeout: 10000 });
            await screenshot(match.hostPage, testName, '02-soulfire-bonus-dice-overlay.png');
            await screenshotLocator(soulfireBonusDieOverlay, testName, '02-soulfire-bonus-dice-overlay-detail.png');
            await closeBonusDieOverlay(match.hostPage);
            await expect(soulfireBonusDieOverlay).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.hostPage);
                const p0 = asRecord(asRecordMap(core.players)['0']);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                const p0Tokens = asRecord(p0.tokens) as Record<string, number>;
                const p1Resources = asRecord(p1.resources) as Record<string, number>;
                const hand = Array.isArray(p0.hand) ? p0.hand : [];
                return {
                    cp: p0Resources[RESOURCE_IDS.CP],
                    handCount: hand.length,
                    opponentHp: p1Resources[RESOURCE_IDS.HP],
                    lifeSap: p0Tokens[TOKEN_IDS.LIFE_SAP] ?? 0,
                    seedling: p0Tokens[TOKEN_IDS.TREANT_SEEDLING] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ cp: 2, handCount: 0, opponentHp: 49, lifeSap: 1, seedling: 1 });
            await screenshot(match.hostPage, testName, '03-soulfire-after-resolve.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者道场应通过真实手牌打出并按骰面分支结算', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者道场应通过真实手牌打出并按骰面分支结算';

        const prepareDojoScenario = async (rollValue: number, handSize = 1) => {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);
                const tokens = asRecord(p1.tokens);
                const deck = Array.isArray(p1.deck) ? p1.deck : [];

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.CP]: 2 },
                    tokens: { ...tokens, [TOKEN_IDS.SMOKE_BOMB]: 0, [TOKEN_IDS.NINJUTSU]: 0 },
                    hand: Array.from({ length: handSize }, () => cloneNinjaCard('ninja-card-dojo')),
                    deck,
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [rollValue]);
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            await expect(match.guestPage.locator('[data-testid="hand-area"] [data-card-id="ninja-card-dojo"]').first()).toBeVisible({ timeout: 10000 });
        };

        try {
            await prepareDojoScenario(6);
            await screenshot(match.guestPage, testName, '01-dojo-mask-before-drag.png');

            await dragHandCardToPlay(match.guestPage, 'ninja-card-dojo');
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByText(/道场|Dojo|烟雾弹|忍术/i).first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '02-dojo-mask-bonus-die-overlay.png');

            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const tokens = asRecord(p1.tokens) as Record<string, number>;
                const hand = Array.isArray(p1.hand) ? p1.hand : [];
                return {
                    smokeBomb: tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    ninjutsu: tokens[TOKEN_IDS.NINJUTSU] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ smokeBomb: 1, ninjutsu: 2, handCount: 0 });

            await match.guestPage.getByLabel(/关闭|Close/i).first().click();
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeHidden({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '03-dojo-mask-after-closeout.png');

            await prepareDojoScenario(1);
            const beforeOther = await readHarnessCoreState(match.guestPage);
            const p1Before = asRecord(asRecordMap(beforeOther.players)['1']);
            const deckBefore = Array.isArray(p1Before.deck) ? p1Before.deck.length : 0;
            await screenshot(match.guestPage, testName, '04-dojo-other-before-drag.png');

            await dragHandCardToPlay(match.guestPage, 'ninja-card-dojo');
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '05-dojo-other-bonus-die-overlay.png');

            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const tokens = asRecord(p1.tokens) as Record<string, number>;
                const hand = Array.isArray(p1.hand) ? p1.hand : [];
                const deck = Array.isArray(p1.deck) ? p1.deck : [];
                return {
                    smokeBomb: tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    ninjutsu: tokens[TOKEN_IDS.NINJUTSU] ?? 0,
                    handCount: hand.length,
                    deckDelta: deckBefore - deck.length,
                };
            }, { timeout: 10000 }).toEqual({ smokeBomb: 0, ninjutsu: 0, handCount: 1, deckDelta: 1 });

            await match.guestPage.getByLabel(/关闭|Close/i).first().click();
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeHidden({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '06-dojo-other-after-closeout.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者雾隐应通过真实手牌打出并获得烟雾弹', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者雾隐应通过真实手牌打出并获得烟雾弹';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);
                const tokens = asRecord(p1.tokens);

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.CP]: 2 },
                    tokens: { ...tokens, [TOKEN_IDS.SMOKE_BOMB]: 0 },
                    hand: [cloneNinjaCard('ninja-card-vanish')],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                };
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            await expect(match.guestPage.locator('[data-testid="hand-area"] [data-card-id="ninja-card-vanish"]').first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-vanish-before-drag.png');

            await dragHandCardToPlay(match.guestPage, 'ninja-card-vanish');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const tokens = asRecord(p1.tokens) as Record<string, number>;
                const hand = Array.isArray(p1.hand) ? p1.hand : [];
                return {
                    smokeBomb: tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ smokeBomb: 1, handCount: 0 });
            await screenshot(match.guestPage, testName, '02-vanish-after-play-smoke-bomb.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算';

        const prepareNinjaMainCard = async (cardId: string, cp = 3) => {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources);
                const p0Tokens = asRecord(p0.tokens);
                const p1Resources = asRecord(p1.resources);
                const p1Tokens = asRecord(p1.tokens);

                players['0'] = {
                    ...p0,
                    resources: { ...p0Resources, [RESOURCE_IDS.HP]: 30 },
                    tokens: { ...p0Tokens, [TOKEN_IDS.DELAYED_POISON]: 0 },
                    damageShields: [],
                };
                players['1'] = {
                    ...p1,
                    resources: { ...p1Resources, [RESOURCE_IDS.CP]: cp },
                    tokens: { ...p1Tokens, [TOKEN_IDS.NINJUTSU]: 0 },
                    hand: [cloneNinjaCard(cardId)],
                    damageShields: [],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                    responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
                };
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            const card = match.guestPage.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
            await expect(card).toBeVisible({ timeout: 10000 });
            await expect(card).toHaveAttribute('data-can-drag', 'true', { timeout: 10000 });
        };

        try {
            await prepareNinjaMainCard('ninja-card-training', 3);
            await screenshot(match.guestPage, testName, '01-training-before-drag.png');
            await dragHandCardToPlay(match.guestPage, 'ninja-card-training');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                const tokens = asRecord(p1.tokens) as Record<string, number>;
                const hand = Array.isArray(p1.hand) ? p1.hand : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    ninjutsu: tokens[TOKEN_IDS.NINJUTSU] ?? 0,
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ cp: 3, ninjutsu: 1, handCount: 0 });
            await screenshot(match.guestPage, testName, '02-training-after-play-ninjutsu.png');

            await prepareNinjaMainCard('ninja-card-poison-dart', 3);
            await screenshot(match.guestPage, testName, '03-poison-dart-before-drag.png');
            await dragHandCardToPlay(match.guestPage, 'ninja-card-poison-dart');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Tokens = asRecord(p0.tokens) as Record<string, number>;
                const p1Resources = asRecord(p1.resources) as Record<string, number>;
                const p1Hand = Array.isArray(p1.hand) ? p1.hand : [];
                return {
                    cp: p1Resources[RESOURCE_IDS.CP],
                    handCount: p1Hand.length,
                    delayedPoison: p0Tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ cp: 1, handCount: 0, delayedPoison: 1 });
            await screenshot(match.guestPage, testName, '04-poison-dart-after-play-delayed-poison.png');

            await prepareNinjaMainCard('ninja-card-knife-fan', 3);
            await screenshot(match.guestPage, testName, '05-knife-fan-before-drag.png');
            await dragHandCardToPlay(match.guestPage, 'ninja-card-knife-fan');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                const p1Resources = asRecord(p1.resources) as Record<string, number>;
                const p1Hand = Array.isArray(p1.hand) ? p1.hand : [];
                return {
                    cp: p1Resources[RESOURCE_IDS.CP],
                    handCount: p1Hand.length,
                    opponentHp: p0Resources[RESOURCE_IDS.HP],
                    pendingDamageOpen: Boolean(core.pendingDamage),
                };
            }, { timeout: 10000 }).toEqual({
                cp: 1,
                handCount: 0,
                opponentHp: 29,
                pendingDamageOpen: false,
            });
            await screenshot(match.guestPage, testName, '06-knife-fan-after-play-direct-damage.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者升级卡应通过真实手牌逐张升级到正确技能', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者升级卡应通过真实手牌逐张升级到正确技能';
        const upgradeCases = [
            { cardId: 'upgrade-blink-2', abilityId: 'blink', level: 2 },
            { cardId: 'upgrade-going-forward-2', abilityId: 'going-forward', level: 2 },
            { cardId: 'upgrade-slash-2', abilityId: 'slash', level: 2 },
            { cardId: 'upgrade-shadow-step-2', abilityId: 'shadow-step', level: 2 },
            { cardId: 'upgrade-smoke-screen-2', abilityId: 'smoke-screen', level: 2 },
            { cardId: 'upgrade-shadow-fang-2', abilityId: 'shadow-fang', level: 2 },
            { cardId: 'upgrade-poison-blade-2', abilityId: 'poison-blade', level: 2 },
            { cardId: 'upgrade-death-blossom-2', abilityId: 'death-blossom', level: 2 },
        ];

        try {
            const baselineCore = await readHarnessCoreState(match.guestPage);
            const baselineNinja = structuredClone(asRecord(asRecordMap(baselineCore.players)['1']));
            for (let index = 0; index < upgradeCases.length; index += 1) {
                const item = upgradeCases[index];
                await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                    const root = asRecord(state.G ?? state);
                    const core = asRecord(root.core);
                    const sys = asRecord(root.sys);
                    const players = asRecordMap(core.players);
                    const resources = asRecord(baselineNinja.resources);

                    players['1'] = {
                        ...baselineNinja,
                        resources: { ...resources, [RESOURCE_IDS.CP]: 5 },
                        hand: [cloneNinjaCard(item.cardId)],
                    };
                    root.core = {
                        ...core,
                        players,
                        activePlayerId: '1',
                        phase: 'main1',
                        pendingAttack: null,
                        pendingDamage: null,
                        pendingBonusDiceSettlement: undefined,
                    };
                    root.sys = {
                        ...sys,
                        phase: 'main1',
                        currentPlayerIndex: 1,
                        interaction: { ...asRecord(sys.interaction), current: undefined },
                        responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
                    };
                    return state;
                });
                await closeDebugPanelIfOpen(match.guestPage);
                await closeCardSpotlightIfOpen(match.guestPage);
                const card = match.guestPage.locator(`[data-testid="hand-area"] [data-card-id="${item.cardId}"]`).first();
                await expect(card).toBeVisible({ timeout: 10000 });
                await expect(card).toHaveAttribute('data-can-drag', 'true', { timeout: 10000 });
                await screenshot(match.guestPage, testName, `${String(index + 1).padStart(2, '0')}-${item.cardId}-before-drag.png`);

                await dragHandCardToPlay(match.guestPage, item.cardId);
                await expect.poll(async () => {
                    const core = await readHarnessCoreState(match.guestPage);
                    const p1 = asRecord(asRecordMap(core.players)['1']);
                    const resources = asRecord(p1.resources) as Record<string, number>;
                    const abilityLevels = asRecord(p1.abilityLevels) as Record<string, number>;
                    const upgradeCardByAbilityId = asRecord(p1.upgradeCardByAbilityId);
                    const hand = Array.isArray(p1.hand) ? p1.hand : [];
                    return {
                        cp: resources[RESOURCE_IDS.CP],
                        level: abilityLevels[item.abilityId],
                        upgradeCardId: asRecord(upgradeCardByAbilityId[item.abilityId]).cardId,
                        handCount: hand.length,
                    };
                }, { timeout: 10000 }).toEqual({
                    cp: 3,
                    level: item.level,
                    upgradeCardId: item.cardId,
                    handCount: 0,
                });
                await screenshot(match.guestPage, testName, `${String(index + 1).padStart(2, '0')}-${item.cardId}-after-play.png`);
            }
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者升级一往无前后应在真实技能槽弹出分支并能选中刀尖舔血结算', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者升级一往无前后应在真实技能槽弹出分支并能选中刀尖舔血结算';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.CP]: 5 },
                    hand: [cloneNinjaCard('upgrade-going-forward-2')],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                    responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
                };
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            await expect(match.guestPage.locator('[data-testid="hand-area"] [data-card-id="upgrade-going-forward-2"]').first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-upgrade-going-forward-2-before-drag.png');

            await dragHandCardToPlay(match.guestPage, 'upgrade-going-forward-2');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                const abilityLevels = asRecord(p1.abilityLevels) as Record<string, number>;
                const hand = Array.isArray(p1.hand) ? p1.hand : [];
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    level: abilityLevels['going-forward'],
                    handCount: hand.length,
                };
            }, { timeout: 10000 }).toEqual({ cp: 3, level: 2, handCount: 0 });
            await screenshot(match.guestPage, testName, '02-upgrade-going-forward-2-after-play.png');

            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const dice = Array.isArray(core.dice) ? [...core.dice] : [];
                const values = [4, 4, 4, 4, 1];
                const symbols = [
                    NINJA_DICE_FACE_IDS.SHURIKEN,
                    NINJA_DICE_FACE_IDS.SHURIKEN,
                    NINJA_DICE_FACE_IDS.SHURIKEN,
                    NINJA_DICE_FACE_IDS.SHURIKEN,
                    NINJA_DICE_FACE_IDS.KATANA,
                ];

                for (let index = 0; index < values.length; index += 1) {
                    dice[index] = {
                        ...asRecord(dice[index]),
                        id: index,
                        value: values[index],
                        symbol: symbols[index],
                        ownerId: '1',
                        isKept: false,
                    };
                }

                players['0'] = {
                    ...p0,
                    resources: { ...asRecord(p0.resources), [RESOURCE_IDS.HP]: 30 },
                };
                players['1'] = {
                    ...p1,
                    tokens: { ...asRecord(p1.tokens), [TOKEN_IDS.NINJUTSU]: 0 },
                };
                root.core = {
                    ...core,
                    players,
                    dice,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    rollDiceCount: 5,
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                    responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
                }, [4]);
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            await expect(match.guestPage.locator('[data-ability-slot="chi"]')).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await screenshot(match.guestPage, testName, '03-going-forward-2-slot-before-click.png');

            await match.guestPage.locator('[data-ability-slot="chi"]').click();
            await expect(match.guestPage.getByText('选择发动变体')).toBeVisible({ timeout: 10000 });
            const variantButtons = match.guestPage.getByRole('button', { name: /一往无前 II/i });
            await expect(variantButtons).toHaveCount(2, { timeout: 10000 });
            await screenshot(match.guestPage, testName, '04-going-forward-2-ability-choice-modal.png');

            await variantButtons.nth(1).click();
            await expect(match.guestPage.getByText('选择发动变体')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return pendingAttack.sourceAbilityId ?? null;
            }, { timeout: 10000 }).toBe('going-forward-2-bleed');
            await screenshot(match.guestPage, testName, '05-going-forward-2-bleed-selected.png');

            const attackShowcaseContinue = match.guestPage.getByRole('button', { name: /^(继续|Continue)$/i }).first();
            if (await attackShowcaseContinue.isVisible({ timeout: 1000 }).catch(() => false)) {
                await attackShowcaseContinue.click();
                await expect(attackShowcaseContinue).toBeHidden({ timeout: 10000 });
            }
            await clickAdvancePhase(match.guestPage, '1');
            const bleedBonusDieOverlay = match.guestPage.locator('[data-testid="bonus-die-overlay"]').first();
            await expect(bleedBonusDieOverlay).toBeVisible({ timeout: 10000 });
            await expect(bleedBonusDieOverlay.getByText(/刀尖舔血：造成 \d+ 点真实伤害/)).toBeVisible({ timeout: 10000 });
            await screenshotLocator(bleedBonusDieOverlay, testName, '06-going-forward-2-bleed-bonus-die-overlay.png');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                return {
                    opponentHp: p0Resources[RESOURCE_IDS.HP],
                    pendingAttackOpen: Boolean(core.pendingAttack),
                    pendingDamageOpen: Boolean(core.pendingDamage),
                };
            }, { timeout: 10000 }).toEqual({
                opponentHp: 26,
                pendingAttackOpen: false,
                pendingDamageOpen: false,
            });
            await screenshot(match.guestPage, testName, '07-going-forward-2-after-bleed-resolve.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者升级暗影步后 4 个面具应在真实技能槽弹出两个分支并可选中', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者升级暗影步后4个面具应在真实技能槽弹出两个分支并可选中';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.CP]: 5 },
                    hand: [cloneNinjaCard('upgrade-shadow-step-2')],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'main1',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'main1',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                    responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
                };
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            await expect(match.guestPage.locator('[data-testid="hand-area"] [data-card-id="upgrade-shadow-step-2"]').first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-upgrade-shadow-step-2-before-drag.png');

            await dragHandCardToPlay(match.guestPage, 'upgrade-shadow-step-2');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                const abilityLevels = asRecord(p1.abilityLevels) as Record<string, number>;
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    level: abilityLevels['shadow-step'],
                };
            }, { timeout: 10000 }).toEqual({ cp: 3, level: 2 });
            await screenshot(match.guestPage, testName, '02-upgrade-shadow-step-2-after-play.png');

            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const dice = Array.isArray(core.dice) ? [...core.dice] : [];
                const values = [6, 6, 6, 6, 1];
                const symbols = [
                    NINJA_DICE_FACE_IDS.MASK,
                    NINJA_DICE_FACE_IDS.MASK,
                    NINJA_DICE_FACE_IDS.MASK,
                    NINJA_DICE_FACE_IDS.MASK,
                    NINJA_DICE_FACE_IDS.KATANA,
                ];

                for (let index = 0; index < values.length; index += 1) {
                    dice[index] = {
                        ...asRecord(dice[index]),
                        id: index,
                        value: values[index],
                        symbol: symbols[index],
                        ownerId: '1',
                        isKept: false,
                    };
                }

                players['0'] = {
                    ...p0,
                    resources: { ...asRecord(p0.resources), [RESOURCE_IDS.HP]: 30 },
                    tokens: { ...asRecord(p0.tokens), [TOKEN_IDS.DELAYED_POISON]: 0 },
                };
                players['1'] = {
                    ...p1,
                    tokens: {
                        ...asRecord(p1.tokens),
                        [TOKEN_IDS.NINJUTSU]: 0,
                        [TOKEN_IDS.SMOKE_BOMB]: 0,
                    },
                };
                root.core = {
                    ...core,
                    players,
                    dice,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    rollDiceCount: 5,
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                    responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
                };
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            await expect(match.guestPage.locator('[data-ability-slot="lightning"]')).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
            await screenshot(match.guestPage, testName, '03-shadow-step-2-slot-before-click.png');

            await match.guestPage.locator('[data-ability-slot="lightning"]').click();
            await expect(match.guestPage.getByText('选择发动变体')).toBeVisible({ timeout: 10000 });
            const variantButtons = match.guestPage.getByRole('button', { name: /暗影步 II/i });
            await expect(variantButtons).toHaveCount(2, { timeout: 10000 });
            await screenshot(match.guestPage, testName, '04-shadow-step-2-ability-choice-modal.png');

            await variantButtons.nth(1).click();
            await expect(match.guestPage.getByText('选择发动变体')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return pendingAttack.sourceAbilityId ?? null;
            }, { timeout: 10000 }).toBe('shadow-step-2-strangle');
            await screenshot(match.guestPage, testName, '05-shadow-step-2-strangle-selected.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.CP]: 3 },
                    hand: [cloneNinjaCard('ninja-card-shuriken')],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'slash',
                        isDefendable: true,
                        damage: 6,
                        bonusDamage: 0,
                        attackModifierBonusDamage: 0,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [1, 2, 3, 4, 6]);
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            await expect(match.guestPage.locator('[data-testid="hand-area"] [data-card-id="ninja-card-shuriken"]').first()).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-shuriken-before-drag.png');

            await dragHandCardToPlay(match.guestPage, 'ninja-card-shuriken');
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByTestId('bonus-die-reroll-option-0')).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '02-shuriken-bonus-dice-overlay.png');

            await closeBonusDieOverlay(match.guestPage);
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                const hand = Array.isArray(p1.hand) ? p1.hand : [];
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    handCount: hand.length,
                    bonusDamage: pendingAttack.bonusDamage ?? 0,
                    attackModifierBonusDamage: pendingAttack.attackModifierBonusDamage ?? 0,
                    pendingBonusOpen: Boolean(core.pendingBonusDiceSettlement),
                };
            }, { timeout: 10000 }).toEqual({
                cp: 2,
                handCount: 0,
                bonusDamage: 3,
                attackModifierBonusDamage: 3,
                pendingBonusOpen: false,
            });
            await screenshot(match.guestPage, testName, '03-shuriken-after-closeout-bonus-damage.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);
                const tokens = asRecord(p1.tokens);

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.HP]: 30, [RESOURCE_IDS.CP]: 2 },
                    tokens: { ...tokens, [TOKEN_IDS.SMOKE_BOMB]: 0 },
                    hand: [cloneNinjaCard('ninja-card-escape')],
                    damageShields: [],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist',
                        isDefendable: true,
                        damage: 7,
                    },
                    pendingDamage: {
                        id: 'e2e-ninja-escape-before-damage',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 7,
                        currentDamage: 7,
                        sourceAbilityId: 'shattering-fist',
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                    responseWindow: {
                        ...asRecord(sys.responseWindow),
                        current: {
                            id: 'e2e-ninja-escape-response-window',
                            sourceId: 'e2e-ninja-escape-before-damage',
                            windowType: 'afterAttackResolved',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                            passedPlayers: [],
                        },
                    },
                }, [4]);
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            const attackShowcaseContinue = match.guestPage.getByRole('button', { name: /^(继续|Continue)$/i }).first();
            if (await attackShowcaseContinue.isVisible({ timeout: 1000 }).catch(() => false)) {
                await attackShowcaseContinue.click();
                await expect(attackShowcaseContinue).toBeHidden({ timeout: 10000 });
            }
            const escapeCard = match.guestPage.locator('[data-testid="hand-area"] [data-card-id="ninja-card-escape"]').first();
            await expect(escapeCard).toBeVisible({ timeout: 10000 });
            await expect(escapeCard).toHaveAttribute('data-can-drag', 'true', { timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-escape-before-drag-pending-damage.png');

            await dragHandCardToPlay(match.guestPage, 'ninja-card-escape');
            const bonusDieOverlay = match.guestPage.getByTestId('bonus-die-overlay');
            await expect(bonusDieOverlay).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByTestId('bonus-die-reroll-option-0')).toBeVisible({ timeout: 10000 });
            await screenshotLocator(bonusDieOverlay, testName, '02-escape-bonus-die-overlay-detail.png');
            await screenshot(match.guestPage, testName, '02-escape-bonus-die-overlay.png');

            await closeBonusDieOverlay(match.guestPage);
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const hand = Array.isArray(p1.hand) ? p1.hand : [];
                const shields = Array.isArray(p1.damageShields) ? p1.damageShields as JsonRecord[] : [];
                return {
                    handCount: hand.length,
                    shieldValue: shields[0]?.value ?? 0,
                    pendingDamage: asRecord(core.pendingDamage).currentDamage,
                };
            }, { timeout: 10000 }).toEqual({ handCount: 0, shieldValue: 2, pendingDamage: 7 });
            await screenshot(match.guestPage, testName, '03-escape-after-closeout-shield-granted.png');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '1',
                payload: {},
            });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                return {
                    hp: resources[RESOURCE_IDS.HP],
                    pendingDamageOpen: Boolean(core.pendingDamage),
                };
            }, { timeout: 10000 }).toEqual({ hp: 25, pendingDamageOpen: false });
            await screenshot(match.guestPage, testName, '04-escape-after-end-attack-damage-resolved.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者瞬身 II 应在真实防御链路中支持保留1颗并重投另外2颗', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者瞬身II应在真实防御链路中支持保留1颗并重投另外2颗';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);
                const tokens = asRecord(p1.tokens);

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.CP]: 5, [RESOURCE_IDS.HP]: 50 },
                    tokens: { ...tokens, [TOKEN_IDS.SMOKE_BOMB]: 0 },
                    abilities: Array.isArray(p1.abilities)
                        ? p1.abilities.map((ability) => {
                            const current = asRecord(ability);
                            return current.id === 'blink'
                                ? structuredClone(BLINK_2) as unknown as JsonRecord
                                : current;
                        })
                        : p1.abilities,
                    abilityLevels: {
                        ...asRecord(p1.abilityLevels),
                        blink: 2,
                    },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    rollDiceCount: 5,
                    rollCount: 1,
                    rollLimit: 3,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist',
                        defenseAbilityId: undefined,
                        isDefendable: true,
                        damage: 0,
                    },
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = {
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                    responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
                };
                return state;
            });
            await closeDebugPanelIfOpen(match.guestPage);
            await closeCardSpotlightIfOpen(match.guestPage);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const p1 = asRecord(asRecordMap(core.players)['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                const abilityLevels = asRecord(p1.abilityLevels) as Record<string, number>;
                return {
                    cp: resources[RESOURCE_IDS.CP],
                    blinkLevel: abilityLevels.blink,
                };
            }, { timeout: 10000 }).toEqual({ cp: 5, blinkLevel: 2 });
            await screenshot(match.guestPage, testName, '01-blink-2-defense-state-prepared.png');

            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);

                players['0'] = {
                    ...p0,
                    resources: { ...asRecord(p0.resources), [RESOURCE_IDS.HP]: 30 },
                };
                players['1'] = {
                    ...p1,
                    tokens: { ...asRecord(p1.tokens), [TOKEN_IDS.SMOKE_BOMB]: 0 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    rollDiceCount: 5,
                    rollCount: 1,
                    rollLimit: 3,
                    rollConfirmed: true,
                };
                root.sys = {
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                    responseWindow: { ...asRecord(sys.responseWindow), current: undefined },
                };
                return state;
            });
            await screenshot(match.guestPage, testName, '02-before-enter-defensive-roll.png');

            await expect.poll(async () => {
                const root = await readHarnessState(match.guestPage);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                return {
                    phase: sys.phase ?? core.phase,
                    pendingAttackSource: asRecord(core.pendingAttack).sourceAbilityId ?? null,
                };
            }, { timeout: 10000 }).toEqual({ phase: 'offensiveRoll', pendingAttackSource: 'shattering-fist' });

            await clickAdvancePhase(match.hostPage, '0');
            await expect.poll(async () => {
                const root = await readHarnessState(match.guestPage);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                return {
                    phase: sys.phase ?? core.phase,
                    rollLimit: core.rollLimit ?? null,
                    rollDiceCount: core.rollDiceCount ?? null,
                    defenseAbilityId: asRecord(core.pendingAttack).defenseAbilityId ?? null,
                };
            }, { timeout: 10000 }).toEqual({
                phase: 'defensiveRoll',
                rollLimit: 2,
                rollDiceCount: 3,
                defenseAbilityId: 'blink',
            });
            await screenshot(match.guestPage, testName, '03-entered-defensive-roll-with-reroll-window.png');

            const defenseRollButton = match.guestPage.locator('[data-tutorial-id="dice-roll-button"]');
            const defenseConfirmButton = match.guestPage.locator('[data-tutorial-id="dice-confirm-button"]');
            const endDefenseButton = match.guestPage.getByRole('button', { name: /结束防御|End Defense/i }).first();

            await match.guestPage.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
            await match.guestPage.evaluate(() => {
                window.__BG_TEST_HARNESS__?.dice.setValues([1, 4, 6]);
            });
            await expect(defenseRollButton).toBeEnabled({ timeout: 10000 });
            await defenseRollButton.click();
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                return {
                    rollCount: core.rollCount ?? null,
                    rollLimit: core.rollLimit ?? null,
                    rollConfirmed: core.rollConfirmed ?? null,
                    dieValues: Array.isArray(core.dice) ? core.dice.slice(0, 3).map((die) => asRecord(die).value ?? null) : [],
                };
            }, { timeout: 10000 }).toEqual({
                rollCount: 1,
                rollLimit: 2,
                rollConfirmed: false,
                dieValues: [1, 4, 6],
            });
            await screenshot(match.guestPage, testName, '04-after-first-defense-roll-reroll-still-available.png');

            const keepFirstDie = match.guestPage.getByTestId('die-button-0');
            await expect(keepFirstDie).toBeVisible({ timeout: 10000 });
            await keepFirstDie.click();
            await match.guestPage.evaluate(() => {
                window.__BG_TEST_HARNESS__?.dice.setValues([6, 6]);
            });
            await expect(defenseRollButton).toBeEnabled({ timeout: 10000 });
            await defenseRollButton.click();

            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                return {
                    rollCount: core.rollCount ?? null,
                    rollLimit: core.rollLimit ?? null,
                    dieValues: Array.isArray(core.dice) ? core.dice.slice(0, 3).map((die) => asRecord(die).value ?? null) : [],
                };
            }, { timeout: 10000 }).toEqual({
                rollCount: 2,
                rollLimit: 2,
                dieValues: [1, 6, 6],
            });
            await screenshot(match.guestPage, testName, '05-after-reroll-two-defense-dice.png');

            await expect(defenseConfirmButton).toBeEnabled({ timeout: 10000 });
            await defenseConfirmButton.click();
            await expect(endDefenseButton).toBeEnabled({ timeout: 10000 });
            await endDefenseButton.click();
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const p1 = asRecord(players['1']);
                const p0Resources = asRecord(p0.resources) as Record<string, number>;
                const p1Tokens = asRecord(p1.tokens) as Record<string, number>;
                return {
                    attackerHp: p0Resources[RESOURCE_IDS.HP],
                    smokeBomb: p1Tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    pendingAttack: Boolean(core.pendingAttack),
                };
            }, { timeout: 10000 }).toEqual({
                attackerHp: 29,
                smokeBomb: 1,
                pendingAttack: false,
            });
            await screenshot(match.guestPage, testName, '06-after-defense-reroll-closeout.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者忍术应在伤害前掷骰加伤并回到可收口状态', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者忍术应在伤害前掷骰加伤并回到可收口状态';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const tokens = asRecord(p1.tokens);

                players['1'] = {
                    ...p1,
                    tokens: { ...tokens, [TOKEN_IDS.NINJUTSU]: 1 },
                };
                const pendingDamage = {
                    id: 'e2e-ninjutsu-before-damage',
                    sourcePlayerId: '1',
                    targetPlayerId: '0',
                    originalDamage: 6,
                    currentDamage: 6,
                    sourceAbilityId: 'slash',
                    responseType: 'beforeDamageDealt',
                    responderId: '1',
                    isFullyEvaded: false,
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'slash',
                        isDefendable: true,
                        damage: 6,
                    },
                    pendingDamage,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = setTutorialFixedDie({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: {
                        ...asRecord(sys.interaction),
                        current: {
                            id: 'dt-token-response-e2e-ninjutsu-before-damage',
                            kind: 'dt:token-response',
                            playerId: '1',
                            data: { pendingDamageId: 'e2e-ninjutsu-before-damage' },
                        },
                    },
                }, 5);
                return state;
            });

            await expect(match.guestPage.getByTestId('token-response-modal')).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-ninjutsu-token-response-before-use.png');

            await match.guestPage.getByTestId('token-response-modal').getByRole('button', { name: /^使用/i }).first().click();
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByTestId('bonus-die-reroll-option-0')).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '02-ninjutsu-bonus-die-overlay.png');

            await match.guestPage.getByLabel(/关闭|Close/i).first().click();
            await expect(match.guestPage.getByTestId('bonus-die-overlay')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                return core.pendingDamage ?? null;
            }, { timeout: 10000 }).toBeFalsy();
            await screenshot(match.guestPage, testName, '03-ninjutsu-after-bonus-closeout.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者忍术 6 点应弹出分支选择并能施加慢性中毒', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者忍术6点应弹出分支选择并能施加慢性中毒';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const tokens = asRecord(p1.tokens);

                players['1'] = {
                    ...p1,
                    tokens: { ...tokens, [TOKEN_IDS.NINJUTSU]: 1 },
                };
                const pendingDamage = {
                    id: 'e2e-ninjutsu-choice-before-damage',
                    sourcePlayerId: '1',
                    targetPlayerId: '0',
                    originalDamage: 6,
                    currentDamage: 6,
                    sourceAbilityId: 'slash',
                    responseType: 'beforeDamageDealt',
                    responderId: '1',
                    isFullyEvaded: false,
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'slash',
                        isDefendable: true,
                        damage: 6,
                    },
                    pendingDamage,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = setTutorialFixedDie({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: {
                        ...asRecord(sys.interaction),
                        current: {
                            id: 'dt-token-response-e2e-ninjutsu-choice-before-damage',
                            kind: 'dt:token-response',
                            playerId: '1',
                            data: { pendingDamageId: 'e2e-ninjutsu-choice-before-damage' },
                        },
                    },
                }, 6);
                return state;
            });

            await expect(match.guestPage.getByTestId('token-response-modal')).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-ninjutsu-6-token-response-before-use.png');

            await match.guestPage.getByTestId('token-response-modal').getByRole('button', { name: /^使用/i }).first().click();
            await expect(match.guestPage.getByText('忍术 6 点效果')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByRole('button', { name: /慢性中毒/ })).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '02-ninjutsu-6-choice-modal.png');

            await match.guestPage.getByRole('button', { name: /慢性中毒/ }).click();
            await expect(match.guestPage.getByText('忍术 6 点效果')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const defender = asRecord(players['0']);
                const defenderTokens = asRecord(defender.tokens) as Record<string, number>;
                return {
                    poison: defenderTokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                    pendingDamageOpen: Boolean(core.pendingDamage),
                };
            }, { timeout: 10000 }).toEqual({ poison: 1, pendingDamageOpen: false });
            await screenshot(match.guestPage, testName, '03-ninjutsu-6-poison-after-choice.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者烟雾弹应在防御方响应窗中真实免除伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者烟雾弹应在防御方响应窗中真实免除伤害';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);
                const tokens = asRecord(p1.tokens);

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.HP]: 30 },
                    tokens: { ...tokens, [TOKEN_IDS.SMOKE_BOMB]: 1 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist',
                        isDefendable: true,
                        damage: 7,
                    },
                    pendingDamage: {
                        id: 'e2e-smoke-bomb-before-damage',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 7,
                        currentDamage: 7,
                        sourceAbilityId: 'shattering-fist',
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: {
                        ...asRecord(sys.interaction),
                        current: {
                            id: 'dt-token-response-e2e-smoke-bomb-before-damage',
                            kind: 'dt:token-response',
                            playerId: '1',
                            data: { pendingDamageId: 'e2e-smoke-bomb-before-damage' },
                        },
                    },
                }, [2]);
                return state;
            });

            await expect(match.guestPage.getByTestId('token-response-modal')).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-smoke-bomb-token-response-before-use.png');

            await clickTokenUseButton(match.guestPage);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                const tokens = asRecord(p1.tokens) as Record<string, number>;
                return {
                    hp: resources[RESOURCE_IDS.HP],
                    smokeBomb: tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    pendingDamageOpen: Boolean(core.pendingDamage),
                };
            }, { timeout: 10000 }).toEqual({ hp: 30, smokeBomb: 0, pendingDamageOpen: false });
            await screenshot(match.guestPage, testName, '02-smoke-bomb-after-use-evaded.png');
            await match.guestPage.getByRole('button', { name: '继续' }).click();
            await expect(match.guestPage.getByRole('button', { name: '继续' })).toBeHidden({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '03-smoke-bomb-after-closeout.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者烟雾弹失败骰面应消耗 token 但保留伤害并可继续结算', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者烟雾弹失败骰面应消耗token但保留伤害并可继续结算';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources);
                const tokens = asRecord(p1.tokens);

                players['1'] = {
                    ...p1,
                    resources: { ...resources, [RESOURCE_IDS.HP]: 30 },
                    tokens: { ...tokens, [TOKEN_IDS.SMOKE_BOMB]: 1 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'offensiveRoll',
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'shattering-fist',
                        isDefendable: true,
                        damage: 7,
                    },
                    pendingDamage: {
                        id: 'e2e-smoke-bomb-failure-before-damage',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 7,
                        currentDamage: 7,
                        sourceAbilityId: 'shattering-fist',
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: {
                        ...asRecord(sys.interaction),
                        current: {
                            id: 'dt-token-response-e2e-smoke-bomb-failure-before-damage',
                            kind: 'dt:token-response',
                            playerId: '1',
                            data: { pendingDamageId: 'e2e-smoke-bomb-failure-before-damage' },
                        },
                    },
                }, [5]);
                return state;
            });

            await expect(match.guestPage.getByTestId('token-response-modal')).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-smoke-bomb-failure-token-response-before-use.png');

            await clickTokenUseButton(match.guestPage);
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                const tokens = asRecord(p1.tokens) as Record<string, number>;
                return {
                    hp: resources[RESOURCE_IDS.HP],
                    smokeBomb: tokens[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                    pendingDamageOpen: Boolean(core.pendingDamage),
                    currentDamage: asRecord(core.pendingDamage).currentDamage,
                };
            }, { timeout: 10000 }).toEqual({
                hp: 30,
                smokeBomb: 0,
                pendingDamageOpen: true,
                currentDamage: 7,
            });
            await screenshot(match.guestPage, testName, '02-smoke-bomb-failure-after-use-pending-damage.png');

            await dispatchDiceThroneCommand(match.guestPage, {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '1',
                payload: {},
            });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const resources = asRecord(p1.resources) as Record<string, number>;
                return {
                    hp: resources[RESOURCE_IDS.HP],
                    pendingDamageOpen: Boolean(core.pendingDamage),
                };
            }, { timeout: 10000 }).toEqual({ hp: 23, pendingDamageOpen: false });
            await screenshot(match.guestPage, testName, '03-smoke-bomb-failure-after-damage-resolved.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('忍者 6 点不可防御分支和慢性中毒回合结束应真实收口', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupTreantNinjaMatch(browser, baseURL);
        const testName = '忍者6点不可防御分支和慢性中毒回合结束应真实收口';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);
                const tokens = asRecord(p1.tokens);

                players['1'] = {
                    ...p1,
                    tokens: { ...tokens, [TOKEN_IDS.NINJUTSU]: 1 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'slash',
                        isDefendable: true,
                        damage: 6,
                    },
                    pendingDamage: {
                        id: 'e2e-ninjutsu-undefendable-before-damage',
                        sourcePlayerId: '1',
                        targetPlayerId: '0',
                        originalDamage: 6,
                        currentDamage: 6,
                        sourceAbilityId: 'slash',
                        responseType: 'beforeDamageDealt',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: {
                        ...asRecord(sys.interaction),
                        current: {
                            id: 'dt-token-response-e2e-ninjutsu-undefendable-before-damage',
                            kind: 'dt:token-response',
                            playerId: '1',
                            data: { pendingDamageId: 'e2e-ninjutsu-undefendable-before-damage' },
                        },
                    },
                }, [6]);
                return state;
            });

            await expect(match.guestPage.getByTestId('token-response-modal')).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-ninjutsu-6-undefendable-before-use.png');

            await clickTokenUseButton(match.guestPage);
            await expect(match.guestPage.getByText('忍术 6 点效果')).toBeVisible({ timeout: 10000 });
            await expect(match.guestPage.getByRole('button', { name: /不可防御/ })).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '02-ninjutsu-6-undefendable-choice-modal.png');

            await match.guestPage.getByRole('button', { name: /不可防御/ }).click();
            await expect(match.guestPage.getByText('忍术 6 点效果')).toBeHidden({ timeout: 10000 });
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                const pendingAttack = asRecord(core.pendingAttack);
                return {
                    isDefendable: pendingAttack.isDefendable,
                    bonusDamage: pendingAttack.bonusDamage,
                    pendingDamageOpen: Boolean(core.pendingDamage),
                };
            }, { timeout: 10000 }).toEqual({ isDefendable: false, bonusDamage: 2, pendingDamageOpen: false });
            await screenshot(match.guestPage, testName, '03-ninjutsu-6-undefendable-after-choice.png');
            await closeCardSpotlightIfOpen(match.guestPage);

            await applyOnlineMatchState(match.matchId, match.hostPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources);
                const tokens = asRecord(p0.tokens);

                players['0'] = {
                    ...p0,
                    resources: { ...resources, [RESOURCE_IDS.HP]: 20 },
                    tokens: { ...tokens, [TOKEN_IDS.DELAYED_POISON]: 2 },
                    hand: [],
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '0',
                    phase: 'discard',
                    pendingAttack: null,
                    pendingDamage: null,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = { ...sys, phase: 'discard', currentPlayerIndex: 0, interaction: { ...asRecord(sys.interaction), current: undefined } };
                return state;
            }, 100);
            await screenshot(match.hostPage, testName, '04-delayed-poison-before-turn-end.png');

            await clickAdvancePhase(match.hostPage, '0');
            await expect.poll(async () => {
                const root = await readHarnessState(match.hostPage);
                const core = asRecord(root.core);
                const players = asRecordMap(core.players);
                const p0 = asRecord(players['0']);
                const resources = asRecord(p0.resources) as Record<string, number>;
                const tokens = asRecord(p0.tokens) as Record<string, number>;
                return {
                    hp: resources[RESOURCE_IDS.HP],
                    poison: tokens[TOKEN_IDS.DELAYED_POISON] ?? 0,
                };
            }, { timeout: 10000 }).toEqual({ hp: 14, poison: 0 });
            await screenshot(match.hostPage, testName, '05-delayed-poison-after-turn-end.png');
        } finally {
            await closeMatchContexts(match);
        }
    });
});
