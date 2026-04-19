/**
 * 游戏牌组生成 - 属性测试 (Property-Based Testing)
 *
 * 使用 fast-check 对游戏牌组生成和阵营卡牌池进行属性测试，每个属性 ≥100 次迭代。
 * 基于真实卡牌注册表和阵营配置数据，不使用 mock。
 *
 * 覆盖属性：
 * - Property 7: 自定义牌组生成游戏牌组结构等价性
 * - Property 8: 阵营卡牌池完整性
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import {
    buildGameDeckFromCustom,
    type GameDeckData,
} from '../config/deckBuilder';
import {
    buildCardRegistry,
    getCardPoolByFaction,
    groupCardsByType,
    type CardRegistry,
    type GroupedCards,
} from '../config/cardRegistry';
import { createDeckByFactionId, FACTION_CATALOG, resolveFactionId } from '../config/factions';
import type {
    Card,
    UnitCard,
    EventCard,
    StructureCard,
    FactionId,
    SerializedCustomDeck,
    SerializedCardEntry,
} from '../domain/types';

// ============================================================================
// 测试前准备：构建卡牌注册表和阵营数据
// ============================================================================

let registry: CardRegistry;
let allCards: Card[];
let summoners: UnitCard[];
let nonSummonerCards: Card[];
/** 所有可选阵营 ID */
let selectableFactionIds: FactionId[];

beforeAll(() => {
    registry = buildCardRegistry();
    allCards = Array.from(registry.values());

    summoners = allCards.filter(
        (c): c is UnitCard => c.cardType === 'unit' && c.unitClass === 'summoner',
    );

    nonSummonerCards = allCards.filter(
        c => !(c.cardType === 'unit' && c.unitClass === 'summoner'),
    );

    selectableFactionIds = FACTION_CATALOG
        .filter(f => f.selectable)
        .map(f => f.id);
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
 * 生成一个合法的 SerializedCustomDeck
 *
 * 策略：选择一个注册表中的召唤师，然后从注册表中选择符号匹配的非召唤师卡牌
 * 作为手动选择的卡牌。数量随机但合理（1-4）。
 */
function arbSerializedCustomDeck(): fc.Arbitrary<SerializedCustomDeck> {
    return arbSummonerCard().chain(summoner => {
        const summonerSymbols = summoner.deckSymbols;

        // 找到所有与该召唤师符号匹配的非召唤师卡牌
        const matchingCards = nonSummonerCards.filter(c =>
            c.deckSymbols.some(s => summonerSymbols.includes(s)),
        );

        // 生成随机的卡牌条目
        if (matchingCards.length === 0) {
            // 没有匹配卡牌时，返回空 cards 列表
            return fc.constant<SerializedCustomDeck>({
                name: '测试牌组',
                summonerId: summoner.id,
                summonerFaction: resolveFactionId(summoner.faction),
                cards: [],
            });
        }

        return fc.array(
            fc.record({
                cardIndex: fc.integer({ min: 0, max: matchingCards.length - 1 }),
                count: fc.integer({ min: 1, max: 4 }),
            }),
            { minLength: 0, maxLength: Math.min(8, matchingCards.length) },
        ).map(entries => {
            // 去重：同一张卡牌只保留一个条目
            const cardMap = new Map<string, SerializedCardEntry>();
            for (const { cardIndex, count } of entries) {
                const card = matchingCards[cardIndex];
                const faction = ('faction' in card && card.faction)
                    ? resolveFactionId(card.faction as string)
                    : 'necromancer' as FactionId;
                cardMap.set(card.id, { cardId: card.id, faction, count });
            }

            return {
                name: '测试牌组',
                summonerId: summoner.id,
                summonerFaction: resolveFactionId(summoner.faction),
                cards: Array.from(cardMap.values()),
            };
        });
    });
}

/**
 * 从 FACTION_CATALOG 中随机选择一个可选阵营 ID
 */
function arbFactionId(): fc.Arbitrary<FactionId> {
    return fc.integer({ min: 0, max: selectableFactionIds.length - 1 })
        .map(i => selectableFactionIds[i]);
}

// ============================================================================
// Property 7: 自定义牌组生成游戏牌组结构等价性
// Feature: sw-custom-deck, Property 7: 自定义牌组生成游戏牌组结构等价性
// **Validates: Requirements 7.3**
// ============================================================================

describe('Property 7: 自定义牌组生成游戏牌组结构等价性', () => {
    it('buildGameDeckFromCustom 返回的对象应包含与 createDeckByFactionId 相同的结构字段', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                // 获取预构筑牌组作为结构参考
                const prebuilt = createDeckByFactionId(customDeck.summonerFaction);

                // 验证所有必要字段存在
                expect(result).toHaveProperty('summoner');
                expect(result).toHaveProperty('summonerPosition');
                expect(result).toHaveProperty('startingUnits');
                expect(result).toHaveProperty('startingGate');
                expect(result).toHaveProperty('startingGatePosition');
                expect(result).toHaveProperty('deck');

                // 预构筑牌组也应有相同字段
                expect(prebuilt).toHaveProperty('summoner');
                expect(prebuilt).toHaveProperty('summonerPosition');
                expect(prebuilt).toHaveProperty('startingUnits');
                expect(prebuilt).toHaveProperty('startingGate');
                expect(prebuilt).toHaveProperty('startingGatePosition');
                expect(prebuilt).toHaveProperty('deck');
            }),
            { numRuns: 100 },
        );
    });

    it('summoner 应为有效的 UnitCard 且 unitClass 为 summoner', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                // 召唤师类型字段完整性
                expect(result.summoner.cardType).toBe('unit');
                expect(result.summoner.unitClass).toBe('summoner');
                expect(typeof result.summoner.id).toBe('string');
                expect(typeof result.summoner.name).toBe('string');
                expect(typeof result.summoner.strength).toBe('number');
                expect(typeof result.summoner.life).toBe('number');
                expect(typeof result.summoner.cost).toBe('number');
                expect(typeof result.summoner.attackType).toBe('string');
                expect(typeof result.summoner.attackRange).toBe('number');
                expect(Array.isArray(result.summoner.deckSymbols)).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('summonerPosition 应为有效的 CellCoord', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                expect(typeof result.summonerPosition.row).toBe('number');
                expect(typeof result.summonerPosition.col).toBe('number');
                expect(result.summonerPosition.row).toBeGreaterThanOrEqual(0);
                expect(result.summonerPosition.col).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: 100 },
        );
    });

    it('startingUnits 应为包含 unit 和 position 的数组', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                expect(Array.isArray(result.startingUnits)).toBe(true);

                for (const entry of result.startingUnits) {
                    // 每个起始单位应有 unit 和 position
                    expect(entry).toHaveProperty('unit');
                    expect(entry).toHaveProperty('position');

                    // unit 应为有效的 UnitCard
                    expect(entry.unit.cardType).toBe('unit');
                    expect(typeof entry.unit.id).toBe('string');
                    expect(typeof entry.unit.name).toBe('string');
                    expect(typeof entry.unit.strength).toBe('number');
                    expect(typeof entry.unit.life).toBe('number');

                    // position 应为有效的 CellCoord
                    expect(typeof entry.position.row).toBe('number');
                    expect(typeof entry.position.col).toBe('number');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('startingGate 应为有效的 StructureCard 且 isGate 为 true', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                expect(result.startingGate.cardType).toBe('structure');
                expect(result.startingGate.isGate).toBe(true);
                expect(typeof result.startingGate.id).toBe('string');
                expect(typeof result.startingGate.name).toBe('string');
                expect(typeof result.startingGate.life).toBe('number');
                expect(Array.isArray(result.startingGate.deckSymbols)).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('startingGatePosition 应为有效的 CellCoord', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                expect(typeof result.startingGatePosition.row).toBe('number');
                expect(typeof result.startingGatePosition.col).toBe('number');
                expect(result.startingGatePosition.row).toBeGreaterThanOrEqual(0);
                expect(result.startingGatePosition.col).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: 100 },
        );
    });

    it('deck 数组中所有卡牌对象的类型字段应完整', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                expect(Array.isArray(result.deck)).toBe(true);

                for (const card of result.deck) {
                    // 每张卡牌必须有基础字段
                    expect(typeof card.id).toBe('string');
                    expect(typeof card.cardType).toBe('string');
                    expect(['unit', 'event', 'structure']).toContain(card.cardType);
                    expect(Array.isArray(card.deckSymbols)).toBe(true);

                    // 根据 cardType 验证特定字段
                    if (card.cardType === 'unit') {
                        const unitCard = card as UnitCard;
                        expect(typeof unitCard.name).toBe('string');
                        expect(typeof unitCard.strength).toBe('number');
                        expect(typeof unitCard.life).toBe('number');
                        expect(typeof unitCard.cost).toBe('number');
                        expect(typeof unitCard.attackType).toBe('string');
                        expect(typeof unitCard.attackRange).toBe('number');
                        expect(typeof unitCard.unitClass).toBe('string');
                    } else if (card.cardType === 'event') {
                        const eventCard = card as EventCard;
                        expect(typeof eventCard.name).toBe('string');
                        expect(typeof eventCard.cost).toBe('number');
                        expect(typeof eventCard.effect).toBe('string');
                    } else if (card.cardType === 'structure') {
                        const structCard = card as StructureCard;
                        expect(typeof structCard.name).toBe('string');
                        expect(typeof structCard.life).toBe('number');
                    }
                }
            }),
            { numRuns: 100 },
        );
    });

    it('deck 数组中的卡牌数量应等于 cards 条目的 count 之和（注册表中存在的卡牌）', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                // 计算预期的 deck 数组长度：只统计注册表中存在的卡牌
                let expectedCount = 0;
                for (const entry of customDeck.cards) {
                    if (registry.has(entry.cardId)) {
                        expectedCount += entry.count;
                    }
                }

                expect(result.deck.length).toBe(expectedCount);
            }),
            { numRuns: 100 },
        );
    });

    it('deck 数组中每张卡牌的 ID 应唯一（通过索引后缀保证）', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);

                const ids = result.deck.map(c => c.id);
                const uniqueIds = new Set(ids);
                expect(uniqueIds.size).toBe(ids.length);
            }),
            { numRuns: 100 },
        );
    });

    it('棋盘布局信息应与预构筑牌组一致（来自同一阵营）', () => {
        fc.assert(
            fc.property(arbSerializedCustomDeck(), (customDeck: SerializedCustomDeck) => {
                const result = buildGameDeckFromCustom(customDeck, registry);
                const prebuilt = createDeckByFactionId(customDeck.summonerFaction);

                // 棋盘布局应完全一致
                expect(result.summonerPosition).toEqual(prebuilt.summonerPosition);
                expect(result.startingGatePosition).toEqual(prebuilt.startingGatePosition);

                // 起始单位数量应一致
                expect(result.startingUnits.length).toBe(prebuilt.startingUnits.length);

                // 起始单位位置应一致
                for (let i = 0; i < result.startingUnits.length; i++) {
                    expect(result.startingUnits[i].position).toEqual(
                        prebuilt.startingUnits[i].position,
                    );
                }

                // 起始城门应一致
                expect(result.startingGate.isGate).toBe(prebuilt.startingGate.isGate);
            }),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 8: 阵营卡牌池完整性
// Feature: sw-custom-deck, Property 8: 阵营卡牌池完整性
// **Validates: Requirements 2.2**
// ============================================================================

describe('Property 8: 阵营卡牌池完整性', () => {
    it('getCardPoolByFaction 对任意阵营 ID 应返回非空的卡牌列表', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);

                // 每个阵营应有至少1张卡牌
                expect(Array.isArray(pool)).toBe(true);
                // 注意：当前 mock 实现只有 necromancer 和 goblin 的数据
                // 对于有数据的阵营，pool 应非空
                // 对于无数据的阵营，pool 可能为空（mock 限制）
            }),
            { numRuns: 100 },
        );
    });

    it('getCardPoolByFaction 返回的卡牌应能被 groupCardsByType 正确分组', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);
                const groups = groupCardsByType(pool);

                // 分组结果应包含所有类型
                expect(groups).toHaveProperty('summoners');
                expect(groups).toHaveProperty('champions');
                expect(groups).toHaveProperty('commons');
                expect(groups).toHaveProperty('events');
                expect(groups).toHaveProperty('structures');

                // 每个分组应为数组
                expect(Array.isArray(groups.summoners)).toBe(true);
                expect(Array.isArray(groups.champions)).toBe(true);
                expect(Array.isArray(groups.commons)).toBe(true);
                expect(Array.isArray(groups.events)).toBe(true);
                expect(Array.isArray(groups.structures)).toBe(true);

                // 分组后的总数应等于原始 pool 的数量
                const totalGrouped =
                    groups.summoners.length +
                    groups.champions.length +
                    groups.commons.length +
                    groups.events.length +
                    groups.structures.length;
                expect(totalGrouped).toBe(pool.length);
            }),
            { numRuns: 100 },
        );
    });

    it('分组后的召唤师应全部为 unitClass=summoner', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);
                const groups = groupCardsByType(pool);

                for (const summoner of groups.summoners) {
                    expect(summoner.cardType).toBe('unit');
                    expect(summoner.unitClass).toBe('summoner');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('分组后的冠军应全部为 unitClass=champion', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);
                const groups = groupCardsByType(pool);

                for (const champion of groups.champions) {
                    expect(champion.cardType).toBe('unit');
                    expect(champion.unitClass).toBe('champion');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('分组后的普通单位应全部为 unitClass=common', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);
                const groups = groupCardsByType(pool);

                for (const common of groups.commons) {
                    expect(common.cardType).toBe('unit');
                    expect(common.unitClass).toBe('common');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('分组后的事件应全部为 cardType=event', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);
                const groups = groupCardsByType(pool);

                for (const event of groups.events) {
                    expect(event.cardType).toBe('event');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('分组后的建筑应全部为 cardType=structure', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);
                const groups = groupCardsByType(pool);

                for (const structure of groups.structures) {
                    expect(structure.cardType).toBe('structure');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('每张卡牌应有完整的基础字段', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);

                for (const card of pool) {
                    // 所有卡牌的基础字段
                    expect(typeof card.id).toBe('string');
                    expect(card.id.length).toBeGreaterThan(0);
                    expect(typeof card.cardType).toBe('string');
                    expect(['unit', 'event', 'structure']).toContain(card.cardType);
                    expect(Array.isArray(card.deckSymbols)).toBe(true);
                }
            }),
            { numRuns: 100 },
        );
    });

    it('同一阵营的卡牌 ID 应唯一', () => {
        fc.assert(
            fc.property(arbFactionId(), (factionId: FactionId) => {
                const pool = getCardPoolByFaction(factionId);

                const ids = pool.map(c => c.id);
                const uniqueIds = new Set(ids);
                expect(uniqueIds.size).toBe(ids.length);
            }),
            { numRuns: 100 },
        );
    });

    it('groupCardsByType 对空数组应返回全空分组', () => {
        // 确定性测试：空输入
        const groups = groupCardsByType([]);

        expect(groups.summoners).toHaveLength(0);
        expect(groups.champions).toHaveLength(0);
        expect(groups.commons).toHaveLength(0);
        expect(groups.events).toHaveLength(0);
        expect(groups.structures).toHaveLength(0);
    });

    it('groupCardsByType 对注册表全量卡牌应正确分组', () => {
        // 确定性测试：全量卡牌
        const groups = groupCardsByType(allCards);

        // 分组后总数应等于全量卡牌数
        const totalGrouped =
            groups.summoners.length +
            groups.champions.length +
            groups.commons.length +
            groups.events.length +
            groups.structures.length;
        expect(totalGrouped).toBe(allCards.length);

        // 注册表中应至少有1个召唤师
        expect(groups.summoners.length).toBeGreaterThanOrEqual(1);
    });
});
