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
    it('已完成 closeout 的英雄不应继续保留 implementation_in_progress 徽标', () => {
        for (const characterId of [
            'gunslinger', 'samurai', 'treant', 'ninja', 'zhanshujia', 'cursed_pirate', 'artificer', 'doctor_strange',
        ]) {
            expect(
                hasImplementationInProgressBadge(characterId),
                `${characterId} 不应继续保留 implementation_in_progress`,
            ).toBe(false);
        }
    });

    it('女猎手当前仍保留 implementation_in_progress 徽标', () => {
        expect(getImplementationInProgressBadge('lieren')).toMatchObject({
            id: 'implementation_in_progress',
            labelKey: 'common:status_tags.under_construction',
            tone: 'warning',
            variant: 'disabled-overlay',
        });
    });

    it('吸血鬼领主审计完成但未获真人确认时保持实施中，完整目录保留且显示实施中徽标', () => {
        const vampireLord = DICETHRONE_CHARACTER_CATALOG.find((character) => character.id === 'vampire_lord');

        expect(vampireLord?.setupOptionStatus).toBe('in_progress');
        expect(vampireLord?.setupOptionStatusReason).toContain('真人确认');
        expect(getImplementationInProgressBadge('vampire_lord')).toMatchObject({
            id: 'implementation_in_progress',
            labelKey: 'common:status_tags.under_construction',
            tone: 'warning',
            variant: 'disabled-overlay',
        });
        expect(DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG.map((character) => character.id)).toContain('vampire_lord');
    });

    it('索尔完整玩法已实施但未获真人完成态确认时保持实施中并可见', () => {
        const thor = DICETHRONE_CHARACTER_CATALOG.find((character) => character.id === 'thor');

        expect(thor?.setupOptionStatus).toBe('in_progress');
        expect(thor?.setupOptionStatusReason).toContain('真人完成态确认前');
        expect(getImplementationInProgressBadge('thor')).toMatchObject({
            id: 'implementation_in_progress',
            labelKey: 'common:status_tags.under_construction',
            tone: 'warning',
            variant: 'disabled-overlay',
        });
        expect(DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG.map((character) => character.id)).toContain('thor');
    });
});
