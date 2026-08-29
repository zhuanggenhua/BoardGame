import { describe, expect, it } from 'vitest';

import {
    DICETHRONE_CHARACTER_CATALOG,
    DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG,
} from '../domain/core-types';

const getImplementationInProgressBadge = (characterId: string) => (
    DICETHRONE_CHARACTER_CATALOG
        .find((character) => character.id === characterId)
        ?.badges?.find((badge) => badge.id === 'implementation_in_progress')
);

const hasImplementationInProgressBadge = (characterId: string) => (
    getImplementationInProgressBadge(characterId) !== undefined
);

describe('DiceThrone 角色目录生命周期状态合同', () => {
    it('已完成 closeout 的近批新英雄不应继续保留 implementation_in_progress 徽标', () => {
        for (const characterId of ['gunslinger', 'samurai', 'treant', 'ninja', 'zhanshujia', 'cursed_pirate', 'artificer']) {
            expect(
                hasImplementationInProgressBadge(characterId),
                `${characterId} 不应继续保留 implementation_in_progress`,
            ).toBe(false);
        }
    });

    it('女猎手和吸血鬼领主当前仍保留 implementation_in_progress 徽标', () => {
        for (const characterId of ['lieren', 'vampire_lord']) {
            expect(getImplementationInProgressBadge(characterId)).toMatchObject({
                id: 'implementation_in_progress',
                labelKey: 'common:status_tags.under_construction',
                tone: 'warning',
                variant: 'disabled-overlay',
            });
        }
    });

    it('吸血鬼领主当前为实施中状态，进入玩家可见目录并显示实施中徽标', () => {
        const vampireLord = DICETHRONE_CHARACTER_CATALOG.find((character) => character.id === 'vampire_lord');

        expect(vampireLord?.setupOptionStatus).toBe('in_progress');
        expect(vampireLord?.setupOptionStatusReason).toContain('当前范围实施与审计');
        expect(hasImplementationInProgressBadge('vampire_lord')).toBe(true);
        expect(DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG.map((character) => character.id)).toContain('vampire_lord');
    });
});
