/**
 * 测试：end 阶段印戒胜利条件检测
 * 
 * 验证修复：在 end 阶段自动推进到下一回合之前，应该检测到印戒胜利条件
 */

import { describe, it, expect } from 'vitest';
import CardiaDomain from '../domain';
import type { CardiaCore } from '../domain/types';

describe('End 阶段印戒胜利条件检测', () => {
    it('应该在 end 阶段检测到玩家达到 5 个印戒', () => {
        // 构造场景：玩家 0 有 5 个印戒，阶段为 end
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [
                        { uid: 'c1', defId: 'deck_i_card_01', baseInfluence: 1, currentInfluence: 1, signets: 1, faction: 'forest' },
                        { uid: 'c2', defId: 'deck_i_card_02', baseInfluence: 2, currentInfluence: 2, signets: 1, faction: 'forest' },
                        { uid: 'c3', defId: 'deck_i_card_03', baseInfluence: 3, currentInfluence: 3, signets: 1, faction: 'forest' },
                        { uid: 'c4', defId: 'deck_i_card_04', baseInfluence: 4, currentInfluence: 4, signets: 1, faction: 'forest' },
                        { uid: 'c5', defId: 'deck_i_card_05', baseInfluence: 5, currentInfluence: 5, signets: 1, faction: 'forest' },
                    ],
                    currentCard: null,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [
                        { uid: 'c6', defId: 'deck_i_card_06', baseInfluence: 6, currentInfluence: 6, signets: 1, faction: 'swamp' },
                    ],
                    currentCard: null,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 3,
            phase: 'end',  // 关键：阶段为 end
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        // 调用 isGameOver
        const result = CardiaDomain.isGameOver!(core);
        
        // 验证：应该检测到玩家 0 获胜
        expect(result).toBeDefined();
        expect(result?.winner).toBe('0');
        
        console.log('✅ 测试通过：end 阶段印戒胜利条件被正确检测');
    });
    
    it('应该在 end 阶段检测到双方都达到 5 个印戒时的平局', () => {
        // 构造场景：双方都有 5 个印戒，阶段为 end
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [
                        { uid: 'c1', defId: 'deck_i_card_01', baseInfluence: 1, currentInfluence: 1, signets: 1, faction: 'forest' },
                        { uid: 'c2', defId: 'deck_i_card_02', baseInfluence: 2, currentInfluence: 2, signets: 1, faction: 'forest' },
                        { uid: 'c3', defId: 'deck_i_card_03', baseInfluence: 3, currentInfluence: 3, signets: 1, faction: 'forest' },
                        { uid: 'c4', defId: 'deck_i_card_04', baseInfluence: 4, currentInfluence: 4, signets: 1, faction: 'forest' },
                        { uid: 'c5', defId: 'deck_i_card_05', baseInfluence: 5, currentInfluence: 5, signets: 1, faction: 'forest' },
                    ],
                    currentCard: null,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [
                        { uid: 'c6', defId: 'deck_i_card_06', baseInfluence: 6, currentInfluence: 6, signets: 1, faction: 'swamp' },
                        { uid: 'c7', defId: 'deck_i_card_07', baseInfluence: 7, currentInfluence: 7, signets: 1, faction: 'swamp' },
                        { uid: 'c8', defId: 'deck_i_card_08', baseInfluence: 8, currentInfluence: 8, signets: 1, faction: 'swamp' },
                        { uid: 'c9', defId: 'deck_i_card_09', baseInfluence: 9, currentInfluence: 9, signets: 1, faction: 'swamp' },
                        { uid: 'c10', defId: 'deck_i_card_10', baseInfluence: 10, currentInfluence: 10, signets: 1, faction: 'swamp' },
                    ],
                    currentCard: null,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 3,
            phase: 'end',  // 关键：阶段为 end
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        // 调用 isGameOver
        const result = CardiaDomain.isGameOver!(core);
        
        // 验证：应该检测到平局
        expect(result).toBeDefined();
        expect(result?.draw).toBe(true);
        
        console.log('✅ 测试通过：end 阶段双方达到 5 个印戒时正确判定为平局');
    });
    
    it('应该在 play 阶段不触发印戒胜利条件（即使有 5 个印戒）', () => {
        // 构造场景：玩家 0 有 5 个印戒，但阶段为 play，且双方都有手牌（不触发"无牌可打"胜利条件）
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [{ uid: 'h1', defId: 'deck_i_card_01', baseInfluence: 1, currentInfluence: 1, signets: 0, faction: 'forest' }],
                    deck: [],
                    discard: [],
                    playedCards: [
                        { uid: 'c1', defId: 'deck_i_card_01', baseInfluence: 1, currentInfluence: 1, signets: 1, faction: 'forest' },
                        { uid: 'c2', defId: 'deck_i_card_02', baseInfluence: 2, currentInfluence: 2, signets: 1, faction: 'forest' },
                        { uid: 'c3', defId: 'deck_i_card_03', baseInfluence: 3, currentInfluence: 3, signets: 1, faction: 'forest' },
                        { uid: 'c4', defId: 'deck_i_card_04', baseInfluence: 4, currentInfluence: 4, signets: 1, faction: 'forest' },
                        { uid: 'c5', defId: 'deck_i_card_05', baseInfluence: 5, currentInfluence: 5, signets: 1, faction: 'forest' },
                    ],
                    currentCard: null,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [{ uid: 'h2', defId: 'deck_i_card_06', baseInfluence: 6, currentInfluence: 6, signets: 0, faction: 'swamp' }],
                    deck: [],
                    discard: [],
                    playedCards: [],
                    currentCard: null,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 3,
            phase: 'play',  // 关键：阶段为 play
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        // 调用 isGameOver
        const result = CardiaDomain.isGameOver!(core);
        
        // 验证：play 阶段不应该触发印戒胜利条件（因为双方都有手牌，不触发"无牌可打"胜利条件）
        expect(result).toBeUndefined();
        
        console.log('✅ 测试通过：play 阶段不触发印戒胜利条件');
    });
});
