/**
 * Bug 修复测试：多个 afterScoring 交互链式传递
 * 
 * 问题：当基地能力和随从 trigger 都创建 afterScoring 交互时，_deferredPostScoringEvents
 * 只被存到最后一个交互中，导致第一个交互解决后没有传递给下一个交互，
 * BASE_CLEARED 提前执行，后续交互弹出时随从已经不在基地上了。
 * 
 * 修复：将 _deferredPostScoringEvents 存到第一个交互中，确保链式传递。
 * 
 * 通用性：此修复对所有多 afterScoring 交互场景有效：
 * - 基地能力 + 随从 trigger（母舰 + 侦察兵、忍者道场 + 大副等）
 * - 多个随从 trigger（多个侦察兵、多个大副等）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { createGameEngine } from '../game';
import type { SmashUpCore } from '../domain/types';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe.skip('Bug: 多个 afterScoring 交互链式传递', () => {
    it('场景1: 母舰 + 侦察兵（基地能力 + 随从 trigger）', () => {
        const engine = createGameEngine();
        
        // 初始化游戏
        let state = engine.setup({ playerIds: ['p1', 'p2'] });
        
        // 设置场景：母舰基地（breakpoint=20），p1 有侦察兵（力量3）和另一个力量2的随从
        const core = state.core as SmashUpCore;
        core.bases[0] = {
            defId: 'base_the_mothership',
            breakpoint: 20,
            minions: [
                {
                    uid: 'scout1',
                    defId: 'alien_scout',
                    owner: 'p1',
                    controller: 'p1',
                },
                {
                    uid: 'weak1',
                    defId: 'alien_invader', // 力量2
                    owner: 'p1',
                    controller: 'p1',
                },
            ],
            ongoingActions: [],
        };
        
        // p2 打出随从凑够爆破点
        core.bases[0].minions.push({
            uid: 'm2',
            defId: 'pirate_pirate_king', // 力量5
            owner: 'p2',
            controller: 'p2',
        });
        core.bases[0].minions.push({
            uid: 'm3',
            defId: 'pirate_pirate_king',
            owner: 'p2',
            controller: 'p2',
        });
        core.bases[0].minions.push({
            uid: 'm4',
            defId: 'pirate_pirate_king',
            owner: 'p2',
            controller: 'p2',
        });
        
        core.currentPlayerId = 'p1';
        state.sys.phase = 'scoreBases';
        
        // 执行：触发基地计分
        const result1 = engine.runCommand(state, {
            type: 'SCORE_BASES',
            playerId: 'p1',
            payload: {},
        });
        
        expect(result1.ok).toBe(true);
        state = result1.state;
        
        // 验证：应该先弹出母舰的交互
        let interaction = state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('base_the_mothership');
        
        // 母舰交互应该有 _deferredPostScoringEvents
        const ctx1 = (interaction?.data as any)?.continuationContext;
        expect(ctx1?._deferredPostScoringEvents).toBeDefined();
        expect(ctx1?._deferredPostScoringEvents.length).toBeGreaterThan(0);
        
        // 解决母舰交互：选择收回 weak1（不是侦察兵）
        const result2 = engine.runCommand(state, {
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: interaction!.id,
                value: { minionUid: 'weak1', minionDefId: 'alien_invader' },
            },
        });
        
        expect(result2.ok).toBe(true);
        state = result2.state;
        
        // 验证：侦察兵的交互应该弹出
        interaction = state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('alien_scout_return');
        
        // 侦察兵交互应该继承了 _deferredPostScoringEvents
        const ctx2 = (interaction?.data as any)?.continuationContext;
        expect(ctx2?._deferredPostScoringEvents).toBeDefined();
        
        // 验证：侦察兵仍然在基地上（BASE_CLEARED 还没执行）
        const base = (state.core as SmashUpCore).bases[0];
        expect(base.minions.some(m => m.uid === 'scout1')).toBe(true);
        
        // 解决侦察兵交互：选择返回手牌
        const result3 = engine.runCommand(state, {
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: interaction!.id,
                value: { returnIt: true, minionUid: 'scout1', minionDefId: 'alien_scout', owner: 'p1', baseIndex: 0 },
            },
        });
        
        expect(result3.ok).toBe(true);
        state = result3.state;
        
        // 验证：侦察兵应该回到手牌
        const p1Hand = (state.core as SmashUpCore).players.p1.hand;
        expect(p1Hand.some(c => c.uid === 'scout1' && c.defId === 'alien_scout')).toBe(true);
        
        // 验证：BASE_CLEARED 应该已经执行（基地被清空）
        const finalBase = (state.core as SmashUpCore).bases[0];
        expect(finalBase.minions.length).toBe(0);
    });

    it('复杂场景：母舰 + 2个侦察兵 + 大副（4个交互链式传递）', () => {
        const engine = createGameEngine();
        
        // 初始化游戏
        let state = engine.setup({ playerIds: ['p1', 'p2'] });
        
        // 设置场景：母舰基地（breakpoint=20）
        // p1: 2个侦察兵（各力量3）+ 1个大副（力量2）+ 1个弱随从（力量2）
        const core = state.core as SmashUpCore;
        core.bases[0] = {
            defId: 'base_the_mothership',
            breakpoint: 20,
            minions: [
                // p1 的随从
                { uid: 'scout1', defId: 'alien_scout', owner: 'p1', controller: 'p1' }, // 力量3
                { uid: 'scout2', defId: 'alien_scout', owner: 'p1', controller: 'p1' }, // 力量3
                { uid: 'mate1', defId: 'pirate_first_mate', owner: 'p1', controller: 'p1' }, // 力量2
                { uid: 'weak1', defId: 'alien_invader', owner: 'p1', controller: 'p1' }, // 力量2
            ],
            ongoingActions: [],
        };
        
        // 添加第二个基地供大副移动
        core.bases.push({
            defId: 'base_tar_pits',
            breakpoint: 15,
            minions: [],
            ongoingActions: [],
        });
        
        // p2 打出随从凑够爆破点
        core.bases[0].minions.push(
            { uid: 'm2', defId: 'pirate_pirate_king', owner: 'p2', controller: 'p2' },
            { uid: 'm3', defId: 'pirate_pirate_king', owner: 'p2', controller: 'p2' },
        );
        
        core.currentPlayerId = 'p1';
        state.sys.phase = 'scoreBases';
        
        // 执行：触发基地计分
        // 预期创建4个交互：母舰 → 侦察兵1 → 侦察兵2 → 大副
        const result1 = engine.runCommand(state, {
            type: 'SCORE_BASES',
            playerId: 'p1',
            payload: {},
        });
        
        expect(result1.ok).toBe(true);
        state = result1.state;
        
        // 验证：第1个交互 - 母舰
        let interaction = state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('base_the_mothership');
        
        // 母舰交互应该有 _deferredPostScoringEvents
        let ctx = (interaction?.data as any)?.continuationContext;
        expect(ctx?._deferredPostScoringEvents).toBeDefined();
        expect(ctx?._deferredPostScoringEvents.length).toBeGreaterThan(0);
        
        // 解决母舰交互：选择收回 weak1
        const result2 = engine.runCommand(state, {
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: interaction!.id,
                value: { minionUid: 'weak1', minionDefId: 'alien_invader' },
            },
        });
        
        expect(result2.ok).toBe(true);
        state = result2.state;
        
        // 验证：第2个交互 - 侦察兵1
        interaction = state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('alien_scout_return');
        
        // 侦察兵1交互应该继承了 _deferredPostScoringEvents
        ctx = (interaction?.data as any)?.continuationContext;
        expect(ctx?._deferredPostScoringEvents).toBeDefined();
        
        // 验证：所有随从仍在基地上（BASE_CLEARED 还没执行）
        let base = (state.core as SmashUpCore).bases[0];
        expect(base.minions.some(m => m.uid === 'scout1')).toBe(true);
        expect(base.minions.some(m => m.uid === 'scout2')).toBe(true);
        expect(base.minions.some(m => m.uid === 'mate1')).toBe(true);
        
        // 解决侦察兵1交互：选择返回手牌
        const result3 = engine.runCommand(state, {
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: interaction!.id,
                value: { returnIt: true, minionUid: 'scout1', minionDefId: 'alien_scout', owner: 'p1', baseIndex: 0 },
            },
        });
        
        expect(result3.ok).toBe(true);
        state = result3.state;
        
        // 验证：第3个交互 - 侦察兵2
        interaction = state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('alien_scout_return');
        
        // 侦察兵2交互应该继承了 _deferredPostScoringEvents
        ctx = (interaction?.data as any)?.continuationContext;
        expect(ctx?._deferredPostScoringEvents).toBeDefined();
        
        // 验证：侦察兵2和大副仍在基地上
        base = (state.core as SmashUpCore).bases[0];
        expect(base.minions.some(m => m.uid === 'scout2')).toBe(true);
        expect(base.minions.some(m => m.uid === 'mate1')).toBe(true);
        
        // 解决侦察兵2交互：选择留在基地
        const result4 = engine.runCommand(state, {
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: interaction!.id,
                value: { returnIt: false },
            },
        });
        
        expect(result4.ok).toBe(true);
        state = result4.state;
        
        // 验证：第4个交互 - 大副
        interaction = state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('pirate_first_mate');
        
        // 大副交互应该继承了 _deferredPostScoringEvents
        ctx = (interaction?.data as any)?.continuationContext;
        expect(ctx?._deferredPostScoringEvents).toBeDefined();
        
        // 验证：大副仍在基地上
        base = (state.core as SmashUpCore).bases[0];
        expect(base.minions.some(m => m.uid === 'mate1')).toBe(true);
        
        // 解决大副交互：选择移动到基地1
        const result5 = engine.runCommand(state, {
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: interaction!.id,
                value: { baseIndex: 1 },
            },
        });
        
        expect(result5.ok).toBe(true);
        state = result5.state;
        
        // 验证：所有交互解决完毕，没有后续交互
        expect(state.sys.interaction?.current).toBeUndefined();
        expect(state.sys.interaction?.queue?.length ?? 0).toBe(0);
        
        // 验证：BASE_CLEARED 已执行，基地0被清空
        const finalBase0 = (state.core as SmashUpCore).bases[0];
        expect(finalBase0.minions.length).toBe(0);
        
        // 验证：侦察兵1回到手牌
        const p1Hand = (state.core as SmashUpCore).players.p1.hand;
        expect(p1Hand.some(c => c.uid === 'scout1')).toBe(true);
        
        // 验证：侦察兵2在弃牌堆（留在基地，被BASE_CLEARED清除）
        const p1Discard = (state.core as SmashUpCore).players.p1.discard;
        expect(p1Discard.some(c => c.uid === 'scout2')).toBe(true);
        
        // 验证：大副移动到基地1
        const finalBase1 = (state.core as SmashUpCore).bases[1];
        expect(finalBase1.minions.some(m => m.uid === 'mate1')).toBe(true);
    });
});
