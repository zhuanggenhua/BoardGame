/**
 * AI 评分系统测试
 * 
 * 验证 AI 评分器能够根据策略配置正确评分动作
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

describe('Cardia AI - 评分系统', () => {
    describe('策略配置影响决策', () => {
        it('aggro 策略应该优先选择高影响力卡牌', async () => {
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
            const aggroPolicy = cardiaAiRuntime.localPolicies?.aggro;
            expect(aggroPolicy).toBeDefined();

            if (!aggroPolicy) return;

            const decision = await aggroPolicy.decide(context);
            expect(decision).toBeDefined();
            expect(decision?.actionId).toBeDefined();
            
            // aggro 策略应该选择高影响力卡牌
            const selectedAction = context.legalActions.find(a => a.actionId === decision?.actionId);
            expect(selectedAction?.metadata?.cardUid).toBe('high-influence');
        });

        it('control 策略应该优先选择有能力的卡牌', async () => {
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
                                    uid: 'with-ability',
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
            const controlPolicy = cardiaAiRuntime.localPolicies?.control;
            expect(controlPolicy).toBeDefined();

            if (!controlPolicy) return;

            const decision = await controlPolicy.decide(context);
            expect(decision).toBeDefined();
            expect(decision?.actionId).toBeDefined();
            
            // control 策略应该选择有能力的卡牌
            const selectedAction = context.legalActions.find(a => a.actionId === decision?.actionId);
            expect(selectedAction?.metadata?.cardUid).toBe('with-ability');
        });

        it('balanced 策略应该能够做出决策', async () => {
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
                                    faction: 'military',
                                    abilityIds: ['ability-1'],
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
            const balancedPolicy = cardiaAiRuntime.localPolicies?.balanced;
            expect(balancedPolicy).toBeDefined();

            if (!balancedPolicy) return;

            const decision = await balancedPolicy.decide(context);
            expect(decision).toBeDefined();
            expect(decision?.actionId).toBeDefined();
            
            // balanced 策略应该选择一个合法动作
            const selectedAction = context.legalActions.find(a => a.actionId === decision?.actionId);
            expect(selectedAction).toBeDefined();
        });
    });

    describe('策略能够处理不同场景', () => {
        it('所有策略都能够做出决策', async () => {
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
            const policies = Object.values(cardiaAiRuntime.localPolicies ?? {});
            expect(policies.length).toBeGreaterThan(0);

            // 测试所有策略
            for (const policy of policies) {
                const decision = await policy.decide(context);
                expect(decision).toBeDefined();
                expect(decision?.actionId).toBeDefined();
                
                const selectedAction = context.legalActions.find(a => a.actionId === decision?.actionId);
                expect(selectedAction).toBeDefined();
            }
        });
    });
});
