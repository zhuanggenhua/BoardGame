/**
 * 伤害追踪回归测试
 */

import { describe, it, expect } from 'vitest';
import type { AbilityEffect } from '../domain/combat';
import { resolveEffectsToEvents, registerCustomActionHandler, type EffectContext } from '../domain/effects';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { createInitializedState, fixedRandom } from './test-utils';

function createCore(): DiceThroneCore {
    return createInitializedState(['0', '1'], fixedRandom).core;
}

function ev(type: string, payload: Record<string, unknown>, timestamp = 1): DiceThroneEvent {
    return { type, payload, timestamp } as DiceThroneEvent;
}

describe('custom action 伤害累计', () => {
    it('resolveEffectsToEvents 会统一累计 custom action 产生的 DAMAGE_DEALT', () => {
        const customActionId = '__test-custom-damage-track__';
        registerCustomActionHandler(
            customActionId,
            ({ targetId, sourceAbilityId, timestamp }) => [
                {
                    type: 'DAMAGE_DEALT',
                    payload: {
                        targetId,
                        amount: 3,
                        actualDamage: 3,
                        sourceAbilityId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                } as DiceThroneEvent,
            ],
            { categories: ['damage'] },
        );

        const core = createCore();
        const effects: AbilityEffect[] = [
            {
                description: 'test custom damage',
                action: {
                    type: 'custom',
                    target: 'opponent',
                    customActionId,
                },
            },
        ];

        const ctx: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-source',
            state: core,
            damageDealt: 0,
            timestamp: 100,
        };

        const events = resolveEffectsToEvents(effects, 'withDamage', ctx);
        expect(events.some((event) => event.type === 'DAMAGE_DEALT')).toBe(true);
        expect(ctx.damageDealt).toBe(3);
    });
});
