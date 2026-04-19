/**
 * AI 辅助函数测试
 * 
 * 验证 AI 辅助函数（评估函数）返回合理值
 * 
 * 注意：这些函数是内部实现，测试通过观察决策结果间接验证
 */

import { describe, it, expect } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { CardiaCore } from '../domain/types';
import { cardiaAiRuntime } from '../ai';
import { createTagContainer } from '../../../engine/primitives/tags';
import { createModifierStack } from '../../../engine/primitives/modifier';
import type { AiDecisionContext } from '../../../engine/ai';

function createTestContext(state: MatchState<CardiaCore>, playerId: string): AiDecisionContext {
    const actions = cardiaAiRuntime.buildLegalActions({ state, playerId });
    
    return {
        gameId: 'cardia',
        matchId: 'test-match',
        playerId,
        visibleState: state,
        interaction: null,
        responseWindow: null,
        legalActions: actions,
        rulesVersion: null,
        decisionBudgetMs: 1000,
        source: 'local',
        difficulty: { level: 'medium' },
    };
}

describe('Cardia AI - 辅助函数', () => {
    describe('卡牌价值评估', () => {
        it('应该考虑基础影响力', async () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'low-influence',
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
                                },
                                {
                                    uid: 'high-influence',
                                    defId: 'card-def-2',
                                    ownerId: '0',
                                    baseInfluence: 20,
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

            const context = createTestContext(state, '0');
            const policy = cardiaAiRuntime.localPolicies?.baseline;
            expect(policy).toBeDefined();

            if (!policy) return;

            const decision = await policy.decide(context);
            expect(decision).toBeDefined();
            
            // 验证决策选择了一个合法动作
            const selectedAction = context.legalActions.find(a => a.actionId === decision?.actionId);
            expect(selectedAction).toBeDefined();
        });

        it('应该考虑能力数量', async () => {
            const state: MatchState<CardiaCore> = {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            name: 'Player 1',
                            hand: [
                                {
                                    uid: 'no-ability',
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
                                    uid: 'with-abilities',
                                    defId: 'card-def-2',
                                    ownerId: '0',
                                    baseInfluence: 10,
                                    faction: 'military',
                                    abilityIds: ['ability-1', 'ability-2'],
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

            const context = createTestContext(state, '0');
            const policy = cardiaAiRuntime.localPolicies?.control;
            expect(policy).toBeDefined();

            if (!policy) return;

            const decision = await policy.decide(context);
            expect(decision).toBeDefined();
            
            // control 策略应该优先选择有能力的卡牌
            const selectedAction = context.legalActions.find(a => a.actionId === decision?.actionId);
            expect(selectedAction?.metadata?.cardUid).toBe('with-abilities');
        });
    });

    describe('能力价值评估', () => {
        it('应该考虑能力类型', async () => {
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

            const context = createTestContext(state, '0');
            const policy = cardiaAiRuntime.localPolicies?.baseline;
            expect(policy).toBeDefined();

            if (!policy) return;

            const decision = await policy.decide(context);
            expect(decision).toBeDefined();
            
            // 验证决策选择了一个合法动作（激活能力或跳过）
            const selectedAction = context.legalActions.find(a => a.actionId === decision?.actionId);
            expect(selectedAction).toBeDefined();
            expect(['activate-ability', 'skip-ability']).toContain(selectedAction?.kind);
        });
    });

    describe('游戏状态评估', () => {
        it('应该计算印戒差距', async () => {
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
                            playedCards: [
                                {
                                    uid: 'played-1',
                                    defId: 'card-def-2',
                                    ownerId: '0',
                                    baseInfluence: 10,
                                    faction: 'military',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 2, // 玩家 0 有 2 个印戒
                                    ongoingMarkers: [],
                                },
                            ],
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
                            playedCards: [
                                {
                                    uid: 'played-2',
                                    defId: 'card-def-3',
                                    ownerId: '1',
                                    baseInfluence: 10,
                                    faction: 'military',
                                    abilityIds: [],
                                    difficulty: 1,
                                    modifiers: createModifierStack(),
                                    tags: createTagContainer(),
                                    signets: 4, // 玩家 1 有 4 个印戒
                                    ongoingMarkers: [],
                                },
                            ],
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

            const context = createTestContext(state, '0');
            const policy = cardiaAiRuntime.localPolicies?.baseline;
            expect(policy).toBeDefined();

            if (!policy) return;

            const decision = await policy.decide(context);
            expect(decision).toBeDefined();
            
            // 验证决策选择了一个合法动作
            const selectedAction = context.legalActions.find(a => a.actionId === decision?.actionId);
            expect(selectedAction).toBeDefined();
            
            // 玩家 0 落后 2 个印戒，应该倾向于打出卡牌争夺印戒
            expect(selectedAction?.kind).toBe('play-card');
        });
    });
});
