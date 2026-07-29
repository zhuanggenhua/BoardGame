import type { CSSProperties } from 'react';
import {
    computeSpriteImgStyle,
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

export const BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO = 675 / 1275;

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

const OMEN_FRONT_ATLAS: SpriteAtlasConfig = {
    imageW: 3376,
    imageH: 2550,
    frames: [
        { x: 0, y: 0, width: 675, height: 1275 },
        { x: 675, y: 0, width: 675, height: 1275 },
        { x: 1350, y: 0, width: 675, height: 1275 },
        { x: 2025, y: 0, width: 675, height: 1275 },
        { x: 2700, y: 0, width: 676, height: 1275 },
        { x: 0, y: 1275, width: 675, height: 1275 },
        { x: 675, y: 1275, width: 675, height: 1275 },
        { x: 1350, y: 1275, width: 675, height: 1275 },
        { x: 2025, y: 1275, width: 675, height: 1275 },
        { x: 2700, y: 1275, width: 676, height: 1275 },
    ],
};

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
    'scary-doll': buildItemVisual(1),
    mirror: buildItemVisual(3),
    'medical-kit': buildItemVisual(4),
    'lucky-coin': buildItemVisual(5),
    'leather-jacket': buildItemVisual(6),
    'tooth-necklace': buildItemVisual(7),
    flashlight: buildItemVisual(8),
    lantern: buildItemVisual(8),
    'lockpick-tool': buildItemVisual(14),
    map: buildItemVisual(16),
    'strange-amulet': buildItemVisual(10),
    brooch: buildItemVisual(11),
    gun: buildItemVisual(12),
    crossbow: buildItemVisual(13),
    notebook: buildItemVisual(16),
    journal: buildItemVisual(16),
    manuscript: buildItemVisual(16),
    'mysterious-stopwatch': buildItemVisual(15),
    'hunting-knife': buildItemVisual(17),
    chainsaw: buildItemVisual(18),
    dynamite: buildItemVisual(19),
    'angel-feather': buildItemVisual(20),
    rope: buildItemVisual(21),
    'holy-water': buildItemVisual(2),
    radio: buildItemVisual(9),
    'omen-book': buildOmenVisual(0),
    dog: buildOmenVisual(1),
    mask: buildOmenVisual(2),
    skull: buildOmenVisual(3),
    'holy-symbol': buildOmenVisual(4),
    dagger: buildOmenVisual(5),
    ring: buildOmenVisual(6),
    armor: buildOmenVisual(7),
    idol: buildOmenVisual(8),
};

// 当前已确认两张正式正面 atlas：
// - item-front-atlas：物品正面
// - omen-front-atlas：预兆正面 candidate-06，对应 9 张正面 + 1 张牌背
//   0 书本、1 狗、2 面具、3 头骨、4 圣符、5 匕首、6 指环、7 盔甲、8 雕像、9 牌背

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
