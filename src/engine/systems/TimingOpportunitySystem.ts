import {
    buildChoiceRequestFromOpportunity,
    buildResolutionFrameFromOpportunity,
    buildResponseWindowFromOpportunity,
    createTimingPoint,
    discoverTimingOpportunities,
    type Opportunity,
    type TimingFactKind,
    type TimingPointPosition,
} from '../TimingOpportunity';
import type { ChoiceRequest } from '../ChoiceRequest';
import type {
    Command,
    DomainCore,
    GameEvent,
    MatchState,
} from '../types';
import type { AiActionMetadata } from '../ai/types';
import {
    createSimpleChoiceFromChoiceRequest,
    type CreateSimpleChoiceFromChoiceRequestOptions,
} from './ChoiceRequestSimpleChoiceAdapter';
import { queueInteraction, type InteractionDescriptor, type SimpleChoiceData } from './InteractionSystem';
import { openResponseWindow } from './ResponseWindowSystem';
import { pushResolutionFrame } from './resolutionStack';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

export interface TimingOpportunitySystemConfig<TValue = unknown, TCore = unknown> {
    /**
     * 事件落地后默认创建的时点位置。replacement/prevention 仍应由游戏在正式落地前主动调用。
     */
    position?: TimingPointPosition | ((event: GameEvent) => TimingPointPosition);
    factKind?: (event: GameEvent) => TimingFactKind;
    includeSystemEvents?: boolean;
    /**
     * ChoiceRequest 投到现有 simple-choice 交互时需要的 UI/交互承载配置。
     * 这里是 adapter 配置，不是 Opportunity 规则真相源。
     */
    choiceRequestOptions?: (
        opportunity: Opportunity<TValue>,
    ) => CreateSimpleChoiceFromChoiceRequestOptions<TValue> | null | undefined;
    /**
     * ChoiceRequest 投到游戏既有专用 interaction 时使用。
     * 用于保留专用 UI / AI / 恢复入口，但规则机会仍由 Opportunity / ChoiceRequest 承载。
     */
    choiceRequestInteraction?: (args: {
        state: MatchState<TCore>;
        opportunity: Opportunity<TValue>;
        choiceRequest: ChoiceRequest<TValue>;
    }) => InteractionDescriptor | null | undefined;
    /**
     * ChoiceRequest interaction 的最终入队 / 原地更新 adapter。
     * 默认使用通用 queueInteraction；需要保留专用 interaction 的替换语义时由游戏层接管。
     */
    queueChoiceInteraction?: (args: {
        state: MatchState<TCore>;
        opportunity: Opportunity<TValue>;
        choiceRequest: ChoiceRequest<TValue>;
        interaction: InteractionDescriptor;
    }) => MatchState<TCore>;
    /**
     * ChoiceRequest 已由本系统实际创建 / 入队后，需要同步追加的领域事件。
     * 用于把“已打开响应窗口”“已请求交互”等证据挂到同一 Opportunity。
     */
    choiceRequestEvents?: (args: {
        state: MatchState<TCore>;
        opportunity: Opportunity<TValue>;
        choiceRequest: ChoiceRequest<TValue>;
        interaction: InteractionDescriptor;
        queuedState: MatchState<TCore>;
    }) => GameEvent[] | undefined;
}

export interface CreateSimpleChoiceFromTimingOpportunityOverrides {
    requestId?: string;
    interactionId?: string;
    metadata?: AiActionMetadata;
}

function resolvePosition(
    event: GameEvent,
    position: TimingOpportunitySystemConfig['position'],
): TimingPointPosition {
    if (typeof position === 'function') return position(event);
    return position ?? 'postCommit';
}

function resolveFactKind(
    event: GameEvent,
    factKind: TimingOpportunitySystemConfig['factKind'],
): TimingFactKind {
    return factKind?.(event) ?? event.type;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

function interactionCarriesOpportunity(
    interaction: InteractionDescriptor<unknown> | undefined,
    opportunityId: string,
): boolean {
    const data = asRecord(interaction?.data);
    const choiceRequest = asRecord(data?.choiceRequest);
    const choiceRequestMetadata = asRecord(choiceRequest?.metadata);
    if (choiceRequestMetadata?.opportunityId === opportunityId) return true;

    const ai = asRecord(data?.ai);
    const decisions = Array.isArray(ai?.decisions) ? ai.decisions : [];
    return decisions.some((decision) => {
        const metadata = asRecord(asRecord(decision)?.metadata);
        return metadata?.opportunityId === opportunityId;
    });
}

function hasQueuedInteraction<TCore>(
    state: MatchState<TCore>,
    interactionId: string,
    opportunityId: string,
): boolean {
    return state.sys.interaction.current?.id === interactionId
        || interactionCarriesOpportunity(state.sys.interaction.current, opportunityId)
        || state.sys.interaction.queue.some((interaction) => (
            interaction.id === interactionId
            || interactionCarriesOpportunity(interaction, opportunityId)
        ));
}

function hasResolutionFrame<TCore>(state: MatchState<TCore>, frameId: string): boolean {
    return state.sys.resolution?.frames?.some((frame) => frame.id === frameId) ?? false;
}

export function createSimpleChoiceFromTimingOpportunity<TValue>(
    opportunity: Opportunity<TValue>,
    options: CreateSimpleChoiceFromChoiceRequestOptions<TValue>,
    overrides: CreateSimpleChoiceFromTimingOpportunityOverrides = {},
): InteractionDescriptor<SimpleChoiceData<TValue>> {
    const choiceRequest = buildChoiceRequestFromOpportunity(opportunity);
    return createSimpleChoiceFromChoiceRequest(
        {
            ...choiceRequest,
            requestId: overrides.requestId ?? choiceRequest.requestId,
            resolution: overrides.interactionId && choiceRequest.resolution.type === 'interaction-response'
                ? {
                    ...choiceRequest.resolution,
                    interactionId: overrides.interactionId,
                }
                : choiceRequest.resolution,
            metadata: {
                ...(choiceRequest.metadata ?? {}),
                ...(overrides.metadata ?? {}),
            },
        },
        options,
    );
}

interface ApplyOpportunityResult<TCore> {
    state: MatchState<TCore>;
    events?: GameEvent[];
}

function applyOpportunity<TCore, TValue>(
    state: MatchState<TCore>,
    opportunity: Opportunity<TValue>,
    config: TimingOpportunitySystemConfig<TValue, TCore>,
): ApplyOpportunityResult<TCore> {
    switch (opportunity.resolution.type) {
        case 'choice-request': {
            const choiceRequest = buildChoiceRequestFromOpportunity(opportunity);
            if (hasQueuedInteraction(state, choiceRequest.requestId, opportunity.id)) return { state };

            const customInteraction = config.choiceRequestInteraction?.({
                state,
                opportunity,
                choiceRequest,
            });
            if (customInteraction) {
                if (hasQueuedInteraction(state, customInteraction.id, opportunity.id)) {
                    if (!config.queueChoiceInteraction) return { state };
                    return {
                        state: config.queueChoiceInteraction({
                            state,
                            opportunity,
                            choiceRequest,
                            interaction: customInteraction,
                        }),
                    };
                }
                const queuedState = config.queueChoiceInteraction?.({
                    state,
                    opportunity,
                    choiceRequest,
                    interaction: customInteraction,
                }) ?? queueInteraction(state, customInteraction);
                return {
                    state: queuedState,
                    events: config.choiceRequestEvents?.({
                        state,
                        opportunity,
                        choiceRequest,
                        interaction: customInteraction,
                        queuedState,
                    }),
                };
            }

            const options = config.choiceRequestOptions?.(opportunity);
            if (!options) {
                throw new Error(`Opportunity ${opportunity.id} 需要 ChoiceRequest adapter 配置`);
            }

            const interaction = createSimpleChoiceFromTimingOpportunity(opportunity, options);
            const queuedState = config.queueChoiceInteraction?.({
                state,
                opportunity,
                choiceRequest,
                interaction,
            }) ?? queueInteraction(state, interaction);
            return {
                state: queuedState,
                events: config.choiceRequestEvents?.({
                    state,
                    opportunity,
                    choiceRequest,
                    interaction,
                    queuedState,
                }),
            };
        }
        case 'response-window': {
            if (state.sys.responseWindow.current?.id === opportunity.id) return { state };
            return {
                state: openResponseWindow(state, buildResponseWindowFromOpportunity(opportunity)),
            };
        }
        case 'child-frame': {
            const frame = buildResolutionFrameFromOpportunity(opportunity);
            if (hasResolutionFrame(state, frame.id)) return { state };
            return {
                state: pushResolutionFrame(state, frame, { suspendParent: true }),
            };
        }
        case 'events':
            return {
                state,
                events: opportunity.resolution.events,
            };
        case 'commands':
            throw new Error(
                `Opportunity ${opportunity.id} 是 commands resolution；TimingOpportunitySystem 不能直接执行命令，请改为 ChoiceRequest 或在游戏层显式处理`,
            );
        case 'none':
            return { state };
        }
}

export function createTimingOpportunitySystem<
    TCore,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
    TValue = unknown,
>(
    domain: DomainCore<TCore, TCommand, TEvent>,
    config: TimingOpportunitySystemConfig<TValue, TCore> = {},
): EngineSystem<TCore> {
    return {
        id: SYSTEM_IDS.TIMING_OPPORTUNITY,
        name: '时点机会系统',
        priority: 30,

        afterEvents: ({ state, events, command, random }): HookResult<TCore> | void => {
            if (!domain.discoverTimingOpportunities || events.length === 0) return;

            let nextState = state;
            const additionalEvents: GameEvent[] = [];
            for (const event of events) {
                if (event.type.startsWith('SYS_') && !config.includeSystemEvents) {
                    continue;
                }

                const timing = createTimingPoint<TCommand, TEvent>({
                    gameId: domain.gameId,
                    position: resolvePosition(event, config.position),
                    factKind: resolveFactKind(event, config.factKind),
                    event: event as TEvent,
                    command: command as TCommand,
                    parentFrameId: nextState.sys.resolution?.activeFrameId,
                    timestamp: event.timestamp,
                });
                const result = discoverTimingOpportunities<TCore, TCommand, TEvent, TValue>(
                    domain,
                    {
                        state: nextState,
                        timing,
                        events: events as TEvent[],
                        command: command as TCommand,
                        random,
                    },
                    { activeOnly: true, sorted: true },
                );
                const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
                if (errors.length > 0) {
                    throw new Error(errors.map((diagnostic) => diagnostic.message).join('；'));
                }

                for (const opportunity of result.opportunities) {
                    const applied = applyOpportunity(nextState, opportunity, config);
                    nextState = applied.state;
                    if (applied.events?.length) {
                        additionalEvents.push(...applied.events);
                    }
                }
            }

            if (nextState === state && additionalEvents.length === 0) return;
            return {
                state: nextState,
                events: additionalEvents.length > 0 ? additionalEvents : undefined,
            };
        },
    };
}
