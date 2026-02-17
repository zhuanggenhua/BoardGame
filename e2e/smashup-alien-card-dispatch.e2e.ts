/**
 * SmashUp 外星人派系 - 卡牌图片索引验证（通过 dispatch 发牌）
 * 
 * 验证策略：
 * 1. 直接使用 __BG_DISPATCH__ 按索引发牌
 * 2. 验证手牌中的 defId 是否正确
 * 3. 截图手牌区域供人工检查图片
 * 
 * 这个测试验证：发适居化卡牌后，手牌中确实是适居化（不是探究）
 */

import { test, expect } from '@playwright/test';
import {
    setupTwoPlayerMatch,
    completeFactionSelection,
    waitForHandArea,
    cleanupTwoPlayerMatch,
} from './smashup-helpers';

test.describe('SmashUp 外星人卡牌 dispatch 验证', () => {
    test('通过 dispatch 发牌并验证 defId', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL);
        if (!setup) {
            console.log('[测试] 创建对局失败');
            test.skip();
            return;
        }

        const { hostPage, guestPage } = setup;

        try {
            // 选择外星人派系
            await completeFactionSelection(hostPage, guestPage, {
                hostFactions: ['aliens', 'robots'],
                guestFactions: ['ninjas', 'pirates'],
            });

            await waitForHandArea(hostPage);
            await hostPage.waitForTimeout(2000);

            // 查找牌库中的关键卡牌索引
            const deckInfo = await hostPage.evaluate(() => {
                const state = (window as any).__BG_STATE__;
                if (!state?.core?.players?.['0']?.deck) return null;

                const deck = state.core.players['0'].deck;
                const handBefore = state.core.players['0'].hand.length;
                
                return {
                    handBefore,
                    deckLength: deck.length,
                    probeIndex: deck.findIndex((c: any) => c.defId === 'alien_probe'),
                    terraformIndex: deck.findIndex((c: any) => c.defId === 'alien_terraform'),
                    cropIndex: deck.findIndex((c: any) => c.defId === 'alien_crop_circles'),
                    deckSnapshot: deck.slice(0, 10).map((c: any, i: number) => ({ idx: i, defId: c.defId })),
                };
            });

            console.log('[测试] 牌库信息:', deckInfo);

            if (!deckInfo || deckInfo.terraformIndex === -1) {
                console.log('[测试] 牌库中没有适居化卡牌，跳过测试');
                test.skip();
                return;
            }

            // 测试 1: 发适居化卡牌
            console.log('[测试] 发适居化卡牌，索引:', deckInfo.terraformIndex);
            
            const result1 = await hostPage.evaluate((idx) => {
                const dispatch = (window as any).__BG_DISPATCH__;
                if (!dispatch) return { error: 'dispatch not found' };
                
                dispatch('SYS_CHEAT_DEAL_CARD_BY_INDEX', { playerId: '0', deckIndex: idx });
                
                // 等待状态更新
                return new Promise((resolve) => {
                    setTimeout(() => {
                        const state = (window as any).__BG_STATE__;
                        const hand = state?.core?.players?.['0']?.hand;
                        if (!hand) {
                            resolve({ error: 'hand not found' });
                            return;
                        }
                        const lastCard = hand[hand.length - 1];
                        resolve({
                            handLength: hand.length,
                            lastCardDefId: lastCard?.defId,
                            lastCardUid: lastCard?.uid,
                        });
                    }, 1000);
                });
            }, deckInfo.terraformIndex);

            console.log('[测试] 发牌结果:', result1);
            
            // 验证手牌中最后一张是适居化
            expect((result1 as any).lastCardDefId).toBe('alien_terraform');

            // 截图手牌
            await hostPage.waitForTimeout(1000);
            const handArea = hostPage.locator('[data-testid="su-hand-area"]');
            await handArea.screenshot({
                path: testInfo.outputPath('hand-with-terraform.png'),
                animations: 'disabled',
            });

            // 测试 2: 发探究卡牌
            if (deckInfo.probeIndex !== -1) {
                console.log('[测试] 发探究卡牌，索引:', deckInfo.probeIndex);
                
                const result2 = await hostPage.evaluate((idx) => {
                    const dispatch = (window as any).__BG_DISPATCH__;
                    if (!dispatch) return { error: 'dispatch not found' };
                    
                    dispatch('SYS_CHEAT_DEAL_CARD_BY_INDEX', { playerId: '0', deckIndex: idx });
                    
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            const state = (window as any).__BG_STATE__;
                            const hand = state?.core?.players?.['0']?.hand;
                            const lastCard = hand?.[hand.length - 1];
                            resolve({
                                handLength: hand?.length,
                                lastCardDefId: lastCard?.defId,
                            });
                        }, 1000);
                    });
                }, deckInfo.probeIndex);

                console.log('[测试] 发牌结果:', result2);
                expect((result2 as any).lastCardDefId).toBe('alien_probe');

                await hostPage.waitForTimeout(1000);
                await handArea.screenshot({
                    path: testInfo.outputPath('hand-with-probe.png'),
                    animations: 'disabled',
                });
            }

            // 测试 3: 发麦田怪圈卡牌
            if (deckInfo.cropIndex !== -1) {
                console.log('[测试] 发麦田怪圈卡牌，索引:', deckInfo.cropIndex);
                
                const result3 = await hostPage.evaluate((idx) => {
                    const dispatch = (window as any).__BG_DISPATCH__;
                    if (!dispatch) return { error: 'dispatch not found' };
                    
                    dispatch('SYS_CHEAT_DEAL_CARD_BY_INDEX', { playerId: '0', deckIndex: idx });
                    
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            const state = (window as any).__BG_STATE__;
                            const hand = state?.core?.players?.['0']?.hand;
                            const lastCard = hand?.[hand.length - 1];
                            resolve({
                                handLength: hand?.length,
                                lastCardDefId: lastCard?.defId,
                            });
                        }, 1000);
                    });
                }, deckInfo.cropIndex);

                console.log('[测试] 发牌结果:', result3);
                expect((result3 as any).lastCardDefId).toBe('alien_crop_circles');

                await hostPage.waitForTimeout(1000);
                await handArea.screenshot({
                    path: testInfo.outputPath('hand-with-crop-circles.png'),
                    animations: 'disabled',
                });
            }

            console.log('[测试] ✅ 所有卡牌 defId 验证通过');
            console.log('[测试] 📸 请检查截图，确认图片与卡牌名称匹配：');
            console.log('[测试]   - hand-with-terraform.png 最右侧应该显示适居化的图片');
            console.log('[测试]   - hand-with-probe.png 最右侧应该显示探究的图片');
            console.log('[测试]   - hand-with-crop-circles.png 最右侧应该显示麦田怪圈的图片');
            console.log('[测试]');
            console.log('[测试] ⚠️  如果图片不匹配，说明图集索引配置错误');

        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
