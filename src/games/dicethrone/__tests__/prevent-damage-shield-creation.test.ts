/**
 * PREVENT_DAMAGE 护盾创建单元测试
 * 
 * 验证 PREVENT_DAMAGE 事件在没有 pendingDamage 时是否正确创建护盾
 */

import { describe, it, expect } from 'vitest';
import { handlePreventDamage, handleDamageDealt } from '../domain/reduceCombat';
import type { DiceThroneCore, PreventDamageEvent, DamageDealtEvent } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';

function createMinimalCore(): DiceThroneCore {
    return {
        players: {
            '0': {
                id: '0',
                characterId: 'test',
                resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 1 },
                tokens: {},
                statusEffects: {},
                damageShields: [],
                abilities: [],
                hand: [],
                deck: [],
                discard: [],
                abilityLevels: {},
            },
            '1': {
                id: '1',
                characterId: 'test',
                resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 1 },
                tokens: {},
                statusEffects: {},
                damageShields: [],
                abilities: [],
                hand: [],
                deck: [],
                discard: [],
                abilityLevels: {},
            },
        },
        dice: [],
        rollCount: 0,
        rollLimit: 3,
        rollDiceCount: 5,
        rollConfirmed: false,
        activePlayerId: '0',
        turnNumber: 1,
        tokenDefinitions: [],
    } as any;
}

describe('PREVENT_DAMAGE 护盾创建', () => {
    it('没有 pendingDamage 时应创建护盾', () => {
        const core = createMinimalCore();
        
        const preventEvent: PreventDamageEvent = {
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: '1',
                amount: 3,
                sourceAbilityId: 'test-ability',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1000,
        };
        
        const newCore = handlePreventDamage(core, preventEvent);
        
        // 验证护盾被创建
        expect(newCore.players['1'].damageShields).toHaveLength(1);
        expect(newCore.players['1'].damageShields[0]).toEqual({
            value: 3,
            sourceId: 'test-ability',
            preventStatus: false,
        });
    });
    
    it('创建的护盾应该被 DAMAGE_DEALT 消耗', () => {
        let core = createMinimalCore();
        
        // 1. 创建护盾
        const preventEvent: PreventDamageEvent = {
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: '1',
                amount: 3,
                sourceAbilityId: 'test-ability',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1000,
        };
        
        core = handlePreventDamage(core, preventEvent);
        expect(core.players['1'].damageShields).toHaveLength(1);
        
        // 2. 造成伤害，应该消耗护盾
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 5,
                actualDamage: 5,
                sourceAbilityId: 'attack-ability',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1001,
        };
        
        core = handleDamageDealt(core, damageEvent);
        
        // 验证护盾被消耗（3点护盾抵消3点伤害，剩余2点伤害扣血）
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(48); // 50 - 2
        expect(core.players['1'].damageShields).toHaveLength(0); // 护盾被完全消耗
    });
    
    it('applyImmediately=true 时不应创建护盾', () => {
        const core = createMinimalCore();
        
        const preventEvent: PreventDamageEvent = {
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: '1',
                amount: 3,
                sourceAbilityId: 'test-ability',
                applyImmediately: true,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1000,
        };
        
        const newCore = handlePreventDamage(core, preventEvent);
        
        // 验证护盾没有被创建
        expect(newCore.players['1'].damageShields).toHaveLength(0);
    });
});
