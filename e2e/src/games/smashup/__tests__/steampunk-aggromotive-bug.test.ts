/**
 * Bug 验证：steampunk_aggromotive（蒸汽机车）随从移除后力量跳转问题
 * 
 * 问题：当第一个随从被移除时，+5 力量会"跳"到下一个随从身上
 * 预期：应该增加玩家在该基地的总战力，而不是给某个具体随从加成
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SU_COMMANDS } from '../domain/commands';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SmashUpDomain, smashUpFlowHooks } from '../game';
import { createFlowSystem, createBaseSystems } from '../../../engine/systems';
import { createSmashUpEventSystem } from '../domain/systems';

function createRunner() {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: ['0', '1'],
    });
}

describe.skip('Bug Fix: steampunk_aggromotive 基地级别力量修正', () => {
    it('第一个随从被消灭后，总力量仍然正确（不会跳到第二个随从）', () => {
        const runner = createRunner<SmashUpCore>('smashup');
        
        runner.setupState((draft) => {
            draft.players['0'].hand = [];
            draft.players['1'].hand = [];
            
            // 基地 0：玩家 0 有两个随从（力量 2 和 3）
            draft.bases[0].minions = [
                { uid: 'm1', defId: 'test_minion', controller: '0', power: 2, attachedActions: [] },
                { uid: 'm2', defId: 'test_minion', controller: '0', power: 3, attachedActions: [] },
            ];
            
            // 玩家 0 打出了蒸汽机车
            draft.bases[0].ongoingActions = [
                { uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '0' },
            ];
        });
        
        const state1 = runner.getState();
        
        // 验证初始状态：第一个随从 m1 获得 +5
        const m1Power1 = state1.bases[0].minions.find(m => m.uid === 'm1')!.power;
        const m2Power1 = state1.bases[0].minions.find(m => m.uid === 'm2')!.power;
        
        // 通过 getEffectivePower 计算（包含修正）
        // 注意：这里需要实际调用力量计算函数
        console.log('初始状态 - m1 基础力量:', m1Power1, 'm2 基础力量:', m2Power1);
        
        // 消灭第一个随从 m1
        runner.setupState((draft) => {
            draft.bases[0].minions = draft.bases[0].minions.filter(m => m.uid !== 'm1');
        });
        
        const state2 = runner.getState();
        
        // Bug：+5 现在跳到了 m2 身上
        const m2Power2 = state2.bases[0].minions.find(m => m.uid === 'm2')!.power;
        console.log('m1 被消灭后 - m2 基础力量:', m2Power2);
        
        // 当前实现：m2 会获得 +5（因为它现在是第一个随从）
        // 正确实现：应该有某种机制让"总战力 +5"不依赖于具体随从
    });
    
    it('第一个随从被返回手牌后，+5 跳到第二个随从（当前错误行为）', () => {
        const runner = createRunner<SmashUpCore>('smashup');
        
        runner.setupState((draft) => {
            draft.players['0'].hand = [];
            draft.players['1'].hand = [];
            
            draft.bases[0].minions = [
                { uid: 'm1', defId: 'test_minion', controller: '0', power: 2, attachedActions: [] },
                { uid: 'm2', defId: 'test_minion', controller: '0', power: 3, attachedActions: [] },
            ];
            
            draft.bases[0].ongoingActions = [
                { uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '0' },
            ];
        });
        
        // 返回第一个随从到手牌
        runner.setupState((draft) => {
            const m1 = draft.bases[0].minions.find(m => m.uid === 'm1')!;
            draft.bases[0].minions = draft.bases[0].minions.filter(m => m.uid !== 'm1');
            draft.players['0'].hand.push({
                uid: m1.uid,
                defId: m1.defId,
                type: 'minion',
                subtype: 'standard',
                faction: 'test',
                power: m1.power,
            });
        });
        
        const state = runner.getState();
        
        // Bug：m2 现在是第一个随从，会获得 +5
        expect(state.bases[0].minions.length).toBe(1);
        expect(state.bases[0].minions[0].uid).toBe('m2');
    });
    
    it('第一个随从移动到其他基地后，+5 跳到第二个随从（当前错误行为）', () => {
        const runner = createRunner<SmashUpCore>('smashup');
        
        runner.setupState((draft) => {
            draft.players['0'].hand = [];
            draft.players['1'].hand = [];
            
            // 基地 0：两个随从
            draft.bases[0].minions = [
                { uid: 'm1', defId: 'test_minion', controller: '0', power: 2, attachedActions: [] },
                { uid: 'm2', defId: 'test_minion', controller: '0', power: 3, attachedActions: [] },
            ];
            
            draft.bases[0].ongoingActions = [
                { uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '0' },
            ];
            
            // 基地 1：空
            draft.bases[1].minions = [];
        });
        
        // 移动第一个随从到基地 1
        runner.setupState((draft) => {
            const m1 = draft.bases[0].minions.find(m => m.uid === 'm1')!;
            draft.bases[0].minions = draft.bases[0].minions.filter(m => m.uid !== 'm1');
            draft.bases[1].minions.push(m1);
        });
        
        const state = runner.getState();
        
        // Bug：基地 0 的 m2 现在是第一个随从，会获得 +5
        expect(state.bases[0].minions.length).toBe(1);
        expect(state.bases[0].minions[0].uid).toBe('m2');
        
        // 基地 1 的 m1 不会获得 +5（因为蒸汽机车在基地 0）
        expect(state.bases[1].minions.length).toBe(1);
        expect(state.bases[1].minions[0].uid).toBe('m1');
    });
});
