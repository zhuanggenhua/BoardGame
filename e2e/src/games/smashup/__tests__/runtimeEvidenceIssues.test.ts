import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { makeCard, makeMatchState, makeMinion, makePlayer, makeState, getInteractionsFromMS } from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('runtime evidence repros (for debugging)', () => {
    it('Fledgling Vampire POD: bury prompt after you destroy another minion', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('fv', 'vampire_fledgling_vampire_pod', 'minion', '0'),
                        makeCard('bg', 'vampire_big_gulp_pod', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('t1', 'robot_microbot', '1', 1)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bg' } },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const i1: any = getInteractionsFromMS(played.finalState)[0];
        expect(i1?.data?.sourceId).toBe('vampire_big_gulp_pod');
        const onlyOpt = i1.data.options[0];
        expect(onlyOpt).toBeTruthy();

        const afterDestroy = runCommand(
            played.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: onlyOpt.id } },
            defaultTestRandom,
        );
        expect(afterDestroy.success).toBe(true);
        void getInteractionsFromMS(afterDestroy.finalState);
    });

    it('Mi-go POD: if no one drew madness, counter prompt appears (and currently only targets own minions)', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('mg', 'elder_thing_mi_go_pod', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('m0', 'robot_microbot', '0', 1),
                    makeMinion('m1', 'robot_microbot', '1', 1),
                ],
                ongoingActions: [],
            }],
            madnessDeck: [makeCard('md1', 'madness', 'action', '1')],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'mg', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);

        const i1: any = getInteractionsFromMS(play.finalState)[0];
        expect(i1?.data?.sourceId).toBe('elder_thing_mi_go_pod');
        const noOpt = i1.data.options.find((o: any) => o.id === 'no');
        expect(noOpt).toBeTruthy();

        const afterOpp = runCommand(
            play.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '1', payload: { optionId: noOpt.id } },
            defaultTestRandom,
        );
        expect(afterOpp.success).toBe(true);

        const i2: any = getInteractionsFromMS(afterOpp.finalState)[0];
        expect(i2?.data?.sourceId).toBe('elder_thing_mi_go_pod_counter');

        const optionUids = i2.data.options.map((o: any) => o.value?.minionUid).filter(Boolean);
        expect(optionUids).toContain('m0');
        // After fix, it should be able to target opponent minions too.
        expect(optionUids).toContain('m1');
    });
});

