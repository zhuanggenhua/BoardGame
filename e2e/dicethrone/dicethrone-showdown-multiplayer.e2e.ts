import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Browser, Page, TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import {
    cleanupDTMatch,
    readyAndStartGame,
    selectCharacter,
    setupDTOnlineMatch,
} from '../helpers/dicethrone';
import { waitForTestHarness } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { getEvidenceScreenshotDir, sanitizeEvidencePathSegment } from '../framework/evidenceScreenshots';
import type { MatchState, RandomFn } from '../../src/engine/types';
import '../../src/games/dicethrone/domain';
import { createCharacterDice, initHeroState } from '../../src/games/dicethrone/domain/characters';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { getHeroDieFace } from '../../src/games/dicethrone/domain/rules';

type OnlineMatchState = MatchState<unknown> & {
    core?: {
        phase?: string | null;
        selectedCharacters?: Record<string, string | null>;
        readyPlayers?: Record<string, boolean | null>;
        seatControllers?: Record<string, { type?: string | null }>;
        players?: Record<string, unknown>;
        pendingAttack?: {
            attackerId?: string | null;
            defenderId?: string | null;
            sourceAbilityId?: string | null;
            damage?: number | null;
            bonusDamage?: number | null;
            isDefendable?: boolean | null;
        } | null;
        activePlayerId?: string | null;
        hostStarted?: boolean | null;
        rollCount?: number | null;
        rollLimit?: number | null;
        rollConfirmed?: boolean | null;
        selectedAbilityId?: string | null;
        currentRollContext?: {
            kind?: string | null;
            status?: string | null;
            ownerPlayerId?: string | null;
            display?: {
                replayOnly?: boolean | null;
            } | null;
            dice?: Array<{
                value?: number | null;
            }>;
        } | null;
        dice?: Array<{
            id?: number;
            value?: number;
            symbol?: string | null;
            symbols?: string[] | null;
            definitionId?: string | null;
            isKept?: boolean | null;
        }>;
    };
    sys?: {
        phase?: string | null;
        interaction?: {
            current?: {
                kind?: string | null;
                playerId?: string | null;
            } | null;
            queue?: unknown[];
        } | null;
        responseWindow?: {
            current?: unknown;
        } | null;
        turnOrder?: string[];
        currentPlayerIndex?: number | null;
        flowHalted?: boolean | null;
    };
};

const DICE_THRONE_PREPARE_RANDOM: RandomFn = {
    shuffle: <T>(values: T[]) => [...values],
    random: () => 0.5,
    d: (_n: number) => 1,
    range: (min: number, _max: number) => min,
};

const getEvidenceScreenshotPath = (testInfo: TestInfo, name: string) => {
    const dir = getEvidenceScreenshotDir(testInfo);
    return join(dir, `${sanitizeEvidencePathSegment(name) || 'screenshot'}.png`);
};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
    const path = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
    return path;
};

const saveLocatorScreenshot = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
    testId: string,
) => {
    const path = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(path), { recursive: true });
    const locator = page.getByTestId(testId);
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error(`Unable to resolve bounding box for ${testId}`);
    }
    await page.screenshot({
        path,
        clip: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
        },
    });
    return path;
};

const expectCompareRollMainResultLayer = async (page: Page, timeout = 8000): Promise<void> => {
    const panel = page.getByTestId('compare-roll-overlay');
    await expect(panel).toBeVisible({ timeout });
    await expect(panel).toHaveAttribute('data-placement', 'main-result-layer');
    await expect(panel.locator('xpath=ancestor::*[@data-player-seat-anchor][1]')).toHaveCount(0);
    await expect(panel.locator('[data-testid="dice-2d"]')).toHaveCount(0);
    await expect(page.getByTestId('roll-spotlight-dice-content')).toHaveCount(0);
    const layout = await page.evaluate(() => {
        const panelNode = document.querySelector<HTMLElement>('[data-testid="compare-roll-overlay"]');
        const panelRect = panelNode?.getBoundingClientRect();
        if (!panelRect) return null;

        return {
            centerOffsetX: Math.abs(panelRect.left + panelRect.width / 2 - window.innerWidth / 2),
            centerOffsetY: Math.abs(panelRect.top + panelRect.height / 2 - window.innerHeight / 2),
            centerToleranceX: Math.max(24, window.innerWidth * 0.02),
            centerToleranceY: Math.max(24, window.innerHeight * 0.02),
        };
    });
    expect(layout).not.toBeNull();
    expect(layout!.centerOffsetX).toBeLessThanOrEqual(layout!.centerToleranceX);
    expect(layout!.centerOffsetY).toBeLessThanOrEqual(layout!.centerToleranceY);
};

const getRightDiceRail = (page: Page) => {
    const diceTray = page.locator('[data-testid="dicethrone-2d-dice-tray"]:visible').first();
    return {
        diceTray,
        rail: diceTray.locator('xpath=ancestor::*[@data-player-seat-anchor][1]'),
    };
};

async function setHarnessRandomQueue(page: Page, values: number[]): Promise<void> {
    await page.evaluate((queueValues) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                random?: { setQueue?: (nextValues: number[]) => void };
            };
        }).__BG_TEST_HARNESS__;
        harness?.random?.setQueue?.(queueValues);
    }, values);
}

async function dispatchHarnessCommand(
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
): Promise<void> {
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                command?: {
                    dispatch?: (command: {
                        type: string;
                        playerId: string;
                        payload: Record<string, unknown>;
                    }) => void | Promise<void>;
                };
            };
        }).__BG_TEST_HARNESS__;

        if (!harness?.command?.dispatch) {
            throw new Error('TestHarness command dispatcher not ready');
        }

        await harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
}

function buildOnlineShowdownState(state: OnlineMatchState): OnlineMatchState {
    const next = structuredClone(state) as OnlineMatchState;
    const host = initHeroState('0', 'gunslinger', DICE_THRONE_PREPARE_RANDOM);
    const guest = initHeroState('1', 'monk', DICE_THRONE_PREPARE_RANDOM);

    next.core = {
        ...next.core,
        phase: 'offensiveRoll',
        hostStarted: true,
        selectedCharacters: {
            ...(next.core?.selectedCharacters ?? {}),
            '0': 'gunslinger',
            '1': 'monk',
        },
        readyPlayers: {
            ...(next.core?.readyPlayers ?? {}),
            '0': true,
            '1': true,
        },
        seatControllers: {
            ...(next.core?.seatControllers ?? {}),
            '0': { type: 'human' },
            '1': { type: 'human' },
        },
        activePlayerId: '0',
        turnNumber: 1,
        rollCount: 1,
        rollLimit: 3,
        rollConfirmed: true,
        selectedAbilityId: 'showdown',
        players: {
            ...(next.core?.players ?? {}),
            '0': {
                ...host,
                resources: {
                    ...(host.resources ?? {}),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
                tokens: {
                    ...(host.tokens ?? {}),
                    loaded: 0,
                },
            },
            '1': {
                ...guest,
                resources: {
                    ...(guest.resources ?? {}),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
        },
        dice: createCharacterDice('gunslinger').map((die, index) => {
            const values = [1, 2, 3, 4, 5];
            const value = values[index] ?? 1;
            const symbol = getHeroDieFace('gunslinger', value);
            return {
                ...die,
                value,
                symbol,
                symbols: [symbol],
                isKept: false,
            };
        }),
        pendingAttack: {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            damage: 5,
            bonusDamage: 0,
            sourceAbilityId: 'showdown',
        },
        pendingDamage: undefined,
        interaction: undefined,
    };

    next.sys = {
        ...next.sys,
        phase: 'offensiveRoll',
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        flowHalted: false,
        responseWindow: {
            ...(next.sys?.responseWindow ?? {}),
            current: null,
        },
        interaction: {
            ...(next.sys?.interaction ?? {}),
            current: null,
            queue: [],
        },
    };

    return next;
}

test.describe('DiceThrone Showdown 双端右侧对掷面板', () => {
    test('枪手 Showdown 应在联机双方右侧骰盘旁展示枪战决斗结果并自动收口', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser as Browser, baseURL, {
            skipImageGate: true,
            characterSelectionTimeout: 120000,
        });
        if (!setup) {
            test.skip(true, 'DiceThrone 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, guestPage, matchId } = setup;

            await selectCharacter(hostPage, 'gunslinger');
            await selectCharacter(guestPage, 'monk');
            await readyAndStartGame(hostPage, guestPage);
            await waitForTestHarness(hostPage, 15000);
            await waitForTestHarness(guestPage, 15000);

            const current = await getMatchState(matchId, hostPage) as OnlineMatchState;
            await injectMatchState(matchId, buildOnlineShowdownState(current), hostPage);

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage) as OnlineMatchState;
                return {
                    phase: state.sys?.phase ?? null,
                    sourceAbilityId: state.core?.pendingAttack?.sourceAbilityId ?? null,
                    bonusDamage: state.core?.pendingAttack?.bonusDamage ?? null,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                };
            }, {
                timeout: 10000,
                message: '等待联机 Showdown 场景注入完成',
            }).toMatchObject({
                phase: 'offensiveRoll',
                sourceAbilityId: 'showdown',
                bonusDamage: 0,
                interactionKind: null,
            });

            await setHarnessRandomQueue(hostPage, [0.99, 0.0]);
            await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage) as OnlineMatchState;
                const context = state.core?.currentRollContext;
                const diceValues = Array.isArray(context?.dice)
                    ? context.dice.map((die) => die.value ?? null)
                    : [];
                return {
                    phase: state.sys?.phase ?? null,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    rollContextKind: context?.kind ?? null,
                    rollContextStatus: context?.status ?? null,
                    rollContextOwner: context?.ownerPlayerId ?? null,
                    diceCount: diceValues.length,
                    diceInRange: diceValues.every((value) => (
                        typeof value === 'number'
                        && value >= 1
                        && value <= 6
                    )),
                };
            }, {
                timeout: 10000,
                message: '等待 Showdown 对掷骰子进入右侧骰盘待确认',
            }).toMatchObject({
                phase: 'offensiveRoll',
                interactionKind: null,
                rollContextKind: 'compare',
                rollContextStatus: 'open',
                rollContextOwner: '0',
                diceCount: 2,
                diceInRange: true,
            });

            const compareRollStateBeforeConfirm = await getMatchState(matchId, hostPage) as OnlineMatchState;
            const compareDiceValues = compareRollStateBeforeConfirm.core?.currentRollContext?.dice
                ?.map((die) => die.value ?? null)
                ?? [];
            expect(compareDiceValues).toHaveLength(2);
            const [attackerCompareRoll, defenderCompareRoll] = compareDiceValues;
            expect(typeof attackerCompareRoll).toBe('number');
            expect(typeof defenderCompareRoll).toBe('number');
            const expectedBonusDamage = (attackerCompareRoll as number) >= (defenderCompareRoll as number) ? 2 : 0;

            const { diceTray: hostCompareDiceTray, rail: hostCompareDiceRail } = getRightDiceRail(hostPage);
            const { diceTray: guestCompareDiceTray } = getRightDiceRail(guestPage);
            await expect(hostCompareDiceTray).toBeVisible({ timeout: 5000 });
            await expect(guestCompareDiceTray).toBeVisible({ timeout: 5000 });
            await expect(hostPage.getByTestId('compare-roll-overlay')).toHaveCount(0);
            await expect(guestPage.getByTestId('compare-roll-overlay')).toHaveCount(0);
            await expect(hostPage.getByTestId('roll-spotlight-dice-content')).toHaveCount(0);
            await expect(guestPage.getByTestId('roll-spotlight-dice-content')).toHaveCount(0);

            const hostCompareConfirmButton = hostCompareDiceRail.locator('[data-tutorial-id="dice-confirm-button"]').first();
            await expect(hostCompareConfirmButton).toBeVisible({ timeout: 5000 });
            await expect(hostCompareConfirmButton).toBeEnabled();
            await hostCompareConfirmButton.click();

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage) as OnlineMatchState;
                const context = state.core?.currentRollContext;
                const interaction = state.sys?.interaction?.current;
                return {
                    interactionKind: interaction?.kind ?? null,
                    interactionPlayerId: interaction?.playerId ?? null,
                    rollContextKind: context?.kind ?? null,
                    rollContextStatus: context?.status ?? null,
                    rollContextReplayOnly: context?.display?.replayOnly ?? null,
                    dice: Array.isArray(context?.dice)
                        ? context.dice.map((die) => die.value ?? null)
                        : [],
                };
            }, {
                timeout: 10000,
                message: '等待 Showdown 普通确认后生成主结果层',
            }).toMatchObject({
                interactionKind: 'compare-roll-choice',
                interactionPlayerId: '0',
                rollContextKind: 'compare',
                rollContextStatus: 'settled',
                rollContextReplayOnly: true,
                dice: compareDiceValues,
            });

            const hostOverlay = hostPage.getByTestId('compare-roll-overlay');
            const guestOverlay = guestPage.getByTestId('compare-roll-overlay');

            await expectCompareRollMainResultLayer(hostPage);
            await expectCompareRollMainResultLayer(guestPage);
            await expect(hostPage.getByText('枪战决斗')).toBeVisible();
            await expect(guestPage.getByText('枪战决斗')).toBeVisible();
            await expect(hostPage.getByTestId('compare-roll-participant-0')).toHaveCount(0);
            await expect(hostPage.getByTestId('compare-roll-participant-1')).toHaveCount(0);
            await expect(guestPage.getByTestId('compare-roll-participant-0')).toHaveCount(0);
            await expect(guestPage.getByTestId('compare-roll-participant-1')).toHaveCount(0);
            await expect(hostPage.getByTestId('compare-roll-autoconfirm')).toContainText('确认中');
            await expect(guestPage.getByTestId('compare-roll-autoconfirm')).toContainText('确认中');

            const hostResultText = (await hostPage.getByTestId('compare-roll-result').textContent())?.trim() ?? '';
            const guestResultText = (await guestPage.getByTestId('compare-roll-result').textContent())?.trim() ?? '';
            expect(hostResultText.length).toBeGreaterThan(0);
            expect(guestResultText).toBe(hostResultText);
            if (expectedBonusDamage === 2) {
                expect(hostResultText).toContain('+2');
            } else {
                expect(hostResultText).not.toContain('+2');
            }

            const hostOpenPath = await saveLocatorScreenshot(hostPage, testInfo, 'showdown-host-open', 'compare-roll-overlay');
            const guestOpenPath = await saveLocatorScreenshot(guestPage, testInfo, 'showdown-guest-open', 'compare-roll-overlay');
            testInfo.annotations.push({ type: 'showdown-host-open', description: hostOpenPath });
            testInfo.annotations.push({ type: 'showdown-guest-open', description: guestOpenPath });

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage) as OnlineMatchState;
                return {
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    phase: state.sys?.phase ?? null,
                    bonusDamage: state.core?.pendingAttack?.bonusDamage ?? null,
                    sourceAbilityId: state.core?.pendingAttack?.sourceAbilityId ?? null,
                };
            }, {
                timeout: 10000,
                message: '等待 Showdown compare-roll 自动确认并写入加伤',
            }).toMatchObject({
                interactionKind: null,
                phase: 'offensiveRoll',
                bonusDamage: expectedBonusDamage,
                sourceAbilityId: 'showdown',
            });

            await expect(hostOverlay).toBeHidden({ timeout: 5000 });
            await expect(guestOverlay).toBeHidden({ timeout: 5000 });

            await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage) as OnlineMatchState;
                return {
                    phase: state.sys?.phase ?? null,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    sourceAbilityId: state.core?.pendingAttack?.sourceAbilityId ?? null,
                };
            }, {
                timeout: 10000,
                message: '等待 Showdown compare-roll 收口后继续推进到 defensiveRoll',
            }).toMatchObject({
                phase: 'defensiveRoll',
                interactionKind: null,
                sourceAbilityId: 'showdown',
            });

            const hostClosedPath = await saveEvidenceScreenshot(hostPage, testInfo, 'showdown-host-closed');
            const guestClosedPath = await saveEvidenceScreenshot(guestPage, testInfo, 'showdown-guest-closed');
            testInfo.annotations.push({ type: 'showdown-host-closed', description: hostClosedPath });
            testInfo.annotations.push({ type: 'showdown-guest-closed', description: guestClosedPath });
        } finally {
            await cleanupDTMatch(setup);
        }
    });
});
