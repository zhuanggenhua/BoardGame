import { describe, expect, it } from 'vitest';

import type { CardPreviewRef } from '../../../core';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getDiceThroneCardPreviewRef } from '../ui/cardPreviewHelper';

const deterministicRandom = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(array: T[]) => array,
};

const getDeckPreviewRef = (characterId: string, cardId: string): CardPreviewRef | null => {
    const character = CHARACTER_DATA_MAP[characterId];
    if (!character) return null;

    return character.getStartingDeck(deterministicRandom as never)
        .find((card) => card.id === cardId)
        ?.previewRef ?? null;
};

describe('DiceThrone 卡牌备用预览入口', () => {
    it('所有实际牌库里的手牌都必须解析到卡图', () => {
        const violations = Object.entries(CHARACTER_DATA_MAP).flatMap(([characterId, character]) => (
            character.getStartingDeck(deterministicRandom as never)
                .filter((card) => !card.previewRef)
                .map((card) => `${characterId}:${card.id}`)
        ));

        expect(violations).toEqual([]);
    });

    it('按当前角色实际牌库解析通用牌图集，不把新规格角色套旧顺序', () => {
        const cases = [
            { characterId: 'vampire_lord', cardId: 'card-get-away', expectedIndex: 11 },
            { characterId: 'tianshi', cardId: 'card-get-away', expectedIndex: 11 },
            { characterId: 'zhanshujia', cardId: 'card-get-away', expectedIndex: 11 },
            { characterId: 'cursed_pirate', cardId: 'card-get-away', expectedIndex: 11 },
            { characterId: 'artificer', cardId: 'card-get-away', expectedIndex: 11 },
            { characterId: 'gunslinger', cardId: 'card-get-away', expectedIndex: 3 },
            { characterId: 'samurai', cardId: 'card-get-away', expectedIndex: 3 },
            { characterId: 'barbarian', cardId: 'card-get-away', expectedIndex: 29 },
        ] as const;

        for (const entry of cases) {
            const expected = getDeckPreviewRef(entry.characterId, entry.cardId);
            expect(expected, `${entry.characterId}:${entry.cardId} 必须在角色牌库里有 previewRef`).toMatchObject({
                type: 'atlas',
                index: entry.expectedIndex,
            });
            expect(getDiceThroneCardPreviewRef(entry.cardId, entry.characterId)).toEqual(expected);
        }
    });

    it('吸血鬼意不意外必须使用本英雄 slot-33，不得错指血石或其它英雄图集', () => {
        const expected = getDeckPreviewRef('vampire_lord', 'card-unexpected');
        expect(expected).toMatchObject({
            type: 'atlas',
            atlasId: 'dicethrone:vampire_lord-cards',
            index: 33,
        });
        expect(getDiceThroneCardPreviewRef('card-unexpected', 'vampire_lord')).toEqual(expected);
    });
});
