import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import {
    getPromptOption,
    getPromptOptionById,
    getSimpleChoicePrompt,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
} from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('frankenstein (base) FAQ alignment', () => {
    it('Blitzed: may remove 0 counters and still destroy a power 0 minion', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('b1', 'frankenstein_blitzed', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('w0', 'giant_ant_worker', '1', 0)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'b1' } },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);
        const removePrompt = getSimpleChoicePrompt(play.finalState, 'frankenstein_blitzed_remove');

        const doneOpt = getPromptOptionById(removePrompt, 'done');
        expect(doneOpt).toBeTruthy();

        const step2 = respondToPrompt(play.finalState, doneOpt.id, '0', defaultTestRandom);
        const destroyPrompt = getSimpleChoicePrompt(step2.finalState, 'frankenstein_blitzed_destroy');

        const destroyOpt = getPromptOption(
            destroyPrompt,
            (option: any) => option.value?.minionUid === 'w0',
            'Blitzed destroy option for w0',
        );

        const step3 = respondToPrompt(step2.finalState, destroyOpt.id, '0', defaultTestRandom);
        expect(step3.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('Überserum: places counters at start of the action controller’s turns (even on opponent minion)', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [{
                    ...makeMinion('m1', 'robot_warbot', '1', 1),
                    attachedActions: [{ uid: 'u1', defId: 'frankenstein_uberserum', ownerId: '0' }],
                }],
                ongoingActions: [],
            }],
        });

        const ms0 = makeMatchState(core);
        ms0.sys.phase = 'endTurn' as any;
        const enter = runCommand(
            ms0,
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 1 } as any,
            defaultTestRandom,
        );
        // onTurnStart triggers are queued; the counter placement should be among produced events
        expect(enter.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
    });

    it('It’s Alive!: 放弃额外随从时不应遗留 pending 指示物效果', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'frankenstein_its_alive', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(play.finalState, 'smashup_immediate_extra_minion');

        const skipOpt = getPromptOption(
            prompt,
            (option: any) => option?.value?.skip,
            'It’s Alive immediate extra minion skip option',
        );

        const skipped = respondToPrompt(play.finalState, skipOpt.id, '0', defaultTestRandom);

        const pending = skipped.finalState.core.players['0'].pendingMinionPlayEffects ?? [];
        expect(pending.length).toBe(0);
    });
});

