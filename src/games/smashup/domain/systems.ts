/**
 * 大杀四方 - 专用事件处理系统
 * 
 * 处理领域事件到系统状态的映射：
 * - 监听 SYS_INTERACTION_RESOLVED 事件 → 从 sourceId 查找处理函数 → 生成后续领域事件
 * - 对交互解决产生的事件应用保护过滤和触发链（与 execute() 后处理对齐）
 */

import type { GameEvent, MatchState, SystemState } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { createSimpleChoice, INTERACTION_EVENTS, queueInteraction, resolveInteraction } from '../../../engine/systems/InteractionSystem';
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
    getDeferredPostScoringEvents,
    isScoringSessionAwaitingDeferredResolution,
    updateScoringSession,
} from './scoringSession';
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

        if (matchedSave) {
            continue;
        }

        if (matchedDestroy) {
            const timestamp = typeof matchedDestroy.timestamp === 'number' ? matchedDestroy.timestamp : fallbackTimestamp;
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
// ============================================================================

function isSameInteractionDataSnapshot(
    currentData: unknown,
    payloadData: unknown,
): boolean {
    if (currentData === payloadData) return true;
    try {
        return JSON.stringify(currentData) === JSON.stringify(payloadData);
    } catch {
        return false;
    }
}

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
                    scoringSession?.currentStep === 'awaiting-post-reduce'
                        ? {
                            ...scoringSession,
                            currentStep: 'idle',
                        }
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
                                const currentInteractionDataBefore = newState.sys.interaction?.current?.data;

                                let emittedEvents = [...result.events] as SmashUpEvent[];

                                newState = result.state;

                                const currentInteractionIdAfter = newState.sys.interaction?.current?.id;
                                const shouldResolveCurrentInteraction = Boolean(currentInteractionIdBefore)
                                    && payload.interactionId === currentInteractionIdBefore
                                    && isSameInteractionDataSnapshot(currentInteractionDataBefore, payload.interactionData)
                                    && currentInteractionIdAfter === currentInteractionIdBefore;

                                // 当一次响应已被接收并产出后续链路时，需弹出当前交互，
                                // 否则会出现“新交互入队但界面仍停留在旧交互”的卡死现象。
                                if (shouldResolveCurrentInteraction) {
                                    newState = resolveInteraction(newState);
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

                                const producedMinionPlayed = emittedEvents.some(
                                    (resultEvent) => resultEvent.type === SU_EVENT_TYPES.MINION_PLAYED,
                                );
                                if (startTurnWindowActive && producedMinionPlayed) {
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
                            const targetMinionUid = (payload.interactionData?.continuationContext as { targetMinionUid?: string } | undefined)?.targetMinionUid;
                            const selected = resolvedValue as { skip?: boolean } | undefined;
                            if (targetMinionUid && !selected?.skip) {
                                const pending = getPendingBodyShopDistributions(newState)
                                    .filter((item) => item.targetMinionUid !== targetMinionUid);
                                newState = setPendingBodyShopDistributions(newState, pending);
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
                                newState = previewState === newState
                                    ? resolved.state
                                    : {
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

            if (!hasPendingDomainEvents && !newState.sys.interaction?.current) {
                const reactionQueueResult = maybeResolveReactionQueue(newState as MatchState<SmashUpCore>, random, latestTimestamp);
                if (reactionQueueResult) {
                    newState = reactionQueueResult.state;
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

            if (newState !== state || nextEvents.length > 0) {
                return {
                    state: newState,
                    events: nextEvents.length > 0 ? nextEvents : undefined,
                };
            }
        },
    };
}
