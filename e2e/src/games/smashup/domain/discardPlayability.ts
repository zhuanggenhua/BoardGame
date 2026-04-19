/**
 * 大杀四方 - 弃牌堆出牌能力查询
 *
 * 通用模块：检查弃牌堆中哪些卡可以被打出、到哪些基地、消耗什么额度。
 * 所有"从弃牌堆打出随从"的能力统一通过此模块注册和查询。
 *
 * 设计原则：
 * - 数据驱动：每种弃牌堆出牌能力注册一个 DiscardPlayProvider
 * - 纯函数查询：不持有可变状态，每次查询传入当前 core
 * - 通用消费：validate / execute / reduce / UI 统一使用
 */

import type { PlayerId } from '../../../engine/types';
import type { SmashUpCore, CardInstance } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/** 弃牌堆中一张可打出的卡的信息 */
export interface DiscardPlayOption {
    /** 卡牌实例 */
    card: CardInstance;
    /** 可打出到的基地索引列表（空数组 = 所有基地） */
    allowedBaseIndices: number[] | 'all';
    /** 是否消耗正常随从额度（false = 额外打出，不消耗） */
    consumesNormalLimit: boolean;
    /** 来源能力 ID（用于 UI 提示和每回合限制追踪） */
    sourceId: string;
    /** 卡牌定义信息（便于 UI 展示） */
    defId: string;
    power: number;
    name: string;
}

/** 弃牌堆出牌能力提供者 */
export interface DiscardPlayProvider {
    /** 能力 ID（唯一标识） */
    id: string;
    /**
     * 检查该能力是否对指定玩家激活，返回可打出的卡牌列表。
     * 返回空数组表示当前不可用。
     */
    getPlayableCards(core: SmashUpCore, playerId: PlayerId): DiscardPlayOption[];
}

// ============================================================================
// 注册表
// ============================================================================

const providers: DiscardPlayProvider[] = [];

/** 注册一个弃牌堆出牌能力提供者 */
export function registerDiscardPlayProvider(provider: DiscardPlayProvider): void {
    // 幂等：同 id 不重复注册
    if (providers.some(p => p.id === provider.id)) return;
    providers.push(provider);
}

/** 清空注册表（测试用） */
export function clearDiscardPlayProviders(): void {
    providers.length = 0;
}

// ============================================================================
// 查询 API
// ============================================================================

/**
 * 查询指定玩家弃牌堆中所有可打出的卡牌
 *
 * 合并所有 provider 的结果。同一张卡可能被多个 provider 提供（取第一个）。
 */
export function getDiscardPlayOptions(core: SmashUpCore, playerId: PlayerId): DiscardPlayOption[] {
    const result: DiscardPlayOption[] = [];
    const seenUids = new Set<string>();
    for (const provider of providers) {
        const options = provider.getPlayableCards(core, playerId);
        for (const opt of options) {
            if (seenUids.has(opt.card.uid)) continue;
            seenUids.add(opt.card.uid);
            result.push(opt);
        }
    }
    return result;
}

/**
 * 检查指定卡牌是否可以从弃牌堆打出到指定基地
 *
 * 用于 validate 层快速校验。
 */
export function canPlayFromDiscard(
    core: SmashUpCore,
    playerId: PlayerId,
    cardUid: string,
    baseIndex: number,
): { allowed: boolean; consumesNormalLimit: boolean; sourceId: string } | null {
    const options = getDiscardPlayOptions(core, playerId);
    const opt = options.find(o => o.card.uid === cardUid);
    if (!opt) return null;
    if (opt.allowedBaseIndices !== 'all' && !opt.allowedBaseIndices.includes(baseIndex)) return null;
    return { allowed: true, consumesNormalLimit: opt.consumesNormalLimit, sourceId: opt.sourceId };
}

/**
 * 检查弃牌堆是否有任何可打出的卡（UI 用，快速判断是否显示指示器）
 */
export function hasAnyDiscardPlayable(core: SmashUpCore, playerId: PlayerId): boolean {
    for (const provider of providers) {
        if (provider.getPlayableCards(core, playerId).length > 0) return true;
    }
    return false;
}
