import { describe, expect, it, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { RandomFn, MatchState } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { smashUpSystemsForTest } from '../game';

const PLAYER_IDS = ['0', '1'];
const systems = smashUpSystemsForTest;
const rng: RandomFn = {
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T>(arr: T[]) => [...arr],
};

beforeAll(() => { initAllAbilities(); });

describe('baseScoreCheck', () => {
    it('produces BASE_SCORED in EventStream', () => {
        const core: SmashUpCore = {
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 25, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_central_brain', minions: [], ongoingActions: [] },
            ],
            baseDeck: ['base_haunted_house'],
            turnNumber: 1,
            nextUid: 100,
        } as any;

        const sys = createInitialSystemState(PLAYER_IDS, systems, undefined);
        sys.phase = 'playCards';
        const state: MatchState<SmashUpCore> = { core, sys };

        const result = executePipeline(
            { domain: SmashUpDomain, systems },
            state,
            { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 } as unknown as SmashUpCommand,
            rng,
            PLAYER_IDS,
        );

        expect(result.state.sys.responseWindow?.current).toBeUndefined();
        const entries = getEventStreamEntries(result.state);
        const scored = entries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);

        expect(scored.length).toBeGreaterThan(0);
    });
});
