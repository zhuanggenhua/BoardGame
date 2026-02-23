import { test, expect } from './fixtures';

test.describe('SmashUp - 地窖基地能力', () => {
    test('行动卡消灭对手随从时触发地窖能力', async ({ smashupMatch }) => {
        const { hostPage, guestPage } = smashupMatch;
        
        // 等待游戏加载
        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
        
        // 使用调试面板注入测试场景
        await page.evaluate(() => {
            const state = window.__BG_STATE__?.();
            if (!state) throw new Error('State not available');
            
            // 设置基地：地窖 (base_crypt) 在索引 0
            state.core.bases[0] = {
                defId: 'base_crypt',
                breakpoint: 20,
                minions: [
                    // 红色玩家（player 0）的随从
                    {
                        uid: 'red_minion_1',
                        defId: 'ninja_shinobi', // 力量 2 的随从
                        controller: '0',
                        owner: '0',
                        powerCounters: 0,
                    },
                ],
                attachedActions: [],
            };
            
            // 蓝色玩家（player 1）有一个随从在地窖
            state.core.bases[0].minions.push({
                uid: 'blue_minion_1',
                defId: 'robot_microbot', // 力量 1 的随从
                controller: '1',
                owner: '1',
                powerCounters: 0,
            });
            
            // 给蓝色玩家一张可以消灭随从的行动卡（一大口 - 消灭力量≤4的随从）
            state.core.players['1'].hand = [
                {
                    uid: 'action_card_1',
                    defId: 'vampire_big_gulp',
                    type: 'action',
                },
            ];
            
            // 设置为蓝色玩家回合
            state.core.currentPlayer = '1';
            state.core.phase = 'play';
            state.core.actionQuota = 1;
            
            window.__BG_DISPATCH__?.({ type: 'su:cheat_apply_state', payload: { state } });
        });
        
        await page.waitForTimeout(500);
        
        // 蓝色玩家打出"一大口"行动卡
        await page.click('[data-card-uid="action_card_1"]');
        await page.waitForTimeout(300);
        
        // 应该出现选择目标的交互
        await expect(page.locator('text=选择要消灭的力量≤4随从')).toBeVisible({ timeout: 5000 });
        
        // 选择红色玩家的随从
        await page.click('text=忍者 (力量 2)');
        await page.waitForTimeout(500);
        
        // 应该触发地窖能力，出现选择放置指示物的交互
        await expect(page.locator('text=选择一个己方随从放置+1指示物')).toBeVisible({ timeout: 5000 });
        
        // 验证选项中包含蓝色玩家的随从
        await expect(page.locator('text=微型机器人')).toBeVisible();
        
        // 选择给微型机器人放置指示物
        await page.click('text=微型机器人');
        await page.waitForTimeout(500);
        
        // 验证微型机器人获得了指示物
        const finalState = await page.evaluate(() => {
            const state = window.__BG_STATE__?.();
            return state?.core.bases[0].minions.find((m: any) => m.uid === 'blue_minion_1');
        });
        
        expect(finalState?.powerCounters).toBe(1);
    });
    
    test('渴血鬼消灭自己随从时触发地窖能力', async ({ smashupMatch }) => {
        const { hostPage, guestPage } = smashupMatch;
        
        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
        
        await page.evaluate(() => {
            const state = window.__BG_STATE__?.();
            if (!state) throw new Error('State not available');
            
            // 设置基地：地窖在索引 0
            state.core.bases[0] = {
                defId: 'base_crypt',
                breakpoint: 20,
                minions: [
                    // 蓝色玩家的渴血鬼
                    {
                        uid: 'heavy_drinker',
                        defId: 'vampire_heavy_drinker',
                        controller: '1',
                        owner: '1',
                        powerCounters: 0,
                    },
                    // 蓝色玩家的另一个随从
                    {
                        uid: 'victim_minion',
                        defId: 'vampire_minion',
                        controller: '1',
                        owner: '1',
                        powerCounters: 0,
                    },
                ],
                attachedActions: [],
            };
            
            state.core.currentPlayer = '1';
            state.core.phase = 'play';
            
            window.__BG_DISPATCH__?.({ type: 'su:cheat_apply_state', payload: { state } });
        });
        
        await page.waitForTimeout(500);
        
        // 点击渴血鬼使用能力
        await page.click('[data-minion-uid="heavy_drinker"]');
        await page.waitForTimeout(300);
        
        // 应该出现选择要消灭的己方随从的交互
        await expect(page.locator('text=选择要消灭的己方随从')).toBeVisible({ timeout: 5000 });
        
        // 选择受害者随从
        await page.click('text=消灭 吸血鬼随从');
        await page.waitForTimeout(500);
        
        // 渴血鬼应该先获得 +1 指示物（来自自身能力）
        // 然后应该触发地窖能力，出现选择放置指示物的交互
        await expect(page.locator('text=选择一个己方随从放置+1指示物')).toBeVisible({ timeout: 5000 });
        
        // 选择给渴血鬼再放置一个指示物
        await page.click('text=渴血鬼');
        await page.waitForTimeout(500);
        
        // 验证渴血鬼获得了 2 个指示物（1 个来自自身能力，1 个来自地窖）
        const finalState = await page.evaluate(() => {
            const state = window.__BG_STATE__?.();
            return state?.core.bases[0].minions.find((m: any) => m.uid === 'heavy_drinker');
        });
        
        expect(finalState?.powerCounters).toBe(2);
    });
    
    test('消灭者在地窖没有随从时不触发', async ({ smashupMatch }) => {
        const { hostPage, guestPage } = smashupMatch;
        
        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
        
        await page.evaluate(() => {
            const state = window.__BG_STATE__?.();
            if (!state) throw new Error('State not available');
            
            // 设置基地：地窖在索引 0，只有红色玩家的随从
            state.core.bases[0] = {
                defId: 'base_crypt',
                breakpoint: 20,
                minions: [
                    {
                        uid: 'red_minion_1',
                        defId: 'ninja_shinobi',
                        controller: '0',
                        owner: '0',
                        powerCounters: 0,
                    },
                ],
                attachedActions: [],
            };
            
            // 蓝色玩家的随从在另一个基地
            state.core.bases[1].minions = [
                {
                    uid: 'blue_minion_1',
                    defId: 'robot_microbot',
                    controller: '1',
                    owner: '1',
                    powerCounters: 0,
                },
            ];
            
            // 给蓝色玩家一张消灭随从的行动卡
            state.core.players['1'].hand = [
                {
                    uid: 'action_card_1',
                    defId: 'vampire_big_gulp',
                    type: 'action',
                },
            ];
            
            state.core.currentPlayer = '1';
            state.core.phase = 'play';
            state.core.actionQuota = 1;
            
            window.__BG_DISPATCH__?.({ type: 'su:cheat_apply_state', payload: { state } });
        });
        
        await page.waitForTimeout(500);
        
        // 打出行动卡
        await page.click('[data-card-uid="action_card_1"]');
        await page.waitForTimeout(300);
        
        // 选择红色玩家的随从
        await page.click('text=忍者 (力量 2)');
        await page.waitForTimeout(1000);
        
        // 不应该出现地窖交互（因为蓝色玩家在地窖没有随从）
        await expect(page.locator('text=选择一个己方随从放置+1指示物')).not.toBeVisible({ timeout: 2000 });
    });
});
