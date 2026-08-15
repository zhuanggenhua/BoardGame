import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { injectSkipImageGate, setChineseLocale, waitForTestHarness } from '../helpers/common';
import { setupDTOnlineMatch } from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import type { RandomFn } from '../../src/engine/types';
import { initHeroState } from '../../src/games/dicethrone/domain/characters';
import { getPlayerDieFace } from '../../src/games/dicethrone/domain/rules';

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
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.command?.isRegistered?.() === true,
        { timeout: 15000 },
    );
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        await (window as any).__BG_TEST_HARNESS__!.command.dispatch({
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

const primeDuelCompareDiceValues = async (page: Page) => {
    await page.waitForFunction(
        () => Boolean((window as any).__BG_TEST_HARNESS__?.dice?.setValues),
        { timeout: 5000 },
    );
    await page.evaluate(() => {
        (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.([6, 1, 1, 1, 1, 1, 1, 1]);
    });
};

const withDuelDieValue = (
    state: DtState,
    die: DtState,
    ownerId: string,
    value: number,
): DtState => {
    const characterId = state.players?.[ownerId]?.characterId;
    const definitionId = typeof characterId === 'string' && characterId !== 'unselected'
        ? `${characterId}-dice`
        : die.definitionId;
    const face = getPlayerDieFace(state as never, ownerId as never, value) ?? die.symbol ?? null;
    return {
        ...die,
        ownerId,
        definitionId,
        value,
        symbol: face,
        symbols: face ? [face] : [],
    };
};

const stabilizeDuelDefenseRollValues = async (matchId: string, page: Page) => {
    await applyOnlineMatchState(matchId, page, (state) => {
        const root = (state.G ?? state) as DtState;
        const next = structuredClone(root);
        const core = (next.core ?? {}) as DtState;
        const pendingAttack = (core.pendingAttack ?? {}) as DtState;
        const defenderId = String(pendingAttack.defenderId ?? '1');
        const attackerId = String(pendingAttack.attackerId ?? '0');
        const rollDiceCount = typeof core.rollDiceCount === 'number' ? core.rollDiceCount : 1;
        const currentRollContext = (core.currentRollContext ?? {}) as DtState;
        const currentContextDice = Array.isArray(currentRollContext.dice) ? currentRollContext.dice : [];
        const defenderDie = withDuelDieValue(next.core, currentContextDice[0] ?? {}, defenderId, 6);
        const attackerDie = withDuelDieValue(
            next.core,
            currentContextDice.find((die: DtState) => die?.ownerId === attackerId && die?.id !== defenderDie.id) ?? currentContextDice[1] ?? { id: 1 },
            attackerId,
            1,
        );

        next.core = {
            ...core,
            dice: Array.isArray(core.dice)
                ? core.dice.map((die: DtState, index: number) => (
                    index < rollDiceCount ? withDuelDieValue(next.core, die, defenderId, 6) : die
                ))
                : core.dice,
            currentRollContext: {
                ...currentRollContext,
                dice: [defenderDie, attackerDie],
            },
        };
        return next;
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
    const preparedDice = [
        { id: 0, definitionId: 'gunslinger-dice', value: 1, symbol: 'bullet', symbols: ['bullet'], isKept: false, ownerId: '1' },
        { id: 1, definitionId: 'gunslinger-dice', value: 2, symbol: 'dash', symbols: ['dash'], isKept: false, ownerId: '1' },
        { id: 2, definitionId: 'gunslinger-dice', value: 3, symbol: 'bullseye', symbols: ['bullseye'], isKept: false, ownerId: '1' },
        { id: 3, definitionId: 'gunslinger-dice', value: 4, symbol: 'bullet', symbols: ['bullet'], isKept: false, ownerId: '1' },
        { id: 4, definitionId: 'gunslinger-dice', value: 5, symbol: 'dash', symbols: ['dash'], isKept: false, ownerId: '1' },
    ];

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
        rollCount: 0,
        rollLimit: 1,
        rollDiceCount: 1,
        rollConfirmed: false,
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
        currentRollContext: null,
        pendingDamage: null,
        pendingAttack: {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            damage: 5,
            bonusDamage: 0,
            sourceAbilityId: 'harmony',
            defenseAbilityId: 'duel',
            duelAttackerDieValue: 1,
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
                rollCount: root.core?.rollCount ?? null,
                rollConfirmed: root.core?.rollConfirmed ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'defensiveRoll',
            activePlayerId: '1',
            defenderId: '1',
            defenseAbilityId: 'duel',
            rollCount: 0,
            rollConfirmed: false,
        });

        await dismissStartDefenseShowcaseIfPresent(guestPage);
        await primeFixedRandomQueue(guestPage);
        await primeDuelCompareDiceValues(guestPage);
        await dispatchHarnessCommand(guestPage, 'ROLL_DICE', '1');
        await stabilizeDuelDefenseRollValues(matchId, guestPage);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, guestPage) as DtState;
            const root = (state.G ?? state) as DtState;
            return {
                phase: root.sys?.phase ?? null,
                rollCount: root.core?.rollCount ?? null,
                rollConfirmed: root.core?.rollConfirmed ?? null,
                rollContextKind: root.core?.currentRollContext?.kind ?? null,
                dice: root.core?.currentRollContext?.dice?.map((die: DtState) => die?.value ?? null) ?? [],
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'defensiveRoll',
            rollCount: 1,
            rollConfirmed: false,
            rollContextKind: 'defensive',
            dice: [6, 1],
        });

        await dispatchHarnessCommand(guestPage, 'CONFIRM_ROLL', '1');
        await expect.poll(async () => {
            const state = await getMatchState(matchId, guestPage) as DtState;
            const root = (state.G ?? state) as DtState;
            return {
                phase: root.sys?.phase ?? null,
                rollConfirmed: root.core?.rollConfirmed ?? null,
                rollContextStatus: root.core?.currentRollContext?.status ?? null,
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'defensiveRoll',
            rollConfirmed: true,
            rollContextStatus: 'settling',
        });

        await dispatchHarnessCommand(guestPage, 'ADVANCE_PHASE', '1');
        await expect.poll(async () => {
            const state = await getMatchState(matchId, guestPage) as DtState;
            const root = (state.G ?? state) as DtState;
            return {
                phase: root.sys?.phase ?? null,
                rollContextKind: root.core?.currentRollContext?.kind ?? null,
                rollContextOwner: root.core?.currentRollContext?.ownerPlayerId ?? null,
                dice: root.core?.currentRollContext?.dice?.map((die: DtState) => die?.value ?? null) ?? [],
            };
        }, { timeout: 15000 }).toMatchObject({
            phase: 'defensiveRoll',
            rollContextKind: 'compare',
            rollContextOwner: '1',
            dice: [6, 1],
        });

        await dispatchHarnessCommand(guestPage, 'CONFIRM_COMPARE_ROLL', '1');

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
        await expect.poll(async () => {
            const state = await getMatchState(matchId, guestPage) as DtState;
            const root = (state.G ?? state) as DtState;
            const current = root.sys?.interaction?.current;
            return {
                phase: root.sys?.phase ?? null,
                interactionKind: current?.kind ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'defensiveRoll',
            interactionKind: null,
        });
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
        const duelLogRow = hostPage.locator('[data-testid="hud-action-log-row"]').filter({
            hasText: /(对掷结果|Roll-off result)/,
        }).filter({
            hasText: /(赢得了对决|won the duel)/i,
        }).first();
        const duelDiceIcons = duelLogRow.locator('[data-testid="action-log-die-icon"]');
        await expect(duelDiceIcons).toHaveCount(2, { timeout: 5000 });
        await expect.poll(async () => duelDiceIcons.evaluateAll((icons) => icons.map((icon) => {
            const style = window.getComputedStyle(icon);
            return {
                backgroundImage: style.backgroundImage,
                backgroundSize: style.backgroundSize,
                backgroundPosition: style.backgroundPosition,
                width: (icon as HTMLElement).offsetWidth,
                height: (icon as HTMLElement).offsetHeight,
            };
        })), { timeout: 5000 }).toEqual([
            expect.objectContaining({
                backgroundImage: expect.stringContaining('dicethrone/images/gunslinger/compressed/dice.webp'),
                backgroundSize: '300% 300%',
                backgroundPosition: '100% 100%',
                width: 16,
                height: 16,
            }),
            expect.objectContaining({
                backgroundImage: expect.stringContaining('dicethrone/images/monk/compressed/dice.webp'),
                backgroundSize: '300% 300%',
                backgroundPosition: '0% 100%',
                width: 16,
                height: 16,
            }),
        ]);
        await expect.poll(async () => duelDiceIcons.evaluateAll(async (icons) => {
            const loadChecks = icons.map((icon) => new Promise<boolean>((resolve) => {
                const style = window.getComputedStyle(icon);
                const url = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
                if (!url) {
                    resolve(false);
                    return;
                }
                const image = new Image();
                image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
                image.onerror = () => resolve(false);
                image.src = url;
            }));
            return Promise.all(loadChecks);
        }), { timeout: 5000 }).toEqual([true, true]);
        await actionLogPanel.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'host-opponent-action-log-shows-duel-result'),
        });
    } finally {
        await guestContext.close().catch(() => {});
        await hostContext.close().catch(() => {});
    }
});
