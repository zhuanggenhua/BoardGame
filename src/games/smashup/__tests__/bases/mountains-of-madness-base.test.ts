import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeMatchState,
    SU_EVENTS,
    type MadnessDrawnEvent,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_mountains_of_madness: 疯狂山脉 - 抽疯狂卡', () => {
    it('有疯狂牌库时生成 MADNESS_DRAWN 事件', () => {
        const state = makeState({
            bases: [{
                defId: 'base_mountains_of_madness',
                minions: [{
                    uid: 'm1',
                    defId: 'test_minion',
                    controller: '0',
                    owner: '1',
                    basePower: 3,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                }],
                ongoingActions: [],
            }],
            madnessDeck: Array(10).fill('madness_1'),
        });

        const { events } = triggerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_mountains_of_madness',
            playerId: '0',
            minionUid: 'm1',
            now: 0,
        });

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.MADNESS_DRAWN);
        expect((events[0] as MadnessDrawnEvent).payload.playerId).toBe('1');
        expect((events[0] as MadnessDrawnEvent).payload.count).toBe(1);
    });

    it('无疯狂牌库时不产生事件', () => {
        const state = makeState({
            bases: [{ defId: 'base_mountains_of_madness', minions: [], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_mountains_of_madness',
            playerId: '0',
            minionUid: 'm1',
            now: 0,
        });

        expect(result.events).toHaveLength(0);
    });

    it('borrowed Infiltrate 由控制者控制时，应阻止 Mountains of Madness 让控制者自己打出的随从拥有者抽疯狂卡', () => {
        const state = makeState({
            bases: [{
                defId: 'base_mountains_of_madness',
                minions: [{
                    uid: 'm2',
                    defId: 'test_minion',
                    controller: '0',
                    owner: '1',
                    basePower: 3,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                }],
                ongoingActions: [{ uid: 'inf-mad-1', defId: 'ninja_infiltrate', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
            }],
            madnessDeck: Array(10).fill('madness_1'),
        });

        const { events } = triggerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_mountains_of_madness',
            playerId: '0',
            minionUid: 'm2',
            now: 1,
        });

        expect(events).toHaveLength(0);
    });
});
