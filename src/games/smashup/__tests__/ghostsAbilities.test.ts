/**
 * 大杀四方 - 幽灵派系能力测试
 *
 * 覆盖：
 * - 交朋友（ghost_make_contact）：只能在本卡是唯一手牌时打出；附着到随从后控制权转移
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { reduce } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { resolveOnPlay } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid, defId, controller, owner: owner ?? controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return makeMatchStateFromHelpers(core);
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

function execPlayAction(
    state: SmashUpCore,
    playerId: string,
    cardUid: string,
    targetBaseIndex?: number,
    targetMinionUid?: string,
): { events: SmashUpEvent[]; matchState: MatchState<SmashUpCore>; success: boolean; error?: string } {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex, targetMinionUid },
    } as any, defaultRandom);
    return {
        events: result.events as SmashUpEvent[],
        matchState: result.finalState,
        success: result.success,
        error: result.error,
    };
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// 交朋友（ghost_make_contact）
// ============================================================================

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
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                }],
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
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('m2', 'test', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                }],
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
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                }],
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
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2, '1')], // 对方随从
                    ongoingActions: [],
                }],
            });

            const { events } = execPlayAction(state, '0', 'a1', 0, 'm1');
            const newState = applyEvents(state, events);

            const minion = newState.bases[0].minions.find(m => m.uid === 'm1');
            expect(minion).toBeDefined();
            // 控制权转移给打出者
            expect(minion!.controller).toBe('0');
            // 原始 owner 不变
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
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '0', 2, '0')], // 己方随从
                    ongoingActions: [],
                }],
            });

            const { events } = execPlayAction(state, '0', 'a1', 0, 'm1');
            const newState = applyEvents(state, events);

            const minion = newState.bases[0].minions.find(m => m.uid === 'm1');
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
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2, '1')],
                    ongoingActions: [],
                }],
            });

            const { events } = execPlayAction(state, '0', 'a1', 0, 'm1');
            const newState = applyEvents(state, events);

            const minion = newState.bases[0].minions.find(m => m.uid === 'm1');
            expect(minion!.attachedActions).toHaveLength(1);
            expect(minion!.attachedActions[0].defId).toBe('ghost_make_contact');
            expect(minion!.attachedActions[0].ownerId).toBe('0');
        });
    });
});

// ============================================================================
// 交朋友（ghost_make_contact_pod）
// ============================================================================

describe('ghost_make_contact_pod（交朋友 POD）', () => {
    it('手牌只有本卡时控制权转移', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ghost_make_contact_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [makeMinion('m1', 'test', '1', 2, '1')],
                ongoingActions: [],
            }],
        });

        const { events } = execPlayAction(state, '0', 'a1', 0, 'm1');
        const newState = applyEvents(state, events);
        const minion = newState.bases[0].minions.find(m => m.uid === 'm1')!;
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
            bases: [{
                defId: 'b1',
                minions: [makeMinion('m2', 'test', '1', 2, '1')],
                ongoingActions: [],
            }],
        });

        const { events } = execPlayAction(state, '0', 'a1', 0, 'm2');
        const newState = applyEvents(state, events);
        const minion = newState.bases[0].minions.find(m => m.uid === 'm2')!;
        expect(minion.controller).toBe('1');
        expect(minion.attachedActions.some(action => action.defId === 'ghost_make_contact_pod')).toBe(false);
    });

    it('被他人拥有时自毁仍应进入其拥有者弃牌堆，而不是当前玩家弃牌堆', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ghost_make_contact_pod', 'action', '1'),
                        makeCard('m1', 'test_minion', 'minion', '0'),
                    ],
                    discard: [makeCard('p0-discard-a', 'test_action', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    discard: [makeCard('p1-discard-a', 'test_action', 'action', '1')],
                }),
            },
            bases: [{
                defId: 'b1',
                minions: [makeMinion('m2', 'test', '1', 2, '1')],
                ongoingActions: [],
            }],
        });

        const { events } = execPlayAction(state, '0', 'a1', 0, 'm2');
        const newState = applyEvents(state, events);
        const minion = newState.bases[0].minions.find(m => m.uid === 'm2')!;

        expect(minion.controller).toBe('1');
        expect(minion.attachedActions.some(action => action.uid === 'a1')).toBe(false);
        expect(newState.players['0'].discard.map(card => card.uid)).toEqual(['p0-discard-a']);
        expect(newState.players['1'].discard.map(card => card.uid)).toEqual(['p1-discard-a', 'a1']);
    });
});

describe('ghost_the_dead_rise（亡者崛起）', () => {
    it('从弃牌堆打出 borrowed 低力量随从时，应保留真实 owner', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('rise', 'ghost_the_dead_rise', 'action', '0'),
                        makeCard('discard-a', 'ghost_spectre', 'minion', '0'),
                        makeCard('discard-b', 'ghost_spectre', 'minion', '0'),
                        makeCard('discard-c', 'ghost_spectre', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('borrowed-ghost', 'vampire_fledgling_vampire', 'minion', '1'),
                        makeCard('own-ghost', 'ghost_spectre', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
        });

        const onPlay = resolveOnPlay('ghost_the_dead_rise');
        expect(onPlay).toBeTruthy();
        const result = onPlay!({
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'rise',
            defId: 'ghost_the_dead_rise',
            baseIndex: 0,
            random: defaultRandom,
            now: 0,
        } as any);

        const discardPrompt = result.matchState?.sys.interaction?.current as any;
        expect(discardPrompt?.data?.sourceId).toBe('ghost_the_dead_rise_discard');
        const discardOptionIds = discardPrompt.data.options
            .filter((option: any) => ['discard-a', 'discard-b', 'discard-c'].includes(option.value?.cardUid))
            .map((option: any) => option.id);
        expect(discardOptionIds).toHaveLength(3);

        const afterDiscard = runCommand(
            result.matchState!,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionIds: discardOptionIds } } as any,
            defaultRandom,
        );
        expect(afterDiscard.success).toBe(true);

        const playPrompt = afterDiscard.finalState.sys.interaction?.current as any;
        expect(playPrompt?.data?.sourceId).toBe('ghost_the_dead_rise_play');
        const borrowedOption = playPrompt.data.options.find((option: any) => option.value?.cardUid === 'borrowed-ghost');
        expect(borrowedOption).toBeTruthy();

        const resolved = runCommand(
            afterDiscard.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: borrowedOption.id } } as any,
            defaultRandom,
        );
        expect(resolved.success).toBe(true);

        const minion = resolved.finalState.core.bases[0].minions.find(card => card.uid === 'borrowed-ghost');
        expect(minion?.controller).toBe('0');
        expect(minion?.owner).toBe('1');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('borrowed-ghost');
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('borrowed-ghost');
    });
});
