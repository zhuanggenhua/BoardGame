/**
 * 自由组卡模式 - 单元测试
 *
 * 覆盖：
 * - freeMode 下跨阵营混搭卡牌
 * - freeMode 下验证跳过符号匹配
 * - freeMode 下 canAddCard 允许跨阵营卡牌
 * - 非 freeMode 下符号不匹配的卡牌被拒绝
 * - 混搭牌组的序列化/反序列化往返一致性
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    validateDeck,
    canAddCard,
    getSymbolMatch,
    type DeckDraft,
} from '../config/deckValidation';
import {
    buildCardRegistry,
    getCardPoolByFaction,
    groupCardsByType,
    type CardRegistry,
} from '../config/cardRegistry';
import {
    serializeDeck,
    deserializeDeck,
} from '../config/deckSerializer';
import { createDeckByFactionId, resolveFactionId } from '../config/factions';
import type { Card, UnitCard, StructureCard } from '../domain/types';

// ============================================================================
// 测试数据准备
// ============================================================================

let registry: CardRegistry;

/** 堕落王国（necromancer）召唤师 */
let necroSummoner: UnitCard;
/** 欺心巫族（trickster）召唤师 */
let tricksterSummoner: UnitCard;

/** 堕落王国的普通单位 */
let necroCommons: Card[];
/** 欺心巫族的普通单位 */
let tricksterCommons: Card[];
/** 堕落王国的冠军 */
let necroChampions: Card[];
/** 欺心巫族的冠军 */
let tricksterChampions: Card[];
/** 堕落王国的事件 */
let necroEvents: Card[];
/** 欺心巫族的事件 */
let tricksterEvents: Card[];

beforeAll(() => {
    registry = buildCardRegistry();

    // 获取两个阵营的卡牌池
    const necroPool = getCardPoolByFaction('necromancer');
    const tricksterPool = getCardPoolByFaction('trickster');

    const necroGroups = groupCardsByType(necroPool);
    const tricksterGroups = groupCardsByType(tricksterPool);

    necroSummoner = necroGroups.summoners[0];
    tricksterSummoner = tricksterGroups.summoners[0];

    necroCommons = necroGroups.commons;
    tricksterCommons = tricksterGroups.commons;
    necroChampions = necroGroups.champions;
    tricksterChampions = tricksterGroups.champions;
    necroEvents = necroGroups.events;
    tricksterEvents = tricksterGroups.events;
});

// ============================================================================
// 辅助函数
// ============================================================================

/** 构建 autoCards（复现 useDeckBuilder 逻辑） */
function buildAutoCards(summoner: UnitCard): Card[] {
    const factionId = resolveFactionId(summoner.faction);
    const autoCards: Card[] = [];
    try {
        const factionDeck = createDeckByFactionId(factionId);
        for (const { unit } of factionDeck.startingUnits) autoCards.push(unit);
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
        autoCards.push(factionDeck.startingGate);
        const portals = factionDeck.deck.filter(
            c => c.cardType === 'structure' && (c as StructureCard).isGate && !(c as StructureCard).isStartingGate,
        );
        autoCards.push(...portals);
    } catch { /* ignore */ }
    return autoCards;
}

/** 创建一个带召唤师的空牌组 */
function createDraft(summoner: UnitCard, freeMode: boolean): DeckDraft {
    return {
        name: '测试混搭牌组',
        summoner,
        autoCards: buildAutoCards(summoner),
        manualCards: new Map(),
        freeMode,
    };
}

/** 向牌组中添加卡牌（模拟 useDeckBuilder.addCard） */
function addCardToDraft(draft: DeckDraft, card: Card, count = 1): DeckDraft {
    const newMap = new Map(draft.manualCards);
    const existing = newMap.get(card.id);
    newMap.set(card.id, { card, count: (existing?.count ?? 0) + count });
    return { ...draft, manualCards: newMap };
}

// ============================================================================
// 自由组卡模式：跨阵营混搭
// ============================================================================

describe('自由组卡模式（freeMode）', () => {
    it('freeMode 下 canAddCard 应允许跨阵营卡牌', () => {
        const draft = createDraft(necroSummoner, true);

        // 欺心巫族的普通单位应该能添加到堕落王国召唤师的牌组
        for (const card of tricksterCommons) {
            const result = canAddCard(draft, card);
            expect(result.allowed).toBe(true);
        }
    });

    it('freeMode 下 canAddCard 应允许跨阵营冠军', () => {
        const draft = createDraft(necroSummoner, true);

        for (const card of tricksterChampions) {
            const result = canAddCard(draft, card);
            expect(result.allowed).toBe(true);
        }
    });

    it('freeMode 下 canAddCard 应允许跨阵营事件', () => {
        const draft = createDraft(necroSummoner, true);

        for (const card of tricksterEvents) {
            const result = canAddCard(draft, card);
            expect(result.allowed).toBe(true);
        }
    });

    it('freeMode 下 validateDeck 应跳过符号匹配检查', () => {
        let draft = createDraft(necroSummoner, true);

        // 混搭：堕落王国召唤师 + 欺心巫族的普通单位和冠军
        for (const card of tricksterCommons) {
            draft = addCardToDraft(draft, card, 4);
        }
        for (const card of tricksterChampions) {
            draft = addCardToDraft(draft, card, 1);
        }
        // 补充事件
        for (const card of tricksterEvents) {
            draft = addCardToDraft(draft, card, 2);
        }

        const result = validateDeck(draft);
        // 不应有 symbol_mismatch 错误
        const symbolErrors = result.errors.filter(e => e.rule === 'symbol_mismatch');
        expect(symbolErrors.length).toBe(0);
    });

    it('freeMode 下混搭两个阵营的卡牌构建合法牌组', () => {
        let draft = createDraft(necroSummoner, true);

        // 从堕落王国取部分普通单位
        let commonCount = 0;
        for (const card of necroCommons) {
            if (commonCount >= 8) break;
            const toAdd = Math.min(4, 8 - commonCount);
            draft = addCardToDraft(draft, card, toAdd);
            commonCount += toAdd;
        }
        // 从欺心巫族取剩余普通单位
        for (const card of tricksterCommons) {
            if (commonCount >= 16) break;
            const toAdd = Math.min(4, 16 - commonCount);
            draft = addCardToDraft(draft, card, toAdd);
            commonCount += toAdd;
        }

        // 冠军：堕落王国 2 + 欺心巫族 1
        let champCount = 0;
        for (const card of necroChampions) {
            if (champCount >= 2) break;
            draft = addCardToDraft(draft, card, 1);
            champCount++;
        }
        for (const card of tricksterChampions) {
            if (champCount >= 3) break;
            draft = addCardToDraft(draft, card, 1);
            champCount++;
        }

        // 事件：混搭
        let eventCount = 0;
        const allEvents = [...necroEvents, ...tricksterEvents];
        for (const card of allEvents) {
            if (eventCount >= 6) break;
            // 跳过传奇事件（已在 autoCards 中）
            if (card.cardType === 'event' && card.eventType === 'legendary') continue;
            const toAdd = Math.min(2, 6 - eventCount);
            draft = addCardToDraft(draft, card, toAdd);
            eventCount += toAdd;
        }

        const result = validateDeck(draft);
        expect(result.errors.filter(e => e.rule === 'symbol_mismatch').length).toBe(0);

        // 如果数量足够，牌组应合法
        if (commonCount >= 16 && champCount >= 3 && eventCount >= 6) {
            expect(result.valid).toBe(true);
        }
    });
});

// ============================================================================
// 非自由模式：符号匹配限制
// ============================================================================

describe('非自由模式（符号匹配限制）', () => {
    it('非 freeMode 下跨阵营卡牌应被 canAddCard 拒绝（如果符号不匹配）', () => {
        const draft = createDraft(necroSummoner, false);

        // 找一张欺心巫族的卡牌，其符号与堕落王国召唤师不匹配
        const mismatchCard = tricksterCommons.find(
            c => !getSymbolMatch(c, necroSummoner.deckSymbols),
        );

        if (mismatchCard) {
            const result = canAddCard(draft, mismatchCard);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('符号');
        }
    });

    it('非 freeMode 下 validateDeck 应报告符号不匹配错误', () => {
        let draft = createDraft(necroSummoner, false);

        // 强制添加一张不匹配的卡牌
        const mismatchCard = tricksterCommons.find(
            c => !getSymbolMatch(c, necroSummoner.deckSymbols),
        );

        if (mismatchCard) {
            draft = addCardToDraft(draft, mismatchCard, 1);
            const result = validateDeck(draft);
            const symbolErrors = result.errors.filter(e => e.rule === 'symbol_mismatch');
            expect(symbolErrors.length).toBe(1);
            expect(symbolErrors[0].current).toBeGreaterThan(0);
        }
    });
});

// ============================================================================
// 混搭牌组序列化/反序列化
// ============================================================================

describe('混搭牌组序列化/反序列化', () => {
    it('freeMode 混搭牌组应能正确序列化和反序列化', () => {
        let draft = createDraft(necroSummoner, true);

        // 添加跨阵营卡牌
        if (tricksterCommons.length > 0) {
            draft = addCardToDraft(draft, tricksterCommons[0], 2);
        }
        if (tricksterChampions.length > 0) {
            draft = addCardToDraft(draft, tricksterChampions[0], 1);
        }

        const serialized = serializeDeck(draft);
        expect(serialized.freeMode).toBe(true);
        expect(serialized.summonerFaction).toBe('necromancer');

        // 反序列化
        const { deck: deserialized, warnings } = deserializeDeck(serialized, registry);
        expect(warnings.length).toBe(0);
        expect(deserialized.summoner?.id).toBe(necroSummoner.id);
        expect(deserialized.freeMode).toBe(true);

        // 手动卡牌数量应一致
        expect(deserialized.manualCards.size).toBe(draft.manualCards.size);
        for (const [cardId, { count }] of draft.manualCards) {
            const entry = deserialized.manualCards.get(cardId);
            expect(entry).toBeDefined();
            expect(entry!.count).toBe(count);
        }
    });

    it('非 freeMode 牌组序列化不应包含 freeMode 字段', () => {
        const draft = createDraft(necroSummoner, false);
        const serialized = serializeDeck(draft);
        expect(serialized.freeMode).toBeUndefined();
    });
});
