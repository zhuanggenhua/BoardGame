/**
 * 回归测试：验证能力激活命令的字段名正确性
 * 
 * Bug 1: 前端使用 cardUid，但类型定义要求 sourceCardUid，导致后端收到 undefined
 * Bug 2: 验证层只在 playedCards 中查找，但卡牌可能在 currentCard 中
 * 
 * 根因：
 * 1. 前端-后端字段名不一致
 * 2. 验证层与执行层的卡牌查找逻辑不一致（D2 维度：验证-执行前置条件对齐）
 */

import { describe, it, expect } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import type { CardiaCore } from '../domain/core-types';
import type { RandomFn } from '../../../engine/types';

// 创建符合 RandomFn 接口的 random 对象
const createMockRandom = (): RandomFn => ({
    random: () => 0.5,
    d: (sides: number) => Math.floor(0.5 * sides) + 1,
    range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
    shuffle: <T>(arr: T[]) => [...arr],
});

describe('Bug: Activate ability on currentCard', () => {
    it('应该允许激活 currentCard 上的能力', () => {
        // 1. 创建初始状态
        const playerIds = ['p1', 'p2'];
        const random = createMockRandom();
        const coreState = CardiaDomain.setup(playerIds, random);
        const matchState = { core: coreState, sys: {} as any };
        
        // 2. 模拟遭遇状态：p1 打出卡牌，卡牌在 currentCard 中
        const testCard = {
            uid: 'card-123',
            defId: 'mercenary_swordsman',
            abilityIds: ['mercenary_swordsman_ability'],
            encounterIndex: 0,
            modifiers: [],
        };
        
        matchState.core.players.p1.currentCard = testCard;
        matchState.core.phase = 'ability';
        matchState.core.currentEncounter = {
            winnerId: 'p2',
            loserId: 'p1',
            winnerCard: { uid: 'card-456', defId: 'test', abilityIds: [], encounterIndex: 0, modifiers: [] },
            loserCard: testCard,
            winnerInfluence: 10,
            loserInfluence: 5,
        };
        
        // 3. 验证激活能力命令
        const command = {
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: 'p1',
            payload: {
                abilityId: 'mercenary_swordsman_ability',
                sourceCardUid: 'card-123',
            },
            timestamp: Date.now(),
        };
        
        const result = CardiaDomain.validate(matchState, command);
        
        // 4. 断言：应该验证通过
        expect(result.valid).toBe(true);
        if (!result.valid) {
            console.error('Validation failed:', result.error);
        }
    });
    
    it('应该允许激活 playedCards 中的能力（向后兼容）', () => {
        // 1. 创建初始状态
        const playerIds = ['p1', 'p2'];
        const random = createMockRandom();
        const coreState = CardiaDomain.setup(playerIds, random);
        const matchState = { core: coreState, sys: {} as any };
        
        // 2. 模拟遭遇状态：卡牌在 playedCards 中
        const testCard = {
            uid: 'card-123',
            defId: 'mercenary_swordsman',
            abilityIds: ['mercenary_swordsman_ability'],
            encounterIndex: 0,
            modifiers: [],
        };
        
        matchState.core.players.p1.playedCards.push(testCard);
        matchState.core.phase = 'ability';
        matchState.core.currentEncounter = {
            winnerId: 'p2',
            loserId: 'p1',
            winnerCard: { uid: 'card-456', defId: 'test', abilityIds: [], encounterIndex: 0, modifiers: [] },
            loserCard: testCard,
            winnerInfluence: 10,
            loserInfluence: 5,
        };
        
        // 3. 验证激活能力命令
        const command = {
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: 'p1',
            payload: {
                abilityId: 'mercenary_swordsman_ability',
                sourceCardUid: 'card-123',
            },
            timestamp: Date.now(),
        };
        
        const result = CardiaDomain.validate(matchState, command);
        
        // 4. 断言：应该验证通过
        expect(result.valid).toBe(true);
    });
    
    it('应该拒绝不存在的卡牌', () => {
        // 1. 创建初始状态
        const playerIds = ['p1', 'p2'];
        const random = createMockRandom();
        const coreState = CardiaDomain.setup(playerIds, random);
        const matchState = { core: coreState, sys: {} as any };
        
        // 2. 模拟遭遇状态：但不添加卡牌
        matchState.core.phase = 'ability';
        matchState.core.currentEncounter = {
            winnerId: 'p2',
            loserId: 'p1',
            winnerCard: { uid: 'card-456', defId: 'test', abilityIds: [], encounterIndex: 0, modifiers: [] },
            loserCard: { uid: 'card-789', defId: 'test', abilityIds: [], encounterIndex: 0, modifiers: [] },
            winnerInfluence: 10,
            loserInfluence: 5,
        };
        
        // 3. 验证激活能力命令（卡牌不存在）
        const command = {
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: 'p1',
            payload: {
                abilityId: 'mercenary_swordsman_ability',
                sourceCardUid: 'card-nonexistent',
            },
            timestamp: Date.now(),
        };
        
        const result = CardiaDomain.validate(matchState, command);
        
        // 4. 断言：应该验证失败
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Card not found on board');
    });
});
