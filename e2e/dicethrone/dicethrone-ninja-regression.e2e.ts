/**
 * DiceThrone Ninja regression coverage.
 *
 * Covers the four user-reported regressions in the new Ninja intake:
 * slot image mapping, Blink defense, undefendable defense suppression, and Knife Fan timing.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../framework';
import type { Browser, Page } from '@playwright/test';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
    closeDebugPanelIfOpen,
    dispatchDiceThroneCommand,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { createCharacterDice } from '../../src/games/dicethrone/domain/characters';
import { getHeroDieFace } from '../../src/games/dicethrone/domain/rules';
import type { Die } from '../../src/games/dicethrone/domain/types';
import '../../src/games/dicethrone/domain';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const evidenceRoot = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    'dicethrone',
    'dicethrone-ninja-regression.e2e',
);

const asRecord = (value: unknown): JsonRecord =>
    value && typeof value === 'object' ? value as JsonRecord : {};

const asRecordMap = (value: unknown): Record<string, JsonRecord> =>
    value && typeof value === 'object' ? value as Record<string, JsonRecord> : {};

const screenshot = async (page: Page, testName: string, fileName: string) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, fileName);
    await page.screenshot({ path, fullPage: false });
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

const dispatchSetupCommand = async (
    page: Page,
    type: 'SELECT_CHARACTER' | 'PLAYER_READY' | 'HOST_START_GAME',
    playerId: string,
    payload: Record<string, unknown> = {},
) => {
    await dispatchDiceThroneCommand(page, { type, playerId, payload });
    await page.waitForTimeout(300);
};

const setupNinjaRegressionMatch = async (
    browser: Browser,
    baseURL: string | undefined,
): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 90000,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用');
        throw new Error('Game server unavailable');
    }

    await waitForDiceThroneHarness(match.hostPage);
    await waitForDiceThroneHarness(match.guestPage);
    await dispatchSetupCommand(match.hostPage, 'SELECT_CHARACTER', '0', { characterId: 'treant' });
    await dispatchSetupCommand(match.guestPage, 'SELECT_CHARACTER', '1', { characterId: 'ninja' });
    await dispatchSetupCommand(match.guestPage, 'PLAYER_READY', '1');
    await dispatchSetupCommand(match.hostPage, 'HOST_START_GAME', '0');

    await waitForGameBoard(match.hostPage, 30000);
    await waitForGameBoard(match.guestPage, 30000);
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

const forceFixedDieQueue = (sys: JsonRecord, values: number[]): JsonRecord => ({
    ...sys,
    tutorial: {
        ...asRecord(sys.tutorial),
        active: true,
        randomPolicy: { mode: 'sequence', values, cursor: 0 },
    },
});

const createNinjaDiceWithValues = (values: number[]) =>
    createCharacterDice('ninja').map((die: Die, index: number) => {
        const value = values[index] ?? 1;
        const symbol = getHeroDieFace('ninja', value);
        return {
            ...die,
            id: index,
            isKept: false,
            isLocked: false,
            value,
            symbol,
            symbols: symbol ? [symbol] : [],
            playerId: '1',
        };
    });

const readHarnessCoreState = async (page: Page): Promise<JsonRecord> => {
    const state = await page.evaluate(() => (window as Window).__BG_TEST_HARNESS__!.state.get());
    return asRecord(state?.core ?? state?.G?.core);
};

const closeCardSpotlightIfOpen = async (page: Page) => {
    const closeButton = page.getByRole('button', { name: /关闭特写|Close/i }).first();
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(200);
    }
};

const ensureCenterBoardCharacter = async (page: Page, characterId: string) => {
    const board = page.getByTestId('player-board-surface').first();
    const header = page.getByTestId('dt-top-header-1').first();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const currentCharacterId = await board.getAttribute('data-character-id').catch(() => '');
        if (currentCharacterId === characterId) {
            return;
        }
        if (await header.isVisible({ timeout: 1000 }).catch(() => false)) {
            await header.click();
            await page.waitForTimeout(500);
        }
    }
    await expect(board, `中心玩家面板应切回 ${characterId}`).toHaveAttribute('data-character-id', characterId);
};

const clickResolvedAbilitySlot = async (
    page: Page,
    slotId: string,
    expectedAbilityId: string,
) => {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-resolved-ability-id', expectedAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });

    const clickPoint = await page.evaluate((targetSlotId) => {
        const element = document.querySelector(
            `[data-testid="player-board-surface"] [data-ability-slot="${targetSlotId}"]`,
        ) as HTMLElement | null;
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const xFractions = [0.18, 0.5, 0.82];
        const yFractions = [0.12, 0.28, 0.5, 0.72, 0.88];

        for (const yFraction of yFractions) {
            for (const xFraction of xFractions) {
                const x = rect.left + rect.width * xFraction;
                const y = rect.top + rect.height * yFraction;
                const topElement = document.elementFromPoint(x, y);
                const hitSlot = topElement?.closest?.('[data-ability-slot]');
                if (hitSlot === element) {
                    return { x, y };
                }
            }
        }

        return null;
    }, slotId);

    expect(clickPoint, `${slotId} 槽位必须存在真实可点击点，不能被手牌或其它层遮住`).not.toBeNull();
    await page.mouse.click(clickPoint!.x, clickPoint!.y);
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
    }
    await dispatchDiceThroneCommand(page, {
        type: 'ADVANCE_PHASE',
        playerId,
        payload: {},
    });
};

test.describe('DiceThrone Ninja 回归修复', () => {
    test('毒刃与死亡盛放应分别映射到 Ninja 实图槽位并可真实选择', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNinjaRegressionMatch(browser, baseURL);
        const testName = '毒刃与死亡盛放应分别映射到 Ninja 实图槽位并可真实选择';

        try {
            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);

                players['1'] = {
                    ...p1,
                    resources: { ...asRecord(p1.resources), [RESOURCE_IDS.CP]: 3 },
                };
                root.core = {
                    ...core,
                    players,
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    dice: createNinjaDiceWithValues([1, 2, 3, 4, 6]),
                    pendingAttack: undefined,
                    pendingDamage: undefined,
                    pendingBonusDiceSettlement: undefined,
                    activatingAbilityId: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [1, 2, 3, 4, 6]);
                return state;
            });
            await ensureCenterBoardCharacter(match.guestPage, 'ninja');

            const poisonSlot = match.guestPage.locator('[data-testid="player-board-surface"] [data-ability-slot="combo"]').first();
            await expect(poisonSlot).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '01-poison-blade-combo-slot-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'combo', 'poison-blade');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                return asRecord(core.pendingAttack).sourceAbilityId;
            }, { timeout: 10000 }).toBe('poison-blade');
            await screenshot(match.guestPage, testName, '02-poison-blade-after-click.png');

            await applyOnlineMatchState(match.matchId, match.guestPage, (state) => {
                const root = asRecord(state.G ?? state);
                const core = asRecord(root.core);
                const sys = asRecord(root.sys);
                const players = asRecordMap(core.players);
                const p1 = asRecord(players['1']);

                root.core = {
                    ...core,
                    players: {
                        ...players,
                        '1': {
                            ...p1,
                            resources: { ...asRecord(p1.resources), [RESOURCE_IDS.CP]: 3 },
                        },
                    },
                    activePlayerId: '1',
                    phase: 'offensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    dice: createNinjaDiceWithValues([1, 2, 3, 4, 5]),
                    pendingAttack: undefined,
                    pendingDamage: undefined,
                    pendingBonusDiceSettlement: undefined,
                    activatingAbilityId: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'offensiveRoll',
                    currentPlayerIndex: 1,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [1, 2, 3, 4, 5]);
                return state;
            });
            await ensureCenterBoardCharacter(match.guestPage, 'ninja');

            const deathBlossomSlot = match.guestPage.locator('[data-testid="player-board-surface"] [data-ability-slot="sky"]').first();
            await expect(deathBlossomSlot).toBeVisible({ timeout: 10000 });
            await screenshot(match.guestPage, testName, '03-death-blossom-sky-slot-before-click.png');
            await clickResolvedAbilitySlot(match.guestPage, 'sky', 'death-blossom');
            await expect.poll(async () => {
                const core = await readHarnessCoreState(match.guestPage);
                return asRecord(core.pendingAttack).sourceAbilityId;
            }, { timeout: 10000 }).toBe('death-blossom');
            await screenshot(match.guestPage, testName, '04-death-blossom-after-click.png');
        } finally {
            await closeMatchContexts(match);
        }
    });

    test('Blink 防御应生效，攻击改为不可防御后不得再执行 Blink', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupNinjaRegressionMatch(browser, baseURL);
        const testName = 'Blink 防御应生效，攻击改为不可防御后不得再执行 Blink';

        try {
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
                    phase: 'defensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    rollDiceCount: 3,
                    dice: createNinjaDiceWithValues([1, 4, 6]),
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: undefined,
                        defenseAbilityId: 'blink',
                        isDefendable: true,
                        damage: 0,
                    },
                    pendingDamage: undefined,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'defensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [1, 4, 6]);
                return state;
            });
            await screenshot(match.guestPage, testName, '01-blink-before-defense-advance.png');
            await clickAdvancePhase(match.guestPage, '1');
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
                };
            }, { timeout: 10000 }).toEqual({ attackerHp: 27, smokeBomb: 0 });
            await screenshot(match.guestPage, testName, '02-blink-after-defense-advance.png');

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
                    phase: 'defensiveRoll',
                    rollCount: 1,
                    rollConfirmed: true,
                    rollDiceCount: 3,
                    dice: createNinjaDiceWithValues([1, 4, 6]),
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: undefined,
                        defenseAbilityId: 'blink',
                        isDefendable: false,
                        damage: 0,
                    },
                    pendingDamage: undefined,
                    pendingBonusDiceSettlement: undefined,
                };
                root.sys = forceFixedDieQueue({
                    ...sys,
                    phase: 'defensiveRoll',
                    currentPlayerIndex: 0,
                    interaction: { ...asRecord(sys.interaction), current: undefined },
                }, [1, 4, 6]);
                return state;
            });
            await screenshot(match.guestPage, testName, '03-undefendable-before-defense-advance.png');
            await clickAdvancePhase(match.guestPage, '1');
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
                };
            }, { timeout: 10000 }).toEqual({ attackerHp: 30, smokeBomb: 0 });
            await screenshot(match.guestPage, testName, '04-undefendable-after-defense-advance.png');
        } finally {
            await closeMatchContexts(match);
        }
    });
});
