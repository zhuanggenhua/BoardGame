import type { CSSProperties } from 'react';
import { getLocalizedAssetPath } from '../../../core';
import { ASSETS } from './assets';

// --- 卡牌图集裁切配置（按行/列真实起点/尺寸）---
export type CardAtlasConfig = {
    imageW: number;
    imageH: number;
    cols: number;
    rows: number;
    rowStarts: number[];
    rowHeights: number[];
    colStarts: number[];
    colWidths: number[];
};

const CARD_ATLAS_JSON = `${ASSETS.CARDS_ATLAS}.atlas.json`;

const isNumberArray = (value: unknown): value is number[] => (
    Array.isArray(value) && value.every((item) => typeof item === 'number')
);

const isCardAtlasConfig = (value: unknown): value is CardAtlasConfig => {
    if (!value || typeof value !== 'object') return false;
    const data = value as Record<string, unknown>;
    return typeof data.imageW === 'number'
        && typeof data.imageH === 'number'
        && typeof data.rows === 'number'
        && typeof data.cols === 'number'
        && isNumberArray(data.rowStarts)
        && isNumberArray(data.rowHeights)
        && isNumberArray(data.colStarts)
        && isNumberArray(data.colWidths);
};

export const loadCardAtlasConfig = async (locale?: string): Promise<CardAtlasConfig> => {
    const basePath = getLocalizedAssetPath(CARD_ATLAS_JSON);
    const localizedPath = locale ? getLocalizedAssetPath(CARD_ATLAS_JSON, locale) : basePath;
    const candidates = localizedPath === basePath ? [basePath] : [localizedPath, basePath];

    for (const url of candidates) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const data: unknown = await response.json();
            if (isCardAtlasConfig(data)) return data;
        } catch {
            // 忽略单个路径错误，继续尝试下一候选
        }
    }

    throw new Error(`未找到卡牌图集配置: ${CARD_ATLAS_JSON}`);
};

export const getCardAtlasStyle = (index: number, atlas: CardAtlasConfig) => {
    const safeIndex = index % (atlas.cols * atlas.rows);
    const col = safeIndex % atlas.cols;
    const row = Math.floor(safeIndex / atlas.cols);
    const cardW = atlas.colWidths[col] ?? atlas.colWidths[0];
    const cardH = atlas.rowHeights[row] ?? atlas.rowHeights[0];
    const x = atlas.colStarts[col] ?? atlas.colStarts[0];
    const y = atlas.rowStarts[row] ?? atlas.rowStarts[0];
    const xPos = (x / (atlas.imageW - cardW)) * 100;
    const yPos = (y / (atlas.imageH - cardH)) * 100;
    const bgSizeX = (atlas.imageW / cardW) * 100;
    const bgSizeY = (atlas.imageH / cardH) * 100;
    return {
        backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
        backgroundPosition: `${xPos}% ${yPos}%`,
    } as CSSProperties;
};
