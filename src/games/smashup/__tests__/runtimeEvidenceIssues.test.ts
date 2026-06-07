import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import {
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    getSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    respondToPrompt,
} from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { SU_COMMANDS } from '../domain/types';

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
        const i1 = getSimpleChoicePrompt(played.finalState, 'vampire_big_gulp_pod');
        const onlyOpt = getPromptOptions(i1)[0];
        expect(onlyOpt).toBeTruthy();

        const afterDestroy = respondToPrompt(
            played.finalState,
            onlyOpt.id,
            '0',
            defaultTestRandom,
        );
        expect(afterDestroy.success).toBe(true);

        const reactionPrompt = getReactionPrompt(afterDestroy.finalState);
        const fledglingOption = getReactionPromptOptionBySourceDefId(
            afterDestroy.finalState,
            reactionPrompt,
            'vampire_fledgling_vampire_pod',
        );
        const afterFledgling = respondToPrompt(
            afterDestroy.finalState,
            fledglingOption.id,
            undefined,
            defaultTestRandom,
        );
        expect(afterFledgling.success).toBe(true);
        getSimpleChoicePrompt(afterFledgling.finalState, 'vampire_fledgling_vampire_pod_bury_source');
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

        const i1 = getSimpleChoicePrompt(play.finalState, 'elder_thing_mi_go_pod');
        const noOpt = getPromptOption(i1, (option: any) => option.id === 'no', 'Mi-go decline option');
        expect(noOpt).toBeTruthy();

        const afterOpp = respondToPrompt(
            play.finalState,
            noOpt.id,
            '1',
            defaultTestRandom,
        );
        expect(afterOpp.success).toBe(true);

        const i2 = getSimpleChoicePrompt(afterOpp.finalState, 'elder_thing_mi_go_pod_counter');

        const optionUids = getPromptOptions(i2).map((o: any) => o.value?.minionUid).filter(Boolean);
        expect(optionUids).toContain('m0');
        // After fix, it should be able to target opponent minions too.
        expect(optionUids).toContain('m1');
    });
});

