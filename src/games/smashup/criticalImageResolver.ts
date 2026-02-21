/**
 * SmashUp 关键图片解析器
 *
 * 派系选择阶段：只需要卡牌图集，基地图集后台暖加载。
 * playing 阶段（含教程）：基地立刻可见，必须作为关键图片预加载。
 * 教程模式：只加载已选派系对应的图集，不加载未使用的派系资源。
 *
 * 通过 phaseKey 区分阶段，阶段切换时 CriticalImageGate 会重新触发预加载。
 */

import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { MatchState } from '../../engine/types';

// ============================================================================
// 图集路径定义
// ============================================================================

/** 卡牌图集图片路径（相对于 /assets/） */
const CARD_ATLAS_PATHS = {
    CARDS1: 'smashup/cards/cards1',
    CARDS2: 'smashup/cards/cards2',
    CARDS3: 'smashup/cards/cards3',
    CARDS4: 'smashup/cards/cards4',
} as const;

/** 基地图集图片路径 */
const BASE_ATLAS_PATHS = {
    BASE1: 'smashup/base/base1',
    BASE2: 'smashup/base/base2',
    BASE3: 'smashup/base/base3',
    BASE4: 'smashup/base/base4',
} as const;

/** 所有卡牌图集路径集合 */
const ALL_CARD_ATLAS = Object.values(CARD_ATLAS_PATHS);
/** 所有基地图集路径集合 */
const ALL_BASE_ATLAS = Object.values(BASE_ATLAS_PATHS);

// ============================================================================
// 派系 → 图集映射（数据驱动，面向百游戏）
// ============================================================================

/**
 * 派系 → 卡牌图集路径映射
 * 每个派系的卡牌只存在于一个图集中，不会跨图集混合
 */
const FACTION_CARD_ATLAS: Record<string, string> = {
    // CARDS1: 海盗、忍者、外星人、恐龙
    pirates: CARD_ATLAS_PATHS.CARDS1,
    ninjas: CARD_ATLAS_PATHS.CARDS1,
    aliens: CARD_ATLAS_PATHS.CARDS1,
    dinosaurs: CARD_ATLAS_PATHS.CARDS1,
    // CARDS2: 米斯卡塔尼克、克苏鲁仆从、印斯茅斯、远古物种、疯狂
    miskatonic_university: CARD_ATLAS_PATHS.CARDS2,
    minions_of_cthulhu: CARD_ATLAS_PATHS.CARDS2,
    innsmouth: CARD_ATLAS_PATHS.CARDS2,
    elder_things: CARD_ATLAS_PATHS.CARDS2,
    madness: CARD_ATLAS_PATHS.CARDS2,
    // CARDS3: 幽灵、熊骑兵、蒸汽朋克、食人花
    ghosts: CARD_ATLAS_PATHS.CARDS3,
    bear_cavalry: CARD_ATLAS_PATHS.CARDS3,
    steampunks: CARD_ATLAS_PATHS.CARDS3,
    killer_plants: CARD_ATLAS_PATHS.CARDS3,
    // CARDS4: 丧尸、巫师、捣蛋鬼、机器人
    zombies: CARD_ATLAS_PATHS.CARDS4,
    wizards: CARD_ATLAS_PATHS.CARDS4,
    tricksters: CARD_ATLAS_PATHS.CARDS4,
    robots: CARD_ATLAS_PATHS.CARDS4,
};

/**
 * 派系 → 基地图集路径映射
 * 基地按扩展包分组，每个派系的基地在对应的基地图集中
 */
const FACTION_BASE_ATLAS: Record<string, string> = {
    // BASE1: 核心包派系
    pirates: BASE_ATLAS_PATHS.BASE1,
    ninjas: BASE_ATLAS_PATHS.BASE1,
    aliens: BASE_ATLAS_PATHS.BASE1,
    dinosaurs: BASE_ATLAS_PATHS.BASE1,
    robots: BASE_ATLAS_PATHS.BASE1,
    zombies: BASE_ATLAS_PATHS.BASE1,
    wizards: BASE_ATLAS_PATHS.BASE1,
    tricksters: BASE_ATLAS_PATHS.BASE1,
    // BASE2: 第二扩展包
    ghosts: BASE_ATLAS_PATHS.BASE2,
    bear_cavalry: BASE_ATLAS_PATHS.BASE2,
    steampunks: BASE_ATLAS_PATHS.BASE2,
    killer_plants: BASE_ATLAS_PATHS.BASE2,
    // BASE3: 第三扩展包
    kitty_cats: BASE_ATLAS_PATHS.BASE3,
    fairies: BASE_ATLAS_PATHS.BASE3,
    princesses: BASE_ATLAS_PATHS.BASE3,
    mythic_horses: BASE_ATLAS_PATHS.BASE3,
    // BASE4: 克苏鲁扩展
    elder_things: BASE_ATLAS_PATHS.BASE4,
    minions_of_cthulhu: BASE_ATLAS_PATHS.BASE4,
    innsmouth: BASE_ATLAS_PATHS.BASE4,
    miskatonic_university: BASE_ATLAS_PATHS.BASE4,
    // 注意：madness 没有专属基地，不在映射中
};

// ============================================================================
// 辅助函数
// ============================================================================

/** 根据派系列表收集需要的卡牌图集（去重） */
function getCardAtlasesForFactions(factionIds: string[]): string[] {
    const set = new Set<string>();
    for (const fid of factionIds) {
        const atlas = FACTION_CARD_ATLAS[fid];
        if (atlas) set.add(atlas);
    }
    return [...set];
}

/** 根据派系列表收集需要的基地图集（去重） */
function getBaseAtlasesForFactions(factionIds: string[]): string[] {
    const set = new Set<string>();
    for (const fid of factionIds) {
        const atlas = FACTION_BASE_ATLAS[fid];
        if (atlas) set.add(atlas);
    }
    return [...set];
}

/** 从游戏状态中提取所有已选派系 */
function extractSelectedFactions(state: MatchState): string[] {
    const core = state.core as { players?: Record<string, { factions?: [string, string] }> };
    if (!core?.players) return [];
    const factions = new Set<string>();
    for (const player of Object.values(core.players)) {
        if (player.factions) {
            for (const f of player.factions) {
                if (f) factions.add(f);
            }
        }
    }
    return [...factions];
}

// ============================================================================
// 解析器实现
// ============================================================================

/**
 * SmashUp 关键图片解析器
 *
 * - 派系选择阶段：卡牌图集 critical，基地图集 warm
 * - 正常 playing 阶段：全部卡牌+基地图集 critical（对手可能打出任何派系的牌）
 * - 教程 playing 阶段：只加载已选派系对应的图集
 */
export const smashUpCriticalImageResolver: CriticalImageResolver = (gameState): CriticalImageResolverResult => {
    const state = gameState as MatchState | undefined;
    const phase = state?.sys?.phase;
    const isTutorial = state?.sys?.tutorial?.active === true;

    // 派系选择阶段
    const isFactionSelect = phase === 'factionSelect';
    if (isFactionSelect) {
        // 教程模式：factionSelect 阶段会被 aiActions 快速推进到 playCards，
        // 不需要展示派系选择 UI，返回空资源让 CriticalImageGate 快速通过，
        // 等 playing 阶段再加载真正需要的图集
        if (isTutorial) {
            return {
                critical: [],
                warm: [],
                phaseKey: 'tutorial-factionSelect',
            };
        }
        // 正常模式：需要全部卡牌图集（展示所有派系），基地暖加载
        return {
            critical: [...ALL_CARD_ATLAS],
            warm: [...ALL_BASE_ATLAS],
            phaseKey: 'factionSelect',
        };
    }

    // 教程模式 playing 阶段：只加载已选派系对应的图集
    if (isTutorial) {
        const selectedFactions = extractSelectedFactions(state!);
        if (selectedFactions.length > 0) {
            const cardAtlases = getCardAtlasesForFactions(selectedFactions);
            const baseAtlases = getBaseAtlasesForFactions(selectedFactions);
            return {
                critical: [...cardAtlases, ...baseAtlases],
                warm: [],
                phaseKey: 'playing',
            };
        }
        // 教程 setup 阶段（派系尚未写入 core）：最小化加载
        return {
            critical: [],
            warm: [],
            phaseKey: 'tutorial-setup',
        };
    }

    // 正常 playing 阶段：全量加载（对手可能使用任何派系）
    return {
        critical: [...ALL_CARD_ATLAS, ...ALL_BASE_ATLAS],
        warm: [],
        phaseKey: 'playing',
    };
};
