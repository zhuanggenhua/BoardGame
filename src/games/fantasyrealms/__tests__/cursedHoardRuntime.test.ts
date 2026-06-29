import { describe, expect, it } from 'vitest';
import {
    createRuntimeDeck,
    getFantasyRealmsDiscardEndThreshold,
    type TableCard,
} from '../foundation';
import { evaluateFantasyRealmsScore, FantasyRealmsDomain } from '../domain';
import { ALL_FANTASY_REALMS_CARDS } from '../data/cards';

const random = {
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
};

function byId(cardId: string): TableCard {
    const card = ALL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`Unknown card: ${cardId}`);
    }
    return { ...card };
}

describe('fantasyrealms cursed hoard runtime', () => {
    it('新花色 runtime deck 会移除被替换的基础牌，并加入 68 张扩展牌组', () => {
        const runtimeDeck = createRuntimeDeck({
            cursedHoardSuitsEnabled: true,
        });

        expect(runtimeDeck).toHaveLength(68);
        expect(runtimeDeck.some((card) => card.id === 'land-bell-tower')).toBe(false);
        expect(runtimeDeck.some((card) => card.id === 'wizard-necromancer')).toBe(false);
        expect(runtimeDeck.some((card) => card.id === 'building-bell-tower-ch')).toBe(true);
        expect(runtimeDeck.some((card) => card.id === 'building-dungeon')).toBe(true);
    });

    it('扩展双人变体会使用 14 张弃牌结束阈值，并保留 0 手牌开局', () => {
        const core = FantasyRealmsDomain.setup(['0', '1'], random, {
            variant: 'duel',
            expansion: 'cursed-hoard-suits',
            setupSelections: {
                variant: 'duel',
                expansion: 'cursed-hoard-suits',
            },
        });

        expect(core.players['0']?.hand).toHaveLength(0);
        expect(core.players['1']?.hand).toHaveLength(0);
        expect(core.drawPile).toHaveLength(68);
        expect(getFantasyRealmsDiscardEndThreshold(2, core.setupConfig)).toBe(14);
    });

    it('Angel 会保护被选中的牌不被 Demon 提前无效化', () => {
        const result = evaluateFantasyRealmsScore(
            [
                byId('outsider-angel'),
                byId('outsider-demon'),
                byId('leader-king'),
            ],
            [],
            {
                setupConfig: { cursedHoardSuitsEnabled: true },
                playerCount: 2,
            },
        );

        expect(result.totalScore).toBe(69);
        expect(result.activeBaseScore).toBe(69);
    });
});
