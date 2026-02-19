import type { CSSProperties } from 'react';
import { getLocalizedAssetPath } from '../../../core';
import {
    type SpriteAtlasConfig,
    computeSpriteStyle,
    generateUniformAtlasConfig as engineGenerateUniform,
} from '../../../engine/primitives/spriteAtlas';
import { SMASHUP_ATLAS_IDS } from '../domain/ids';

// 向后兼容类型别名
export type CardAtlasConfig = SpriteAtlasConfig;

/** 均匀网格图集的默认配置（行列数），用于在 JSON 不存在时自动生成 */
export type UniformAtlasDefault = {
    rows: number;
    cols: number;
};

/**
 * 根据图片尺寸和行列数生成均匀网格配置
 */
export const generateUniformAtlasConfig = (
    imageW: number,
    imageH: number,
    rows: number,
    cols: number
): CardAtlasConfig => engineGenerateUniform(imageW, imageH, rows, cols);

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
 * SmashUp 所有图集都是规则网格，通过图片实际尺寸 + 行列数生成配置
 * 图片尺寸探测使用 getLocalizedAssetPath + 固定 locale，因为图片已迁移到 i18n/ 目录
 * 像素尺寸与语言无关，但文件只存在于国际化路径下
 * @param imageBase 图片基础路径（不含扩展名），如 'smashup/base/base1'
 * @param defaultGrid 网格配置（行列数）
 */
export const loadCardAtlasConfig = async (
    imageBase: string,
    defaultGrid: UniformAtlasDefault,
): Promise<CardAtlasConfig> => {
    const fileName = imageBase.split('/').pop() ?? imageBase;
    // 固定使用 zh-CN 探测尺寸（像素尺寸与语言无关，但文件只存在于 i18n/ 目录下）
    const PROBE_LOCALE = 'zh-CN';

    // 从压缩版图片获取实际尺寸，生成均匀网格配置
    try {
        const webpPath = `${imageBase.split('/').slice(0, -1).join('/')}/compressed/${fileName}.webp`;
        const imgUrl = getLocalizedAssetPath(webpPath, PROBE_LOCALE);
        const { width, height } = await getImageSize(imgUrl);
        return generateUniformAtlasConfig(width, height, defaultGrid.rows, defaultGrid.cols);
    } catch {
        // 全部失败，回退到虚拟尺寸
        return generateUniformAtlasConfig(
            defaultGrid.cols,
            defaultGrid.rows,
            defaultGrid.rows,
            defaultGrid.cols
        );
    }
};

export const getCardAtlasStyle = (index: number, atlas: CardAtlasConfig) => {
    return computeSpriteStyle(index, atlas) as CSSProperties;
};

import { registerCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';

/**
 * 初始化 SmashUp 卡牌图集（模块加载时同步注册）
 * 使用硬编码的均匀网格配置，避免运行时异步加载 JSON 导致的竞态条件
 */
export function initSmashUpCardAtlases() {
    // cards1: 6x8 grid
    registerCardAtlasSource(SMASHUP_ATLAS_IDS.CARDS1, {
        image: 'smashup/cards/cards1',
        config: generateUniformAtlasConfig(1943, 2048, 6, 8),
    });

    // cards2: 7x8 grid
    registerCardAtlasSource(SMASHUP_ATLAS_IDS.CARDS2, {
        image: 'smashup/cards/cards2',
        config: generateUniformAtlasConfig(1666, 2048, 7, 8),
    });

    // cards3: 6x8 grid
    registerCardAtlasSource(SMASHUP_ATLAS_IDS.CARDS3, {
        image: 'smashup/cards/cards3',
        config: generateUniformAtlasConfig(1943, 2048, 6, 8),
    });

    // cards4: 6x8 grid
    registerCardAtlasSource(SMASHUP_ATLAS_IDS.CARDS4, {
        image: 'smashup/cards/cards4',
        config: generateUniformAtlasConfig(1943, 2048, 6, 8),
    });
}
