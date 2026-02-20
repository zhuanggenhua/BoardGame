/**
 * SmashUp 关键图片解析器
 *
 * 派系选择阶段：只需要卡牌图集，基地图集后台暖加载。
 * playing 阶段（含教程）：基地立刻可见，必须作为关键图片预加载。
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
const BASE_ATLAS_PATHS = [
    'smashup/base/base1',
    'smashup/base/base2',
    'smashup/base/base3',
    'smashup/base/base4',
] as const;

/** 所有卡牌图集路径集合 */
const ALL_CARD_ATLAS_SET = new Set(Object.values(CARD_ATLAS_PATHS));

// ============================================================================
// 解析器实现
// ============================================================================

/**
 * SmashUp 关键图片解析器
 *
 * - 派系选择阶段：卡牌图集 critical，基地图集 warm
 * - 其他阶段（playing/教程等）：卡牌+基地图集都 critical
 */
export const smashUpCriticalImageResolver: CriticalImageResolver = (gameState): CriticalImageResolverResult => {
    const state = gameState as MatchState | undefined;
    const phase = state?.sys?.phase;
    // 派系选择阶段基地不可见，可以暖加载
    const isFactionSelect = phase === 'factionSelect';

    if (isFactionSelect) {
        return {
            critical: [...ALL_CARD_ATLAS_SET],
            warm: [...BASE_ATLAS_PATHS],
            phaseKey: 'factionSelect',
        };
    }

    // playing 及其他阶段（含教程）：基地立刻可见，必须预加载
    return {
        critical: [...ALL_CARD_ATLAS_SET, ...BASE_ATLAS_PATHS],
        warm: [],
        phaseKey: 'playing',
    };
};
