/**
 * 宫廷卫士 - choice 类型交互测试
 * 
 * 验证 wrapCardiaInteraction 函数正确处理 choice 类型的交互
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import { ABILITY_IDS, CARD_IDS_DECK_I } from '../domain/ids';
import { Cardia } from '../game';

describe('宫廷卫士 - choice 交互', () => {
    const playerIds = ['0', '1'];
    
    const runner = new GameTestRunner({
        domain: CardiaDomain,
        systems: Cardia.systems,
        playerIds,
        random: {
            random: () => 0.5,
            d: (sides) => Math.ceil(sides / 2),
            range: (min, max) => Math.floor((min + max) / 2),
            shuffle: (arr) => [...arr],
        },
    });
    
    it('对手有该派系手牌时，应该创建 choice 交互', () => {
        
        // 初始化游戏
        runner.start({
            playerCount: 2,
            config: { deckVariant: 'deck_i' },
        });
        
        // 设置场景：P1 打出宫廷卫士（影响力7），P2 打出傀儡师（影响力10）
        runner.applyState((state) => {
            const p1 = state.core.players['0'];
            const p2 = state.core.players['1'];
            
            // P1 打出宫廷卫士
            p1.playedCards = [{
                uid: 'p1_court_guard',
                defId: CARD_IDS_DECK_I.CARD_07,
                ownerId: '0',
                baseInfluence: 7,
                faction: 'guild',
                abilityIds: [ABILITY_IDS.COURT_GUARD],
                difficulty: 2,
                modifiers: { entries: [], nextOrder: 0 },
                tags: { tags: {} },
                signets: 0,
                ongoingMarkers: [],
                encounterIndex: 1,
                imagePath: 'cardia/cards/deck1/7',
            }];
            
            // P2 打出傀儡师
            p2.playedCards = [{
                uid: 'p2_puppeteer',
                defId: CARD_IDS_DECK_I.CARD_10,
                ownerId: '1',
                baseInfluence: 10,
                faction: 'swamp',
                abilityIds: [ABILITY_IDS.PUPPETEER],
                difficulty: 2,
                modifiers: { entries: [], nextOrder: 0 },
                tags: { tags: {} },
                signets: 1,
                ongoingMarkers: [],
                encounterIndex: 1,
                imagePath: 'cardia/cards/deck1/10',
            }];
            
            // P2 手牌中有 Swamp 派系的牌
            p2.hand = [{
                uid: 'p2_hand_saboteur',
                defId: CARD_IDS_DECK_I.CARD_05,
                ownerId: '1',
                baseInfluence: 5,
                faction: 'swamp',
                abilityIds: [ABILITY_IDS.SABOTEUR],
                difficulty: 1,
                modifiers: { entries: [], nextOrder: 0 },
                tags: { tags: {} },
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/5',
            }];
            
            // 设置遭遇状态
            state.core.currentEncounter = {
                player1Card: p1.playedCards[0],
                player2Card: p2.playedCards[0],
                player1Influence: 7,
                player2Influence: 10,
                winnerId: '1',
                loserId: '0',
            };
            
            // 设置阶段和玩家状态
            state.core.phase = 'ability';
            p1.hasPlayed = true;
            p2.hasPlayed = true;
            p1.cardRevealed = true;
            p2.cardRevealed = true;
            
            return state;
        });
        
        // P1 激活宫廷卫士能力
        runner.dispatch({
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: '0',
            payload: {},
        });
        
        // 应该有交互（派系选择）
        const state1 = runner.getState();
        expect(state1.sys.interaction.current).toBeDefined();
        expect(state1.sys.interaction.current?.playerId).toBe('0');
        
        // P1 选择 Swamp 派系
        const factionOption = state1.sys.interaction.current?.options.find(
            (opt: any) => opt.id === 'faction_swamp'
        );
        expect(factionOption).toBeDefined();
        
        runner.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: {
                optionId: factionOption!.id,
            },
        });
        
        // 应该创建 P2 的 choice 交互
        const state2 = runner.getState();
        expect(state2.sys.interaction.current).toBeDefined();
        expect(state2.sys.interaction.current?.playerId).toBe('1');
        
        // 验证选项
        const options = state2.sys.interaction.current?.options || [];
        console.log('P2 交互选项:', options.map((opt: any) => ({
            id: opt.id,
            label: opt.label,
            value: opt.value,
        })));
        
        // 应该有两个选项：弃牌 和 不弃牌
        expect(options.length).toBeGreaterThanOrEqual(1);
        
        // 检查是否有紧急跳过选项（这是 bug 的表现）
        const hasEmergencySkip = options.some((opt: any) => opt.id === '__emergency_skip__');
        expect(hasEmergencySkip).toBe(false);
        
        // 应该有正常的选项
        const hasDiscardOption = options.some((opt: any) => opt.id === 'discard');
        const hasDeclineOption = options.some((opt: any) => opt.id === 'decline');
        
        expect(hasDiscardOption || hasDeclineOption).toBe(true);
    });
    
    it('对手选择不弃牌时，P1 应该获得+7修正', () => {
        
        runner.start({
            playerCount: 2,
            config: { deckVariant: 'deck_i' },
        });
        
        // 设置相同的场景
        runner.applyState((state) => {
            const p1 = state.core.players['0'];
            const p2 = state.core.players['1'];
            
            p1.playedCards = [{
                uid: 'p1_court_guard',
                defId: CARD_IDS_DECK_I.CARD_07,
                ownerId: '0',
                baseInfluence: 7,
                faction: 'guild',
                abilityIds: [ABILITY_IDS.COURT_GUARD],
                difficulty: 2,
                modifiers: { entries: [], nextOrder: 0 },
                tags: { tags: {} },
                signets: 0,
                ongoingMarkers: [],
                encounterIndex: 1,
                imagePath: 'cardia/cards/deck1/7',
            }];
            
            p2.playedCards = [{
                uid: 'p2_puppeteer',
                defId: CARD_IDS_DECK_I.CARD_10,
                ownerId: '1',
                baseInfluence: 10,
                faction: 'swamp',
                abilityIds: [ABILITY_IDS.PUPPETEER],
                difficulty: 2,
                modifiers: { entries: [], nextOrder: 0 },
                tags: { tags: {} },
                signets: 1,
                ongoingMarkers: [],
                encounterIndex: 1,
                imagePath: 'cardia/cards/deck1/10',
            }];
            
            p2.hand = [{
                uid: 'p2_hand_saboteur',
                defId: CARD_IDS_DECK_I.CARD_05,
                ownerId: '1',
                baseInfluence: 5,
                faction: 'swamp',
                abilityIds: [ABILITY_IDS.SABOTEUR],
                difficulty: 1,
                modifiers: { entries: [], nextOrder: 0 },
                tags: { tags: {} },
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/5',
            }];
            
            state.core.currentEncounter = {
                player1Card: p1.playedCards[0],
                player2Card: p2.playedCards[0],
                player1Influence: 7,
                player2Influence: 10,
                winnerId: '1',
                loserId: '0',
            };
            
            state.core.phase = 'ability';
            p1.hasPlayed = true;
            p2.hasPlayed = true;
            p1.cardRevealed = true;
            p2.cardRevealed = true;
            
            return state;
        });
        
        // P1 激活能力
        runner.dispatch({
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: '0',
            payload: {},
        });
        
        // P1 选择 Swamp 派系
        const state1 = runner.getState();
        const factionOption = state1.sys.interaction.current?.options.find(
            (opt: any) => opt.id === 'faction_swamp'
        );
        
        runner.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: {
                optionId: factionOption!.id,
            },
        });
        
        // P2 选择不弃牌
        const state2 = runner.getState();
        const declineOption = state2.sys.interaction.current?.options.find(
            (opt: any) => opt.id === 'decline'
        );
        
        expect(declineOption).toBeDefined();
        
        runner.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: {
                optionId: declineOption!.id,
            },
        });
        
        // 验证：P1 的牌应该获得+7修正
        const finalState = runner.getState();
        const modifier = finalState.core.modifierTokens.find(
            (m) => m.cardId === 'p1_court_guard' && m.source === ABILITY_IDS.COURT_GUARD
        );
        
        expect(modifier).toBeDefined();
        expect(modifier!.value).toBe(7);
    });
});
