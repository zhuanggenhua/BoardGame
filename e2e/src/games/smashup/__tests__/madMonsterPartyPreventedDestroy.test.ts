import { beforeAll, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { makeMatchState, makeMinion, makePlayer, getInteractionsFromMS } from './helpers';
import { defaultTestRandom } from './testRunner';
import { SU_EVENTS } from '../domain/types';
import { processDestroyTriggers } from '../domain/reducer';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('onMinionDestroyed: prevented destroy should not queue reaction triggers', () => {
    it('giant_ant_drone_prevent_destroy blocks vampire_mad_monster_party_pod prompt', () => {
        const core: SmashUpCore = {
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a-mmp', defId: 'vampire_mad_monster_party_pod', type: 'action', owner: '0' } as any],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    ongoingActions: [],
                    minions: [
                        // victim (will be destroyed)
                        makeMinion('m-victim', 'test_victim', '0', 2, { powerCounters: 0, tempPowerModifier: 0 } as any),
                        // Drone that can prevent destruction
                        makeMinion('m-drone', 'giant_ant_drone_pod', '0', 3, { powerCounters: 1, tempPowerModifier: 0 } as any),
                    ],
                } as any,
            ],
        } as any;

        const ms: MatchState<SmashUpCore> = makeMatchState(core as any);
        const destroyEvent: SmashUpEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'm-victim',
                minionDefId: 'test_victim',
                fromBaseIndex: 0,
                ownerId: '0',
                destroyerId: '0',
                reason: 'test_destroy',
            },
            timestamp: 10,
        } as any;

        const result = processDestroyTriggers([destroyEvent], ms, '0', defaultTestRandom, 10);

        // The destruction is pending-save (replacement prompt created), so it must not be queued as a real destroy yet.
        expect(result.events.some(e => e.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(false);

        const interactions = getInteractionsFromMS(result.matchState ?? ms) as any[];
        const sourceIds = interactions.map(i => i?.data?.sourceId);
        expect(sourceIds).toContain('giant_ant_drone_prevent_destroy');
        expect(sourceIds).not.toContain('vampire_mad_monster_party_pod_play');
    });
});

