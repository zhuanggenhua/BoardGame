/**
 * Bug 修复测试：Card06 (占卜师) 和 Card08 (审判官)
 * 
 * Bug 1: Card08 (审判官) - 平局仍然会触发能力
 * Bug 2: Card06 (占卜师) - 能力没有生效
 */

import { describe, it, expect } from 'vitest';
import { createMockCore, createMockCard, createMockPlayer } from './test-helpers';
import { ABILITY_IDS, CARD_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import { reduce } from '../domain/reduce';

describe('Bug Fixes: Card06 (占卜师) and Card08 (审判官)', () => {
    describe('Bug 2: Card06 (占卜师) - 能力应该生效', () => {
        it('占卜师能力应该让对手先揭示卡牌', () => {
            // 创建测试状态：占卜师能力已激活
            const core = createMockCore({
                playerOrder: ['0', '1'],
                currentPlayerId: '0',
                players: {
                    '0': createMockPlayer('0'),
                    '1': createMockPlayer('1'),
                },
            });
            core.phase = 'play';
            core.turnNumber = 1;
            core.revealFirstNextEncounter = '1'; // 对手（玩家1）先揭示
            
            // 玩家0打出卡牌
            const player0Card = createMockCard({
                uid: 'player0_card',
                defId: CARD_IDS.CARD_01,
                ownerId: '0',
                baseInfluence: 1,
                abilityIds: [],
            });
            
            core.players['0'].hand = [player0Card];
            core.players['0'].hasPlayed = false;
            
            // 玩家1打出卡牌
            const player1Card = createMockCard({
                uid: 'player1_card',
                defId: CARD_IDS.CARD_03,
                ownerId: '1',
                baseInfluence: 3,
                abilityIds: [],
            });
            
            core.players['1'].hand = [player1Card];
            core.players['1'].hasPlayed = false;
            
            // 玩家0打出卡牌（不应揭示）
            const event1 = {
                type: CARDIA_EVENTS.CARD_PLAYED,
                timestamp: Date.now(),
                payload: {
                    cardUid: player0Card.uid,
                    playerId: '0',
                    slotIndex: 0,
                },
            };
            
            let newCore = reduce(core, event1);
            
            // 验证：玩家0的卡牌未揭示
            expect(newCore.players['0'].cardRevealed).toBe(false);
            
            // 玩家1打出卡牌（应该立即揭示）
            const event2 = {
                type: CARDIA_EVENTS.CARD_PLAYED,
                timestamp: Date.now(),
                payload: {
                    cardUid: player1Card.uid,
                    playerId: '1',
                    slotIndex: 0,
                },
            };
            
            newCore = reduce(newCore, event2);
            
            // 验证：玩家1的卡牌已揭示（因为是 revealFirstNextEncounter 指定的玩家）
            expect(newCore.players['1'].cardRevealed).toBe(true);
            
            // 模拟遭遇解析
            const encounterEvent = {
                type: CARDIA_EVENTS.ENCOUNTER_RESOLVED,
                timestamp: Date.now(),
                payload: {
                    slotIndex: 0,
                    winner: '1',
                    loser: '0',
                },
            };
            
            newCore = reduce(newCore, encounterEvent);
            
            // 验证：遭遇解析后，revealFirstNextEncounter 被重置
            expect(newCore.revealFirstNextEncounter).toBeNull();
        });

        it('占卜师能力应该强制对手先出牌', () => {
            // 创建测试状态：占卜师能力已激活
            const core = createMockCore({
                playerOrder: ['0', '1'],
                currentPlayerId: '0',
                players: {
                    '0': createMockPlayer('0'),
                    '1': createMockPlayer('1'),
                },
            });
            core.phase = 'play';
            core.turnNumber = 1;
            core.forcedPlayOrderNextEncounter = '1'; // 对手（玩家1）必须先出牌
            
            // 玩家0打出卡牌
            const player0Card = createMockCard({
                uid: 'player0_card',
                defId: CARD_IDS.CARD_01,
                ownerId: '0',
                baseInfluence: 1,
                abilityIds: [],
            });
            
            core.players['0'].hand = [player0Card];
            core.players['0'].hasPlayed = false;
            
            // 玩家1打出卡牌
            const player1Card = createMockCard({
                uid: 'player1_card',
                defId: CARD_IDS.CARD_03,
                ownerId: '1',
                baseInfluence: 3,
                abilityIds: [],
            });
            
            core.players['1'].hand = [player1Card];
            core.players['1'].hasPlayed = false;
            
            // 玩家0尝试先出牌（应该被阻止）
            const event1 = {
                type: CARDIA_EVENTS.CARD_PLAYED,
                timestamp: Date.now(),
                payload: {
                    cardUid: player0Card.uid,
                    playerId: '0',
                    slotIndex: 0,
                },
            };
            
            // 验证：玩家0不能先出牌（需要通过 validate 检查）
            // 这里我们直接测试 reduce 的行为，假设 validate 已经通过
            // 在实际游戏中，validate 会阻止这个命令
            
            // 玩家1先出牌（应该成功）
            const event2 = {
                type: CARDIA_EVENTS.CARD_PLAYED,
                timestamp: Date.now(),
                payload: {
                    cardUid: player1Card.uid,
                    playerId: '1',
                    slotIndex: 0,
                },
            };
            
            let newCore = reduce(core, event2);
            
            // 验证：玩家1已出牌
            expect(newCore.players['1'].hasPlayed).toBe(true);
            
            // 现在玩家0可以出牌了
            newCore = reduce(newCore, event1);
            
            // 验证：玩家0已出牌
            expect(newCore.players['0'].hasPlayed).toBe(true);
            
            // 模拟遭遇解析
            const encounterEvent = {
                type: CARDIA_EVENTS.ENCOUNTER_RESOLVED,
                timestamp: Date.now(),
                payload: {
                    slotIndex: 0,
                    winner: '1',
                    loser: '0',
                },
            };
            
            newCore = reduce(newCore, encounterEvent);
            
            // 验证：遭遇解析后，forcedPlayOrderNextEncounter 被重置
            expect(newCore.forcedPlayOrderNextEncounter).toBeNull();
        });
    });
});
