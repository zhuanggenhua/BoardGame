/**
 * SmashUp ongoing effects registry and runtime helpers.
 * Centralizes protection, restriction, trigger and interceptor lookup.
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type {
    ActiveDuel,
    DuelOutcomeKind,
    SmashUpCore,
    SmashUpEvent,
    MinionOnBase,
    SmashUpReactionResourceFootprint,
    TriggerInstance,
    TriggerQueuedEvent,
    PlayerTurnRestrictionType } from './types';
import { SU_EVENTS } from './types';
import { registerTriggerExecutor } from './triggerExecutors';
import { getBaseDef, getCardDef, getTitanDef } from '../data/cards';
import { getAllCardDefs } from '../data/cards';
import { isSameNameDefId, matchesDefId, mustUseBaseLimitedMinionQuota } from './utils';
import { shouldGenerateSmashUpPodAlias } from './variantBindingRuntime';
import { buildValidatedOngoingDetachEvents, findLiveOngoingCardLocation } from './ongoingDetach';

// ============================================================================
// Registry types
// ============================================================================


export type ProtectionType =
    | 'destroy'
    | 'move'
    | 'affect'
    | 'action';


export type BaseAbilitySuppressionChecker = (state: SmashUpCore, baseIndex: number) => boolean;
export type BaseScoringSuppressionChecker = (state: SmashUpCore, baseIndex: number) => boolean;
export type BaseVpModifierChecker = (state: SmashUpCore, baseIndex: number, playerId: PlayerId, currentVp: number) => number;
export type CardAbilitySuppressionChecker = (state: SmashUpCore, turnScopedSuppressedCardUids: ReadonlySet<string>) => string[];


export interface ProtectionCheckContext {
    state: SmashUpCore;

    targetMinion: MinionOnBase;

    targetBaseIndex: number;

    sourcePlayerId: PlayerId;

    sourceKind?: 'action' | 'nonAction';

    /** 造成当前影响的牌定义，用于“只保护本次牌”的选择性保护。 */
    sourceDefId?: string;

    sourceBaseIndex?: number;

    protectionType: ProtectionType;
}


export type ProtectionChecker = (ctx: ProtectionCheckContext) => boolean;


export type RestrictionType =
    | 'play_minion'
    | 'play_action';


export interface RestrictionCheckContext {
    state: SmashUpCore;

    baseIndex: number;

    playerId: PlayerId;

    restrictionType: RestrictionType;

    extra?: Record<string, unknown>;
}


export type RestrictionChecker = (ctx: RestrictionCheckContext) => boolean;

export type EventInterceptor = (
    state: SmashUpCore,
    event: SmashUpEvent
) => SmashUpEvent | SmashUpEvent[] | null | undefined;


export type TriggerTiming =
    | 'onDuelStarted'
    | 'onDuelResolved'
    | 'onMinionPlayed'
    | 'onActionPlayed'
    | 'onMonsterDestroyed'
    | 'onVpAwarded'
    | 'onCardsDiscarded'
    | 'onCardBuried'
    | 'onBuriedCardUncovered'
    | 'onBaseRevealed'
    | 'onMinionDestroyed'
    | 'onMinionMoved'
    | 'onCardTransferred'
    | 'onCardReturnedToHand'
    | 'onCardDestroyed'
    | 'onDeckInspected'
    | 'onMinionAffected'
    | 'onMinionDiscardedFromBase'
    | 'onTalentUsed'
    | 'onTurnEnd'
    | 'onTurnStart'
    | 'beforeScoring'
    | 'afterScoring';

export type TitanAwareTriggerTiming = TriggerTiming | 'whenScoring' | 'onTitanMoved';

export type AffectType =
    | 'destroy'
    | 'move'
    | 'return'
    | 'power_change'
    | 'attach_action'
    | 'control_change'
    | 'cancel_ability'
    | 'shuffle_into_deck';


export interface TriggerContext {
    state: SmashUpCore;
    /** 完整的 match 状态，用于触发器创建交互 */
    matchState?: MatchState<SmashUpCore>;
    timing: TitanAwareTriggerTiming;
    /** 触发来源 defId（queued trigger 在源对象离场后仍可依赖） */
    sourceDefId?: string;
    /** 同一事件/同一牌的反应 frame */
    frameId?: string;
    /** 触发来源事件 id */
    sourceEventId?: string;
    /** 具体触发来源实例 uid */
    sourceCardUid?: string;
    /** 具体触发来源 defId；用于 source 尚未入场时的 explicit fallback */
    sourceDefId?: string;
    /** 触发来源所在基地 */
    sourceBaseIndex?: number;
    /** 触发来源控制者 */
    sourceControllerId?: PlayerId;
    /** 触发来源真实拥有者；用于 explicit fallback / replay 路径保真 */
    sourceOwnerPlayerId?: PlayerId;
    /** 事件关联玩家 */
    playerId: PlayerId;
    /** 事件关联基地 */
    baseIndex?: number;
    /** 决斗上下文（onDuelStarted / onDuelResolved） */
    duel?: ActiveDuel;
    duelSourceId?: string;
    duelOutcome?: DuelOutcomeKind;
    duelChallenger?: MinionOnBase;
    duelChallenged?: MinionOnBase;
    duelWinner?: MinionOnBase;
    duelLoser?: MinionOnBase;
    duelTie?: boolean;
    /** onMinionMoved 时：移动前基地 */
    moveFromBaseIndex?: number;
    /** onMinionMoved 时：移动后基地 */
    moveToBaseIndex?: number;
    /** 同批移动的随从 UID 列表；用于批量移动时抑制组内互相见证。 */
    simultaneousMoveBatchMinionUids?: string[];
    /** 触发相关随从 */
    triggerMinion?: MinionOnBase;
    /** 触发相关随从 UID */
    triggerMinionUid?: string;
    /** 触发相关随从 defId */
    triggerMinionDefId?: string;
    /** 触发相关随从力量 */
    triggerMinionPower?: number;
    /** Munchkin 怪物被击败时的快照 */
    destroyedMonsterUid?: string;
    destroyedMonsterDefId?: string;
    destroyedMonsterPower?: number;
    /** onMinionPlayed 时：触发相关随从是否从牌库打出 */
    triggerMinionFromDeck?: boolean;
    /** 触发相关场上行动牌 UID */
    triggerCardUid?: string;
    /** 触发相关场上行动牌 defId */
    triggerCardDefId?: string;
    /** 触发相关场上行动牌拥有者 */
    triggerCardOwnerId?: PlayerId;
    /** 触发相关场上行动牌类型 */
    triggerCardKind?: 'ongoing' | 'attached_action';
    /** onCardTransferred 时：被转移卡牌 */
    transferredCardUid?: string;
    transferredCardDefId?: string;
    transferredCardOwnerId?: PlayerId;
    transferredFromPlayerId?: PlayerId;
    transferredToPlayerId?: PlayerId;
    /** onCardsDiscarded 时：弃置/磨掉的卡牌快照 */
    discardedCards?: Array<{ uid: string; defId: string; ownerId: PlayerId }>;
    discardedFromZone?: 'hand' | 'deck';
    /** 收集 trigger 时应排除的来源实例 UID（例如 onPlay 才被移动进来的“晚到见证者”）。 */
    suppressedSourceCardUids?: string[];
    /** 消灭者（仅 onMinionDestroyed） */
    destroyerId?: PlayerId;
    /** 事件里相关随从/对象的控制者 */
    controllerId?: PlayerId;
    /** 事件原因 */
    reason?: string;
    /** VP 变化量（仅 onVpAwarded） */
    vpAmount?: number;
    /** 影响类型（仅 onMinionAffected） */
    affectType?: AffectType;
    /** 指示物变化类型（仅 onMinionAffected + power_change） */
    counterChangeKind?: 'added' | 'removed';
    /** 指示物变化量（added 为正，removed 为负） */
    counterDelta?: number;
    /** onMinionAffected 时的原始影响事件，用于可选复制等需要保留原事件语义的场景 */
    affectEvent?: SmashUpEvent;
    /** onMinionAffected 时，同一原始事件命中的随从目标快照，用于去重/按批判断 */
    affectBatchTargets?: Array<{ minionUid: string; baseIndex: number; controllerId: PlayerId }>;
    /** 基地计分排名（仅 afterScoring） */
    rankings?: { playerId: PlayerId; power: number; vp: number }[];
    /** 埋葬/翻开相关卡牌 UID */
    buriedCardUid?: string;
    /** 埋葬/翻开相关卡牌 defId */
    buriedCardDefId?: string;
    /** 埋葬/翻开相关卡牌控制者 */
    buriedCardControllerId?: PlayerId;
    /** 埋葬来源 */
    buriedFrom?: 'hand' | 'discard' | 'play' | 'deck';
    /** onActionPlayed 时：行动牌目标基地 */
    actionTargetBaseIndex?: number;
    /** onActionPlayed 时：行动牌目标类型 */
    actionTargetType?: 'base' | 'minion';
    /** onActionPlayed 时：行动牌目标随从 */
    actionTargetMinionUid?: string;
    /** REVEAL_HAND / REVEAL_DECK_TOP / onDeckInspected 时：暴露卡牌 */
    inspectionCards?: Array<{ uid: string; defId: string }>;
    /** REVEAL_HAND / REVEAL_DECK_TOP / onDeckInspected 时：暴露区域 */
    inspectionZone?: 'deck' | 'hand';
    /** REVEAL_HAND / REVEAL_DECK_TOP / onDeckInspected 时：被查看玩家 */
    inspectionTargetPlayerIds?: PlayerId[];
    /** REVEAL_HAND / REVEAL_DECK_TOP / onDeckInspected 时：实际查看者 */
    inspectionCausePlayerId?: PlayerId;
    random: RandomFn;
    now: number;
    /** 同一次 fireTriggers 调用内共享的临时状态（用于跨实例去重等） */
    triggerSharedState?: Record<string, unknown>;
}


export interface TriggerResult {
    events: SmashUpEvent[];

    matchState?: MatchState<SmashUpCore>;
}


export type TriggerCallback = (ctx: TriggerContext) => SmashUpEvent[] | TriggerResult;

/**
 * 从牌定义注册通用生命周期。生命周期只使用 collectTriggers 提供的来源实例，
 * 因此不会因 POD ID、同名牌或场上多张实例而重新扫描并误删其它牌。
 */
export function registerDataDrivenOngoingLifecycles(): void {
    for (const def of getAllCardDefs()) {
        if (def.type !== 'action' || def.subtype !== 'ongoing' || !def.lifecycle) continue;
        const lifecycle = def.lifecycle.expires;
        const callback: TriggerCallback = (ctx) => {
            if (!ctx.sourceCardUid) return [];
            if (lifecycle.actor === 'owner' && ctx.sourceOwnerPlayerId !== ctx.playerId) return [];
            const live = findLiveOngoingCardLocation(ctx.state, ctx.sourceCardUid);
            if (!live) return [];
            if (lifecycle.condition?.talentUsed !== undefined) {
                const armed = live.metadata?.lifecycleArmed === true;
                if (live.talentUsed !== lifecycle.condition.talentUsed && !armed) return [];
            }
            return buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: ctx.sourceCardUid,
                reason: lifecycle.reason ?? ctx.sourceDefId ?? def.id,
                now: ctx.now,
                destination: lifecycle.destination,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.sourceCardUid,
                sourceDefId: ctx.sourceDefId,
                sourceControllerId: ctx.sourceControllerId,
                sourceBaseIndex: ctx.sourceBaseIndex,
            });
        };
        registerTrigger(def.id, lifecycle.timing, callback, {
            perInstance: true,
            mandatory: true,
            playerContext: lifecycle.actor === 'sourceController' ? 'sourceController' : 'eventPlayer',
            canTrigger: lifecycle.actor === 'owner'
                ? (ctx) => ctx.sourceOwnerPlayerId === ctx.playerId
                : undefined,
            // 不提供静态空合同：排序必须从真实 detach 事件推导 hand/discard 写入，
            // 否则多个同一时点的生命周期触发会错误地跳过规则要求的排序选择。
        });
    }
}

// ============================================================================
// UI helpers
// ============================================================================

interface ProtectionEntry {

    sourceDefId: string;
    protectionType: ProtectionType;
    checker: ProtectionChecker;

    consumable?: boolean;
    generatedPodAlias?: boolean;
}

interface RestrictionEntry {
    sourceDefId: string;
    restrictionType: RestrictionType;
    checker: RestrictionChecker;
    global?: boolean;
    generatedPodAlias?: boolean;
}

interface TriggerEntry {
    sourceDefId: string;
    timing: TitanAwareTriggerTiming;
    rawCallback: TriggerCallback;
    callback: TriggerCallback;
    canTrigger?: (ctx: TriggerContext) => boolean;
    optional?: boolean;
    mandatory?: boolean;
    phase?: 'replacement' | 'reaction';
    playerContext?: 'eventPlayer' | 'sourceController' | 'sourceHostController';
    baseScoped?: boolean;

    perInstance?: boolean;

    sourceScope?: 'any' | 'triggerBase';
    effectContract?: import('./types').SmashUpReactionResourceFootprint;
    /**
     * Global triggers bypass the "source must be in play" witness check.
     * Use for Special cards that can be played from hand/discard when a condition happens.
     */
    global?: boolean;

    globalZones?: Array<'hand' | 'discard' | 'deck'>;
    fallbackFootprint?: import('./types').SmashUpReactionResourceFootprint & { fallbackReason: string };
    generatedPodAlias?: boolean;
}

interface TriggerSourceLocation {
    uid?: string;
    baseIndex?: number;
    controllerId?: PlayerId;
    ownerId?: PlayerId;
    hostControllerId?: PlayerId;
    titanUid?: string;
}

interface InterceptorEntry {
    sourceDefId: string;
    interceptor: EventInterceptor;
    generatedPodAlias?: boolean;
}

interface BaseAbilitySuppressionEntry {
    sourceDefId: string;
    checker: BaseAbilitySuppressionChecker;
    generatedPodAlias?: boolean;
}

interface BaseScoringSuppressionEntry {
    sourceDefId: string;
    checker: BaseScoringSuppressionChecker;
    generatedPodAlias?: boolean;
}

interface BaseVpModifierEntry {
    sourceDefId: string;
    checker: BaseVpModifierChecker;
    generatedPodAlias?: boolean;
}

interface CardAbilitySuppressionEntry {
    sourceDefId: string;
    checker: CardAbilitySuppressionChecker;
    generatedPodAlias?: boolean;
}

// ============================================================================

// ============================================================================

const protectionRegistry: ProtectionEntry[] = [];
const restrictionRegistry: RestrictionEntry[] = [];
const triggerRegistry: TriggerEntry[] = [];
const interceptorRegistry: InterceptorEntry[] = [];
const baseAbilitySuppressionRegistry: BaseAbilitySuppressionEntry[] = [];
const baseScoringSuppressionRegistry: BaseScoringSuppressionEntry[] = [];
const baseVpModifierRegistry: BaseVpModifierEntry[] = [];
const cardAbilitySuppressionRegistry: CardAbilitySuppressionEntry[] = [];

type CardSuppressionCacheEntry = {
    suppressedUids: ReadonlySet<string>;
    filteredStateBySourceDefId: Map<string, SmashUpCore>;
};

let cardSuppressionCacheByState = new WeakMap<SmashUpCore, CardSuppressionCacheEntry>();

function resetCardSuppressionCache(): void {
    cardSuppressionCacheByState = new WeakMap();
}

function shouldExposePodOngoingAlias(defId: string): boolean {
    const podCard = getCardDef(`${defId}_pod`);
    if (podCard) {
        return podCard.abilityTags?.includes('ongoing') ?? false;
    }
    return Boolean(getBaseDef(`${defId}_pod`));
}

function shouldHideGeneratedPodOngoingAlias(
    entries: Array<{ sourceDefId: string; generatedPodAlias?: boolean }>,
    sourceDefId: string,
): boolean {
    if (!sourceDefId.endsWith('_pod')) return false;
    const related = entries.filter((entry) => entry.sourceDefId === sourceDefId);
    if (related.length === 0) return false;
    if (related.some((entry) => !entry.generatedPodAlias)) return false;
    return !shouldExposePodOngoingAlias(sourceDefId.slice(0, -4));
}


export function registerProtection(
    sourceDefId: string,
    protectionType: ProtectionType,
    checker: ProtectionChecker,
    options?: { consumable?: boolean; generatedPodAlias?: boolean }
): void {

    if (protectionRegistry.some(e => e.sourceDefId === sourceDefId && e.protectionType === protectionType)) return;
    protectionRegistry.push({
        sourceDefId,
        protectionType,
        checker,
        consumable: options?.consumable,
        generatedPodAlias: options?.generatedPodAlias,
    });
}


export function registerRestriction(
    sourceDefId: string,
    restrictionType: RestrictionType,
    checker: RestrictionChecker,
    options?: { generatedPodAlias?: boolean; global?: boolean },
): void {

    if (restrictionRegistry.some(e => e.sourceDefId === sourceDefId && e.restrictionType === restrictionType)) return;
    restrictionRegistry.push({
        sourceDefId,
        restrictionType,
        checker,
        global: options?.global,
        generatedPodAlias: options?.generatedPodAlias,
    });
}

export function registerTrigger(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    callback: TriggerCallback,
    options?: {
        canTrigger?: (ctx: TriggerContext) => boolean;
        optional?: boolean;
        mandatory?: boolean;
        phase?: 'replacement' | 'reaction';
        global?: boolean;
        globalZones?: Array<'hand' | 'discard' | 'deck'>;
        playerContext?: 'eventPlayer' | 'sourceController' | 'sourceHostController';
        baseScoped?: boolean;
        perInstance?: boolean;
        sourceScope?: 'any' | 'triggerBase';
        effectContract?: import('./types').SmashUpReactionResourceFootprint;
        fallbackFootprint?: import('./types').SmashUpReactionResourceFootprint & { fallbackReason: string };
        generatedPodAlias?: boolean;
    }
): void {

    if (triggerRegistry.some(e => e.sourceDefId === sourceDefId && e.timing === timing)) return;
    triggerRegistry.push({
        sourceDefId,
        timing,
        rawCallback: callback,
        callback,
        canTrigger: options?.canTrigger,
        optional: options?.optional,
        mandatory: options?.mandatory,
        phase: options?.phase ?? 'reaction',
        perInstance: options?.perInstance,
        sourceScope: options?.sourceScope ?? 'any',
        effectContract: options?.effectContract,
        global: options?.global,
        globalZones: options?.globalZones,
        playerContext: options?.playerContext ?? 'eventPlayer',
        baseScoped: options?.baseScoped ?? true,
        fallbackFootprint: options?.fallbackFootprint,
        generatedPodAlias: options?.generatedPodAlias,
    });
    registerTriggerExecutor(sourceDefId, timing, callback);
}

function locateSources(state: SmashUpCore, sourceDefId: string): TriggerSourceLocation[] {
    const locations: TriggerSourceLocation[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        if (base.defId === sourceDefId) locations.push({ baseIndex: i });
        for (const ongoing of base.ongoingActions.filter(o => o.defId === sourceDefId)) {
            const metadata = ongoing.metadata as { sourceControllerId?: PlayerId; sourcePlayerId?: PlayerId } | undefined;
            locations.push({
                uid: ongoing.uid,
                baseIndex: i,
                controllerId: metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? ongoing.ownerId,
                ownerId: ongoing.ownerId,
            });
        }
        for (const minion of base.minions.filter(m => m.defId === sourceDefId)) {
            locations.push({
                uid: minion.uid,
                baseIndex: i,
                controllerId: minion.controller,
                ownerId: minion.owner,
            });
        }
        for (const m of base.minions) {
            for (const attached of m.attachedActions?.filter(a => a.defId === sourceDefId) ?? []) {
                const metadata = attached.metadata as { sourceControllerId?: PlayerId; sourcePlayerId?: PlayerId } | undefined;
                locations.push({
                    uid: attached.uid,
                    baseIndex: i,
                    controllerId: metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? attached.ownerId,
                    ownerId: attached.ownerId,
                    hostControllerId: m.controller,
                });
            }
        }
    }
    for (const titan of state.titans ?? []) {
        if (titan.defId !== sourceDefId || titan.location.zone !== 'base') continue;
        locations.push({
            uid: titan.uid,
            titanUid: titan.uid,
            baseIndex: titan.location.baseIndex,
            controllerId: titan.controllerId,
            ownerId: titan.ownerId,
        });
    }
    for (const special of state.pendingAfterScoringSpecials ?? []) {
        if (special.sourceDefId !== sourceDefId) continue;
        locations.push({
            uid: special.cardUid,
            baseIndex: special.baseIndex,
            controllerId: special.playerId,
            ownerId: special.playerId,
        });
    }
    return locations;
}

function isTriggerSourceEligible(
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    located: TriggerSourceLocation,
    triggerBaseIndex: number | undefined,
): boolean {
    if (triggerBaseIndex === undefined) return true;
    if (
        entry.baseScoped !== false
        && (timing === 'onMinionMoved' || timing === 'onMinionAffected' || timing === 'onTitanMoved')
        && located.baseIndex !== triggerBaseIndex
    ) {
        return false;
    }
    if (entry.sourceScope === 'triggerBase' && located.baseIndex !== triggerBaseIndex) {
        return false;
    }
    return true;
}

function isTurnBoundarySourceControllerEligible(
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    located: TriggerSourceLocation,
    playerId: PlayerId,
): boolean {
    if (entry.playerContext !== 'sourceController' && entry.playerContext !== 'sourceHostController') return true;
    if (timing !== 'onTurnStart' && timing !== 'onTurnEnd') return true;
    const sourcePlayerId = getTriggerSourcePlayerId(entry, located);
    if (!sourcePlayerId) return true;
    return sourcePlayerId === playerId;
}

function getTriggerSourcePlayerId(
    entry: Pick<TriggerEntry, 'playerContext'>,
    located: TriggerSourceLocation,
): PlayerId | undefined {
    if (entry.playerContext === 'sourceHostController') {
        return located.hostControllerId ?? located.controllerId;
    }
    if (entry.playerContext === 'sourceController') {
        return located.controllerId;
    }
    return undefined;
}

function buildTriggerId(
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    now: number,
    order: number,
    located: TriggerSourceLocation,
    sourceEventId?: string,
): string {
    const sourceKey = sourceEventId ?? `${timing}:${now}`;
    if (entry.perInstance) {
        const instanceKey = located.titanUid ?? located.uid ?? 'global';
        return `${timing}:${entry.sourceDefId}:${sourceKey}:${instanceKey}:${order}`;
    }
    return `${timing}:${entry.sourceDefId}:${sourceKey}:${order}`;
}

function createTriggerInstance(
    state: SmashUpCore,
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    now: number,
    order: number,
    pid: PlayerId,
    located: TriggerSourceLocation,
    ctx: Omit<TriggerContext, 'timing'>,
): TriggerInstance {
    const mandatory = entry.mandatory ?? !(entry.optional ?? false);
    const sourceEventId = ctx.sourceEventId ?? `${timing}:${now}`;
    const frameId = ctx.frameId ?? `${timing}:${sourceEventId}`;
    const sourcePlayerId = getTriggerSourcePlayerId(entry, located);
    const queueOwnerPlayerId = located.titanUid
        && mandatory
        && timing === 'afterScoring'
        && ctx.sourceControllerId !== undefined
        ? pid
        : (
            located.titanUid
            && mandatory
            && timing === 'beforeScoring'
                ? (located.ownerId ?? sourcePlayerId ?? pid)
                : (sourcePlayerId ?? pid)
        );
    const explicitDerivedFootprint = cloneEffectContractWithSourceContext(entry.effectContract, located, sourcePlayerId ?? located.controllerId);
    const triggerBaseControllersAtTrigger = ctx.baseIndex !== undefined
        ? Array.from(new Set((state.bases[ctx.baseIndex]?.minions ?? []).map((minion) => minion.controller)))
        : undefined;
    return {
        id: buildTriggerId(entry, timing, now, order, located, sourceEventId),
        timing,
        playerContext: entry.playerContext,
        sourceDefId: entry.sourceDefId,
        sourceCardUid: located.uid,
        sourceControllerId: sourcePlayerId ?? located.controllerId,
        sourceOwnerPlayerId: located.ownerId,
        sourceBaseIndex: located.baseIndex,
        mandatory,
        resolutionClass: mandatory ? 'mandatory' : 'optional',
        frameId,
        sourceEventId,
        ownerPlayerId: queueOwnerPlayerId,
        eventPlayerId: pid,
        witnessRequirement: 'inPlayAtTriggerTime',
        witnessed: true,
        baseIndex: ctx.baseIndex,
        moveFromBaseIndex: ctx.moveFromBaseIndex,
        moveToBaseIndex: ctx.moveToBaseIndex,
        simultaneousMoveBatchMinionUids: ctx.simultaneousMoveBatchMinionUids
            ? [...ctx.simultaneousMoveBatchMinionUids]
            : undefined,
        duel: ctx.duel ? structuredClone(ctx.duel) : undefined,
        duelSourceId: ctx.duelSourceId,
        duelOutcome: ctx.duelOutcome,
        duelChallenger: ctx.duelChallenger ? structuredClone(ctx.duelChallenger) : undefined,
        duelChallenged: ctx.duelChallenged ? structuredClone(ctx.duelChallenged) : undefined,
        duelWinner: ctx.duelWinner ? structuredClone(ctx.duelWinner) : undefined,
        duelLoser: ctx.duelLoser ? structuredClone(ctx.duelLoser) : undefined,
        duelTie: ctx.duelTie,
        triggerMinionUid: ctx.triggerMinionUid,
        triggerMinionDefId: ctx.triggerMinionDefId,
        triggerMinionPower: ctx.triggerMinionPower,
        destroyedMonsterUid: ctx.destroyedMonsterUid,
        destroyedMonsterDefId: ctx.destroyedMonsterDefId,
        destroyedMonsterPower: ctx.destroyedMonsterPower,
        triggerMinionFromDeck: ctx.triggerMinionFromDeck,
        triggerCardUid: ctx.triggerCardUid,
        triggerCardDefId: ctx.triggerCardDefId,
        triggerCardOwnerId: ctx.triggerCardOwnerId,
        triggerCardKind: ctx.triggerCardKind,
        transferredCardUid: ctx.transferredCardUid,
        transferredCardDefId: ctx.transferredCardDefId,
        transferredCardOwnerId: ctx.transferredCardOwnerId,
        transferredFromPlayerId: ctx.transferredFromPlayerId,
        transferredToPlayerId: ctx.transferredToPlayerId,
        discardedCards: ctx.discardedCards ? structuredClone(ctx.discardedCards) : undefined,
        discardedFromZone: ctx.discardedFromZone,
        destroyerId: ctx.destroyerId,
        controllerId: ctx.controllerId,
        reason: ctx.reason,
        ...(explicitDerivedFootprint
            ? {
                derivedFootprint: explicitDerivedFootprint,
            }
            : {}),
        affectType: ctx.affectType,
        counterChangeKind: ctx.counterChangeKind,
        counterDelta: ctx.counterDelta,
        affectEvent: ctx.affectEvent ? structuredClone(ctx.affectEvent) : undefined,
        affectBatchTargets: ctx.affectBatchTargets ? structuredClone(ctx.affectBatchTargets) : undefined,
        rankings: ctx.rankings ? structuredClone(ctx.rankings) : undefined,
        triggerBaseControllersAtTrigger,
        buriedCardUid: ctx.buriedCardUid,
        buriedCardDefId: ctx.buriedCardDefId,
        buriedCardControllerId: ctx.buriedCardControllerId,
        buriedFrom: ctx.buriedFrom,
        actionTargetBaseIndex: ctx.actionTargetBaseIndex,
        actionTargetType: ctx.actionTargetType,
        actionTargetMinionUid: ctx.actionTargetMinionUid,
        inspectionCards: ctx.inspectionCards ? structuredClone(ctx.inspectionCards) : undefined,
        inspectionZone: ctx.inspectionZone,
        inspectionTargetPlayerIds: ctx.inspectionTargetPlayerIds ? structuredClone(ctx.inspectionTargetPlayerIds) : undefined,
        inspectionCausePlayerId: ctx.inspectionCausePlayerId,
        fallbackFootprint: entry.fallbackFootprint,
        lkiMinion: ctx.triggerMinion
            ? {
                uid: ctx.triggerMinion.uid,
                defId: ctx.triggerMinion.defId,
                owner: ctx.triggerMinion.owner,
                controller: ctx.triggerMinion.controller,
                baseIndex: ctx.baseIndex ?? located.baseIndex ?? -1,
                basePower: ctx.triggerMinion.basePower,
                powerCounters: ctx.triggerMinion.powerCounters,
                powerModifier: ctx.triggerMinion.powerModifier,
                tempPowerModifier: ctx.triggerMinion.tempPowerModifier,
                attachedActionDefIds: ctx.triggerMinion.attachedActions?.map(a => a.defId) ?? [],
                attachedActions: ctx.triggerMinion.attachedActions?.map(action => ({
                    uid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    metadata: action.metadata ? structuredClone(action.metadata) : undefined,
                })) ?? [],
                metadata: ctx.triggerMinion.metadata ? structuredClone(ctx.triggerMinion.metadata) : undefined }
            : undefined };
}

function buildTriggerEligibilityContext(
    state: SmashUpCore,
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    now: number,
    pid: PlayerId,
    located: TriggerSourceLocation,
    ctx: Omit<TriggerContext, 'timing'>,
): TriggerContext {
    const sourcePlayerId = getTriggerSourcePlayerId(entry, located);
    return {
        ...ctx,
        state,
        timing,
        playerId: pid,
        sourceDefId: entry.sourceDefId,
        sourceCardUid: located.uid,
        sourceBaseIndex: located.baseIndex,
        sourceControllerId: sourcePlayerId ?? located.controllerId,
        sourceOwnerPlayerId: located.ownerId,
        now,
    };
}

function isQueuedTriggerPlayerEligible(
    state: SmashUpCore,
    trigger: TriggerInstance,
): boolean {
    const turnOrder = state.turnOrder ?? [];
    if (turnOrder.length === 0) return false;
    return turnOrder.includes(trigger.ownerPlayerId) && turnOrder.includes(trigger.eventPlayerId);
}

function shouldSkipTriggerInstance(
    state: SmashUpCore,
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    located: TriggerSourceLocation,
    ctx: Omit<TriggerContext, 'timing'>,
): boolean {
    if (
        timing === 'onMinionPlayed'
        && located.uid
        && ctx.suppressedSourceCardUids?.includes(located.uid)
    ) {
        return true;
    }

    if (
        timing === 'onMinionMoved'
        && located.uid
        && ctx.triggerMinionUid
        && ctx.simultaneousMoveBatchMinionUids?.includes(located.uid)
        && ctx.simultaneousMoveBatchMinionUids.includes(ctx.triggerMinionUid)
        && located.uid !== ctx.triggerMinionUid
    ) {
        return true;
    }

    if (
        entry.sourceDefId === 'world_champs_aramis'
        && timing === 'onMinionAffected'
        && located.uid
        && ctx.triggerMinionUid !== located.uid
    ) {
        return true;
    }

    if (
        entry.sourceDefId === 'world_champs_diva'
        && timing === 'onMinionAffected'
        && located.uid
        && located.baseIndex !== undefined
        && located.controllerId
    ) {
        const firstOtherFriendlyTargetUid = ctx.affectBatchTargets?.find(target =>
            target.baseIndex === located.baseIndex
            && target.controllerId === located.controllerId
            && target.minionUid !== located.uid
        )?.minionUid;
        if (!firstOtherFriendlyTargetUid) {
            return true;
        }
        if (ctx.triggerMinionUid !== firstOtherFriendlyTargetUid) {
            return true;
        }
    }

    if (
        entry.sourceDefId === 'skeletons_returned_one'
        && timing === 'onMinionPlayed'
    ) {
        if (!located.uid || ctx.triggerMinionUid !== located.uid) {
            return true;
        }

        const baseIndex = located.baseIndex ?? ctx.baseIndex;
        if (baseIndex === undefined) {
            return true;
        }

        const returnedOne = state.bases[baseIndex]?.minions.find(minion => minion.uid === located.uid);
        if (!returnedOne || returnedOne.metadata?.playedFrom !== 'buried') {
            return true;
        }

        const hasAnotherOwnedBuriedCard = (state.bases[baseIndex]?.buriedCards ?? []).some(card =>
            card.controllerId === returnedOne.controller
            && card.uid !== located.uid
        );
        if (!hasAnotherOwnedBuriedCard) {
            return true;
        }
    }

    if (
        entry.sourceDefId === 'bear_cavalry_major_ursa'
        && timing === 'onMinionMoved'
        && located.baseIndex !== undefined
    ) {
        return ctx.moveToBaseIndex !== located.baseIndex;
    }

    return entry.sourceDefId === 'explorers_very_large_boulder'
        && timing === 'onMinionMoved'
        && !!located.titanUid
        && (state.veryLargeBoulderTriggeredTurnByTitan ?? {})[located.titanUid] === state.turnNumber;
}

function cloneEffectContractWithSourceContext(
    effectContract: SmashUpReactionResourceFootprint | undefined,
    located: TriggerSourceLocation,
    sourcePlayerId: PlayerId | undefined,
): SmashUpReactionResourceFootprint | undefined {
    if (!effectContract) return undefined;
    return {
        reads: [
            ...effectContract.reads,
            ...(located.uid
                ? [
                    { kind: 'sourceInstance' as const, uid: located.uid },
                    { kind: 'cardInstance' as const, uid: located.uid },
                ]
                : []),
            ...(sourcePlayerId
                ? [{ kind: 'playerControl' as const, playerId: sourcePlayerId }]
                : []),
        ],
        writes: [...effectContract.writes],
        ...(effectContract.opensInteraction ? { opensInteraction: true } : {}),
        ...(effectContract.fallbackReason ? { fallbackReason: effectContract.fallbackReason } : {}),
    };
}

/** 收集符合当前时机的触发器实例，供全局反应队列后续排序与执行。 */
export function collectTriggers(
    state: SmashUpCore,
    timing: TitanAwareTriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>,
    options?: { sourceDefIds?: readonly string[] },
): TriggerQueuedEvent | undefined {
    if (triggerRegistry.length === 0) return undefined;
    const triggers: TriggerInstance[] = [];
    const now = ctx.now;
    const pid = ctx.playerId;
    const allowedSourceDefIds = options?.sourceDefIds ? new Set(options.sourceDefIds) : undefined;
    const buildExplicitSourceFallback = (entry: TriggerEntry): TriggerSourceLocation | undefined => {
        if (!entry.perInstance) return undefined;
        if (!ctx.sourceCardUid || ctx.sourceControllerId === undefined) return undefined;
        if (isCardSuppressed(state, ctx.sourceCardUid)) return undefined;
        if (allowedSourceDefIds) {
            if (!allowedSourceDefIds.has(entry.sourceDefId)) return undefined;
        } else if (!ctx.sourceDefId || entry.sourceDefId !== ctx.sourceDefId) {
            return undefined;
        }
        return {
            uid: ctx.sourceCardUid,
            baseIndex: ctx.sourceBaseIndex,
            controllerId: ctx.sourceControllerId,
            ownerId: ctx.sourceOwnerPlayerId,
        };
    };

    for (const entry of triggerRegistry) {
        if (entry.timing !== timing) continue;
        if (allowedSourceDefIds && !allowedSourceDefIds.has(entry.sourceDefId)) continue;
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        // Only queue reaction-phase triggers (replacement effects must remain immediate)
        if (entry.phase === 'replacement') continue;
        if (entry.global) {
            const located = selectGlobalTriggerSourceLocation(
                filteredState,
                entry,
                timing,
                entry.globalZones ?? ['hand', 'discard'],
                pid,
                ctx,
                candidate => !entry.canTrigger
                    || entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, now, pid, candidate, ctx)),
            );
            if (!located) continue;
            if (entry.canTrigger && !entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, now, pid, located, ctx))) continue;
            const trigger = createTriggerInstance(filteredState, entry, timing, now, triggers.length, pid, located, ctx);
            if (!isQueuedTriggerPlayerEligible(filteredState, trigger)) continue;
            triggers.push(trigger);
            continue;
        }

        const locatedSources = locateSources(filteredState, entry.sourceDefId);
        if (locatedSources.length === 0) {
            const explicitSourceFallback = buildExplicitSourceFallback(entry);
            if (explicitSourceFallback) {
                if (!isTriggerSourceEligible(entry, timing, explicitSourceFallback, ctx.baseIndex)) continue;
                if (!isTurnBoundarySourceControllerEligible(entry, timing, explicitSourceFallback, pid)) continue;
                if (shouldSkipTriggerInstance(filteredState, entry, timing, explicitSourceFallback, ctx)) continue;
                if (entry.canTrigger && !entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, now, pid, explicitSourceFallback, ctx))) continue;
                const trigger = createTriggerInstance(filteredState, entry, timing, now, triggers.length, pid, explicitSourceFallback, ctx);
                if (!isQueuedTriggerPlayerEligible(filteredState, trigger)) continue;
                triggers.push(trigger);
                continue;
            }
            if (!entry.perInstance && isSourceActive(filteredState, entry.sourceDefId)) {
                if (entry.canTrigger && !entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, now, pid, {}, ctx))) continue;
                const trigger = createTriggerInstance(filteredState, entry, timing, now, triggers.length, pid, {}, ctx);
                if (!isQueuedTriggerPlayerEligible(filteredState, trigger)) continue;
                triggers.push(trigger);
            }
            continue;
        }

        if (entry.perInstance) {
            for (const located of locatedSources) {
                if (!isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)) continue;
                if (!isTurnBoundarySourceControllerEligible(entry, timing, located, pid)) continue;
                if (shouldSkipTriggerInstance(filteredState, entry, timing, located, ctx)) continue;
                if (entry.canTrigger && !entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, now, pid, located, ctx))) continue;
                const trigger = createTriggerInstance(filteredState, entry, timing, now, triggers.length, pid, located, ctx);
                if (!isQueuedTriggerPlayerEligible(filteredState, trigger)) continue;
                triggers.push(trigger);
            }
            continue;
        }

        const located = selectSpecificSourceLocation(locatedSources, ctx, candidate => {
            if (!isTriggerSourceEligible(entry, timing, candidate, ctx.baseIndex)) return false;
            if (!isTurnBoundarySourceControllerEligible(entry, timing, candidate, pid)) return false;
            if (shouldSkipTriggerInstance(filteredState, entry, timing, candidate, ctx)) return false;
            return !entry.canTrigger
                || entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, now, pid, candidate, ctx));
        });
        if (!located) continue;
        if (entry.canTrigger && !entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, now, pid, located, ctx))) continue;
        const trigger = createTriggerInstance(filteredState, entry, timing, now, triggers.length, pid, located, ctx);
        if (!isQueuedTriggerPlayerEligible(filteredState, trigger)) continue;
        triggers.push(trigger);
    }

    if (triggers.length === 0) return undefined;
    return {
        type: SU_EVENTS.TRIGGER_QUEUED,
        payload: { triggers },
        timestamp: now } as TriggerQueuedEvent;
}


export function registerInterceptor(
    sourceDefId: string,
    interceptor: EventInterceptor,
    options?: { generatedPodAlias?: boolean },
): void {

    if (interceptorRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    interceptorRegistry.push({ sourceDefId, interceptor, generatedPodAlias: options?.generatedPodAlias });
}


export function registerBaseAbilitySuppression(
    sourceDefId: string,
    checker: BaseAbilitySuppressionChecker,
    options?: { generatedPodAlias?: boolean },
): void {

    if (baseAbilitySuppressionRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    baseAbilitySuppressionRegistry.push({ sourceDefId, checker, generatedPodAlias: options?.generatedPodAlias });
}

export function registerBaseScoringSuppression(
    sourceDefId: string,
    checker: BaseScoringSuppressionChecker,
    options?: { generatedPodAlias?: boolean },
): void {
    if (baseScoringSuppressionRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    baseScoringSuppressionRegistry.push({ sourceDefId, checker, generatedPodAlias: options?.generatedPodAlias });
}

export function registerCardAbilitySuppression(
    sourceDefId: string,
    checker: CardAbilitySuppressionChecker,
    options?: { generatedPodAlias?: boolean },
): void {
    if (cardAbilitySuppressionRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    cardAbilitySuppressionRegistry.push({ sourceDefId, checker, generatedPodAlias: options?.generatedPodAlias });
    resetCardSuppressionCache();
}

export function registerBaseVpModifier(
    sourceDefId: string,
    checker: BaseVpModifierChecker,
    options?: { generatedPodAlias?: boolean },
): void {
    if (baseVpModifierRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    baseVpModifierRegistry.push({ sourceDefId, checker, generatedPodAlias: options?.generatedPodAlias });
}


export function clearOngoingEffectRegistry(): void {
    protectionRegistry.length = 0;
    restrictionRegistry.length = 0;
    triggerRegistry.length = 0;
    interceptorRegistry.length = 0;
    baseAbilitySuppressionRegistry.length = 0;
    baseScoringSuppressionRegistry.length = 0;
    baseVpModifierRegistry.length = 0;
    cardAbilitySuppressionRegistry.length = 0;
    resetCardSuppressionCache();
}

export function hasRegisteredTrigger(sourceDefId: string, timing: TriggerTiming): boolean {
    return triggerRegistry.some(entry => entry.sourceDefId === sourceDefId && entry.timing === timing);
}

export interface OngoingRuntimeRegistrationShape {
    protectionTypes: Set<ProtectionType>;
    restrictionTypes: Set<RestrictionType>;
    triggerTimings: Set<TriggerTiming>;
    hasInterceptor: boolean;
    hasBaseAbilitySuppression: boolean;
    hasBaseScoringSuppression: boolean;
    hasBaseVpModifier: boolean;
    hasCardAbilitySuppression: boolean;
}

export function getOngoingRuntimeRegistrationShape(sourceDefId: string): OngoingRuntimeRegistrationShape {
    return {
        protectionTypes: new Set(
            protectionRegistry
                .filter((entry) => entry.sourceDefId === sourceDefId)
                .map((entry) => entry.protectionType),
        ),
        restrictionTypes: new Set(
            restrictionRegistry
                .filter((entry) => entry.sourceDefId === sourceDefId)
                .map((entry) => entry.restrictionType),
        ),
        triggerTimings: new Set(
            triggerRegistry
                .filter((entry) => entry.sourceDefId === sourceDefId)
                .map((entry) => entry.timing as TriggerTiming),
        ),
        hasInterceptor: interceptorRegistry.some((entry) => entry.sourceDefId === sourceDefId),
        hasBaseAbilitySuppression: baseAbilitySuppressionRegistry.some((entry) => entry.sourceDefId === sourceDefId),
        hasBaseScoringSuppression: baseScoringSuppressionRegistry.some((entry) => entry.sourceDefId === sourceDefId),
        hasBaseVpModifier: baseVpModifierRegistry.some((entry) => entry.sourceDefId === sourceDefId),
        hasCardAbilitySuppression: cardAbilitySuppressionRegistry.some((entry) => entry.sourceDefId === sourceDefId),
    };
}

/**

 *



 *

 */
export function registerPodOngoingAliases(): void {
    let _mappedCount = 0;


    const triggersToAdd: TriggerEntry[] = [];
    for (const entry of triggerRegistry) {
        const {
            sourceDefId,
            timing,
            rawCallback,
            canTrigger,
            optional,
            mandatory,
            phase,
            playerContext,
            baseScoped,
            perInstance,
            sourceScope,
            effectContract,
            global,
            globalZones,
            fallbackFootprint,
        } = entry;


        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ongoing', sourceDefId)) continue;

        const podDefId = `${sourceDefId}_pod`;


        const alreadyRegistered = triggerRegistry.some(
            e => e.sourceDefId === podDefId && e.timing === timing
        );
        if (alreadyRegistered) continue;


        triggersToAdd.push({
            sourceDefId: podDefId,
            timing,
            rawCallback,
            callback: rawCallback,
            canTrigger,
            optional,
            mandatory,
            phase,
            playerContext,
            baseScoped,
            perInstance,
            sourceScope,
            effectContract,
            global,
            globalZones,
            fallbackFootprint,
        });
        _mappedCount++;
    }


    for (const entry of triggersToAdd) {
        registerTrigger(entry.sourceDefId, entry.timing, entry.callback, {
            canTrigger: entry.canTrigger,
            optional: entry.optional,
            mandatory: entry.mandatory,
            phase: entry.phase,
            playerContext: entry.playerContext,
            baseScoped: entry.baseScoped,
            perInstance: entry.perInstance,
            sourceScope: entry.sourceScope,
            effectContract: entry.effectContract,
            global: entry.global,
            globalZones: entry.globalZones,
            fallbackFootprint: entry.fallbackFootprint,
            generatedPodAlias: true,
        });
    }


    const restrictionsToAdd: RestrictionEntry[] = [];
    for (const entry of restrictionRegistry) {
        const { sourceDefId, restrictionType, checker } = entry;

        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ongoing', sourceDefId)) continue;

        const podDefId = `${sourceDefId}_pod`;

        const alreadyRegistered = restrictionRegistry.some(
            e => e.sourceDefId === podDefId && e.restrictionType === restrictionType
        );
        if (alreadyRegistered) continue;

        restrictionsToAdd.push({ sourceDefId: podDefId, restrictionType, checker, generatedPodAlias: true });
        _mappedCount++;
    }

    restrictionRegistry.push(...restrictionsToAdd);


    const protectionsToAdd: ProtectionEntry[] = [];
    for (const entry of protectionRegistry) {
        const { sourceDefId, protectionType, checker } = entry;

        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ongoing', sourceDefId)) continue;

        const podDefId = `${sourceDefId}_pod`;

        const alreadyRegistered = protectionRegistry.some(
            e => e.sourceDefId === podDefId
                && e.protectionType === protectionType
                && e.consumable === entry.consumable
        );
        if (alreadyRegistered) continue;

        protectionsToAdd.push({
            sourceDefId: podDefId,
            protectionType,
            checker,
            consumable: entry.consumable,
            generatedPodAlias: true,
        });
        _mappedCount++;
    }

    protectionRegistry.push(...protectionsToAdd);


    const interceptorsToAdd: InterceptorEntry[] = [];
    for (const entry of interceptorRegistry) {
        const { sourceDefId, interceptor } = entry;

        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ongoing', sourceDefId)) continue;

        const podDefId = `${sourceDefId}_pod`;

        const alreadyRegistered = interceptorRegistry.some(
            e => e.sourceDefId === podDefId && e.interceptor === interceptor
        );
        if (alreadyRegistered) continue;

        interceptorsToAdd.push({ sourceDefId: podDefId, interceptor, generatedPodAlias: true });
        _mappedCount++;
    }

    interceptorRegistry.push(...interceptorsToAdd);


    const suppressionsToAdd: { sourceDefId: string; checker: BaseAbilitySuppressionChecker }[] = [];
    for (const entry of baseAbilitySuppressionRegistry) {
        const { sourceDefId, checker } = entry;

        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ongoing', sourceDefId)) continue;

        const podDefId = `${sourceDefId}_pod`;

        const alreadyRegistered = baseAbilitySuppressionRegistry.some(
            e => e.sourceDefId === podDefId && e.checker === checker
        );
        if (alreadyRegistered) continue;

        suppressionsToAdd.push({ sourceDefId: podDefId, checker, generatedPodAlias: true });
        _mappedCount++;
    }

    baseAbilitySuppressionRegistry.push(...suppressionsToAdd);


    const scoringSuppressionsToAdd: { sourceDefId: string; checker: BaseScoringSuppressionChecker }[] = [];
    for (const entry of baseScoringSuppressionRegistry) {
        const { sourceDefId, checker } = entry;

        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ongoing', sourceDefId)) continue;

        const podDefId = `${sourceDefId}_pod`;

        const alreadyRegistered = baseScoringSuppressionRegistry.some(
            e => e.sourceDefId === podDefId && e.checker === checker
        );
        if (alreadyRegistered) continue;

        scoringSuppressionsToAdd.push({ sourceDefId: podDefId, checker, generatedPodAlias: true });
        _mappedCount++;
    }

    baseScoringSuppressionRegistry.push(...scoringSuppressionsToAdd);

    const baseVpModifiersToAdd: BaseVpModifierEntry[] = [];
    for (const entry of baseVpModifierRegistry) {
        const { sourceDefId, checker } = entry;

        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ongoing', sourceDefId)) continue;

        const podDefId = `${sourceDefId}_pod`;
        const alreadyRegistered = baseVpModifierRegistry.some(
            candidate => candidate.sourceDefId === podDefId && candidate.checker === checker,
        );
        if (alreadyRegistered) continue;

        baseVpModifiersToAdd.push({
            sourceDefId: podDefId,
            checker,
            generatedPodAlias: true,
        });
        _mappedCount++;
    }

    baseVpModifierRegistry.push(...baseVpModifiersToAdd);


    const cardSuppressionsToAdd: CardAbilitySuppressionEntry[] = [];
    for (const entry of cardAbilitySuppressionRegistry) {
        const { sourceDefId, checker } = entry;

        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ongoing', sourceDefId)) continue;

        const podDefId = `${sourceDefId}_pod`;

        const alreadyRegistered = cardAbilitySuppressionRegistry.some(
            e => e.sourceDefId === podDefId && e.checker === checker,
        );
        if (alreadyRegistered) continue;

        cardSuppressionsToAdd.push({ sourceDefId: podDefId, checker, generatedPodAlias: true });
        _mappedCount++;
    }

    cardAbilitySuppressionRegistry.push(...cardSuppressionsToAdd);
    if (cardSuppressionsToAdd.length > 0) {
        resetCardSuppressionCache();
    }


}


export function getOngoingEffectRegistrySize(): {
    protection: number;
    restriction: number;
    trigger: number;
    interceptor: number;
} {
    return {
        protection: protectionRegistry.length,
        restriction: restrictionRegistry.length,
        trigger: triggerRegistry.length,
        interceptor: interceptorRegistry.length };
}


export function getRegisteredOngoingEffectIds(): {
    protectionIds: Set<string>;
    restrictionIds: Set<string>;
    triggerIds: Map<string, TriggerTiming[]>;
    interceptorIds: Set<string>;
    baseAbilitySuppressionIds: Set<string>;
    baseScoringSuppressionIds: Set<string>;
    baseVpModifierIds: Set<string>;
    cardAbilitySuppressionIds: Set<string>;
} {
    const protectionIds = new Set(
        protectionRegistry
            .filter((entry) => !shouldHideGeneratedPodOngoingAlias(protectionRegistry, entry.sourceDefId))
            .map(e => e.sourceDefId),
    );
    const restrictionIds = new Set(
        restrictionRegistry
            .filter((entry) => !shouldHideGeneratedPodOngoingAlias(restrictionRegistry, entry.sourceDefId))
            .map(e => e.sourceDefId),
    );
    const interceptorIds = new Set(
        interceptorRegistry
            .filter((entry) => !shouldHideGeneratedPodOngoingAlias(interceptorRegistry, entry.sourceDefId))
            .map(e => e.sourceDefId),
    );
    const baseAbilitySuppressionIds = new Set(
        baseAbilitySuppressionRegistry
            .filter((entry) => !shouldHideGeneratedPodOngoingAlias(baseAbilitySuppressionRegistry, entry.sourceDefId))
            .map(e => e.sourceDefId),
    );
    const baseScoringSuppressionIds = new Set(
        baseScoringSuppressionRegistry
            .filter((entry) => !shouldHideGeneratedPodOngoingAlias(baseScoringSuppressionRegistry, entry.sourceDefId))
            .map(e => e.sourceDefId),
    );
    const baseVpModifierIds = new Set(
        baseVpModifierRegistry
            .filter((entry) => !shouldHideGeneratedPodOngoingAlias(baseVpModifierRegistry, entry.sourceDefId))
            .map(e => e.sourceDefId),
    );
    const cardAbilitySuppressionIds = new Set(
        cardAbilitySuppressionRegistry
            .filter((entry) => !shouldHideGeneratedPodOngoingAlias(cardAbilitySuppressionRegistry, entry.sourceDefId))
            .map(e => e.sourceDefId),
    );


    const triggerIds = new Map<string, TriggerTiming[]>();
    for (const entry of triggerRegistry) {
        if (shouldHideGeneratedPodOngoingAlias(triggerRegistry, entry.sourceDefId)) continue;
        const existing = triggerIds.get(entry.sourceDefId) ?? [];
        existing.push(entry.timing);
        triggerIds.set(entry.sourceDefId, existing);
    }

    return {
        protectionIds,
        restrictionIds,
        triggerIds,
        interceptorIds,
        baseAbilitySuppressionIds,
        baseScoringSuppressionIds,
        baseVpModifierIds,
        cardAbilitySuppressionIds,
    };
}

// ============================================================================

// ============================================================================

/**

 *


 */
export function isBaseAbilitySuppressed(
    state: SmashUpCore,
    baseIndex: number
): boolean {

    if (state.suppressedBasesUntilTurnStart?.some(s => s.baseIndex === baseIndex)) {
        return true;
    }


    if (baseAbilitySuppressionRegistry.length === 0) return false;
    for (const entry of baseAbilitySuppressionRegistry) {
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActiveOnBase(filteredState, entry.sourceDefId, baseIndex)) continue;
        if (entry.checker(filteredState, baseIndex)) return true;
    }
    return false;
}

export function isBaseScoringSuppressed(
    state: SmashUpCore,
    baseIndex: number
): boolean {
    if (baseScoringSuppressionRegistry.length === 0) return false;
    for (const entry of baseScoringSuppressionRegistry) {
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActiveOnBase(filteredState, entry.sourceDefId, baseIndex)) continue;
        if (entry.checker(filteredState, baseIndex)) return true;
    }
    return false;
}

export function getModifiedBaseVp(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
    printedVp: number,
): number {
    let currentVp = printedVp;
    if (baseVpModifierRegistry.length === 0) {
        return Math.max(0, currentVp);
    }
    for (const entry of baseVpModifierRegistry) {
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActiveOnBase(filteredState, entry.sourceDefId, baseIndex)) continue;
        currentVp += entry.checker(filteredState, baseIndex, playerId, currentVp);
    }
    return Math.max(0, currentVp);
}

function getTurnScopedSuppressedCardUids(state: SmashUpCore): ReadonlySet<string> {
    return new Set([
        ...(state.suppressedCardsUntilTurnStart ?? []).map(entry => entry.cardUid),
        ...(state.suppressedCardUidsUntilTurnEnd ?? []),
    ]);
}

function computeSuppressedCardUids(state: SmashUpCore): ReadonlySet<string> {
    const turnScopedSuppressedCardUids = getTurnScopedSuppressedCardUids(state);
    const suppressedUids = new Set(turnScopedSuppressedCardUids);
    if (cardAbilitySuppressionRegistry.length === 0) {
        return suppressedUids;
    }

    for (const entry of cardAbilitySuppressionRegistry) {
        const filteredState = getStateFilteredBySuppressedUids(state, entry.sourceDefId, turnScopedSuppressedCardUids);
        const additionalSuppressedUids = entry.checker(filteredState, turnScopedSuppressedCardUids);
        for (const cardUid of additionalSuppressedUids) {
            suppressedUids.add(cardUid);
        }
    }
    return suppressedUids;
}

function getCardSuppressionCacheEntry(state: SmashUpCore): CardSuppressionCacheEntry {
    const existing = cardSuppressionCacheByState.get(state);
    if (existing) return existing;

    const entry: CardSuppressionCacheEntry = {
        suppressedUids: computeSuppressedCardUids(state),
        filteredStateBySourceDefId: new Map(),
    };
    cardSuppressionCacheByState.set(state, entry);
    return entry;
}

function getSuppressedCardUids(state: SmashUpCore): ReadonlySet<string> {
    return getCardSuppressionCacheEntry(state).suppressedUids;
}

export function isCardSuppressed(
    state: SmashUpCore,
    cardUid: string,
): boolean {
    return getSuppressedCardUids(state).has(cardUid);
}

export function getSuppressionFilteredStateForSource(
    state: SmashUpCore,
    sourceDefId: string,
): SmashUpCore {
    const cacheEntry = getCardSuppressionCacheEntry(state);
    const suppressedUids = cacheEntry.suppressedUids;
    if (suppressedUids.size === 0) {
        return state;
    }
    const cached = cacheEntry.filteredStateBySourceDefId.get(sourceDefId);
    if (cached) return cached;

    const filteredState = getStateFilteredBySuppressedUids(state, sourceDefId, suppressedUids);
    cacheEntry.filteredStateBySourceDefId.set(sourceDefId, filteredState);
    return filteredState;
}

function getStateFilteredBySuppressedUids(
    state: SmashUpCore,
    sourceDefId: string,
    suppressedUids: ReadonlySet<string>,
): SmashUpCore {
    let changed = false;

    const bases = state.bases.map(base => {
        let baseChanged = false;

        const ongoingActions = base.ongoingActions.filter(action => {
            const keep = !(action.defId === sourceDefId && suppressedUids.has(action.uid));
            if (!keep) baseChanged = true;
            return keep;
        });

        const minions = base.minions.flatMap(minion => {
            if (minion.defId === sourceDefId && suppressedUids.has(minion.uid)) {
                baseChanged = true;
                return [];
            }

            const attachedActions = (minion.attachedActions ?? []).filter(action => {
                const keep = !(action.defId === sourceDefId && suppressedUids.has(action.uid));
                if (!keep) baseChanged = true;
                return keep;
            });

            if (attachedActions.length !== (minion.attachedActions ?? []).length) {
                return [{ ...minion, attachedActions }];
            }

            return [minion];
        });

        if (!baseChanged) {
            return base;
        }

        changed = true;
        return {
            ...base,
            minions,
            ongoingActions };
    });

    if (!changed) {
        return state;
    }

    return {
        ...state,
        bases };
}

/**

 *


 */
export function isMinionProtected(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    targetBaseIndex: number,
    sourcePlayerId: PlayerId,
    protectionType: ProtectionType,
    options?: { sourceKind?: 'action' | 'nonAction'; sourceDefId?: string; sourceBaseIndex?: number },
): boolean {
    if (hasTurnScopedMetadataProtection(state, targetMinion, protectionType, sourcePlayerId)) return true;
    if (protectionRegistry.length === 0) return false;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        sourceKind: options?.sourceKind,
        sourceDefId: options?.sourceDefId,
        sourceBaseIndex: options?.sourceBaseIndex,
        protectionType };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        if (entry.sourceDefId === state.bases[targetBaseIndex]?.defId && isBaseAbilitySuppressed(state, targetBaseIndex)) {
            continue;
        }

        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        if (entry.checker({ ...ctx, state: filteredState })) return true;
    }
    return false;
}

/**

 *


 */
export function isMinionProtectedNonConsumable(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    targetBaseIndex: number,
    sourcePlayerId: PlayerId,
    protectionType: ProtectionType,
    options?: { sourceKind?: 'action' | 'nonAction'; sourceDefId?: string; sourceBaseIndex?: number },
): boolean {
    if (hasTurnScopedMetadataProtection(state, targetMinion, protectionType, sourcePlayerId)) return true;
    if (protectionRegistry.length === 0) return false;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        sourceKind: options?.sourceKind,
        sourceDefId: options?.sourceDefId,
        sourceBaseIndex: options?.sourceBaseIndex,
        protectionType };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        if (entry.consumable) continue;
        if (entry.sourceDefId === state.bases[targetBaseIndex]?.defId && isBaseAbilitySuppressed(state, targetBaseIndex)) {
            continue;
        }
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        if (entry.checker({ ...ctx, state: filteredState })) return true;
    }
    return false;
}

function hasTurnScopedMetadataProtection(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    protectionType: ProtectionType,
    sourcePlayerId: PlayerId,
): boolean {
    const metadata = targetMinion.metadata ?? {};
    const currentTurn = state.turnNumber ?? 0;
    const protectingPlayerId = typeof metadata.tempProtectSourcePlayerId === 'string'
        ? metadata.tempProtectSourcePlayerId
        : undefined;
    if (protectingPlayerId !== undefined && protectingPlayerId === sourcePlayerId) return false;
    const destroyUntilTurn = typeof metadata.tempProtectDestroyUntilTurnNumber === 'number'
        ? metadata.tempProtectDestroyUntilTurnNumber
        : undefined;
    const moveUntilTurn = typeof metadata.tempProtectMoveUntilTurnNumber === 'number'
        ? metadata.tempProtectMoveUntilTurnNumber
        : undefined;
    const affectUntilTurn = typeof metadata.tempProtectAffectUntilTurnNumber === 'number'
        ? metadata.tempProtectAffectUntilTurnNumber
        : undefined;

    if (protectionType === 'destroy') return (destroyUntilTurn ?? -1) >= currentTurn;
    if (protectionType === 'move') return (moveUntilTurn ?? -1) >= currentTurn;
    if (protectionType === 'affect' || protectionType === 'action') return (affectUntilTurn ?? -1) >= currentTurn;
    return false;
}

/**
 * 返回一个可被消耗的保护来源。
 *
 * 只有在 `isMinionProtected()` 已确认目标受到保护时，这里才会继续查找具体来源；
 * 例如 `trickster_hideout` 这类持续效果，会在真正拦截 destroy / move / affect 前
 * 定位到对应的 ongoing 来源，供后续发出 `ONGOING_DETACHED` 或移除保护状态使用。
 */
export function getConsumableProtectionSource(
    state: SmashUpCore,
    targetMinion: MinionOnBase,
    targetBaseIndex: number,
    sourcePlayerId: PlayerId,
    protectionType: ProtectionType
): { uid: string; defId: string; ownerId: string; controllerId: PlayerId } | undefined {
    if (protectionRegistry.length === 0) return undefined;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType };

    const candidateMatchesChecker = (
        filteredState: SmashUpCore,
        sourceDefId: string,
        checker: (ctx: ProtectionCheckContext) => boolean,
        candidate:
            | { kind: 'attached'; uid: string }
            | { kind: 'ongoing'; uid: string },
    ): boolean => {
        const isolatedBases = filteredState.bases.map((base, baseIndex) => {
            if (baseIndex !== targetBaseIndex) return base;
            return {
                ...base,
                minions: base.minions.map((minion) => {
                    if (minion.uid !== targetMinion.uid) return minion;
                    return {
                        ...minion,
                        attachedActions: minion.attachedActions.filter((action) => (
                            action.defId !== sourceDefId
                            || (candidate.kind === 'attached' && action.uid === candidate.uid)
                        )),
                    };
                }),
                ongoingActions: base.ongoingActions.filter((action) => (
                    action.defId !== sourceDefId
                    || (candidate.kind === 'ongoing' && action.uid === candidate.uid)
                )),
            };
        });
        const isolatedState = { ...filteredState, bases: isolatedBases };
        const isolatedBase = isolatedState.bases[targetBaseIndex];
        const isolatedTargetMinion = isolatedBase?.minions.find((minion) => minion.uid === targetMinion.uid) ?? targetMinion;
        return checker({
            state: isolatedState,
            targetMinion: isolatedTargetMinion,
            targetBaseIndex,
            sourcePlayerId,
            protectionType,
        });
    };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        if (!entry.consumable) continue;
        if (entry.sourceDefId === state.bases[targetBaseIndex]?.defId && isBaseAbilitySuppressed(state, targetBaseIndex)) {
            continue;
        }
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        if (!entry.checker({ ...ctx, state: filteredState })) continue;

        const base = filteredState.bases[targetBaseIndex];
        if (!base) continue;

        const filteredTargetMinion = base.minions.find(minion => minion.uid === targetMinion.uid) ?? targetMinion;
        for (const attached of filteredTargetMinion.attachedActions) {
            if (attached.defId !== entry.sourceDefId) continue;
            if (!candidateMatchesChecker(filteredState, entry.sourceDefId, entry.checker, { kind: 'attached', uid: attached.uid })) continue;
            const metadata = attached.metadata as { sourceControllerId?: PlayerId; sourcePlayerId?: PlayerId } | undefined;
            return {
                uid: attached.uid,
                defId: attached.defId,
                ownerId: attached.ownerId,
                controllerId: metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? attached.ownerId,
            };
        }

        for (const ongoing of base.ongoingActions) {
            if (ongoing.defId !== entry.sourceDefId) continue;
            if (!candidateMatchesChecker(filteredState, entry.sourceDefId, entry.checker, { kind: 'ongoing', uid: ongoing.uid })) continue;
            const metadata = ongoing.metadata as { sourceControllerId?: PlayerId; sourcePlayerId?: PlayerId } | undefined;
            return {
                uid: ongoing.uid,
                defId: ongoing.defId,
                ownerId: ongoing.ownerId,
                controllerId: metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? ongoing.ownerId,
            };
        }
    }
    return undefined;
}

/**

 *



 */
export function isOperationRestricted(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
    restrictionType: RestrictionType,
    extra?: Record<string, unknown>
): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;


    const baseDef = getBaseDef(base.defId);
    if (baseDef?.restrictions) {
        for (const r of baseDef.restrictions) {
            if (r.type !== restrictionType) continue;

            if (!r.condition) return true;

            if (r.condition.maxPower !== undefined && restrictionType === 'play_minion') {
                const basePower = extra?.basePower as number | undefined;
                if (basePower !== undefined && basePower <= r.condition.maxPower) {



                    if (baseDef.id === 'base_tsars_palace') {
                        const hasBaseInfiltrate = base.ongoingActions.some(o =>
                            (o.metadata?.sourceControllerId ?? o.ownerId) === playerId && o.defId === 'ninja_infiltrate',
                        );
                        if (hasBaseInfiltrate) {
                            continue;
                        }
                    }
                    return true;
                }
            }

            if (r.condition.extraPlayMinionPowerMax !== undefined && restrictionType === 'play_minion') {
                const basePower = extra?.basePower as number | undefined;
                const isExtraMinionPlay = extra?.isExtraMinionPlayAttempt as boolean | undefined;
                const usingBaseLimitedQuota = (extra?.usesBaseLimitedMinionQuota as boolean | undefined)
                    ?? mustUseBaseLimitedMinionQuota(
                        state,
                        state.players[playerId],
                        baseIndex,
                        extra?.minionDefId as string | undefined,
                        basePower,
                    );
                if ((isExtraMinionPlay || usingBaseLimitedQuota) && basePower !== undefined && basePower > r.condition.extraPlayMinionPowerMax) {
                    return true;
                }
            }

            if (r.condition.minionPlayLimitPerTurn !== undefined && restrictionType === 'play_minion') {
                const player = state.players[playerId];
                const playedAtBase = player?.minionsPlayedPerBase?.[baseIndex] ?? 0;
                if (playedAtBase >= r.condition.minionPlayLimitPerTurn) {


                    if (baseDef.id === 'base_antarctic_base') {
                        const hasBaseInfiltrate = base.ongoingActions.some(o =>
                            (o.metadata?.sourceControllerId ?? o.ownerId) === playerId && o.defId === 'ninja_infiltrate',
                        );
                        if (hasBaseInfiltrate) {
                            continue;
                        }
                    }
                    return true;
                }
            }
            if (r.condition.sameNameAlreadyAtBase === true && restrictionType === 'play_minion') {
                const minionDefId = extra?.minionDefId as string | undefined;
                if (minionDefId && base.minions.some(minion => isSameNameDefId(minionDefId, minion.defId))) {
                    return true;
                }
            }
        }
    }


    if (restrictionRegistry.length > 0) {
        const ctx: RestrictionCheckContext = {
            state,
            baseIndex,
            playerId,
            restrictionType,
            extra };
        for (const entry of restrictionRegistry) {
            if (entry.restrictionType !== restrictionType) continue;
            const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
            const sourceActive = entry.global
                ? isSourceActive(filteredState, entry.sourceDefId)
                : isSourceActiveOnBase(filteredState, entry.sourceDefId, baseIndex);
            if (!sourceActive) continue;
            if (entry.checker({ ...ctx, state: filteredState })) return true;
        }
    }

    return false;
}


export function hasPlayerTurnRestriction(
    state: SmashUpCore,
    playerId: PlayerId,
    restrictionType: PlayerTurnRestrictionType,
): boolean {
    return state.playerRestrictionsUntilTurnStart?.some(
        entry => entry.targetPlayerId === playerId && entry.restrictionType === restrictionType,
    ) ?? false;
}

/**

 *
 * 闁哄鏅滈弻銊ッ洪弽顓炵９缁绢參顥撶粣?



 */
export function interceptEvent(
    state: SmashUpCore,
    event: SmashUpEvent
): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (interceptorRegistry.length === 0) return undefined;

    for (const entry of interceptorRegistry) {
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        const result = entry.interceptor(filteredState, event);
        if (result !== undefined) return result;
    }
    return undefined;
}

/**

 *

 */
export function fireTriggers(
    state: SmashUpCore,
    timing: TitanAwareTriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>,
    options?: { phase?: 'replacement' | 'reaction' }
): TriggerResult {
    if (triggerRegistry.length === 0) {
        return { events: [] };
    }

    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    const triggerSharedState: Record<string, unknown> = {};
    const fullCtx: TriggerContext = { ...ctx, timing, triggerSharedState };

    for (const entry of triggerRegistry) {
        if (entry.timing !== timing) continue;
        if (options?.phase && (entry.phase ?? 'reaction') !== options.phase) continue;

        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        const getFilteredMatchState = () => (
            matchState && matchState.core === state
                ? { ...matchState, core: filteredState }
                : matchState
        );
        const canTriggerWithSource = (located: TriggerSourceLocation): boolean => (
            !entry.canTrigger
            || entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, ctx.now, ctx.playerId, located, ctx))
        );

        if (entry.global) {
            const located = selectGlobalTriggerSourceLocation(
                filteredState,
                entry,
                timing,
                entry.globalZones ?? ['hand', 'discard'],
                ctx.playerId,
                ctx,
                candidate => !entry.canTrigger
                    || entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, ctx.now, ctx.playerId, candidate, ctx)),
            );
            if (!located) continue;
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceDefId: entry.sourceDefId,
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: getTriggerSourcePlayerId(entry, located) ?? located.controllerId });
            const triggerEvents = Array.isArray(result) ? result : result.events;
            if (triggerEvents.length > 0) {
                events.push(...triggerEvents);
            }
            if (!Array.isArray(result) && result.matchState) {
                matchState = result.matchState;
            }
            continue;
        }

        const locatedSources = locateSources(filteredState, entry.sourceDefId);
        if (locatedSources.length === 0) {
            if (!entry.perInstance && isSourceActive(filteredState, entry.sourceDefId) && canTriggerWithSource({})) {
                const result = entry.callback({ ...fullCtx, state: filteredState, matchState: getFilteredMatchState() });
                const triggerEvents = Array.isArray(result) ? result : result.events;
                if (triggerEvents.length > 0) {
                    events.push(...triggerEvents);
                }
                if (!Array.isArray(result) && result.matchState) {
                    matchState = result.matchState;
                }
            }
            continue;
        }

        const sourcesToExecute = entry.perInstance
            ? locatedSources.filter(located => (
                isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)
                && isTurnBoundarySourceControllerEligible(entry, timing, located, ctx.playerId)
                && canTriggerWithSource(located)
            ))
            : [selectSpecificSourceLocation(locatedSources, ctx, located => (
                isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)
                && isTurnBoundarySourceControllerEligible(entry, timing, located, ctx.playerId)
                && canTriggerWithSource(located)
            ))].filter(located => located !== undefined);
        if (sourcesToExecute.length === 0) continue;

        for (const located of sourcesToExecute) {
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceDefId: entry.sourceDefId,
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: getTriggerSourcePlayerId(entry, located) ?? located.controllerId });
            const triggerEvents = Array.isArray(result) ? result : result.events;
            if (triggerEvents.length > 0) {
                events.push(...triggerEvents);
            }
            if (!Array.isArray(result) && result.matchState) {
                matchState = result.matchState;
            }
        }
    }

    return { events, matchState };
}

function selectSpecificSourceLocation(
    locatedSources: TriggerSourceLocation[],
    ctx?: Pick<TriggerContext, 'sourceCardUid' | 'triggerMinionUid'>,
    isEligible?: (located: TriggerSourceLocation) => boolean,
): TriggerSourceLocation | undefined {
    const preferredUids = [ctx?.sourceCardUid, ctx?.triggerMinionUid].filter(
        (uid): uid is string => typeof uid === 'string' && uid.length > 0,
    );
    let matchedPreferredSource = false;
    for (const preferredUid of preferredUids) {
        const matched = locatedSources.find(located => located.uid === preferredUid);
        if (matched) {
            matchedPreferredSource = true;
        }
        if (matched && (!isEligible || isEligible(matched))) {
            return matched;
        }
    }
    if (matchedPreferredSource) {
        return undefined;
    }
    return isEligible ? locatedSources.find(isEligible) : locatedSources[0];
}

/**

 *


 */
export function fireTriggerForSource(
    state: SmashUpCore,
    sourceDefId: string,
    timing: TriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>,
    options?: { phase?: 'replacement' | 'reaction' }
): TriggerResult {
    if (triggerRegistry.length === 0) {
        return { events: [] };
    }

    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    const fullCtx: TriggerContext = { ...ctx, timing };

    for (const entry of triggerRegistry) {
        if (entry.sourceDefId !== sourceDefId) continue;
        if (entry.timing !== timing) continue;
        if (options?.phase && (entry.phase ?? 'reaction') !== options.phase) continue;

        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        const getFilteredMatchState = () => (
            matchState && matchState.core === state
                ? { ...matchState, core: filteredState }
                : matchState
        );
        const canTriggerWithSource = (located: TriggerSourceLocation): boolean => (
            !entry.canTrigger
            || entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, ctx.now, ctx.playerId, located, ctx))
        );

        if (entry.global) {
            const located = selectGlobalTriggerSourceLocation(
                filteredState,
                entry,
                timing,
                entry.globalZones ?? ['hand', 'discard'],
                ctx.playerId,
                ctx,
                candidate => !entry.canTrigger
                    || entry.canTrigger(buildTriggerEligibilityContext(filteredState, entry, timing, ctx.now, ctx.playerId, candidate, ctx)),
            );
            if (!located) continue;
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceDefId: entry.sourceDefId,
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: getTriggerSourcePlayerId(entry, located) ?? located.controllerId });
            const triggerEvents = Array.isArray(result) ? result : result.events;
            if (triggerEvents.length > 0) {
                events.push(...triggerEvents);
            }
            if (!Array.isArray(result) && result.matchState) {
                matchState = result.matchState;
            }
            continue;
        }

        const locatedSources = locateSources(filteredState, entry.sourceDefId);
        if (locatedSources.length === 0) {
            if (!entry.perInstance && isSourceActive(filteredState, entry.sourceDefId) && canTriggerWithSource({})) {
                const result = entry.callback({ ...fullCtx, state: filteredState, matchState: getFilteredMatchState() });
                const triggerEvents = Array.isArray(result) ? result : result.events;
                if (triggerEvents.length > 0) {
                    events.push(...triggerEvents);
                }
                if (!Array.isArray(result) && result.matchState) {
                    matchState = result.matchState;
                }
            }
            continue;
        }

        const sourcesToExecute = entry.perInstance
            ? locatedSources.filter(located => (
                isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)
                && isTurnBoundarySourceControllerEligible(entry, timing, located, ctx.playerId)
                && canTriggerWithSource(located)
            ))
            : [selectSpecificSourceLocation(locatedSources, ctx, located => (
                isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)
                && isTurnBoundarySourceControllerEligible(entry, timing, located, ctx.playerId)
                && canTriggerWithSource(located)
            ))].filter(located => located !== undefined);
        if (sourcesToExecute.length === 0) continue;

        for (const located of sourcesToExecute) {
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceDefId: entry.sourceDefId,
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: getTriggerSourcePlayerId(entry, located) ?? located.controllerId });
            const triggerEvents = Array.isArray(result) ? result : result.events;
            if (triggerEvents.length > 0) {
                events.push(...triggerEvents);
            }
            if (!Array.isArray(result) && result.matchState) {
                matchState = result.matchState;
            }
        }
    }

    return { events, matchState };
}

function isSourceInZones(
    state: SmashUpCore,
    sourceDefId: string,
    zones: Array<'hand' | 'discard' | 'deck'>,
): boolean {
    for (const p of Object.values(state.players)) {
        if (zones.includes('hand') && p.hand?.some(c => c.defId === sourceDefId)) return true;
        if (zones.includes('discard') && p.discard?.some(c => c.defId === sourceDefId)) return true;
        if (zones.includes('deck') && p.deck?.some(c => c.defId === sourceDefId)) return true;
    }
    if ((state.titans ?? []).some(titan => titan.defId === sourceDefId)) {
        return true;
    }
    return false;
}

function locateGlobalSources(
    state: SmashUpCore,
    sourceDefId: string,
    zones: Array<'hand' | 'discard' | 'deck'>,
): TriggerSourceLocation[] {
    const locations: TriggerSourceLocation[] = [];
    for (const player of Object.values(state.players)) {
        if (zones.includes('hand')) {
            for (const card of player.hand ?? []) {
                if (card.defId === sourceDefId) {
                    locations.push({ uid: card.uid, controllerId: player.id, ownerId: card.owner });
                }
            }
        }
        if (zones.includes('discard')) {
            for (const card of player.discard ?? []) {
                if (card.defId === sourceDefId) {
                    locations.push({ uid: card.uid, controllerId: player.id, ownerId: card.owner });
                }
            }
        }
        if (zones.includes('deck')) {
            for (const card of player.deck ?? []) {
                if (card.defId === sourceDefId) {
                    locations.push({ uid: card.uid, controllerId: player.id, ownerId: card.owner });
                }
            }
        }
    }
    for (const titan of state.titans ?? []) {
        if (titan.defId !== sourceDefId) continue;
        locations.push({
            uid: titan.uid,
            titanUid: titan.uid,
            baseIndex: titan.location.zone === 'base' ? titan.location.baseIndex : undefined,
            controllerId: titan.controllerId,
            ownerId: titan.ownerId,
        });
    }
    return locations;
}

function buildExplicitGlobalSourceFallback(
    entry: Pick<TriggerEntry, 'playerContext'>,
    ctx?: Omit<TriggerContext, 'timing'>,
): TriggerSourceLocation | undefined {
    if (!ctx?.sourceCardUid || ctx.sourceControllerId === undefined) return undefined;
    return {
        uid: ctx.sourceCardUid,
        baseIndex: ctx.sourceBaseIndex,
        controllerId: ctx.sourceControllerId,
        ownerId: ctx.sourceOwnerPlayerId,
        hostControllerId: entry.playerContext === 'sourceHostController' ? ctx.sourceControllerId : undefined,
    };
}

function selectGlobalTriggerSourceLocation(
    state: SmashUpCore,
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    zones: Array<'hand' | 'discard' | 'deck'>,
    playerId: PlayerId,
    ctx?: Omit<TriggerContext, 'timing'>,
    isEligible?: (located: TriggerSourceLocation) => boolean,
): TriggerSourceLocation | undefined {
    const titanSources = (state.titans ?? [])
        .filter(titan => titan.defId === entry.sourceDefId)
        .map(titan => ({
            uid: titan.uid,
            titanUid: titan.uid,
            baseIndex: titan.location.zone === 'base' ? titan.location.baseIndex : undefined,
            controllerId: titan.controllerId,
            ownerId: titan.ownerId,
        }));
    if (!isSourceInZones(state, entry.sourceDefId, zones) && titanSources.length === 0) {
        if (
            timing === 'onMinionDiscardedFromBase'
            && zones.includes('discard')
            && ctx?.triggerMinionDefId === entry.sourceDefId
            && ctx.triggerMinionUid
        ) {
            return {
                uid: ctx.triggerMinionUid,
                baseIndex: ctx.baseIndex,
                controllerId: ctx.triggerMinion?.controller ?? ctx.controllerId ?? playerId,
                ownerId: ctx.triggerMinion?.owner,
            };
        }
        return undefined;
    }
    const preferredUids = [
        ctx?.sourceCardUid,
        ctx?.triggerMinionDefId === entry.sourceDefId ? ctx.triggerMinionUid : undefined,
    ].filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);
    const locatedSources = [
        ...locateGlobalSources(state, entry.sourceDefId, zones),
        ...titanSources.filter(titanSource =>
            !locateGlobalSources(state, entry.sourceDefId, zones).some(source => source.uid === titanSource.uid),
        ),
    ];
    const isCandidateEligible = (candidate: TriggerSourceLocation): boolean => (
        (
            timing !== 'onTurnStart'
            && timing !== 'onTurnEnd'
        ) || isTurnBoundarySourceControllerEligible(entry, timing, candidate, playerId)
    ) && (!isEligible || isEligible(candidate));
    const preferredLocated = preferredUids.length > 0
        ? locatedSources.find(candidate =>
            preferredUids.includes(candidate.uid ?? '')
            && isCandidateEligible(candidate),
        )
        : undefined;
    const explicitGlobalFallback = buildExplicitGlobalSourceFallback(entry, ctx);
    if (ctx?.sourceCardUid) {
        if (preferredLocated) return preferredLocated;
        if (explicitGlobalFallback && (!isEligible || isEligible(explicitGlobalFallback))) {
            return explicitGlobalFallback;
        }
        return undefined;
    }
    const located = preferredLocated
        ?? selectSpecificSourceLocation(locatedSources, ctx, isCandidateEligible);
    if (located) return located;
    if (entry.playerContext !== 'sourceController' && entry.playerContext !== 'sourceHostController') {
        return {};
    }
    if (!explicitGlobalFallback || (isEligible && !isEligible(explicitGlobalFallback))) return undefined;
    return explicitGlobalFallback;
}

// ============================================================================

// ============================================================================

/**

 *





 */
function isSourceActive(state: SmashUpCore, sourceDefId: string): boolean {
    // 特殊响应牌打出后会进入弃牌堆，但其本回合的限制仍由基地 metadata 承载。
    if (sourceDefId === 'munchkin_orcs_and_stay_down'
        && state.bases.some(base => typeof base.metadata?.andStayDownTurnNumber === 'number')) {
        return true;
    }
    // PR63: Tricksters POD「睡眠印记」会写入 sleepMarkedPlayers / sleepMoveMarkedPlayers，
    // 同时使用 registerInterceptor('trickster_mark_of_sleep_pod') 拦截 MINION_MOVED。
    //
    // 由于该卡在数据上是 standard action（不是 ongoing），它不会挂在 base.ongoingActions 上，
    // 如果仅依赖“卡牌是否在场”来判断 source 是否 active，会导致拦截器永远不生效。
    //
    // 因此这里把“睡眠印记 POD 的 turn restriction 尚未清除”或旧版 sleep* 标记尚未过期视为 source active。
    if (sourceDefId === 'trickster_mark_of_sleep_pod') {
        if (state.playerRestrictionsUntilTurnStart?.some(entry => entry.sourceDefId === sourceDefId)) {
            return true;
        }
        const expires = state.sleepMarkExpiresOnTurnNumber;
        const hasAnyMarks =
            (state.sleepMarkedPlayers?.length ?? 0) > 0
            || (state.sleepMoveMarkedPlayers?.length ?? 0) > 0;
        if (hasAnyMarks && typeof expires === 'number' && state.turnNumber < expires) {
            return true;
        }
    }

    if (state.pendingAfterScoringSpecials?.some(s => s.sourceDefId === sourceDefId)) {
        return true;
    }
    for (const base of state.bases) {

        if (base.defId === sourceDefId) {
            return true;
        }

        if (base.ongoingActions.some(o => o.defId === sourceDefId)) {
            return true;
        }

        if (base.minions.some(m => m.defId === sourceDefId)) {
            return true;
        }

        for (const m of base.minions) {
            if (m.attachedActions?.some(a => a.defId === sourceDefId)) {
                return true;
            }
        }
    }

    if ((state.titans ?? []).some(titan => titan.defId === sourceDefId && titan.location.zone === 'base')) {
        return true;
    }

    return false;
}

/**


 */
export function isSourceActiveOnBase(state: SmashUpCore, sourceDefId: string, baseIndex: number): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;

    if (base.defId === sourceDefId) return true;

    if (base.ongoingActions.some(o => o.defId === sourceDefId)) return true;

    if (base.minions.some(m => m.defId === sourceDefId)) return true;
    for (const minion of base.minions) {
        if (minion.attachedActions?.some(action => action.defId === sourceDefId)) {
            return true;
        }
    }
    if ((state.titans ?? []).some(titan =>
        titan.defId === sourceDefId
        && titan.location.zone === 'base'
        && titan.location.baseIndex === baseIndex,
    )) {
        return true;
    }
    return false;
}

// ============================================================================

// ============================================================================


export interface BaseRestrictionInfo {
    type: 'blocked_faction' | 'blocked_action';
    displayText: string;
    sourceDefId: string;
}

export function getBaseRestrictions(state: SmashUpCore, baseIndex: number): BaseRestrictionInfo[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    const restrictions: BaseRestrictionInfo[] = [];


    const blockActions = base.ongoingActions.filter(o => matchesDefId(o.defId, 'trickster_block_the_path'));
    for (const blockAction of blockActions) {
        const blockedFaction = blockAction.metadata?.blockedFaction as string | undefined;
        if (!blockedFaction) continue;


        restrictions.push({
            type: 'blocked_faction',
            displayText: blockedFaction,
            sourceDefId: blockAction.defId,
        });
    }


    // const domeAction = base.ongoingActions.find(o => o.defId === 'steampunk_ornate_dome');
    // if (domeAction) {
    //     restrictions.push({
    //         type: 'blocked_action',
    //         displayText: 'action',
    //         sourceDefId: 'steampunk_ornate_dome',
    //     });
    // }

    return restrictions;
}
