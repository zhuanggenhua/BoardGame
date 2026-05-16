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

describe('base_mountains_of_madness 疯狂之山', () => {
    it('随从入场后抽疯狂卡（有疯狂牌库时）', () => {
        const state = makeState({
            bases: [{ defId: 'base_mountains_of_madness', minions: [], ongoingActions: [] }],
            madnessDeck: ['madness_1', 'madness_2'],
            nextUid: 100,
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

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe(SU_EVENTS.MADNESS_DRAWN);
        expect((result.events[0] as MadnessDrawnEvent).payload.count).toBe(1);
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
});
