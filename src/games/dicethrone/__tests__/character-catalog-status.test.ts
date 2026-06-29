import { describe, expect, it } from 'vitest';

import { DICETHRONE_CHARACTER_CATALOG } from '../domain/core-types';

const hasImplementationInProgressBadge = (characterId: string) => (
    DICETHRONE_CHARACTER_CATALOG
        .find((character) => character.id === characterId)
        ?.badges?.some((badge) => badge.id === 'implementation_in_progress')
    ?? false
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
});
