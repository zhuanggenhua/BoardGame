import type { CSSProperties } from 'react';
import type { HeroState } from '../types';
import type { TranslateFn } from './utils';
import { buildLocalizedImageSet } from '../../../core';

export const ASSETS = {
    PLAYER_BOARD: 'dicethrone/images/monk/compressed/monk-player-board',
    TIP_BOARD: 'dicethrone/images/monk/compressed/monk-tip-board',
    CARDS_ATLAS: 'dicethrone/images/monk/compressed/monk-ability-cards',
    ABILITY_CARDS_BASE: 'dicethrone/images/monk/compressed/monk-base-ability-cards',
    DICE_SPRITE: 'dicethrone/images/monk/compressed/dice-sprite',
    EFFECT_ICONS: 'dicethrone/images/monk/compressed/status-icons-atlas',
    CARD_BG: 'dicethrone/images/Common/compressed/card-background',
    AVATAR: 'dicethrone/images/Common/compressed/character-portraits',
};

const DICE_ATLAS: {
    cols: number;
    rows: number;
    faceMap: Record<number, { col: number; row: number }>;
} = {
    cols: 3,
    rows: 3,
    faceMap: {
        1: { col: 0, row: 2 },
        2: { col: 0, row: 1 },
        3: { col: 1, row: 2 },
        4: { col: 1, row: 1 },
        5: { col: 2, row: 1 },
        6: { col: 2, row: 2 },
    },
};

export const DICE_BG_SIZE = `${DICE_ATLAS.cols * 100}% ${DICE_ATLAS.rows * 100}%`;

export const getDiceSpritePosition = (value: number) => {
    const mapping = DICE_ATLAS.faceMap[value] ?? DICE_ATLAS.faceMap[1];
    const xPos = DICE_ATLAS.cols > 1 ? (mapping.col / (DICE_ATLAS.cols - 1)) * 100 : 0;
    const yPos = DICE_ATLAS.rows > 1 ? (mapping.row / (DICE_ATLAS.rows - 1)) * 100 : 0;
    return { xPos, yPos };
};

export const getBonusFaceLabel = (value: number, t: TranslateFn) => {
    const face = value === 1 || value === 2
        ? 'fist'
        : value === 3
            ? 'palm'
            : value === 4 || value === 5
                ? 'taiji'
                : 'lotus';
    return t(`dice.face.${face}`) as string;
};

const PORTRAIT_ATLAS = {
    imageW: 3950,
    imageH: 4096,
    deckX: 0,
    deckY: 0,
    deckW: 3934,
    deckH: 1054,
    cols: 10,
    rows: 2,
};

const PORTRAIT_CELL_W = PORTRAIT_ATLAS.deckW / PORTRAIT_ATLAS.cols;
const PORTRAIT_CELL_H = PORTRAIT_ATLAS.deckH / PORTRAIT_ATLAS.rows;
const PORTRAIT_BG_SIZE = {
    x: (PORTRAIT_ATLAS.imageW / PORTRAIT_CELL_W) * 100,
    y: (PORTRAIT_ATLAS.imageH / PORTRAIT_CELL_H) * 100,
};

const CHARACTER_PORTRAIT_INDEX: Record<HeroState['characterId'], number> = {
    monk: 3,
};

const getPortraitAtlasPosition = (index: number) => {
    const safeIndex = index % (PORTRAIT_ATLAS.cols * PORTRAIT_ATLAS.rows);
    const col = safeIndex % PORTRAIT_ATLAS.cols;
    const row = Math.floor(safeIndex / PORTRAIT_ATLAS.cols);
    const x = PORTRAIT_ATLAS.deckX + col * PORTRAIT_CELL_W;
    const y = PORTRAIT_ATLAS.deckY + row * PORTRAIT_CELL_H;
    const xPos = (x / (PORTRAIT_ATLAS.imageW - PORTRAIT_CELL_W)) * 100;
    const yPos = (y / (PORTRAIT_ATLAS.imageH - PORTRAIT_CELL_H)) * 100;
    return { xPos, yPos };
};

export const getPortraitStyle = (characterId: HeroState['characterId'], locale?: string) => {
    const index = CHARACTER_PORTRAIT_INDEX[characterId] ?? 0;
    const { xPos, yPos } = getPortraitAtlasPosition(index);
    return {
        backgroundImage: buildLocalizedImageSet(ASSETS.AVATAR, locale),
        backgroundSize: `${PORTRAIT_BG_SIZE.x}% ${PORTRAIT_BG_SIZE.y}%`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${xPos}% ${yPos}%`,
    } as CSSProperties;
};
