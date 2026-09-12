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

    it('尊重角色牌库里的无图卡，不用默认顺序错指其它吸血鬼牌', () => {
        expect(getDeckPreviewRef('vampire_lord', 'card-unexpected')).toBeNull();
        expect(getDiceThroneCardPreviewRef('card-unexpected', 'vampire_lord')).toBeNull();
    });
});
