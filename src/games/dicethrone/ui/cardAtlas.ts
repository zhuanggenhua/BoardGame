import type { CSSProperties } from 'react';
import { getLocalizedAssetPath } from '../../../core';

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

/**
 * 加载卡牌图集配置
 * 图集配置文件 (.atlas.json) 存放在 compressed/ 目录下
 * @param imageBase 图片基础路径（不含扩展名），如 'dicethrone/images/monk/monk-ability-cards'
 * @param locale 可选的语言代码，用于加载本地化版本
 */
export const loadCardAtlasConfig = async (imageBase: string, locale?: string): Promise<CardAtlasConfig> => {
    // 从 imageBase 提取文件名和目录路径，构建 compressed/ 下的配置文件路径
    const fileName = imageBase.split('/').pop() ?? imageBase;
    const dirPath = imageBase.substring(0, imageBase.length - fileName.length);
    const atlasJsonPath = `${dirPath}compressed/${fileName}.atlas.json`;
    
    // 构建候选 URL：优先本地化版本，然后是基础版本
    const basePath = getLocalizedAssetPath(atlasJsonPath);
    const localizedPath = locale ? getLocalizedAssetPath(atlasJsonPath, locale) : basePath;
    const candidates = localizedPath !== basePath ? [localizedPath, basePath] : [basePath];

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

    throw new Error(`未找到卡牌图集配置: ${atlasJsonPath}`);
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
