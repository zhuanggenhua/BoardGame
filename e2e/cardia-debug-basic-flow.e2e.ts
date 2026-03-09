/**
 * Cardia E2E 调试测试 - 基本流程
 * 
 * 目标：验证游戏基本流程是否正常工作
 * - 创建在线对局
 * - 玩家加入
 * - 打出卡牌
 * - 遭遇结算
 * - 能力触发
 */

import { test, expect } from '@playwright/test';
import {
    setupCardiaOnlineMatch,
    cleanupCardiaMatch,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

test.describe('Cardia 基本流程调试', () => {
    test('应该能够创建在线对局并开始游戏', async ({ browser }) => {
        console.log('\n=== 测试开始：创建在线对局 ===');
        
        // 1. 设置在线对局
        const setup = await setupCardiaOnlineMatch(browser, 'http://localhost:5173');
        if (!setup) {
            throw new Error('创建在线对局失败');
        }
        
        const { matchId, hostPage, guestPage } = setup;
        console.log(`[Cardia] 对局 ID: ${matchId}`);
        
        try {
            // 2. 验证初始状态
            console.log('[STEP 1] 验证初始状态');
            const hostState = await readCoreState(hostPage);
            const guestState = await readCoreState(guestPage);
            
            console.log('Host 状态:', JSON.stringify(hostState, null, 2));
            console.log('Guest 状态:', JSON.stringify(guestState, null, 2));
            
            expect(hostState).toBeTruthy();
            expect(guestState).toBeTruthy();
            expect(hostState?.phase).toBe('play');
            expect(Object.keys(hostState?.players || {})).toHaveLength(2);
            expect((hostState?.players as any)?.['0']?.hand).toBeDefined();  // 初始手牌存在
            expect((hostState?.players as any)?.['1']?.hand).toBeDefined();
            
            console.log('  ✓ 初始状态正常');
            console.log(`  - 阶段: ${hostState?.phase}`);
            console.log(`  - 回合: ${hostState?.turnNumber}`);
            console.log(`  - Host 手牌: ${(hostState?.players as any)?.['0']?.hand?.length || 0}`);
            console.log(`  - Guest 手牌: ${(hostState?.players as any)?.['1']?.hand?.length || 0}`);
            
            // 3. Host 打出第一张卡牌
            console.log('[STEP 2] Host 打出卡牌');
            await playCard(hostPage, 0);
            
            // 验证 Host 已打出卡牌（检查手牌数量变化）
            const hostStateAfterPlay = await readCoreState(hostPage);
            expect((hostStateAfterPlay?.players as any)?.['0']?.hand?.length).toBeLessThan(5);  // 手牌减少
            console.log('  ✓ Host 已打出卡牌');
            
            // 4. Guest 打出第一张卡牌
            console.log('[STEP 3] Guest 打出卡牌');
            await playCard(guestPage, 0);
            
            // 等待状态同步
            await guestPage.waitForTimeout(1000);
            
            // 验证 Guest 已打出卡牌（检查手牌数量变化）
            const guestStateAfterPlay = await readCoreState(guestPage);
            expect((guestStateAfterPlay?.players as any)?.['1']?.hand?.length).toBeLessThan(5);  // 手牌减少
            console.log('  ✓ Guest 已打出卡牌');
            
            // 5. 等待遭遇结算（阶段应该变为 ability）
            console.log('[STEP 4] 等待遭遇结算');
            await waitForPhase(hostPage, 'ability', 5000);
            
            const hostStateAfterEncounter = await readCoreState(hostPage);
            console.log('遭遇结算后状态:', JSON.stringify(hostStateAfterEncounter, null, 2));
            
            expect(hostStateAfterEncounter?.phase).toBe('ability');
            console.log('  ✓ 遭遇已结算，进入能力阶段');
            
            console.log('\n=== 测试完成 ===');
        } finally {
            // 清理
            await cleanupCardiaMatch(setup);
        }
    });
    
    test('应该能够读取游戏状态和调试工具', async ({ browser }) => {
        console.log('\n=== 测试开始：状态读取和调试工具 ===');
        
        // 1. 设置在线对局
        const setup = await setupCardiaOnlineMatch(browser, 'http://localhost:5173');
        if (!setup) {
            throw new Error('创建在线对局失败');
        }
        
        const { hostPage } = setup;
        
        try {
            // 2. 检查调试工具是否可用
            console.log('[STEP 1] 检查调试工具');
            const debugToolsAvailable = await hostPage.evaluate(() => {
                return typeof (window as any).__CARDIA_DEBUG__ !== 'undefined';
            });
            
            console.log(`  调试工具可用: ${debugToolsAvailable}`);
            
            // 3. 读取游戏状态
            console.log('[STEP 2] 读取游戏状态');
            const state = await readCoreState(hostPage);
            
            expect(state).toBeTruthy();
            expect(state?.phase).toBeTruthy();
            expect(Object.keys(state?.players || {})).toHaveLength(2);
            
            console.log('  ✓ 状态读取成功');
            console.log('  状态:', JSON.stringify(state, null, 2));
            
            // 4. 如果调试工具可用，测试快照功能
            if (debugToolsAvailable) {
                console.log('[STEP 3] 测试状态快照');
                const snapshot = await hostPage.evaluate(() => {
                    const debug = (window as any).__CARDIA_DEBUG__;
                    const state = (window as any).__BG_STATE__;
                    if (!debug || !state) return null;
                    
                    return debug.createSnapshot(state.core);
                });
                
                expect(snapshot).toBeTruthy();
                console.log('  ✓ 快照创建成功');
            }
            
            console.log('\n=== 测试完成 ===');
        } finally {
            // 清理
            await cleanupCardiaMatch(setup);
        }
    });
});
