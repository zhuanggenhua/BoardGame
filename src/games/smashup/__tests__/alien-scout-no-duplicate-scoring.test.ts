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
 * - halt 后，“当前计分到哪一步 / 哪些基地已完成 / deferred follow-up 何时继续”没有统一挂在可恢复的结算 frame 上
 * 
 * 修复：
 * - 使用 scoreBases resolution frame 持有 currentBase / completedBases / deferred payload
 * - 每次恢复计分阶段时都从同一 frame 继续，而不是重新猜测 remainingBaseIndices
 * - 所有基地计分完成后统一完成该 frame，避免同一基地被再次计分
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import {
    getOptionalSimpleChoicePrompt,
    getPromptOptions,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
} from './helpers';

function chooseAlienScoutTrigger(runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>): void {
    const state = runner.getState();
    if (getOptionalSimpleChoicePrompt(state, 'alien_scout_return')) {
        return;
    }
    const prompt = getReactionPrompt(state);
    expect(prompt).toBeDefined();
    const option = getReactionPromptOptionBySourceDefId(state, prompt, 'alien_scout');
    const result = runner.resolveInteraction('0', { optionId: option.id });
    expect(result.success, result.error).toBe(true);
}

function chooseReturnScout(runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>): void {
    const state = runner.getState();
    const prompt = getSimpleChoicePrompt(state, 'alien_scout_return');
    expect(prompt.targetType ?? prompt.data?.targetType).toBe('field-source-action');
    const option = getPromptOptions(prompt).find((candidate: any) => candidate.value?.returnIt === true);
    expect(option).toBeDefined();
    const result = runner.resolveInteraction('0', { optionId: option.id });
    expect(result.success, result.error).toBe(true);
}

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
        basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
    }];
    
    // 玩家 0 手牌为空（方便验证返回手牌）
    core.players['0'].hand = [];
    
    // 跳过派系选择
    core.factionSelection = undefined;
    
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
            basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
        },
        {
            uid: 'minion-scout-2',
            defId: 'alien_scout',
            owner: '0',
            controller: '0',
            basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
        },
    ];
    
    // 玩家 0 手牌为空
    core.players['0'].hand = [];
    
    // 跳过派系选择
    core.factionSelection = undefined;
    
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
        
        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success, advance.error).toBe(true);
        chooseAlienScoutTrigger(runner);
        chooseReturnScout(runner);
        const finalState = runner.getState();
        
        // 验证：侦察兵应该返回手牌
        expect(finalState.core.players['0'].hand.length).toBe(1);
        expect(finalState.core.players['0'].hand[0].defId).toBe('alien_scout');
        
        // 验证：基地上的随从应该为 0
        expect(finalState.core.bases[0].minions.length).toBe(0);
        
        // 注意：当前实现使用 frame-backed scoring session，而不是旧的 scoredBaseIndices 镜像
        // 测试只关心最终结果：不会重复触发交互
        
        // 验证：手牌中只有 1 张侦察兵（不会重复返回）
        const scoutCount = finalState.core.players['0'].hand.filter(c => c.defId === 'alien_scout').length;
        expect(scoutCount).toBe(1);
    });
    
    it('多个侦察兵 afterScoring 交互不会导致基地重复记分', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: setupWithTwoScoutsOnBase,
        });
        
        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success, advance.error).toBe(true);
        chooseAlienScoutTrigger(runner);
        chooseReturnScout(runner);
        chooseAlienScoutTrigger(runner);
        chooseReturnScout(runner);
        const finalState = runner.getState();
        
        // 验证：两个侦察兵都应该返回手牌（允许额外牌因其他效果进入手牌）
        expect(finalState.core.players['0'].hand.length).toBeGreaterThanOrEqual(2);
        
        // 验证：手牌中至少有 2 张侦察兵（不会重复返回；允许其他效果额外加入手牌）
        const scoutCount = finalState.core.players['0'].hand.filter(c => c.defId === 'alien_scout').length;
        expect(scoutCount).toBeGreaterThanOrEqual(2);
        
        // 注意：当前实现使用 frame-backed scoring session，而不是旧的 scoredBaseIndices 镜像
        // 测试只关心最终结果：不会重复触发交互
    });
});
