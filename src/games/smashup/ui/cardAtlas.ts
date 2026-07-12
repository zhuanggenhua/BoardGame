// @asset-pipeline-allow
import type { CSSProperties } from 'react';
import {
    type SpriteAtlasConfig,
    computeSpriteStyle,
    generateUniformAtlasConfig as engineGenerateUniform,
} from '../../../engine/primitives/spriteAtlas';
import { SMASHUP_ATLAS_DEFINITIONS, getSmashUpPodAtlasImagePath } from '../domain/atlasCatalog';
import smashUpEnglishMap from '../data/englishAtlasMap.json';
export { getSmashUpPodAtlasImagePath } from '../domain/atlasCatalog';

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
 * 加载卡牌图集配置
 * SmashUp 图集运行时通过 cardAtlasRegistry 的懒解析链路从 AssetLoader 预加载缓存读取尺寸。
 * 这里保留旧导出兼容历史调用方，不再自建图片加载链路。
 * @param imageBase 图片基础路径（不含扩展名），如 'smashup/base/base1'
 * @param defaultGrid 网格配置（行列数）
 */
export const loadCardAtlasConfig = async (
    _imageBase: string,
    defaultGrid: UniformAtlasDefault,
): Promise<CardAtlasConfig> => {
    return generateUniformAtlasConfig(
        defaultGrid.cols,
        defaultGrid.rows,
        defaultGrid.rows,
        defaultGrid.cols
    );
};

export const getCardAtlasStyle = (index: number, atlas: CardAtlasConfig) => {
    return computeSpriteStyle(index, atlas) as CSSProperties;
};

import { getCardAtlasSource, getLazyRegistration, registerLazyCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';
import podAtlasConfig from '../../../../public/assets/atlas-configs/smashup/pod-atlas-config.json';

type TtsConfig = {
    atlases: Record<string, { grid: { rows: number; cols: number } }>;
};

type EnglishMapConfig = { atlasId: string; index: number };

const REQUIRED_TTS_ATLAS_IDS = Array.from(
    new Set(
        Object.values(smashUpEnglishMap as Record<string, EnglishMapConfig>)
            .map(entry => entry.atlasId)
            .filter(atlasId => atlasId.startsWith('tts_atlas_'))
    )
)
    .filter(atlasId => !SMASHUP_ATLAS_DEFINITIONS.some(atlas => atlas.id === atlasId))
    .sort();

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

    // 动态注册 POD 英文高清图集（只注册 englishAtlasMap 实际使用的 atlasId）
    const podData = podAtlasConfig as TtsConfig;
    
    for (const atlasId of REQUIRED_TTS_ATLAS_IDS) {
        const config = podData.atlases[atlasId];
        if (!config) {
             
            console.warn(`[SmashUp.cardAtlas] ⚠️ 缺少 POD 图集配置: ${atlasId}`);
            continue;
        }
        const imagePath = getSmashUpPodAtlasImagePath(atlasId);
        registerLazyCardAtlasSource(atlasId, {
            image: imagePath,
            grid: { rows: config.grid.rows, cols: config.grid.cols },
        });
    }
}

export function ensureSmashUpAtlasRegistered(atlasId: string): boolean {
    if (!atlasId) return false;
    if (getCardAtlasSource(atlasId, 'en') || getLazyRegistration(atlasId)) {
        return false;
    }

    const builtInAtlas = SMASHUP_ATLAS_DEFINITIONS.find(atlas => atlas.id === atlasId);
    if (builtInAtlas) {
        registerLazyCardAtlasSource(atlasId, {
            image: builtInAtlas.image,
            grid: builtInAtlas.grid,
        });
        return true;
    }

    const podData = podAtlasConfig as TtsConfig;
    const ttsConfig = podData.atlases[atlasId];
    if (ttsConfig) {
        registerLazyCardAtlasSource(atlasId, {
            image: getSmashUpPodAtlasImagePath(atlasId),
            grid: { rows: ttsConfig.grid.rows, cols: ttsConfig.grid.cols },
        });
        return true;
    }

    return false;
}

/** @deprecated 使用 initSmashUpAtlases 代替 */
export const initSmashUpCardAtlases = initSmashUpAtlases;

// 模块加载时同步注册所有图集（包括 POD 图集）
initSmashUpAtlases();
