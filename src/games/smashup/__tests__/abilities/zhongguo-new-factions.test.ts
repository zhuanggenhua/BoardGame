import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SmashUpDomain } from '../../domain';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { reduce } from '../../domain/reduce';
import { SU_COMMANDS, SU_EVENTS, type SmashUpCommand, type SmashUpCore } from '../../domain/types';
import { smashUpSystemsForTest } from '../../game';
import { createInitialSystemState, executePipeline } from '../../../../engine/pipeline';
import type { MatchState } from '../../../../engine/types';
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
    triggerBaseAbilityWithMS,
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

    it('凶恶百倍会给目标随从 +3 临时战力', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('meaner-1', 'vigilantes_a_whole_lot_meaner', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('target', 'truckers_good_buddy', '1', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'meaner-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && (event as any).payload?.minionUid === 'target'
            && (event as any).payload?.amount === 3,
        )).toBe(true);
        expect(played.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.tempPowerModifier).toBe(3);
    });

    it('打到穿越会把目标随从洗回其拥有者牌库', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('knock-1', 'vigilantes_knocked_into_next_week', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        deck: [makeCard('deck-1', 'test_action_a', 'action', '1')],
                    }),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('target', 'truckers_good_buddy', '1', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'knock-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[0].minions.some(minion => minion.uid === 'target')).toBe(false);
        expect(played.finalState.core.players['1'].deck.some(card => card.uid === 'target')).toBe(true);
    });

    it('破萝飞龙打出时会找到牌库中的战术并抽到手牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('stoneford-1', 'vigilantes_stoneford', '0')],
                        deck: [
                            makeCard('deck-minion', 'truckers_good_buddy', 'minion', '0'),
                            makeCard('deck-action', 'vigilantes_who_loves_ya_baby', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase('base_a', [])],
            })),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'stoneford-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.DECK_REORDERED
            && (event as any).payload?.deckUids?.[0] === 'deck-action',
        )).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'deck-action')).toBe(true);
    });

    it('杰基比尔会在其他玩家打出战术后获得 +2 临时战力', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('jacky', 'vigilantes_jacky_bill', '0', 4),
                ]),
            ],
        });

        const triggered = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && (event as any).payload?.minionUid === 'jacky'
            && (event as any).payload?.amount === 2,
        )).toBe(true);
    });

    it('狐狸翠会在其他玩家影响本基地随从后获得 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('foxy', 'vigilantes_foxy_green', '0', 4),
                    makeMinion('target', 'truckers_good_buddy', '1', 2),
                ]),
            ],
        });

        const triggered = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'target',
            triggerMinionDefId: 'truckers_good_buddy',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'target'),
            random: defaultTestRandom,
            now: 1000,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.minionUid === 'foxy'
            && (event as any).payload?.amount === 1,
        )).toBe(true);
    });

    it('狐狸翠在 queued onMinionAffected 真链中也会按来源控制者结算 +1 指示物', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('foxy', 'vigilantes_foxy_green', '1', 4),
                    makeMinion('target', 'truckers_good_buddy', '0', 2),
                ]),
            ],
        });

        const matchState = makeMatchState(core, 'playCards', '0');
        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState,
            playerId: '0',
            baseIndex: 0,
            sourceCardUid: 'inferno-1',
            sourceDefId: 'disco_dancers_disco_inferno',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerMinionUid: 'target',
            triggerMinionDefId: 'truckers_good_buddy',
            triggerMinion: core.bases[0].minions[1],
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            affectEvent: {
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: {
                    minionUid: 'target',
                    baseIndex: 0,
                    amount: 1,
                    reason: 'disco_dancers_disco_inferno',
                    sourcePlayerId: '0',
                    sourceDefId: 'disco_dancers_disco_inferno',
                    sourceCardUid: 'inferno-1',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any,
            reason: 'disco_dancers_disco_inferno',
            random: defaultTestRandom,
            now: 1000,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'vigilantes_foxy_green',
            sourceCardUid: 'foxy',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            triggerMinionUid: 'target',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '0'),
            defaultTestRandom,
            1000,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'foxy',
                amount: 1,
                reason: 'vigilantes_foxy_green',
                sourceControllerId: '1',
            }),
        }));
    });

    it('街头正义会保护同基地己方随从不受其他玩家影响', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('protected', 'vigilantes_jacky_bill', '0', 4),
                        makeMinion('enemy', 'truckers_good_buddy', '1', 2),
                    ],
                    ongoingActions: [{ uid: 'justice-1', defId: 'vigilantes_street_justice', ownerId: '0' }],
                }),
            ],
        });

        const protectedMinion = state.bases[0].minions[0];
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '0', 'destroy')).toBe(false);
    });

    it('藏身处会保护本基地己方随从不受其他玩家影响', () => {
        const state = makeState({
            bases: [
                makeBase('base_hideout', [
                    makeMinion('protected', 'vigilantes_jacky_bill', '0', 4),
                    makeMinion('enemy', 'truckers_good_buddy', '1', 2),
                ]),
            ],
        });

        const protectedMinion = state.bases[0].minions[0];
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '0', 'destroy')).toBe(false);
    });

    it('不屑一顾天赋会压制所在基地能力', () => {
        const used = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_the_mean_streets',
                        ongoingActions: [{ uid: 'shrug-1', defId: 'vigilantes_shrug_it_off', ownerId: '0', talentUsed: false } as any],
                    }),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'shrug-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);
        expect(used.events.some(event =>
            event.type === SU_EVENTS.BASE_ABILITY_SUPPRESSED
            && (event as any).payload?.baseIndex === 0
            && (event as any).payload?.sourceDefId === 'vigilantes_shrug_it_off',
        )).toBe(true);
    });

    it('不屑一顾压制后，藏身处不应继续保护本基地己方随从', () => {
        const initial = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_hideout',
                    minions: [
                        makeMinion('protected', 'vigilantes_jacky_bill', '0', 4),
                        makeMinion('enemy', 'truckers_good_buddy', '1', 2),
                    ],
                    ongoingActions: [{ uid: 'shrug-1', defId: 'vigilantes_shrug_it_off', ownerId: '1', talentUsed: false } as any],
                }),
            ],
        }));

        const beforeSuppressed = initial.core.bases[0].minions[0];
        expect(isMinionProtected(initial.core, beforeSuppressed, 0, '1', 'action')).toBe(true);

        const used = runCommand(
            initial,
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '1',
                payload: { ongoingCardUid: 'shrug-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);
        const protectedAfterSuppressed = used.finalState.core.bases[0].minions[0];
        expect(isMinionProtected(used.finalState.core, protectedAfterSuppressed, 0, '1', 'action')).toBe(false);
        expect(isMinionProtected(used.finalState.core, protectedAfterSuppressed, 0, '1', 'destroy')).toBe(false);
        expect(isMinionProtected(used.finalState.core, protectedAfterSuppressed, 0, '1', 'move')).toBe(false);
    });

    it('直面恐惧会移动有己方随从基地中的其他玩家随从并给予额外战术', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('scared-1', 'vigilantes_scared_straight', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('own', 'vigilantes_jacky_bill', '0', 4),
                        makeMinion('target', 'truckers_good_buddy', '1', 2),
                    ]),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'scared-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const chooseMinionPrompt = getSimpleChoicePrompt(played.finalState, 'vigilantes_scared_straight');
        const chooseMinion = respondToPrompt(
            played.finalState,
            getPromptOption(chooseMinionPrompt, option => option.value?.minionUid === 'target', '直面恐惧目标').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseMinion.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(chooseMinion.finalState, 'vigilantes_scared_straight_destination');
        const resolved = respondToPrompt(
            chooseMinion.finalState,
            getPromptOption(chooseBasePrompt, option => option.value?.baseIndex === 1, '直面恐惧目标基地').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'target')).toBe(true);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'action'
            && (event as any).payload?.delta === 1,
        )).toBe(true);
    });

    it('铁杆神探会把弃牌堆至多 2 个随从放到牌库顶并移出弃牌堆', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('shift-1', 'vigilantes_shift', '0')],
                        deck: [makeCard('deck-1', 'test_action_a', 'action', '0')],
                        discard: [
                            makeCard('discard-minion-a', 'truckers_good_buddy', 'minion', '0'),
                            makeCard('discard-minion-b', 'disco_dancers_roller', 'minion', '0'),
                            makeCard('discard-action', 'vigilantes_who_loves_ya_baby', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase('base_a', [])],
            })),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'shift-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.finalState.core.players['0'].deck.slice(0, 2).map(card => card.uid)).toEqual([
            'discard-minion-a',
            'discard-minion-b',
        ]);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'discard-minion-a')).toBe(false);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'discard-minion-b')).toBe(false);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'discard-action')).toBe(true);
    });

    it('瞌睡的亨利会把本基地一个随从洗回牌库', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('henry-1', 'vigilantes_dusty_henry', '0')],
                    }),
                    '1': makePlayer('1', {
                        deck: [makeCard('deck-1', 'test_action_a', 'action', '1')],
                    }),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('target', 'truckers_good_buddy', '1', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'henry-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'vigilantes_dusty_henry');
        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'target', '瞌睡的亨利目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'target')).toBe(false);
        expect(resolved.finalState.core.players['1'].deck.some(card => card.uid === 'target')).toBe(true);
    });

    it('做个了断吧会在控制者回合开始时把有双方随从的基地临界点降为 0', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_mean_streets',
                    minions: [
                        makeMinion('own', 'vigilantes_jacky_bill', '0', 4),
                        makeMinion('enemy', 'truckers_good_buddy', '1', 2),
                    ],
                    ongoingActions: [{ uid: 'finish-1', defId: 'vigilantes_lets_finish_this', ownerId: '0' }],
                }),
            ],
        });

        const triggered = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            sourceCardUid: 'finish-1',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.BREAKPOINT_MODIFIED
            && (event as any).payload?.baseIndex === 0
            && (event as any).payload?.delta === -25,
        )).toBe(true);
    });

    it('做个了断吧在真实 onTurnStart 队列消费时，仍应按所在基地把临界点降为 0', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_mean_streets',
                    minions: [
                        makeMinion('own', 'vigilantes_jacky_bill', '0', 4),
                        makeMinion('enemy', 'truckers_good_buddy', '1', 2),
                    ],
                    ongoingActions: [{ uid: 'finish-1', defId: 'vigilantes_lets_finish_this', ownerId: '0' }],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        expect(queued?.type).toBe(SU_EVENTS.TRIGGER_QUEUED);

        const queuedCore = reduce(core, queued as any);
        const resolved = maybeResolveReactionQueue(makeMatchState(queuedCore, 'startTurn', '0'), defaultTestRandom, 1001);

        expect(resolved).toBeDefined();
        expect(resolved!.events.some(event =>
            event.type === SU_EVENTS.BREAKPOINT_MODIFIED
            && (event as any).payload?.baseIndex === 0
            && (event as any).payload?.delta === -25,
        )).toBe(true);
        expect(resolved!.state.core.tempBreakpointModifiers?.[0]).toBe(-25);
    });

    it('时髦镇会在影响本基地随从的战术后给该随从 +1 指示物', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_funky_town', [
                    makeMinion('target', 'truckers_good_buddy', '0', 2),
                ]),
            ],
        });

        const result = triggerBaseAbilityWithMS('base_funky_town', 'onActionPlayed', {
            state,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_funky_town',
            actionTargetBaseIndex: 0,
            actionTargetType: 'minion',
            actionTargetMinionUid: 'target',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.minionUid === 'target'
            && (event as any).payload?.amount === 1,
        )).toBe(true);
    });

    it('时髦镇在真实后处理顺序里，战术真正影响这里的随从后仍应再补 1 枚指示物', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_funky_town', [
                    makeMinion('target', 'truckers_good_buddy', '0', 2),
                ]),
            ],
        });

        const processed = SmashUpDomain.postProcessSystemEvents(
            core,
            [{
                type: SU_EVENTS.ACTION_PLAYED,
                payload: {
                    playerId: '0',
                    cardUid: 'inferno-1',
                    defId: 'disco_dancers_disco_inferno',
                    ownerId: '0',
                },
                timestamp: 1000,
            } as any, {
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: {
                    minionUid: 'target',
                    baseIndex: 0,
                    amount: 1,
                    reason: 'disco_dancers_disco_inferno',
                    sourcePlayerId: '0',
                    sourceCardUid: 'inferno-1',
                    sourceDefId: 'disco_dancers_disco_inferno',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any],
            defaultTestRandom,
            makeMatchState(core),
        );

        expect(processed.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.minionUid === 'target'
            && (event as any).payload?.reason === 'base_funky_town',
        )).toBe(true);
        expect(processed.matchState!.core.bases[0].minions.find(minion => minion.uid === 'target')?.powerCounters).toBe(2);
    });

    it('廉价小饭馆会在计分后让每位在这里有随从的玩家抓 1 张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('draw-0', 'test_action_a', 'action', '0')] }),
                '1': makePlayer('1', { deck: [makeCard('draw-1', 'test_action_b', 'action', '1')] }),
            },
            bases: [
                makeBase('base_the_greasy_spoon', [
                    makeMinion('a', 'truckers_good_buddy', '0', 2),
                    makeMinion('b', 'vigilantes_jacky_bill', '1', 4),
                ]),
            ],
        });

        const result = triggerBaseAbilityWithMS('base_the_greasy_spoon', 'afterScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_the_greasy_spoon',
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(2);
    });

    it('廉价小饭馆会在真实计分命令链后让在场双方各抓 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-0', 'truckers_fixin_to_fix_it', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('draw-1', 'disco_dancers_get_down_tonight', 'action', '1')],
                }),
            },
            bases: [
                makeBase('base_the_greasy_spoon', [
                    makeMinion('greasy-p0', 'truckers_good_buddy', '0', 18),
                    makeMinion('greasy-p1', 'disco_dancers_diva', '1', 8),
                ]),
                makeBase('base_central_brain', []),
            ],
            baseDeck: ['base_the_factory'],
        });
        core.currentPlayerIndex = 0;

        const sys = createInitialSystemState(['0', '1'], smashUpSystemsForTest, undefined);
        sys.phase = 'playCards';
        const state: MatchState<SmashUpCore> = { core, sys };

        const advance = executePipeline(
            { domain: SmashUpDomain, systems: smashUpSystemsForTest },
            state,
            { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 } as unknown as SmashUpCommand,
            defaultTestRandom,
            ['0', '1'],
        );
        expect(advance.success).toBe(true);

        const finalState = advance.state.core;
        expect(finalState.players['0'].hand.some(card => card.uid === 'draw-0')).toBe(true);
        expect(finalState.players['1'].hand.some(card => card.uid === 'draw-1')).toBe(true);
        expect(finalState.players['0'].deck.some(card => card.uid === 'draw-0')).toBe(false);
        expect(finalState.players['1'].deck.some(card => card.uid === 'draw-1')).toBe(false);
    });

    it('卡车服务站会在计分后把这里的随从移到另一个基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_truck_stop', [
                    makeMinion('a', 'truckers_good_buddy', '0', 2),
                    makeMinion('b', 'disco_dancers_roller', '1', 2),
                ]),
                makeBase('base_a', []),
            ],
        });

        const result = triggerBaseAbilityWithMS('base_truck_stop', 'afterScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_truck_stop',
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(true);
    });

    it('摇摆仙境会在回合开始时给予 2 力量或更低随从额外随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-1', 'truckers_good_buddy', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_boogie_wonderland', [])],
        });

        const result = triggerBaseAbilityWithMS('base_boogie_wonderland', 'onTurnStart', {
            state,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_boogie_wonderland',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'minion'
            && (event as any).payload?.delta === 1
            && (event as any).payload?.restrictToBase === 0
            && (event as any).payload?.powerMax === 2,
        )).toBe(true);
    });

    it('险恶街区会在战术影响这里时让其他玩家的随从获得 +1 指示物', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_mean_streets', [
                    makeMinion('enemy', 'truckers_good_buddy', '1', 2),
                ]),
            ],
        });

        const result = triggerBaseAbilityWithMS('base_the_mean_streets', 'onActionPlayed', {
            state,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_the_mean_streets',
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.minionUid === 'enemy'
            && (event as any).payload?.amount === 1,
        )).toBe(true);
    });

    it('险恶街区在真实后处理顺序里，战术真正影响这里的敌方随从后仍应再补 1 枚指示物', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_mean_streets', [
                    makeMinion('enemy', 'truckers_good_buddy', '1', 2),
                ]),
            ],
        });

        const processed = SmashUpDomain.postProcessSystemEvents(
            core,
            [{
                type: SU_EVENTS.ACTION_PLAYED,
                payload: {
                    playerId: '0',
                    cardUid: 'inferno-1',
                    defId: 'disco_dancers_disco_inferno',
                    ownerId: '0',
                },
                timestamp: 1000,
            } as any, {
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: {
                    minionUid: 'enemy',
                    baseIndex: 0,
                    amount: 1,
                    reason: 'disco_dancers_disco_inferno',
                    sourcePlayerId: '0',
                    sourceCardUid: 'inferno-1',
                    sourceDefId: 'disco_dancers_disco_inferno',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any],
            defaultTestRandom,
            makeMatchState(core),
        );

        expect(processed.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.minionUid === 'enemy'
            && (event as any).payload?.reason === 'base_the_mean_streets',
        )).toBe(true);
        expect(processed.matchState!.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.powerCounters).toBe(2);
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

    it('迪斯科·卢会把弃牌堆中的战术放到牌库顶', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('lou-1', 'disco_dancers_ul_disco_lou', '0')],
                        deck: [makeCard('deck-1', 'test_action_a', 'action', '0')],
                        discard: [makeCard('discard-action', 'disco_dancers_celebration', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase('base_a', [])],
            })),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'lou-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.CARD_TO_DECK_TOP
            && (event as any).payload?.cardUid === 'discard-action',
        )).toBe(true);
        expect(played.finalState.core.players['0'].deck[0]?.uid).toBe('discard-action');
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'discard-action')).toBe(false);
    });

    it('迪斯科地狱会给目标随从 +1 指示物并抓牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('inferno-1', 'disco_dancers_disco_inferno', 'action', '0')],
                        deck: [makeCard('draw-1', 'test_action_a', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('target', 'truckers_good_buddy', '0', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'inferno-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'disco_dancers_disco_inferno');
        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'target', '迪斯科地狱目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.powerCounters).toBe(1);
    });

    it('庆祝会给予两次额外战术额度', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('celebration-1', 'disco_dancers_celebration', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'celebration-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.filter(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'action'
            && (event as any).payload?.delta === 1,
        )).toHaveLength(2);
    });

    it('男人雨会给予一次额外随从额度', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('rain-1', 'disco_dancers_its_raining_men', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'rain-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'minion'
            && (event as any).payload?.delta === 1,
        )).toBe(true);
    });

    it('我很亢奋会移动己方随从到其他基地并抓牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('excited-1', 'disco_dancers_im_so_excited', 'action', '0')],
                        deck: [makeCard('draw-1', 'test_action_a', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('mover', 'disco_dancers_roller', '0', 2),
                    ]),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'excited-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const chooseMinionPrompt = getSimpleChoicePrompt(played.finalState, 'disco_dancers_im_so_excited');
        const chooseMinion = respondToPrompt(
            played.finalState,
            getPromptOption(chooseMinionPrompt, option => option.value?.minionUid === 'mover', '我很亢奋移动目标').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseMinion.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(chooseMinion.finalState, 'disco_dancers_im_so_excited_destination');
        const resolved = respondToPrompt(
            chooseMinion.finalState,
            getPromptOption(chooseBasePrompt, option => option.value?.baseIndex === 1, '我很亢奋目标基地').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'mover')).toBe(true);
    });

    it('最后的舞曲会消灭自己的随从并获得 1 VP', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('last-dance-1', 'disco_dancers_last_dance', 'action', '0')],
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
                payload: { cardUid: 'last-dance-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'disco_dancers_last_dance');
        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'target', '最后的舞曲目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.VP_AWARDED
            && (event as any).payload?.playerId === '0'
            && (event as any).payload?.amount === 1,
        )).toBe(true);
        expect(resolved.finalState.core.players['0'].vp).toBe(1);
    });

    it('活着会把弃牌堆中与己方场上同名的随从回手', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('stayin-1', 'disco_dancers_stayin_alive', 'action', '0')],
                        discard: [
                            makeCard('discard-roller', 'disco_dancers_roller', 'minion', '0'),
                            makeCard('discard-other', 'truckers_good_buddy', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('roller-in-play', 'disco_dancers_roller', '0', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'stayin-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD
            && (event as any).payload?.cardUids?.includes('discard-roller'),
        )).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'discard-roller')).toBe(true);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'discard-other')).toBe(true);
    });

    it('轮滑舞娘被影响时若没有 +1 指示物，会给自己加 1 枚', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('roller', 'disco_dancers_roller', '0', 2),
                ]),
            ],
        });

        const triggered = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'roller',
            triggerMinionDefId: 'disco_dancers_roller',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'roller'),
            random: defaultTestRandom,
            now: 1000,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.minionUid === 'roller'
            && (event as any).payload?.amount === 1,
        )).toBe(true);
    });

    it('轮滑舞娘在真实后处理顺序里，被迪斯科地狱放置第 1 枚指示物后仍应再补 1 枚', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_boogie_wonderland', [
                    makeMinion('roller', 'disco_dancers_roller', '0', 2),
                ]),
            ],
        });

        const processed = SmashUpDomain.postProcessSystemEvents(
            core,
            [{
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: {
                    minionUid: 'roller',
                    baseIndex: 0,
                    amount: 1,
                    reason: 'disco_dancers_disco_inferno',
                    sourcePlayerId: '0',
                    sourceDefId: 'disco_dancers_disco_inferno',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any],
            defaultTestRandom,
            makeMatchState(core),
        );

        expect(processed.events.some(event =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
            && (event as any).payload?.triggers?.some((trigger: any) =>
                trigger.sourceDefId === 'disco_dancers_roller'
                && trigger.sourceCardUid === 'roller'
                && trigger.triggerMinionUid === 'roller',
            ),
        )).toBe(true);

        expect(processed.events.some(event =>
            event.type === SU_EVENTS.TRIGGER_CONSUMED
        )).toBe(true);
        expect(processed.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.minionUid === 'roller'
            && (event as any).payload?.reason === 'disco_dancers_roller',
        )).toBe(true);
        expect(processed.matchState!.core.bases[0].minions.find(minion => minion.uid === 'roller')?.powerCounters).toBe(2);
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

    it('修理会把弃牌堆中的战术回收到手牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('fix-1', 'truckers_fixin_to_fix_it', 'action', '0')],
                        discard: [
                            makeCard('discard-action', 'truckers_convoy', 'action', '0'),
                            makeCard('discard-minion', 'truckers_good_buddy', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'fix-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD
            && (event as any).payload?.cardUids?.includes('discard-action'),
        )).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'discard-action')).toBe(true);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'discard-action')).toBe(false);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'discard-minion')).toBe(true);
    });

    it('装甲卡车会保护同基地己方随从不受消灭和移动影响', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('protected', 'truckers_good_buddy', '0', 2),
                        makeMinion('enemy', 'truckers_el_bandido', '1', 5),
                    ],
                    ongoingActions: [
                        { uid: 'armor-1', defId: 'truckers_armored_truck', ownerId: '0' },
                    ],
                }),
            ],
        });

        const protectedMinion = state.bases[0].minions[0];
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'affect')).toBe(false);
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
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'minnie')).toBe(false);
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'convoy-1')).toBe(false);

        const movedMinnie = resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'minnie');
        expect(movedMinnie).toEqual(expect.objectContaining({
            uid: 'minnie',
            defId: 'truckers_skinny_minnie',
            talentUsed: true,
        }));

        const movedConvoy = resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'convoy-1');
        expect(movedConvoy).toEqual(expect.objectContaining({
            uid: 'convoy-1',
            defId: 'truckers_convoy',
            ownerId: '0',
        }));
        expect((movedConvoy as any)?.metadata?.sourceControllerId).toBeUndefined();
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
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'ally', amount: 4 }),
            }),
        ]));
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && (event as any).payload?.minionUid === 'enemy',
        )).toBe(false);
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
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'ally', amount: 1 }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'enemy', amount: -1 }),
            }),
        ]));
    });

    it('快如闪电会给予目标 +2 战力并在本回合被消灭时改回手牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('fast-1', 'kung_fu_fighters_fast_as_lightning', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('lady', 'kung_fu_fighters_lady_whirlwind', '0', 4),
                        makeMinion('target', 'test_target', '1', 1),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'fast-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const fastPrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_fast_as_lightning');
        const applied = respondToPrompt(
            played.finalState,
            getPromptOption(fastPrompt, option => option.value?.minionUid === 'target', '快如闪电目标').id,
            '0',
            defaultTestRandom,
        );

        expect(applied.success).toBe(true);
        expect(applied.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.tempPowerModifier).toBe(2);

        const usedTalent = runCommand(applied.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'lady', baseIndex: 0 },
        }, defaultTestRandom);

        expect(usedTalent.success).toBe(true);
        expect(usedTalent.finalState.core.bases[0].minions.some(minion => minion.uid === 'target')).toBe(false);
        expect(usedTalent.finalState.core.players['1'].hand.some(card => card.uid === 'target')).toBe(true);
        expect(usedTalent.events.some(event =>
            event.type === SU_EVENTS.MINION_RETURNED
            && (event as any).payload?.minionUid === 'target',
        )).toBe(true);
    });

    it('快如闪电会在目标因基地计分清场进入弃牌堆时改回手牌', () => {
        const played = runCommand(
            makeMatchState(makeState({
                turnNumber: 3,
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('fast-1', 'kung_fu_fighters_fast_as_lightning', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('target', 'test_target', '1', 1),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'fast-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const fastPrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_fast_as_lightning');
        const applied = respondToPrompt(
            played.finalState,
            getPromptOption(fastPrompt, option => option.value?.minionUid === 'target', '快如闪电清场目标').id,
            '0',
            defaultTestRandom,
        );

        expect(applied.success).toBe(true);

        const target = applied.finalState.core.bases[0].minions.find(minion => minion.uid === 'target');
        const triggered = fireTriggers(applied.finalState.core, 'onMinionDiscardedFromBase', {
            state: applied.finalState.core,
            matchState: makeMatchState(applied.finalState.core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'target',
            triggerMinionDefId: 'test_target',
            triggerMinion: target,
            random: defaultTestRandom,
            now: 3000,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.MINION_RETURNED
            && (event as any).payload?.minionUid === 'target'
            && (event as any).payload?.toPlayerId === '1',
        )).toBe(true);
        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.MINION_MOVED
            && (event as any).payload?.toZone === 'discard',
        )).toBe(false);
    });

    it('人人都是功夫高手会让所选基地每位有随从的玩家各消灭另一位玩家的随从', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('everybody-1', 'kung_fu_fighters_everybody_was_kung_fu_fighting', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('ally', 'kung_fu_fighters_cricket', '0', 2),
                        makeMinion('enemy', 'test_enemy', '1', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'everybody-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_everybody_was_kung_fu_fighting_base');
        const chooseBase = respondToPrompt(
            played.finalState,
            getPromptOption(basePrompt, option => option.value?.baseIndex === 0, '人人都是功夫高手目标基地').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseBase.success).toBe(true);

        const p0Prompt = getSimpleChoicePrompt(chooseBase.finalState, 'kung_fu_fighters_everybody_was_kung_fu_fighting_target');
        const p0Choice = respondToPrompt(
            chooseBase.finalState,
            getPromptOption(p0Prompt, option => option.value?.minionUid === 'enemy', '玩家0消灭目标').id,
            '0',
            defaultTestRandom,
        );
        expect(p0Choice.success).toBe(true);

        const p1Prompt = getSimpleChoicePrompt(p0Choice.finalState, 'kung_fu_fighters_everybody_was_kung_fu_fighting_target');
        const resolved = respondToPrompt(
            p0Choice.finalState,
            getPromptOption(p1Prompt, option => option.value?.minionUid === 'ally', '玩家1消灭目标').id,
            '1',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'ally')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy')).toBe(false);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(2);
    });

    it('掌握时机会在计分前打出并同时转移全部 +1 标记与授予额外天赋', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('expert-1', 'kung_fu_fighters_expert_timing', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_greasy_spoon', [
                    makeMinion('dragon', 'kung_fu_fighters_dragon_warrior', '0', 5, { talentUsed: true }),
                    makeMinion('source', 'test_source', '1', 2, { powerCounters: 3 }),
                    makeMinion('receiver', 'kung_fu_fighters_cricket', '0', 2, { powerCounters: 0 }),
                ]),
            ],
        });

        const played = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'expert-1' },
        } as any, defaultTestRandom);

        expect(played.success).toBe(true);
        const modePrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_expert_timing_mode');
        const chooseMode = respondToPrompt(
            played.finalState,
            getPromptOption(modePrompt, option => option.value?.mode === 'both', '掌握时机两者都做').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseMode.success).toBe(true);

        const talentPrompt = getSimpleChoicePrompt(chooseMode.finalState, 'kung_fu_fighters_expert_timing_talent');
        const chooseTalent = respondToPrompt(
            chooseMode.finalState,
            getPromptOption(talentPrompt, option => option.value?.minionUid === 'dragon', '掌握时机额外天赋目标').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseTalent.success).toBe(true);

        const sourcePrompt = getSimpleChoicePrompt(chooseTalent.finalState, 'kung_fu_fighters_expert_timing_source');
        const chooseSource = respondToPrompt(
            chooseTalent.finalState,
            getPromptOption(sourcePrompt, option => option.value?.minionUid === 'source', '掌握时机标记来源').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseSource.success).toBe(true);

        const targetPrompt = getSimpleChoicePrompt(chooseSource.finalState, 'kung_fu_fighters_expert_timing_target');
        const resolved = respondToPrompt(
            chooseSource.finalState,
            getPromptOption(targetPrompt, option => option.value?.minionUid === 'receiver', '掌握时机标记接收者').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'source')?.powerCounters).toBe(0);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'receiver')?.powerCounters).toBe(3);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: expect.objectContaining({
                    minionUid: 'dragon',
                    metadataUpdate: expect.objectContaining({
                        mythicHorsesSeastarExtraTalent: true,
                        mythicHorsesSeastarExtraTalentConsumed: false,
                    }),
                }),
            }),
        ]));
    });

    it('掌握时机只做额外天赋时会直接授予己方有天赋随从一次额外使用', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('expert-1', 'kung_fu_fighters_expert_timing', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_greasy_spoon', [
                    makeMinion('dragon', 'kung_fu_fighters_dragon_warrior', '0', 5, { talentUsed: true }),
                    makeMinion('ally', 'truckers_good_buddy', '0', 2),
                ]),
            ],
        });

        const played = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'expert-1' },
        } as any, defaultTestRandom);

        expect(played.success).toBe(true);
        const modePrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_expert_timing_mode');
        expect(modePrompt.options.some(option => option.value?.mode === 'transfer')).toBe(false);

        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(modePrompt, option => option.value?.mode === 'talent', '掌握时机只做额外天赋').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(getSimpleChoicePrompt(resolved.finalState, 'kung_fu_fighters_expert_timing_talent')).toBeDefined();

        const chooseTalent = respondToPrompt(
            resolved.finalState,
            getPromptOption(
                getSimpleChoicePrompt(resolved.finalState, 'kung_fu_fighters_expert_timing_talent'),
                option => option.value?.minionUid === 'dragon',
                '掌握时机额外天赋目标',
            ).id,
            '0',
            defaultTestRandom,
        );

        expect(chooseTalent.success).toBe(true);
        expect(chooseTalent.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: expect.objectContaining({
                    minionUid: 'dragon',
                    metadataUpdate: expect.objectContaining({
                        mythicHorsesSeastarExtraTalent: true,
                        mythicHorsesSeastarExtraTalentConsumed: false,
                    }),
                }),
            }),
        ]));
        expect(chooseTalent.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally')?.metadata).toBeUndefined();
    });

    it('掌握时机会把基地持续战术上的全部 +1 标记转移到另一个随从', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('expert-1', 'kung_fu_fighters_expert_timing', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        makeMinion('receiver', 'kung_fu_fighters_cricket', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [
                        {
                            uid: 'art-1',
                            defId: 'kung_fu_fighters_ancient_chinese_art',
                            ownerId: '0',
                            talentUsed: false,
                            metadata: { powerCounters: 2 },
                        } as any,
                    ],
                }),
            ],
        });

        const played = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'expert-1' },
        } as any, defaultTestRandom);

        expect(played.success).toBe(true);
        const modePrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_expert_timing_mode');
        expect(modePrompt.options.some(option => option.value?.mode === 'talent')).toBe(true);

        const chooseMode = respondToPrompt(
            played.finalState,
            getPromptOption(modePrompt, option => option.value?.mode === 'transfer', '掌握时机只转移标记').id,
            '0',
            defaultTestRandom,
        );

        expect(chooseMode.success).toBe(true);
        const sourcePrompt = getSimpleChoicePrompt(chooseMode.finalState, 'kung_fu_fighters_expert_timing_source');
        const chooseSource = respondToPrompt(
            chooseMode.finalState,
            getPromptOption(sourcePrompt, option => option.value?.actionUid === 'art-1', '掌握时机标记来源牌').id,
            '0',
            defaultTestRandom,
        );

        expect(chooseSource.success).toBe(true);
        const targetPrompt = getSimpleChoicePrompt(chooseSource.finalState, 'kung_fu_fighters_expert_timing_target');
        const resolved = respondToPrompt(
            chooseSource.finalState,
            getPromptOption(targetPrompt, option => option.value?.minionUid === 'receiver', '掌握时机标记接收者').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect((resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'art-1') as any)?.metadata?.powerCounters).toBe(0);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'receiver')?.powerCounters).toBe(2);
    });

    it('掌握时机会把随从上的全部 +1 标记转移到基地持续战术上', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('expert-1', 'kung_fu_fighters_expert_timing', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        makeMinion('source', 'kung_fu_fighters_dragon_warrior', '0', 5, { powerCounters: 3 }),
                    ],
                    ongoingActions: [
                        {
                            uid: 'art-1',
                            defId: 'kung_fu_fighters_ancient_chinese_art',
                            ownerId: '0',
                            talentUsed: false,
                            metadata: { powerCounters: 0 },
                        } as any,
                    ],
                }),
            ],
        });

        const played = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'expert-1' },
        } as any, defaultTestRandom);

        expect(played.success).toBe(true);
        const chooseMode = respondToPrompt(
            played.finalState,
            getPromptOption(
                getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_expert_timing_mode'),
                option => option.value?.mode === 'transfer',
                '掌握时机只转移标记到基地持续牌',
            ).id,
            '0',
            defaultTestRandom,
        );

        expect(chooseMode.success).toBe(true);
        const chooseSource = respondToPrompt(
            chooseMode.finalState,
            getPromptOption(
                getSimpleChoicePrompt(chooseMode.finalState, 'kung_fu_fighters_expert_timing_source'),
                option => option.value?.minionUid === 'source',
                '掌握时机随从标记来源',
            ).id,
            '0',
            defaultTestRandom,
        );

        expect(chooseSource.success).toBe(true);
        const resolved = respondToPrompt(
            chooseSource.finalState,
            getPromptOption(
                getSimpleChoicePrompt(chooseSource.finalState, 'kung_fu_fighters_expert_timing_target'),
                option => option.value?.actionUid === 'art-1',
                '掌握时机基地持续牌接收者',
            ).id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'source')?.powerCounters).toBe(0);
        expect((resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'art-1') as any)?.metadata?.powerCounters).toBe(3);
    });

    it('平头彼特天赋会转移自身并移动同基地另一张己方基地战术', () => {
        const used = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [makeMinion('ally', 'truckers_good_buddy', '0', 2)],
                        ongoingActions: [
                            { uid: 'pete-1', defId: 'truckers_cab_over_pete', ownerId: '0', talentUsed: false } as any,
                            { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0', talentUsed: false } as any,
                        ],
                    }),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'pete-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);
        const basePrompt = getSimpleChoicePrompt(used.finalState, 'truckers_cab_over_pete_base');
        const chooseBase = respondToPrompt(
            used.finalState,
            getPromptOption(basePrompt, option => option.value?.baseIndex === 1, '平头彼特目标基地').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseBase.success).toBe(true);

        const cardPrompt = getSimpleChoicePrompt(chooseBase.finalState, 'truckers_cab_over_pete_card');
        const resolved = respondToPrompt(
            chooseBase.finalState,
            getPromptOption(cardPrompt, option => option.value?.actionUid === 'convoy-1', '平头彼特移动战术').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'pete-1')?.talentUsed).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'convoy-1')).toBe(true);
        expect(resolved.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'pete-1' || action.uid === 'convoy-1')).toBe(false);
    });

    it('平头彼特天赋也可以转移自身并移动同基地另一张己方随从', () => {
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
                        ongoingActions: [
                            { uid: 'pete-1', defId: 'truckers_cab_over_pete', ownerId: '0', talentUsed: false } as any,
                        ],
                    }),
                    makeBase('base_b', []),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'pete-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);
        const basePrompt = getSimpleChoicePrompt(used.finalState, 'truckers_cab_over_pete_base');
        const chooseBase = respondToPrompt(
            used.finalState,
            getPromptOption(basePrompt, option => option.value?.baseIndex === 1, '平头彼特目标基地').id,
            '0',
            defaultTestRandom,
        );

        expect(chooseBase.success).toBe(true);
        const cardPrompt = getSimpleChoicePrompt(chooseBase.finalState, 'truckers_cab_over_pete_card');
        const resolved = respondToPrompt(
            chooseBase.finalState,
            getPromptOption(cardPrompt, option => option.value?.minionUid === 'ally', '平头彼特移动随从').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'pete-1')?.talentUsed).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'ally')).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'ally')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy')).toBe(true);
    });
});
