/**
 * 测试宫廷卫士能力的抽牌时序问题
 * 
 * Bug: P2弹窗选择时，已经抽牌了
 * 
 * 预期行为：
 * 1. P1 激活宫廷卫士能力
 * 2. P1 选择派系
 * 3. P2 看到选择弹窗（此时不应该抽牌）
 * 4. P2 做出选择
 * 5. 交互链完成后才抽牌
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import { ABILITY_IDS, CARD_IDS_DECK_I } from '../domain/ids';
import { Cardia } from '../game';

describe('宫廷卫士抽牌时序', () => {
    it('P2弹窗时不应该抽牌', () => {
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
        
        // 获取初始状态并修改
        const initialState = runner.getState();
        const p1 = initialState.core.players['0'];
        const p2 = initialState.core.players['1'];
        
        // 记录初始手牌数量
        const p1InitialHandCount = p1.hand.length;
        const p2InitialHandCount = p2.hand.length;
        
        // P1 打出宫廷卫士（影响力 7）
        p1.playedCards = [{
            uid: 'p1_court_guard',
            defId: CARD_IDS_DECK_I.CARD_07,
            ownerId: '0',
            baseInfluence: 7,
            faction: 'guild',
            abilityIds: [ABILITY_IDS.COURT_GUARD],
            difficulty: 2,
            modifiers: { entries: [], nextOrder: 0 },
            encounterIndex: 0,
        }];
        
        // P2 打出一张更高影响力的牌（影响力 10）
        p2.playedCards = [{
            uid: 'p2_puppeteer',
            defId: CARD_IDS_DECK_I.CARD_10,
            ownerId: '1',
            baseInfluence: 10,
            faction: 'academy',
            abilityIds: [ABILITY_IDS.PUPPETEER],
            difficulty: 2,
            modifiers: { entries: [], nextOrder: 0 },
            encounterIndex: 0,
        }];
        
        // P2 手牌包含 swamp 派系的牌
        p2.hand = [
            {
                uid: 'p2_hand_swamp_1',
                defId: CARD_IDS_DECK_I.CARD_01,
                ownerId: '1',
                baseInfluence: 1,
                faction: 'swamp',
                abilityIds: [ABILITY_IDS.MERCENARY_SWORDSMAN],
                difficulty: 1,
                modifiers: { entries: [], nextOrder: 0 },
            },
            {
                uid: 'p2_hand_academy_1',
                defId: CARD_IDS_DECK_I.CARD_02,
                ownerId: '1',
                baseInfluence: 2,
                faction: 'academy',
                abilityIds: [ABILITY_IDS.VOID_MAGE],
                difficulty: 1,
                modifiers: { entries: [], nextOrder: 0 },
            },
        ];
        
        // 推进到 ability 阶段
        initialState.core.phase = 'ability';
        
        runner.setState(initialState);
        
        // P1 激活宫廷卫士能力
        runner.dispatch(CARDIA_COMMANDS.ACTIVATE_ABILITY, {
            playerId: '0',
            abilityId: ABILITY_IDS.COURT_GUARD,
            sourceCardUid: 'p1_court_guard',
        });
        
        // 检查是否有交互（P1 选择派系）
        let state = runner.getState();
        expect(state.sys.interaction.current).toBeDefined();
        expect(state.sys.interaction.current?.playerId).toBe('0');
        
        // 检查此时手牌数量（不应该抽牌）
        expect(state.core.players['0'].hand.length).toBe(p1InitialHandCount);
        expect(state.core.players['1'].hand.length).toBe(p2InitialHandCount);
        
        console.log('P1 选择派系前手牌数量:', {
            p1: state.core.players['0'].hand.length,
            p2: state.core.players['1'].hand.length,
        });
        
        // P1 选择 swamp 派系
        runner.dispatch(CARDIA_COMMANDS.CHOOSE_FACTION, {
            playerId: '0',
            faction: 'swamp',
        });
        
        // 检查是否有新交互（P2 选择是否弃牌）
        state = runner.getState();
        console.log('P1 选择派系后状态:', {
            hasInteraction: !!state.sys.interaction.current,
            interactionPlayerId: state.sys.interaction.current?.playerId,
            queueLength: state.sys.interaction.queue.length,
            p1HandCount: state.core.players['0'].hand.length,
            p2HandCount: state.core.players['1'].hand.length,
        });
        
        // ✅ 关键检查：P2 弹窗时，不应该抽牌
        expect(state.sys.interaction.current).toBeDefined();
        expect(state.sys.interaction.current?.playerId).toBe('1');
        expect(state.core.players['0'].hand.length).toBe(p1InitialHandCount);
        expect(state.core.players['1'].hand.length).toBe(p2InitialHandCount);
        
        // P2 选择不弃牌
        runner.dispatch(CARDIA_COMMANDS.CONFIRM_CHOICE, {
            playerId: '1',
            optionId: 'decline',
        });
        
        // 检查交互链完成后的状态
        state = runner.getState();
        console.log('P2 选择后状态:', {
            hasInteraction: !!state.sys.interaction.current,
            queueLength: state.sys.interaction.queue.length,
            p1HandCount: state.core.players['0'].hand.length,
            p2HandCount: state.core.players['1'].hand.length,
            phase: state.core.phase,
        });
        
        // 交互链完成后，应该抽牌并推进回合
        expect(state.sys.interaction.current).toBeNull();
        expect(state.core.players['0'].hand.length).toBe(p1InitialHandCount + 1);
        expect(state.core.players['1'].hand.length).toBe(p2InitialHandCount + 1);
        expect(state.core.phase).toBe('play');
    });
});
