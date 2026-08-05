import type { CSSProperties } from 'react';
import { type SpriteAtlasConfig, computeSpriteStyle, isSpriteAtlasConfig } from '../../../engine/primitives/spriteAtlas';
import { registerCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';
import { DICETHRONE_CARD_ATLAS_IDS } from '../domain/ids';
import { ASSETS } from './assets';
// 直接 import src/ 下的 JSON（同步，Vite 构建时内联）
import atlasConfigData from '../../../assets/atlas-configs/dicethrone/ability-cards-common.atlas.json';
import treantAtlasConfigData from '../../../assets/atlas-configs/dicethrone/ability-cards-treant.atlas.json';
import ninjaAtlasConfigData from '../../../assets/atlas-configs/dicethrone/ability-cards-ninja.atlas.json';
import zhanshujiaAtlasConfigData from '../../../assets/atlas-configs/dicethrone/ability-cards-zhanshujia.atlas.json';
import cursedPirateAtlasConfigData from '../../../assets/atlas-configs/dicethrone/ability-cards-cursed_pirate.atlas.json';
import artificerAtlasConfigData from '../../../assets/atlas-configs/dicethrone/ability-cards-artificer.atlas.json';
import tianshiAtlasConfigData from '../../../assets/atlas-configs/dicethrone/ability-cards-tianshi.atlas.json';

// 向后兼容类型别名
export type CardAtlasConfig = SpriteAtlasConfig;

/** 解析并验证静态 JSON 配置（支持公共网格和角色专属精确 frame） */
function parseAtlasConfig(data: unknown, label: string): SpriteAtlasConfig {
    if (isSpriteAtlasConfig(data)) return data;
    throw new Error(`[DiceThrone] 无效的图集配置: ${label}`);
}

// @atlas-contract ability-cards-common.atlas.json 不规则网格；坐标来自图集人工采样（colStarts/rowStarts）。
// 枪手/武士新图集存在轻微左偏，基于抽样像素对列坐标做微调修正。
/** 默认公共配置：所有当前正式角色都沿用这份不规则网格。 */
export const COMMON_CARD_ATLAS_CONFIG = parseAtlasConfig(atlasConfigData, 'ability-cards-common.atlas.json');

const applyGlobalOffset = (config: CardAtlasConfig, offsetX: number): CardAtlasConfig => {
    if ('frames' in config) return config;
    return {
        ...config,
        colStarts: config.colStarts.map((value) => value + offsetX),
    };
};

// 枪手/武士图集仅有轻微左偏：按基准图集像素做小幅全局左移修正。
// 该偏移会在 CardPreview 的尺寸缩放中等比放大到实际图集尺寸。
const GUNSLINGER_GLOBAL_SHIFT_X = -5.0; // slot-30 CP 仍偏左，进一步左移确保 CP 完整可见
const SAMURAI_GLOBAL_SHIFT_X = -3.97; // 对应实图约 -4px

const GUNSLINGER_CARD_ATLAS_CONFIG = applyGlobalOffset(COMMON_CARD_ATLAS_CONFIG, GUNSLINGER_GLOBAL_SHIFT_X);
const SAMURAI_CARD_ATLAS_CONFIG = applyGlobalOffset(COMMON_CARD_ATLAS_CONFIG, SAMURAI_GLOBAL_SHIFT_X);
const TREANT_CARD_ATLAS_CONFIG = parseAtlasConfig(treantAtlasConfigData, 'ability-cards-treant.atlas.json');
const NINJA_CARD_ATLAS_CONFIG = parseAtlasConfig(ninjaAtlasConfigData, 'ability-cards-ninja.atlas.json');
const ZHANSHUJIA_CARD_ATLAS_CONFIG = parseAtlasConfig(zhanshujiaAtlasConfigData, 'ability-cards-zhanshujia.atlas.json');
const CURSED_PIRATE_CARD_ATLAS_CONFIG = parseAtlasConfig(cursedPirateAtlasConfigData, 'ability-cards-cursed_pirate.atlas.json');
const ARTIFICER_CARD_ATLAS_CONFIG = parseAtlasConfig(artificerAtlasConfigData, 'ability-cards-artificer.atlas.json');
const TIANSHI_CARD_ATLAS_CONFIG = parseAtlasConfig(tianshiAtlasConfigData, 'ability-cards-tianshi.atlas.json');

const getHeroAtlasConfig = (charId: string) => {
    if (charId === 'gunslinger') return GUNSLINGER_CARD_ATLAS_CONFIG;
    if (charId === 'samurai') return SAMURAI_CARD_ATLAS_CONFIG;
    if (charId === 'treant') return TREANT_CARD_ATLAS_CONFIG;
    if (charId === 'ninja') return NINJA_CARD_ATLAS_CONFIG;
    if (charId === 'zhanshujia') return ZHANSHUJIA_CARD_ATLAS_CONFIG;
    if (charId === 'cursed_pirate') return CURSED_PIRATE_CARD_ATLAS_CONFIG;
    if (charId === 'artificer') return ARTIFICER_CARD_ATLAS_CONFIG;
    if (charId === 'tianshi') return TIANSHI_CARD_ATLAS_CONFIG;
    return COMMON_CARD_ATLAS_CONFIG;
};
/**
 * 初始化 DiceThrone 所有英雄的卡牌图集（模块加载时同步注册）
 * 枪手/武士做轻微全局偏移，其余角色沿用公共 atlas。
 */
export function initDiceThroneCardAtlases() {
    for (const [, atlasId] of Object.entries(DICETHRONE_CARD_ATLAS_IDS)) {
        // 从 atlasId 提取 charId：'dicethrone:monk-cards' → 'monk'
        const charId = atlasId.replace('dicethrone:', '').replace('-cards', '');
        registerCardAtlasSource(atlasId, { image: ASSETS.CARDS_ATLAS(charId), config: getHeroAtlasConfig(charId) });
    }
}

// 模块加载时同步注册
initDiceThroneCardAtlases();

/** @deprecated 使用 initDiceThroneCardAtlases 代替（同步注册，无需 await） */
export const loadCardAtlasConfig = async (): Promise<CardAtlasConfig> => {
    return COMMON_CARD_ATLAS_CONFIG;
};

export const getCardAtlasStyle = (index: number, atlas: CardAtlasConfig) => {
    return computeSpriteStyle(index, atlas) as CSSProperties;
};
