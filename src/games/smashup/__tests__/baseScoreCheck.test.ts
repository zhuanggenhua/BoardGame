import { describe, expect, it, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { RandomFn, MatchState } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';

const PLAYER_IDS = ['0', '1'];
const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createBaseSystems<SmashUpCore>(),
];
const rng: RandomFn = {
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T>(arr: T[]) => [...arr],
};

beforeAll(() => { initAllAbilities(); });

describe('baseScoreCheck', () => {
    it('produces BASE_SCORED in EventStream', () => {
        console.log('=== baseScoreCheck START ===');

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
                        { uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 25, powerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
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

        console.log('phase before pipeline:', state.sys.phase);

        // Step 1: ADVANCE_PHASE from playCards → scoreBases
        // 这会打开 Me First! 响应窗口
        let current = executePipeline(
            { domain: SmashUpDomain, systems },
            state,
            { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 } as unknown as SmashUpCommand,
            rng,
            PLAYER_IDS,
        );
        console.log('after ADVANCE_PHASE - phase:', current.state.sys.phase);
        console.log('responseWindow:', current.state.sys.responseWindow?.current ? 'OPEN' : 'closed');

        // Step 2: 两位玩家都 PASS Me First! 响应窗口
        current = executePipeline(
            { domain: SmashUpDomain, systems },
            current.state,
            { type: 'RESPONSE_PASS', playerId: '0', payload: undefined, timestamp: 2 } as unknown as SmashUpCommand,
            rng,
            PLAYER_IDS,
        );
        console.log('after P0 PASS - phase:', current.state.sys.phase, 'responseWindow:', current.state.sys.responseWindow?.current ? 'OPEN' : 'closed');

        current = executePipeline(
            { domain: SmashUpDomain, systems },
            current.state,
            { type: 'RESPONSE_PASS', playerId: '1', payload: undefined, timestamp: 3 } as unknown as SmashUpCommand,
            rng,
            PLAYER_IDS,
        );
        console.log('after P1 PASS - phase:', current.state.sys.phase, 'responseWindow:', current.state.sys.responseWindow?.current ? 'OPEN' : 'closed');

        const result = current;

        console.log('pipeline success:', result.success);
        console.log('final phase:', result.state.sys.phase);

        const entries = getEventStreamEntries(result.state);
        const scored = entries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('total entries:', entries.length);
        console.log('BASE_SCORED count:', scored.length);
        console.log('event types:', [...new Set(entries.map(e => e.event.type))]);

        expect(scored.length).toBeGreaterThan(0);
    });
});
