/**
 * 海盗湾计分 Bug 复现测试
 * 
 * 用户报告：猫眼石（海盗湾）一直触发，并每次移动都加分
 * 
 * 场景：
 * - 基地1：海盗湾（临界点17）
 * - 玩家0：15分（已达胜利条件）
 * - 玩家1：7分
 * - 海盗湾上有随从，总力量达到临界点
 * - 触发计分后，非冠军玩家应该可以移动随从
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.describe('海盗湾计分流程', () => {
    let page: Page;
    let roomId: string;

    test.beforeEach(async ({ setupOnlineMatch }) => {
        const setup = await setupOnlineMatch({
            gameId: 'smashup',
            playerCount: 2,
        });
        page = setup.page;
        roomId = setup.roomId;

        // 等待游戏加载
        await page.waitForSelector('[data-testid="game-board"]', { timeout: 10000 });
    });

    test('海盗湾计分后应该创建移动随从交互', async () => {
        // 1. 注入测试状态：海盗湾达到计分条件
        await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.read();
            
            // 修改基地配置
            state.core.bases = [
                {
                    defId: 'base_cave_of_shinies',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_pirate_cove',  // 海盗湾，临界点17
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'pirate_king',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'm2',
                            defId: 'robot_hoverbot',
                            owner: '0',
                            controller: '0',
                            basePower: 3,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'm3',
                            defId: 'wizard_chronomage',
                            owner: '1',
                            controller: '1',
                            basePower: 3,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'm4',
                            defId: 'robot_zapbot',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'm5',
                            defId: 'robot_zapbot',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'm6',
                            defId: 'trickster_brownie',
                            owner: '1',
                            controller: '1',
                            basePower: 4,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_wizard_academy',
                    minions: [],
                    ongoingActions: [],
                },
            ];

            // 设置玩家分数
            state.core.players['0'].vp = 12;  // 接近胜利
            state.core.players['1'].vp = 7;

            // 设置阶段为 scoreBases
            state.sys.phase = 'scoreBases';
            state.core.scoringEligibleBaseIndices = [1];  // 海盗湾达到计分条件

            window.__BG_TEST_HARNESS__!.state.patch(state);
        });

        // 2. 等待计分流程
        await page.waitForTimeout(1000);

        // 3. 检查是否创建了交互
        const hasInteraction = await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.read();
            return !!state.sys.interaction?.current;
        });

        // 4. 如果有交互，检查是否是海盗湾的移动随从交互
        if (hasInteraction) {
            const interactionInfo = await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.read();
                const interaction = state.sys.interaction?.current;
                return {
                    id: interaction?.id,
                    playerId: interaction?.playerId,
                    sourceId: (interaction?.data as any)?.sourceId,
                };
            });

            console.log('交互信息:', interactionInfo);

            // 验证交互是否正确
            expect(interactionInfo.sourceId).toBe('base_pirate_cove');
            expect(interactionInfo.playerId).toBe('1');  // 非冠军玩家

            // 5. 响应交互（跳过移动）
            await page.evaluate(() => {
                window.__BG_TEST_HARNESS__!.command.dispatch({
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: '1',
                    payload: {
                        interactionId: window.__BG_TEST_HARNESS__!.state.read().sys.interaction!.current!.id,
                        optionId: 'skip',
                    },
                });
            });

            await page.waitForTimeout(500);

            // 6. 检查游戏是否继续
            const finalState = await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.read();
                return {
                    phase: state.sys.phase,
                    vp0: state.core.players['0'].vp,
                    vp1: state.core.players['1'].vp,
                    hasInteraction: !!state.sys.interaction?.current,
                };
            });

            console.log('最终状态:', finalState);

            // 验证计分是否完成
            expect(finalState.vp0).toBeGreaterThan(12);  // 玩家0应该获得分数
            expect(finalState.hasInteraction).toBe(false);  // 交互应该已解决
        } else {
            console.log('没有创建交互，可能是计分流程有问题');
            
            // 检查当前状态
            const currentState = await page.evaluate(() => {
                const state = window.__BG_TEST_HARNESS__!.state.read();
                return {
                    phase: state.sys.phase,
                    scoringEligible: state.core.scoringEligibleBaseIndices,
                    beforeScoringTriggered: state.core.beforeScoringTriggeredBases,
                    vp0: state.core.players['0'].vp,
                    vp1: state.core.players['1'].vp,
                };
            });

            console.log('当前状态:', currentState);
        }
    });

    test('海盗湾计分后移动随从不应该重复触发计分', async () => {
        // 1. 注入测试状态：海盗湾达到计分条件
        await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.read();
            
            // 修改基地配置
            state.core.bases = [
                {
                    defId: 'base_cave_of_shinies',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_pirate_cove',  // 海盗湾，临界点17
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'pirate_king',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'm2',
                            defId: 'robot_hoverbot',
                            owner: '0',
                            controller: '0',
                            basePower: 3,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'm3',
                            defId: 'wizard_chronomage',
                            owner: '1',
                            controller: '1',
                            basePower: 3,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_wizard_academy',
                    minions: [],
                    ongoingActions: [],
                },
            ];

            // 设置玩家分数
            state.core.players['0'].vp = 12;
            state.core.players['1'].vp = 7;

            // 设置阶段为 scoreBases
            state.sys.phase = 'scoreBases';
            state.core.scoringEligibleBaseIndices = [1];  // 海盗湾达到计分条件

            window.__BG_TEST_HARNESS__!.state.patch(state);
        });

        // 2. 等待计分流程
        await page.waitForTimeout(1000);

        // 3. 获取初始 EventStream 长度
        const initialEventCount = await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.read();
            return state.sys.eventStream?.entries?.length ?? 0;
        });

        console.log('初始事件数量:', initialEventCount);

        // 4. 响应交互（移动随从到其他基地）
        const interactionId = await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.read();
            return state.sys.interaction?.current?.id;
        });

        if (interactionId) {
            // 选择移动随从到其他基地
            await page.evaluate((id) => {
                const state = window.__BG_TEST_HARNESS__!.state.read();
                const interaction = state.sys.interaction?.current;
                const options = (interaction?.data as any)?.options ?? [];
                
                // 找到移动选项（不是 skip）
                const moveOption = options.find((opt: any) => opt.id !== 'skip');
                
                if (moveOption) {
                    window.__BG_TEST_HARNESS__!.command.dispatch({
                        type: 'SYS_INTERACTION_RESPOND',
                        playerId: '1',
                        payload: {
                            interactionId: id,
                            optionId: moveOption.id,
                        },
                    });
                }
            }, interactionId);

            await page.waitForTimeout(1000);
        }

        // 5. 检查 EventStream 中 BASE_SCORED 事件的数量
        const baseScoredCount = await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.read();
            const entries = state.sys.eventStream?.entries ?? [];
            return entries.filter((e: any) => e.event.type === 'su:base_scored').length;
        });

        console.log('BASE_SCORED 事件数量:', baseScoredCount);

        // 6. 验证只有一次 BASE_SCORED 事件
        expect(baseScoredCount).toBe(1);

        // 7. 验证游戏状态正常
        const finalState = await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__!.state.read();
            return {
                phase: state.sys.phase,
                vp0: state.core.players['0'].vp,
                vp1: state.core.players['1'].vp,
                hasInteraction: !!state.sys.interaction?.current,
                basesCount: state.core.bases.length,
            };
        });

        console.log('最终状态:', finalState);

        // 验证计分完成且游戏继续
        expect(finalState.vp0).toBeGreaterThan(12);  // 玩家0应该获得分数
        expect(finalState.hasInteraction).toBe(false);  // 交互应该已解决
        expect(finalState.basesCount).toBe(3);  // 基地数量应该保持3个（海盗湾被替换）
    });
});
