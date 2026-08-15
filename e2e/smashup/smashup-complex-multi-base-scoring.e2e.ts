import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import type { Page } from '@playwright/test';
import { attachPageDiagnostics } from '../helpers/common';

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
            try {
                await page.locator('button').filter({ hasText: label }).first().click({ force: true, timeout: 5000 });
                await page.waitForTimeout(200);
                return;
            } catch {
                // fallback to generic pass/skip button below
            }
        }
    }
    if (optionId === 'skip' || optionId === 'pass') {
        await page.getByRole('button', { name: /^(跳过|Skip|Pass|过|计过|让过)(?:\s*\(\d+\))?$/i }).first().click({ force: true, timeout: 5000 });
        await page.waitForTimeout(200);
        return;
    }
    if (optionId.startsWith('trigger:')) {
        await page.locator('button')
            .filter({ hasNotText: /^(跳过|Skip|Pass|过|计过)$/i })
            .first()
            .click({ force: true, timeout: 5000 });
        await page.waitForTimeout(200);
        return;
    }
    throw new Error(`交互选项不可点击: ${optionId}`);
}

type CurrentInteraction = {
    sourceId: string;
    options: Array<{ id: string; label?: string; value?: any }>;
};

function isPassOption(option: { id: string; value?: any }): boolean {
    return option.id === 'skip'
        || option.id === 'pass'
        || option.value?.kind === 'pass'
        || option.value?.skip === true;
}

async function readCurrentInteraction(page: Page): Promise<null | CurrentInteraction> {
    return page.evaluate(() => {
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
}

async function waitForInteractionSourceIn(page: Page, sourceIds: string[], timeout = 20000): Promise<string> {
    await page.waitForFunction(
        (expectedSourceIds: string[]) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const sourceId = state?.sys?.interaction?.current?.data?.sourceId ?? null;
            return typeof sourceId === 'string' && expectedSourceIds.includes(sourceId);
        },
        sourceIds,
        { timeout, polling: 100 },
    );

    return page.evaluate(() =>
        (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId ?? '',
    );
}

function findNonPassOptionMatching(
    interaction: CurrentInteraction | null,
    matcher: (option: CurrentInteraction['options'][number]) => boolean,
) {
    return interaction?.options.find((option) => !isPassOption(option) && matcher(option));
}

async function chooseReactionOptionMatching(
    page: Page,
    matcher: (option: CurrentInteraction['options'][number]) => boolean,
    description: string,
): Promise<void> {
    const currentInteraction = await readCurrentInteraction(page);
    expect(currentInteraction?.sourceId, `${description}: 当前交互必须是统一反应选择`).toBe('smashup_reaction_choose');
    const option = findNonPassOptionMatching(currentInteraction, matcher);
    expect(option, `${description}: 未找到匹配的反应选项`).toBeTruthy();
    await respondCurrentInteractionByOptionId(page, option!.id);
}

async function passOpenScoringResponsesUntilClosed(page: Page, maxSteps = 8): Promise<void> {
    for (let step = 0; step < maxSteps; step += 1) {
        const currentInteraction = await readCurrentInteraction(page);
        if (!currentInteraction) {
            return;
        }
        expect(currentInteraction.sourceId, '计分响应收口期间只能停在统一反应选择').toBe('smashup_reaction_choose');
        await passCurrentSmashupResponse(page);
    }
    throw new Error(`计分响应窗口在 ${maxSteps} 次让过后仍未收口`);
}

async function passCurrentSmashupResponse(page: Page): Promise<void> {
    const currentInteraction = await readCurrentInteraction(page);
    if (currentInteraction) {
        const skipOption = currentInteraction.options.find(isPassOption);
        if (skipOption) {
            await respondCurrentInteractionByOptionId(page, skipOption.id);
            return;
        }
    }

    const overlayPassButton = page.getByTestId('me-first-pass-button');
    if (await overlayPassButton.isVisible().catch(() => false)) {
        await overlayPassButton.click();
        await page.waitForTimeout(200);
        return;
    }

    throw new Error('当前没有可用于 PASS 的 SmashUp 响应交互');
}

async function respondCurrentInteractionByOptionId(page: Page, optionId: string): Promise<void> {
    const currentPlayerId = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.interaction?.current?.playerId ?? null;
    });
    if (!currentPlayerId) {
        throw new Error(`当前没有可响应的交互，无法提交选项: ${optionId}`);
    }

    await page.evaluate(async ({ playerId, nextOptionId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        await harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId,
            payload: { optionId: nextOptionId },
        });
    }, {
        playerId: currentPlayerId,
        nextOptionId: optionId,
    });
    await page.waitForTimeout(200);
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
                    interactionSource: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                    p0Hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.defId) ?? [],
                    scoringEligibleBaseIndices: state?.core?.scoringEligibleBaseIndices ?? null,
                };
            });
            console.log('[TEST] 推进后状态:', stateAfterAdvance);

            await waitForInteractionSourceIn(page, ['smashup_reaction_choose'], 15000);

            const reactionState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const current = state?.sys?.interaction?.current;
                return {
                    phase: state?.sys?.phase,
                    sourceId: current?.data?.sourceId ?? null,
                    playerId: current?.playerId ?? null,
                    optionIds: (current?.data?.options ?? []).map((option: any) => option.id),
                    optionLabels: (current?.data?.options ?? []).map((option: any) => option.label),
                };
            });

            expect(reactionState.phase).toBe('scoreBases');
            expect(reactionState.sourceId).toBe('smashup_reaction_choose');

            const overlayVisible = await page.getByTestId('me-first-overlay').isVisible().catch(() => false);
            const reactionPrompt = await readCurrentInteraction(page);
            if (!overlayVisible) {
                expect(reactionPrompt?.sourceId).toBe('smashup_reaction_choose');
            }
            await expect(
                page.getByRole('button', { name: /我们乃最强|we are the champions/i }).first(),
                'afterScoring 应显示玩家可见的“我们乃最强”响应按钮',
            ).toBeVisible({ timeout: 5000 });
            await game.screenshot('02-after-scoring-reaction-open', testInfo);

            await passCurrentSmashupResponse(page);
            await game.screenshot('03-p0-passed-after-scoring', testInfo);

            const afterFirstAfterScoringPass = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase,
                    interactionSource: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                    interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                };
            });
            console.log('[TEST] afterScoring 首次 PASS 后状态:', afterFirstAfterScoringPass);

            await passOpenScoringResponsesUntilClosed(page);

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return !state?.sys?.interaction?.current
                        && !state?.sys?.responseWindow?.current
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
                    interactionId: state?.sys?.interaction?.current?.id ?? null,
                    p0Vp: state?.core?.players?.['0']?.vp ?? 0,
                    p1Vp: state?.core?.players?.['1']?.vp ?? 0,
                };
            });

            expect(finalState.responseWindowId).toBeNull();
            expect(finalState.interactionId).toBeNull();
            expect(finalState.phase).toBe('playCards');
            expect(finalState.currentPlayerIndex).toBe(1);
            expect(finalState.p0Vp).toBeGreaterThan(0);

            await game.screenshot('04-final-state', testInfo);
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

            for (let step = 0; step < 40; step += 1) {
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
                    await respondCurrentInteractionByOptionId(page, keepOnBase!.id);
                    continue;
                }

                if (currentInteraction.sourceId === 'base_tortuga' || currentInteraction.sourceId === 'pirate_first_mate_choose_base') {
                    const skip = currentInteraction.options.find((option: any) => option.id === 'skip' || option.value?.skip === true);
                    expect(skip).toBeTruthy();
                    await respondCurrentInteractionByOptionId(page, skip!.id);
                    continue;
                }

                if (currentInteraction.sourceId === 'smashup_reaction_choose') {
                    const nextTrigger = currentInteraction.options.find((option: any) => {
                        const label = String(option.label ?? '');
                        return option.id !== 'skip' && /托尔图加|base_tortuga/i.test(label);
                    })
                        ?? currentInteraction.options.find((option: any) => {
                            const label = String(option.label ?? '');
                            return option.id !== 'skip' && /大副|first mate/i.test(label);
                        })
                        ?? currentInteraction.options.find((option: any) => option.id !== 'skip' && option.value?.kind === 'trigger')
                        ?? currentInteraction.options.find((option: any) => option.id !== 'skip');
                    expect(nextTrigger).toBeTruthy();
                    await respondCurrentInteractionByOptionId(page, nextTrigger!.id);
                    continue;
                }

                throw new Error(`unexpected interaction sourceId: ${currentInteraction.sourceId}`);
            }

            expect(resolvedSources.filter((id) => id === 'pirate_king_move')).toHaveLength(1);
            expect(resolvedSources.length).toBeGreaterThanOrEqual(6);
            expect(resolvedSources).toContain('base_tortuga');
            expect(resolvedSources).toContain('pirate_first_mate_choose_base');
            expect(resolvedSources.filter((id) => id === 'smashup_reaction_choose').length).toBeGreaterThanOrEqual(1);

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

    test('托尔图加 afterScoring 选中随从后会移动到替换基地', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        const diagnostics = attachPageDiagnostics(page);
        page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.text().includes('[LocalGame]')) {
                console.log(`[browser-console] ${msg.type()}: ${msg.text()}`);
            }
        });

        try {
            await openSmashupScene(page, game, {
                gameId: 'smashup',
                phase: 'playCards',
                currentPlayer: '0',
                player0: {
                    hand: [],
                    field: [],
                    factions: ['robots', 'wizards'],
                },
                player1: {
                    hand: [],
                    field: [],
                    factions: ['dinosaurs', 'ninjas'],
                },
                bases: [
                    { defId: 'base_tortuga', minions: [] },
                    { defId: 'base_secret_garden', minions: [] },
                    { defId: 'base_great_library', minions: [] },
                ],
                extra: {
                    core: {
                        baseDeck: ['base_the_jungle'],
                        bases: [
                            {
                                defId: 'base_tortuga',
                                minions: [
                                    {
                                        uid: 'tortuga-winner-rex',
                                        defId: 'dino_king_rex',
                                        owner: '1',
                                        controller: '1',
                                        basePower: 7,
                                        powerModifier: 0,
                                        powerCounters: 0,
                                        tempPowerModifier: 0,
                                        talentUsed: false,
                                        attachedActions: [],
                                    },
                                    {
                                        uid: 'tortuga-winner-laser',
                                        defId: 'dino_laser_triceratops',
                                        owner: '1',
                                        controller: '1',
                                        basePower: 4,
                                        powerModifier: 0,
                                        powerCounters: 0,
                                        tempPowerModifier: 0,
                                        talentUsed: false,
                                        attachedActions: [],
                                    },
                                    {
                                        uid: 'tortuga-winner-assassin',
                                        defId: 'ninja_tiger_assassin',
                                        owner: '1',
                                        controller: '1',
                                        basePower: 4,
                                        powerModifier: 0,
                                        powerCounters: 0,
                                        tempPowerModifier: 0,
                                        talentUsed: false,
                                        attachedActions: [],
                                    },
                                    {
                                        uid: 'tortuga-winner-shinobi',
                                        defId: 'ninja_shinobi',
                                        owner: '1',
                                        controller: '1',
                                        basePower: 3,
                                        powerModifier: 0,
                                        powerCounters: 0,
                                        tempPowerModifier: 0,
                                        talentUsed: false,
                                        attachedActions: [],
                                    },
                                    {
                                        uid: 'tortuga-runnerup-archmage',
                                        defId: 'wizard_archmage',
                                        owner: '0',
                                        controller: '0',
                                        basePower: 4,
                                        powerModifier: 0,
                                        powerCounters: 0,
                                        tempPowerModifier: 0,
                                        talentUsed: false,
                                        attachedActions: [],
                                    },
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_secret_garden',
                                minions: [
                                    {
                                        uid: 'runner-up-traveler',
                                        defId: 'robot_hoverbot',
                                        owner: '0',
                                        controller: '0',
                                        basePower: 3,
                                        powerModifier: 0,
                                        powerCounters: 0,
                                        tempPowerModifier: 0,
                                        talentUsed: false,
                                        attachedActions: [],
                                    },
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_great_library',
                                minions: [],
                                ongoingActions: [],
                            },
                        ],
                    },
                },
            });

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return state?.sys?.phase === 'playCards'
                        && state?.core?.factionSelection === undefined
                        && state?.core?.bases?.[0]?.defId === 'base_tortuga'
                        && state?.core?.bases?.[0]?.minions?.length === 5
                        && state?.core?.bases?.[1]?.minions?.some((minion: any) => minion.uid === 'runner-up-traveler');
                },
                { timeout: 30000 },
            );

            await game.screenshot('tortuga-01-scene-ready', testInfo);

            await advancePhaseFromUI(page, game);

            const firstSourceId = await waitForInteractionSourceIn(page, ['smashup_reaction_choose', 'base_tortuga'], 20000);
            if (firstSourceId === 'smashup_reaction_choose') {
                await chooseReactionOptionMatching(
                    page,
                    (option) => String(option.id).includes('base_tortuga')
                        || /托尔图加|tortuga|base_tortuga/i.test(String(option.label ?? '')),
                    '托尔图加 afterScoring',
                );
            }
            await waitForInteractionSourceIn(page, ['base_tortuga'], 20000);

            const tortugaInteraction = await readCurrentInteraction(page);
            expect(tortugaInteraction?.sourceId).toBe('base_tortuga');
            const moveOption = tortugaInteraction?.options.find((option) => (
                option.value?.minionUid === 'runner-up-traveler'
            ));
            expect(moveOption).toBeTruthy();
            await game.screenshot('tortuga-02-interaction-open', testInfo);
            await respondCurrentInteractionByOptionId(page, moveOption!.id);

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    if (!state) return false;
                    const replacementBase = state.core?.bases?.[0];
                    const sourceBase = state.core?.bases?.[1];
                    return !state.sys?.interaction?.current
                        && !state.sys?.responseWindow?.current
                        && state.sys?.phase === 'playCards'
                        && state.core?.currentPlayerIndex === 1
                        && replacementBase?.defId === 'base_the_jungle'
                        && replacementBase?.minions?.some((minion: any) => minion.uid === 'runner-up-traveler')
                        && !sourceBase?.minions?.some((minion: any) => minion.uid === 'runner-up-traveler');
                },
                { timeout: 20000, polling: 100 },
            );

            const finalState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase,
                    currentPlayerIndex: state?.core?.currentPlayerIndex,
                    responseWindowId: state?.sys?.responseWindow?.current?.id ?? null,
                    interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                    replacementBaseDefId: state?.core?.bases?.[0]?.defId ?? null,
                    replacementBaseMinions: (state?.core?.bases?.[0]?.minions ?? []).map((minion: any) => minion.uid),
                    originalBaseMinions: (state?.core?.bases?.[1]?.minions ?? []).map((minion: any) => minion.uid),
                };
            });

            expect(finalState.phase).toBe('playCards');
            expect(finalState.currentPlayerIndex).toBe(1);
            expect(finalState.responseWindowId).toBeNull();
            expect(finalState.interactionSourceId).toBeNull();
            expect(finalState.replacementBaseDefId).toBe('base_the_jungle');
            expect(finalState.replacementBaseMinions).toContain('runner-up-traveler');
            expect(finalState.originalBaseMinions).not.toContain('runner-up-traveler');

            await game.screenshot('tortuga-03-moved-to-replacement-base', testInfo);
        } catch (error) {
            if (diagnostics.errors.length > 0) {
                console.log('[page-diagnostics]', diagnostics.errors);
            }
            throw error;
        }
    });
});
