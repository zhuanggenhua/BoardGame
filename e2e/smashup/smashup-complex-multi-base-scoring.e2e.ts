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
    id: string;
    playerId: string;
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
            id: current.id ?? '',
            playerId: current.playerId ?? '',
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

async function chooseCurrentInteractionOptionMatching(
    page: Page,
    matcher: (option: CurrentInteraction['options'][number]) => boolean,
    description: string,
): Promise<CurrentInteraction['options'][number]> {
    const currentInteraction = await readCurrentInteraction(page);
    expect(currentInteraction, `${description}: 当前必须存在玩家交互`).toBeTruthy();
    const option = currentInteraction!.options.find(matcher);
    expect(option, `${description}: 未找到匹配的交互选项`).toBeTruthy();
    await respondCurrentInteractionByOptionId(page, option!.id);
    return option!;
}

async function chooseScoringBaseByDefId(page: Page, baseDefId: string): Promise<void> {
    await waitForInteractionSourceIn(page, ['multi_base_scoring'], 20000);
    await chooseCurrentInteractionOptionMatching(
        page,
        (option) => option.value?.baseDefId === baseDefId,
        `选择计分基地 ${baseDefId}`,
    );
}

async function waitForVisibleSmashUpCardArt(page: Page, minLoadedFrames = 1, timeout = 30000): Promise<void> {
    await page.waitForFunction(
        ({ minLoadedFrames: expectedMinLoadedFrames }) => {
            const visible = (element: Element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.visibility !== 'hidden'
                    && style.display !== 'none'
                    && Number(style.opacity || '1') > 0.01
                    && rect.width > 2
                    && rect.height > 2;
            };

            const visibleShimmers = Array.from(document.querySelectorAll('.atlas-shimmer'))
                .filter(visible);
            if (visibleShimmers.length > 0) {
                return false;
            }

            const loadedFrames = Array.from(document.querySelectorAll<HTMLElement>('[data-card-atlas-frame="true"]'))
                .filter(visible)
                .filter((frame) => {
                    const image = frame.querySelector<HTMLImageElement>('img[data-card-atlas-img="true"]');
                    return !!image
                        && image.complete
                        && image.naturalWidth >= 16
                        && image.naturalHeight >= 16;
                });

            return loadedFrames.length >= expectedMinLoadedFrames;
        },
        { minLoadedFrames },
        { timeout, polling: 100 },
    );
}

function assertNoReactNaNWarnings(diagnostics: { errors: string[] }): void {
    const nanWarnings = diagnostics.errors.filter((entry) => /Received NaN/i.test(entry));
    expect(nanWarnings, '真实页面不能把 NaN 渲染到 React DOM；这表示 UI 数值输入仍有非法状态').toEqual([]);
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
    const currentInteraction = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const current = state?.sys?.interaction?.current;
        return current
            ? { id: current.id ?? null, playerId: current.playerId ?? null }
            : null;
    });
    if (!currentInteraction?.playerId) {
        throw new Error(`当前没有可响应的交互，无法提交选项: ${optionId}`);
    }

    await page.evaluate(async ({ interactionId, playerId, nextOptionId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        await harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId,
            payload: { interactionId, optionId: nextOptionId },
        });
    }, {
        interactionId: currentInteraction.id,
        playerId: currentInteraction.playerId,
        nextOptionId: optionId,
    });
    await page.waitForTimeout(200);
}

async function respondInteractionOptionIfStillCurrent(
    page: Page,
    expectedInteraction: Pick<CurrentInteraction, 'id' | 'sourceId'>,
    optionId: string,
): Promise<boolean> {
    const submitted = await page.evaluate(async ({ expectedInteractionId, expectedSourceId, nextOptionId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const current = state?.sys?.interaction?.current;
        if (!current) return false;
        if (current.id !== expectedInteractionId) return false;
        if ((current.data?.sourceId ?? '') !== expectedSourceId) return false;
        if (!current.playerId) return false;

        await harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: current.playerId,
            payload: { interactionId: current.id, optionId: nextOptionId },
        });
        return true;
    }, {
        expectedInteractionId: expectedInteraction.id,
        expectedSourceId: expectedInteraction.sourceId,
        nextOptionId: optionId,
    });

    if (submitted) {
        await page.waitForTimeout(200);
    }
    return submitted;
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
            await locator.click({ force: true, timeout: 5000, noWaitAfter: true });
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

    test('复杂链路里海盗王可发动时应先点本体再高亮计分基地', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        const diagnostics = attachPageDiagnostics(page);
        page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.text().includes('[LocalGame]')) {
                console.log(`[browser-console] ${msg.type()}: ${msg.text()}`);
            }
        });

        const createPlayer = (id: string, factions: [string, string], hand: Array<{ uid: string; defId: string; type: 'action' | 'minion' }> = []) => ({
            id,
            vp: 0,
            hand,
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
            await openSmashupScene(page, game, {
                gameId: 'smashup',
                phase: 'playCards',
                currentPlayer: '0',
                extra: {
                    core: {
                        turnOrder: ['0', '1'],
                        currentPlayerIndex: 0,
                        turnNumber: 7,
                        players: {
                            '0': createPlayer('0', ['pirates', 'ninjas'], [
                                { uid: 'hidden-0', defId: 'ninja_hidden_ninja', type: 'action' },
                                { uid: 'shinobi-hand-0', defId: 'ninja_shinobi', type: 'minion' },
                                { uid: 'acolyte-hand-0', defId: 'ninja_acolyte', type: 'minion' },
                            ]),
                            '1': createPlayer('1', ['aliens', 'wizards']),
                        },
                        bases: [
                            {
                                defId: 'base_tortuga',
                                minions: [
                                    createMinion('mate-0', 'pirate_first_mate', '0', 2),
                                    createMinion('tortuga-p0', 'pirate_buccaneer', '0', 10),
                                    createMinion('tortuga-p1', 'alien_invader', '1', 10),
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_the_jungle',
                                minions: [
                                    createMinion('king-0', 'pirate_king', '0', 5),
                                    createMinion('jungle-p0', 'ninja_master', '0', 7),
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_secret_garden',
                                minions: [
                                    createMinion('reserve-p1', 'wizard_apprentice', '1', 2),
                                ],
                                ongoingActions: [],
                            },
                        ],
                        baseDeck: ['base_central_brain', 'base_cave_of_shinies'],
                        factionSelection: undefined,
                        scoringEligibleBases: undefined,
                    },
                },
            });

            await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible({ timeout: 15000 });
            await waitForVisibleSmashUpCardArt(page, 8);
            await game.screenshot('complex-hand-response-01-existing-scoring-chain-ready', testInfo);

            await advancePhaseFromUI(page, game);
            await chooseScoringBaseByDefId(page, 'base_tortuga');
            await waitForInteractionSourceIn(page, ['pirate_king_move'], 20000);
            const pirateKingInteraction = await readCurrentInteraction(page);
            expect(pirateKingInteraction?.sourceId).toBe('pirate_king_move');
            const scoringBase = page.getByTestId('base-zone-0');
            const nonScoringBase = page.getByTestId('base-zone-1');
            const pirateKingCard = page.locator('[data-minion-uid="king-0"]').first();
            const pirateKingFrame = page.getByTestId('su-minion-frame-king-0');
            expect(
                pirateKingInteraction?.options.some((option) => option.value?.move === true),
                '海盗王移动窗口仍应在合同里携带移动选项',
            ).toBe(true);
            await expect(page.locator('[data-option-id="yes"]')).toHaveCount(0);
            await expect(pirateKingCard).toHaveAttribute('data-highlighted', 'true');
            await expect(pirateKingFrame).toHaveAttribute('data-highlighted', 'true');
            await expect(scoringBase).toHaveAttribute('data-deploy-mode', 'false');
            await expect(scoringBase).toHaveAttribute('data-selectable', 'false');
            await expect(nonScoringBase).toHaveAttribute('data-deploy-mode', 'false');
            await expect(nonScoringBase).toHaveAttribute('data-selectable', 'false');
            await game.screenshot('complex-hand-response-02-pirate-king-available-source-highlight', testInfo);

            await pirateKingCard.click({ force: true });
            await expect(pirateKingCard).toHaveAttribute('data-selected', 'true');
            await expect(pirateKingFrame).toHaveAttribute('data-selected', 'true');
            await expect(scoringBase).toHaveAttribute('data-deploy-mode', 'true');
            await expect(scoringBase).toHaveAttribute('data-selectable', 'true');
            await expect(scoringBase).toHaveAttribute('data-dimmed', 'false');
            await expect(nonScoringBase).toHaveAttribute('data-deploy-mode', 'false');
            await expect(nonScoringBase).toHaveAttribute('data-dimmed', 'true');
            await game.screenshot('complex-hand-response-03-pirate-king-after-source-click-target-base-highlight', testInfo);

            await nonScoringBase.click({ force: true });
            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
                    base0: state.core.bases[0].minions.map((minion: any) => minion.uid),
                    base1: state.core.bases[1].minions.map((minion: any) => minion.uid),
                };
            }).toEqual({
                interactionSource: 'pirate_king_move',
                base0: ['mate-0', 'tortuga-p0', 'tortuga-p1'],
                base1: ['king-0', 'jungle-p0'],
            });

            await scoringBase.click({ force: true });

            await waitForInteractionSourceIn(page, ['smashup_reaction_choose'], 20000);
            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    base0: state.core.bases[0].minions.map((minion: any) => minion.uid),
                    base1: state.core.bases[1].minions.map((minion: any) => minion.uid),
                };
            }, { timeout: 10000 }).toEqual({
                base0: ['mate-0', 'tortuga-p0', 'tortuga-p1', 'king-0'],
                base1: ['jungle-p0'],
            });
            await expect(page.getByTestId('su-reaction-pass-button')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮手牌响应', { timeout: 10000 });

            const handArea = page.getByTestId('su-hand-area');
            const shinobiCard = handArea.locator('[data-card-uid="shinobi-hand-0"]');
            const hiddenNinjaCard = handArea.locator('[data-card-uid="hidden-0"]');
            const acolyteCard = handArea.locator('[data-card-uid="acolyte-hand-0"]');

            await expect(shinobiCard).toHaveAttribute('data-highlighted', 'true');
            await expect(hiddenNinjaCard).toHaveAttribute('data-disabled', 'true');
            await expect(acolyteCard).toHaveAttribute('data-disabled', 'true');
            await game.screenshot('complex-hand-response-04-pirate-king-me-first-hand-highlight', testInfo);

            await shinobiCard.click({ force: true });
            await expect(shinobiCard).toHaveAttribute('data-selected', 'true');
            await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮目标打出响应牌');
            await expect(scoringBase).toHaveAttribute('data-deploy-mode', 'true');
            await expect(scoringBase).toHaveAttribute('data-dimmed', 'false');
            await expect(nonScoringBase).toHaveAttribute('data-deploy-mode', 'false');
            await expect(nonScoringBase).toHaveAttribute('data-dimmed', 'true');
            await game.screenshot('complex-hand-response-05-after-select-card-target-base-highlight', testInfo);

            await nonScoringBase.click({ force: true });
            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
                    hand: state.core.players['0'].hand.map((card: any) => card.uid),
                    base0: state.core.bases[0].minions.map((minion: any) => minion.uid),
                    base1: state.core.bases[1].minions.map((minion: any) => minion.uid),
                };
            }).toEqual({
                interactionSource: 'smashup_reaction_choose',
                hand: ['hidden-0', 'shinobi-hand-0', 'acolyte-hand-0'],
                base0: ['mate-0', 'tortuga-p0', 'tortuga-p1', 'king-0'],
                base1: ['jungle-p0'],
            });

            await scoringBase.click({ force: true });
            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    hand: state.core.players['0'].hand.map((card: any) => card.uid),
                    base0: state.core.bases[0].minions.map((minion: any) => minion.uid),
                };
            }, { timeout: 10000 }).toEqual({
                hand: ['hidden-0', 'acolyte-hand-0'],
                base0: ['mate-0', 'tortuga-p0', 'tortuga-p1', 'king-0', 'shinobi-hand-0'],
            });
            await game.screenshot('complex-hand-response-06-legal-base-played-before-scoring-chain-continues', testInfo);

            const resolvedSources: string[] = ['pirate_king_move', 'smashup_reaction_choose'];
            let capturedFirstMateChoice = false;
            let capturedTortugaChoice = false;
            for (let step = 0; step < 20; step += 1) {
                const currentInteraction = await readCurrentInteraction(page);
                if (!currentInteraction) break;
                resolvedSources.push(currentInteraction.sourceId);

                if (currentInteraction.sourceId === 'smashup_reaction_choose') {
                    const optionText = (option: CurrentInteraction['options'][number]) =>
                        `${option.id} ${option.label ?? ''} ${JSON.stringify(option.value ?? {})}`;
                    const trigger = currentInteraction.options.find((option) =>
                        option.id !== 'pass'
                        && option.value?.kind === 'trigger'
                        && /大副|first mate|pirate_first_mate/i.test(optionText(option)),
                    ) ?? currentInteraction.options.find((option) =>
                        option.id !== 'pass'
                        && option.value?.kind === 'trigger'
                        && /托尔图加|base_tortuga/i.test(optionText(option)),
                    ) ?? currentInteraction.options.find((option) => option.id !== 'pass' && option.value?.kind === 'trigger');
                    if (trigger) {
                        await respondInteractionOptionIfStillCurrent(page, currentInteraction, trigger.id);
                    } else {
                        await passCurrentSmashupResponse(page);
                    }
                    continue;
                }

                if (currentInteraction.sourceId === 'pirate_first_mate_choose_base') {
                    if (!capturedFirstMateChoice) {
                        await game.screenshot('complex-hand-response-07-first-mate-after-scoring-base-choice', testInfo);
                        capturedFirstMateChoice = true;
                    }
                    const moveToSecretGarden = currentInteraction.options.find((option) =>
                        option.value?.baseDefId === 'base_secret_garden'
                        || option.value?.baseIndex === 2,
                    );
                    expect(moveToSecretGarden, '大副应能选择移动到第三个基地，证明 afterScoring 不是被跳过').toBeTruthy();
                    await respondInteractionOptionIfStillCurrent(page, currentInteraction, moveToSecretGarden!.id);
                    continue;
                }

                if (currentInteraction.sourceId === 'base_tortuga') {
                    if (!capturedTortugaChoice) {
                        await game.screenshot('complex-hand-response-08-tortuga-after-scoring-minion-choice', testInfo);
                        capturedTortugaChoice = true;
                    }
                    const moveRunnerUpReserve = currentInteraction.options.find((option) =>
                        option.value?.minionUid === 'reserve-p1'
                        && option.value?.fromBaseIndex === 2,
                    );
                    expect(moveRunnerUpReserve, '托尔图加应能选择亚军在其它基地上的随从').toBeTruthy();
                    await respondInteractionOptionIfStillCurrent(page, currentInteraction, moveRunnerUpReserve!.id);
                    continue;
                }

                throw new Error(`复杂手牌响应链遇到未预期交互: ${currentInteraction.sourceId}`);
            }

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    if (!state) return false;
                    return !state.sys?.interaction?.current
                        && !state.sys?.responseWindow?.current
                        && state.sys?.phase === 'playCards'
                        && state.core?.currentPlayerIndex === 1;
                },
                { timeout: 30000, polling: 100 },
            );

            const finalState = await game.getState();
            expect(finalState.sys.phase).toBe('playCards');
            expect(finalState.core.currentPlayerIndex).toBe(1);
            expect(resolvedSources).toContain('pirate_king_move');
            expect(resolvedSources).toContain('smashup_reaction_choose');
            expect(resolvedSources).toContain('base_tortuga');
            expect(resolvedSources).toContain('pirate_first_mate_choose_base');
            expect(finalState.sys.interaction?.current ?? null).toBeNull();
            expect(finalState.sys.responseWindow?.current ?? null).toBeNull();
            expect(finalState.core.players['0'].vp).toBeGreaterThan(0);
            expect(finalState.core.players['1'].vp).toBeGreaterThan(0);

            await expect(page.getByTestId('su-interaction-select-banner')).toBeHidden({ timeout: 10000 });
            await expect(page.getByTestId('su-reaction-hand-status')).toBeHidden({ timeout: 10000 });
            await expect(page.getByTestId('su-reaction-pass-button')).toBeHidden({ timeout: 10000 });
            await page.waitForTimeout(500);
            await waitForVisibleSmashUpCardArt(page, 3);
            await game.screenshot('complex-hand-response-09-scoring-chain-complete', testInfo);
            assertNoReactNaNWarnings(diagnostics);
        } catch (error) {
            if (diagnostics.errors.length > 0) {
                console.log('[page-diagnostics]', diagnostics.errors);
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

    test('四人三基地同时计分黄金链会截到计分选择、计分后响应、清场换基地和最终VP', async ({ page, game }, testInfo) => {
        test.setTimeout(240000);

        const diagnostics = attachPageDiagnostics(page);
        await page.addInitScript(() => {
            const originalError = console.error;
            console.error = (...args: unknown[]) => {
                const text = args.map((arg) => String(arg)).join(' ');
                if (/Received NaN/i.test(text)) {
                    const nanTextNodes: string[] = [];
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    while (nanTextNodes.length < 20) {
                        const node = walker.nextNode();
                        if (!node) break;
                        const value = node.textContent?.trim() ?? '';
                        if (/NaN/i.test(value)) {
                            nanTextNodes.push(value);
                        }
                    }
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    originalError('[smashup-nan-render-diagnostic]', JSON.stringify({
                        args: text,
                        stack: new Error().stack,
                        nanTextNodes,
                        phase: state?.sys?.phase ?? null,
                        interactionSource: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                        baseDefIds: (state?.core?.bases ?? []).map((base: any) => base.defId),
                        baseMinionSummary: (state?.core?.bases ?? []).map((base: any) => (base.minions ?? []).map((minion: any) => ({
                            uid: minion.uid,
                            defId: minion.defId,
                            controller: minion.controller,
                            basePower: minion.basePower,
                            powerModifier: minion.powerModifier,
                            powerCounters: minion.powerCounters,
                            tempPowerModifier: minion.tempPowerModifier,
                        }))),
                    }));
                }
                originalError(...args);
            };
        });
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
                        turnNumber: 12,
                        players: {
                            '0': createPlayer('0', ['robots', 'wizards']),
                            '1': createPlayer('1', ['dinosaurs', 'ninjas']),
                            '2': createPlayer('2', ['ghosts', 'aliens']),
                            '3': createPlayer('3', ['dinosaurs', 'ghosts']),
                        },
                        bases: [
                            {
                                defId: 'base_tortuga',
                                minions: [
                                    createMinion('tortuga-winner-rex', 'dino_king_rex', '1', 7),
                                    createMinion('tortuga-winner-laser', 'dino_laser_triceratops', '1', 4),
                                    createMinion('tortuga-winner-assassin', 'ninja_tiger_assassin', '1', 4),
                                    createMinion('tortuga-winner-shinobi', 'ninja_shinobi', '1', 3),
                                    createMinion('tortuga-runnerup-archmage', 'wizard_archmage', '0', 4),
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_dread_lookout',
                                minions: [
                                    createMinion('p0-b1-runnerup', 'robot_hoverbot', '0', 3),
                                    createMinion('p1-b1-invader', 'alien_invader', '1', 5),
                                    createMinion('p2-b1-spectre', 'ghost_spectre', '2', 8),
                                    createMinion('p3-b1-rex', 'dino_king_rex', '3', 7),
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_tsars_palace',
                                minions: [
                                    createMinion('p0-b2-grave-digger', 'zombie_grave_digger', '0', 3),
                                    createMinion('p1-b2-assassin', 'ninja_tiger_assassin', '1', 4),
                                    createMinion('p2-b2-spirit', 'ghost_spirit', '2', 8),
                                    createMinion('p3-b2-rex', 'dino_king_rex', '3', 9),
                                ],
                                ongoingActions: [],
                            },
                        ],
                        baseDeck: ['base_central_brain', 'base_cave_of_shinies', 'base_rhodes_plaza'],
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
                        && state?.core?.bases?.length === 3
                        && state?.core?.bases?.[0]?.defId === 'base_tortuga'
                        && state?.core?.bases?.[1]?.defId === 'base_dread_lookout'
                        && state?.core?.bases?.[2]?.defId === 'base_tsars_palace';
                },
                { timeout: 30000 },
            );

            await waitForVisibleSmashUpCardArt(page, 12);
            await game.screenshot('golden-01-three-scoring-bases-before-finish', testInfo);

            await advancePhaseFromUI(page, game);
            await waitForInteractionSourceIn(page, ['multi_base_scoring'], 20000);
            await expect(page.getByText('选择先计分的基地')).toBeVisible({ timeout: 5000 });

            const initialScoringPrompt = await readCurrentInteraction(page);
            expect(initialScoringPrompt?.sourceId).toBe('multi_base_scoring');
            expect(
                (initialScoringPrompt?.options ?? []).map((option) => option.value?.baseDefId).sort(),
            ).toEqual(['base_dread_lookout', 'base_tortuga', 'base_tsars_palace']);
            await waitForVisibleSmashUpCardArt(page, 12);
            await game.screenshot('golden-02-real-scoring-screen-three-base-choice', testInfo);

            await chooseScoringBaseByDefId(page, 'base_tortuga');
            const afterTortugaSourceId = await waitForInteractionSourceIn(page, ['smashup_reaction_choose', 'base_tortuga'], 20000);

            const afterTortugaAwardState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase,
                    sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                    p0Vp: state?.core?.players?.['0']?.vp ?? 0,
                    p1Vp: state?.core?.players?.['1']?.vp ?? 0,
                    base0DefId: state?.core?.bases?.[0]?.defId ?? null,
                    base0MinionUids: (state?.core?.bases?.[0]?.minions ?? []).map((minion: any) => minion.uid),
                };
            });
            expect(afterTortugaAwardState.phase).toBe('scoreBases');
            expect(afterTortugaAwardState.p0Vp).toBe(3);
            expect(afterTortugaAwardState.p1Vp).toBe(4);
            expect(afterTortugaAwardState.base0DefId).toBe('base_tortuga');
            expect(afterTortugaAwardState.base0MinionUids).toEqual(expect.arrayContaining([
                'tortuga-winner-rex',
                'tortuga-runnerup-archmage',
            ]));
            await expect(page.getByTestId('base-zone-0')).toBeVisible();
            await waitForVisibleSmashUpCardArt(page, 12);
            await game.screenshot('golden-03-vp-awarded-before-clear-old-base-still-visible', testInfo);

            if (afterTortugaSourceId === 'smashup_reaction_choose') {
                await chooseReactionOptionMatching(
                    page,
                    (option) => String(option.id).includes('base_tortuga')
                        || /托尔图加|tortuga|base_tortuga/i.test(String(option.label ?? '')),
                    '三基地黄金链里的托尔图加 afterScoring',
                );
            }

            await waitForInteractionSourceIn(page, ['base_tortuga'], 20000);
            const tortugaInteraction = await readCurrentInteraction(page);
            expect(tortugaInteraction?.sourceId).toBe('base_tortuga');
            const moveRunnerUpMinion = tortugaInteraction?.options.find((option) => option.value?.minionUid === 'p0-b1-runnerup');
            expect(moveRunnerUpMinion, '托尔图加应允许亚军移动另一基地上的随从').toBeTruthy();
            await waitForVisibleSmashUpCardArt(page, 12);
            await game.screenshot('golden-04-tortuga-runner-up-minion-choice-before-clear', testInfo);
            await respondCurrentInteractionByOptionId(page, moveRunnerUpMinion!.id);

            await waitForInteractionSourceIn(page, ['multi_base_scoring'], 30000);
            const afterFirstBasePrompt = await readCurrentInteraction(page);
            const afterFirstBaseState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    p0Vp: state?.core?.players?.['0']?.vp ?? 0,
                    p1Vp: state?.core?.players?.['1']?.vp ?? 0,
                    baseDefIds: (state?.core?.bases ?? []).map((base: any) => base.defId),
                    replacementBase0MinionUids: (state?.core?.bases?.[0]?.minions ?? []).map((minion: any) => minion.uid),
                    remainingBaseOptions: (state?.sys?.interaction?.current?.data?.options ?? []).map((option: any) => option.value?.baseDefId).sort(),
                };
            });
            expect(afterFirstBasePrompt?.sourceId).toBe('multi_base_scoring');
            expect(afterFirstBaseState.p0Vp).toBe(3);
            expect(afterFirstBaseState.p1Vp).toBe(4);
            expect(afterFirstBaseState.baseDefIds).toEqual(['base_central_brain', 'base_dread_lookout', 'base_tsars_palace']);
            expect(afterFirstBaseState.replacementBase0MinionUids).toContain('p0-b1-runnerup');
            expect(afterFirstBaseState.remainingBaseOptions).toEqual(['base_dread_lookout', 'base_tsars_palace']);
            await waitForVisibleSmashUpCardArt(page, 8);
            await game.screenshot('golden-05-after-first-base-cleared-replaced-back-to-scoring-choice', testInfo);

            await chooseScoringBaseByDefId(page, 'base_dread_lookout');

            await page.waitForFunction(
                () => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    if (!state) return false;
                    return !state.sys?.interaction?.current
                        && !state.sys?.responseWindow?.current
                        && state.sys?.phase === 'playCards'
                        && state.core?.currentPlayerIndex === 1;
                },
                { timeout: 30000, polling: 100 },
            );

            const finalState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const vpByPlayer = Object.fromEntries(
                    Object.entries(state?.core?.players ?? {}).map(([playerId, player]: [string, any]) => [playerId, player?.vp ?? 0]),
                );
                return {
                    phase: state?.sys?.phase,
                    currentPlayerIndex: state?.core?.currentPlayerIndex,
                    responseWindowId: state?.sys?.responseWindow?.current?.id ?? null,
                    interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                    vpByPlayer,
                    totalVp: Object.values(vpByPlayer).reduce((sum: number, value: any) => sum + Number(value ?? 0), 0),
                    baseDefIds: (state?.core?.bases ?? []).map((base: any) => base.defId),
                    baseMinionUids: (state?.core?.bases ?? []).map((base: any) => (base.minions ?? []).map((minion: any) => minion.uid)),
                    triggerQueueLength: state?.core?.triggerQueue?.length ?? 0,
                };
            });

            expect(finalState.phase).toBe('playCards');
            expect(finalState.currentPlayerIndex).toBe(1);
            expect(finalState.responseWindowId).toBeNull();
            expect(finalState.interactionSourceId).toBeNull();
            expect(finalState.vpByPlayer).toEqual({
                '0': 3,
                '1': 7,
                '2': 7,
                '3': 7,
            });
            expect(finalState.totalVp).toBe(24);
            expect(finalState.baseDefIds).toEqual(['base_central_brain', 'base_cave_of_shinies', 'base_rhodes_plaza']);
            expect(finalState.baseMinionUids[0]).toContain('p0-b1-runnerup');
            expect(finalState.baseMinionUids[1]).toHaveLength(0);
            expect(finalState.baseMinionUids[2]).toHaveLength(0);
            expect(finalState.triggerQueueLength).toBe(0);

            await waitForVisibleSmashUpCardArt(page, 4);
            await game.screenshot('golden-06-final-scoring-complete-no-duplicate-vp', testInfo);
            await page.waitForTimeout(300);
            assertNoReactNaNWarnings(diagnostics);
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
