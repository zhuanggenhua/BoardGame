/**
 * 回归测试：同一交互重复 respond 不得产生二次副作用
 *
 * 场景：雄蜂防止消灭交互（giant_ant_drone_prevent_destroy）
 * 问题：快速连点导致同一交互被 respond 两次，第一次消耗指示物，
 *       第二次在边界状态下触发 MINION_DESTROYED 回退路径。
 *
 * 验证：
 * 1. 第一次 respond 成功消耗指示物
 * 2. 第二次 respond（相同 interactionId）被引擎拒绝，状态不变
 * 3. 随从不会被错误消灭
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { makeState, makeMinion, makePlayer, makeMatchState, makeBase } from './helpers';
import { runCommand } from './testRunner';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import type { SmashUpCommand } from '../domain/types';

describe('同一交互重复 respond 防护', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });
    /**
     * 构造场景：
     * - 基地 0 上有玩家 0 的随从 A（即将被消灭）和雄蜂 B（有 1 个力量指示物）
     * - 触发雄蜂防止消灭交互
     * - 第一次 respond 选择消耗指示物 → 成功
     * - 第二次 respond 同一 interactionId → 应被拒绝
     */
    it('第二次 SYS_INTERACTION_RESPOND 对已消费的交互应被拒绝', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase('test_base', [
                    makeMinion('target-1', 'test_minion', '0', 3),
                    makeMinion('drone-1', 'giant_ant_drone', '0', 2, { powerCounters: 1 }),
                ]),
            ],
        });

        const ms = makeMatchState(core);

        // 手动注入一个雄蜂防止消灭交互到 interaction system
        const interactionId = 'giant_ant_drone_prevent_destroy_test';
        ms.sys.interaction = {
            current: {
                id: interactionId,
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: '雄蜂：是否移除1个力量指示物来防止该随从被消灭？',
                    options: [
                        { id: 'skip', label: '不防止消灭', value: { skip: true } },
                        { id: 'drone-0', label: '移除雄蜂的1个指示物来防止消灭', value: { droneUid: 'drone-1', droneBaseIndex: 0, minionUid: 'drone-1' } },
                    ],
                    sourceId: 'giant_ant_drone_prevent_destroy',
                    targetType: 'generic',
                    continuationContext: {
                        targetMinionUid: 'target-1',
                        targetMinionDefId: 'test_minion',
                        fromBaseIndex: 0,
                        toPlayerId: '0',
                    },
                },
            },
            queue: [],
        };

        // 第一次 respond：选择消耗指示物防止消灭
        const respondCmd: SmashUpCommand = {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'drone-0' },
            timestamp: Date.now(),
        };

        const result1 = runCommand(ms, respondCmd);
        expect(result1.success).toBe(true);

        // 检查事件链：应包含 INTERACTION_RESOLVED 和 POWER_COUNTER_REMOVED
        const resolvedEvents = result1.events.filter((e: any) => e.type === 'SYS_INTERACTION_RESOLVED');
        const counterEvents = result1.events.filter((e: any) => e.type === 'su:power_counter_removed');
        expect(resolvedEvents.length).toBeGreaterThanOrEqual(1);
        expect(counterEvents.length).toBe(1);

        // 验证第一次 respond 后：指示物被消耗
        const droneAfter1 = result1.finalState.core.bases[0]?.minions.find(
            (m: any) => m.uid === 'drone-1',
        );
        expect(droneAfter1).toBeDefined();
        expect(droneAfter1!.powerCounters).toBe(0); // 指示物从 1 → 0

        // 验证交互已被消费（current 应为 null/undefined）
        expect(result1.finalState.sys.interaction?.current).toBeFalsy();

        // 目标随从仍在场上（被防止消灭了）
        const targetAfter1 = result1.finalState.core.bases[0]?.minions.find(
            (m: any) => m.uid === 'target-1',
        );
        expect(targetAfter1).toBeDefined();

        // 第二次 respond：同一交互 ID，应被拒绝
        const result2 = runCommand(result1.finalState, respondCmd);
        expect(result2.success).toBe(false);

        // 状态不应发生任何变化
        expect(result2.finalState.core).toEqual(result1.finalState.core);

        // 目标随从仍在场上（不应被二次消灭）
        const targetAfter2 = result2.finalState.core.bases[0]?.minions.find(
            (m: any) => m.uid === 'target-1',
        );
        expect(targetAfter2).toBeDefined();

        // 雄蜂指示物不应被二次消耗
        const droneAfter2 = result2.finalState.core.bases[0]?.minions.find(
            (m: any) => m.uid === 'drone-1',
        );
        expect(droneAfter2).toBeDefined();
        expect(droneAfter2!.powerCounters).toBe(0); // 仍然是 0，没有变成 -1
    });

    it('交互消费后再次 respond 不会产生 MINION_DESTROYED 事件', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase('test_base', [
                    makeMinion('target-1', 'test_minion', '0', 3),
                    makeMinion('drone-1', 'giant_ant_drone', '0', 2, { powerCounters: 1 }),
                ]),
            ],
        });

        const ms = makeMatchState(core);

        // 注入交互
        ms.sys.interaction = {
            current: {
                id: 'drone_prevent_test_2',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: '雄蜂：是否移除1个力量指示物来防止该随从被消灭？',
                    options: [
                        { id: 'skip', label: '不防止消灭', value: { skip: true } },
                        { id: 'drone-0', label: '移除雄蜂的1个指示物来防止消灭', value: { droneUid: 'drone-1', droneBaseIndex: 0, minionUid: 'drone-1' } },
                    ],
                    sourceId: 'giant_ant_drone_prevent_destroy',
                    targetType: 'generic',
                    continuationContext: {
                        targetMinionUid: 'target-1',
                        targetMinionDefId: 'test_minion',
                        fromBaseIndex: 0,
                        toPlayerId: '0',
                    },
                },
            },
            queue: [],
        };

        // 第一次 respond：跳过（不防止消灭）
        const skipCmd: SmashUpCommand = {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'skip' },
            timestamp: Date.now(),
        };

        const result1 = runCommand(ms, skipCmd);
        expect(result1.success).toBe(true);

        // 跳过后交互已消费
        expect(result1.finalState.sys.interaction?.current).toBeFalsy();

        // 第二次 respond：应被拒绝，不产生额外 MINION_DESTROYED
        const result2 = runCommand(result1.finalState, skipCmd);
        expect(result2.success).toBe(false);

        // 不应有新的 MINION_DESTROYED 事件
        const destroyEvents = result2.events.filter(
            (e: any) => e.type === 'su:minion_destroyed',
        );
        expect(destroyEvents).toHaveLength(0);
    });
});
