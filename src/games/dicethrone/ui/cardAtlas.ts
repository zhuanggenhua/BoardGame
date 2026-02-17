import type { CSSProperties } from 'react';
import { type SpriteAtlasConfig, computeSpriteStyle, isSpriteAtlasConfig } from '../../../engine/primitives/spriteAtlas';
// 直接 import src/ 下的 JSON
import atlasConfigData from '../../../assets/atlas-configs/dicethrone/ability-cards-common.atlas.json';

// 向后兼容类型别名
export type CardAtlasConfig = SpriteAtlasConfig;

/**
 * 加载卡牌图集配置
 * DiceThrone 所有英雄使用统一的图集配置（4行10列），直接 import 静态 JSON
 */
export const loadCardAtlasConfig = async (): Promise<CardAtlasConfig> => {
    const data: unknown = atlasConfigData;
    if (isSpriteAtlasConfig(data)) {
        console.log('[loadCardAtlasConfig] loaded config:', { imageW: data.imageW, rows: data.rows, cols: data.cols });
        return data;
    }
    throw new Error('Invalid atlas config format');
};

export const getCardAtlasStyle = (index: number, atlas: CardAtlasConfig) => {
    return computeSpriteStyle(index, atlas) as CSSProperties;
};
