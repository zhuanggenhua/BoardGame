/**
 * 大杀四方 - 基地能力触发系统
 *
 * 基地能力按触发时机分类，通过注册表模式实现。
 * FlowHooks 在对应时机调用 triggerBaseAbilities() 获取事件。
 */

import type { PlayerId, MatchState, RandomFn } from '../../../engine/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    MinionCardDef,
    MinionReturnedEvent,
    VpAwardedEvent,
    CardsDiscardedEvent,
    CardToDeckBottomEvent,
    MinionOnBase,
    BaseDeckReorderedEvent,
    PendingPostScoringAction } from './types';
import { SU_EVENTS } from './types';
import { getEffectivePower } from './ongoingModifiers';
import {
    drawMadnessCards,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    addTempPower,
    addPowerCounter,
    grantExtraAction,
    grantExtraMinion,
    modifyBreakpoint,
    buildReplayMoveEvent,
    buildValidatedBaseMoveEvents,
    buildValidatedDestroyEvents,
    buildValidatedReturnEvents,
    buildStandardDrawEvents,
    createSkipOption,
} from './abilityHelpers';
import { getCardDef, getBaseDef } from '../data/cards';
import {
    createSimpleChoice,
    getCurrentTrackedIdTopSnapshot,
    queueInteraction,
    type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { registerExpansionBaseAbilities, registerExpansionBaseInteractionHandlers } from './baseAbilities_expansion';
import { isBaseAbilitySuppressed } from './ongoingEffects';
import { collectExtendedBaseAbilityTriggers, registerBaseAbilityAsQueuedTrigger } from './baseAbilityQueue';
import { resolveLiveBaseIndex } from './utils';
import { shouldGenerateSmashUpPodAlias } from './variantBindingRuntime';
import {
    appendPendingPostScoringActions,
    getDeferredReplacementBaseDefId,
    isScoringSessionAwaitingDeferredResolution,
    serializePostScoringEvents,
    updateDeferredPostScoringEvents,
} from './scoringSession';
import { getCurrentPlayerId } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/** 基地能力触发时机 */
export type BaseTriggerTiming =
    | 'onMinionPlayed'    // 随从入场时
    | 'beforeScoring'     // 记分前
    | 'whenScoring'       // 计分时
    | 'afterScoring'      // 记分后
    | 'onTurnStart'       // 回合开始时
    | 'onTurnEnd'         // 回合结束时
    | 'onTalentUsed'      // 天赋使用后
    | 'onActionPlayed';   // 行动卡打出时

export interface BaseAbilityContext {
    state: SmashUpCore;
    /** 完整的 match 状态，用于调用 queueInteraction */
    matchState?: MatchState<SmashUpCore>;
    /** 触发能力时用于洗牌/随机选择的随机源 */
    random?: RandomFn;
    baseIndex: number;
    baseDefId: string;
    /**
     * 被操作实体的拥有者（语义依上下文而定）
     * - onMinionPlayed: 打出随从的玩家
     * - onMinionDestroyed: 被消灭随从的拥有者
     * - beforeScoring/afterScoring: 当前回合玩家
     * 
     * ⚠️ 注意：此字段不代表"操作发起者"（如消灭者、攻击者）
     * 需要操作发起者时，使用专用字段（如 destroyerId）
     * 
     * TODO: 未来版本将添加 actorId 字段表示操作发起者，与引擎层 ActionLogEntry.actorId 对齐
     */
    playerId: PlayerId;
    /** onMinionPlayed 时：刚打出的随从 */
    minionUid?: string;
    minionDefId?: string;
    minionPower?: number;
    /** onMinionDestroyed 时：消灭者 ID（如果有） */
    destroyerId?: PlayerId;
    /** onMinionDestroyed 时：被消灭随从的控制者 */
    controllerId?: PlayerId;
    /** onMinionDestroyed / onMinionMoved 时：本次事件的来源 reason */
    reason?: string;
    /** afterScoring 时：排名信息 */
    rankings?: { playerId: PlayerId; power: number; vp: number }[];
    /** onActionPlayed 时：行动卡目标基地 */
    actionTargetBaseIndex?: number;
    /** onActionPlayed 时：行动卡是打到基地还是打到随从 */
    actionTargetType?: 'base' | 'minion';
    /** onActionPlayed 时：行动卡目标随从（附着行动卡时有值） */
    actionTargetMinionUid?: string;
    /** 主动基地能力：玩家选择的目标基地。 */
    targetBaseIndex?: number;
    /** 主动基地能力：玩家选择的目标随从。 */
    targetMinionUid?: string;
    /** onActionPlayed 时：刚打出的行动卡 uid / defId / owner */
    triggerCardUid?: string;
    triggerCardDefId?: string;
    triggerCardOwnerId?: PlayerId;
    /** queued trigger 所属 frame 身份；用于排序/诊断/后续上下文对齐 */
    frameId?: string;
    /** queued trigger 源事件身份；用于运行时上下文恢复 */
    sourceEventId?: string;
    now: number;
}

/** 基地能力执行结果 */
export interface BaseAbilityResult {
    events: SmashUpEvent[];
    /** 如果能力创建了 Interaction，返回更新后的 matchState */
    matchState?: MatchState<SmashUpCore>;
}

/** 基地能力执行函数签名 */
export type BaseAbilityExecutor = (ctx: BaseAbilityContext) => BaseAbilityResult;

export type BaseAbilityRegistrationOptions = {
    /** Whether this trigger is mandatory for reaction ordering rules */
    mandatory?: boolean;
    /** Override the player who decides optional queued base abilities. Defaults to the caller-provided owner. */
    ownerPlayerId?: (ctx: BaseAbilityContext) => PlayerId | undefined;
    /** 当前状态下是否应进入 reaction queue；返回 false 时不暴露空触发。 */
    canTrigger?: (ctx: BaseAbilityContext) => boolean;
    /** 显式 reaction resource footprint；用于不依赖 runtime probe 的已知合同。 */
    effectContract?: import('./types').SmashUpReactionResourceFootprint;
    /** 显式 program-style footprint；用于无法通过 runtime artifacts 还原的只读依赖。 */
    deriveFootprint?: (ctx: BaseAbilityContext) => import('./types').SmashUpReactionResourceFootprint | undefined;
};

export type ActiveBaseAbilityRegistrationOptions = {
    /** 主动基地能力是否限制为“每回合一次” */
    oncePerTurn?: boolean;
    /** 当前状态下是否允许发动；用于 UI 高亮与命令验证 */
    canUse?: (ctx: BaseAbilityContext) => boolean;
};

type PirateCoveSysState = MatchState<SmashUpCore>['sys'] & { _pirateCoveTriggered?: Set<number> };
type HandCardChoiceValue = { cardUid: string; defId: string };
type ExcellentMoviesTeensStoreValue = {
    skip?: boolean;
    cardUid?: string;
    minionUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    sourceBaseIndex?: number;
    sourceCardKind?: 'minion' | 'baseOngoingAction' | 'attachedAction';
    targetMinionUid?: string;
};
type WizardAcademyContinuationContext = {
    baseIndex: number;
    topCards: string[];
    replacementBaseDefId?: string;
    step?: 'chooseReplacement' | 'orderRemaining';
};

function getContinuationContext<T>(
    interactionData: Record<string, unknown> | undefined,
): T | undefined {
    if (!interactionData) return undefined;
    return interactionData.continuationContext as T | undefined;
}

function getCurrentBaseDeckTopSnapshotDefIds(
    state: SmashUpCore,
    trackedTopCards: string[],
): string[] {
    return getCurrentTrackedIdTopSnapshot(state.baseDeck ?? [], trackedTopCards);
}

function buildWizardAcademyOptions(
    state: SmashUpCore,
    trackedTopCards: string[],
) {
    return getCurrentBaseDeckTopSnapshotDefIds(state, trackedTopCards).map((defId, index) => {
        const def = getBaseDef(defId);
        return {
            id: `base-${index}`,
            label: def?.name ?? defId,
            value: { defId, index } };
    });
}

function buildWizardAcademyPrompt(
    state: SmashUpCore,
    playerId: PlayerId,
    now: number,
    title: string,
    titleKey: string,
    trackedTopCards: string[],
    continuationContext: WizardAcademyContinuationContext,
) {
    const interaction = createSimpleChoice(
        `base_wizard_academy_${continuationContext.step ?? 'chooseReplacement'}_${now}`,
        playerId,
        title,
        buildWizardAcademyOptions(state, trackedTopCards),
        { sourceId: 'base_wizard_academy', targetType: 'generic', responseValidationMode: 'live', titleKey },
    );
    (interaction.data as { optionsGenerator?: unknown }).optionsGenerator = (
        nextState: { core: SmashUpCore },
        interactionData: { continuationContext?: WizardAcademyContinuationContext } | undefined,
    ) => buildWizardAcademyOptions(
        nextState.core,
        interactionData?.continuationContext?.topCards ?? trackedTopCards,
    );
    return {
        ...interaction,
        data: { ...interaction.data, continuationContext },
    };
}

function rewriteWizardAcademyDeferredReplacement(
    state: MatchState<SmashUpCore>,
    baseIndex: number,
    replacementBaseDefId: string,
    timestamp: number,
): MatchState<SmashUpCore> {
    if (!isScoringSessionAwaitingDeferredResolution(state)) {
        return state;
    }

    return updateDeferredPostScoringEvents(state, (deferredEvents) => {
        if (deferredEvents.length === 0) {
            return deferredEvents;
        }

        let hasReplacementEvent = false;
        const withoutRevealTriggers = deferredEvents.filter((event) => {
            if (event.type !== SU_EVENTS.TRIGGER_QUEUED) return true;
            const triggers = (event.payload as { triggers?: Array<{ timing?: string; baseIndex?: number }> } | undefined)?.triggers;
            return !Array.isArray(triggers) || !triggers.some((trigger) =>
                trigger.timing === 'onBaseRevealed' && trigger.baseIndex === baseIndex,
            );
        });

        const updatedEvents = withoutRevealTriggers.map((event) => {
            if (event.type !== SU_EVENTS.BASE_REPLACED) {
                return event;
            }
            hasReplacementEvent = true;
            return {
                ...event,
                payload: {
                    ...(event.payload as { baseIndex: number; oldBaseDefId: string; newBaseDefId: string }),
                    newBaseDefId: replacementBaseDefId,
                },
            };
        });

        if (!hasReplacementEvent) {
            return deferredEvents;
        }

        const replacementCore: SmashUpCore = {
            ...state.core,
            bases: state.core.bases.map((base, index) =>
                index === baseIndex ? { ...base, defId: replacementBaseDefId } : base,
            ),
        };
        const revealTrigger = collectExtendedBaseAbilityTriggers({
            core: replacementCore,
            timing: 'onBaseRevealed',
            ownerPlayerId: getCurrentPlayerId(state.core),
            baseIndex,
            now: timestamp,
        });

        if (!revealTrigger) {
            return updatedEvents;
        }

        return [
            ...updatedEvents,
            ...serializePostScoringEvents([revealTrigger as unknown as SmashUpEvent]),
        ];
    });
}

function getTurnMinionsPlayedAtBase(state: SmashUpCore, baseIndex: number): number {
    return Object.values(state.players).reduce(
        (total, player) => total + (player.minionsPlayedPerBase?.[baseIndex] ?? 0),
        0,
    );
}

function isFirstMinionPlayedAtBaseThisTurn(ctx: BaseAbilityContext): boolean {
    return getTurnMinionsPlayedAtBase(ctx.state, ctx.baseIndex) === 1;
}

function buildBacktimersStasisStoreFromHandEvent(
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    storedUnderDefId: string,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_STORED,
        payload: {
            playerId,
            cardUid,
            defId,
            ownerId,
            from: 'hand',
            storedUnderDefId,
            counters: 2,
            reason: 'backtimers_stasis',
        },
        timestamp: now,
    } as SmashUpEvent;
}

function buildBacktimersStasisStoreFromPlayEvent(
    playerId: PlayerId,
    value: Required<Pick<ExcellentMoviesTeensStoreValue, 'cardUid' | 'defId' | 'ownerId' | 'sourceBaseIndex' | 'sourceCardKind'>>,
    storedUnderDefId: string,
    now: number,
    targetMinionUid?: string,
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_STORED,
        payload: {
            playerId,
            cardUid: value.cardUid,
            defId: value.defId,
            ownerId: value.ownerId,
            from: 'play',
            sourceBaseIndex: value.sourceBaseIndex,
            sourceCardKind: value.sourceCardKind,
            ...(targetMinionUid ? { targetMinionUid } : {}),
            storedUnderDefId,
            counters: 2,
            reason: 'backtimers_stasis',
        },
        timestamp: now,
    } as SmashUpEvent;
}

function buildWraithrustlersHqPendingEvent(
    playerId: PlayerId,
    pending: boolean,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.WRAITHRUSTLERS_HQ_BONUS_UPDATED,
        payload: { playerId, pending, reason: 'base_wraithrustlers_hq' },
        timestamp: now,
    } as SmashUpEvent;
}

function getRuntimeActionController(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId;
}

function getPlayerMinionsAtBase(state: SmashUpCore, baseIndex: number, playerId: PlayerId): MinionOnBase[] {
    return state.bases[baseIndex]?.minions.filter(minion => minion.controller === playerId) ?? [];
}

function getPromptCardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function getPromptBaseName(state: SmashUpCore, baseIndex: number): string {
    const defId = state.bases[baseIndex]?.defId;
    return defId ? (getBaseDef(defId)?.name ?? defId) : '基地';
}

function getPlayerIdsFromCurrentPlayersLeft(state: SmashUpCore): PlayerId[] {
    const turnOrder = state.turnOrder ?? [];
    if (turnOrder.length === 0) return [];
    const currentIndex = state.currentPlayerIndex >= 0 && state.currentPlayerIndex < turnOrder.length
        ? state.currentPlayerIndex
        : 0;
    return [
        ...turnOrder.slice(currentIndex + 1),
        ...turnOrder.slice(0, currentIndex + 1),
    ];
}

// ============================================================================
// 注册表
// ============================================================================

type BaseAbilityEntry = {
    executor: BaseAbilityExecutor;
    options: Required<Pick<BaseAbilityRegistrationOptions, 'mandatory'>>
        & Pick<BaseAbilityRegistrationOptions, 'canTrigger' | 'ownerPlayerId' | 'effectContract' | 'deriveFootprint'>;
};
type ActiveBaseAbilityEntry = {
    executor: BaseAbilityExecutor;
    options: Required<Omit<ActiveBaseAbilityRegistrationOptions, 'canUse'>> & Pick<ActiveBaseAbilityRegistrationOptions, 'canUse'>;
};
const POD_SUFFIX = '_pod';

function isPodDefId(defId: string): boolean {
    return defId.endsWith(POD_SUFFIX);
}

function toPodDefId(defId: string): string {
    return isPodDefId(defId) ? defId : `${defId}${POD_SUFFIX}`;
}

/** 内部存储：baseDefId 到 Map<BaseTriggerTiming, BaseAbilityEntry> */
const baseAbilityRegistry = new Map<string, Map<BaseTriggerTiming, BaseAbilityEntry>>();
const activeBaseAbilityRegistry = new Map<string, ActiveBaseAbilityEntry>();

/** 注册一个基地能力 */
export function registerBaseAbility(
    baseDefId: string,
    timing: BaseTriggerTiming,
    executor: BaseAbilityExecutor,
    options: BaseAbilityRegistrationOptions = {},
): void {
    let timingMap = baseAbilityRegistry.get(baseDefId);
    if (!timingMap) {
        timingMap = new Map();
        baseAbilityRegistry.set(baseDefId, timingMap);
    }
    timingMap.set(timing, {
        executor,
            options: {
                mandatory: options.mandatory ?? true,
                ...(options.ownerPlayerId ? { ownerPlayerId: options.ownerPlayerId } : {}),
                ...(options.canTrigger ? { canTrigger: options.canTrigger } : {}),
                ...(options.deriveFootprint ? { deriveFootprint: options.deriveFootprint } : {}),
                ...(options.effectContract ? { effectContract: options.effectContract } : {}) } });
    // Make this base ability runnable by the global reaction queue.
    registerBaseAbilityAsQueuedTrigger(baseDefId, timing);
}

/** 注册一个“你的回合中主动使用”的基地能力 */
export function registerActiveBaseAbility(
    baseDefId: string,
    executor: BaseAbilityExecutor,
    options: ActiveBaseAbilityRegistrationOptions = {},
): void {
    activeBaseAbilityRegistry.set(baseDefId, {
        executor,
        options: {
            oncePerTurn: options.oncePerTurn ?? false,
            ...(options.canUse ? { canUse: options.canUse } : {}) } });
}

/** 触发指定基地在指定时机的能力 */
export function triggerBaseAbility(
    baseDefId: string,
    timing: BaseTriggerTiming,
    ctx: BaseAbilityContext
): BaseAbilityResult {
    // 检查基地能力是否被压制（如 alien_jammed_signal）
    if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return { events: [] };
    const entry = baseAbilityRegistry.get(baseDefId)?.get(timing);
    if (!entry) return { events: [] };
    return entry.executor(ctx);
}

/** 主动触发基地能力（如“During your turn, once each turn”） */
export function triggerActiveBaseAbility(
    baseDefId: string,
    ctx: BaseAbilityContext,
): BaseAbilityResult {
    if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return { events: [] };
    const entry = activeBaseAbilityRegistry.get(baseDefId);
    if (!entry) return { events: [] };
    return entry.executor(ctx);
}

/** 触发所有基地在指定时机的能力 */
export function triggerAllBaseAbilities(
    timing: BaseTriggerTiming,
    state: SmashUpCore,
    playerId: PlayerId,
    now: number,
    /** 在 onMinionPlayed 时需要 */
    minionContext?: { baseIndex: number; minionUid: string; minionDefId: string; minionPower: number },
    matchState?: MatchState<SmashUpCore>,
    random?: RandomFn,
): BaseAbilityResult {
    const events: SmashUpEvent[] = [];
    let ms = matchState;
    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        // onMinionPlayed 只触发随从所在基地
        if (timing === 'onMinionPlayed' && minionContext && i !== minionContext.baseIndex) {
            continue;
        }
        const ctx: BaseAbilityContext = {
            state,
            matchState: ms,
            random,
            baseIndex: i,
            baseDefId: base.defId,
            playerId,
            minionUid: minionContext?.minionUid,
            minionDefId: minionContext?.minionDefId,
            minionPower: minionContext?.minionPower,
            now };
        const result = triggerBaseAbility(base.defId, timing, ctx);
        events.push(...result.events);
        if (result.matchState) ms = result.matchState;
    }
    return { events, matchState: ms };
}

/** 检查基地是否有指定时机的能力 */
export function hasBaseAbility(baseDefId: string, timing: BaseTriggerTiming): boolean {
    return baseAbilityRegistry.get(baseDefId)?.has(timing) ?? false;
}

export function getBaseAbilityOptions(baseDefId: string, timing: BaseTriggerTiming): BaseAbilityEntry['options'] | undefined {
    return baseAbilityRegistry.get(baseDefId)?.get(timing)?.options;
}

export function getBaseAbilityExecutor(baseDefId: string, timing: BaseTriggerTiming): BaseAbilityExecutor | undefined {
    return baseAbilityRegistry.get(baseDefId)?.get(timing)?.executor;
}

export function getRegisteredBaseAbilityTimings(baseDefId: string): Set<BaseTriggerTiming> {
    return new Set(baseAbilityRegistry.get(baseDefId)?.keys() ?? []);
}

export function hasActiveBaseAbility(baseDefId: string): boolean {
    return activeBaseAbilityRegistry.has(baseDefId);
}

export function getActiveBaseAbilityOptions(baseDefId: string): ActiveBaseAbilityEntry['options'] | undefined {
    return activeBaseAbilityRegistry.get(baseDefId)?.options;
}

export function canUseActiveBaseAbility(baseDefId: string, ctx: BaseAbilityContext): boolean {
    if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return false;
    const entry = activeBaseAbilityRegistry.get(baseDefId);
    if (!entry) return false;
    return entry.options.canUse ? entry.options.canUse(ctx) : true;
}

/** 清空注册表（测试用） */
export function clearBaseAbilityRegistry(): void {
    baseAbilityRegistry.clear();
    activeBaseAbilityRegistry.clear();
    extendedRegistry.clear();
}

/** 获取注册表大小（调试用） */
export function getBaseAbilityRegistrySize(): number {
    let count = 0;
    for (const timingMap of baseAbilityRegistry.values()) {
        count += timingMap.size;
    }
    count += activeBaseAbilityRegistry.size;
    for (const timingMap of extendedRegistry.values()) {
        count += timingMap.size;
    }
    return count;
}

// ============================================================================
// 扩展触发时机：随从被消灭时
// ============================================================================

export type ExtendedBaseTrigger = BaseTriggerTiming | 'onMinionDestroyed';

/** 扩展注册表：支持 onMinionDestroyed */
type ExtendedBaseAbilityRegistrationOptions = {
    mandatory?: boolean;
    /** Override the player who decides optional queued extended base abilities. Defaults to the caller-provided owner. */
    ownerPlayerId?: (ctx: BaseAbilityContext) => PlayerId | undefined;
    /** 当前状态下是否应进入 reaction queue；返回 false 时不暴露空触发。 */
    canTrigger?: (ctx: BaseAbilityContext) => boolean;
    /** 显式 reaction resource footprint；用于不依赖 runtime probe 的已知合同。 */
    effectContract?: import('./types').SmashUpReactionResourceFootprint;
    /** 显式 program-style footprint；用于无法通过 runtime artifacts 还原的只读依赖。 */
    deriveFootprint?: (ctx: BaseAbilityContext) => import('./types').SmashUpReactionResourceFootprint | undefined;
};

type ExtendedBaseAbilityEntry = {
    executor: BaseAbilityExecutor;
    options: Required<Pick<ExtendedBaseAbilityRegistrationOptions, 'mandatory'>>
        & Pick<ExtendedBaseAbilityRegistrationOptions, 'canTrigger' | 'ownerPlayerId' | 'effectContract' | 'deriveFootprint'>;
};

const extendedRegistry = new Map<string, Map<string, ExtendedBaseAbilityEntry>>();

export function registerExtended(
    baseDefId: string,
    timing: string,
    executor: BaseAbilityExecutor,
    options: ExtendedBaseAbilityRegistrationOptions = {},
): void {
    let timingMap = extendedRegistry.get(baseDefId);
    if (!timingMap) {
        timingMap = new Map();
        extendedRegistry.set(baseDefId, timingMap);
    }
    timingMap.set(timing, {
        executor,
        options: {
            mandatory: options.mandatory ?? true,
            ...(options.ownerPlayerId ? { ownerPlayerId: options.ownerPlayerId } : {}),
            ...(options.canTrigger ? { canTrigger: options.canTrigger } : {}),
            ...(options.deriveFootprint ? { deriveFootprint: options.deriveFootprint } : {}),
            ...(options.effectContract ? { effectContract: options.effectContract } : {}),
        } });
}

/** 触发扩展时机（如 onMinionDestroyed） */
export function triggerExtendedBaseAbility(
    baseDefId: string,
    timing: string,
    ctx: BaseAbilityContext
): BaseAbilityResult {
    // 扩展触发同样遵循基地能力压制（如 alien_jammed_signal）
    if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return { events: [] };
    const entry = extendedRegistry.get(baseDefId)?.get(timing);
    if (!entry) return { events: [] };
    return entry.executor(ctx);
}

export function getExtendedBaseAbilityOptions(
    baseDefId: string,
    timing: string,
): ExtendedBaseAbilityEntry['options'] | undefined {
    return extendedRegistry.get(baseDefId)?.get(timing)?.options;
}

export function getExtendedBaseAbilityExecutor(baseDefId: string, timing: string): BaseAbilityExecutor | undefined {
    return extendedRegistry.get(baseDefId)?.get(timing)?.executor;
}

export function getRegisteredExtendedBaseAbilityTimings(baseDefId: string): Set<string> {
    return new Set(extendedRegistry.get(baseDefId)?.keys() ?? []);
}

/**
 * 为基地能力注册表补充 POD 别名。
 *
 * 说明：
 * 1) 不覆盖已显式注册的 POD 能力（支持未来逐张覆写）。
 * 2) 普通基地能力需要同步注册 reaction queue executor，确保触发队列可执行。
 * 3) 扩展时机（extendedRegistry）只做映射，不在此处注册 queue executor（按现有收集路径动态注册）。
 */
export function registerPodBaseAbilityAliases(): void {
    const baseEntries = Array.from(baseAbilityRegistry.entries());
    for (const [baseDefId, timingMap] of baseEntries) {
        if (isPodDefId(baseDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('baseAbility', baseDefId)) continue;
        const podDefId = toPodDefId(baseDefId);
        const podTimingMap = baseAbilityRegistry.get(podDefId) ?? new Map<BaseTriggerTiming, BaseAbilityEntry>();
        if (!baseAbilityRegistry.has(podDefId)) {
            baseAbilityRegistry.set(podDefId, podTimingMap);
        }

        for (const [timing, entry] of timingMap.entries()) {
            if (podTimingMap.has(timing)) continue;
            podTimingMap.set(timing, entry);
            registerBaseAbilityAsQueuedTrigger(podDefId, timing);
        }
    }

    const extendedEntries = Array.from(extendedRegistry.entries());
    for (const [baseDefId, timingMap] of extendedEntries) {
        if (isPodDefId(baseDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('baseAbility', baseDefId)) continue;
        const podDefId = toPodDefId(baseDefId);
        const podTimingMap = extendedRegistry.get(podDefId) ?? new Map<string, ExtendedBaseAbilityEntry>();

        for (const [timing, entry] of timingMap.entries()) {
            if (podTimingMap.has(timing)) continue;
            podTimingMap.set(timing, entry);
        }

        if (!extendedRegistry.has(podDefId)) {
            extendedRegistry.set(podDefId, podTimingMap);
        }
    }

    const activeEntries = Array.from(activeBaseAbilityRegistry.entries());
    for (const [baseDefId, entry] of activeEntries) {
        if (isPodDefId(baseDefId)) continue;
        if (!shouldGenerateSmashUpPodAlias('baseAbility', baseDefId)) continue;
        const podDefId = toPodDefId(baseDefId);
        if (!activeBaseAbilityRegistry.has(podDefId)) {
            activeBaseAbilityRegistry.set(podDefId, entry);
        }
    }
}

// ============================================================================
// 基地能力注册（所有可 Prompt 实现的基地）
// ============================================================================

/** 注册所有基地能力（幂等） */
/** 注册所有基地能力（幂等） */
export function registerBaseAbilities(): void {

    // === 基础包 (Base Set) ===

    // base_rhodes_plaza: 罗德百货商场
    // "在这个基地计分时，每位玩家在这里每有一个随从就获得1VP"
    registerBaseAbility('base_rhodes_plaza', 'whenScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const playerMinionCounts = new Map<PlayerId, number>();
        for (const m of base.minions) {
            playerMinionCounts.set(m.controller, (playerMinionCounts.get(m.controller) ?? 0) + 1);
        }
        const events: SmashUpEvent[] = [];
        for (const [pid, count] of playerMinionCounts) {
            if (count > 0) {
                events.push({
                    type: SU_EVENTS.VP_AWARDED,
                    payload: { playerId: pid, amount: count, reason: '罗德百货商场：每个随从1VP' },
                    timestamp: ctx.now } as VpAwardedEvent);
            }
        }
        return { events };
    }, {
    });

    // base_castle_blood: 血堡 (Castle Blood)
    // "打出随从到这后，如果对手在这里力量比你大，你可以在该随从上放 +1 指示物"
    registerBaseAbility('base_castle_blood', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.minionUid) return { events: [] };
        // Infiltrate：只影响你自己是否能用本基地能力
        const ignored = base.ongoingActions?.some(o =>
            ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === ctx.playerId && o.defId === 'ninja_infiltrate',
        ) ?? false;
        if (ignored) return { events: [] };
        // 计算当前玩家和最强对手的力量
        let myPower = 0;
        let maxOpponentPower = 0;
        for (const m of base.minions) {
            const power = getEffectivePower(ctx.state, m, ctx.baseIndex);
            if (m.controller === ctx.playerId) myPower += power;
            else {
                const opPower = base.minions
                    .filter(mm => mm.controller === m.controller)
                    .reduce((sum, mm) => sum + getEffectivePower(ctx.state, mm, ctx.baseIndex), 0);
                if (opPower > maxOpponentPower) maxOpponentPower = opPower;
            }
        }
        if (maxOpponentPower <= myPower) return { events: [] };
        // 可选效果：让玩家选择是否放指示物
        const minion = base.minions.find(m => m.uid === ctx.minionUid);
        if (!minion) return { events: [] };
        if (!ctx.matchState) {
            // 无交互上下文时保持兼容：默认执行放置
            return {
                events: [addPowerCounter(ctx.minionUid, ctx.baseIndex, 1, 'base_castle_blood', ctx.now)] };
        }
        const options: PromptOption<{ skip?: boolean; apply?: boolean; minionUid?: string; minionDefId?: string; baseIndex?: number }>[] = [
            {
                id: 'apply',
                label: '放置 +1 力量指示物',
                labelKey: 'ui.base_castle_blood_apply_counter_option',
                value: { apply: true, minionUid: ctx.minionUid, minionDefId: minion.defId, baseIndex: ctx.baseIndex },
                displayMode: 'button' as const },
            createSkipOption(),
        ];
        const interaction = createSimpleChoice(
            `base_castle_blood_${ctx.now}`,
            ctx.playerId,
            '血堡：是否在该随从上放置 +1 力量指示物？',
            options,
            { sourceId: 'base_castle_blood', targetType: 'minion', titleKey: 'ui.base_castle_blood_title' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
        mandatory: false });

    // base_central_brain: 中央大脑
    // "每个在这里的随从获得+1力量"
    // 持续性被动 buff，通过 power modifier 实现（非入场指示物）
    // 注册在 ongoing_modifiers.ts 的 registerBaseModifiers() 中

    // base_cave_of_shinies: 闪光洞穴
    // "每当这里的一个随从被消灭后，它的拥有者获得1VP"
    registerExtended('base_cave_of_shinies', 'onMinionDestroyed', (ctx) => {
        return {
            events: [{
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: ctx.playerId,
                    amount: 1,
                    reason: '闪光洞穴：随从被消灭获得1VP' },
                timestamp: ctx.now } as VpAwardedEvent] };
    }, {
    });

    // base_cave_of_shinies_pod: 闪光洞穴（POD）
    // "Once per turn, after a minion here you own is destroyed, gain 1 VP."
    registerExtended('base_cave_of_shinies_pod', 'onMinionDestroyed', (ctx) => {
        const alreadyTriggeredThisTurn = (ctx.state.turnDestroyedMinions ?? [])
            .some(record => record.baseIndex === ctx.baseIndex);
        if (alreadyTriggeredThisTurn) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: ctx.playerId,
                    amount: 1,
                    reason: '闪光洞穴（POD）：每回合一次，己方随从被消灭获得1VP' },
                timestamp: ctx.now } as VpAwardedEvent] };
    }, {
    });

    // base_the_factory: 436-1337工厂
    // "当这个基地计分时，冠军在这里每有5力量就获得1VP"
    registerBaseAbility('base_the_factory', 'whenScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const playerPowers = new Map<PlayerId, number>();
        for (const m of base.minions) {
            const prev = playerPowers.get(m.controller) ?? 0;
            playerPowers.set(m.controller, prev + getEffectivePower(ctx.state, m, ctx.baseIndex));
        }
        let maxPower = 0;
        let winnerId: PlayerId | undefined;
        for (const [pid, power] of playerPowers) {
            if (power > maxPower) { maxPower = power; winnerId = pid; }
        }
        if (!winnerId || maxPower === 0) return { events: [] };
        const bonusVp = Math.floor(maxPower / 5);
        if (bonusVp <= 0) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: winnerId,
                    amount: bonusVp,
                    reason: `工厂：每5力量1VP（${maxPower}力量=${bonusVp}VP）` },
                timestamp: ctx.now } as VpAwardedEvent] };
    }, {
    });

    // base_tar_pits: 焦油坑
    // "每当有一个随从在这里被消灭后，将它放到其拥有者的牌库底"
    //
    // 规则点：这不是“防止消灭”（replacement），而是“消灭已发生后，改变去向”。
    // 为避免把它当成 saveEvent 而抑制 after-destroy 反应，
    // 我们把去向替换做在 reducer 的 MINION_DESTROYED 归约阶段处理（见 reduce.ts）。

    // base_haunted_house: 伊万斯堡城镇公墓
    // "在这个基地计分后，冠军弃掉他的手牌并抽取5张牌"
    registerBaseAbility('base_haunted_house', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const winner = ctx.state.players[winnerId];
        if (!winner) return { events: [] };
        const events: SmashUpEvent[] = [];
        // 弃掉所有手牌
        if (winner.hand.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: winnerId,
                    cardUids: winner.hand.map(c => c.uid) },
                timestamp: ctx.now } as CardsDiscardedEvent);
        }
        // 抽5张牌：需基于“弃手牌后”的临时状态计算，确保牌库为空时可洗入刚弃的手牌
        const drawState = winner.hand.length > 0
            ? {
                ...ctx.state,
                players: {
                    ...ctx.state.players,
                    [winnerId]: {
                        ...winner,
                        hand: [],
                        discard: [...winner.discard, ...winner.hand] } } }
            : ctx.state;
        events.push(...buildStandardDrawEvents(drawState, winnerId, 5, ctx.random, ctx.now));
        return { events };
    }, {
    });

    // base_dragons_lair: 龙穴
    // "在这个基地计分后，冠军抽 3 张牌"
    registerBaseAbility('base_dragons_lair', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        if (!ctx.state.players[winnerId]) return { events: [] };
        return {
            events: buildStandardDrawEvents(ctx.state, winnerId, 3, ctx.random, ctx.now),
        };
    }, {
    });

    // base_temple_of_goju: 刚柔流寺庙
    // "在这个基地计分后，将每位玩家在这里力量最高的一张随从放入他们拥有者的牌库底"
    registerBaseAbility('base_temple_of_goju', 'afterScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        // 收集需要玩家选择的平局情况
        const tieBreakPlayers: { playerId: string; candidates: MinionOnBase[]; maxPower: number }[] = [];
        // 按玩家分组，找每位玩家力量最高的随从
        const playerMinions = new Map<PlayerId, MinionOnBase[]>();
        for (const m of base.minions) {
            const list = playerMinions.get(m.controller) ?? [];
            list.push(m);
            playerMinions.set(m.controller, list);
        }
        for (const [pid, minions] of playerMinions) {
            if (minions.length === 0) continue;
            // 找力量最高值
            let maxPower = -Infinity;
            for (const m of minions) {
                const power = getEffectivePower(ctx.state, m, ctx.baseIndex);
                if (power > maxPower) maxPower = power;
            }
            // 找所有最高力量随从
            const strongest = minions.filter(m => getEffectivePower(ctx.state, m, ctx.baseIndex) === maxPower);
            if (strongest.length === 1) {
                // 唯一最强，直接放牌库底
                events.push({
                    type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                    payload: {
                        cardUid: strongest[0].uid,
                        defId: strongest[0].defId,
                        ownerId: strongest[0].owner,
                        sourcePlayerId: strongest[0].controller,
                        reason: '刚柔流寺庙：最高力量随从放入牌库底' },
                    timestamp: ctx.now } as CardToDeckBottomEvent);
            } else {
                // 平局：需要拥有者选择
                tieBreakPlayers.push({ playerId: pid, candidates: strongest, maxPower });
            }
        }

        if (tieBreakPlayers.length > 0 && ctx.matchState) {
            // 创建第一个平局选择交互，剩余通过 continuationContext 链式传递
            const first = tieBreakPlayers[0];
            const remaining = tieBreakPlayers.slice(1);
            
            // 保存随从快照（包括第一个玩家和剩余玩家的所有候选随从）
            const firstCandidatesSnapshot = first.candidates.map(m => ({
                uid: m.uid,
                defId: m.defId,
                owner: m.owner,
                power: getEffectivePower(ctx.state, m, ctx.baseIndex) }));
            
            const options = firstCandidatesSnapshot.map(m => {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                return { 
                    uid: m.uid, 
                    defId: m.defId, 
                    baseIndex: ctx.baseIndex, 
                    label: `${name} (力量 ${first.maxPower})`,
                    displayMode: 'card' as const };
            });
            const interaction = createSimpleChoice(
                `base_temple_of_goju_tiebreak_${ctx.now}`, first.playerId,
                '刚柔流寺庙：选择放入牌库底的最高力量随从', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }),
                { sourceId: 'base_temple_of_goju_tiebreak', targetType: 'minion', titleKey: 'ui.base_temple_of_goju_tiebreak_title' },
            );
            const remainingData = remaining.map(tb => ({
                playerId: tb.playerId,
                // 保存每个玩家的候选随从快照
                candidateUids: tb.candidates.map(c => ({ 
                    uid: c.uid, 
                    defId: c.defId, 
                    owner: c.owner,
                    power: getEffectivePower(ctx.state, c, ctx.baseIndex) })),
                maxPower: tb.maxPower }));
            return { events, matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { 
                    ...interaction.data, 
                    continuationContext: { 
                        baseIndex: ctx.baseIndex, 
                        remainingPlayers: remainingData,
                        // 保存第一个玩家的候选随从快照
                        firstCandidatesSnapshot } } }) };
        }

        return { events };
    }, {
        mandatory: true });

    // base_temple_of_goju_pod: POD 版本为“随从被消灭后置牌库底”，
    // 由 reducer 在 MINION_DESTROYED 阶段处理；因此 afterScoring 无效果。
    registerBaseAbility('base_temple_of_goju_pod', 'afterScoring', () => ({ events: [] }), {
    });

    // base_great_library: 大图书馆
    // "在这个基地计分后，所有在这里有随从的玩家可以抽一张卡牌"
    registerBaseAbility('base_great_library', 'afterScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        // 找出在此基地有随从的玩家
        const playersWithMinions = new Set<PlayerId>();
        for (const m of base.minions) {
            playersWithMinions.add(m.controller);
        }
        for (const pid of playersWithMinions) {
            events.push(...buildStandardDrawEvents(ctx.state, pid, 1, ctx.random, ctx.now));
        }
        return { events };
    }, {
    });

    // === 扩展包 (Awesome Level 9000) ===

    // base_haunted_house_al9000: 鬼屋
    // "在一个玩家打出一个随从到这后，这个玩家必须弃掉一张卡牌"
    registerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || player.hand.length === 0) return { events: [] };
        // 只有1张手牌→自动弃掉
        if (player.hand.length === 1) {
            return {
                events: [{
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId: ctx.playerId, cardUids: [player.hand[0].uid] },
                    timestamp: ctx.now } as CardsDiscardedEvent] };
        }
        // 多张手牌→Prompt 选择弃哪张
        if (!ctx.matchState) return { events: [] };
        
        // 生成初始选项（基于当前状态）
        const initialOptions = player.hand.map((c, i) => {
            const def = getCardDef(c.defId);
            return { id: `card-${i}`, label: def?.name ?? c.defId, value: { cardUid: c.uid, defId: c.defId }, _source: 'hand' as const, displayMode: 'card' as const };
        });
        
        const pid = ctx.playerId;
        const interaction = createSimpleChoice(
            `base_haunted_house_al9000_${ctx.now}`,
            pid,
            '鬼屋：选择要弃掉的卡牌',
            initialOptions,
            {
                sourceId: 'base_haunted_house_al9000',
                targetType: 'hand',
                titleKey: 'ui.base_haunted_house_al9000_title',
                // 手牌在共享态与座位态之间可能发生刷新漂移，响应时必须按最新手牌重算。
                responseValidationMode: 'live',
            },
        );
        
        // 手牌弃牌类交互：使用 optionsGenerator 动态生成选项
        // 确保新抽到的牌也能被选择（如幽灵能力同时触发抓牌）
        interaction.data.optionsGenerator = state => {
            const core = state.core as SmashUpCore;
            const p = core.players?.[pid];
            if (!p || !p.hand || p.hand.length === 0) return [];
            return p.hand.map((c, i): PromptOption<HandCardChoiceValue> => {
                const def = getCardDef(c.defId);
                return { id: `card-${i}`, label: def?.name ?? c.defId, value: { cardUid: c.uid, defId: c.defId }, _source: 'hand' as const, displayMode: 'card' as const };
            });
        };
        
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
    });

    // base_the_field_of_honor: 荣誉之地
    // "当一个或多个随从在这里被消灭，那个将它们消灭的玩家获得1VP"
    registerExtended('base_the_field_of_honor', 'onMinionDestroyed', (ctx) => {
        const destroyerId = ctx.destroyerId;
        if (!destroyerId) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: destroyerId,
                    amount: 1,
                    reason: '荣誉之地：消灭随从获得1VP' },
                timestamp: ctx.now } as VpAwardedEvent] };
    }, {
    });

    // base_the_workshop: 工坊
    // "当一个玩家打出一个战术到这个基地时，该玩家可以额外打出一张战术"
    registerBaseAbility('base_the_workshop', 'onActionPlayed', (ctx) => {
        const actionTargetType = ctx.actionTargetType ?? (ctx.actionTargetMinionUid ? 'minion' : 'base');
        if (actionTargetType !== 'base') return { events: [] };
        return {
            events: [grantContextualExtraAction(ctx, '工坊：额外打出一张战斗牌')] };
    }, {
    });

    // base_crypt: 地窖 (Crypt)
    // "当一个或多个随从在这被消灭，消灭者可在自己在这的随从上放 +1 指示物"
    registerExtended('base_crypt', 'onMinionDestroyed', (ctx) => {
        // ✅ 只使用 destroyerId，不 fallback 到 playerId
        // playerId 在此上下文中是被消灭随从的拥有者，不是消灭者
        if (!ctx.destroyerId) return { events: [] };
        const destroyerId = ctx.destroyerId;

        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        // 消灭者在这里有随从才能放指示物
        const destroyerMinions = base.minions.filter(m => m.controller === destroyerId && m.uid !== ctx.minionUid);
        if (destroyerMinions.length === 0) return { events: [] };
        if (!ctx.matchState && destroyerMinions.length === 1) {
            // 无交互上下文时保持兼容：默认执行放置
            return {
                events: [addPowerCounter(destroyerMinions[0].uid, ctx.baseIndex, 1, 'base_crypt', ctx.now)] };
        }
        // 可选效果：单目标/多目标都允许跳过
        if (!ctx.matchState) return { events: [] };
        const minionOptions = destroyerMinions.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: def?.name ?? m.defId,
                value: { minionUid: m.uid, minionDefId: m.defId, baseIndex: ctx.baseIndex, defId: m.defId },
                _source: 'field' as const,
                displayMode: 'card' as const };
        });
        const options: PromptOption<{ skip?: boolean; minionUid?: string; minionDefId?: string; baseIndex?: number; defId?: string }>[] = [
            createSkipOption(),
            ...minionOptions,
        ];
        const interaction = createSimpleChoice(
            `base_crypt_${ctx.now}`, destroyerId,
            '地窖：选择一个你的随从放置 +1 指示物', options,
            { sourceId: 'base_crypt', targetType: 'minion', titleKey: 'ui.base_crypt_title' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
    });

    // === Monster Smash 基地能力 ===

    // base_laboratorium: 实验工坊 (Laboratorium)
    // "每回合第一个被打出到这里的随从，其控制者在上面放 +1 力量指示物"
    registerBaseAbility('base_laboratorium', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.minionUid) return { events: [] };
        // 每个玩家回合开始都会清空全体玩家的 minionsPlayedPerBase，
        // 因此这里统计的是“当前回合里，这个基地全场累计被打出随从的次数”。
        if (!isFirstMinionPlayedAtBaseThisTurn(ctx)) return { events: [] };
        const playedMinion = base.minions.find(m => m.uid === ctx.minionUid);
        const controllerId = playedMinion?.controller ?? ctx.playerId;
        const ignored = base.ongoingActions?.some(o =>
            ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === controllerId && o.defId === 'ninja_infiltrate',
        ) ?? false;
        if (ignored) return { events: [] };
        return {
            events: [addPowerCounter(ctx.minionUid, ctx.baseIndex, 1, 'base_laboratorium', ctx.now)] };
    }, {
        canTrigger: isFirstMinionPlayedAtBaseThisTurn });

    // base_golem_schloss: 魔像城堡 (Golem Schloß)
    // "基地计分后，冠军在其每个随从上放置 +1 力量指示物"
    registerBaseAbility('base_golem_schloss', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const ignoredByWinner = base.ongoingActions?.some(o =>
            ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === winnerId && o.defId === 'ninja_infiltrate',
        ) ?? false;
        if (ignoredByWinner) return { events: [] };
        const events: SmashUpEvent[] = [];
        for (let bi = 0; bi < ctx.state.bases.length; bi++) {
            const b = ctx.state.bases[bi];
            for (const m of b.minions) {
                if (m.controller !== winnerId) continue;
                events.push(addPowerCounter(m.uid, bi, 1, 'base_golem_schloss', ctx.now));
            }
        }
        return { events };
    }, {
    });

    // base_moot_site: 集会场 (Moot Site)
    // "每回合第一个打出到这的随从获得 +2 力量直到回合结束"
    registerBaseAbility('base_moot_site', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.minionUid) return { events: [] };
        // 这里需要识别“当前玩家回合内基地全局首次”，而不是当前玩家自己的首次。
        if (!isFirstMinionPlayedAtBaseThisTurn(ctx)) return { events: [] };
        const minion = base.minions.find(m => m.uid === ctx.minionUid);
        if (!minion) return { events: [] };
        const ignored = base.ongoingActions?.some(o =>
            ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === minion.controller && o.defId === 'ninja_infiltrate',
        ) ?? false;
        if (ignored) return { events: [] };
        return {
            events: [
                addTempPower(
                    ctx.minionUid,
                    ctx.baseIndex,
                    2,
                    '集会场：首个随从 +2 临时力量',
                    ctx.now,
                ) as SmashUpEvent,
            ],
        };
    }, {
        canTrigger: isFirstMinionPlayedAtBaseThisTurn });

    // base_standing_stones: 巨石阵 (Standing Stones)
    // "你的回合中，你在这的一个随从可以使用才能两次"
    // 实现位于 commands.ts (USE_TALENT 验证) 和 reduce.ts (TALENT_USED / TURN_STARTED)
    // 通过 SmashUpCore.standingStonesDoubleTalentMinionUid 追踪每回合双才能名额

    // base_egg_chamber: 卵室 (Egg Chamber)
    // "这里有 +1 力量指示物的随从不能被消灭"
    // 实现：通过 protection 系统注册消灭保护

    // base_the_hill: 蚁丘 (The Hill)
    // "每位玩家回合开始时，可以将一个自己的随从从任意基地移到这里"
    registerBaseAbility('base_the_hill', 'onTurnStart', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        const ignored = base?.ongoingActions?.some(o =>
            ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === ctx.playerId && o.defId === 'ninja_infiltrate',
        ) ?? false;
        if (ignored) return { events: [] };
        // 收集该玩家在其他基地的随从
        const candidates: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let bi = 0; bi < ctx.state.bases.length; bi++) {
            if (bi === ctx.baseIndex) continue;
            const base = ctx.state.bases[bi];
            if (!base) continue;
            for (const m of base.minions) {
                if (m.controller !== ctx.playerId) continue;
                const def = getCardDef(m.defId);
                const baseDef = getBaseDef(base.defId);
                candidates.push({
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex: bi,
                    label: `${def?.name ?? m.defId} @ ${baseDef?.name ?? base.defId}` });
            }
        }
        if (candidates.length === 0) return { events: [] };
        if (!ctx.matchState) return { events: [] };
        const options = [
            createSkipOption(),
            ...candidates.map((c, i) => ({
                id: `minion-${i}`,
                label: c.label,
                value: { minionUid: c.uid, minionDefId: c.defId, baseIndex: c.baseIndex, defId: c.defId },
                _source: 'field' as const,
                displayMode: 'card' as const })),
        ];
        const interaction = createSimpleChoice(
            `base_the_hill_${ctx.now}`, ctx.playerId,
            '蚁丘：选择一个你的随从移动到这里', options,
            { sourceId: 'base_the_hill', targetType: 'minion', titleKey: 'ui.base_the_hill_title' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { targetBaseIndex: ctx.baseIndex } } }) };
    }, {
    });

    // base_ritual_site: 仪式场所
    // "在这个基地计分后，在它上面的所有随从洗回他们的拥有者牌库，而不收回是进入弃牌堆"
    registerBaseAbility('base_ritual_site', 'afterScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        for (const m of base.minions) {
            events.push({
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: m.uid,
                    defId: m.defId,
                    ownerId: m.owner,
                    sourcePlayerId: m.controller,
                    reason: '仪式场所：随从洗回牌库',
                    sourceDefId: 'base_ritual_site',
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                },
                timestamp: ctx.now } as CardToDeckBottomEvent);
        }
        return { events };
    }, {
    });

    // === 克苏鲁扩展基地 ===

    // base_mountains_of_madness: 疯狂之山
    // "在一个随从被打出到这后，它的拥有者抽一张疯狂卡"
    registerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        const playedMinion = ctx.minionUid ? base?.minions.find(m => m.uid === ctx.minionUid) : undefined;
        const ownerId = playedMinion?.owner ?? ctx.playerId;
        const controllerId = playedMinion?.controller ?? ctx.playerId;
        // Infiltrate：只让“你自己”忽略基地能力（不影响其他玩家）
        const ignoredByController = base?.ongoingActions?.some(o =>
            ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === controllerId && o.defId === 'ninja_infiltrate',
        ) ?? false;
        if (ignoredByController) return { events: [] };
        const evt = drawMadnessCards(ownerId, 1, ctx.state, 'base_mountains_of_madness', ctx.now);
        return { events: evt ? [evt] : [] };
    }, {
    });

    // base_rlyeh: 拉莱耶
    // "你的回合开始时，你可以消灭这里的一个随从来获得1VP"
    registerBaseAbility('base_rlyeh', 'onTurnStart', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
        if (myMinions.length === 0) return { events: [] };
        // 只有1个己方随从→直接提供 skip + 该随从
        const minionOptions = myMinions.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: `${def?.name ?? m.defId} (力量${getEffectivePower(ctx.state, m, ctx.baseIndex)})`,
                value: { minionUid: m.uid, minionDefId: m.defId, baseIndex: ctx.baseIndex },
                _source: 'field' as const,
                displayMode: 'card' as const };
        });
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; baseIndex: number }>[] = [
            createSkipOption('不消灭', 'ui.base_rlyeh_skip_option'),
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_rlyeh_${ctx.now}`, ctx.playerId,
            '拉莱耶：消灭一个随从获得1VP', options,
            { sourceId: 'base_rlyeh', targetType: 'minion', titleKey: 'ui.base_rlyeh_title' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
    });

    // base_rlyeh: 仅当“本基地能力导致的消灭真正发生”时给予 1VP
    registerExtended('base_rlyeh', 'onMinionDestroyed', (ctx) => {
        if (ctx.reason !== 'base_rlyeh') return { events: [] };
        if (!ctx.destroyerId) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.VP_AWARDED,
                payload: { playerId: ctx.destroyerId, amount: 1, reason: '拉莱耶：消灭随从获得1VP' },
                timestamp: ctx.now } as VpAwardedEvent] };
    }, {
    });

    // === 基础版需要 Prompt 的基地 ===

    // base_the_homeworld: 母星
    // "每当有一个随从打出到这里后，它的拥有者可以额外打出一个力量为2或以下的随从"
    // 力量≤2 限制通过 LIMIT_MODIFIED 事件的 powerMax 字段全局生效
    registerBaseAbility('base_the_homeworld', 'onMinionPlayed', (ctx) => {
        return {
            events: [grantContextualExtraMinion(ctx, '母星：额外打出力量≤2的随从', undefined, { powerMax: 2 })] };
    }, {
    });

    // base_the_mothership: 母舰
    // "在这个基地计分后，冠军可以将这里一个力量≤3的随从放回手牌"
    // 注意：afterScoring 能力在 BASE_SCORED 事件处理前收集，此时随从仍在基地上。
    // 但交互解决时随从可能已进入弃牌堆（BASE_CLEARED），因此将随从信息存入 continuation data。
    registerBaseAbility('base_the_mothership', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const eligible = base.minions.filter(m =>
            m.controller === winnerId &&
            getEffectivePower(ctx.state, m, ctx.baseIndex) <= 3
        );
        if (eligible.length === 0) return { events: [] };
        
        // 将随从信息存入快照，供交互解决时使用
        const minionsSnapshot = eligible.map(m => ({
            uid: m.uid,
            defId: m.defId,
            power: getEffectivePower(ctx.state, m, ctx.baseIndex) }));
        
        const minionOptions = minionsSnapshot.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: `${def?.name ?? m.defId} (力量${m.power})`,
                value: { minionUid: m.uid, minionDefId: m.defId, baseIndex: ctx.baseIndex },
                _source: 'field' as const,
                displayMode: 'card' as const };
        });
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string }>[] = [
            createSkipOption('不收回', 'ui.base_the_mothership_skip_option'),
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_the_mothership_${ctx.now}`, winnerId,
            '母舰：选择收回的随从', options,
            { sourceId: 'base_the_mothership', targetType: 'minion', titleKey: 'ui.base_the_mothership_title' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { 
                    ...interaction.data, 
                    title: '母舰：选择收回的随从',
                    options: interaction.data.options.map((option) => (
                        option.id === 'skip' ? { ...option, label: '不收回' } : option
                    )),
                    continuationContext: { 
                        baseIndex: ctx.baseIndex,
                        minionsSnapshot, // 保存随从快照
                    } } }) };
    }, {
    });

    // base_ninja_dojo: 忍者道场
    // "在这个基地计分后，冠军可以消灭任意一个随从"（全局范围）
    registerBaseAbility('base_ninja_dojo', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0 || !ctx.matchState) return { events: [] };

        const championPower = ctx.rankings[0]?.power;
        const championIds = ctx.rankings
            .filter(ranking => ranking.power === championPower)
            .map(ranking => ranking.playerId);
        if (championIds.length === 0) return { events: [] };

        // 收集所有基地上的所有随从（全局范围）
        const allMinions: { uid: string; defId: string; baseIndex: number; owner: string; controller: string; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            const b = ctx.state.bases[i];
            const bDef = getBaseDef(b.defId);
            for (const m of b.minions) {
                const def = getCardDef(m.defId);
                allMinions.push({
                    uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, controller: m.controller,
                    label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})` });
            }
        }
        if (allMinions.length === 0) return { events: [] };

        const minionOptions = allMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, baseIndex: m.baseIndex, minionDefId: m.defId, ownerId: m.owner },
            _source: 'field' as const,
            displayMode: 'card' as const }));
        const options: PromptOption<{ skip: true } | { minionUid: string; baseIndex: number; minionDefId: string; ownerId: string }>[] = [
            createSkipOption('不消灭', 'ui.base_ninja_dojo_skip_option'),
            ...minionOptions,
        ];

        let nextMatchState = ctx.matchState;
        championIds.forEach((winnerId, index) => {
            const interaction = createSimpleChoice(
                `base_ninja_dojo_${ctx.now}_${index}`,
                winnerId,
                '忍者道场：选择消灭的随从',
                options,
                { sourceId: 'base_ninja_dojo', targetType: 'minion', titleKey: 'ui.base_ninja_dojo_title' },
            );
            nextMatchState = queueInteraction(nextMatchState, interaction);
        });

        return { events: [], matchState: nextMatchState };
    }, {
        // 整条计分后链必须执行；每位冠军自己的“可不消灭”由 skip 选项承接，
        // 不能先把整条 tied-champion 链暴露成当前响应者可整体跳过的 optional trigger。
        mandatory: true });

    // base_ninja_dojo_pod: POD 勘误为无基地能力。
    registerBaseAbility('base_ninja_dojo_pod', 'afterScoring', () => ({ events: [] }), {
    });

    // === 基础版需要 Prompt 的基地（续） ===

    // base_pirate_cove: 海盗湾
    // "在这个基地计分后，除了冠军的所有玩家可以从这里移动一个随从到其他基地而不收回是进入弃牌堆"
    // 注意：afterScoring 能力在 BASE_SCORED 事件处理前收集，此时随从仍在基地上。
    // 但交互解决时随从可能已进入弃牌堆（BASE_CLEARED），因此将随从信息存入 continuation data。
    registerBaseAbility('base_pirate_cove', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        
        // 【防重复触发】检查是否已经为这个基地创建过交互
        // 使用 matchState.sys 上的临时标记，避免重复创建相同的交互
        const sysState = ctx.matchState?.sys as PirateCoveSysState | undefined;
        if (!sysState) {
            // 无 matchState 时无法创建交互，直接返回
            return { events };
        }
        if (!sysState._pirateCoveTriggered) {
            sysState._pirateCoveTriggered = new Set<number>();
        }
        const triggeredBases = sysState._pirateCoveTriggered;
        
        if (triggeredBases.has(ctx.baseIndex)) {
            return { events, matchState: ctx.matchState };
        }
        
        // 标记此基地已触发
        triggeredBases.add(ctx.baseIndex);
        
        // 遍历非冠军玩家，为每位在此有随从的玩家生成 Prompt
        const playerMinions = new Map<string, MinionOnBase[]>();
        for (const m of base.minions) {
            if (m.controller === winnerId) continue;
            const list = playerMinions.get(m.controller) ?? [];
            list.push(m);
            playerMinions.set(m.controller, list);
        }

        for (const [pid, minions] of playerMinions) {
            // 将随从信息存入 continuationContext，供交互解决时使用
            const minionsSnapshot = minions.map(m => ({
                uid: m.uid,
                defId: m.defId,
                owner: m.owner,
                power: getEffectivePower(ctx.state, m, ctx.baseIndex) }));
            
            const minionOptions = minionsSnapshot.map((m, i) => {
                const def = getCardDef(m.defId);
                return {
                    id: `minion-${i}`,
                    label: `${def?.name ?? m.defId} (力量${m.power})`,
                    value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner },
                    _source: 'field' as const,
                    displayMode: 'card' as const };
            });
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; owner: string }>[] = [
                createSkipOption(),
                ...minionOptions,
            ];
            if (ctx.matchState) {
                const interactionId = `base_pirate_cove_${pid}_${ctx.baseIndex}_${ctx.now}`;
                const interaction = createSimpleChoice(
                    interactionId, pid,
                    '海盗湾：选择移动一个随从到其他基地', options,
                    { sourceId: 'base_pirate_cove', targetType: 'minion', titleKey: 'ui.base_pirate_cove_title' },
                );
                
                // 【修复】使用 optionsGenerator 动态生成选项，确保交互解决时使用最新状态
                // 问题：海盗湾的 afterScoring 能力和大副的 afterScoring 能力都创建了交互
                // 如果大副的交互先解决，大副被移动到其他基地，海盗湾的交互选项中仍包含大副
                // 解决方案：使用 optionsGenerator 动态生成选项，过滤掉已经不在原基地上的随从
                interaction.data.optionsGenerator = state => {
                    const currentBase = (state.core as SmashUpCore).bases?.[ctx.baseIndex];
                    if (!currentBase) return [createSkipOption()];
                    
                    // 过滤出仍在原基地上的随从
                    const stillOnBase = minionsSnapshot.filter(m => 
                        currentBase.minions.some(minion => minion.uid === m.uid)
                    );
                    
                    if (stillOnBase.length === 0) {
                        // 所有随从都已被移动，只返回"跳过"选项
                        return [createSkipOption()];
                    }
                    
                    const refreshedOptions = stillOnBase.map((m, i) => {
                        const def = getCardDef(m.defId);
                        return {
                            id: `minion-${i}`,
                            label: `${def?.name ?? m.defId} (力量${m.power})`,
                            value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner },
                            _source: 'field' as const,
                            displayMode: 'card' as const };
                    });
                    
                    return [
                        createSkipOption(),
                        ...refreshedOptions,
                    ];
                };
                
                ctx.matchState = queueInteraction(ctx.matchState, {
                    ...interaction,
                    data: { 
                        ...interaction.data, 
                        continuationContext: { 
                            baseIndex: ctx.baseIndex,
                            minionsSnapshot, // 保存随从快照
                        } } });
            }
        }
        return { events, matchState: ctx.matchState };
    }, {
    });

    // base_tortuga: 托尔图加
    // 勘误版："在这个基地计分并被替换后，亚军可以移动他在其他基地上的一个随从到替换基地。"
    // 注意：被移动的随从不能来自托尔图加本身（官方澄清）
    // continuation 运行时基地已被替换，替换基地在同一 baseIndex 位置
    registerBaseAbility('base_tortuga', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length < 2) {
            return { events: [] };
        }
        const runnerUpId = ctx.rankings[1].playerId;
        // 收集亚军在其他基地上的随从（不包括托尔图加本身）
        const otherMinions: { uid: string; defId: string; owner: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === ctx.baseIndex) continue; // 排除托尔图加本身
            const base = ctx.state.bases[i];
            const baseDef = getBaseDef(base.defId);
            for (const m of base.minions) {
                if (m.controller !== runnerUpId) continue;
                const def = getCardDef(m.defId);
                otherMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    owner: m.owner,
                    baseIndex: i,
                    label: `${def?.name ?? m.defId} (${baseDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})` });
            }
        }
        if (otherMinions.length === 0) {
            return { events: [] };
        }
        const minionOptions = otherMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner, fromBaseIndex: m.baseIndex },
            _source: 'field' as const,
            displayMode: 'card' as const }));
        const options = [
            createSkipOption(),
            ...minionOptions,
        ] as PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; owner: string; fromBaseIndex: number }>[];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_tortuga_${ctx.now}`, runnerUpId,
            '托尔图加：选择移动一个其他基地上的随从到替换基地', options,
            { sourceId: 'base_tortuga', targetType: 'minion', titleKey: 'ui.base_tortuga_title' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } } }) };
    }, {
    });

    // base_wizard_academy: 巫师学院
    // "在这个基地计分后，冠军查看基地牌库顶的3张牌。选择一张替换这个基地，然后以任意顺序将其余的放回"
    registerBaseAbility('base_wizard_academy', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const baseDeck = ctx.state.baseDeck;
        if (!baseDeck || baseDeck.length === 0) return { events: [] };
        const topCount = Math.min(3, baseDeck.length);
        const topCards = baseDeck.slice(0, topCount);
        if (!ctx.matchState) return { events: [] };
        return {
            events: [],
            matchState: queueInteraction(
                ctx.matchState,
                buildWizardAcademyPrompt(
                    ctx.state,
                    winnerId,
                    ctx.now,
                    '巫师学院：选择一个基地来替换这里',
                    'ui.base_wizard_academy_replace_title',
                    topCards,
                    {
                        baseIndex: ctx.baseIndex,
                        topCards,
                        step: 'chooseReplacement',
                    },
                ),
            ),
        };
    }, {
    });

    // base_mushroom_kingdom: 蘑菇王国
    // "在每位玩家回合开始时，该玩家可以从任意基地移动一个其他玩家的随从到这里"
    registerBaseAbility('base_mushroom_kingdom', 'onTurnStart', (ctx) => {
        const mushroomBaseIndex = ctx.baseIndex;
        // 收集所有基地上的对手随从
        const opponentMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === mushroomBaseIndex) continue; // 不收回从蘑菇王国自身移动
            const base = ctx.state.bases[i];
            const bDef = getBaseDef(base.defId);
            for (const m of base.minions) {
                if (m.controller === ctx.playerId) continue; // 排除自己的随从
                const def = getCardDef(m.defId);
                opponentMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex: i,
                    label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${(m.basePower ?? 0) + (m.powerCounters ?? 0) + (m.powerModifier ?? 0) + (m.tempPowerModifier ?? 0)})` });
            }
        }
        if (opponentMinions.length === 0) return { events: [] };
        const minionOptions = opponentMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
            _source: 'field' as const,
            displayMode: 'card' as const }));
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; fromBaseIndex: number }>[] = [
            createSkipOption(),
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_mushroom_kingdom_${ctx.now}`, ctx.playerId,
            '蘑菇王国：选择一个对手随从移动到蘑菇王国', options,
            { sourceId: 'base_mushroom_kingdom', targetType: 'minion', titleKey: 'ui.base_mushroom_kingdom_title' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { mushroomBaseIndex } } }) };
    }, {
    });

    // base_mushroom_kingdom_pod: 蘑菇王国（POD）
    // "At the start of your turn, if you have more cards in your hand than any other player,
    //  you may move a minion to or from this base."
    registerBaseAbility('base_mushroom_kingdom_pod', 'onTurnStart', (ctx) => {
        const mushroomBaseIndex = ctx.baseIndex;
        const me = ctx.state.players[ctx.playerId];
        if (!me) return { events: [] };
        const myHandCount = me.hand.length;
        const hasStrictlyMoreThanAnyOther = Object.entries(ctx.state.players)
            .filter(([pid]) => pid !== ctx.playerId)
            .every(([, player]) => myHandCount > player.hand.length);
        if (!hasStrictlyMoreThanAnyOther) return { events: [] };

        const allMinions: { uid: string; defId: string; fromBaseIndex: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            const base = ctx.state.bases[i];
            const bDef = getBaseDef(base.defId);
            for (const m of base.minions) {
                const def = getCardDef(m.defId);
                allMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    fromBaseIndex: i,
                    label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})` });
            }
        }
        if (allMinions.length === 0) return { events: [] };

        const minionOptions = allMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.fromBaseIndex },
            _source: 'field' as const,
            displayMode: 'card' as const }));
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; fromBaseIndex: number }>[] = [
            createSkipOption(),
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_mushroom_kingdom_pod_${ctx.now}`, ctx.playerId,
            '蘑菇王国（POD）：选择一个随从，移动到或移出该基地', options,
            { sourceId: 'base_mushroom_kingdom_pod', targetType: 'minion', titleKey: 'ui.base_mushroom_kingdom_pod_title' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { mushroomBaseIndex } } }) };
    }, {
    });

    // === Excellent Movies, Dudes! / Teens 基地 ===

    // 楼顶：回合开始时，若你在此恰好有 1 个佣兵，可使本基地临界点降低该佣兵战力直到回合结束；计分时该条件玩家各得 1VP。
    registerBaseAbility('base_building_rooftop', 'onTurnStart', (ctx) => {
        const ownMinions = getPlayerMinionsAtBase(ctx.state, ctx.baseIndex, ctx.playerId);
        if (ownMinions.length !== 1 || !ctx.matchState) return { events: [] };
        const minion = ownMinions[0];
        const power = getEffectivePower(ctx.state, minion, ctx.baseIndex);
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; baseIndex: number }>[] = [
            {
                id: 'apply',
                label: '降低临界点 ' + power,
                value: { minionUid: minion.uid, minionDefId: minion.defId, baseIndex: ctx.baseIndex },
                displayMode: 'button' as const,
            },
            createSkipOption(),
        ];
        const interaction = createSimpleChoice(
            'base_building_rooftop_' + ctx.playerId + '_' + ctx.now,
            ctx.playerId,
            '楼顶：是否按唯一己方佣兵的战力降低本基地临界点？',
            options,
            { sourceId: 'base_building_rooftop', targetType: 'minion', titleKey: 'ui.base_building_rooftop_title' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
        mandatory: false,
        canTrigger: (ctx) => getPlayerMinionsAtBase(ctx.state, ctx.baseIndex, ctx.playerId).length === 1,
    });

    registerBaseAbility('base_building_rooftop', 'whenScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const minionCounts = new Map<PlayerId, number>();
        for (const minion of base.minions) {
            minionCounts.set(minion.controller, (minionCounts.get(minion.controller) ?? 0) + 1);
        }
        const events: SmashUpEvent[] = [];
        for (const [playerId, count] of minionCounts.entries()) {
            if (count === 1) {
                events.push({
                    type: SU_EVENTS.VP_AWARDED,
                    payload: { playerId, amount: 1, reason: '楼顶：计分时恰好 1 个佣兵' },
                    timestamp: ctx.now,
                } as VpAwardedEvent);
            }
        }
        return { events };
    });

    // 丛林营地：计分后，冠军可以将其在此处的 1 个佣兵返回手牌。
    registerBaseAbility('base_jungle_camp', 'afterScoring', (ctx) => {
        const winnerId = ctx.rankings?.[0]?.playerId;
        if (!winnerId || !ctx.matchState) return { events: [] };
        const candidates = getPlayerMinionsAtBase(ctx.state, ctx.baseIndex, winnerId);
        if (candidates.length === 0) return { events: [] };
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; fromBaseIndex: number }>[] = [
            createSkipOption(),
            ...candidates.map((minion, index) => ({
                id: 'minion-' + index,
                label: getPromptCardName(minion.defId),
                value: { minionUid: minion.uid, minionDefId: minion.defId, fromBaseIndex: ctx.baseIndex },
                _source: 'field' as const,
                displayMode: 'card' as const,
            })),
        ];
        const interaction = createSimpleChoice(
            'base_jungle_camp_' + winnerId + '_' + ctx.now,
            winnerId,
            '丛林营地：选择是否将冠军的 1 个佣兵返回手牌',
            options,
            { sourceId: 'base_jungle_camp', targetType: 'minion', titleKey: 'ui.base_jungle_camp_title' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
        mandatory: false,
        ownerPlayerId: (ctx) => ctx.rankings?.[0]?.playerId,
        canTrigger: (ctx) => {
            const winnerId = ctx.rankings?.[0]?.playerId;
            return !!winnerId && getPlayerMinionsAtBase(ctx.state, ctx.baseIndex, winnerId).length > 0;
        },
    });

    // 另类现在：每回合你第一次在此处打出佣兵后，可以将 1 张手牌置入停滞并放 2 个标记。
    registerBaseAbility('base_alternate_present', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || !ctx.matchState) return { events: [] };
        if ((player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) !== 1) return { events: [] };
        if (player.hand.length === 0) return { events: [] };
        const options: PromptOption<{ skip: true } | ExcellentMoviesTeensStoreValue>[] = [
            createSkipOption(),
            ...player.hand.map((card, index) => ({
                id: 'card-' + index,
                label: getPromptCardName(card.defId),
                value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            })),
        ];
        const interaction = createSimpleChoice(
            'base_alternate_present_' + ctx.playerId + '_' + ctx.now,
            ctx.playerId,
            '另类现在：选择 1 张手牌置入停滞并放置 2 个停滞标记',
            options,
            { sourceId: 'base_alternate_present', targetType: 'hand', titleKey: 'ui.base_alternate_present_title' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
        mandatory: false,
        canTrigger: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return !!player && (player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1 && player.hand.length > 0;
        },
    });

    // 时间旅行汽车：计分后，冠军可以将其此处 1 个佣兵或行动置入停滞并放 2 个标记。
    registerBaseAbility('base_time_traveling_car', 'afterScoring', (ctx) => {
        const winnerId = ctx.rankings?.[0]?.playerId;
        const base = ctx.state.bases[ctx.baseIndex];
        if (!winnerId || !base || !ctx.matchState) return { events: [] };
        const candidates: ExcellentMoviesTeensStoreValue[] = [
            ...base.minions
                .filter(minion => minion.controller === winnerId)
                .map(minion => ({
                    cardUid: minion.uid,
                    minionUid: minion.uid,
                    defId: minion.defId,
                    ownerId: minion.owner,
                    sourceBaseIndex: ctx.baseIndex,
                    sourceCardKind: 'minion' as const,
                })),
            ...base.ongoingActions
                .filter(action => getRuntimeActionController(action) === winnerId)
                .map(action => ({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    sourceBaseIndex: ctx.baseIndex,
                    sourceCardKind: 'baseOngoingAction' as const,
                })),
            ...base.minions.flatMap(minion => minion.attachedActions
                .filter(action => getRuntimeActionController(action) === winnerId)
                .map(action => ({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    sourceBaseIndex: ctx.baseIndex,
                    sourceCardKind: 'attachedAction' as const,
                    targetMinionUid: minion.uid,
                }))),
        ];
        if (candidates.length === 0) return { events: [] };
        const options: PromptOption<{ skip: true } | ExcellentMoviesTeensStoreValue>[] = [
            createSkipOption(),
            ...candidates.map((candidate, index) => ({
                id: 'card-' + index,
                label: getPromptCardName(candidate.defId ?? ''),
                value: candidate,
                _source: 'field' as const,
                displayMode: 'card' as const,
            })),
        ];
        const interaction = createSimpleChoice(
            'base_time_traveling_car_' + winnerId + '_' + ctx.now,
            winnerId,
            '时间旅行汽车：选择 1 个冠军的佣兵或行动置入停滞',
            options,
            { sourceId: 'base_time_traveling_car', targetType: 'board', titleKey: 'ui.base_time_traveling_car_title' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
        mandatory: false,
        ownerPlayerId: (ctx) => ctx.rankings?.[0]?.playerId,
        canTrigger: (ctx) => {
            const winnerId = ctx.rankings?.[0]?.playerId;
            const base = ctx.state.bases[ctx.baseIndex];
            if (!winnerId || !base) return false;
            return base.minions.some(minion => minion.controller === winnerId)
                || base.ongoingActions.some(action => getRuntimeActionController(action) === winnerId)
                || base.minions.some(minion => minion.attachedActions.some(action => getRuntimeActionController(action) === winnerId));
        },
    });

    // 育巢：计分前，从当前玩家左手边开始，每位在此有佣兵的玩家可以从牌库顶额外打出 1 个佣兵到此处。
    registerBaseAbility('base_brood_hive', 'beforeScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.matchState) return { events: [] };
        let matchState = ctx.matchState;
        for (const playerId of getPlayerIdsFromCurrentPlayersLeft(ctx.state)) {
            const player = ctx.state.players[playerId];
            const topCard = player?.deck[0];
            if (!player || !topCard || getCardDef(topCard.defId)?.type !== 'minion') continue;
            if (!base.minions.some(minion => minion.controller === playerId)) continue;
            const options: PromptOption<{ skip: true } | { cardUid: string; defId: string; baseIndex: number }>[] = [
                createSkipOption(),
                {
                    id: 'play-top-minion',
                    label: '额外打出 ' + getPromptCardName(topCard.defId) + ' 到' + getPromptBaseName(ctx.state, ctx.baseIndex),
                    value: { cardUid: topCard.uid, defId: topCard.defId, baseIndex: ctx.baseIndex },
                    _source: 'deck' as const,
                    displayMode: 'card' as const,
                },
            ];
            const interaction = createSimpleChoice(
                'base_brood_hive_' + playerId + '_' + ctx.now,
                playerId,
                '育巢：是否从牌库顶额外打出 1 个佣兵到这里？',
                options,
                { sourceId: 'base_brood_hive', targetType: 'generic', titleKey: 'ui.base_brood_hive_title' },
            );
            matchState = queueInteraction(matchState, interaction);
        }
        return matchState === ctx.matchState ? { events: [] } : { events: [], matchState };
    }, {
        canTrigger: (ctx) => {
            const base = ctx.state.bases[ctx.baseIndex];
            return !!base && getPlayerIdsFromCurrentPlayersLeft(ctx.state).some(playerId => {
                const topCard = ctx.state.players[playerId]?.deck[0];
                return !!topCard
                    && getCardDef(topCard.defId)?.type === 'minion'
                    && base.minions.some(minion => minion.controller === playerId);
            });
        },
    });

    // 怨灵捕手总部：冠军在其下个回合可打出 1 张额外行动或 1 个额外佣兵。
    registerBaseAbility('base_wraithrustlers_hq', 'afterScoring', (ctx) => {
        const winnerId = ctx.rankings?.[0]?.playerId;
        return winnerId ? { events: [buildWraithrustlersHqPendingEvent(winnerId, true, ctx.now)] } : { events: [] };
    }, {
        ownerPlayerId: (ctx) => ctx.rankings?.[0]?.playerId,
        canTrigger: (ctx) => !!ctx.rankings?.[0]?.playerId,
    });

    registerBaseAbility('base_wraithrustlers_hq', 'onTurnStart', (ctx) => {
        if (!ctx.state.wraithrustlersHqPendingBonus?.[ctx.playerId] || !ctx.matchState) return { events: [] };
        const options: PromptOption<{ skip: true } | { choice: 'minion' | 'action' }>[] = [
            { id: 'minion', label: '额外佣兵', labelKey: 'ui.base_wraithrustlers_hq_extra_minion_option', value: { choice: 'minion' }, displayMode: 'button' as const },
            { id: 'action', label: '额外行动', labelKey: 'ui.base_wraithrustlers_hq_extra_action_option', value: { choice: 'action' }, displayMode: 'button' as const },
            createSkipOption(),
        ];
        const interaction = createSimpleChoice(
            'base_wraithrustlers_hq_' + ctx.playerId + '_' + ctx.now,
            ctx.playerId,
            '怨灵捕手总部：选择本回合的额外出牌额度',
            options,
            { sourceId: 'base_wraithrustlers_hq', targetType: 'button', titleKey: 'ui.base_wraithrustlers_hq_title' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
        mandatory: false,
        canTrigger: (ctx) => ctx.state.wraithrustlersHqPendingBonus?.[ctx.playerId] === true,
    });

    // === 限制类基地已通过 BaseCardDef.restrictions 数据驱动，isOperationRestricted 自动解析 ===

    // === 被动保护类已在 baseAbilities_expansion.ts 中通过 registerProtection 注册 ===

    registerPodBaseAbilityAliases();

    // === 扩展包基地能力（克苏鲁/AL9000/Pretty Pretty） ===
    registerExpansionBaseAbilities();
    registerPodBaseAbilityAliases();
}

// ============================================================================
// 基地交互解决处理函数
// ============================================================================

/** 注册基地能力的交互解决处理函数 */
export function registerBaseInteractionHandlers(): void {
    // 鬼屋：选择弃哪张卡
    registerInteractionHandler('base_haunted_house_al9000', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid, skip, __cancel__, __emergency_skip__ } = value as {
            cardUid?: string;
            skip?: boolean;
            __cancel__?: boolean;
            __emergency_skip__?: boolean;
        };
        if (skip || __cancel__ || __emergency_skip__ || !cardUid) {
            return { state, events: [] };
        }
        return { state, events: [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [cardUid] },
            timestamp } as CardsDiscardedEvent] };
    });

    // 拉莱耶：消灭随从+1VP
    registerInteractionHandler('base_rlyeh', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const base = state.core.bases[selected.baseIndex!];
        if (!base) return { state, events: [] };
        const target = base.minions.find(m => m.uid === selected.minionUid);
        if (!target) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: selected.baseIndex!,
                destroyerId: playerId,
                reason: 'base_rlyeh',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'base_rlyeh',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex!,
                sourceKind: 'nonAction',
            }) };
    });

    // 血堡：可选在刚打出的随从上放 +1 指示物
    registerInteractionHandler('base_castle_blood', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; apply?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip || !selected.apply) return { state, events: [] };
        if (!selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'base_castle_blood', timestamp)] };
    });

    // 母舰：收回随从到手牌
    registerInteractionHandler('base_the_mothership', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            minionUid?: string;
            minionDefId?: string;
            uid?: string;
            defId?: string;
        };
        const events: SmashUpEvent[] = [];
        if (!selected.skip) {
            const ctx = getContinuationContext<{
                baseIndex: number;
                minionsSnapshot?: Array<{ uid: string; defId: string; power: number }>;
            }>(iData);
            if (!ctx) return { state, events: [] };
            const minionUid = selected.minionUid ?? selected.uid;
            const minionDefId = selected.minionDefId ?? selected.defId;
            if (!minionUid || !minionDefId) return { state, events: [] };
            const returnEvents = buildValidatedReturnEvents(state, {
                minionUid,
                minionDefId,
                fromBaseIndex: ctx.baseIndex,
                toPlayerId: playerId,
                reason: '母舰：冠军收回随从',
                now: timestamp,
                sourcePlayerId: playerId });
            if (returnEvents.length > 0) {
                events.push(...returnEvents);
            } else {
                const existsElsewhere = state.core.bases.some(base =>
                    base.minions.some(minion => minion.uid === minionUid),
                ) || Object.values(state.core.players).some(player =>
                    player.hand.some(card => card.uid === minionUid)
                    || player.deck.some(card => card.uid === minionUid)
                    || player.discard.some(card => card.uid === minionUid),
                );
                const isInSnapshot = !ctx.minionsSnapshot
                    || ctx.minionsSnapshot.some(minion => minion.uid === minionUid && minion.defId === minionDefId);
                if (isInSnapshot && !existsElsewhere) {
                    events.push(...buildValidatedReturnEvents(state, {
                        minionUid,
                        minionDefId,
                        fromBaseIndex: ctx.baseIndex,
                        toPlayerId: playerId,
                        sourcePlayerId: playerId,
                        reason: '母舰：冠军收回随从',
                        now: timestamp,
                    }));
                }
            }
        }

        return { state, events };
    });

    // 忍者道场：消灭随从
    registerInteractionHandler('base_ninja_dojo', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number; minionDefId?: string; ownerId?: string };
        const events: SmashUpEvent[] = [];
        
        if (!selected.skip) {
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid!,
                minionDefId: selected.minionDefId!,
                fromBaseIndex: selected.baseIndex!,
                sourcePlayerId: playerId,
                sourceDefId: 'base_ninja_dojo',
                sourceControllerId: playerId,
                sourceKind: 'nonAction',
                reason: 'base_ninja_dojo',
                now: timestamp }));
        }
        
        return { state, events };
    });

    // 海盗湾：选择随从后，链式选择目标基地
    registerInteractionHandler('base_pirate_cove', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; owner?: string };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ baseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        
        // 收集可用的目标基地（排除原基地）
        const baseCandidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === ctx.baseIndex) continue;
            const bDef = getBaseDef(state.core.bases[i].defId);
            baseCandidates.push({ baseIndex: i, label: bDef?.name ?? `基地 ${i + 1}` });
        }
        
        // 只有一个目标基地→自动移动
        if (baseCandidates.length <= 1) {
            const targetBase = baseCandidates.length === 1 ? baseCandidates[0].baseIndex : 0;
            return {
                state,
                events: buildValidatedBaseMoveEvents(state, {
                    minionUid: selected.minionUid!,
                    minionDefId: selected.minionDefId!,
                    fromBaseIndex: ctx.baseIndex,
                    toBaseIndex: targetBase,
                    sourcePlayerId: playerId,
                    sourceDefId: 'base_pirate_cove',
                    sourceBaseIndex: ctx.baseIndex,
                    reason: '海盗湾：移动随从到其他基地',
                    now: timestamp }) };
        }
        
        // 多个目标基地→链式交互选择
        const options = buildBaseTargetOptions(baseCandidates, state.core);
        const interaction = createSimpleChoice(
            `base_pirate_cove_choose_base_${timestamp}`, playerId,
            '海盗湾：选择移动到的基地', options,
            { sourceId: 'base_pirate_cove_choose_base', targetType: 'base', titleKey: 'ui.base_pirate_cove_choose_base_title' },
        );
        return {
            // 使用 urgent 标志，确保链式交互的第二步不被其他交互插队
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    continuationContext: {
                        minionUid: selected.minionUid,
                        minionDefId: selected.minionDefId,
                        fromBaseIndex: ctx.baseIndex } } }, { urgent: true }), // 链式交互的后续步骤标记为 urgent
            events: [] };
    });

    // 海盗湾：第二步——选择目标基地后执行移动
    registerInteractionHandler('base_pirate_cove_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: targetBase, baseDefId } = value as { baseIndex: number; baseDefId?: string };
        const ctx = getContinuationContext<{ minionUid: string; minionDefId: string; fromBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };

        if (isScoringSessionAwaitingDeferredResolution(state)) {
            const resolvedTargetBase = resolveLiveBaseIndex(state.core, targetBase, baseDefId) ?? targetBase;
            const moveEvent: SmashUpEvent = buildReplayMoveEvent({
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBaseIndex,
                toBaseIndex: resolvedTargetBase,
                toBaseDefId: baseDefId,
                reason: '海盗湾：移动随从到其他基地',
                now: timestamp,
            });
            return { state, events: [moveEvent] };
        }

        return {
            state,
            events: buildValidatedBaseMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBaseIndex,
                toBaseIndex: targetBase,
                toBaseDefId: baseDefId,
                sourcePlayerId: _playerId,
                sourceDefId: 'base_pirate_cove',
                sourceBaseIndex: ctx.fromBaseIndex,
                reason: '海盗湾：移动随从到其他基地',
                now: timestamp }) };
    });

    // 托尔图加：将其他基地上的随从移动到替换基地
    registerInteractionHandler('base_tortuga', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; owner?: string; fromBaseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ baseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        const moveEvents = buildValidatedBaseMoveEvents(state, {
            minionUid: selected.minionUid!,
            minionDefId: selected.minionDefId!,
            fromBaseIndex: selected.fromBaseIndex ?? -1,
            toBaseIndex: ctx.baseIndex,
            sourcePlayerId: _playerId,
            sourceDefId: 'base_tortuga',
            sourceBaseIndex: ctx.baseIndex,
            reason: '托尔图加：亚军移动随从到替换基地',
            now: timestamp });
        if (moveEvents.length === 0) {
            return { state, events: [] };
        }
        if (isScoringSessionAwaitingDeferredResolution(state)) {
            const targetBaseDefId = getDeferredReplacementBaseDefId(state, iData);
            if (!targetBaseDefId) {
                return { state, events: [] };
            }
            const pendingAction: PendingPostScoringAction = {
                kind: 'moveMinionToReplacementBase',
                minionUid: selected.minionUid!,
                minionDefId: selected.minionDefId!,
                fromBaseIndex: selected.fromBaseIndex ?? -1,
                toBaseIndex: ctx.baseIndex,
                targetBaseDefId,
                reason: '托尔图加：亚军移动随从到替换基地',
                sourcePlayerId: _playerId,
                sourceDefId: 'base_tortuga',
                sourceControllerId: _playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'nonAction',
            };
            return {
                state: appendPendingPostScoringActions(state, [pendingAction]),
                events: [] };
        }
        return {
            state,
            events: moveEvents };
    });

    // 巫师学院：先选替换基地，再决定剩余基地回牌库顶的顺序
    registerInteractionHandler('base_wizard_academy', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { defId: string; index: number };
        const ctx = getContinuationContext<WizardAcademyContinuationContext>(iData);
        if (!ctx?.topCards || ctx.topCards.length === 0) return { state, events: [] };
        const currentTopCards = getCurrentBaseDeckTopSnapshotDefIds(state.core, ctx.topCards);
        if (currentTopCards.length === 0) return { state, events: [] };
        const chosenDefId = currentTopCards.find((defId) => defId === selected.defId);
        if (!chosenDefId) return { state, events: [] };

        if (ctx.step === 'orderRemaining') {
            if (!ctx.replacementBaseDefId) return { state, events: [] };
            const remaining = currentTopCards.filter((defId) => defId !== chosenDefId);
            const newOrder = [ctx.replacementBaseDefId, chosenDefId, ...remaining];
            return { state, events: [{
                type: SU_EVENTS.BASE_DECK_REORDERED,
                payload: {
                    topDefIds: newOrder,
                    reason: '巫师学院：冠军决定剩余基地顺序' },
                timestamp } as BaseDeckReorderedEvent] };
        }

        const remaining = currentTopCards.filter((defId) => defId !== chosenDefId);
        const updatedState = rewriteWizardAcademyDeferredReplacement(
            state,
            ctx.baseIndex,
            chosenDefId,
            timestamp,
        );

        if (remaining.length <= 1) {
            return { state: updatedState, events: [{
                type: SU_EVENTS.BASE_DECK_REORDERED,
                payload: {
                    topDefIds: [chosenDefId, ...remaining],
                    reason: '巫师学院：冠军选择替换基地并整理剩余基地' },
                timestamp } as BaseDeckReorderedEvent] };
        }

        const followup = buildWizardAcademyPrompt(
            updatedState.core,
            playerId,
            timestamp,
            '巫师学院：选择剩余基地放回牌库顶的顺序（先选的在最上面）',
            'ui.base_wizard_academy_order_title',
            remaining,
            {
                baseIndex: ctx.baseIndex,
                topCards: remaining,
                replacementBaseDefId: chosenDefId,
                step: 'orderRemaining',
            },
        );

        return {
            state: queueInteraction(updatedState, followup),
            events: [],
        };
    });

    // 蘑菇王国：移动对手随从到蘑菇王国
    registerInteractionHandler('base_mushroom_kingdom', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ mushroomBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return {
            state,
            events: buildValidatedBaseMoveEvents(state, {
                minionUid: selected.minionUid!,
                minionDefId: selected.minionDefId!,
                fromBaseIndex: selected.fromBaseIndex!,
                toBaseIndex: ctx.mushroomBaseIndex,
                sourcePlayerId: _playerId,
                sourceDefId: 'base_mushroom_kingdom',
                sourceBaseIndex: ctx.mushroomBaseIndex,
                // 规则：基地能力不属于任何玩家；reason 用稳定 id，供保护/归因系统判断
                reason: 'base_mushroom_kingdom',
                now: timestamp }) };
    });

    // 蘑菇王国（POD）：第一段选择本基地随从
    registerInteractionHandler('base_mushroom_kingdom_pod', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ mushroomBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };

        const selectedBaseIndex = selected.baseIndex ?? ctx.mushroomBaseIndex;
        // 选择了其他基地的对手随从：直接移入蘑菇王国
        if (selectedBaseIndex !== ctx.mushroomBaseIndex) {
            return {
                state,
                events: buildValidatedBaseMoveEvents(state, {
                    minionUid: selected.minionUid!,
                    minionDefId: selected.minionDefId!,
                    fromBaseIndex: selectedBaseIndex,
                    toBaseIndex: ctx.mushroomBaseIndex,
                    sourcePlayerId: playerId,
                    sourceDefId: 'base_mushroom_kingdom_pod',
                    sourceBaseIndex: ctx.mushroomBaseIndex,
                    reason: 'base_mushroom_kingdom_pod',
                    now: timestamp }) };
        }

        // 选择了本基地己方随从：进入二段选基地
        const baseCandidates = state.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? base.defId }))
            .filter(candidate => candidate.baseIndex !== ctx.mushroomBaseIndex);
        if (baseCandidates.length === 0) return { state, events: [] };
        const options = buildBaseTargetOptions(baseCandidates, state.core);
        const interaction = createSimpleChoice(
            `base_mushroom_kingdom_pod_choose_base_${timestamp}`, playerId,
            '蘑菇王国（POD）：选择一个基地以移动该随从', options,
            { sourceId: 'base_mushroom_kingdom_pod_choose_base', targetType: 'base', titleKey: 'ui.base_mushroom_kingdom_pod_choose_base_title' },
        );
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    continuationContext: {
                        minionUid: selected.minionUid,
                        minionDefId: selected.minionDefId,
                        fromBaseIndex: ctx.mushroomBaseIndex } } }),
            events: [] };
    });

    // 蘑菇王国（POD）：第二段选择目标基地后移动
    registerInteractionHandler('base_mushroom_kingdom_pod_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: targetBase } = value as { baseIndex: number };
        const ctx = getContinuationContext<{ minionUid: string; minionDefId: string; fromBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return {
            state,
            events: buildValidatedBaseMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBaseIndex,
                toBaseIndex: targetBase,
                sourcePlayerId: _playerId,
                sourceDefId: 'base_mushroom_kingdom_pod',
                sourceBaseIndex: ctx.fromBaseIndex,
                reason: 'base_mushroom_kingdom_pod',
                now: timestamp }) };
    });

    // 刚柔流寺庙：平局时拥有者选择放入牌库底的随从（链式处理多个玩家）
    registerInteractionHandler('base_mushroom_kingdom_pod', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        if (selected.skip) return { state, events: [] };
        if (!selected.minionUid || !selected.minionDefId || selected.fromBaseIndex === undefined) {
            return { state, events: [] };
        }
        const ctx = getContinuationContext<{ mushroomBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };

        if (selected.fromBaseIndex !== ctx.mushroomBaseIndex) {
            return {
                state,
                events: buildValidatedBaseMoveEvents(state, {
                    minionUid: selected.minionUid,
                    minionDefId: selected.minionDefId,
                    fromBaseIndex: selected.fromBaseIndex,
                    toBaseIndex: ctx.mushroomBaseIndex,
                    sourcePlayerId: playerId,
                    sourceDefId: 'base_mushroom_kingdom_pod',
                    sourceBaseIndex: ctx.mushroomBaseIndex,
                    reason: 'base_mushroom_kingdom_pod',
                    now: timestamp }) };
        }

        const baseCandidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === ctx.mushroomBaseIndex) continue;
            const bDef = getBaseDef(state.core.bases[i].defId);
            baseCandidates.push({ baseIndex: i, label: bDef?.name ?? `基地 ${i + 1}` });
        }
        if (baseCandidates.length === 0) return { state, events: [] };
        if (baseCandidates.length === 1) {
            return {
                state,
                events: buildValidatedBaseMoveEvents(state, {
                    minionUid: selected.minionUid,
                    minionDefId: selected.minionDefId,
                    fromBaseIndex: selected.fromBaseIndex,
                    toBaseIndex: baseCandidates[0].baseIndex,
                    sourcePlayerId: playerId,
                    sourceDefId: 'base_mushroom_kingdom_pod',
                    sourceBaseIndex: selected.fromBaseIndex,
                    reason: 'base_mushroom_kingdom_pod',
                    now: timestamp }) };
        }

        const interaction = createSimpleChoice(
            `base_mushroom_kingdom_pod_choose_base_${timestamp}`, playerId,
            '蘑菇王国（POD）：选择要移动到的基地',
            buildBaseTargetOptions(baseCandidates, state.core),
            { sourceId: 'base_mushroom_kingdom_pod_choose_base', targetType: 'base', titleKey: 'ui.base_mushroom_kingdom_pod_choose_destination_title' },
        );
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    continuationContext: {
                        minionUid: selected.minionUid,
                        minionDefId: selected.minionDefId,
                        fromBaseIndex: selected.fromBaseIndex } } }),
            events: [] };
    });

    registerInteractionHandler('base_mushroom_kingdom_pod_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBaseIndex } = value as { baseIndex: number };
        const ctx = getContinuationContext<{ minionUid: string; minionDefId: string; fromBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return {
            state,
            events: buildValidatedBaseMoveEvents(state, {
                minionUid: ctx.minionUid,
                minionDefId: ctx.minionDefId,
                fromBaseIndex: ctx.fromBaseIndex,
                toBaseIndex,
                sourcePlayerId: _playerId,
                sourceDefId: 'base_mushroom_kingdom_pod',
                sourceBaseIndex: ctx.fromBaseIndex,
                reason: 'base_mushroom_kingdom_pod',
                now: timestamp }) };
    });

    registerInteractionHandler('base_temple_of_goju_tiebreak', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number; defId: string };
        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };
        const events: SmashUpEvent[] = [{
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: {
                cardUid: target.uid,
                defId: target.defId,
                ownerId: target.owner,
                sourcePlayerId: target.controller,
                reason: '刚柔流寺庙：最高力量随从放入牌库底' },
            timestamp } as CardToDeckBottomEvent];

        // 检查是否有剩余玩家需要平局选择
        const ctx = iData?.continuationContext as { baseIndex: number; remainingPlayers?: { playerId: string; candidateUids: { uid: string; defId: string; owner: string }[]; maxPower: number }[] } | undefined;
        const remaining = ctx?.remainingPlayers ?? [];
        if (remaining.length > 0) {
            const next = remaining[0];
            const rest = remaining.slice(1);
            const options = next.candidateUids.map(c => {
                const def = getCardDef(c.defId) as MinionCardDef | undefined;
                const name = def?.name ?? c.defId;
                return { uid: c.uid, defId: c.defId, baseIndex: ctx!.baseIndex, label: `${name} (力量 ${next.maxPower})` };
            });
            const interaction = createSimpleChoice(
                `base_temple_of_goju_tiebreak_${timestamp}`, next.playerId,
                '刚柔流寺庙：选择放入牌库底的最高力量随从', buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: playerId }),
                { sourceId: 'base_temple_of_goju_tiebreak', targetType: 'minion', titleKey: 'ui.base_temple_of_goju_tiebreak_title' },
            );
            return { 
                // 使用 urgent 标志，确保链式交互的后续步骤不被其他交互插队
                state: queueInteraction(state, { 
                    ...interaction, 
                    data: { 
                        ...interaction.data, 
                        continuationContext: {
                            baseIndex: ctx!.baseIndex,
                            remainingPlayers: rest }
                    }
                }, { urgent: true }), // 链式交互的后续步骤标记为 urgent
                events };
        }

        return { state, events };
    });

    // 地窖：选择随从放 +1 指示物
    registerInteractionHandler('base_crypt', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        if (!selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return { state, events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'base_crypt', timestamp)] };
    });

    // 蚁丘（The Hill）：选择随从移动到这里
    registerInteractionHandler('base_the_hill', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        if (!selected.minionUid || !selected.minionDefId || selected.baseIndex === undefined) return { state, events: [] };
        const ctx = iData?.continuationContext as { targetBaseIndex: number } | undefined;
        if (!ctx) return { state, events: [] };
        return {
            state,
            events: buildValidatedBaseMoveEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId,
                fromBaseIndex: selected.baseIndex,
                toBaseIndex: ctx.targetBaseIndex,
                sourcePlayerId: _playerId,
                sourceDefId: 'base_the_hill',
                sourceBaseIndex: ctx.targetBaseIndex,
                reason: 'base_the_hill',
                now: timestamp }) };
    });

    registerInteractionHandler('base_building_rooftop', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; baseIndex?: number };
        if (selected.skip || !selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate =>
            candidate.uid === selected.minionUid && candidate.controller === playerId,
        );
        if (!minion) return { state, events: [] };
        const power = getEffectivePower(state.core, minion, selected.baseIndex);
        return { state, events: [modifyBreakpoint(selected.baseIndex, -power, 'base_building_rooftop', timestamp)] };
    });

    registerInteractionHandler('base_jungle_camp', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        if (selected.skip || !selected.minionUid || !selected.minionDefId || selected.fromBaseIndex === undefined) {
            return { state, events: [] };
        }
        const minion = state.core.bases[selected.fromBaseIndex]?.minions.find(candidate =>
            candidate.uid === selected.minionUid && candidate.controller === playerId,
        );
        if (!minion) return { state, events: [] };
        return {
            state,
            events: buildValidatedReturnEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId,
                fromBaseIndex: selected.fromBaseIndex,
                reason: 'base_jungle_camp',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'base_jungle_camp',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.fromBaseIndex,
            }),
        };
    });

    registerInteractionHandler('base_alternate_present', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as ExcellentMoviesTeensStoreValue;
        if (selected.skip || !selected.cardUid || !selected.defId || !selected.ownerId) return { state, events: [] };
        const card = state.core.players[playerId]?.hand.find(candidate => candidate.uid === selected.cardUid);
        if (!card) return { state, events: [] };
        return {
            state,
            events: [buildBacktimersStasisStoreFromHandEvent(
                playerId,
                card.uid,
                card.defId,
                card.owner,
                'base_alternate_present',
                timestamp,
            )],
        };
    });

    registerInteractionHandler('base_time_traveling_car', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as ExcellentMoviesTeensStoreValue;
        if (selected.skip
            || !selected.cardUid
            || !selected.defId
            || !selected.ownerId
            || selected.sourceBaseIndex === undefined
            || !selected.sourceCardKind) {
            return { state, events: [] };
        }
        const base = state.core.bases[selected.sourceBaseIndex];
        const stillInPlay = selected.sourceCardKind === 'minion'
            ? base?.minions.some(minion => minion.uid === selected.cardUid && minion.controller === playerId)
            : selected.sourceCardKind === 'baseOngoingAction'
                ? base?.ongoingActions.some(action => action.uid === selected.cardUid && getRuntimeActionController(action) === playerId)
                : base?.minions.some(minion =>
                    (!selected.targetMinionUid || minion.uid === selected.targetMinionUid)
                    && minion.attachedActions.some(action => action.uid === selected.cardUid && getRuntimeActionController(action) === playerId),
                );
        if (!stillInPlay) return { state, events: [] };
        return {
            state,
            events: [buildBacktimersStasisStoreFromPlayEvent(
                playerId,
                {
                    cardUid: selected.cardUid,
                    defId: selected.defId,
                    ownerId: selected.ownerId,
                    sourceBaseIndex: selected.sourceBaseIndex,
                    sourceCardKind: selected.sourceCardKind,
                },
                'base_time_traveling_car',
                timestamp,
                selected.targetMinionUid,
            )],
        };
    });

    registerInteractionHandler('base_brood_hive', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; baseIndex?: number };
        if (selected.skip || !selected.cardUid || !selected.defId || selected.baseIndex === undefined) return { state, events: [] };
        const topCard = state.core.players[playerId]?.deck[0];
        const base = state.core.bases[selected.baseIndex];
        if (!topCard || topCard.uid !== selected.cardUid || getCardDef(topCard.defId)?.type !== 'minion') return { state, events: [] };
        if (!base?.minions.some(minion => minion.controller === playerId)) return { state, events: [] };
        return {
            state,
            events: [grantExtraMinion(playerId, 'base_brood_hive', timestamp, selected.baseIndex, {
                playTiming: 'immediate',
                specificCardUid: selected.cardUid,
            })],
        };
    });

    registerInteractionHandler('base_wraithrustlers_hq', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; choice?: 'minion' | 'action' };
        if (!state.core.wraithrustlersHqPendingBonus?.[playerId]) return { state, events: [] };
        const events: SmashUpEvent[] = [buildWraithrustlersHqPendingEvent(playerId, false, timestamp)];
        if (selected.choice === 'minion') {
            events.push(grantExtraMinion(playerId, 'base_wraithrustlers_hq', timestamp, undefined, { playTiming: 'banked' }));
        } else if (selected.choice === 'action') {
            events.push(grantExtraAction(playerId, 'base_wraithrustlers_hq', timestamp, { playTiming: 'banked' }));
        }
        return { state, events };
    });

    // === 扩展包基地交互处理函数 ===
    registerExpansionBaseInteractionHandlers();
}
