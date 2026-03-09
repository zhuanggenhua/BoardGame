/**
 * 钟表匠（Clockmaker）延迟效果测试
 * 
 * 测试场景：
 * 1. P1 打出钟表匠（影响力 11），激活能力
 * 2. 验证延迟效果被注册到 delayedEffects 数组
 * 3. P1 打出下一张牌
 * 4. 验证延迟效果被触发，下一张牌获得 +3 修正标记
 * 5. 验证延迟效果从 delayedEffects 数组中移除
 */

import { describe, it, expect } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import { CARDIA_EVENTS } from '../domain/events';
import { ABILITY_IDS } from '../domain/ids';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reduce';
import type { CardiaCore } from '../domain/core-types';
// 导入能力执行器注册代码
import '../domain/abilities/group2-modifiers';

describe('钟表匠延迟效果', () => {
    it('应该为下一张打出的牌添加 +3 修正标记', () => {
        // 1. 初始化游戏状态
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 2. 构造测试场景：P1 已打出钟表匠（encounterIndex 1），P2 已打出一张牌
        const testState: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'ability',
            players: {
                'player1': {
                    ...initialState.players['player1'],
                    hand: [
                        {
                            uid: 'p1_hand_card01',
                            defId: 'deck_i_card_01',
                            ownerId: 'player1',
                            baseInfluence: 1,
                            faction: 'guild',
                            abilityIds: [],
                            difficulty: 0,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/1',
                        },
                    ],
                    playedCards: [
                        {
                            uid: 'p1_clockmaker',
                            defId: 'deck_i_card_11',
                            ownerId: 'player1',
                            baseInfluence: 11,
                            faction: 'academy',
                            abilityIds: [ABILITY_IDS.CLOCKMAKER],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 0,
                            ongoingMarkers: [],
                            encounterIndex: 1,
                            imagePath: 'cardia/cards/deck1/11',
                        },
                    ],
                    hasPlayed: true,
                    cardRevealed: true,
                    currentCard: null,
                },
                'player2': {
                    ...initialState.players['player2'],
                    playedCards: [
                        {
                            uid: 'p2_card',
                            defId: 'deck_i_card_10',
                            ownerId: 'player2',
                            baseInfluence: 10,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 1,
                            ongoingMarkers: [],
                            encounterIndex: 1,
                            imagePath: 'cardia/cards/deck1/10',
                        },
                    ],
                    hasPlayed: true,
                    cardRevealed: true,
                    currentCard: null,
                },
            },
            currentEncounter: {
                player1Card: {
                    uid: 'p1_clockmaker',
                    defId: 'deck_i_card_11',
                    ownerId: 'player1',
                    baseInfluence: 11,
                    faction: 'academy',
                    abilityIds: [ABILITY_IDS.CLOCKMAKER],
                    difficulty: 2,
                    modifiers: { entries: [], nextOrder: 0 },
                    tags: { tags: {} },
                    signets: 0,
                    ongoingMarkers: [],
                    imagePath: 'cardia/cards/deck1/11',
                },
                player2Card: {
                    uid: 'p2_card',
                    defId: 'deck_i_card_10',
                    ownerId: 'player2',
                    baseInfluence: 10,
                    faction: 'swamp',
                    abilityIds: [],
                    difficulty: 2,
                    modifiers: { entries: [], nextOrder: 0 },
                    tags: { tags: {} },
                    signets: 0,
                    ongoingMarkers: [],
                    imagePath: 'cardia/cards/deck1/10',
                },
                player1Influence: 11,
                player2Influence: 10,
                winnerId: 'player1',
                loserId: 'player2',
            },
        };
        
        // 3. P1 激活钟表匠能力
        const activateEvents = execute({ core: testState, sys: {} as any }, {
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: 'player1',
            payload: {
                abilityId: ABILITY_IDS.CLOCKMAKER,
                sourceCardUid: 'p1_clockmaker',
            },
        }, {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        });
        
        console.log('[Test] Activate ability events:', activateEvents.map(e => e.type));
        
        // 应用事件
        let state = testState;
        for (const event of activateEvents) {
            state = reduce(state, event);
        }
        
        // 4. 验证延迟效果被注册
        expect(state.delayedEffects).toHaveLength(1);
        expect(state.delayedEffects[0]).toMatchObject({
            effectType: 'modifyInfluence',
            target: 'self',
            value: 3,
            condition: 'onNextCardPlayed',
            sourceAbilityId: ABILITY_IDS.CLOCKMAKER,
            sourcePlayerId: 'player1',
        });
        
        console.log('[Test] Delayed effects registered:', state.delayedEffects);
        
        // 5. 进入下一回合的 play 阶段
        state = {
            ...state,
            phase: 'play',
            turnNumber: 2,
            currentPlayerId: 'player1',
            players: {
                ...state.players,
                'player1': {
                    ...state.players['player1'],
                    hasPlayed: false,
                    currentCard: null,
                },
                'player2': {
                    ...state.players['player2'],
                    hasPlayed: false,
                    currentCard: null,
                },
            },
            currentEncounter: null,
        };
        
        // 6. P1 打出下一张牌
        const playCardEvents = execute({ core: state, sys: {} as any }, {
            type: CARDIA_COMMANDS.PLAY_CARD,
            playerId: 'player1',
            payload: {
                cardUid: 'p1_hand_card01',
                slotIndex: 0,
            },
        }, {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        });
        
        console.log('[Test] Play card events:', playCardEvents.map(e => e.type));
        
        // 7. 验证事件包含 DELAYED_EFFECT_TRIGGERED 和 MODIFIER_TOKEN_PLACED
        const delayedEffectTriggeredEvent = playCardEvents.find(
            e => e.type === CARDIA_EVENTS.DELAYED_EFFECT_TRIGGERED
        );
        expect(delayedEffectTriggeredEvent).toBeDefined();
        expect(delayedEffectTriggeredEvent?.payload).toMatchObject({
            effectType: 'modifyInfluence',
            targetCardId: 'p1_hand_card01',
            sourceAbilityId: ABILITY_IDS.CLOCKMAKER,
            sourcePlayerId: 'player1',
        });
        
        const modifierTokenPlacedEvent = playCardEvents.find(
            e => e.type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED &&
            (e.payload as any).cardId === 'p1_hand_card01'
        );
        expect(modifierTokenPlacedEvent).toBeDefined();
        expect(modifierTokenPlacedEvent?.payload).toMatchObject({
            cardId: 'p1_hand_card01',
            value: 3,
            source: ABILITY_IDS.CLOCKMAKER,
        });
        
        // 8. 应用事件
        for (const event of playCardEvents) {
            state = reduce(state, event);
        }
        
        // 9. 验证延迟效果被移除
        expect(state.delayedEffects).toHaveLength(0);
        
        // 10. 验证修正标记被添加
        const modifierToken = state.modifierTokens.find(
            t => t.cardId === 'p1_hand_card01'
        );
        expect(modifierToken).toBeDefined();
        expect(modifierToken?.value).toBe(3);
        expect(modifierToken?.source).toBe(ABILITY_IDS.CLOCKMAKER);
        
        console.log('[Test] Final state:', {
            delayedEffects: state.delayedEffects,
            modifierTokens: state.modifierTokens,
        });
    });
});
