import type { CSSProperties } from 'react';
import {
    LEVEL_1_CARD_ORDER,
    LEVEL_2_CARD_ORDER,
    LEVEL_3_CARD_ORDER,
    NOBLE_CARD_ORDER,
    SPLENDOR_SPRITE_ATLAS_BY_ID,
    buildIndexMap,
} from './spriteMapping';

const buildSpriteStyle = (imagePath: string, cols: number, rows: number, index: number): CSSProperties => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = cols <= 1 ? 0 : (col / (cols - 1)) * 100;
    const y = rows <= 1 ? 0 : (row / (rows - 1)) * 100;

    return {
        backgroundImage: `url(/assets/${imagePath})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${x}% ${y}%`,
    };
};

const NOBLE_INDEX_BY_ID = buildIndexMap(NOBLE_CARD_ORDER);

const CARD_INDEX_BY_ID: Record<1 | 2 | 3, Record<string, number>> = {
    1: buildIndexMap(LEVEL_1_CARD_ORDER),
    2: buildIndexMap(LEVEL_2_CARD_ORDER),
    3: buildIndexMap(LEVEL_3_CARD_ORDER),
};

export const getNobleSpriteStyle = (nobleId: string): CSSProperties | null => {
    const index = NOBLE_INDEX_BY_ID[nobleId];
    if (index === undefined) return null;
    const atlas = SPLENDOR_SPRITE_ATLAS_BY_ID.nobles;
    return buildSpriteStyle(atlas.imagePath, atlas.cols, atlas.rows, index);
};

export const getDevelopmentCardSpriteStyle = (cardId: string, tier: 1 | 2 | 3): CSSProperties | null => {
    const layout = SPLENDOR_SPRITE_ATLAS_BY_ID[`tier${tier}` as const];
    const index = CARD_INDEX_BY_ID[tier]?.[cardId];
    if (!layout || index === undefined) return null;
    return buildSpriteStyle(layout.imagePath, layout.cols, layout.rows, index);
};
