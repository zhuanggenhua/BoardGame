import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers } from '../../domain/ongoingEffects';
import { validate } from '../../domain/commands';
import { execute } from '../../domain/reducer';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptsBySourceId,
    getPromptOptions,
    getPromptSourceId,
    respondToPromptOption,
    withOnlyCurrentPrompt,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Frankenstein abilities', () => {
    it('frankenstein_german_engineering 在该基地打出随从后给该随从 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('ge1', 'frankenstein_german_engineering', 'action', '0'),
                        makeCard('m1', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const afterOngoing = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ge1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        const afterMinion = runCommand(
            afterOngoing.finalState,
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const geEvt = afterMinion.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'frankenstein_german_engineering',
        );
        expect(geEvt).toBeDefined();
        expect((geEvt as any).payload.minionUid).toBe('m1');

        const finalMinion = afterMinion.finalState.core.bases[0].minions.find(minion => minion.uid === 'm1');
        expect(finalMinion).toBeDefined();
        expect(finalMinion!.powerCounters).toBe(1);
    });

    it('frankenstein_the_monster 天赋移除指示物并授予额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 2 }),
                ],
                ongoingActions: [],
            }],
        });

        const talentResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'monster1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const removedEvt = talentResult.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_REMOVED
                && (event as any).payload.reason === 'frankenstein_the_monster',
        );
        expect(removedEvt).toBeDefined();
        expect((removedEvt as any).payload.minionUid).toBe('monster1');

        const limitEvt = talentResult.events.find(
            event => event.type === SU_EVENTS.LIMIT_MODIFIED
                && (event as any).payload.limitType === 'minion',
        );
        expect(limitEvt).toBeDefined();
    });

    it('frankenstein_the_monster_pod 没有 +1 力量指示物时 validate 拒绝天赋', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('monster1', 'frankenstein_the_monster_pod', '0', 5, { powerCounters: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'monster1', baseIndex: 0 },
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe('该随从当前无法发动天赋：没有+1力量指示物');
    });

    it('frankenstein_the_monster_pod 没有 +1 力量指示物时 execute 不应误生成 TALENT_USED', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('monster1', 'frankenstein_the_monster_pod', '0', 5, { powerCounters: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'monster1', baseIndex: 0 },
        }, defaultTestRandom);

        expect(events).toEqual([]);
        expect(events.some(event => event.type === SU_EVENTS.TALENT_USED)).toBe(false);
    });

    it('frankenstein_angry_mob 若所选手牌已离开手牌，不应凭旧交互再塞回牌库', () => {
        const playState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('angry-mob', 'frankenstein_angry_mob', 'action', '0'),
                        makeCard('h1', 'test_action_a', 'action', '0'),
                        makeCard('h2', 'test_action_b', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 0 })],
                ongoingActions: [],
            }],
        }));

        const played = runCommand(
            playState,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'angry-mob' } },
            defaultTestRandom,
        );
        const chooseMinion = respondToPromptOption(
            played.finalState,
            option => option.value?.minionUid === 'monster1',
            'Angry Mob target monster option',
            '0',
            defaultTestRandom,
        );
        expect(chooseMinion.success, chooseMinion.error).toBe(true);
        const chooseCardPrompt = getSimpleChoicePrompt(chooseMinion.finalState, 'frankenstein_angry_mob_choose_card');

        const liveResult = respondToPromptOption(
            chooseMinion.finalState,
            option => option.value?.cardUid === 'h1',
            'Angry Mob card h1 option',
            '0',
            defaultTestRandom,
        );
        expect(liveResult.success, liveResult.error).toBe(true);
        expect(liveResult.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);
        expect(liveResult.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);

        const staleStateCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h2', 'test_action_b', 'action', '0')],
                    discard: [makeCard('h1', 'test_action_a', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 0 })],
                ongoingActions: [],
            }],
        });

        const stalePromptState = withOnlyCurrentPrompt(makeMatchState(staleStateCore), chooseCardPrompt);
        const staleResult = respondToPromptOption(
            stalePromptState,
            option => option.value?.cardUid === 'h1',
            'stale Angry Mob card h1 option',
            '0',
            defaultTestRandom,
        );
        expect(staleResult.success, staleResult.error).toBe(true);
        expect(staleResult.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(false);
        expect(staleResult.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
    });
});

describe('frankenstein_igor 基地结算弃置触发', () => {
    it('非 Igor 随从被弃时不触发', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerModifier: 0 }),
                        makeMinion('enemy1', 'enemy', '1', 5, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('t1', 'test_minion', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy1',
            triggerMinionDefId: 'enemy',
            random: defaultTestRandom,
            now: 100,
        });

        expect(result.events).toEqual([]);
    });

    it('Igor 自身被弃时自动在其他基地己方唯一随从上放指示物', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('t1', 'test_minion', '0', 4, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor1',
            triggerMinionDefId: 'frankenstein_igor',
            random: defaultTestRandom,
            now: 100,
        });

        expect(result.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 't1', baseIndex: 1 }),
            }),
        ]);
    });

    it('POD 版 Igor 自身被弃时也会触发放置指示物', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('igor-pod-1', 'frankenstein_igor_pod', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('t1', 'test_minion', '0', 4, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor-pod-1',
            triggerMinionDefId: 'frankenstein_igor_pod',
            random: defaultTestRandom,
            now: 100,
        });

        expect(result.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 't1',
                    baseIndex: 1,
                    reason: 'frankenstein_igor_pod',
                }),
            }),
        ]);
    });

    it('其他基地有多个己方随从时创建选择 prompt', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('t1', 'test_a', '0', 3, { powerModifier: 0 }),
                        makeMinion('t2', 'test_b', '0', 4, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor1',
            triggerMinionDefId: 'frankenstein_igor',
            random: defaultTestRandom,
            now: 100,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'frankenstein_igor');
        expect(getPromptSourceId(prompt)).toBe('frankenstein_igor');
        expect(getPromptOptions(prompt)).toHaveLength(2);
    });

    it('Igor 自身被弃时，同基地其他己方随从可作为候选目标', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerModifier: 0 }),
                        makeMinion('ally1', 'test_minion', '0', 3, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor1',
            triggerMinionDefId: 'frankenstein_igor',
            random: defaultTestRandom,
            now: 100,
        });

        expect(result.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 'ally1', baseIndex: 0 }),
            }),
        ]);
    });

    it('giant_ant_drone 不会被 onMinionDiscardedFromBase 触发', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('drone1', 'giant_ant_drone', '0', 1, { powerModifier: 0 }),
                        makeMinion('ally1', 'test_minion', '0', 3, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('t1', 'test_b', '0', 4, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ally1',
            triggerMinionDefId: 'test_minion',
            random: defaultTestRandom,
            now: 100,
        });

        expect(getPromptsBySourceId(result.matchState!, 'giant_ant_drone_prevent_destroy')).toHaveLength(0);
    });
});
