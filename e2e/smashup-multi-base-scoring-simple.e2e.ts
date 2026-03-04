/**
 * 大杀四方 - 多基地计分简单测试
 * 
 * 使用 smashupMatch fixture 验证多基地计分流程
 * 
 * 测试场景：3 个基地同时达到临界点，依次计分
 * 
 * 验证：
 * 1. 每个基地只计分一次
 * 2. 每个基地只清空和替换一次
 * 3. afterScoring 交互正确触发
 * 4. 延迟事件不会重复补发
 */

import { test, expect } from './fixtures';

test.describe('多基地计分简单测试', () => {
    test('3个基地依次计分', async ({ smashupMatch }, testInfo) => {
        test.setTimeout(180000); // 增加超时时间到 3 分钟（包含派系选择）
        
        const { host } = smashupMatch;

        // 等待游戏开始（等待基地区域渲染）
        await host.page.waitForSelector('[data-testid^="base-zone-"]', { timeout: 15000 });
        await host.page.waitForTimeout(2000); // 等待初始化完成

        // 注入测试场景：3 个基地都达到临界点
        await host.page.evaluate(() => {
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

        // 等待 React 重新渲染
        await host.page.waitForTimeout(2000);

        // 截图：初始状态
        await host.page.screenshot({ path: testInfo.outputPath('01-initial-state.png'), fullPage: true });

        // 验证初始状态
        const initialState = await host.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        expect(initialState.core.bases.length).toBe(3);
        expect(initialState.core.bases[0].defId).toBe('base_the_jungle');
        expect(initialState.core.bases[1].defId).toBe('base_ninja_dojo');
        expect(initialState.core.bases[2].defId).toBe('base_pirate_cove');

        // Step 1: 推进到 scoreBases 阶段
        const endTurnButton = host.page.locator('button').filter({ hasText: /结束回合|End Turn/ });
        await expect(endTurnButton).toBeVisible({ timeout: 5000 });
        await endTurnButton.click();
        await host.page.waitForTimeout(1500);

        // 应该出现多基地选择交互
        await expect(host.page.locator('text=/选择先记分的基地|Choose which base to score first/')).toBeVisible({ timeout: 5000 });
        await host.page.screenshot({ path: testInfo.outputPath('02-first-choice.png'), fullPage: true });

        // Step 2: P0 选择先计分基地0（丛林，无 afterScoring）
        const jungleOption = host.page.locator('[data-option-id]').filter({ hasText: /丛林|Jungle/ }).first();
        await expect(jungleOption).toBeVisible({ timeout: 5000 });
        await jungleOption.click();
        await host.page.waitForTimeout(1500);

        // 基地0计分完成，应该创建新的多基地选择交互（剩余基地1和2）
        await expect(host.page.locator('text=/选择先记分的基地|Choose which base to score first/')).toBeVisible({ timeout: 5000 });
        await host.page.screenshot({ path: testInfo.outputPath('03-second-choice.png'), fullPage: true });

        // Step 3: P0 选择计分基地2（海盗湾，有 afterScoring）
        const pirateCoveOption = host.page.locator('[data-option-id]').filter({ hasText: /海盗湾|Pirate Cove/ }).first();
        await expect(pirateCoveOption).toBeVisible({ timeout: 5000 });
        await pirateCoveOption.click();
        await host.page.waitForTimeout(1500);

        // 海盗湾 afterScoring 创建交互（P1 亚军移动随从）
        await expect(host.page.locator('text=/海盗湾|Pirate Cove/')).toBeVisible({ timeout: 5000 });
        await host.page.screenshot({ path: testInfo.outputPath('04-pirate-cove-interaction.png'), fullPage: true });

        // Step 4: 跳过海盗湾交互（如果有跳过按钮）
        const skipButton = host.page.locator('button').filter({ hasText: /跳过|Skip/ });
        if (await skipButton.isVisible()) {
            await skipButton.click();
            await host.page.waitForTimeout(1500);
        }

        // 海盗湾交互解决后，应该弹出最后一个 multi_base_scoring 交互
        await expect(host.page.locator('text=/计分最后一个基地|Score the last base/')).toBeVisible({ timeout: 5000 });
        await host.page.screenshot({ path: testInfo.outputPath('05-last-base.png'), fullPage: true });

        // Step 5: P0 选择计分最后一个基地（忍者道场）
        const ninjaDojoOption = host.page.locator('[data-option-id]').filter({ hasText: /忍者道场|Ninja Dojo/ }).first();
        await expect(ninjaDojoOption).toBeVisible({ timeout: 5000 });
        await ninjaDojoOption.click();
        await host.page.waitForTimeout(1500);

        // 忍者道场 afterScoring 创建交互（P0 冠军消灭随从）
        await expect(host.page.locator('text=/忍者道场|Ninja Dojo/')).toBeVisible({ timeout: 5000 });
        await host.page.screenshot({ path: testInfo.outputPath('06-ninja-dojo-interaction.png'), fullPage: true });

        // Step 6: P0 响应忍者道场交互（跳过消灭）
        const noDestroyButton = host.page.locator('button').filter({ hasText: /不消灭|Don't destroy/ });
        if (await noDestroyButton.isVisible()) {
            await noDestroyButton.click();
            await host.page.waitForTimeout(1500);
        }

        // 所有基地计分完成，应该推进到 draw 阶段
        await host.page.screenshot({ path: testInfo.outputPath('07-final.png'), fullPage: true });

        // 验证：3 个基地都被替换了
        const finalState = await host.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        
        expect(finalState.core.bases).toHaveLength(3);
        expect(finalState.core.bases[0].defId).not.toBe('base_the_jungle');
        expect(finalState.core.bases[1].defId).not.toBe('base_ninja_dojo');
        expect(finalState.core.bases[2].defId).not.toBe('base_pirate_cove');

        // 验证：玩家分数正确（每个基地冠军 3VP，亚军 2VP）
        // 基地0（丛林）：P0 冠军 3VP，P1 亚军 2VP
        // 基地2（海盗湾）：P0 冠军 3VP，P1 亚军 2VP
        // 基地1（忍者道场）：P0 冠军 3VP，P1 亚军 2VP
        expect(finalState.core.players['0'].vp).toBe(9); // 3 + 3 + 3
        expect(finalState.core.players['1'].vp).toBe(6); // 2 + 2 + 2

        console.log('[E2E] ✅ 测试通过：3个基地依次计分，每个基地只计分一次');
    });
});
