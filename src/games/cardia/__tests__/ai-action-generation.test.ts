/**
 * AI 动作生成测试
 * 
 * 验证 AI 系统能够正确生成合法动作
 */

import { describe, it, expect } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { CardiaCore } from '../domain/types';
import { cardiaAiRuntime } from '../ai';
import { createTagContainer } from '../../../engine/primitives/tags';
import { createModifierStack } from '../../../engine/primitives/modifier';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

describe('Cardia AI - 动作生成', () => {
    describe('打牌阶段', () => {
        it('应该为手牌中的每张卡牌生成打牌动作', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'card-1',
                                    defId: 'card-def-1',
                                    ownerId: '0',
                                    baseInfluence: 10,
                                    faction: 'military',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                                {
                                    uid: 'card-2',
                                    defId: 'card-def-2',
                                    ownerId: '0',
                                    baseInfluence: 15,
                                    faction: 'religious',
                                    abilityIds: ['ability-1'],
                                    difficulty: 2,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                            ],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'play',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'play' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            // 应该生成 2 个打牌动作（对应 2 张手牌）
            expect(actions).toHaveLength(2);
            expect(actions[0].kind).toBe('play-card');
            expect(actions[1].kind).toBe('play-card');
            
            // 验证动作 ID 唯一性
            const actionIds = actions.map(a => a.actionId);
            expect(new Set(actionIds).size).toBe(actionIds.length);
            
            // 验证策略标签
            const action1 = actions.find(a => a.metadata?.cardUid === 'card-1');
            const action2 = actions.find(a => a.metadata?.cardUid === 'card-2');
            
            expect(action1).toBeDefined();
            expect(action2).toBeDefined();
            
            // 高影响力卡牌应该有 aggro 标签
            expect(action2?.metadata?.strategyTags).toContain('aggro');
            
            // 有能力的卡牌应该有 value 标签
            expect(action2?.metadata?.strategyTags).toContain('value');
        });

        it('线上反馈 6a14081b：已打牌玩家不应继续暴露打牌动作', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'already-played-card',
                                    defId: 'card-def-1',
                                    ownerId: '0',
                                    baseInfluence: 10,
                                    faction: 'military',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                            ],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: false,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'play',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'play' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            expect(actions.filter(a => a.kind === 'play-card')).toHaveLength(0);
        });

        it('线上反馈 6a3517a3：占卜师要求对手先出牌时，不应给错误座位暴露打牌动作', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'card-1',
                                    defId: 'card-def-1',
                                    ownerId: '0',
                                    baseInfluence: 10,
                                    faction: 'military',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                            ],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [
                                {
                                    uid: 'card-2',
                                    defId: 'card-def-2',
                                    ownerId: '1',
                                    baseInfluence: 12,
                                    faction: 'religious',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                            ],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'play',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: '1',
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'play' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const wrongSeatActions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });
            const forcedSeatActions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '1',
            });

            expect(wrongSeatActions.filter(a => a.kind === 'play-card')).toHaveLength(0);
            expect(forcedSeatActions.filter(a => a.kind === 'play-card')).toHaveLength(1);
        });
    });

    describe('策略标签附加', () => {
        it('应该为高影响力卡牌附加 aggro 标签', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'high-influence-card',
                                    defId: 'card-def-1',
                                    ownerId: '0',
                                    baseInfluence: 20, // 高影响力
                                    faction: 'military',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                            ],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'play',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'play' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            const action = actions.find(a => a.metadata?.cardUid === 'high-influence-card');
            expect(action).toBeDefined();
            expect(action?.metadata?.strategyTags).toContain('aggro');
        });

        it('应该为有能力的卡牌附加 value 标签', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'ability-card',
                                    defId: 'card-def-1',
                                    ownerId: '0',
                                    baseInfluence: 10,
                                    faction: 'military',
                                    abilityIds: ['ability-1', 'ability-2'], // 有能力
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                            ],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'play',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'play' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            const action = actions.find(a => a.metadata?.cardUid === 'ability-card');
            expect(action).toBeDefined();
            expect(action?.metadata?.strategyTags).toContain('value');
        });

        it('应该为跳过能力动作附加 economy 标签', () => {
            const loserCard = {
                uid: 'loser-card',
                defId: 'card-def-1',
                ownerId: '0',
                baseInfluence: 5,
                faction: 'military',
                abilityIds: ['ability-1'],
                difficulty: 1,
                modifiers: createModifierStack(),
                tags: createTagContainer(),
                signets: 0,
                ongoingMarkers: [],
            };

            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'ability',
                    currentEncounter: {
                        player1Card: loserCard,
                        player2Card: {
                            uid: 'winner-card',
                            defId: 'card-def-2',
                            ownerId: '1',
                            baseInfluence: 10,
                            faction: 'religious',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: createModifierStack(),
                            tags: createTagContainer(),
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        player1Influence: 5,
                        player2Influence: 10,
                        winnerId: '1',
                        loserId: '0',
                    },
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'ability' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            const skipAction = actions.find(a => a.kind === 'skip-ability');
            expect(skipAction).toBeDefined();
            expect(skipAction?.metadata?.strategyTags).toContain('economy');
        });
    });

    describe('能力阶段', () => {
        it('应该为输掉遭遇战的卡牌生成能力动作', () => {
            const loserCard = {
                uid: 'loser-card',
                defId: 'card-def-1',
                ownerId: '0',
                baseInfluence: 5,
                faction: 'military',
                abilityIds: ['ability-1'],
                difficulty: 1,
                modifiers: createModifierStack(),
                tags: createTagContainer(),
                signets: 0,
                ongoingMarkers: [],
            };

            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'ability',
                    currentEncounter: {
                        player1Card: loserCard,
                        player2Card: {
                            uid: 'winner-card',
                            defId: 'card-def-2',
                            ownerId: '1',
                            baseInfluence: 10,
                            faction: 'religious',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: createModifierStack(),
                            tags: createTagContainer(),
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        player1Influence: 5,
                        player2Influence: 10,
                        winnerId: '1',
                        loserId: '0',
                    },
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'ability' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            // 应该生成 2 个动作：1 个激活能力 + 1 个跳过能力
            expect(actions.length).toBeGreaterThanOrEqual(1);
            
            // 应该有跳过能力动作
            const skipAction = actions.find(a => a.kind === 'skip-ability');
            expect(skipAction).toBeDefined();
            expect(skipAction?.metadata?.strategyTags).toContain('economy');
        });

        it('败者没有可用能力时也应该生成跳过能力动作', () => {
            const loserCard = {
                uid: 'loser-no-ability',
                defId: 'card-def-1',
                ownerId: '0',
                baseInfluence: 5,
                faction: 'military',
                abilityIds: [],
                difficulty: 1,
                modifiers: createModifierStack(),
                tags: createTagContainer(),
                signets: 0,
                ongoingMarkers: [],
            };

            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'ability',
                    currentEncounter: {
                        player1Card: loserCard,
                        player2Card: {
                            uid: 'winner-card',
                            defId: 'card-def-2',
                            ownerId: '1',
                            baseInfluence: 10,
                            faction: 'religious',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: createModifierStack(),
                            tags: createTagContainer(),
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        player1Influence: 5,
                        player2Influence: 10,
                        winnerId: '1',
                        loserId: '0',
                    },
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'ability' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            expect(actions).toHaveLength(1);
            expect(actions[0]).toMatchObject({
                kind: 'skip-ability',
                commands: [{
                    type: 'cardia:skip_ability',
                    payload: { playerId: '0' },
                }],
            });
        });
    });

    describe('交互阶段', () => {
        it('simple-choice 交互动作应把当前 interactionId 带进响应 payload', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'ability',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'ability' },
                    interaction: {
                        current: {
                            id: 'cardia-choice-interaction-id',
                            playerId: '0',
                            kind: 'simple-choice',
                            data: {
                                options: [
                                    {
                                        id: 'choice-1',
                                        label: '选项一',
                                        value: { branch: 'a' },
                                    },
                                ],
                            },
                        },
                        queue: [],
                    },
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            } as MatchState<CardiaCore>;

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            expect(actions).toHaveLength(1);
            expect(actions[0]).toMatchObject({
                kind: 'interaction-choice',
                commands: [{
                    type: INTERACTION_COMMANDS.RESPOND,
                    payload: {
                        interactionId: 'cardia-choice-interaction-id',
                        optionId: 'choice-1',
                        branch: 'a',
                    },
                }],
            });
        });

        it('simple-choice 多选交互应生成 optionIds 响应，而不是空动作', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'ability',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'ability' },
                    interaction: {
                        current: {
                            id: 'cardia-multi-card-choice',
                            playerId: '0',
                            kind: 'simple-choice',
                            data: {
                                multi: { min: 2, max: 2 },
                                options: [
                                    {
                                        id: 'card-a',
                                        label: '卡牌 A',
                                        value: { cardUid: 'card-a-uid' },
                                    },
                                    {
                                        id: 'card-b',
                                        label: '卡牌 B',
                                        value: { cardUid: 'card-b-uid' },
                                    },
                                    {
                                        id: 'card-c',
                                        label: '卡牌 C',
                                        value: { cardUid: 'card-c-uid' },
                                    },
                                ],
                            },
                        },
                        queue: [],
                    },
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            } as MatchState<CardiaCore>;

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            expect(actions).toHaveLength(1);
            expect(actions[0]).toMatchObject({
                kind: 'interaction-choice',
                commands: [{
                    type: INTERACTION_COMMANDS.RESPOND,
                    payload: {
                        interactionId: 'cardia-multi-card-choice',
                        optionIds: ['card-a', 'card-b'],
                    },
                }],
            });
        });

        it('未知交互属于 AI 时应生成紧急取消动作，而不是继续走阶段动作', () => {
            const state = {
                core: {
                    phase: 'play',
                    currentPlayerId: '0',
                    players: {},
                    playerOrder: ['0', '1'],
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'cardia-custom-blocker',
                            playerId: '0',
                            kind: 'cardia:future-choice',
                            data: { sourceId: 'future-choice' },
                        },
                        queue: [],
                    },
                },
            } as unknown as MatchState<CardiaCore>;

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            expect(actions).toHaveLength(1);
            expect(actions[0]).toMatchObject({
                kind: 'interaction-cancel',
                commands: [{
                    type: INTERACTION_COMMANDS.CANCEL,
                    payload: {
                        interactionId: 'cardia-custom-blocker',
                        reason: 'missing-support',
                    },
                }],
            });
        });

        it('交互属于其他玩家时不应继续生成当前 AI 的阶段动作', () => {
            const state = {
                core: {
                    phase: 'play',
                    currentPlayerId: '0',
                    players: {
                        '0': {
                            id: '0',
                            hand: [{
                                uid: 'card-1',
                                defId: 'card-def-1',
                                ownerId: '0',
                                baseInfluence: 10,
                                faction: 'military',
                                abilityIds: [],
                                difficulty: 1,
                                modifiers: createModifierStack(),
                                tags: createTagContainer(),
                                signets: 0,
                                ongoingMarkers: [],
                            }],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                    },
                    playerOrder: ['0', '1'],
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'cardia-other-player-choice',
                            playerId: '1',
                            kind: 'simple-choice',
                            data: {
                                options: [{ id: 'ok', label: '确认' }],
                            },
                        },
                        queue: [],
                    },
                },
            } as unknown as MatchState<CardiaCore>;

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            expect(actions).toEqual([]);
        });
    });

    describe('结束阶段', () => {
        it('当前玩家在结束阶段应该生成结束回合动作', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'end',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'end' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            expect(actions).toHaveLength(1);
            expect(actions[0]).toMatchObject({
                kind: 'end-turn',
                commands: [{
                    type: 'cardia:end_turn',
                    payload: {},
                }],
            });
            expect(actions[0].metadata?.strategyTags).toContain('economy');
        });
    });

    describe('动作 ID 唯一性', () => {
        it('应该为每个动作生成唯一的 actionId', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'card-1',
                                    defId: 'card-def-1',
                                    ownerId: '0',
                                    baseInfluence: 10,
                                    faction: 'military',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                                {
                                    uid: 'card-2',
                                    defId: 'card-def-2',
                                    ownerId: '0',
                                    baseInfluence: 15,
                                    faction: 'religious',
                                    abilityIds: [],
                                    difficulty: 2,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                                {
                                    uid: 'card-3',
                                    defId: 'card-def-3',
                                    ownerId: '0',
                                    baseInfluence: 12,
                                    faction: 'economic',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                            ],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'play',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'play' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            // 验证所有动作 ID 唯一
            const actionIds = actions.map(a => a.actionId);
            expect(new Set(actionIds).size).toBe(actionIds.length);
            
            // 验证每个 ID 都是非空字符串
            actionIds.forEach(id => {
                expect(id).toBeTruthy();
                expect(typeof id).toBe('string');
            });
        });
    });

    describe('元数据完整性', () => {
        it('打牌动作应该包含完整的卡牌元数据', () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'test-card',
                                    defId: 'card-def-1',
                                    ownerId: '0',
                                    baseInfluence: 15,
                                    faction: 'military',
                                    abilityIds: ['ability-1'],
                                    difficulty: 2,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 0,
                                    ongoingMarkers: [],
                                },
                            ],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: false,
                            cardRevealed: false,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'play',
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'play' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            const action = actions.find(a => a.metadata?.cardUid === 'test-card');
            expect(action).toBeDefined();
            expect(action?.metadata).toBeDefined();
            expect(action?.metadata?.cardUid).toBe('test-card');
            expect(action?.metadata?.cardInfluence).toBe(15);
            expect(action?.metadata?.cardFaction).toBe('military');
            expect(action?.metadata?.cardAbilityCount).toBe(1);
            expect(action?.metadata?.strategyTags).toBeDefined();
            expect(Array.isArray(action?.metadata?.strategyTags)).toBe(true);
        });

        it('能力动作应该包含完整的能力元数据', () => {
            const loserCard = {
                uid: 'loser-card',
                defId: 'card-def-1',
                ownerId: '0',
                baseInfluence: 5,
                faction: 'military',
                abilityIds: ['ability-1'],
                difficulty: 1,
                modifiers: createModifierStack(),
                tags: createTagContainer(),
                signets: 0,
                ongoingMarkers: [],
            };

            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                        '1': {
                            id: '1',
                            name: 'Player 2',
                            hand: [],
                            deck: [],
                            discard: [],
                            playedCards: [],
                            signets: 0,
                            tags: createTagContainer(),
                            hasPlayed: true,
                            cardRevealed: true,
                        },
                    },
                    playerOrder: ['0', '1'],
                    currentPlayerId: '0',
                    turnNumber: 1,
                    phase: 'ability',
                    currentEncounter: {
                        player1Card: loserCard,
                        player2Card: {
                            uid: 'winner-card',
                            defId: 'card-def-2',
                            ownerId: '1',
                            baseInfluence: 10,
                            faction: 'religious',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: createModifierStack(),
                            tags: createTagContainer(),
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        player1Influence: 5,
                        player2Influence: 10,
                        winnerId: '1',
                        loserId: '0',
                    },
                    encounterHistory: [],
                    ongoingAbilities: [],
                    modifierTokens: [],
                    delayedEffects: [],
                    revealFirstNextEncounter: null,
                    forcedPlayOrderNextEncounter: null,
                    mechanicalSpiritActive: null,
                    deckVariant: 'deck1',
                    targetSignets: 5,
                },
                sys: {
                    flow: { phase: 'ability' },
                    interaction: null,
                    actionLog: { entries: [] },
                    undo: { snapshots: [], aiSeatIds: [] },
                    rematch: { requests: {} },
                    responseWindow: null,
                    tutorial: null,
                    eventStream: { entries: [] },
                    gameover: null,
                },
            };

            const actions = cardiaAiRuntime.buildLegalActions({
                state,
                playerId: '0',
            });

            const activateAction = actions.find(a => a.kind === 'activate-ability');
            if (activateAction) {
                expect(activateAction.metadata).toBeDefined();
                expect(activateAction.metadata?.abilityId).toBe('ability-1');
                expect(activateAction.metadata?.strategyTags).toBeDefined();
            }

            const skipAction = actions.find(a => a.kind === 'skip-ability');
            expect(skipAction).toBeDefined();
            expect(skipAction?.metadata).toBeDefined();
            expect(skipAction?.metadata?.strategyTags).toContain('economy');
        });
    });
});

