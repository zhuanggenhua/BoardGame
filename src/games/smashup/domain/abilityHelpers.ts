/**
 * 大杀四方 - 能力执行辅助函数
 *
 * 提供常用的能力效果生成器（消灭随从、移动随从、抽牌、额外出牌等）。
 * 所有函数返回事件数组，由 reducer 统一归约。
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type {
    PromptOption as EnginePromptOption,
    SimpleChoiceConfig,
    SimpleChoiceTargetType,
} from '../../../engine/systems/InteractionSystem';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { AbilityContext, AbilityResult } from './abilityRegistry';
import { resolveOnPlay } from './abilityRegistry';
import { isMinionProtected, isMinionProtectedNonConsumable, type ProtectionType } from './ongoingEffects';
import { collectBaseAbilityTriggers } from './baseAbilityQueue';
import { resolveLiveBaseIndex } from './utils';
import type {
    SmashUpCore,
    MinionOnBase,
    MinionPlayedEvent,
    LimitModifiedEvent,
    MinionReturnedEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    MinionControlChangedEvent,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    CardRecoveredFromDiscardEvent,
    HandShuffledIntoDeckEvent,
    TempPowerAddedEvent,
    PermanentPowerAddedEvent,
    BreakpointModifiedEvent,
    BaseDeckShuffledEvent,
    RevealHandEvent,
    RevealDeckTopEvent,
    DeckInspectedEvent,
    CardInstance,
    SmashUpEvent,
    CardsDrawnEvent,
    DeckReorderedEvent,
    AbilityFeedbackEvent,
    OngoingCardCounterChangedEvent,
    CardToDeckBottomEvent,
    TitanState,
    TitanPlayedEvent,
    TitanMovedEvent,
    TitanRemovedFromPlayEvent,
    TitanPowerCounterAddedEvent,
    TitanPowerCounterRemovedEvent,
    TitanPlayAsKind,
} from './types';
import { SU_EVENT_TYPES as SU_EVENTS } from './events';
import { getEffectivePower } from './ongoingModifiers';
import { triggerAllBaseAbilities } from './baseAbilities';
import { collectTriggers, fireTriggers } from './ongoingEffects';
import { getMinionDef, getTitanDef } from '../data/cards';
import { drawCards } from './utils';

// ============================================================================
// 交互选项工厂函数
// ============================================================================

/**
 * 创建标准 skip 选项
 * 
 * 用于"你可以"类可选效果，提供统一的跳过选项格式。
 * 
 * @param label 按钮文本，默认"跳过"
 * @returns 标准格式的 skip 选项（{ skip: true } + displayMode: 'button'）
 * 
 * @example
 * ```typescript
 * const options = [
 *     createSkipOption(),  // 默认"跳过"
 *     ...minionOptions
 * ];
 * 
 * const options2 = [
 *     createSkipOption('跳过（不消灭随从）'),  // 自定义文本
 *     ...minionOptions
 * ];
 * ```
 */
export function createSkipOption(label: string = '跳过'): EnginePromptOption<{ skip: true }> {
    return {
        id: 'skip',
        label,
        value: { skip: true },
        displayMode: 'button'
    };
}

// ============================================================================
// 力量计算便捷函数
// ============================================================================

/**
 * 获取随从的有效力量（含持续修正）
 * 
 * 能力函数中所有力量比较/判断必须使用此函数，禁止直接 basePower + powerModifier。
 */
export function getMinionPower(state: SmashUpCore, minion: MinionOnBase, baseIndex: number): number {
    return getEffectivePower(state, minion, baseIndex);
}

// ============================================================================
// 随从消灭
// ============================================================================

/** 生成消灭随从事件 */
export function destroyMinion(
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    ownerId: PlayerId,
    destroyerId: PlayerId | undefined,
    reason: string,
    now: number
): MinionDestroyedEvent {
    return {
        type: SU_EVENTS.MINION_DESTROYED,
        payload: { minionUid, minionDefId, fromBaseIndex, ownerId, destroyerId, reason },
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
    now: number,
    toBaseDefId?: string,
): MinionMovedEvent {
    return {
        type: SU_EVENTS.MINION_MOVED,
        payload: { minionUid, minionDefId, fromBaseIndex, toBaseIndex, ...(toBaseDefId ? { toBaseDefId } : {}), reason },
        timestamp: now,
    };
}

/** 生成随从控制权变更事件 */
export function changeMinionController(
    minionUid: string,
    minionDefId: string,
    baseIndex: number,
    ownerId: PlayerId,
    fromControllerId: PlayerId,
    toControllerId: PlayerId,
    sourcePlayerId: PlayerId,
    reason: string,
    now: number,
): MinionControlChangedEvent {
    return {
        type: SU_EVENTS.MINION_CONTROL_CHANGED,
        payload: {
            minionUid,
            minionDefId,
            baseIndex,
            ownerId,
            fromControllerId,
            toControllerId,
            sourcePlayerId,
            reason,
        },
        timestamp: now,
    };
}

// ============================================================================
// 泰坦
// ============================================================================

export function getAllTitans(state: SmashUpCore): TitanState[] {
    return state.titans ?? [];
}

export function getTitansOnBase(state: SmashUpCore, baseIndex: number): TitanState[] {
    return getAllTitans(state).filter(
        titan => titan.location.zone === 'base' && titan.location.baseIndex === baseIndex,
    );
}

export function getTitanByUid(state: SmashUpCore, titanUid: string): TitanState | undefined {
    return getAllTitans(state).find(titan => titan.uid === titanUid);
}

export function getTitanByController(state: SmashUpCore, controllerId: PlayerId): TitanState | undefined {
    return getAllTitans(state).find(
        titan => titan.controllerId === controllerId && titan.location.zone === 'base',
    );
}

export function getSetAsideTitansPlayableAs(
    state: SmashUpCore,
    playerId: PlayerId,
    playKind: TitanPlayAsKind,
): TitanState[] {
    if (getTitanByController(state, playerId)) return [];
    return getAllTitans(state).filter((titan) => {
        if (titan.ownerId !== playerId || titan.location.zone !== 'setaside') return false;
        const titanDef = getTitanDef(titan.defId);
        return !!titanDef?.playAsKinds?.includes(playKind);
    });
}

export function playTitan(
    titan: TitanState,
    controllerId: PlayerId,
    baseIndex: number,
    reason: string,
    now: number,
    baseDefId?: string,
    consumesRegularPlayKinds?: TitanPlayAsKind | TitanPlayAsKind[],
): TitanPlayedEvent {
    const normalizedKinds = Array.isArray(consumesRegularPlayKinds)
        ? consumesRegularPlayKinds
        : consumesRegularPlayKinds
            ? [consumesRegularPlayKinds]
            : [];

    return {
        type: SU_EVENTS.TITAN_PLAYED,
        payload: {
            titanUid: titan.uid,
            defId: titan.defId,
            ownerId: titan.ownerId,
            controllerId,
            baseIndex,
            ...(baseDefId ? { baseDefId } : {}),
            ...(normalizedKinds.length === 1 ? { consumesRegularPlayKind: normalizedKinds[0] } : {}),
            ...(normalizedKinds.length > 1 ? { consumesRegularPlayKinds: normalizedKinds } : {}),
            reason,
        },
        timestamp: now,
    };
}

export function moveTitan(
    titanUid: string,
    defId: string,
    fromBaseIndex: number,
    toBaseIndex: number,
    reason: string,
    now: number,
    toBaseDefId?: string,
): TitanMovedEvent {
    return {
        type: SU_EVENTS.TITAN_MOVED,
        payload: {
            titanUid,
            defId,
            fromBaseIndex,
            toBaseIndex,
            ...(toBaseDefId ? { toBaseDefId } : {}),
            reason,
        },
        timestamp: now,
    };
}

export function removeTitanFromPlay(
    titan: TitanState,
    reason: string,
    now: number,
): TitanRemovedFromPlayEvent {
    return {
        type: SU_EVENTS.TITAN_REMOVED_FROM_PLAY,
        payload: {
            titanUid: titan.uid,
            defId: titan.defId,
            ownerId: titan.ownerId,
            controllerId: titan.controllerId,
            ...(titan.location.zone === 'base' ? { fromBaseIndex: titan.location.baseIndex } : {}),
            reason,
        },
        timestamp: now,
    };
}

export function addTitanPowerCounter(
    titanUid: string,
    amount: number,
    reason: string,
    now: number,
): TitanPowerCounterAddedEvent {
    return {
        type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
        payload: { titanUid, amount, reason },
        timestamp: now,
    };
}

export function removeTitanPowerCounter(
    titanUid: string,
    amount: number,
    reason: string,
    now: number,
): TitanPowerCounterRemovedEvent {
    return {
        type: SU_EVENTS.TITAN_POWER_COUNTER_REMOVED,
        payload: { titanUid, amount, reason },
        timestamp: now,
    };
}

export function buildValidatedMoveEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
        toBaseDefId?: string;
        reason: string;
        now: number;
    },
): MinionMovedEvent[] {
    const core = 'core' in state ? state.core : state;
    const sourceBase = core.bases[params.fromBaseIndex];
    if (!sourceBase) return [];
    const resolvedToBaseIndex = resolveLiveBaseIndex(core, params.toBaseIndex, params.toBaseDefId) ?? params.toBaseIndex;
    const targetBase = core.bases[resolvedToBaseIndex];
    if (!targetBase) return [];

    const minion = sourceBase.minions.find(candidate => candidate.uid === params.minionUid);
    if (!minion) return [];

    return [
        moveMinion(
            params.minionUid,
            minion.defId ?? params.minionDefId,
            params.fromBaseIndex,
            resolvedToBaseIndex,
            params.reason,
            params.now,
            params.toBaseDefId,
        ),
    ];
}

export function findMinionOnBase(
    state: SmashUpCore | MatchState<SmashUpCore>,
    baseIndex: number,
    minionUid: string,
): MinionOnBase | undefined {
    const core = 'core' in state ? state.core : state;
    const base = core.bases[baseIndex];
    if (!base) return undefined;
    return base.minions.find(candidate => candidate.uid === minionUid);
}

export function buildValidatedDestroyEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        destroyerId?: PlayerId;
        reason: string;
        now: number;
    },
): MinionDestroyedEvent[] {
    const minion = findMinionOnBase(state, params.fromBaseIndex, params.minionUid);
    if (!minion) return [];

    return [
        destroyMinion(
            params.minionUid,
            minion.defId ?? params.minionDefId,
            params.fromBaseIndex,
            minion.owner,
            params.destroyerId,
            params.reason,
            params.now,
        ),
    ];
}

export function buildValidatedReturnEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toPlayerId?: PlayerId;
        reason: string;
        now: number;
        sourcePlayerId?: PlayerId;
    },
): MinionReturnedEvent[] {
    const minion = findMinionOnBase(state, params.fromBaseIndex, params.minionUid);
    if (!minion) return [];

    return [{
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
            minionUid: params.minionUid,
            minionDefId: minion.defId ?? params.minionDefId,
            fromBaseIndex: params.fromBaseIndex,
            toPlayerId: params.toPlayerId ?? minion.owner,
            reason: params.reason,
            ...(params.sourcePlayerId !== undefined ? { sourcePlayerId: params.sourcePlayerId } : {}),
        },
        timestamp: params.now,
    }];
}

export function buildValidatedCardToDeckBottomEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        reason: string;
        now: number;
        expectedLocation?: 'discard' | 'hand' | 'deck' | 'bases' | 'any';
    },
): CardToDeckBottomEvent[] {
    const core = 'core' in state ? state.core : state;
    const owner = core.players[params.ownerId];
    if (!owner) return [];

    const exists = (() => {
        switch (params.expectedLocation ?? 'any') {
            case 'discard':
                return owner.discard.some(card => card.uid === params.cardUid);
            case 'hand':
                return owner.hand.some(card => card.uid === params.cardUid);
            case 'deck':
                return owner.deck.some(card => card.uid === params.cardUid);
            case 'bases':
                return core.bases.some(
                    base => base.minions.some(minion => minion.uid === params.cardUid)
                        || base.ongoingActions.some(action => action.uid === params.cardUid),
                );
            case 'any':
            default:
                return owner.hand.some(card => card.uid === params.cardUid)
                    || owner.deck.some(card => card.uid === params.cardUid)
                    || owner.discard.some(card => card.uid === params.cardUid)
                    || core.bases.some(
                        base => base.minions.some(minion => minion.uid === params.cardUid)
                            || base.ongoingActions.some(action => action.uid === params.cardUid),
                    );
        }
    })();

    if (!exists) return [];

    return [{
        type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
        payload: {
            cardUid: params.cardUid,
            defId: params.defId,
            ownerId: params.ownerId,
            reason: params.reason,
        },
        timestamp: params.now,
    }];
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

/** 生成 ongoing 卡力量指示物变化事件（如 vampire_summon_wolves） */
export function addOngoingCardCounter(
    cardUid: string,
    baseIndex: number,
    delta: number,
    reason: string,
    now: number
): OngoingCardCounterChangedEvent {
    return {
        type: SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED,
        payload: { cardUid, baseIndex, delta, reason },
        timestamp: now,
    };
}

/** 队列化随从打出后效果（如打出后自动+1指示物），在 fireMinionPlayedTriggers 中消费 */
export function queueMinionPlayEffect(
    playerId: PlayerId,
    effect: 'addPowerCounter',
    amount: number,
    now: number
): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_PLAY_EFFECT_QUEUED,
        payload: { playerId, effect, amount },
        timestamp: now,
    } as unknown as SmashUpEvent;
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

/** 生成临时力量修正事件（回合结束自动清零） */
export function addTempPower(
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    now: number
): TempPowerAddedEvent {
    return {
        type: SU_EVENTS.TEMP_POWER_ADDED,
        payload: { minionUid, baseIndex, amount, reason },
        timestamp: now,
    };
}

/** 生成永久力量修正事件（非指示物，不可移动/转移） */
export function addPermanentPower(
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    now: number
): PermanentPowerAddedEvent {
    return {
        type: SU_EVENTS.PERMANENT_POWER_ADDED,
        payload: { minionUid, baseIndex, amount, reason },
        timestamp: now,
    };
}

/** 生成临界点临时修正事件（回合结束自动清零） */
export function modifyBreakpoint(
    baseIndex: number,
    delta: number,
    reason: string,
    now: number
): BreakpointModifiedEvent {
    return {
        type: SU_EVENTS.BREAKPOINT_MODIFIED,
        payload: { baseIndex, delta, reason },
        timestamp: now,
    };
}

/** 生成基地牌库洗混事件 */
export function shuffleBaseDeck(
    newBaseDeckDefIds: string[],
    reason: string,
    now: number
): BaseDeckShuffledEvent {
    return {
        type: SU_EVENTS.BASE_DECK_SHUFFLED,
        payload: { newBaseDeckDefIds, reason },
        timestamp: now,
    };
}

/** 生成展示手牌事件 */
export function revealHand(
    targetPlayerId: PlayerId | PlayerId[],
    viewerPlayerId: PlayerId,
    cards: { uid: string; defId: string }[],
    reason: string,
    now: number,
    sourcePlayerId?: PlayerId,
): RevealHandEvent {
    return {
        type: SU_EVENTS.REVEAL_HAND,
        payload: { targetPlayerId, viewerPlayerId, cards, reason, sourcePlayerId },
        timestamp: now,
    };
}

/** 生成展示牌库顶事件 */
export function revealDeckTop(
    targetPlayerId: PlayerId | PlayerId[],
    viewerPlayerId: PlayerId | 'all',
    cards: { uid: string; defId: string }[],
    count: number,
    reason: string,
    now: number,
    sourcePlayerId?: PlayerId,
): RevealDeckTopEvent {
    return {
        type: SU_EVENTS.REVEAL_DECK_TOP,
        payload: { targetPlayerId, viewerPlayerId, cards, count, reason, sourcePlayerId },
        timestamp: now,
    };
}

/** 生成牌库被查看 / 展示 / 检索的统一见证事件 */
export function inspectDeck(
    targetPlayerId: PlayerId | PlayerId[],
    inspectorPlayerId: PlayerId,
    count: number,
    reason: string,
    now: number,
): DeckInspectedEvent {
    return {
        type: SU_EVENTS.DECK_INSPECTED,
        payload: { targetPlayerId, inspectorPlayerId, count, reason },
        timestamp: now,
    };
}

// ============================================================================
// 牌库顶翻牌通用 helper
// ============================================================================

export function revealAndPickFromDeck(params: {
    /** 完整游戏状态，用于访问牌库 + 弃牌堆并支持洗牌 */
    state: SmashUpCore;
    /** 随机函数（用于弃牌堆洗入牌库时的随机顺序） */
    random: RandomFn;
    /** 进行翻牌/搜索的玩家 */
    playerId: PlayerId;
    /**
     * 翻多少张（不传 = 搜索模式：逐张翻直到找到 maxPick 张满足条件的卡，
     * 在牌库见底且弃牌堆非空时，会将弃牌堆洗入牌库继续搜索）
     */
    count?: number;
    /** 筛选条件：返回 true 的卡被"命中" */
    predicate: (card: CardInstance) => boolean;
    /** 最多拿几张命中的卡 */
    maxPick: number;
    /** 未命中的卡去哪（默认 deck_bottom） */
    missTarget?: 'deck_bottom' | 'deck_top';
    /** 展示给谁：'all' = 所有人，'none' = 不展示，PlayerId = 指定玩家（默认 'none'） */
    revealTo?: PlayerId | 'all' | 'none';
    /** 触发来源（用于事件 reason 字段） */
    reason: string;
    now: number;
}): { events: SmashUpEvent[]; picked: CardInstance[]; missed: CardInstance[] } {
    const { state, random, playerId, predicate, maxPick, reason, now } = params;
    const missTarget = params.missTarget ?? 'deck_bottom';
    const revealTo = params.revealTo ?? 'none';

    const player = state.players[playerId];
    if (!player) return { events: [], picked: [], missed: [] };

    // 使用本地模拟的牌库/弃牌堆数组，按照"需要翻牌/搜索时若牌库为空则洗弃牌堆"的规则处理。
    let deckSim = [...player.deck];
    let discardSim = [...player.discard];
    const picked: CardInstance[] = [];
    const missed: CardInstance[] = [];
    const revealed: CardInstance[] = [];

    if (params.count !== undefined) {
        // 固定数量模式：翻 count 张
        const targetCount = params.count;
        while (revealed.length < targetCount) {
            if (deckSim.length === 0) {
                if (discardSim.length === 0) break;
                deckSim = random.shuffle([...discardSim]);
                discardSim = [];
            }
            if (deckSim.length === 0) break;
            const card = deckSim[0];
            deckSim = deckSim.slice(1);
            revealed.push(card);
            if (predicate(card) && picked.length < maxPick) {
                picked.push(card);
            } else {
                missed.push(card);
            }
        }
    } else {
        // 搜索模式：逐张翻直到找到 maxPick 张
        while (picked.length < maxPick) {
            if (deckSim.length === 0) {
                if (discardSim.length === 0) break;
                deckSim = random.shuffle([...discardSim]);
                discardSim = [];
            }
            if (deckSim.length === 0) break;
            const card = deckSim[0];
            deckSim = deckSim.slice(1);
            revealed.push(card);
            if (predicate(card)) {
                picked.push(card);
            } else {
                missed.push(card);
            }
        }
    }

    if (revealed.length === 0) {
        return { events: [], picked: [], missed: [] };
    }

    const events: SmashUpEvent[] = [inspectDeck(playerId, playerId, revealed.length, reason, now)];

    // 1. 展示事件（仅当 revealTo 不为 'none' 时生成）
    if (revealTo !== 'none') {
        const revealEvent = revealDeckTop(
            playerId, revealTo,
            revealed.map(c => ({ uid: c.uid, defId: c.defId })),
            revealed.length, reason, now, playerId,
        );
        events.push(revealEvent);
    }

    // 2. 重排牌库：根据模拟后的 deckSim + missed，为 reducer 提供新的牌库顺序
    const remaining = deckSim;
    const deckOrderBeforeDraw =
        missTarget === 'deck_bottom'
            ? [...remaining, ...picked, ...missed]
            : [...missed, ...picked, ...remaining];

    if (deckOrderBeforeDraw.length > 0) {
        const deckReorderEvt: DeckReorderedEvent = {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: deckOrderBeforeDraw.map(c => c.uid),
            },
            timestamp: now,
        };
        events.push(deckReorderEvt);
    }

    // 3. 命中的卡放入手牌
    if (picked.length > 0) {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: picked.length, cardUids: picked.map(c => c.uid) },
            timestamp: now,
        } as CardsDrawnEvent);
    }

    return { events, picked, missed };
}

/**
 * 查看牌库顶1张并展示给指定观察者
 *
 * 用于 wizardNeophyte / robotHoverbot / zombieWalker 等"看1张"类技能。
 * 自动生成 REVEAL_DECK_TOP 事件。
 *
 * @returns 牌库顶卡牌 + 展示事件（牌库为空返回 undefined）
 */
export function peekDeckTop(
    state: SmashUpCore,
    random: RandomFn,
    playerId: PlayerId,
    /** 展示给谁：'all' = 所有玩家，playerId = 仅自己，'none' = 仅记私有查看 */
    revealTo: PlayerId | 'all' | 'none',
    reason: string,
    now: number,
    inspectorPlayerId: PlayerId = playerId,
): { card: CardInstance; revealEvent?: RevealDeckTopEvent; events: SmashUpEvent[] } | undefined {
    const player = state.players[playerId];
    if (!player) return undefined;

    // 规则：当需要 look/reveal/search/draw 而牌库为空时，将弃牌堆洗入牌库并继续。
    // peekDeckTop 不消耗牌库顶，只在必要时重排牌库顺序（DECK_REORDERED）。
    const events: SmashUpEvent[] = [];
    if (player.deck.length === 0) {
        if (player.discard.length === 0) return undefined;
        const shuffled = random.shuffle([...player.discard]);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: shuffled.map(c => c.uid),
            },
            timestamp: now,
        } as DeckReorderedEvent);
        // 注意：此处不直接修改 state；由 reducer 根据 DECK_REORDERED 更新 deck/discard 后，
        // 才会在后续流程中体现为“弃牌堆洗回牌库”。
        // 为了本次 peek 能返回正确的 card，我们用模拟的 shuffled[0]。
        const card = shuffled[0];
        events.push(inspectDeck(playerId, inspectorPlayerId, 1, reason, now));
        if (revealTo === 'none') {
            return { card, events };
        }
        const revealEvent = revealDeckTop(
            playerId, revealTo,
            [{ uid: card.uid, defId: card.defId }],
            1, reason, now, inspectorPlayerId,
        );
        events.push(revealEvent);
        return { card, revealEvent, events };
    }

    const card = player.deck[0];
    events.push(inspectDeck(playerId, inspectorPlayerId, 1, reason, now));
    if (revealTo === 'none') {
        return { card, events };
    }
    const revealEvent = revealDeckTop(
        playerId, revealTo,
        [{ uid: card.uid, defId: card.defId }],
        1, reason, now, inspectorPlayerId,
    );
    events.push(revealEvent);
    return { card, revealEvent, events };
}

// ============================================================================
// 随从打出完整事件链
// ============================================================================

/**
 * 打出随从后的触发链：onPlay 能力 + 基地能力 onMinionPlayed + ongoing 触发器 onMinionPlayed
 *
 * 由 postProcessSystemEvents 自动调用，处理所有 MINION_PLAYED 事件。
 * PLAY_MINION 命令也可直接调用此函数复用触发链。
 * 
 * 调用方需自行构造 MINION_PLAYED 事件并传入 playedEvt。
 */
export function fireMinionPlayedTriggers(params: {
    core: SmashUpCore;
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    baseIndex: number;
    power: number;
    random: RandomFn;
    now: number;
    playedEvt: MinionPlayedEvent;
}): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const { core, playerId, cardUid, defId, baseIndex, power, random, now } = params;
    let matchState = params.matchState;
    const events: SmashUpEvent[] = [];

    // 注意：此函数被 postProcessSystemEvents 调用时，MINION_PLAYED 事件已经被 reduce 到 core 中
    // 所以随从已经在基地上了，不需要再次 reduce

    // 1. onPlay 能力触发
    const executor = resolveOnPlay(defId);
    if (executor) {
        const ctx: AbilityContext = {
            state: core,
            matchState,
            playerId,
            cardUid,
            defId,
            baseIndex,
            random,
            now,
        };
        const result = executor(ctx);
        events.push(...result.events);
        if (result.matchState) matchState = result.matchState;
    }

    // 2. 基地能力触发 onMinionPlayed（改为入队，按 Wiki 同时触发排序解决）
    const minionDef = getMinionDef(defId);
    const queuedBase = collectBaseAbilityTriggers({
        core,
        timing: 'onMinionPlayed',
        ownerPlayerId: playerId,
        baseIndex,
        triggerMinionUid: cardUid,
        triggerMinionDefId: defId,
        triggerMinionPower: minionDef?.power ?? power,
        now,
    });
    if (queuedBase) events.push(queuedBase as unknown as SmashUpEvent);

    // 3. ongoing 触发器 onMinionPlayed（改为入队，按 Wiki 同时触发排序解决）
    const playedMinion = core.bases[baseIndex]?.minions.find(m => m.uid === cardUid);
    const queued = collectTriggers(core, 'onMinionPlayed', {
        state: core,
        matchState,
        playerId,
        baseIndex,
        triggerMinionUid: cardUid,
        triggerMinionDefId: defId,
        triggerMinion: playedMinion,
        random,
        now,
    });
    if (queued) events.push(queued);

    // 4. 消费 pendingMinionPlayEffects 队列（如 crack_of_dusk / its_alive 的打出后+1指示物）
    const player = core.players[playerId];
    if (player?.pendingMinionPlayEffects && player.pendingMinionPlayEffects.length > 0) {
        const effect = player.pendingMinionPlayEffects[0];
        if (effect.effect === 'addPowerCounter') {
            events.push(addPowerCounter(cardUid, baseIndex, effect.amount, 'pendingMinionPlayEffect', now));
        }
        // 生成消费事件（reducer 负责 shift 队列）
        events.push({
            type: SU_EVENTS.MINION_PLAY_EFFECT_CONSUMED,
            payload: { playerId },
            timestamp: now,
        } as SmashUpEvent);
    }

    return matchState !== params.matchState ? { events, matchState } : { events };
}

// ============================================================================
// 额外出牌额度
// ============================================================================

/** 生成额外随从额度事件 */
export function grantExtraMinion(
    playerId: PlayerId,
    reason: string,
    now: number,
    /** 限定额度只能用于指定基地（不设则为全局额度） */
    restrictToBase?: number,
    /** 额外选项 */
    options?: { sameNameOnly?: boolean; sameNameDefId?: string; powerMax?: number },
): LimitModifiedEvent {
    return {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: {
            playerId, limitType: 'minion', delta: 1, reason,
            ...(restrictToBase !== undefined ? { restrictToBase } : {}),
            ...(options?.powerMax !== undefined ? { powerMax: options.powerMax } : {}),
            ...(options?.sameNameOnly ? { sameNameOnly: true } : {}),
            ...(options?.sameNameDefId ? { sameNameDefId: options.sameNameDefId } : {}),
        },
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

/** 通过附着行动卡 uid 反查随从（用于 ongoing+talent 附着在随从上的场景） */
export function findMinionByAttachedCard(
    core: SmashUpCore,
    attachedCardUid: string
): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (let i = 0; i < core.bases.length; i++) {
        for (const m of core.bases[i].minions) {
            if (m.attachedActions.some(a => a.uid === attachedCardUid)) {
                return { minion: m, baseIndex: i };
            }
        }
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

export type PlayerCardZone = 'hand' | 'deck' | 'discard';

export function findCardInPlayerZone(
    core: SmashUpCore,
    playerId: PlayerId,
    zone: PlayerCardZone,
    cardUid: string,
    defId?: string,
): CardInstance | undefined {
    const player = core.players[playerId];
    if (!player) return undefined;
    return player[zone].find(card => {
        if (card.uid !== cardUid) return false;
        if (defId !== undefined && card.defId !== defId) return false;
        return true;
    });
}

export function filterCardsPresentInPlayerZone<T extends { uid: string; defId?: string }>(
    core: SmashUpCore,
    playerId: PlayerId,
    zone: PlayerCardZone,
    cards: T[],
): T[] {
    return cards.filter(card => findCardInPlayerZone(core, playerId, zone, card.uid, card.defId) != null);
}

/**
 * 交互取消回滚（行动卡）通用事件构建。
 *
 * 语义：当行动卡在交互中被取消时，统一执行
 * 1) 回收该行动卡到手牌
 * 2) 返还本回合 1 点行动额度
 * 3) 允许在前置参数中附加自定义回滚事件（如恢复/撤销指示物）
 */
export function buildActionCancelRollbackEvents(
    playerId: PlayerId,
    actionCardUid: string,
    reasonPrefix: string,
    now: number,
    rollbackEvents: SmashUpEvent[] = [],
): SmashUpEvent[] {
    return [
        ...rollbackEvents,
        recoverCardsFromDiscard(playerId, [actionCardUid], `${reasonPrefix}_cancel`, now),
        grantExtraAction(playerId, `${reasonPrefix}_cancel`, now),
    ];
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
// Special 能力限制组（每基地每回合一次）
// ============================================================================

import type { MinionCardDef, ActionCardDef, SpecialLimitUsedEvent } from './types';
import { getCardDef } from '../data/cards';

/**
 * 检查指定 defId 的 special 能力在指定基地是否已被限制组阻止
 * @returns true = 已被使用，不能再用
 */
export function isSpecialLimitBlocked(state: SmashUpCore, defId: string, baseIndex: number): boolean {
    const def = getCardDef(defId);
    if (!def) return false;
    const limitGroup = (def as MinionCardDef | ActionCardDef).specialLimitGroup;
    if (!limitGroup) return false;
    const used = state.specialLimitUsed?.[limitGroup];
    return used?.includes(baseIndex) ?? false;
}

/**
 * 生成 special 能力限制组使用记录事件
 * 如果该 defId 没有 specialLimitGroup 则返回 undefined
 */
export function emitSpecialLimitUsed(
    playerId: PlayerId,
    defId: string,
    baseIndex: number,
    now: number,
): SpecialLimitUsedEvent | undefined {
    const def = getCardDef(defId);
    if (!def) return undefined;
    const limitGroup = (def as MinionCardDef | ActionCardDef).specialLimitGroup;
    if (!limitGroup) return undefined;
    return {
        type: SU_EVENTS.SPECIAL_LIMIT_USED,
        payload: { playerId, baseIndex, limitGroup, abilityDefId: defId },
        timestamp: now,
    };
}

// ============================================================================
// Me First! 响应窗口
// ============================================================================

import type { GameEvent } from '../../../engine/types';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';

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

export function buildStandardDrawEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    count: number,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    if (count <= 0) return [];
    const player = state.players[playerId];
    if (!player) return [];
    const draw = drawCards(player, count, random);
    const events: SmashUpEvent[] = [];
    if (draw.reshuffledDeckUids && draw.reshuffledDeckUids.length > 0) {
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: draw.reshuffledDeckUids },
            timestamp: now,
        } as DeckReorderedEvent);
    }
    if (draw.drawnUids.length > 0) {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: draw.drawnUids.length, cardUids: draw.drawnUids },
            timestamp: now,
        } as CardsDrawnEvent);
    }
    return events;
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
            const baseFactionId = f.endsWith('_pod') ? f.slice(0, -4) : f;
            if ((CTHULHU_EXPANSION_FACTIONS as readonly string[]).includes(baseFactionId as any)) return true;
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

/**
 * 打开计分后响应窗口（After Scoring）
 * 
 * 用于基地计分后，允许玩家打出 specialTiming: 'afterScoring' 的特殊行动卡
 * 
 * @param triggerContext 触发上下文（如 'scoreBases'）
 * @param currentPlayerId 当前玩家 ID
 * @param turnOrder 玩家回合顺序
 * @param now 时间戳
 */
export function openAfterScoringWindow(
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
            windowId: `afterScoring_${triggerContext}_${now}`,
            responderQueue,
            windowType: 'afterScoring' as const,
            sourceId: triggerContext,
        },
        timestamp: now,
    };
}


// ============================================================================
// 交互辅助函数（目标选择）
// ============================================================================

/**
 * 构建随从目标选择的交互选项（自动保护过滤）
 * 
 * 自动过滤受保护的对手随从：对每个对手随从检查所有保护类型，
 * 己方随从不做保护检查。调用方无需手动指定 effectType。
 * 
 * @param candidates 候选随从列表（含基地索引）
 * @param context state + sourcePlayerId（必传）；effectType 可选覆盖
 * @returns 引擎层 PromptOption 数组
 */
export function buildMinionTargetOptions(
    candidates: { uid: string; defId: string; baseIndex: number; label: string }[],
    context: {
        /** 当前游戏状态（用于保护检查） */
        state: SmashUpCore;
        /** 发起效果的玩家 */
        sourcePlayerId: PlayerId;
        /** 效果类型覆盖（可选，不传则自动检查 destroy + affect） */
        effectType?: ProtectionType;
    }
): EnginePromptOption<{ minionUid: string; baseIndex: number; defId: string }>[] {
    const { state, sourcePlayerId, effectType } = context;
    const filteredCandidates = candidates.filter(c => {
        const minion = state.bases[c.baseIndex]?.minions.find(m => m.uid === c.uid);
        if (!minion) return false;
        // 己方随从不做保护检查（保护只针对对手效果）
        if (minion.controller === sourcePlayerId) return true;
        // 对手随从：检查保护
        if (effectType) {
            // 指定了 effectType → 只检查该类型（非消耗型）+ affect（非消耗型广义保护）
            if (isMinionProtected(state, minion, c.baseIndex, sourcePlayerId, effectType)) return false;
            if (effectType !== 'affect' && isMinionProtectedNonConsumable(state, minion, c.baseIndex, sourcePlayerId, 'affect')) return false;
            return true;
        }
        // 未指定 effectType → 检查 destroy（全部）+ affect（仅非消耗型）
        if (isMinionProtected(state, minion, c.baseIndex, sourcePlayerId, 'destroy')) return false;
        if (isMinionProtectedNonConsumable(state, minion, c.baseIndex, sourcePlayerId, 'affect')) return false;
        return true;
    });

    return filteredCandidates.map((c, i) => ({
        id: `minion-${i}`,
        label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex, defId: c.defId },
        _source: 'field' as const,
    }));
}

/**
 * 构建基地目标选择的交互选项
 * 
 * @param candidates 候选基地列表，包含 baseIndex 和 label
 * @param state 游戏状态，用于自动提取 baseDefId（触发卡牌展示模式）
 * @returns 引擎层 PromptOption 数组，自动添加 baseDefId 以触发卡牌展示模式
 */
export function buildBaseTargetOptions(
    candidates: { baseIndex: number; label: string }[],
    state?: SmashUpCore
): EnginePromptOption<{ baseIndex: number; baseDefId?: string }>[] {
    return candidates.map((c, i) => {
        const baseDefId = state?.bases?.[c.baseIndex]?.defId;
        return {
            id: `base-${i}`,
            label: c.label,
            value: { baseIndex: c.baseIndex, ...(baseDefId && { baseDefId }) },
            _source: 'base' as const,
        };
    });
}

// ============================================================================
// 数据驱动选择：resolveOrPrompt
// ============================================================================

/**
 * 数据驱动的候选选择 helper。
 *
 * 替代各能力中硬编码的 `if (candidates.length === 1) { ... }` 模式。
 * 根据配置决定：单候选自动执行 or 始终创建交互让玩家选择。
 * UI 层根据 targetType 决定渲染方式（高亮基地/随从 vs 弹窗）。
 *
 * @param ctx 能力执行上下文
 * @param options 已构建好的 PromptOption 数组（通过 buildBaseTargetOptions / buildMinionTargetOptions）
 * @param config 选择配置
 * @param resolve 单候选自动执行时的回调，返回 AbilityResult
 */
export function resolveOrPrompt<T>(
    ctx: AbilityContext,
    options: EnginePromptOption<T>[],
    config: {
        id: string;
        title: string;
        sourceId: string;
        targetType: SimpleChoiceTargetType;
        /** 单候选自动执行（默认 true，强制效果）；false = 可选效果，始终让玩家选 */
        autoResolveIfSingle?: boolean;
        /** 是否自动添加取消选项（默认 false） */
        autoCancelOption?: boolean;
    },
    resolve: (value: T) => AbilityResult,
): AbilityResult {
    if (options.length === 0) return { events: [] };

    const autoResolve = config.autoResolveIfSingle ?? true;
    if (autoResolve && options.length === 1 && !config.autoCancelOption) {
        // 单候选且不需要取消选项时自动执行
        return resolve(options[0].value);
    }

    // 创建交互，UI 层根据 targetType 高亮对应区域
    const interaction = createSimpleChoice(
        `${config.id}_${ctx.now}`, ctx.playerId,
        config.title, options,
        {
            sourceId: config.sourceId,
            targetType: config.targetType,
            autoResolveIfSingle: autoResolve,
            autoCancelOption: config.autoCancelOption,
        } as SimpleChoiceConfig,
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 生成能力反馈事件（纯 UI 提示，不影响状态） */
export function buildAbilityFeedback(
    playerId: PlayerId,
    messageKey: string,
    now: number,
    messageParams?: Record<string, string | number>,
    tone: 'info' | 'warning' = 'info',
): AbilityFeedbackEvent {
    return {
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId, messageKey, messageParams, tone },
        timestamp: now,
    };
}
