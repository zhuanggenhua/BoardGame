import { beforeAll, describe, expect, it } from 'vitest';
import { SU_COMMANDS, SU_EVENTS, type MinionDestroyedEvent, type SmashUpCore } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { processDestroyTriggers } from '../domain/reducer';
import { makeCard, makeMatchState, makeMinion, makePlayer, makeState, getInteractionsFromMS } from './helpers';
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

        const triggerResult = processDestroyTriggers([destroyEvent], ms, '0', defaultTestRandom, 1000);
        expect(triggerResult.events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        expect(triggerResult.matchState?.sys.interaction.current).toBeDefined();
        expect((triggerResult.matchState?.sys.interaction.current?.data as any)?.sourceId).toBe('giant_ant_drone_prevent_destroy');

        const prompt: any = triggerResult.matchState?.sys.interaction.current?.data;
        const droneOption = prompt?.options?.find((o: any) => o?.value?.droneUid === 'dr1');
        expect(droneOption).toBeDefined();

        const respondResult = runCommand(
            triggerResult.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );

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

        const prompt1: any = getInteractionsFromMS(talentResult.finalState)[0]?.data;
        expect(prompt1?.sourceId).toBe('giant_ant_soldier_pod_choose_source');
        const srcOpt = prompt1?.options?.find((o: any) => o?.value?.minionUid === 'src');
        expect(srcOpt).toBeDefined();

        const chooseSource = runCommand(
            talentResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: srcOpt.id } } as any,
            defaultTestRandom,
        );

        const prompt2: any = getInteractionsFromMS(chooseSource.finalState)[0]?.data;
        expect(prompt2?.sourceId).toBe('giant_ant_soldier_pod_choose_target');
        const dstOpt = prompt2?.options?.find((o: any) => o?.value?.minionUid === 'dst');
        expect(dstOpt).toBeDefined();

        const chooseTarget = runCommand(
            chooseSource.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: dstOpt.id } } as any,
            defaultTestRandom,
        );

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

        const prompt1: any = getInteractionsFromMS(play.finalState)[0]?.data;
        expect(prompt1?.sourceId).toBe('giant_ant_gimme_the_prize_pod_first');
        const firstOpt = prompt1?.options?.find((o: any) => o?.value?.minionUid === 'm1');
        expect(firstOpt).toBeDefined();

        const chooseFirst = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstOpt.id } } as any,
            defaultTestRandom,
        );

        const prompt2: any = getInteractionsFromMS(chooseFirst.finalState)[0]?.data;
        expect(prompt2?.sourceId).toBe('giant_ant_gimme_the_prize_pod_second');
        const secondOpt = prompt2?.options?.find((o: any) => o?.value?.minionUid === 'm2');
        expect(secondOpt).toBeDefined();

        const chooseSecond = runCommand(
            chooseFirst.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: secondOpt.id } } as any,
            defaultTestRandom,
        );

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

        const prompt: any = getInteractionsFromMS(play.finalState)[0]?.data;
        expect(prompt?.sourceId).toBe('giant_ant_we_will_rock_you_pod_choose_base');
        const base0Opt = prompt?.options?.find((o: any) => o?.value?.baseIndex === 0);
        expect(base0Opt).toBeDefined();

        const chooseBase = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: base0Opt.id } } as any,
            defaultTestRandom,
        );

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

        const prompt: any = getInteractionsFromMS(play.finalState)[0]?.data;
        expect(prompt?.sourceId).toBe('giant_ant_who_wants_to_live_forever_pod_search');
        const pickC2 = prompt?.options?.find((o: any) => o?.value?.cardUid === 'c2');
        expect(pickC2).toBeDefined();

        const choose = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: pickC2.id } } as any,
            defaultTestRandom,
        );

        expect(choose.finalState.core.players['0']?.deck[0]?.uid).toBe('c2');
    });
});

