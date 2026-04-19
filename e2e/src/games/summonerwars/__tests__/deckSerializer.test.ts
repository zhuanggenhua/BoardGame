/**
 * 牌组序列化/反序列化模块 - 单元测试
 *
 * 覆盖场景：
 * - 正常序列化/反序列化往返
 * - 空 manualCards 的序列化
 * - 召唤师缺失时序列化抛错
 * - 反序列化时卡牌找不到的警告处理
 * - 反序列化时召唤师找不到的警告处理
 */

import { describe, it, expect } from 'vitest';
import {
    serializeDeck,
    deserializeDeck,
    type SerializedCustomDeck,
    type SerializedCardEntry,
} from '../config/deckSerializer';
import type { DeckDraft } from '../config/deckValidation';
import type { CardRegistry } from '../config/cardRegistry';
import type { Card, UnitCard, EventCard } from '../domain/types';

// ============================================================================
// 测试用卡牌数据
// ============================================================================

const mockSummoner: UnitCard = {
    id: 'necro_summoner',
    cardType: 'unit',
    name: 'Ret-Talus',
    unitClass: 'summoner',
    faction: 'necromancer',
    strength: 3,
    life: 6,
    cost: 0,
    attackType: 'ranged',
    attackRange: 3,
    deckSymbols: ['skull'],
};

const mockChampion: UnitCard = {
    id: 'necro_champion_1',
    cardType: 'unit',
    name: 'Dragos',
    unitClass: 'champion',
    faction: 'necromancer',
    strength: 3,
    life: 5,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    deckSymbols: ['skull'],
};

const mockCommon: UnitCard = {
    id: 'necro_common_1',
    cardType: 'unit',
    name: 'Skeleton',
    unitClass: 'common',
    faction: 'necromancer',
    strength: 1,
    life: 1,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    deckSymbols: ['skull'],
};

const mockEvent: EventCard = {
    id: 'necro_event_1',
    cardType: 'event',
    name: 'Raise Dead',
    faction: 'necromancer',
    cost: 0,
    playPhase: 'summon',
    effect: 'Return a common unit from discard pile to play.',
    deckSymbols: ['skull'],
};

/** 构建测试用注册表 */
function buildTestRegistry(cards: Card[]): CardRegistry {
    const registry: CardRegistry = new Map();
    for (const card of cards) {
        registry.set(card.id, card);
    }
    return registry;
}

// ============================================================================
// 测试用例
// ============================================================================

describe('deckSerializer', () => {
    describe('serializeDeck', () => {
        it('应正确序列化包含手动卡牌的牌组', () => {
            const draft: DeckDraft = {
                name: '测试牌组',
                summoner: mockSummoner,
                autoCards: [],
                manualCards: new Map([
                    ['necro_champion_1', { card: mockChampion, count: 1 }],
                    ['necro_common_1', { card: mockCommon, count: 4 }],
                ]),
            };

            const result = serializeDeck(draft);

            expect(result.name).toBe('测试牌组');
            expect(result.summonerId).toBe('necro_summoner');
            expect(result.summonerFaction).toBe('necromancer');
            expect(result.cards).toHaveLength(2);

            // 验证卡牌条目
            const championEntry = result.cards.find(c => c.cardId === 'necro_champion_1');
            expect(championEntry).toEqual({
                cardId: 'necro_champion_1',
                faction: 'necromancer',
                count: 1,
            });

            const commonEntry = result.cards.find(c => c.cardId === 'necro_common_1');
            expect(commonEntry).toEqual({
                cardId: 'necro_common_1',
                faction: 'necromancer',
                count: 4,
            });
        });

        it('应正确序列化空 manualCards 的牌组', () => {
            const draft: DeckDraft = {
                name: '空牌组',
                summoner: mockSummoner,
                autoCards: [],
                manualCards: new Map(),
            };

            const result = serializeDeck(draft);

            expect(result.name).toBe('空牌组');
            expect(result.summonerId).toBe('necro_summoner');
            expect(result.cards).toHaveLength(0);
        });

        it('当没有召唤师时应抛出错误', () => {
            const draft: DeckDraft = {
                name: '无召唤师',
                summoner: null,
                autoCards: [],
                manualCards: new Map(),
            };

            expect(() => serializeDeck(draft)).toThrow('无法序列化没有召唤师的牌组');
        });
    });

    describe('deserializeDeck', () => {
        it('应正确反序列化牌组数据', () => {
            const registry = buildTestRegistry([mockSummoner, mockChampion, mockCommon]);

            const data: SerializedCustomDeck = {
                name: '测试牌组',
                summonerId: 'necro_summoner',
                summonerFaction: 'necromancer',
                cards: [
                    { cardId: 'necro_champion_1', faction: 'necromancer', count: 1 },
                    { cardId: 'necro_common_1', faction: 'necromancer', count: 4 },
                ],
            };

            const { deck, warnings } = deserializeDeck(data, registry);

            expect(warnings).toHaveLength(0);
            expect(deck.name).toBe('测试牌组');
            expect(deck.summoner).toEqual(mockSummoner);
            expect(deck.autoCards).toEqual([]);
            expect(deck.manualCards.size).toBe(2);

            const champion = deck.manualCards.get('necro_champion_1');
            expect(champion?.card).toEqual(mockChampion);
            expect(champion?.count).toBe(1);

            const common = deck.manualCards.get('necro_common_1');
            expect(common?.card).toEqual(mockCommon);
            expect(common?.count).toBe(4);
        });

        it('当卡牌在注册表中找不到时应跳过并记录警告', () => {
            const registry = buildTestRegistry([mockSummoner]);

            const data: SerializedCustomDeck = {
                name: '缺失卡牌牌组',
                summonerId: 'necro_summoner',
                summonerFaction: 'necromancer',
                cards: [
                    { cardId: 'nonexistent_card', faction: 'necromancer', count: 2 },
                    { cardId: 'another_missing', faction: 'goblin', count: 1 },
                ],
            };

            const { deck, warnings } = deserializeDeck(data, registry);

            expect(deck.summoner).toEqual(mockSummoner);
            expect(deck.manualCards.size).toBe(0);
            expect(warnings).toHaveLength(2);
            expect(warnings[0].cardId).toBe('nonexistent_card');
            expect(warnings[1].cardId).toBe('another_missing');
        });

        it('当召唤师在注册表中找不到时应记录警告', () => {
            const registry = buildTestRegistry([mockCommon]);

            const data: SerializedCustomDeck = {
                name: '无召唤师牌组',
                summonerId: 'missing_summoner',
                summonerFaction: 'necromancer',
                cards: [
                    { cardId: 'necro_common_1', faction: 'necromancer', count: 4 },
                ],
            };

            const { deck, warnings } = deserializeDeck(data, registry);

            expect(deck.summoner).toBeNull();
            expect(deck.manualCards.size).toBe(1);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].cardId).toBe('missing_summoner');
            expect(warnings[0].message).toContain('未找到');
        });

        it('当召唤师 ID 对应的卡牌不是召唤师类型时应记录警告', () => {
            // 注册表中有该 ID，但它是普通单位而非召唤师
            const registry = buildTestRegistry([mockCommon]);

            const data: SerializedCustomDeck = {
                name: '错误召唤师类型',
                summonerId: 'necro_common_1', // 这是普通单位，不是召唤师
                summonerFaction: 'necromancer',
                cards: [],
            };

            const { deck, warnings } = deserializeDeck(data, registry);

            expect(deck.summoner).toBeNull();
            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('不是有效的召唤师');
        });
    });

    describe('序列化往返一致性', () => {
        it('serialize → deserialize 应产生等价的牌组', () => {
            const registry = buildTestRegistry([mockSummoner, mockChampion, mockCommon, mockEvent]);

            const originalDraft: DeckDraft = {
                name: '往返测试',
                summoner: mockSummoner,
                autoCards: [], // autoCards 不参与序列化
                manualCards: new Map([
                    ['necro_champion_1', { card: mockChampion, count: 1 }],
                    ['necro_common_1', { card: mockCommon, count: 4 }],
                ]),
            };

            const serialized = serializeDeck(originalDraft);
            const { deck: deserialized, warnings } = deserializeDeck(serialized, registry);

            expect(warnings).toHaveLength(0);
            expect(deserialized.name).toBe(originalDraft.name);
            expect(deserialized.summoner).toEqual(originalDraft.summoner);
            expect(deserialized.manualCards.size).toBe(originalDraft.manualCards.size);

            // 逐条验证 manualCards 内容一致
            originalDraft.manualCards.forEach(({ card, count }, cardId) => {
                const entry = deserialized.manualCards.get(cardId);
                expect(entry).toBeDefined();
                expect(entry!.card).toEqual(card);
                expect(entry!.count).toBe(count);
            });
        });

        it('空 manualCards 的往返一致性', () => {
            const registry = buildTestRegistry([mockSummoner]);

            const originalDraft: DeckDraft = {
                name: '空牌组往返',
                summoner: mockSummoner,
                autoCards: [],
                manualCards: new Map(),
            };

            const serialized = serializeDeck(originalDraft);
            const { deck: deserialized, warnings } = deserializeDeck(serialized, registry);

            expect(warnings).toHaveLength(0);
            expect(deserialized.name).toBe(originalDraft.name);
            expect(deserialized.summoner).toEqual(originalDraft.summoner);
            expect(deserialized.manualCards.size).toBe(0);
        });
    });
});
