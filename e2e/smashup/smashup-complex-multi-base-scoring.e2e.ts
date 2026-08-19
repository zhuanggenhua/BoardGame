import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import type { Locator, Page } from '@playwright/test';
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

function optionDebugText(option: CurrentInteraction['options'][number]): string {
    return `${option.id} ${option.label ?? ''} ${JSON.stringify(option.value ?? {})}`;
}

function findReactionTriggerOptionMatching(
    interaction: CurrentInteraction | null,
    matcher: (option: CurrentInteraction['options'][number]) => boolean,
) {
    return interaction?.options.find((option) => !isPassOption(option) && option.value?.kind === 'trigger' && matcher(option));
}

async function expectNoVisibleReactionProxyButtons(page: Page, matcher: RegExp, description: string): Promise<void> {
    const labels = await page.locator('[data-testid="su-reaction-option-button"]').evaluateAll((buttons) => buttons
        .filter((button) => {
            const style = window.getComputedStyle(button);
            const rect = button.getBoundingClientRect();
            return style.visibility !== 'hidden'
                && style.display !== 'none'
                && Number(style.opacity || '1') > 0.01
                && rect.width > 2
                && rect.height > 2;
        })
        .map((button) => button.textContent?.trim() ?? ''));
    expect(
        labels.filter((label) => matcher.test(label)),
        `${description}: 响应窗口不应再显示场上效果代理按钮；当前可见响应按钮=${JSON.stringify(labels)}`,
    ).toEqual([]);
}

async function expectStandardObjectHighlight(locator: Locator, description: string): Promise<void> {
    await expect(locator, `${description}: 对象本体必须可见`).toBeVisible({ timeout: 5000 });
    const metrics = await locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const classText = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))]
            .map((node) => {
                const className = node.className;
                return typeof className === 'string' ? className : '';
            })
            .join(' ');
        const clippingAncestors: Array<{
            tag: string;
            testId: string | null;
            overflow: string;
            outside: boolean;
        }> = [];
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.documentElement) {
            const ancestorStyle = window.getComputedStyle(ancestor);
            const overflow = `${ancestorStyle.overflow} ${ancestorStyle.overflowX} ${ancestorStyle.overflowY}`;
            if (/(auto|hidden|scroll|clip)/.test(overflow)) {
                const ancestorRect = ancestor.getBoundingClientRect();
                clippingAncestors.push({
                    tag: ancestor.tagName.toLowerCase(),
                    testId: ancestor.getAttribute('data-testid'),
                    overflow,
                    outside: rect.left < ancestorRect.left - 1
                        || rect.right > ancestorRect.right + 1
                        || rect.top < ancestorRect.top - 1
                        || rect.bottom > ancestorRect.bottom + 1,
                });
            }
            ancestor = ancestor.parentElement;
        }

        return {
            width: rect.width,
            height: rect.height,
            display: style.display,
            visibility: style.visibility,
            opacity: Number(style.opacity || '1'),
            classText,
            clippingAncestors,
        };
    });

    expect(metrics.width, `${description}: 对象宽度必须可见`).toBeGreaterThan(8);
    expect(metrics.height, `${description}: 对象高度必须可见`).toBeGreaterThan(8);
    expect(metrics.display, `${description}: 对象不能 display:none`).not.toBe('none');
    expect(metrics.visibility, `${description}: 对象不能 visibility:hidden`).not.toBe('hidden');
    expect(metrics.opacity, `${description}: 对象不能透明`).toBeGreaterThan(0.15);
    expect(
        /ring-(?:2|4|\[[^\]]+\])/.test(metrics.classText) && /shadow-\[0_0/.test(metrics.classText),
        `${description}: 必须复用统一 ring/shadow 高亮样式，不得依赖专属覆盖层`,
    ).toBe(true);
    expect(
        metrics.clippingAncestors.filter((ancestor) => ancestor.outside),
        `${description}: 对象本体不能被滚动/裁切祖先截断`,
    ).toEqual([]);
}

async function readReactionTriggerSourceForOption(page: Page, optionId: string): Promise<{
    triggerId: string | null;
    sourceDefId: string | null;
    sourceCardUid: string | null;
    sourceBaseIndex: number | null;
}> {
    return page.evaluate(({ nextOptionId }) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const current = state?.sys?.interaction?.current;
        const option = (current?.data?.options ?? []).find((candidate: any) => candidate.id === nextOptionId);
        const triggerId = option?.value?.triggerId ?? null;
        const trigger = (state?.core?.triggerQueue ?? []).find((candidate: any) => candidate.id === triggerId);
        return {
            triggerId,
            sourceDefId: trigger?.sourceDefId ?? null,
            sourceCardUid: trigger?.sourceCardUid ?? null,
            sourceBaseIndex: typeof (trigger?.sourceBaseIndex ?? trigger?.baseIndex) === 'number'
                ? (trigger.sourceBaseIndex ?? trigger.baseIndex)
                : null,
        };
    }, { nextOptionId: optionId });
}

async function clickReactionTriggerSourceByOption(
    page: Page,
    option: CurrentInteraction['options'][number],
    description: string,
): Promise<void> {
    const source = await readReactionTriggerSourceForOption(page, option.id);
    expect(source.triggerId, `${description}: 反应选项必须能追到当前触发来源`).toBeTruthy();

    if (source.sourceCardUid) {
        const minionSource = page.locator(`[data-minion-uid="${source.sourceCardUid}"]`).first();
        if (await minionSource.isVisible({ timeout: 1000 }).catch(() => false)) {
            await minionSource.click({ force: true });
            await page.waitForTimeout(200);
            return;
        }
        const ongoingSource = page.locator(`[data-ongoing-uid="${source.sourceCardUid}"]`).first();
        if (await ongoingSource.isVisible({ timeout: 1000 }).catch(() => false)) {
            await ongoingSource.click({ force: true });
            await page.waitForTimeout(200);
            return;
        }
        const titanSource = page.locator(`[data-titan-uid="${source.sourceCardUid}"]`).first();
        if (await titanSource.isVisible({ timeout: 1000 }).catch(() => false)) {
            await titanSource.click({ force: true });
            await page.waitForTimeout(200);
            return;
        }
    }

    if (typeof source.sourceBaseIndex === 'number') {
        await page.getByTestId(`base-zone-${source.sourceBaseIndex}`).click({ force: true });
        await page.waitForTimeout(200);
        return;
    }

    throw new Error(`${description}: 没有可点击的场上来源本体: ${JSON.stringify(source)}`);
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
                        { uid: 'card-normal-1', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
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
                        && state?.core?.players?.['0']?.hand?.length === 2
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
            await expectNoVisibleReactionProxyButtons(
                page,
                /我们乃最强|we are the champions/i,
                'afterScoring 手牌响应第一层',
            );
            await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮手牌响应', { timeout: 10000 });
            const handArea = page.getByTestId('su-hand-area');
            await expect(handArea.locator('[data-card-uid="card-after-1"]')).toHaveAttribute('data-highlighted', 'true');
            await expect(handArea.locator('[data-card-uid="card-normal-1"]')).toHaveAttribute('data-disabled', 'true');
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
                                    createMinion('tortuga-p1', 'alien_invader', '1', 25),
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
                                    createMinion('reserve-p0', 'wizard_apprentice', '0', 2),
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
                    const firstMateTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /大副|first mate|pirate_first_mate/i.test(optionDebugText(option)),
                    );
                    if (firstMateTrigger) {
                        await expectNoVisibleReactionProxyButtons(page, /大副|first mate|pirate_first_mate/i, '大副计分后可选效果第一层');
                        const firstMateCard = page.locator('[data-minion-uid="mate-0"]').first();
                        const firstMateFrame = page.getByTestId('su-minion-frame-mate-0');
                        const firstMateSourceBase = page.getByTestId('base-zone-0');
                        const firstMateJungleBase = page.getByTestId('base-zone-1');
                        const firstMateSecretGardenBase = page.getByTestId('base-zone-2');
                        const tortugaSourceIsAlsoAvailable = Boolean(findReactionTriggerOptionMatching(
                            currentInteraction,
                            (option) => /托尔图加|tortuga|base_tortuga/i.test(optionDebugText(option)),
                        ));

                        await expect(firstMateCard).toHaveAttribute('data-highlighted', 'true');
                        await expect(firstMateFrame).toHaveAttribute('data-highlighted', 'true');
                        await expect(firstMateSourceBase).toHaveAttribute('data-selectable', tortugaSourceIsAlsoAvailable ? 'true' : 'false');
                        await expect(firstMateJungleBase).toHaveAttribute('data-selectable', 'false');
                        await expect(firstMateSecretGardenBase).toHaveAttribute('data-selectable', 'false');
                        await game.screenshot('complex-hand-response-07-first-mate-reaction-source-highlight-before-trigger', testInfo);

                        await firstMateCard.click({ force: true });
                        await waitForInteractionSourceIn(page, ['pirate_first_mate_choose_base'], 20000);
                        continue;
                    }

                    const tortugaTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /托尔图加|tortuga|base_tortuga/i.test(optionDebugText(option)),
                    );
                    if (tortugaTrigger) {
                        await expectNoVisibleReactionProxyButtons(page, /托尔图加|tortuga|base_tortuga/i, '托尔图加计分后可选效果第一层');
                        const tortugaBase = page.getByTestId('base-zone-0');
                        const runnerUpReserve = page.locator('[data-minion-uid="reserve-p0"]').first();

                        await expect(tortugaBase).toHaveAttribute('data-selectable', 'true');
                        await expect(tortugaBase).toHaveAttribute('data-dimmed', 'false');
                        await expect(runnerUpReserve).toHaveAttribute('data-highlighted', 'false');
                        await game.screenshot('complex-hand-response-09-tortuga-reaction-source-base-highlight-before-trigger', testInfo);

                        await tortugaBase.click({ force: true });
                        await waitForInteractionSourceIn(page, ['base_tortuga'], 20000);
                        continue;
                    }

                    const unmappedTrigger = findReactionTriggerOptionMatching(currentInteraction, () => true);
                    if (unmappedTrigger) {
                        await clickReactionTriggerSourceByOption(page, unmappedTrigger, '复杂手牌响应链其它场上可选效果');
                    } else {
                        await passCurrentSmashupResponse(page);
                    }
                    continue;
                }

                if (currentInteraction.sourceId === 'pirate_first_mate_choose_base') {
                    if (!capturedFirstMateChoice) {
                        const firstMateCard = page.locator('[data-minion-uid="mate-0"]').first();
                        const firstMateFrame = page.getByTestId('su-minion-frame-mate-0');
                        const firstMateSourceBase = page.getByTestId('base-zone-0');
                        const firstMateJungleBase = page.getByTestId('base-zone-1');
                        const firstMateSecretGardenBase = page.getByTestId('base-zone-2');

                        await expect(firstMateCard).toHaveAttribute('data-highlighted', 'true');
                        await expect(firstMateFrame).toHaveAttribute('data-highlighted', 'true');
                        await expect(firstMateCard).toHaveAttribute('data-selected', 'true');
                        await expect(firstMateFrame).toHaveAttribute('data-selected', 'true');
                        await expect(firstMateSourceBase).toHaveAttribute('data-selectable', 'false');
                        await expect(firstMateJungleBase).toHaveAttribute('data-selectable', 'true');
                        await expect(firstMateSecretGardenBase).toHaveAttribute('data-selectable', 'true');
                        await expect(firstMateSecretGardenBase).toHaveAttribute('data-deploy-mode', 'true');
                        await expect(firstMateSecretGardenBase).toHaveAttribute('data-dimmed', 'false');
                        await game.screenshot('complex-hand-response-08-first-mate-target-base-highlight-after-source-click', testInfo);
                        capturedFirstMateChoice = true;
                    }
                    const moveToSecretGarden = currentInteraction.options.find((option) =>
                        option.value?.baseDefId === 'base_secret_garden'
                        || option.value?.baseIndex === 2,
                    );
                    expect(moveToSecretGarden, '大副应能选择移动到第三个基地，证明 afterScoring 不是被跳过').toBeTruthy();
                    await page.getByTestId('base-zone-2').click({ force: true });
                    continue;
                }

                if (currentInteraction.sourceId === 'base_tortuga') {
                    if (!capturedTortugaChoice) {
                        await game.screenshot('complex-hand-response-10-tortuga-minion-choice-after-source-click', testInfo);
                        capturedTortugaChoice = true;
                    }
                    const moveRunnerUpReserve = currentInteraction.options.find((option) =>
                        option.value?.minionUid === 'reserve-p0'
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
            expect(resolvedSources).toContain('pirate_first_mate_choose_base');
            expect(resolvedSources).toContain('base_tortuga');
            expect(finalState.sys.interaction?.current ?? null).toBeNull();
            expect(finalState.sys.responseWindow?.current ?? null).toBeNull();
            expect(finalState.core.players['0'].vp).toBeGreaterThan(0);
            expect(finalState.core.players['1'].vp).toBeGreaterThan(0);
            const replacementBase = finalState.core.bases.find((base: any) => base.defId === 'base_central_brain');
            expect(
                replacementBase?.minions.some((minion: any) => minion.uid === 'reserve-p0'),
                '托尔图加应由玩家点击基地来源后选择亚军随从，并把该随从移动到替换基地',
            ).toBe(true);
            expect(finalState.core.bases[2].minions.map((minion: any) => minion.uid)).toContain('mate-0');
            expect(finalState.core.bases[2].minions.map((minion: any) => minion.uid)).not.toContain('reserve-p0');

            await expect(page.getByTestId('su-interaction-select-banner')).toBeHidden({ timeout: 10000 });
            await expect(page.getByTestId('su-reaction-hand-status')).toBeHidden({ timeout: 10000 });
            await expect(page.getByTestId('su-reaction-pass-button')).toBeHidden({ timeout: 10000 });
            await page.waitForTimeout(500);
            await waitForVisibleSmashUpCardArt(page, 3);
            await game.screenshot('complex-hand-response-11-scoring-chain-complete', testInfo);
            assertNoReactNaNWarnings(diagnostics);
        } catch (error) {
            if (diagnostics.errors.length > 0) {
                console.log('[page-diagnostics]', diagnostics.errors);
            }
            throw error;
        }
    });

    test('最复杂计分压力链会交错手牌响应、随从、基地、持续行动和泰坦来源', async ({ page, game }, testInfo) => {
        test.setTimeout(240000);

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

        const createMinion = (
            uid: string,
            defId: string,
            owner: string,
            basePower: number,
            overrides: Partial<{
                controller: string;
                powerModifier: number;
                powerCounters: number;
                tempPowerModifier: number;
                talentUsed: boolean;
                attachedActions: unknown[];
                playedThisTurn: boolean;
            }> = {},
        ) => ({
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
            ...overrides,
        });

        const clickFieldSourceThenTargetBase = async ({
            source,
            sourceDescription,
            sourceScreenshot,
            targetBaseIndex,
            targetScreenshot,
        }: {
            source: ReturnType<Page['locator']>;
            sourceDescription: string;
            sourceScreenshot: string;
            targetBaseIndex: number;
            targetScreenshot: string;
        }) => {
            const targetBase = page.getByTestId(`base-zone-${targetBaseIndex}`);
            if (await source.getAttribute('data-selected') !== 'true') {
                await expect(source, `${sourceDescription} 第一层应高亮来源本体`).toHaveAttribute('data-highlighted', 'true');
                await expect(source, `${sourceDescription} 第一层还不能把来源当作已选中`).toHaveAttribute('data-selected', 'false');
                await expect(targetBase, `${sourceDescription} 点击来源前目标基地不能提前高亮`).toHaveAttribute('data-selectable', 'false');
                await game.screenshot(sourceScreenshot, testInfo);
                await source.click({ force: true });
                await page.waitForTimeout(300);
            }
            await expect(source, `${sourceDescription} 点击来源后应保留来源选中态`).toHaveAttribute('data-selected', 'true');
            await expect(targetBase, `${sourceDescription} 点击来源后目标基地必须高亮`).toHaveAttribute('data-selectable', 'true');
            await expect(targetBase, `${sourceDescription} 点击来源后目标基地必须进入可投放/可选择表现`).toHaveAttribute('data-deploy-mode', 'true');
            await expect(targetBase, `${sourceDescription} 合法目标基地不能被置灰`).toHaveAttribute('data-dimmed', 'false');
            await game.screenshot(targetScreenshot, testInfo);
            await targetBase.click({ force: true });
            await page.waitForTimeout(300);
        };

        const clickPromptButtonByOptionId = async (optionId: string, description: string) => {
            const directButton = page.locator(`[data-option-id="${optionId}"]`).first();
            if (await directButton.isVisible({ timeout: 1200 }).catch(() => false)) {
                await directButton.click({ force: true });
                await page.waitForTimeout(300);
                return;
            }

            const currentInteraction = await readCurrentInteraction(page);
            const option = currentInteraction?.options.find(candidate => candidate.id === optionId);
            expect(option, `${description}: 找不到当前交互选项 ${optionId}`).toBeTruthy();
            const buttonByText = page.getByRole('button', {
                name: new RegExp(String(option!.label ?? optionId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
            }).first();
            await expect(buttonByText, `${description}: 选项按钮必须真实可见`).toBeVisible({ timeout: 5000 });
            await buttonByText.click({ force: true });
            await page.waitForTimeout(300);
        };

        const setSliderValue = async (amount: number) => {
            const slider = page.getByLabel(/slider-choice|滑杆选择/i);
            await expect(slider).toBeVisible({ timeout: 5000 });
            await slider.evaluate((element, nextAmount) => {
                const input = element as HTMLInputElement;
                input.value = String(nextAmount);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }, amount);
        };

        const clickTransferConfirmButton = async (description: string) => {
            const confirmButton = page.getByRole('button', { name: /确认转移/i }).first();
            await expect(confirmButton, `${description}: 数量确认按钮必须真实可见`).toBeVisible({ timeout: 5000 });
            await confirmButton.click({ force: true });
            await page.waitForTimeout(300);
        };

        try {
            await page.setViewportSize({ width: 1600, height: 950 });
            await openFourPlayerTestGame(game);
            await game.setupScene({
                gameId: 'smashup',
                phase: 'playCards',
                currentPlayer: '0',
                extra: {
                    core: {
                        turnOrder: ['0', '1', '2', '3'],
                        currentPlayerIndex: 0,
                        turnNumber: 18,
                        enabledExpansions: ['titans'],
                        players: {
                            '0': createPlayer('0', ['pirates', 'giant_ants'], [
                                { uid: 'stress-full-sail-hand', defId: 'pirate_full_sail', type: 'action' },
                                { uid: 'stress-under-pressure-hand', defId: 'giant_ant_under_pressure', type: 'action' },
                                { uid: 'stress-shinobi-hand', defId: 'ninja_shinobi', type: 'minion' },
                                { uid: 'stress-champions-hand', defId: 'giant_ant_we_are_the_champions', type: 'action' },
                                { uid: 'stress-hidden-hand', defId: 'ninja_hidden_ninja', type: 'action' },
                                { uid: 'stress-acolyte-hand', defId: 'ninja_acolyte', type: 'minion' },
                            ]),
                            '1': createPlayer('1', ['aliens', 'wizards']),
                            '2': createPlayer('2', ['mermaids', 'skeletons']),
                            '3': createPlayer('3', ['dinosaurs', 'robots']),
                        },
                        bases: [
                            {
                                defId: 'base_tortuga',
                                minions: [
                                    createMinion('stress-first-mate', 'pirate_first_mate', '0', 2),
                                    createMinion('stress-kraken-save', 'pirate_buccaneer', '0', 3),
                                    createMinion('stress-p0-anchor', 'ninja_acolyte', '0', 2),
                                    createMinion('stress-full-sail-move', 'pirate_buccaneer', '0', 1),
                                    createMinion('stress-pressure-source', 'giant_ant_worker', '0', 1, { powerCounters: 2 }),
                                    createMinion('stress-champions-source', 'giant_ant_soldier', '0', 2, { powerCounters: 2 }),
                                    createMinion('stress-p1-winner', 'alien_invader', '1', 30),
                                    createMinion('stress-p2-rival', 'mermaids_sea_dog', '2', 6),
                                    createMinion('stress-p3-rival', 'dino_war_raptor', '3', 5),
                                ],
                                ongoingActions: [
                                    {
                                        uid: 'stress-shipwreck-cove',
                                        defId: 'mermaids_shipwreck_cove',
                                        ownerId: '0',
                                        talentUsed: false,
                                    },
                                    {
                                        uid: 'stress-gravestones',
                                        defId: 'skeletons_gravestones',
                                        ownerId: '0',
                                        talentUsed: false,
                                    },
                                ],
                            },
                            {
                                defId: 'base_dread_lookout',
                                minions: [
                                    createMinion('stress-pirate-king', 'pirate_king', '0', 5),
                                    createMinion('stress-runnerup-reserve', 'wizard_apprentice', '0', 2),
                                    createMinion('stress-second-base-winner', 'ghost_spectre', '2', 22),
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_secret_garden',
                                minions: [
                                    createMinion('stress-ant-target', 'giant_ant_drone', '0', 1),
                                ],
                                ongoingActions: [],
                            },
                            {
                                defId: 'base_the_mothership',
                                minions: [],
                                ongoingActions: [],
                            },
                        ],
                        titans: [
                            {
                                uid: 'stress-kraken',
                                defId: 'pirates_the_kraken',
                                faction: 'pirates',
                                ownerId: '0',
                                controllerId: '0',
                                powerCounters: 0,
                                talentUsed: false,
                                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
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
            await waitForVisibleSmashUpCardArt(page, 12);
            await game.screenshot('stress-01-scene-ready-with-all-scoring-sources', testInfo);

            await advancePhaseFromUI(page, game);
            const firstSourceId = await waitForInteractionSourceIn(page, ['multi_base_scoring', 'pirate_king_move'], 30000);
            if (firstSourceId === 'multi_base_scoring') {
                await game.screenshot('stress-02-multi-base-choice-before-pressure-chain', testInfo);
                await chooseScoringBaseByDefId(page, 'base_tortuga');
            }

            const resolvedSources: string[] = [];
            const capturedSources = new Set<string>();
            let selectedPrimaryScoringBase = firstSourceId === 'multi_base_scoring';

            for (let step = 0; step < 80; step += 1) {
                const currentInteraction = await readCurrentInteraction(page);
                if (!currentInteraction) break;
                resolvedSources.push(currentInteraction.sourceId);

                if (currentInteraction.sourceId === 'multi_base_scoring') {
                    const tortugaOption = currentInteraction.options.find((option) => option.value?.baseDefId === 'base_tortuga');
                    if (tortugaOption && !selectedPrimaryScoringBase) {
                        selectedPrimaryScoringBase = true;
                        await respondCurrentInteractionByOptionId(page, tortugaOption.id);
                        continue;
                    }
                    const nextScoringBase = currentInteraction.options.find((option) => option.value?.baseDefId === 'base_dread_lookout')
                        ?? currentInteraction.options.find((option) => !isPassOption(option));
                    expect(nextScoringBase, '压力链清完第一基地后仍有可计分基地时必须能继续选择').toBeTruthy();
                    await game.screenshot('stress-19-after-first-base-back-to-multi-base-scoring', testInfo);
                    await respondCurrentInteractionByOptionId(page, nextScoringBase!.id);
                    continue;
                }

                if (currentInteraction.sourceId === 'pirate_king_move') {
                    const pirateKingCard = page.locator('[data-minion-uid="stress-pirate-king"]').first();
                    const scoringBase = page.getByTestId('base-zone-0');
                    const wrongBase = page.getByTestId('base-zone-1');
                    await expect(pirateKingCard).toHaveAttribute('data-highlighted', 'true');
                    await expect(scoringBase).toHaveAttribute('data-selectable', 'false');
                    await expect(wrongBase).toHaveAttribute('data-selectable', 'false');
                    await game.screenshot('stress-03-pirate-king-source-highlight-before-targets', testInfo);

                    await pirateKingCard.click({ force: true });
                    await page.waitForTimeout(300);
                    await expect(pirateKingCard).toHaveAttribute('data-selected', 'true');
                    await expect(scoringBase).toHaveAttribute('data-selectable', 'true');
                    await expect(scoringBase).toHaveAttribute('data-deploy-mode', 'true');
                    await expect(wrongBase).toHaveAttribute('data-selectable', 'false');
                    await expect(wrongBase).toHaveAttribute('data-dimmed', 'true');
                    await game.screenshot('stress-04-pirate-king-target-scoring-base-highlight', testInfo);

                    await scoringBase.click({ force: true });
                    capturedSources.add('pirate_king_move');
                    continue;
                }

                if (currentInteraction.sourceId === 'smashup_reaction_choose') {
                    const handArea = page.getByTestId('su-hand-area');
                    const pendingScoringBase = page.getByTestId('base-zone-0');
                    const selectedReactionHandCardUid = await page.evaluate(() => {
                        const hand = document.querySelector<HTMLElement>('[data-testid="su-hand-area"]');
                        const selected = hand?.querySelector<HTMLElement>('[data-card-uid][data-selected="true"]');
                        return selected?.dataset.cardUid ?? null;
                    });
                    if (selectedReactionHandCardUid) {
                        const baseReady = await expect(pendingScoringBase)
                            .toHaveAttribute('data-selectable', 'true', { timeout: 1500 })
                            .then(() => true)
                            .catch(() => false);
                        if (baseReady) {
                            await expect(pendingScoringBase).toHaveAttribute('data-dimmed', 'false');
                            const selectedHandCard = handArea.locator(`[data-card-uid="${selectedReactionHandCardUid}"]`).first();
                            await expect(selectedHandCard).toHaveAttribute('data-selected', 'true');
                            const shotByCardUid: Record<string, string> = {
                                'stress-full-sail-hand': 'stress-05aa-full-sail-target-scoring-base-highlight-after-hand-click',
                                'stress-under-pressure-hand': 'stress-06aa-under-pressure-target-scoring-base-highlight-after-hand-click',
                                'stress-shinobi-hand': 'stress-06-hand-response-target-scoring-base-highlight',
                                'stress-champions-hand': 'stress-16b-champions-target-scoring-base-highlight-after-hand-click',
                            };
                            await game.screenshot(shotByCardUid[selectedReactionHandCardUid] ?? 'stress-reaction-hand-target-scoring-base-highlight', testInfo);
                            await pendingScoringBase.click({ force: true });
                            if (selectedReactionHandCardUid === 'stress-full-sail-hand') {
                                capturedSources.add('pirate_full_sail_hand');
                            } else if (selectedReactionHandCardUid === 'stress-under-pressure-hand') {
                                capturedSources.add('giant_ant_under_pressure_hand');
                            } else if (selectedReactionHandCardUid === 'stress-shinobi-hand') {
                                capturedSources.add('hand-response');
                            } else if (selectedReactionHandCardUid === 'stress-champions-hand') {
                                capturedSources.add('giant_ant_we_are_the_champions_hand');
                            }
                            await page.waitForTimeout(300);
                            continue;
                        }
                    }
                    const fullSailCard = handArea.locator('[data-card-uid="stress-full-sail-hand"]');
                    if (
                        !capturedSources.has('pirate_full_sail')
                        && !capturedSources.has('pirate_full_sail_hand')
                        && await fullSailCard.isVisible({ timeout: 500 }).catch(() => false)
                        && await fullSailCard.getAttribute('data-highlighted') === 'true'
                    ) {
                        const hiddenNinjaCard = handArea.locator('[data-card-uid="stress-hidden-hand"]');
                        const acolyteCard = handArea.locator('[data-card-uid="stress-acolyte-hand"]');
                        await expectNoVisibleReactionProxyButtons(page, /全速航行|full sail|pirate_full_sail/i, '压力链全速航行手牌响应');
                        await expect(page.getByTestId('su-reaction-pass-button')).toBeVisible({ timeout: 10000 });
                        await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮手牌响应', { timeout: 10000 });
                        await expect(fullSailCard).toHaveAttribute('data-highlighted', 'true');
                        await expect(hiddenNinjaCard).toHaveAttribute('data-disabled', 'true');
                        await expect(acolyteCard).toHaveAttribute('data-disabled', 'true');
                        await expectStandardObjectHighlight(
                            fullSailCard,
                            '全速航行手牌响应高亮',
                        );
                        await game.screenshot('stress-05a-full-sail-hand-card-highlight-before-click', testInfo);

                        await fullSailCard.click({ force: true });
                        capturedSources.add('pirate_full_sail_hand');
                        await page.waitForTimeout(300);
                        continue;
                    }

                    const underPressureCard = handArea.locator('[data-card-uid="stress-under-pressure-hand"]');
                    if (
                        !capturedSources.has('giant_ant_under_pressure')
                        && !capturedSources.has('giant_ant_under_pressure_hand')
                        && await underPressureCard.isVisible({ timeout: 500 }).catch(() => false)
                        && await underPressureCard.getAttribute('data-highlighted') === 'true'
                    ) {
                        await expectNoVisibleReactionProxyButtons(page, /承受压力|under pressure|giant_ant_under_pressure/i, '压力链承受压力手牌响应');
                        await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮手牌响应', { timeout: 10000 });
                        await expect(underPressureCard).toHaveAttribute('data-highlighted', 'true');
                        await expect(handArea.locator('[data-card-uid="stress-acolyte-hand"]')).toHaveAttribute('data-disabled', 'true');
                        await expectStandardObjectHighlight(
                            underPressureCard,
                            '承受压力手牌响应高亮',
                        );
                        await game.screenshot('stress-06a-under-pressure-hand-card-highlight-before-click', testInfo);

                        await underPressureCard.click({ force: true });
                        capturedSources.add('giant_ant_under_pressure_hand');
                        await page.waitForTimeout(300);
                        const scoringBase = page.getByTestId('base-zone-0');
                        if (await expect(scoringBase).toHaveAttribute('data-selectable', 'true', { timeout: 1500 }).then(() => true).catch(() => false)) {
                            await expect(underPressureCard).toHaveAttribute('data-selected', 'true');
                            await expect(scoringBase).toHaveAttribute('data-deploy-mode', 'true');
                            await expect(scoringBase).toHaveAttribute('data-dimmed', 'false');
                            await game.screenshot('stress-06aa-under-pressure-target-scoring-base-highlight-after-hand-click', testInfo);
                            await scoringBase.click({ force: true });
                            await page.waitForTimeout(300);
                        }
                        continue;
                    }

                    const shinobiCard = handArea.locator('[data-card-uid="stress-shinobi-hand"]');
                    if (
                        !capturedSources.has('hand-response')
                        && await shinobiCard.isVisible({ timeout: 500 }).catch(() => false)
                        && await shinobiCard.getAttribute('data-highlighted') === 'true'
                    ) {
                        const hiddenNinjaCard = handArea.locator('[data-card-uid="stress-hidden-hand"]');
                        const acolyteCard = handArea.locator('[data-card-uid="stress-acolyte-hand"]');
                        await expect(page.getByTestId('su-reaction-pass-button')).toBeVisible({ timeout: 10000 });
                        await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮手牌响应', { timeout: 10000 });
                        await expect(shinobiCard).toHaveAttribute('data-highlighted', 'true');
                        await expect(hiddenNinjaCard).toHaveAttribute('data-disabled', 'true');
                        await expect(acolyteCard).toHaveAttribute('data-disabled', 'true');
                        await game.screenshot('stress-05-hand-response-card-highlight-non-response-dimmed', testInfo);

                        await shinobiCard.click({ force: true });
                        await page.waitForTimeout(300);
                        await expect(shinobiCard).toHaveAttribute('data-selected', 'true');
                        await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-deploy-mode', 'true');
                        await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-dimmed', 'false');
                        await expect(page.getByTestId('base-zone-1')).toHaveAttribute('data-dimmed', 'true');
                        await game.screenshot('stress-06-hand-response-target-scoring-base-highlight', testInfo);

                        await page.getByTestId('base-zone-0').click({ force: true });
                        capturedSources.add('hand-response');
                        continue;
                    }

                    const championsCard = handArea.locator('[data-card-uid="stress-champions-hand"]');
                    if (
                        !capturedSources.has('giant_ant_we_are_the_champions')
                        && !capturedSources.has('giant_ant_we_are_the_champions_hand')
                        && await championsCard.isVisible({ timeout: 500 }).catch(() => false)
                        && await championsCard.getAttribute('data-highlighted') === 'true'
                    ) {
                        await expectNoVisibleReactionProxyButtons(page, /我们乃最强|we are the champions|giant_ant_we_are_the_champions/i, '压力链我们乃最强手牌响应');
                        await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮手牌响应', { timeout: 10000 });
                        await expect(championsCard).toHaveAttribute('data-highlighted', 'true');
                        await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-deploy-mode', 'false');
                        await expectStandardObjectHighlight(
                            championsCard,
                            '我们乃最强手牌响应高亮',
                        );
                        await game.screenshot('stress-16a-champions-hand-card-highlight-before-click', testInfo);

                        await championsCard.click({ force: true });
                        await page.waitForTimeout(300);
                        await expect(championsCard).toHaveAttribute('data-selected', 'true');
                        await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-selectable', 'true');
                        await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-deploy-mode', 'true');
                        await game.screenshot('stress-16b-champions-target-scoring-base-highlight-after-hand-click', testInfo);
                        await page.getByTestId('base-zone-0').click({ force: true });
                        capturedSources.add('giant_ant_we_are_the_champions_hand');
                        await page.waitForTimeout(300);
                        continue;
                    }

                    const shipwreckTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /沉船湾|shipwreck|mermaids_shipwreck_cove/i.test(optionDebugText(option)),
                    );
                    if (shipwreckTrigger && !capturedSources.has('mermaids_shipwreck_cove_after_scoring')) {
                        await expectNoVisibleReactionProxyButtons(page, /沉船湾|shipwreck|mermaids_shipwreck_cove/i, '压力链沉船湾 afterScoring');
                        const source = page.locator('[data-ongoing-uid="stress-shipwreck-cove"]').first();
                        await expect(source).toHaveAttribute('data-highlighted', 'true');
                        await expect(page.getByTestId('base-zone-2')).toHaveAttribute('data-selectable', 'false');
                        await game.screenshot('stress-07-shipwreck-cove-source-highlight-from-reaction-window', testInfo);
                        await clickReactionTriggerSourceByOption(page, shipwreckTrigger, '压力链沉船湾 afterScoring');
                        continue;
                    }

                    const gravestonesTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /墓碑|gravestones|skeletons_gravestones/i.test(optionDebugText(option)),
                    );
                    if (gravestonesTrigger && !capturedSources.has('skeletons_gravestones_after_scoring')) {
                        await expectNoVisibleReactionProxyButtons(page, /墓碑|gravestones|skeletons_gravestones/i, '压力链墓碑 afterScoring');
                        const source = page.locator('[data-ongoing-uid="stress-gravestones"]').first();
                        await expect(source).toHaveAttribute('data-highlighted', 'true');
                        await expect(page.getByTestId('base-zone-3')).toHaveAttribute('data-selectable', 'false');
                        await game.screenshot('stress-09-gravestones-source-highlight-from-reaction-window', testInfo);
                        await clickReactionTriggerSourceByOption(page, gravestonesTrigger, '压力链墓碑 afterScoring');
                        continue;
                    }

                    const firstMateTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /大副|first mate|pirate_first_mate/i.test(optionDebugText(option)),
                    );
                    if (firstMateTrigger && !capturedSources.has('pirate_first_mate_choose_base')) {
                        await expectNoVisibleReactionProxyButtons(page, /大副|first mate|pirate_first_mate/i, '压力链大副 afterScoring');
                        const firstMate = page.locator('[data-minion-uid="stress-first-mate"]').first();
                        await expect(firstMate).toHaveAttribute('data-highlighted', 'true');
                        await expect(page.getByTestId('base-zone-2')).toHaveAttribute('data-selectable', 'false');
                        await game.screenshot('stress-13-first-mate-source-highlight-from-reaction-window', testInfo);
                        await clickReactionTriggerSourceByOption(page, firstMateTrigger, '压力链大副 afterScoring');
                        continue;
                    }

                    const tortugaTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /托尔图加|tortuga|base_tortuga/i.test(optionDebugText(option)),
                    );
                    if (tortugaTrigger && !capturedSources.has('base_tortuga')) {
                        await expectNoVisibleReactionProxyButtons(page, /托尔图加|tortuga|base_tortuga/i, '压力链托尔图加 afterScoring');
                        await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-selectable', 'true');
                        await expect(page.locator('[data-minion-uid="stress-runnerup-reserve"]').first()).toHaveAttribute('data-highlighted', 'false');
                        await game.screenshot('stress-15-tortuga-source-base-highlight-from-reaction-window', testInfo);
                        await clickReactionTriggerSourceByOption(page, tortugaTrigger, '压力链托尔图加 afterScoring');
                        continue;
                    }

                    const krakenTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /克拉肯|kraken|pirates_the_kraken/i.test(optionDebugText(option)),
                    );
                    if (krakenTrigger && !capturedSources.has('titan_pirates_the_kraken_choose_minion')) {
                        await expectNoVisibleReactionProxyButtons(page, /克拉肯|kraken|pirates_the_kraken/i, '压力链克拉肯 afterScoring');
                        const kraken = page.locator('[data-titan-uid="stress-kraken"]').first();
                        await expect(kraken).toHaveAttribute('data-highlighted', 'true');
                        await expect(page.locator('[data-minion-uid="stress-kraken-save"]').first()).toHaveAttribute('data-highlighted', 'false');
                        await expectStandardObjectHighlight(
                            kraken,
                            '克拉肯泰坦响应窗口来源高亮',
                        );
                        await game.screenshot('stress-11-kraken-source-highlight-from-reaction-window', testInfo);
                        await clickReactionTriggerSourceByOption(page, krakenTrigger, '压力链克拉肯 afterScoring');
                        continue;
                    }

                    await passCurrentSmashupResponse(page);
                    continue;
                }

                if (currentInteraction.sourceId === 'pirate_full_sail_choose_minion') {
                    const fullSailMinion = page.locator('[data-minion-uid="stress-full-sail-move"]').first();
                    if (
                        !capturedSources.has('pirate_full_sail_move')
                        && await fullSailMinion.isVisible({ timeout: 500 }).catch(() => false)
                        && await fullSailMinion.getAttribute('data-highlighted') === 'true'
                    ) {
                        await expect(fullSailMinion).toHaveAttribute('data-highlighted', 'true');
                        await expect(page.getByTestId('base-zone-2')).toHaveAttribute('data-selectable', 'false');
                        await expectStandardObjectHighlight(
                            fullSailMinion,
                            '全速航行随从目标高亮',
                        );
                        await game.screenshot('stress-05b-full-sail-minion-target-highlight-after-hand-click', testInfo);
                        await fullSailMinion.click({ force: true });
                        await page.waitForTimeout(300);
                        continue;
                    }

                    expect(capturedSources.has('pirate_full_sail_move'), '全速航行完成按钮只能在至少移动过一个随从后点击').toBe(true);
                    await clickPromptButtonByOptionId('done', '压力链全速航行完成移动');
                    capturedSources.add('pirate_full_sail');
                    continue;
                }

                if (currentInteraction.sourceId === 'pirate_full_sail_choose_base') {
                    await expect(page.getByTestId('base-zone-2')).toHaveAttribute('data-selectable', 'true');
                    await expect(page.getByTestId('base-zone-2')).toHaveAttribute('data-dimmed', 'false');
                    await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-selectable', 'false');
                    await game.screenshot('stress-05c-full-sail-target-base-highlight-before-move', testInfo);
                    await page.getByTestId('base-zone-2').click({ force: true });
                    capturedSources.add('pirate_full_sail_move');
                    await page.waitForTimeout(300);
                    continue;
                }

                if (currentInteraction.sourceId === 'giant_ant_under_pressure_choose_source') {
                    const sourceMinion = page.locator('[data-minion-uid="stress-pressure-source"]').first();
                    const targetMinion = page.locator('[data-minion-uid="stress-ant-target"]').first();
                    await expect(sourceMinion).toHaveAttribute('data-highlighted', 'true');
                    await expect(targetMinion).toHaveAttribute('data-highlighted', 'false');
                    await expectStandardObjectHighlight(
                        sourceMinion,
                        '承受压力来源随从高亮',
                    );
                    await game.screenshot('stress-06b-under-pressure-source-minion-highlight-before-click', testInfo);
                    await sourceMinion.click({ force: true });
                    await page.waitForTimeout(300);
                    continue;
                }

                if (currentInteraction.sourceId === 'giant_ant_under_pressure_choose_target') {
                    const targetMinion = page.locator('[data-minion-uid="stress-ant-target"]').first();
                    await expect(targetMinion).toHaveAttribute('data-highlighted', 'true');
                    await expect(page.locator('[data-minion-uid="stress-pressure-source"]').first()).toHaveAttribute('data-highlighted', 'false');
                    await expectStandardObjectHighlight(
                        targetMinion,
                        '承受压力目标随从高亮',
                    );
                    await game.screenshot('stress-06c-under-pressure-target-minion-highlight-after-source-click', testInfo);
                    await targetMinion.click({ force: true });
                    await page.waitForTimeout(300);
                    continue;
                }

                if (currentInteraction.sourceId === 'giant_ant_under_pressure_choose_amount') {
                    await setSliderValue(2);
                    await game.screenshot('stress-06d-under-pressure-amount-slider-before-confirm', testInfo);
                    await clickTransferConfirmButton('压力链承受压力数量选择');
                    capturedSources.add('giant_ant_under_pressure');
                    continue;
                }

                if (currentInteraction.sourceId === 'mermaids_shipwreck_cove_after_scoring') {
                    await clickFieldSourceThenTargetBase({
                        source: page.locator('[data-ongoing-uid="stress-shipwreck-cove"]').first(),
                        sourceDescription: '沉船湾计分后持续行动',
                        sourceScreenshot: 'stress-07b-shipwreck-cove-direct-source-highlight',
                        targetBaseIndex: 2,
                        targetScreenshot: 'stress-08-shipwreck-cove-target-base-highlight-after-source-click',
                    });
                    capturedSources.add('mermaids_shipwreck_cove_after_scoring');
                    continue;
                }

                if (currentInteraction.sourceId === 'skeletons_gravestones_after_scoring') {
                    await clickFieldSourceThenTargetBase({
                        source: page.locator('[data-ongoing-uid="stress-gravestones"]').first(),
                        sourceDescription: '墓碑计分后持续行动',
                        sourceScreenshot: 'stress-09b-gravestones-direct-source-highlight',
                        targetBaseIndex: 3,
                        targetScreenshot: 'stress-10-gravestones-target-base-highlight-after-source-click',
                    });
                    capturedSources.add('skeletons_gravestones_after_scoring');
                    continue;
                }

                if (currentInteraction.sourceId === 'titan_pirates_the_kraken_choose_minion') {
                    const kraken = page.locator('[data-titan-uid="stress-kraken"]').first();
                    const targetMinion = page.locator('[data-minion-uid="stress-kraken-save"]').first();
                    if (await kraken.getAttribute('data-selected') !== 'true') {
                        await expect(kraken).toHaveAttribute('data-highlighted', 'true');
                        await expect(kraken).toHaveAttribute('data-selected', 'false');
                        await expect(targetMinion).toHaveAttribute('data-highlighted', 'false');
                        await expectStandardObjectHighlight(
                            kraken,
                            '克拉肯泰坦第一层来源高亮',
                        );
                        await game.screenshot('stress-11-kraken-titan-source-highlight-before-minion-target', testInfo);
                        await kraken.click({ force: true });
                        await page.waitForTimeout(300);
                    }
                    await expect(kraken).toHaveAttribute('data-selected', 'true');
                    await expect(targetMinion).toHaveAttribute('data-highlighted', 'true');
                    await expectStandardObjectHighlight(
                        kraken,
                        '克拉肯泰坦选中态高亮',
                    );
                    await expectStandardObjectHighlight(
                        targetMinion,
                        '克拉肯目标随从高亮',
                    );
                    await game.screenshot('stress-12-kraken-target-minion-highlight-after-source-click', testInfo);
                    await targetMinion.click({ force: true });
                    capturedSources.add('titan_pirates_the_kraken_choose_minion');
                    continue;
                }

                if (currentInteraction.sourceId === 'titan_pirates_the_kraken_choose_base') {
                    await expect(page.getByTestId('base-zone-3')).toHaveAttribute('data-selectable', 'true');
                    await expect(page.getByTestId('base-zone-3')).toHaveAttribute('data-dimmed', 'false');
                    await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-selectable', 'false');
                    await game.screenshot('stress-12b-kraken-followup-target-base-highlight', testInfo);
                    await page.getByTestId('base-zone-3').click({ force: true });
                    capturedSources.add('titan_pirates_the_kraken_choose_base');
                    continue;
                }

                if (currentInteraction.sourceId === 'pirate_first_mate_choose_base') {
                    const firstMate = page.locator('[data-minion-uid="stress-first-mate"]').first();
                    await expect(firstMate).toHaveAttribute('data-highlighted', 'true');
                    await expect(firstMate).toHaveAttribute('data-selected', 'true');
                    await expect(page.getByTestId('base-zone-2')).toHaveAttribute('data-selectable', 'true');
                    await expect(page.getByTestId('base-zone-2')).toHaveAttribute('data-deploy-mode', 'true');
                    await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-selectable', 'false');
                    await game.screenshot('stress-14-first-mate-target-base-highlight-after-source-click', testInfo);
                    await page.getByTestId('base-zone-2').click({ force: true });
                    capturedSources.add('pirate_first_mate_choose_base');
                    continue;
                }

                if (currentInteraction.sourceId === 'base_tortuga') {
                    const moveRunnerUpReserve = currentInteraction.options.find((option) =>
                        option.value?.minionUid === 'stress-runnerup-reserve'
                        && option.value?.fromBaseIndex === 1,
                    );
                    expect(moveRunnerUpReserve, '托尔图加应能选择亚军在其它基地上的随从').toBeTruthy();
                    await expect(page.locator('[data-minion-uid="stress-runnerup-reserve"]').first()).toHaveAttribute('data-highlighted', 'true');
                    await game.screenshot('stress-16-tortuga-runnerup-minion-highlight-after-source-click', testInfo);
                    await respondInteractionOptionIfStillCurrent(page, currentInteraction, moveRunnerUpReserve!.id);
                    capturedSources.add('base_tortuga');
                    continue;
                }

                if (currentInteraction.sourceId === 'giant_ant_we_are_the_champions_choose_source') {
                    const sourceMinion = page.locator('[data-minion-uid="stress-champions-source"]').first();
                    const targetMinion = page.locator('[data-minion-uid="stress-ant-target"]').first();
                    await expect(sourceMinion).toHaveAttribute('data-highlighted', 'true');
                    await expect(targetMinion).toHaveAttribute('data-highlighted', 'false');
                    await expectStandardObjectHighlight(
                        sourceMinion,
                        '我们乃最强来源随从高亮',
                    );
                    await game.screenshot('stress-16c-champions-source-minion-highlight-before-click', testInfo);
                    await sourceMinion.click({ force: true });
                    await page.waitForTimeout(300);
                    continue;
                }

                if (currentInteraction.sourceId === 'giant_ant_we_are_the_champions_choose_snapshot_source') {
                    await game.screenshot('stress-16c-champions-snapshot-source-card-choice-before-click', testInfo);
                    await chooseCurrentInteractionOptionMatching(
                        page,
                        (option) => option.value?.minionUid === 'stress-champions-source',
                        '压力链我们乃最强计分后快照来源',
                    );
                    continue;
                }

                if (currentInteraction.sourceId === 'giant_ant_we_are_the_champions_choose_target') {
                    const targetMinion = page.locator('[data-minion-uid="stress-ant-target"]').first();
                    await expect(targetMinion).toHaveAttribute('data-highlighted', 'true');
                    await expectStandardObjectHighlight(
                        targetMinion,
                        '我们乃最强目标随从高亮',
                    );
                    await game.screenshot('stress-16d-champions-target-minion-highlight-after-source-click', testInfo);
                    await targetMinion.click({ force: true });
                    await page.waitForTimeout(300);
                    continue;
                }

                if (currentInteraction.sourceId === 'giant_ant_we_are_the_champions_choose_amount') {
                    await setSliderValue(2);
                    await game.screenshot('stress-16e-champions-amount-slider-before-confirm', testInfo);
                    await clickTransferConfirmButton('压力链我们乃最强数量选择');
                    capturedSources.add('giant_ant_we_are_the_champions');
                    continue;
                }

                throw new Error(`最复杂计分压力链遇到未预期交互: ${currentInteraction.sourceId}`);
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
                { timeout: 45000, polling: 100 },
            );

            const finalState = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const bases = state?.core?.bases ?? [];
                const findOngoingBase = (uid: string) => bases.findIndex((base: any) =>
                    (base.ongoingActions ?? []).some((action: any) => action.uid === uid),
                );
                const findBuriedBase = (uid: string) => bases.findIndex((base: any) =>
                    (base.buriedCards ?? []).some((card: any) => card.uid === uid || card.cardUid === uid),
                );
                const findMinionBase = (uid: string) => bases.findIndex((base: any) =>
                    (base.minions ?? []).some((minion: any) => minion.uid === uid),
                );
                const findMinion = (uid: string) => {
                    for (let baseIndex = 0; baseIndex < bases.length; baseIndex += 1) {
                        const minion = (bases[baseIndex].minions ?? []).find((candidate: any) => candidate.uid === uid);
                        if (minion) return { baseIndex, minion };
                    }
                    return null;
                };
                const antTarget = findMinion('stress-ant-target');
                return {
                    phase: state?.sys?.phase,
                    currentPlayerIndex: state?.core?.currentPlayerIndex,
                    interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                    responseWindowId: state?.sys?.responseWindow?.current?.id ?? null,
                    triggerQueueLength: state?.core?.triggerQueue?.length ?? 0,
                    baseDefIds: bases.map((base: any) => base.defId),
                    p0Vp: state?.core?.players?.['0']?.vp ?? 0,
                    p1Vp: state?.core?.players?.['1']?.vp ?? 0,
                    p2Vp: state?.core?.players?.['2']?.vp ?? 0,
                    p3Vp: state?.core?.players?.['3']?.vp ?? 0,
                    shipwreckBaseIndex: findOngoingBase('stress-shipwreck-cove'),
                    gravestonesBuriedBaseIndex: findBuriedBase('stress-gravestones'),
                    krakenSavedBaseIndex: findMinionBase('stress-kraken-save'),
                    firstMateBaseIndex: findMinionBase('stress-first-mate'),
                    tortugaMovedBaseIndex: findMinionBase('stress-runnerup-reserve'),
                    fullSailMovedBaseIndex: findMinionBase('stress-full-sail-move'),
                    antTargetBaseIndex: antTarget?.baseIndex ?? -1,
                    antTargetCounters: antTarget?.minion?.powerCounters ?? null,
                    baseMinionUids: bases.map((base: any) => (base.minions ?? []).map((minion: any) => minion.uid)),
                };
            });

            expect(finalState.phase).toBe('playCards');
            expect(finalState.currentPlayerIndex).toBe(1);
            expect(finalState.interactionSourceId).toBeNull();
            expect(finalState.responseWindowId).toBeNull();
            expect(finalState.triggerQueueLength).toBe(0);
            expect(finalState.p0Vp).toBeGreaterThan(0);
            expect(finalState.p1Vp).toBeGreaterThan(0);
            expect(finalState.p2Vp).toBeGreaterThan(0);
            expect(finalState.shipwreckBaseIndex).toBe(2);
            expect(finalState.gravestonesBuriedBaseIndex).toBe(3);
            expect(finalState.krakenSavedBaseIndex).toBe(3);
            expect(finalState.firstMateBaseIndex).toBe(2);
            expect(finalState.tortugaMovedBaseIndex).toBe(0);
            expect(finalState.fullSailMovedBaseIndex).toBe(2);
            expect(finalState.antTargetBaseIndex).toBe(2);
            expect(finalState.antTargetCounters).toBe(4);
            if (capturedSources.has('pirate_full_sail_move') && finalState.fullSailMovedBaseIndex === 2) {
                capturedSources.add('pirate_full_sail');
            }

            for (const source of [
                'pirate_king_move',
                'pirate_full_sail',
                'giant_ant_under_pressure',
                'hand-response',
                'giant_ant_we_are_the_champions',
                'mermaids_shipwreck_cove_after_scoring',
                'skeletons_gravestones_after_scoring',
                'titan_pirates_the_kraken_choose_minion',
                'titan_pirates_the_kraken_choose_base',
                'pirate_first_mate_choose_base',
                'base_tortuga',
            ]) {
                expect(capturedSources.has(source), `压力链必须真实跑过 ${source}`).toBe(true);
            }

            await expect(page.getByTestId('su-interaction-select-banner')).toBeHidden({ timeout: 10000 });
            await expect(page.getByTestId('su-reaction-hand-status')).toBeHidden({ timeout: 10000 });
            await expect(page.getByTestId('su-reaction-pass-button')).toBeHidden({ timeout: 10000 });
            await waitForVisibleSmashUpCardArt(page, 8);
            await game.screenshot('stress-20-final-no-residual-after-all-interleaved-effects', testInfo);
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
                    const tortugaTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /托尔图加|tortuga|base_tortuga/i.test(optionDebugText(option)),
                    );
                    if (tortugaTrigger) {
                        await expectNoVisibleReactionProxyButtons(page, /托尔图加|tortuga|base_tortuga/i, '四人链托尔图加计分后可选效果第一层');
                        await clickReactionTriggerSourceByOption(page, tortugaTrigger, '四人链托尔图加计分后可选效果');
                        continue;
                    }

                    const firstMateTrigger = findReactionTriggerOptionMatching(
                        currentInteraction,
                        (option) => /大副|first mate|pirate_first_mate/i.test(optionDebugText(option)),
                    );
                    if (firstMateTrigger) {
                        await expectNoVisibleReactionProxyButtons(page, /大副|first mate|pirate_first_mate/i, '四人链大副计分后可选效果第一层');
                        await clickReactionTriggerSourceByOption(page, firstMateTrigger, '四人链大副计分后可选效果');
                        continue;
                    }

                    const unmappedTrigger = findReactionTriggerOptionMatching(currentInteraction, () => true);
                    if (unmappedTrigger) {
                        await clickReactionTriggerSourceByOption(page, unmappedTrigger, '四人链其它场上可选效果');
                        continue;
                    }

                    const nextOption = currentInteraction.options.find((option: any) => option.id !== 'skip');
                    expect(nextOption).toBeTruthy();
                    await respondCurrentInteractionByOptionId(page, nextOption!.id);
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
                const tortugaReaction = await readCurrentInteraction(page);
                const tortugaTrigger = findReactionTriggerOptionMatching(
                    tortugaReaction,
                    (option) => /托尔图加|tortuga|base_tortuga/i.test(optionDebugText(option)),
                );
                expect(tortugaTrigger, '三基地黄金链里的托尔图加 afterScoring 必须保留真实响应触发选项').toBeTruthy();
                await expectNoVisibleReactionProxyButtons(page, /托尔图加|tortuga|base_tortuga/i, '三基地黄金链托尔图加 afterScoring');
                await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-selectable', 'true');
                await game.screenshot('golden-04-tortuga-source-base-highlight-before-trigger', testInfo);
                await clickReactionTriggerSourceByOption(page, tortugaTrigger!, '三基地黄金链托尔图加 afterScoring');
            }

            await waitForInteractionSourceIn(page, ['base_tortuga'], 20000);
            const tortugaInteraction = await readCurrentInteraction(page);
            expect(tortugaInteraction?.sourceId).toBe('base_tortuga');
            const moveRunnerUpMinion = tortugaInteraction?.options.find((option) => option.value?.minionUid === 'p0-b1-runnerup');
            expect(moveRunnerUpMinion, '托尔图加应允许亚军移动另一基地上的随从').toBeTruthy();
            await waitForVisibleSmashUpCardArt(page, 12);
            await game.screenshot('golden-05-tortuga-runner-up-minion-choice-after-source-click', testInfo);
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
            await game.screenshot('golden-06-after-first-base-cleared-replaced-back-to-scoring-choice', testInfo);

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
            await game.screenshot('golden-07-final-scoring-complete-no-duplicate-vp', testInfo);
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
                const tortugaReaction = await readCurrentInteraction(page);
                const tortugaTrigger = findReactionTriggerOptionMatching(
                    tortugaReaction,
                    (option) => /托尔图加|tortuga|base_tortuga/i.test(optionDebugText(option)),
                );
                expect(tortugaTrigger, '托尔图加 afterScoring 必须保留真实响应触发选项').toBeTruthy();
                await expectNoVisibleReactionProxyButtons(page, /托尔图加|tortuga|base_tortuga/i, '托尔图加 afterScoring');
                await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-selectable', 'true');
                await game.screenshot('tortuga-02-source-base-highlight-before-trigger', testInfo);
                await clickReactionTriggerSourceByOption(page, tortugaTrigger!, '托尔图加 afterScoring');
            }
            await waitForInteractionSourceIn(page, ['base_tortuga'], 20000);

            const tortugaInteraction = await readCurrentInteraction(page);
            expect(tortugaInteraction?.sourceId).toBe('base_tortuga');
            const moveOption = tortugaInteraction?.options.find((option) => (
                option.value?.minionUid === 'runner-up-traveler'
            ));
            expect(moveOption).toBeTruthy();
            await game.screenshot('tortuga-03-minion-choice-after-source-click', testInfo);
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

            await game.screenshot('tortuga-04-moved-to-replacement-base', testInfo);
        } catch (error) {
            if (diagnostics.errors.length > 0) {
                console.log('[page-diagnostics]', diagnostics.errors);
            }
            throw error;
        }
    });
});
