import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { injectSkipImageGate, setChineseLocale, waitForTestHarness } from '../helpers/common';
import { setupDTOnlineMatch } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import type { RandomFn } from '../../src/engine/types';
import { initHeroState } from '../../src/games/dicethrone/domain/characters';

type DtState = Record<string, any>;

const DICE_THRONE_PREPARE_RANDOM: RandomFn = {
    shuffle: <T>(values: T[]) => [...values],
    random: () => 0.5,
    d: (_n: number) => 1,
    range: (min: number, _max: number) => min,
};

const applyOnlineMatchState = async (
    matchId: string,
    page: Page,
    updater: (state: DtState) => DtState,
    waitMs = 1000,
) => {
    const current = await getMatchState(matchId, page) as DtState;
    const next = updater(structuredClone(current));
    const root = (next.G ?? next) as DtState;
    const core = (root.core ?? {}) as DtState;
    const sys = (root.sys ?? {}) as DtState;
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(core.players ?? {});

    root.core = {
        ...core,
        phase: typeof core.phase === 'string' ? core.phase : sys.phase,
    };
    root.sys = {
        ...sys,
        matchId,
        turnOrder,
        currentPlayerIndex: typeof sys.currentPlayerIndex === 'number' ? sys.currentPlayerIndex : 1,
    };

    await injectMatchState(matchId, next, page);
    await page.waitForTimeout(waitMs);
};

const dispatchHarnessCommand = async (
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
) => {
    await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
        (window as any).__BG_TEST_HARNESS__!.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
};

const primeFixedRandomQueue = async (page: Page) => {
    await page.evaluate(() => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: { random?: { setQueue?: (values: number[]) => void } };
        }).__BG_TEST_HARNESS__;
        harness?.random?.setQueue?.([0.99, 0.0]);
    });
};

const dismissStartDefenseShowcaseIfPresent = async (page: Page) => {
    const startDefenseButton = page.getByRole('button', { name: /开始防御|Start Defense/i }).first();
    if (await startDefenseButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await startDefenseButton.click();
        await expect(startDefenseButton).toBeHidden({ timeout: 5000 }).catch(() => {});
    }
};

const openFabPanel = async (page: Page, panelId: string, mainId = 'chat') => {
    const panel = page.getByTestId(`fab-panel-${panelId}`);
    if (await panel.isVisible().catch(() => false)) {
        return panel;
    }

    const panelButton = page.locator(`[data-fab-id="${panelId}"]`).first();
    if (!await panelButton.isVisible().catch(() => false)) {
        const mainButton = page.locator(`[data-fab-id="${mainId}"]`).first();
        if (await mainButton.isVisible().catch(() => false)) {
            await mainButton.click();
        }
    }

    await expect(panelButton).toBeVisible({ timeout: 5000 });
    await panelButton.click();
    await expect(panel).toBeVisible({ timeout: 5000 });
    return panel;
};

const buildSharedDuelState = (state: DtState): DtState => {
    const root = (state.G ?? state) as DtState;
    const next = structuredClone(root);
    const core = (next.core ?? {}) as DtState;
    const sys = (next.sys ?? {}) as DtState;
    const monk = initHeroState('0', 'monk', DICE_THRONE_PREPARE_RANDOM);
    const gunslinger = initHeroState('1', 'gunslinger', DICE_THRONE_PREPARE_RANDOM);
    const preparedDice = Array.isArray(core.dice) && core.dice.length > 0
        ? core.dice.map((die: DtState, index: number) => (
            index === 0
                ? { ...die, value: 6, isKept: true }
                : die
        ))
        : Array.from({ length: 5 }, (_, index) => ({
            id: index,
            value: index === 0 ? 6 : 1,
            isKept: index === 0,
        }));

    next.core = {
        ...core,
        hostStarted: true,
        phase: 'defensiveRoll',
        selectedCharacters: {
            ...(core.selectedCharacters ?? {}),
            '0': 'monk',
            '1': 'gunslinger',
        },
        readyPlayers: {
            ...(core.readyPlayers ?? {}),
            '0': true,
            '1': true,
        },
        seatControllers: {
            ...(core.seatControllers ?? {}),
            '0': { type: 'human' },
            '1': { type: 'human' },
        },
        activePlayerId: '1',
        turnNumber: typeof core.turnNumber === 'number' ? core.turnNumber : 1,
        rollCount: 1,
        rollLimit: 1,
        rollConfirmed: true,
        dice: preparedDice,
        players: {
            '0': {
                ...monk,
                resources: {
                    ...(monk.resources ?? {}),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
            '1': {
                ...gunslinger,
                resources: {
                    ...(gunslinger.resources ?? {}),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
        },
        pendingDamage: null,
        pendingAttack: {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            damage: 5,
            bonusDamage: 0,
            sourceAbilityId: 'harmony',
            defenseAbilityId: 'duel',
        },
    };

    next.sys = {
        ...sys,
        phase: 'defensiveRoll',
        turnOrder: ['0', '1'],
        currentPlayerIndex: 1,
        responseWindow: {
            ...(sys.responseWindow ?? {}),
            current: null,
        },
        interaction: {
            ...(sys.interaction ?? {}),
            current: null,
            queue: [],
        },
    };

    return next;
};

test('枪手 Duel compare-roll 应对双方同时可见，且对手侧能从日志看出结果', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup?.guestPage) {
        test.skip(true, '在线双人房创建失败');
        return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
        await injectSkipImageGate(hostContext, true);
        await injectSkipImageGate(guestContext, true);
        await setChineseLocale(hostContext);
        await setChineseLocale(guestContext);
        await hostPage.reload({ waitUntil: 'domcontentloaded' });
        await guestPage.reload({ waitUntil: 'domcontentloaded' });
        await waitForTestHarness(hostPage, 15000);
        await waitForTestHarness(guestPage, 15000);

        await primeFixedRandomQueue(hostPage);
        await primeFixedRandomQueue(guestPage);
        await applyOnlineMatchState(matchId, guestPage, buildSharedDuelState);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, guestPage) as DtState;
            const root = (state.G ?? state) as DtState;
            return {
                phase: root.sys?.phase ?? null,
                activePlayerId: root.core?.activePlayerId ?? null,
                defenderId: root.core?.pendingAttack?.defenderId ?? null,
                defenseAbilityId: root.core?.pendingAttack?.defenseAbilityId ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'defensiveRoll',
            activePlayerId: '1',
            defenderId: '1',
            defenseAbilityId: 'duel',
        });

        await dismissStartDefenseShowcaseIfPresent(guestPage);
        await dispatchHarnessCommand(guestPage, 'ADVANCE_PHASE', '1');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, guestPage) as DtState;
            const root = (state.G ?? state) as DtState;
            return {
                phase: root.sys?.phase ?? null,
                interactionKind: root.sys?.interaction?.current?.kind ?? null,
                interactionPlayerId: root.sys?.interaction?.current?.playerId ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'defensiveRoll',
            interactionKind: 'compare-roll-choice',
            interactionPlayerId: '1',
        });

        await expect(guestPage.getByTestId('compare-roll-overlay')).toBeVisible({ timeout: 15000 });
        await expect(guestPage.getByRole('button', { name: '抵挡 1/2 进攻伤害' })).toBeVisible({ timeout: 5000 });
        await expect(hostPage.getByTestId('compare-roll-overlay')).toBeVisible({ timeout: 15000 });
        await expect(hostPage.getByTestId('compare-roll-waiting')).toBeVisible({ timeout: 5000 });
        await expect(hostPage.locator('[data-testid="compare-roll-overlay"] button')).toHaveCount(0);

        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'host-opponent-sees-duel-compare-roll'),
            fullPage: false,
        });
        await guestPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'guest-gunslinger-sees-duel-compare-roll'),
            fullPage: false,
        });

        await guestPage.getByRole('button', { name: '抵挡 1/2 进攻伤害' }).click();
        await expect(guestPage.getByTestId('compare-roll-overlay')).toHaveCount(0, { timeout: 10000 });
        await expect(hostPage.getByTestId('compare-roll-overlay')).toHaveCount(0, { timeout: 10000 });

        await hostPage.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'host-opponent-duel-overlay-closed-after-gunslinger-choice'),
            fullPage: false,
        });

        const actionLogPanel = await openFabPanel(hostPage, 'action-log', 'chat');
        await expect.poll(async () => {
            const rows = await hostPage.locator('[data-testid="hud-action-log-row"]').allInnerTexts();
            return rows.some((text) =>
                /(对掷结果|Roll-off result)/.test(text)
                && /(赢得了对决|won the duel)/i.test(text),
            );
        }, { timeout: 10000 }).toBe(true);
        await actionLogPanel.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'host-opponent-action-log-shows-duel-result'),
        });
    } finally {
        await guestContext.close().catch(() => {});
        await hostContext.close().catch(() => {});
    }
});
