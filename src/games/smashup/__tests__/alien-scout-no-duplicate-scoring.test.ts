/**
 * 测试：侦察兵 afterScoring 不会导致基地重复记分
 * 
 * Bug 描述：
 * 1. 基地记分时，侦察兵触发 afterScoring 交互
 * 2. 交互创建后，onPhaseExit 返回 halt: true
 * 3. 用户选择"返回手牌"，交互解决
 * 4. FlowSystem afterEvents 触发 onAutoContinueCheck，返回 autoContinue: true
 * 5. onPhaseExit 再次被调用，但 remainingBaseIndices 是局部变量，被重置为初始值
 * 6. 同一个基地被记分两次，导致侦察兵返回手牌两次（卡牌重复）
 * 
 * 根因：
 * - remainingBaseIndices 是 onPhaseExit 的局部变量，每次调用都会重置
 * - halt 后，已记分的基地索引没有被持久化到 sys 状态
 * 
 * 修复：
 * - 使用 sys.scoredBaseIndices 跟踪已记分的基地
 * - 每次 onPhaseExit 调用时，过滤掉已记分的基地
 * - 所有基地记分完成后，清理 sys.scoredBaseIndices
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

function setupWithScoutOnBase(ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> {
    const core = SmashUpDomain.setup(ids, random);
    const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
    
    // 设置基地为母舰（breakpoint 20）
    core.bases[0].defId = 'base_the_mothership';
    
    // 玩家 0 的侦察兵在基地上
    core.bases[0].minions = [{
        uid: 'minion-scout-1',
        defId: 'alien_scout',
        owner: '0',
        controller: '0',
        basePower: 20, // 足够触发记分
        powerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    }];
    
    // 玩家 0 手牌为空（方便验证返回手牌）
    core.players['0'].hand = [];
    
    // 玩家 0 已选择派系（避免 factionSelect 阶段）
    core.players['0'].factions = ['aliens', 'dinosaurs'];
    core.players['1'].factions = ['pirates', 'ninjas'];
    core.factionSelection.completedPlayers = ['0', '1'];
    core.factionSelection.takenFactions = ['aliens', 'dinosaurs', 'pirates', 'ninjas'];
    
    // 设置阶段为 playCards（准备进入 scoreBases）
    sys.phase = 'playCards';
    
    return { sys, core };
}

function setupWithTwoScoutsOnBase(ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> {
    const core = SmashUpDomain.setup(ids, random);
    const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
    
    // 设置基地为母舰（breakpoint 20）
    core.bases[0].defId = 'base_the_mothership';
    
    // 玩家 0 的两个侦察兵在基地上
    core.bases[0].minions = [
        {
            uid: 'minion-scout-1',
            defId: 'alien_scout',
            owner: '0',
            controller: '0',
            basePower: 10,
            powerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        },
        {
            uid: 'minion-scout-2',
            defId: 'alien_scout',
            owner: '0',
            controller: '0',
            basePower: 10,
            powerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        },
    ];
    
    // 玩家 0 手牌为空
    core.players['0'].hand = [];
    
    // 玩家 0 已选择派系
    core.players['0'].factions = ['aliens', 'dinosaurs'];
    core.players['1'].factions = ['pirates', 'ninjas'];
    core.factionSelection.completedPlayers = ['0', '1'];
    core.factionSelection.takenFactions = ['aliens', 'dinosaurs', 'pirates', 'ninjas'];
    
    // 设置阶段为 playCards
    sys.phase = 'playCards';
    
    return { sys, core };
}

describe('Alien Scout - No Duplicate Scoring', () => {
    it('侦察兵 afterScoring 交互不会导致基地重复记分', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: setupWithScoutOnBase,
        });
        
        const result = runner.run({
            name: '侦察兵 afterScoring 不重复记分',
            commands: [
                // 执行 ADVANCE_PHASE 进入记分阶段
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 用户选择"返回手牌"
                { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: 'yes' } },
            ] as any[],
        });
        
        // 验证：测试应该通过
        expect(result.passed).toBe(true);
        
        // 验证：侦察兵应该返回手牌
        expect(result.finalState.core.players['0'].hand.length).toBe(1);
        expect(result.finalState.core.players['0'].hand[0].defId).toBe('alien_scout');
        
        // 验证：基地上的随从应该为 0
        expect(result.finalState.core.bases[0].minions.length).toBe(0);
        
        // 注意：scoredBaseIndices 是内部实现细节，在阶段推进完成后才会清理
        // 测试只关心最终结果：不会重复触发交互
        
        // 验证：不应该再有交互（不会重复触发）
        expect(result.finalState.sys.interaction.current).toBeUndefined();
        
        // 验证：手牌中只有 1 张侦察兵（不会重复返回）
        const scoutCount = result.finalState.core.players['0'].hand.filter(c => c.defId === 'alien_scout').length;
        expect(scoutCount).toBe(1);
    });
    
    it('多个侦察兵 afterScoring 交互不会导致基地重复记分', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: setupWithTwoScoutsOnBase,
        });
        
        const result = runner.run({
            name: '多个侦察兵 afterScoring 不重复记分',
            commands: [
                // 执行 ADVANCE_PHASE 进入记分阶段
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 用户选择"返回手牌"（第一个侦察兵）
                { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: 'yes' } },
                // 用户选择"返回手牌"（第二个侦察兵）
                { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: 'yes' } },
            ] as any[],
        });
        
        // 验证：测试应该通过
        expect(result.passed).toBe(true);
        
        // 验证：两个侦察兵都应该返回手牌
        expect(result.finalState.core.players['0'].hand.length).toBe(2);
        
        // 验证：手牌中有且仅有 2 张侦察兵（不会重复返回）
        const scoutCount = result.finalState.core.players['0'].hand.filter(c => c.defId === 'alien_scout').length;
        expect(scoutCount).toBe(2);
        
        // 注意：scoredBaseIndices 是内部实现细节，在阶段推进完成后才会清理
        // 测试只关心最终结果：不会重复触发交互
        
        // 验证：不应该再有交互
        expect(result.finalState.sys.interaction.current).toBeUndefined();
    });
});
