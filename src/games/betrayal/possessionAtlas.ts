import type { CSSProperties } from 'react';
import {
    computeSpriteImgStyle,
    generateUniformAtlasConfig,
    type SpriteAtlasConfig,
} from '../../engine/primitives/spriteAtlas';
import type { BetrayalInventoryCard } from './game';

export type BetrayalPossessionAtlasVisual = {
    image: string;
    config: SpriteAtlasConfig;
    frameIndex: number;
};

export const BETRAYAL_POSSESSION_ATLAS_IMAGE_PATHS = [
    'betrayal/cards/item-front-atlas',
    'betrayal/cards/omen-front-atlas',
];

const ITEM_FRONT_ATLAS: SpriteAtlasConfig = {
    imageW: 5400,
    imageH: 3826,
    cols: 8,
    rows: 3,
    colStarts: [31, 706, 1381, 2056, 2731, 3406, 4086, 4756],
    colWidths: [621, 621, 621, 621, 621, 621, 611, 618],
    rowStarts: [40, 1315, 2592],
    rowHeights: [1217, 1217, 1212],
};

const OMEN_FRONT_ATLAS = generateUniformAtlasConfig(3084, 3072, 2, 5);

const buildItemVisual = (frameIndex: number): BetrayalPossessionAtlasVisual => ({
    image: 'betrayal/cards/item-front-atlas',
    config: ITEM_FRONT_ATLAS,
    frameIndex,
});

const buildOmenVisual = (frameIndex: number): BetrayalPossessionAtlasVisual => ({
    image: 'betrayal/cards/omen-front-atlas',
    config: OMEN_FRONT_ATLAS,
    frameIndex,
});

const POSSESSION_FRONT_VISUALS: Record<string, BetrayalPossessionAtlasVisual> = {
    camera: buildItemVisual(0),
    'medical-kit': buildItemVisual(4),
    flashlight: buildItemVisual(8),
    lantern: buildItemVisual(8),
    'lockpick-tool': buildItemVisual(14),
    map: buildItemVisual(16),
    notebook: buildItemVisual(16),
    journal: buildItemVisual(16),
    manuscript: buildItemVisual(16),
    'hunting-knife': buildItemVisual(17),
    rope: buildItemVisual(21),
    'holy-water': buildItemVisual(2),
    radio: buildItemVisual(9),
    'omen-book': buildOmenVisual(0),
    mask: buildOmenVisual(2),
    ring: buildOmenVisual(6),
};

export function resolvePossessionAtlasVisual(card: BetrayalInventoryCard): BetrayalPossessionAtlasVisual | null {
    const normalizedCardId = card.id
        .replace(/-preview-\d+$/, '')
        .replace(/-\d+$/, '');
    return POSSESSION_FRONT_VISUALS[normalizedCardId] ?? null;
}

export function buildPossessionAtlasImageStyle(visual: BetrayalPossessionAtlasVisual): CSSProperties & { aspectRatio: number } {
    const spriteStyle = computeSpriteImgStyle(visual.frameIndex, visual.config);
    return {
        width: spriteStyle.imgWidth,
        height: spriteStyle.imgHeight,
        maxWidth: 'none',
        transform: `translate(${spriteStyle.translateX}, ${spriteStyle.translateY})`,
        aspectRatio: spriteStyle.aspectRatio,
    };
}
