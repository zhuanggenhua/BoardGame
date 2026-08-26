import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { validate } from '../../domain/commands';
import { execute } from '../../domain/reducer';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getPromptOptionById,
    getSimpleChoicePrompt,
    getPromptsBySourceId,
    getPromptOptions,
    getPromptSourceId,
    resolveDestroyedMinions,
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
    it('frankenstein_blitzed 可以移除 0 个指示物后仍消灭力量 0 随从', () => {
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

        const step2 = respondToPromptOption(
            play.finalState,
            option => option.id === doneOpt.id,
            'frankenstein blitzed done option',
            '0',
            defaultTestRandom,
        );
        expect(step2.success, step2.error).toBe(true);

        const step3 = respondToPromptOption(
            step2.finalState,
            option => option.value?.minionUid === 'w0',
            'frankenstein blitzed destroy option',
            '0',
            defaultTestRandom,
        );
        expect(step3.success, step3.error).toBe(true);
        expect(step3.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('frankenstein_uberserum 在行动拥有者回合开始放置指示物，即使附着在对手随从上', () => {
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
        expect(enter.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
    });

    it('frankenstein_its_alive 放弃额外随从时不应遗留 pending 指示物效果', () => {
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
        const skipped = respondToPromptOption(
            play.finalState,
            option => option?.value?.skip,
            'frankenstein its alive immediate extra minion skip option',
            '0',
            defaultTestRandom,
        );
        expect(skipped.success, skipped.error).toBe(true);

        const pending = skipped.finalState.core.players['0'].pendingMinionPlayEffects ?? [];
        expect(pending).toHaveLength(0);
    });

    it('frankenstein_body_shop 消灭后应进入指示物分配，并允许分配到多个己方随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('body-shop', 'frankenstein_body_shop', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('dok', 'frankenstein_herr_doktor', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('monster', 'frankenstein_the_monster', '0', 4, { powerCounters: 0 }),
                        makeMinion('assistant', 'frankenstein_lab_assistant', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'body-shop' } },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);

        const chooseDestroyed = respondToPromptOption(
            play.finalState,
            option => option.value?.minionUid === 'dok',
            'body shop destroy dok option',
            '0',
            defaultTestRandom,
        );
        expect(chooseDestroyed.success, chooseDestroyed.error).toBe(true);
        expect(chooseDestroyed.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(chooseDestroyed.finalState.core.bases[0].minions.some(minion => minion.uid === 'dok')).toBe(false);

        const distributePrompt1 = getSimpleChoicePrompt(chooseDestroyed.finalState, 'frankenstein_body_shop_distribute');
        expect(getPromptOptions(distributePrompt1)).toHaveLength(2);

        const firstDistribution = respondToPromptOption(
            chooseDestroyed.finalState,
            option => option.value?.minionUid === 'monster',
            'body shop distribute first counter to monster',
            '0',
            defaultTestRandom,
        );
        expect(firstDistribution.success, firstDistribution.error).toBe(true);
        expect(firstDistribution.finalState.core.bases[1].minions.find(minion => minion.uid === 'monster')?.powerCounters).toBe(1);

        const distributePrompt2 = getSimpleChoicePrompt(firstDistribution.finalState, 'frankenstein_body_shop_distribute');
        expect(getPromptOptions(distributePrompt2)).toHaveLength(2);

        const secondDistribution = respondToPromptOption(
            firstDistribution.finalState,
            option => option.value?.minionUid === 'assistant',
            'body shop distribute second counter to assistant',
            '0',
            defaultTestRandom,
        );
        expect(secondDistribution.success, secondDistribution.error).toBe(true);
        expect(secondDistribution.finalState.core.bases[1].minions.find(minion => minion.uid === 'assistant')?.powerCounters).toBe(1);
        expect(getPromptsBySourceId(secondDistribution.finalState, 'frankenstein_body_shop_distribute')).toHaveLength(0);
    });

    it('frankenstein_body_shop 选择海盗 4 力量随从时，即使其改为移动，仍应继续进入指示物分配', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('body-shop', 'frankenstein_body_shop', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('buccaneer', 'pirate_buccaneer', '0', 4, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('monster', 'frankenstein_the_monster', '0', 5, { powerCounters: 0 }),
                        makeMinion('assistant', 'frankenstein_lab_assistant', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_c',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'body-shop' } },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);

        const chooseBuccaneer = respondToPromptOption(
            play.finalState,
            option => option.value?.minionUid === 'buccaneer',
            'body shop choose buccaneer option',
            '0',
            defaultTestRandom,
        );
        expect(chooseBuccaneer.success, chooseBuccaneer.error).toBe(true);
        const movePrompt = getSimpleChoicePrompt(chooseBuccaneer.finalState, 'pirate_buccaneer_move');

        const moveToBaseC = respondToPromptOption(
            chooseBuccaneer.finalState,
            option => getPromptSourceId(movePrompt) === 'pirate_buccaneer_move' && option.value?.toBaseIndex === 2,
            'buccaneer move to base c option',
            '0',
            defaultTestRandom,
        );
        expect(moveToBaseC.success, moveToBaseC.error).toBe(true);
        expect(moveToBaseC.finalState.core.bases[0].minions.some(minion => minion.uid === 'buccaneer')).toBe(false);
        expect(moveToBaseC.finalState.core.bases[2].minions.some(minion => minion.uid === 'buccaneer')).toBe(true);

        const distributePrompt = getSimpleChoicePrompt(moveToBaseC.finalState, 'frankenstein_body_shop_distribute');
        expect(getPromptOptions(distributePrompt)).toHaveLength(2);

        let currentState = moveToBaseC.finalState;
        for (let i = 0; i < 4; i += 1) {
            const step = respondToPromptOption(
                currentState,
                option => option.value?.minionUid === 'monster',
                `body shop distribute counter ${i + 1} to monster`,
                '0',
                defaultTestRandom,
            );
            expect(step.success, step.error).toBe(true);
            currentState = step.finalState;
        }

        expect(currentState.core.bases[1].minions.find(minion => minion.uid === 'monster')?.powerCounters).toBe(4);
        expect(currentState.core.bases[1].minions.find(minion => minion.uid === 'assistant')?.powerCounters ?? 0).toBe(0);
        expect(getPromptsBySourceId(currentState, 'frankenstein_body_shop_distribute')).toHaveLength(0);
    });

    it('The Bride 第二个效果不应把第一个效果选中的同一随从强行排除', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['frankenstein', 'aliens'],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_the_factory',
                minions: [{
                    ...makeMinion('bride-target', 'frankenstein_igor', '0', 2),
                    powerCounters: 1,
                }],
                ongoingActions: [],
            }],
            titans: [{
                uid: 'bride-1',
                defId: 'frankenstein_the_bride',
                faction: 'frankenstein',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
        });

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 123,
        });
        const chooseFirstEffect = respondToPromptOption(
            triggerResult.matchState!,
            option => option.value?.kind === 'removeCounter',
            'The Bride first remove-counter effect',
            '0',
            defaultTestRandom,
        );
        expect(chooseFirstEffect.success, chooseFirstEffect.error).toBe(true);

        const chooseTarget = respondToPromptOption(
            chooseFirstEffect.finalState,
            option => option.value?.targetUid === 'bride-target',
            'The Bride remove-counter target',
            '0',
            defaultTestRandom,
        );
        expect(chooseTarget.success, chooseTarget.error).toBe(true);

        const secondEffectPrompt = getSimpleChoicePrompt(
            chooseTarget.finalState,
            'titan_frankenstein_the_bride_start_choose_branch',
        );
        expect(
            getPromptOptions(secondEffectPrompt).some(option => option.value?.kind === 'destroy'),
        ).toBe(true);
    });

    it('The Bride 先消灭海盗时，应先进入海盗移动替代并在移动后继续第二个效果', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['frankenstein', 'pirates'],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [{
                        ...makeMinion('bucc', 'pirate_buccaneer', '0', 4),
                        powerCounters: 1,
                    }],
                    ongoingActions: [],
                },
                { defId: 'base_b', minions: [], ongoingActions: [] },
                { defId: 'base_c', minions: [], ongoingActions: [] },
            ],
            titans: [{
                uid: 'bride-1',
                defId: 'frankenstein_the_bride',
                faction: 'frankenstein',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
        });

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 123,
        });
        const chooseDestroy = respondToPromptOption(
            triggerResult.matchState!,
            option => option.value?.kind === 'destroy',
            'The Bride first destroy effect',
            '0',
            defaultTestRandom,
        );
        expect(chooseDestroy.success, chooseDestroy.error).toBe(true);

        const destroyBuccaneer = respondToPromptOption(
            chooseDestroy.finalState,
            option => option.value?.targetUid === 'bucc',
            'The Bride destroy pirate buccaneer',
            '0',
            defaultTestRandom,
        );
        expect(destroyBuccaneer.success, destroyBuccaneer.error).toBe(true);
        expect(getPromptSourceId(getSimpleChoicePrompt(destroyBuccaneer.finalState, 'pirate_buccaneer_move'))).toBe('pirate_buccaneer_move');
        expect(getPromptsBySourceId(destroyBuccaneer.finalState, 'titan_frankenstein_the_bride_start_choose_branch')).toHaveLength(1);
        expect(destroyBuccaneer.finalState.core.bases[0].minions.some(minion => minion.uid === 'bucc')).toBe(true);
        expect(destroyBuccaneer.finalState.core.players['0'].discard.some(card => card.uid === 'bucc')).toBe(false);

        const moveBuccaneer = respondToPromptOption(
            destroyBuccaneer.finalState,
            option => option.value?.toBaseIndex === 1,
            'move pirate buccaneer to base_b',
            '0',
            defaultTestRandom,
        );
        expect(moveBuccaneer.success, moveBuccaneer.error).toBe(true);
        expect(moveBuccaneer.finalState.core.bases[1].minions.some(minion => minion.uid === 'bucc')).toBe(true);

        const secondEffectPrompt = getSimpleChoicePrompt(
            moveBuccaneer.finalState,
            'titan_frankenstein_the_bride_start_choose_branch',
        );
        expect(
            getPromptOptions(secondEffectPrompt).some(option => option.value?.kind === 'removeCounter'),
        ).toBe(true);

        const chooseRemoveCounter = respondToPromptOption(
            moveBuccaneer.finalState,
            option => option.value?.kind === 'removeCounter',
            'The Bride second remove-counter effect',
            '0',
            defaultTestRandom,
        );
        expect(chooseRemoveCounter.success, chooseRemoveCounter.error).toBe(true);

        const removeCounterPrompt = getSimpleChoicePrompt(
            chooseRemoveCounter.finalState,
            'titan_frankenstein_the_bride_start_choose_target',
        );
        expect(
            getPromptOptions(removeCounterPrompt).some(
                option => option.value?.targetUid === 'bucc' && option.value?.baseIndex === 1,
            ),
        ).toBe(true);
    });

    it('线上反馈 6a33a09c5ed87cdca4f71449：The Bride 在起始阶段消灭己方随从并命中身体改造时，应改为回手而不是抛 helper 未定义异常', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['frankenstein', 'giant_ants'],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_secret_volcano_headquarters',
                    minions: [{
                        ...makeMinion('worker-1', 'giant_ant_worker', '0', 2),
                        powerCounters: 2,
                    }],
                    ongoingActions: [{
                        uid: 'grave-1',
                        defId: 'frankenstein_grave_situation',
                        ownerId: '0',
                    }],
                },
                { defId: 'base_ninja_dojo', minions: [], ongoingActions: [] },
                { defId: 'base_isis_swingin_pad', minions: [], ongoingActions: [] },
            ],
            titans: [{
                uid: 'bride-1',
                defId: 'frankenstein_the_bride',
                faction: 'frankenstein',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
        });

        const triggerResult = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 123,
        });

        const chooseDestroy = respondToPromptOption(
            triggerResult.matchState!,
            option => option.value?.kind === 'destroy',
            'The Bride first destroy effect',
            '0',
            defaultTestRandom,
        );
        expect(chooseDestroy.success, chooseDestroy.error).toBe(true);

        const destroyWorker = respondToPromptOption(
            chooseDestroy.finalState,
            option => option.value?.targetUid === 'worker-1',
            'The Bride destroy worker with grave situation',
            '0',
            defaultTestRandom,
        );
        expect(destroyWorker.success, destroyWorker.error).toBe(true);
        expect(destroyWorker.events.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(true);
        expect(destroyWorker.finalState.core.players['0'].hand.some(card => card.uid === 'worker-1')).toBe(true);
    });

    it('frankenstein_grave_situation 在同基地己方随从被消灭时，应改为回手', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['frankenstein', 'aliens'],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [{
                    ...makeMinion('igor', 'frankenstein_igor', '0', 2),
                    powerCounters: 1,
                }],
                ongoingActions: [{
                    uid: 'grave-1',
                    defId: 'frankenstein_grave_situation',
                    ownerId: '0',
                }],
            }],
        });

        const triggerMinion = core.bases[0].minions[0];
        const triggerResult = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: triggerMinion.uid,
            triggerMinionDefId: triggerMinion.defId,
            triggerMinion,
            random: defaultTestRandom,
            now: 123,
        });
        expect(triggerResult.events.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(true);
    });

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
    function triggerIgorDiscardAndChooseTarget(
        core: ReturnType<typeof makeState>,
        triggerMinionUid: string,
        triggerMinionDefId: string,
        targetMinionUid: string,
    ) {
        const result = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid,
            triggerMinionDefId,
            random: defaultTestRandom,
            now: 100,
        });
        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'frankenstein_igor');
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === targetMinionUid,
            `Igor counter target ${targetMinionUid}`,
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        return resolved.events;
    }

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

    it('Igor 自身被弃时可选择在其他基地己方唯一随从上放指示物', () => {
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

        const events = triggerIgorDiscardAndChooseTarget(core, 'igor1', 'frankenstein_igor', 't1');

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 't1', baseIndex: 1 }),
            }),
        );
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

        const events = triggerIgorDiscardAndChooseTarget(core, 'igor-pod-1', 'frankenstein_igor_pod', 't1');

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 't1',
                    baseIndex: 1,
                    reason: 'frankenstein_igor_pod',
                }),
            }),
        );
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

    it('frankenstein_igor 在宿主进入弃牌堆后仍会通过 queued discard trigger 给控制者创建目标选择交互', () => {
        const preDiscardCore = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('igor-left', 'frankenstein_igor', '0', 2, { owner: '1', powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('ally-a', 'test_a', '0', 3, { powerModifier: 0 }),
                        makeMinion('ally-b', 'test_b', '0', 4, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const queued = collectTriggers(preDiscardCore, 'onMinionDiscardedFromBase', {
            state: preDiscardCore,
            matchState: makeMatchState(preDiscardCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor-left',
            triggerMinionDefId: 'frankenstein_igor',
            triggerMinion: preDiscardCore.bases[0].minions[0],
            random: defaultTestRandom,
            now: 101,
        });

        expect(queued).toBeDefined();

        const postDiscardCore = makeState({
            players: preDiscardCore.players,
            turnOrder: preDiscardCore.turnOrder,
            currentPlayerIndex: preDiscardCore.currentPlayerIndex,
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('ally-a', 'test_a', '0', 3, { powerModifier: 0 }),
                        makeMinion('ally-b', 'test_b', '0', 4, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        postDiscardCore.triggerQueue = (queued as any).payload.triggers;
        const resolved = maybeResolveReactionQueue(makeMatchState(postDiscardCore), defaultTestRandom, 101);

        expect(resolved).toBeDefined();
        expect(resolved!.events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.TRIGGER_CONSUMED,
            }),
        );
        expect(resolved!.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
        const prompt = getSimpleChoicePrompt(resolved!.state, 'frankenstein_igor');
        expect(prompt.playerId).toBe('0');
        expect(getPromptSourceId(prompt)).toBe('frankenstein_igor');
        const optionUids = getPromptOptions(prompt).map(option => option.value?.minionUid);
        expect(optionUids).toEqual(expect.arrayContaining(['ally-a', 'ally-b']));
        expect(optionUids).not.toContain('igor-left');
    });

    it('borrowed frankenstein_igor 被消灭时，应按当前 controller 而不是真实 owner 给控制者创建 onDestroy 目标选择', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('igor-borrowed', 'frankenstein_igor', '0', 2, { owner: '1', powerModifier: 0 }),
                        makeMinion('ally-same-base', 'test_minion', '0', 3, { powerModifier: 0 }),
                        makeMinion('enemy-same-base', 'test_enemy', '1', 4, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-other-base', 'test_ally', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const result = resolveDestroyedMinions(
            makeMatchState(core),
            '0',
            [{
                minionUid: 'igor-borrowed',
                minionDefId: 'frankenstein_igor',
                fromBaseIndex: 0,
                ownerId: '1',
                destroyerId: '0',
            }],
            defaultTestRandom,
            100,
        );

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'frankenstein_igor');
        expect(prompt.playerId).toBe('0');
        const optionUids = getPromptOptions(prompt).map(option => option.value?.minionUid);
        expect(optionUids).toEqual(expect.arrayContaining(['ally-same-base', 'ally-other-base']));
        expect(optionUids).not.toContain('igor-borrowed');
        expect(optionUids).not.toContain('enemy-same-base');
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

        const events = triggerIgorDiscardAndChooseTarget(core, 'igor1', 'frankenstein_igor', 'ally1');

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 'ally1', baseIndex: 0 }),
            }),
        );
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
