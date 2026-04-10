/**
 * afterScoring 延迟清场 / 替换相关回归测试
 *
 * 覆盖两类问题：
 * - 交互链结束后，BASE_CLEARED / BASE_REPLACED 仍需被补发
 * - 像温室 / 托尔图加这类“作用于替换后基地”的效果，必须在补发后再落地
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { createInitialSystemState } from '../../../engine/pipeline';
import { createFlowSystem, createBaseSystems } from '../../../engine/systems';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { createSmashUpEventSystem } from '../domain/systems';
import { smashUpFlowHooks } from '../domain/index';
import { reduce } from '../domain/reduce';
import type { SmashUpCore, SmashUpEvent, PlayerState, BaseInPlay, MinionOnBase, CardInstance } from '../domain/types';
import type { SmashUpCommand } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
        ...overrides,
    };
}

function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid,
        defId,
        controller,
        owner: controller,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

function makeBase(defId: string, overrides?: Partial<BaseInPlay>): BaseInPlay {
    return {
        defId,
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner = '0'): CardInstance {
    return { uid, defId, type, owner };
}

function makeCore(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': makePlayer('0'),
            '1': makePlayer('1'),
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

function wrapState(core: SmashUpCore) {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    const sys = createInitialSystemState(['0', '1'], systems, undefined);
    sys.phase = 'scoreBases';
    sys.interaction.current = undefined;
    sys.interaction.queue = [];
    return { core, sys };
}

describe('afterScoring 延迟清场回归', () => {
    it('base_greenhouse: 应先换基地，再把牌库随从打到新基地', () => {
        const system = createSmashUpEventSystem();
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dk1', 'alien_collector', 'minion')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_greenhouse')],
            baseDeck: ['base_secret_garden'],
        }));

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-greenhouse',
                    playerId: '0',
                    optionId: 'minion-0',
                    value: { cardUid: 'dk1', defId: 'alien_collector', power: 4 },
                    sourceId: 'base_greenhouse',
                    interactionData: {
                        sourceId: 'base_greenhouse',
                        continuationContext: {
                            baseIndex: 0,
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: 'base_greenhouse' },
                                    timestamp: 2100,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: 'base_greenhouse',
                                        newBaseDefId: 'base_secret_garden',
                                    },
                                    timestamp: 2100,
                                },
                            ],
                        },
                    },
                },
                timestamp: 2100,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.map(event => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.MINION_PLAYED,
        ]);

        const finalCore = emittedEvents?.reduce((core, event) => reduce(core, event), state.core as SmashUpCore);
        expect(finalCore?.bases[0].defId).toBe('base_secret_garden');
        expect(finalCore?.bases[0].minions.map(minion => minion.uid)).toEqual(['dk1']);
        expect(finalCore?.players['0'].deck).toHaveLength(0);
    });

    it('延迟打出随从时即使旧 baseIndex 漂移，仍应按 baseDefId 落到替换后基地', () => {
        const state = makeCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dk1', 'alien_collector', 'minion')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_secret_garden'),
                makeBase('base_other'),
            ],
        });

        const finalCore = reduce(state, {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: '0',
                cardUid: 'dk1',
                defId: 'alien_collector',
                baseIndex: 1,
                baseDefId: 'base_secret_garden',
                power: 4,
                fromDeck: true,
                consumesNormalLimit: false,
            },
            timestamp: 2101,
        } as any);

        expect(finalCore.bases[0].minions.map(minion => minion.uid)).toEqual(['dk1']);
        expect(finalCore.bases[1].minions).toHaveLength(0);
        expect(finalCore.players['0'].deck).toHaveLength(0);
    });

    it('base_tortuga: 应先换基地，再把亚军随从移到新基地', () => {
        const system = createSmashUpEventSystem();
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tortuga', {
                    minions: [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '1', 3),
                    ],
                }),
                makeBase('base_other', {
                    minions: [makeMinion('m3', '1', 2)],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-tortuga',
                    playerId: '1',
                    optionId: 'minion-0',
                    value: { minionUid: 'm3', minionDefId: 'd1', fromBaseIndex: 1 },
                    sourceId: 'base_tortuga',
                    interactionData: {
                        sourceId: 'base_tortuga',
                        continuationContext: {
                            baseIndex: 0,
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: 'base_tortuga' },
                                    timestamp: 2200,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: 'base_tortuga',
                                        newBaseDefId: 'base_secret_garden',
                                    },
                                    timestamp: 2200,
                                },
                            ],
                        },
                    },
                },
                timestamp: 2200,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.map(event => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.MINION_MOVED,
        ]);

        const finalCore = emittedEvents?.reduce((core, event) => reduce(core, event), state.core as SmashUpCore);
        expect(finalCore?.bases[0].defId).toBe('base_secret_garden');
        expect(finalCore?.bases[0].minions.map(minion => minion.uid)).toEqual(['m3']);
        expect(finalCore?.bases[1].minions).toHaveLength(0);
    });

    it('base_the_mothership should not flush deferred clear events when next interaction is in current', () => {
        const system = createSmashUpEventSystem();
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_mothership', {
                    minions: [
                        makeMinion('winner-minion', '1', 3),
                        makeMinion('scout-minion', '0', 2, 'alien_scout'),
                    ],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        // 模拟：当前交互（母舰）已被弹出，下一交互（侦察兵）已在 current，queue 为空。
        state.sys.interaction.current = {
            id: 'i-scout-next',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                sourceId: 'alien_scout_return',
                options: [
                    { id: 'yes', label: '返回手牌', value: { returnIt: true } },
                    { id: 'no', label: '留在基地', value: { returnIt: false } },
                ],
            },
        } as any;
        state.sys.interaction.queue = [];

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-mothership',
                    playerId: '1',
                    optionId: 'minion-0',
                    value: { minionUid: 'winner-minion', minionDefId: 'd1', baseIndex: 0 },
                    sourceId: 'base_the_mothership',
                    interactionData: {
                        sourceId: 'base_the_mothership',
                        continuationContext: {
                            baseIndex: 0,
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: 'base_the_mothership' },
                                    timestamp: 2200,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: 'base_the_mothership',
                                        newBaseDefId: 'base_secret_garden',
                                    },
                                    timestamp: 2200,
                                },
                            ],
                        },
                    },
                },
                timestamp: 2200,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(true);
        expect(emittedEvents?.some(event => event.type === SU_EVENTS.BASE_CLEARED)).toBe(false);
        expect(emittedEvents?.some(event => event.type === SU_EVENTS.BASE_REPLACED)).toBe(false);

        const nextCtx = (result?.state.sys.interaction.current?.data as any)?.continuationContext;
        expect(nextCtx?._deferredPostScoringEvents).toBeDefined();
        expect(nextCtx?._deferredPostScoringEvents).toHaveLength(2);
    });

    it('最后一个 afterScoring 交互已补发延迟事件时，不应再次重复补发', () => {
        const system = createSmashUpEventSystem();
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tortuga', {
                    minions: [makeMinion('mate', '0', 2, 'pirate_first_mate')],
                }),
                makeBase('base_other'),
                makeBase('base_else', {
                    minions: [makeMinion('runner', '1', 2)],
                }),
            ],
            baseDeck: ['base_secret_garden'],
            pendingPostScoringActions: [{
                kind: 'moveMinionToReplacementBase',
                minionUid: 'runner',
                minionDefId: 'd1',
                fromBaseIndex: 2,
                toBaseIndex: 1,
                targetBaseDefId: 'base_secret_garden',
                reason: '托尔图加：亚军移动随从到替换基地',
            }],
        }));

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-first-mate',
                    playerId: '0',
                    optionId: 'base-1',
                    value: { baseIndex: 1 },
                    sourceId: 'pirate_first_mate_choose_base',
                    interactionData: {
                        sourceId: 'pirate_first_mate_choose_base',
                        continuationContext: {
                            mateUid: 'mate',
                            mateDefId: 'pirate_first_mate',
                            scoringBaseIndex: 0,
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: 'base_tortuga' },
                                    timestamp: 2300,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: 'base_tortuga',
                                        newBaseDefId: 'base_secret_garden',
                                    },
                                    timestamp: 2300,
                                },
                            ],
                        },
                    },
                },
                timestamp: 2300,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.map(event => event.type)).toEqual([
            SU_EVENTS.MINION_MOVED,
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.MINION_MOVED,
        ]);
        expect(emittedEvents?.filter(event => event.type === SU_EVENTS.BASE_CLEARED)).toHaveLength(1);
        expect(emittedEvents?.filter(event => event.type === SU_EVENTS.BASE_REPLACED)).toHaveLength(1);
        expect(result?.state.core.pendingPostScoringActions).toBeUndefined();

        const finalCore = emittedEvents?.reduce((core, event) => reduce(core, event), state.core as SmashUpCore);
        expect(finalCore?.bases[0].defId).toBe('base_secret_garden');
        expect(finalCore?.bases[0].minions.map(minion => minion.uid)).toEqual(['runner']);
        expect(finalCore?.bases[1].minions.map(minion => minion.uid)).toEqual(['mate']);
        expect(finalCore?.bases[2].minions).toHaveLength(0);
    });

    it('海盗湾最后一步若随从已暂离来源基地但仍处于延迟清场链，应继续发出移动事件', () => {
        const system = createSmashUpEventSystem();
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('archmage', 'wizard_archmage_pod', 'minion')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_pirate_cove'),
                makeBase('base_the_jungle'),
                makeBase('base_tortuga', {
                    minions: [makeMinion('mate', '1', 2, 'pirate_first_mate_pod')],
                }),
            ],
            baseDeck: ['base_tar_pits_pod'],
        }));

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-pirate-cove-step-2',
                    playerId: '0',
                    optionId: 'base-0',
                    value: { baseIndex: 1, baseDefId: 'base_the_jungle' },
                    sourceId: 'base_pirate_cove_choose_base',
                    interactionData: {
                        sourceId: 'base_pirate_cove_choose_base',
                        continuationContext: {
                            minionUid: 'archmage',
                            minionDefId: 'wizard_archmage_pod',
                            fromBaseIndex: 0,
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: 'base_pirate_cove_pod' },
                                    timestamp: 2400,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: 'base_pirate_cove_pod',
                                        newBaseDefId: 'base_tar_pits_pod',
                                    },
                                    timestamp: 2400,
                                },
                            ],
                        },
                    },
                },
                timestamp: 2400,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.map(event => event.type)).toEqual([
            SU_EVENTS.MINION_MOVED,
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
        ]);
        expect(emittedEvents?.[0]).toMatchObject({
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'archmage',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: '海盗湾：移动随从到其他基地',
            },
        });

        const finalCore = emittedEvents?.reduce((core, event) => reduce(core, event), state.core as SmashUpCore);
        expect(finalCore?.bases[0].defId).toBe('base_tar_pits_pod');
        expect(finalCore?.bases[1].minions.map(minion => minion.uid)).toEqual(['archmage']);
        expect(finalCore?.players['0'].discard.some(card => card.uid === 'archmage')).toBe(false);
    });

    it('scoreBases 因 afterScoring 响应窗口 halt 时应保留 scoredBaseIndices', () => {
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('card-after', 'giant_ant_we_are_the_champions', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_jungle', {
                    minions: [
                        { ...makeMinion('m1', '0', 5, 'giant_ant_worker'), powerCounters: 2 },
                        makeMinion('m2', '0', 3, 'giant_ant_soldier'),
                        makeMinion('m3', '1', 2, 'ninja_shinobi'),
                    ],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        const result = smashUpFlowHooks.onPhaseExit?.({
            state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', timestamp: 2300 },
            random: () => 0.5,
        });

        if (!result || Array.isArray(result)) {
            throw new Error('Expected scoreBases to return PhaseExitResult when afterScoring window opens');
        }

        const emittedEvents = result.events as SmashUpEvent[];
        expect(emittedEvents.map(event => event.type)).toContain(SU_EVENTS.BASE_SCORED);
        expect(emittedEvents.map(event => event.type)).toContain('RESPONSE_WINDOW_OPENED');
        expect(result.halt).toBe(true);
        expect((result.updatedState?.sys as any).smashupScoring?.currentBaseRef?.slotIndex).toBe(0);
        expect(result.updatedState?.sys.scoredBaseIndices).toEqual([0]);
    });

    it('scoreBases 在 afterScoring 响应窗口打开时，不应因 eligibleIndices 为空而自动推进', () => {
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('card-after', 'giant_ant_we_are_the_champions', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_secret_garden'),
            ],
            baseDeck: [],
        }));

        state.sys.flowHalted = true;
        state.sys.responseWindow.current = {
            id: 'after-scoring-window',
            responderQueue: ['0', '1'],
            currentResponderIndex: 0,
            passedPlayers: [],
            windowType: 'afterScoring',
            sourceId: 'test-after-scoring',
            actionTakenThisRound: false,
            consecutivePassRounds: 0,
        };

        const result = smashUpFlowHooks.onAutoContinueCheck?.({
            state,
            events: [],
            random: (() => 0.5) as any,
        });

        expect(result).toBeUndefined();
    });

    it('scoreBases 进入 draw 时应基于清场后的临时 core 洗牌抽牌', () => {
        const state = wrapState(makeCore({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    deck: [],
                    discard: [],
                }),
            },
            bases: [
                makeBase('base_cave_of_shinies_pod', {
                    minions: [
                        makeMinion('p1a', '1', 3, 'wizard_neophyte_pod'),
                        makeMinion('p1b', '1', 4, 'bear_cavalry_polar_commando_pod'),
                    ],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        const result = smashUpFlowHooks.onPhaseEnter?.({
            state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined, timestamp: 3000 } as any,
            random: {
                D6: () => 1,
                Number: () => 0.5,
                Die: () => 1,
                shuffle: <T>(cards: T[]) => [...cards],
            } as any,
            exitEvents: [
                {
                    type: SU_EVENTS.BASE_CLEARED,
                    payload: { baseIndex: 0, baseDefId: 'base_cave_of_shinies_pod' },
                    timestamp: 3000,
                } as any,
            ],
        });

        if (!result) {
            throw new Error('Expected onPhaseEnter(draw) to return events');
        }

        const emittedEvents = (Array.isArray(result) ? result : result.events) as SmashUpEvent[];
        expect(emittedEvents.map(event => event.type)).toEqual([
            SU_EVENTS.DECK_RESHUFFLED,
            SU_EVENTS.CARDS_DRAWN,
        ]);
        expect((emittedEvents[0] as any).payload.deckUids).toEqual(['p1a', 'p1b']);
        expect((emittedEvents[1] as any).payload.cardUids).toEqual(['p1a', 'p1b']);
    });

    it('DECK_RESHUFFLED 不应吞掉同批次稍后由 CARDS_DRAWN 抽走的旧牌库顶部卡', () => {
        const state = makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [],
                    deck: [makeCard('top', 'wizard_winds_of_change_pod', 'action', '1')],
                    discard: [
                        makeCard('d1', 'wizard_neophyte_pod', 'minion', '1'),
                        makeCard('d2', 'wizard_portal_pod', 'action', '1'),
                    ],
                }),
            },
        });

        const afterReshuffle = reduce(state, {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: { playerId: '1', deckUids: ['d2', 'd1'] },
            timestamp: 3100,
        } as any);
        const finalState = reduce(afterReshuffle, {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: '1', count: 2, cardUids: ['top', 'd2'] },
            timestamp: 3100,
        } as any);

        expect(finalState.players['1'].hand.map(card => card.uid)).toEqual(['top', 'd2']);
        expect(finalState.players['1'].deck.map(card => card.uid)).toEqual(['d1']);
        expect(finalState.players['1'].discard).toHaveLength(0);
    });

    it('afterScoring 已完成清场换基地后，后续结束回合不应再次给第一个基地计分', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, _random) => {
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                sys.phase = 'playCards';

                const core = makeCore({
                    currentPlayerIndex: 1,
                    turnNumber: 8,
                    bases: [
                        makeBase('base_secret_garden'),
                        makeBase('base_great_library', {
                            minions: [
                                {
                                    ...makeMinion('m3', '0', 2, 'robot_microbot_alpha'),
                                    powerCounters: 7,
                                },
                            ],
                        }),
                        makeBase('base_the_jungle'),
                    ],
                    baseDeck: ['base_temple_of_goju'],
                });

                return { core, sys };
            },
        });

        const player1EndTurn = runner.dispatch('ADVANCE_PHASE', { playerId: '1' });
        expect(player1EndTurn.success).toBe(true);
        expect(player1EndTurn.events.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(0);

        const stateAfterPlayer1Turn = runner.getState();
        expect(stateAfterPlayer1Turn.sys.phase).toBe('playCards');
        expect(stateAfterPlayer1Turn.core.turnOrder[stateAfterPlayer1Turn.core.currentPlayerIndex]).toBe('0');
        expect(stateAfterPlayer1Turn.core.bases[0].defId).toBe('base_secret_garden');

        const player0EndTurn = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(player0EndTurn.success).toBe(true);
        expect(player0EndTurn.events.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(0);

        const finalState = runner.getState();
        expect(finalState.sys.phase).toBe('playCards');
        expect(finalState.core.turnOrder[finalState.core.currentPlayerIndex]).toBe('1');
        expect(finalState.core.bases[0].defId).toBe('base_secret_garden');
    });
});
