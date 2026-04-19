/**
 * PREVENT_DAMAGE 事件处理测试
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent, PendingDamage } from '../domain/types';
import { createInitializedState, fixedRandom } from './test-utils';

const createCoreState = (): DiceThroneCore => {
    const state = createInitializedState(['0', '1'], fixedRandom);
    return state.core;
};

describe('PREVENT_DAMAGE reducer', () => {
    it('有 pendingDamage 时降低伤害并标记完全闪避', () => {
        const core = createCoreState();
        const pendingDamage: PendingDamage = {
            id: 'pd-1',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 5,
            currentDamage: 5,
            sourceAbilityId: 'test-ability',
            responseType: 'beforeDamageReceived',
            responderId: '1',
            isFullyEvaded: false,
        };
        core.pendingDamage = pendingDamage;

        const event: DiceThroneEvent = {
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: '1',
                amount: 10,
                sourceAbilityId: 'test-ability',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };

        const next = reduce(core, event);
        expect(next.pendingDamage?.currentDamage).toBe(0);
        expect(next.pendingDamage?.isFullyEvaded).toBe(true);
    });

    it('无 pendingDamage 时转为一次性护盾', () => {
        const core = createCoreState();
        core.pendingDamage = undefined;

        const event: DiceThroneEvent = {
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: '1',
                amount: 2,
                sourceAbilityId: 'test-ability',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 2,
        };

        const next = reduce(core, event);
        expect(next.players['1'].damageShields.length).toBe(1);
        expect(next.players['1'].damageShields[0]).toMatchObject({
            value: 2,
            sourceId: 'test-ability',
            preventStatus: false,
        });
    });
});
