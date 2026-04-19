/**
 * Card16 精灵 - 印戒授予测试
 * 
 * 测试场景：
 * - 遭遇 4：P0 Card 15 (Inventor) vs P1 Card 16 (Elf)
 *   - P1 获胜，Card 16 应该获得 1 枚基础印戒
 * 
 * 验证：Card 16 获得了基础印戒
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import type { CardiaCoreState } from '../domain/core-types';
import type { PlayedCard } from '../domain/core-types';

describe('Card16 Elf - Signet Grant', () => {
    it('遭遇 4：Card 16 (Elf) 获胜后应该获得基础印戒', () => {
        const runner = new GameTestRunner({
            domain: CardiaDomain,
            playerIds: ['0', '1'],
        });
        
        // 直接修改状态，设置遭遇 4 的初始状态
        const state = runner.getState();
        const core = state.core as CardiaCoreState;
        
        // 清空初始手牌和牌库
        core.players['0'].hand = [];
        core.players['0'].deck = [];
        core.players['1'].hand = [];
        core.players['1'].deck = [];
        
        // 设置遭遇 4 的初始状态
        core.turnNumber = 5;
        core.phase = 'play';
        core.currentPlayerId = '0';
        
        // P0 已打出 3 张牌
        const p0Card1: PlayedCard = {
            uid: 'card_12',
            defId: 'deck_i_card_12',
            ownerId: '0',
            baseInfluence: 12,
            faction: 'dynasty',
            abilityIds: ['ability_i_treasurer'],
            difficulty: 2,
            modifiers: { entries: [], nextOrder: 0 },
            tags: {},
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck1/12',
            encounterIndex: 1,
        };
        
        const p0Card2: PlayedCard = {
            uid: 'card_01',
            defId: 'deck_i_card_01',
            ownerId: '0',
            baseInfluence: 1,
            faction: 'swamp',
            abilityIds: ['ability_i_mercenary_swordsman'],
            difficulty: 0,
            modifiers: { entries: [], nextOrder: 0 },
            tags: {},
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck1/1',
            encounterIndex: 2,
        };
        
        const p0Card3: PlayedCard = {
            uid: 'card_04',
            defId: 'deck_i_card_04',
            ownerId: '0',
            baseInfluence: 4,
            faction: 'dynasty',
            abilityIds: ['ability_i_mediator'],
            difficulty: 0,
            modifiers: { entries: [], nextOrder: 0 },
            tags: {},
            signets: 0,
            ongoingMarkers: ['ability_i_mediator'],
            imagePath: 'cardia/cards/deck1/4',
            encounterIndex: 3,
        };
        
        core.players['0'].playedCards = [p0Card1, p0Card2, p0Card3];
        
        // P1 已打出 3 张牌
        const p1Card1: PlayedCard = {
            uid: 'card_15_p1',
            defId: 'deck_i_card_15',
            ownerId: '1',
            baseInfluence: 15,
            faction: 'guild',
            abilityIds: ['ability_i_inventor'],
            difficulty: 3,
            modifiers: { entries: [], nextOrder: 0 },
            tags: {},
            signets: 1,
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck1/15',
            encounterIndex: 1,
        };
        
        const p1Card2: PlayedCard = {
            uid: 'card_13',
            defId: 'deck_i_card_13',
            ownerId: '1',
            baseInfluence: 13,
            faction: 'swamp',
            abilityIds: ['ability_i_swamp_guard'],
            difficulty: 3,
            modifiers: { entries: [], nextOrder: 0 },
            tags: {},
            signets: 1,
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck1/13',
            encounterIndex: 2,
        };
        
        const p1Card3: PlayedCard = {
            uid: 'card_08',
            defId: 'deck_i_card_08',
            ownerId: '1',
            baseInfluence: 8,
            faction: 'dynasty',
            abilityIds: ['ability_i_magistrate'],
            difficulty: 1,
            modifiers: { entries: [], nextOrder: 0 },
            tags: {},
            signets: 0,  // 被 Mediator 移除了
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck1/8',
            encounterIndex: 3,
        };
        
        core.players['1'].playedCards = [p1Card1, p1Card2, p1Card3];
        
        // 设置遭遇历史
        core.encounterHistory = [
            {
                player1Card: p0Card1,
                player2Card: p1Card1,
                player1Influence: 12,
                player2Influence: 18,  // +3 modifier
                winnerId: '1',
                loserId: '0',
            },
            {
                player1Card: p0Card2,
                player2Card: p1Card2,
                player1Influence: 1,
                player2Influence: 13,
                winnerId: '1',
                loserId: '0',
            },
            {
                player1Card: p0Card3,
                player2Card: p1Card3,
                player1Influence: 4,
                player2Influence: 8,
                winnerId: '1',
                loserId: '0',
            },
        ];
        
        // 设置持续能力
        core.ongoingAbilities = [
            {
                abilityId: 'ability_i_mediator',
                cardId: 'card_04',
                playerId: '0',
                effectType: 'forceTie',
                timestamp: Date.now(),
                encounterIndex: 3,
            },
        ];
        
        // P0 手牌：Card 15 (Inventor)
        core.players['0'].hand = [
            {
                uid: 'card_15_p0',
                defId: 'deck_i_card_15',
                ownerId: '0',
                baseInfluence: 15,
                faction: 'guild',
                abilityIds: ['ability_i_inventor'],
                difficulty: 3,
                modifiers: { entries: [], nextOrder: 0 },
                tags: {},
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/15',
            },
        ];
        
        // P1 手牌：Card 16 (Elf)
        core.players['1'].hand = [
            {
                uid: 'card_16',
                defId: 'deck_i_card_16',
                ownerId: '1',
                baseInfluence: 16,
                faction: 'dynasty',
                abilityIds: ['ability_i_elf'],
                difficulty: 3,
                modifiers: { entries: [], nextOrder: 0 },
                tags: {},
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/16',
            },
        ];
        
        // P1 打出 Card 16 (Elf)
        runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '1', cardUid: 'card_16', slotIndex: 0 });
        
        // P0 打出 Card 15 (Inventor)
        runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { playerId: '0', cardUid: 'card_15_p0', slotIndex: 3 });
        
        // 验证：遭遇已解决
        const finalCore = runner.getState().core as CardiaCoreState;
        expect(finalCore.encounterHistory).toHaveLength(4);
        
        const encounter4 = finalCore.encounterHistory[3];
        expect(encounter4.winnerId).toBe('1');
        expect(encounter4.loserId).toBe('0');
        
        // 验证：Card 16 获得了基础印戒
        const card16 = finalCore.players['1'].playedCards.find(c => c.uid === 'card_16');
        expect(card16).toBeDefined();
        expect(card16!.signets).toBe(1);  // 应该有 1 枚基础印戒
    });
});
