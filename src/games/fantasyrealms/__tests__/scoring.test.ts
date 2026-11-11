import { describe, expect, it } from 'vitest';
import { ALL_FANTASY_REALMS_CARDS } from '../data/cards';
import { evaluateFantasyRealmsScore, resolveFantasyRealmsWinner } from '../domain';
import { evaluateFantasyRealmsResolvedScore, type FantasyRealmsScoreSelections } from '../domain/scoring';

function byId(cardId: string) {
    const card = ALL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`Unknown card: ${cardId}`);
    }
    return { ...card };
}

describe('fantasyrealms official scoring', () => {
    it('终局确定计分严格使用玩家指定目标，不能自行改成最高分', () => {
        const choices: FantasyRealmsScoreSelections = {
            shapeshifterTargetId: null, mirageTargetId: null, doppelgangerTargetId: null,
            bookTargetId: null, bookSuit: null, islandTargetId: null, angelTargetId: null, fountainTargetId: null,
        };
        const hand = [byId('flame-wildfire'), byId('flood-island'), byId('leader-princess')];
        const skipped = evaluateFantasyRealmsResolvedScore(hand, [], choices);
        const cleared = evaluateFantasyRealmsResolvedScore(hand, [], { ...choices, islandTargetId: 'flame-wildfire' });
        expect(skipped.cardDeltas.find((card) => card.cardId === 'leader-princess')?.totalDelta).toBe(0);
        expect(cleared.cardDeltas.find((card) => card.cardId === 'leader-princess')?.totalDelta).toBe(2);
    });

    it('巫妖牌面按每张亡灵加分，包含巫妖自身', () => {
        const result = evaluateFantasyRealmsScore([byId('undead-lich')], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'undead-lich')?.totalDelta).toBe(23);
    });

    it('基础牌组共用扩展牌面：钟塔为建筑且护林人计入建筑', () => {
        const result = evaluateFantasyRealmsScore([byId('army-rangers'), byId('land-bell-tower')], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'army-rangers')?.bonus).toBe(10);
        expect(result.cardDeltas.find((card) => card.cardId === 'land-bell-tower')?.baseScore).toBe(8);
    });
    it('共用牌面的大洪水也无效建筑牌', () => {
        const result = evaluateFantasyRealmsScore([byId('flood-great-flood'), byId('land-bell-tower')], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'land-bell-tower')?.isBlanked).toBe(true);
    });

    it('中文牌面：女皇基础分为15分', () => {
        const result = evaluateFantasyRealmsScore([byId('leader-empress')], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'leader-empress')?.baseScore).toBe(15);
    });
    it('中文牌面：战马对每张生效的领袖和巫师分别加14分', () => {
        const result = evaluateFantasyRealmsScore([
            byId('beast-warhorse'), byId('leader-king'), byId('leader-queen'), byId('wizard-collector'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'beast-warhorse')?.totalDelta).toBe(48);
    });

    it('中文牌面：世界树满足不同花色时奖励70分', () => {
        const result = evaluateFantasyRealmsScore([byId('artifact-world-tree')], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'artifact-world-tree')?.totalDelta).toBe(72);
    });

    it('世界树遇到同花色生效牌时没有奖励', () => {
        const result = evaluateFantasyRealmsScore([
            byId('artifact-world-tree'), byId('artifact-gem-of-order'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'artifact-world-tree')?.bonus).toBe(0);
    });

    it('野火同时无效化战马和领袖时二者都不计分', () => {
        const result = evaluateFantasyRealmsScore([
            byId('beast-warhorse'), byId('leader-king'), byId('flame-wildfire'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'beast-warhorse')?.totalDelta).toBe(0);
        expect(result.cardDeltas.find((card) => card.cardId === 'leader-king')?.totalDelta).toBe(0);
    });

    it('野火生效时同时无效化军队和领袖', () => {
        const result = evaluateFantasyRealmsScore([
            byId('flame-wildfire'), byId('army-dwarvish-infantry'), byId('leader-queen'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'army-dwarvish-infantry')?.totalDelta).toBe(0);
        expect(result.cardDeltas.find((card) => card.cardId === 'leader-queen')?.totalDelta).toBe(0);
        expect(result.cardDeltas.find((card) => card.cardId === 'flame-wildfire')?.totalDelta).toBe(40);
    });

    it('守护符文清除惩罚后，野火不再无效化军队和领袖', () => {
        const result = evaluateFantasyRealmsScore([
            byId('artifact-protection-rune'), byId('flame-wildfire'),
            byId('army-dwarvish-infantry'), byId('leader-queen'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'army-dwarvish-infantry')?.baseScore).toBe(15);
        expect(result.cardDeltas.find((card) => card.cardId === 'leader-queen')?.baseScore).toBe(6);
    });
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

    it('岛屿可清除野火的惩罚，使截图中的军队和领袖不被野火无效化', () => {
        const hand = [
            byId('flood-island'), byId('army-celestial-knights'), byId('flame-wildfire'),
            byId('leader-warlord'), byId('wizard-necromancer'),
            byId('artifact-gem-of-order'), byId('leader-princess'),
        ];
        const withIsland = evaluateFantasyRealmsScore(hand, []);
        const withoutIsland = evaluateFantasyRealmsScore(hand.filter((card) => card.id !== 'flood-island'), []);
        for (const id of ['army-celestial-knights', 'leader-warlord', 'leader-princess']) {
            expect(withIsland.cardDeltas.find((card) => card.cardId === id)?.baseScore).toBeGreaterThan(0);
            expect(withoutIsland.cardDeltas.find((card) => card.cardId === id)?.totalDelta).toBe(0);
        }
    });

    it('恶魔无效驭兽师后，不撤销此前清除的巨兽惩罚', () => {
        const result = evaluateFantasyRealmsScore([
            byId('outsider-demon'), byId('wizard-beastmaster'), byId('beast-basilisk'), byId('beast-dragon'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'wizard-beastmaster')?.totalDelta).toBe(0);
        expect(result.cardDeltas.find((card) => card.cardId === 'beast-dragon')?.totalDelta).toBe(30);
    });

    it('恶魔无效洞穴后，不撤销此前清除的天象惩罚', () => {
        const result = evaluateFantasyRealmsScore([
            byId('outsider-demon'), byId('land-underground-caverns'), byId('weather-smoke'), byId('weather-whirlwind'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'land-underground-caverns')?.totalDelta).toBe(0);
        expect(result.cardDeltas.find((card) => card.cardId === 'weather-smoke')?.totalDelta).toBe(27);
    });

    it('护林人先清除飞艇的军队条件，随后被野火无效也不恢复该条件', () => {
        const result = evaluateFantasyRealmsScore([
            byId('army-rangers'), byId('flame-wildfire'), byId('weapon-war-dirigible'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'army-rangers')?.totalDelta).toBe(0);
        expect(result.cardDeltas.find((card) => card.cardId === 'weapon-war-dirigible')?.totalDelta).toBe(35);
    });

    it('没有烈焰时烟雾先无效，不能再使有军队的飞艇无效', () => {
        const result = evaluateFantasyRealmsScore([
            byId('weather-smoke'), byId('weapon-war-dirigible'), byId('army-light-cavalry'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'weather-smoke')?.totalDelta).toBe(0);
        expect(result.cardDeltas.find((card) => card.cardId === 'weapon-war-dirigible')?.totalDelta).toBe(35);
    });

    it('巨龙没有巫师时扣 40 分但仍是生效巨兽', () => {
        const result = evaluateFantasyRealmsScore([byId('beast-dragon'), byId('land-forest')], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'beast-dragon')?.totalDelta).toBe(-10);
        expect(result.cardDeltas.find((card) => card.cardId === 'land-forest')?.totalDelta).toBe(19);
        expect(result.totalScore).toBe(9);
    });

    it('护林人清除蛇怪惩罚中的军队字样，但不保护领袖', () => {
        const result = evaluateFantasyRealmsScore([
            byId('army-rangers'), byId('army-dwarvish-infantry'),
            byId('beast-basilisk'), byId('leader-queen'),
        ], []);
        expect(result.cardDeltas.find((card) => card.cardId === 'army-rangers')?.baseScore).toBe(5);
        expect(result.cardDeltas.find((card) => card.cardId === 'army-dwarvish-infantry')?.baseScore).toBe(15);
        expect(result.cardDeltas.find((card) => card.cardId === 'leader-queen')?.totalDelta).toBe(0);
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
