/**
 * AI 伏击者能力交互测试
 * 
 * 测试 AI 在触发伏击者能力时能否正确生成派系选择动作
 */

import { describe, it, expect } from 'vitest';
import { cardiaAiRuntime } from '../ai';
import type { MatchState } from '../../../engine/types';
import type { CardiaCore } from '../domain/types';
import { ABILITY_IDS, CARD_IDS_DECK_I, FACTION_IDS } from '../domain/ids';

describe('AI 伏击者能力交互', () => {
    it('应该能够为派系选择交互生成合法动作', () => {
        // 创建测试状态：AI 玩家触发伏击者能力后，需要选择派系
        const testState: MatchState<CardiaCore> = {
            core: {
                phase: 'ability',
                currentPlayer: '0',
                playerOrder: ['0', '1'],
                players: {
                    '0': {
                        id: '0',
                        hand: [],
                        deck: [],
                        discard: [],
                        playedCards: [{
                            uid: 'card_09',
                            defId: CARD_IDS_DECK_I.CARD_09,
                            ownerId: '0',
                            baseInfluence: 9,
                            currentInfluence: 9,
                            faction: FACTION_IDS.SWAMP,
                            abilityIds: [ABILITY_IDS.AMBUSHER],
                            signets: 0,
                            modifiers: { entries: [], nextOrder: 0 },
                            difficulty: 2,
                        }],
                        signets: 0,
                    },
                    '1': {
                        id: '1',
                        hand: [
                            {
                                uid: 'opp_card_1',
                                defId: CARD_IDS_DECK_I.CARD_01,
                                ownerId: '1',
                                baseInfluence: 1,
                                currentInfluence: 1,
                                faction: FACTION_IDS.SWAMP,
                                abilityIds: [],
                                signets: 0,
                                modifiers: { entries: [], nextOrder: 0 },
                                difficulty: 1,
                            },
                            {
                                uid: 'opp_card_2',
                                defId: CARD_IDS_DECK_I.CARD_02,
                                ownerId: '1',
                                baseInfluence: 2,
                                currentInfluence: 2,
                                faction: FACTION_IDS.ACADEMY,
                                abilityIds: [],
                                signets: 0,
                                modifiers: { entries: [], nextOrder: 0 },
                                difficulty: 1,
                            },
                        ],
                        deck: [],
                        discard: [],
                        playedCards: [],
                        signets: 0,
                    },
                },
                currentEncounter: {
                    player1Card: {
                        uid: 'card_09',
                        defId: CARD_IDS_DECK_I.CARD_09,
                        ownerId: '0',
                        baseInfluence: 9,
                        currentInfluence: 9,
                        faction: FACTION_IDS.SWAMP,
                        abilityIds: [ABILITY_IDS.AMBUSHER],
                        signets: 0,
                        modifiers: { entries: [], nextOrder: 0 },
                        difficulty: 2,
                    },
                    player2Card: null,
                    player1Influence: 9,
                    player2Influence: 0,
                    winnerId: '0',
                    loserId: '1',
                    isTie: false,
                },
                encounterHistory: [],
                locations: [],
                ongoingAbilities: [],
            },
            sys: {
                interaction: {
                    current: {
                        id: 'ambusher_interaction_123',
                        kind: 'simple-choice',
                        playerId: '0',
                        title: '选择派系',
                        description: '选择一个派系，对手弃掉所有该派系的手牌',
                        data: {
                            options: [
                                { id: 'faction_swamp', label: 'swamp', value: { faction: 'swamp' } },
                                { id: 'faction_academy', label: 'academy', value: { faction: 'academy' } },
                                { id: 'faction_guild', label: 'guild', value: { faction: 'guild' } },
                                { id: 'faction_dynasty', label: 'dynasty', value: { faction: 'dynasty' } },
                            ],
                        },
                    },
                    history: [],
                },
                gameover: null,
            },
        } as any;

        // 调用 AI 的动作生成函数
        const actions = cardiaAiRuntime.buildLegalActions({
            state: testState,
            playerId: '0',
        });

        // 验证：应该生成 4 个派系选择动作
        expect(actions).toBeDefined();
        expect(actions.length).toBe(4);

        // 验证每个动作的结构
        actions.forEach((action) => {
            expect(action.actionId).toBeDefined();
            expect(action.kind).toBe('interaction-choice');
            expect(action.commands).toHaveLength(1);
            expect(action.commands[0].type).toBe('SYS_INTERACTION_RESPOND');
            expect(action.commands[0].payload).toHaveProperty('optionId');
        });

        // 验证派系选项
        const factionOptions = actions.map(a => a.commands[0].payload.optionId);
        expect(factionOptions).toContain('faction_swamp');
        expect(factionOptions).toContain('faction_academy');
        expect(factionOptions).toContain('faction_guild');
        expect(factionOptions).toContain('faction_dynasty');
    });

    it('应该在没有交互时返回空数组（能力阶段但无待处理交互）', () => {
        const testState: MatchState<CardiaCore> = {
            core: {
                phase: 'ability',
                currentPlayer: '0',
                playerOrder: ['0', '1'],
                players: {
                    '0': {
                        id: '0',
                        hand: [],
                        deck: [],
                        discard: [],
                        playedCards: [],
                        signets: 0,
                    },
                    '1': {
                        id: '1',
                        hand: [],
                        deck: [],
                        discard: [],
                        playedCards: [],
                        signets: 0,
                    },
                },
                currentEncounter: null,
                encounterHistory: [],
                locations: [],
                ongoingAbilities: [],
            },
            sys: {
                interaction: null,
                gameover: null,
            },
        } as any;

        const actions = cardiaAiRuntime.buildLegalActions({
            state: testState,
            playerId: '0',
        });

        // 没有输掉的卡牌，应该返回空数组
        expect(actions).toEqual([]);
    });
});
