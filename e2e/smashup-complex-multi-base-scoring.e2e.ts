import { test, expect } from './framework';
import type { GameTestContext } from './framework';
import type { Page } from '@playwright/test';
import { attachPageDiagnostics } from './helpers/common';

type SceneConfig = Parameters<GameTestContext['setupScene']>[0];

async function openSmashupScene(page: Page, game: GameTestContext, scene: SceneConfig): Promise<void> {
    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        { timeout: 30000 },
    );
    await game.setupScene(scene);
}

function escapeRegExp(source: string): string {
    return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function clickInteractionOption(page: Page, optionId: string, label?: string): Promise<void> {
    try {
        await page.locator(`[data-option-id="${optionId}"]`).first().click({ force: true, timeout: 5000 });
        await page.waitForTimeout(200);
        return;
    } catch {
        // fallback to role based click below
    }
    if (label) {
        try {
            await page.getByRole('button', { name: new RegExp(escapeRegExp(label), 'i') }).first().click({ force: true, timeout: 5000 });
            await page.waitForTimeout(200);
            return;
        } catch {
            // fallback to generic skip button below
        }
    }
    if (optionId === 'skip') {
        await page.getByRole('button', { name: /^(跳过|Skip)(?:\s*\(\d+\))?$/i }).first().click({ force: true, timeout: 5000 });
        await page.waitForTimeout(200);
        return;
    }
    throw new Error(`交互选项不可点击: ${optionId}`);
}

async function advancePhaseFromUI(page: Page, game: GameTestContext): Promise<void> {
    const selectors = [
        page.locator('[data-action="advance-phase"]').first(),
        page.getByRole('button', { name: /^(结束回合|Finish Turn|End|FINISH)/i }).first(),
        page.locator('button:has-text("FINISH")').first(),
        page.locator('button:has-text("结束")').first(),
    ];
    for (const locator of selectors) {
        if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
            await locator.click({ force: true, timeout: 5000 });
            await page.waitForTimeout(300);
            return;
        }
    }
    await game.advancePhase();
}

async function openFourPlayerTestGame(game: GameTestContext): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await game.openTestGame('smashup', { numPlayers: 4, skipInitialization: true });
            return;
        } catch (error) {
            lastError = error;
            if (attempt === 3) throw error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('openFourPlayerTestGame failed');
}

test.describe('大杀四方 - afterScoring 响应窗口', () => {
    test('基地计分后 afterScoring 响应窗口正常打开', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        const diagnostics = attachPageDiagnostics(page);
        page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.text().includes('[LocalGame]')) {
                console.log(`[浏览器控制台] ${msg.type()}: ${msg.text()}`);
            }
        });

        try {
            await openSmashupScene(page, game, {
                gameId: 'smashup',
                player0: {
                    hand: [
                        { uid: 'card-after-1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                    ],
                    field: [
                        { uid: 'queen-1', defId: 'giant_ant_killer_queen', baseIndex: 0, owner: '0', controller: '0' },
                        { uid: 'master-1', defId: 'ninja_master', baseIndex: 0, owner: '0', controller: '0' },
                    ],
                    factions: ['giant_ants', 'ninjas'],
                },
                player1: {
                    hand: [],
                    field: [
                        { uid: 'assassin-1', defId: 'ninja_tiger_assassin', baseIndex: 0, owner: '1', controller: '1' },
                    ],
                    factions: ['ninjas', 'wizards'],
                },
                bases: [
                    { defId: 'base_the_jungle', minions: [] },
                ],
                currentPlayer: '0',
                phase: 'playCards',
            });

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return state?.sys?.phase === 'playCards'
                        && state?.core?.factionSelection === undefined
                        && state?.core?.players?.['0']?.hand?.length === 1
                        && state?.core?.bases?.[0]?.minions?.length === 3;
                },
                { timeout: 30000 },
            );

            await game.screenshot('01-scene-ready', testInfo);

            await advancePhaseFromUI(page, game);
            await page.waitForTimeout(1000);

            const stateAfterAdvance = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase,
                    windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                    interactionId: state?.sys?.interaction?.current?.id ?? null,
                    interactionSource: state?.sys?.interaction?.current?.sourceId ?? null,
                    p0Hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.defId) ?? [],
                    scoringEligibleBaseIndices: state?.core?.scoringEligibleBaseIndices ?? null,
                };
            });
            console.log('[TEST] 推进后状态:', stateAfterAdvance);

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    const windowType = state?.sys?.responseWindow?.current?.windowType;
                    return state?.sys?.phase === 'scoreBases'
                        && (windowType === 'meFirst' || windowType === 'afterScoring');
                },
                { timeout: 15000, polling: 100 },
            );

            const responseWindowState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase,
                    windowType: state?.sys?.responseWindow?.current?.windowType,
                    currentResponder: state?.sys?.responseWindow?.current?.responderQueue?.[
                        state?.sys?.responseWindow?.current?.currentResponderIndex ?? 0
                    ],
                };
            });

            expect(responseWindowState.phase).toBe('scoreBases');
            expect(['meFirst', 'afterScoring']).toContain(responseWindowState.windowType);

            await expect(page.getByTestId('me-first-overlay')).toBeVisible();
            await expect(page.getByTestId('me-first-pass-button')).toBeVisible();

            if (responseWindowState.windowType === 'meFirst') {
                await game.screenshot('02-me-first-open', testInfo);
                await page.getByTestId('me-first-pass-button').click();
                await page.waitForTimeout(500);
                await game.screenshot('03-p0-passed-me-first', testInfo);

                await page.getByTestId('me-first-pass-button').click();

                await page.waitForFunction(
                    () => {
                        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                        return state?.sys?.responseWindow?.current?.windowType === 'afterScoring';
                    },
                    { timeout: 15000 },
                );
            }

            const afterScoringState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase,
                    windowType: state?.sys?.responseWindow?.current?.windowType,
                    currentResponder: state?.sys?.responseWindow?.current?.responderQueue?.[
                        state?.sys?.responseWindow?.current?.currentResponderIndex ?? 0
                    ],
                };
            });

            expect(afterScoringState.phase).toBe('scoreBases');
            expect(afterScoringState.windowType).toBe('afterScoring');

            await expect(page.getByTestId('me-first-overlay')).toBeVisible();
            await expect(page.getByTestId('me-first-pass-button')).toBeVisible();
            await game.screenshot('04-after-scoring-open', testInfo);

            await page.getByTestId('me-first-pass-button').click();
            await page.waitForTimeout(500);
            await game.screenshot('05-p0-passed-after-scoring', testInfo);

            const afterFirstAfterScoringPass = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase,
                    windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                    currentResponder: state?.sys?.responseWindow?.current?.responderQueue?.[
                        state?.sys?.responseWindow?.current?.currentResponderIndex ?? 0
                    ] ?? null,
                };
            });
            console.log('[TEST] afterScoring 首次 PASS 后状态:', afterFirstAfterScoringPass);

            if (afterFirstAfterScoringPass.windowType === 'afterScoring') {
                await expect(page.getByTestId('me-first-pass-button')).toBeVisible();
                await page.getByTestId('me-first-pass-button').click();
            }

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return !state?.sys?.responseWindow?.current
                        && state?.sys?.phase === 'playCards'
                        && state?.core?.currentPlayerIndex === 1;
                },
                { timeout: 15000 },
            );

            const finalState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase,
                    currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
                    responseWindowId: state?.sys?.responseWindow?.current?.id ?? null,
                    p0Vp: state?.core?.players?.['0']?.vp ?? 0,
                    p1Vp: state?.core?.players?.['1']?.vp ?? 0,
                };
            });

            expect(finalState.responseWindowId).toBeNull();
            expect(finalState.phase).toBe('playCards');
            expect(finalState.currentPlayerIndex).toBe(1);
            expect(finalState.p0Vp).toBeGreaterThan(0);

            await game.screenshot('06-final-state', testInfo);
        } catch (error) {
            if (diagnostics.errors.length > 0) {
                console.log('[页面诊断]', diagnostics.errors);
            }
            throw error;
        }
    });

    test('4p afterScoring chain handles 6 interactions without duplicate score', async ({ page, game }, testInfo) => {
        test.setTimeout(240000);

        const diagnostics = attachPageDiagnostics(page);
        page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.text().includes('[LocalGame]')) {
                console.log(`[browser-console] ${msg.type()}: ${msg.text()}`);
            }
        });

        const createPlayer = (id: string, factions: [string, string]) => ({
            id,
            vp: 0,
            hand: [],
            deck: [],
            discard: [],
            factions,
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayedPerBase: {},
            sameNameMinionDefId: null,
        });

        const createMinion = (uid: string, defId: string, owner: string, basePower: number) => ({
            uid,
            defId,
            owner,
            controller: owner,
            basePower,
            powerModifier: 0,
            powerCounters: 0,
            tempPowerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        });

        try {
            await openFourPlayerTestGame(game);
            await game.setupScene({
                gameId: 'smashup',
                phase: 'playCards',
                currentPlayer: '0',
                extra: {
                    core: {
                        turnOrder: ['0', '1', '2', '3'],
                        currentPlayerIndex: 0,
                        turnNumber: 9,
                        players: {
                            '0': createPlayer('0', ['pirates', 'ninjas']),
                            '1': createPlayer('1', ['aliens', 'wizards']),
                            '2': createPlayer('2', ['robots', 'ghosts']),
                            '3': createPlayer('3', ['dinosaurs', 'zombies']),
                        },
                        bases: [
                            {
                                defId: 'base_tortuga',
                                minions: [
                                    createMinion('mate-p0', 'pirate_first_mate', '0', 2),
                                    createMinion('mate-p1', 'pirate_first_mate', '0', 2),
                                    createMinion('mate-p2', 'pirate_first_mate', '0', 2),
                                    createMinion('mate-p3', 'pirate_first_mate', '0', 2),
                                    createMinion('pow-p0', 'test_minion', '0', 10),
                                    createMinion('pow-p1', 'test_minion', '1', 19),
                                    createMinion('pow-p2', 'test_minion', '2', 8),
                                    createMinion('pow-p3', 'test_minion', '3', 7),
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_the_jungle',
                                minions: [
                                    createMinion('king-0', 'pirate_king', '0', 5),
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_secret_garden',
                                minions: [
                                    createMinion('reserve-p1', 'test_minion', '1', 2),
                                ],
                                ongoingActions: [],
                            },
                        ],
                        baseDeck: ['base_central_brain'],
                        factionSelection: undefined,
                        scoringEligibleBases: undefined,
                    },
                },
            });

            await expect.poll(async () => {
                const text = await page.evaluate(() => document.body?.innerText ?? '');
                return text.includes('Loading match resources...');
            }, { timeout: 20000 }).toBe(false);

            await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible({ timeout: 15000 });

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return state?.sys?.phase === 'playCards'
                        && state?.core?.turnOrder?.length === 4
                        && state?.core?.bases?.[0]?.minions?.length === 8;
                },
                { timeout: 30000 },
            );

            await game.screenshot('4p-01-initial', testInfo);

            await advancePhaseFromUI(page, game);
            await game.waitForInteraction('pirate_king_move', 20000);

            const resolvedSources: string[] = [];

            for (let step = 0; step < 10; step += 1) {
                const currentInteraction = await page.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    const current = state?.sys?.interaction?.current;
                    if (!current) return null;
                    const options = (current.data?.options ?? []).map((option: any) => ({
                        id: option.id,
                        label: option.label,
                        value: option.value,
                    }));
                    return {
                        sourceId: current.data?.sourceId ?? '',
                        options,
                    };
                });

                if (!currentInteraction) break;
                resolvedSources.push(currentInteraction.sourceId);

                if (currentInteraction.sourceId === 'pirate_king_move') {
                    const keepOnBase = currentInteraction.options.find((option: any) => option.value?.move === false || option.id === 'no');
                    expect(keepOnBase).toBeTruthy();
                    await clickInteractionOption(page, keepOnBase!.id, keepOnBase!.label);
                    continue;
                }

                if (currentInteraction.sourceId === 'base_tortuga' || currentInteraction.sourceId === 'pirate_first_mate_choose_base') {
                    const skip = currentInteraction.options.find((option: any) => option.id === 'skip' || option.value?.skip === true);
                    expect(skip).toBeTruthy();
                    await clickInteractionOption(page, skip!.id, skip!.label);
                    continue;
                }

                throw new Error(`unexpected interaction sourceId: ${currentInteraction.sourceId}`);
            }

            expect(resolvedSources.filter((id) => id === 'pirate_king_move')).toHaveLength(1);
            expect(resolvedSources.filter((id) => id === 'base_tortuga')).toHaveLength(1);
            expect(resolvedSources.filter((id) => id === 'pirate_first_mate_choose_base')).toHaveLength(4);
            expect(resolvedSources).toHaveLength(6);

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    if (!state) return false;
                    return !state.sys?.interaction?.current
                        && !state.sys?.responseWindow?.current
                        && state.sys?.phase === 'playCards'
                        && state.core?.currentPlayerIndex === 1;
                },
                { timeout: 20000 },
            );

            const finalState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const vpByPlayer = Object.values(state?.core?.players ?? {}).map((player: any) => player?.vp ?? 0);
                const totalVp = vpByPlayer.reduce((sum: number, value: number) => sum + value, 0);
                return {
                    phase: state?.sys?.phase,
                    currentPlayerIndex: state?.core?.currentPlayerIndex,
                    vpByPlayer,
                    totalVp,
                };
            });

            expect(finalState.phase).toBe('playCards');
            expect(finalState.currentPlayerIndex).toBe(1);
            expect(finalState.totalVp).toBe(9);
            expect([...finalState.vpByPlayer].sort((a, b) => a - b)).toEqual([0, 2, 3, 4]);

            await game.screenshot('4p-02-final', testInfo);
        } catch (error) {
            if (diagnostics.errors.length > 0) {
                console.log('[page-diagnostics]', diagnostics.errors);
            }
            throw error;
        }
    });
});
