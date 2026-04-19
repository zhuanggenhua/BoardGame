/**
 * 多个护盾叠加消耗测试
 * 
 * 测试目标：验证多个护盾按顺序消耗的逻辑
 * 
 * 当前 Bug：只消耗第一个护盾，剩余护盾被丢弃
 * 期望行为：按顺序消耗所有护盾，直到伤害完全抵消或护盾耗尽
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent, DamageDealtEvent } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';

const createCoreState = (): DiceThroneCore => ({
    players: {
        '0': {
            id: '0',
            hand: [],
            deck: [],
            discard: [],
            abilities: [],
            resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
            statusEffects: {},
            tokens: {},
            damageShields: [],
            abilityLevels: {},
        },
        '1': {
            id: '1',
            hand: [],
            deck: [],
            discard: [],
            abilities: [],
            resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
            statusEffects: {},
            tokens: {},
            damageShields: [],
            abilityLevels: {},
        },
    },
    activePlayerId: '0',
    turnNumber: 1,
    dice: [],
    rollCount: 0,
    rollLimit: 3,
    rollConfirmed: false,
    selectedCharacters: { '0': 'shadow_thief', '1': 'paladin' },
    pendingAttack: null,
});

describe('多个护盾叠加消耗（Bug 验证）', () => {
    it('【Bug 复现】用户案例：下次一定(6) + 神圣防御(3) vs 8点伤害', () => {
        const core = createCoreState();
        
        // 防御方有两个护盾（按打出顺序）
        core.players['1'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },      // 第一个：下次一定
            { value: 3, sourceId: 'holy-defense', preventStatus: false },        // 第二个：神圣防御
        ];
        
        // 受到 8 点伤害（匕首打击）
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 8,
                actualDamage: 8,
                sourceAbilityId: 'dagger-strike',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ❌ 当前错误行为：只消耗第一个护盾(6)，剩余伤害 2 点
        // ✅ 期望正确行为：消耗第一个(6) + 第二个(2)，剩余伤害 0 点
        
        console.log('实际 HP:', newCore.players['1'].resources[RESOURCE_IDS.HP]);
        console.log('剩余护盾:', newCore.players['1'].damageShields);
        
        // 这个测试会失败，证明 bug 存在
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(50); // 期望：无伤害
        expect(newCore.players['1'].damageShields).toEqual([
            { value: 1, sourceId: 'holy-defense', preventStatus: false }, // 期望：第二个护盾剩余 1 点
        ]);
    });

    it('【Bug 复现】第一个护盾不足以抵消伤害，应继续消耗第二个', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
            { value: 2, sourceId: 'protect-token', preventStatus: false },
        ];
        
        // 10 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 10, actualDamage: 10, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ❌ 当前错误：只消耗第一个(3)，剩余伤害 7 点，HP = 43
        // ✅ 期望正确：消耗第一个(3) + 第二个(2)，剩余伤害 5 点，HP = 45
        
        console.log('实际 HP:', newCore.players['1'].resources[RESOURCE_IDS.HP]);
        console.log('剩余护盾:', newCore.players['1'].damageShields);
        
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(45); // 50 - 5 = 45
        expect(newCore.players['1'].damageShields).toEqual([]); // 所有护盾耗尽
    });

    it('【Bug 复现】第一个护盾完全抵消伤害，第二个护盾应保留', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 10, sourceId: 'card-next-time', preventStatus: false },
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        // 5 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 5, actualDamage: 5, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ❌ 当前错误：第一个护盾消耗 5 点，但第二个护盾被丢弃
        // ✅ 期望正确：第一个护盾消耗 5 点剩余 5 点，第二个护盾完整保留
        
        console.log('实际 HP:', newCore.players['1'].resources[RESOURCE_IDS.HP]);
        console.log('剩余护盾:', newCore.players['1'].damageShields);
        
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(50); // 无伤害
        expect(newCore.players['1'].damageShields).toEqual([
            { value: 5, sourceId: 'card-next-time', preventStatus: false },  // 第一个剩余 5
            { value: 3, sourceId: 'holy-defense', preventStatus: false },    // 第二个完整保留
        ]);
    });

    it('【Bug 复现】三个护盾叠加，应按顺序消耗', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 2, sourceId: 'shield-1', preventStatus: false },
            { value: 3, sourceId: 'shield-2', preventStatus: false },
            { value: 4, sourceId: 'shield-3', preventStatus: false },
        ];
        
        // 7 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 7, actualDamage: 7, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ❌ 当前错误：只消耗第一个(2)，剩余伤害 5 点，HP = 45
        // ✅ 期望正确：消耗第一个(2) + 第二个(3) + 第三个(2)，剩余伤害 0 点，HP = 50
        
        console.log('实际 HP:', newCore.players['1'].resources[RESOURCE_IDS.HP]);
        console.log('剩余护盾:', newCore.players['1'].damageShields);
        
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(50); // 无伤害
        expect(newCore.players['1'].damageShields).toEqual([
            { value: 2, sourceId: 'shield-3', preventStatus: false }, // 第三个剩余 2 点
        ]);
    });

    it('【Bug 复现】百分比护盾 + 固定值护盾组合', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 50, sourceId: 'protect-token', preventStatus: false, reductionPercent: 50 }, // 50% 减伤
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        // 10 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 10, actualDamage: 10, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ❌ 当前错误：只消耗第一个护盾(50%减伤=5)，剩余伤害 5 点，HP = 45
        // ✅ 期望正确：第一个减伤 5 点，第二个消耗 3 点，剩余伤害 2 点，HP = 48
        
        console.log('实际 HP:', newCore.players['1'].resources[RESOURCE_IDS.HP]);
        console.log('剩余护盾:', newCore.players['1'].damageShields);
        
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(48); // 50 - 2 = 48
        expect(newCore.players['1'].damageShields).toEqual([]); // 百分比护盾消耗后不保留
    });
});

describe('多个护盾叠加消耗（修复后）', () => {
    // 这些测试验证修复后的正确行为

    it('修复后：多个护盾按顺序消耗，直到伤害完全抵消', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 8, actualDamage: 8, sourceAbilityId: 'dagger-strike' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // 第一个护盾消耗 6 点，第二个护盾消耗 2 点，剩余伤害 0 点
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(newCore.players['1'].damageShields).toEqual([
            { value: 1, sourceId: 'holy-defense', preventStatus: false },
        ]);
    });

    it('修复后：第一个护盾完全抵消伤害，保留剩余护盾', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 10, sourceId: 'card-next-time', preventStatus: false },
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 5, actualDamage: 5, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(newCore.players['1'].damageShields).toEqual([
            { value: 5, sourceId: 'card-next-time', preventStatus: false },
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ]);
    });

    it('修复后：所有护盾消耗完仍有剩余伤害', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
            { value: 2, sourceId: 'protect-token', preventStatus: false },
        ];
        
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 10, actualDamage: 10, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(45); // 50 - 5 = 45
        expect(newCore.players['1'].damageShields).toEqual([]);
    });
});
