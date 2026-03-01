import type { CSSProperties } from 'react';
import { getLocalizedAssetPath } from '../../../core';
import {
    type SpriteAtlasConfig,
    computeSpriteStyle,
    generateUniformAtlasConfig as engineGenerateUniform,
} from '../../../engine/primitives/spriteAtlas';
import { SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';

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

import { registerLazyCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';
// TODO: PR #5 引入了 TTS 英文图集支持，但缺少 atlas-config.json 文件
// import ttsAtlasConfig from '../../../../public/assets/i18n/en/smashup/atlas-config.json';

type TtsConfig = {
    atlases: Record<string, { grid: { rows: number; cols: number } }>;
};

/**
 * 初始化 SmashUp 所有图集（模块加载时同步注册）
 * 使用懒解析模式：只声明 image + rows/cols，首次渲染时自动从预加载缓存读取图片尺寸。
 * CriticalImageGate 保证图片在 Board 渲染前已预加载到缓存中。
 */
export function initSmashUpAtlases() {
    for (const atlas of SMASHUP_ATLAS_DEFINITIONS) {
        registerLazyCardAtlasSource(atlas.id, {
            image: atlas.image,
            grid: atlas.grid,
        });
    }

    // TODO: 动态注册 TTS 英文高清图集（等 atlas-config.json 文件补充后启用）
    // const ttsData = ttsAtlasConfig as TtsConfig;
    // for (const [atlasId, config] of Object.entries(ttsData.atlases)) {
    //     registerLazyCardAtlasSource(atlasId, {
    //         image: `smashup/cards/compressed/${atlasId}`,
    //         grid: { rows: config.grid.rows, cols: config.grid.cols },
    //     });
    // }
}

/** @deprecated 使用 initSmashUpAtlases 代替 */
export const initSmashUpCardAtlases = initSmashUpAtlases;
