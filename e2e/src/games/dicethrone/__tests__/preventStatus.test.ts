/**
 * preventStatus 护盾逻辑测试
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import { STATUS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { createInitializedState, fixedRandom } from './test-utils';

const createCoreState = (): DiceThroneCore => {
    const state = createInitializedState(['0', '1'], fixedRandom);
    return state.core;
};

describe('preventStatus 护盾', () => {
    it('在攻击进行中阻挡 debuff 并消耗护盾', () => {
        const core = createCoreState();
        core.pendingAttack = { attackerId: '0', defenderId: '1', isDefendable: true };
        core.players['1'].damageShields = [{ value: 1, sourceId: 'test', preventStatus: true }];
        core.players['1'].statusEffects[STATUS_IDS.BURN] = 0;

        const event: DiceThroneEvent = {
            type: 'STATUS_APPLIED',
            payload: {
                targetId: '1',
                statusId: STATUS_IDS.BURN,
                stacks: 1,
                newTotal: 1,
                sourceAbilityId: 'test-ability',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };

        const next = reduce(core, event);
        expect(next.players['1'].statusEffects[STATUS_IDS.BURN]).toBe(0);
        expect(next.players['1'].damageShields.length).toBe(0);
    });

    it('不会抵消伤害，但护盾保留到攻击结算', () => {
        const core = createCoreState();
        const hp = core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        core.players['1'].damageShields = [{ value: 1, sourceId: 'test', preventStatus: true }];

        const event: DiceThroneEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 2,
                actualDamage: 2,
                sourceAbilityId: 'test-ability',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 2,
        };

        const next = reduce(core, event);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(hp - 2);
        expect(next.players['1'].damageShields.length).toBe(1);
    });

    it('攻击结算后清理 preventStatus 护盾', () => {
        const core = createCoreState();
        core.players['1'].damageShields = [{ value: 1, sourceId: 'test', preventStatus: true }];

        const event: DiceThroneEvent = {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                totalDamage: 0,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 3,
        };

        const next = reduce(core, event);
        expect(next.players['1'].damageShields.length).toBe(0);
    });
});
