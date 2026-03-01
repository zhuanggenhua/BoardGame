/**
 * 测试 scoreBases 阶段的自动推进逻辑
 * 
 * 场景：
 * 1. 基地计分后有交互（如托尔图加 afterScoring）
 * 2. 交互解决后应该自动推进到 draw 阶段，不需要再次点击"结束回合"
 */

import { describe, it, expect } from 'vitest';
import { smashUpFlowHooks } from '../domain/index';
import type { MatchState } from '../../../core/types';
import type { SmashUpCore, PlayerState, BaseInPlay, MinionOnBase } from '../types';

/** 构造最小 SmashUpCore 用于测试 */
function makeMinimalCore(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    const defaultPlayer: PlayerState = {
        id: '0',
        factionIds: ['robot'],
        hand: [],
        deck: [],
        discard: [],
        vp: 0,
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
    };
    
    return {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        turnNumber: 1,
        players: {
            '0': defaultPlayer,
            '1': { ...defaultPlayer, id: '1', factionIds: ['pirate'] },
        },
        bases: [],
        baseDeck: [],
        nextUid: 1000,
        ...overrides,
    };
}

/** 构造基地 */
function makeBase(defId: string, minions: MinionOnBase[] = []): BaseInPlay {
    return {
        defId,
        minions,
        ongoingActions: [],
    };
}

/** 构造随从 */
function makeMinion(owner: string, defId: string, power: number): MinionOnBase {
    return {
        uid: `minion_${Math.random()}`,
        defId,
        owner,
        controller: owner,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

describe('scoreBases 阶段自动推进', () => {
    it('交互解决后应该自动推进到 draw 阶段', () => {
        // 创建一个基地达到临界点的状态
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5), // 力量 5
            ])],
        });
        
        // 模拟 flowHalted=true 且交互已解决的状态
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: true, // 上一轮 onPhaseExit 返回了 halt
                interaction: { current: null, queue: [] }, // 交互已解决
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 autoContinue=true
        expect(result).toBeDefined();
        expect(result?.autoContinue).toBe(true);
        expect(result?.playerId).toBe('0');
    });
    
    it('没有 eligible 基地时应该自动推进', () => {
        // 创建一个没有基地达到临界点的状态
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 2), // 力量 2，未达到临界点
            ])],
        });
        
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 autoContinue=true
        expect(result).toBeDefined();
        expect(result?.autoContinue).toBe(true);
    });
    
    it('有 eligible 基地但未开始计分时不应该自动推进', () => {
        // 创建一个基地达到临界点的状态
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5), // 力量 5
            ])],
            scoringEligibleBaseIndices: [0], // 锁定的 eligible 基地列表
        });
        
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: false, // 未开始计分
                interaction: { current: null, queue: [] },
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 undefined（不自动推进）
        expect(result).toBeUndefined();
    });
    
    it('有交互时不应该自动推进', () => {
        // 创建一个有交互的状态
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5),
            ])],
        });
        
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: true,
                interaction: {
                    current: {
                        id: 'test_interaction',
                        playerId: '0',
                        type: 'simple-choice',
                        data: { title: '测试交互', options: [] },
                    },
                    queue: [],
                },
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 undefined（不自动推进，因为有交互）
        expect(result).toBeUndefined();
    });
});
