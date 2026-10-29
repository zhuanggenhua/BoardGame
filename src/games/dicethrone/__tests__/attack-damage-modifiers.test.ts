import { expect, it } from 'vitest';
import { applyCurrentAttackDamageModifiers } from '../domain/attackDamageModifiers';
import type { DamageDealtEvent } from '../domain/types';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

it('当前攻击伤害只计算一次眩光，并不修改独立伤害或反击', () => {
    const state = createHeroMatchup('cursed_pirate', 'treant')(['0', '1'], createQueuedRandom([1])).core;
    state.pendingAttack = {
        attackerId: '0', defenderId: '1', sourceAbilityId: 'verdict-command',
        isDefendable: false, dazzleDamagePercent: -50,
    };
    const event = {
        type: 'DAMAGE_DEALT', payload: { targetId: '1', amount: 7, actualDamage: 7, damageScope: 'attack' },
        timestamp: 100,
    } as DamageDealtEvent;
    const once = applyCurrentAttackDamageModifiers(state, event, '0');
    expect(once.payload).toMatchObject({ amount: 4, actualDamage: 4, attackDamageBeforePercent: 7 });
    expect(applyCurrentAttackDamageModifiers(state, once, '0')).toEqual(once);
    const direct = { ...event, payload: { ...event.payload, damageScope: 'direct' as const } };
    expect(applyCurrentAttackDamageModifiers(state, direct, '0')).toEqual(direct);
    expect(applyCurrentAttackDamageModifiers(state, event, '1')).toEqual(event);
});
