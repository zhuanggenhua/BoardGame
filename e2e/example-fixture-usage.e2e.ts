/**
 * Fixture 使用示例
 * 
 * 展示如何使用 fixture 简化 E2E 测试代码
 */

import { test, expect } from './fixtures';

test.describe('Fixture 使用示例', () => {
    /**
     * 示例 1：使用默认配置的 SmashUp 对局
     * 
     * 重构前需要 15+ 行 setup 代码，重构后只需 1 行
     */
    test('SmashUp 默认对局', async ({ smashupMatch }) => {
        const { hostPage, guestPage, matchId } = smashupMatch;
        
        // 直接开始测试，无需 setup 代码
        console.log('Match ID:', matchId);
        
        // 验证游戏已加载
        await expect(hostPage.getByTestId('debug-toggle')).toBeVisible();
        await expect(guestPage.getByTestId('debug-toggle')).toBeVisible();
        
        // 测试代码...
        
        // 无需手动 cleanup，fixture 自动处理
    });

    /**
     * 示例 2：使用默认配置的 DiceThrone 对局
     */
    test('DiceThrone 默认对局', async ({ dicethroneMatch }) => {
        const { hostPage, guestPage, matchId } = dicethroneMatch;
        
        console.log('Match ID:', matchId);
        
        // 验证游戏已加载
        await expect(hostPage.getByTestId('dt-phase-banner')).toBeVisible();
        await expect(guestPage.getByTestId('dt-phase-banner')).toBeVisible();
        
        // 测试代码...
    });

    /**
     * 示例 3：使用默认配置的 SummonerWars 对局
     */
    test('SummonerWars 默认对局', async ({ summonerwarsMatch }) => {
        const { hostPage, guestPage, matchId } = summonerwarsMatch;
        
        console.log('Match ID:', matchId);
        
        // 验证游戏已加载
        await expect(hostPage.getByTestId('sw-action-banner')).toBeVisible();
        await expect(guestPage.getByTestId('sw-action-banner')).toBeVisible();
        
        // 测试代码...
    });

    /**
     * 示例 4：同时使用多个 fixture（不推荐，仅作演示）
     * 
     * 注意：这会创建多个对局，消耗更多资源
     */
    test.skip('多个 fixture（演示）', async ({ smashupMatch, dicethroneMatch }) => {
        // 可以同时访问多个对局
        console.log('SmashUp Match:', smashupMatch.matchId);
        console.log('DiceThrone Match:', dicethroneMatch.matchId);
        
        // 但通常不需要这样做
    });
});

/**
 * 代码量对比：
 * 
 * 重构前（每个测试）：
 * - Setup: 15-20 行
 * - 测试逻辑: 5-10 行
 * - Cleanup: 3-5 行
 * - 总计: 23-35 行
 * 
 * 重构后（每个测试）：
 * - Setup: 0 行（fixture 自动处理）
 * - 测试逻辑: 5-10 行
 * - Cleanup: 0 行（fixture 自动处理）
 * - 总计: 5-10 行
 * 
 * 减少代码量：60-70%
 */
