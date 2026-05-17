import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    triggerBaseAbilityWithMS,
    makeState,
    makeMatchState,
    SU_EVENTS,
    type LimitModifiedEvent,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_the_homeworld 母星', () => {
    it('随从入场后授予额外随从出牌次数', () => {
        const state = makeState({
            bases: [{ defId: 'base_the_homeworld', minions: [], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_homeworld', 'onMinionPlayed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_homeworld',
            playerId: '0',
            minionUid: 'm1',
            now: 0,
        });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        const evt = result.events[0] as LimitModifiedEvent;
        expect(evt.payload.limitType).toBe('minion');
        expect(evt.payload.delta).toBe(1);
    });

    it('非出牌阶段触发时将额外随从次数标记为 immediate', () => {
        const state = makeState({
            bases: [{ defId: 'base_the_homeworld', minions: [], ongoingActions: [] }],
        });
        const matchState = makeMatchState(state);
        matchState.sys.phase = 'startTurn';

        const result = triggerBaseAbilityWithMS('base_the_homeworld', 'onMinionPlayed', {
            state,
            matchState,
            baseIndex: 0,
            baseDefId: 'base_the_homeworld',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'alien_collector',
            minionPower: 2,
            now: 0,
        });

        expect((result.events[0] as any).payload.playTiming).toBe('immediate');
    });

    it('同回合再次打出随从时，仍会继续给额外额度', () => {
        const state = makeState({
            players: {
                '0': {
                    id: '0', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    minionsPlayedPerBase: { 0: 2 },
                    factions: [],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [],
                },
            } as any,
            bases: [{ defId: 'base_the_homeworld', minions: [], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_homeworld', 'onMinionPlayed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_homeworld',
            playerId: '0',
            minionUid: 'm1',
            now: 0,
        });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
    });

    it('POD 版本母星应复用同一能力', () => {
        const state = makeState({
            players: {
                '0': {
                    id: '0', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    minionsPlayedPerBase: { 0: 1 },
                    factions: [],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [],
                },
            } as any,
            bases: [{ defId: 'base_the_homeworld_pod', minions: [], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_homeworld_pod', 'onMinionPlayed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_homeworld_pod',
            playerId: '0',
            minionUid: 'm1',
            now: 0,
        });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
    });
});
