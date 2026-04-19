/**
 * buildGameDeckFromCustom 单元测试
 *
 * 验证自定义牌组能正确生成与 createDeckByFactionId 相同结构的牌组对象
 * 使用真实阵营数据（连字符 ID 格式，如 necro-summoner）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { buildGameDeckFromCustom } from '../config/deckBuilder';
import { buildCardRegistry } from '../config/cardRegistry';
import type { CardRegistry } from '../config/cardRegistry';
import type { SerializedCustomDeck } from '../domain/types';

let registry: CardRegistry;

beforeAll(() => {
    registry = buildCardRegistry();
});

describe('buildGameDeckFromCustom', () => {
    // 真实阵营数据中的 ID（连字符格式）
    const SUMMONER_ID = 'necro-summoner';
    const CHAMPION_ID = 'necro-elut-bar';
    const COMMON_ID = 'necro-undead-warrior';

    it('应返回与 createDeckByFactionId 相同结构的对象', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: SUMMONER_ID,
            summonerFaction: 'necromancer',
            cards: [
                { cardId: CHAMPION_ID, faction: 'necromancer', count: 1 },
                { cardId: COMMON_ID, faction: 'necromancer', count: 2 },
            ],
        };

        const result = buildGameDeckFromCustom(customDeck, registry);

        expect(result).toHaveProperty('summoner');
        expect(result).toHaveProperty('summonerPosition');
        expect(result).toHaveProperty('startingUnits');
        expect(result).toHaveProperty('startingGate');
        expect(result).toHaveProperty('startingGatePosition');
        expect(result).toHaveProperty('deck');
    });

    it('应使用召唤师所属阵营的棋盘布局', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: SUMMONER_ID,
            summonerFaction: 'necromancer',
            cards: [],
        };

        const result = buildGameDeckFromCustom(customDeck, registry);

        expect(result.summonerPosition).toEqual({ row: 0, col: 3 });
        expect(result.startingGatePosition).toBeDefined();
        expect(result.startingUnits).toBeDefined();
        expect(Array.isArray(result.startingUnits)).toBe(true);
        expect(result.startingGate).toBeDefined();
        expect(result.startingGate.isGate).toBe(true);
    });

    it('应正确查找召唤师卡牌', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: SUMMONER_ID,
            summonerFaction: 'necromancer',
            cards: [],
        };

        const result = buildGameDeckFromCustom(customDeck, registry);

        expect(result.summoner.id).toBe(SUMMONER_ID);
        expect(result.summoner.cardType).toBe('unit');
        expect(result.summoner.unitClass).toBe('summoner');
    });

    it('应根据手动选择的卡牌构建 deck 数组', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: SUMMONER_ID,
            summonerFaction: 'necromancer',
            cards: [
                { cardId: CHAMPION_ID, faction: 'necromancer', count: 1 },
                { cardId: COMMON_ID, faction: 'necromancer', count: 3 },
            ],
        };

        const result = buildGameDeckFromCustom(customDeck, registry);

        expect(result.deck.length).toBe(4);

        const champions = result.deck.filter(c => c.id.startsWith(CHAMPION_ID));
        expect(champions.length).toBe(1);

        const commons = result.deck.filter(c => c.id.startsWith(COMMON_ID));
        expect(commons.length).toBe(3);
    });

    it('deck 数组中的卡牌 ID 应唯一', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: SUMMONER_ID,
            summonerFaction: 'necromancer',
            cards: [
                { cardId: COMMON_ID, faction: 'necromancer', count: 4 },
            ],
        };

        const result = buildGameDeckFromCustom(customDeck, registry);

        const ids = result.deck.map(c => c.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('空 cards 列表应生成空 deck 数组', () => {
        const customDeck: SerializedCustomDeck = {
            name: '空牌组',
            summonerId: SUMMONER_ID,
            summonerFaction: 'necromancer',
            cards: [],
        };

        const result = buildGameDeckFromCustom(customDeck, registry);

        expect(result.deck).toEqual([]);
    });

    it('注册表中找不到的卡牌应被跳过', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: SUMMONER_ID,
            summonerFaction: 'necromancer',
            cards: [
                { cardId: 'nonexistent-card', faction: 'necromancer', count: 2 },
                { cardId: COMMON_ID, faction: 'necromancer', count: 1 },
            ],
        };

        const result = buildGameDeckFromCustom(customDeck, registry);

        expect(result.deck.length).toBe(1);
    });

    it('无效的召唤师 ID 应抛出错误', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: 'nonexistent-summoner',
            summonerFaction: 'necromancer',
            cards: [],
        };

        expect(() => buildGameDeckFromCustom(customDeck, registry)).toThrow('无效的召唤师 ID');
    });

    it('非召唤师类型的卡牌 ID 作为召唤师应抛出错误', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: CHAMPION_ID,
            summonerFaction: 'necromancer',
            cards: [],
        };

        expect(() => buildGameDeckFromCustom(customDeck, registry)).toThrow('无效的召唤师 ID');
    });

    it('不传 registry 时应自动构建', () => {
        const customDeck: SerializedCustomDeck = {
            name: '测试牌组',
            summonerId: SUMMONER_ID,
            summonerFaction: 'necromancer',
            cards: [],
        };

        const result = buildGameDeckFromCustom(customDeck);

        expect(result.summoner.id).toBe(SUMMONER_ID);
        expect(result.summonerPosition).toBeDefined();
    });
});
