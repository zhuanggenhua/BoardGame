import { test, expect } from './framework';

async function longPressTouch(locator: any, page: any, pointerId: number) {
    const box = await locator.boundingBox();
    expect(box, '长按目标应该先可见').not.toBeNull();

    await locator.evaluate(async (element: HTMLElement, nextPointerId: number) => {
        const rect = element.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        const dispatch = (type: 'pointerdown' | 'pointerup') => {
            element.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                pointerId: nextPointerId,
                pointerType: 'touch',
                clientX,
                clientY,
            }));
        };

        dispatch('pointerdown');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 720));
        dispatch('pointerup');
    }, pointerId);
    await page.waitForTimeout(120);
}

async function closeMagnifyOverlay(page: any) {
    const overlay = page.locator('[data-testid="su-card-magnify-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await overlay.getByRole('button').click();
    await expect(overlay).toHaveCount(0);
}

async function waitForMagnifyPreviewReady(page: any) {
    const overlay = page.locator('[data-testid="su-card-magnify-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await expect
        .poll(async () => overlay.locator('.atlas-shimmer').count(), {
            timeout: 8000,
            message: '放大预览不应停留在 atlas shimmer 占位态',
        })
        .toBe(0);
    await page.waitForTimeout(120);
}

async function clickCenter(locator: any, page: any) {
    const box = await locator.boundingBox();
    expect(box, '点击目标应该先可见').not.toBeNull();
    await locator.dispatchEvent('click');
}

const INITIAL_BASE_IDS = ['base_the_jungle', 'base_dread_lookout', 'base_tsars_palace'] as const;
const REPLACEMENT_BASE_DECK = [
    'base_central_brain',
    'base_cave_of_shinies',
    'base_rhodes_plaza',
    'base_the_factory',
] as const;
const EXPECTED_FINAL_BASE_IDS = ['base_cave_of_shinies', 'base_rhodes_plaza', 'base_central_brain'] as const;
const EXPECTED_FINAL_VP = {
    '0': 7,
    '1': 4,
    '2': 8,
    '3': 10,
} as const;
const MOBILE_LANDSCAPE_VIEWPORT = { width: 800, height: 450 } as const;
const DESKTOP_REFERENCE_VIEWPORT = { width: 1920, height: 1080 } as const;

function createPlayerState(
    playerId: string,
    vp: number,
    factions: [string, string],
) {
    return {
        id: playerId,
        vp,
        hand: [],
        deck: [],
        discard: [],
        factions,
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 1,
        actionLimit: 1,
    };
}

function buildFourPlayerMultiBaseScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    { uid: 'p2-b0-spectre', defId: 'ghost_spectre', owner: '2', controller: '2' },
                    { uid: 'p0-b0-grave-digger', defId: 'zombie_grave_digger', owner: '0', controller: '0' },
                    { uid: 'p1-b0-invader', defId: 'alien_invader', owner: '1', controller: '1' },
                    { uid: 'p3-b0-ghost', defId: 'ghost_ghost', owner: '3', controller: '3' },
                ],
            },
            {
                defId: 'base_dread_lookout',
                breakpoint: 20,
                minions: [
                    { uid: 'p3-b1-king-rex', defId: 'dino_king_rex', owner: '3', controller: '3' },
                    { uid: 'p1-b1-tiger-assassin', defId: 'ninja_tiger_assassin', owner: '1', controller: '1' },
                    { uid: 'p1-b1-collector', defId: 'alien_collector', owner: '1', controller: '1' },
                    { uid: 'p0-b1-grave-digger', defId: 'zombie_grave_digger', owner: '0', controller: '0' },
                    { uid: 'p2-b1-chronomage', defId: 'wizard_chronomage', owner: '2', controller: '2' },
                ],
            },
            {
                defId: 'base_tsars_palace',
                breakpoint: 22,
                minions: [
                    { uid: 'p0-b2-king-rex', defId: 'dino_king_rex', owner: '0', controller: '0' },
                    { uid: 'p2-b2-spirit-a', defId: 'ghost_spirit', owner: '2', controller: '2' },
                    { uid: 'p2-b2-spirit-b', defId: 'ghost_spirit', owner: '2', controller: '2' },
                    { uid: 'p3-b2-spectre', defId: 'ghost_spectre', owner: '3', controller: '3' },
                    { uid: 'p1-b2-tiger-assassin', defId: 'ninja_tiger_assassin', owner: '1', controller: '1' },
                ],
            },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1', '2', '3'],
                turnNumber: 5,
                nextUid: 9000,
                baseDeck: [...REPLACEMENT_BASE_DECK],
                players: {
                    '0': createPlayerState('0', 1, ['dinosaurs', 'zombies']),
                    '1': createPlayerState('1', 2, ['aliens', 'ninjas']),
                    '2': createPlayerState('2', 3, ['ghosts', 'wizards']),
                    '3': createPlayerState('3', 4, ['dinosaurs', 'ghosts']),
                },
            },
        },
    };
}

async function openFourPlayerScoreScene(page: any, game: any) {
    await game.openTestGame('smashup', {
        numPlayers: 4,
        skipInitialization: true,
    });
    await game.setupScene(buildFourPlayerMultiBaseScene());
    await expect.poll(async () => {
        const text = await page.evaluate(() => document.body?.innerText ?? '');
        return text.includes('Loading match resources...');
    }, { timeout: 20000 }).toBe(false);
    await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toBeVisible({ timeout: 15000 });
}

async function getBaseOptions(game: any) {
    const options = await game.getInteractionOptions();
    return options.map((option: any) => ({
        id: option.id as string,
        baseDefId: option.value?.baseDefId as string | undefined,
        baseIndex: option.value?.baseIndex as number | undefined,
        label: option.label as string,
    }));
}

async function selectBaseByDefId(game: any, baseDefId: string) {
    const options = await getBaseOptions(game);
    const option = options.find((entry: any) => entry.baseDefId === baseDefId);
    expect(option, `未找到基地选项 ${baseDefId}`).toBeTruthy();
    await game.selectOption(option!.id);
}

function buildFourPlayerMobileScene() {
    const scene = buildFourPlayerMultiBaseScene();

    return {
        ...scene,
        bases: [
            {
                ...scene.bases[0],
                minions: [
                    {
                        uid: 'p0-b0-armor-stego',
                        defId: 'dino_armor_stego_pod',
                        owner: '0',
                        controller: '0',
                        talentUsed: false,
                        attachedActions: [
                            { uid: 'p0-b0-armor-stego-upgrade', defId: 'dino_tooth_and_claw_pod', ownerId: '0' },
                        ],
                    },
                    ...scene.bases[0].minions.filter((minion) => minion.controller !== '0'),
                ],
                ongoingActions: [
                    { uid: 'p0-b0-base-ongoing', defId: 'zombie_overrun', ownerId: '0', talentUsed: false },
                ],
            },
            ...scene.bases.slice(1),
        ],
        extra: {
            ...scene.extra,
            core: {
                ...scene.extra.core,
                players: {
                    ...scene.extra.core.players,
                    '0': {
                        ...scene.extra.core.players['0'],
                        hand: [
                            { uid: 'p0-mobile-hand-terraform', defId: 'alien_terraform', type: 'action', owner: '0' },
                            { uid: 'p0-mobile-hand-invader', defId: 'alien_invader', type: 'minion', owner: '0' },
                        ],
                    },
                },
            },
        },
    };
}

function buildMonsterWithoutCountersMobileScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    {
                        uid: 'p0-monster-no-counter',
                        defId: 'frankenstein_the_monster_pod',
                        owner: '0',
                        controller: '0',
                        powerCounters: 0,
                        talentUsed: false,
                    },
                ],
            },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 3,
                nextUid: 3000,
                baseDeck: [],
                players: {
                    '0': createPlayerState('0', 0, ['frankenstein', 'aliens']),
                    '1': createPlayerState('1', 0, ['pirates', 'ninjas']),
                },
            },
        },
    };
}

function buildMonsterWithCounterMobileScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    {
                        uid: 'p0-monster-with-counter',
                        defId: 'frankenstein_the_monster_pod',
                        owner: '0',
                        controller: '0',
                        powerCounters: 1,
                        talentUsed: false,
                    },
                ],
            },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 3,
                nextUid: 3001,
                baseDeck: [],
                players: {
                    '0': createPlayerState('0', 0, ['frankenstein', 'aliens']),
                    '1': createPlayerState('1', 0, ['pirates', 'ninjas']),
                },
            },
        },
    };
}

function buildFactionSelectionMobileScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'factionSelect' as const,
        extra: {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                turnNumber: 1,
                nextUid: 1000,
                players: {
                    '0': createPlayerState('0', 0, ['aliens', 'pirates']),
                    '1': createPlayerState('1', 0, ['ninjas', 'dinosaurs']),
                },
                factionSelection: {
                    takenFactions: [],
                    playerSelections: {
                        '0': [],
                        '1': [],
                    },
                },
            },
        },
    };
}

async function expectLocatorInsideViewport(
    locator: any,
    name: string,
    viewportWidth: number,
    viewportHeight: number,
) {
    const box = await locator.boundingBox();
    expect(box, `${name} 应该有可见的布局盒`).not.toBeNull();
    expect(box!.x, `${name} 不应超出左边界`).toBeGreaterThanOrEqual(-2);
    expect(box!.y, `${name} 不应超出上边界`).toBeGreaterThanOrEqual(-2);
    expect(box!.x + box!.width, `${name} 不应超出右边界`).toBeLessThanOrEqual(viewportWidth + 2);
    expect(box!.y + box!.height, `${name} 不应超出下边界`).toBeLessThanOrEqual(viewportHeight + 2);
}

async function waitForSmashUpMainUiReady(page: any) {
    await expect.poll(async () => {
        return await page.evaluate(() => {
            const bodyText = document.body?.innerText ?? '';
            const unresolvedKeys = [
                'ui.you_short',
                'ui.score_sheet',
                'ui.finish_turn',
                'ui.deck',
                'ui.discard',
                'phases.playCards',
            ];

            return !bodyText.includes('Loading match resources...')
                && unresolvedKeys.every((key) => !bodyText.includes(key));
        });
    }, {
        timeout: 15000,
        intervals: [200, 300, 500],
    }).toBe(true);
}

test.describe('大杀四方四人局三基地同时计分', () => {
    test('四人局三基地同时计分时，正确弹出多基地选择交互', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await openFourPlayerScoreScene(page, game);

        const scoreBoard = page.locator('[data-tutorial-id="su-scoreboard"]');
        await expect(scoreBoard).toContainText('P1');
        await expect(scoreBoard).toContainText('P2');
        await expect(scoreBoard).toContainText('P3');

        await game.advancePhase();
        await game.waitForInteraction('multi_base_scoring', 15000);

        await expect(page.getByText('选择先记分的基地')).toBeVisible();

        const baseOptions = await getBaseOptions(game);
        expect(baseOptions).toHaveLength(3);
        expect(baseOptions.map((option: any) => option.baseDefId).sort()).toEqual([...INITIAL_BASE_IDS].sort());

        await game.screenshot('01-four-player-multi-base-prompt', testInfo);
    });

    test('四人局三基地同时计分会按选择顺序依次结算并更新四名玩家VP', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await openFourPlayerScoreScene(page, game);

        await game.advancePhase();
        await game.waitForInteraction('multi_base_scoring', 15000);

        await selectBaseByDefId(game, 'base_tsars_palace');

        await expect.poll(async () => {
            return (await getBaseOptions(game)).map((option: any) => option.baseDefId).sort();
        }).toEqual(['base_dread_lookout', 'base_the_jungle']);
        await expect(page.getByText('选择先记分的基地')).toBeVisible();

        await game.screenshot('02-after-first-base-choice', testInfo);

        await selectBaseByDefId(game, 'base_the_jungle');

        await expect.poll(async () => {
            const state = await game.getState();
            return state.sys?.interaction?.current ? 'active' : 'idle';
        }, { timeout: 15000 }).toBe('idle');

        const finalState = await game.getState();

        expect(finalState.core.turnOrder).toEqual(['0', '1', '2', '3']);
        expect(finalState.core.players['0'].vp).toBe(EXPECTED_FINAL_VP['0']);
        expect(finalState.core.players['1'].vp).toBe(EXPECTED_FINAL_VP['1']);
        expect(finalState.core.players['2'].vp).toBe(EXPECTED_FINAL_VP['2']);
        expect(finalState.core.players['3'].vp).toBe(EXPECTED_FINAL_VP['3']);
        expect(finalState.core.bases.map((base: any) => base.defId)).toEqual([...EXPECTED_FINAL_BASE_IDS]);
        expect(finalState.core.baseDeck).toEqual(['base_the_factory']);

        for (const base of finalState.core.bases) {
            expect(base.minions).toHaveLength(0);
            expect(base.ongoingActions).toHaveLength(0);
        }

        await game.screenshot('03-final-four-player-state', testInfo);
    });

    test('移动端横屏应保持四人局布局可用，并支持手牌长按看牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 4,
            skipInitialization: true,
        });
        await game.setupScene(buildFourPlayerMobileScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 800
                && window.innerHeight === 450
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && (state?.core?.players?.['0']?.hand?.length ?? 0) === 2;
        }, { timeout: 10000, polling: 200 });

        const scoreBoard = page.locator('[data-tutorial-id="su-scoreboard"]');
        const handArea = page.locator('[data-testid="su-hand-area"]');
        const deckStack = page.locator('[data-testid="su-deck-stack"]');
        const discardToggle = page.locator('[data-testid="su-discard-toggle"]');
        const endTurnButton = page.locator('[data-tutorial-id="su-end-turn-btn"]');
        const endTurnActionButton = page.locator('[data-testid="su-end-turn-action-button"]');
        const endTurnVisibilityToggle = page.locator('[data-testid="su-end-turn-visibility-toggle"]');
        const endTurnHints = page.locator('[data-testid="su-end-turn-hints"]');
        const endTurnMinionQuota = page.locator('[data-testid="su-end-turn-minion-quota"]');
        const endTurnActionQuota = page.locator('[data-testid="su-end-turn-action-quota"]');
        const firstBase = page.locator('[data-base-index="0"]');
        const secondBase = page.locator('[data-base-index="1"]');
        const handCard = page.locator('[data-card-uid="p0-mobile-hand-terraform"]').first();
        const inspectButton = page.locator('[data-testid="su-hand-card-inspect-p0-mobile-hand-terraform"]');
        const talentMinion = page.locator('[data-minion-uid="p0-b0-armor-stego"]');
        const baseOngoingCard = page.locator('[data-ongoing-uid="p0-b0-base-ongoing"]');
        const attachedActionCard = page.locator('[data-attached-action-uid="p0-b0-armor-stego-upgrade"]');
        const magnifyOverlay = page.locator('[data-testid="su-card-magnify-overlay"]');
        const exitFabButton = page.locator('[data-fab-id="exit"]').first();
        const exitFabVisual = page.locator('[data-fab-visual-id="exit"]').first();
        const exitFabPanel = page.locator('[data-testid="fab-panel-exit"]');
        const exitFabSheet = page.locator('[data-testid="fab-sheet-exit"]');
        const exitFabSheetBackdrop = page.locator('[data-testid="fab-sheet-backdrop-exit"]');
        const exitFabTooltip = page.locator('[data-testid="fab-tooltip-exit"]');

        await expect(scoreBoard).toBeVisible({ timeout: 15000 });
        await expect(handArea).toBeVisible({ timeout: 15000 });
        await expect(deckStack).toBeVisible({ timeout: 15000 });
        await expect(discardToggle).toBeVisible({ timeout: 15000 });
        await expect(endTurnActionButton).toBeVisible({ timeout: 15000 });
        await expect(endTurnVisibilityToggle).toBeVisible({ timeout: 15000 });
        await expect(endTurnHints).toBeVisible({ timeout: 15000 });
        await expect(endTurnMinionQuota).toBeVisible({ timeout: 15000 });
        await expect(endTurnActionQuota).toBeVisible({ timeout: 15000 });
        await expect(firstBase).toBeVisible({ timeout: 15000 });
        await expect(secondBase).toBeVisible({ timeout: 15000 });
        await expect(handCard).toBeVisible({ timeout: 15000 });
        await expect(exitFabButton).toBeVisible({ timeout: 15000 });
        await expect(exitFabVisual).toBeVisible({ timeout: 15000 });
        await expect(inspectButton).toHaveCSS('opacity', '1');
        await expect(talentMinion).toBeVisible({ timeout: 15000 });
        await expect(baseOngoingCard).toBeVisible({ timeout: 15000 });
        await expect(talentMinion).toHaveAttribute('data-attached-actions-visible', 'false');

        await waitForSmashUpMainUiReady(page);

        const viewport = page.viewportSize();
        expect(viewport).not.toBeNull();

        await expectLocatorInsideViewport(scoreBoard, '记分板', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(deckStack, '牌库', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(discardToggle, '弃牌堆', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(handCard, '手牌卡牌', viewport!.width, viewport!.height);

        await expectLocatorInsideViewport(endTurnButton, '结束回合按钮', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnHints, '结束回合右侧提示容器', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnMinionQuota, '随从额度提示', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnActionQuota, '战术额度提示', viewport!.width, viewport!.height);

        await expectLocatorInsideViewport(endTurnVisibilityToggle, '缁撴潫鍥炲悎闅愯棌鎸夐挳', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnHints, '缁撴潫鍥炲悎鎻愮ず瀹瑰櫒', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnMinionQuota, '闅忎粠棰濆害鎻愮ず', viewport!.width, viewport!.height);
        await expectLocatorInsideViewport(endTurnActionQuota, '鎴樻湳棰濆害鎻愮ず', viewport!.width, viewport!.height);
        const mobileLandscapeDocumentMetrics = await page.evaluate(() => ({
            viewportWidth: window.innerWidth,
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            bodyClientWidth: document.body.clientWidth,
            bodyScrollWidth: document.body.scrollWidth,
            htmlOverflowX: window.getComputedStyle(document.documentElement).overflowX,
            bodyOverflowX: window.getComputedStyle(document.body).overflowX,
            rootOverflowX: window.getComputedStyle(document.getElementById('root')!).overflowX,
        }));
        expect(
            mobileLandscapeDocumentMetrics.documentScrollWidth,
            '手机横屏时 documentElement 不应出现全局横向溢出',
        ).toBeLessThanOrEqual(mobileLandscapeDocumentMetrics.documentClientWidth + 1);
        expect(
            mobileLandscapeDocumentMetrics.bodyScrollWidth,
            '手机横屏时 body 不应出现全局横向溢出',
        ).toBeLessThanOrEqual(mobileLandscapeDocumentMetrics.bodyClientWidth + 1);
        expect(mobileLandscapeDocumentMetrics.htmlOverflowX, '手机横屏时 html 应禁用横向滚动').toBe('hidden');
        expect(mobileLandscapeDocumentMetrics.bodyOverflowX, '手机横屏时 body 应禁用横向滚动').toBe('hidden');

        const handCardBox = await handCard.boundingBox();
        expect(handCardBox, '手牌卡牌应提供尺寸').not.toBeNull();
        expect(handCardBox!.width, '移动端手牌宽度不应过小').toBeGreaterThan(48);

        const endTurnActionButtonBox = await endTurnActionButton.boundingBox();
        expect(endTurnActionButtonBox).not.toBeNull();
        expect(endTurnActionButtonBox!.width).toBeGreaterThan(48);
        expect(endTurnActionButtonBox!.height).toBeGreaterThan(48);

        const exitFabBox = await exitFabVisual.boundingBox();
        expect(exitFabBox).not.toBeNull();
        expect(exitFabBox!.width).toBeLessThanOrEqual(42);
        expect(exitFabBox!.height).toBeLessThanOrEqual(42);

        await game.screenshot('04-mobile-landscape-layout', testInfo);

        await endTurnVisibilityToggle.click();
        await expect(endTurnActionButton).toHaveCount(0);
        await expect(endTurnHints).toHaveCount(0);
        await expect(endTurnVisibilityToggle).toBeVisible({ timeout: 5000 });
        await game.screenshot('04b-mobile-end-turn-hidden', testInfo);

        await endTurnVisibilityToggle.click();
        await expect(endTurnActionButton).toBeVisible({ timeout: 5000 });
        await expect(endTurnHints).toBeVisible({ timeout: 5000 });
        await game.screenshot('04c-mobile-end-turn-restored', testInfo);

        await exitFabButton.click();
        await expect(exitFabPanel).toBeVisible({ timeout: 5000 });
        await expect(exitFabSheet).toBeVisible({ timeout: 5000 });
        await expectLocatorInsideViewport(exitFabPanel, 'exit fab panel', viewport!.width, viewport!.height);
        const exitFabDocumentMetrics = await page.evaluate(() => ({
            htmlOverflowY: window.getComputedStyle(document.documentElement).overflowY,
            bodyOverflowY: window.getComputedStyle(document.body).overflowY,
            htmlOverscrollBehaviorY: window.getComputedStyle(document.documentElement).overscrollBehaviorY,
            bodyOverscrollBehaviorY: window.getComputedStyle(document.body).overscrollBehaviorY,
        }));
        expect(exitFabDocumentMetrics.htmlOverflowY, 'exit fab sheet 打开时 html 不应继续可滚动').toBe('hidden');
        expect(exitFabDocumentMetrics.bodyOverflowY, 'exit fab sheet 打开时 body 不应继续可滚动').toBe('hidden');
        expect(exitFabDocumentMetrics.htmlOverscrollBehaviorY, 'exit fab sheet 打开时 html 不应继续透传滚动').toBe('none');
        expect(exitFabDocumentMetrics.bodyOverscrollBehaviorY, 'exit fab sheet 打开时 body 不应继续透传滚动').toBe('none');
        const exitFabPanelMetrics = await exitFabPanel.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
        }));
        expect(exitFabPanelMetrics.scrollWidth, 'exit fab panel 不应出现横向内容溢出').toBeLessThanOrEqual(exitFabPanelMetrics.clientWidth + 1);
        expect(exitFabPanelMetrics.scrollHeight, 'exit fab panel should not rely on internal scrolling').toBeLessThanOrEqual(exitFabPanelMetrics.clientHeight + 1);
        const exitFabPanelButtons = exitFabPanel.locator('button');
        const exitFabPanelButtonCount = await exitFabPanelButtons.count();
        expect(exitFabPanelButtonCount, 'exit fab panel should expose at least one action button').toBeGreaterThan(0);
        for (let index = 0; index < exitFabPanelButtonCount; index += 1) {
            const panelButton = exitFabPanelButtons.nth(index);
            await expect(panelButton).toBeVisible();
            await expect(panelButton).toBeEnabled();
            await expectLocatorInsideViewport(panelButton, `exit fab panel button ${index + 1}`, viewport!.width, viewport!.height);
        }
        await game.screenshot('04a-mobile-exit-fab-panel', testInfo);
        await exitFabSheetBackdrop.click();
        await expect(exitFabPanel).toHaveCount(0);
        await expect(exitFabSheet).toHaveCount(0);
        await expect(exitFabTooltip).toHaveCount(0);
        await page.mouse.move(12, 12);
        await expect(exitFabTooltip).toHaveCount(0);

        await firstBase.click();
        await expect(magnifyOverlay).toHaveCount(0);

        await clickCenter(talentMinion, page);
        await expect(talentMinion).toHaveAttribute('data-expanded', 'true');
        await expect(talentMinion).toHaveAttribute('data-attached-actions-visible', 'true');
        await expect(talentMinion).toHaveAttribute('data-activation-armed', 'true');
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-b0-armor-stego')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(false);
        await expect(magnifyOverlay).toHaveCount(0);

        await game.screenshot('05-mobile-single-tap-expands-attached-actions', testInfo);

        await clickCenter(talentMinion, page);
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-b0-armor-stego')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(true);
        await expect(talentMinion).toHaveAttribute('data-attached-actions-visible', 'true');
        await expect(talentMinion).toHaveAttribute('data-activation-armed', 'false');

        await game.screenshot('06-mobile-second-tap-uses-talent', testInfo);

        await clickCenter(baseOngoingCard, page);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('06a-mobile-base-ongoing-single-tap-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await clickCenter(attachedActionCard, page);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('06b-mobile-attached-action-single-tap-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await longPressTouch(talentMinion, page, 1);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('07-mobile-minion-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await longPressTouch(secondBase, page, 2);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('08-mobile-base-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await longPressTouch(baseOngoingCard, page, 3);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('09-mobile-base-ongoing-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await longPressTouch(attachedActionCard, page, 4);
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('10-mobile-attached-action-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        await inspectButton.dispatchEvent('click');
        await waitForMagnifyPreviewReady(page);
        await game.screenshot('11-mobile-hand-long-press-magnify', testInfo);
        await closeMagnifyOverlay(page);

        const stateAfterLongPress = await game.getState();
        expect(stateAfterLongPress.core.players['0'].hand.some((card: any) => card.uid === 'p0-mobile-hand-terraform')).toBe(true);
        expect(stateAfterLongPress.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-b0-armor-stego')?.talentUsed).toBe(true);

        await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
        await page.waitForFunction(() => window.innerWidth === 1920 && window.innerHeight === 1080, {
            timeout: 5000,
            polling: 100,
        });
        await waitForSmashUpMainUiReady(page);

        const desktopViewport = page.viewportSize();
        expect(desktopViewport).not.toBeNull();
        await expect(endTurnActionButton).toBeVisible({ timeout: 5000 });
        await expect(endTurnVisibilityToggle).toBeVisible({ timeout: 5000 });
        await expect(endTurnHints).toBeVisible({ timeout: 5000 });
        await expectLocatorInsideViewport(endTurnVisibilityToggle, 'PC 缁撴潫鍥炲悎闅愯棌鎸夐挳', desktopViewport!.width, desktopViewport!.height);

        await endTurnVisibilityToggle.click();
        await expect(endTurnActionButton).toHaveCount(0);
        await expect(endTurnHints).toHaveCount(0);
        await expect(endTurnVisibilityToggle).toBeVisible({ timeout: 5000 });

        await endTurnVisibilityToggle.click();
        await expect(endTurnActionButton).toBeVisible({ timeout: 5000 });
        await expect(endTurnHints).toBeVisible({ timeout: 5000 });
        await game.screenshot('13-desktop-end-turn-restored', testInfo);
    });

    test('移动端不会把没有+1力量指示物的怪物当成可发动天赋', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 812, height: 375 });
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 2,
            skipInitialization: true,
        });
        await game.setupScene(buildMonsterWithoutCountersMobileScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 812
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && state?.core?.bases?.[0]?.minions?.[0]?.uid === 'p0-monster-no-counter';
        }, { timeout: 10000, polling: 200 });

        const monster = page.locator('[data-minion-uid="p0-monster-no-counter"]');

        await expect(monster).toBeVisible({ timeout: 15000 });
        await expect(monster).toHaveAttribute('data-expanded', 'false');
        await expect(monster).toHaveAttribute('data-activation-armed', 'false');

        await clickCenter(monster, page);

        await expect(monster).toHaveAttribute('data-expanded', 'false');
        await expect(monster).toHaveAttribute('data-activation-armed', 'false');
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-monster-no-counter')?.talentUsed ?? false;
        }, { timeout: 5000 }).toBe(false);

        await game.screenshot('12-monster-without-counter-does-not-arm-talent', testInfo);
    });

    test('移动端有+1力量指示物的怪物发动天赋后会移除指示物并提示额外随从机会', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 812, height: 375 });
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });

        await game.openTestGame('smashup', {
            numPlayers: 2,
            skipInitialization: true,
        });
        await game.setupScene(buildMonsterWithCounterMobileScene());

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 812
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'playCards'
                && state?.core?.bases?.[0]?.minions?.[0]?.uid === 'p0-monster-with-counter';
        }, { timeout: 10000, polling: 200 });

        const monster = page.locator('[data-minion-uid="p0-monster-with-counter"]');

        await expect(monster).toBeVisible({ timeout: 15000 });
        await expect(monster).toContainText('+1');
        await expect(monster).toHaveAttribute('data-activation-armed', 'false');

        await clickCenter(monster, page);
        await expect(monster).toHaveAttribute('data-expanded', 'true');
        await expect(monster).toHaveAttribute('data-activation-armed', 'true');
        await expect(page.getByText('再次点击发动')).toBeVisible({ timeout: 5000 });

        await clickCenter(monster, page);

        await expect.poll(async () => {
            const state = await game.getState();
            const player = state.core.players['0'];
            return {
                powerCounters: state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-monster-with-counter')?.powerCounters ?? -1,
                talentUsed: state.core.bases[0].minions.find((minion: any) => minion.uid === 'p0-monster-with-counter')?.talentUsed ?? false,
                minionLimit: player.minionLimit,
            };
        }, { timeout: 5000 }).toEqual({
            powerCounters: 0,
            talentUsed: true,
            minionLimit: 2,
        });

        await expect(page.getByText('获得1次额外随从机会')).toBeVisible({ timeout: 5000 });

        await expect(monster).toHaveAttribute('data-activation-armed', 'false');
        await game.screenshot('13-monster-with-counter-grants-extra-minion', testInfo);
    });
});

test.describe('大杀四方移动端派系选择布局', () => {
    test('横屏移动端打开派系详情时应完整显示并可滚动查看全部卡牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 852, height: 393 });
        await page.addInitScript(() => {
            const query = '(pointer: coarse)';
            const originalMatchMedia = window.matchMedia.bind(window);
            window.matchMedia = ((media: string) => {
                if (media !== query) {
                    return originalMatchMedia(media);
                }

                return {
                    matches: true,
                    media,
                    onchange: null,
                    addListener: () => { },
                    removeListener: () => { },
                    addEventListener: () => { },
                    removeEventListener: () => { },
                    dispatchEvent: () => true,
                } as MediaQueryList;
            }) as typeof window.matchMedia;
        });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildFactionSelectionMobileScene());

        const factionSelect = page.locator('[data-tutorial-id="su-faction-select"]');
        const factionHeading = page.getByText(/Draft Your Factions|选择你的派系/i);
        const aliensCard = factionSelect.getByText(/Aliens|外星人/i).first();
        const rotateBanner = page.getByText(/建议旋转至横屏|建议切换为竖屏/i);

        await expect(factionHeading).toBeVisible({ timeout: 15000 });
        await expect(rotateBanner).toHaveCount(0);
        await expect(aliensCard).toBeVisible({ timeout: 10000 });
        await aliensCard.click();

        const confirmButton = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
        const previewCards = factionSelect.locator('.cursor-zoom-in');
        const previewSection = previewCards.first().locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');

        await expect(confirmButton).toBeVisible({ timeout: 10000 });
        const previewCardCount = await previewCards.count();
        expect(previewCardCount).toBeGreaterThan(8);
        await expect(previewSection).toBeVisible({ timeout: 10000 });

        const scrollMetrics = await previewSection.evaluate((node) => ({
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
        }));
        expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

        await page.waitForTimeout(250);
        await game.screenshot('11-mobile-landscape-faction-detail-top', testInfo);

        await previewCards.last().scrollIntoViewIfNeeded();
        await expect(previewCards.last()).toBeVisible({ timeout: 5000 });

        await game.screenshot('12-mobile-landscape-faction-detail-bottom', testInfo);
    });
});
