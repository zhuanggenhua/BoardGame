/**
 * 大杀四方 - 基地能力系统测试
 *
 * 覆盖：
 * - Property 17: 基地能力事件顺序
 * - 基地能力注册表往返一致性
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
    registerBaseAbility,
    triggerBaseAbility,
    triggerAllBaseAbilities,
    hasBaseAbility,
    clearBaseAbilityRegistry,
    getBaseAbilityRegistrySize,
} from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import type { SmashUpCore, SmashUpEvent } from '../domain/types';

beforeEach(() => {
    clearBaseAbilityRegistry();
});

describe('基地能力注册表', () => {
    it('注册后可以解析到能力', () => {
        const executor = (_ctx: BaseAbilityContext) => ({ events: [] });
        registerBaseAbility('base_test', 'onMinionPlayed', executor);

        expect(hasBaseAbility('base_test', 'onMinionPlayed')).toBe(true);
        expect(hasBaseAbility('base_test', 'beforeScoring')).toBe(false);
        expect(hasBaseAbility('base_unknown', 'onMinionPlayed')).toBe(false);
    });

    it('注册表大小正确', () => {
        expect(getBaseAbilityRegistrySize()).toBe(0);

        registerBaseAbility('base_a', 'onMinionPlayed', () => ({ events: [] }));
        registerBaseAbility('base_a', 'beforeScoring', () => ({ events: [] }));
        registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }));

        expect(getBaseAbilityRegistrySize()).toBe(3);
    });

    it('清空注册表', () => {
        registerBaseAbility('base_a', 'onMinionPlayed', () => ({ events: [] }));
        expect(getBaseAbilityRegistrySize()).toBe(1);

        clearBaseAbilityRegistry();
        expect(getBaseAbilityRegistrySize()).toBe(0);
    });

    it('触发已注册的基地能力返回事件', () => {
        const mockEvent: SmashUpEvent = {
            type: 'su:talent_used',
            payload: { playerId: '0', minionUid: 'm1', defId: 'test', baseIndex: 0 },
            timestamp: 1000,
        };
        registerBaseAbility('base_test', 'onMinionPlayed', () => ({
            events: [mockEvent],
        }));

        const ctx: BaseAbilityContext = {
            state: { bases: [] } as any,
            baseIndex: 0,
            baseDefId: 'base_test',
            playerId: '0',
            now: 1000,
        };

        const result = triggerBaseAbility('base_test', 'onMinionPlayed', ctx);
        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toBe(mockEvent);
    });

    it('触发未注册的基地能力返回空数组', () => {
        const ctx: BaseAbilityContext = {
            state: { bases: [] } as any,
            baseIndex: 0,
            baseDefId: 'base_unknown',
            playerId: '0',
            now: 1000,
        };

        const result = triggerBaseAbility('base_unknown', 'onMinionPlayed', ctx);
        expect(result.events).toHaveLength(0);
    });

    it('triggerAllBaseAbilities 只触发 onMinionPlayed 所在基地', () => {
        let triggeredBaseIndex = -1;
        registerBaseAbility('base_a', 'onMinionPlayed', (ctx) => {
            triggeredBaseIndex = ctx.baseIndex;
            return { events: [] };
        });
        registerBaseAbility('base_b', 'onMinionPlayed', () => {
            throw new Error('不应触发其他基地');
        });

        const state = {
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        } as unknown as SmashUpCore;

        triggerAllBaseAbilities('onMinionPlayed', state, '0', 1000, {
            baseIndex: 0,
            minionUid: 'm1',
            minionDefId: 'test_minion',
            minionPower: 3,
        });

        expect(triggeredBaseIndex).toBe(0);
    });

    it('triggerAllBaseAbilities onTurnStart 触发所有基地', () => {
        const triggered: number[] = [];
        registerBaseAbility('base_a', 'onTurnStart', (ctx) => {
            triggered.push(ctx.baseIndex);
            return { events: [] };
        });
        registerBaseAbility('base_b', 'onTurnStart', (ctx) => {
            triggered.push(ctx.baseIndex);
            return { events: [] };
        });

        const state = {
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        } as unknown as SmashUpCore;

        triggerAllBaseAbilities('onTurnStart', state, '0', 1000);
        expect(triggered).toEqual([0, 1]);
    });
});
