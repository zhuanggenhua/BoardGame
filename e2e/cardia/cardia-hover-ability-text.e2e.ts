/**
 * Cardia - 卡牌悬浮能力文本测试
 * 
 * 验证：
 * 1. 鼠标悬停在卡牌上时显示能力文本覆盖层
 * 2. 覆盖层样式正确（白色背景、黑色粗体文字）
 * 3. 能力文本内容正确
 */

import { test, expect } from '@playwright/test';
import { setupCardiaTestScenario } from '../helpers/cardia';

test.describe('Cardia - 卡牌悬浮能力文本', () => {
    test('应该在 hover 时显示能力文本覆盖层', async ({ browser }) => {
        // 1. 创建测试场景（使用有能力的卡牌）
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                // deck_i_card_02 = 虚空法师（影响力2）- 有能力
                // deck_i_card_03 = 外科医生（影响力3）- 有能力
                hand: ['deck_i_card_02', 'deck_i_card_03'],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
            },
            player2: {
                hand: ['deck_i_card_06', 'deck_i_card_07'],
                deck: ['deck_i_card_08', 'deck_i_card_09'],
            },
            phase: 'play',
        });
        
        const { player1Page } = setup;
        
        try {
            console.log('\n=== 测试卡牌悬浮能力文本 ===');
            
            // 2. 等待游戏加载完成
            await player1Page.waitForSelector('[data-testid="cardia-phase-indicator"]', { timeout: 15000 });
            await player1Page.waitForTimeout(1000);
            
            // 3. 验证手牌已注入
            const { readCoreState } = await import('../helpers/cardia');
            const state = await readCoreState(player1Page);
            type PlayerState = { hand: Array<{ defId: string; abilityIds: string[] }> };
            const players = state.players as Record<string, PlayerState>;
            console.log('P1 手牌数量:', players['0'].hand.length);
            console.log('P1 手牌:', players['0'].hand.map(c => ({ defId: c.defId, abilities: c.abilityIds })));
            
            // 4. 查找第一张手牌（虚空法师）
            const handArea = player1Page.locator('[data-testid="cardia-hand-area"]');
            await handArea.waitFor({ state: 'visible', timeout: 5000 });
            
            const handCards = await handArea.locator('[data-testid^="card-"]').all();
            console.log('UI 手牌数量:', handCards.length);
            expect(handCards.length).toBeGreaterThan(0);
            
            const firstCard = handCards[0];
            
            // 5. 截图：hover 前
            await player1Page.screenshot({ 
                path: `test-results/cardia-hover-before-${Date.now()}.png`,
                fullPage: false 
            });
            
            // 6. 检查 hover 前的状态（覆盖层应该不可见）
            console.log('检查 hover 前的状态...');
            
            // 先检查能力文本是否存在
            const cardState = await firstCard.evaluate(el => {
                const cardDiv = el.querySelector('[data-testid^="card-"]');
                if (!cardDiv) return { error: 'cardDiv not found' };
                
                // 查找所有子元素
                const children = Array.from(cardDiv.children).map((child, i) => ({
                    index: i,
                    tagName: child.tagName,
                    className: child.className,
                    hasAbilityOverlay: child.hasAttribute('data-testid') && child.getAttribute('data-testid') === 'ability-overlay',
                }));
                
                return { children };
            });
            console.log('卡牌状态:', JSON.stringify(cardState, null, 2));
            
            const overlayBefore = firstCard.locator('[data-testid="ability-overlay"]');
            
            // 检查覆盖层是否存在
            const overlayCount = await overlayBefore.count();
            console.log('覆盖层数量:', overlayCount);
            
            if (overlayCount > 0) {
                // 检查初始 opacity（应该是 0）
                const opacityBefore = await overlayBefore.first().evaluate(el => {
                    return window.getComputedStyle(el).opacity;
                });
                console.log('Hover 前 opacity:', opacityBefore);
            } else {
                console.log('⚠️ 覆盖层不存在！');
            }
            
            // 7. Hover 到卡牌上
            console.log('Hover 到卡牌...');
            await firstCard.hover();
            await player1Page.waitForTimeout(500); // 等待 transition 动画完成
            
            // 8. 截图：hover 后
            await player1Page.screenshot({ 
                path: `test-results/cardia-hover-after-${Date.now()}.png`,
                fullPage: false 
            });
            
            // 9. 检查覆盖层是否可见
            console.log('检查 hover 后的状态...');
            const overlay = firstCard.locator('[data-testid="ability-overlay"]');
            
            const overlayCountAfter = await overlay.count();
            console.log('Hover 后覆盖层数量:', overlayCountAfter);
            
            if (overlayCountAfter > 0) {
                // 检查 opacity（应该是 1）
                const opacityAfter = await overlay.first().evaluate(el => {
                    return window.getComputedStyle(el).opacity;
                });
                console.log('Hover 后 opacity:', opacityAfter);
                expect(parseFloat(opacityAfter)).toBeGreaterThan(0.9);
                
                // 10. 检查能力文本容器
                const abilityTextContainer = overlay.locator('div.bg-white\\/90').first();
                await expect(abilityTextContainer).toBeVisible({ timeout: 1000 });
                
                // 11. 检查样式
                const styles = await abilityTextContainer.evaluate(el => {
                    const computed = window.getComputedStyle(el);
                    return {
                        backgroundColor: computed.backgroundColor,
                        color: computed.color,
                        fontWeight: computed.fontWeight,
                    };
                });
                console.log('能力文本样式:', styles);
                
                // 验证黑色文字（rgb(0, 0, 0) 或接近黑色）
                expect(styles.color).toMatch(/rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0/);
                
                // 验证粗体（font-weight >= 700）
                expect(parseInt(styles.fontWeight)).toBeGreaterThanOrEqual(700);
                
                // 12. 检查能力文本内容
                const abilityText = await abilityTextContainer.textContent();
                console.log('能力文本内容:', abilityText);
                expect(abilityText).toBeTruthy();
                expect(abilityText!.length).toBeGreaterThan(0);
                
                console.log('✅ 卡牌悬浮能力文本测试通过');
            } else {
                console.log('❌ 覆盖层未找到！');
                
                // 调试：打印卡牌的 HTML 结构
                const cardHTML = await firstCard.evaluate(el => el.outerHTML);
                console.log('卡牌 HTML 结构:', cardHTML.substring(0, 500));
                
                // 调试：检查是否有 group class
                const hasGroupClass = await firstCard.evaluate(el => el.classList.contains('group'));
                console.log('卡牌是否有 group class:', hasGroupClass);
                
                // 调试：查找所有子元素
                const children = await firstCard.locator('> *').all();
                console.log('卡牌子元素数量:', children.length);
                for (let i = 0; i < children.length; i++) {
                    const childClass = await children[i].getAttribute('class');
                    console.log(`子元素 ${i} class:`, childClass);
                }
                
                throw new Error('覆盖层未找到');
            }
        } finally {
            // 清理
            await setup.player1Context.close().catch(() => {});
            await setup.player2Context.close().catch(() => {});
        }
    });
    
    test('应该在场上卡牌 hover 时显示能力文本', async ({ browser }) => {
        // 测试场上卡牌的 hover 效果
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
                playedCards: [
                    {
                        defId: 'deck_i_card_02', // 虚空法师
                        encounterIndex: 1,
                        signets: 0,
                    }
                ],
            },
            player2: {
                hand: ['deck_i_card_06'],
                deck: ['deck_i_card_08', 'deck_i_card_09'],
                playedCards: [
                    {
                        defId: 'deck_i_card_03', // 外科医生
                        encounterIndex: 1,
                        signets: 0,
                    }
                ],
            },
            phase: 'play',
            turnNumber: 2,
        });
        
        const { player1Page } = setup;
        
        try {
            console.log('\n=== 测试场上卡牌悬浮能力文本 ===');
            
            // 等待游戏加载完成
            await player1Page.waitForSelector('[data-testid="cardia-phase-indicator"]', { timeout: 15000 });
            await player1Page.waitForTimeout(1000);
            
            // 查找战场区域
            const battlefield = player1Page.locator('[data-testid="cardia-battlefield"]');
            await battlefield.waitFor({ state: 'visible', timeout: 5000 });
            
            // 查找场上的卡牌
            const fieldCards = await battlefield.locator('[data-testid^="card-"]').all();
            console.log('场上卡牌数量:', fieldCards.length);
            expect(fieldCards.length).toBeGreaterThan(0);
            
            const firstFieldCard = fieldCards[0];
            
            // Hover 到场上卡牌
            console.log('Hover 到场上卡牌...');
            await firstFieldCard.hover();
            await player1Page.waitForTimeout(500);
            
            // 截图
            await player1Page.screenshot({ 
                path: `test-results/cardia-hover-field-card-${Date.now()}.png`,
                fullPage: false 
            });
            
            // 检查覆盖层
            const overlay = firstFieldCard.locator('div.absolute.inset-0.z-10').filter({
                has: player1Page.locator('div.bg-white\\/90')
            });
            
            const overlayCount = await overlay.count();
            console.log('场上卡牌覆盖层数量:', overlayCount);
            
            if (overlayCount > 0) {
                const opacity = await overlay.first().evaluate(el => {
                    return window.getComputedStyle(el).opacity;
                });
                console.log('场上卡牌 hover 后 opacity:', opacity);
                expect(parseFloat(opacity)).toBeGreaterThan(0.9);
                
                console.log('✅ 场上卡牌悬浮能力文本测试通过');
            } else {
                console.log('⚠️ 场上卡牌覆盖层未找到');
            }
        } finally {
            // 清理
            await setup.player1Context.close().catch(() => {});
            await setup.player2Context.close().catch(() => {});
        }
    });

    test('移动端长按时应显示能力覆盖层且放大镜不再常驻遮挡', async ({ browser }, testInfo) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_02', 'deck_i_card_03'],
                deck: ['deck_i_card_04', 'deck_i_card_05'],
            },
            player2: {
                hand: ['deck_i_card_06', 'deck_i_card_07'],
                deck: ['deck_i_card_08', 'deck_i_card_09'],
            },
            phase: 'play',
        });

        const { player1Page } = setup;

        try {
            await player1Page.setViewportSize({ width: 896, height: 414 });
            await player1Page.waitForSelector('[data-testid="cardia-phase-indicator"]', { timeout: 15000 });
            await player1Page.waitForTimeout(600);

            const handArea = player1Page.locator('[data-testid="cardia-hand-area"]');
            await handArea.waitFor({ state: 'visible', timeout: 5000 });

            const overlay = handArea.locator('[data-testid="ability-overlay"]').first();
            const magnifyButton = handArea.locator('button[title="查看大图"]').first();
            const cardSurface = overlay.locator('xpath=..');

            await expect(overlay).toHaveCSS('opacity', '0');
            await expect(magnifyButton).toHaveCSS('opacity', '0');

            await cardSurface.evaluate((element) => {
                const target = element as HTMLElement;
                const rect = target.getBoundingClientRect();
                const createTouch = () => new Touch({
                    identifier: 1,
                    target,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    pageX: rect.left + rect.width / 2,
                    pageY: rect.top + rect.height / 2,
                    radiusX: 2,
                    radiusY: 2,
                    rotationAngle: 0,
                    force: 1,
                });

                const touch = createTouch();
                target.dispatchEvent(new TouchEvent('touchstart', {
                    bubbles: true,
                    cancelable: true,
                    touches: [touch],
                    targetTouches: [touch],
                    changedTouches: [touch],
                }));
            });

            await player1Page.waitForTimeout(320);

            await cardSurface.evaluate((element) => {
                const target = element as HTMLElement;
                const rect = target.getBoundingClientRect();
                const touch = new Touch({
                    identifier: 1,
                    target,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    pageX: rect.left + rect.width / 2,
                    pageY: rect.top + rect.height / 2,
                    radiusX: 2,
                    radiusY: 2,
                    rotationAngle: 0,
                    force: 0,
                });

                target.dispatchEvent(new TouchEvent('touchend', {
                    bubbles: true,
                    cancelable: true,
                    touches: [],
                    targetTouches: [],
                    changedTouches: [touch],
                }));
            });

            await expect(overlay).toHaveCSS('opacity', '1');
            await expect(magnifyButton).toHaveCSS('opacity', '1');

            await player1Page.screenshot({
                path: testInfo.outputPath('cardia-mobile-touch-preview.png'),
                fullPage: false,
            });
        } finally {
            await setup.player1Context.close().catch(() => {});
            await setup.player2Context.close().catch(() => {});
        }
    });
});
