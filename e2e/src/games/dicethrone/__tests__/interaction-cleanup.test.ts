/**
 * 交互清理测试
 * 验证所有响应交互的命令都生成 INTERACTION_COMPLETED 事件
 */

import { describe, it, expect } from 'vitest';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import type { RandomFn } from '../../../engine/types';

describe('Interaction Cleanup', () => {
    const mockRandom: RandomFn = {
        random: () => 0.5,
        d: (max) => Math.ceil(max / 2),
    };
    
    const createMockState = (): { core: DiceThroneCore; sys?: { phase?: string } } => ({
        core: {
            players: {
                '0': {
                    characterId: 'monk',
                    resources: { hp: 50, cp: 5 },
                    statusEffects: { poison: 2 },
                    tokens: {},
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                },
                '1': {
                    characterId: 'barbarian',
                    resources: { hp: 50, cp: 5 },
                    statusEffects: {},
                    tokens: {},
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                },
            },
            dice: [
                { id: 0, value: 3, symbol: 'fist', isKept: false },
                { id: 1, value: 3, symbol: 'fist', isKept: false },
                { id: 2, value: 3, symbol: 'fist', isKept: false },
                { id: 3, value: 3, symbol: 'fist', isKept: false },
                { id: 4, value: 3, symbol: 'fist', isKept: false },
            ],
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: false,
            rollDiceCount: 5,
            activePlayerId: '0',
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            hostPlayerId: '0',
            hostStarted: false,
            readyPlayers: {},
            tokenDefinitions: [],
        },
        sys: { phase: 'offensiveRoll' },
    });

    it('MODIFY_DIE 命令生成 DIE_MODIFIED 事件（交互完成由 systems 层自动处理）', () => {
        const state = createMockState();
        const command: DiceThroneCommand = {
            type: 'MODIFY_DIE',
            playerId: '0',
            payload: { dieId: 0, newValue: 6 },
            timestamp: Date.now(),
        };

        const events = execute(state, command, mockRandom);

        // 验证生成了 DIE_MODIFIED 事件
        expect(events.some(e => e.type === 'DIE_MODIFIED')).toBe(true);
        
        // INTERACTION_COMPLETED 不再由 execute 层生成
        // 骰子交互完成由 systems.ts 的 afterEvents 自动处理（达到 selectCount 时触发）
        expect(events.some(e => e.type === 'INTERACTION_COMPLETED')).toBe(false);
    });

    it('REROLL_DIE 命令生成 DIE_REROLLED 事件（交互完成由 systems 层自动处理）', () => {
        const state = createMockState();
        const command: DiceThroneCommand = {
            type: 'REROLL_DIE',
            playerId: '0',
            payload: { dieId: 0 },
            timestamp: Date.now(),
        };

        const events = execute(state, command, mockRandom);

        // 验证生成了 DIE_REROLLED 事件
        expect(events.some(e => e.type === 'DIE_REROLLED')).toBe(true);
        
        // INTERACTION_COMPLETED 不再由 execute 层生成
        // 骰子交互完成由 systems.ts 的 afterEvents 自动处理（达到 selectCount 时触发）
        expect(events.some(e => e.type === 'INTERACTION_COMPLETED')).toBe(false);
    });

    it('REMOVE_STATUS 命令生成业务事件（交互完成由 systems 层自动处理）', () => {
        const state = createMockState();
        const command: DiceThroneCommand = {
            type: 'REMOVE_STATUS',
            playerId: '0',
            payload: { targetPlayerId: '0', statusId: 'poison' },
            timestamp: Date.now(),
        };

        const events = execute(state, command, mockRandom);

        // 验证生成了 STATUS_REMOVED 事件
        expect(events.some(e => e.type === 'STATUS_REMOVED')).toBe(true);
        
        // INTERACTION_COMPLETED 不再由 execute 层生成
        // 状态交互完成由 systems.ts 的 afterEvents 自动处理（检测到 STATUS_REMOVED 时触发）
        // 这确保 interactionId 与 ResponseWindowSystem 的 interactionLock 匹配
        expect(events.some(e => e.type === 'INTERACTION_COMPLETED')).toBe(false);
    });

    it('TRANSFER_STATUS 命令生成业务事件（交互完成由 systems 层自动处理）', () => {
        const state = createMockState();
        const command: DiceThroneCommand = {
            type: 'TRANSFER_STATUS',
            playerId: '0',
            payload: { fromPlayerId: '0', toPlayerId: '1', statusId: 'poison' },
            timestamp: Date.now(),
        };

        const events = execute(state, command, mockRandom);

        // 验证生成了 STATUS_REMOVED 事件（移除源玩家的状态）
        expect(events.some(e => e.type === 'STATUS_REMOVED')).toBe(true);
        
        // 验证生成了 STATUS_APPLIED 事件（添加到目标玩家）
        expect(events.some(e => e.type === 'STATUS_APPLIED')).toBe(true);
        
        // INTERACTION_COMPLETED 不再由 execute 层生成
        // 状态交互完成由 systems.ts 的 afterEvents 自动处理
        expect(events.some(e => e.type === 'INTERACTION_COMPLETED')).toBe(false);
    });

    it('INTERACTION_CANCELLED 事件返还卡牌和 CP', () => {
        const state = createMockState();
        const cardId = 'test-card-1';
        
        // 模拟卡牌已打出：从手牌移到弃牌堆，扣除 CP
        state.core.players['0'].hand = [];
        state.core.players['0'].discard = [{ id: cardId, uid: 'uid-1', defId: 'test-card' }];
        state.core.players['0'].resources.cp = 3; // 原本 5 CP，扣除 2 CP
        
        const event: DiceThroneEvent = {
            type: 'INTERACTION_CANCELLED',
            payload: {
                playerId: '0',
                sourceCardId: cardId,
                cpCost: 2,
            },
            sourceCommandType: 'SYS_INTERACTION_CANCEL', // 已迁移到 InteractionSystem
            timestamp: Date.now(),
        };
        
        const newState = reduce(state.core, event);
        
        // 卡牌应该回到手牌
        expect(newState.players['0'].hand).toHaveLength(1);
        expect(newState.players['0'].hand[0].id).toBe(cardId);
        
        // 弃牌堆应该清空
        expect(newState.players['0'].discard).toHaveLength(0);
        
        // CP 应该返还
        expect(newState.players['0'].resources.cp).toBe(5);
    });
});
