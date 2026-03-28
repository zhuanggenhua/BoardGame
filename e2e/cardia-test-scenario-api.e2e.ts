import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';

/**
 * 测试新的 setupCardiaTestScenario API
 * 
 * 这个测试验证新API是否能正确工作
 */
test.describe('Cardia 测试场景API验证', () => {
    test.describe.configure({ timeout: 120_000 });

    test('基础场景：配置手牌和阶段', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02'], // 雇佣剑士 + 虚空法师
                deck: ['deck_i_card_03', 'deck_i_card_04'], // 确保有牌可抽
            },
            player2: {
                hand: ['deck_i_card_03'], // 外科医生
                deck: ['deck_i_card_05', 'deck_i_card_06'],
            },
            phase: 'play',
        });
        
        try {
            console.log('\n=== 测试新API：基础场景 ===');
            
            // 1. 验证初始状态
            const initialState = await readCoreState(setup.player1Page);
            
            console.log('初始状态:', {
                p1HandSize: (initialState.players as Record<string, { hand: unknown[] }>)['0'].hand.length,
                p2HandSize: (initialState.players as Record<string, { hand: unknown[] }>)['1'].hand.length,
                p1DeckSize: (initialState.players as Record<string, { deck: unknown[] }>)['0'].deck.length,
                p2DeckSize: (initialState.players as Record<string, { deck: unknown[] }>)['1'].deck.length,
                phase: initialState.phase,
            });
            
            // 验证手牌数量
            expect((initialState.players as Record<string, { hand: unknown[] }>)['0'].hand.length).toBe(2);
            expect((initialState.players as Record<string, { hand: unknown[] }>)['1'].hand.length).toBe(1);
            
            // 验证牌库数量
            expect((initialState.players as Record<string, { deck: unknown[] }>)['0'].deck.length).toBe(2);
            expect((initialState.players as Record<string, { deck: unknown[] }>)['1'].deck.length).toBe(2);
            
            // 验证阶段
            expect(initialState.phase).toBe('play');
            
            // 2. 测试打牌流程
            console.log('P1 打出第一张牌');
            await playCard(setup.player1Page, 0);
            
            console.log('P2 打出第一张牌');
            await playCard(setup.player2Page, 0);
            
            // 3. 等待进入能力阶段
            console.log('等待进入能力阶段...');
            await waitForPhase(setup.player1Page, 'ability');
            
            // 4. 验证阶段推进
            const afterPlay = await readCoreState(setup.player1Page);
            expect(afterPlay.phase).toBe('ability');
            
            // 验证场上有牌
            expect((afterPlay.players as Record<string, { playedCards: unknown[] }>)['0'].playedCards.length).toBe(1);
            expect((afterPlay.players as Record<string, { playedCards: unknown[] }>)['1'].playedCards.length).toBe(1);
            
            console.log('✅ 新API测试通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    
    test('完整场景：配置已打出的牌和印戒', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
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
        });
        
        try {
            console.log('\n=== 测试新API：完整场景 ===');
            
            // 验证已打出的牌
            const state = await readCoreState(setup.player1Page);
            const p1PlayedCards = (state.players as Record<string, { playedCards: Array<{ signets?: number }> }>)['0'].playedCards;
            const p2PlayedCards = (state.players as Record<string, { playedCards: Array<{ signets?: number }> }>)['1'].playedCards;
            
            console.log('已打出的牌:', {
                p1Count: p1PlayedCards.length,
                p2Count: p2PlayedCards.length,
                p1Seals: p1PlayedCards.map(c => c.signets),
                p2Seals: p2PlayedCards.map(c => c.signets),
            });
            
            // 验证场上牌数量
            expect(p1PlayedCards.length).toBe(2);
            expect(p2PlayedCards.length).toBe(1);
            
            // 验证印戒数量
            expect(p1PlayedCards[0].signets).toBe(1);
            expect(p1PlayedCards[1].signets).toBe(2);
            expect(p2PlayedCards[0].signets).toBe(1);
            
            // 验证总印戒数
            const p1TotalSeals = p1PlayedCards.reduce((sum, c) => sum + (c.signets ?? 0), 0);
            const p2TotalSeals = p2PlayedCards.reduce((sum, c) => sum + (c.signets ?? 0), 0);
            expect(p1TotalSeals).toBe(3);
            expect(p2TotalSeals).toBe(1);
            
            console.log('✅ 完整场景测试通过');
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
    test('窄高视口下顶部对手卡应完整显示在战场内', async ({ browser }, testInfo) => {
        const setup = await setupCardiaTestScenario(browser, {
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
        });

        try {
            const { player1Page } = setup;

            await clearEvidenceScreenshotsForTest(testInfo);
            await player1Page.setViewportSize({ width: 1280, height: 640 });
            await player1Page.waitForTimeout(800);

            const state = await readCoreState(player1Page);
            const players = state.players as Record<string, { playedCards: Array<{ uid: string }> }>;
            const myCardUid = players['0'].playedCards[0].uid;
            const opponentCardUid = players['1'].playedCards[0].uid;

            const battlefield = player1Page.locator('[data-testid="cardia-battlefield"]');
            await expect(battlefield).toBeVisible({ timeout: 10000 });

            const myCard = player1Page.locator(`[data-testid="card-${myCardUid}"]`);
            const opponentCard = player1Page.locator(`[data-testid="card-${opponentCardUid}"]`);
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

            const viewport = player1Page.viewportSize();
            expect(viewport, '视口尺寸应可用').not.toBeNull();
            expect(topCardBox.y, '顶部卡牌不应被裁到视口外').toBeGreaterThanOrEqual(0);
            expect(topCardBox.y + topCardBox.height, '顶部卡牌底部不应超出视口').toBeLessThanOrEqual(viewport!.height + 1);

            await player1Page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'cardia-top-row-layout-1280x640'),
                fullPage: true,
            });
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('标准视口下卡牌尺寸应保持原版大小', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
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
        });

        try {
            const { player1Page } = setup;
            await player1Page.setViewportSize({ width: 1280, height: 900 });
            await player1Page.waitForTimeout(800);

            const state = await readCoreState(player1Page);
            const players = state.players as Record<string, { playedCards: Array<{ uid: string }> }>;
            const myCardUid = players['0'].playedCards[0].uid;

            const myCard = player1Page.locator(`[data-testid="card-${myCardUid}"]`);
            await expect(myCard).toBeVisible({ timeout: 10000 });

            const myCardBox = await myCard.boundingBox();
            expect(myCardBox, '标准视口下卡牌应有边界框').not.toBeNull();
            expect(myCardBox!.width, '标准视口下卡牌宽度应保持原版').toBeGreaterThanOrEqual(104);
            expect(myCardBox!.width, '标准视口下卡牌宽度应保持原版').toBeLessThanOrEqual(108);
            expect(myCardBox!.height, '标准视口下卡牌高度应保持原版').toBeGreaterThanOrEqual(158);
            expect(myCardBox!.height, '标准视口下卡牌高度应保持原版').toBeLessThanOrEqual(162);
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
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
