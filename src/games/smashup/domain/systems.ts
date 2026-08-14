/**
 * 大杀四方 - 专用事件处理系统
 * 
 * 处理领域事件到系统状态的映射：
 * - 监听 SYS_INTERACTION_RESOLVED 事件 → 从 sourceId 查找处理函数 → 生成后续领域事件
 * - 对交互解决产生的事件应用保护过滤和触发链（与 execute() 后处理对齐）
 */

import type { GameEvent, MatchState, SystemState } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { INTERACTION_EVENTS, queueInteraction, resolveInteraction } from '../../../engine/systems/InteractionSystem';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import type {
    SmashUpCore,
    SmashUpEvent,
    SmashUpSystemState,
    MinionDestroyedEvent,
    MinionMovedEvent,
    MinionReturnedEvent,
    CardToDeckBottomEvent,
    CardToDeckTopEvent,
} from './types';
import { getInteractionHandler } from './abilityInteractionHandlers';
import { resolveAbilityRuntimePrompt } from './abilityRuntime';
import { addPowerCounter } from './abilityHelpers';
import { resumePendingBranchingChoiceFrames } from './branchingChoice';
import { SU_EVENT_TYPES } from './events';
import { reduce } from './reduce';
import { maybeResolveReactionQueue } from './reactionQueue';
import { getSmashUpReactionSession, resolveSmashUpReactionChoice } from './reactionSession';
import {
    getDeferredReplacementBaseDefIdFromBaseDeckReorderEvents,
    getDeferredPostScoringEvents,
    getScoringSession,
    isScoringSessionAwaitingDeferredResolution,
    replaceDeferredPostScoringReplacementBase,
    updateScoringSession,
    withScoringSessionProgress,
    isScoringSessionWaitingForPostReduce,
} from './scoringSession';
import {
    DIRECT_SCORING_DEFERRED_FINALIZE_KEY,
    finalizeCurrentScoringBase,
} from './scoringFinalization';
import { getCardDef } from '../data/cards';
import { createFrankensteinBodyShopDistributionInteraction } from '../abilities/frankenstein';

const BODY_SHOP_PENDING_DISTRIBUTIONS_KEY = '_pendingBodyShopDistributions';

interface BodyShopPendingDistribution {
    playerId: string;
    targetMinionUid: string;
    totalCounters: number;
}

type SmashUpSystemState = SystemState & {
    _waitForStartTurnInteractionReduce?: boolean;
    _waitForScoreBasesInteractionReduce?: boolean;
    _smashupStartTurnWindowActive?: boolean;
};

const isMinionDestroyedEvent = (event: GameEvent): event is MinionDestroyedEvent => (
    event.type === SU_EVENT_TYPES.MINION_DESTROYED
);

const isMinionMovedEvent = (event: GameEvent): event is MinionMovedEvent => (
    event.type === SU_EVENT_TYPES.MINION_MOVED
);

const isMinionReturnedEvent = (event: GameEvent): event is MinionReturnedEvent => (
    event.type === SU_EVENT_TYPES.MINION_RETURNED
);

const isCardToDeckBottomEvent = (event: GameEvent): event is CardToDeckBottomEvent => (
    event.type === SU_EVENT_TYPES.CARD_TO_DECK_BOTTOM
);

const isCardToDeckTopEvent = (event: GameEvent): event is CardToDeckTopEvent => (
    event.type === SU_EVENT_TYPES.CARD_TO_DECK_TOP
);

function getPendingBodyShopDistributions(state: { sys: Record<string, unknown> }): BodyShopPendingDistribution[] {
    const raw = state.sys[BODY_SHOP_PENDING_DISTRIBUTIONS_KEY];
    return Array.isArray(raw) ? raw as BodyShopPendingDistribution[] : [];
}

function setPendingBodyShopDistributions(
    state: MatchState<SmashUpCore>,
    items: BodyShopPendingDistribution[],
): MatchState<SmashUpCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            [BODY_SHOP_PENDING_DISTRIBUTIONS_KEY]: items.length > 0 ? items : undefined,
        } as typeof state.sys,
    };
}

function buildPreviewStateWithPendingDomainEvents(
    state: MatchState<SmashUpCore>,
    pendingEvents: readonly GameEvent[],
): MatchState<SmashUpCore> {
    const previewEvents = pendingEvents.filter((event): event is SmashUpEvent =>
        !!event
        && typeof event.type === 'string'
        && !event.type.startsWith('SYS_'),
    );
    if (previewEvents.length === 0) {
        return state;
    }

    const previewCore = previewEvents.reduce(
        (core, event) => reduce(core, event),
        state.core,
    );
    if (previewCore === state.core) {
        return state;
    }

    return {
        ...state,
        core: previewCore,
    };
}

function emittedEventsAffectBaseStaticZones(events: readonly SmashUpEvent[]): boolean {
    return events.some((event) => (
        event.type === SU_EVENT_TYPES.ONGOING_ATTACHED
        || event.type === SU_EVENT_TYPES.ONGOING_DETACHED
        || event.type === SU_EVENT_TYPES.CARD_BURIED
        || event.type === SU_EVENT_TYPES.BURIED_CARD_UNCOVERED
        || event.type === SU_EVENT_TYPES.BURIED_CARD_RETURNED_TO_HAND
        || event.type === SU_EVENT_TYPES.BURIED_CARDS_DISCARDED_WITH_BASE
    ));
}

function getPureDeckReorderPlayerIds(events: readonly SmashUpEvent[]): string[] {
    if (events.length === 0 || !events.every((event) => event.type === SU_EVENT_TYPES.DECK_REORDERED)) {
        return [];
    }

    return Array.from(new Set(events
        .map((event) => event.payload?.playerId)
        .filter((playerId): playerId is string => typeof playerId === 'string')));
}

function getPromptResultTriggerQueue(
    resultState: MatchState<SmashUpCore>,
    emittedEvents: readonly SmashUpEvent[],
): SmashUpCore['triggerQueue'] {
    const consumedTriggerIds = new Set(emittedEvents
        .filter((event) => event.type === SU_EVENT_TYPES.TRIGGER_CONSUMED)
        .map((event) => (event.payload as { triggerId?: unknown } | undefined)?.triggerId)
        .filter((triggerId): triggerId is string => typeof triggerId === 'string'));

    if (consumedTriggerIds.size === 0) {
        return resultState.core.triggerQueue;
    }

    const next = (resultState.core.triggerQueue ?? []).filter(
        (trigger) => !consumedTriggerIds.has(trigger.id),
    );
    return next.length > 0 ? next : undefined;
}

function mergePromptResultCoreWithPreEventState(
    resultState: MatchState<SmashUpCore>,
    coreBeforeHandler: SmashUpCore,
    emittedEvents: readonly SmashUpEvent[],
): SmashUpCore {
    const preserveBaseStaticZones = !emittedEventsAffectBaseStaticZones(emittedEvents);
    const pureDeckReorderPlayerIds = getPureDeckReorderPlayerIds(emittedEvents);
    const bases = preserveBaseStaticZones
        ? coreBeforeHandler.bases.map((base, index) => {
            const resultBase = resultState.core.bases[index];
            if (!resultBase) return base;
            return {
                ...base,
                ongoingActions: resultBase.ongoingActions,
                buriedCards: resultBase.buriedCards,
            };
        })
        : coreBeforeHandler.bases;
    const players = pureDeckReorderPlayerIds.length > 0
        ? Object.fromEntries(Object.entries(coreBeforeHandler.players).map(([playerId, player]) => {
            if (!pureDeckReorderPlayerIds.includes(playerId)) {
                return [playerId, player];
            }

            const resultPlayer = resultState.core.players[playerId];
            if (!resultPlayer) {
                return [playerId, player];
            }

            return [playerId, {
                ...player,
                hand: resultPlayer.hand,
                deck: resultPlayer.deck,
            }];
        })) as typeof coreBeforeHandler.players
        : coreBeforeHandler.players;

    return {
        ...coreBeforeHandler,
        bases,
        players,
        // 交互处理器可能会先消费 triggerQueue，再把后续领域事件交给 pipeline 统一 reduce。
        // 这里若沿用 handler 前的 triggerQueue，会把已选择的强制触发还原，导致同一“先结算”弹窗反复出现。
        triggerQueue: getPromptResultTriggerQueue(resultState, emittedEvents),
        timedPowerModifiers: resultState.core.timedPowerModifiers,
    };
}

function materializeBodyShopDistribution(
    state: MatchState<SmashUpCore>,
    pending: BodyShopPendingDistribution,
    timestamp: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const candidates: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex++) {
        for (const minion of state.core.bases[baseIndex].minions) {
            if (minion.controller !== pending.playerId) continue;
            if (minion.uid === pending.targetMinionUid) continue;
            const def = getCardDef(minion.defId);
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: def?.name ?? minion.defId,
            });
        }
    }

    if (candidates.length === 0) {
        return { state, events: [] };
    }

    if (candidates.length === 1) {
        return {
            state,
            events: [addPowerCounter(candidates[0].uid, candidates[0].baseIndex, pending.totalCounters, 'frankenstein_body_shop', timestamp)],
        };
    }

    return {
        state: queueInteraction(
            state,
            createFrankensteinBodyShopDistributionInteraction(state, pending, timestamp),
        ),
        events: [],
    };
}

function reconcilePendingBodyShopDistributions(
    state: MatchState<SmashUpCore>,
    events: readonly GameEvent[],
    fallbackTimestamp: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const pending = getPendingBodyShopDistributions(state);
    if (pending.length === 0) {
        return { state, events: [] };
    }

    let nextState = state;
    const remaining: BodyShopPendingDistribution[] = [];
    const emitted: SmashUpEvent[] = [];

    for (const item of pending) {
        const matchedDestroy = events.find((event) =>
            isMinionDestroyedEvent(event) && event.payload.minionUid === item.targetMinionUid,
        );
        const matchedSave = events.find((event) => {
            if (isMinionReturnedEvent(event) || isMinionMovedEvent(event)) {
                return event.payload.minionUid === item.targetMinionUid;
            }
            if (isCardToDeckBottomEvent(event) || isCardToDeckTopEvent(event)) {
                return event.payload.cardUid === item.targetMinionUid;
            }
            return false;
        });

        if (matchedDestroy || matchedSave) {
            const matchedTimestamp = matchedDestroy?.timestamp ?? matchedSave?.timestamp;
            const timestamp = typeof matchedTimestamp === 'number' ? matchedTimestamp : fallbackTimestamp;
            const result = materializeBodyShopDistribution(nextState, item, timestamp);
            nextState = result.state;
            emitted.push(...result.events);
            continue;
        }

        remaining.push(item);
    }

    return {
        state: setPendingBodyShopDistributions(nextState, remaining),
        events: emitted,
    };
}

// ============================================================================
// SmashUp 事件处理系统
/**
 * 创建 SmashUp 事件处理系统
 * 
 * 职责：
 * - 监听 SYS_INTERACTION_RESOLVED 事件 → 从 sourceId 查找处理函数 → 生成后续事件
 */
export function createSmashUpEventSystem(): EngineSystem<SmashUpCore> {
    return {
        id: 'smashup-event-system',
        name: '大杀四方事件处理',
        priority: 24, // 必须在 FlowSystem(25) 之前执行，确保交互处理器先于 onAutoContinueCheck 运行
        beforeCommand: ({ state }) => {
            const sys = state.sys as Record<string, unknown>;
            if (!sys._processedDestroyEvents && !sys._processedPlayedEvents && !sys._processedTitanPositionEvents) {
                return;
            }
            return {
                state: {
                    ...state,
                    sys: {
                        ...state.sys,
                        _processedDestroyEvents: undefined,
                        _processedPlayedEvents: undefined,
                        _processedTitanPositionEvents: undefined,
                        _processedImmediateExtraEvents: undefined,
                    } as typeof state.sys,
                },
            };
        },

        afterEvents: ({ state, events, random }): HookResult<SmashUpCore> | void => {
            let newState = state;
            const nextEvents: GameEvent[] = [];
            const pendingStartTurnInteractionReduceFlag = '_waitForStartTurnInteractionReduce';
            const pendingScoreBasesInteractionReduceFlag = '_waitForScoreBasesInteractionReduce';
            const pendingReduceFlag = '_waitForPostScoringReduce';
            let latestTimestamp = 0;
            let reactionChoiceResolved = false;
            const handledReactionWindowIds = new Set<string>();
            const normalizeCancelledValue = (
                raw: unknown,
                reason: unknown,
                interactionData?: Record<string, unknown>,
            ): Record<string, unknown> => {
                const optionSeed = Array.isArray(interactionData?.options)
                    ? interactionData.options.find((option) => {
                        if (!option || typeof option !== 'object') return false;
                        const candidate = option as Record<string, unknown>;
                        return candidate.disabled !== true
                            && candidate.value
                            && typeof candidate.value === 'object'
                            && (
                                (candidate.value as Record<string, unknown>).skip
                                || (candidate.value as Record<string, unknown>).done
                                || (candidate.value as Record<string, unknown>).cancel
                                || (candidate.value as Record<string, unknown>).__cancel__
                                || (candidate.value as Record<string, unknown>).__emergency_skip__
                            );
                    })
                    : undefined;
                const normalized: Record<string, unknown> =
                    raw && typeof raw === 'object'
                        ? { ...(raw as Record<string, unknown>) }
                        : optionSeed && typeof optionSeed === 'object' && (optionSeed as Record<string, unknown>).value && typeof (optionSeed as Record<string, unknown>).value === 'object'
                            ? { ...((optionSeed as { value: Record<string, unknown> }).value) }
                            : {};
                if (typeof reason === 'string' && normalized.__emergency_skip_reason__ === undefined) {
                    normalized.__emergency_skip_reason__ = reason;
                }
                if (normalized.__emergency_skip__ === undefined && typeof reason === 'string') {
                    normalized.__emergency_skip__ = true;
                }
                normalized.__cancel__ = true;
                normalized.skip = true;
                return normalized;
            };

            // 同一轮 afterEvents 中，后续系统看不到本轮新发出事件的 reduce 结果。
            // 上一轮如果刚补发了 BASE_CLEARED / BASE_REPLACED，需要先等 pipeline 在轮末完成 reduce，
            // 本轮开始时再清掉阻塞标记，允许 FlowSystem 继续自动推进。
            if ((newState.sys as any)[pendingReduceFlag]) {
                newState = updateScoringSession(newState, (scoringSession) => (
                    isScoringSessionWaitingForPostReduce(scoringSession)
                        ? withScoringSessionProgress(scoringSession, 'select-base')
                        : scoringSession
                ));
                newState = {
                    ...newState,
                    sys: {
                        ...newState.sys,
                        [pendingReduceFlag]: undefined,
                    } as typeof newState.sys,
                };
            }

            if ((newState.sys as any)[pendingStartTurnInteractionReduceFlag]) {
                newState = {
                    ...newState,
                    sys: {
                        ...newState.sys,
                        [pendingStartTurnInteractionReduceFlag]: undefined,
                    } as typeof newState.sys,
                };
            }

            if ((newState.sys as any)[pendingScoreBasesInteractionReduceFlag]) {
                newState = {
                    ...newState,
                    sys: {
                        ...newState.sys,
                        [pendingScoreBasesInteractionReduceFlag]: undefined,
                    } as typeof newState.sys,
                };
            }

            for (const event of events) {
                const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
                latestTimestamp = Math.max(latestTimestamp, eventTimestamp);

                // 监听 SYS_INTERACTION_RESOLVED / SYS_INTERACTION_CANCELLED → 从 sourceId 查找处理函数 → 生成后续事件
                if (event.type === INTERACTION_EVENTS.RESOLVED || event.type === INTERACTION_EVENTS.CANCELLED) {
                    const isCancelled = event.type === INTERACTION_EVENTS.CANCELLED;
                    const payload = event.payload as {
                        interactionId: string;
                        playerId: string;
                        optionId: string | null;
                        value: unknown;
                        sourceId?: string;
                        interactionData?: Record<string, unknown>;
                        reason?: unknown;
                    };
                    const resolvedValue = isCancelled
                        ? payload.sourceId === 'smashup_reaction_choose'
                            ? {
                                kind: 'pass',
                                __cancel__: true,
                                skip: true,
                                ...(typeof payload.reason === 'string'
                                    ? { __emergency_skip_reason__: payload.reason }
                                    : {}),
                            }
                            : normalizeCancelledValue(payload.value, payload.reason, payload.interactionData)
                        : payload.value;
                    if (payload.sourceId === 'smashup_reaction_choose') {
                        reactionChoiceResolved = true;
                    }

                    if (payload.sourceId) {
                        const runtimeResult = resolveAbilityRuntimePrompt(
                            newState,
                            payload.playerId,
                            resolvedValue,
                            payload.interactionData,
                            random,
                            eventTimestamp,
                        );
                        const handler = runtimeResult ? undefined : getInteractionHandler(payload.sourceId);
                        if (runtimeResult || handler) {
                            const activeSys = newState.sys as SmashUpSystemState;
                            const startTurnWindowActive =
                                newState.sys.phase === 'startTurn'
                                || Boolean(activeSys._smashupStartTurnWindowActive);

                            const result = runtimeResult ?? handler!(
                                newState,
                                payload.playerId,
                                resolvedValue,
                                payload.interactionData,
                                random,
                                eventTimestamp,
                            );

                            if (result) {
                                // 记录 handler 前的交互快照，用于判断“当前交互是否需要弹出”
                                const currentInteractionIdBefore = newState.sys.interaction?.current?.id;
                                const coreBeforeHandler = newState.core;

                                const emittedEvents = [...result.events] as SmashUpEvent[];

                                newState = payload.sourceId === 'smashup_reaction_choose'
                                    ? emittedEvents.length === 0
                                        ? result.state
                                        : {
                                            ...result.state,
                                            core: mergePromptResultCoreWithPreEventState(result.state, coreBeforeHandler, emittedEvents),
                                        }
                                    : runtimeResult && emittedEvents.length > 0
                                        ? {
                                            ...result.state,
                                            core: mergePromptResultCoreWithPreEventState(result.state, coreBeforeHandler, emittedEvents),
                                        }
                                        : result.state;

                                const currentInteractionIdAfter = newState.sys.interaction?.current?.id;
                                const shouldResolveCurrentInteraction = Boolean(currentInteractionIdBefore)
                                    && payload.interactionId === currentInteractionIdBefore
                                    && currentInteractionIdAfter === currentInteractionIdBefore;

                                // 当一次响应已被接收并产出后续链路时，需弹出当前交互，
                                // 否则会出现“新交互入队但界面仍停留在旧交互”的卡死现象。
                                if (shouldResolveCurrentInteraction) {
                                    newState = resolveInteraction(newState);
                                }

                                const replacementBaseDefId = getDeferredReplacementBaseDefIdFromBaseDeckReorderEvents(emittedEvents);
                                if (replacementBaseDefId) {
                                    newState = replaceDeferredPostScoringReplacementBase(newState, replacementBaseDefId);
                                }

                                // 注意：afterEvents 轮产生的领域事件会在 pipeline.runAfterEventsRounds 中
                                // 统一调用 postProcessSystemEvents 处理（包含 trigger/保护/去重逻辑）。
                                // 此处不再手动调用，避免重复触发（D41/D45）。

                                // 交互处理器返回的领域事件需要先经过与 execute() 同步的后处理，
                                // 再统一交给 pipeline.reduceEventsToCore 做一次拦截与 reduce。
                                // 这里不能手动先调用 interceptEvent，否则像 Cthulhu 这类
                                // “交互返回 MADNESS_DRAWN，再由拦截器补标记”的链路会被重复处理。
                                nextEvents.push(...emittedEvents);

                                const producedDomainEvents = emittedEvents.some(
                                    (resultEvent) => typeof resultEvent.type === 'string' && !resultEvent.type.startsWith('SYS_'),
                                );
                                // 只有本轮真的产出了待 reduce 的领域事件时，才需要阻断 scoreBases 自动推进。
                                // 纯 state 变更（例如 multi_base_scoring 选基地、afterScoring 把后续动作写入 deferred frame）
                                // 必须允许 FlowSystem 在同一轮基于最新 sys 继续推进，否则会停在 scoreBases。
                                if (newState.sys.phase === 'scoreBases' && producedDomainEvents) {
                                    // 某些计分阶段交互（如海盗王确认移动）会先产出领域事件，再回到
                                    // smashup 的统一反应队列继续处理 Me First!/afterScoring。
                                    // 这时真实 core 还没 reduce 当前 emittedEvents，若直接等待下一轮
                                    // auto-continue，可能会把计分前反应窗漏掉。先用预览 core 补跑一次
                                    // reaction queue，只同步 sys/交互变化，事件仍留给后续统一 reduce。
                                    if (payload.sourceId !== 'smashup_reaction_choose' && !newState.sys.interaction?.current) {
                                        const previewState = buildPreviewStateWithPendingDomainEvents(
                                            newState as MatchState<SmashUpCore>,
                                            nextEvents,
                                        );
                                        const reactionQueueResult = maybeResolveReactionQueue(
                                            previewState,
                                            random,
                                            latestTimestamp,
                                        );
                                        if (reactionQueueResult) {
                                            newState = {
                                                ...reactionQueueResult.state,
                                                core: newState.core,
                                            };
                                            nextEvents.push(...reactionQueueResult.events as GameEvent[]);
                                        }
                                    }
                                    newState = {
                                        ...newState,
                                        sys: {
                                            ...newState.sys,
                                            [pendingScoreBasesInteractionReduceFlag]: true,
                                        } as typeof newState.sys,
                                    };
                                }

                                // 补发延迟的 BASE_CLEARED/BASE_REPLACED 事件
                                // afterScoring 基地能力创建交互时，清除事件被延迟到交互解决后发出，
                                // 确保 targetType: 'minion' 的场上点选交互能看到随从
                                const deferred = getDeferredPostScoringEvents(newState, payload.interactionData) as
                                    | { type: string; payload: unknown; timestamp: number }[]
                                    | undefined;
                                if (deferred && deferred.length > 0) {
                                    if (!isScoringSessionAwaitingDeferredResolution(newState)) {
                                        throw new Error('SmashUp deferred post-scoring payload 丢失 scoreBases frame 所有权');
                                    }
                                    // session-first 计分链会在 scoreBases onPhaseExit 里统一补发 deferred。
                                    newState = {
                                        ...newState,
                                        sys: {
                                            ...newState.sys,
                                            flowHalted: true,
                                            [pendingScoreBasesInteractionReduceFlag]: producedDomainEvents ? true : undefined,
                                        } as typeof newState.sys,
                                    };
                                    continue;
                                }

                                if (startTurnWindowActive && producedDomainEvents) {
                                    newState = {
                                        ...newState,
                                        sys: {
                                            ...newState.sys,
                                            [pendingStartTurnInteractionReduceFlag]: true,
                                        } as typeof newState.sys,
                                    };
                                }
                            }
                        }

                        if (payload.sourceId === 'giant_ant_drone_prevent_destroy') {
                            const selected = resolvedValue as { skip?: boolean } | undefined;
                            if (!selected?.skip) {
                                const pendingItems = getPendingBodyShopDistributions(newState);
                                const remaining: BodyShopPendingDistribution[] = [];

                                for (const item of pendingItems) {
                                    const targetStillOnBoard = newState.core.bases.some((base) =>
                                        base.minions.some((minion) => minion.uid === item.targetMinionUid),
                                    );
                                    if (!targetStillOnBoard) {
                                        remaining.push(item);
                                        continue;
                                    }

                                    const result = materializeBodyShopDistribution(
                                        newState as MatchState<SmashUpCore>,
                                        item,
                                        eventTimestamp,
                                    );
                                    newState = result.state;
                                    if (result.events.length > 0) {
                                        nextEvents.push(...result.events as GameEvent[]);
                                    }
                                }

                                newState = setPendingBodyShopDistributions(
                                    newState as MatchState<SmashUpCore>,
                                    remaining,
                                );
                            }
                        }
                    }
                }

                if (
                    (event.type === RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED
                    || event.type === RESPONSE_WINDOW_EVENTS.CLOSED)
                    && !reactionChoiceResolved
                ) {
                    const payload = event.payload as { windowId?: string };
                    const windowId = payload?.windowId;
                    if (typeof windowId === 'string' && windowId.startsWith('smashup_reaction_window_')) {
                        if (handledReactionWindowIds.has(windowId)) {
                            continue;
                        }
                        handledReactionWindowIds.add(windowId);
                        if (!newState.sys.interaction?.current && (newState.sys.interaction?.queue?.length ?? 0) === 0) {
                            const session = getSmashUpReactionSession(newState as MatchState<SmashUpCore>);
                            if (session) {
                                const previewState = buildPreviewStateWithPendingDomainEvents(
                                    newState as MatchState<SmashUpCore>,
                                    nextEvents,
                                );
                                const resolved = resolveSmashUpReactionChoice(
                                    previewState,
                                    random,
                                    eventTimestamp,
                                    { kind: 'pass' } as any,
                                );
                                newState = {
                                    ...resolved.state,
                                    core: newState.core,
                                };
                                if (resolved.events.length > 0) {
                                    nextEvents.push(...(resolved.events as GameEvent[]));
                                }
                            }
                        }
                    }
                }
            }

            const bodyShopReconcile = reconcilePendingBodyShopDistributions(
                newState as MatchState<SmashUpCore>,
                events,
                latestTimestamp,
            );
            if (bodyShopReconcile.state !== newState) {
                newState = bodyShopReconcile.state;
            }
            if (bodyShopReconcile.events.length > 0) {
                nextEvents.push(...bodyShopReconcile.events as GameEvent[]);
            }

            const hasPendingDomainEvents = nextEvents.length > 0;

            if (!hasPendingDomainEvents && !reactionChoiceResolved && !newState.sys.interaction?.current) {
                const reactionQueueResult = maybeResolveReactionQueue(newState as MatchState<SmashUpCore>, random, latestTimestamp);
                if (reactionQueueResult) {
                    newState = {
                        ...reactionQueueResult.state,
                        core: newState.core,
                    };
                    nextEvents.push(...reactionQueueResult.events as GameEvent[]);
                }
            }

            if (nextEvents.length === 0) {
                const resumedBranchingState = resumePendingBranchingChoiceFrames(
                    newState as MatchState<SmashUpCore>,
                    latestTimestamp,
                );
                if (resumedBranchingState !== newState) {
                    newState = resumedBranchingState;
                }
            }

            if (
                nextEvents.length === 0
                && newState.sys.phase !== 'scoreBases'
                && !newState.sys.interaction?.current
                && (newState.sys.interaction?.queue?.length ?? 0) === 0
                && !getSmashUpReactionSession(newState as MatchState<SmashUpCore>)
                && isScoringSessionAwaitingDeferredResolution(newState as MatchState<SmashUpCore>)
                && getScoringSession(newState as MatchState<SmashUpCore>)?.currentBaseRef
                && (getDeferredPostScoringEvents(newState as MatchState<SmashUpCore>)?.length ?? 0) > 0
                && (newState.sys as Record<string, unknown>)[DIRECT_SCORING_DEFERRED_FINALIZE_KEY] === true
            ) {
                const directScoringState = {
                    ...newState,
                    sys: {
                        ...newState.sys,
                        flowHalted: false,
                    },
                } as MatchState<SmashUpCore>;
                const finalized = finalizeCurrentScoringBase(directScoringState, latestTimestamp, random);
                newState = finalized.updatedState;
                nextEvents.push(...finalized.events as GameEvent[]);
            }

            if (newState !== state || nextEvents.length > 0) {
                return {
                    state: newState,
                    events: nextEvents.length > 0 ? nextEvents : undefined,
                };
            }
        },
    };
}
