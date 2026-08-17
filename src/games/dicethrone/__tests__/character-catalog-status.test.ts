import { describe, expect, it } from 'vitest';

import { DICETHRONE_CHARACTER_CATALOG } from '../domain/core-types';

const getImplementationInProgressBadge = (characterId: string) => (
    DICETHRONE_CHARACTER_CATALOG
        .find((character) => character.id === characterId)
        ?.badges?.find((badge) => badge.id === 'implementation_in_progress')
);

const hasImplementationInProgressBadge = (characterId: string) => (
    getImplementationInProgressBadge(characterId) !== undefined
);

describe('DiceThrone 角色目录实施中状态合同', () => {
    it('已完成 closeout 的近批新英雄不应继续保留 implementation_in_progress 徽标', () => {
        for (const characterId of ['gunslinger', 'samurai', 'treant', 'ninja', 'zhanshujia', 'cursed_pirate', 'artificer']) {
            expect(
                hasImplementationInProgressBadge(characterId),
                `${characterId} 不应继续保留 implementation_in_progress`,
            ).toBe(false);
        }
    });

    it('女猎手当前应保留 implementation_in_progress 徽标', () => {
        expect(getImplementationInProgressBadge('lieren')).toMatchObject({
            id: 'implementation_in_progress',
            labelKey: 'common:status_tags.under_construction',
            tone: 'warning',
            variant: 'disabled-overlay',
        });
    });
});
