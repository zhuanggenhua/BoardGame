import { describe, expect, it } from 'vitest';
import { OFFICIAL_FANTASY_REALMS_CARDS } from '../data/cards';
import { createRuntimeDeck, getFantasyRealmsCardRuleText } from '../foundation';
import { getFantasyRealmsCardFaceStyle } from '../ui/cardAtlas';

const EXPECTED_SUIT_COUNTS = {
    军队: 5,
    神器: 5,
    巨兽: 5,
    烈焰: 5,
    洪流: 5,
    土地: 5,
    领袖: 5,
    武器: 5,
    天象: 5,
    野牌: 3,
    法师: 5,
} as const;

describe('fantasyrealms official card catalog', () => {
    it('官方基础卡表包含 53 张唯一卡牌，且花色分布符合真相源', () => {
        expect(OFFICIAL_FANTASY_REALMS_CARDS).toHaveLength(53);

        const ids = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => card.id);
        expect(new Set(ids).size).toBe(53);

        const suitCounts = OFFICIAL_FANTASY_REALMS_CARDS.reduce<Record<string, number>>((acc, card) => {
            acc[card.suit] = (acc[card.suit] ?? 0) + 1;
            return acc;
        }, {});

        expect(suitCounts).toEqual(EXPECTED_SUIT_COUNTS);
        expect(OFFICIAL_FANTASY_REALMS_CARDS.every((card) => card.name.trim().length > 0)).toBe(true);
        expect(OFFICIAL_FANTASY_REALMS_CARDS.every((card) => card.displayNameZh.trim().length > 0)).toBe(true);
        expect(OFFICIAL_FANTASY_REALMS_CARDS.every((card) => card.text.trim().length > 0)).toBe(true);
        expect(OFFICIAL_FANTASY_REALMS_CARDS.every((card) => card.textZh.trim().length > 0)).toBe(true);
    });

    it('官方卡表的 id 与花色前缀保持一致', () => {
        const suitPrefixes: Record<string, string> = {
            军队: 'army-',
            神器: 'artifact-',
            巨兽: 'beast-',
            烈焰: 'flame-',
            洪流: 'flood-',
            土地: 'land-',
            领袖: 'leader-',
            武器: 'weapon-',
            天象: 'weather-',
            野牌: 'wild-',
            法师: 'wizard-',
        };

        OFFICIAL_FANTASY_REALMS_CARDS.forEach((card) => {
            expect(card.id.startsWith(suitPrefixes[card.suit])).toBe(true);
        });
    });

    it('createRuntimeDeck 返回克隆数据，不污染静态官方卡表', () => {
        const runtimeDeck = createRuntimeDeck();

        expect(runtimeDeck).toHaveLength(53);
        expect(runtimeDeck).not.toBe(OFFICIAL_FANTASY_REALMS_CARDS);
        expect(runtimeDeck[0]).not.toBe(OFFICIAL_FANTASY_REALMS_CARDS[0]);
        expect(runtimeDeck[0]).toEqual(OFFICIAL_FANTASY_REALMS_CARDS[0]);

        const originalName = OFFICIAL_FANTASY_REALMS_CARDS[0]!.name;
        runtimeDeck[0]!.name = 'Mutated Runtime Card';

        expect(OFFICIAL_FANTASY_REALMS_CARDS[0]!.name).toBe(originalName);
    });

    it('53 张官方基础卡在 zh-CN 下都存在 atlas face 映射，不卡到 fallback 英文卡面', () => {
        OFFICIAL_FANTASY_REALMS_CARDS.forEach((card) => {
            const atlasStyle = getFantasyRealmsCardFaceStyle(card.id, 'zh-CN');
            expect(atlasStyle).not.toBeNull();
            expect(atlasStyle?.backgroundImage).toContain('fantasyrealms-base-cards-atlas');
        });
    });

    it('结构化中文效果文案已接入 cards.ts，并可按 locale 切换运行时文案', () => {
        const candle = OFFICIAL_FANTASY_REALMS_CARDS.find((card) => card.id === 'flame-candle');
        const warship = OFFICIAL_FANTASY_REALMS_CARDS.find((card) => card.id === 'weapon-warship');

        expect(candle).toBeDefined();
        expect(warship).toBeDefined();
        expect(getFantasyRealmsCardRuleText(candle!, 'zh-CN')).toContain('奖励：与变化之书');
        expect(getFantasyRealmsCardRuleText(candle!, 'en')).toContain('Bonus: +100');
        expect(getFantasyRealmsCardRuleText(warship!, 'zh-CN')).toContain('惩罚：若手中没有至少一张洪流牌');
        expect(getFantasyRealmsCardRuleText(warship!, 'en')).toContain('Penalty: Blanked unless with at least one Flood');
    });
});
