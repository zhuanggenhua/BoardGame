/**
 * afterScoring 响应窗口中打出卡牌的执行测试
 * 
 * 问题：用户在 afterScoring 响应窗口中打出"重返深海"和"我们乃最强"后，没有任何日志反馈
 * 根因：afterScoring 卡牌在打出时只生成 ARMED 事件，不立即执行能力
 * 修复：在 afterScoring 响应窗口中打出 afterScoring 卡牌时，立即执行能力
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent, MinionOnBase } from '../domain/types';
import { SU_EVENT_TYPES } from '../domain/events';
import { createInitialSystemState } from '../../../engine/pipeline';

describe('afterScoring 响应窗口中打出卡牌的执行', () => {
    it('在 afterScoring 响应窗口中打出"重返深海"应该立即执行能力', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, random) => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                
                // 跳过派系选择
                core.factionSelection = undefined;
                sys.phase = 'scoreBases';
                
                // 设置基地达到临界点
                core.bases[0] = {
                    defId: 'base_the_mothership',  // 临界点 20
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'innsmouth_the_locals',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                        {
                            uid: 'm2',
                            defId: 'innsmouth_the_locals',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                    ] as MinionOnBase[],
                    ongoingActions: [],
                };
                
                // 设置玩家手牌
                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'innsmouth_return_to_the_sea', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [];
                
                // 打开 afterScoring 响应窗口
                sys.responseWindow = {
                    current: {
                        id: 'test-afterscoring',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                        windowType: 'afterScoring',
                        sourceId: 'test',
                        actionTakenThisRound: false,
                        consecutivePassRounds: 0,
                    },
                };
                
                return { core, sys };
            },
        });

        // 打出"重返深海"
        const result = runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });

        const events = result.events;

        // 验证：应该生成 ACTION_PLAYED 事件
        const actionPlayedEvent = events.find(e => e.type === SU_EVENT_TYPES.ACTION_PLAYED);
        expect(actionPlayedEvent).toBeDefined();

        // 验证：不应该生成 SPECIAL_AFTER_SCORING_ARMED 事件（因为在响应窗口中立即执行）
        const armedEvent = events.find(e => e.type === SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_ARMED);
        expect(armedEvent).toBeUndefined();

        // 验证：应该立即创建交互，而不是静默无效果
        const interactionState = (result.finalState?.sys as any)?.interaction;
        const interaction = interactionState?.current ?? interactionState?.queue?.[0];
        expect(interaction?.data?.sourceId).toBe('innsmouth_return_to_the_sea');
        expect(interaction?.data?.options?.some((entry: any) => entry.value?.minionDefId === 'innsmouth_the_locals')).toBe(true);
    });

    it('在 afterScoring 响应窗口中打出"我们乃最强"应该立即执行能力', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, random) => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                
                // 跳过派系选择
                core.factionSelection = undefined;
                sys.phase = 'scoreBases';
                
                // 设置基地达到临界点
                core.bases[0] = {
                    defId: 'base_the_mothership',  // 临界点 20
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'alien_invader',
                            owner: '0',
                            controller: '0',
                            basePower: 3,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                        {
                            uid: 'm2',
                            defId: 'robot_microbot_alpha',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 0,
                            attachedActions: [],
                            talentUsed: false,
                        },
                        {
                            uid: 'm3',
                            defId: 'ninja_shinobi',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                    ] as MinionOnBase[],
                    ongoingActions: [],
                };
                
                // 设置玩家手牌
                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [];
                
                // 打开 afterScoring 响应窗口
                sys.responseWindow = {
                    current: {
                        id: 'test-afterscoring',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                        windowType: 'afterScoring',
                        sourceId: 'test',
                        actionTakenThisRound: false,
                        consecutivePassRounds: 0,
                    },
                };
                
                return { core, sys };
            },
        });

        // 打出"我们乃最强"
        const result = runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });

        const events = result.events;

        // 验证：应该生成 ACTION_PLAYED 事件
        const actionPlayedEvent = events.find(e => e.type === SU_EVENT_TYPES.ACTION_PLAYED);
        expect(actionPlayedEvent).toBeDefined();

        // 验证：不应该生成 SPECIAL_AFTER_SCORING_ARMED 事件（因为在响应窗口中立即执行）
        const armedEvent = events.find(e => e.type === SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_ARMED);
        expect(armedEvent).toBeUndefined();

        // 验证：应该生成交互（选择转移指示物）
        const state = runner.getState();
        const hasInteraction = state.sys.interaction?.queue?.length > 0 || !!state.sys.interaction?.current;
        expect(hasInteraction).toBe(true);
    });
});
