import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../framework';

async function saveStableScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
    const dir = join(testInfo.config.rootDir, 'evidence', 'screenshots');
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
}

async function waitForMagnifyOverlay(page: Page): Promise<void> {
    const overlay = page.locator('[data-testid="su-card-magnify-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await expect(overlay.locator('[data-testid="su-card-magnify-content"]')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(150);
}

async function closeMagnifyOverlay(page: Page): Promise<void> {
    const overlay = page.locator('[data-testid="su-card-magnify-overlay"]');
    await overlay.getByRole('button').click();
    await expect(overlay).toHaveCount(0);
}

async function longPressTouch(locator: ReturnType<Page['locator']>, page: Page): Promise<void> {
    await locator.evaluate(async (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        const pointerId = 77;

        element.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerId,
            pointerType: 'touch',
            clientX,
            clientY,
        }));

        await new Promise<void>((resolve) => window.setTimeout(resolve, 720));

        element.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true,
            pointerId,
            pointerType: 'touch',
            clientX,
            clientY,
        }));
    });
    await page.waitForTimeout(120);
}

test.describe('Smash Up 牌库检索交互', () => {
    test('悬浮机器人应显示可选卡牌并允许打出', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['pirate_first_mate', 'pirate_swashbuckler'],
            },
            player1: {
                hand: [],
                deck: [],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('robot_hoverbot', { targetBaseIndex: 0 });
        await game.waitForInteraction('robot_hoverbot');

        const playCardOption = page.locator('[data-option-id="play"]').first();
        const cardOptions = page.locator('[data-testid^="prompt-card-"]');
        await expect(playCardOption).toBeVisible();
        await expect(cardOptions).toHaveCount(1);

        const options = await game.getInteractionOptions();
        expect(options.map((option: any) => option.id)).toEqual(expect.arrayContaining(['play', 'skip']));

        const skipButton = page.getByRole('button', { name: /放回牌库顶|跳过|skip/i });
        await expect(skipButton).toBeVisible();

        await game.screenshot('hoverbot-interaction-visible', testInfo);

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const interaction = harness?.state?.get?.()?.sys?.interaction?.current;
            harness?.command?.dispatch?.({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: interaction?.playerId,
                payload: { optionId: 'play' },
            });
        });
        await page.waitForTimeout(300);
        const hoverbotResolution = await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                const current = state?.sys?.interaction?.current;
                if (current?.data?.sourceId === 'robot_hoverbot_base') {
                    return { needsBaseSelection: true };
                }
                const base0HasTopDeckMinion = state?.core?.bases?.[0]?.minions?.some(
                    (minion: any) => minion.defId === 'pirate_first_mate',
                );
                if (!current && base0HasTopDeckMinion) {
                    return { needsBaseSelection: false };
                }
                return null;
            },
            { timeout: 5000, polling: 200 },
        );
        const { needsBaseSelection } = await hoverbotResolution.jsonValue() as { needsBaseSelection: boolean };
        if (needsBaseSelection) {
            await game.selectBase(0);
            await game.waitForNoInteraction();
        }

        const finalState = await game.getState();
        const base0Minions = finalState.core.bases[0].minions.filter((minion: any) => minion.controller === '0');
        expect(base0Minions.some((minion: any) => minion.defId === 'robot_hoverbot')).toBe(true);
        expect(base0Minions.some((minion: any) => minion.defId === 'pirate_first_mate')).toBe(true);

        await game.screenshot('hoverbot-played-pirate', testInfo);
    });

    test('狮身人面像埋葬牌交互应直接在场景内翻正面并高亮可选牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['ancient_egyptians', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_pyramids',
                    buriedCards: [
                        {
                            uid: 'sphinx-buried-1',
                            defId: 'robot_warbot',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'hand',
                        },
                    ],
                },
            ],
            extra: {
                core: {
                    titans: [
                        {
                            uid: 't-sphinx-setaside',
                            defId: 'sphinx',
                            faction: 'ancient_egyptians',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'setaside' },
                        },
                    ],
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'e2e-sphinx-bury-prompt',
                            kind: 'simple-choice',
                            playerId: '0',
                            data: {
                                title: '狮身人面像：选择一张你的埋葬牌，将其回手并把此泰坦放到其所在基地',
                                sourceId: 'titan_sphinx_start_turn',
                                targetType: 'generic',
                                continuationContext: {
                                    titanUid: 't-sphinx-setaside',
                                    titanDefId: 'sphinx',
                                },
                                options: [
                                    {
                                        id: 'buried-sphinx-buried-1',
                                        label: '战斗机器人 @ 金字塔',
                                        value: {
                                            cardUid: 'sphinx-buried-1',
                                            defId: 'robot_warbot',
                                            baseIndex: 0,
                                            baseDefId: 'base_pyramids',
                                        },
                                        displayMode: 'card',
                                    },
                                    {
                                        id: 'skip',
                                        label: '跳过',
                                        value: { skip: true },
                                        displayMode: 'button',
                                    },
                                ],
                            },
                        },
                        queue: [],
                    },
                },
            },
        });

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(interactionMeta.sourceId).toBe('titan_sphinx_start_turn');
        expect(interactionMeta.optionDisplayModes).toEqual(['card', 'button']);

        const cardOptions = page.locator('[data-testid^="prompt-card-"]');
        await expect(cardOptions).toHaveCount(0);

        const buriedCard = page.locator('[data-buried-card-uid="sphinx-buried-1"]').first();
        await expect(buriedCard).toBeVisible();
        await expect(buriedCard).toHaveAttribute('data-buried-face-up', 'true');
        await expect(buriedCard).toHaveAttribute('data-buried-selectable', 'true');
        await expect(page.getByRole('button', { name: '跳过' })).toBeVisible();

        await game.screenshot('sphinx-bury-board-select', testInfo);
        await saveStableScreenshot(page, testInfo, 'sphinx-bury-board-select');

        await buriedCard.hover();
        const buriedInspectButton = page.getByTestId('buried-inspect-sphinx-buried-1');
        await expect(buriedInspectButton).toBeVisible();
        await buriedInspectButton.click();
        await waitForMagnifyOverlay(page);
        await expect(page.locator('[data-testid="su-card-magnify-content"]')).toHaveAttribute('data-card-def-id', 'robot_warbot');
        await game.screenshot('sphinx-bury-board-magnify-open', testInfo);
        await saveStableScreenshot(page, testInfo, 'sphinx-bury-board-magnify-open');
        await closeMagnifyOverlay(page);

        const stateAfterInspect = await game.getState();
        expect(stateAfterInspect.core.bases[0].buriedCards?.some((card: any) => card.uid === 'sphinx-buried-1') ?? false).toBe(true);

        await buriedCard.click();
        await game.waitForNoInteraction();
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                const sphinx = (state?.core?.titans ?? []).find((titan: any) => titan.uid === 't-sphinx-setaside');
                const buriedStillExists = state?.core?.bases?.[0]?.buriedCards?.some((card: any) => card.uid === 'sphinx-buried-1') ?? false;
                return sphinx?.location?.zone === 'base' && sphinx?.location?.baseIndex === 0 && buriedStillExists === false;
            },
            { timeout: 5000, polling: 200 },
        );

        const finalState = await game.getState();
        expect(finalState.core.bases[0].buriedCards?.some((card: any) => card.uid === 'sphinx-buried-1') ?? false).toBe(false);
        const sphinx = (finalState.core.titans ?? []).find((titan: any) => titan.uid === 't-sphinx-setaside');
        expect(sphinx?.location?.zone).toBe('base');
        expect(sphinx?.location?.baseIndex).toBe(0);
    });

    test('狮身人面像埋葬牌交互在手机长按时应只放大不误触选择', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 800, height: 450 });
        await page.goto('/play/smashup?bgForceCoarsePointer=1');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['ancient_egyptians', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_pyramids',
                    buriedCards: [
                        {
                            uid: 'sphinx-buried-mobile-1',
                            defId: 'ancient_egyptians_lost_knowledge',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'hand',
                        },
                    ],
                },
            ],
            extra: {
                core: {
                    titans: [
                        {
                            uid: 't-sphinx-mobile-setaside',
                            defId: 'sphinx',
                            faction: 'ancient_egyptians',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'setaside' },
                        },
                    ],
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'e2e-sphinx-bury-mobile-prompt',
                            kind: 'simple-choice',
                            playerId: '0',
                            data: {
                                title: '狮身人面像：选择一张你的埋葬牌，将其回手并把此泰坦放到其所在基地',
                                sourceId: 'titan_sphinx_start_turn',
                                targetType: 'generic',
                                continuationContext: {
                                    titanUid: 't-sphinx-mobile-setaside',
                                    titanDefId: 'sphinx',
                                },
                                options: [
                                    {
                                        id: 'buried-sphinx-buried-mobile-1',
                                        label: '失落知识 @ 金字塔',
                                        displayMode: 'card',
                                        value: {
                                            cardUid: 'sphinx-buried-mobile-1',
                                            defId: 'ancient_egyptians_lost_knowledge',
                                            baseIndex: 0,
                                            baseDefId: 'base_pyramids',
                                        },
                                    },
                                    { id: 'skip', label: '跳过', displayMode: 'button', value: { skip: true } },
                                ],
                            },
                        },
                        queue: [],
                    },
                },
            },
        });

        const buriedCard = page.locator('[data-buried-card-uid="sphinx-buried-mobile-1"]').first();
        await expect(buriedCard).toBeVisible();
        await expect(buriedCard).toHaveAttribute('data-buried-face-up', 'true');
        await expect(buriedCard).toHaveAttribute('data-buried-selectable', 'true');

        await longPressTouch(buriedCard, page);
        await waitForMagnifyOverlay(page);
        await expect(page.locator('[data-testid="su-card-magnify-content"]')).toHaveAttribute('data-card-def-id', 'ancient_egyptians_lost_knowledge');
        await game.screenshot('sphinx-bury-mobile-long-press-magnify', testInfo);
        await saveStableScreenshot(page, testInfo, 'sphinx-bury-mobile-long-press-magnify');
        await closeMagnifyOverlay(page);

        const stateAfterLongPress = await game.getState();
        expect(stateAfterLongPress.core.bases[0].buriedCards?.some((card: any) => card.uid === 'sphinx-buried-mobile-1') ?? false).toBe(true);
        expect(stateAfterLongPress.sys.interaction?.current?.id).toBe('e2e-sphinx-bury-mobile-prompt');

        await buriedCard.click();
        await game.waitForNoInteraction();
        const finalState = await game.getState();
        expect(finalState.core.bases[0].buriedCards?.some((card: any) => card.uid === 'sphinx-buried-mobile-1') ?? false).toBe(false);
        const sphinx = (finalState.core.titans ?? []).find((titan: any) => titan.uid === 't-sphinx-mobile-setaside');
        expect(sphinx?.location?.zone).toBe('base');
        expect(sphinx?.location?.baseIndex).toBe(0);
    });

    test('狮身人面像埋葬牌交互遇到 stale 选项时应只保留仍存在的埋葬牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['ancient_egyptians', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_pyramids',
                    buriedCards: [
                        {
                            uid: 'sphinx-buried-real',
                            defId: 'robot_warbot',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'hand',
                        },
                    ],
                },
            ],
            extra: {
                core: {
                    titans: [
                        {
                            uid: 't-sphinx-stale',
                            defId: 'sphinx',
                            faction: 'ancient_egyptians',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'setaside' },
                        },
                    ],
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'e2e-prior-step',
                            kind: 'simple-choice',
                            playerId: '0',
                            data: {
                                title: '前置步骤：继续到狮身人面像交互',
                                sourceId: 'e2e_prior_step',
                                targetType: 'button',
                                options: [
                                    {
                                        id: 'continue',
                                        label: '继续',
                                        value: { continue: true },
                                        displayMode: 'button',
                                    },
                                ],
                            },
                        },
                        queue: [
                            {
                                id: 'e2e-sphinx-bury-stale-prompt',
                                kind: 'simple-choice',
                                playerId: '0',
                                data: {
                                    title: '狮身人面像：选择一张你的埋葬牌，将其回手并把此泰坦放到其所在基地',
                                    sourceId: 'titan_sphinx_start_turn',
                                    targetType: 'generic',
                                    autoRefresh: 'buried',
                                    responseValidationMode: 'live',
                                    continuationContext: {
                                        titanUid: 't-sphinx-stale',
                                        titanDefId: 'sphinx',
                                    },
                                    options: [
                                        {
                                            id: 'buried-sphinx-buried-real',
                                            label: '战斗机器人 @ 金字塔',
                                            value: {
                                                cardUid: 'sphinx-buried-real',
                                                defId: 'robot_warbot',
                                                baseIndex: 0,
                                                baseDefId: 'base_pyramids',
                                            },
                                            displayMode: 'card',
                                        },
                                        {
                                            id: 'buried-sphinx-buried-stale',
                                            label: '过期埋葬牌 @ 金字塔',
                                            value: {
                                                cardUid: 'sphinx-buried-stale',
                                                defId: 'pirate_first_mate',
                                                baseIndex: 0,
                                                baseDefId: 'base_pyramids',
                                            },
                                            displayMode: 'card',
                                        },
                                        {
                                            id: 'skip',
                                            label: '跳过',
                                            value: { skip: true },
                                            displayMode: 'button',
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            },
        });

        await page.getByRole('button', { name: '继续' }).click();

        await expect.poll(async () => {
            return page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const current = harness?.state?.get?.()?.sys?.interaction?.current;
                return (current?.data?.options ?? []).map((option: any) => option.id);
            });
        }, { timeout: 5000 }).toEqual(['buried-sphinx-buried-real', 'skip']);

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                autoRefresh: current?.data?.autoRefresh,
                responseValidationMode: current?.data?.responseValidationMode,
                optionIds: (current?.data?.options ?? []).map((option: any) => option.id),
            };
        });

        expect(interactionMeta.sourceId).toBe('titan_sphinx_start_turn');
        expect(interactionMeta.autoRefresh).toBe('buried');
        expect(interactionMeta.responseValidationMode).toBe('live');
        expect(interactionMeta.optionIds).toEqual(['buried-sphinx-buried-real', 'skip']);

        const realBuriedCard = page.locator('[data-buried-card-uid="sphinx-buried-real"]').first();
        await expect(realBuriedCard).toBeVisible();
        await expect(realBuriedCard).toHaveAttribute('data-buried-face-up', 'true');
        await expect(realBuriedCard).toHaveAttribute('data-buried-selectable', 'true');
        await expect(page.locator('[data-buried-card-uid="sphinx-buried-stale"]')).toHaveCount(0);
        await expect(page.getByRole('button', { name: '跳过' })).toBeVisible();

        await game.screenshot('sphinx-bury-stale-options-filtered', testInfo);
        await saveStableScreenshot(page, testInfo, 'sphinx-bury-stale-options-filtered');

        await realBuriedCard.click();
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.bases[0].buriedCards?.some((card: any) => card.uid === 'sphinx-buried-real') ?? false).toBe(false);
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'sphinx-buried-real')).toBe(true);
        const sphinx = (finalState.core.titans ?? []).find((titan: any) => titan.uid === 't-sphinx-stale');
        expect(sphinx?.location?.zone).toBe('base');
        expect(sphinx?.location?.baseIndex).toBe(0);
    });

    test('企鹅帝皇天赋交互应显示卡牌选项而不是文字按钮', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [{ uid: 'emperor-hand-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' }],
                deck: [{ uid: 'emperor-existing-deck', defId: 'robot_microbot_guard', type: 'minion', owner: '0' }],
                discard: [],
                factions: ['penguins', 'pirates'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['robots', 'ninjas'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            ],
            extra: {
                core: {
                    enabledExpansions: ['titans'],
                    titans: [
                        {
                            uid: 't-emperor-talent',
                            defId: 'penguins_emperor_penguin',
                            faction: 'penguins',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                        },
                    ],
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'e2e-emperor-penguin-talent',
                            kind: 'simple-choice',
                            playerId: '0',
                            data: {
                                title: '企鹅帝皇：选择要洗回牌库的低战力随从',
                                sourceId: 'titan_penguins_emperor_penguin_talent',
                                targetType: 'generic',
                                options: [
                                    {
                                        id: 'emperor-hand-minion',
                                        label: '大副（手牌）',
                                        value: {
                                            cardUid: 'emperor-hand-minion',
                                            defId: 'pirate_first_mate',
                                            zone: 'hand',
                                        },
                                        displayMode: 'card',
                                    },
                                ],
                            },
                        },
                        queue: [],
                    },
                },
            },
        });

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(interactionMeta.sourceId).toBe('titan_penguins_emperor_penguin_talent');
        expect(interactionMeta.optionDisplayModes).toEqual(['card']);

        const cardOption = page.locator('[data-option-id="emperor-hand-minion"]').first();
        await expect(cardOption).toBeVisible();
        await expect(page.locator('[data-testid^="prompt-card-"]')).toHaveCount(1);
        await expect(page.getByRole('button', { name: '大副（手牌）' })).toHaveCount(0);

        await game.screenshot('emperor-penguin-talent-card-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'emperor-penguin-talent-card-prompt');

        await cardOption.click();
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return !harness?.state?.get?.()?.sys?.interaction?.current;
            },
            { timeout: 5000, polling: 200 },
        );

        const finalState = await game.getState();
        const emperorPenguin = finalState.core.titans.find((candidate: any) => candidate.uid === 't-emperor-talent');
        expect(emperorPenguin?.powerCounters).toBe(1);
        expect(finalState.core.players['0'].hand.map((card: any) => card.uid)).not.toContain('emperor-hand-minion');
        expect(finalState.core.players['0'].deck.map((card: any) => card.uid)).toEqual(
            expect.arrayContaining(['emperor-existing-deck', 'emperor-hand-minion']),
        );
    });

    test('嫩芽牌库检索交互应显示卡牌选项并允许跳过', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [
                    { uid: 'sprout-deck-1', defId: 'killer_plant_sprout', type: 'minion' },
                    { uid: 'sprout-deck-2', defId: 'wizard_neophyte', type: 'minion' },
                    { uid: 'sprout-deck-3', defId: 'robot_tech_center', type: 'action' },
                ],
                field: [
                    { uid: 'sprout-field-1', defId: 'killer_plant_sprout', baseIndex: 0, power: 2 },
                ],
            },
            player1: {
                hand: [],
                deck: [],
            },
            bases: [
                {
                    defId: 'base_secret_garden',
                    breakpoint: 20,
                    power: 2,
                    minions: [],
                },
            ],
            currentPlayer: '1',
            phase: 'playCards',
        });

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return (
                    state?.sys?.phase === 'playCards' &&
                    state?.core?.currentPlayerIndex === 1 &&
                    state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === 'sprout-field-1') &&
                    state?.core?.players?.['0']?.deck?.length === 3
                );
            },
            { timeout: 5000, polling: 200 },
        );

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
        });

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return state?.sys?.interaction?.current?.data?.sourceId === 'killer_plant_sprout_search';
            },
            { timeout: 10000, polling: 200 },
        );

        const cardOptions = page.locator('[data-testid^="prompt-card-"]');
        await expect(cardOptions.first()).toBeVisible();
        await expect(cardOptions).toHaveCount(2);

        const skipButton = page.getByRole('button', { name: /放回牌库顶|跳过|skip/i });
        await expect(skipButton).toBeVisible();

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const current = state?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                targetType: current?.data?.targetType,
                autoRefresh: current?.data?.autoRefresh,
                responseValidationMode: current?.data?.responseValidationMode,
                optionIds: (current?.data?.options ?? []).map((option: any) => option.id),
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(interactionMeta.sourceId).toBe('killer_plant_sprout_search');
        expect(interactionMeta.targetType).toBe('generic');
        expect(interactionMeta.autoRefresh).toBe('deck');
        expect(interactionMeta.responseValidationMode).toBe('live');
        expect(interactionMeta.optionIds).toEqual(expect.arrayContaining(['minion-0', 'minion-1', 'skip']));
        expect(interactionMeta.optionDisplayModes.filter((mode: string) => mode === 'card')).toHaveLength(2);

        await game.screenshot('sprout-prompt-visible', testInfo);
        await saveStableScreenshot(page, testInfo, 'sprout-prompt-visible');

        await skipButton.click();

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return !state?.sys?.interaction?.current;
            },
            { timeout: 5000, polling: 200 },
        );

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'sprout-field-1')).toBe(false);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.controller === '0')).toBe(false);
        expect(finalState.core.players['0'].deck).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ defId: 'killer_plant_sprout' }),
                expect.objectContaining({ defId: 'wizard_neophyte' }),
            ]),
        );

        await game.screenshot('sprout-prompt-skipped', testInfo);
        await saveStableScreenshot(page, testInfo, 'sprout-prompt-skipped');
    });

    test('疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                factions: ['aliens', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await expect(page.locator('[data-testid="su-madness-supply"]')).toHaveCount(0);
        await game.screenshot('madness-supply-hidden', testInfo);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['cthulhu_whispers_in_darkness'],
                deck: ['alien_invader', 'robot_hoverbot'],
                factions: ['minions_of_cthulhu', 'aliens'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    madnessDeck: Array.from({ length: 30 }, () => 'special_madness'),
                },
            },
        });

        await expect(page.getByTestId('su-madness-supply')).toBeVisible();
        await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 30');
        await game.screenshot('madness-supply-initial', testInfo);

        await game.playCard('cthulhu_whispers_in_darkness');

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.madnessDeck?.length === 29
                    && state?.core?.players?.['0']?.hand?.some((card: any) => card.defId === 'special_madness');
            },
            { timeout: 5000, polling: 200 },
        );

        await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 29');
        await game.screenshot('madness-supply-after-draw', testInfo);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [{ uid: 'madness-hand-1', defId: 'special_madness', type: 'action' }],
                deck: ['alien_invader'],
                factions: ['minions_of_cthulhu', 'aliens'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    madnessDeck: Array.from({ length: 29 }, () => 'special_madness'),
                },
            },
        });

        await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 29');
        const spotlightQueue = page.getByTestId('card-spotlight-queue');
        if (await spotlightQueue.isVisible({ timeout: 200 }).catch(() => false)) {
            await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
        }

        await game.playCard('special_madness');
        await game.waitForInteraction('special_madness');
        await game.selectOption('return');

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return !state?.sys?.interaction?.current
                    && state?.core?.madnessDeck?.length === 29
                    && !state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'madness-hand-1')
                    && !state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === 'madness-hand-1');
            },
            { timeout: 5000, polling: 200 },
        );

        await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 29');
        await page.waitForTimeout(1500);
        await game.screenshot('madness-supply-after-consume', testInfo);
    });
});
