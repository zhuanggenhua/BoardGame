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

/** 均匀网格图集的默认配置（行列数），用于在 JSON 不存在时自动生成 */
export type UniformAtlasDefault = {
    rows: number;
    cols: number;
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
 * 根据图片尺寸和行列数生成均匀网格配置
 */
export const generateUniformAtlasConfig = (
    imageW: number,
    imageH: number,
    rows: number,
    cols: number
): CardAtlasConfig => {
    const cellW = imageW / cols;
    const cellH = imageH / rows;
    const rowStarts: number[] = [];
    const rowHeights: number[] = [];
    const colStarts: number[] = [];
    const colWidths: number[] = [];
    for (let i = 0; i < rows; i++) {
        rowStarts.push(i * cellH);
        rowHeights.push(cellH);
    }
    for (let i = 0; i < cols; i++) {
        colStarts.push(i * cellW);
        colWidths.push(cellW);
    }
    return { imageW, imageH, rows, cols, rowStarts, rowHeights, colStarts, colWidths };
};

/**
 * 获取图片尺寸
 */
const getImageSize = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = src;
    });
};

/**
 * 加载卡牌图集配置
 * 图集配置文件 (.atlas.json) 存放在 compressed/ 目录下
 * @param imageBase 图片基础路径（不含扩展名），如 'smashup/base/base1'
 * @param locale 可选的语言代码，用于加载本地化版本
 * @param defaultGrid 可选的默认网格配置，当 JSON 不存在时使用
 */
export const loadCardAtlasConfig = async (
    imageBase: string,
    locale?: string,
    defaultGrid?: UniformAtlasDefault
): Promise<CardAtlasConfig> => {
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

    // JSON 不存在，尝试使用默认网格配置
    if (defaultGrid) {
        try {
            // 尝试加载压缩版图片获取尺寸（优先 webp）
            const compressedPath = `${dirPath}compressed/${fileName}.webp`;
            const imgUrl = getLocalizedAssetPath(compressedPath, locale);
            const { width, height } = await getImageSize(imgUrl);
            return generateUniformAtlasConfig(width, height, defaultGrid.rows, defaultGrid.cols);
        } catch {
            // 压缩版加载失败，尝试原始 PNG
            try {
                const pngPath = getLocalizedAssetPath(`${imageBase}.png`, locale);
                const { width, height } = await getImageSize(pngPath);
                return generateUniformAtlasConfig(width, height, defaultGrid.rows, defaultGrid.cols);
            } catch {
                // 图片也加载失败，回退到虚拟尺寸（保证图集仍可用）
                return generateUniformAtlasConfig(
                    defaultGrid.cols,
                    defaultGrid.rows,
                    defaultGrid.rows,
                    defaultGrid.cols
                );
            }
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
