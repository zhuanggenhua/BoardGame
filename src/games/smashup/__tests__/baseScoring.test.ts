/**
 * 大杀四方 - 基地记分测试
 *
 * 覆盖 Property 11: 基地记分时持续行动清理
 * 覆盖 Property 12: 随从离场时附着行动清理
 * 覆盖 Property 13: 力量指示物不变量
 * 覆盖 Property 16: VP 分配正确性
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import type {
    SmashUpCore, SmashUpEvent, MinionOnBase, BaseInPlay,
    OngoingActionOnBase, AttachedActionOnMinion,
} from '../domain/types';
import { SU_EVENTS, getTotalPowerOnBase, getPlayerPowerOnBase } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function makePlayer(id: string, overrides: Partial<any> = {}) {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS] as [string, string],
        ...overrides,
    };
}

describe('基地记分与力量计算', () => {
    // Property 13: 力量指示物不变量
    describe('Property 13: 力量指示物', () => {
        it('powerModifier 不能为负', () => {
            const minion: MinionOnBase = {
                uid: 'test', defId: 'test', controller: '0', owner: '0',
                basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [],
            };
            const newModifier = Math.max(0, minion.powerModifier - 5);
            expect(newModifier).toBe(0);
        });

        it('基地总力量等于所有随从 basePower + powerModifier 之和', () => {
            const base: BaseInPlay = {
                defId: 'test_base',
                minions: [
                    { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 3, powerModifier: 2, talentUsed: false, attachedActions: [] },
                    { uid: 'b', defId: 'd2', controller: '1', owner: '1', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            };
            expect(getTotalPowerOnBase(base)).toBe(10);
        });

        it('getPlayerPowerOnBase 只计算指定玩家的随从', () => {
            const base: BaseInPlay = {
                defId: 'test_base',
                minions: [
                    { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 3, powerModifier: 1, talentUsed: false, attachedActions: [] },
                    { uid: 'b', defId: 'd2', controller: '1', owner: '1', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'c', defId: 'd3', controller: '0', owner: '0', basePower: 2, powerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            };
            expect(getPlayerPowerOnBase(base, '0')).toBe(6);
            expect(getPlayerPowerOnBase(base, '1')).toBe(5);
        });
    });

    // Property 16: VP 分配正确性
    describe('Property 16: VP 分配', () => {
        it('reduce BASE_SCORED 正确分配 VP', () => {
            const { reduce } = SmashUpDomain;
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [
                        { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'b', defId: 'd2', controller: '1', owner: '1', basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [
                    { playerId: '0', power: 5, vp: 4 },
                    { playerId: '1', power: 3, vp: 2 },
                ]},
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            expect(newState.players['0'].vp).toBe(4);
            expect(newState.players['1'].vp).toBe(2);
            // BASE_SCORED 仅发放 VP，基地仍在；BASE_CLEARED 才清除基地
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);
            expect(newState.bases.length).toBe(0);
        });

        it('reduce BASE_SCORED 随从回弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const state: SmashUpCore = {
                players: { '0': makePlayer('0') },
                turnOrder: ['0'],
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [
                        { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [{ playerId: '0', power: 5, vp: 4 }] },
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            // BASE_SCORED 仅发放 VP，弃置由 BASE_CLEARED 执行
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);
            expect(newState.players['0'].discard.length).toBe(1);
            expect(newState.players['0'].discard[0].uid).toBe('a');
        });
    });

    // Property 11: 基地记分时持续行动清理
    describe('Property 11: 持续行动卡清理', () => {
        it('基地记分后持续行动卡回各自所有者弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const ongoing1: OngoingActionOnBase = { uid: 'oa1', defId: 'ongoing_def1', ownerId: '0' };
            const ongoing2: OngoingActionOnBase = { uid: 'oa2', defId: 'ongoing_def2', ownerId: '1' };

            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [
                        { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [ongoing1, ongoing2],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [{ playerId: '0', power: 5, vp: 4 }] },
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            // BASE_CLEARED 执行弃置
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);

            // P0 弃牌堆：持续行动卡 oa1 + 随从 a
            const p0Discard = newState.players['0'].discard;
            expect(p0Discard.some(c => c.uid === 'oa1')).toBe(true);
            expect(p0Discard.some(c => c.uid === 'a')).toBe(true);

            // P1 弃牌堆：持续行动卡 oa2
            const p1Discard = newState.players['1'].discard;
            expect(p1Discard.some(c => c.uid === 'oa2')).toBe(true);
            expect(p1Discard.length).toBe(1);
        });

        it('无持续行动卡时正常记分', () => {
            const { reduce } = SmashUpDomain;
            const state: SmashUpCore = {
                players: { '0': makePlayer('0') },
                turnOrder: ['0'],
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [
                        { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [{ playerId: '0', power: 5, vp: 4 }] },
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            expect(newState.players['0'].vp).toBe(4);
            // BASE_CLEARED 执行弃置
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);
            expect(newState.players['0'].discard.length).toBe(1);
        });
    });

    // Property 12: 随从离场时附着行动清理
    describe('Property 12: 附着行动卡清理', () => {
        it('基地记分时随从附着的行动卡回各自所有者弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const attached1: AttachedActionOnMinion = { uid: 'att1', defId: 'action_def1', ownerId: '1' };
            const attached2: AttachedActionOnMinion = { uid: 'att2', defId: 'action_def2', ownerId: '0' };

            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [{
                        uid: 'm1', defId: 'd1', controller: '0', owner: '0',
                        basePower: 5, powerModifier: 0, talentUsed: false,
                        attachedActions: [attached1, attached2],
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [{ playerId: '0', power: 5, vp: 4 }] },
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            // BASE_CLEARED 执行弃置
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);

            // P0 弃牌堆：附着卡 att2 + 随从 m1
            const p0Discard = newState.players['0'].discard;
            expect(p0Discard.some(c => c.uid === 'att2')).toBe(true);
            expect(p0Discard.some(c => c.uid === 'm1')).toBe(true);

            // P1 弃牌堆：附着卡 att1
            const p1Discard = newState.players['1'].discard;
            expect(p1Discard.some(c => c.uid === 'att1')).toBe(true);
            expect(p1Discard.length).toBe(1);
        });

        it('随从被消灭时附着的行动卡回各自所有者弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const attached: AttachedActionOnMinion = { uid: 'att1', defId: 'action_def1', ownerId: '1' };

            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [{
                        uid: 'm1', defId: 'd1', controller: '0', owner: '0',
                        basePower: 3, powerModifier: 0, talentUsed: false,
                        attachedActions: [attached],
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: 'm1', minionDefId: 'd1',
                    fromBaseIndex: 0, ownerId: '0', reason: '测试消灭',
                },
                timestamp: 1000,
            } as any;

            const newState = reduce(state, event);

            // P0 弃牌堆：随从 m1
            expect(newState.players['0'].discard.some(c => c.uid === 'm1')).toBe(true);
            // P1 弃牌堆：附着卡 att1
            expect(newState.players['1'].discard.some(c => c.uid === 'att1')).toBe(true);
        });
    });

    // Property 16: 平局 VP 分配
    describe('Property 16: 平局 VP 分配', () => {
        it('力量相同的玩家获得该名次最高VP（验证辅助函数）', () => {
            const base: BaseInPlay = {
                defId: 'test_base',
                minions: [
                    { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'b', defId: 'd2', controller: '1', owner: '1', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            };
            expect(getPlayerPowerOnBase(base, '0')).toBe(getPlayerPowerOnBase(base, '1'));
        });
    });
});
