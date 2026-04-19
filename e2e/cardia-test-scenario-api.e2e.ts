import { test, expect } from './framework';
import { 
    applyCardiaScenarioToPage,
    readCoreState,
    type CardiaTestScenario,
} from './helpers/cardia';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';

async function hideDebugChrome(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>('[data-testid="debug-toggle-container"]');
        if (toggle) {
            toggle.style.opacity = '0';
            toggle.style.pointerEvents = 'none';
        }

        const debugRoot = Array.from(document.querySelectorAll<HTMLElement>('body *'))
            .find((el) => (el.textContent ?? '').includes('Debug Console'));
        if (debugRoot) {
            debugRoot.style.opacity = '0';
            debugRoot.style.pointerEvents = 'none';
        }
    });
}

async function readHarnessCoreState(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => { core?: unknown };
                };
            };
        }).__BG_TEST_HARNESS__;

        return harness?.state?.get?.()?.core ?? null;
    });
}

/**
 * 测试新的 setupCardiaTestScenario API
 * 
 * 这个测试验证新API是否能正确工作
 */
test.describe('Cardia 测试场景API验证', () => {
    test.describe.configure({ timeout: 120_000 });

    test('基础场景：配置手牌和阶段', async ({ page, game }) => {
        const scenario: CardiaTestScenario = {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'], // 雇佣剑士 + 虚空法师
                deck: ['deck_i_card_03', 'deck_i_card_04'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_03'], // 外科医生
                deck: ['deck_i_card_05', 'deck_i_card_06'],
            },
            phase: 'play',
        };

        await game.openTestGame('cardia');
        await applyCardiaScenarioToPage(page, scenario);

        console.log('\n=== 测试新API：基础场景 ===');

        const initialState = await readCoreState(page);

        console.log('初始状态:', {
            p1HandSize: (initialState.players as Record<string, { hand: unknown[] }>)['0'].hand.length,
            p2HandSize: (initialState.players as Record<string, { hand: unknown[] }>)['1'].hand.length,
            p1DeckSize: (initialState.players as Record<string, { deck: unknown[] }>)['0'].deck.length,
            p2DeckSize: (initialState.players as Record<string, { deck: unknown[] }>)['1'].deck.length,
            phase: initialState.phase,
        });

        expect((initialState.players as Record<string, { hand: unknown[] }>)['0'].hand.length).toBe(2);
        expect((initialState.players as Record<string, { hand: unknown[] }>)['1'].hand.length).toBe(1);
        expect((initialState.players as Record<string, { deck: unknown[] }>)['0'].deck.length).toBe(2);
        expect((initialState.players as Record<string, { deck: unknown[] }>)['1'].deck.length).toBe(2);
        expect(initialState.phase).toBe('play');
    });
    
    test('完整场景：配置已打出的牌和印戒', async ({ page, game }) => {
        const scenario: CardiaTestScenario = {
            player1: {
                hand: ['deck_i_card_01'],
                playedCards: [
                    { defId: 'deck_i_card_02', signets: 1 }, // 之前的牌，有1个印戒
                    { defId: 'deck_i_card_03', signets: 2 }, // 之前的牌，有2个印戒
                ],
            },
            player2: {
                hand: ['deck_i_card_04'],
                playedCards: [
                    { defId: 'deck_i_card_05', signets: 1 },
                ],
            },
            phase: 'play',
        };

        await game.openTestGame('cardia');
        await applyCardiaScenarioToPage(page, scenario);

        console.log('\n=== 测试新API：完整场景 ===');

        const state = await readCoreState(page);
        const p1PlayedCards = (state.players as Record<string, { playedCards: Array<{ seals: number }> }>)['0'].playedCards;
        const p2PlayedCards = (state.players as Record<string, { playedCards: Array<{ seals: number }> }>)['1'].playedCards;

        console.log('已打出的牌:', {
            p1Count: p1PlayedCards.length,
            p2Count: p2PlayedCards.length,
            p1Seals: p1PlayedCards.map(c => c.seals),
            p2Seals: p2PlayedCards.map(c => c.seals),
        });

        expect(p1PlayedCards.length).toBe(2);
        expect(p2PlayedCards.length).toBe(1);
        expect(p1PlayedCards[0].seals).toBe(1);
        expect(p1PlayedCards[1].seals).toBe(2);
        expect(p2PlayedCards[0].seals).toBe(1);

        const p1TotalSeals = p1PlayedCards.reduce((sum, c) => sum + c.seals, 0);
        const p2TotalSeals = p2PlayedCards.reduce((sum, c) => sum + c.seals, 0);
        expect(p1TotalSeals).toBe(3);
        expect(p2TotalSeals).toBe(1);
    });
    test('窄高视口下顶部对手卡应完整显示在战场内', async ({ page, game }, testInfo) => {
        const scenario: CardiaTestScenario = {
            player1: {
                hand: ['deck_i_card_01'],
                deck: ['deck_i_card_02'],
                playedCards: [
                    { defId: 'deck_i_card_03', signets: 1, encounterIndex: 0 },
                ],
            },
            player2: {
                hand: ['deck_i_card_04'],
                deck: ['deck_i_card_05'],
                playedCards: [
                    { defId: 'deck_i_card_06', signets: 1, encounterIndex: 0 },
                ],
            },
            phase: 'play',
        };

        await game.openTestGame('cardia');
        await applyCardiaScenarioToPage(page, scenario);

        await clearEvidenceScreenshotsForTest(testInfo);
        await page.setViewportSize({ width: 1280, height: 640 });
        await page.waitForTimeout(800);
        await hideDebugChrome(page);

        const state = await readHarnessCoreState(page) as Record<string, unknown> | null;
        expect(state, 'TestHarness 应返回 core 状态').not.toBeNull();
        const players = (state!.players as Record<string, { playedCards: Array<{ uid: string }> }>);
        const myCardUid = players['0'].playedCards[0].uid;
        const opponentCardUid = players['1'].playedCards[0].uid;

        const battlefield = page.locator('[data-testid="cardia-battlefield"]');
        await expect(battlefield).toBeVisible({ timeout: 10000 });

        const myCard = page.locator(`[data-testid="card-${myCardUid}"]`);
        const opponentCard = page.locator(`[data-testid="card-${opponentCardUid}"]`);
        await expect(myCard).toBeVisible({ timeout: 10000 });
        await expect(opponentCard).toBeVisible({ timeout: 10000 });

        const battlefieldBox = await battlefield.boundingBox();
        const myCardBox = await myCard.boundingBox();
        const opponentCardBox = await opponentCard.boundingBox();

        expect(battlefieldBox, '战场容器应有边界框').not.toBeNull();
        expect(myCardBox, '己方卡牌应有边界框').not.toBeNull();
        expect(opponentCardBox, '对手卡牌应有边界框').not.toBeNull();

        const cardBoxes = [myCardBox!, opponentCardBox!].sort((a, b) => a.y - b.y);
        const topCardBox = cardBoxes[0];
        const bottomCardBox = cardBoxes[1];

        expect(topCardBox.y, '顶部卡牌顶部不应超出战场').toBeGreaterThanOrEqual(battlefieldBox!.y - 1);
        expect(topCardBox.y + topCardBox.height, '顶部卡牌底部应落在战场内').toBeLessThanOrEqual(battlefieldBox!.y + battlefieldBox!.height + 1);
        expect(bottomCardBox.y, '底部卡牌顶部应落在战场内').toBeGreaterThanOrEqual(battlefieldBox!.y - 1);
        expect(bottomCardBox.y + bottomCardBox.height, '底部卡牌底部不应超出战场').toBeLessThanOrEqual(battlefieldBox!.y + battlefieldBox!.height + 1);

        const viewport = page.viewportSize();
        expect(viewport, '视口尺寸应可用').not.toBeNull();
        expect(topCardBox.y, '顶部卡牌不应被裁到视口外').toBeGreaterThanOrEqual(0);
        expect(topCardBox.y + topCardBox.height, '顶部卡牌底部不应超出视口').toBeLessThanOrEqual(viewport!.height + 1);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'cardia-top-row-layout-1280x640'),
            fullPage: true,
        });
    });

    test('紧凑横屏下底部手牌应完整显示在玩家区内', async ({ page, game }, testInfo) => {
        const scenario: CardiaTestScenario = {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03'],
            },
            player2: {
                hand: ['deck_i_card_04'],
                deck: ['deck_i_card_05'],
            },
            phase: 'play',
        };

        await game.openTestGame('cardia');
        await applyCardiaScenarioToPage(page, scenario);

        await clearEvidenceScreenshotsForTest(testInfo);
        await page.setViewportSize({ width: 800, height: 360 });
        await page.waitForTimeout(800);
        await hideDebugChrome(page);

        const state = await readHarnessCoreState(page) as Record<string, unknown> | null;
        expect(state, 'TestHarness 应返回 core 状态').not.toBeNull();
        const players = (state!.players as Record<string, { hand: Array<{ uid: string }> }>);
        const firstHandCardUid = players['0'].hand[0].uid;

        const playerZone = page.locator('[data-testid="cardia-player-zone"]');
        const handCard = page.locator(`[data-testid="card-${firstHandCardUid}"]`).first();

        await expect(playerZone).toBeVisible({ timeout: 10000 });
        await expect(handCard).toBeVisible({ timeout: 10000 });

        const playerZoneBox = await playerZone.boundingBox();
        const handCardBox = await handCard.boundingBox();
        const compactMetrics = await page.evaluate((cardUid) => {
            const playerZoneEl = document.querySelector<HTMLElement>('[data-testid="cardia-player-zone"]');
            const cardEl = document.querySelector<HTMLElement>(`[data-testid="card-${cardUid}"]`);
            const playerZoneComputed = playerZoneEl ? getComputedStyle(playerZoneEl) : null;
            const cardComputed = cardEl ? getComputedStyle(cardEl) : null;
            const playerZoneRect = playerZoneEl?.getBoundingClientRect();
            const cardRect = cardEl?.getBoundingClientRect();

            const cssZoneHeight = playerZoneComputed ? Number.parseFloat(playerZoneComputed.height) : NaN;
            const cssCardHeight = cardComputed ? Number.parseFloat(cardComputed.height) : NaN;
            const rectZoneHeight = playerZoneRect?.height ?? NaN;
            const rectCardHeight = cardRect?.height ?? NaN;
            const scale = Number.isFinite(cssZoneHeight) && cssZoneHeight > 0
                ? rectZoneHeight / cssZoneHeight
                : NaN;

            return {
                cssZoneHeight,
                cssCardHeight,
                rectZoneHeight,
                rectCardHeight,
                scale,
                expectedScaledCardHeight: Number.isFinite(scale) && Number.isFinite(cssCardHeight)
                    ? cssCardHeight * scale
                    : NaN,
            };
        }, firstHandCardUid);

        expect(playerZoneBox, '玩家区应有边界框').not.toBeNull();
        expect(handCardBox, '手牌卡应有边界框').not.toBeNull();

        expect(handCardBox!.y, '紧凑横屏下手牌顶部不应被裁出玩家区').toBeGreaterThanOrEqual(playerZoneBox!.y - 1);
        expect(handCardBox!.y + handCardBox!.height, '紧凑横屏下手牌底部不应被裁出玩家区').toBeLessThanOrEqual(playerZoneBox!.y + playerZoneBox!.height + 1);
        expect(handCardBox!.width / handCardBox!.height, '紧凑横屏下手牌应保持完整卡面纵横比').toBeCloseTo(106 / 160, 2);
        expect(compactMetrics.expectedScaledCardHeight, '紧凑横屏下手牌应仅被整页等比缩放，不应额外裁切').toBeGreaterThan(0);
        expect(handCardBox!.height, '紧凑横屏下手牌可视高度应与整页缩放后的完整卡高一致').toBeCloseTo(compactMetrics.expectedScaledCardHeight, 0);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'cardia-tight-landscape-hand-complete'),
            fullPage: true,
        });
    });

    test('标准视口下卡牌尺寸应保持原版大小', async ({ page, game }) => {
        const scenario: CardiaTestScenario = {
            player1: {
                hand: ['deck_i_card_01'],
                deck: ['deck_i_card_02'],
                playedCards: [
                    { defId: 'deck_i_card_03', signets: 1, encounterIndex: 0 },
                ],
            },
            player2: {
                hand: ['deck_i_card_04'],
                deck: ['deck_i_card_05'],
                playedCards: [
                    { defId: 'deck_i_card_06', signets: 1, encounterIndex: 0 },
                ],
            },
            phase: 'play',
        };

        await game.openTestGame('cardia');
        await applyCardiaScenarioToPage(page, scenario);

        await page.setViewportSize({ width: 1280, height: 900 });
        await page.waitForTimeout(800);
        await hideDebugChrome(page);

        const state = await readHarnessCoreState(page) as Record<string, unknown> | null;
        expect(state, 'TestHarness 应返回 core 状态').not.toBeNull();
        const players = (state!.players as Record<string, { playedCards: Array<{ uid: string }> }>);
        const myCardUid = players['0'].playedCards[0].uid;

        const myCard = page.locator(`[data-testid="card-${myCardUid}"]`);
        await expect(myCard).toBeVisible({ timeout: 10000 });

        const myCardBox = await myCard.boundingBox();
        expect(myCardBox, '标准视口下卡牌应有边界框').not.toBeNull();
        expect(myCardBox!.width, '标准视口下卡牌宽度应保持原版').toBeGreaterThanOrEqual(104);
        expect(myCardBox!.width, '标准视口下卡牌宽度应保持原版').toBeLessThanOrEqual(108);
        expect(myCardBox!.height, '标准视口下卡牌高度应保持原版').toBeGreaterThanOrEqual(158);
        expect(myCardBox!.height, '标准视口下卡牌高度应保持原版').toBeLessThanOrEqual(162);
    });

    test('紧凑横屏下卡牌选择弹窗确认按钮不应被已聚焦手牌遮挡', async ({ page, game }, testInfo) => {
        const scenario: CardiaTestScenario = {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02', 'deck_i_card_03', 'deck_i_card_04'],
                deck: ['deck_i_card_05'],
            },
            player2: {
                hand: ['deck_i_card_06'],
                deck: ['deck_i_card_07'],
            },
            phase: 'ability',
        };

        await game.openTestGame('cardia');
        await applyCardiaScenarioToPage(page, scenario);

        await clearEvidenceScreenshotsForTest(testInfo);
        await page.setViewportSize({ width: 932, height: 412 });
        await page.waitForTimeout(800);
        await hideDebugChrome(page);

        const state = await readHarnessCoreState(page) as Record<string, unknown> | null;
        expect(state, 'TestHarness 应返回 core 状态').not.toBeNull();
        const players = state!.players as Record<string, { hand: Array<{ uid: string }> }>;
        const focusedHandCardUid = players['0'].hand[2].uid;

        const focusedHandCard = page.locator(`[data-testid="card-${focusedHandCardUid}"]`).first();
        await expect(focusedHandCard).toBeVisible({ timeout: 10000 });
        await focusedHandCard.hover();
        await page.waitForTimeout(200);

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            if (!state) throw new Error('TestHarness state.get 不可用');

            const selectionCards = [
                {
                    uid: 'selection-card-1',
                    defId: 'deck_i_card_08',
                    ownerId: '0',
                    baseInfluence: 3,
                    faction: 'swamp',
                    abilityIds: [],
                    difficulty: 1,
                    modifiers: { entries: [], nextOrder: 0 },
                    tags: { entries: [], nextOrder: 0 },
                    signets: 0,
                    ongoingMarkers: [],
                    imageIndex: 0,
                    imagePath: '',
                    optionId: 'selection-option-1',
                },
                {
                    uid: 'selection-card-2',
                    defId: 'deck_i_card_09',
                    ownerId: '1',
                    baseInfluence: 5,
                    faction: 'academy',
                    abilityIds: [],
                    difficulty: 2,
                    modifiers: { entries: [], nextOrder: 0 },
                    tags: { entries: [], nextOrder: 0 },
                    signets: 0,
                    ongoingMarkers: [],
                    imageIndex: 1,
                    imagePath: '',
                    optionId: 'selection-option-2',
                },
            ];

            harness.state.patch({
                sys: {
                    ...state.sys,
                    interaction: {
                        current: {
                            id: 'cardia-feedback-selection-modal',
                            kind: 'simple-choice',
                            playerId: '0',
                            data: {
                                interactionType: 'card-selection',
                                title: '选择要操作的卡牌',
                                minSelect: 1,
                                maxSelect: 1,
                                cards: selectionCards,
                                options: selectionCards.map((card) => ({
                                    id: card.optionId,
                                    label: card.defId,
                                    value: { cardUid: card.uid },
                                })),
                            },
                        },
                        queue: [],
                        isBlocked: false,
                    },
                },
            });
        });

        const confirmButton = page.getByRole('button', { name: /确认|confirm/i });
        await expect(confirmButton).toBeVisible({ timeout: 10000 });

        const overlapCheck = await page.evaluate(() => {
            const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
                .find((button) => /确认|confirm/i.test(button.textContent ?? ''));
            if (!confirm) return null;
            const rect = confirm.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const topElement = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
            return {
                centerX,
                centerY,
                topTag: topElement?.tagName ?? null,
                topText: topElement?.textContent?.trim() ?? null,
                coveredByButton: !!topElement?.closest('button') && topElement.closest('button') === confirm,
            };
        });

        expect(overlapCheck, '应能命中确认按钮中心点').not.toBeNull();
        expect(overlapCheck!.coveredByButton, '确认按钮中心点顶部元素应仍是弹窗按钮，而不是手牌层').toBe(true);

        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'cardia-selection-modal-over-hand'),
            fullPage: true,
        });
    });

    test('紧凑横屏下长手牌与弃牌堆共存时不应挤出战场与手牌区', async ({ browser }, testInfo) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: [
                    'deck_i_card_01', 'deck_i_card_02', 'deck_i_card_03', 'deck_i_card_04',
                    'deck_i_card_05', 'deck_i_card_06', 'deck_i_card_07', 'deck_i_card_08',
                ],
                deck: ['deck_i_card_09', 'deck_i_card_10'],
                discard: ['deck_i_card_11', 'deck_i_card_12', 'deck_i_card_13', 'deck_i_card_14'],
                playedCards: [
                    { defId: 'deck_i_card_15', signets: 2, encounterIndex: 0 },
                    { defId: 'deck_i_card_16', signets: 1, encounterIndex: 1 },
                ],
            },
            player2: {
                hand: ['deck_i_card_01', 'deck_i_card_02'],
                deck: ['deck_i_card_03', 'deck_i_card_04'],
                discard: ['deck_i_card_05', 'deck_i_card_06', 'deck_i_card_07'],
                playedCards: [
                    { defId: 'deck_i_card_08', signets: 1, encounterIndex: 0 },
                    { defId: 'deck_i_card_09', signets: 2, encounterIndex: 1 },
                ],
            },
            phase: 'play',
        });

        try {
            const { player1Page } = setup;
            await clearEvidenceScreenshotsForTest(testInfo);
            await player1Page.setViewportSize({ width: 932, height: 412 });
            await player1Page.waitForTimeout(1000);

            const battlefield = player1Page.locator('[data-testid="cardia-battlefield"]');
            const handArea = player1Page.locator('[data-testid="cardia-hand-area"]');
            const playerArea = player1Page.locator('[data-testid="cardia-player-area-panel"]');
            const discardLabels = player1Page.locator('text=/弃牌堆|discard/i');

            await expect(battlefield).toBeVisible({ timeout: 10000 });
            await expect(handArea).toBeVisible({ timeout: 10000 });
            await expect(playerArea).toBeVisible({ timeout: 10000 });
            await expect(handArea.locator('[data-testid^="card-"]').first()).toBeVisible({ timeout: 10000 });
            await expect(battlefield.locator('[data-testid^="card-"]').first()).toBeVisible({ timeout: 10000 });
            await expect(discardLabels.first()).toBeVisible({ timeout: 10000 });

            const metrics = await player1Page.evaluate(() => {
                const board = document.querySelector<HTMLElement>('[data-testid="cardia-board"]');
                const battlefieldEl = document.querySelector<HTMLElement>('[data-testid="cardia-battlefield"]');
                const handEl = document.querySelector<HTMLElement>('[data-testid="cardia-hand-area"]');
                const playerPanel = document.querySelector<HTMLElement>('[data-testid="cardia-player-area-panel"]');
                const boardRect = board?.getBoundingClientRect();
                const battlefieldRect = battlefieldEl?.getBoundingClientRect();
                const handRect = handEl?.getBoundingClientRect();
                const playerRect = playerPanel?.getBoundingClientRect();
                return {
                    boardRect,
                    battlefieldRect,
                    handRect,
                    playerRect,
                    overflowY: document.documentElement.scrollHeight - window.innerHeight,
                    overflowX: document.documentElement.scrollWidth - window.innerWidth,
                };
            });

            expect(metrics.overflowX, '紧凑横屏不应出现整页横向溢出').toBeLessThanOrEqual(1);
            expect(metrics.overflowY, '紧凑横屏不应出现明显整页纵向溢出').toBeLessThanOrEqual(8);
            expect(metrics.battlefieldRect?.height ?? 0, '战场区仍应保留可用高度').toBeGreaterThan(120);
            expect(metrics.handRect?.height ?? 0, '手牌区仍应保留可用高度').toBeGreaterThan(70);
            expect(metrics.playerRect?.bottom ?? 0, '玩家区底部应留在棋盘内').toBeLessThanOrEqual((metrics.boardRect?.bottom ?? 0) + 1);

            await player1Page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'cardia-tight-landscape-long-hand-discard'),
                fullPage: true,
            });
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('紧凑横屏下调试开关存在时仍不应遮挡主要交互区域', async ({ browser }, testInfo) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02', 'deck_i_card_03', 'deck_i_card_04'],
                deck: ['deck_i_card_05'],
                discard: ['deck_i_card_06', 'deck_i_card_07'],
                playedCards: [
                    { defId: 'deck_i_card_08', signets: 1, encounterIndex: 0 },
                ],
            },
            player2: {
                hand: ['deck_i_card_09', 'deck_i_card_10'],
                deck: ['deck_i_card_11'],
                discard: ['deck_i_card_12'],
                playedCards: [
                    { defId: 'deck_i_card_13', signets: 2, encounterIndex: 0 },
                ],
            },
            phase: 'play',
        });

        try {
            const { player1Page } = setup;
            await clearEvidenceScreenshotsForTest(testInfo);
            await player1Page.setViewportSize({ width: 932, height: 412 });
            await player1Page.waitForTimeout(1000);

            const debugToggle = player1Page.locator('[data-testid="debug-toggle-container"]');
            const handFirstCard = player1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            const battlefieldFirstCard = player1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first();

            await expect(debugToggle).toBeVisible({ timeout: 10000 });
            await expect(handFirstCard).toBeVisible({ timeout: 10000 });
            await expect(battlefieldFirstCard).toBeVisible({ timeout: 10000 });

            const overlap = await player1Page.evaluate(() => {
                const toggle = document.querySelector<HTMLElement>('[data-testid="debug-toggle-container"]');
                const handCard = document.querySelector<HTMLElement>('[data-testid="cardia-hand-area"] [data-testid^="card-"]');
                const battlefieldCard = document.querySelector<HTMLElement>('[data-testid="cardia-battlefield"] [data-testid^="card-"]');
                const t = toggle?.getBoundingClientRect();
                const h = handCard?.getBoundingClientRect();
                const b = battlefieldCard?.getBoundingClientRect();
                const intersects = (a?: DOMRect, c?: DOMRect) => {
                    if (!a || !c) return false;
                    return !(a.right <= c.left || a.left >= c.right || a.bottom <= c.top || a.top >= c.bottom);
                };
                return {
                    toggleRect: t,
                    handRect: h,
                    battlefieldRect: b,
                    overlapsHand: intersects(t, h),
                    overlapsBattlefield: intersects(t, b),
                };
            });

            expect(overlap.overlapsHand, '调试开关不应遮挡首张手牌').toBe(false);
            expect(overlap.overlapsBattlefield, '调试开关不应遮挡首张战场卡').toBe(false);

            await player1Page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'cardia-tight-landscape-debug-toggle-safe-area'),
                fullPage: true,
            });
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
