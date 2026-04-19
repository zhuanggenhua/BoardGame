import { describe, expect, test } from 'vitest';
import { SPLENDOR_CARD_DEFS, SPLENDOR_NOBLE_DEFS } from '../domain/data';
import {
    LEVEL_1_CARD_ORDER,
    LEVEL_2_CARD_ORDER,
    LEVEL_3_CARD_ORDER,
    NOBLE_CARD_ORDER,
    SPLENDOR_SPRITE_ATLASES,
} from '../spriteMapping';
import {
    getDevelopmentCardSpriteStyle,
    getNobleSpriteStyle,
} from '../sprites';

describe('splendor sprite mapping', () => {
    test('level order arrays match expected counts and contain unique ids', () => {
        expect(LEVEL_1_CARD_ORDER).toHaveLength(40);
        expect(LEVEL_2_CARD_ORDER).toHaveLength(30);
        expect(LEVEL_3_CARD_ORDER).toHaveLength(20);

        expect(new Set(LEVEL_1_CARD_ORDER).size).toBe(40);
        expect(new Set(LEVEL_2_CARD_ORDER).size).toBe(30);
        expect(new Set(LEVEL_3_CARD_ORDER).size).toBe(20);
    });

    test('every development card has a sprite mapping', () => {
        for (const card of SPLENDOR_CARD_DEFS) {
            const style = getDevelopmentCardSpriteStyle(card.id, card.tier);
            expect(style).not.toBeNull();
        }
    });

    test('every noble has a sprite mapping', () => {
        for (const noble of SPLENDOR_NOBLE_DEFS) {
            const style = getNobleSpriteStyle(noble.id);
            expect(style).not.toBeNull();
        }
    });

    test('atlas configs match expected frame counts and noble order is unique', () => {
        expect(SPLENDOR_SPRITE_ATLASES.find((atlas) => atlas.id === 'tier1')?.frameIds).toHaveLength(40);
        expect(SPLENDOR_SPRITE_ATLASES.find((atlas) => atlas.id === 'tier2')?.frameIds).toHaveLength(30);
        expect(SPLENDOR_SPRITE_ATLASES.find((atlas) => atlas.id === 'tier3')?.frameIds).toHaveLength(20);
        expect(SPLENDOR_SPRITE_ATLASES.find((atlas) => atlas.id === 'nobles')?.frameIds).toHaveLength(10);
        expect(new Set(NOBLE_CARD_ORDER).size).toBe(10);
    });

    test('level order arrays only reference cards from their own tier', () => {
        const level1Ids = new Set(SPLENDOR_CARD_DEFS.filter((card) => card.tier === 1).map((card) => card.id));
        const level2Ids = new Set(SPLENDOR_CARD_DEFS.filter((card) => card.tier === 2).map((card) => card.id));
        const level3Ids = new Set(SPLENDOR_CARD_DEFS.filter((card) => card.tier === 3).map((card) => card.id));

        expect(LEVEL_1_CARD_ORDER.every((id) => level1Ids.has(id))).toBe(true);
        expect(LEVEL_2_CARD_ORDER.every((id) => level2Ids.has(id))).toBe(true);
        expect(LEVEL_3_CARD_ORDER.every((id) => level3Ids.has(id))).toBe(true);
    });

    test('level 1 order follows white, green, black, red, blue groups', () => {
        expect(LEVEL_1_CARD_ORDER.slice(0, 8).every((id) => id.startsWith('t1-white-'))).toBe(true);
        expect(LEVEL_1_CARD_ORDER.slice(8, 16).every((id) => id.startsWith('t1-green-'))).toBe(true);
        expect(LEVEL_1_CARD_ORDER.slice(16, 24).every((id) => id.startsWith('t1-black-'))).toBe(true);
        expect(LEVEL_1_CARD_ORDER.slice(24, 32).every((id) => id.startsWith('t1-red-'))).toBe(true);
        expect(LEVEL_1_CARD_ORDER.slice(32, 40).every((id) => id.startsWith('t1-blue-'))).toBe(true);
    });

    test('level 2 order follows white, green, black, red, blue groups', () => {
        expect(LEVEL_2_CARD_ORDER.slice(0, 6).every((id) => id.startsWith('t2-white-'))).toBe(true);
        expect(LEVEL_2_CARD_ORDER.slice(6, 12).every((id) => id.startsWith('t2-green-'))).toBe(true);
        expect(LEVEL_2_CARD_ORDER.slice(12, 18).every((id) => id.startsWith('t2-black-'))).toBe(true);
        expect(LEVEL_2_CARD_ORDER.slice(18, 24).every((id) => id.startsWith('t2-red-'))).toBe(true);
        expect(LEVEL_2_CARD_ORDER.slice(24, 30).every((id) => id.startsWith('t2-blue-'))).toBe(true);
    });

    test('level 3 order follows white, green, black, red, blue groups', () => {
        expect(LEVEL_3_CARD_ORDER.slice(0, 4).every((id) => id.startsWith('t3-white-'))).toBe(true);
        expect(LEVEL_3_CARD_ORDER.slice(4, 8).every((id) => id.startsWith('t3-green-'))).toBe(true);
        expect(LEVEL_3_CARD_ORDER.slice(8, 12).every((id) => id.startsWith('t3-black-'))).toBe(true);
        expect(LEVEL_3_CARD_ORDER.slice(12, 16).every((id) => id.startsWith('t3-red-'))).toBe(true);
        expect(LEVEL_3_CARD_ORDER.slice(16, 20).every((id) => id.startsWith('t3-blue-'))).toBe(true);
    });
});
