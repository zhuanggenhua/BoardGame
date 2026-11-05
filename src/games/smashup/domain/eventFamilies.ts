import type { MinionOnBase } from './types';
import {
    getSmashUpSettlementContext,
    prepareSmashUpCandidates,
    isSmashUpEventSettled,
    getSmashUpSettlementPhase,
} from './eventSettlementContext';
import {
    type SmashUpEvent,
    type SmashUpCore,
    SU_EVENTS,
    type MinionDestroyedEvent,
    type MinionMovedEvent,
    type OngoingDetachedEvent,
    type MinionReturnedEvent,
    type CardTransferredEvent,
    type CardRecoveredFromDiscardEvent,
    type CardInstance,
    type BuriedCardReturnedToHandEvent,
    type RevealHandEvent,
    type RevealDeckTopEvent,
    type DeckInspectedEvent,
} from './types';
import type { PlayerId, MatchState, RandomFn } from '../../../engine/types';
import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent';
import { resolveSemanticMinionEventProtectionBlock, filterSemanticProtectedAffectEvents } from './effectSemantics';
import { matchesDefId } from './utils';
import {
    reduceOngoingDetachedEvent,
    reduceMinionMovedEvent,
    reduceMinionReturnedEvent,
    reduceCardTransferredEvent,
    reduceCardRecoveredFromDiscardEvent,
    reduceBuriedCardReturnedToHandEvent,
    reduceDeckInspectionFactEvent,
} from './reduce';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { type AffectRecord, buildAffectRecords } from './affect';
import { getMinionLikePower, getCardDef } from '../data/cards';
import { getEffectivePower } from './ongoingModifiers';
import { fireTriggers as fireRuleTriggers, collectTriggers as collectRuleTriggers } from './ongoingEffects';
import { collectExtendedBaseAbilityTriggers as collectRuleBaseTriggers } from './baseAbilityQueue';
import { doesDestroyedMinionEnterOwnerDiscard } from './destroyFacts';
import { resolveOnDestroy as resolveRuleOnDestroy, type AbilityContext } from './abilityRegistry';
import { applyTriggerQueueFactEvent } from './triggerQueueFacts';
import { maybeResolveReactionQueue as maybeResolveRuleQueue } from './reactionQueue';
import { getCardTransferObjectRef, buildCardInstanceFromObjectRef } from './objectProvenance';

// ============================================================================
export function filterProtectedMinionEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
    protectedEventType: typeof SU_EVENTS.MINION_DESTROYED | typeof SU_EVENTS.MINION_MOVED,
): SmashUpEvent[] {
    if (getSmashUpSettlementPhase() === 'facts') return events;

    const result: SmashUpEvent[] = [];
    let workingCore = core;
    let pendingSourceKey: string | undefined;
    let pendingEvents: SmashUpEvent[] = [];

    const flushPendingEvents = () => {
        for (const pendingEvent of pendingEvents) {
            workingCore = applyPostProcessPrefixEvent(workingCore, pendingEvent);
        }
        pendingEvents = [];
        pendingSourceKey = undefined;
    };

    const appendEvent = (event: SmashUpEvent, sourceKey: string | undefined) => {
        result.push(event);
        if (sourceKey) {
            pendingSourceKey = sourceKey;
            pendingEvents.push(event);
            return;
        }
        workingCore = applyPostProcessPrefixEvent(workingCore, event);
    };

    for (const e of events) {
        const sourceKey = buildAffectEventSourceKey(e, sourcePlayerId);
        if (pendingEvents.length > 0 && sourceKey !== pendingSourceKey) {
            flushPendingEvents();
        }

        if (e.type !== protectedEventType) {
            appendEvent(e, sourceKey);
            continue;
        }
        const resolution = resolveSemanticMinionEventProtectionBlock(
            workingCore,
            e as MinionDestroyedEvent | MinionMovedEvent,
            sourcePlayerId,
        );
        if (resolution.blocked) {
            for (const extraEvent of resolution.extraEvents) {
                appendEvent(extraEvent, sourceKey);
            }
            continue;
        }
        appendEvent(e, sourceKey);
    }
    flushPendingEvents();
    return result;
}

export function buildAffectEventSourceKey(event: SmashUpEvent, fallbackSourcePlayerId: PlayerId): string | undefined {
    const payload = (event as { payload?: Record<string, unknown> }).payload;
    if (!payload) return undefined;
    const sourceParts = [
        payload.sourcePlayerId ?? fallbackSourcePlayerId,
        payload.sourceCardUid,
        payload.sourceDefId,
        payload.sourceControllerId,
        payload.sourceBaseIndex,
        payload.reason,
    ];
    if (sourceParts.every((part) => part === undefined || part === null || part === '')) {
        return undefined;
    }
    return sourceParts.map((part) => String(part ?? '')).join('|');
}

// onDestroy 后处理前的遗留桥接：批量刷新事件流，但保护语义解析已下沉到 shared effect semantics
// ============================================================================

export function filterProtectedDestroyEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
): SmashUpEvent[] {
    return filterProtectedMinionEvents(events, core, sourcePlayerId, SU_EVENTS.MINION_DESTROYED);
}

/** 后处理结果：事件 + 可选的 matchState（触发器可能创建了交互） */
export interface PostProcessResult {
    events: SmashUpEvent[];
    matchState?: MatchState<SmashUpCore>;
}

export function findClydeDetachChoiceContext(
    core: SmashUpCore,
    event: OngoingDetachedEvent,
): { baseIndex: number; hostUid: string; clydeControllerId: PlayerId } | undefined {
    if (event.payload.clydeReturnToHand !== undefined) return undefined;
    const { cardUid } = event.payload;

    for (const [baseIndex, base] of core.bases.entries()) {
        const host = base.minions.find((minion) => minion.attachedActions.some((action) => action.uid === cardUid));
        if (!host) continue;
        if (base.defId === 'base_primate_park') return undefined;
        const clyde = base.minions.find(
            (minion) => minion.controller === host.controller && matchesDefId(minion.defId, 'cyborg_apes_clyde_2_0'),
        );
        if (!clyde) return undefined;
        return { baseIndex, hostUid: host.uid, clydeControllerId: clyde.controller };
    }

    return undefined;
}

export function processClydeDetachChoices(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    now: number,
): PostProcessResult {
    const prepared = prepareSmashUpCandidates(events, state);
    events = prepared.events;
    state = prepared.state;

    let matchState = state;
    const result: SmashUpEvent[] = [];

    for (const event of events) {
        if (isSmashUpEventSettled(event) || event.type !== SU_EVENTS.ONGOING_DETACHED) {
            result.push(event);
            const advancedCore = applyPostProcessPrefixEvent(matchState.core, event);
            if (advancedCore !== matchState.core) {
                matchState = { ...matchState, core: advancedCore };
            }
            continue;
        }

        const detached = event as OngoingDetachedEvent;
        const context = findClydeDetachChoiceContext(matchState.core, detached);
        if (!context) {
            result.push(event);
            const advancedCore = reduceOngoingDetachedEvent(matchState.core, detached);
            if (advancedCore !== matchState.core) {
                matchState = { ...matchState, core: advancedCore };
            }
            continue;
        }

        const interaction = createSimpleChoice(
            `cyborg_apes_clyde_2_0_detach_${detached.payload.cardUid}_${now}`,
            context.clydeControllerId,
            '克莱德2.0：是否将离场行动收入手牌？',
            [
                {
                    id: 'return-to-hand',
                    label: '收入手牌',
                    labelKey: 'ui.cyborg_apes_clyde_detach_return_option',
                    value: { returnToHand: true },
                    displayMode: 'button' as const,
                },
                {
                    id: 'discard',
                    label: '进入弃牌堆',
                    labelKey: 'ui.cyborg_apes_clyde_detach_discard_option',
                    value: { returnToHand: false },
                    displayMode: 'button' as const,
                },
            ],
            {
                sourceId: 'cyborg_apes_clyde_2_0_detach',
                targetType: 'generic',
                titleKey: 'ui.cyborg_apes_clyde_detach_title',
            },
        );
        interaction.data.detached = {
            ...detached.payload,
            baseIndex: context.baseIndex,
            hostUid: context.hostUid,
            clydeControllerId: context.clydeControllerId,
            timestamp: detached.timestamp,
        };
        matchState = queueInteraction(matchState, interaction);
    }

    return { events: result, matchState: matchState === state ? undefined : matchState };
}

export function filterProtectedAffectEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    fallbackSourcePlayerId: PlayerId,
): SmashUpEvent[] {
    if (getSmashUpSettlementPhase() === 'facts') return events;

    return filterSemanticProtectedAffectEvents(events, core, fallbackSourcePlayerId);
}

export function buildDestroyEventKey(event: MinionDestroyedEvent): string {
    const payload = event.payload;
    const timestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
    const destroyerId = payload.destroyerId ?? 'unknown';
    return `${payload.minionUid}@${payload.fromBaseIndex}@${destroyerId}@${timestamp}`;
}

export function buildAffectRecordEventKey(event: SmashUpEvent, record: AffectRecord, recordIndex: number): string {
    const timestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
    return [
        event.type,
        record.targetKind,
        record.targetUid,
        record.baseIndex ?? 'none',
        record.affectType,
        record.sourcePlayerId ?? 'unknown',
        record.sourceCardUid ?? 'none',
        record.sourceDefId ?? 'none',
        record.reason ?? 'none',
        recordIndex,
        timestamp,
    ].join('@');
}

export function buildAffectEventKeys(
    core: SmashUpCore,
    event: SmashUpEvent,
    fallbackSourcePlayerId?: PlayerId,
): string[] {
    return buildAffectRecords(core, event, fallbackSourcePlayerId)
        .map((record, recordIndex) => ({ record, recordIndex }))
        .filter(
            ({ record }) => record.countsForOnMinionAffected && record.triggerMinion && record.baseIndex !== undefined,
        )
        .map(({ record, recordIndex }) => buildAffectRecordEventKey(event, record, recordIndex));
}

export function processDestroyTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    options?: { skipDestroyEventKeys?: Set<string>; skipReactionQueueResolution?: boolean },
): PostProcessResult {
    const prepared = prepareSmashUpCandidates(events, state);
    events = prepared.events;
    state = prepared.state;

    const core = state.core;
    // 保护检查：过滤掉受保护的随从的消灭事件
    const filteredEvents = filterProtectedDestroyEvents(events, core, playerId);
    const skipDestroyEventKeys = options?.skipDestroyEventKeys;

    // ✅ 去重：同一个 minionUid 只处理一次（防止重复触发 onDestroy）
    const destroyEventsRaw = filteredEvents.filter(
        (e) => e.type === SU_EVENTS.MINION_DESTROYED && !isSmashUpEventSettled(e),
    ) as MinionDestroyedEvent[];
    const seenUids = new Set<string>();
    const destroyEvents = destroyEventsRaw.filter((e) => {
        const uid = e.payload.minionUid;
        if (seenUids.has(uid)) {
            // 跳过重复的消灭事件
            return false;
        }
        if (skipDestroyEventKeys?.has(buildDestroyEventKey(e))) {
            // 跳过已处理过的消灭事件（防止重复触发）
            seenUids.add(uid);
            return false;
        }
        seenUids.add(uid);
        return true;
    });
    if (destroyEvents.length === 0) return { events: filteredEvents };
    const destroyEventKeysToProcess = new Set(destroyEvents.map(buildDestroyEventKey));

    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;
    let prefixCursor = 0;
    // 待拯救随从：trigger 创建了交互（玩家选择是否拯救）但未产生 MINION_RETURNED，
    // 需要暂缓 MINION_DESTROYED，等交互解决后再决定消灭或拯救
    const pendingSaveMinionUids = new Set<string>();
    // FAQ batching: some base triggers apply once per destruction ability
    const baseDestroyBatchSeen = new Set<string>();

    const advanceStateBeforeDestroy = (destroyEvent: MinionDestroyedEvent) => {
        const targetIndex = filteredEvents.findIndex((event, index) => index >= prefixCursor && event === destroyEvent);
        if (targetIndex < 0) return;

        const prefixEvents = filteredEvents
            .slice(prefixCursor, targetIndex)
            .filter((event) => event.type !== SU_EVENTS.MINION_DESTROYED || isSmashUpEventSettled(event));
        if (prefixEvents.length > 0) {
            const stateBeforePrefix = ms ?? state;
            const advancedCore = prefixEvents.reduce(
                (acc, event) => applyPostProcessPrefixEvent(acc, event),
                stateBeforePrefix.core,
            );
            if (advancedCore !== stateBeforePrefix.core) {
                ms = {
                    ...stateBeforePrefix,
                    core: advancedCore,
                };
            }
        }
        prefixCursor = targetIndex + 1;
    };

    for (const de of destroyEvents) {
        advanceStateBeforeDestroy(de);
        const currentState = ms ?? state;
        const currentCore = currentState.core;
        const destroyEventKey = buildDestroyEventKey(de);
        if (!destroyEventKeysToProcess.has(destroyEventKey)) {
            continue;
        }
        destroyEventKeysToProcess.delete(destroyEventKey);
        const {
            minionUid,
            minionDefId,
            fromBaseIndex,
            ownerId: eventOwnerId,
            controllerId: eventControllerId,
            destroyerId: eventDestroyerId,
            reason,
        } = de.payload;
        const base = currentCore.bases[fromBaseIndex];
        const minion = base?.minions.find((m) => m.uid === minionUid);
        // The formal planner receives a pre-reduce core. Only live targets may
        // produce a new destruction fact; old direct consumers can still supply
        // an already-reduced core and the explicit event LKI.
        if (!minion && getSmashUpSettlementContext()?.commit) continue;
        const triggerMinion = minion ?? {
            uid: minionUid,
            defId: minionDefId,
            owner: eventOwnerId,
            controller: eventControllerId ?? eventOwnerId,
            basePower: getMinionLikePower(minionDefId) ?? 0,
            powerCounters: 0,
            powerModifier: 0,
            tempPowerModifier: 0,
            attachedActions: [],
            metadata: undefined,
        };
        const triggerMinionPower = minion
            ? getEffectivePower(currentCore, minion, fromBaseIndex)
            : triggerMinion.basePower;
        // ✅ 优先从 state 读取 owner（兜底修复：即使事件中的 ownerId 错了也能修复）
        const ownerId = minion?.owner ?? eventOwnerId;
        const triggerPlayerId = minion?.controller ?? triggerMinion.controller ?? ownerId;
        // "you destroyed" 类触发只能信任事件显式声明的 destroyerId。
        // 不能把当前回合玩家/目标控制者兜底成消灭者，否则会把中性或缺失归因的消灭误判为玩家造成。
        const destroyerId = eventDestroyerId;

        // === Phase 1: 先检查防止消灭触发器（ongoing replacement） ===
        // 在触发 onDestroy 之前，先确认消灭是否会被防止
        const currentMS_save = currentState;
        const interactionCountBefore =
            (currentMS_save.sys.interaction.current ? 1 : 0) + currentMS_save.sys.interaction.queue.length;

        const saveEvents: SmashUpEvent[] = [];

        // 2. 触发 ongoing 拦截器 onMinionDestroyed（replacement：如雄蜂防止消灭、逃生舱回手牌）
        const ongoingDestroyEvents = fireTriggers(
            currentCore,
            'onMinionDestroyed',
            {
                state: currentCore,
                matchState: ms ?? currentMS_save,
                playerId: triggerPlayerId,
                baseIndex: fromBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                triggerMinion,
                triggerMinionPower,
                controllerId: triggerPlayerId,
                destroyerId,
                reason: de.payload.reason,
                random,
                now,
            },
            { phase: 'replacement' },
        );
        saveEvents.push(...ongoingDestroyEvents.events);
        if (ongoingDestroyEvents.matchState) ms = ongoingDestroyEvents.matchState;

        // 检测"待拯救"模式：baseTrigger/ongoing 创建了新交互但未产生 MINION_RETURNED/MINION_MOVED
        // 典型场景：九命之屋创建玩家选择交互，暂缓消灭等待玩家决定
        // 海盗单基地时直接返回 MINION_MOVED 事件，也视为拯救
        const hasReturn = saveEvents.some((e) => e.type === SU_EVENTS.MINION_RETURNED);
        const hasMoveAway = saveEvents.some(
            (e) => e.type === SU_EVENTS.MINION_MOVED && (e as MinionMovedEvent).payload.minionUid === minionUid,
        );
        const hasDeckRedirect = saveEvents.some(
            (e) =>
                (e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) &&
                (e as any).payload?.cardUid === minionUid,
        );
        const hasSaveEvent = hasReturn || hasMoveAway || hasDeckRedirect;
        let isPendingSave = false;
        if (!hasSaveEvent && ms) {
            const interactionCountAfter = (ms.sys.interaction.current ? 1 : 0) + ms.sys.interaction.queue.length;
            if (interactionCountAfter > interactionCountBefore) {
                // 检查新交互是否为"防止消灭"类交互（白名单）
                // 排除：地窖等"给其他随从加指示物"的交互
                const PREVENT_DESTROY_SOURCE_IDS = [
                    'base_nine_lives_intercept', // 九命之屋
                    'giant_ant_drone_prevent_destroy', // 雄蜂防止消灭
                    'pirate_buccaneer_move', // 海盗：被消灭时移动到其他基地
                    'kitty_cats_hang_in_there', // 猫咪：坚持住移动随从并弃掉本行动
                ];
                const newInteraction =
                    ms.sys.interaction.current ?? ms.sys.interaction.queue[ms.sys.interaction.queue.length - 1];
                const sourceId = (newInteraction?.data as any)?.sourceId as string | undefined;
                const isPreventDestroy = sourceId ? PREVENT_DESTROY_SOURCE_IDS.includes(sourceId) : false;
                if (isPreventDestroy) {
                    isPendingSave = true;
                    pendingSaveMinionUids.add(minionUid);
                }
            }
        }

        // === Phase 2: 只有确认消灭（无防止/无返回/无移走）时才触发 onDestroy ===
        // 当 isPendingSave 时，Phase 1 的 saveEvents 中包含了所有 onMinionDestroyed 触发器的事件
        // （包括吸血鬼伯爵/投机主义等加指示物事件），这些必须被抑制——
        // 因为消灭尚未确认，等交互解决后再决定是否触发。
        // 只保留 matchState 变更（交互创建），丢弃所有副作用事件。
        //
        // 当 hasSaveEvent 时，消灭被替代/改写（回手牌 / 移动走 / 放回牌库顶/底），
        // 同样需要抑制其他触发器的副作用事件，但保留替代效果事件本身。
        const localEvents: SmashUpEvent[] = isPendingSave
            ? []
            : hasSaveEvent
              ? saveEvents.filter(
                    (e) =>
                        e.type === SU_EVENTS.MINION_RETURNED ||
                        (e.type === SU_EVENTS.MINION_MOVED &&
                            (e as MinionMovedEvent).payload.minionUid === minionUid) ||
                        ((e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) &&
                            (e as any).payload?.cardUid === minionUid),
                )
              : [...saveEvents];
        if (!isPendingSave && !hasSaveEvent) {
            const phase2State = ms ?? currentState;
            const phase2Core = phase2State.core;
            const sourceEventId = `minion-destroyed:${minionUid}:${fromBaseIndex}:${now}`;
            const frameId = `minion-destroyed-frame:${minionUid}:${fromBaseIndex}:${now}`;
            if (base) {
                const needsBatchDedup = base.defId === 'base_the_field_of_honor' || base.defId === 'base_crypt';
                const batchKey = `${base.defId}::${fromBaseIndex}::${destroyerId}::${reason ?? ''}`;
                if (!needsBatchDedup || !baseDestroyBatchSeen.has(batchKey)) {
                    if (needsBatchDedup) {
                        baseDestroyBatchSeen.add(batchKey);
                    }
                    const queuedBaseDestroyReaction = collectExtendedBaseAbilityTriggers({
                        core: phase2Core,
                        timing: 'onMinionDestroyed',
                        ownerPlayerId: ownerId,
                        baseIndex: fromBaseIndex,
                        triggerMinionUid: minionUid,
                        triggerMinionDefId: minionDefId,
                        triggerMinionPower,
                        destroyerId,
                        controllerId: triggerPlayerId,
                        reason: de.payload.reason,
                        frameId,
                        sourceEventId,
                        now,
                    });
                    if (queuedBaseDestroyReaction) {
                        localEvents.push(queuedBaseDestroyReaction);
                    }
                }
            }
            // reaction-phase triggers for onMinionDestroyed are queued and resolved later (Wiki simultaneous ordering)
            const queuedDestroyReactions = collectTriggers(phase2Core, 'onMinionDestroyed', {
                state: phase2Core,
                matchState: phase2State,
                playerId: triggerPlayerId,
                baseIndex: fromBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                triggerMinion,
                triggerMinionPower,
                controllerId: triggerPlayerId,
                destroyerId,
                reason: de.payload.reason,
                frameId,
                sourceEventId,
                random,
                now,
            });
            if (queuedDestroyReactions) {
                localEvents.push(queuedDestroyReactions);
            }
            const didEnterOwnerDiscard = doesDestroyedMinionEnterOwnerDiscard(phase2Core, de);
            if (didEnterOwnerDiscard) {
                const discardSourceEventId = `minion-discarded-from-base:${minionUid}:${fromBaseIndex}:${now}`;
                const discardFrameId = `minion-discarded-from-base-frame:${minionUid}:${fromBaseIndex}:${now}`;
                const discardTriggerPlayerId = triggerPlayerId;
                const queuedDiscardReactions = collectTriggers(phase2Core, 'onMinionDiscardedFromBase', {
                    state: phase2Core,
                    matchState: phase2State,
                    playerId: discardTriggerPlayerId,
                    baseIndex: fromBaseIndex,
                    triggerMinionUid: minionUid,
                    triggerMinionDefId: minionDefId,
                    triggerMinion: minion,
                    triggerMinionPower,
                    destroyerId,
                    controllerId: triggerPlayerId,
                    reason: de.payload.reason,
                    frameId: discardFrameId,
                    sourceEventId: discardSourceEventId,
                    random,
                    now,
                });
                if (queuedDiscardReactions) {
                    localEvents.push(queuedDiscardReactions);
                }
            }
            // 1. 触发随从自身的 onDestroy 能力
            const executor = resolveOnDestroy(minionDefId);
            if (executor) {
                const onDestroyPlayerId = triggerPlayerId;
                const ctx: AbilityContext = {
                    state: phase2Core,
                    matchState: phase2State,
                    playerId: onDestroyPlayerId,
                    cardUid: minionUid,
                    defId: minionDefId,
                    baseIndex: fromBaseIndex,
                    random,
                    now,
                };
                const result = executor(ctx);
                localEvents.push(...result.events);
                if (result.matchState) ms = result.matchState;
            }
        }

        const filteredLocal = filterProtectedDestroyEvents(localEvents, (ms ?? currentState).core, destroyerId);
        extraEvents.push(...filteredLocal);

        // 同批次多个 MINION_DESTROYED 需要串行吃到最新手牌/牌库状态，
        // 否则像“双小鬼同时被消灭”会重复抽到同一张牌、重复弃同一张牌，第二次实际落不下去。
        if (filteredLocal.length > 0) {
            const stateBeforeAdvance = ms ?? currentState;
            const advancedCore = filteredLocal.reduce(
                (acc, event) => applyPostProcessPrefixEvent(acc, event),
                stateBeforeAdvance.core,
            );
            if (advancedCore !== stateBeforeAdvance.core) {
                ms = {
                    ...stateBeforeAdvance,
                    core: advancedCore,
                };
            }
        }
    }

    // 记录已处理的消灭事件，防止同一事件在后续流程中重复触发
    if (skipDestroyEventKeys) {
        for (const de of destroyEvents) {
            skipDestroyEventKeys.add(buildDestroyEventKey(de));
        }
    }

    // 需要抑制的随从 uid：已被 replacement 改写去向（回手/移动走/放回牌库）+ 待交互拯救
    const suppressedMinionUids = new Set(
        extraEvents
            .filter((e) => e.type === SU_EVENTS.MINION_RETURNED)
            .map((e) => (e as MinionReturnedEvent).payload.minionUid),
    );
    // 被 MINION_MOVED 移走的随从也视为拯救（如海盗单基地自动移动）
    for (const e of extraEvents) {
        if (e.type === SU_EVENTS.MINION_MOVED) {
            suppressedMinionUids.add((e as MinionMovedEvent).payload.minionUid);
        }
        if (e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) {
            const uid = (e as any).payload?.cardUid as string | undefined;
            if (uid) suppressedMinionUids.add(uid);
        }
    }
    for (const uid of pendingSaveMinionUids) {
        suppressedMinionUids.add(uid);
    }

    const cleanedEvents =
        getSmashUpSettlementPhase() === 'facts' || suppressedMinionUids.size === 0
            ? filteredEvents
            : filteredEvents.filter((e) => {
                  if (e.type !== SU_EVENTS.MINION_DESTROYED) return true;
                  const { minionUid } = (e as MinionDestroyedEvent).payload;
                  return !suppressedMinionUids.has(minionUid);
              });

    const combined = [...cleanedEvents, ...extraEvents];
    const hasImmediateExtraPlay = combined.some(
        (event) =>
            event.type === SU_EVENTS.LIMIT_MODIFIED &&
            (event as any).payload?.playTiming === 'immediate' &&
            ((event as any).payload?.delta ?? 0) > 0,
    );

    // Attempt to auto-resolve reaction queue when possible (single trigger, no ordering prompt).
    let coreForQueue = (ms ?? state).core;
    for (const e of combined) {
        if (e.type === SU_EVENTS.TRIGGER_QUEUED || e.type === SU_EVENTS.TRIGGER_CONSUMED) {
            coreForQueue = applyTriggerQueueFactEvent(coreForQueue, e);
        }
    }
    const baseMS = ms ?? state;
    const msForQueue = coreForQueue === baseMS.core ? baseMS : { ...baseMS, core: coreForQueue };
    if (hasImmediateExtraPlay) {
        return { events: combined, matchState: msForQueue };
    }
    if (!options?.skipReactionQueueResolution) {
        const rq = maybeResolveReactionQueue(msForQueue, random, now);
        if (rq) {
            return { events: [...combined, ...rq.events], matchState: rq.state };
        }
    }

    return { events: combined, matchState: ms };
}

// ============================================================================
// onMove 后处理：扫描 MINION_MOVED 事件，触发 onMinionMoved 拦截器
// ============================================================================

/** 遗留桥接：批量刷新 MINION_MOVED，但 move 保护语义解析已下沉到 shared effect semantics */
export function filterProtectedMoveEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
): SmashUpEvent[] {
    return filterProtectedMinionEvents(events, core, sourcePlayerId, SU_EVENTS.MINION_MOVED);
}

// ============================================================================
// onReturn 保护过滤：扫描 MINION_RETURNED 事件，过滤受保护的随从
// ============================================================================

/**
 * 过滤受保护的随从的返回手牌事件
 *
 * 与 filterProtectedMoveEvents 对齐：
 * - 'move' 保护同时阻止移动和返回手牌（deep_roots / entangled）
 * - 'action' / 'affect' 广义保护也阻止返回手牌（ghost_incorporeal / elder_thing）
 *
 * 注意：tooth_and_claw 通过 interceptor 拦截 MINION_RETURNED（引擎管线层），
 * 此函数处理的是 registerProtection 注册的保护（领域层后处理）。
 */
export function filterProtectedReturnEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
): SmashUpEvent[] {
    return filterProtectedAffectEvents(events, core, sourcePlayerId);
}

// ============================================================================
// onDeckBottom 保护过滤：扫描 CARD_TO_DECK_BOTTOM 事件，过滤受保护的随从
// ============================================================================

/**
 * 过滤受保护的随从的放入牌库底事件
 *
 * CARD_TO_DECK_BOTTOM 没有 fromBaseIndex，需要遍历基地查找随从。
 * 保护检查逻辑与 filterProtectedReturnEvents 对齐：
 * - 'move' 保护阻止（bear_cavalry_superiority 描述含"返回牌库"）
 * - 'action' / 'affect' 广义保护也阻止（ghost_incorporeal / elder_thing 等）
 *
 * 注意：tooth_and_claw 通过 interceptor 拦截 CARD_TO_DECK_BOTTOM（引擎管线层），
 * 此函数处理的是 registerProtection 注册的保护（领域层后处理）。
 * 注意：只过滤场上随从的放牌库底事件，不过滤手牌/弃牌堆的卡牌操作。
 */
export function filterProtectedDeckBottomEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
): SmashUpEvent[] {
    return filterProtectedAffectEvents(events, core, sourcePlayerId);
}

/** 后处理：触发 onMinionMoved 拦截器 */
export function processMoveTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
): PostProcessResult {
    const prepared = prepareSmashUpCandidates(events, state);
    events = prepared.events;
    state = prepared.state;

    const core = state.core;
    // 保护检查：过滤掉受 move 保护的随从的移动事件
    const filteredEvents = filterProtectedMoveEvents(events, core, playerId);
    const moveBatchUidsByBatchId = new Map<string, string[]>();
    for (const event of filteredEvents) {
        if (event.type !== SU_EVENTS.MINION_MOVED) continue;
        const batchId = event.payload.batchId;
        if (!batchId) continue;
        const list = moveBatchUidsByBatchId.get(batchId) ?? [];
        list.push(event.payload.minionUid);
        moveBatchUidsByBatchId.set(batchId, list);
    }

    const moveEvents = filteredEvents.filter((e) => e.type === SU_EVENTS.MINION_MOVED) as MinionMovedEvent[];
    if (moveEvents.length === 0) return { events: filteredEvents };

    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;
    for (const event of filteredEvents) {
        const stateBeforeMove = ms ?? state;
        const coreBeforeMove = stateBeforeMove.core;
        if (isSmashUpEventSettled(event) || event.type !== SU_EVENTS.MINION_MOVED) {
            ms = { ...stateBeforeMove, core: applyPostProcessPrefixEvent(coreBeforeMove, event) };
            continue;
        }
        const me = event as MinionMovedEvent;
        const { minionUid, minionDefId, fromBaseIndex, toBaseIndex, reason } = me.payload;
        const simultaneousMoveBatchMinionUids = me.payload.batchId
            ? moveBatchUidsByBatchId.get(me.payload.batchId)
            : undefined;
        const advancedCore = reduceMinionMovedEvent(coreBeforeMove, me);
        const advancedMatchState = { ...stateBeforeMove, core: advancedCore };
        const sourceEventId = `minion-moved:${minionUid}:${fromBaseIndex}:${toBaseIndex}:${now}`;
        const frameId = `minion-moved-frame:${minionUid}:${fromBaseIndex}:${toBaseIndex}:${now}`;

        // 触发 ongoing 拦截器 onMinionMoved（改为入队，按 Wiki 同时触发排序解决）
        const queued = collectTriggers(advancedCore, 'onMinionMoved', {
            state: advancedCore,
            matchState: advancedMatchState,
            playerId,
            baseIndex: toBaseIndex,
            frameId,
            sourceEventId,
            moveFromBaseIndex: fromBaseIndex,
            moveToBaseIndex: toBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            simultaneousMoveBatchMinionUids,
            random,
            now,
        });
        if (queued) extraEvents.push(queued);

        // 触发“有随从从该基地移走”的 ongoing onMinionMoved（如硕大圆石）
        if (fromBaseIndex !== toBaseIndex) {
            const queuedFromBase = collectTriggers(advancedCore, 'onMinionMoved', {
                state: advancedCore,
                matchState: advancedMatchState,
                playerId,
                baseIndex: fromBaseIndex,
                frameId,
                sourceEventId,
                moveFromBaseIndex: fromBaseIndex,
                moveToBaseIndex: toBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                simultaneousMoveBatchMinionUids,
                random,
                now,
            });
            if (queuedFromBase) extraEvents.push(queuedFromBase);
        }

        // 触发基地扩展时机 onMinionMoved（如牧场：首次移动触发额外移动）
        // 与 ongoing onMinionMoved 一样统一入队，避免混入直执行交互态而绕开 reaction ordering。
        const targetBase = advancedCore.bases[toBaseIndex];
        if (targetBase) {
            const movedMinion = targetBase.minions.find((minion) => minion.uid === minionUid);
            const queuedBase = collectExtendedBaseAbilityTriggers({
                core: advancedCore,
                timing: 'onMinionMoved',
                ownerPlayerId: playerId,
                baseIndex: toBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                triggerMinionPower: movedMinion?.basePower,
                controllerId: movedMinion?.controller,
                reason,
                frameId,
                sourceEventId,
                simultaneousMoveBatchMinionUids,
                now,
            });
            if (queuedBase) {
                extraEvents.push(queuedBase);
            }
        }
        ms = advancedMatchState;
    }

    return ms
        ? { events: [...filteredEvents, ...extraEvents], matchState: ms }
        : { events: [...filteredEvents, ...extraEvents] };
}

/** 后处理：触发 onCardReturnedToHand 拦截器 */
export function processReturnToHandTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    _playerId: PlayerId,
    random: RandomFn,
    now: number,
): PostProcessResult {
    const prepared = prepareSmashUpCandidates(events, state);
    events = prepared.events;
    state = prepared.state;

    const retainedEvents: SmashUpEvent[] = [];
    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;

    const getProcessedReturnToHandEventKeys = (matchState: MatchState<SmashUpCore>): Set<string> => {
        const sysAny = matchState.sys as any;
        if (!(sysAny._processedReturnToHandEvents instanceof Set)) {
            sysAny._processedReturnToHandEvents = new Set<string>();
        }
        return sysAny._processedReturnToHandEvents as Set<string>;
    };

    const buildReturnToHandDedupKey = (event: SmashUpEvent, cardUidOverride?: string): string | undefined => {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const payload = (event as MinionReturnedEvent).payload;
            return [
                event.type,
                payload.minionUid,
                payload.minionDefId,
                payload.fromBaseIndex,
                payload.toPlayerId,
                payload.reason ?? '',
                event.timestamp,
            ].join(':');
        }
        if (event.type === SU_EVENTS.CARD_TRANSFERRED) {
            const payload = (event as CardTransferredEvent).payload;
            return [
                event.type,
                payload.cardUid,
                payload.defId ?? '',
                payload.fromPlayerId,
                payload.toPlayerId,
                payload.reason ?? '',
                event.timestamp,
            ].join(':');
        }
        if (event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD) {
            const payload = (event as CardRecoveredFromDiscardEvent).payload;
            return [event.type, cardUidOverride ?? '', payload.playerId, payload.reason ?? '', event.timestamp].join(
                ':',
            );
        }
        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const payload = (event as any).payload as {
                playerId: PlayerId;
                cardUid: string;
                baseIndex: number;
                reason?: string;
            };
            return [
                event.type,
                payload.cardUid,
                payload.playerId,
                payload.baseIndex,
                payload.reason ?? '',
                event.timestamp,
            ].join(':');
        }
        return undefined;
    };

    const isCardTransferFromPlayOrDiscard = (core: SmashUpCore, event: CardTransferredEvent): boolean => {
        const { cardUid, fromPlayerId } = event.payload;
        const fromDiscard = core.players[fromPlayerId]?.discard.some((card) => card.uid === cardUid) ?? false;
        if (fromDiscard) return true;
        return core.bases.some(
            (base) =>
                base.ongoingActions.some((action) => action.uid === cardUid) ||
                base.minions.some(
                    (minion) =>
                        minion.uid === cardUid || minion.attachedActions.some((action) => action.uid === cardUid),
                ),
        );
    };

    const findRecoveredCardFromDiscard = (
        core: SmashUpCore,
        playerId: PlayerId,
        cardUid: string,
    ): CardInstance | undefined => {
        const discard = core.players[playerId]?.discard ?? [];
        return discard.find((candidate) => candidate.uid === cardUid);
    };

    const findTransferredMinionFromPlayOrDiscard = (
        core: SmashUpCore,
        event: CardTransferredEvent,
    ): CardInstance | undefined => {
        const { cardUid, fromPlayerId } = event.payload;
        const discard = core.players[fromPlayerId]?.discard ?? [];
        const discardedCard = discard.find((card) => card.uid === cardUid);
        if (discardedCard?.type === 'minion') return discardedCard;

        for (const base of core.bases) {
            const minion = base.minions.find((candidate) => candidate.uid === cardUid);
            if (minion) {
                return {
                    uid: minion.uid,
                    defId: minion.defId,
                    type: 'minion',
                    owner: minion.owner,
                };
            }
        }
        const transferRef = getCardTransferObjectRef(event.payload);
        if (transferRef && (transferRef.type === 'minion' || getCardDef(transferRef.defId)?.type === 'minion')) {
            return buildCardInstanceFromObjectRef(transferRef);
        }
        return undefined;
    };

    const findTransferredMinionLkiFromPlay = (
        core: SmashUpCore,
        event: CardTransferredEvent,
    ): { minion: MinionOnBase; baseIndex: number } | undefined => {
        const { cardUid } = event.payload;
        for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
            const minion = core.bases[baseIndex].minions.find(
                (candidate) =>
                    candidate.uid === cardUid || candidate.attachedActions.some((action) => action.uid === cardUid),
            );
            if (minion) {
                return { minion, baseIndex };
            }
        }
        return undefined;
    };

    const findReturnedMinionLkiFromPlay = (
        core: SmashUpCore,
        event: MinionReturnedEvent,
    ): { minion: MinionOnBase; baseIndex: number } | undefined => {
        const { minionUid, fromBaseIndex } = event.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find((candidate) => candidate.uid === minionUid);
        return minion ? { minion, baseIndex: fromBaseIndex } : undefined;
    };

    const findReturnedBuriedMinion = (
        core: SmashUpCore,
        baseIndex: number,
        cardUid: string,
    ): CardInstance | undefined => {
        const buriedCard = core.bases[baseIndex]?.buriedCards?.find((card) => card.uid === cardUid);
        if (!buriedCard) return undefined;
        if (getCardDef(buriedCard.defId)?.type !== 'minion') return undefined;
        return {
            uid: buriedCard.uid,
            defId: buriedCard.defId,
            type: 'minion',
            owner: buriedCard.trueOwnerId,
        };
    };

    const buildReturnToHandFrameMeta = (
        event: SmashUpEvent,
        eventIndex: number,
    ): { frameId: string; sourceEventId: string } => {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const payload = (event as MinionReturnedEvent).payload;
            return {
                sourceEventId: `card-returned-to-hand:${event.type}:${payload.minionUid}:${payload.toPlayerId}:${eventIndex}:${now}`,
                frameId: `card-returned-to-hand-frame:${event.type}:${payload.minionUid}:${payload.toPlayerId}:${eventIndex}:${now}`,
            };
        }
        if (event.type === SU_EVENTS.CARD_TRANSFERRED) {
            const payload = (event as CardTransferredEvent).payload;
            return {
                sourceEventId: `card-returned-to-hand:${event.type}:${payload.cardUid}:${payload.toPlayerId}:${eventIndex}:${now}`,
                frameId: `card-returned-to-hand-frame:${event.type}:${payload.cardUid}:${payload.toPlayerId}:${eventIndex}:${now}`,
            };
        }
        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const payload = (event as any).payload;
            return {
                sourceEventId: `card-returned-to-hand:${event.type}:${payload.cardUid}:${payload.playerId}:${eventIndex}:${now}`,
                frameId: `card-returned-to-hand-frame:${event.type}:${payload.cardUid}:${payload.playerId}:${eventIndex}:${now}`,
            };
        }
        const payload = (event as CardRecoveredFromDiscardEvent).payload;
        const cardUidKey = (payload.cardUids ?? []).join(',');
        return {
            sourceEventId: `card-returned-to-hand:${event.type}:${cardUidKey}:${payload.playerId}:${eventIndex}:${now}`,
            frameId: `card-returned-to-hand-frame:${event.type}:${cardUidKey}:${payload.playerId}:${eventIndex}:${now}`,
        };
    };

    const buildRecoveredCardReturnFrameMeta = (
        payload: CardRecoveredFromDiscardEvent['payload'],
        cardUid: string,
        eventIndex: number,
    ): { frameId: string; sourceEventId: string } => ({
        sourceEventId: `card-returned-to-hand:${SU_EVENTS.CARD_RECOVERED_FROM_DISCARD}:${cardUid}:${payload.playerId}:${eventIndex}:${now}`,
        frameId: `card-returned-to-hand-frame:${SU_EVENTS.CARD_RECOVERED_FROM_DISCARD}:${cardUid}:${payload.playerId}:${eventIndex}:${now}`,
    });

    for (const [eventIndex, event] of events.entries()) {
        const stateBeforeReturn = ms ?? state;
        const coreBeforeReturn = stateBeforeReturn.core;
        if (isSmashUpEventSettled(event)) {
            retainedEvents.push(event);
            ms = { ...stateBeforeReturn, core: applyPostProcessPrefixEvent(coreBeforeReturn, event) };
            continue;
        }
        const processedReturnToHandEventKeys = getProcessedReturnToHandEventKeys(stateBeforeReturn);
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const payload = (event as MinionReturnedEvent).payload;
            const returnedMinionLki = findReturnedMinionLkiFromPlay(coreBeforeReturn, event as MinionReturnedEvent);
            const { frameId, sourceEventId } = buildReturnToHandFrameMeta(event, eventIndex);
            if (!payload.skipReturnReplacement && returnedMinionLki) {
                const replacement = fireTriggers(
                    coreBeforeReturn,
                    'onCardReturnedToHand',
                    {
                        state: coreBeforeReturn,
                        matchState: stateBeforeReturn,
                        playerId: payload.toPlayerId,
                        baseIndex: returnedMinionLki.baseIndex,
                        frameId,
                        sourceEventId,
                        affectEvent: event,
                        triggerMinion: returnedMinionLki.minion,
                        triggerMinionUid: payload.minionUid,
                        triggerMinionDefId: payload.minionDefId,
                        reason: payload.reason,
                        random,
                        now,
                    },
                    { phase: 'replacement' },
                );
                if (
                    replacement.events.length > 0 ||
                    (replacement.matchState && replacement.matchState !== stateBeforeReturn)
                ) {
                    extraEvents.push(...replacement.events);
                    if (replacement.matchState) ms = replacement.matchState;
                    continue;
                }
            }
            const advancedCore = reduceMinionReturnedEvent(coreBeforeReturn, event as MinionReturnedEvent);
            const advancedMatchState = { ...stateBeforeReturn, core: advancedCore };
            const dedupKey = buildReturnToHandDedupKey(event);
            if (dedupKey && processedReturnToHandEventKeys.has(dedupKey)) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            if (dedupKey) {
                markReturnProcessed(processedReturnToHandEventKeys, dedupKey);
            }
            const queued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                state: advancedCore,
                matchState: advancedMatchState,
                playerId: payload.toPlayerId,
                frameId,
                sourceEventId,
                triggerMinion: returnedMinionLki?.minion,
                triggerMinionUid: payload.minionUid,
                triggerMinionDefId: payload.minionDefId,
                reason: payload.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
            if (returnedMinionLki) {
                const queuedBase = collectExtendedBaseAbilityTriggers({
                    core: advancedCore,
                    timing: 'onCardReturnedToHand',
                    ownerPlayerId: payload.toPlayerId,
                    baseIndex: returnedMinionLki.baseIndex,
                    triggerMinionUid: returnedMinionLki.minion.uid,
                    triggerMinionDefId: returnedMinionLki.minion.defId,
                    triggerMinionPower: returnedMinionLki.minion.basePower,
                    controllerId: returnedMinionLki.minion.controller,
                    reason: payload.reason,
                    frameId,
                    sourceEventId,
                    now,
                });
                if (queuedBase) extraEvents.push(queuedBase);
            }
            if (returnedMinionLki) {
                for (const attachedAction of returnedMinionLki.minion.attachedActions) {
                    const attachedControllerId =
                        (
                            attachedAction.metadata as
                                { sourceControllerId?: string; sourcePlayerId?: string } | undefined
                        )?.sourceControllerId ??
                        (
                            attachedAction.metadata as
                                { sourceControllerId?: string; sourcePlayerId?: string } | undefined
                        )?.sourcePlayerId ??
                        attachedAction.ownerId;
                    const attachedQueued = collectTriggers(
                        advancedCore,
                        'onCardReturnedToHand',
                        {
                            state: advancedCore,
                            matchState: advancedMatchState,
                            playerId: payload.toPlayerId,
                            frameId,
                            sourceEventId,
                            sourceCardUid: attachedAction.uid,
                            sourceDefId: attachedAction.defId,
                            sourceBaseIndex: returnedMinionLki.baseIndex,
                            sourceControllerId: attachedControllerId,
                            sourceOwnerPlayerId: attachedAction.ownerId,
                            triggerMinion: returnedMinionLki.minion,
                            triggerMinionUid: returnedMinionLki.minion.uid,
                            triggerMinionDefId: returnedMinionLki.minion.defId,
                            reason: payload.reason,
                            random,
                            now,
                        },
                        { sourceDefIds: [attachedAction.defId] },
                    );
                    if (attachedQueued) extraEvents.push(attachedQueued);
                }
            }
            retainedEvents.push(event);
            ms = advancedMatchState;
            continue;
        }

        if (event.type === SU_EVENTS.CARD_TRANSFERRED) {
            const payload = (event as CardTransferredEvent).payload;
            const transferredMinionLki = findTransferredMinionLkiFromPlay(
                coreBeforeReturn,
                event as CardTransferredEvent,
            );
            const advancedCore = reduceCardTransferredEvent(coreBeforeReturn, event as CardTransferredEvent);
            const advancedMatchState = { ...stateBeforeReturn, core: advancedCore };
            const transferFrameId = `card-transferred-frame:${payload.cardUid}:${payload.fromPlayerId}:${payload.toPlayerId}:${eventIndex}:${now}`;
            const transferSourceEventId = `card-transferred:${payload.cardUid}:${payload.fromPlayerId}:${payload.toPlayerId}:${eventIndex}:${now}`;
            const transferDedupKey = `${SU_EVENTS.CARD_TRANSFERRED}:trigger:${payload.cardUid}:${payload.fromPlayerId}:${payload.toPlayerId}:${payload.reason ?? ''}:${event.timestamp}`;
            if (!processedReturnToHandEventKeys.has(transferDedupKey)) {
                markReturnProcessed(processedReturnToHandEventKeys, transferDedupKey);
                const transferredOwnerId =
                    payload.ownerId ?? getCardTransferObjectRef(payload)?.provenance.ownerId ?? payload.fromPlayerId;
                const queuedTransfer = collectTriggers(advancedCore, 'onCardTransferred', {
                    state: advancedCore,
                    matchState: advancedMatchState,
                    playerId: payload.toPlayerId,
                    frameId: transferFrameId,
                    sourceEventId: transferSourceEventId,
                    transferredCardUid: payload.cardUid,
                    transferredCardDefId: payload.defId,
                    transferredCardOwnerId: transferredOwnerId,
                    transferredFromPlayerId: payload.fromPlayerId,
                    transferredToPlayerId: payload.toPlayerId,
                    triggerCardUid: payload.cardUid,
                    triggerCardDefId: payload.defId,
                    triggerCardOwnerId: transferredOwnerId,
                    reason: payload.reason,
                    random,
                    now,
                });
                if (queuedTransfer) extraEvents.push(queuedTransfer);
            }
            if (!isCardTransferFromPlayOrDiscard(coreBeforeReturn, event as CardTransferredEvent)) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            const dedupKey = buildReturnToHandDedupKey(event);
            if (dedupKey && processedReturnToHandEventKeys.has(dedupKey)) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            if (dedupKey) {
                markReturnProcessed(processedReturnToHandEventKeys, dedupKey);
            }
            const transferredMinion = findTransferredMinionFromPlayOrDiscard(
                coreBeforeReturn,
                event as CardTransferredEvent,
            );
            const { frameId, sourceEventId } = buildReturnToHandFrameMeta(event, eventIndex);
            const queued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                state: advancedCore,
                matchState: advancedMatchState,
                playerId: payload.toPlayerId,
                frameId,
                sourceEventId,
                triggerMinion: transferredMinionLki?.minion,
                triggerMinionUid: transferredMinion?.uid,
                triggerMinionDefId: transferredMinion?.defId,
                reason: payload.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
            if (transferredMinionLki) {
                const queuedBase = collectExtendedBaseAbilityTriggers({
                    core: advancedCore,
                    timing: 'onCardReturnedToHand',
                    ownerPlayerId: payload.toPlayerId,
                    baseIndex: transferredMinionLki.baseIndex,
                    triggerMinionUid: transferredMinionLki.minion.uid,
                    triggerMinionDefId: transferredMinionLki.minion.defId,
                    triggerMinionPower: transferredMinionLki.minion.basePower,
                    controllerId: transferredMinionLki.minion.controller,
                    reason: payload.reason,
                    frameId,
                    sourceEventId,
                    now,
                });
                if (queuedBase) extraEvents.push(queuedBase);
            }
            if (transferredMinionLki && transferredMinionLki.minion.uid === payload.cardUid) {
                for (const attachedAction of transferredMinionLki.minion.attachedActions) {
                    const attachedControllerId =
                        (
                            attachedAction.metadata as
                                { sourceControllerId?: string; sourcePlayerId?: string } | undefined
                        )?.sourceControllerId ??
                        (
                            attachedAction.metadata as
                                { sourceControllerId?: string; sourcePlayerId?: string } | undefined
                        )?.sourcePlayerId ??
                        attachedAction.ownerId;
                    const attachedQueued = collectTriggers(
                        advancedCore,
                        'onCardReturnedToHand',
                        {
                            state: advancedCore,
                            matchState: advancedMatchState,
                            playerId: payload.toPlayerId,
                            frameId,
                            sourceEventId,
                            sourceCardUid: attachedAction.uid,
                            sourceDefId: attachedAction.defId,
                            sourceBaseIndex: transferredMinionLki.baseIndex,
                            sourceControllerId: attachedControllerId,
                            sourceOwnerPlayerId: attachedAction.ownerId,
                            triggerMinion: transferredMinionLki.minion,
                            triggerMinionUid: transferredMinionLki.minion.uid,
                            triggerMinionDefId: transferredMinionLki.minion.defId,
                            reason: payload.reason,
                            random,
                            now,
                        },
                        { sourceDefIds: [attachedAction.defId] },
                    );
                    if (attachedQueued) extraEvents.push(attachedQueued);
                }
            }
            retainedEvents.push(event);
            ms = advancedMatchState;
            continue;
        }

        if (event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD) {
            const payload = (event as CardRecoveredFromDiscardEvent).payload;
            const advancedCore = reduceCardRecoveredFromDiscardEvent(
                coreBeforeReturn,
                event as CardRecoveredFromDiscardEvent,
            );
            const advancedMatchState = { ...stateBeforeReturn, core: advancedCore };
            if ((payload.cardUids?.length ?? 0) === 0) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            for (const cardUid of payload.cardUids ?? []) {
                const dedupKey = buildReturnToHandDedupKey(event, cardUid);
                if (dedupKey && processedReturnToHandEventKeys.has(dedupKey)) {
                    continue;
                }
                if (dedupKey) {
                    markReturnProcessed(processedReturnToHandEventKeys, dedupKey);
                }
                const recoveredCard = findRecoveredCardFromDiscard(coreBeforeReturn, payload.playerId, cardUid);
                const recoveredMinion = recoveredCard?.type === 'minion' ? recoveredCard : undefined;
                const { frameId, sourceEventId } = buildRecoveredCardReturnFrameMeta(payload, cardUid, eventIndex);
                const queued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                    state: advancedCore,
                    matchState: advancedMatchState,
                    playerId: payload.playerId,
                    frameId,
                    sourceEventId,
                    triggerMinionUid: recoveredMinion?.uid,
                    triggerMinionDefId: recoveredMinion?.defId,
                    reason: payload.reason,
                    random,
                    now,
                });
                if (queued) extraEvents.push(queued);
            }
            retainedEvents.push(event);
            ms = advancedMatchState;
            continue;
        }

        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const payload = (event as any).payload as {
                playerId: PlayerId;
                cardUid: string;
                baseIndex: number;
                reason?: string;
            };
            const advancedCore = reduceBuriedCardReturnedToHandEvent(
                coreBeforeReturn,
                event as BuriedCardReturnedToHandEvent,
            );
            const advancedMatchState = { ...stateBeforeReturn, core: advancedCore };
            const dedupKey = buildReturnToHandDedupKey(event);
            if (dedupKey && processedReturnToHandEventKeys.has(dedupKey)) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            if (dedupKey) {
                markReturnProcessed(processedReturnToHandEventKeys, dedupKey);
            }
            const returnedMinion = findReturnedBuriedMinion(coreBeforeReturn, payload.baseIndex, payload.cardUid);
            const { frameId, sourceEventId } = buildReturnToHandFrameMeta(event, eventIndex);
            const queued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                state: advancedCore,
                matchState: advancedMatchState,
                playerId: payload.playerId,
                frameId,
                sourceEventId,
                triggerMinionUid: returnedMinion?.uid,
                triggerMinionDefId: returnedMinion?.defId,
                reason: payload.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
            if (returnedMinion) {
                const queuedBase = collectExtendedBaseAbilityTriggers({
                    core: advancedCore,
                    timing: 'onCardReturnedToHand',
                    ownerPlayerId: payload.playerId,
                    baseIndex: payload.baseIndex,
                    triggerMinionUid: returnedMinion.uid,
                    triggerMinionDefId: returnedMinion.defId,
                    reason: payload.reason,
                    frameId,
                    sourceEventId,
                    now,
                });
                if (queuedBase) extraEvents.push(queuedBase);
            }
            retainedEvents.push(event);
            ms = advancedMatchState;
            continue;
        }

        // 同批次里前置的非回手事件也可能改写 source controller / base 现场。
        // 若这里不顺序推进现场，后续 return carrier 仍会按旧 core 收集 queued trigger。
        retainedEvents.push(event);
        ms = { ...stateBeforeReturn, core: applyPostProcessPrefixEvent(coreBeforeReturn, event) };
    }

    if (extraEvents.length > 0) {
        return { events: [...retainedEvents, ...extraEvents], matchState: ms };
    }
    return ms ? { events: retainedEvents, matchState: ms } : { events: retainedEvents };
}

// ============================================================================
// destroy→move 循环：move 触发器可能产生新的 MINION_DESTROYED（如制高点/幼熊斥候），
// 需要回馈给 processDestroyTriggers 处理（如海盗被消灭时移动到其他基地）。
// 循环直到 move 不再产生新的 MINION_DESTROYED 事件为止。
// ============================================================================

/**
 * 循环执行 destroy→move 直到稳定（move 不再产生新的 MINION_DESTROYED）
 *
 * 典型场景：黑熊骑兵移动海盗到制高点基地 → 制高点消灭海盗 → 海盗 onDestroyed 触发移动
 */
export function processDestroyMoveCycle(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    options?: { skipDestroyEventKeys?: Set<string>; skipReactionQueueResolution?: boolean },
): PostProcessResult {
    let currentEvents = events;
    let ms: MatchState<SmashUpCore> | undefined;

    const destroySysAny = state.sys as any;
    if (!destroySysAny._processedDestroyEvents || !(destroySysAny._processedDestroyEvents instanceof Set)) {
        destroySysAny._processedDestroyEvents = new Set<string>();
    }
    const processedDestroyEventKeys = (options?.skipDestroyEventKeys ??
        destroySysAny._processedDestroyEvents) as Set<string>;
    const mergedOptions = { ...(options ?? {}), skipDestroyEventKeys: processedDestroyEventKeys };

    // 跟踪已处理的 MINION_DESTROYED 事件（防止重复处理）
    const processedDestroyUids = new Set<string>();

    // 第一轮：正常的 destroy → move
    // 记录第一轮处理的所有 MINION_DESTROYED 事件
    for (const e of currentEvents) {
        if (e.type === SU_EVENTS.MINION_DESTROYED) {
            const uid = (e as MinionDestroyedEvent).payload.minionUid;
            processedDestroyUids.add(uid);
        }
    }

    const afterDestroy = processDestroyTriggers(currentEvents, ms ?? state, playerId, random, now, mergedOptions);
    if (afterDestroy.matchState) ms = afterDestroy.matchState;
    const afterMove = processMoveTriggers(afterDestroy.events, ms ?? state, playerId, random, now);
    if (afterMove.matchState) ms = afterMove.matchState;
    currentEvents = afterMove.events;

    // 检查 move 是否产生了新的 MINION_DESTROYED 事件（不在已处理集合中的）
    let newDestroyEvents = currentEvents.filter(
        (e) =>
            e.type === SU_EVENTS.MINION_DESTROYED &&
            !processedDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid),
    ) as SmashUpEvent[];

    // 循环处理新产生的 MINION_DESTROYED（最多 5 轮防止无限循环）
    let iteration = 0;
    while (newDestroyEvents.length > 0 && iteration < 5) {
        iteration++;

        // 将新事件加入已处理集合
        for (const e of newDestroyEvents) {
            const uid = (e as MinionDestroyedEvent).payload.minionUid;
            processedDestroyUids.add(uid);
        }

        // 只对新的 MINION_DESTROYED 事件运行 destroy 触发器
        const extraDestroy = processDestroyTriggers(
            newDestroyEvents,
            ms ?? state,
            playerId,
            random,
            now,
            mergedOptions,
        );
        if (extraDestroy.matchState) ms = extraDestroy.matchState;

        // 替换原事件中的新 MINION_DESTROYED 为处理后的结果
        // （processDestroyTriggers 可能过滤掉被拯救的随从、添加 MINION_RETURNED/MINION_MOVED 等）
        const newDestroyUids = new Set(newDestroyEvents.map((e) => (e as MinionDestroyedEvent).payload.minionUid));
        const eventsWithoutNewDestroy = currentEvents.filter(
            (e) =>
                !(
                    e.type === SU_EVENTS.MINION_DESTROYED &&
                    newDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid)
                ),
        );
        currentEvents = [...eventsWithoutNewDestroy, ...extraDestroy.events];

        // 对 extraDestroy 产生的 MINION_MOVED 事件运行 move 触发器
        const extraMoveEvents = extraDestroy.events.filter((e) => e.type === SU_EVENTS.MINION_MOVED);
        if (extraMoveEvents.length > 0) {
            const extraMove = processMoveTriggers(extraDestroy.events, ms ?? state, playerId, random, now);
            if (extraMove.matchState) ms = extraMove.matchState;
            // 替换 extraDestroy.events 部分为 extraMove 结果
            const eventsWithoutExtra = currentEvents.filter((e) => !extraDestroy.events.includes(e));
            currentEvents = [...eventsWithoutExtra, ...extraMove.events];

            // 检查是否又产生了新的 MINION_DESTROYED（不在已处理集合中的）
            newDestroyEvents = extraMove.events.filter(
                (e) =>
                    e.type === SU_EVENTS.MINION_DESTROYED &&
                    !processedDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid),
            );
        } else {
            break;
        }
    }

    return { events: currentEvents, matchState: ms };
}

// ============================================================================
// onAffected 后处理：扫描"影响"类事件，触发 onMinionAffected
// 影响 = 消灭 | 移动 | 负力量修改 | 附着对手行动卡
// ============================================================================

/** 后处理：触发 onMinionAffected（聚合时机） */
export function processAffectTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    options?: { skipAffectEventKeys?: Set<string> },
): PostProcessResult {
    const prepared = prepareSmashUpCandidates(events, state);
    events = prepared.events;
    state = prepared.state;

    const retainedEvents: SmashUpEvent[] = [];
    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;

    const skipEnsignRedirect = (event: SmashUpEvent): boolean =>
        ((event as { payload?: { skipEnsignRedirect?: boolean } }).payload?.skipEnsignRedirect ?? false) === true;

    eventLoop: for (const [eventIndex, event] of events.entries()) {
        const stateBeforeAffect = ms ?? state;
        const coreBeforeAffect = stateBeforeAffect.core;
        if (isSmashUpEventSettled(event)) {
            retainedEvents.push(event);
            ms = { ...stateBeforeAffect, core: applyPostProcessPrefixEvent(coreBeforeAffect, event) };
            continue;
        }
        const affectRecords = buildAffectRecords(coreBeforeAffect, event, playerId);
        const affectBatchTargets = affectRecords
            .filter(
                (record) => record.countsForOnMinionAffected && record.triggerMinion && record.baseIndex !== undefined,
            )
            .map((record) => ({
                minionUid: record.triggerMinionUid ?? record.triggerMinion!.uid,
                baseIndex: record.baseIndex!,
                controllerId: record.triggerMinion!.controller,
            }));
        for (const [recordIndex, record] of affectRecords.entries()) {
            if (
                record.affectType === 'destroy' &&
                (record.targetKind === 'ongoing' || record.targetKind === 'attached_action') &&
                record.triggerCardUid &&
                record.triggerCardDefId &&
                record.triggerCardOwnerId
            ) {
                const sourceEventId = `card-destroyed:${event.type}:${record.triggerCardUid}:${record.affectType}:${record.baseIndex ?? 'none'}:${eventIndex}:${recordIndex}:${now}`;
                const frameId = `card-destroyed-frame:${event.type}:${record.triggerCardUid}:${record.affectType}:${record.baseIndex ?? 'none'}:${eventIndex}:${recordIndex}:${now}`;
                const queuedCardDestroyed = collectTriggers(coreBeforeAffect, 'onCardDestroyed', {
                    state: coreBeforeAffect,
                    matchState: stateBeforeAffect,
                    playerId: record.sourcePlayerId ?? playerId,
                    baseIndex: record.baseIndex,
                    frameId,
                    sourceEventId,
                    sourceCardUid: record.sourceCardUid,
                    sourceDefId: record.sourceDefId,
                    sourceBaseIndex: record.sourceBaseIndex,
                    sourceControllerId: record.sourceControllerId,
                    sourceOwnerPlayerId: record.sourceOwnerPlayerId,
                    triggerCardUid: record.triggerCardUid,
                    triggerCardDefId: record.triggerCardDefId,
                    triggerCardOwnerId: record.triggerCardOwnerId,
                    triggerCardKind: record.triggerCardKind,
                    destroyerId: record.sourcePlayerId ?? playerId,
                    affectType: record.affectType,
                    affectEvent: event,
                    reason: record.reason,
                    random,
                    now,
                });
                if (queuedCardDestroyed) extraEvents.push(queuedCardDestroyed);
            }

            if (!record.countsForOnMinionAffected || !record.triggerMinion || record.baseIndex === undefined) continue;
            if (options?.skipAffectEventKeys?.has(buildAffectRecordEventKey(event, record, recordIndex))) continue;
            const sourceEventId = `minion-affected:${event.type}:${record.triggerMinionUid}:${record.affectType}:${record.baseIndex}:${eventIndex}:${recordIndex}:${now}`;
            const frameId = `minion-affected-frame:${event.type}:${record.triggerMinionUid}:${record.affectType}:${record.baseIndex}:${eventIndex}:${recordIndex}:${now}`;

            if (!skipEnsignRedirect(event)) {
                const replacement = fireTriggers(
                    coreBeforeAffect,
                    'onMinionAffected',
                    {
                        state: coreBeforeAffect,
                        matchState: stateBeforeAffect,
                        playerId: record.sourcePlayerId ?? playerId,
                        baseIndex: record.baseIndex,
                        frameId,
                        sourceEventId,
                        sourceCardUid: record.sourceCardUid,
                        sourceDefId: record.sourceDefId,
                        sourceBaseIndex: record.sourceBaseIndex,
                        sourceControllerId: record.sourceControllerId,
                        sourceOwnerPlayerId: record.sourceOwnerPlayerId,
                        triggerMinionUid: record.triggerMinionUid,
                        triggerMinionDefId: record.triggerMinionDefId,
                        triggerMinion: record.triggerMinion,
                        controllerId: record.triggerMinion.controller,
                        affectType: record.affectType,
                        counterChangeKind: record.counterChangeKind,
                        counterDelta: record.counterDelta,
                        affectEvent: event,
                        affectBatchTargets,
                        reason: record.reason,
                        random,
                        now,
                    },
                    { phase: 'replacement' },
                );
                if (
                    replacement.events.length > 0 ||
                    (replacement.matchState && replacement.matchState !== stateBeforeAffect)
                ) {
                    extraEvents.push(...replacement.events);
                    if (replacement.matchState) ms = replacement.matchState;
                    continue eventLoop;
                }
            }

            const queued = collectTriggers(coreBeforeAffect, 'onMinionAffected', {
                state: coreBeforeAffect,
                matchState: stateBeforeAffect,
                playerId: record.sourcePlayerId ?? playerId,
                baseIndex: record.baseIndex,
                frameId,
                sourceEventId,
                sourceCardUid: record.sourceCardUid,
                sourceDefId: record.sourceDefId,
                sourceBaseIndex: record.sourceBaseIndex,
                sourceControllerId: record.sourceControllerId,
                sourceOwnerPlayerId: record.sourceOwnerPlayerId,
                triggerMinionUid: record.triggerMinionUid,
                triggerMinionDefId: record.triggerMinionDefId,
                triggerMinion: record.triggerMinion,
                controllerId: record.triggerMinion.controller,
                affectType: record.affectType,
                counterChangeKind: record.counterChangeKind,
                counterDelta: record.counterDelta,
                affectEvent: event,
                affectBatchTargets,
                reason: record.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);

            const queuedBase = collectExtendedBaseAbilityTriggers({
                core: coreBeforeAffect,
                timing: 'onMinionAffected',
                ownerPlayerId: record.sourcePlayerId ?? playerId,
                baseIndex: record.baseIndex,
                triggerMinionUid: record.triggerMinionUid,
                triggerMinionDefId: record.triggerMinionDefId,
                triggerMinionPower: record.triggerMinion.basePower,
                controllerId: record.triggerMinion.controller,
                reason: record.reason,
                actionTargetBaseIndex: record.baseIndex,
                actionTargetType: 'minion',
                actionTargetMinionUid: record.triggerMinionUid,
                frameId,
                sourceEventId,
                now,
            });
            if (queuedBase) extraEvents.push(queuedBase);
        }

        const advancedCore = applyPostProcessPrefixEvent(coreBeforeAffect, event);
        if (advancedCore !== coreBeforeAffect) {
            ms = {
                ...stateBeforeAffect,
                core: advancedCore,
            };
        }
        retainedEvents.push(event);
    }

    if (extraEvents.length === 0) return ms ? { events: retainedEvents, matchState: ms } : { events: retainedEvents };
    return { events: [...retainedEvents, ...extraEvents], matchState: ms };
}

// ============================================================================
// onDeckInspected 后处理：扫描牌库查看事件，触发 onDeckInspected
// ============================================================================

export function processDeckInspectionTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
): PostProcessResult {
    const prepared = prepareSmashUpCandidates(events, state);
    events = prepared.events;
    state = prepared.state;

    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;

    for (const [eventIndex, evt] of events.entries()) {
        const stateBeforeInspection = ms ?? state;
        const coreBeforeInspection = stateBeforeInspection.core;
        if (
            isSmashUpEventSettled(evt) ||
            (evt.type !== SU_EVENTS.REVEAL_HAND &&
                evt.type !== SU_EVENTS.REVEAL_DECK_TOP &&
                evt.type !== SU_EVENTS.DECK_INSPECTED)
        ) {
            ms = { ...stateBeforeInspection, core: applyPostProcessPrefixEvent(coreBeforeInspection, evt) };
            continue;
        }

        const isReveal = evt.type === SU_EVENTS.REVEAL_HAND || evt.type === SU_EVENTS.REVEAL_DECK_TOP;
        const payload = (evt as RevealHandEvent | RevealDeckTopEvent | DeckInspectedEvent).payload as any;
        const targetPlayerIds = Array.isArray(payload.targetPlayerId)
            ? payload.targetPlayerId
            : [payload.targetPlayerId];
        const inspectionZone = isReveal ? (evt.type === SU_EVENTS.REVEAL_HAND ? 'hand' : 'deck') : 'deck';
        const inspectionCausePlayerId = (isReveal ? payload.sourcePlayerId : payload.inspectorPlayerId) ?? playerId;
        const sourceEventId = `deck-inspected:${evt.type}:${inspectionZone}:${targetPlayerIds.join(',')}:${eventIndex}:${now}`;
        const frameId = `deck-inspected-frame:${evt.type}:${inspectionZone}:${targetPlayerIds.join(',')}:${eventIndex}:${now}`;
        const advancedCore = reduceDeckInspectionFactEvent(
            coreBeforeInspection,
            evt as RevealHandEvent | RevealDeckTopEvent | DeckInspectedEvent,
        );
        const advancedMatchState = { ...stateBeforeInspection, core: advancedCore };

        const queued = collectTriggers(advancedCore, 'onDeckInspected', {
            state: advancedCore,
            matchState: advancedMatchState,
            playerId: inspectionCausePlayerId,
            frameId,
            sourceEventId,
            inspectionCards: isReveal ? payload.cards : [],
            inspectionZone,
            inspectionTargetPlayerIds: targetPlayerIds,
            inspectionCausePlayerId,
            random,
            now,
        });

        if (queued) extraEvents.push(queued);
        for (const [baseIndex] of advancedCore.bases.entries()) {
            const queuedBase = collectExtendedBaseAbilityTriggers({
                core: advancedCore,
                timing: 'onDeckInspected',
                ownerPlayerId: inspectionCausePlayerId,
                baseIndex,
                reason: payload.reason,
                frameId,
                sourceEventId,
                now,
            });
            if (queuedBase) extraEvents.push(queuedBase);
        }
        ms = advancedMatchState;
    }

    if (extraEvents.length === 0) return ms ? { events, matchState: ms } : { events };
    return { events: [...events, ...extraEvents], matchState: ms };
}

function collectTriggers(...args: Parameters<typeof collectRuleTriggers>): ReturnType<typeof collectRuleTriggers> {
    return getSmashUpSettlementPhase() === 'prepare' ? undefined : collectRuleTriggers(...args);
}
function collectExtendedBaseAbilityTriggers(
    ...args: Parameters<typeof collectRuleBaseTriggers>
): ReturnType<typeof collectRuleBaseTriggers> {
    return getSmashUpSettlementPhase() === 'prepare' ? undefined : collectRuleBaseTriggers(...args);
}
function resolveOnDestroy(...args: Parameters<typeof resolveRuleOnDestroy>): ReturnType<typeof resolveRuleOnDestroy> {
    return getSmashUpSettlementPhase() === 'prepare' ? undefined : resolveRuleOnDestroy(...args);
}
function maybeResolveReactionQueue(
    ...args: Parameters<typeof maybeResolveRuleQueue>
): ReturnType<typeof maybeResolveRuleQueue> {
    return getSmashUpSettlementPhase() === 'prepare' ? undefined : maybeResolveRuleQueue(...args);
}
function fireTriggers(...args: Parameters<typeof fireRuleTriggers>): ReturnType<typeof fireRuleTriggers> {
    return getSmashUpSettlementPhase() === 'facts' && args[3]?.phase === 'replacement'
        ? { events: [] }
        : fireRuleTriggers(...args);
}
function markReturnProcessed(set: Set<string>, key: string): void {
    if (getSmashUpSettlementPhase() !== 'prepare') set.add(key);
}
