/**
 * 大杀四方 - 多基地计分完整流程 E2E 测试
 * 
 * 测试场景：3 个基地同时达到临界点，依次计分，中间有 afterScoring 交互
 * 
 * 验证：
 * 1. 每个基地只计分一次
 * 2. 每个基地只清空和替换一次
 * 3. afterScoring 交互正确触发
 * 4. 延迟事件正确补发
 * 
 * 使用 smashupMatch fixture 创建在线对局，通过 TestHarness.state.patch 注入状态
 */

import { test, expect } from '../fixtures';

test.describe('多基地计分完整流程', () => {
    test('3个基地依次计分，中间有 afterScoring 交互', async ({ page, smashupMatch }, testInfo) => {
        const { hostPage } = smashupMatch;

        // 等待游戏开始
        await hostPage.waitForSelector('[data-testid^="base-zone-"]', { timeout: 10000 });

        // 注入测试场景：3 个基地都达到临界点
        await hostPage.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            
            harness.state.patch({
                'core.bases': [
                    {
                        defId: 'base_the_jungle', // breakpoint=12，无 afterScoring
                        minions: [
                            {
                                uid: 'm0',
                                defId: 'test_minion',
                                controller: '0',
                                owner: '0',
                                basePower: 7,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                playedThisTurn: false,
                                attachedActions: [],
                            },
                            {
                                uid: 'm1',
                                defId: 'test_minion',
                                controller: '1',
                                owner: '1',
                                basePower: 6,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                playedThisTurn: false,
                                attachedActions: [],
                            }
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_ninja_dojo', // breakpoint=18，afterScoring 消灭随从
                        minions: [
                            {
                                uid: 'm2',
                                defId: 'test_minion',
                                controller: '0',
                                owner: '0',
                                basePower: 10,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                playedThisTurn: false,
                                attachedActions: [],
                            },
                            {
                                uid: 'm3',
                                defId: 'test_minion',
                                controller: '1',
                                owner: '1',
                                basePower: 9,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                playedThisTurn: false,
                                attachedActions: [],
                            }
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_pirate_cove', // breakpoint=20，afterScoring 亚军移动随从
                        minions: [
                            {
                                uid: 'm4',
                                defId: 'test_minion',
                                controller: '0',
                                owner: '0',
                                basePower: 11,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                playedThisTurn: false,
                                attachedActions: [],
                            },
                            {
                                uid: 'm5',
                                defId: 'test_minion',
                                controller: '1',
                                owner: '1',
                                basePower: 10,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                playedThisTurn: false,
                                attachedActions: [],
                            }
                        ],
                        ongoingActions: [],
                    }
                ],
                'core.players.0.hand': [],
                'core.players.1.hand': [],
            });
        });

        await hostPage.waitForTimeout(2000); // 等待 React 重新渲染

        // 截图：初始状态
        await hostPage.screenshot({ path: testInfo.outputPath('01-initial-state.png'), fullPage: true });

        // Step 1: 推进到 scoreBases 阶段
        const endTurnButton = hostPage.locator('button').filter({ hasText: '结束回合' });
        await endTurnButton.click();
        await hostPage.waitForTimeout(1000);

        // 应该出现多基地选择交互
        await expect(hostPage.locator('text=选择先记分的基地')).toBeVisible({ timeout: 5000 });
        await hostPage.screenshot({ path: testInfo.outputPath('02-first-choice.png'), fullPage: true });

        // Step 2: P0 选择先计分基地0（丛林，无 afterScoring）
        const jungleOption = hostPage.locator('[data-option-id]').filter({ hasText: '丛林' }).first();
        await jungleOption.click();
        await hostPage.waitForTimeout(1000);

        // 基地0计分完成，应该创建新的多基地选择交互（剩余基地1和2）
        await expect(hostPage.locator('text=选择先记分的基地')).toBeVisible({ timeout: 5000 });
        await hostPage.screenshot({ path: testInfo.outputPath('03-second-choice.png'), fullPage: true });

        // Step 3: P0 选择计分基地2（海盗湾，有 afterScoring）
        const pirateCoveOption = hostPage.locator('[data-option-id]').filter({ hasText: '海盗湾' }).first();
        await pirateCoveOption.click();
        await hostPage.waitForTimeout(1000);

        // 海盗湾 afterScoring 创建交互（P1 亚军移动随从）
        // 注意：在线对局中，P1 的交互会显示在 guestPage，但我们只用 hostPage 测试
        await expect(hostPage.locator('text=海盗湾')).toBeVisible({ timeout: 5000 });
        await hostPage.screenshot({ path: testInfo.outputPath('04-pirate-cove-interaction.png'), fullPage: true });

        // Step 4: 跳过海盗湾交互（如果有跳过按钮）
        const skipButton = hostPage.locator('button').filter({ hasText: '跳过' });
        if (await skipButton.isVisible()) {
            await skipButton.click();
            await hostPage.waitForTimeout(1000);
        }

        // 海盗湾交互解决后，应该弹出最后一个 multi_base_scoring 交互
        await expect(hostPage.locator('text=计分最后一个基地')).toBeVisible({ timeout: 5000 });
        await hostPage.screenshot({ path: testInfo.outputPath('05-last-base.png'), fullPage: true });

        // Step 5: P0 选择计分最后一个基地（忍者道场）
        const ninjaDojoOption = hostPage.locator('[data-option-id]').filter({ hasText: '忍者道场' }).first();
        await ninjaDojoOption.click();
        await hostPage.waitForTimeout(1000);

        // 忍者道场 afterScoring 创建交互（P0 冠军消灭随从）
        await expect(hostPage.locator('text=忍者道场')).toBeVisible({ timeout: 5000 });
        await hostPage.screenshot({ path: testInfo.outputPath('06-ninja-dojo-interaction.png'), fullPage: true });

        // Step 6: P0 响应忍者道场交互（跳过消灭）
        const noDestroyButton = hostPage.locator('button').filter({ hasText: '不消灭' });
        if (await noDestroyButton.isVisible()) {
            await noDestroyButton.click();
            await hostPage.waitForTimeout(1000);
        }

        // 所有基地计分完成，应该推进到 draw 阶段
        await hostPage.screenshot({ path: testInfo.outputPath('07-final.png'), fullPage: true });

        // 验证：3 个基地都被替换了
        const finalState = await hostPage.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        
        expect(finalState.core.bases).toHaveLength(3);
        expect(finalState.core.bases[0].defId).not.toBe('base_the_jungle');
        expect(finalState.core.bases[1].defId).not.toBe('base_ninja_dojo');
        expect(finalState.core.bases[2].defId).not.toBe('base_pirate_cove');

        // 验证：玩家分数正确（每个基地冠军 3VP，亚军 2VP，季军 1VP）
        // 基地0（丛林）：P0 冠军 3VP，P1 亚军 2VP
        // 基地2（海盗湾）：P0 冠军 3VP，P1 亚军 2VP
        // 基地1（忍者道场）：P0 冠军 3VP，P1 亚军 2VP
        expect(finalState.core.players['0'].vp).toBe(9); // 3 + 3 + 3
        expect(finalState.core.players['1'].vp).toBe(6); // 2 + 2 + 2
    });
});
