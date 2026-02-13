import type { CSSProperties } from 'react';
import { getLocalizedAssetPath } from '../../../core';
import { type SpriteAtlasConfig, computeSpriteStyle, isSpriteAtlasConfig } from '../../../engine/primitives/spriteAtlas';

// 向后兼容类型别名
export type CardAtlasConfig = SpriteAtlasConfig;

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
            if (isSpriteAtlasConfig(data)) return data;
        } catch {
            // 忽略单个路径错误，继续尝试下一候选
        }
    }

    throw new Error(`未找到卡牌图集配置: ${atlasJsonPath}`);
};

export const getCardAtlasStyle = (index: number, atlas: CardAtlasConfig) => {
    return computeSpriteStyle(index, atlas) as CSSProperties;
};
