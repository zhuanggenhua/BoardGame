import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry, resolveOnPlay } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers, isOperationRestricted } from '../../domain/ongoingEffects';
import {
    makeMinion,
    makeCard,
    makePlayer,
    applyEvents,
    getFirstPrompt,
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    getPromptsBySourceId,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptOption,
    getReactionPromptOptionBySourceDefId,
    respondToPrompt,
    respondToPromptOptions,
    respondCommand,
    expectNoPrompt,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';
import { getEffectivePower } from '../../domain/ongoingModifiers';

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

    it('同一宿主上两张 vampire_opportunist 在对手随从被消灭后，应逐实例各给宿主放 1 个指示物', () => {
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
                        attachedActions: [
                            { uid: 'oa1', defId: 'vampire_opportunist', ownerId: '0' },
                            { uid: 'oa2', defId: 'vampire_opportunist', ownerId: '0' },
                        ],
                    }),
                    makeMinion('e1', 'enemy_low', '1', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'vampire_big_gulp');
        const enemyOption = getPromptOption(prompt, option => option.value?.minionUid === 'e1', 'enemy target');
        const resolved = respondToPrompt(played.finalState, enemyOption.id);

        const opportunistEvents = resolved.events.filter(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'vampire_opportunist',
        );
        expect(opportunistEvents).toHaveLength(2);
        expect(opportunistEvents.every(event => (event as any).payload.minionUid === 'm0')).toBe(true);
        expect(
            resolved.finalState.core.bases[0]?.minions.find(minion => minion.uid === 'm0')?.powerCounters,
        ).toBe(2);
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
    it('vampire_buffet 在对手计分时仍应把 queued afterScoring owner 交给 special 拥有者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'test_base',
                    minions: [
                        makeMinion('m1', 'test_minion', '0', 5, { powerModifier: 0 }),
                        makeMinion('m2', 'test_minion', '1', 8, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
            pendingAfterScoringSpecials: [{ sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0 }],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [
                { playerId: '1', power: 8, vp: 4 },
                { playerId: '0', power: 5, vp: 2 },
            ],
            random: defaultTestRandom,
            now: 101,
        });

        expect(queued).toBeDefined();
        const buffetTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceDefId === 'vampire_buffet');
        expect(buffetTrigger).toBeDefined();
        expect(buffetTrigger.ownerPlayerId).toBe('0');
    });

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

describe('vampires_pod: Nightstalker POD', () => {
    it('talent requires having destroyed a minion this turn', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('ns', 'vampire_nightstalker_pod', 'minion', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('m1', 'robot_microbot', 'minion', '1')] }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'ns', baseIndex: 0 } },
            defaultTestRandom,
        );

        const use1 = runCommand(
            played.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'ns', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(use1.success).toBe(false);
        expect(String(use1.error ?? '')).toContain('本回合你还没有消灭过随从');
        expect(use1.events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(false);

        const core2 = {
            ...played.finalState.core,
            destroyedMinionByPlayersThisTurn: ['0'] as any,
            players: {
                ...played.finalState.core.players,
                '0': {
                    ...played.finalState.core.players['0'],
                    deck: [makeCard('d1', 'robot_microbot', 'minion', '0')],
                },
            },
            bases: played.finalState.core.bases.map((b, i) => i !== 0 ? b : ({
                ...b,
                minions: b.minions.map(m => m.uid === 'ns' ? { ...m, talentUsed: false } : m),
            })),
        };
        const use2 = runCommand(
            makeMatchState(core2),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'ns', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(use2.success).toBe(true);
        expect(use2.events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
    });

    it('destroying your own Fledgling Vampire this turn should satisfy the talent condition', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gulp', 'vampire_big_gulp_pod', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ns', 'vampire_nightstalker_pod', '0', 4),
                    makeMinion('fv', 'vampire_fledgling_vampire_pod', '0', 2),
                ],
                ongoingActions: [],
            }],
        });

        const playBigGulp = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gulp' } },
            defaultTestRandom,
        );
        expect(playBigGulp.success).toBe(true);

        const destroyPrompt = getSimpleChoicePrompt(playBigGulp.finalState, 'vampire_big_gulp_pod');
        const fledglingOption = getPromptOption(
            destroyPrompt,
            option => option.value?.minionUid === 'fv',
            'Fledgling Vampire destroy option',
        );

        const afterDestroy = runCommand(
            playBigGulp.finalState,
            respondCommand(fledglingOption.id, '0'),
            defaultTestRandom,
        );
        expect(afterDestroy.success).toBe(true);
        expect(afterDestroy.finalState.core.destroyedMinionByPlayersThisTurn).toContain('0');

        const useTalent = runCommand(
            afterDestroy.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'ns', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(useTalent.success).toBe(true);
        expect(useTalent.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(useTalent.events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
    });

    it('WWTLF POD + Drone skip should still count as having destroyed a minion this turn', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('wwtlf', 'giant_ant_who_wants_to_live_forever_pod', 'action', '0')],
                    deck: [makeCard('top-card', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ns', 'vampire_nightstalker_pod', '0', 4),
                    makeMinion('fv', 'vampire_fledgling_vampire_pod', '0', 2),
                    makeMinion('drone', 'giant_ant_drone_pod', '0', 2, { powerCounters: 1 }),
                ],
                ongoingActions: [],
            }],
        });

        const playWWTLF = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'wwtlf' } },
            defaultTestRandom,
        );
        expect(playWWTLF.success).toBe(true);

        let currentState = playWWTLF.finalState;
        for (let step = 0; step < 20; step += 1) {
            const prompt = getFirstPrompt(currentState);
            if (!prompt) break;

            const sourceId = getPromptSourceId(prompt);
            let optionId: string | undefined;

            if (sourceId === 'giant_ant_who_wants_to_live_forever_pod_destroy') {
                optionId = getPromptOption(prompt, o => o.value?.minionUid === 'fv', 'WWTLF destroy target fv').id;
            } else if (sourceId === 'giant_ant_drone_prevent_destroy') {
                optionId = getPromptOption(prompt, o => o.value?.skip, 'Drone skip option').id;
            } else if (sourceId === 'giant_ant_who_wants_to_live_forever_pod_search') {
                optionId = getPromptOption(prompt, o => o.value?.cardUid === 'top-card', 'WWTLF top-card search option').id;
            } else if (sourceId === 'vampire_fledgling_vampire_pod_bury_source') {
                optionId = getPromptOption(prompt, o => o.id === 'skip', 'Fledgling bury skip option').id;
            } else if (sourceId === 'smashup_reaction_choose') {
                const options = getPromptOptions(prompt);
                optionId = options.find((o: any) => o.id === 'pass' || o.value?.kind === 'pass' || o.value?.pass === true)?.id
                    ?? options[0]?.id;
            } else {
                throw new Error(`未处理的交互 sourceId: ${sourceId ?? 'unknown'}`);
            }

            expect(optionId).toBeTruthy();
            const next = runCommand(
                currentState,
                respondCommand(optionId!, getPromptPlayerId(prompt)),
                defaultTestRandom,
            );
            expect(next.success).toBe(true);
            currentState = next.finalState;
        }

        for (let guard = 0; guard < 5; guard += 1) {
            const prompt = getFirstPrompt(currentState);
            if (!prompt) break;
            if (getPromptSourceId(prompt) !== 'smashup_reaction_choose') break;
            const options = getPromptOptions(prompt);
            const passId = options.find((o: any) =>
                o.id === 'pass' || o.value?.kind === 'pass' || o.value?.pass === true,
            )?.id ?? options[0]?.id;
            if (!passId) break;
            const next = runCommand(
                currentState,
                respondCommand(passId, getPromptPlayerId(prompt)),
                defaultTestRandom,
            );
            expect(next.success).toBe(true);
            currentState = next.finalState;
        }

        expect(currentState.core.destroyedMinionByPlayersThisTurn).toContain('0');
        expect(currentState.core.players['0'].deck[0]?.uid).toBe('top-card');

        const remainingPrompt = getFirstPrompt(currentState);
        if (remainingPrompt) {
            expect(getPromptSourceId(remainingPrompt)).toBe('smashup_reaction_choose');
        }
        expect(currentState.sys.phase).toBe('playCards');
        expect(currentState.core.turnOrder[currentState.core.currentPlayerIndex]).toBe('0');
    });

    it('House of Nine Lives declining the save should still preserve Nightstalker POD condition', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gulp', 'vampire_big_gulp_pod', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('fv', 'vampire_fledgling_vampire_pod', '0', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_house_of_nine_lives',
                    minions: [
                        makeMinion('ns', 'vampire_nightstalker_pod', '0', 4),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playBigGulp = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gulp' } },
            defaultTestRandom,
        );
        expect(playBigGulp.success).toBe(true);

        const destroyPrompt = getSimpleChoicePrompt(playBigGulp.finalState, 'vampire_big_gulp_pod');
        const fledglingOption = getPromptOption(
            destroyPrompt,
            option => option.value?.minionUid === 'fv',
            'Fledgling Vampire destroy option',
        );

        const afterChooseDestroy = runCommand(
            playBigGulp.finalState,
            respondCommand(fledglingOption.id, '0'),
            defaultTestRandom,
        );
        expect(afterChooseDestroy.success).toBe(true);

        const nineLivesPrompt = getSimpleChoicePrompt(afterChooseDestroy.finalState, 'base_nine_lives_intercept');
        const skipOption = getPromptOption(
            nineLivesPrompt,
            option => option.value?.move === false,
            'House of Nine Lives decline option',
        );

        const afterNineLivesSkip = runCommand(
            afterChooseDestroy.finalState,
            respondCommand(skipOption.id, '0'),
            defaultTestRandom,
        );
        expect(afterNineLivesSkip.success).toBe(true);
        expect(afterNineLivesSkip.finalState.core.destroyedMinionByPlayersThisTurn).toContain('0');

        const useTalent = runCommand(
            afterNineLivesSkip.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'ns', baseIndex: 1 } } as any,
            defaultTestRandom,
        );
        expect(useTalent.success).toBe(true);
        expect(useTalent.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(useTalent.events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
    });

    it('destroying an in-play Fledgling should still let another copy in hand trigger and bury via the shared pipeline', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('fv-hand', 'vampire_fledgling_vampire_pod', 'minion', '0'),
                        makeCard('gulp', 'vampire_big_gulp_pod', 'action', '0'),
                    ],
                    deck: [makeCard('draw-1', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('fv-board', 'vampire_fledgling_vampire_pod', '0', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_star_portal_pod',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const playBigGulp = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gulp' } },
            defaultTestRandom,
        );
        expect(playBigGulp.success).toBe(true);

        const destroyPrompt = getSimpleChoicePrompt(playBigGulp.finalState, 'vampire_big_gulp_pod');
        const fledglingOption = getPromptOption(
            destroyPrompt,
            option => option.value?.minionUid === 'fv-board',
            'in-play Fledgling destroy option',
        );

        const afterDestroy = runCommand(
            playBigGulp.finalState,
            respondCommand(fledglingOption.id, '0'),
            defaultTestRandom,
        );
        expect(afterDestroy.success).toBe(true);

        const reactionPrompt = getSimpleChoicePrompt(afterDestroy.finalState, 'smashup_reaction_choose');
        const reactionOption = getReactionPromptOptionBySourceDefId(
            afterDestroy.finalState,
            reactionPrompt,
            'vampire_fledgling_vampire_pod',
        );

        const afterReaction = runCommand(
            afterDestroy.finalState,
            respondCommand(reactionOption.id, getPromptPlayerId(reactionPrompt)),
            defaultTestRandom,
        );
        expect(afterReaction.success).toBe(true);

        const sourcePrompt = getSimpleChoicePrompt(afterReaction.finalState, 'vampire_fledgling_vampire_pod_bury_source');
        const handSourceOption = getPromptOption(
            sourcePrompt,
            option => option.value?.cardUid === 'fv-hand',
            'hand Fledgling bury source',
        );

        const afterSource = runCommand(
            afterReaction.finalState,
            respondCommand(handSourceOption.id, '0'),
            defaultTestRandom,
        );
        expect(afterSource.success).toBe(true);

        const basePrompt = getSimpleChoicePrompt(afterSource.finalState, 'vampire_fledgling_vampire_pod_bury_base');
        const starPortalOption = getPromptOption(
            basePrompt,
            option => option.value?.baseIndex === 1,
            'Star Portal bury base',
        );

        const afterBury = runCommand(
            afterSource.finalState,
            respondCommand(starPortalOption.id, '0'),
            defaultTestRandom,
        );
        expect(afterBury.success).toBe(true);
        expect(afterBury.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(afterBury.events.some(event =>
            event.type === SU_EVENTS.TRIGGER_QUEUED || event.type === SU_EVENTS.CARDS_DRAWN,
        )).toBe(true);
        expect(afterBury.finalState.core.bases[1].buriedCards?.some(card => card.uid === 'fv-hand')).toBe(true);
        expect(afterBury.finalState.core.players['0'].hand.some(card => card.uid === 'fv-hand')).toBe(false);
    });

    it('borrowed Fledgling Vampire POD 从当前玩家手牌埋葬时，仍应保留真实 trueOwnerId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('fv-hand', 'vampire_fledgling_vampire_pod', 'minion', '1'),
                        makeCard('gulp', 'vampire_big_gulp_pod', 'action', '0'),
                    ],
                    deck: [makeCard('draw-1', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('fv-board', 'vampire_fledgling_vampire_pod', '0', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_star_portal_pod',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const playBigGulp = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gulp' } },
            defaultTestRandom,
        );
        const destroyPrompt = getSimpleChoicePrompt(playBigGulp.finalState, 'vampire_big_gulp_pod');
        const fledglingOption = getPromptOption(
            destroyPrompt,
            option => option.value?.minionUid === 'fv-board',
            'in-play Fledgling destroy option',
        );

        const afterDestroy = runCommand(
            playBigGulp.finalState,
            respondCommand(fledglingOption.id, '0'),
            defaultTestRandom,
        );
        const reactionPrompt = getSimpleChoicePrompt(afterDestroy.finalState, 'smashup_reaction_choose');
        const reactionOption = getReactionPromptOptionBySourceDefId(
            afterDestroy.finalState,
            reactionPrompt,
            'vampire_fledgling_vampire_pod',
        );

        const afterReaction = runCommand(
            afterDestroy.finalState,
            respondCommand(reactionOption.id, getPromptPlayerId(reactionPrompt)),
            defaultTestRandom,
        );
        const sourcePrompt = getSimpleChoicePrompt(afterReaction.finalState, 'vampire_fledgling_vampire_pod_bury_source');
        const handSourceOption = getPromptOption(
            sourcePrompt,
            option => option.value?.cardUid === 'fv-hand',
            'borrowed hand Fledgling bury source',
        );

        const afterSource = runCommand(
            afterReaction.finalState,
            respondCommand(handSourceOption.id, '0'),
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(afterSource.finalState, 'vampire_fledgling_vampire_pod_bury_base');
        const starPortalOption = getPromptOption(
            basePrompt,
            option => option.value?.baseIndex === 1,
            'Star Portal bury base',
        );

        const afterBury = runCommand(
            afterSource.finalState,
            respondCommand(starPortalOption.id, '0'),
            defaultTestRandom,
        );

        const buriedCard = afterBury.finalState.core.bases[1].buriedCards?.find(card => card.uid === 'fv-hand');
        expect(buriedCard).toBeDefined();
        expect(buriedCard?.controllerId).toBe('0');
        expect(buriedCard?.trueOwnerId).toBe('1');
    });
});

describe('vampires_pod: Buffet POD', () => {
    it('can be played as a normal action and draws two cards', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bf', 'vampire_buffet_pod', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bf' } },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(e => e.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(played.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(c => c.uid)).toEqual(
            expect.arrayContaining(['draw-1', 'draw-2']),
        );
        expect(played.finalState.core.players['0'].discard.some(c => c.uid === 'bf')).toBe(true);
    });
});

describe('vampires_pod: Cull The Weak POD', () => {
    it('搜牌库弃随从时由玩家选择最多两张，不自动弃掉前两张合法随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cull', 'vampire_cull_the_weak_pod', 'action', '0')],
                    deck: [
                        makeCard('first-minion', 'vampire_fledgling_vampire_pod', 'minion', '0'),
                        makeCard('chosen-minion-a', 'vampire_nightstalker_pod', 'minion', '0'),
                        makeCard('chosen-minion-b', 'vampire_the_count_pod', 'minion', '0'),
                        makeCard('deck-action', 'vampire_buffet_pod', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('target', 'vampire_fledgling_vampire_pod', '0', 2),
                    makeMinion('other', 'test_minion', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'cull' } },
            defaultTestRandom,
        );
        expect(played.success).toBe(true);

        const deckPrompt = getSimpleChoicePrompt(played.finalState, 'vampire_cull_the_weak_pod_deck');
        expect(deckPrompt.autoResolveIfSingle).toBe(false);
        expect(deckPrompt.targetType).toBe('generic');
        expect(getPromptOptions(deckPrompt).map(option => option.value?.cardUid)).toEqual([
            'first-minion',
            'chosen-minion-a',
            'chosen-minion-b',
        ]);

        const deckOptions = getPromptOptions(deckPrompt)
            .filter(option => ['chosen-minion-a', 'chosen-minion-b'].includes(option.value?.cardUid))
            .map(option => option.id);
        const afterDeckChoice = respondToPromptOptions(played.finalState, deckOptions, '0', defaultTestRandom);
        expect(afterDeckChoice.success, afterDeckChoice.error).toBe(true);

        const targetPrompt = getSimpleChoicePrompt(afterDeckChoice.finalState, 'vampire_cull_the_weak_pod');
        const targetOption = getPromptOption(targetPrompt, option => option.value?.minionUid === 'target', 'counter target');
        const resolved = respondToPrompt(afterDeckChoice.finalState, targetOption.id, '0', defaultTestRandom);

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(
            expect.arrayContaining(['cull', 'chosen-minion-a', 'chosen-minion-b']),
        );
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('first-minion');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['first-minion', 'deck-action']);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.powerCounters).toBe(2);
    });
});

describe('vampires_pod: The Count POD', () => {
    it('borrowed Stakeout POD talent 应按控制者建立封锁，并只豁免控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            basePowerDecreasedPlayersThisTurn: { 0: ['1'] },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('stake-borrowed', 'vampire_stakeout_pod', '0', 4, { owner: '1' }),
                ],
                ongoingActions: [],
            }],
        });

        const useTalent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'stake-borrowed', baseIndex: 0 } } as any,
            defaultTestRandom,
        );

        expect(useTalent.success).toBe(true);
        const blockEvent = useTalent.events.find(event => event.type === SU_EVENTS.STAKEOUT_POD_BLOCK_ADDED) as any;
        expect(blockEvent).toBeDefined();
        expect(blockEvent.payload.ownerId).toBe('0');

        const state = useTalent.finalState.core;
        expect(isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 3 })).toBe(false);
        expect(isOperationRestricted(state, 0, '1', 'play_minion', { basePower: 3 })).toBe(true);
    });

    it('同一基地两条不同 owner 的 Stakeout POD block 并存时，不应因第一条自豁免 block 漏掉后面另一条真实限制', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 5,
            stakeoutPodBlocks: [
                { baseIndex: 0, ownerId: '1', expiresOnTurnNumber: 7, reason: 'test-self-exempt-first' },
                { baseIndex: 0, ownerId: '0', expiresOnTurnNumber: 7, reason: 'test-real-block-second' },
            ],
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('stake-p0', 'vampire_stakeout_pod', '0', 4),
                    makeMinion('stake-p1', 'vampire_stakeout_pod', '1', 4),
                ],
                ongoingActions: [],
            }],
        });

        expect(isOperationRestricted(core, 0, '1', 'play_minion', { basePower: 3 })).toBe(true);
        expect(isOperationRestricted(core, 0, '0', 'play_minion', { basePower: 3 })).toBe(true);
        expect(isOperationRestricted(core, 0, '1', 'play_minion', { basePower: 2 })).toBe(false);
    });

    it('ongoing 应在任意基地触发（不是仅同基地）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('count', 'vampire_the_count_pod', 'minion', '0'),
                        makeCard('bg', 'vampire_big_gulp_pod', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('ally', 'robot_microbot', '0', 2),
                        makeMinion('victim', 'robot_microbot', '1', 1),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playCount = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'count', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(playCount.success).toBe(true);

        const playBigGulp = runCommand(
            playCount.finalState,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bg' } },
            defaultTestRandom,
        );
        expect(playBigGulp.success).toBe(true);

        const chooseDestroy = getSimpleChoicePrompt(playBigGulp.finalState, 'vampire_big_gulp_pod');
        const victimOpt = getPromptOption(
            chooseDestroy,
            option => option.value?.minionUid === 'victim',
            'Big Gulp victim option',
        );

        const afterDestroy = runCommand(
            playBigGulp.finalState,
            respondCommand(victimOpt.id, '0'),
            defaultTestRandom,
        );
        expect(afterDestroy.success).toBe(true);
        const countPrompts = getPromptsBySourceId(afterDestroy.finalState, 'vampire_the_count_pod_add_counter');
        if (countPrompts.length > 0) {
            expect(countPrompts[0]).toBeTruthy();
        } else {
            const reactionPrompt = getSimpleChoicePrompt(afterDestroy.finalState, 'smashup_reaction_choose');
            const hasCountTrigger = getPromptOptions(reactionPrompt).some((o: any) =>
                String(o.id ?? '').includes('vampire_the_count_pod')
                || String(o.label ?? '').includes('伯爵'),
            );
            expect(hasCountTrigger).toBe(true);
        }
    });

    it('多个 The Count POD 走 direct fireTriggers 时，应按每个 source 继续给各自控制者链式加指示物 prompt', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('count-p0', 'vampire_the_count_pod', '0', 5)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('count-p1', 'vampire_the_count_pod', '1', 5)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_c',
                    minions: [
                        makeMinion('target-a', 'robot_microbot', '0', 2),
                        makeMinion('victim-a', 'ghosts_spectre', '1', 2),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const direct = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 2,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[2].minions.find(minion => minion.uid === 'victim-a'),
            destroyerId: '0',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 40,
        });

        const firstPrompt = getSimpleChoicePrompt(direct.matchState!, 'vampire_the_count_pod_add_counter');
        expect(getPromptPlayerId(firstPrompt)).toBe('0');

        const afterFirstSkip = respondToPrompt(
            direct.matchState!,
            getPromptOption(firstPrompt, option => option.value?.skip === true, 'The Count POD first skip').id,
            '0',
            defaultTestRandom,
        );
        const secondPrompt = getSimpleChoicePrompt(afterFirstSkip.finalState, 'vampire_the_count_pod_add_counter');
        expect(getPromptPlayerId(secondPrompt)).toBe('1');
    });

    it('talent 的 -1 应持续到自己下回合开始', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('count', 'vampire_the_count_pod', '0', 5),
                    makeMinion('target', 'robot_microbot', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const useTalent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'count', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(useTalent.success).toBe(true);
        const prompt = getSimpleChoicePrompt(useTalent.finalState, 'vampire_the_count_pod_talent');
        const targetOpt = getPromptOption(
            prompt,
            option => option.value?.minionUid === 'target',
            'The Count talent target option',
        );

        const afterChoose = runCommand(
            useTalent.finalState,
            respondCommand(targetOpt.id, '0'),
            defaultTestRandom,
        );
        expect(afterChoose.success).toBe(true);

        const afterApply = afterChoose.finalState.core.bases[0].minions.find(m => m.uid === 'target');
        expect(afterApply?.powerModifier).toBe(-1);

        const afterOpponentStart = applyEvents(afterChoose.finalState.core, [
            { type: SU_EVENTS.TURN_STARTED, payload: { playerId: '1', turnNumber: 2 }, timestamp: 100 } as any,
        ]);
        const stillDebuffed = afterOpponentStart.bases[0].minions.find(m => m.uid === 'target');
        expect(stillDebuffed?.powerModifier).toBe(-1);

        const afterOwnerStart = applyEvents(afterOpponentStart, [
            { type: SU_EVENTS.TURN_STARTED, payload: { playerId: '0', turnNumber: 3 }, timestamp: 200 } as any,
        ]);
        const reverted = afterOwnerStart.bases[0].minions.find(m => m.uid === 'target');
        expect(reverted?.powerModifier).toBe(0);
    });
});

describe('vampires_pod: Dinner Date POD', () => {
    it('ongoing -2 生效且力量变为 0 时立即消灭', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('dd', 'vampire_dinner_date_pod', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally', 'robot_microbot', '0', 2),
                    makeMinion('victim', 'robot_microbot', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'dd', targetBaseIndex: 0, targetMinionUid: 'victim' },
            },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);
        const prompt = getSimpleChoicePrompt(play.finalState, 'vampire_dinner_date_pod');
        const allyOpt = getPromptOption(
            prompt,
            option => option.value?.minionUid === 'ally',
            'Dinner Date ally option',
        );

        const resolved = runCommand(
            play.finalState,
            respondCommand(allyOpt.id, '0'),
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'victim')).toBe(false);
    });

    it('ongoing -2 不应在回合开始被清零', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('dd', 'vampire_dinner_date_pod', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally', 'robot_microbot', '0', 2),
                    makeMinion('victim', 'robot_microbot', '1', 4),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'dd', targetBaseIndex: 0, targetMinionUid: 'victim' },
            },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);
        const prompt = getSimpleChoicePrompt(play.finalState, 'vampire_dinner_date_pod');
        const allyOpt = getPromptOption(
            prompt,
            option => option.value?.minionUid === 'ally',
            'Dinner Date ally option',
        );

        const resolved = runCommand(
            play.finalState,
            respondCommand(allyOpt.id, '0'),
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);

        const victimNow = resolved.finalState.core.bases[0].minions.find(m => m.uid === 'victim')!;
        expect(getEffectivePower(resolved.finalState.core, victimNow, 0)).toBe(2);

        const afterOpponentStart = applyEvents(resolved.finalState.core, [
            { type: SU_EVENTS.TURN_STARTED, payload: { playerId: '1', turnNumber: 2 }, timestamp: 100 } as any,
        ]);
        const victimAfterTurnStart = afterOpponentStart.bases[0].minions.find(m => m.uid === 'victim')!;
        expect(getEffectivePower(afterOpponentStart, victimAfterTurnStart, 0)).toBe(2);
    });
});

describe('vampires_pod: Wolf Pact POD', () => {
    it('随从面在“此基地没有另一个己方随从”时不应强制进入减攻流程', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('wp', 'vampire_wolf_pact_pod', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy', 'robot_microbot', '1', 2)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'wp', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);
        expectNoPrompt(play.finalState);
    });

    it('战术面应为强制选择，不应出现“跳过”选项', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('d1', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const onPlay = resolveOnPlay('vampire_wolf_pact_pod_action');
        expect(onPlay).toBeTruthy();
        const result = onPlay!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wp',
            defId: 'vampire_wolf_pact_pod_action',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 0,
        } as any);
        const ms = result.matchState ?? makeMatchState(core);
        const prompt = getSimpleChoicePrompt(ms, 'vampire_wolf_pact_pod_action');
        expect(getPromptOptions(prompt).some((o: any) => o.id === 'skip')).toBe(false);
    });
});
