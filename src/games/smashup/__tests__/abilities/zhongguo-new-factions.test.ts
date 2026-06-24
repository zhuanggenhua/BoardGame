import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { fireTriggers } from '../../domain/ongoingEffects';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOptions,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function attachBeforeScoringWindow(core: ReturnType<typeof makeState>, sourceBaseIndex = 0, activePlayerId = '0') {
    const matchState = startSmashUpReactionSession(makeMatchState(core), {
        frameId: `score-before:${sourceBaseIndex}:test`,
        frameKind: 'score-before',
        phase: 'optional',
        activePlayerId,
        currentPlayerId: activePlayerId,
        consecutivePasses: 0,
        sourceBaseIndex,
        responseWindowType: 'meFirst',
    });
    matchState.sys.phase = 'scoreBases';
    matchState.sys.responseWindow = { ...(matchState.sys.responseWindow ?? {}), current: undefined } as any;
    return matchState as any;
}

describe('zhongguo 三个后续派系首批能力实现', () => {
    it('谁爱你，小老弟？按己方战力 4 或更高随从数量抓牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('who-1', 'vigilantes_who_loves_ya_baby', 'action', '0')],
                        deck: [
                            makeCard('draw-1', 'test_action_a', 'action', '0'),
                            makeCard('draw-2', 'test_action_b', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('own-4', 'vigilantes_jacky_bill', '0', 4),
                        makeMinion('own-5', 'truckers_el_bandido', '0', 5),
                        makeMinion('own-low', 'truckers_good_buddy', '0', 2),
                        makeMinion('enemy-4', 'vigilantes_foxy_green', '1', 4),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'who-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const draw = played.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(draw?.payload.count).toBe(2);
    });

    it('一天的快乐会消灭有己方随从基地中战力 3 或更低随从并抓牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('make-1', 'vigilantes_make_my_day', 'action', '0')],
                        deck: [makeCard('draw-1', 'test_action_a', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('ally', 'truckers_good_buddy', '0', 2),
                        makeMinion('target', 'test_target', '1', 3),
                        makeMinion('too-big', 'test_big', '1', 4),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'make-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'vigilantes_make_my_day');
        expect(prompt).toBeDefined();
        expect(prompt.options.some(option => option.value?.minionUid === 'too-big')).toBe(false);

        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'target', '一天的快乐目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'target')).toBe(false);
    });

    it('猛龙怪客会在其他玩家消灭别人随从后反杀其一个随从，且每回合仅一次', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('death-wisher', 'vigilantes_death_wisher', '0', 4),
                    makeMinion('victim', 'truckers_good_buddy', '0', 2),
                    makeMinion('killer', 'truckers_el_bandido', '1', 5),
                ]),
                makeBase('base_b', [
                    makeMinion('wingman', 'truckers_rubber_chicken', '1', 4),
                ]),
            ],
        });

        const triggered = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'victim',
            triggerMinionDefId: 'truckers_good_buddy',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'victim'),
            controllerId: '0',
            destroyerId: '1',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 1000,
        });

        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'vigilantes_death_wisher');
        const resolved = respondToPrompt(
            triggered.matchState!,
            getPromptOption(prompt, option => option.value?.minionUid === 'wingman', '猛龙怪客反杀目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'wingman')).toBe(false);

        const secondTrigger = fireTriggers(resolved.finalState.core, 'onMinionDestroyed', {
            state: resolved.finalState.core,
            matchState: resolved.finalState,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'victim',
            triggerMinionDefId: 'truckers_good_buddy',
            controllerId: '0',
            destroyerId: '1',
            reason: 'test_destroy_again',
            random: defaultTestRandom,
            now: 1001,
        });
        expect(secondTrigger.events).toHaveLength(0);
    });

    it('复仇会在计分后且自己不是第一名时，把计分基地中的己方随从移到其他基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('save-me', 'vigilantes_shift', '0', 4),
                    makeMinion('winner', 'truckers_el_bandido', '1', 5),
                ]),
                makeBase('base_b', []),
            ],
            pendingAfterScoringSpecials: [{
                sourceDefId: 'vigilantes_the_revenge',
                playerId: '0',
                baseIndex: 0,
                cardUid: 'revenge-1',
            }],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'revenge-1',
            now: 1100,
            random: defaultTestRandom,
        });

        expect(triggered.events.some(event => event.type === SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED)).toBe(true);

        const chooseMinionPrompt = getSimpleChoicePrompt(triggered.matchState!, 'vigilantes_the_revenge');
        const chooseMinion = respondToPrompt(
            triggered.matchState!,
            getPromptOption(chooseMinionPrompt, option => option.value?.minionUid === 'save-me', '复仇移动目标').id,
            '0',
            defaultTestRandom,
        );

        const chooseBasePrompt = getSimpleChoicePrompt(chooseMinion.finalState, 'vigilantes_the_revenge_destination');
        const resolved = respondToPrompt(
            chooseMinion.finalState,
            getPromptOption(chooseBasePrompt, option => option.value?.baseIndex === 1, '复仇目标基地').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'save-me')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'save-me')).toBe(true);
    });

    it('神探布洛杰克会在其他随从移动后跟随到同一基地并获得 +1 临时战力', () => {
        const movedCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('brojak', 'vigilantes_brojak', '0', 4),
                ]),
                makeBase('base_b', []),
                makeBase('base_c', [
                    makeMinion('runner', 'truckers_good_buddy', '1', 2),
                ]),
            ],
        });

        const triggered = fireTriggers(movedCore, 'onMinionMoved', {
            state: movedCore,
            matchState: makeMatchState(movedCore),
            playerId: '1',
            baseIndex: 2,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 2,
            triggerMinionUid: 'runner',
            triggerMinionDefId: 'truckers_good_buddy',
            triggerMinion: movedCore.bases[2].minions.find(minion => minion.uid === 'runner'),
            random: defaultTestRandom,
            now: 1200,
        });

        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'vigilantes_brojak');
        const resolved = respondToPrompt(
            triggered.matchState!,
            getPromptOption(prompt, option => option.value?.skip === false, '神探布洛杰克跟随').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'brojak')).toBe(false);
        expect(resolved.finalState.core.bases[2].minions.find(minion => minion.uid === 'brojak')?.tempPowerModifier).toBe(1);
    });

    it('好伙伴在本基地有己方行动牌时抓 1 张牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('buddy-1', 'truckers_good_buddy', '0')],
                        deck: [makeCard('draw-1', 'test_action_a', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        ongoingActions: [{ uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' }],
                    }),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'buddy-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('短路点火可以把基地战术转移到另一个基地并获得控制权', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('hotwire-1', 'truckers_hotwire', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        ongoingActions: [{ uid: 'enemy-convoy', defId: 'truckers_convoy', ownerId: '1' }],
                    }),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'hotwire-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);

        const chooseActionPrompt = getSimpleChoicePrompt(played.finalState, 'truckers_hotwire_action');
        const chooseAction = respondToPrompt(
            played.finalState,
            getPromptOption(chooseActionPrompt, option => option.value?.actionUid === 'enemy-convoy', '短路点火目标战术').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseAction.success).toBe(true);

        const chooseModePrompt = getSimpleChoicePrompt(chooseAction.finalState, 'truckers_hotwire_mode');
        const chooseMode = respondToPrompt(
            chooseAction.finalState,
            getPromptOption(chooseModePrompt, option => option.value?.mode === 'transfer_and_control', '短路点火转移并控权').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseMode.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(chooseMode.finalState, 'truckers_hotwire_base');
        const resolved = respondToPrompt(
            chooseMode.finalState,
            getPromptOption(chooseBasePrompt, option => option.value?.baseIndex === 1, '短路点火目标基地').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.ONGOING_DETACHED
            && (event as any).payload?.cardUid === 'enemy-convoy',
        )).toBe(true);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.ONGOING_ATTACHED
            && (event as any).payload?.cardUid === 'enemy-convoy'
            && (event as any).payload?.targetBaseIndex === 1
            && (event as any).payload?.sourcePlayerId === '0',
        )).toBe(true);
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'enemy-convoy')).toBe(false);
        expect(resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'enemy-convoy')?.metadata).toEqual(
            expect.objectContaining({ sourceControllerId: '0' }),
        );
    });

    it('埃尔班迪多打出时可以获得基地战术控制权', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('bandido-1', 'truckers_el_bandido', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        ongoingActions: [{ uid: 'enemy-convoy', defId: 'truckers_convoy', ownerId: '1' }],
                    }),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'bandido-1', baseIndex: 1 },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'truckers_el_bandido_take_control');
        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.actionUid === 'enemy-convoy', '埃尔班迪多控权目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'enemy-convoy')?.metadata).toEqual(
            expect.objectContaining({ sourceControllerId: '0' }),
        );
    });

    it('埃尔班迪多天赋可转移基地战术到另一个基地', () => {
        const used = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [makeMinion('bandido', 'truckers_el_bandido', '0', 5)],
                        ongoingActions: [{ uid: 'enemy-convoy', defId: 'truckers_convoy', ownerId: '1' }],
                    }),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'bandido', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);

        const chooseModePrompt = getSimpleChoicePrompt(used.finalState, 'truckers_el_bandido_talent_mode');
        const chooseMode = respondToPrompt(
            used.finalState,
            getPromptOption(chooseModePrompt, option => option.value?.mode === 'transfer', '埃尔班迪多转移模式').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseMode.success).toBe(true);

        const chooseActionPrompt = getSimpleChoicePrompt(chooseMode.finalState, 'truckers_el_bandido_transfer_action');
        const chooseAction = respondToPrompt(
            chooseMode.finalState,
            getPromptOption(chooseActionPrompt, option => option.value?.actionUid === 'enemy-convoy', '埃尔班迪多转移目标').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseAction.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(chooseAction.finalState, 'truckers_el_bandido_transfer_base');
        const resolved = respondToPrompt(
            chooseAction.finalState,
            getPromptOption(chooseBasePrompt, option => option.value?.baseIndex === 1, '埃尔班迪多目标基地').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        const moved = resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'enemy-convoy');
        expect(moved).toEqual(expect.objectContaining({
            uid: 'enemy-convoy',
            defId: 'truckers_convoy',
            ownerId: '1',
        }));
        expect((moved as any)?.metadata?.sourceControllerId).toBeUndefined();
    });

    it('就在今晚会给所选随从 +2 临时战力并抓牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('getdown-1', 'disco_dancers_get_down_tonight', 'action', '0')],
                        deck: [makeCard('draw-1', 'test_action_a', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('target', 'disco_dancers_roller', '0', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'getdown-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(played.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.tempPowerModifier).toBe(2);
    });

    it('主唱会复制己方其他随从受到的普通战术影响', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('getdown-1', 'disco_dancers_get_down_tonight', 'action', '0')],
                        deck: [makeCard('draw-1', 'test_action_a', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('diva', 'disco_dancers_diva', '0', 3),
                        makeMinion('target', 'truckers_good_buddy', '0', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'getdown-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'disco_dancers_get_down_tonight');
        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'target', '就在今晚原目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'diva')?.tempPowerModifier).toBe(2);
    });

    it('我们是一家人会复制宿主同基地其他己方随从受到的普通战术影响', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('getdown-1', 'disco_dancers_get_down_tonight', 'action', '0')],
                        deck: [makeCard('draw-1', 'test_action_a', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('host', 'truckers_good_buddy', '0', 2, {
                            attachedActions: [{ uid: 'family-1', defId: 'disco_dancers_we_are_family', ownerId: '0' }],
                        }),
                        makeMinion('target', 'vigilantes_jacky_bill', '0', 4),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'getdown-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'disco_dancers_get_down_tonight');
        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'target', '就在今晚原目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.tempPowerModifier).toBe(2);
    });

    it('舞王会提示选择同基地另一个随从复制普通战术影响', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('getdown-1', 'disco_dancers_get_down_tonight', 'action', '0')],
                        deck: [makeCard('draw-1', 'test_action_a', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('king', 'disco_dancers_dancing_king', '0', 5),
                        makeMinion('target', 'truckers_good_buddy', '0', 2),
                        makeMinion('copy', 'vigilantes_jacky_bill', '1', 4),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'getdown-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const targetPrompt = getSimpleChoicePrompt(played.finalState, 'disco_dancers_get_down_tonight');
        const chooseTarget = respondToPrompt(
            played.finalState,
            getPromptOption(targetPrompt, option => option.value?.minionUid === 'target', '就在今晚原目标').id,
            '0',
            defaultTestRandom,
        );

        expect(chooseTarget.success).toBe(true);
        const prompt = getSimpleChoicePrompt(chooseTarget.finalState, 'disco_dancers_dancing_king');
        expect(prompt).toBeDefined();

        const resolved = respondToPrompt(
            chooseTarget.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'copy', '舞王复制目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'copy')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.tempPowerModifier).toBe(2);
    });

    it('我会活下去会在计分后把计分基地中的己方随从返回拥有者手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('save-me', 'disco_dancers_roller', '0', 2),
                    makeMinion('other', 'truckers_good_buddy', '1', 2),
                ]),
            ],
            pendingAfterScoringSpecials: [{
                sourceDefId: 'disco_dancers_i_will_survive',
                playerId: '0',
                baseIndex: 0,
                cardUid: 'survive-1',
            }],
        });
        const matchState = makeMatchState(core);
        const triggered = fireTriggers(core, 'afterScoring', {
            matchState,
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'survive-1',
            now: 1000,
            random: defaultTestRandom,
        });

        const prompt = getSimpleChoicePrompt(triggered.matchState ?? matchState, 'disco_dancers_i_will_survive');
        expect(prompt).toBeDefined();

        const resolved = respondToPrompt(
            triggered.matchState ?? matchState,
            getPromptOption(prompt, option => option.value?.minionUid === 'save-me', '我会活下去返回目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'save-me')).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'save-me')).toBe(false);
    });

    it('咬紧牙关会让宿主随从 +2 战力', () => {
        const state = makeState({
            bases: [
                makeBase('base_a', [
                    makeMinion('host', 'test_minion', '0', 3, {
                        attachedActions: [{ uid: 'tough-1', defId: 'vigilantes_tough_it_out', ownerId: '0' }],
                    }),
                ]),
            ],
        });

        expect(getEffectivePower(state, state.bases[0].minions[0], 0)).toBe(5);
    });

    it('橡皮鸡按本基地己方行动牌数量获得持续战力', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('rubber', 'truckers_rubber_chicken', '0', 4)],
                    ongoingActions: [
                        { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' },
                        { uid: 'armor-1', defId: 'truckers_armored_truck', ownerId: '0' },
                        { uid: 'enemy-1', defId: 'truckers_convoy', ownerId: '1' },
                    ],
                }),
            ],
        });

        expect(getEffectivePower(state, state.bases[0].minions[0], 0)).toBe(6);
    });

    it('车队按本基地己方行动牌数量提供基地力量', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('buddy', 'truckers_good_buddy', '0', 2)],
                    ongoingActions: [
                        { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' },
                        { uid: 'armor-1', defId: 'truckers_armored_truck', ownerId: '0' },
                        { uid: 'enemy-1', defId: 'truckers_convoy', ownerId: '1' },
                    ],
                }),
            ],
        });

        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '0')).toBe(4);
    });

    it('觉得运气不错？会在宿主控制者打出战术后消灭宿主', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('who-1', 'vigilantes_who_loves_ya_baby', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('host', 'test_minion', '0', 3, {
                            attachedActions: [{ uid: 'lucky-1', defId: 'vigilantes_feeling_lucky', ownerId: '1' }],
                        }),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'who-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(played.finalState.core.bases[0].minions.some(minion => minion.uid === 'host')).toBe(false);
    });

    it('高速追逐战天赋会转移自身、移动己方随从并给予 +3 战力', () => {
        const used = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [
                            makeMinion('ally', 'truckers_good_buddy', '0', 2),
                            makeMinion('enemy', 'test_enemy', '1', 3),
                        ],
                        ongoingActions: [{ uid: 'chase-1', defId: 'truckers_high_speed_chase', ownerId: '0', talentUsed: false } as any],
                    }),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'chase-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);

        const chooseMinionPrompt = getSimpleChoicePrompt(used.finalState, 'truckers_high_speed_chase_minion');
        const chooseMinion = respondToPrompt(
            used.finalState,
            getPromptOption(chooseMinionPrompt, option => option.value?.minionUid === 'ally', '高速追逐战目标随从').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseMinion.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(chooseMinion.finalState, 'truckers_high_speed_chase_base');
        const resolved = respondToPrompt(
            chooseMinion.finalState,
            getPromptOption(chooseBasePrompt, option => option.value?.baseIndex === 1, '高速追逐战目标基地').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && (event as any).payload?.minionUid === 'ally'
            && (event as any).payload?.amount === 3,
        )).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'ally')?.tempPowerModifier).toBe(3);
        expect(resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'chase-1')?.talentUsed).toBe(true);
    });

    it('暴走卡车天赋会转移自身并移动至多 3 个己方随从', () => {
        const used = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [
                            makeMinion('m1', 'truckers_good_buddy', '0', 2),
                            makeMinion('m2', 'truckers_rubber_chicken', '0', 4),
                            makeMinion('m3', 'test_friend', '0', 3),
                        ],
                        ongoingActions: [{ uid: 'deko-1', defId: 'truckers_dekotora', ownerId: '0', talentUsed: false } as any],
                    }),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'deko-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(used.finalState, 'truckers_dekotora_base');
        const chooseBase = respondToPrompt(
            used.finalState,
            getPromptOption(chooseBasePrompt, option => option.value?.baseIndex === 1, '暴走卡车目标基地').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseBase.success).toBe(true);

        const chooseMinionsPrompt = getSimpleChoicePrompt(chooseBase.finalState, 'truckers_dekotora_minions');
        const chooseMinions = getPromptOptions(chooseMinionsPrompt)
            .filter(option => option.value?.minionUid === 'm1' || option.value?.minionUid === 'm2')
            .map(option => option.id);
        const resolved = respondToPromptOptions(
            chooseBase.finalState,
            chooseMinions,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'deko-1')?.talentUsed).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'm1')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'm2')).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'm3')).toBe(true);
    });

    it('皮包骨米妮天赋会移动自己并转移同基地战术', () => {
        const used = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [makeMinion('minnie', 'truckers_skinny_minnie', '0', 3)],
                        ongoingActions: [{ uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' }],
                    }),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'minnie', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(used.finalState, 'truckers_skinny_minnie_base');
        const chooseBase = respondToPrompt(
            used.finalState,
            getPromptOption(chooseBasePrompt, option => option.value?.baseIndex === 1, '皮包骨米妮目标基地').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseBase.success).toBe(true);

        const chooseActionPrompt = getSimpleChoicePrompt(chooseBase.finalState, 'truckers_skinny_minnie_action');
        const resolved = respondToPrompt(
            chooseBase.finalState,
            getPromptOption(chooseActionPrompt, option => option.value?.actionUid === 'convoy-1', '皮包骨米妮目标战术').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'minnie')).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'convoy-1')).toBe(true);
    });

    it('车友聚会会按计分基地中你控制的战术数量给予目标随从临时战力', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('rally-1', 'truckers_rally', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        makeMinion('ally', 'truckers_good_buddy', '0', 2),
                        makeMinion('enemy', 'test_enemy', '1', 3),
                    ],
                    ongoingActions: [
                        { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' },
                        { uid: 'armor-1', defId: 'truckers_armored_truck', ownerId: '0' },
                        { uid: 'enemy-action', defId: 'truckers_convoy', ownerId: '1' },
                    ],
                }),
                makeBase('base_b', []),
            ],
        });

        const played = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'rally-1', targetBaseIndex: 0 },
        } as any, defaultTestRandom);

        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'truckers_rally');
        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'ally', '车友聚会目标随从').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally')?.tempPowerModifier).toBe(4);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('节拍一转会先让计分基地目标随从 +1，再让同基地一个随从 -1', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('beat-1', 'truckers_turn_the_beat_around', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_greasy_spoon', [
                    makeMinion('ally', 'truckers_good_buddy', '0', 2),
                    makeMinion('enemy', 'test_enemy', '1', 3),
                ]),
                makeBase('base_b', []),
            ],
        });

        const played = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'beat-1', targetBaseIndex: 0 },
        } as any, defaultTestRandom);

        expect(played.success).toBe(true);

        const boostPrompt = getSimpleChoicePrompt(played.finalState, 'truckers_turn_the_beat_around');
        const chooseBoost = respondToPrompt(
            played.finalState,
            getPromptOption(boostPrompt, option => option.value?.minionUid === 'ally', '节拍一转增益目标').id,
            '0',
            defaultTestRandom,
        );

        expect(chooseBoost.success).toBe(true);
        const penaltyPrompt = getSimpleChoicePrompt(chooseBoost.finalState, 'truckers_turn_the_beat_around_penalty');
        const resolved = respondToPrompt(
            chooseBoost.finalState,
            getPromptOption(penaltyPrompt, option => option.value?.minionUid === 'enemy', '节拍一转减益目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally')?.tempPowerModifier).toBe(1);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.tempPowerModifier).toBe(-1);
    });
});
