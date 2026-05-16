import { beforeAll, describe, expect, it } from 'vitest';
import { SU_COMMANDS, SU_EVENTS, type MinionDestroyedEvent, type SmashUpCore } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import {
    getFirstPrompt,
    getPromptOption,
    getPromptSourceId,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveDestroyedMinions,
    respondToPrompt,
} from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import type { MatchState } from '../../../engine/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('giant_ants_pod: Ant Drone (POD)', () => {
    it('talent: remove 1 counter to draw 1 card', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('d1', 'test_card_1', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        // Drone POD with 1 power counter so the talent is usable.
                        makeMinion('dr1', 'giant_ant_drone_pod', '0', 3, { powerCounters: 1, powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const result = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'dr1', baseIndex: 0 } },
            defaultTestRandom,
        );

        expect(result.events.map(e => e.type)).toContain(SU_EVENTS.CARDS_DRAWN);
        expect(result.finalState.core.players['0']?.hand.length).toBe(1);
        expect(result.finalState.core.bases[0].minions.find(m => m.uid === 'dr1')?.powerCounters).toBe(0);
    });

    it('ongoing replacement: can remove a counter to prevent destruction', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('dr1', 'giant_ant_drone_pod', '0', 3, { powerCounters: 1, powerModifier: 0 }),
                        makeMinion('m1', 'test_minion', '0', 2, { powerCounters: 0, powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms: MatchState<SmashUpCore> = makeMatchState(core);

        const destroyEvent: MinionDestroyedEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'm1',
                minionDefId: 'test_minion',
                fromBaseIndex: 0,
                ownerId: '0',
                reason: 'test_destroy',
            },
            timestamp: 1000,
        };

        const triggerResult = resolveDestroyedMinions(ms, '0', [destroyEvent], defaultTestRandom, 1000);
        expect(triggerResult.events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        const prompt = getFirstPrompt(triggerResult.matchState!);
        expect(prompt).toBeDefined();
        expect(getPromptSourceId(prompt)).toBe('giant_ant_drone_prevent_destroy');

        const droneOption = getPromptOption(
            prompt,
            o => o?.value?.droneUid === 'dr1',
            'Drone POD prevent destroy option',
        );
        const respondResult = respondToPrompt(triggerResult.matchState!, droneOption.id, '0', defaultTestRandom);

        // No destruction event should be emitted when prevented.
        expect(respondResult.events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        expect(respondResult.finalState.core.bases[0].minions.some(m => m.uid === 'm1')).toBe(true);
        expect(respondResult.finalState.core.bases[0].minions.find(m => m.uid === 'dr1')?.powerCounters).toBe(0);
    });
});

describe('giant_ants_pod: Ant Soldier (POD)', () => {
    it('talent: transfer a +1 power counter between two of your minions', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('s1', 'giant_ant_soldier_pod', '0', 3, { powerCounters: 0, powerModifier: 0 }),
                        makeMinion('src', 'test_src', '0', 2, { powerCounters: 1, powerModifier: 0 }),
                        makeMinion('dst', 'test_dst', '0', 2, { powerCounters: 0, powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const ms1 = makeMatchState(core);
        const talentResult = runCommand(
            ms1,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 's1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt1 = getFirstPrompt(talentResult.finalState);
        expect(getPromptSourceId(prompt1)).toBe('giant_ant_soldier_pod_choose_source');
        const srcOpt = getPromptOption(
            prompt1,
            o => o?.value?.minionUid === 'src',
            'Soldier POD source minion option',
        );
        const chooseSource = respondToPrompt(talentResult.finalState, srcOpt.id, '0', defaultTestRandom);

        const prompt2 = getFirstPrompt(chooseSource.finalState);
        expect(getPromptSourceId(prompt2)).toBe('giant_ant_soldier_pod_choose_target');
        const dstOpt = getPromptOption(
            prompt2,
            o => o?.value?.minionUid === 'dst',
            'Soldier POD target minion option',
        );
        const chooseTarget = respondToPrompt(chooseSource.finalState, dstOpt.id, '0', defaultTestRandom);

        const base = chooseTarget.finalState.core.bases[0];
        expect(base.minions.find(m => m.uid === 'src')?.powerCounters).toBe(0);
        expect(base.minions.find(m => m.uid === 'dst')?.powerCounters).toBe(1);
    });
});

describe('giant_ants_pod: Gimme the Prize (POD)', () => {
    it('places +2 on one minion and +1 on another (with prompt chain)', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_gimme_the_prize_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'test_m1', '0', 2, { powerCounters: 0, powerModifier: 0 }),
                        makeMinion('m2', 'test_m2', '0', 2, { powerCounters: 0, powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt1 = getFirstPrompt(play.finalState);
        expect(getPromptSourceId(prompt1)).toBe('giant_ant_gimme_the_prize_pod_first');
        const firstOpt = getPromptOption(
            prompt1,
            o => o?.value?.minionUid === 'm1',
            'Gimme the Prize first minion option',
        );
        const chooseFirst = respondToPrompt(play.finalState, firstOpt.id, '0', defaultTestRandom);

        const prompt2 = getFirstPrompt(chooseFirst.finalState);
        expect(getPromptSourceId(prompt2)).toBe('giant_ant_gimme_the_prize_pod_second');
        const secondOpt = getPromptOption(
            prompt2,
            o => o?.value?.minionUid === 'm2',
            'Gimme the Prize second minion option',
        );
        const chooseSecond = respondToPrompt(chooseFirst.finalState, secondOpt.id, '0', defaultTestRandom);

        const base = chooseSecond.finalState.core.bases[0];
        expect(base.minions.find(m => m.uid === 'm1')?.powerCounters).toBe(2);
        expect(base.minions.find(m => m.uid === 'm2')?.powerCounters).toBe(1);
    });
});

describe('giant_ants_pod: We Will Rock You (POD)', () => {
    it('choose a base; each of your minions there gain temp power = counters', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_we_will_rock_you_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'test_m1', '0', 2, { powerCounters: 2, powerModifier: 0 }),
                        makeMinion('m2', 'test_m2', '0', 2, { powerCounters: 1, powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('m3', 'test_m3', '0', 2, { powerCounters: 3, powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt = getFirstPrompt(play.finalState);
        expect(getPromptSourceId(prompt)).toBe('giant_ant_we_will_rock_you_pod_choose_base');
        const base0Opt = getPromptOption(
            prompt,
            o => o?.value?.baseIndex === 0,
            'We Will Rock You base option',
        );
        const chooseBase = respondToPrompt(play.finalState, base0Opt.id, '0', defaultTestRandom);

        const tempEvents = chooseBase.events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED) as any[];
        expect(tempEvents).toHaveLength(2);
        expect(tempEvents.some(e => e.payload.minionUid === 'm1' && e.payload.amount === 2)).toBe(true);
        expect(tempEvents.some(e => e.payload.minionUid === 'm2' && e.payload.amount === 1)).toBe(true);
    });
});

describe('giant_ants_pod: Who Wants to Live Forever? (POD)', () => {
    it('can still search when you have no minion to destroy', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_who_wants_to_live_forever_pod', 'action', '0')],
                    deck: [
                        makeCard('c1', 'test_card_1', 'action', '0'),
                        makeCard('c2', 'test_card_2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt = getFirstPrompt(play.finalState);
        expect(getPromptSourceId(prompt)).toBe('giant_ant_who_wants_to_live_forever_pod_search');
        const pickC2 = getPromptOption(
            prompt,
            o => o?.value?.cardUid === 'c2',
            'Who Wants to Live Forever search option',
        );
        const choose = respondToPrompt(play.finalState, pickC2.id, '0', defaultTestRandom);

        expect(choose.finalState.core.players['0']?.deck[0]?.uid).toBe('c2');
    });
});

