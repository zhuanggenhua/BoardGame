/**
 * Checkpoint 验证测试
 * 验证领域层核心功能是否正常工作
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { abilityExecutorRegistry } from '../domain/abilityExecutor';
import { ABILITY_IDS } from '../domain/ids';
import CardiaDomain from '../domain/index';

// 导入所有能力执行器（确保它们被注册）
import '../domain/abilities/group1-resources';
import '../domain/abilities/group2-modifiers';
import '../domain/abilities/group3-ongoing';
import '../domain/abilities/group4-card-ops';
import '../domain/abilities/group5-copy';
import '../domain/abilities/group6-special';
import '../domain/abilities/group7-faction';

describe('Checkpoint - 领域层实现完成', () => {
    // 创建正确的 RandomFn mock
    const mockRandom = {
        random: () => 0.5,
    };
    
    describe('能力执行器注册表', () => {
        it('应该注册所有 32 个能力执行器', () => {
            const allAbilityIds = Object.values(ABILITY_IDS);
            expect(allAbilityIds.length).toBe(32);
            
            // 检查每个能力是否已注册
            for (const abilityId of allAbilityIds) {
                expect(abilityExecutorRegistry.has(abilityId), `能力 ${abilityId} 应该已注册`).toBe(true);
            }
        });
        
        it('应该能够获取所有已注册的能力 ID', () => {
            const registeredIds = abilityExecutorRegistry.getRegisteredIds();
            expect(registeredIds instanceof Set).toBe(true);
            expect(registeredIds.size).toBeGreaterThanOrEqual(32);
        });
    });
    
    describe('CardiaDomain 核心功能', () => {
        it('应该有正确的 gameId', () => {
            expect(CardiaDomain.gameId).toBe('cardia');
        });
        
        it('应该能够初始化游戏状态', () => {
            const state = CardiaDomain.setup(['player1', 'player2'], mockRandom);
            
            // 验证基本结构
            expect(state.players).toBeDefined();
            expect(state.playerOrder).toEqual(['player1', 'player2']);
            expect(state.currentPlayerId).toBe('player1');
            expect(state.turnNumber).toBe(1);
            expect(state.phase).toBe('play');
            
            // 验证能力系统状态
            expect(state.ongoingAbilities).toEqual([]);
            expect(state.modifierTokens).toEqual([]);
            expect(state.delayedEffects).toEqual([]);
            expect(state.revealFirstNextEncounter).toBeNull();
            expect(state.mechanicalSpiritActive).toBeNull();
            
            // 验证玩家状态
            expect(state.players['player1']).toBeDefined();
            expect(state.players['player2']).toBeDefined();
            expect(state.players['player1'].hand.length).toBe(5);
            expect(state.players['player2'].hand.length).toBe(5);
        });
        
        it('应该有 validate 函数', () => {
            expect(CardiaDomain.validate).toBeDefined();
            expect(typeof CardiaDomain.validate).toBe('function');
        });
        
        it('应该有 execute 函数', () => {
            expect(CardiaDomain.execute).toBeDefined();
            expect(typeof CardiaDomain.execute).toBe('function');
        });
        
        it('应该有 reduce 函数', () => {
            expect(CardiaDomain.reduce).toBeDefined();
            expect(typeof CardiaDomain.reduce).toBe('function');
        });
        
        it('应该有 isGameOver 函数', () => {
            expect(CardiaDomain.isGameOver).toBeDefined();
            expect(typeof CardiaDomain.isGameOver).toBe('function');
        });
    });
    
    describe('胜利条件检测', () => {
        it('应该在没有玩家获胜时返回 undefined', () => {
            const state = CardiaDomain.setup(['player1', 'player2'], mockRandom);
            
            const result = CardiaDomain.isGameOver!(state);
            expect(result).toBeUndefined();
        });
        
        it('应该在玩家达到目标印戒数时返回获胜者', () => {
            const state = CardiaDomain.setup(['player1', 'player2'], mockRandom);
            
            // ⚠️ 修复：标准印戒胜利条件只在阶段3（回合结束阶段）检查
            state.phase = 'end';
            
            // 模拟玩家1获得5个印戒
            state.players['player1'].playedCards = [
                { uid: 'card1', defId: 'test', baseInfluence: 5, signets: 5, slotIndex: 0 } as any,
            ];
            
            const result = CardiaDomain.isGameOver!(state);
            expect(result).toBeDefined();
            expect(result?.winner).toBe('player1');
        });
        
        it('应该在玩家无法出牌时返回对手获胜', () => {
            const state = CardiaDomain.setup(['player1', 'player2'], mockRandom);
            
            // 模拟玩家1手牌和牌库都为空
            state.players['player1'].hand = [];
            state.players['player1'].deck = [];
            
            const result = CardiaDomain.isGameOver!(state);
            expect(result).toBeDefined();
            expect(result?.winner).toBe('player2');
        });
    });
});
