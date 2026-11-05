import type { CardPreviewRef } from '../../../core/cardPreviewTypes';

export const QIDAHEN_MING_ATLAS_ID = 'qidahen:ming-hand-preview';
export const QIDAHEN_MONGOL_ATLAS_ID = 'qidahen:mongol-hand-preview';
export const QIDAHEN_JIN_ATLAS_ID = 'qidahen:jin-hand-preview';
export const QIDAHEN_CHRONOLOGY_ATLAS_ID = 'qidahen:chronology-preview';
export const QIDAHEN_KOREA_ATLAS_ID = 'qidahen:korea-special-preview';
export const QIDAHEN_ATLAS05_ORDINARY_HAND_ATLAS_ID = 'qidahen:atlas05-ordinary-hand-preview';

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

export const qidahenAtlas05OrdinaryHandPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: QIDAHEN_ATLAS05_ORDINARY_HAND_ATLAS_ID,
    index,
});

export const QIDAHEN_CARD_ATLAS_IDS = {
    MING_HAND: QIDAHEN_MING_ATLAS_ID,
    MONGOL_HAND: QIDAHEN_MONGOL_ATLAS_ID,
    JIN_HAND: QIDAHEN_JIN_ATLAS_ID,
    CHRONOLOGY: QIDAHEN_CHRONOLOGY_ATLAS_ID,
    KOREA_SPECIAL: QIDAHEN_KOREA_ATLAS_ID,
    ATLAS05_ORDINARY_HAND: QIDAHEN_ATLAS05_ORDINARY_HAND_ATLAS_ID,
} as const;
