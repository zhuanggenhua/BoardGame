/**
 * 响应窗口跳过逻辑测试
 * 验证修复：重新开始一轮时跳过没有可响应内容的玩家
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import type { SmashUpCore, MinionOnBase } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';

describe('响应窗口跳过逻辑', () => {
    it('重新开始一轮时应跳过没有可响应内容的玩家', () => {
        const runner = new GameTestRunner<SmashUpCore, any, any>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            random: {
                random: () => 0.5,
                d: (max) => Math.ceil(max / 2),
                range: (min, max) => Math.floor((min + max) / 2),
                shuffle: (arr) => [...arr],
            },
            setup: (playerIds: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                
                // 构造场景：
                // - 玩家 0 手牌中有 special 卡（wizard_portal）
                // - 玩家 1 手牌中没有 special 卡
                // - 基地即将计分
                core.factionSelection = undefined;
                sys.phase = 'playCards';
                
                // 替换第一个基地为低临界点基地
                core.bases[0] = {
                    defId: 'base_the_mothership', // 临界点 20
                    minions: [],
                    ongoingActions: [],
                };
                
                // 添加足够的随从达到临界点（25 > 20）
                const fakeMinions: MinionOnBase[] = Array.from({ length: 5 }, (_, i) => ({
                    uid: `fake-${i}`,
                    defId: 'test_minion',
                    owner: '0',
                    controller: '0',
                    basePower: 5,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    powerCounters: 0,
                    attachedActions: [],
                    talentUsed: false,
                }));
                core.bases[0].minions = fakeMinions;
                
                // 玩家 0 有 special 卡（pirate_full_sail - 简单的 special 卡，不需要交互），玩家 1 没有
                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'pirate_full_sail', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [
                    { uid: 'card-2', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' },
                ];
                
                return { core, sys };
            },
        });
        
        // 推进到 scoreBases 阶段
        runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        
        // 验证：Me First! 窗口打开，且当前响应者是玩家 0（有 special 卡）
        const state1 = runner.getState();
        expect(state1.sys.responseWindow?.current).toBeDefined();
        expect(state1.sys.responseWindow?.current?.windowType).toBe('meFirst');
        expect(state1.sys.responseWindow?.current?.responderQueue).toEqual(['0', '1']);
        expect(state1.sys.responseWindow?.current?.currentResponderIndex).toBe(0);
        
        // 玩家 0 打出 special 卡（pirate_full_sail - 不创建交互）
        runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });
        
        // 验证：窗口仍然打开，推进到玩家 1，但玩家 1 没有 special 卡，应该被跳过，重新回到玩家 0
        const state2 = runner.getState();
        console.log('[Test] After player 0 plays card:', {
            hasWindow: !!state2.sys.responseWindow?.current,
            currentResponderIndex: state2.sys.responseWindow?.current?.currentResponderIndex,
            actionTakenThisRound: state2.sys.responseWindow?.current?.actionTakenThisRound,
        });
        
        // 【关键验证】重新开始一轮时，应该跳过玩家 1（没有 special 卡），直接回到玩家 0
        // 如果修复生效，currentResponderIndex 应该是 0
        // 如果修复未生效，currentResponderIndex 会是 1（玩家 1 没有牌但仍然轮到他）
        expect(state2.sys.responseWindow?.current).toBeDefined();
        expect(state2.sys.responseWindow?.current?.currentResponderIndex).toBe(0);
        
        // 玩家 0 pass
        runner.dispatch('RESPONSE_PASS', { playerId: '0' });
        
        // 验证：窗口关闭（因为玩家 1 没有 special 卡，被自动跳过）
        const state3 = runner.getState();
        expect(state3.sys.responseWindow?.current).toBeUndefined();
    });
    
    it('所有玩家都没有可响应内容时应立即关闭窗口', () => {
        const runner = new GameTestRunner<SmashUpCore, any, any>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            random: {
                random: () => 0.5,
                d: (max) => Math.ceil(max / 2),
                range: (min, max) => Math.floor((min + max) / 2),
                shuffle: (arr) => [...arr],
            },
            setup: (playerIds: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                
                // 构造场景：两个玩家都没有 special 卡
                core.factionSelection = undefined;
                sys.phase = 'playCards';
                
                // 替换第一个基地为低临界点基地
                core.bases[0] = {
                    defId: 'base_the_mothership', // 临界点 20
                    minions: [],
                    ongoingActions: [],
                };
                
                // 添加足够的随从达到临界点（25 > 20）
                const fakeMinions: MinionOnBase[] = Array.from({ length: 5 }, (_, i) => ({
                    uid: `fake-${i}`,
                    defId: 'test_minion',
                    owner: '0',
                    controller: '0',
                    basePower: 5,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    powerCounters: 0,
                    attachedActions: [],
                    talentUsed: false,
                }));
                core.bases[0].minions = fakeMinions;
                
                // 两个玩家都没有 special 卡
                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                ];
                core.players['1'].hand = [
                    { uid: 'card-2', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' },
                ];
                
                return { core, sys };
            },
        });
        
        // 推进到 scoreBases 阶段
        runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        
        // 验证：窗口应该立即关闭（因为所有玩家都没有 special 卡）
        const state = runner.getState();
        expect(state.sys.responseWindow?.current).toBeUndefined();
    });
    
    it('交互失败时应解锁但不推进（当前响应者继续响应）', () => {
        const runner = new GameTestRunner<SmashUpCore, any, any>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            random: {
                random: () => 0.5,
                d: (max) => Math.ceil(max / 2),
                range: (min, max) => Math.floor((min + max) / 2),
                shuffle: (arr) => [...arr],
            },
            setup: (playerIds: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                
                // 构造场景：
                // - 玩家 0 有"承受压力"（beforeScoring special）
                // - 玩家 0 在计分基地上有随从（有力量指示物）
                // - 玩家 0 在其他基地上没有随从（交互会失败）
                // - 玩家 1 有另一张 special 卡
                core.factionSelection = undefined;
                sys.phase = 'playCards';
                
                // 清空所有基地的随从
                for (let i = 0; i < core.bases.length; i++) {
                    core.bases[i].minions = [];
                }
                
                // 替换第一个基地为低临界点基地
                core.bases[0] = {
                    defId: 'base_the_mothership', // 临界点 20
                    minions: [],
                    ongoingActions: [],
                };
                
                // 玩家 0 在计分基地上有随从（有力量指示物）
                const minion: MinionOnBase = {
                    uid: 'minion-1',
                    defId: 'giant_ant_soldier',
                    owner: '0',
                    controller: '0',
                    basePower: 3,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    powerCounters: 2, // 有力量指示物
                    attachedActions: [],
                    talentUsed: false,
                };
                core.bases[0].minions = [minion];
                
                // 添加足够的随从达到临界点（25 > 20）
                const fakeMinions: MinionOnBase[] = Array.from({ length: 5 }, (_, i) => ({
                    uid: `fake-${i}`,
                    defId: 'test_minion',
                    owner: '1',
                    controller: '1',
                    basePower: 5,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    powerCounters: 0,
                    attachedActions: [],
                    talentUsed: false,
                }));
                core.bases[0].minions.push(...fakeMinions);
                
                // 玩家 0 有"承受压力"，玩家 1 有另一张 special 卡
                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'giant_ant_under_pressure', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [
                    { uid: 'card-2', defId: 'pirate_full_sail', type: 'action', owner: '1' },
                ];
                
                return { core, sys };
            },
        });
        
        // 推进到 scoreBases 阶段
        runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        
        // 验证：Me First! 窗口打开，当前响应者是玩家 0
        const state1 = runner.getState();
        expect(state1.sys.responseWindow?.current).toBeDefined();
        expect(state1.sys.responseWindow?.current?.windowType).toBe('meFirst');
        expect(state1.sys.responseWindow?.current?.currentResponderIndex).toBe(0);
        
        // 玩家 0 打出"承受压力"
        runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });
        
        // 验证：交互已创建（选择来源随从）
        const state2 = runner.getState();
        expect(state2.sys.interaction?.current).toBeDefined();
        expect(state2.sys.interaction?.current?.data?.sourceId).toBe('giant_ant_under_pressure_choose_source');
        
        // 【调试】验证场景设置正确：玩家 0 只在计分基地上有随从
        const player0Minions = state2.core.bases.flatMap((base, idx) => 
            base.minions
                .filter(m => m.controller === '0')
                .map(m => ({ uid: m.uid, baseIndex: idx }))
        );
        expect(player0Minions).toHaveLength(1); // 只有 1 个随从
        expect(player0Minions[0].baseIndex).toBe(0); // 在计分基地上
        
        // 【调试】输出所有基地的随从信息
        console.log('[Test] All bases minions:', state2.core.bases.map((base, idx) => ({
            baseIndex: idx,
            minions: base.minions.map(m => ({ uid: m.uid, controller: m.controller, powerCounters: m.powerCounters }))
        })));
        
        // 【调试】输出 scoringEligibleBaseIndices
        console.log('[Test] scoringEligibleBaseIndices:', state2.core.scoringEligibleBaseIndices);
        
        // 玩家 0 选择来源随从（minion-1）
        // 需要找到对应的 optionId
        const sourceOptions = state2.sys.interaction!.current!.data.options;
        console.log('[Test] Source options:', sourceOptions.map((opt: any) => ({
            id: opt.id,
            label: opt.label,
            value: opt.value,
        })));
        
        const sourceOption = sourceOptions.find((opt: any) => opt.value?.minionUid === 'minion-1');
        console.log('[Test] Found source option:', sourceOption);
        expect(sourceOption).toBeDefined();
        
        const resolveResult = runner.resolveInteraction('0', { optionId: sourceOption!.id });
        
        console.log('[Test] Dispatch result:', {
            success: resolveResult.success,
            error: resolveResult.error,
            events: resolveResult.events.map((e: any) => e.type),
        });
        
        // 验证：交互失败（没有其他基地的随从），产生 ABILITY_FEEDBACK 事件
        const state3 = resolveResult.finalState;
        
        // 【调试】输出解决结果
        console.log('[Test] Resolve result events:', resolveResult.events.map(e => e.type));
        console.log('[Test] After resolve interaction:', {
            current: state3.sys.interaction?.current?.id,
            queue: state3.sys.interaction?.queue?.map(i => i.id),
        });
        
        // 【关键验证】交互已解决（handler 返回 ABILITY_FEEDBACK，没有创建新交互）
        // 响应窗口应该解锁（pendingInteractionId 为 undefined）
        // 当前响应者仍然是玩家 0（没有推进，因为交互失败）
        expect(state3.sys.interaction?.current).toBeUndefined(); // 交互已解决
        expect(state3.sys.responseWindow?.current).toBeDefined();
        expect(state3.sys.responseWindow?.current?.currentResponderIndex).toBe(0);
        expect(state3.sys.responseWindow?.current?.pendingInteractionId).toBeUndefined(); // 已解锁
        
        // 玩家 0 可以继续响应（pass）
        runner.dispatch('RESPONSE_PASS', { playerId: '0' });
        
        // 验证：推进到玩家 1
        const state4 = runner.getState();
        expect(state4.sys.responseWindow?.current).toBeDefined();
        expect(state4.sys.responseWindow?.current?.currentResponderIndex).toBe(1);
    });
});
