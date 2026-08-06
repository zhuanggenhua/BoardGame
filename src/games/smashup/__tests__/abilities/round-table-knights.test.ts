import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { defaultTestRandom, runCommand } from '../testRunner';
import {
    applyEvents,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';

beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('圆桌骑士能力', () => {
    it('圣杯：只能打到自己没有行动牌的基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('grail-1', 'round_table_knights_the_grail', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_camelot',
                    minions: [],
                    ongoingActions: [{ uid: 'good-deed-1', defId: 'round_table_knights_good_deed', ownerId: '0' }],
                }),
                makeBase({ defId: 'base_round_table', minions: [], ongoingActions: [] }),
            ],
        });

        const blocked = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'grail-1', targetBaseIndex: 0 },
        } as any, defaultTestRandom);
        expect(blocked.success).toBe(false);
        expect(blocked.error).toContain('没有行动牌');

        const allowed = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'grail-1', targetBaseIndex: 1 },
        } as any, defaultTestRandom);
        expect(allowed.success, allowed.error).toBe(true);
    });

    it('圣剑：亚瑟王所在基地计分后 VP 给圣剑拥有者', () => {
        const arthur = makeMinion('arthur-1', 'round_table_knights_king_arthur', '1', 5, {
            owner: '1',
            attachedActions: [{ uid: 'excalibur-1', defId: 'round_table_knights_excalibur', ownerId: '0' }],
        });
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_camelot', minions: [arthur], ongoingActions: [] })],
        });

        const result = fireTriggers(state, 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            playerId: '1',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({ playerId: '0', amount: 1 }),
        }));
    });

    it('善行：同一回合第二个己方随从移入不再触发抽牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'robot_zapbot', 'minion', '0'),
                        makeCard('draw-2', 'robot_zapbot', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_round_table',
                minions: [makeMinion('moved-1', 'round_table_knights_lancelot', '0', 4)],
                ongoingActions: [{ uid: 'good-deed-1', defId: 'round_table_knights_good_deed', ownerId: '0' }],
            })],
            turnNumber: 3,
        });

        const first = fireTriggers(state, 'onMinionMoved', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinion: state.bases[0].minions[0],
            random: defaultTestRandom,
            now: 1000,
        });
        expect(first.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(1);

        const afterFirst = applyEvents(state, first.events);
        const second = fireTriggers(afterFirst, 'onMinionMoved', {
            state: afterFirst,
            matchState: makeMatchState(afterFirst),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinion: afterFirst.bases[0].minions[0],
            random: defaultTestRandom,
            now: 1001,
        });
        expect(second.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
    });

    it('渔夫王：移动触发抽牌后手牌达到 8 张会自毁并给 1 VP', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: Array.from({ length: 7 }, (_, i) => makeCard(`h-${i}`, 'robot_zapbot', 'minion', '0')),
                    deck: [makeCard('draw-1', 'robot_zapbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_round_table',
                minions: [makeMinion('moved-1', 'round_table_knights_lancelot', '0', 4)],
                ongoingActions: [{ uid: 'fisher-1', defId: 'round_table_knights_the_fisher_king', ownerId: '0' }],
            })],
        });

        const result = fireTriggers(state, 'onMinionMoved', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinion: state.bases[0].minions[0],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({ cardUid: 'fisher-1' }),
        }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({ playerId: '0', amount: 1 }),
        }));
    });

    it('圣杯：3 个己方 4+ 战力随从在场时移入触发移出游戏并给 2 VP', () => {
        const moved = makeMinion('moved-1', 'round_table_knights_lancelot', '0', 4);
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_round_table',
                minions: [
                    moved,
                    makeMinion('arthur-1', 'round_table_knights_king_arthur', '0', 5),
                    makeMinion('gawain-1', 'round_table_knights_gawain', '0', 4),
                ],
                ongoingActions: [{ uid: 'grail-1', defId: 'round_table_knights_the_grail', ownerId: '0' }],
            })],
        });

        const result = fireTriggers(state, 'onMinionMoved', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinion: moved,
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({ cardUid: 'grail-1' }),
        }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
            payload: expect.objectContaining({ cardUid: 'grail-1' }),
        }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({ playerId: '0', amount: 2 }),
        }));
    });

    it('卡美洛：印刷战力 4+ 的随从受其他玩家卡牌影响/消灭/移动/行动保护', () => {
        const protectedMinion = makeMinion('lancelot-1', 'round_table_knights_lancelot', '0', 4);
        const smallMinion = makeMinion('small-1', 'goblins_gobbo', '0', 2);
        const state = makeState({
            bases: [makeBase({ defId: 'base_camelot', minions: [protectedMinion, smallMinion], ongoingActions: [] })],
        });

        for (const type of ['affect', 'destroy', 'move', 'action'] as const) {
            expect(isMinionProtected(state, protectedMinion, 0, '1', type)).toBe(true);
            expect(isMinionProtected(state, protectedMinion, 0, '0', type)).toBe(false);
            expect(isMinionProtected(state, smallMinion, 0, '1', type)).toBe(false);
        }
    });

    it('卡美洛：主动能力会移动玩家指定的己方随从到指定基地', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_camelot',
                    minions: [
                        makeMinion('lancelot-1', 'round_table_knights_lancelot', '0', 4),
                        makeMinion('percival-1', 'round_table_knights_percival', '0', 4),
                    ],
                    ongoingActions: [],
                }),
                makeBase({ defId: 'base_round_table', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'base_goblin_town', minions: [], ongoingActions: [] }),
            ],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0, targetMinionUid: 'percival-1', targetBaseIndex: 2 },
        } as any, defaultTestRandom);

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('lancelot-1');
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('percival-1');
        expect(result.finalState.core.bases[2].minions.map(minion => minion.uid)).toContain('percival-1');
    });

    it('圆桌会议：相同印刷战力的己方随从只获得 +1，不按同伴数叠加', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_round_table',
                minions: [
                    makeMinion('lancelot-1', 'round_table_knights_lancelot', '0', 4),
                    makeMinion('guinevere-1', 'round_table_knights_guinevere', '0', 4),
                    makeMinion('merlin-1', 'round_table_knights_merlin', '0', 4),
                ],
                ongoingActions: [],
            })],
        });

        expect(getEffectivePower(state, state.bases[0].minions[0], 0)).toBe(5);
        expect(getEffectivePower(state, state.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(state, state.bases[0].minions[2], 0)).toBe(5);
    });

    it('亚瑟王：天赋会移动玩家指定的己方随从到亚瑟王所在基地', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_camelot', minions: [makeMinion('arthur-1', 'round_table_knights_king_arthur', '0', 5)], ongoingActions: [] }),
                makeBase({ defId: 'base_round_table', minions: [makeMinion('lancelot-1', 'round_table_knights_lancelot', '0', 4)], ongoingActions: [] }),
                makeBase({ defId: 'base_goblin_town', minions: [makeMinion('percival-1', 'round_table_knights_percival', '0', 4)], ongoingActions: [] }),
            ],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'arthur-1', baseIndex: 0, targetMinionUid: 'percival-1' },
        } as any, defaultTestRandom);

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('percival-1');
        expect(result.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('lancelot-1');
        expect(result.finalState.core.bases[2].minions.map(minion => minion.uid)).not.toContain('percival-1');
    });

    it('帕西瓦尔：天赋会移动到玩家指定且有己方行动牌的基地', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_camelot', minions: [makeMinion('percival-1', 'round_table_knights_percival', '0', 4)], ongoingActions: [] }),
                makeBase({ defId: 'base_round_table', minions: [], ongoingActions: [{ uid: 'good-deed-1', defId: 'round_table_knights_good_deed', ownerId: '0' }] }),
                makeBase({ defId: 'base_goblin_town', minions: [], ongoingActions: [{ uid: 'grail-1', defId: 'round_table_knights_the_grail', ownerId: '0' }] }),
            ],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'percival-1', baseIndex: 0, targetBaseIndex: 2 },
        } as any, defaultTestRandom);

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.bases[2].minions.map(minion => minion.uid)).toContain('percival-1');
        expect(result.finalState.core.bases[1].minions.map(minion => minion.uid)).not.toContain('percival-1');
    });

    it('梅林：牌库顶是行动牌时抽起并提供立即额外打出该行动的机会', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('action-1', 'round_table_knights_good_deed', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_camelot', minions: [makeMinion('merlin-1', 'round_table_knights_merlin', '0', 4)], ongoingActions: [] })],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'merlin-1', baseIndex: 0 },
        } as any, defaultTestRandom);

        expect(result.success, result.error).toBe(true);
        expect(result.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'action',
                playTiming: 'immediate',
                restrictToCardUid: 'action-1',
            }),
        }));
    });

    it('湖中女神：从弃牌堆找可打到随从的行动后，提供立即额外打出该行动的机会', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lady-1', 'round_table_knights_the_lady_of_the_lake', 'action', '0')],
                    discard: [makeCard('excalibur-1', 'round_table_knights_excalibur', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_camelot', minions: [makeMinion('arthur-1', 'round_table_knights_king_arthur', '0', 5)], ongoingActions: [] })],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'lady-1' },
        } as any, defaultTestRandom);

        expect(result.success, result.error).toBe(true);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: expect.objectContaining({ cardUids: ['excalibur-1'] }),
        }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'action',
                playTiming: 'immediate',
                restrictToCardUid: 'excalibur-1',
            }),
        }));
    });

    it('善行：同基地还有其他己方行动牌时，也应定位并触发善行自身', () => {
        const moved = makeMinion('moved-1', 'round_table_knights_lancelot', '0', 4);
        const state = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('draw-1', 'robot_zapbot', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_round_table',
                    minions: [moved],
                    ongoingActions: [
                        { uid: 'other-action-1', defId: 'round_table_knights_the_grail', ownerId: '0' },
                        { uid: 'good-deed-1', defId: 'round_table_knights_good_deed', ownerId: '0' },
                    ],
                }),
                makeBase({ defId: 'base_camelot', minions: [], ongoingActions: [] }),
            ],
        });

        const result = fireTriggers(state, 'onMinionMoved', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinion: moved,
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({ cardUid: 'good-deed-1' }),
        }));
        expect(result.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({ cardUid: 'other-action-1' }),
        }));
    });

    it('梅林藏书馆：天赋可移动玩家指定的己方随从到这里', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_camelot', minions: [], ongoingActions: [{ uid: 'library-1', defId: 'round_table_knights_merlins_library', ownerId: '0' }] }),
                makeBase({ defId: 'base_round_table', minions: [makeMinion('lancelot-1', 'round_table_knights_lancelot', '0', 4)], ongoingActions: [] }),
            ],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'library-1', baseIndex: 0, targetMinionUid: 'lancelot-1' },
        } as any, defaultTestRandom);

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('lancelot-1');
        expect(result.finalState.core.bases[1].minions.map(minion => minion.uid)).not.toContain('lancelot-1');
    });
});
