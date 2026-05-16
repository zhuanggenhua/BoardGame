import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers } from '../../domain/ongoingEffects';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptOption,
    respondToPrompt,
    expectNoPrompt,
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

describe('Vampires abilities', () => {
    it('vampire_cull_the_weak 先选随从，再可连续弃置并主动停止结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'vampire_cull_the_weak', 'action', '0'),
                        makeCard('h1', 'test_minion', 'minion', '0'),
                        makeCard('h2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('v1', 'vampire_nightstalker', '0', 4, { powerModifier: 0 }),
                    makeMinion('v2', 'vampire_fledgling_vampire', '0', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const chooseMinionPrompt = getSimpleChoicePrompt(playResult.finalState, 'vampire_cull_the_weak');
        const minionOption = getPromptOption(chooseMinionPrompt, option => option.value?.minionUid === 'v1', 'v1 target');
        const afterChooseMinion = respondToPrompt(playResult.finalState, minionOption.id);

        const discardPrompt = getSimpleChoicePrompt(afterChooseMinion.finalState, 'vampire_cull_the_weak_choose_card');
        expect(discardPrompt.targetType).toBe('hand');
        const firstCardOption = getPromptOption(discardPrompt, option => option.value?.cardUid === 'h1', 'first discard card');
        const afterDiscardOne = respondToPrompt(afterChooseMinion.finalState, firstCardOption.id);

        expect(afterDiscardOne.events.some(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toBe(true);
        const counterEvt1 = afterDiscardOne.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'vampire_cull_the_weak',
        );
        expect(counterEvt1).toBeDefined();
        expect((counterEvt1 as any).payload.minionUid).toBe('v1');
        expect((counterEvt1 as any).payload.amount).toBe(1);

        const continuePrompt = getSimpleChoicePrompt(afterDiscardOne.finalState, 'vampire_cull_the_weak_choose_card');
        const secondCardOption = getPromptOption(continuePrompt, option => option.value?.cardUid === 'h2', 'second discard card');
        const afterDiscardTwo = respondToPrompt(afterDiscardOne.finalState, secondCardOption.id);

        const counterEvt2 = afterDiscardTwo.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'vampire_cull_the_weak',
        );
        expect(counterEvt2).toBeDefined();
        expect((counterEvt2 as any).payload.minionUid).toBe('v1');
        expectNoPrompt(afterDiscardTwo.finalState);
    });

    it('vampire_opportunist 对手随从被消灭后才给附着随从 +1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('m0', 'test_host', '0', 5, {
                        attachedActions: [{ uid: 'oa1', defId: 'vampire_opportunist', ownerId: '0' }],
                    }),
                    makeMinion('e1', 'enemy_low', '1', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const result = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(result.finalState, 'vampire_big_gulp');
        const enemyOption = getPromptOption(prompt, option => option.value?.minionUid === 'e1', 'enemy target');
        const resolved = respondToPrompt(result.finalState, enemyOption.id);

        const opportunistEvt = resolved.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'vampire_opportunist',
        );
        expect(opportunistEvt).toBeDefined();
        expect((opportunistEvt as any).payload.minionUid).toBe('m0');
    });

    it('vampire_opportunist 己方随从被消灭时不应触发', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '1')],
                }),
            },
            currentPlayerIndex: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('m0', 'test_host', '0', 4, {
                        attachedActions: [{ uid: 'oa1', defId: 'vampire_opportunist', ownerId: '0' }],
                    }),
                    makeMinion('f1', 'test_fodder', '0', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const resolveResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '1', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const opportunistEvt = resolveResult.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'vampire_opportunist',
        );
        expect(opportunistEvt).toBeUndefined();
    });

    it('vampire_the_count 己方随从被消灭时不应触发', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '1')],
                }),
            },
            currentPlayerIndex: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('c1', 'vampire_the_count', '0', 5, { powerModifier: 1 }),
                    makeMinion('f1', 'test_fodder', '0', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const resolveResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '1', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const countEvt = resolveResult.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'vampire_the_count',
        );
        expect(countEvt).toBeUndefined();
    });

    it('vampire_heavy_drinker 多同名来源时给触发来源加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c_hd', 'vampire_heavy_drinker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('hd_old', 'vampire_heavy_drinker', '0', 3, { powerModifier: 0 }),
                        makeMinion('fod1', 'test_fodder', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('hd_new', 'vampire_heavy_drinker', '0', 3, { powerModifier: 0 }),
                        makeMinion('fod2', 'test_fodder', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c_hd', baseIndex: 1 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'vampire_heavy_drinker');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'fod2', 'fod2 target');
        const resolveResult = respondToPrompt(playResult.finalState, option.id);

        const counterEvt = resolveResult.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'vampire_heavy_drinker',
        );
        expect(counterEvt).toBeDefined();
        expect((counterEvt as any).payload.minionUid).toBe('c_hd');
    });

    it('vampire_nightstalker 多同名来源时给入场来源加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'vampire_nightstalker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('e1', 'enemy_low', '1', 1, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ns_old', 'vampire_nightstalker', '0', 4, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'vampire_nightstalker');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'e1', 'enemy target');
        const resolveResult = respondToPrompt(playResult.finalState, option.id);

        const counterEvt = resolveResult.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'vampire_nightstalker',
        );
        expect(counterEvt).toBeDefined();
        expect((counterEvt as any).payload.minionUid).toBe('c1');
    });
});

describe('vampire_buffet afterScoring', () => {
    it('赢家拥有 buffet 时，所有己方随从获得 +1 指示物', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'test_base',
                    minions: [
                        makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 }),
                        makeMinion('m3', 'test_minion', '1', 1, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'test_base2',
                    minions: [makeMinion('m2', 'test_minion', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
            pendingAfterScoringSpecials: [{ sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0 }],
        });

        const { events } = fireTriggers(core, 'afterScoring', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            rankings: [
                { playerId: '0', power: 3, vp: 4 },
                { playerId: '1', power: 1, vp: 2 },
            ],
            random: defaultTestRandom,
            now: 100,
        });

        const counterTargets = events
            .filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)
            .map(event => (event as any).payload.minionUid);

        expect(counterTargets).toEqual(expect.arrayContaining(['m1', 'm2']));
        expect(counterTargets).toHaveLength(2);
    });

    it('非赢家拥有 buffet 时不触发加指示物效果', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'test_base',
                    minions: [
                        makeMinion('m1', 'test_minion', '0', 1, { powerModifier: 0 }),
                        makeMinion('m2', 'test_minion', '1', 5, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
            pendingAfterScoringSpecials: [{ sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0 }],
        });

        const { events } = fireTriggers(core, 'afterScoring', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            rankings: [
                { playerId: '1', power: 5, vp: 4 },
                { playerId: '0', power: 1, vp: 2 },
            ],
            random: defaultTestRandom,
            now: 100,
        });

        expect(events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
    });
});
