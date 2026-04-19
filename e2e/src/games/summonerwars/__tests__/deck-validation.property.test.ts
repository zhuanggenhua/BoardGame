/**
 * 牌组验证引擎与序列化 - 属性测试 (Property-Based Testing)
 *
 * 使用 fast-check 对核心验证逻辑进行属性测试，每个属性 ≥100 次迭代。
 * 所有生成器基于真实卡牌注册表数据，不使用 mock。
 *
 * 覆盖属性：
 * - Property 1: 牌组验证完整性
 * - Property 3: 符号匹配正确性
 * - Property 4: 卡牌数量上限约束
 * - Property 6: 序列化往返一致性
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import {
    validateDeck,
    canAddCard,
    getSymbolMatch,
    type DeckDraft,
    type DeckValidationResult,
} from '../config/deckValidation';
import {
    serializeDeck,
    deserializeDeck,
} from '../config/deckSerializer';
import {
    buildCardRegistry,
    groupCardsByType,
    type CardRegistry,
} from '../config/cardRegistry';
import type {
    Card,
    UnitCard,
    EventCard,
    StructureCard,
    FactionId,
} from '../domain/types';

// ============================================================================
// 测试前准备：构建卡牌注册表
// ============================================================================

let registry: CardRegistry;
let allCards: Card[];
let summoners: UnitCard[];
let champions: UnitCard[];
let commons: UnitCard[];
let events: EventCard[];
let structures: StructureCard[];

beforeAll(() => {
    registry = buildCardRegistry();
    allCards = Array.from(registry.values());

    const grouped = groupCardsByType(allCards);
    summoners = grouped.summoners;
    champions = grouped.champions;
    commons = grouped.commons;
    events = grouped.events;
    structures = grouped.structures;
});

// ============================================================================
// 生成器（Arbitraries）
// ============================================================================

/**
 * 从注册表中随机选择一个召唤师卡牌
 */
function arbSummonerCard(): fc.Arbitrary<UnitCard> {
    return fc.integer({ min: 0, max: summoners.length - 1 }).map(i => summoners[i]);
}

/**
 * 从注册表中随机选择一张卡牌
 */
function arbCard(): fc.Arbitrary<Card> {
    return fc.integer({ min: 0, max: allCards.length - 1 }).map(i => allCards[i]);
}

/**
 * 从注册表中随机选择一张非召唤师卡牌（用于手动添加）
 */
function arbNonSummonerCard(): fc.Arbitrary<Card> {
    const nonSummoners = allCards.filter(
        c => !(c.cardType === 'unit' && c.unitClass === 'summoner'),
    );
    return fc.integer({ min: 0, max: nonSummoners.length - 1 }).map(i => nonSummoners[i]);
}

/**
 * 生成随机的 manualCards Map
 * 每张卡牌数量在 1-6 之间（可能超出上限，用于测试验证）
 */
function arbManualCards(): fc.Arbitrary<Map<string, { card: Card; count: number }>> {
    const nonSummoners = allCards.filter(
        c => !(c.cardType === 'unit' && c.unitClass === 'summoner'),
    );
    if (nonSummoners.length === 0) {
        return fc.constant(new Map());
    }

    return fc.array(
        fc.record({
            cardIndex: fc.integer({ min: 0, max: nonSummoners.length - 1 }),
            count: fc.integer({ min: 1, max: 6 }),
        }),
        { minLength: 0, maxLength: 10 },
    ).map(entries => {
        const map = new Map<string, { card: Card; count: number }>();
        for (const { cardIndex, count } of entries) {
            const card = nonSummoners[cardIndex];
            // 如果同一张卡牌被多次选中，取最后一次的数量
            map.set(card.id, { card, count });
        }
        return map;
    });
}

/**
 * 生成随机的 DeckDraft（包括合法和非法状态）
 * 用于测试 validateDeck 的完整性
 */
function arbDeckDraft(): fc.Arbitrary<DeckDraft> {
    return fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }),
        hasSummoner: fc.boolean(),
        manualCards: arbManualCards(),
    }).chain(({ name, hasSummoner, manualCards }) => {
        if (!hasSummoner || summoners.length === 0) {
            return fc.constant<DeckDraft>({
                name,
                summoner: null,
                autoCards: [],
                manualCards,
            });
        }
        return arbSummonerCard().map(summoner => ({
            name,
            summoner,
            autoCards: [],
            manualCards,
        }));
    });
}

/**
 * 生成随机的牌组符号列表
 */
function arbDeckSymbols(): fc.Arbitrary<string[]> {
    const allSymbols = [
        'double_axe', 'flame', 'moon', 'eye', 'wave',
        'shield', 'diamond', 'claw', 'mask', 'snowflake',
        'droplet', 'star', 'rhombus',
    ];
    return fc.subarray(allSymbols, { minLength: 0, maxLength: 4 });
}

/**
 * 生成一个有召唤师的 DeckDraft（用于序列化测试，序列化要求有召唤师）
 */
function arbDeckDraftWithSummoner(): fc.Arbitrary<DeckDraft> {
    if (summoners.length === 0) {
        throw new Error('注册表中没有召唤师卡牌，无法生成测试数据');
    }
    return fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }),
        summoner: arbSummonerCard(),
        manualCards: arbManualCards(),
    }).map(({ name, summoner, manualCards }) => ({
        name,
        summoner,
        autoCards: [],
        manualCards,
    }));
}

// ============================================================================
// Property 1: 牌组验证完整性
// Feature: sw-custom-deck, Property 1: 牌组验证完整性
// **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8**
// ============================================================================

describe('Property 1: 牌组验证完整性', () => {
    it('validateDeck 对任意 DeckDraft 应返回结构正确的 DeckValidationResult', () => {
        fc.assert(
            fc.property(arbDeckDraft(), (draft: DeckDraft) => {
                const result = validateDeck(draft);

                // 结果结构必须正确
                expect(result).toHaveProperty('valid');
                expect(result).toHaveProperty('errors');
                expect(typeof result.valid).toBe('boolean');
                expect(Array.isArray(result.errors)).toBe(true);

                // valid 为 true 当且仅当 errors 为空
                expect(result.valid).toBe(result.errors.length === 0);
            }),
            { numRuns: 100 },
        );
    });

    it('无召唤师的牌组必须报告 summoner_count 错误', () => {
        fc.assert(
            fc.property(arbManualCards(), (manualCards) => {
                const draft: DeckDraft = {
                    name: '无召唤师测试',
                    summoner: null,
                    autoCards: [],
                    manualCards,
                };

                const result = validateDeck(draft);

                // 无召唤师时必须报错
                expect(result.valid).toBe(false);
                const summonerError = result.errors.find(e => e.rule === 'summoner_count');
                expect(summonerError).toBeDefined();
                expect(summonerError!.current).toBe(0);
                expect(summonerError!.expected).toBe(1);
            }),
            { numRuns: 100 },
        );
    });

    it('每个验证错误应包含完整的结构信息', () => {
        fc.assert(
            fc.property(arbDeckDraft(), (draft: DeckDraft) => {
                const result = validateDeck(draft);

                for (const error of result.errors) {
                    // 每个错误必须有 rule、message、current、expected
                    expect(error).toHaveProperty('rule');
                    expect(error).toHaveProperty('message');
                    expect(error).toHaveProperty('current');
                    expect(error).toHaveProperty('expected');
                    expect(typeof error.rule).toBe('string');
                    expect(typeof error.message).toBe('string');
                    expect(typeof error.current).toBe('number');
                    expect(typeof error.expected).toBe('number');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('普通单位不足16时应报告 commons 错误', () => {
        fc.assert(
            fc.property(arbSummonerCard(), (summoner: UnitCard) => {
                // 构建一个普通单位不足的牌组
                const draft: DeckDraft = {
                    name: '普通不足测试',
                    summoner,
                    autoCards: [],
                    manualCards: new Map(), // 空的手动卡牌 → 0 个普通单位
                };

                const result = validateDeck(draft);

                // 应报告 commons 错误
                const commonsError = result.errors.find(e => e.rule === 'commons');
                expect(commonsError).toBeDefined();
                expect(commonsError!.current).toBeLessThan(16);
                expect(commonsError!.expected).toBe(16);
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 3: 符号匹配正确性
// Feature: sw-custom-deck, Property 3: 符号匹配正确性
// **Validates: Requirements 3.5, 4.2**
// ============================================================================

describe('Property 3: 符号匹配正确性', () => {
    it('有符号的普通事件卡与召唤师匹配结果等于交集判断', () => {
        // 只测试普通事件（非传奇、非建筑、非召唤师），这些走纯交集逻辑
        const standardEvents = allCards.filter(
            (c): c is EventCard => c.cardType === 'event' && c.eventType !== 'legendary' && c.deckSymbols.length > 0,
        );
        if (standardEvents.length === 0) return;

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: standardEvents.length - 1 }),
                arbSummonerCard(),
                (cardIdx: number, summoner: UnitCard) => {
                    const card = standardEvents[cardIdx];
                    const result = getSymbolMatch(card, summoner.deckSymbols);
                    const hasIntersection = card.deckSymbols.some(
                        s => summoner.deckSymbols.includes(s),
                    );
                    expect(result).toBe(hasIntersection);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('传奇事件无需符号匹配，始终返回 true', () => {
        const legendaryEvents = allCards.filter(
            (c): c is EventCard => c.cardType === 'event' && c.eventType === 'legendary',
        );
        if (legendaryEvents.length === 0) return;

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: legendaryEvents.length - 1 }),
                arbDeckSymbols(),
                (cardIdx: number, summonerSymbols: string[]) => {
                    const card = legendaryEvents[cardIdx];
                    expect(getSymbolMatch(card, summonerSymbols)).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('建筑卡无需符号匹配，始终返回 true', () => {
        if (structures.length === 0) return;

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: structures.length - 1 }),
                arbDeckSymbols(),
                (cardIdx: number, summonerSymbols: string[]) => {
                    const card = structures[cardIdx];
                    expect(getSymbolMatch(card, summonerSymbols)).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('召唤师卡无需符号匹配，始终返回 true', () => {
        fc.assert(
            fc.property(arbSummonerCard(), arbDeckSymbols(), (summoner: UnitCard, symbols: string[]) => {
                expect(getSymbolMatch(summoner, symbols)).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('空 deckSymbols 的普通事件卡默认允许（返回 true）', () => {
        fc.assert(
            fc.property(arbDeckSymbols(), (summonerSymbols: string[]) => {
                const cardWithNoSymbols: Card = {
                    id: 'test-no-symbols',
                    cardType: 'event',
                    name: '无符号事件',
                    eventType: 'common',
                    faction: 'necromancer',
                    cost: 0,
                    playPhase: 'any',
                    effect: '测试',
                    deckSymbols: [],
                } as EventCard;

                // 空 deckSymbols 的卡牌默认允许
                expect(getSymbolMatch(cardWithNoSymbols, summonerSymbols)).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('符号匹配对称性：普通事件卡之间的交集判断是对称的', () => {
        fc.assert(
            fc.property(
                arbDeckSymbols(),
                arbDeckSymbols(),
                (cardSymbols: string[], summonerSymbols: string[]) => {
                    // 构造两张普通事件卡（非特殊类型，走纯交集逻辑）
                    const makeCard = (id: string, symbols: string[]): EventCard => ({
                        id,
                        cardType: 'event',
                        name: '测试',
                        eventType: 'common',
                        faction: 'necromancer',
                        cost: 0,
                        playPhase: 'any',
                        effect: '测试',
                        deckSymbols: symbols,
                    } as EventCard);

                    const cardA = makeCard('test-a', cardSymbols);
                    const cardB = makeCard('test-b', summonerSymbols);

                    // 当两张卡都有符号时，交集判断是对称的
                    if (cardSymbols.length > 0 && summonerSymbols.length > 0) {
                        const forward = getSymbolMatch(cardA, summonerSymbols);
                        const backward = getSymbolMatch(cardB, cardSymbols);
                        expect(forward).toBe(backward);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('注册表中有符号的卡牌与召唤师匹配结果应与手动计算一致', () => {
        fc.assert(
            fc.property(arbSummonerCard(), (summoner: UnitCard) => {
                const summonerSymbols = summoner.deckSymbols;

                // 只测试有符号的非特殊卡牌（排除召唤师/传奇事件/建筑，它们有特殊规则）
                const testableCards = allCards.filter(c => {
                    if (c.cardType === 'unit' && c.unitClass === 'summoner') return false;
                    if (c.cardType === 'event' && (c as EventCard).eventType === 'legendary') return false;
                    if (c.cardType === 'structure') return false;
                    return c.deckSymbols.length > 0;
                });

                for (const card of testableCards) {
                    const result = getSymbolMatch(card, summonerSymbols);
                    const expected = card.deckSymbols.some(s => summonerSymbols.includes(s));
                    expect(result).toBe(expected);
                }
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 4: 卡牌数量上限约束
// Feature: sw-custom-deck, Property 4: 卡牌数量上限约束
// **Validates: Requirements 4.4, 4.5, 4.6**
// ============================================================================

describe('Property 4: 卡牌数量上限约束', () => {
    it('无召唤师时 canAddCard 应拒绝添加', () => {
        fc.assert(
            fc.property(arbCard(), (card: Card) => {
                const draft: DeckDraft = {
                    name: '无召唤师',
                    summoner: null,
                    autoCards: [],
                    manualCards: new Map(),
                };

                const result = canAddCard(draft, card);
                expect(result.allowed).toBe(false);
                expect(result.reason).toBeDefined();
            }),
            { numRuns: 100 },
        );
    });

    it('canAddCard 返回结构正确的结果', () => {
        fc.assert(
            fc.property(
                arbDeckDraft(),
                arbCard(),
                (draft: DeckDraft, card: Card) => {
                    const result = canAddCard(draft, card);

                    // 结果必须有 allowed 字段
                    expect(result).toHaveProperty('allowed');
                    expect(typeof result.allowed).toBe('boolean');

                    // 如果不允许，必须有 reason
                    if (!result.allowed) {
                        expect(result.reason).toBeDefined();
                        expect(typeof result.reason).toBe('string');
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('canAddCard 对有召唤师的牌组应返回布尔结果', () => {
        fc.assert(
            fc.property(
                arbSummonerCard(),
                arbNonSummonerCard(),
                (summoner: UnitCard, card: Card) => {
                    const draft: DeckDraft = {
                        name: '有召唤师测试',
                        summoner,
                        autoCards: [],
                        manualCards: new Map(),
                    };

                    const result = canAddCard(draft, card);
                    expect(typeof result.allowed).toBe('boolean');
                },
            ),
            { numRuns: 100 },
        );
    });

    // ========================================================================
    // 边界测试：各类别达到上限后拒绝添加
    // ========================================================================

    it('普通单位达到16张上限后应拒绝继续添加', () => {
        if (summoners.length === 0 || commons.length === 0) return;

        // 选一个召唤师，用自由模式跳过符号匹配
        const summoner = summoners[0];
        const manualCards = new Map<string, { card: Card; count: number }>();

        // 用不同的普通单位填满16张（每种最多4张）
        let filled = 0;
        const usedIds = new Set<string>();
        for (const c of commons) {
            if (filled >= 16) break;
            const toAdd = Math.min(4, 16 - filled);
            manualCards.set(c.id, { card: c, count: toAdd });
            usedIds.add(c.id);
            filled += toAdd;
        }

        const draft: DeckDraft = {
            name: '普通上限测试',
            summoner,
            autoCards: [],
            manualCards,
            freeMode: true,
        };

        // 找一个未使用的普通单位来测试总数上限（避免命中同名上限）
        const extraCommon = commons.find(c => !usedIds.has(c.id)) ?? commons[0];
        const result = canAddCard(draft, extraCommon);
        expect(result.allowed).toBe(false);
    });

    it('同名普通单位达到4张上限后应拒绝继续添加', () => {
        if (summoners.length === 0 || commons.length === 0) return;

        const summoner = summoners[0];
        const targetCommon = commons[0];
        const manualCards = new Map<string, { card: Card; count: number }>();
        manualCards.set(targetCommon.id, { card: targetCommon, count: 4 });

        const draft: DeckDraft = {
            name: '同名普通上限测试',
            summoner,
            autoCards: [],
            manualCards,
            freeMode: true,
        };

        const result = canAddCard(draft, targetCommon);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('4');
    });

    it('冠军单位达到3个上限后应拒绝继续添加', () => {
        if (summoners.length === 0 || champions.length < 3) return;

        const summoner = summoners[0];
        const manualCards = new Map<string, { card: Card; count: number }>();

        // 填满3个不同冠军（每种最多1个）
        for (let i = 0; i < 3 && i < champions.length; i++) {
            manualCards.set(champions[i].id, { card: champions[i], count: 1 });
        }

        const draft: DeckDraft = {
            name: '冠军上限测试',
            summoner,
            autoCards: [],
            manualCards,
            freeMode: true,
        };

        // 再添加任意冠军应被拒绝
        const extraChampion = champions.length > 3 ? champions[3] : champions[0];
        const result = canAddCard(draft, extraChampion);
        expect(result.allowed).toBe(false);
    });

    it('标准事件达到6张上限后应拒绝继续添加', () => {
        const standardEvents = events.filter(e => e.eventType !== 'legendary');
        if (summoners.length === 0 || standardEvents.length === 0) return;

        const summoner = summoners[0];
        const manualCards = new Map<string, { card: Card; count: number }>();

        // 用不同标准事件填满6张（每种最多2张）
        let filled = 0;
        const usedIds = new Set<string>();
        for (const e of standardEvents) {
            if (filled >= 6) break;
            const toAdd = Math.min(2, 6 - filled);
            manualCards.set(e.id, { card: e, count: toAdd });
            usedIds.add(e.id);
            filled += toAdd;
        }

        const draft: DeckDraft = {
            name: '标准事件上限测试',
            summoner,
            autoCards: [],
            manualCards,
            freeMode: true,
        };

        // 找一个未使用的标准事件来测试总数上限（避免命中同名上限）
        const extraEvent = standardEvents.find(e => !usedIds.has(e.id)) ?? standardEvents[0];
        const result = canAddCard(draft, extraEvent);
        expect(result.allowed).toBe(false);
    });

    it('同名标准事件达到2张上限后应拒绝继续添加', () => {
        const standardEvents = events.filter(e => e.eventType !== 'legendary');
        if (summoners.length === 0 || standardEvents.length === 0) return;

        const summoner = summoners[0];
        const targetEvent = standardEvents[0];
        const manualCards = new Map<string, { card: Card; count: number }>();
        manualCards.set(targetEvent.id, { card: targetEvent, count: 2 });

        const draft: DeckDraft = {
            name: '同名标准事件上限测试',
            summoner,
            autoCards: [],
            manualCards,
            freeMode: true,
        };

        const result = canAddCard(draft, targetEvent);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('2');
    });
});

// ============================================================================
// Property 6: 序列化往返一致性
// Feature: sw-custom-deck, Property 6: 序列化往返一致性
// **Validates: Requirements 8.1, 8.2, 8.3**
// ============================================================================

describe('Property 6: 序列化往返一致性', () => {
    it('serialize → deserialize 应保持牌组名称一致', () => {
        fc.assert(
            fc.property(arbDeckDraftWithSummoner(), (draft: DeckDraft) => {
                const serialized = serializeDeck(draft);
                const { deck: deserialized, warnings } = deserializeDeck(serialized, registry);

                // 名称应一致
                expect(deserialized.name).toBe(draft.name);
            }),
            { numRuns: 100 },
        );
    });

    it('serialize → deserialize 应保持召唤师一致', () => {
        fc.assert(
            fc.property(arbDeckDraftWithSummoner(), (draft: DeckDraft) => {
                const serialized = serializeDeck(draft);
                const { deck: deserialized } = deserializeDeck(serialized, registry);

                // 召唤师应一致（注册表中能找到的情况下）
                if (draft.summoner && registry.has(draft.summoner.id)) {
                    expect(deserialized.summoner).not.toBeNull();
                    expect(deserialized.summoner!.id).toBe(draft.summoner.id);
                    expect(deserialized.summoner!.unitClass).toBe('summoner');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('serialize → deserialize 应保持 manualCards 数量一致', () => {
        fc.assert(
            fc.property(arbDeckDraftWithSummoner(), (draft: DeckDraft) => {
                const serialized = serializeDeck(draft);
                const { deck: deserialized, warnings } = deserializeDeck(serialized, registry);

                // 所有在注册表中能找到的卡牌应保持一致
                let expectedCount = 0;
                draft.manualCards.forEach(({ card }) => {
                    if (registry.has(card.id)) {
                        expectedCount++;
                    }
                });

                expect(deserialized.manualCards.size).toBe(expectedCount);
            }),
            { numRuns: 100 },
        );
    });

    it('serialize → deserialize 应保持每张卡牌的数量一致', () => {
        fc.assert(
            fc.property(arbDeckDraftWithSummoner(), (draft: DeckDraft) => {
                const serialized = serializeDeck(draft);
                const { deck: deserialized } = deserializeDeck(serialized, registry);

                // 逐条验证在注册表中能找到的卡牌
                draft.manualCards.forEach(({ card, count }, cardId) => {
                    if (registry.has(card.id)) {
                        const entry = deserialized.manualCards.get(cardId);
                        expect(entry).toBeDefined();
                        expect(entry!.count).toBe(count);
                        expect(entry!.card.id).toBe(card.id);
                    }
                });
            }),
            { numRuns: 100 },
        );
    });

    it('序列化结果应包含正确的结构字段', () => {
        fc.assert(
            fc.property(arbDeckDraftWithSummoner(), (draft: DeckDraft) => {
                const serialized = serializeDeck(draft);

                // 序列化结果必须包含所有必要字段
                expect(serialized).toHaveProperty('name');
                expect(serialized).toHaveProperty('summonerId');
                expect(serialized).toHaveProperty('summonerFaction');
                expect(serialized).toHaveProperty('cards');
                expect(Array.isArray(serialized.cards)).toBe(true);

                // 名称应与原始一致
                expect(serialized.name).toBe(draft.name);
                // 召唤师 ID 应与原始一致
                expect(serialized.summonerId).toBe(draft.summoner!.id);

                // cards 数量应与 manualCards 一致
                expect(serialized.cards.length).toBe(draft.manualCards.size);

                // 每个 card entry 应有正确结构
                for (const entry of serialized.cards) {
                    expect(entry).toHaveProperty('cardId');
                    expect(entry).toHaveProperty('faction');
                    expect(entry).toHaveProperty('count');
                    expect(typeof entry.cardId).toBe('string');
                    expect(typeof entry.count).toBe('number');
                    expect(entry.count).toBeGreaterThan(0);
                }
            }),
            { numRuns: 100 },
        );
    });

    it('无 manualCards 的牌组序列化往返应一致', () => {
        fc.assert(
            fc.property(arbSummonerCard(), (summoner: UnitCard) => {
                const draft: DeckDraft = {
                    name: '空牌组',
                    summoner,
                    autoCards: [],
                    manualCards: new Map(),
                };

                const serialized = serializeDeck(draft);
                expect(serialized.cards).toHaveLength(0);

                const { deck: deserialized, warnings } = deserializeDeck(serialized, registry);

                // 空牌组往返后仍为空
                expect(deserialized.manualCards.size).toBe(0);
                expect(deserialized.name).toBe(draft.name);

                // 召唤师应一致（如果注册表中有）
                if (registry.has(summoner.id)) {
                    expect(deserialized.summoner).not.toBeNull();
                    expect(deserialized.summoner!.id).toBe(summoner.id);
                }
            }),
            { numRuns: 100 },
        );
    });

    it('没有召唤师的牌组不可序列化', () => {
        fc.assert(
            fc.property(arbManualCards(), (manualCards) => {
                const draft: DeckDraft = {
                    name: '无召唤师',
                    summoner: null,
                    autoCards: [],
                    manualCards,
                };

                expect(() => serializeDeck(draft)).toThrow('无法序列化没有召唤师的牌组');
            }),
            { numRuns: 100 },
        );
    });
});
