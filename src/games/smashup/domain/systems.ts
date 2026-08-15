/**
 * 大杀四方 - 专用事件处理系统
 * 
 * 处理领域事件到系统状态的映射：
 * - 监听 SYS_INTERACTION_RESOLVED 事件 → 从 sourceId 查找处理函数 → 生成后续领域事件
 * - 对交互解决产生的事件应用保护过滤和触发链（与 execute() 后处理对齐）
 */

import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { INTERACTION_EVENTS, queueInteraction, resolveInteraction } from '../../../engine/systems/InteractionSystem';
import type {
    SmashUpCore,
    SmashUpEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    MinionReturnedEvent,
    CardToDeckBottomEvent,
    CardToDeckTopEvent,
} from './types';
import { getInteractionHandler } from './abilityInteractionHandlers';
import {
    isAbilityRuntimeContinuationEvent,
    resolveAbilityRuntimePrompt,
    resumeAbilityRuntimeContinuationEvent,
} from './abilityRuntime';
import { addPowerCounter } from './abilityHelpers';
import { resumePendingBranchingChoiceFrames } from './branchingChoice';
import { SU_EVENT_TYPES } from './events';
import { maybeResolveReactionQueueSuspendingDomainEvents } from './reactionQueue';
import {
    buildReactionOptions,
    getSmashUpReactionSession,
    resolveSmashUpReactionPassRequest,
} from './reactionSession';
import {
    getDeferredReplacementBaseDefIdFromBaseDeckReorderEvents,
    getScoringSession,
    replaceDeferredPostScoringReplacementBase,
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

function resolveReactionSessionPass(args: {
    state: MatchState<SmashUpCore>;
    random: RandomFn;
    timestamp: number;
}): { state: MatchState<SmashUpCore>; events: GameEvent[] } | null {
    const session = getSmashUpReactionSession(args.state);
    if (!session) return null;

    const resolved = resolveSmashUpReactionPassRequest(
        args.state,
        args.random,
        args.timestamp,
    );
    return {
        state: resolved.state,
        events: resolved.events as GameEvent[],
    };
}

function shouldHoldExplicitOptionalPassSession(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    timestamp: number,
): boolean {
    const session = getSmashUpReactionSession(state);
    if (!session || session.phase !== 'optional') return false;
    if ((session.passedPlayerIds?.length ?? 0) === 0) return false;

    const nonPassOptions = buildReactionOptions(state, session, timestamp, random)
        .filter(option => option.id !== 'pass');
    return nonPassOptions.length === 0;
}

function hasDomainEvents(events: readonly GameEvent[]): boolean {
    return events.some((event) => typeof event.type === 'string' && !event.type.startsWith('SYS_'));
}

function assertNoCoreMutationWithDomainEvents(params: {
    sourceId: string;
    coreBeforeHandler: SmashUpCore;
    resultState: MatchState<SmashUpCore>;
    emittedEvents: readonly GameEvent[];
}): void {
    if (!hasDomainEvents(params.emittedEvents)) {
        return;
    }
    if (params.resultState.core === params.coreBeforeHandler) {
        return;
    }
    throw new Error(
        `SmashUp 交互处理器 "${params.sourceId}" 在发出领域事件时同时修改了权威 core；`
        + 'core 改动必须先表达成领域事件，或改成 frame/sys metadata 后再续链。',
    );
}

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
            let latestTimestamp = 0;
            let reactionChoiceResolved = false;
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
            // 计分 session 的 awaiting-post-reduce 表示上一轮已经发出收尾事件；
            // 到本轮 afterEvents 时这些事件已正式落地，可以释放回 idle 继续下一座基地。
            if (getScoringSession(newState as MatchState<SmashUpCore>)?.currentStep === 'awaiting-post-reduce') {
                newState = updateScoringSession(newState, (scoringSession) => (
                    scoringSession?.currentStep === 'awaiting-post-reduce'
                        ? {
                            ...scoringSession,
                            currentStep: 'idle',
                        }
                        : scoringSession
                ));
            }

            for (const event of events) {
                const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
                latestTimestamp = Math.max(latestTimestamp, eventTimestamp);

                if (isAbilityRuntimeContinuationEvent(event)) {
                    const result = resumeAbilityRuntimeContinuationEvent(
                        newState as MatchState<SmashUpCore>,
                        event,
                        random,
                    );

                    if (result) {
                        const coreBeforeHandler = newState.core;
                        const emittedEvents = [...result.events] as GameEvent[];
                        assertNoCoreMutationWithDomainEvents({
                            sourceId: 'smashup_ability_runtime_continuation',
                            coreBeforeHandler,
                            resultState: result.state,
                            emittedEvents,
                        });

                        newState = result.state;
                        nextEvents.push(...emittedEvents);
                    }

                    continue;
                }

                if (event.type === SU_EVENT_TYPES.REACTION_PASS_REQUESTED) {
                    const payload = event.payload as { playerId?: unknown } | undefined;
                    const session = getSmashUpReactionSession(newState as MatchState<SmashUpCore>);
                    if (!session) {
                        throw new Error('SmashUp reaction pass requested without live ReactionSession');
                    }
                    if (payload?.playerId !== session.activePlayerId) {
                        throw new Error('SmashUp reaction pass requested by non-active responder');
                    }

                    const resolvedPass = resolveReactionSessionPass({
                        state: newState as MatchState<SmashUpCore>,
                        random,
                        timestamp: eventTimestamp,
                    });
                    if (resolvedPass) {
                        reactionChoiceResolved = true;
                        newState = resolvedPass.state;
                        if (resolvedPass.events.length > 0) {
                            nextEvents.push(...resolvedPass.events);
                        }
                    }
                    continue;
                }

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
                                assertNoCoreMutationWithDomainEvents({
                                    sourceId: payload.sourceId,
                                    coreBeforeHandler,
                                    resultState: result.state,
                                    emittedEvents,
                                });

                                newState = result.state;

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

            if (
                !hasPendingDomainEvents
                && !reactionChoiceResolved
                && !newState.sys.interaction?.current
                && !shouldHoldExplicitOptionalPassSession(newState as MatchState<SmashUpCore>, random, latestTimestamp)
            ) {
                const reactionQueueResult = maybeResolveReactionQueueSuspendingDomainEvents(
                    newState as MatchState<SmashUpCore>,
                    random,
                    latestTimestamp,
                );
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
