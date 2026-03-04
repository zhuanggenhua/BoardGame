/**
 * Bug Fix 验证：steampunk_aggromotive（蒸汽机车）基地级别力量修正
 * 
 * 修复前：给第一个随从 +5 力量，随从移除后力量会"跳"到下一个随从
 * 修复后：给玩家在该基地的总力量 +5，不依赖于具体随从
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getPlayerEffectivePowerOnBase, getTotalEffectivePowerOnBase, getEffectivePower } from '../domain/ongoingModifiers';
import { makeMinion, makeState } from './helpers';
import { initAllAbilities, resetAbilityInit } from '../abilities';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('Bug Fix: steampunk_aggromotive 基地级别力量修正', () => {
    it('随从移除后，总力量仍然正确（不会跳到其他随从）', () => {
        // 初始状态：玩家 0 有两个随从（力量 2 和 3）+ 蒸汽机车
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0, powerCounters: 0 });
        const m2 = makeMinion('m2', 'test_b', '0', 3, { powerModifier: 0, powerCounters: 0 });
        const base1 = {
            defId: 'base_a',
            minions: [m1, m2],
            ongoingActions: [{ uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '0' }],
        };
        const state1 = makeState({ bases: [base1] });
        
        // 初始总力量 = 2 + 3 + 5 = 10
        expect(getPlayerEffectivePowerOnBase(state1, state1.bases[0], 0, '0')).toBe(10);
        
        // 移除第一个随从
        const base2 = {
            defId: 'base_a',
            minions: [m2], // 只剩 m2
            ongoingActions: [{ uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '0' }],
        };
        const state2 = makeState({ bases: [base2] });
        
        // 移除后总力量 = 3 + 5 = 8（蒸汽机车仍然生效，因为还有随从）
        expect(getPlayerEffectivePowerOnBase(state2, state2.bases[0], 0, '0')).toBe(8);
    });
    
    it('所有随从移除后，蒸汽机车不再生效', () => {
        const base = {
            defId: 'base_a',
            minions: [],
            ongoingActions: [{ uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '0' }],
        };
        const state = makeState({ bases: [base] });
        
        // 没有随从时，蒸汽机车不生效
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '0')).toBe(0);
    });
    
    it('多张蒸汽机车叠加，随从移除后仍然正确', () => {
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0, powerCounters: 0 });
        const m2 = makeMinion('m2', 'test_b', '0', 3, { powerModifier: 0, powerCounters: 0 });
        const base1 = {
            defId: 'base_a',
            minions: [m1, m2],
            ongoingActions: [
                { uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '0' },
                { uid: 'ag2', defId: 'steampunk_aggromotive', ownerId: '0' },
            ],
        };
        const state1 = makeState({ bases: [base1] });
        
        // 初始总力量 = 2 + 3 + 10 = 15
        expect(getPlayerEffectivePowerOnBase(state1, state1.bases[0], 0, '0')).toBe(15);
        
        // 移除第一个随从
        const base2 = {
            defId: 'base_a',
            minions: [m2],
            ongoingActions: [
                { uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '0' },
                { uid: 'ag2', defId: 'steampunk_aggromotive', ownerId: '0' },
            ],
        };
        const state2 = makeState({ bases: [base2] });
        
        // 移除后总力量 = 3 + 10 = 13
        expect(getPlayerEffectivePowerOnBase(state2, state2.bases[0], 0, '0')).toBe(13);
    });
    
    it('不同玩家的蒸汽机车互不影响', () => {
        const m0 = makeMinion('m0', 'test_a', '0', 2, { powerModifier: 0, powerCounters: 0 });
        const m1 = makeMinion('m1', 'test_b', '1', 3, { powerModifier: 0, powerCounters: 0 });
        const base = {
            defId: 'base_a',
            minions: [m0, m1],
            ongoingActions: [
                { uid: 'ag0', defId: 'steampunk_aggromotive', ownerId: '0' },
                { uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '1' },
            ],
        };
        const state = makeState({ bases: [base] });
        
        // 玩家 0 总力量 = 2 + 5 = 7
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '0')).toBe(7);
        // 玩家 1 总力量 = 3 + 5 = 8
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '1')).toBe(8);
    });
    
    it('getTotalEffectivePowerOnBase 包含基地级别修正', () => {
        const m0 = makeMinion('m0', 'test_a', '0', 2, { powerModifier: 0, powerCounters: 0 });
        const m1 = makeMinion('m1', 'test_b', '1', 3, { powerModifier: 0, powerCounters: 0 });
        const base = {
            defId: 'base_a',
            minions: [m0, m1],
            ongoingActions: [
                { uid: 'ag0', defId: 'steampunk_aggromotive', ownerId: '0' },
                { uid: 'ag1', defId: 'steampunk_aggromotive', ownerId: '1' },
            ],
        };
        const state = makeState({ bases: [base] });
        
        // 基地总力量 = 玩家0(2+5) + 玩家1(3+5) = 15
        expect(getTotalEffectivePowerOnBase(state, state.bases[0], 0)).toBe(15);
    });
    
    it('POD 版本蒸汽机车也能正常工作', () => {
        const m0 = makeMinion('m0', 'test_a', '0', 3, { powerModifier: 0, powerCounters: 0 });
        const base = {
            defId: 'base_a',
            minions: [m0],
            ongoingActions: [
                { uid: 'ag0', defId: 'steampunk_aggromotive_pod', ownerId: '0' },
            ],
        };
        const state = makeState({ bases: [base] });
        
        // 玩家 0 总力量 = 3 + 5 = 8
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '0')).toBe(8);
        // 基地总力量也应该是 8
        expect(getTotalEffectivePowerOnBase(state, state.bases[0], 0)).toBe(8);
    });
});

describe('Bug Fix: steampunk_steam_man POD 版本不应该翻倍', () => {
    it('steampunk_steam_man_pod 应该只给 +1 力量，不是 +2', () => {
        const m0 = makeMinion('m0', 'steampunk_steam_man_pod', '0', 3, { powerModifier: 0, powerCounters: 0 });
        const base = {
            defId: 'base_a',
            minions: [m0],
            ongoingActions: [
                { uid: 'action1', defId: 'test_action', ownerId: '0' },
            ],
        };
        const state = makeState({ bases: [base] });
        
        // 蒸汽人 POD 版本应该只给 +1 力量（不是 +2）
        expect(getEffectivePower(state, m0, 0)).toBe(4); // 3 (base) + 1 (action bonus)
    });
    
    it('steampunk_steam_man 基础版本也应该只给 +1 力量', () => {
        const m0 = makeMinion('m0', 'steampunk_steam_man', '0', 3, { powerModifier: 0, powerCounters: 0 });
        const base = {
            defId: 'base_a',
            minions: [m0],
            ongoingActions: [
                { uid: 'action1', defId: 'test_action', ownerId: '0' },
            ],
        };
        const state = makeState({ bases: [base] });
        
        expect(getEffectivePower(state, m0, 0)).toBe(4); // 3 (base) + 1 (action bonus)
    });
});
