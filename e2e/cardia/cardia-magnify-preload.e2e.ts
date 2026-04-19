/**
 * Cardia - 卡牌放大镜预加载测试
 * 
 * 验证：
 * 1. 图片预加载机制正常工作
 * 2. 点击放大镜后图片立即显示，无延迟
 * 3. 不显示 shimmer 占位效果
 */

import { test, expect } from '@playwright/test';
import { setupCardiaTestScenario } from '../helpers/cardia';

test.describe('Cardia - 卡牌放大镜预加载', () => {
    test('应该预加载所有卡牌图片，放大镜无延迟', async ({ browser }) => {
        // 1. 使用新 API 创建测试场景（确保有手牌）
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01', 'deck_i_card_02', 'deck_i_card_03'],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
            },
            player2: {
                hand: ['deck_i_card_06', 'deck_i_card_07'],
                deck: ['deck_i_card_08', 'deck_i_card_09'],
            },
            phase: 'play',
        });
        
        const { player1Page } = setup;
        
        // 2. 在页面加载后开始监听控制台日志
        const preloadLogs: string[] = [];
        player1Page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[Cardia]') || 
                text.includes('[AssetLoader]') ||
                text.includes('[OptimizedImage]') ||
                text.includes('[CardMagnifyOverlay]') ||
                text.includes('Critical image resolver')) {
                preloadLogs.push(text);
                console.log('[Console]', text);
            }
        });
        
        try {
            console.log('\n=== 测试卡牌放大镜预加载 ===');
            
            // 3. 等待游戏加载完成（等待阶段指示器出现）
            await player1Page.waitForSelector('[data-testid="cardia-phase-indicator"]', { timeout: 15000 });
            
            // 4. 等待预加载完成
            await player1Page.waitForTimeout(2000);
            
            // 5. 验证预加载日志存在（可选，不强制）
            console.log('预加载日志数量:', preloadLogs.length);
            if (preloadLogs.length > 0) {
                console.log('前10条日志:', preloadLogs.slice(0, 10));
            }
            
            // 6. 验证手牌已注入
            const { readCoreState } = await import('../helpers/cardia');
            const state = await readCoreState(player1Page);
            type PlayerState = { hand: Array<{ defId: string }> };
            const players = state.players as Record<string, PlayerState>;
            console.log('P1 手牌数量:', players['0'].hand.length);
            console.log('P1 手牌:', players['0'].hand.map(c => c.defId));
            
            // 7. 等待 UI 更新（React 重新渲染）
            await player1Page.waitForTimeout(1000);
            
            // 8. 查找第一张手牌（使用正确的选择器）
            const handArea = player1Page.locator('[data-testid="cardia-hand-area"]');
            await handArea.waitFor({ state: 'visible', timeout: 5000 });
            
            // 卡牌的 data-testid 格式是 "card-{uid}"
            const handCards = await handArea.locator('[data-testid^="card-"]').all();
            console.log('UI 手牌数量:', handCards.length);
            
            expect(handCards.length).toBeGreaterThan(0); // 确保有手牌
            
            // 9. 找到第一张手牌上的放大镜按钮并点击
            console.log('查找放大镜按钮...');
            const firstCard = handCards[0];
            
            // 先 hover 到卡牌上，让放大镜按钮显示出来
            await firstCard.hover();
            await player1Page.waitForTimeout(500); // 等待 opacity 动画完成
            
            // 查找放大镜按钮（通过 title 属性）
            const magnifyButton = firstCard.locator('button[title="查看大图"]');
            
            console.log('点击放大镜按钮...');
            const clickTime = Date.now();
            await magnifyButton.click({ force: true }); // 使用 force 点击，因为按钮可能还在动画中
            
            // 10. 等待放大镜覆盖层出现（应该立即出现）
            const magnifyOverlay = player1Page.locator('[class*="fixed"][class*="inset-0"]').filter({
                has: player1Page.locator('img')
            }).first();
            await expect(magnifyOverlay).toBeVisible({ timeout: 5000 });
            const overlayVisibleTime = Date.now();
            const overlayDelay = overlayVisibleTime - clickTime;
            console.log('放大镜覆盖层显示延迟:', overlayDelay, 'ms');
            
            // 验证覆盖层显示延迟 < 500ms（合理的 UI 响应时间）
            expect(overlayDelay).toBeLessThan(500);
            
            // 11. 检查图片是否立即显示（应该在覆盖层出现后立即可见）
            const cardImage = magnifyOverlay.locator('img').first();
            await expect(cardImage).toBeVisible({ timeout: 1000 });
            const imageVisibleTime = Date.now();
            const imageDelay = imageVisibleTime - overlayVisibleTime;
            console.log('图片显示延迟（相对于覆盖层）:', imageDelay, 'ms');
            
            // 验证图片显示延迟 < 100ms（应该立即显示，因为已预加载）
            expect(imageDelay).toBeLessThan(100);
            
            // 12. 检查图片的 opacity（应该是 1，不是 0）
            const opacity = await cardImage.evaluate(el => {
                return window.getComputedStyle(el).opacity;
            });
            console.log('图片 opacity:', opacity);
            expect(parseFloat(opacity)).toBeGreaterThan(0.9);
            
            // 13. 检查是否有 shimmer 背景动画
            const hasShimmer = await cardImage.evaluate(el => {
                const style = window.getComputedStyle(el);
                const hasShimmerBg = style.backgroundImage.includes('linear-gradient');
                const hasShimmerAnim = style.animation.includes('shimmer') || style.animation.includes('img-shimmer');
                return hasShimmerBg && hasShimmerAnim;
            });
            console.log('是否有 shimmer:', hasShimmer);
            expect(hasShimmer).toBe(false);
            
            // 14. 检查图片加载时间（通过 performance API）
            const loadTime = await cardImage.evaluate(el => {
                const img = el as HTMLImageElement;
                // 如果图片已经在缓存中，complete 应该立即为 true
                return img.complete ? 0 : -1;
            });
            console.log('图片加载时间:', loadTime === 0 ? '立即（已缓存）' : '未知');
            expect(loadTime).toBe(0); // 图片应该已经在缓存中
            
            // 15. 截图验证
            await player1Page.screenshot({ 
                path: `test-results/cardia-magnify-preload-${Date.now()}.png`,
                fullPage: false 
            });
            
            console.log('✅ 卡牌放大镜预加载测试通过');
        } finally {
            // 清理
            await setup.player1Context.close().catch(() => {});
            await setup.player2Context.close().catch(() => {});
        }
    });
});
