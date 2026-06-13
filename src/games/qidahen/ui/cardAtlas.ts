import type { CardPreviewRef } from '../../../core/types';
import { registerCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';

const QIDAHEN_MING_ATLAS_ID = 'qidahen:ming-hand-preview';
const QIDAHEN_MONGOL_ATLAS_ID = 'qidahen:mongol-hand-preview';
const QIDAHEN_JIN_ATLAS_ID = 'qidahen:jin-hand-preview';
const QIDAHEN_CHRONOLOGY_ATLAS_ID = 'qidahen:chronology-preview';
const QIDAHEN_KOREA_ATLAS_ID = 'qidahen:korea-special-preview';
const QIDAHEN_MING_CARD_BACK = 'qidahen/cards/backs/ming-card-back';
const QIDAHEN_MONGOL_CARD_BACK = 'qidahen/cards/backs/mongol-card-back';
const QIDAHEN_JIN_CARD_BACK = 'qidahen/cards/backs/jin-card-back';

const buildFrames = (
    topXs: number[],
    leftYs: number[],
    frameWidth: number,
    frameHeight: number,
) => ([
    ...topXs.map((x) => ({ x, y: 0, width: frameWidth, height: frameHeight })),
    ...leftYs.map((y) => ({ x: 0, y, width: frameWidth, height: frameHeight })),
]);

registerCardAtlasSource(QIDAHEN_MING_ATLAS_ID, {
    image: 'qidahen/cards/atlases/ming-faction-deck-atlas',
    config: {
        imageW: 4870,
        imageH: 4705,
        frames: buildFrames(
            [0, 487, 974, 1461, 1948, 2435, 2922, 3409, 3896, 4383],
            [672, 1344, 2016, 2688, 3360, 4032],
            487,
            672,
        ),
    },
});

registerCardAtlasSource(QIDAHEN_MONGOL_ATLAS_ID, {
    image: 'qidahen/cards/atlases/mongol-faction-deck-atlas',
    config: {
        imageW: 4783,
        imageH: 4641,
        frames: buildFrames(
            [0, 478, 956, 1434, 1912, 2390, 2868, 3346, 3824, 4302],
            [663, 1326, 1989, 2652, 3315, 3978],
            478,
            663,
        ),
    },
});

registerCardAtlasSource(QIDAHEN_JIN_ATLAS_ID, {
    image: 'qidahen/cards/atlases/jin-faction-deck-atlas',
    config: {
        imageW: 4872,
        imageH: 4730,
        frames: buildFrames(
            [0, 487, 974, 1461, 1948, 2435, 2922, 3409, 3896, 4383],
            [676, 1352, 2028, 2704, 3380, 4056],
            487,
            676,
        ),
    },
});

registerCardAtlasSource(QIDAHEN_CHRONOLOGY_ATLAS_ID, {
    image: 'qidahen/cards/atlases/chronology-deck-atlas',
    config: {
        imageW: 4798,
        imageH: 4625,
        frames: buildFrames(
            [0, 476, 952, 1428, 1904, 2380, 2856, 3332, 3808],
            [661, 1322, 1983, 2644, 3305],
            476,
            661,
        ),
    },
});

registerCardAtlasSource(QIDAHEN_KOREA_ATLAS_ID, {
    image: 'qidahen/cards/atlases/korea-special-deck-atlas',
    config: {
        imageW: 4795,
        imageH: 4623,
        frames: buildFrames(
            [0, 476, 952, 1428, 1904, 2380, 2856, 3332, 3808],
            [660, 1320, 1980, 2640, 3300],
            476,
            660,
        ),
    },
});

export const qidahenMingHandPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: QIDAHEN_MING_ATLAS_ID,
    index,
});

export const qidahenMongolHandPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: QIDAHEN_MONGOL_ATLAS_ID,
    index,
});

export const qidahenJinHandPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: QIDAHEN_JIN_ATLAS_ID,
    index,
});

export const qidahenChronologyPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: QIDAHEN_CHRONOLOGY_ATLAS_ID,
    index,
});

export const qidahenKoreaSpecialPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: QIDAHEN_KOREA_ATLAS_ID,
    index,
});

export const QIDAHEN_CARD_ATLAS_IDS = {
    MING_HAND: QIDAHEN_MING_ATLAS_ID,
    MONGOL_HAND: QIDAHEN_MONGOL_ATLAS_ID,
    JIN_HAND: QIDAHEN_JIN_ATLAS_ID,
    CHRONOLOGY: QIDAHEN_CHRONOLOGY_ATLAS_ID,
    KOREA_SPECIAL: QIDAHEN_KOREA_ATLAS_ID,
} as const;
