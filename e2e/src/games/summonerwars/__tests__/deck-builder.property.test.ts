/**
 * useDeckBuilder 核心逻辑 - 属性测试 (Property-Based Testing)
 *
 * 使用 fast-check 对牌组构建核心逻辑进行属性测试，每个属性 ≥100 次迭代。
 * 测试纯函数逻辑（不依赖 React），基于真实卡牌注册表数据。
 *
 * 覆盖属性：
 * - Property 2: 召唤师选择自动填充
 * - Property 5: 添加/移除卡牌往返一致性
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import {
    buildCardRegistry,
    type CardRegistry,
} from '../config/cardRegistry';
import { createDeckByFactionId, resolveFactionId } from '../config/factions';
import {
    type DeckDraft,
    canAddCard,
    getSymbolMatch,
} from '../config/deckValidation';
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

beforeAll(() => {
    registry = buildCardRegistry();
    allCards = Array.from(registry.values());

    summoners = allCards.filter(
        (c): c is UnitCard => c.cardType === 'unit' && c.unitClass === 'summoner',
    );
});

// ============================================================================
// 辅助函数：复现 useDeckBuilder 中的 buildAutoCards 逻辑
// ============================================================================

/**
 * 复现 useDeckBuilder.ts 中 buildAutoCards 的逻辑
 * 用于测试属性 2（召唤师选择自动填充）
 *
 * 包含：
 * - 该召唤师阵营的起始单位（来自预构筑配置的 startingUnits）
 * - 该召唤师阵营的史诗事件（eventType === 'legendary'，去重）
 * - 起始城门（10HP）
 * - 传送门（5HP，从牌组中筛选）
 */
function buildAutoCards(summoner: UnitCard): Card[] {
    const factionId = resolveFactionId(summoner.faction);
    const autoCards: Card[] = [];

    try {
        const factionDeck = createDeckByFactionId(factionId);

        // 起始单位（来自预构筑配置的 startingUnits）
        for (const { unit } of factionDeck.startingUnits) {
            autoCards.push(unit);
        }

        // 传奇事件（从牌组中筛选，去重）
        const seenLegendary = new Set<string>();
        for (const card of factionDeck.deck) {
            if (card.cardType === 'event' && card.eventType === 'legendary') {
                const baseId = card.id.replace(/-\d+$/, '');
                if (!seenLegendary.has(baseId)) {
                    seenLegendary.add(baseId);
                    autoCards.push(card);
                }
            }
        }

        // 起始城门（10HP）
        autoCards.push(factionDeck.startingGate);

        // 传送门（5HP，从牌组中筛选）
        const portals = factionDeck.deck.filter(
            c => c.cardType === 'structure' && (c as StructureCard).isGate && !(c as StructureCard).isStartingGate,
        );
        autoCards.push(...portals);
    } catch {
        // 阵营数据不可用
    }

    return autoCards;
}

/**
 * 模拟 useDeckBuilder 中 addCard 的纯逻辑部分
 */
function simulateAddCard(
    draft: DeckDraft,
    card: Card,
): { success: boolean; newManualCards: Map<string, { card: Card; count: number }> } {
    const check = canAddCard(draft, card);
    if (!check.allowed) {
        return { success: false, newManualCards: draft.manualCards };
    }

    if (draft.summoner && !getSymbolMatch(card, draft.summoner.deckSymbols)) {
        return { success: false, newManualCards: draft.manualCards };
    }

    const newMap = new Map(draft.manualCards);
    const existing = newMap.get(card.id);
    if (existing) {
        newMap.set(card.id, { card, count: existing.count + 1 });
    } else {
        newMap.set(card.id, { card, count: 1 });
    }

    return { success: true, newManualCards: newMap };
}

/**
 * 模拟 useDeckBuilder 中 removeCard 的纯逻辑部分
 */
function simulateRemoveCard(
    manualCards: Map<string, { card: Card; count: number }>,
    cardId: string,
): Map<string, { card: Card; count: number }> {
    const newMap = new Map(manualCards);
    const existing = newMap.get(cardId);
    if (!existing) return newMap;

    if (existing.count > 1) {
        newMap.set(cardId, { ...existing, count: existing.count - 1 });
    } else {
        newMap.delete(cardId);
    }
    return newMap;
}

// ============================================================================
// 生成器（Arbitraries）
// ============================================================================

function arbSummonerCard(): fc.Arbitrary<UnitCard> {
    return fc.integer({ min: 0, max: summoners.length - 1 }).map(i => summoners[i]);
}

function arbEmptyDeckWithSummoner(): fc.Arbitrary<DeckDraft> {
    return arbSummonerCard().map(summoner => ({
        name: '测试牌组',
        summoner,
        autoCards: buildAutoCards(summoner),
        manualCards: new Map(),
    }));
}

function arbDraftWithMatchingCard(): fc.Arbitrary<{ draft: DeckDraft; card: Card }> {
    return arbSummonerCard().chain(summoner => {
        const summonerSymbols = summoner.deckSymbols;

        const matchingCards = allCards.filter(c => {
            if (c.cardType === 'unit' && c.unitClass === 'summoner') return false;
            if (c.cardType === 'structure' && (c as StructureCard).isGate) return false;
            return getSymbolMatch(c, summonerSymbols);
        });

        if (matchingCards.length === 0) {
            return fc.constant({
                draft: {
                    name: '测试牌组',
                    summoner,
                    autoCards: buildAutoCards(summoner),
                    manualCards: new Map(),
                } as DeckDraft,
                card: allCards[0],
            });
        }

        return fc.integer({ min: 0, max: matchingCards.length - 1 }).map(cardIdx => ({
            draft: {
                name: '测试牌组',
                summoner,
                autoCards: buildAutoCards(summoner),
                manualCards: new Map(),
            } as DeckDraft,
            card: matchingCards[cardIdx],
        }));
    });
}

// ============================================================================
// Property 2: 召唤师选择自动填充
// ============================================================================

describe('Property 2: 召唤师选择自动填充', () => {
    it('选择任意召唤师后，autoCards 应包含起始单位', () => {
        fc.assert(
            fc.property(arbSummonerCard(), (summoner: UnitCard) => {
                const autoCards = buildAutoCards(summoner);
                const factionId = resolveFactionId(summoner.faction);
                const factionDeck = createDeckByFactionId(factionId);

                const startingUnitsInAuto = autoCards.filter(c => c.cardType === 'unit');
                expect(startingUnitsInAuto.length).toBe(factionDeck.startingUnits.length);

                for (const { unit } of factionDeck.startingUnits) {
                    expect(startingUnitsInAuto.find(c => c.id === unit.id)).toBeDefined();
                }
            }),
            { numRuns: 100 },
        );
    });

    it('选择任意召唤师后，autoCards 应包含史诗事件（legendary）', () => {
        fc.assert(
            fc.property(arbSummonerCard(), (summoner: UnitCard) => {
                const autoCards = buildAutoCards(summoner);
                const factionId = resolveFactionId(summoner.faction);
                const factionDeck = createDeckByFactionId(factionId);

                const seenLegendary = new Set<string>();
                for (const card of factionDeck.deck) {
                    if (card.cardType === 'event' && card.eventType === 'legendary') {
                        seenLegendary.add(card.id.replace(/-\d+$/, ''));
                    }
                }

                const epicEventsInAuto = autoCards.filter(
                    c => c.cardType === 'event' && (c as EventCard).eventType === 'legendary',
                );
                expect(epicEventsInAuto.length).toBe(seenLegendary.size);
            }),
            { numRuns: 100 },
        );
    });

    it('选择任意召唤师后，autoCards 应包含起始城门和传送门', () => {
        fc.assert(
            fc.property(arbSummonerCard(), (summoner: UnitCard) => {
                const autoCards = buildAutoCards(summoner);
                const factionId = resolveFactionId(summoner.faction);
                const factionDeck = createDeckByFactionId(factionId);

                const gatesInAuto = autoCards.filter(
                    c => c.cardType === 'structure' && (c as StructureCard).isGate,
                );
                const startingGatesInAuto = gatesInAuto.filter(
                    c => (c as StructureCard).isStartingGate,
                );
                expect(startingGatesInAuto.length).toBe(1);

                const portalsInDeck = factionDeck.deck.filter(
                    c => c.cardType === 'structure' && (c as StructureCard).isGate && !(c as StructureCard).isStartingGate,
                );
                const portalsInAuto = gatesInAuto.filter(c => !(c as StructureCard).isStartingGate);
                expect(portalsInAuto.length).toBe(portalsInDeck.length);
            }),
            { numRuns: 100 },
        );
    });

    it('更换召唤师时，旧召唤师的自动卡牌应被完全替换', () => {
        if (summoners.length < 2) return;

        fc.assert(
            fc.property(
                arbSummonerCard(),
                arbSummonerCard(),
                (summoner1: UnitCard, summoner2: UnitCard) => {
                    fc.pre(summoner1.id !== summoner2.id);

                    const autoCards1 = buildAutoCards(summoner1);
                    const autoCards2 = buildAutoCards(summoner2);

                    if (summoner1.faction !== summoner2.faction) {
                        const startingUnits1 = autoCards1.filter(c => c.cardType === 'unit').map(c => c.id);
                        const startingUnits2 = autoCards2.filter(c => c.cardType === 'unit').map(c => c.id);

                        const intersection = startingUnits1.filter(id => startingUnits2.includes(id));
                        expect(intersection.length).toBe(0);
                    }

                    // autoCards2 应是 summoner2 的正确自动填充
                    const factionDeck2 = createDeckByFactionId(resolveFactionId(summoner2.faction));
                    const unitsInAuto2 = autoCards2.filter(c => c.cardType === 'unit');
                    expect(unitsInAuto2.length).toBe(factionDeck2.startingUnits.length);
                    for (const { unit } of factionDeck2.startingUnits) {
                        expect(unitsInAuto2.find(c => c.id === unit.id)).toBeDefined();
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('autoCards 的总数量应为：起始单位 + 传奇事件 + 城门', () => {
        fc.assert(
            fc.property(arbSummonerCard(), (summoner: UnitCard) => {
                const autoCards = buildAutoCards(summoner);
                const factionId = resolveFactionId(summoner.faction);
                const factionDeck = createDeckByFactionId(factionId);

                const startingUnitsCount = factionDeck.startingUnits.length;

                const seenLegendary = new Set<string>();
                for (const card of factionDeck.deck) {
                    if (card.cardType === 'event' && card.eventType === 'legendary') {
                        seenLegendary.add(card.id.replace(/-\d+$/, ''));
                    }
                }
                const epicEventsCount = seenLegendary.size;
                const startingGateCount = 1;
                const portalsCount = factionDeck.deck.filter(
                    c => c.cardType === 'structure' && (c as StructureCard).isGate && !(c as StructureCard).isStartingGate,
                ).length;

                const expectedTotal = startingUnitsCount + epicEventsCount + startingGateCount + portalsCount;
                expect(autoCards.length).toBe(expectedTotal);
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 5: 添加/移除卡牌往返一致性
// ============================================================================

describe('Property 5: 添加/移除卡牌往返一致性', () => {
    it('addCard → removeCard 应恢复原始 manualCards 状态（空牌组）', () => {
        fc.assert(
            fc.property(
                arbDraftWithMatchingCard(),
                ({ draft, card }) => {
                    const originalSize = draft.manualCards.size;
                    const addResult = simulateAddCard(draft, card);
                    fc.pre(addResult.success);

                    const afterRemove = simulateRemoveCard(addResult.newManualCards, card.id);
                    expect(afterRemove.size).toBe(originalSize);
                    expect(afterRemove.size).toBe(0);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('addCard → removeCard 应恢复原始 manualCards 状态（非空牌组）', () => {
        fc.assert(
            fc.property(
                arbDraftWithMatchingCard(),
                fc.integer({ min: 1, max: 3 }),
                ({ draft, card }, preExistingCount) => {
                    const preFilledMap = new Map(draft.manualCards);
                    preFilledMap.set(card.id, { card, count: preExistingCount });
                    const preFilledDraft: DeckDraft = { ...draft, manualCards: preFilledMap };

                    const addResult = simulateAddCard(preFilledDraft, card);
                    fc.pre(addResult.success);

                    const afterAddEntry = addResult.newManualCards.get(card.id);
                    expect(afterAddEntry).toBeDefined();
                    expect(afterAddEntry!.count).toBe(preExistingCount + 1);

                    const afterRemove = simulateRemoveCard(addResult.newManualCards, card.id);
                    const afterRemoveEntry = afterRemove.get(card.id);
                    expect(afterRemoveEntry).toBeDefined();
                    expect(afterRemoveEntry!.count).toBe(preExistingCount);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('addCard 后 manualCards 中该卡牌数量应 +1', () => {
        fc.assert(
            fc.property(
                arbDraftWithMatchingCard(),
                ({ draft, card }) => {
                    const originalEntry = draft.manualCards.get(card.id);
                    const originalCount = originalEntry ? originalEntry.count : 0;

                    const addResult = simulateAddCard(draft, card);
                    fc.pre(addResult.success);

                    const newEntry = addResult.newManualCards.get(card.id);
                    expect(newEntry).toBeDefined();
                    expect(newEntry!.count).toBe(originalCount + 1);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('removeCard 后 manualCards 中该卡牌数量应 -1（或移除）', () => {
        fc.assert(
            fc.property(
                arbDraftWithMatchingCard(),
                fc.integer({ min: 1, max: 4 }),
                ({ draft, card }, count) => {
                    const map = new Map(draft.manualCards);
                    map.set(card.id, { card, count });

                    const afterRemove = simulateRemoveCard(map, card.id);

                    if (count > 1) {
                        const entry = afterRemove.get(card.id);
                        expect(entry).toBeDefined();
                        expect(entry!.count).toBe(count - 1);
                    } else {
                        expect(afterRemove.has(card.id)).toBe(false);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('removeCard 对不存在的卡牌应保持 manualCards 不变', () => {
        fc.assert(
            fc.property(
                arbEmptyDeckWithSummoner(),
                (draft) => {
                    const originalSize = draft.manualCards.size;
                    const afterRemove = simulateRemoveCard(draft.manualCards, 'nonexistent-card-id');
                    expect(afterRemove.size).toBe(originalSize);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('多次 addCard 后逐一 removeCard 应恢复原始状态', () => {
        fc.assert(
            fc.property(
                arbDraftWithMatchingCard(),
                fc.integer({ min: 1, max: 3 }),
                ({ draft, card }, addCount) => {
                    let currentMap = new Map(draft.manualCards);
                    const originalSize = currentMap.size;
                    let allAdded = true;

                    for (let i = 0; i < addCount; i++) {
                        const currentDraft: DeckDraft = { ...draft, manualCards: currentMap };
                        const result = simulateAddCard(currentDraft, card);
                        if (!result.success) {
                            allAdded = false;
                            break;
                        }
                        currentMap = result.newManualCards;
                    }

                    fc.pre(allAdded);

                    for (let i = 0; i < addCount; i++) {
                        currentMap = simulateRemoveCard(currentMap, card.id);
                    }

                    expect(currentMap.size).toBe(originalSize);
                    expect(currentMap.has(card.id)).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });
});
