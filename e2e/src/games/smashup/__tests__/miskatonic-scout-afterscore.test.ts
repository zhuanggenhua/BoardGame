/**
 * Bug 测试：密大基地 + 侦察兵 afterScoring 交互链
 * 
 * 场景：密大基地（Miskatonic University）有 afterScoring 能力（返回疯狂卡）
 * 同时侦察兵也有 afterScoring trigger（返回自身）
 * 
 * 预期：两个交互应该链式触发，侦察兵应该能正常弹出交互
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { engineConfig } from '../game';
import type { SmashUpCore } from '../domain/types';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe.skip('Bug: 密大基地 + 侦察兵 afterScoring 交互链', () => {
    it('密大基地 + 侦察兵：两个交互应该链式触发', () => {
        // 初始化游戏
        let state = engineConfig.setup({ playerIds: ['p1', 'p2'] });
        
        // 设置场景：密大基地（breakpoint=24），p1 有侦察兵（力量3）和其他随从
        const core = state.core as SmashUpCore;
        core.bases[0] = {
            defId: 'base_miskatonic_university_base',
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
        core.bases[0].minions.push(
            { uid: 'm2', defId: 'pirate_pirate_king', owner: 'p2', controller: 'p2' }, // 力量5
            { uid: 'm3', defId: 'pirate_pirate_king', owner: 'p2', controller: 'p2' },
            { uid: 'm4', defId: 'pirate_pirate_king', owner: 'p2', controller: 'p2' },
            { uid: 'm5', defId: 'pirate_pirate_king', owner: 'p2', controller: 'p2' },
        );
        
        // 给 p1 添加疯狂卡（触发密大基地能力）
        core.players.p1.hand.push({
            uid: 'madness1',
            defId: 'special_madness',
            type: 'action',
        });
        
        // 初始化疯狂牌库
        core.madnessDeck = [];
        
        core.currentPlayerId = 'p1';
        state.sys.phase = 'scoreBases';
        
        console.log('[TEST] 初始状态:', {
            baseDefId: core.bases[0].defId,
            minions: core.bases[0].minions.map(m => ({ uid: m.uid, defId: m.defId, controller: m.controller })),
            p1Hand: core.players.p1.hand.map(c => c.defId),
            madnessDeck: core.madnessDeck,
        });
        
        // 执行：触发基地计分
        const result1 = engineConfig.runCommand(state, {
            type: 'SCORE_BASES',
            playerId: 'p1',
            payload: {},
        });
        
        console.log('[TEST] SCORE_BASES 结果:', {
            ok: result1.ok,
            hasInteraction: !!result1.state.sys.interaction?.current,
            interactionId: result1.state.sys.interaction?.current?.id,
            interactionSourceId: result1.state.sys.interaction?.current?.data.sourceId,
            queueLength: result1.state.sys.interaction?.queue?.length ?? 0,
        });
        
        expect(result1.ok).toBe(true);
        state = result1.state;
        
        // 验证：应该先弹出密大基地的交互
        let interaction = state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('base_miskatonic_university_base');
        
        // 密大基地交互应该有 _deferredPostScoringEvents
        let ctx = (interaction?.data as any)?.continuationContext;
        console.log('[TEST] 密大基地交互 continuationContext:', ctx);
        expect(ctx?._deferredPostScoringEvents).toBeDefined();
        expect(ctx?._deferredPostScoringEvents.length).toBeGreaterThan(0);
        
        // 解决密大基地交互：跳过返回疯狂卡
        const result2 = engineConfig.runCommand(state, {
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: interaction!.id,
                value: { skip: true },
            },
        });
        
        console.log('[TEST] 解决密大基地交互后:', {
            ok: result2.ok,
            hasInteraction: !!result2.state.sys.interaction?.current,
            interactionId: result2.state.sys.interaction?.current?.id,
            interactionSourceId: result2.state.sys.interaction?.current?.data.sourceId,
            queueLength: result2.state.sys.interaction?.queue?.length ?? 0,
        });
        
        expect(result2.ok).toBe(true);
        state = result2.state;
        
        // 验证：侦察兵的交互应该弹出
        interaction = state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('alien_scout_return');
        
        // 侦察兵交互应该继承了 _deferredPostScoringEvents
        ctx = (interaction?.data as any)?.continuationContext;
        console.log('[TEST] 侦察兵交互 continuationContext:', ctx);
        expect(ctx?._deferredPostScoringEvents).toBeDefined();
        
        // 验证：侦察兵仍然在基地上（BASE_CLEARED 还没执行）
        const base = (state.core as SmashUpCore).bases[0];
        console.log('[TEST] 基地状态:', {
            minions: base.minions.map(m => ({ uid: m.uid, defId: m.defId })),
        });
        expect(base.minions.some(m => m.uid === 'scout1')).toBe(true);
        
        // 解决侦察兵交互：选择返回手牌
        const result3 = engineConfig.runCommand(state, {
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: interaction!.id,
                value: { returnIt: true, minionUid: 'scout1', minionDefId: 'alien_scout', owner: 'p1', baseIndex: 0 },
            },
        });
        
        console.log('[TEST] 解决侦察兵交互后:', {
            ok: result3.ok,
            hasInteraction: !!result3.state.sys.interaction?.current,
            p1Hand: (result3.state.core as SmashUpCore).players.p1.hand.map(c => c.defId),
            baseMinions: (result3.state.core as SmashUpCore).bases[0].minions.length,
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
});
