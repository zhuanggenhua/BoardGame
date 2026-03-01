/**
 * 虚空法师交互测试
 * 验证虚空法师能力是否正确创建交互界面
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ABILITY_IDS } from '../domain/ids';
import { abilityExecutorRegistry, initializeAbilityExecutors } from '../domain/abilityExecutor';
import type { CardiaCore } from '../domain/core-types';
import type { CardiaAbilityContext } from '../domain/abilityExecutor';

describe('虚空法师交互测试', () => {
    let mockCore: CardiaCore;
    let mockContext: CardiaAbilityContext;

    beforeAll(async () => {
        // 初始化所有能力执行器
        await initializeAbilityExecutors();
    });

    beforeEach(() => {
        mockCore = {
            turnNumber: 1,
            phase: 'ability',
            players: {
                '0': {
                    playerId: '0',
                    hand: [],
                    playedCards: [
                        {
                            uid: 'played1',
                            defId: 'deck_i_card_02',
                            encounterIndex: 1,
                        }
                    ],
                    discard: [],
                    signets: 0,
                },
                '1': {
                    playerId: '1',
                    hand: [],
                    playedCards: [
                        {
                            uid: 'played2',
                            defId: 'deck_i_card_16',
                            encounterIndex: 1,
                        }
                    ],
                    discard: [],
                    signets: 0,
                },
            },
            modifierTokens: [
                { cardId: 'played2', value: 5, source: 'test_source', timestamp: Date.now() }
            ],
            ongoingAbilities: [],
            currentEncounter: {
                encounterIndex: 1,
                winnerId: '1',
                loserId: '0',
                isTie: false,
            },
        } as any;

        mockContext = {
            core: mockCore,
            playerId: '0',
            opponentId: '1',
            cardId: 'played1',
            abilityId: ABILITY_IDS.VOID_MAGE,
            timestamp: Date.now(),
        };
    });

    it('应该创建交互界面让玩家选择目标卡牌', () => {
        const executorFn = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE);
        expect(executorFn).toBeDefined();
        
        const result = executorFn!(mockContext);

        // 验证返回了交互而不是事件
        expect(result.interaction).toBeDefined();
        expect(result.events).toEqual([]);

        // 验证交互的基本属性
        expect(result.interaction!.type).toBe('card_selection');
        expect(result.interaction!.playerId).toBe('0');
        expect((result.interaction as any).minSelect).toBe(1);
        expect((result.interaction as any).maxSelect).toBe(1);

        // 验证可选卡牌列表包含有标记的卡牌
        expect((result.interaction as any).availableCards).toContain('played2');
    });

    it('选择目标卡牌后应该移除标记', () => {
        // 第二次调用，传入选中的卡牌
        const contextWithSelection = {
            ...mockContext,
            selectedCardId: 'played2',
        };

        const executorFn = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE);
        expect(executorFn).toBeDefined();
        
        const result = executorFn!(contextWithSelection);

        // 验证生成了移除标记的事件
        expect(result.events.length).toBeGreaterThan(0);
        expect(result.interaction).toBeUndefined();

        // 验证事件类型（使用完整的事件类型名）
        const removeEvent = result.events.find(e => e.type === 'cardia:modifier_token_removed');
        expect(removeEvent).toBeDefined();
        expect((removeEvent as any).payload.cardId).toBe('played2');
    });

    it('没有标记时不应该创建交互', () => {
        // 移除所有标记
        mockCore.modifierTokens = [];
        mockCore.ongoingAbilities = [];

        const executorFn = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE);
        expect(executorFn).toBeDefined();
        
        const result = executorFn!(mockContext);

        // 验证没有交互也没有事件
        expect(result.events).toEqual([]);
        expect(result.interaction).toBeUndefined();
    });
});
