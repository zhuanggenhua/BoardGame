/**
 * Cardia - 状态调试测试
 * 用于调试卡牌打出后的状态变化
 */

import { test, expect } from '@playwright/test';
import { setupCardiaOnlineMatch, cleanupCardiaMatch } from '../helpers/cardia';

test.describe('Cardia - Debug State', () => {
    test('should debug card play state', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);
        
        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }
        
        const { hostPage: p1Page, guestPage: p2Page } = setup;
        
        try {
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);
            
            // 读取初始状态
            const initialState = await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness) return null;
                const state = harness.state.get();
                return {
                    phase: state.core.phase,
                    turnNumber: state.core.turnNumber,
                    p1Hand: state.core.players['0'].hand.length,
                    p2Hand: state.core.players['1'].hand.length,
                    p1PlayedCards: state.core.players['0'].playedCards.length,
                    p2PlayedCards: state.core.players['1'].playedCards.length,
                    p1CurrentCard: state.core.players['0'].currentCard,
                    p2CurrentCard: state.core.players['1'].currentCard,
                };
            });
            
            console.log('[DEBUG] Initial state:', JSON.stringify(initialState, null, 2));
            
            // P1 打出第一张手牌
            const p1FirstCard = p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            const p1CardUid = await p1FirstCard.getAttribute('data-testid');
            console.log('[DEBUG] P1 clicking card:', p1CardUid);
            
            await p1FirstCard.click();
            
            // 等待状态更新
            await p1Page.waitForTimeout(1000);
            
            // 读取P1打牌后的状态
            const afterP1State = await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness) return null;
                const state = harness.state.get();
                return {
                    phase: state.core.phase,
                    p1Hand: state.core.players['0'].hand.length,
                    p1PlayedCards: state.core.players['0'].playedCards.length,
                    p1CurrentCard: state.core.players['0'].currentCard ? {
                        uid: state.core.players['0'].currentCard.uid,
                        defId: state.core.players['0'].currentCard.defId,
                        encounterIndex: state.core.players['0'].currentCard.encounterIndex,
                    } : null,
                    p1HasPlayed: state.core.players['0'].hasPlayed,
                    p1CardRevealed: state.core.players['0'].cardRevealed,
                };
            });
            
            console.log('[DEBUG] After P1 play:', JSON.stringify(afterP1State, null, 2));
            
            // 检查战场上是否有卡牌元素
            const battlefieldCards = await p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').count();
            console.log('[DEBUG] Battlefield cards count:', battlefieldCards);
            
            // 检查战场HTML结构
            const battlefieldHTML = await p1Page.locator('[data-testid="cardia-battlefield"]').innerHTML();
            console.log('[DEBUG] Battlefield HTML:', battlefieldHTML.substring(0, 500));
            
            // P2 打出第一张手牌
            const p2FirstCard = p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first();
            const p2CardUid = await p2FirstCard.getAttribute('data-testid');
            console.log('[DEBUG] P2 clicking card:', p2CardUid);
            
            await p2FirstCard.click();
            
            // 等待状态更新
            await p1Page.waitForTimeout(1000);
            
            // 读取双方都打牌后的状态
            const afterP2State = await p1Page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                if (!harness) return null;
                const state = harness.state.get();
                return {
                    phase: state.core.phase,
                    p1PlayedCards: state.core.players['0'].playedCards.map((c: any) => ({
                        uid: c.uid,
                        defId: c.defId,
                        encounterIndex: c.encounterIndex,
                    })),
                    p2PlayedCards: state.core.players['1'].playedCards.map((c: any) => ({
                        uid: c.uid,
                        defId: c.defId,
                        encounterIndex: c.encounterIndex,
                    })),
                    p1CurrentCard: state.core.players['0'].currentCard,
                    p2CurrentCard: state.core.players['1'].currentCard,
                    currentEncounter: state.core.currentEncounter,
                };
            });
            
            console.log('[DEBUG] After P2 play:', JSON.stringify(afterP2State, null, 2));
            
            // 再次检查战场上是否有卡牌元素
            const battlefieldCards2 = await p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').count();
            console.log('[DEBUG] Battlefield cards count after P2:', battlefieldCards2);
            
            // 检查战场HTML结构
            const battlefieldHTML2 = await p1Page.locator('[data-testid="cardia-battlefield"]').innerHTML();
            console.log('[DEBUG] Battlefield HTML after P2:', battlefieldHTML2.substring(0, 500));
            
        } finally {
            await cleanupCardiaMatch(setup);
        }
    });

    test('battlefield should be horizontally scrollable on mobile/tablet (screenshots)', async ({ browser }, testInfo) => {
        test.setTimeout(120_000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupCardiaOnlineMatch(browser, baseURL);

        if (!setup) {
            throw new Error('Failed to setup Cardia match');
        }

        const { hostPage: p1Page, guestPage: p2Page } = setup;

        try {
            // 等待游戏状态完全同步
            await p1Page.waitForTimeout(2000);

            // 连续进行多回合，制造可横滑的战场序列
            for (let round = 0; round < 4; round += 1) {
                await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText('Play Card', { timeout: 15000 });
                await expect(p2Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText('Play Card', { timeout: 15000 });

                await p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first().click();
                await p1Page.waitForTimeout(250);
                await p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first().click();

                await expect(p1Page.locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]').first()).toBeVisible({ timeout: 15000 });
                await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText('Ability', { timeout: 15000 });

                // 有跳过能力按钮的一方点击（失败者）
                const p1SkipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
                const p2SkipButton = p2Page.locator('[data-testid="cardia-skip-ability-btn"]');
                if (await p1SkipButton.isVisible()) {
                    await p1SkipButton.click();
                } else if (await p2SkipButton.isVisible()) {
                    await p2SkipButton.click();
                }

                // 等待进入结束阶段并结束回合
                await p1Page.waitForFunction(() => (window as any).__BG_STATE__?.core?.phase === 'end', { timeout: 15000 });
                const p1EndButton = p1Page.locator('[data-testid="cardia-end-turn-btn"]');
                const p2EndButton = p2Page.locator('[data-testid="cardia-end-turn-btn"]');

                if (await p1EndButton.isVisible()) {
                    await p1EndButton.click({ timeout: 15000 });
                } else if (await p2EndButton.isVisible()) {
                    await p2EndButton.click({ timeout: 15000 });
                }

                await p1Page.waitForTimeout(500);
            }

            const battlefield = p1Page.locator('[data-testid="cardia-battlefield"]');
            await battlefield.scrollIntoViewIfNeeded();

            const viewports = [
                { name: 'iphone-xr-portrait', width: 414, height: 896 },
                { name: 'iphone-14-portrait', width: 390, height: 844 },
                { name: 'iphone-xr-landscape', width: 896, height: 414 },
                { name: 'ipad-portrait', width: 768, height: 1024 },
                { name: 'ipad-landscape', width: 1024, height: 768 },
                { name: 'ipad-pro-11-portrait', width: 834, height: 1194 },
                { name: 'ipad-pro-11-landscape', width: 1194, height: 834 },
            ] as const;

            for (const vp of viewports) {
                await p1Page.setViewportSize({ width: vp.width, height: vp.height });
                await p1Page.waitForTimeout(250);

                // 重置到最左侧，并验证第一张卡可完整显示
                await battlefield.evaluate((el) => {
                    el.scrollTo({ left: 0, behavior: 'instant' as ScrollBehavior });
                });
                await p1Page.waitForTimeout(200);

                const leftMetrics = await battlefield.evaluate((el) => ({
                    scrollLeft: el.scrollLeft,
                    scrollWidth: el.scrollWidth,
                    clientWidth: el.clientWidth,
                }));
                expect(leftMetrics.scrollWidth).toBeGreaterThan(leftMetrics.clientWidth);

                const firstVisibleCheck = await p1Page.evaluate(() => {
                    const battlefieldEl = document.querySelector('[data-testid="cardia-battlefield"]');
                    const firstCard = battlefieldEl?.querySelector('[data-testid^="card-"]');
                    if (!battlefieldEl || !firstCard) return null;

                    const c = firstCard.getBoundingClientRect();
                    const b = battlefieldEl.getBoundingClientRect();
                    return {
                        cardLeft: c.left,
                        cardRight: c.right,
                        boxLeft: b.left,
                        boxRight: b.right,
                    };
                });
                expect(firstVisibleCheck).not.toBeNull();
                if (firstVisibleCheck) {
                    expect(firstVisibleCheck.cardLeft).toBeGreaterThanOrEqual(firstVisibleCheck.boxLeft);
                    expect(firstVisibleCheck.cardRight).toBeLessThanOrEqual(firstVisibleCheck.boxRight);
                }

                await battlefield.screenshot({
                    path: testInfo.outputPath(`cardia-battlefield-${vp.name}-left.png`),
                });

                // 滚动到最右侧，并验证最后一张卡可完整显示
                await battlefield.evaluate((el) => {
                    el.scrollTo({ left: el.scrollWidth, behavior: 'instant' as ScrollBehavior });
                });
                await p1Page.waitForTimeout(250);

                const lastVisibleCheck = await p1Page.evaluate(() => {
                    const battlefieldEl = document.querySelector('[data-testid="cardia-battlefield"]');
                    const cards = battlefieldEl?.querySelectorAll('[data-testid^="card-"]');
                    const lastCard = cards && cards.length > 0 ? (cards[cards.length - 1] as HTMLElement) : null;
                    if (!battlefieldEl || !lastCard) return null;

                    const c = lastCard.getBoundingClientRect();
                    const b = battlefieldEl.getBoundingClientRect();
                    return {
                        cardLeft: c.left,
                        cardRight: c.right,
                        boxLeft: b.left,
                        boxRight: b.right,
                    };
                });
                expect(lastVisibleCheck).not.toBeNull();
                if (lastVisibleCheck) {
                    expect(lastVisibleCheck.cardLeft).toBeGreaterThanOrEqual(lastVisibleCheck.boxLeft);
                    expect(lastVisibleCheck.cardRight).toBeLessThanOrEqual(lastVisibleCheck.boxRight);
                }

                await battlefield.screenshot({
                    path: testInfo.outputPath(`cardia-battlefield-${vp.name}-right.png`),
                });
            }
        } finally {
            try {
                await cleanupCardiaMatch(setup);
            } catch (error) {
                // 超时或浏览器上下文提前销毁时，清理可能报错；不应阻塞截图类测试。
                console.warn('[WARN] cleanupCardiaMatch failed:', error);
            }
        }
    });
});
