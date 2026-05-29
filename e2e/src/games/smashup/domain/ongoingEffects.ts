/**
 * SmashUp ongoing effects registry and runtime helpers.
 * Mirrors src/games/smashup/domain/ongoingEffects.ts for E2E parity.
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type {
    ActiveDuel,
    DuelOutcomeKind,
    SmashUpCore,
    SmashUpEvent,
    MinionOnBase,
    TriggerInstance,
    TriggerQueuedEvent,
    PlayerTurnRestrictionType } from './types';
import { SU_EVENTS } from './types';
import { registerTriggerExecutor } from './triggerExecutors';
import { getBaseDef, getTitanDef } from '../data/cards';
import { matchesDefId, mustUseBaseLimitedMinionQuota } from './utils';

// ============================================================================
// Registry types
// ============================================================================


export type ProtectionType =
    | 'destroy'
    | 'move'
    | 'affect'
    | 'action';


export type BaseAbilitySuppressionChecker = (state: SmashUpCore, baseIndex: number) => boolean;


export interface ProtectionCheckContext {
    state: SmashUpCore;

    targetMinion: MinionOnBase;

    targetBaseIndex: number;

    sourcePlayerId: PlayerId;

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
    | 'onCardsDiscarded'
    | 'onCardBuried'
    | 'onBuriedCardUncovered'
    | 'onBaseRevealed'
    | 'onMinionDestroyed'
    | 'onMinionMoved'
    | 'onCardReturnedToHand'
    | 'onDeckInspected'
    | 'onMinionAffected'
    | 'onMinionDiscardedFromBase'
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
    /** 同一事件/同一牌的反应 frame */
    frameId?: string;
    /** 触发来源事件 id */
    sourceEventId?: string;
    /** 具体触发来源实例 uid */
    sourceCardUid?: string;
    /** 触发来源所在基地 */
    sourceBaseIndex?: number;
    /** 触发来源控制者 */
    sourceControllerId?: PlayerId;
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
    /** 触发相关随从 */
    triggerMinion?: MinionOnBase;
    /** 触发相关随从 UID */
    triggerMinionUid?: string;
    /** 触发相关随从 defId */
    triggerMinionDefId?: string;
    /** 消灭者（仅 onMinionDestroyed） */
    destroyerId?: PlayerId;
    /** 事件原因 */
    reason?: string;
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

// ============================================================================
// UI helpers
// ============================================================================

interface ProtectionEntry {

    sourceDefId: string;
    protectionType: ProtectionType;
    checker: ProtectionChecker;

    consumable?: boolean;
}

interface RestrictionEntry {
    sourceDefId: string;
    restrictionType: RestrictionType;
    checker: RestrictionChecker;
}

interface TriggerEntry {
    sourceDefId: string;
    timing: TitanAwareTriggerTiming;
    rawCallback: TriggerCallback;
    callback: TriggerCallback;
    optional?: boolean;
    mandatory?: boolean;
    phase?: 'replacement' | 'reaction';
    playerContext?: 'eventPlayer' | 'sourceController';
    baseScoped?: boolean;

    perInstance?: boolean;

    sourceScope?: 'any' | 'triggerBase';
    /**
     * Global triggers bypass the "source must be in play" witness check.
     * Use for Special cards that can be played from hand/discard when a condition happens.
     */
    global?: boolean;

    globalZones?: Array<'hand' | 'discard' | 'deck'>;
    fallbackFootprint?: import('./types').SmashUpReactionResourceFootprint & { fallbackReason: string };
}

interface TriggerSourceLocation {
    uid?: string;
    baseIndex?: number;
    controllerId?: PlayerId;
    titanUid?: string;
}

interface InterceptorEntry {
    sourceDefId: string;
    interceptor: EventInterceptor;
}

// ============================================================================

// ============================================================================

const protectionRegistry: ProtectionEntry[] = [];
const restrictionRegistry: RestrictionEntry[] = [];
const triggerRegistry: TriggerEntry[] = [];
const interceptorRegistry: InterceptorEntry[] = [];
const baseAbilitySuppressionRegistry: { sourceDefId: string; checker: BaseAbilitySuppressionChecker }[] = [];


export function registerProtection(
    sourceDefId: string,
    protectionType: ProtectionType,
    checker: ProtectionChecker,
    options?: { consumable?: boolean }
): void {

    if (protectionRegistry.some(e => e.sourceDefId === sourceDefId && e.protectionType === protectionType)) return;
    protectionRegistry.push({ sourceDefId, protectionType, checker, consumable: options?.consumable });
}


export function registerRestriction(
    sourceDefId: string,
    restrictionType: RestrictionType,
    checker: RestrictionChecker
): void {

    if (restrictionRegistry.some(e => e.sourceDefId === sourceDefId && e.restrictionType === restrictionType)) return;
    restrictionRegistry.push({ sourceDefId, restrictionType, checker });
}

export function registerTrigger(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    callback: TriggerCallback,
    options?: {
        optional?: boolean;
        mandatory?: boolean;
        phase?: 'replacement' | 'reaction';
        global?: boolean;
        globalZones?: Array<'hand' | 'discard' | 'deck'>;
        playerContext?: 'eventPlayer' | 'sourceController';
        baseScoped?: boolean;
        perInstance?: boolean;
        sourceScope?: 'any' | 'triggerBase';
            fallbackFootprint?: import('./types').SmashUpReactionResourceFootprint & { fallbackReason: string };
    }
): void {

    if (triggerRegistry.some(e => e.sourceDefId === sourceDefId && e.timing === timing)) return;
    triggerRegistry.push({
        sourceDefId,
        timing,
        rawCallback: callback,
        callback,
        optional: options?.optional,
        mandatory: options?.mandatory,
        phase: options?.phase ?? 'reaction',
        perInstance: options?.perInstance,
        sourceScope: options?.sourceScope ?? 'any',
        global: options?.global,
        globalZones: options?.globalZones,
        playerContext: options?.playerContext ?? 'eventPlayer',
        baseScoped: options?.baseScoped ?? true,
        fallbackFootprint: options?.fallbackFootprint });
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
            });
        }
        for (const minion of base.minions.filter(m => m.defId === sourceDefId)) {
            locations.push({ uid: minion.uid, baseIndex: i, controllerId: minion.controller });
        }
        for (const m of base.minions) {
            for (const attached of m.attachedActions?.filter(a => a.defId === sourceDefId) ?? []) {
                const metadata = attached.metadata as { sourceControllerId?: PlayerId; sourcePlayerId?: PlayerId } | undefined;
                locations.push({
                    uid: attached.uid,
                    baseIndex: i,
                    controllerId: metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? attached.ownerId,
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
            controllerId: titan.controllerId });
    }
    for (const special of state.pendingAfterScoringSpecials ?? []) {
        if (special.sourceDefId !== sourceDefId) continue;
        locations.push({
            uid: special.cardUid,
            baseIndex: special.baseIndex,
            controllerId: special.playerId });
    }
    return locations;
}

function locateSource(state: SmashUpCore, sourceDefId: string): TriggerSourceLocation {
    return locateSources(state, sourceDefId)[0] ?? {};
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
    if (entry.playerContext !== 'sourceController') return true;
    if (timing !== 'onTurnStart' && timing !== 'onTurnEnd') return true;
    if (!located.controllerId) return true;
    return located.controllerId === playerId;
}

function buildTriggerId(
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    now: number,
    order: number,
    located: TriggerSourceLocation,
): string {
    if (entry.perInstance) {
        return `${timing}:${entry.sourceDefId}:${now}:${order}`;
    }
    return `${timing}:${entry.sourceDefId}:${now}:${order}`;
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
    const triggerBaseControllersAtTrigger = ctx.baseIndex !== undefined
        ? Array.from(new Set((state.bases[ctx.baseIndex]?.minions ?? []).map((minion) => minion.controller)))
        : undefined;
    return {
        id: buildTriggerId(entry, timing, now, order, located),
        timing,
        sourceDefId: entry.sourceDefId,
        sourceCardUid: located.uid,
        sourceControllerId: located.controllerId,
        sourceBaseIndex: located.baseIndex,
        mandatory,
        resolutionClass: mandatory ? 'mandatory' : 'optional',
        frameId,
        sourceEventId,
        ownerPlayerId: entry.playerContext === 'sourceController' && located.controllerId
            ? located.controllerId
            : pid,
        witnessRequirement: 'inPlayAtTriggerTime',
        witnessed: true,
        baseIndex: ctx.baseIndex,
        moveFromBaseIndex: ctx.moveFromBaseIndex,
        moveToBaseIndex: ctx.moveToBaseIndex,
        triggerMinionUid: ctx.triggerMinionUid,
        triggerMinionDefId: ctx.triggerMinionDefId,
        triggerMinionPower: (ctx as any).triggerMinionPower,
        destroyerId: ctx.destroyerId,
        reason: ctx.reason,
        affectType: ctx.affectType,
        counterChangeKind: ctx.counterChangeKind,
        counterDelta: ctx.counterDelta,
        affectEvent: ctx.affectEvent,
        rankings: ctx.rankings,
        triggerBaseControllersAtTrigger,
        buriedCardUid: (ctx as any).buriedCardUid,
        buriedCardDefId: (ctx as any).buriedCardDefId,
        buriedCardControllerId: (ctx as any).buriedCardControllerId,
        buriedFrom: (ctx as any).buriedFrom,
        actionTargetBaseIndex: ctx.actionTargetBaseIndex,
        actionTargetType: ctx.actionTargetType,
        actionTargetMinionUid: ctx.actionTargetMinionUid,
        inspectionCards: ctx.inspectionCards,
        inspectionZone: ctx.inspectionZone,
        inspectionTargetPlayerIds: ctx.inspectionTargetPlayerIds,
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
                metadata: ctx.triggerMinion.metadata ? { ...ctx.triggerMinion.metadata } : undefined }
            : undefined };
}

function shouldSkipTriggerInstance(
    state: SmashUpCore,
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    located: TriggerSourceLocation,
    ctx: Omit<TriggerContext, 'timing'>,
): boolean {
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

    return entry.sourceDefId === 'explorers_very_large_boulder'
        && timing === 'onMinionMoved'
        && !!located.titanUid
        && (state.veryLargeBoulderTriggeredTurnByTitan ?? {})[located.titanUid] === state.turnNumber;
}

/** 收集符合当前时机的触发器实例，供全局反应队列后续排序与执行。 */
export function collectTriggers(
    state: SmashUpCore,
    timing: TitanAwareTriggerTiming,
    ctx: Omit<TriggerContext, 'timing'>,
): TriggerQueuedEvent | undefined {
    if (triggerRegistry.length === 0) return undefined;
    const triggers: TriggerInstance[] = [];
    const now = ctx.now;
    const pid = ctx.playerId;

    for (const entry of triggerRegistry) {
        if (entry.timing !== timing) continue;
        // Only queue reaction-phase triggers (replacement effects must remain immediate)
        if (entry.phase === 'replacement') continue;
        if (entry.global) {
            const located = selectGlobalTriggerSourceLocation(
                state,
                entry,
                timing,
                entry.globalZones ?? ['hand', 'discard'],
                pid,
            );
            if (!located) continue;
            triggers.push(createTriggerInstance(state, entry, timing, now, triggers.length, pid, located, ctx));
            continue;
        }

        const locatedSources = locateSources(state, entry.sourceDefId);
        if (locatedSources.length === 0) {
            if (!entry.perInstance && isSourceActive(state, entry.sourceDefId)) {
                triggers.push(createTriggerInstance(state, entry, timing, now, triggers.length, pid, {}, ctx));
            }
            continue;
        }

        if (entry.perInstance) {
            for (const located of locatedSources) {
                if (!isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)) continue;
                if (!isTurnBoundarySourceControllerEligible(entry, timing, located, pid)) continue;
                if (shouldSkipTriggerInstance(state, entry, timing, located, ctx)) continue;
                triggers.push(createTriggerInstance(state, entry, timing, now, triggers.length, pid, located, ctx));
            }
            continue;
        }

        const located = selectSpecificSourceLocation(locatedSources, ctx, candidate => (
            isTriggerSourceEligible(entry, timing, candidate, ctx.baseIndex)
            && isTurnBoundarySourceControllerEligible(entry, timing, candidate, pid)
            && !shouldSkipTriggerInstance(state, entry, timing, candidate, ctx)
        ));
        if (!located) continue;
        triggers.push(createTriggerInstance(state, entry, timing, now, triggers.length, pid, located, ctx));
    }

    if (triggers.length === 0) return undefined;
    return {
        type: SU_EVENTS.TRIGGER_QUEUED,
        payload: { triggers },
        timestamp: now } as TriggerQueuedEvent;
}


export function registerInterceptor(
    sourceDefId: string,
    interceptor: EventInterceptor
): void {

    if (interceptorRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    interceptorRegistry.push({ sourceDefId, interceptor });
}


export function registerBaseAbilitySuppression(
    sourceDefId: string,
    checker: BaseAbilitySuppressionChecker
): void {

    if (baseAbilitySuppressionRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    baseAbilitySuppressionRegistry.push({ sourceDefId, checker });
}


export function clearOngoingEffectRegistry(): void {
    protectionRegistry.length = 0;
    restrictionRegistry.length = 0;
    triggerRegistry.length = 0;
    interceptorRegistry.length = 0;
    baseAbilitySuppressionRegistry.length = 0;
}

export function hasRegisteredTrigger(sourceDefId: string, timing: TriggerTiming): boolean {
    return triggerRegistry.some(entry => entry.sourceDefId === sourceDefId && entry.timing === timing);
}

/**

 * 



 * 

 */
export function registerPodOngoingAliases(): void {
    let mappedCount = 0;
    

    const triggersToAdd: TriggerEntry[] = [];
    for (const entry of triggerRegistry) {
        const { sourceDefId, timing, rawCallback, fallbackFootprint } = entry;
        

        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        
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
            optional: entry.optional,
            phase: entry.phase,
            perInstance: entry.perInstance,
            sourceScope: entry.sourceScope,
            global: entry.global,
            globalZones: entry.globalZones,
            fallbackFootprint });
        mappedCount++;
    }
    

    for (const entry of triggersToAdd) {
        registerTrigger(entry.sourceDefId, entry.timing, entry.callback, {
            optional: entry.optional,
            phase: entry.phase,
            perInstance: entry.perInstance,
            sourceScope: entry.sourceScope,
            global: entry.global,
            globalZones: entry.globalZones,
                fallbackFootprint: entry.fallbackFootprint });
    }
    

    const restrictionsToAdd: RestrictionEntry[] = [];
    for (const entry of restrictionRegistry) {
        const { sourceDefId, restrictionType, checker } = entry;
        
        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        
        const alreadyRegistered = restrictionRegistry.some(
            e => e.sourceDefId === podDefId && e.restrictionType === restrictionType
        );
        if (alreadyRegistered) continue;
        
        restrictionsToAdd.push({ sourceDefId: podDefId, restrictionType, checker });
        mappedCount++;
    }
    
    restrictionRegistry.push(...restrictionsToAdd);
    

    const protectionsToAdd: ProtectionEntry[] = [];
    for (const entry of protectionRegistry) {
        const { sourceDefId, protectionType, checker } = entry;
        
        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        
        const alreadyRegistered = protectionRegistry.some(
            e => e.sourceDefId === podDefId && e.protectionType === protectionType
        );
        if (alreadyRegistered) continue;
        
        protectionsToAdd.push({ sourceDefId: podDefId, protectionType, checker });
        mappedCount++;
    }
    
    protectionRegistry.push(...protectionsToAdd);
    

    const suppressionsToAdd: { sourceDefId: string; checker: BaseAbilitySuppressionChecker }[] = [];
    for (const entry of baseAbilitySuppressionRegistry) {
        const { sourceDefId, checker } = entry;
        
        if (sourceDefId.endsWith('_pod')) continue;
        if (getTitanDef(sourceDefId)) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        
        const alreadyRegistered = baseAbilitySuppressionRegistry.some(
            e => e.sourceDefId === podDefId
        );
        if (alreadyRegistered) continue;
        
        suppressionsToAdd.push({ sourceDefId: podDefId, checker });
        mappedCount++;
    }
    
    baseAbilitySuppressionRegistry.push(...suppressionsToAdd);
    

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
} {
    const protectionIds = new Set(protectionRegistry.map(e => e.sourceDefId));
    const restrictionIds = new Set(restrictionRegistry.map(e => e.sourceDefId));
    const interceptorIds = new Set(interceptorRegistry.map(e => e.sourceDefId));
    const baseAbilitySuppressionIds = new Set(baseAbilitySuppressionRegistry.map(e => e.sourceDefId));


    const triggerIds = new Map<string, TriggerTiming[]>();
    for (const entry of triggerRegistry) {
        const existing = triggerIds.get(entry.sourceDefId) ?? [];
        existing.push(entry.timing);
        triggerIds.set(entry.sourceDefId, existing);
    }

    return { protectionIds, restrictionIds, triggerIds, interceptorIds, baseAbilitySuppressionIds };
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


export function isCardSuppressed(
    state: SmashUpCore,
    cardUid: string,
): boolean {
    return state.suppressedCardsUntilTurnStart?.some(entry => entry.cardUid === cardUid) ?? false;
}

export function getSuppressionFilteredStateForSource(
    state: SmashUpCore,
    sourceDefId: string,
): SmashUpCore {
    if (!state.suppressedCardsUntilTurnStart?.length) {
        return state;
    }

    const suppressedUids = new Set(state.suppressedCardsUntilTurnStart.map(entry => entry.cardUid));
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
    protectionType: ProtectionType
): boolean {
    if (hasTurnScopedMetadataProtection(state, targetMinion, protectionType)) return true;
    if (protectionRegistry.length === 0) return false;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;

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
    protectionType: ProtectionType
): boolean {
    if (hasTurnScopedMetadataProtection(state, targetMinion, protectionType)) return true;
    if (protectionRegistry.length === 0) return false;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        if (entry.consumable) continue;
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
): boolean {
    const metadata = targetMinion.metadata ?? {};
    const currentTurn = state.turnNumber ?? 0;
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
): { uid: string; defId: string; ownerId: string } | undefined {
    if (protectionRegistry.length === 0) return undefined;

    const ctx: ProtectionCheckContext = {
        state,
        targetMinion,
        targetBaseIndex,
        sourcePlayerId,
        protectionType };

    for (const entry of protectionRegistry) {
        if (entry.protectionType !== protectionType) continue;
        if (!entry.consumable) continue;
        const filteredState = getSuppressionFilteredStateForSource(state, entry.sourceDefId);
        if (!isSourceActive(filteredState, entry.sourceDefId)) continue;
        if (!entry.checker({ ...ctx, state: filteredState })) continue;

        const base = filteredState.bases[targetBaseIndex];
        if (!base) continue;

        const filteredTargetMinion = base.minions.find(minion => minion.uid === targetMinion.uid) ?? targetMinion;
        const attached = filteredTargetMinion.attachedActions.find(a => a.defId === entry.sourceDefId);
        if (attached) return { uid: attached.uid, defId: attached.defId, ownerId: attached.ownerId };

        const ongoing = base.ongoingActions.find(o => o.defId === entry.sourceDefId);
        if (ongoing) return { uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId };
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
            if (!isSourceActiveOnBase(filteredState, entry.sourceDefId, baseIndex)) continue;
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

        if (entry.global) {
            const located = selectGlobalTriggerSourceLocation(
                filteredState,
                entry,
                timing,
                entry.globalZones ?? ['hand', 'discard'],
                ctx.playerId,
            );
            if (!located) continue;
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: located.controllerId });
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
            if (!entry.perInstance && isSourceActive(filteredState, entry.sourceDefId)) {
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
            ))
            : [selectSpecificSourceLocation(locatedSources, ctx, located => (
                isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)
                && isTurnBoundarySourceControllerEligible(entry, timing, located, ctx.playerId)
            ))].filter(located => located !== undefined);
        if (sourcesToExecute.length === 0) continue;

        for (const located of sourcesToExecute) {
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: located.controllerId });
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
    ctx: Omit<TriggerContext, 'timing'>,
    isEligible?: (located: TriggerSourceLocation) => boolean,
): TriggerSourceLocation | undefined {
    const preferredUids = [ctx.sourceCardUid, ctx.triggerMinionUid].filter(
        (uid): uid is string => typeof uid === 'string' && uid.length > 0,
    );
    for (const preferredUid of preferredUids) {
        const matched = locatedSources.find(located => located.uid === preferredUid);
        if (matched && (!isEligible || isEligible(matched))) {
            return matched;
        }
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

        if (entry.global) {
            const located = selectGlobalTriggerSourceLocation(
                filteredState,
                entry,
                timing,
                entry.globalZones ?? ['hand', 'discard'],
                ctx.playerId,
            );
            if (!located) continue;
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: located.controllerId });
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
            if (!entry.perInstance && isSourceActive(filteredState, entry.sourceDefId)) {
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
            ))
            : [selectSpecificSourceLocation(locatedSources, ctx, located => (
                isTriggerSourceEligible(entry, timing, located, ctx.baseIndex)
                && isTurnBoundarySourceControllerEligible(entry, timing, located, ctx.playerId)
            ))].filter(located => located !== undefined);
        if (sourcesToExecute.length === 0) continue;

        for (const located of sourcesToExecute) {
            const result = entry.callback({
                ...fullCtx,
                state: filteredState,
                matchState: getFilteredMatchState(),
                sourceCardUid: located.uid,
                sourceBaseIndex: located.baseIndex,
                sourceControllerId: located.controllerId });
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
                    locations.push({ uid: card.uid, controllerId: card.owner ?? player.id });
                }
            }
        }
        if (zones.includes('discard')) {
            for (const card of player.discard ?? []) {
                if (card.defId === sourceDefId) {
                    locations.push({ uid: card.uid, controllerId: card.owner ?? player.id });
                }
            }
        }
        if (zones.includes('deck')) {
            for (const card of player.deck ?? []) {
                if (card.defId === sourceDefId) {
                    locations.push({ uid: card.uid, controllerId: card.owner ?? player.id });
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
            controllerId: titan.location.zone === 'base' ? titan.controllerId : titan.ownerId });
    }
    return locations;
}

function selectGlobalTriggerSourceLocation(
    state: SmashUpCore,
    entry: TriggerEntry,
    timing: TitanAwareTriggerTiming,
    zones: Array<'hand' | 'discard' | 'deck'>,
    playerId: PlayerId,
): TriggerSourceLocation | undefined {
    if (!isSourceInZones(state, entry.sourceDefId, zones)) return undefined;
    if (entry.playerContext !== 'sourceController') return {};
    if (timing !== 'onTurnStart' && timing !== 'onTurnEnd') return {};
    return locateGlobalSources(state, entry.sourceDefId, zones).find(located =>
        isTurnBoundarySourceControllerEligible(entry, timing, located, playerId),
    );
}

// ============================================================================

// ============================================================================

/**

 *





 */
function isSourceActive(state: SmashUpCore, sourceDefId: string): boolean {
    // PR63: Tricksters POD「睡眠印记」会写入 sleepMarkedPlayers / sleepMoveMarkedPlayers，
    // 同时使用 registerInterceptor('trickster_mark_of_sleep_pod') 拦截 MINION_MOVED。
    //
    // 由于该卡在数据上是 standard action（不是 ongoing），它不会挂在 base.ongoingActions 上，
    // 如果仅依赖“卡牌是否在场”来判断 source 是否 active，会导致拦截器永远不生效。
    //
    // 因此这里把“睡眠印记 POD 的标记尚未过期”视为 source active 的一种形式。
    if (sourceDefId === 'trickster_mark_of_sleep_pod') {
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
