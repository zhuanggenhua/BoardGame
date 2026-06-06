import { describe, expect, it } from 'vitest';
import { OFFICIAL_FANTASY_REALMS_CARDS } from '../data/cards';
import { evaluateFantasyRealmsScore, resolveFantasyRealmsWinner } from '../domain';

function byId(cardId: string) {
    const card = OFFICIAL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`Unknown card: ${cardId}`);
    }
    return { ...card };
}

describe('fantasyrealms official scoring', () => {
    it('FAQ 链式封印：没有洞穴时，Blizzard 会压掉 Great Flood，让 Wildfire 保持有效', () => {
        const result = evaluateFantasyRealmsScore([
            byId('weather-blizzard'),
            byId('flood-great-flood'),
            byId('flame-wildfire'),
        ], []);

        expect(result.totalScore).toBe(65);
        expect(result.activeBaseScore).toBe(70);
        expect(result.totalPenalty).toBe(5);
    });

    it('FAQ 链式封印：有 Underground Caverns 时，Blizzard 解罚后不再封印 Great Flood', () => {
        const result = evaluateFantasyRealmsScore([
            byId('weather-blizzard'),
            byId('flood-great-flood'),
            byId('flame-wildfire'),
            byId('land-underground-caverns'),
        ], []);

        expect(result.totalScore).toBe(62);
        expect(result.activeBaseScore).toBe(62);
        expect(result.totalPenalty).toBe(0);
    });

    it('Rangers 不能阻止 Wildfire 封印军队', () => {
        const result = evaluateFantasyRealmsScore([
            byId('army-rangers'),
            byId('army-dwarvish-infantry'),
            byId('flame-wildfire'),
        ], []);

        expect(result.totalScore).toBe(40);
        expect(result.activeBaseScore).toBe(40);
    });

    it('Book of Changes 会为 Candle 找到最优改花色，补出 Wizard 组合', () => {
        const result = evaluateFantasyRealmsScore([
            byId('flame-candle'),
            byId('artifact-book-of-changes'),
            byId('land-bell-tower'),
            byId('artifact-protection-rune'),
        ], []);

        expect(result.totalScore).toBe(129);
        expect(result.activeBaseScore).toBe(14);
        expect(result.totalBonus).toBe(115);
    });

    it('Necromancer 会从弃牌堆拿最优第 8 张牌一起结算', () => {
        const result = evaluateFantasyRealmsScore(
            [
                byId('wizard-necromancer'),
                byId('beast-dragon'),
            ],
            [
                byId('wizard-beastmaster'),
                byId('army-rangers'),
            ],
        );

        expect(result.totalScore).toBe(51);
        expect(result.tiebreakBaseScore).toBe(42);
        expect(result.extraCardId).toBe('wizard-beastmaster');
    });

    it('双人结束态会用正式计分与基础分平分规则裁胜者', () => {
        const result = resolveFantasyRealmsWinner(
            ['0', '1'],
            {
                '0': [
                    byId('flame-candle'),
                    byId('artifact-book-of-changes'),
                    byId('land-bell-tower'),
                    byId('artifact-protection-rune'),
                ],
                '1': [
                    byId('weather-blizzard'),
                    byId('flood-great-flood'),
                    byId('flame-wildfire'),
                ],
            },
            [],
        );

        expect(result.winner).toBe('0');
        expect(result.scores).toEqual({
            '0': 129,
            '1': 65,
        });
    });
});
