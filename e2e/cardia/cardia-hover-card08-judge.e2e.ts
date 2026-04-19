/**
 * Cardia - Card 08 (审判官/Judge) 悬浮能力文本测试
 * 
 * 验证：Card 08 的 hover 能力文本显示正常
 */

import { test, expect } from '@playwright/test';
import { setupCardiaTestScenario } from '../helpers/cardia';

test.describe('Cardia - Card 08 审判官 hover 测试', () => {
    test('Card 08 应该显示能力文本', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_08'], // 审判官
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_06'],
                deck: ['deck_i_card_07', 'deck_i_card_09'],
            },
            phase: 'play',
        });
        
        const { player1Page } = setup;
        
        try {
            console.log('\n=== 测试 Card 08 审判官 hover ===');
            
            // 等待游戏加载完成
            await player1Page.waitForSelector('[data-testid="cardia-phase-indicator"]', { timeout: 15000 });
            await player1Page.waitForTimeout(1000);
            
            // 验证手牌
            const { readCoreState } = await import('../helpers/cardia');
            const state = await readCoreState(player1Page);
            type PlayerState = { hand: Array<{ defId: string; abilityIds: string[] }> };
            const players = state.players as Record<string, PlayerState>;
            console.log('P1 手牌:', players['0'].hand.map(c => ({ defId: c.defId, abilities: c.abilityIds })));
            
            // 查找手牌
            const handArea = player1Page.locator('[data-testid="cardia-hand-area"]');
            await handArea.waitFor({ state: 'visible', timeout: 5000 });
            
            const handCards = await handArea.locator('[data-testid^="card-"]').all();
            expect(handCards.length).toBeGreaterThan(0);
            
            const card08 = handCards[0];
            
            // Hover 到卡牌
            console.log('Hover 到 Card 08...');
            await card08.hover();
            await player1Page.waitForTimeout(500);
            
            // 调试：检查卡牌内部结构
            const cardDebug = await card08.evaluate(el => {
                const cardDiv = el.querySelector('[data-testid^="card-"]');
                if (!cardDiv) return { error: 'cardDiv not found' };
                
                const children = Array.from(cardDiv.children).map((child, i) => ({
                    index: i,
                    tagName: child.tagName,
                    className: child.className,
                    hasAbilityOverlay: child.hasAttribute('data-testid') && child.getAttribute('data-testid') === 'ability-overlay',
                    textContent: child.textContent?.substring(0, 100),
                }));
                
                return { children };
            });
            console.log('卡牌结构:', JSON.stringify(cardDebug, null, 2));
            
            // 检查覆盖层
            const overlay = card08.locator('[data-testid="ability-overlay"]');
            const overlayCount = await overlay.count();
            console.log('覆盖层数量:', overlayCount);
            
            expect(overlayCount).toBe(1);
            
            // 检查 opacity
            const opacity = await overlay.first().evaluate(el => {
                return window.getComputedStyle(el).opacity;
            });
            console.log('Hover 后 opacity:', opacity);
            expect(parseFloat(opacity)).toBeGreaterThan(0.9);
            
            // 检查能力文本
            const abilityTextContainer = overlay.locator('div.bg-white\\/90').first();
            await expect(abilityTextContainer).toBeVisible({ timeout: 1000 });
            
            const abilityText = await abilityTextContainer.textContent();
            console.log('能力文本:', abilityText);
            expect(abilityText).toBeTruthy();
            expect(abilityText!.length).toBeGreaterThan(0);
            
            // 验证文本内容包含关键词
            expect(abilityText).toMatch(/win.*tie|赢得.*平局/i);
            
            // 截图
            await player1Page.screenshot({ 
                path: `test-results/cardia-hover-card08-${Date.now()}.png`,
                fullPage: false 
            });
            
            console.log('✅ Card 08 hover 测试通过');
        } finally {
            await setup.player1Context.close().catch(() => {});
            await setup.player2Context.close().catch(() => {});
        }
    });
});
