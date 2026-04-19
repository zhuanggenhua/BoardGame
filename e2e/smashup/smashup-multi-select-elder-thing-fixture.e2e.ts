/**
 * 大杀四方 - 远古之物多选交互 E2E 测试（使用 Fixture）
 * 
 * 测试远古之物"消灭两个己方随从"的多选功能
 * 使用 Fixture 自动处理房间创建和派系选择
 */

import { test, expect, createSmashUpMatch } from '../fixtures';
import { readCoreState, applyCoreState } from '../helpers/smashup';

test.describe('远古之物 - 消灭两个己方随从（多选）', () => {
    test('选择消灭时应显示多选界面，选择2个随从后确认', async ({ browser }, testInfo) => {
        test.setTimeout(120000); // 增加到 120 秒，因为创建对局 + 选择派系需要时间
        
        // 使用工厂函数创建包含远古之物的对局
        // 远古之物索引 13，外星人索引 3
        const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
            hostFactions: [13, 3], // 远古之物 + 外星人
            guestFactions: [0, 1], // 海盗 + 忍者
        });
        
        if (!setup) {
            test.skip();
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        
        // 读取当前状态
        const currentState = await readCoreState(hostPage);
        
        // 注入测试状态：场上有远古之物 + 3个其他随从
        const testState = {
            ...currentState,
            phase: 'main',
            currentPlayer: '0',
            bases: [{
                defId: 'base_the_homeworld',
                breakpoint: 20,
                minions: [
                    { uid: 'et-1', defId: 'elder_thing_elder_thing', controller: '0', owner: '0', power: 5 },
                    { uid: 'm1', defId: 'alien_invader', controller: '0', owner: '0', power: 3 },
                    { uid: 'm2', defId: 'alien_supreme_overlord', controller: '0', owner: '0', power: 4 },
                    { uid: 'm3', defId: 'alien_scout', controller: '0', owner: '0', power: 2 },
                ],
                ongoingActions: []
            }]
        };
        
        await applyCoreState(hostPage, testState);
        
        // 等待状态应用
        await hostPage.waitForTimeout(1000);
        
        // 触发远古之物 onPlay（通过点击卡牌或调试面板）
        // 这里需要根据实际 UI 实现来触发技能
        // 方案 1：如果有技能按钮，直接点击
        // 方案 2：通过调试面板分发命令
        
        // 假设有技能按钮可以点击
        const abilityButton = hostPage.locator('button:has-text("消灭两个己方其他随从")');
        if (await abilityButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await abilityButton.click();
        } else {
            // 如果没有按钮，通过调试面板分发命令
            await hostPage.evaluate(() => {
                const dispatch = (window as any).__BG_DISPATCH__;
                if (dispatch) {
                    dispatch({
                        type: 'ABILITY_ACTIVATE',
                        payload: {
                            abilityId: 'elder_thing_elder_thing',
                            sourceUid: 'et-1',
                            trigger: 'onPlay',
                            baseIndex: 0
                        }
                    });
                }
            });
        }

        // 等待第一个选择：消灭 vs 放牌库底
        await hostPage.waitForFunction(
            () => {
                const state = (window as any).__BG_STATE__;
                return state?.sys?.interaction?.current?.data?.sourceId === 'elder_thing_elder_thing_choice';
            },
            { timeout: 10000 }
        );

        // 选择"消灭"
        await hostPage.click('button:has-text("消灭两个己方其他随从")');

        // 等待多选界面
        await hostPage.waitForFunction(
            () => {
                const state = (window as any).__BG_STATE__;
                return state?.sys?.interaction?.current?.data?.sourceId === 'elder_thing_elder_thing_destroy_select';
            },
            { timeout: 10000 }
        );

        // 验证显示了3个选项（排除远古之物自己）
        const optionCount = await hostPage.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state?.sys?.interaction?.current?.data?.options?.length || 0;
        });
        expect(optionCount).toBe(3);

        // 选择2个随从（点击前两个卡牌）
        await hostPage.evaluate(() => {
            const cards = document.querySelectorAll('[data-testid^="prompt-card-"]');
            if (cards.length >= 2) {
                (cards[0] as HTMLElement).click();
                (cards[1] as HTMLElement).click();
            }
        });

        // 等待一下让 UI 更新
        await hostPage.waitForTimeout(500);

        // 验证确认按钮显示已选数量
        await expect(hostPage.locator('button:has-text("确认 (2)")')).toBeVisible();

        // 点击确认
        await hostPage.click('button:has-text("确认")');

        // 验证随从被消灭（只剩2个）
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_STATE__;
            const base = state?.bases?.[0];
            return base?.minions?.length === 2;
        }, { timeout: 10000 });

        const finalMinions = await hostPage.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state.bases[0].minions.map((m: any) => m.uid);
        });

        // 应该剩下远古之物和1个随从
        expect(finalMinions.length).toBe(2);
        expect(finalMinions).toContain('et-1');

        // 清理
        await hostContext.close().catch(() => {});
        await guestContext.close().catch(() => {});
    });

    test('恰好2个随从时选择消灭应直接执行，无需多选', async ({ browser }, testInfo) => {
        test.setTimeout(120000); // 增加到 120 秒
        
        // 使用工厂函数创建包含远古之物的对局
        const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
            hostFactions: [13, 3], // 远古之物 + 外星人
            guestFactions: [0, 1], // 海盗 + 忍者
        });
        
        if (!setup) {
            test.skip();
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        
        // 读取当前状态
        const currentState = await readCoreState(hostPage);
        
        // 注入测试状态：场上有远古之物 + 恰好2个其他随从
        const testState = {
            ...currentState,
            phase: 'main',
            currentPlayer: '0',
            bases: [{
                defId: 'base_the_homeworld',
                breakpoint: 20,
                minions: [
                    { uid: 'et-1', defId: 'elder_thing_elder_thing', controller: '0', owner: '0', power: 5 },
                    { uid: 'm1', defId: 'alien_invader', controller: '0', owner: '0', power: 3 },
                    { uid: 'm2', defId: 'alien_scout', controller: '0', owner: '0', power: 2 },
                ],
                ongoingActions: []
            }]
        };
        
        await applyCoreState(hostPage, testState);
        
        // 等待状态应用
        await hostPage.waitForTimeout(1000);
        
        // 触发远古之物 onPlay
        const abilityButton = hostPage.locator('button:has-text("消灭两个己方其他随从")');
        if (await abilityButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await abilityButton.click();
        } else {
            await hostPage.evaluate(() => {
                const dispatch = (window as any).__BG_DISPATCH__;
                if (dispatch) {
                    dispatch({
                        type: 'ABILITY_ACTIVATE',
                        payload: {
                            abilityId: 'elder_thing_elder_thing',
                            sourceUid: 'et-1',
                            trigger: 'onPlay',
                            baseIndex: 0
                        }
                    });
                }
            });
        }

        // 等待第一个选择
        await hostPage.waitForFunction(
            () => {
                const state = (window as any).__BG_STATE__;
                return state?.sys?.interaction?.current?.data?.sourceId === 'elder_thing_elder_thing_choice';
            },
            { timeout: 10000 }
        );

        // 选择消灭
        await hostPage.click('button:has-text("消灭两个己方其他随从")');

        // 应该直接消灭，不显示多选界面
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_STATE__;
            const base = state?.bases?.[0];
            return base?.minions?.length === 1; // 只剩远古之物
        }, { timeout: 10000 });

        const finalMinions = await hostPage.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            return state.bases[0].minions.map((m: any) => m.uid);
        });

        expect(finalMinions).toEqual(['et-1']);

        // 清理
        await hostContext.close().catch(() => {});
        await guestContext.close().catch(() => {});
    });
});
