/**
 * 大杀四方 - 能力执行辅助函数
 *
 * 提供常用的能力效果生成器（消灭随从、移动随从、抽牌、额外出牌等）。
 * 所有函数返回事件数组，由 reducer 统一归约。
 */

import type { PlayerId } from '../../../engine/types';
import type {
    SmashUpCore,
    MinionOnBase,
    LimitModifiedEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    CardRecoveredFromDiscardEvent,
    HandShuffledIntoDeckEvent,
} from './types';
import { SU_EVENTS } from './types';

// ============================================================================
// 随从消灭
// ============================================================================

/** 生成消灭随从事件 */
export function destroyMinion(
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    ownerId: PlayerId,
    reason: string,
    now: number
): MinionDestroyedEvent {
    return {
        type: SU_EVENTS.MINION_DESTROYED,
        payload: { minionUid, minionDefId, fromBaseIndex, ownerId, reason },
        timestamp: now,
    };
}

// ============================================================================
// 随从移动
// ============================================================================

/** 生成移动随从事件 */
export function moveMinion(
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    toBaseIndex: number,
    reason: string,
    now: number
): MinionMovedEvent {
    return {
        type: SU_EVENTS.MINION_MOVED,
        payload: { minionUid, minionDefId, fromBaseIndex, toBaseIndex, reason },
        timestamp: now,
    };
}

// ============================================================================
// 力量指示物
// ============================================================================

/** 生成添加力量指示物事件 */
export function addPowerCounter(
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    now: number
): PowerCounterAddedEvent {
    return {
        type: SU_EVENTS.POWER_COUNTER_ADDED,
        payload: { minionUid, baseIndex, amount, reason },
        timestamp: now,
    };
}

/** 生成移除力量指示物事件 */
export function removePowerCounter(
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    now: number
): PowerCounterRemovedEvent {
    return {
        type: SU_EVENTS.POWER_COUNTER_REMOVED,
        payload: { minionUid, baseIndex, amount, reason },
        timestamp: now,
    };
}

// ============================================================================
// 额外出牌额度
// ============================================================================

/** 生成额外随从额度事件 */
export function grantExtraMinion(
    playerId: PlayerId,
    reason: string,
    now: number
): LimitModifiedEvent {
    return {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: { playerId, limitType: 'minion', delta: 1, reason },
        timestamp: now,
    };
}

/** 生成额外行动额度事件 */
export function grantExtraAction(
    playerId: PlayerId,
    reason: string,
    now: number
): LimitModifiedEvent {
    return {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: { playerId, limitType: 'action', delta: 1, reason },
        timestamp: now,
    };
}

// ============================================================================
// 查找辅助
// ============================================================================

/** 在所有基地中查找随从 */
export function findMinionOnBases(
    core: SmashUpCore,
    minionUid: string
): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (let i = 0; i < core.bases.length; i++) {
        const m = core.bases[i].minions.find(m => m.uid === minionUid);
        if (m) return { minion: m, baseIndex: i };
    }
    return undefined;
}

/** 获取基地上指定玩家的随从 */
export function getPlayerMinionsOnBase(
    core: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId
): MinionOnBase[] {
    const base = core.bases[baseIndex];
    if (!base) return [];
    return base.minions.filter(m => m.controller === playerId);
}

/** 获取基地上其他玩家的随从 */
export function getOpponentMinionsOnBase(
    core: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId
): MinionOnBase[] {
    const base = core.bases[baseIndex];
    if (!base) return [];
    return base.minions.filter(m => m.controller !== playerId);
}

// ============================================================================
// 弃牌堆操作
// ============================================================================

/** 生成从弃牌堆取回卡牌到手牌事件 */
export function recoverCardsFromDiscard(
    playerId: PlayerId,
    cardUids: string[],
    reason: string,
    now: number
): CardRecoveredFromDiscardEvent {
    return {
        type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
        payload: { playerId, cardUids, reason },
        timestamp: now,
    };
}

// ============================================================================
// 手牌/牌库操作
// ============================================================================

/** 生成手牌洗入牌库事件 */
export function shuffleHandIntoDeck(
    playerId: PlayerId,
    newDeckUids: string[],
    reason: string,
    now: number
): HandShuffledIntoDeckEvent {
    return {
        type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
        payload: { playerId, newDeckUids, reason },
        timestamp: now,
    };
}

// ============================================================================
// Me First! 响应窗口
// ============================================================================

import type { GameEvent } from '../../../engine/types';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import type { PromptOption as EnginePromptOption } from '../../../engine/types';
import type { PromptContinuationContext, PromptContinuationEvent } from './types';

// ============================================================================
// 疯狂牌库操作
// ============================================================================

import type { MadnessDrawnEvent, MadnessReturnedEvent } from './types';
import { MADNESS_CARD_DEF_ID, CTHULHU_EXPANSION_FACTIONS } from './types';

/**
 * 生成抽取疯狂卡事件
 * 
 * @param playerId 抽取玩家
 * @param count 抽取数量
 * @param state 当前游戏状态（用于检查牌库剩余和生成 UID）
 * @param reason 触发来源
 * @param now 时间戳
 * @returns 事件（如果疯狂牌库为空或不存在则返回 undefined）
 */
export function drawMadnessCards(
    playerId: PlayerId,
    count: number,
    state: SmashUpCore,
    reason: string,
    now: number
): MadnessDrawnEvent | undefined {
    if (!state.madnessDeck || state.madnessDeck.length === 0 || count <= 0) return undefined;
    const actualCount = Math.min(count, state.madnessDeck.length);
    // 生成唯一 UID（使用 nextUid 偏移，避免与玩家卡牌冲突）
    const cardUids: string[] = [];
    for (let i = 0; i < actualCount; i++) {
        cardUids.push(`madness_${state.nextUid + i}`);
    }
    return {
        type: SU_EVENTS.MADNESS_DRAWN,
        payload: { playerId, count: actualCount, cardUids, reason },
        timestamp: now,
    };
}

/**
 * 生成返回疯狂卡事件
 * 
 * @param playerId 返回玩家
 * @param cardUid 疯狂卡实例 UID
 * @param reason 触发来源
 * @param now 时间戳
 */
export function returnMadnessCard(
    playerId: PlayerId,
    cardUid: string,
    reason: string,
    now: number
): MadnessReturnedEvent {
    return {
        type: SU_EVENTS.MADNESS_RETURNED,
        payload: { playerId, cardUid, reason },
        timestamp: now,
    };
}

/** 检查游戏中是否有克苏鲁扩展派系（需要疯狂牌库） */
export function hasCthulhuExpansionFaction(players: Record<string, { factions: [string, string] }>): boolean {
    for (const player of Object.values(players)) {
        for (const f of player.factions) {
            if ((CTHULHU_EXPANSION_FACTIONS as readonly string[]).includes(f)) return true;
        }
    }
    return false;
}

/** 计算玩家持有的疯狂卡数量（手牌+牌库+弃牌堆） */
export function countMadnessCards(player: { hand: { defId: string }[]; deck: { defId: string }[]; discard: { defId: string }[] }): number {
    let count = 0;
    for (const c of player.hand) if (c.defId === MADNESS_CARD_DEF_ID) count++;
    for (const c of player.deck) if (c.defId === MADNESS_CARD_DEF_ID) count++;
    for (const c of player.discard) if (c.defId === MADNESS_CARD_DEF_ID) count++;
    return count;
}

/** 计算疯狂卡 VP 惩罚（每 2 张扣 1 VP） */
export function madnessVpPenalty(madnessCount: number): number {
    return Math.floor(madnessCount / 2);
}

/**
 * 生成 Me First! 响应窗口打开事件
 * 
 * 规则：从当前玩家开始顺时针轮流，每人可打 1 张特殊牌或让过。
 * 所有人连续让过时终止。
 * 
 * @param triggerContext 触发上下文描述（如 "基地记分前"）
 * @param currentPlayerId 当前玩家（响应从此玩家开始）
 * @param turnOrder 玩家回合顺序
 * @param now 时间戳
 */
export function openMeFirstWindow(
    triggerContext: string,
    currentPlayerId: PlayerId,
    turnOrder: PlayerId[],
    now: number
): GameEvent {
    // 构建响应者队列：从当前玩家开始顺时针
    const startIdx = turnOrder.indexOf(currentPlayerId);
    const responderQueue: PlayerId[] = [];
    for (let i = 0; i < turnOrder.length; i++) {
        responderQueue.push(turnOrder[(startIdx + i) % turnOrder.length]);
    }

    return {
        type: RESPONSE_WINDOW_EVENTS.OPENED,
        payload: {
            windowId: `meFirst_${triggerContext}_${now}`,
            responderQueue,
            windowType: 'meFirst' as const,
            sourceId: triggerContext,
        },
        timestamp: now,
    };
}


// ============================================================================
// Prompt 辅助函数（目标选择）
// ============================================================================

/**
 * 生成 Prompt 继续上下文设置事件
 * 
 * 当能力需要目标选择时，先生成此事件将继续上下文存入 core 状态，
 * 然后通过 queuePrompt 创建引擎层 Prompt。
 * Prompt 解决后，FlowHooks 读取 pendingPromptContinuation 并执行继续逻辑。
 */
export function setPromptContinuation(
    continuation: PromptContinuationContext,
    now: number
): PromptContinuationEvent {
    return {
        type: SU_EVENTS.PROMPT_CONTINUATION,
        payload: { action: 'set', continuation },
        timestamp: now,
    };
}

/** 生成清除 Prompt 继续上下文事件 */
export function clearPromptContinuation(
    now: number
): PromptContinuationEvent {
    return {
        type: SU_EVENTS.PROMPT_CONTINUATION,
        payload: { action: 'clear' },
        timestamp: now,
    };
}

/**
 * 构建随从目标选择的 Prompt 选项
 * 
 * @param candidates 候选随从列表（含基地索引）
 * @returns 引擎层 PromptOption 数组
 */
export function buildMinionTargetOptions(
    candidates: { uid: string; defId: string; baseIndex: number; label: string }[]
): EnginePromptOption<{ minionUid: string; baseIndex: number }>[] {
    return candidates.map((c, i) => ({
        id: `minion-${i}`,
        label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex },
    }));
}

/**
 * 构建基地目标选择的 Prompt 选项
 * 
 * @param candidates 候选基地列表
 * @returns 引擎层 PromptOption 数组
 */
export function buildBaseTargetOptions(
    candidates: { baseIndex: number; label: string }[]
): EnginePromptOption<{ baseIndex: number }>[] {
    return candidates.map((c, i) => ({
        id: `base-${i}`,
        label: c.label,
        value: { baseIndex: c.baseIndex },
    }));
}
