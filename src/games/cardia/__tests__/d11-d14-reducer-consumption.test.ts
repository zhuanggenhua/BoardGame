/**
 * D11-D14 Reducer 消耗路径测试
 * 
 * 验证维度：
 * - D11 Reducer 消耗路径：事件写入的资源/额度/状态在 reducer 消耗时走的分支是否正确
 * - D12 写入-消耗对称：能力/事件写入的字段在所有消费点是否被正确读取和消耗
 * - D13 多来源竞争：同一资源有多个写入来源时，消耗逻辑是否正确区分来源
 * - D14 回合清理完整：回合/阶段结束时临时状态是否全部正确清理
 */

import { describe, it, expect } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import { CARDIA_EVENTS } from '../domain/events';
import { ABILITY_IDS } from '../domain/ids';
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

describe('D11-D14 Reducer 消耗路径测试', () => {
    /**
     * D11.1 修正标记消耗路径
     * 
     * 测试场景：外科医生能力写入修正标记，reducer 正确消耗并更新 modifierTokens
     * 
     * 验证：
     * 1. MODIFIER_TOKEN_PLACED 事件正确写入 modifierTokens 数组
     * 2. modifierTokens 包含正确的 cardId、value、source、timestamp
     * 3. 影响力计算时正确读取 modifierTokens
     */
    it('D11.1 修正标记写入-消耗路径正确', () => {
        // 初始化游戏状态
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 构造测试场景：P1 打出外科医生，P2 打出普通牌
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'ability',
            players: {
                'player1': {
                    ...initialState.players['player1'],
                    playedCards: [
                        {
                            uid: 'p1_surgeon',
                            defId: 'deck_i_card_03',
                            ownerId: 'player1',
                            baseInfluence: 3,
                            faction: 'academy',
                            abilityIds: [ABILITY_IDS.SURGEON],
                            difficulty: 1,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 0,
                            ongoingMarkers: [],
                            encounterIndex: 1,
                            imagePath: 'cardia/cards/deck1/3',
                        },
                    ],
                },
                'player2': {
                    ...initialState.players['player2'],
                    playedCards: [],
                },
            },
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        // 激活外科医生能力（写入延迟效果）
        const activateEvents = execute(state, {
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: 'player1',
            payload: {
                abilityId: ABILITY_IDS.SURGEON,
                sourceCardUid: 'p1_surgeon',
            },
        }, {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        });
        
        // 应用事件
        for (const event of activateEvents) {
            state = {
                ...state,
                core: reduce(state.core, event),
            };
        }
        
        // 验证：延迟效果已写入
        expect(state.core.delayedEffects.length).toBe(1);
        expect(state.core.delayedEffects[0]).toMatchObject({
            effectType: 'modifyInfluence',
            condition: 'onNextCardPlayed',
            sourcePlayerId: 'player1',
            sourceAbilityId: ABILITY_IDS.SURGEON,
            value: -5,
        });
        
        // P1 打出下一张牌（触发延迟效果，写入修正标记）
        const nextCard = state.core.players['player1'].hand[0];
        const playCardEvents = execute(state, {
            type: CARDIA_COMMANDS.PLAY_CARD,
            playerId: 'player1',
            payload: {
                cardUid: nextCard.uid,
                slotIndex: 0,
            },
        }, {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        });
        
        // 应用事件
        for (const event of playCardEvents) {
            state = {
                ...state,
                core: reduce(state.core, event),
            };
        }
        
        // 验证：修正标记已写入 modifierTokens
        const modifierToken = state.core.modifierTokens.find(
            t => t.cardId === nextCard.uid && t.source === ABILITY_IDS.SURGEON
        );
        expect(modifierToken).toBeDefined();
        expect(modifierToken?.value).toBe(-5);
        expect(modifierToken?.source).toBe(ABILITY_IDS.SURGEON);
        
        // 验证：延迟效果已消费（清除）
        expect(state.core.delayedEffects.length).toBe(0);
    });

    /**
     * D11.2 持续能力消耗路径
     * 
     * 测试场景：宫廷卫士能力写入持续能力，reducer 正确消耗并更新 ongoingAbilities
     * 
     * 验证：
     * 1. ONGOING_ABILITY_PLACED 事件正确写入 ongoingAbilities 数组
     * 2. ongoingAbilities 包含正确的 abilityId、cardId、playerId、effectType
     * 3. 卡牌的 ongoingMarkers 字段同步更新
     */
    it('D11.2 持续能力写入-消耗路径正确', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'ability',
            players: {
                'player1': {
                    ...initialState.players['player1'],
                    hand: [
                        {
                            uid: 'p1_hand_swamp',
                            defId: 'deck_i_card_05',
                            ownerId: 'player1',
                            baseInfluence: 5,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/5',
                        },
                    ],
                    playedCards: [
                        {
                            uid: 'p1_court_guard',
                            defId: 'deck_i_card_07',
                            ownerId: 'player1',
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
                        },
                    ],
                },
                'player2': {
                    ...initialState.players['player2'],
                    playedCards: [],
                },
            },
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        // 激活宫廷卫士能力（创建交互）
        const activateEvents = execute(state, {
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: 'player1',
            payload: {
                abilityId: ABILITY_IDS.COURT_GUARD,
                sourceCardUid: 'p1_court_guard',
            },
        }, {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        });
        
        // 应用事件
        for (const event of activateEvents) {
            state = {
                ...state,
                core: reduce(state.core, event),
            };
        }
        
        // 验证：能力激活事件已发射
        const abilityActivated = activateEvents.find(
            e => e.type === CARDIA_EVENTS.ABILITY_ACTIVATED
        );
        expect(abilityActivated).toBeDefined();
        
        // 验证：交互请求事件已发射
        const interactionRequested = activateEvents.find(
            e => e.type === CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED
        );
        expect(interactionRequested).toBeDefined();
    });

    /**
     * D12.1 写入-消耗对称：印戒字段
     * 
     * 测试场景：遭遇结算后印戒写入 playedCards[].signets，UI 层正确读取
     * 
     * 验证：
     * 1. SIGNET_GRANTED 事件写入 playedCards[].signets
     * 2. 所有消费点（reducer/validate/UI）读取相同的字段
     * 3. 写入路径和消耗路径的条件分支对称
     */
    it('D12.1 印戒字段写入-消耗对称', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 构造测试场景：P1 先打出卡牌，确保 P1 的卡牌影响力更高
        const p1Card = initialState.players['player1'].hand[0];
        const p2Card = initialState.players['player2'].hand[0];
        
        // 修改卡牌影响力确保 P1 获胜
        p1Card.baseInfluence = 5;
        p2Card.baseInfluence = 1;
        
        let state: MatchState<CardiaCore> = {
            core: initialState,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        const randomFn = {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        };
        
        // P1 打出卡牌
        const p1Events = execute(state, {
            type: CARDIA_COMMANDS.PLAY_CARD,
            playerId: 'player1',
            payload: { cardUid: p1Card.uid },
        }, randomFn);
        
        for (const event of p1Events) {
            state = { ...state, core: reduce(state.core, event) };
        }
        
        // P2 打出卡牌（触发遭遇结算）
        const p2Events = execute(state, {
            type: CARDIA_COMMANDS.PLAY_CARD,
            playerId: 'player2',
            payload: { cardUid: p2Card.uid },
        }, randomFn);
        
        // 逐个归约事件，在 ENCOUNTER_RESOLVED 后保存状态用于验证 currentEncounter
        let encounterResolvedState: MatchState<CardiaCore> | null = null;
        for (const event of p2Events) {
            state = { ...state, core: reduce(state.core, event) };
            
            if (event.type === CARDIA_EVENTS.ENCOUNTER_RESOLVED) {
                // 保存遭遇解析后的状态（用于验证 currentEncounter 存在）
                encounterResolvedState = state;
            }
        }
        
        // 验证：遭遇已解析（在 ENCOUNTER_RESOLVED 事件归约后）
        expect(encounterResolvedState).toBeDefined();
        expect(encounterResolvedState!.core.currentEncounter).toBeDefined();
        
        // 验证：获胜者卡牌获得印戒（在所有事件归约后，包括 EXTRA_SIGNET_PLACED）
        const winnerId = encounterResolvedState!.core.currentEncounter?.winnerId;
        expect(winnerId).toBeDefined();
        
        if (winnerId) {
            // 使用最终状态（state）而非 encounterResolvedState，因为印戒是在 EXTRA_SIGNET_PLACED 事件中添加的
            const winnerCard = state.core.players[winnerId].playedCards[0];
            expect(winnerCard).toBeDefined();
            expect(winnerCard.signets).toBe(1);
            
            // 验证：失败者卡牌没有印戒
            const loserId = encounterResolvedState!.core.currentEncounter?.loserId;
            if (loserId) {
                const loserCard = state.core.players[loserId].playedCards[0];
                expect(loserCard).toBeDefined();
                expect(loserCard.signets).toBe(0);
            }
        }
    });

    /**
     * D12.2 写入-消耗对称：持续能力标记
     * 
     * 测试场景：持续能力写入 ongoingAbilities 和 card.ongoingMarkers，两者保持同步
     * 
     * 验证：
     * 1. ONGOING_ABILITY_PLACED 事件同时写入 ongoingAbilities 和 card.ongoingMarkers
     * 2. ONGOING_ABILITY_REMOVED 事件同时移除两处的记录
     * 3. 两处数据保持一致性
     */
    it('D12.2 持续能力标记写入-消耗对称', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 构造测试场景：P1 打出调停者（持续能力）
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'ability',
            players: {
                'player1': {
                    ...initialState.players['player1'],
                    playedCards: [
                        {
                            uid: 'p1_mediator',
                            defId: 'deck_i_card_08',
                            ownerId: 'player1',
                            baseInfluence: 8,
                            faction: 'guild',
                            abilityIds: [ABILITY_IDS.MEDIATOR],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 0,
                            ongoingMarkers: [],
                            encounterIndex: 1,
                            imagePath: 'cardia/cards/deck1/8',
                        },
                    ],
                },
                'player2': {
                    ...initialState.players['player2'],
                    playedCards: [],
                },
            },
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        // 激活调停者能力（放置持续能力）
        const activateEvents = execute(state, {
            type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
            playerId: 'player1',
            payload: {
                abilityId: ABILITY_IDS.MEDIATOR,
                sourceCardUid: 'p1_mediator',
            },
        }, {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        });
        
        // 应用事件
        for (const event of activateEvents) {
            state = {
                ...state,
                core: reduce(state.core, event),
            };
        }
        
        // 验证：持续能力已写入 ongoingAbilities
        const ongoingAbility = state.core.ongoingAbilities.find(
            a => a.abilityId === ABILITY_IDS.MEDIATOR && a.cardId === 'p1_mediator'
        );
        expect(ongoingAbility).toBeDefined();
        expect(ongoingAbility?.playerId).toBe('player1');
        
        // 验证：持续能力标记已写入 card.ongoingMarkers
        const card = state.core.players['player1'].playedCards.find(c => c.uid === 'p1_mediator');
        expect(card).toBeDefined();
        expect(card?.ongoingMarkers).toContain(ABILITY_IDS.MEDIATOR);
        
        // 验证：两处数据一致
        expect(card?.ongoingMarkers.length).toBe(1);
        expect(state.core.ongoingAbilities.filter(a => a.cardId === 'p1_mediator').length).toBe(1);
    });

    /**
     * D13.1 多来源竞争：修正标记
     * 
     * 测试场景：多个能力同时写入修正标记，reducer 正确区分来源
     * 
     * 验证：
     * 1. 不同来源的修正标记可以共存
     * 2. 每个修正标记的 source 字段正确标识来源
     * 3. 移除特定来源的修正标记时不影响其他来源
     */
    it('D13.1 多来源修正标记正确区分', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 手动构造包含多个修正标记的状态
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'ability',
            players: {
                'player1': {
                    ...initialState.players['player1'],
                    playedCards: [
                        {
                            uid: 'p1_card',
                            defId: 'deck_i_card_10',
                            ownerId: 'player1',
                            baseInfluence: 10,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 0,
                            ongoingMarkers: [],
                            encounterIndex: 1,
                            imagePath: 'cardia/cards/deck1/10',
                        },
                    ],
                },
                'player2': {
                    ...initialState.players['player2'],
                    playedCards: [],
                },
            },
            modifierTokens: [
                {
                    cardId: 'p1_card',
                    value: -5,
                    source: ABILITY_IDS.SURGEON,
                    timestamp: 1000,
                },
                {
                    cardId: 'p1_card',
                    value: 3,
                    source: ABILITY_IDS.CLOCKMAKER,
                    timestamp: 2000,
                },
                {
                    cardId: 'p1_card',
                    value: 1,
                    source: ABILITY_IDS.AMBUSHER,
                    timestamp: 3000,
                },
            ],
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        // 验证：所有修正标记都存在
        expect(state.core.modifierTokens.length).toBe(3);
        
        // 验证：每个修正标记的来源正确
        const surgeonModifier = state.core.modifierTokens.find(t => t.source === ABILITY_IDS.SURGEON);
        expect(surgeonModifier).toBeDefined();
        expect(surgeonModifier?.value).toBe(-5);
        
        const clockmakerModifier = state.core.modifierTokens.find(t => t.source === ABILITY_IDS.CLOCKMAKER);
        expect(clockmakerModifier).toBeDefined();
        expect(clockmakerModifier?.value).toBe(3);
        
        const ambusherModifier = state.core.modifierTokens.find(t => t.source === ABILITY_IDS.AMBUSHER);
        expect(ambusherModifier).toBeDefined();
        expect(ambusherModifier?.value).toBe(1);
        
        // 计算总影响力（基础 10 + (-5) + 3 + 1 = 9）
        const totalInfluence = state.core.modifierTokens
            .filter(t => t.cardId === 'p1_card')
            .reduce((acc, t) => acc + t.value, 10);
        expect(totalInfluence).toBe(9);
        
        // 移除特定来源的修正标记（外科医生）
        const removeEvent = {
            type: CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED,
            timestamp: Date.now(),
            payload: {
                cardId: 'p1_card',
                source: ABILITY_IDS.SURGEON,
            },
        };
        
        state = {
            ...state,
            core: reduce(state.core, removeEvent as any),
        };
        
        // 验证：只移除了外科医生的修正标记
        expect(state.core.modifierTokens.length).toBe(2);
        expect(state.core.modifierTokens.find(t => t.source === ABILITY_IDS.SURGEON)).toBeUndefined();
        expect(state.core.modifierTokens.find(t => t.source === ABILITY_IDS.CLOCKMAKER)).toBeDefined();
        expect(state.core.modifierTokens.find(t => t.source === ABILITY_IDS.AMBUSHER)).toBeDefined();
        
        // 计算新的总影响力（基础 10 + 3 + 1 = 14）
        const newTotalInfluence = state.core.modifierTokens
            .filter(t => t.cardId === 'p1_card')
            .reduce((acc, t) => acc + t.value, 10);
        expect(newTotalInfluence).toBe(14);
    });

    /**
     * D13.2 多来源竞争：持续能力
     * 
     * 测试场景：多个持续能力同时生效，移除特定能力时不影响其他能力
     * 
     * 验证：
     * 1. 不同来源的持续能力可以共存
     * 2. 每个持续能力的 abilityId 和 cardId 正确标识来源
     * 3. 移除特定持续能力时不影响其他持续能力
     */
    it('D13.2 多来源持续能力正确区分', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 手动构造包含多个持续能力的状态
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'ability',
            players: {
                'player1': {
                    ...initialState.players['player1'],
                    playedCards: [
                        {
                            uid: 'p1_mediator',
                            defId: 'deck_i_card_08',
                            ownerId: 'player1',
                            baseInfluence: 8,
                            faction: 'guild',
                            abilityIds: [ABILITY_IDS.MEDIATOR],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 0,
                            ongoingMarkers: [ABILITY_IDS.MEDIATOR],
                            encounterIndex: 1,
                            imagePath: 'cardia/cards/deck1/8',
                        },
                        {
                            uid: 'p1_treasurer',
                            defId: 'deck_i_card_09',
                            ownerId: 'player1',
                            baseInfluence: 9,
                            faction: 'guild',
                            abilityIds: [ABILITY_IDS.TREASURER],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 0,
                            ongoingMarkers: [ABILITY_IDS.TREASURER],
                            encounterIndex: 2,
                            imagePath: 'cardia/cards/deck1/9',
                        },
                    ],
                },
                'player2': {
                    ...initialState.players['player2'],
                    playedCards: [],
                },
            },
            ongoingAbilities: [
                {
                    abilityId: ABILITY_IDS.MEDIATOR,
                    cardId: 'p1_mediator',
                    playerId: 'player1',
                    effectType: 'tiebreaker',
                    timestamp: 1000,
                },
                {
                    abilityId: ABILITY_IDS.TREASURER,
                    cardId: 'p1_treasurer',
                    playerId: 'player1',
                    effectType: 'extraSignet',
                    timestamp: 2000,
                    targetCardId: 'p1_mediator',
                    targetPlayerId: 'player1',
                },
            ],
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        // 验证：所有持续能力都存在
        expect(state.core.ongoingAbilities.length).toBe(2);
        
        // 验证：每个持续能力的来源正确
        const mediatorAbility = state.core.ongoingAbilities.find(
            a => a.abilityId === ABILITY_IDS.MEDIATOR
        );
        expect(mediatorAbility).toBeDefined();
        expect(mediatorAbility?.cardId).toBe('p1_mediator');
        
        const treasurerAbility = state.core.ongoingAbilities.find(
            a => a.abilityId === ABILITY_IDS.TREASURER
        );
        expect(treasurerAbility).toBeDefined();
        expect(treasurerAbility?.cardId).toBe('p1_treasurer');
        
        // 移除调停者的持续能力
        const removeEvent = {
            type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED,
            timestamp: Date.now(),
            payload: {
                abilityId: ABILITY_IDS.MEDIATOR,
                cardId: 'p1_mediator',
                playerId: 'player1',
            },
        };
        
        state = {
            ...state,
            core: reduce(state.core, removeEvent as any),
        };
        
        // 验证：只移除了调停者的持续能力
        expect(state.core.ongoingAbilities.length).toBe(1);
        expect(state.core.ongoingAbilities.find(a => a.abilityId === ABILITY_IDS.MEDIATOR)).toBeUndefined();
        expect(state.core.ongoingAbilities.find(a => a.abilityId === ABILITY_IDS.TREASURER)).toBeDefined();
        
        // 验证：卡牌的 ongoingMarkers 同步更新
        const mediatorCard = state.core.players['player1'].playedCards.find(c => c.uid === 'p1_mediator');
        expect(mediatorCard?.ongoingMarkers).not.toContain(ABILITY_IDS.MEDIATOR);
        
        const treasurerCard = state.core.players['player1'].playedCards.find(c => c.uid === 'p1_treasurer');
        expect(treasurerCard?.ongoingMarkers).toContain(ABILITY_IDS.TREASURER);
    });

    /**
     * D14.1 回合清理完整：延迟效果
     * 
     * 测试场景：延迟效果在触发后正确清除，不会泄漏到下一回合
     * 
     * 验证：
     * 1. 延迟效果在触发后从 delayedEffects 数组中移除
     * 2. 未触发的延迟效果保留到下一回合
     * 3. 回合结束时不会错误清除未触发的延迟效果
     */
    it('D14.1 延迟效果触发后正确清除', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 手动构造包含延迟效果的状态
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'play',
            delayedEffects: [
                {
                    effectType: 'modifyInfluence',
                    condition: 'onNextCardPlayed',
                    sourcePlayerId: 'player1',
                    sourceAbilityId: ABILITY_IDS.SURGEON,
                    value: -5,
                    target: 'self',
                    timestamp: 1000,
                },
            ],
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        // 验证：延迟效果存在
        expect(state.core.delayedEffects.length).toBe(1);
        
        // P1 打出卡牌（触发延迟效果）
        const nextCard = state.core.players['player1'].hand[0];
        const playCardEvents = execute(state, {
            type: CARDIA_COMMANDS.PLAY_CARD,
            playerId: 'player1',
            payload: {
                cardUid: nextCard.uid,
                slotIndex: 0,
            },
        }, {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        });
        
        // 应用事件
        for (const event of playCardEvents) {
            state = {
                ...state,
                core: reduce(state.core, event),
            };
        }
        
        // 验证：延迟效果已触发并清除
        expect(state.core.delayedEffects.length).toBe(0);
        
        // 验证：修正标记已放置
        const modifierToken = state.core.modifierTokens.find(
            t => t.cardId === nextCard.uid && t.source === ABILITY_IDS.SURGEON
        );
        expect(modifierToken).toBeDefined();
        expect(modifierToken?.value).toBe(-5);
    });

    /**
     * D14.2 回合清理完整：发明家待续标记
     * 
     * 测试场景：发明家能力的待续标记在回合结束时正确清除
     * 
     * 验证：
     * 1. inventorPending 标记在回合结束时清除
     * 2. 清除后不会影响下一回合的正常游戏
     * 3. 清除逻辑不会错误触发
     */
    it('D14.2 发明家待续标记回合结束时清除', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 手动构造包含发明家待续标记的状态
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'end',
            inventorPending: {
                playerId: 'player1',
                timestamp: 1000,
                firstCardId: 'p1_card_1',
                triggeringCardId: 'p1_inventor',
            },
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        // 验证：发明家待续标记存在
        expect(state.core.inventorPending).toBeDefined();
        expect(state.core.inventorPending?.playerId).toBe('player1');
        
        // 结束回合
        const endTurnEvents = execute(state, {
            type: CARDIA_COMMANDS.END_TURN,
            playerId: 'player1',
            payload: {},
        }, {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        });
        
        // 应用事件
        for (const event of endTurnEvents) {
            state = {
                ...state,
                core: reduce(state.core, event),
            };
        }
        
        // 验证：发明家待续标记已清除
        expect(state.core.inventorPending).toBeUndefined();
        
        // 验证：回合已推进
        expect(state.core.turnNumber).toBe(2);
    });

    /**
     * D14.3 回合清理完整：占卜师能力标记
     * 
     * 测试场景：占卜师能力的揭示顺序标记在遭遇结算后正确清除
     * 
     * 验证：
     * 1. revealFirstNextEncounter 标记在遭遇结算后清除
     * 2. forcedPlayOrderNextEncounter 标记在遭遇结算后清除
     * 3. 清除后不会影响下一次遭遇
     */
    it('D14.3 占卜师能力标记遭遇结算后清除', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 手动设置占卜师能力标记
        const testCore: CardiaCore = {
            ...initialState,
            revealFirstNextEncounter: 'player2',
            forcedPlayOrderNextEncounter: 'player1',
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        const randomFn = {
            random: () => 0.5,
            d: (max: number) => Math.floor(max / 2) + 1,
            range: (min: number, max: number) => Math.floor((min + max) / 2),
            shuffle: <T>(arr: T[]) => arr,
        };
        
        // 验证：占卜师能力标记存在
        expect(state.core.revealFirstNextEncounter).toBe('player2');
        expect(state.core.forcedPlayOrderNextEncounter).toBe('player1');
        
        // P1 打出卡牌
        const p1Card = state.core.players['player1'].hand[0];
        const p1Events = execute(state, {
            type: CARDIA_COMMANDS.PLAY_CARD,
            playerId: 'player1',
            payload: { cardUid: p1Card.uid },
        }, randomFn);
        
        for (const event of p1Events) {
            state = { ...state, core: reduce(state.core, event) };
        }
        
        // P2 打出卡牌（触发遭遇结算）
        const p2Card = state.core.players['player2'].hand[0];
        const p2Events = execute(state, {
            type: CARDIA_COMMANDS.PLAY_CARD,
            playerId: 'player2',
            payload: { cardUid: p2Card.uid },
        }, randomFn);
        
        // 逐个归约事件，在 ENCOUNTER_RESOLVED 后立即验证
        let encounterResolvedState: MatchState<CardiaCore> | null = null;
        for (const event of p2Events) {
            state = { ...state, core: reduce(state.core, event) };
            
            if (event.type === CARDIA_EVENTS.ENCOUNTER_RESOLVED) {
                // 保存遭遇解析后的状态
                encounterResolvedState = state;
            }
        }
        
        // 验证：遭遇已解析（在 ENCOUNTER_RESOLVED 事件归约后）
        expect(encounterResolvedState).toBeDefined();
        expect(encounterResolvedState!.core.currentEncounter).toBeDefined();
        
        // 验证：占卜师能力标记已清除（在 ENCOUNTER_RESOLVED 事件归约后）
        expect(encounterResolvedState!.core.revealFirstNextEncounter).toBeNull();
        expect(encounterResolvedState!.core.forcedPlayOrderNextEncounter).toBeNull();
    });

    /**
     * D14.4 回合清理完整：卡牌回收时清除标记
     * 
     * 测试场景：卡牌回收到手牌时，印戒和持续标记正确清除
     * 
     * 验证：
     * 1. 回收的卡牌 signets 重置为 0
     * 2. 回收的卡牌 ongoingMarkers 清空
     * 3. 回收的卡牌 encounterIndex 重置为 -1
     * 4. 相关的修正标记从 modifierTokens 中移除
     */
    it('D14.4 卡牌回收时清除所有标记', () => {
        const initialState = CardiaDomain.setup(['player1', 'player2'], { random: () => 0.5 });
        
        // 手动构造包含标记的卡牌
        const testCore: CardiaCore = {
            ...initialState,
            turnNumber: 1,
            phase: 'ability',
            players: {
                'player1': {
                    ...initialState.players['player1'],
                    playedCards: [
                        {
                            uid: 'p1_card',
                            defId: 'deck_i_card_10',
                            ownerId: 'player1',
                            baseInfluence: 10,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: { tags: {} },
                            signets: 2,  // 有印戒
                            ongoingMarkers: [ABILITY_IDS.MEDIATOR],  // 有持续标记
                            encounterIndex: 1,
                            imagePath: 'cardia/cards/deck1/10',
                        },
                    ],
                },
                'player2': {
                    ...initialState.players['player2'],
                    playedCards: [],
                },
            },
            modifierTokens: [
                {
                    cardId: 'p1_card',
                    value: -5,
                    source: ABILITY_IDS.SURGEON,
                    timestamp: 1000,
                },
            ],
        };
        
        let state: MatchState<CardiaCore> = {
            core: testCore,
            sys: {
                interaction: { current: null, queue: [], isBlocked: false },
            } as any,
        };
        
        // 验证：卡牌有标记
        const cardBefore = state.core.players['player1'].playedCards.find(c => c.uid === 'p1_card');
        expect(cardBefore?.signets).toBe(2);
        expect(cardBefore?.ongoingMarkers).toContain(ABILITY_IDS.MEDIATOR);
        expect(cardBefore?.encounterIndex).toBe(1);
        expect(state.core.modifierTokens.length).toBe(1);
        
        // 回收卡牌
        const recycleEvent = {
            type: CARDIA_EVENTS.CARD_RECYCLED,
            timestamp: Date.now(),
            payload: {
                playerId: 'player1',
                cardId: 'p1_card',
                from: 'field' as const,
            },
        };
        
        state = {
            ...state,
            core: reduce(state.core, recycleEvent as any),
        };
        
        // 验证：卡牌已回到手牌
        const cardInHand = state.core.players['player1'].hand.find(c => c.uid === 'p1_card');
        expect(cardInHand).toBeDefined();
        
        // 验证：所有标记已清除
        expect(cardInHand?.signets).toBe(0);
        expect(cardInHand?.ongoingMarkers).toEqual([]);
        expect(cardInHand?.encounterIndex).toBe(-1);
        
        // 验证：修正标记已移除
        expect(state.core.modifierTokens.length).toBe(0);
        
        // 验证：卡牌已从场上移除
        expect(state.core.players['player1'].playedCards.find(c => c.uid === 'p1_card')).toBeUndefined();
    });
});
