import type { PlayerId, RandomFn } from '../../../engine/types';
import type { CardInstance, PlayerState, SmashUpCore, MinionOnBase } from './types';
import { getBaseDef, getFactionCards } from '../data/cards';

// ============================================================================
// 玩家显示名
// ============================================================================

/** 玩家编号→友好显示名映射（支持 2-4 人） */
const PLAYER_LABELS = ['一', '二', '三', '四'];

/** 获取玩家友好显示名（如"玩家一"、"玩家二"） */
export function getPlayerLabel(pid: PlayerId): string {
    const idx = typeof pid === 'number' ? pid : parseInt(pid, 10);
    return `玩家${PLAYER_LABELS[idx] ?? (idx + 1)}`;
}

/** 获取对手友好显示名（如"对手一"） */
export function getOpponentLabel(pid: PlayerId): string {
    const idx = typeof pid === 'number' ? pid : parseInt(pid, 10);
    return `对手${PLAYER_LABELS[idx] ?? (idx + 1)}`;
}

/**
 * 检查 defId 是否匹配指定基础版 ID（包含对应的 `_pod` 版本）
 *
 * 用于 POD 自动映射后的运行时判断，避免注册成功但执行阶段仍只识别基础版。
 */
export function matchesDefId(defId: string | undefined | null, baseDefId: string): boolean {
    return defId === baseDefId || defId === `${baseDefId}_pod`;
}

/**
 * 判断同名额外随从额度对当前卡是否可用。
 *
 * - 没有同名额度 → false
 * - 尚未锁定 defId → 任意随从都可使用，首次使用时再锁定
 * - 已锁定 defId → 只有同名随从可使用
 */
export function canUseSameNameMinionQuota(
    player: PlayerState | undefined,
    cardDefId: string | undefined,
): boolean {
    if (!player || !cardDefId) return false;
    const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
    if (sameNameRemaining <= 0) return false;
    return player.sameNameMinionDefId === null
        || player.sameNameMinionDefId === undefined
        || player.sameNameMinionDefId === cardDefId;
}

/**
 * 判断当前卡能否消耗指定基地的基地限定额外随从额度。
 *
 * 会同时检查：
 * - 该基地是否仍有额度
 * - 基地限定同名约束是否满足
 * - 基地定义上的额外随从力量限制是否满足（如神秘花园）
 */
export function canUseBaseLimitedMinionQuota(
    state: SmashUpCore,
    player: PlayerState | undefined,
    baseIndex: number,
    cardDefId: string | undefined,
    basePower?: number,
): boolean {
    if (!player) return false;
    const quota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
    if (quota <= 0) return false;
    if (player.baseLimitedSameNameRequired?.[baseIndex]) {
        const requiredDefId = player.baseLimitedSameNameDefId?.[baseIndex];
        if (requiredDefId && cardDefId !== requiredDefId) return false;
    }
    const baseDefId = state.bases[baseIndex]?.defId;
    const baseDef = baseDefId ? getBaseDef(baseDefId) : undefined;
    const basePowerLimit = baseDef?.restrictions?.find(
        restriction => restriction.type === 'play_minion' && restriction.condition?.extraPlayMinionPowerMax !== undefined,
    )?.condition?.extraPlayMinionPowerMax;
    if (basePowerLimit !== undefined && basePower !== undefined && basePower > basePowerLimit) {
        return false;
    }
    return true;
}

/**
 * 判断这次打出是否“只能”消耗指定基地的基地限定随从额度。
 *
 * 只要玩家还存在其他可用额度（通用额度 / 同名额度），就不应把这次打出
 * 视为在消耗基地限定额度；只有没有其他可用额度，且该基地仍有额度时，
 * 才算“被迫使用基地限定额度”。
 */
export function mustUseBaseLimitedMinionQuota(
    state: SmashUpCore,
    player: PlayerState | undefined,
    baseIndex: number,
    cardDefId: string | undefined,
    basePower?: number,
): boolean {
    void state;
    void basePower;
    if (!player) return false;
    const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
    if (globalQuotaRemaining > 0) return false;
    if (canUseSameNameMinionQuota(player, cardDefId)) return false;
    const quota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
    return quota > 0;
}

/** 获取当前剩余的全局受限额外随从额度列表。 */
export function getRemainingGlobalPowerLimitedMinionQuotas(player: PlayerState | undefined): number[] {
    if (!player) return [];
    if (player.extraMinionPowerCaps && player.extraMinionPowerCaps.length > 0) {
        return [...player.extraMinionPowerCaps];
    }
    if (player.extraMinionPowerMax !== undefined) {
        const globalQuotaRemaining = Math.max(0, player.minionLimit - player.minionsPlayed);
        return Array.from({ length: globalQuotaRemaining }, () => player.extraMinionPowerMax!);
    }
    return [];
}

/** 获取当前剩余的全局“不限力量”的额外随从额度数量。 */
export function getRemainingUnrestrictedGlobalMinionQuota(
    player: PlayerState | undefined,
): number {
    if (!player) return 0;
    const globalQuotaRemaining = Math.max(0, player.minionLimit - player.minionsPlayed);
    const restrictedQuotaCount = getRemainingGlobalPowerLimitedMinionQuotas(player).length;
    return Math.max(0, globalQuotaRemaining - restrictedQuotaCount);
}

/** 获取当前卡可用的最严格全局受限额外随从额度（用于优先消耗受限额度）。 */
export function getBestMatchingGlobalPowerLimitedQuota(
    player: PlayerState | undefined,
    basePower: number,
): number | undefined {
    const candidates = getRemainingGlobalPowerLimitedMinionQuotas(player)
        .filter(powerCap => basePower <= powerCap)
        .sort((a, b) => a - b);
    return candidates[0];
}

/** 获取当前剩余全局受限额外随从额度中最宽松的力量上限（用于错误提示）。 */
export function getMaxRemainingGlobalPowerLimitedQuota(
    player: PlayerState | undefined,
): number | undefined {
    const quotas = getRemainingGlobalPowerLimitedMinionQuotas(player);
    if (quotas.length === 0) return undefined;
    return Math.max(...quotas);
}

/**
 * 判断当前打出是否“只能”消耗全局受限额外随从额度。
 *
 * 若还存在其他可用路径（不限力量的全局额度 / 同名额度 / 当前基地可用的基地额度），
 * 就不应该对这次打出强制施加全局力量上限。
 */
export function mustUseGlobalPowerLimitedMinionQuota(
    state: SmashUpCore,
    player: PlayerState | undefined,
    baseIndex: number,
    cardDefId: string | undefined,
    basePower?: number,
): boolean {
    if (!player) return false;
    const restrictedQuotas = getRemainingGlobalPowerLimitedMinionQuotas(player);
    if (restrictedQuotas.length === 0) return false;
    const globalQuotaRemaining = Math.max(0, player.minionLimit - player.minionsPlayed);
    if (globalQuotaRemaining <= 0) return false;
    if (getRemainingUnrestrictedGlobalMinionQuota(player) > 0) return false;
    if (canUseSameNameMinionQuota(player, cardDefId)) return false;
    if (canUseBaseLimitedMinionQuota(state, player, baseIndex, cardDefId, basePower)) return false;
    return true;
}

// ============================================================================
// 微型机判断
// ============================================================================

/** 微型机 defId 集合（原始定义） */
export const MICROBOT_DEF_IDS = new Set([
    'robot_microbot_guard', 'robot_microbot_fixer', 'robot_microbot_reclaimer',
    'robot_microbot_archive', 'robot_microbot_alpha',
]);

/**
 * 判断一个随从是否算作微型机
 *
 * 规则：robot_microbot_alpha 的持续效果"你的所有随从均视为微型机"
 * - alpha 在场时，同控制者的所有随从都算微型机
 * - alpha 不在场时，只有原始微型机 defId 才算
 */
export function isMicrobot(state: SmashUpCore, minion: MinionOnBase): boolean {
    if (Array.from(MICROBOT_DEF_IDS).some(defId => matchesDefId(minion.defId, defId))) return true;
    // 检查同控制者的 alpha 是否在场
    for (const base of state.bases) {
        if (base.minions.some(m => matchesDefId(m.defId, 'robot_microbot_alpha') && m.controller === minion.controller)) {
            return true;
        }
    }
    return false;
}

/**
 * 判断一个弃牌堆中的卡是否算作微型机（用于回收等场景）
 * alpha 在场时所有己方随从卡都算微型机
 */
export function isDiscardMicrobot(state: SmashUpCore, card: CardInstance, playerId: PlayerId): boolean {
    if (card.type !== 'minion') return false;
    if (Array.from(MICROBOT_DEF_IDS).some(defId => matchesDefId(card.defId, defId))) return true;
    // 检查该玩家的 alpha 是否在场
    for (const base of state.bases) {
        if (base.minions.some(m => matchesDefId(m.defId, 'robot_microbot_alpha') && m.controller === playerId)) {
            return true;
        }
    }
    return false;
}

/** 将派系卡牌定义展开为卡牌实例列表 */
export function buildDeck(
    factions: [string, string],
    owner: PlayerId,
    startUid: number,
    random: RandomFn
): { deck: CardInstance[]; nextUid: number } {
    const cards: CardInstance[] = [];
    let uid = startUid;
    for (const factionId of factions) {
        const defs = getFactionCards(factionId);
        for (const def of defs) {
            for (let i = 0; i < def.count; i++) {
                cards.push({
                    uid: `c${uid++}`,
                    defId: def.id,
                    type: def.type,
                    owner,
                });
            }
        }
    }
    return { deck: random.shuffle(cards), nextUid: uid };
}

/** 从牌库顶部抽牌 */
export function drawCards(
    player: PlayerState,
    count: number,
    random: RandomFn
): {
    hand: CardInstance[];
    deck: CardInstance[];
    discard: CardInstance[];
    drawnUids: string[];
    reshuffledDeckUids?: string[];
} {
    let deck = [...player.deck];
    let discard = [...player.discard];
    const drawn: CardInstance[] = [];
    let reshuffledDeckUids: string[] | undefined;

    for (let i = 0; i < count; i++) {
        if (deck.length === 0 && discard.length > 0) {
            deck = random.shuffle([...discard]);
            discard = [];
            if (!reshuffledDeckUids) {
                reshuffledDeckUids = deck.map(card => card.uid);
            }
        }
        if (deck.length === 0) break;
        drawn.push(deck[0]);
        deck = deck.slice(1);
    }

    return {
        hand: [...player.hand, ...drawn],
        deck,
        discard,
        drawnUids: drawn.map(c => c.uid),
        reshuffledDeckUids,
    };
}
