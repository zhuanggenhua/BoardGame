/**
 * D18/D19 — 否定路径与组合场景审计测试
 *
 * D18: 验证额度消耗的否定路径（消耗一种额度不影响另一种）
 * D19: 验证多种额度来源同时生效时的组合行为
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runCommand } from './testRunner';
import {
    makeState,
    makeMatchState,
    makePlayer,
    makeBase,
    makeMinion,
    makeCard,
    applyEvents,
} from './helpers/auditUtils';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type { SmashUpCore } from '../domain/types';
import { grantExtraMinion } from '../domain/abilityHelpers';

// ============================================================================
// D18: 否定路径 — 额度消耗隔离性
// ============================================================================

describe('D18: 否定路径 — 额度消耗隔离性', () => {
    let baseCore: SmashUpCore;

    beforeEach(() => {
        baseCore = makeState({
            bases: [
                makeBase('base_a', []),
                makeBase('base_b', []),
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('m1', 'test_minion_a', 'minion', '0'),
                        makeCard('m2', 'test_minion_a', 'minion', '0'),
                        makeCard('m3', 'test_minion_b', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
    });

    it('基地限定额度消耗后 minionsPlayed 不变', () => {
        // 先消耗全局额度
        const afterGlobal = applyEvents(baseCore, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm1', defId: 'test_minion_a', baseIndex: 0, power: 3, consumesNormalLimit: true }, timestamp: 1 },
        ]);
        expect(afterGlobal.players['0'].minionsPlayed).toBe(1);

        // 授予基地限定额度
        const afterGrant = applyEvents(afterGlobal, [
            grantExtraMinion('0', 'test', 2, 0), // restrictToBase=0
        ]);
        expect(afterGrant.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);

        // 使用基地限定额度打出随从
        const afterBaseQuota = applyEvents(afterGrant, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm2', defId: 'test_minion_a', baseIndex: 0, power: 3, consumesNormalLimit: true }, timestamp: 3 },
        ]);

        // 关键断言：minionsPlayed 不应增加（基地限定额度消耗不影响全局计数）
        expect(afterBaseQuota.players['0'].minionsPlayed).toBe(1);
        // 基地限定额度应减少
        expect(afterBaseQuota.players['0'].baseLimitedMinionQuota?.[0]).toBe(0);
    });

    it('正常额度消耗后 baseLimitedMinionQuota 不变', () => {
        // 先授予基地限定额度
        const afterGrant = applyEvents(baseCore, [
            grantExtraMinion('0', 'test', 1, 1), // restrictToBase=1
        ]);
        expect(afterGrant.players['0'].baseLimitedMinionQuota?.[1]).toBe(1);

        // 使用全局额度打出随从到基地0
        const afterPlay = applyEvents(afterGrant, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm1', defId: 'test_minion_a', baseIndex: 0, power: 3, consumesNormalLimit: true }, timestamp: 2 },
        ]);

        // 关键断言：全局额度消耗，基地限定额度不受影响
        expect(afterPlay.players['0'].minionsPlayed).toBe(1);
        expect(afterPlay.players['0'].baseLimitedMinionQuota?.[1]).toBe(1);
    });

    it('在非限定基地打随从不消耗基地限定额度', () => {
        // 先消耗全局额度
        const afterGlobal = applyEvents(baseCore, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm1', defId: 'test_minion_a', baseIndex: 0, power: 3, consumesNormalLimit: true }, timestamp: 1 },
        ]);

        // 授予基地0的限定额度
        const afterGrant = applyEvents(afterGlobal, [
            grantExtraMinion('0', 'test', 2, 0), // restrictToBase=0
        ]);
        expect(afterGrant.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);

        // 尝试在基地1打出随从（非限定基地）— 全局额度已满，基地1无额度
        // 此时 reducer 不应消耗基地0的额度
        // 注意：实际游戏中 validate 会阻止这个操作，但 reducer 层面的行为也需要正确
        // 我们验证的是：如果强制在基地1打出，基地0的额度不受影响
        const afterPlay = applyEvents(afterGrant, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm2', defId: 'test_minion_a', baseIndex: 1, power: 3, consumesNormalLimit: true }, timestamp: 3 },
        ]);

        // 基地0的限定额度不应被消耗
        expect(afterPlay.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
    });

    it('同名额度消耗后 baseLimitedMinionQuota 和 minionsPlayed 均不变', () => {
        // 先消耗全局额度
        const afterGlobal = applyEvents(baseCore, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm1', defId: 'test_minion_a', baseIndex: 0, power: 3, consumesNormalLimit: true }, timestamp: 1 },
        ]);

        // 授予同名额度 + 基地限定额度
        const afterGrant = applyEvents(afterGlobal, [
            grantExtraMinion('0', 'test_samename', 2, undefined, { sameNameOnly: true }),
            grantExtraMinion('0', 'test_base', 2, 0),
        ]);
        expect(afterGrant.players['0'].sameNameMinionRemaining).toBe(1);
        expect(afterGrant.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);

        // 使用同名额度打出随从
        const afterSameName = applyEvents(afterGrant, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm2', defId: 'test_minion_a', baseIndex: 0, power: 3, consumesNormalLimit: true }, timestamp: 3 },
        ]);

        // 同名额度消耗，其他额度不受影响
        expect(afterSameName.players['0'].sameNameMinionRemaining).toBe(0);
        expect(afterSameName.players['0'].minionsPlayed).toBe(1); // 不变
        expect(afterSameName.players['0'].baseLimitedMinionQuota?.[0]).toBe(1); // 不变
    });
});

// ============================================================================
// D19: 组合场景 — 多种额度来源同时生效
// ============================================================================

describe('D19: 组合场景 — 多种额度来源同时生效', () => {
    it('全局额度+1（力量≤2）+ 基地限定额度+1 同时生效', () => {
        const core = makeState({
            bases: [
                makeBase('base_a', []),
                makeBase('base_b', []),
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('m1', 'test_minion_big', 'minion', '0'),   // 力量5
                        makeCard('m2', 'test_minion_small', 'minion', '0'), // 力量2
                        makeCard('m3', 'test_minion_tiny', 'minion', '0'),  // 力量1
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        // 消耗全局额度
        const s1 = applyEvents(core, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm1', defId: 'test_minion_big', baseIndex: 0, power: 5, consumesNormalLimit: true }, timestamp: 1 },
        ]);
        expect(s1.players['0'].minionsPlayed).toBe(1);
        expect(s1.players['0'].minionLimit).toBe(1);

        // 授予全局额度+1（力量≤2）+ 基地0限定额度+1
        const s2 = applyEvents(s1, [
            grantExtraMinion('0', 'homeworld', 2, undefined, { powerMax: 2 }),
            grantExtraMinion('0', 'secret_garden', 2, 0),
        ]);
        expect(s2.players['0'].minionLimit).toBe(2);
        expect(s2.players['0'].extraMinionPowerMax).toBe(2);
        expect(s2.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);

        // 使用全局额度+1 打出力量2随从到基地1
        const s3 = applyEvents(s2, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm2', defId: 'test_minion_small', baseIndex: 1, power: 2, consumesNormalLimit: true }, timestamp: 3 },
        ]);
        expect(s3.players['0'].minionsPlayed).toBe(2);
        // 基地限定额度不受影响
        expect(s3.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);

        // 使用基地0限定额度打出随从
        const s4 = applyEvents(s3, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm3', defId: 'test_minion_tiny', baseIndex: 0, power: 1, consumesNormalLimit: true }, timestamp: 4 },
        ]);
        // 基地限定额度消耗
        expect(s4.players['0'].baseLimitedMinionQuota?.[0]).toBe(0);
        // 全局 minionsPlayed 不变（基地限定额度不增加全局计数）
        expect(s4.players['0'].minionsPlayed).toBe(2);
    });

    it('同名额度优先于基地限定额度消耗', () => {
        const core = makeState({
            bases: [makeBase('base_a', [])],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('m1', 'test_minion_a', 'minion', '0'),
                        makeCard('m2', 'test_minion_a', 'minion', '0'),
                        makeCard('m3', 'test_minion_a', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        // 消耗全局额度
        const s1 = applyEvents(core, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm1', defId: 'test_minion_a', baseIndex: 0, power: 3, consumesNormalLimit: true }, timestamp: 1 },
        ]);

        // 同时授予同名额度和基地限定额度
        const s2 = applyEvents(s1, [
            grantExtraMinion('0', 'samename', 2, undefined, { sameNameOnly: true }),
            grantExtraMinion('0', 'base_quota', 2, 0),
        ]);
        expect(s2.players['0'].sameNameMinionRemaining).toBe(1);
        expect(s2.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);

        // 打出同名随从 — reducer 中同名额度优先于基地限定额度
        const s3 = applyEvents(s2, [
            { type: SU_EVENTS.MINION_PLAYED, payload: { playerId: '0', cardUid: 'm2', defId: 'test_minion_a', baseIndex: 0, power: 3, consumesNormalLimit: true }, timestamp: 3 },
        ]);

        // 同名额度被消耗
        expect(s3.players['0'].sameNameMinionRemaining).toBe(0);
        // 基地限定额度不受影响
        expect(s3.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        // 全局 minionsPlayed 不变
        expect(s3.players['0'].minionsPlayed).toBe(1);
    });

    it('回合切换后所有额度类型均被清理', () => {
        const core = makeState({
            bases: [makeBase('base_a', [])],
            players: {
                '0': makePlayer('0', {
                    minionLimit: 2,
                    minionsPlayed: 1,
                    baseLimitedMinionQuota: { 0: 1 },
                    baseLimitedSameNameRequired: { 0: true },
                    extraMinionPowerMax: 2,
                    sameNameMinionRemaining: 1,
                    sameNameMinionDefId: 'test_minion_a',
                }),
                '1': makePlayer('1'),
            },
        });

        // 触发 TURN_STARTED 清理
        const afterTurn = applyEvents(core, [
            { type: SU_EVENTS.TURN_STARTED, payload: { playerId: '0', turnNumber: 2 }, timestamp: 10 },
        ]);

        const p = afterTurn.players['0'];
        expect(p.minionsPlayed).toBe(0);
        expect(p.minionLimit).toBe(1);
        expect(p.baseLimitedMinionQuota).toBeUndefined();
        expect(p.baseLimitedSameNameRequired).toBeUndefined();
        expect(p.extraMinionPowerMax).toBeUndefined();
        expect(p.sameNameMinionRemaining).toBeUndefined();
        expect(p.sameNameMinionDefId).toBeNull();
    });
});
