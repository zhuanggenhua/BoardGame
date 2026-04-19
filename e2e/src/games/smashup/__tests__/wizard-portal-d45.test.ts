/**
 * 传送门交互 D45 问题测试
 * 
 * 问题：传送门的 ACTION_PLAYED 事件在 pipeline 步骤 4.5 和步骤 5 被处理两次，
 * 导致 onPlay 能力被触发两次，创建两个相同 ID 的交互，第二个覆盖第一个，UI 一闪而过。
 * 
 * 修复：在 postProcessSystemEvents 中添加 ACTION_PLAYED 去重逻辑，
 * 使用 _processedPlayedEvents Set 记录已处理的事件。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SmashUpDomain, postProcessSystemEvents } from '../domain';
import type { SmashUpCore } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import type { RandomFn, MatchState } from '../../../engine/types';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: (n: number) => Math.ceil(n / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T>(arr: T[]) => [...arr],
};

describe('传送门交互 D45 问题', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearOngoingEffectRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    it('postProcessSystemEvents 对 ACTION_PLAYED 事件去重', () => {
        // 1. 初始化游戏状态
        const core = SmashUpDomain.setup(['p1', 'p2'], fixedRandom);

        // 2. 跳过派系选择
        core.factionSelection = undefined;
        core.players.p1.factions = ['wizard', 'robot'];
        core.players.p2.factions = ['pirate', 'ninja'];

        // 3. 构造 ACTION_PLAYED 事件
        const portalUid = 'portal-1';
        const actionPlayedEvent = {
            type: SU_EVENTS.ACTION_PLAYED,
            payload: { playerId: 'p1', cardUid: portalUid, defId: 'wizard_portal' },
            timestamp: 1000,
        };

        // 4. 构造 matchState（包含 sys）
        const matchState: MatchState<SmashUpCore> = {
            core,
            sys: {
                interaction: { current: undefined, queue: [] },
            } as any,
        };

        // 5. 第一次调用 postProcessSystemEvents（模拟 pipeline 步骤 4.5）
        const result1 = postProcessSystemEvents(core, [actionPlayedEvent as any], fixedRandom, matchState);
        
        // 验证：第一次调用标记了事件
        const processedSet1 = result1.matchState?.sys._processedPlayedEvents;
        expect(processedSet1).toBeDefined();
        expect(processedSet1!.has(`ACTION:${portalUid}@p1`)).toBe(true);

        // 6. 第二次调用 postProcessSystemEvents（模拟 pipeline 步骤 5）
        // 使用第一次调用返回的 matchState（包含已标记的事件）
        const result2 = postProcessSystemEvents(core, [actionPlayedEvent as any], fixedRandom, result1.matchState);
        
        // 验证：第二次调用没有重复处理（事件数量不变）
        // 如果没有去重，第二次调用会再次触发 onPlay 能力，产生新的事件
        expect(result2.events.length).toBe(result1.events.length);
        
        // 验证：processedSet 仍然只有一个条目
        const processedSet2 = result2.matchState?.sys._processedPlayedEvents;
        expect(processedSet2!.size).toBe(1);
        expect(processedSet2!.has(`ACTION:${portalUid}@p1`)).toBe(true);
    });

    it('postProcessSystemEvents 对 MINION_PLAYED 事件去重', () => {
        // 1. 初始化游戏状态
        const core = SmashUpDomain.setup(['p1', 'p2'], fixedRandom);

        // 2. 跳过派系选择
        core.factionSelection = undefined;
        core.players.p1.factions = ['wizard', 'robot'];
        core.players.p2.factions = ['pirate', 'ninja'];

        // 3. 构造 MINION_PLAYED 事件
        const minionUid = 'minion-1';
        const minionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId: 'p1', cardUid: minionUid, defId: 'wizard_chronomage', baseIndex: 0, power: 3 },
            timestamp: 1000,
        };

        // 4. 构造 matchState
        const matchState: MatchState<SmashUpCore> = {
            core,
            sys: {
                interaction: { current: undefined, queue: [] },
            } as any,
        };

        // 5. 第一次调用
        const result1 = postProcessSystemEvents(core, [minionPlayedEvent as any], fixedRandom, matchState);
        
        // 验证：第一次调用标记了事件
        const processedSet1 = result1.matchState?.sys._processedPlayedEvents;
        expect(processedSet1).toBeDefined();
        expect(processedSet1!.has(`MINION:${minionUid}@0`)).toBe(true);
        
        // 验证：第一次调用产生了 derived events（onPlay 能力等）
        // MINION_PLAYED 本身 + derived events（至少包含原事件）
        expect(result1.events.length).toBeGreaterThanOrEqual(1);

        // 6. 第二次调用
        const result2 = postProcessSystemEvents(core, [minionPlayedEvent as any], fixedRandom, result1.matchState);
        
        // 验证：第二次调用没有重复处理（只返回原事件，不产生新的 derived events）
        // 关键：第二次调用应该只返回 MINION_PLAYED 事件本身，不再触发 fireMinionPlayedTriggers
        expect(result2.events.length).toBe(1);
        expect(result2.events[0].type).toBe(SU_EVENTS.MINION_PLAYED);
        
        // 验证：processedSet 仍然只有一个条目
        const processedSet2 = result2.matchState?.sys._processedPlayedEvents;
        expect(processedSet2!.size).toBe(1);
        expect(processedSet2!.has(`MINION:${minionUid}@0`)).toBe(true);
    });
});
