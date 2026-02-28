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
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';

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
        basePower: power, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
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
                    minions: [makeMinion('m1', 'test', '1', 2)],
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
                    minions: [makeMinion('m2', 'test', '1', 2)],
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
                    minions: [makeMinion('m1', 'test', '1', 2)],
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
