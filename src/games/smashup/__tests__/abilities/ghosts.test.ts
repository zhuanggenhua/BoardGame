import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { buildAffectRecords } from '../../domain/affect';
import {
    clearOngoingEffectRegistry,
    isMinionProtected,
} from '../../domain/ongoingEffects';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectNoPrompt,
    getPromptsBySourceId,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function execPlayAction(
    state: SmashUpCore,
    playerId: string,
    cardUid: string,
    targetBaseIndex?: number,
    targetMinionUid?: string,
) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex, targetMinionUid },
        } as any,
        defaultTestRandom,
    );
    return {
        events: result.events as SmashUpEvent[],
        matchState: result.finalState,
        success: result.success,
        error: result.error,
    };
}

describe('ghost_make_contact（交朋友）', () => {
    describe('打出约束：只能在本卡是唯一手牌时打出', () => {
        it('手牌只有本卡时允许打出', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_make_contact', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                })],
            });

            const result = execPlayAction(state, '0', 'a1', 0, 'm1');
            expect(result.success).toBe(true);
        });

        it('手牌有其他卡时禁止打出', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'ghost_make_contact', 'action', '0'),
                            makeCard('m1', 'test_minion', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m2', 'test', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                })],
            });

            const result = execPlayAction(state, '0', 'a1', 0, 'm2');
            expect(result.success).toBe(false);
            expect(result.error).toContain('唯一手牌');
        });

        it('手牌有两张行动卡时禁止打出', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'ghost_make_contact', 'action', '0'),
                            makeCard('a2', 'test_action', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                })],
            });

            const result = execPlayAction(state, '0', 'a1', 0, 'm1');
            expect(result.success).toBe(false);
        });
    });

    describe('效果：附着后随从控制权转移', () => {
        it('附着到对方随从后控制权变为己方', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_make_contact', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2, '1')],
                    ongoingActions: [],
                })],
            });

            const { events } = execPlayAction(state, '0', 'a1', 0, 'm1');
            const newState = applyEvents(state, events);
            const minion = newState.bases[0].minions.find(entry => entry.uid === 'm1');
            expect(minion).toBeDefined();
            expect(minion!.controller).toBe('0');
            expect(minion!.owner).toBe('1');
        });

        it('附着到己方随从后控制权仍为己方', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_make_contact', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '0', 2, '0')],
                    ongoingActions: [],
                })],
            });

            const { events } = execPlayAction(state, '0', 'a1', 0, 'm1');
            const newState = applyEvents(state, events);
            const minion = newState.bases[0].minions.find(entry => entry.uid === 'm1');
            expect(minion!.controller).toBe('0');
        });

        it('行动卡附着记录在随从的 attachedActions 中', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_make_contact', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2, '1')],
                    ongoingActions: [],
                })],
            });

            const { events } = execPlayAction(state, '0', 'a1', 0, 'm1');
            const newState = applyEvents(state, events);
            const minion = newState.bases[0].minions.find(entry => entry.uid === 'm1');
            expect(minion!.attachedActions).toHaveLength(1);
            expect(minion!.attachedActions[0].defId).toBe('ghost_make_contact');
            expect(minion!.attachedActions[0].ownerId).toBe('0');
        });
    });
});

describe('ghost_incorporeal（幽灵化）保护', () => {
    it('附着 ghost_incorporeal 的随从不受对手 affect 影响', () => {
        const minion = makeMinion('g-1', 'ghost_a', '0', 3, {
            powerModifier: 0,
            attachedActions: [{ uid: 'gi-1', defId: 'ghost_incorporeal', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
    });

    it('附着 ghost_incorporeal_pod 的随从也不受对手 affect 影响', () => {
        const minion = makeMinion('g-pod-1', 'ghost_a', '0', 3, {
            powerModifier: 0,
            attachedActions: [{ uid: 'gi-pod-1', defId: 'ghost_incorporeal_pod', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
    });

    it('无附着时不受保护', () => {
        const minion = makeMinion('g-1', 'ghost_a', '0', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(false);
    });

    it('自己不受保护限制', () => {
        const minion = makeMinion('g-1', 'ghost_a', '0', 3, {
            powerModifier: 0,
            attachedActions: [{ uid: 'gi-1', defId: 'ghost_incorporeal', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(isMinionProtected(state, minion, 0, '0', 'affect')).toBe(false);
    });
});

describe('ghost_make_contact（交朋友）低层行为合同', () => {
    it('唯一手牌时显式发出控制权变更事件，且不遗留 prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mc-1', 'ghost_make_contact', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ minions: [makeMinion('om-1', 'opp_m', '1', 5, { owner: '1', powerModifier: 0 })] })],
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'mc-1', targetBaseIndex: 0, targetMinionUid: 'om-1' },
            } as any,
            defaultTestRandom,
        );

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        const controlChanged = result.events.find(event => event.type === SU_EVENTS.MINION_CONTROL_CHANGED);
        expect(controlChanged).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({
                    minionUid: 'om-1',
                    fromControllerId: '1',
                    toControllerId: '0',
                    sourcePlayerId: '0',
                    sourceCardUid: 'mc-1',
                    sourceDefId: 'ghost_make_contact',
                }),
            }),
        );
    });

    it('POD 版无手牌时也显式发出控制权变更事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mc-pod-1', 'ghost_make_contact_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ minions: [makeMinion('om-1', 'opp_m', '1', 5, { owner: '1', powerModifier: 0 })] })],
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'mc-pod-1', targetBaseIndex: 0, targetMinionUid: 'om-1' },
            } as any,
            defaultTestRandom,
        );

        expect(result.success, result.error).toBe(true);
        const controlChanged = result.events.find(event => event.type === SU_EVENTS.MINION_CONTROL_CHANGED);
        expect((controlChanged as any)?.payload?.sourceDefId).toBe('ghost_make_contact_pod');
    });

    it('脱离时恢复控制权不会再次记成随从被影响', () => {
        const controlledMinion = makeMinion('om-1', 'opp_m', '0', 3, {
            owner: '1',
            powerModifier: 0,
            attachedActions: [{ uid: 'mc-1', defId: 'ghost_make_contact', ownerId: '0' }],
        });
        const state = makeState({
            bases: [makeBase({ minions: [controlledMinion] })],
        });

        const records = buildAffectRecords(state, {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'mc-1',
                defId: 'ghost_make_contact',
                ownerId: '0',
                reason: 'ghost_make_contact_expired',
            },
            timestamp: 1000,
        } as any);

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
            targetKind: 'attached_action',
            targetUid: 'mc-1',
            affectType: 'destroy',
            countsForOnMinionAffected: false,
        });
    });
});

describe('ghost_make_contact_pod（交朋友 POD）', () => {
    it('手牌只有本卡时控制权转移', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ghost_make_contact_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [makeMinion('m1', 'test', '1', 2, '1')],
                ongoingActions: [],
            })],
        });

        const { events } = execPlayAction(state, '0', 'a1', 0, 'm1');
        const newState = applyEvents(state, events);
        const minion = newState.bases[0].minions.find(entry => entry.uid === 'm1')!;
        expect(minion.controller).toBe('0');
        expect(minion.attachedActions.some(action => action.defId === 'ghost_make_contact_pod')).toBe(true);
    });

    it('手牌仍有其他卡时自毁且不转移控制权', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ghost_make_contact_pod', 'action', '0'),
                        makeCard('m1', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [makeMinion('m2', 'test', '1', 2, '1')],
                ongoingActions: [],
            })],
        });

        const { events } = execPlayAction(state, '0', 'a1', 0, 'm2');
        const newState = applyEvents(state, events);
        const minion = newState.bases[0].minions.find(entry => entry.uid === 'm2')!;
        expect(minion.controller).toBe('1');
        expect(minion.attachedActions.some(action => action.defId === 'ghost_make_contact_pod')).toBe(false);
    });
});

describe('ghost_ghost（幽灵）', () => {
    it('多张可弃手牌时创建弃牌 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('m1', 'ghost_ghost', 'minion', '0'),
                        makeCard('h1', 'test_card', 'action', '0'),
                        makeCard('h2', 'test_card2', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        } as any, defaultTestRandom);

        expect(getPromptsBySourceId(result.finalState, 'ghost_ghost')).toHaveLength(1);
    });

    it('无其他手牌时不弃牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'ghost_ghost', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        } as any, defaultTestRandom);

        const discardEvents = result.events.filter(event => event.type === 'su:cards_discarded');
        expect(discardEvents).toHaveLength(0);
    });

    it('单张可弃手牌时 Prompt 待决且手牌暂不变化', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('m1', 'ghost_ghost', 'minion', '0'),
                        makeCard('h1', 'test_card', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        } as any, defaultTestRandom);

        const newState = applyEvents(state, result.events as SmashUpEvent[]);
        expect(getPromptsBySourceId(result.finalState, 'ghost_ghost')).toHaveLength(1);
        expect(newState.players['0'].hand.some(card => card.uid === 'h1')).toBe(true);
        expect(newState.bases[0].minions.some(minion => minion.uid === 'm1')).toBe(true);
    });
});

describe('ghost_seance（招魂）', () => {
    it('手牌少时抽到 5 张', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, 'test_card', 'minion', '0'),
        );
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ghost_seance', 'action', '0'),
                        makeCard('h1', 'test', 'minion', '0'),
                    ],
                    deck: deckCards,
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(event => event.type === 'su:cards_drawn');
        expect(drawEvents).toHaveLength(1);
        expect((drawEvents[0] as any).payload.count).toBe(4);
    });

    it('牌库空但弃牌堆有牌时先洗回再抽牌', () => {
        const discardCards = Array.from({ length: 4 }, (_, i) =>
            makeCard(`d${i}`, 'discard_card', 'minion', '0'),
        );
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ghost_seance', 'action', '0'),
                        makeCard('h1', 'test', 'minion', '0'),
                    ],
                    deck: [],
                    discard: discardCards,
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const eventTypes = events.map(event => event.type);
        expect(eventTypes).toContain('su:deck_reshuffled');
        expect(eventTypes).toContain('su:cards_drawn');
        expect(eventTypes.indexOf('su:deck_reshuffled')).toBeLessThan(eventTypes.indexOf('su:cards_drawn'));

        const newState = applyEvents(state, events);
        expect(newState.players['0'].hand.map(card => card.uid)).toEqual(['h1', 'd0', 'd1', 'd2', 'd3']);
        expect(newState.players['0'].deck).toHaveLength(0);
        expect(newState.players['0'].discard.map(card => card.uid)).toEqual(['a1']);
    });

    it('手牌多时不抽牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ghost_seance', 'action', '0'),
                        makeCard('h1', 'test', 'minion', '0'),
                        makeCard('h2', 'test', 'minion', '0'),
                        makeCard('h3', 'test', 'minion', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(event => event.type === 'su:cards_drawn');
        expect(drawEvents).toHaveLength(0);
    });
});

describe('ghost_shady_deal（阴暗交易）', () => {
    it('手牌少时获得 1 VP', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ghost_shady_deal', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const vpEvents = events.filter(event => event.type === 'su:vp_awarded');
        expect(vpEvents).toHaveLength(1);
        expect((vpEvents[0] as any).payload.amount).toBe(1);
        expect((vpEvents[0] as any).payload.playerId).toBe('0');
    });

    it('手牌多时不获得 VP', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ghost_shady_deal', 'action', '0'),
                        makeCard('h1', 'test', 'minion', '0'),
                        makeCard('h2', 'test', 'minion', '0'),
                        makeCard('h3', 'test', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const vpEvents = events.filter(event => event.type === 'su:vp_awarded');
        expect(vpEvents).toHaveLength(0);
    });

    it('VP 正确累加', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    vp: 3,
                    hand: [makeCard('a1', 'ghost_shady_deal', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const newState = applyEvents(state, events);
        expect(newState.players['0'].vp).toBe(4);
    });
});

describe('ghost_ghostly_arrival（悄然而至）', () => {
    it('给予额外随从和行动额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ghost_ghostly_arrival', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const limitEvents = events.filter(event => event.type === 'su:limit_modified');
        expect(limitEvents).toHaveLength(2);
        const types = limitEvents.map(event => (event as any).payload.limitType);
        expect(types).toContain('minion');
        expect(types).toContain('action');
    });

    it('额度正确累加', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ghost_ghostly_arrival', 'action', '0')],
                    minionLimit: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const newState = applyEvents(state, events);
        expect(newState.players['0'].minionLimit).toBe(2);
        expect(newState.players['0'].actionLimit).toBe(2);
    });

    it('off-phase 额外额度都应标记为 immediate', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const matchState = makeMatchState(state);
        matchState.sys.phase = 'startTurn';
        const result = invokeRegisteredAbilityContract('ghost_ghostly_arrival', 'onPlay', {
            state,
            matchState,
            playerId: '0',
            cardUid: 'a1',
            defId: 'ghost_ghostly_arrival',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        const limitEvents = result.events.filter(event => event.type === 'su:limit_modified');
        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.every(event => (event as any).payload.playTiming === 'immediate')).toBe(true);
    });
});
