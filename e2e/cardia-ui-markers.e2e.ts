import { test, expect } from '@playwright/test';
import { setupOnlineMatch, waitForTestHarness } from './helpers/cardia';

test.describe('Cardia UI 标记显示', () => {
    test('应该显示持续能力标记', async ({ page }) => {
        const { player1Page } = await setupOnlineMatch(page, {
            player1Deck: 'deck1',
            player2Deck: 'deck1',
        });
        
        await waitForTestHarness(player1Page);
        
        // 注入状态：玩家1场上有一张带持续能力标记的卡牌
        await player1Page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.read();
            
            // 创建一张带持续能力标记的卡牌
            const testCard = {
                uid: 'test-card-1',
                defId: 'card_001',
                ownerId: '0',
                baseInfluence: 10,
                faction: 'swamp' as const,
                abilityIds: ['mediator'],
                difficulty: 3,
                modifiers: { stack: [] },
                tags: { tags: [] },
                signets: 0,
                ongoingMarkers: ['mediator'], // 持续能力标记
                encounterIndex: 1,
                imagePath: 'cardia/cards/1.jpg',
            };
            
            harness.state.patch({
                core: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        '0': {
                            ...state.core.players['0'],
                            playedCards: [testCard],
                        },
                    },
                },
            });
        });
        
        // 等待 UI 更新
        await player1Page.waitForTimeout(500);
        
        // 验证持续能力标记显示
        const ongoingMarker = player1Page.locator('[data-testid="card-test-card-1"]').locator('text=🔄');
        await expect(ongoingMarker).toBeVisible();
    });
    
    test('应该显示正确的影响力值（包含修正标记）', async ({ page }) => {
        const { player1Page } = await setupOnlineMatch(page, {
            player1Deck: 'deck1',
            player2Deck: 'deck1',
        });
        
        await waitForTestHarness(player1Page);
        
        // 注入状态：玩家1场上有一张带修正标记的卡牌
        await player1Page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.read();
            
            // 创建一张带修正标记的卡牌（基础影响力10，修正+3）
            const testCard = {
                uid: 'test-card-2',
                defId: 'card_002',
                ownerId: '0',
                baseInfluence: 10,
                faction: 'academy' as const,
                abilityIds: [],
                difficulty: 2,
                modifiers: { stack: [] },
                tags: { tags: [] },
                signets: 0,
                ongoingMarkers: [],
                modifierTokens: [
                    { cardId: 'test-card-2', value: 2, source: 'ability', timestamp: 1 },
                    { cardId: 'test-card-2', value: 1, source: 'ability', timestamp: 2 },
                ],
                encounterIndex: 1,
                imagePath: 'cardia/cards/2.jpg',
            };
            
            harness.state.patch({
                core: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        '0': {
                            ...state.core.players['0'],
                            playedCards: [testCard],
                        },
                    },
                },
            });
        });
        
        // 等待 UI 更新
        await player1Page.waitForTimeout(500);
        
        // 验证影响力显示为 13（10 + 3）
        const cardElement = player1Page.locator('[data-testid="card-test-card-2"]');
        const influenceDisplay = cardElement.locator('.bg-black\\/70').first();
        await expect(influenceDisplay).toContainText('13');
        
        // 验证修正标记显示为 +3
        const modifierDisplay = cardElement.locator('.bg-green-500');
        await expect(modifierDisplay).toContainText('+3');
    });
});
