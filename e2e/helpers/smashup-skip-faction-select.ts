/**
 * SmashUp E2E 测试 - 跳过派系选择辅助函数
 * 
 * 通过调试面板直接注入游戏状态，跳过派系选择流程
 */

import type { Page } from '@playwright/test';

/**
 * 跳过派系选择，直接进入游戏
 * 
 * @param page Playwright 页面对象
 * @param playerFactions 玩家派系配置，例如 { '0': ['wizard', 'robot'], '1': ['pirate', 'ninja'] }
 */
export async function skipFactionSelect(
    page: Page,
    playerFactions: Record<string, [string, string]> = {
        '0': ['wizard', 'robot'],
        '1': ['pirate', 'ninja'],
    }
) {
    // 等待调试面板可用
    await page.waitForFunction(() => window.__BG_TEST_HARNESS__ !== undefined, { timeout: 10000 });

    // 注入状态：清除 factionSelection，设置玩家派系
    await page.evaluate((factions) => {
        const harness = window.__BG_TEST_HARNESS__!;
        
        // 获取当前状态
        const currentState = harness.state.get();
        
        // 修改状态
        const newState = {
            ...currentState,
            factionSelection: undefined,  // 清除派系选择状态
            players: Object.fromEntries(
                Object.entries(currentState.players).map(([pid, player]: [string, any]) => [
                    pid,
                    {
                        ...player,
                        factions: factions[pid] ?? ['wizard', 'robot'],
                        // 给每个玩家一些初始手牌（简化测试）
                        hand: [
                            { uid: `${pid}-card-1`, defId: 'wizard_portal', type: 'action', owner: pid },
                            { uid: `${pid}-card-2`, defId: 'wizard_chronomage', type: 'minion', owner: pid },
                            { uid: `${pid}-card-3`, defId: 'robot_hoverbot', type: 'minion', owner: pid },
                        ],
                        deck: [],
                        discard: [],
                    },
                ])
            ),
        };
        
        // 应用新状态
        harness.state.patch(newState);
        
        // 切换到游戏阶段
        harness.command.dispatch({ type: 'SYS_FLOW_ADVANCE', playerId: '0', payload: {} });
    }, playerFactions);

    // 等待游戏界面加载
    await page.waitForSelector('[data-base-index="0"]', { timeout: 10000 });
}
