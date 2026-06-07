import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerExtendedBaseAbility,
    makeState,
    SU_EVENTS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_the_field_of_honor: 消灭者获1VP', () => {
    it('有消灭者时触发VP奖励', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '1', // 被消灭随从的拥有者
            destroyerId: '0', // 消灭者
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.VP_AWARDED);
        expect((events[0] as any).payload.playerId).toBe('0'); // 消灭者获得VP
        expect((events[0] as any).payload.amount).toBe(1);
    });

    it('无消灭者时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '1',
            // destroyerId 未设置
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(0);
    });

    it('base_the_field_of_honor: destroy 自己的随从时仍应得分', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '0',
            controllerId: '0',
            destroyerId: '0',
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.VP_AWARDED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.amount).toBe(1);
    });

    it('base_the_field_of_honor: 同回合前一批已有人被消灭时，新的消灭批次仍应继续得分', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                turnDestroyedMinions: [{
                    uid: 'victim-prior',
                    defId: 'v0',
                    baseIndex: 0,
                    owner: '1',
                }],
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '1',
            controllerId: '1',
            destroyerId: '0',
            now: 1001,
        };

        const { events } = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.VP_AWARDED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.amount).toBe(1);
    });
});
