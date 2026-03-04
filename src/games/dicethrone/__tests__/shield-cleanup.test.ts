/**
 * 护盾清理机制测试
 * 
 * 测试修复后的护盾行为：
 * 1. 攻击结束后所有护盾清理
 * 2. 护盾不会持久化到下次攻击
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
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
    selectedCharacters: { '0': 'paladin', '1': 'barbarian' },
    pendingAttack: null,
});

describe('护盾清理机制', () => {
    it('攻击结束后清理防御方的所有护盾', () => {
        const core = createCoreState();
        
        // 1. 防御方获得护盾
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        // 2. 设置 pendingAttack
        core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
        };
        
        // 3. 攻击结算事件
        const event: DiceThroneEvent = {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                totalDamage: 5,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 0,
        };
        
        const newCore = reduce(core, event);
        
        // 4. 验证护盾已清理
        expect(newCore.players['1'].damageShields).toEqual([]);
    });

    it('攻击结束后清理多个护盾', () => {
        const core = createCoreState();
        
        // 防御方有多个护盾
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
            { value: 1, sourceId: 'protect-token', preventStatus: false },
            { value: 1, sourceId: 'barbarian-thick-skin', preventStatus: true },
        ];
        
        core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
        };
        
        const event: DiceThroneEvent = {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                totalDamage: 5,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 0,
        };
        
        const newCore = reduce(core, event);
        
        // 所有护盾都应该清理（包括 preventStatus: true 和 false）
        expect(newCore.players['1'].damageShields).toEqual([]);
    });

    it('护盾在伤害计算时正确消耗', () => {
        const core = createCoreState();
        
        // 防御方有护盾
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        // 受到 5 点伤害
        const event: DiceThroneEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 5,
                actualDamage: 5,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 0,
        };
        
        const newCore = reduce(core, event);
        
        // 护盾抵消 3 点，实际扣血 2 点
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(48); // 50 - 2
        // 护盾消耗后应该清空
        expect(newCore.players['1'].damageShields).toEqual([]);
    });

    it('preventStatus 护盾不减少伤害', () => {
        const core = createCoreState();
        
        // 防御方只有 preventStatus 护盾
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'thick-skin', preventStatus: true },
        ];
        
        // 受到 5 点伤害
        const event: DiceThroneEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 5,
                actualDamage: 5,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 0,
        };
        
        const newCore = reduce(core, event);
        
        // preventStatus 护盾不减伤，扣血 5 点
        expect(newCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(45); // 50 - 5
        // preventStatus 护盾不消耗
        expect(newCore.players['1'].damageShields).toEqual([
            { value: 3, sourceId: 'thick-skin', preventStatus: true },
        ]);
    });

    it('攻击方不受护盾清理影响', () => {
        const core = createCoreState();
        
        // 攻击方也有护盾（不应该被清理）
        core.players['0'].damageShields = [
            { value: 2, sourceId: 'some-ability', preventStatus: false },
        ];
        
        // 防御方有护盾
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
        };
        
        const event: DiceThroneEvent = {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                totalDamage: 5,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 0,
        };
        
        const newCore = reduce(core, event);
        
        // 只清理防御方的护盾
        expect(newCore.players['1'].damageShields).toEqual([]);
        // 攻击方的护盾保留
        expect(newCore.players['0'].damageShields).toEqual([
            { value: 2, sourceId: 'some-ability', preventStatus: false },
        ]);
    });

    it('ATTACK_RESOLVED 总是清理护盾（即使 pendingAttack 为 null）', () => {
        // 这个测试验证即使 pendingAttack 为 null（异常情况），
        // ATTACK_RESOLVED 事件也会清理护盾
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        // 没有 pendingAttack（异常情况）
        core.pendingAttack = null;
        
        const event: DiceThroneEvent = {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                totalDamage: 5,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 0,
        };
        
        const newCore = reduce(core, event);
        
        // 护盾应该被清理（因为 ATTACK_RESOLVED 表示攻击已结束）
        expect(newCore.players['1'].damageShields).toEqual([]);
    });
});
