/**
 * Court Guard 多张派系手牌测试
 * 
 * 测试场景：P2 有多张 Guild 派系手牌，选择弃牌后应该显示卡牌选择界面
 */

import { describe, it, expect } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import { CARDIA_EVENTS } from '../domain/events';
import { ABILITY_IDS, CARD_IDS_DECK_I } from '../domain/ids';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reduce';
import type { CardiaCore } from '../domain/core-types';
import type { MatchState } from '../../../engine/types';

// 导入能力执行器注册代码
import '../domain/abilities/group1-resources';
import '../domain/abilities/group2-modifiers';
import '../domain/abilities/group3-ongoing';
import '../domain/abilities/group4-card-ops';
import '../domain/abilities/group5-copy';
import '../domain/abilities/group6-special';
import '../domain/abilities/group7-faction';

describe('Court Guard - 多张派系手牌选择', () => {
    it('P2 有 3 张 Guild 派系手牌，选择弃牌后应该创建卡牌选择交互', () => {
        // 初始化游戏状态
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 构造测试场景：P1 打出宫廷卫士（影响力7），P2 打出伏击者（影响力9）
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'ability',
            players: {
                '0': {
                    ...initialState.players['0'],
                    hand: [],
                    playedCards: [
                        {
                            uid: 'p1_card_07',
                            defId: CARD_IDS_DECK_I.CARD_07,
                            ownerId: '0',
                            baseInfluence: 7,
                            faction: 'guild',
                            abilityIds: [ABILITY_IDS.COURT_GUARD],
                            difficulty: 1,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/7',
                            encounterIndex: 1,
                        },
                    ],
                    discard: [],
                },
                '1': {
                    ...initialState.players['1'],
                    hand: [
                        {
                            uid: 'p2_card_11',
                            defId: CARD_IDS_DECK_I.CARD_11,
                            ownerId: '1',
                            baseInfluence: 11,
                            faction: 'guild',
                            abilityIds: [ABILITY_IDS.CLOCKMAKER],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/11',
                        },
                        {
                            uid: 'p2_card_03',
                            defId: CARD_IDS_DECK_I.CARD_03,
                            ownerId: '1',
                            baseInfluence: 3,
                            faction: 'guild',
                            abilityIds: [ABILITY_IDS.SURGEON],
                            difficulty: 0,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/3',
                        },
                        {
                            uid: 'p2_card_07_copy',
                            defId: CARD_IDS_DECK_I.CARD_07,
                            ownerId: '1',
                            baseInfluence: 7,
                            faction: 'guild',
                            abilityIds: [ABILITY_IDS.COURT_GUARD],
                            difficulty: 1,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/7',
                        },
                    ],
                    playedCards: [
                        {
                            uid: 'p2_card_09',
                            defId: CARD_IDS_DECK_I.CARD_09,
                            ownerId: '1',
                            baseInfluence: 9,
                            faction: 'swamp',
                            abilityIds: [ABILITY_IDS.AMBUSHER],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/9',
                            encounterIndex: 1,
                        },
                    ],
                    discard: [],
                },
            },
            currentEncounter: {
                winnerId: '1',
                loserId: '0',
                winnerCardUid: 'p2_card_09',
                loserCardUid: 'p1_card_07',
                winnerInfluence: 9,
                loserInfluence: 7,
                timestamp: Date.now(),
            },
        };
        
        const testState: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                phase: 'ability',
                interaction: {
                    current: null,
                    queue: [],
                },
                responseWindow: {
                    current: null,
                    queue: [],
                },
                eventStream: {
                    entries: [],
                    nextId: 1,
                },
                gameover: null,
                log: {
                    entries: [],
                    nextId: 1,
                },
            },
        };
        
        const randomFn = {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        };
        
        // 1. P1 激活宫廷卫士能力
        const activateEvents = execute(
            testState,
            {
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId: '0',
                payload: {
                    abilityId: ABILITY_IDS.COURT_GUARD,
                    sourceCardUid: 'p1_card_07',
                },
            },
            randomFn
        );
        
        // 应用事件
        let currentState = testState;
        for (const event of activateEvents) {
            currentState = {
                ...currentState,
                core: reduce(currentState.core, event),
            };
        }
        
        // 验证：应该有交互（P1 选择派系）
        expect(currentState.sys.interaction.current).toBeDefined();
        expect(currentState.sys.interaction.current?.playerId).toBe('0');
        
        // 2. P1 选择 Guild 派系
        const selectFactionEvents = execute(
            currentState,
            {
                type: CARDIA_COMMANDS.RESOLVE_INTERACTION,
                playerId: '0',
                payload: { faction: 'guild' },
            },
            randomFn
        );
        
        // 应用事件
        for (const event of selectFactionEvents) {
            currentState = {
                ...currentState,
                core: reduce(currentState.core, event),
            };
        }
        
        console.log('After P1 selects faction:', {
            hasInteraction: !!currentState.sys.interaction.current,
            interactionPlayerId: currentState.sys.interaction.current?.playerId,
            queueLength: currentState.sys.interaction.queue.length,
            p2HandSize: currentState.core.players['1'].hand.length,
            p2HandCards: currentState.core.players['1'].hand.map(c => ({ uid: c.uid, faction: c.faction })),
        });
        
        // 验证：应该有新的交互（P2 选择是否弃牌）
        expect(currentState.sys.interaction.current).toBeDefined();
        expect(currentState.sys.interaction.current?.playerId).toBe('1');
        
        // 3. P2 选择"弃牌"
        const chooseDiscardEvents = execute(
            currentState,
            {
                type: CARDIA_COMMANDS.RESOLVE_INTERACTION,
                playerId: '1',
                payload: { option: 'discard' },
            },
            randomFn
        );
        
        // 应用事件
        for (const event of chooseDiscardEvents) {
            currentState = {
                ...currentState,
                core: reduce(currentState.core, event),
            };
        }
        
        console.log('After P2 chooses to discard:', {
            hasInteraction: !!currentState.sys.interaction.current,
            interactionPlayerId: currentState.sys.interaction.current?.playerId,
            interactionType: (currentState.sys.interaction.current?.data as any)?.interactionType,
            queueLength: currentState.sys.interaction.queue.length,
            p2HandSize: currentState.core.players['1'].hand.length,
            p2DiscardSize: currentState.core.players['1'].discard.length,
        });
        
        // 核心断言：应该有卡牌选择交互
        expect(currentState.sys.interaction.current).toBeDefined();
        expect(currentState.sys.interaction.current?.playerId).toBe('1');
        expect((currentState.sys.interaction.current?.data as any)?.interactionType).toBe('card-selection');
        
        // 验证：P2 手牌没有减少（还没选择具体哪张）
        expect(currentState.core.players['1'].hand.length).toBe(3);
        expect(currentState.core.players['1'].discard.length).toBe(0);
    });
});
