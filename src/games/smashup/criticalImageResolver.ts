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
import { getAllBaseDefs, getAllCardDefs } from './data/cards';
import { getSmashUpAtlasImageById, getSmashUpAtlasImagesByKind } from './domain/atlasCatalog';

// ============================================================================
// 图集路径与派系映射（自动派生）
// ============================================================================

type PreviewRefLike = {
    type?: string;
    atlasId?: string;
};

type DefWithFactionPreview = {
    faction?: string;
    previewRef?: PreviewRefLike;
};

/** 所有卡牌图集路径集合（来自统一图集目录） */
const ALL_CARD_ATLAS = getSmashUpAtlasImagesByKind('card');
/** 所有基地图集路径集合（来自统一图集目录） */
const ALL_BASE_ATLAS = getSmashUpAtlasImagesByKind('base');

function resolveAtlasImagePath(previewRef?: PreviewRefLike): string | undefined {
    if (!previewRef || previewRef.type !== 'atlas' || typeof previewRef.atlasId !== 'string') {
        return undefined;
    }
    return getSmashUpAtlasImageById(previewRef.atlasId);
}

/**
 * 根据牌库定义自动构建「派系 -> 图集路径列表」映射。
 *
 * 注意：某些基地（如 vampires）没有 previewRef，属于规则层“无专属基地”的设计，
 * 此处会自动跳过，避免手写白名单。
 */
function buildFactionAtlasMap(defs: DefWithFactionPreview[]): Record<string, string[]> {
    const map = new Map<string, Set<string>>();
    for (const def of defs) {
        const faction = def.faction;
        if (!faction) continue;
        const atlasPath = resolveAtlasImagePath(def.previewRef);
        if (!atlasPath) continue;
        let set = map.get(faction);
        if (!set) {
            set = new Set<string>();
            map.set(faction, set);
        }
        set.add(atlasPath);
    }
    return Object.fromEntries(
        [...map.entries()].map(([faction, atlases]) => [faction, [...atlases]]),
    );
}

function getFactionCardAtlasMap(): Record<string, string[]> {
    return buildFactionAtlasMap(getAllCardDefs());
}

function getFactionBaseAtlasMap(): Record<string, string[]> {
    return buildFactionAtlasMap(getAllBaseDefs());
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 根据派系列表收集需要的卡牌图集（去重） */
function getCardAtlasesForFactions(factionIds: string[]): string[] {
    const set = new Set<string>();
    const factionCardAtlasMap = getFactionCardAtlasMap();
    for (const fid of factionIds) {
        const atlases = factionCardAtlasMap[fid];
        if (!atlases) continue;
        for (const atlas of atlases) {
            set.add(atlas);
        }
    }
    return [...set];
}

/** 根据派系列表收集需要的基地图集（去重） */
function getBaseAtlasesForFactions(factionIds: string[]): string[] {
    const set = new Set<string>();
    const factionBaseAtlasMap = getFactionBaseAtlasMap();
    for (const fid of factionIds) {
        const atlases = factionBaseAtlasMap[fid];
        if (!atlases) continue;
        for (const atlas of atlases) {
            set.add(atlas);
        }
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
