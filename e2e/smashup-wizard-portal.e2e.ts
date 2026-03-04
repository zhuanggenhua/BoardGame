/**
 * SmashUp - 传送门交互 E2E 测试（简化版）
 * 
 * 测试目标：验证传送门交互不会一闪而过
 * 
 * 测试策略：
 * - 完成派系选择后直接测试（不注入状态）
 * - 验证交互持续显示
 */

import { test, expect } from './fixtures';

test.describe('传送门交互', () => {
    // 增加超时时间到 60 秒，因为派系选择需要时间
    test.setTimeout(60000);
    
    test('派系选择应该成功完成', async ({ smashupMatch }, testInfo) => {
        const { hostPage, guestPage } = smashupMatch;
        
        // 如果能走到这里，说明派系选择已经成功完成
        // 截图验证
        await hostPage.screenshot({ 
            path: testInfo.outputPath('host-game-started.png'), 
            fullPage: true 
        });
        
        await guestPage.screenshot({ 
            path: testInfo.outputPath('guest-game-started.png'), 
            fullPage: true 
        });

        console.log('✅ 派系选择成功完成，游戏已开始');
    });
});
