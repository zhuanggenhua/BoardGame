/**
 * 大杀四方 - 能力执行辅助函数
 *
 * 提供常用的能力效果生成器（消灭随从、移动随从、抽牌、额外出牌等）。
 * 所有函数返回事件数组，由 reducer 统一归约。
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import { buildTargetAiHint, OPTIONAL_SKIP_AI_HINT } from '../../../engine/ai';
import type { AiEffectIntent, AiHint } from '../../../engine/ai';
import type {
    PromptOption as EnginePromptOption,
    SimpleChoiceConfig,
    SimpleChoiceTargetType,
} from '../../../engine/systems/InteractionSystem';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { AbilityContext, AbilityResult } from './abilityRegistry';
import { resolveOnPlay } from './abilityRegistry';
import { buildOngoingDetachedEvent } from './ongoingDetach';
import { getSmashUpRelationToPlayer } from './teamMode';
import type { ProtectionType } from './ongoingEffects';
import { collectBaseAbilityTriggers } from './baseAbilityQueue';
import { resolveLiveBaseIndex } from './utils';
import {
    buildProtectionSelfDestructEvent,
    filterSemanticProtectedAffectEvents,
    inferSemanticSourceKind,
    isMinionTargetAllowed,
    type MinionSemanticEffectType,
    type MinionTargetSemanticOptions,
    partitionMinionTargetsBySemantics,
    type SemanticMinionTargetCandidate,
    type SemanticTargetRole,
} from './effectSemantics';
import type {
    SmashUpCore,
    MinionOnBase,
    TitanState,
    MinionPlayedEvent,
    LimitModifiedEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    MinionControlChangedEvent,
    MinionCardDef,
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
    DeckReshuffledEvent,
    DeckReorderedEvent,
    AbilityFeedbackEvent,
    OngoingAttachedEvent,
    OngoingCardCounterChangedEvent,
    CardToDeckBottomEvent,
    TitanRemovedFromPlayEvent,
    TitanMetadataUpdatedEvent,
} from './types';
import { SU_EVENT_TYPES as SU_EVENTS } from './events';
import { getEffectivePower } from './ongoingModifiers';
import { collectTriggers } from './ongoingEffects';
import { reduce } from './reduce';
import { getCardDef, getMinionDef, getTitanDef } from '../data/cards';
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
 * @param labelKey 可选的 i18n key；传入后状态里会优先保存 key，避免把原始文案带到 UI / 日志
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
 *
 * const options3 = [
 *     createSkipOption('跳过（不消灭随从）', 'ui.skip_destroy_minion'),
 *     ...minionOptions
 * ];
 * ```
 */
export function createSkipOption(label: string = '跳过', labelKey?: string): EnginePromptOption<{ skip: true }> {
    return {
        id: 'skip',
        label,
        ...((typeof labelKey === 'string' && labelKey.trim())
            ? { labelKey }
            : (label === '跳过' ? { labelKey: 'ui.skip' } : {})),
        value: { skip: true },
        displayMode: 'button',
        _ai: OPTIONAL_SKIP_AI_HINT,
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
// 泰坦查询与离场
// ============================================================================

export function getTitanByUid(
    state: SmashUpCore | MatchState<SmashUpCore>,
    titanUid: string,
): TitanState | undefined {
    const core = 'core' in state ? state.core : state;
    return (core.titans ?? []).find((titan) => titan.uid === titanUid);
}

export function getTitansOnBase(
    state: SmashUpCore | MatchState<SmashUpCore>,
    baseIndex: number,
): TitanState[] {
    const core = 'core' in state ? state.core : state;
    return (core.titans ?? []).filter(
        (titan) => titan.location.zone === 'base' && titan.location.baseIndex === baseIndex,
    );
}

export function getTitanByController(
    state: SmashUpCore | MatchState<SmashUpCore>,
    controllerId: PlayerId,
): TitanState | undefined {
    const core = 'core' in state ? state.core : state;
    return (core.titans ?? []).find(
        (titan) => titan.controllerId === controllerId && titan.location.zone === 'base',
    );
}

export function canControllerPlayTitan(
    state: SmashUpCore | MatchState<SmashUpCore>,
    controllerId: PlayerId,
    titanUid: string,
    options?: { allowConcurrentOwnTitan?: boolean },
): boolean {
    const core = 'core' in state ? state.core : state;
    const activeTitans = (core.titans ?? []).filter(
        titan => titan.controllerId === controllerId && titan.location.zone === 'base',
    );
    if (activeTitans.length === 0) return true;
    if (activeTitans.some(titan => titan.uid === titanUid)) return true;
    if (options?.allowConcurrentOwnTitan === true) return true;

    const redTrooperPodInPlay = core.bases.some(base =>
        base.minions.some(minion =>
            minion.controller === controllerId
            && minion.defId === 'mega_troopers_red_trooper_pod',
        ),
    );
    const titanLimit = redTrooperPodInPlay ? 2 : 1;
    return activeTitans.length < titanLimit;
}

export function getSpiritOfTheForestByController(
    state: SmashUpCore | MatchState<SmashUpCore>,
    controllerId: PlayerId,
): TitanState | undefined {
    const titan = getTitanByController(state, controllerId);
    return titan?.defId === 'fairies_spirit_of_the_forest' ? titan : undefined;
}

export function getAvailableSpiritOfTheForestOrTitan(
    state: SmashUpCore | MatchState<SmashUpCore>,
    controllerId: PlayerId,
): TitanState | undefined {
    const core = 'core' in state ? state.core : state;
    const titan = getSpiritOfTheForestByController(core, controllerId);
    if (!titan) return undefined;
    const usedTurn = typeof titan.metadata?.spiritOfTheForestUsedTurn === 'number'
        ? titan.metadata.spiritOfTheForestUsedTurn
        : undefined;
    return usedTurn === core.turnNumber ? undefined : titan;
}

export function markSpiritOfTheForestOrUsed(
    titanUid: string,
    turnNumber: number,
    now: number,
): TitanMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.TITAN_METADATA_UPDATED,
        payload: {
            titanUid,
            metadataUpdate: { spiritOfTheForestUsedTurn: turnNumber },
            reason: 'fairies_spirit_of_the_forest_or',
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
            fromBaseIndex: titan.location.zone === 'base' ? titan.location.baseIndex : undefined,
            reason,
        },
        timestamp: now,
    };
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
    now: number,
    sourceKind?: 'action' | 'nonAction',
    controllerId?: PlayerId,
    source?: {
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): MinionDestroyedEvent {
    return {
        type: SU_EVENTS.MINION_DESTROYED,
        payload: {
            minionUid,
            minionDefId,
            fromBaseIndex,
            ownerId,
            controllerId,
            destroyerId,
            ...(source?.sourcePlayerId !== undefined ? { sourcePlayerId: source.sourcePlayerId } : {}),
            ...(source?.sourceCardUid !== undefined ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceDefId !== undefined ? { sourceDefId: source.sourceDefId } : {}),
            ...(source?.sourceControllerId !== undefined ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
            ...(sourceKind !== undefined ? { sourceKind } : {}),
            reason,
        },
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
    source?: {
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
    batchId?: string,
): MinionMovedEvent {
    return {
        type: SU_EVENTS.MINION_MOVED,
        payload: {
            minionUid,
            minionDefId,
            fromBaseIndex,
            toBaseIndex,
            ...(toBaseDefId ? { toBaseDefId } : {}),
            ...(source?.sourcePlayerId !== undefined ? { sourcePlayerId: source.sourcePlayerId } : {}),
            ...(source?.sourceCardUid !== undefined ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceDefId !== undefined ? { sourceDefId: source.sourceDefId } : {}),
            ...(source?.sourceControllerId !== undefined ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
            ...(batchId !== undefined ? { batchId } : {}),
            reason,
        },
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
    source?: {
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
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
            ...(source?.sourceCardUid !== undefined ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceDefId !== undefined ? { sourceDefId: source.sourceDefId } : {}),
            ...(source?.sourceControllerId !== undefined ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
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

export function getSetAsideTitansPlayableAs(
    state: SmashUpCore,
    playerId: PlayerId,
    playKind: TitanPlayAsKind,
): TitanState[] {
    if (getTitanByController(state, playerId)) return [];
    return getAllTitans(state).filter((titan) => {
        if (titan.controllerId !== playerId || titan.location.zone !== 'setaside') return false;
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
    metadata?: Record<string, unknown>,
): TitanMovedEvent {
    return {
        type: SU_EVENTS.TITAN_MOVED,
        payload: {
            titanUid,
            defId,
            fromBaseIndex,
            toBaseIndex,
            ...(toBaseDefId ? { toBaseDefId } : {}),
            ...(metadata ? { metadata } : {}),
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
        sourcePlayerId: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        sourceKind?: 'action' | 'nonAction';
        batchId?: string;
        allowMissingTargetBase?: boolean;
        targetSnapshot?: {
            ownerId?: PlayerId;
            controllerId?: PlayerId;
            attachedActions?: MinionOnBase['attachedActions'];
            metadata?: MinionOnBase['metadata'];
            playedThisTurn?: boolean;
        };
    },
): SmashUpEvent[] {
    const core = 'core' in state ? state.core : state;
    const sourceBase = core.bases[params.fromBaseIndex];
    if (!sourceBase) return [];
    const resolvedToBaseIndex = resolveLiveBaseIndex(core, params.toBaseIndex, params.toBaseDefId) ?? params.toBaseIndex;
    const targetBase = core.bases[resolvedToBaseIndex];
    const hasFutureTargetBase = params.allowMissingTargetBase
        && resolvedToBaseIndex === core.bases.length
        && !!params.toBaseDefId;
    if (!targetBase && !hasFutureTargetBase) return [];

    const minion = sourceBase.minions.find(candidate => candidate.uid === params.minionUid)
        ?? buildFallbackMinionOnBase(params.minionUid, params.minionDefId, params.targetSnapshot);
    if (!minion) return [];

    const actingPlayerId = params.sourceControllerId ?? params.sourcePlayerId;
    const targetMoai = targetBase?.minions.find(candidate =>
        candidate.defId === 'polynesian_voyagers_moai'
        && candidate.controller !== minion.controller,
    );
    const isOtherPlayerMovingMoai = minion.defId === 'polynesian_voyagers_moai'
        && minion.controller !== actingPlayerId;
    if (targetMoai || isOtherPlayerMovingMoai) {
        return [buildAbilityFeedback(params.sourcePlayerId, 'feedback.target_protected', params.now, undefined, 'warning')];
    }

    return buildSemanticSingleMinionEffectEvents(
        state,
        { minion, baseIndex: params.fromBaseIndex },
        {
            sourcePlayerId: params.sourcePlayerId,
            actionProtectionSourcePlayerId: params.sourceControllerId ?? params.sourcePlayerId,
            sourceDefId: params.sourceDefId,
            sourceKind: inferSemanticSourceKind(params.sourceKind, params.sourceDefId),
            effectType: 'move',
            mode: 'apply',
            feedbackPlayerId: params.sourcePlayerId,
            now: params.now,
            allBlockedMessageKey: 'feedback.target_protected',
        },
        () => [moveMinion(
            params.minionUid,
            minion.defId ?? params.minionDefId,
            params.fromBaseIndex,
            resolvedToBaseIndex,
            params.reason,
            params.now,
            params.toBaseDefId,
            {
                sourcePlayerId: params.sourcePlayerId,
                sourceCardUid: params.sourceCardUid,
                sourceDefId: params.sourceDefId,
                sourceControllerId: params.sourceControllerId,
                sourceBaseIndex: params.sourceBaseIndex,
            },
            params.batchId,
        )],
    );
}

export function buildValidatedBaseMoveEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
        toBaseDefId?: string;
        reason: string;
        now: number;
        sourcePlayerId: PlayerId;
        sourceDefId: string;
        sourceBaseIndex: number;
    },
): SmashUpEvent[] {
    return buildValidatedMoveEvents(state, {
        minionUid: params.minionUid,
        minionDefId: params.minionDefId,
        fromBaseIndex: params.fromBaseIndex,
        toBaseIndex: params.toBaseIndex,
        toBaseDefId: params.toBaseDefId,
        reason: params.reason,
        now: params.now,
        sourcePlayerId: params.sourcePlayerId,
        sourceDefId: params.sourceDefId,
        sourceControllerId: params.sourcePlayerId,
        sourceBaseIndex: params.sourceBaseIndex,
        sourceKind: 'nonAction',
    });
}

export function buildReplayMoveEvent(params: {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    toBaseIndex: number;
    toBaseDefId?: string;
    reason: string;
    now: number;
    batchId?: string;
}): MinionMovedEvent {
    return moveMinion(
        params.minionUid,
        params.minionDefId,
        params.fromBaseIndex,
        params.toBaseIndex,
        params.reason,
        params.now,
        params.toBaseDefId,
        undefined,
        params.batchId,
    );
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

function buildFallbackMinionOnBase(
    minionUid: string,
    minionDefId: string,
    targetSnapshot?: {
        ownerId?: PlayerId;
        controllerId?: PlayerId;
        attachedActions?: MinionOnBase['attachedActions'];
        metadata?: MinionOnBase['metadata'];
        playedThisTurn?: boolean;
    },
): MinionOnBase | undefined {
    const ownerId = targetSnapshot?.ownerId;
    const controllerId = targetSnapshot?.controllerId ?? ownerId;
    if (!ownerId || !controllerId) return undefined;

    const minionDef = getMinionDef(minionDefId);
    return {
        uid: minionUid,
        defId: minionDefId,
        owner: ownerId,
        controller: controllerId,
        basePower: minionDef?.power ?? 0,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        playedThisTurn: targetSnapshot?.playedThisTurn,
        attachedActions: [...(targetSnapshot?.attachedActions ?? [])],
        metadata: targetSnapshot?.metadata ? { ...targetSnapshot.metadata } : undefined,
    };
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
        sourcePlayerId: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        sourceKind?: 'action' | 'nonAction';
        targetSnapshot?: {
            ownerId?: PlayerId;
            controllerId?: PlayerId;
            attachedActions?: MinionOnBase['attachedActions'];
            metadata?: MinionOnBase['metadata'];
            playedThisTurn?: boolean;
        };
    },
): SmashUpEvent[] {
    const minion = findMinionOnBase(state, params.fromBaseIndex, params.minionUid)
        ?? buildFallbackMinionOnBase(params.minionUid, params.minionDefId, params.targetSnapshot);
    if (!minion) return [];

    return buildSemanticSingleMinionEffectEvents(
        state,
        { minion, baseIndex: params.fromBaseIndex },
        {
            sourcePlayerId: params.sourcePlayerId,
            actionProtectionSourcePlayerId: params.sourceControllerId ?? params.sourcePlayerId,
            sourceDefId: params.sourceDefId,
            sourceKind: inferSemanticSourceKind(params.sourceKind, params.sourceDefId),
            effectType: 'destroy',
            mode: 'apply',
            feedbackPlayerId: params.sourcePlayerId,
            now: params.now,
            allBlockedMessageKey: 'feedback.target_protected',
        },
        () => [
            destroyMinion(
                params.minionUid,
                minion.defId ?? params.minionDefId,
                params.fromBaseIndex,
                minion.owner,
                params.destroyerId,
                params.reason,
                params.now,
                inferSemanticSourceKind(params.sourceKind, params.sourceDefId),
                minion.controller,
                {
                    sourcePlayerId: params.sourcePlayerId,
                    sourceCardUid: params.sourceCardUid,
                    sourceDefId: params.sourceDefId,
                    sourceControllerId: params.sourceControllerId,
                    sourceBaseIndex: params.sourceBaseIndex,
                },
            ),
        ],
    );
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
        sourcePlayerId: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        sourceKind?: 'action' | 'nonAction';
        targetSnapshot?: {
            ownerId?: PlayerId;
            controllerId?: PlayerId;
            attachedActions?: MinionOnBase['attachedActions'];
            metadata?: MinionOnBase['metadata'];
            playedThisTurn?: boolean;
        };
    },
): SmashUpEvent[] {
    const minion = findMinionOnBase(state, params.fromBaseIndex, params.minionUid)
        ?? buildFallbackMinionOnBase(params.minionUid, params.minionDefId, params.targetSnapshot);
    if (!minion) return [];

    return buildSemanticSingleMinionEffectEvents(
        state,
        { minion, baseIndex: params.fromBaseIndex },
        {
            sourcePlayerId: params.sourcePlayerId,
            actionProtectionSourcePlayerId: params.sourceControllerId ?? params.sourcePlayerId,
            sourceDefId: params.sourceDefId,
            sourceKind: inferSemanticSourceKind(params.sourceKind, params.sourceDefId),
            effectType: 'return',
            mode: 'apply',
            feedbackPlayerId: params.sourcePlayerId,
            now: params.now,
            allBlockedMessageKey: 'feedback.target_protected',
        },
        () => [{
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: params.minionUid,
                minionDefId: minion.defId ?? params.minionDefId,
                fromBaseIndex: params.fromBaseIndex,
                toPlayerId: params.toPlayerId ?? minion.owner,
                reason: params.reason,
                sourcePlayerId: params.sourcePlayerId,
                ...(params.sourceCardUid !== undefined ? { sourceCardUid: params.sourceCardUid } : {}),
                ...(params.sourceDefId !== undefined ? { sourceDefId: params.sourceDefId } : {}),
                ...(params.sourceControllerId !== undefined ? { sourceControllerId: params.sourceControllerId } : {}),
                ...(params.sourceBaseIndex !== undefined ? { sourceBaseIndex: params.sourceBaseIndex } : {}),
            },
            timestamp: params.now,
        }],
    );
}

export function buildValidatedControlChangeEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        minionUid: string;
        minionDefId: string;
        baseIndex: number;
        toControllerId: PlayerId;
        sourcePlayerId: PlayerId;
        reason: string;
        now: number;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        sourceKind?: 'action' | 'nonAction';
    },
): SmashUpEvent[] {
    const minion = findMinionOnBase(state, params.baseIndex, params.minionUid);
    if (!minion || minion.controller === params.toControllerId) return [];

    return buildSemanticSingleMinionEffectEvents(
        state,
        { minion, baseIndex: params.baseIndex },
        {
            sourcePlayerId: params.sourcePlayerId,
            actionProtectionSourcePlayerId: params.sourceControllerId ?? params.sourcePlayerId,
            sourceDefId: params.sourceDefId,
            sourceKind: inferSemanticSourceKind(params.sourceKind, params.sourceDefId),
            effectType: 'control',
            mode: 'apply',
            feedbackPlayerId: params.sourcePlayerId,
            now: params.now,
            allBlockedMessageKey: 'feedback.target_protected',
        },
        () => [changeMinionController(
            params.minionUid,
            minion.defId ?? params.minionDefId,
            params.baseIndex,
            minion.owner,
            minion.controller,
            params.toControllerId,
            params.sourcePlayerId,
            params.reason,
            params.now,
            {
                sourceCardUid: params.sourceCardUid,
                sourceDefId: params.sourceDefId,
                sourceControllerId: params.sourceControllerId,
                sourceBaseIndex: params.sourceBaseIndex,
            },
        )],
    );
}

export function buildValidatedCardToDeckBottomEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        sourcePlayerId: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        locationPlayerId?: PlayerId;
        reason: string;
        now: number;
        expectedLocation?: 'discard' | 'hand' | 'deck' | 'bases' | 'any';
    },
    ): SmashUpEvent[] {
    const core = 'core' in state ? state.core : state;
    const owner = core.players[params.ownerId];
    if (!owner) return [];
    const zonePlayer = core.players[params.locationPlayerId ?? params.ownerId] ?? owner;

    const exists = (() => {
        switch (params.expectedLocation ?? 'any') {
            case 'discard':
                return zonePlayer.discard.some(card => card.uid === params.cardUid);
            case 'hand':
                return zonePlayer.hand.some(card => card.uid === params.cardUid);
            case 'deck':
                return zonePlayer.deck.some(card => card.uid === params.cardUid);
            case 'bases':
                return core.bases.some(
                    base => base.minions.some(minion => minion.uid === params.cardUid)
                        || base.ongoingActions.some(action => action.uid === params.cardUid)
                        || base.minions.some(minion => minion.attachedActions.some(action => action.uid === params.cardUid)),
                );
            case 'any':
            default:
                return owner.hand.some(card => card.uid === params.cardUid)
                    || owner.deck.some(card => card.uid === params.cardUid)
                    || owner.discard.some(card => card.uid === params.cardUid)
                    || core.bases.some(
                        base => base.minions.some(minion => minion.uid === params.cardUid)
                            || base.ongoingActions.some(action => action.uid === params.cardUid)
                            || base.minions.some(minion => minion.attachedActions.some(action => action.uid === params.cardUid)),
                    );
        }
    })();

    if (!exists) return [];

    const minionOnBase = core.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter((candidate) => candidate.uid === params.cardUid)
            .map((minion) => ({ minion, baseIndex }))
    ))[0];

    if (minionOnBase) {
        return buildSemanticSingleMinionEffectEvents(
            state,
            minionOnBase,
            {
                sourcePlayerId: params.sourcePlayerId,
                actionProtectionSourcePlayerId: params.sourceControllerId ?? params.sourcePlayerId,
                sourceDefId: params.sourceDefId,
                sourceKind: inferSemanticSourceKind(undefined, params.sourceDefId),
                effectType: 'return',
                mode: 'apply',
                feedbackPlayerId: params.sourcePlayerId,
                now: params.now,
                allBlockedMessageKey: 'feedback.target_protected',
            },
            () => [{
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: params.cardUid,
                    defId: params.defId,
                    ownerId: params.ownerId,
                    reason: params.reason,
                    sourcePlayerId: params.sourcePlayerId,
                    ...(params.sourceCardUid !== undefined ? { sourceCardUid: params.sourceCardUid } : {}),
                    ...(params.sourceDefId !== undefined ? { sourceDefId: params.sourceDefId } : {}),
                    ...(params.sourceControllerId !== undefined ? { sourceControllerId: params.sourceControllerId } : {}),
                    ...(params.sourceBaseIndex !== undefined ? { sourceBaseIndex: params.sourceBaseIndex } : {}),
                },
                timestamp: params.now,
            }],
        );
    }

    const proposedEvent: CardToDeckBottomEvent = {
        type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
        payload: {
            cardUid: params.cardUid,
            defId: params.defId,
            ownerId: params.ownerId,
            reason: params.reason,
            sourcePlayerId: params.sourcePlayerId,
            ...(params.sourceCardUid !== undefined ? { sourceCardUid: params.sourceCardUid } : {}),
            ...(params.sourceDefId !== undefined ? { sourceDefId: params.sourceDefId } : {}),
            ...(params.sourceControllerId !== undefined ? { sourceControllerId: params.sourceControllerId } : {}),
            ...(params.sourceBaseIndex !== undefined ? { sourceBaseIndex: params.sourceBaseIndex } : {}),
        },
        timestamp: params.now,
    };

    return filterSemanticProtectedAffectEvents([proposedEvent], core, params.sourcePlayerId);
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
    now: number,
    source?: {
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): PowerCounterAddedEvent {
    return {
        type: SU_EVENTS.POWER_COUNTER_ADDED,
        payload: {
            minionUid,
            baseIndex,
            amount,
            reason,
            ...(source?.sourcePlayerId !== undefined ? { sourcePlayerId: source.sourcePlayerId } : {}),
            ...(source?.sourceCardUid !== undefined ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceDefId !== undefined ? { sourceDefId: source.sourceDefId } : {}),
            ...(source?.sourceControllerId !== undefined ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
        },
        timestamp: now,
    };
}

/** 生成 ongoing 卡力量指示物变化事件（如 vampire_summon_wolves） */
export function addOngoingCardCounter(
    cardUid: string,
    baseIndex: number,
    delta: number,
    reason: string,
    now: number,
    options?: {
        metadataUpdate?: Record<string, unknown>;
        replaceMode?: boolean;
    },
): OngoingCardCounterChangedEvent {
    return {
        type: SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED,
        payload: {
            cardUid,
            baseIndex,
            delta,
            reason,
            ...(options?.metadataUpdate ? { metadataUpdate: options.metadataUpdate } : {}),
            ...(options?.replaceMode ? { replaceMode: true } : {}),
        },
        timestamp: now,
    };
}

/** 队列化随从打出后效果（如打出后自动+1指示物），在 fireMinionPlayedTriggers 中消费 */
export function queueMinionPlayEffect(
    playerId: PlayerId,
    effect: 'addPowerCounter' | 'addTempPower' | 'grantExtraActionForPlayedMinion',
    amount: number,
    now: number,
    reason?: string,
): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_PLAY_EFFECT_QUEUED,
        payload: { playerId, effect, amount, ...(reason ? { reason } : {}) },
        timestamp: now,
    } as unknown as SmashUpEvent;
}

/** 生成移除力量指示物事件 */
export function removePowerCounter(
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    now: number,
    source?: {
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): PowerCounterRemovedEvent {
    return {
        type: SU_EVENTS.POWER_COUNTER_REMOVED,
        payload: {
            minionUid,
            baseIndex,
            amount,
            reason,
            ...(source?.sourcePlayerId !== undefined ? { sourcePlayerId: source.sourcePlayerId } : {}),
            ...(source?.sourceCardUid !== undefined ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceDefId !== undefined ? { sourceDefId: source.sourceDefId } : {}),
            ...(source?.sourceControllerId !== undefined ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
        },
        timestamp: now,
    };
}

/** 生成临时力量修正事件（回合结束自动清零） */
export function addTempPower(
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    now: number,
    source?: {
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): TempPowerAddedEvent {
    return {
        type: SU_EVENTS.TEMP_POWER_ADDED,
        payload: {
            minionUid,
            baseIndex,
            amount,
            reason,
            ...(source?.sourcePlayerId !== undefined ? { sourcePlayerId: source.sourcePlayerId } : {}),
            ...(source?.sourceCardUid !== undefined ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceDefId !== undefined ? { sourceDefId: source.sourceDefId } : {}),
            ...(source?.sourceControllerId !== undefined ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
        },
        timestamp: now,
    };
}

/** 生成永久力量修正事件（非指示物，不可移动/转移） */
export function addPermanentPower(
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    now: number,
    options?: {
        expiresOnTurnNumber?: number;
        expiresOnPlayerId?: PlayerId;
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): PermanentPowerAddedEvent {
    return {
        type: SU_EVENTS.PERMANENT_POWER_ADDED,
        payload: {
            minionUid,
            baseIndex,
            amount,
            reason,
            ...(options?.expiresOnTurnNumber !== undefined ? { expiresOnTurnNumber: options.expiresOnTurnNumber } : {}),
            ...(options?.expiresOnPlayerId !== undefined ? { expiresOnPlayerId: options.expiresOnPlayerId } : {}),
            ...(options?.sourcePlayerId !== undefined ? { sourcePlayerId: options.sourcePlayerId } : {}),
            ...(options?.sourceCardUid !== undefined ? { sourceCardUid: options.sourceCardUid } : {}),
            ...(options?.sourceDefId !== undefined ? { sourceDefId: options.sourceDefId } : {}),
            ...(options?.sourceControllerId !== undefined ? { sourceControllerId: options.sourceControllerId } : {}),
            ...(options?.sourceBaseIndex !== undefined ? { sourceBaseIndex: options.sourceBaseIndex } : {}),
        },
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
    now: number,
    options?: {
        clearBaseDiscard?: boolean;
        newBaseDiscardDefIds?: string[];
    },
): BaseDeckShuffledEvent {
    return {
        type: SU_EVENTS.BASE_DECK_SHUFFLED,
        payload: {
            newBaseDeckDefIds,
            reason,
            ...(options?.clearBaseDiscard ? { clearBaseDiscard: true } : {}),
            ...(options?.newBaseDiscardDefIds ? { newBaseDiscardDefIds: options.newBaseDiscardDefIds } : {}),
        },
        timestamp: now,
    };
}

/** 生成展示手牌事件 */
export function revealHand(
    targetPlayerId: PlayerId | PlayerId[],
    viewerPlayerId: PlayerId | 'all',
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

    const splitDiscardByOwnerForDeckRebuild = (
        discardCards: CardInstance[],
    ): { sourceCards: CardInstance[]; ownerDeckEvents: DeckReorderedEvent[] } => {
        const sourceCards: CardInstance[] = [];
        const borrowedByOwner = new Map<PlayerId, CardInstance[]>();

        for (const card of discardCards) {
            if (card.owner !== playerId && state.players[card.owner]) {
                borrowedByOwner.set(card.owner, [...(borrowedByOwner.get(card.owner) ?? []), card]);
                continue;
            }
            sourceCards.push(card);
        }

        return {
            sourceCards,
            ownerDeckEvents: Array.from(borrowedByOwner.entries()).map(([ownerId, cards]) => ({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    sourcePlayerId: playerId,
                    deckUids: [...state.players[ownerId].deck.map(card => card.uid), ...cards.map(card => card.uid)],
                },
                timestamp: now,
            }) as DeckReorderedEvent),
        };
    };

    // 规则：当需要 look/reveal/search/draw 而牌库为空时，将弃牌堆洗入牌库并继续。
    // peekDeckTop 不消耗牌库顶，只在必要时重排牌库顺序（DECK_REORDERED）。
    const events: SmashUpEvent[] = [];
    if (player.deck.length === 0) {
        if (player.discard.length === 0) return undefined;
        const shuffled = random.shuffle([...player.discard]);
        const { sourceCards, ownerDeckEvents } = splitDiscardByOwnerForDeckRebuild(shuffled);
        events.push(...ownerDeckEvents);
        if (sourceCards.length === 0) return undefined;
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: sourceCards.map(c => c.uid),
            },
            timestamp: now,
        } as DeckReorderedEvent);
        // 注意：此处不直接修改 state；由 reducer 根据 DECK_REORDERED 更新 deck/discard 后，
        // 才会在后续流程中体现为“弃牌堆洗回牌库”。
        // 为了本次 peek 能返回正确的 card，我们用模拟的 sourceCards[0]。
        const card = sourceCards[0];
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
    let triggerCore = core;
    const events: SmashUpEvent[] = [];
    const preOnPlayTriggerBaseMinionUids = new Set(core.bases[baseIndex]?.minions.map((minion) => minion.uid) ?? []);

    // 注意：此函数被 postProcessSystemEvents 调用时，MINION_PLAYED 事件已经被 reduce 到 core 中
    // 所以随从已经在基地上了，不需要再次 reduce

    // 1. onPlay 能力触发
    const executor = params.playedEvt.payload.skipOnPlayAbility ? undefined : resolveOnPlay(defId);
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
        if (result.events.length > 0) {
            for (const event of result.events) {
                triggerCore = reduce(triggerCore, event);
            }
        }
        if (result.matchState) {
            matchState = {
                ...result.matchState,
                core: triggerCore,
            };
        } else if (triggerCore !== core) {
            matchState = {
                ...matchState,
                core: triggerCore,
            };
        }
    }

    // 2. 基地能力触发 onMinionPlayed（改为入队，按 Wiki 同时触发排序解决）
    const minionDef = getMinionDef(defId);
    const sourceEventId = `minion-played:${cardUid}:${baseIndex}:${now}`;
    const frameId = `minion-played-frame:${cardUid}:${baseIndex}:${now}`;
    const queuedBase = collectBaseAbilityTriggers({
        core: triggerCore,
        timing: 'onMinionPlayed',
        ownerPlayerId: playerId,
        baseIndex,
        triggerMinionUid: cardUid,
        triggerMinionDefId: defId,
        triggerMinionPower: minionDef?.power ?? power,
        frameId,
        sourceEventId,
        now,
    });
    if (queuedBase) events.push(queuedBase as unknown as SmashUpEvent);

    // 3. ongoing 触发器 onMinionPlayed（改为入队，按 Wiki 同时触发排序解决）
    const playedMinion = triggerCore.bases[baseIndex]?.minions.find(m => m.uid === cardUid);
    const suppressedSourceCardUids = (triggerCore.bases[baseIndex]?.minions ?? [])
        .filter(minion => minion.uid !== cardUid && !preOnPlayTriggerBaseMinionUids.has(minion.uid))
        .map(minion => minion.uid);
    const queued = collectTriggers(triggerCore, 'onMinionPlayed', {
        state: triggerCore,
        matchState,
        playerId,
        baseIndex,
        triggerMinionUid: cardUid,
        triggerMinionDefId: defId,
        triggerMinion: playedMinion,
        suppressedSourceCardUids,
        frameId,
        sourceEventId,
        random,
        now,
    });
    if (queued) events.push(queued);

    // 4. 消费 pendingMinionPlayEffects 队列（如 crack_of_dusk / its_alive 的打出后+1指示物）
    const player = triggerCore.players[playerId];
    if (player?.pendingMinionPlayEffects && player.pendingMinionPlayEffects.length > 0) {
        const effect = player.pendingMinionPlayEffects[0];
        if (effect.effect === 'addPowerCounter') {
            events.push(addPowerCounter(cardUid, baseIndex, effect.amount, 'pendingMinionPlayEffect', now));
        } else if (effect.effect === 'addTempPower') {
            events.push(addTempPower(cardUid, baseIndex, effect.amount, effect.reason ?? 'pendingMinionPlayEffect', now, {
                sourcePlayerId: playerId,
                sourceDefId: effect.reason,
                sourceControllerId: playerId,
                sourceBaseIndex: baseIndex,
            }));
        } else if (effect.effect === 'grantExtraActionForPlayedMinion') {
            events.push(grantExtraAction(playerId, effect.reason ?? 'pendingMinionPlayEffect', now, {
                playTiming: 'immediate',
                restrictToMinionUid: cardUid,
            }));
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
    options?: {
        sameNameOnly?: boolean;
        sameNameDefId?: string;
        specificCardUid?: string;
        powerMax?: number;
        playTiming?: 'banked' | 'immediate';
        consumePendingMinionPlayEffectOnSkip?: boolean;
    },
): LimitModifiedEvent {
    return {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: {
            playerId, limitType: 'minion', delta: 1, reason,
            ...(options?.playTiming ? { playTiming: options.playTiming } : {}),
            ...(restrictToBase !== undefined ? { restrictToBase } : {}),
            ...(options?.powerMax !== undefined ? { powerMax: options.powerMax } : {}),
            ...(options?.sameNameOnly ? { sameNameOnly: true } : {}),
            ...(options?.sameNameDefId ? { sameNameDefId: options.sameNameDefId } : {}),
            ...(options?.specificCardUid ? { specificCardUid: options.specificCardUid } : {}),
            ...(options?.consumePendingMinionPlayEffectOnSkip ? { consumePendingMinionPlayEffectOnSkip: true } : {}),
        },
        timestamp: now,
    };
}


/** 生成额外行动额度事件 */
export function grantExtraAction(
    playerId: PlayerId,
    reason: string,
    now: number,
    options?: {
        playTiming?: 'banked' | 'immediate';
        restrictToBase?: number;
        restrictToMinionUid?: string;
        specialActionWindow?: 'meFirst' | 'afterScoring';
        restrictToCardUid?: string;
        restrictToCardDefId?: string;
        restrictToBaseModifier?: boolean;
    },
): LimitModifiedEvent {
    return {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: {
            playerId,
            limitType: 'action',
            delta: 1,
            reason,
            ...(options?.playTiming ? { playTiming: options.playTiming } : {}),
            ...(options?.restrictToBase !== undefined ? { restrictToBase: options.restrictToBase } : {}),
            ...(options?.restrictToMinionUid ? { restrictToMinionUid: options.restrictToMinionUid } : {}),
            ...(options?.specialActionWindow ? { specialActionWindow: options.specialActionWindow } : {}),
            ...(options?.restrictToCardUid ? { restrictToCardUid: options.restrictToCardUid } : {}),
            ...(options?.restrictToCardDefId ? { restrictToCardDefId: options.restrictToCardDefId } : {}),
            ...(options?.restrictToBaseModifier ? { restrictToBaseModifier: true } : {}),
        },
        timestamp: now,
    };
}

export function buildStandardDrawEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    playerId: PlayerId,
    count: number,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    const core = 'core' in state ? state.core : state;
    const player = core.players[playerId];
    if (!player || count <= 0) return [];

    const drawResult = drawCards(player, count, random);
    const events: SmashUpEvent[] = [];

    if (drawResult.reshuffledDeckUids && drawResult.reshuffledDeckUids.length > 0) {
        events.push({
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: {
                playerId,
                deckUids: drawResult.reshuffledDeckUids,
            },
            timestamp: now,
        } as DeckReshuffledEvent);
    }

    if (drawResult.drawnUids.length > 0) {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: {
                playerId,
                count: drawResult.drawnUids.length,
                cardUids: drawResult.drawnUids,
            },
            timestamp: now,
        } as CardsDrawnEvent);
    }

    return events;
}

export function buildStandardDrawEventsFromRuntimeContext(
    runtime: {
        state: SmashUpCore | MatchState<SmashUpCore>;
        random: RandomFn;
        timestamp: number;
    },
    playerId: PlayerId,
    count: number,
): SmashUpEvent[] {
    return buildStandardDrawEvents(runtime.state, playerId, count, runtime.random, runtime.timestamp);
}

export function resolveExtraPlayTiming(matchState?: Pick<MatchState<SmashUpCore>, 'sys'>): 'banked' | 'immediate' {
    return matchState?.sys?.phase === 'playCards' ? 'banked' : 'immediate';
}

export function grantContextualExtraMinion(
    ctx: { playerId: PlayerId; now: number; matchState?: Pick<MatchState<SmashUpCore>, 'sys'> },
    reason: string,
    restrictToBase?: number,
    options?: { sameNameOnly?: boolean; sameNameDefId?: string; powerMax?: number; specificCardUid?: string },
): LimitModifiedEvent {
    return grantExtraMinion(
        ctx.playerId,
        reason,
        ctx.now,
        restrictToBase,
        {
            ...options,
            playTiming: resolveExtraPlayTiming(ctx.matchState),
        },
    );
}

export function grantContextualExtraAction(
    ctx: { playerId: PlayerId; now: number; matchState?: Pick<MatchState<SmashUpCore>, 'sys'> },
    reason: string,
    options?: {
        playTiming?: 'banked' | 'immediate';
        restrictToBase?: number;
        restrictToMinionUid?: string;
        restrictToCardUid?: string;
        restrictToCardDefId?: string;
        restrictToBaseModifier?: boolean;
    },
): LimitModifiedEvent {
    return grantExtraAction(ctx.playerId, reason, ctx.now, {
        playTiming: options?.playTiming ?? resolveExtraPlayTiming(ctx.matchState),
        restrictToBase: options?.restrictToBase,
        restrictToMinionUid: options?.restrictToMinionUid,
        restrictToCardUid: options?.restrictToCardUid,
        restrictToCardDefId: options?.restrictToCardDefId,
        restrictToBaseModifier: options?.restrictToBaseModifier,
    });
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
            if (CTHULHU_EXPANSION_FACTIONS.some((factionId) => factionId === baseFactionId)) return true;
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

/** 计算某位玩家整局持有的疯狂卡数量（含埋葬区） */
export function countMadnessCardsForPlayer(state: SmashUpCore, playerId: PlayerId): number {
    const player = state.players[playerId];
    if (!player) return 0;

    let count = countMadnessCards(player);
    for (const base of state.bases) {
        for (const buried of base.buriedCards ?? []) {
            if (buried.controllerId === playerId && buried.defId === MADNESS_CARD_DEF_ID) {
                count++;
            }
        }
    }

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

type MinionTargetEffectType = ProtectionType | 'buff';

function inferMinionEffectIntent(
    effectType: MinionTargetEffectType | undefined,
): AiEffectIntent | undefined {
    switch (effectType) {
        case 'buff':
            return 'buff';
        case 'destroy':
            return 'destroy';
        case 'move':
            return 'move';
        case 'action':
        case 'affect':
            return 'affect';
        default:
            return undefined;
    }
}

function buildMinionTargetAiHint(args: {
    state: Pick<SmashUpCore, 'seatOrder' | 'players' | 'turnOrder' | 'teamMode'>;
    minion: MinionOnBase;
    sourcePlayerId: PlayerId;
    effectType?: MinionTargetEffectType;
}): AiHint {
    const effectIntent = inferMinionEffectIntent(args.effectType);
    return buildTargetAiHint({
        actorPlayerId: args.sourcePlayerId,
        targetPlayerId: args.minion.controller,
        effectIntent,
        targetKind: 'minion',
        targetOwnerId: args.minion.owner,
        targetControllerId: args.minion.controller,
        relationResolver: ({ actorPlayerId, targetPlayerId }) => getSmashUpRelationToPlayer(
            args.state,
            actorPlayerId as PlayerId | undefined,
            targetPlayerId as PlayerId | undefined,
        ),
    });
}

export function buildPlayerTargetOptions<TExtraValue extends Record<string, unknown> = Record<string, never>>(
    candidates: Array<{
        id?: string;
        label: string;
        targetPlayerId: PlayerId;
        value?: TExtraValue;
        displayMode?: EnginePromptOption<{ targetPlayerId: PlayerId } & TExtraValue>['displayMode'];
        priorityHint?: number;
        forcedTargetPolicy?: AiHint['forcedTargetPolicy'];
    }>,
    context: {
        state?: Pick<SmashUpCore, 'seatOrder' | 'players' | 'turnOrder' | 'teamMode'>;
        sourcePlayerId: PlayerId;
        effectIntent?: AiEffectIntent;
        derivedFrom?: AiHint['derivedFrom'];
    },
): EnginePromptOption<{ targetPlayerId: PlayerId } & TExtraValue>[] {
    const relationResolver = context.state
        ? ({ actorPlayerId, targetPlayerId }: { actorPlayerId?: string; targetPlayerId?: string }) => getSmashUpRelationToPlayer(
            context.state,
            actorPlayerId as PlayerId | undefined,
            targetPlayerId as PlayerId | undefined,
        )
        : undefined;

    return candidates.map((candidate, index) => ({
        id: candidate.id ?? `player-${index}`,
        label: candidate.label,
        value: {
            targetPlayerId: candidate.targetPlayerId,
            ...((candidate.value ?? {}) as TExtraValue),
        },
        ...(candidate.displayMode ? { displayMode: candidate.displayMode } : {}),
        _ai: buildTargetAiHint({
            actorPlayerId: context.sourcePlayerId,
            targetPlayerId: candidate.targetPlayerId,
            effectIntent: context.effectIntent,
            targetKind: 'player',
            priorityHint: candidate.priorityHint,
            forcedTargetPolicy: candidate.forcedTargetPolicy,
            derivedFrom: context.derivedFrom ?? 'inferred',
            ...(relationResolver ? { relationResolver } : {}),
        }),
    }));
}

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
        /** 来源卡牌 defId；若是行动卡，会自动尊重 action 保护 */
        sourceDefId?: string;
        /** 显式来源类型；仅在无法提供 sourceDefId 时使用 */
        sourceKind?: 'action' | 'nonAction';
        /** 查询语义角色；仅真正施加效果时使用 target 过滤 */
        semanticRole?: SemanticTargetRole;
        /** 效果类型覆盖（可选，不传则自动检查 destroy + affect） */
        effectType?: MinionTargetEffectType;
        /** 是否额外尊重“行动卡保护”（如烟雾弹） */
        respectActionProtection?: boolean;
    }
): EnginePromptOption<{
    minionUid: string;
    baseIndex: number;
    defId: string;
    minionDefId: string;
    baseDefId?: string;
}>[] {
    const {
        state,
        sourcePlayerId,
        sourceDefId,
        sourceKind,
        semanticRole = 'target',
        effectType,
        respectActionProtection = false,
    } = context;
    const effectSourceKind = inferSemanticSourceKind(sourceKind, sourceDefId);
    const semanticEffectType: MinionSemanticEffectType | undefined = effectType;
    const filteredCandidates = semanticRole !== 'target' ? candidates : candidates.filter(c => {
        const minion = state.bases[c.baseIndex]?.minions.find(m => m.uid === c.uid);
        if (!minion) return false;
        return isMinionTargetAllowed(state, minion, c.baseIndex, {
            sourcePlayerId,
            sourceKind: effectSourceKind,
            effectType: semanticEffectType ?? 'destroy',
            respectActionProtection,
            mode: 'preview',
        });
    });

    return filteredCandidates.map((c, i) => {
        const minion = state.bases[c.baseIndex]?.minions.find(m => m.uid === c.uid);
        if (!minion) {
            return {
                id: `minion-${i}`,
                label: c.label,
                value: {
                    minionUid: c.uid,
                    baseIndex: c.baseIndex,
                    defId: c.defId,
                    minionDefId: c.defId,
                    baseDefId: state.bases[c.baseIndex]?.defId,
                },
                _source: 'field' as const,
            };
        }

        return {
            id: `minion-${i}`,
            label: c.label,
            value: {
                minionUid: c.uid,
                baseIndex: c.baseIndex,
                defId: c.defId,
                minionDefId: c.defId,
                baseDefId: state.bases[c.baseIndex]?.defId,
            },
            _source: 'field' as const,
            _ai: buildMinionTargetAiHint({
                state,
                minion,
                sourcePlayerId,
                effectType,
            }),
        };
    });
}

/**
 * 构建“行动卡来源”的随从目标选择选项。
 *
 * 仅用于行动卡/特殊行动卡/行动卡持续效果这类真实会影响目标随从的场景。
 * 若某张行动只是把随从当作参照物（例如查同名、统计条件），不要用这个 helper。
 */
export function buildActionMinionTargetOptions(
    candidates: { uid: string; defId: string; baseIndex: number; label: string }[],
    context: {
        state: SmashUpCore;
        sourcePlayerId: PlayerId;
        sourceDefId?: string;
        effectType?: MinionTargetEffectType;
    },
): EnginePromptOption<{ minionUid: string; baseIndex: number; defId: string }>[] {
    return buildMinionTargetOptions(candidates, {
        ...context,
        sourceKind: 'action',
        respectActionProtection: true,
    });
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

export function buildSemanticProtectionFeedback(
    playerId: PlayerId,
    blockedCount: number,
    appliedCount: number,
    now: number,
    options?: {
        allBlockedMessageKey?: 'feedback.all_protected' | 'feedback.target_protected';
    },
): AbilityFeedbackEvent[] {
    if (blockedCount <= 0) return [];
    return [
        buildAbilityFeedback(
            playerId,
            appliedCount === 0
                ? (options?.allBlockedMessageKey ?? 'feedback.all_protected')
                : 'feedback.target_protected',
            now,
            undefined,
            'warning',
        ),
    ];
}

function buildSemanticSingleMinionEffectEvents<TMinion extends MinionOnBase>(
    state: SmashUpCore | MatchState<SmashUpCore>,
    candidate: SemanticMinionTargetCandidate<TMinion>,
    options: MinionTargetSemanticOptions & {
        feedbackPlayerId?: PlayerId;
        now: number;
        allBlockedMessageKey?: 'feedback.all_protected' | 'feedback.target_protected';
    },
    buildEvents: (candidate: SemanticMinionTargetCandidate<TMinion>) => SmashUpEvent[],
): SmashUpEvent[] {
    const core = 'core' in state ? state.core : state;
    const partitioned = partitionMinionTargetsBySemantics(core, [candidate], options);
    if (partitioned.allowed.length > 0) {
        return buildEvents(partitioned.allowed[0]);
    }

    const events = options.feedbackPlayerId
        ? buildSemanticProtectionFeedback(
            options.feedbackPlayerId,
            partitioned.blocked.length,
            0,
            options.now,
            { allBlockedMessageKey: options.allBlockedMessageKey },
        )
        : [];

    for (const blocked of partitioned.blocked) {
        if (!blocked.blockInfo.consumableSource) continue;
        events.push(buildProtectionSelfDestructEvent(
            blocked.blockInfo.consumableSource,
            blocked.baseIndex,
            options.now,
        ));
    }

    return events;
}

export function applySemanticMinionEffectBatch<TMinion extends MinionOnBase>(
    state: SmashUpCore | MatchState<SmashUpCore>,
    candidates: readonly SemanticMinionTargetCandidate<TMinion>[],
    options: MinionTargetSemanticOptions & {
        buildEvents: (candidate: SemanticMinionTargetCandidate<TMinion>) => SmashUpEvent[];
        feedbackPlayerId?: PlayerId;
        now?: number;
        allBlockedMessageKey?: 'feedback.all_protected' | 'feedback.target_protected';
    },
): {
    events: SmashUpEvent[];
    allowed: Array<SemanticMinionTargetCandidate<TMinion>>;
    blocked: Array<SemanticMinionTargetCandidate<TMinion> & {
        blockInfo: import('./effectSemantics').MinionTargetBlockInfo;
    }>;
} {
    const core = 'core' in state ? state.core : state;
    const partitioned = partitionMinionTargetsBySemantics(core, candidates, options);
    const events = partitioned.allowed.flatMap((candidate) => options.buildEvents(candidate));

    if (options.feedbackPlayerId && options.now !== undefined) {
        events.push(...buildSemanticProtectionFeedback(
            options.feedbackPlayerId,
            partitioned.blocked.length,
            events.length,
            options.now,
            { allBlockedMessageKey: options.allBlockedMessageKey },
        ));
    }

    return {
        events,
        allowed: partitioned.allowed,
        blocked: partitioned.blocked,
    };
}

export function buildSemanticOngoingAttachEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        sourcePlayerId?: PlayerId;
        sourceKind?: 'action' | 'nonAction';
        targetBaseIndex: number;
        targetMinionUid?: string;
        metadata?: Record<string, unknown>;
        talentUsed?: boolean;
        removeFromDiscard?: boolean;
        onBlockedSourceDestination?: 'discard' | 'hand';
        now: number;
    },
): SmashUpEvent[] {
    const core = 'core' in state ? state.core : state;
    if (!params.targetMinionUid) {
        return [{
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: params.cardUid,
                defId: params.defId,
                ownerId: params.ownerId,
                ...(params.sourcePlayerId !== undefined ? { sourcePlayerId: params.sourcePlayerId } : {}),
                targetType: 'base',
                targetBaseIndex: params.targetBaseIndex,
                ...(params.metadata ? { metadata: params.metadata } : {}),
                ...(params.talentUsed !== undefined ? { talentUsed: params.talentUsed } : {}),
                ...(params.removeFromDiscard !== undefined ? { removeFromDiscard: params.removeFromDiscard } : {}),
            },
            timestamp: params.now,
        } as OngoingAttachedEvent];
    }

    const minion = core.bases[params.targetBaseIndex]?.minions.find(
        (candidate) => candidate.uid === params.targetMinionUid,
    );
    if (!minion) return [];

    const sourcePlayerId = params.sourcePlayerId ?? params.ownerId;
    const partitioned = partitionMinionTargetsBySemantics(
        core,
        [{ minion, baseIndex: params.targetBaseIndex }],
        {
            sourcePlayerId,
            sourceDefId: params.defId,
            sourceKind: params.sourceKind ?? inferSemanticSourceKind(undefined, params.defId),
            effectType: 'affect',
            respectActionProtection: true,
            mode: 'apply',
        },
    );

    if (partitioned.blocked.length > 0) {
        return [
            ...buildSemanticProtectionFeedback(
                sourcePlayerId,
                partitioned.blocked.length,
                0,
                params.now,
                { allBlockedMessageKey: 'feedback.target_protected' },
            ),
            ...(params.onBlockedSourceDestination
                ? [buildOngoingDetachedEvent({
                    cardUid: params.cardUid,
                    defId: params.defId,
                    ownerId: params.ownerId,
                    reason: `${params.defId}_blocked_attach`,
                    destination: params.onBlockedSourceDestination,
                    sourcePlayerId: params.sourcePlayerId,
                    now: params.now,
                })]
                : []),
            ...partitioned.blocked.flatMap(({ blockInfo }) => (
                blockInfo.consumableSource
                    ? [buildProtectionSelfDestructEvent(blockInfo.consumableSource, params.targetBaseIndex, params.now)]
                    : []
            )),
        ];
    }

    return [{
        type: SU_EVENTS.ONGOING_ATTACHED,
        payload: {
            cardUid: params.cardUid,
            defId: params.defId,
            ownerId: params.ownerId,
            ...(params.sourcePlayerId !== undefined ? { sourcePlayerId: params.sourcePlayerId } : {}),
            targetType: 'minion',
            targetBaseIndex: params.targetBaseIndex,
            targetMinionUid: params.targetMinionUid,
            ...(params.metadata ? { metadata: params.metadata } : {}),
            ...(params.talentUsed !== undefined ? { talentUsed: params.talentUsed } : {}),
            ...(params.removeFromDiscard !== undefined ? { removeFromDiscard: params.removeFromDiscard } : {}),
        },
        timestamp: params.now,
    } as OngoingAttachedEvent];
}
