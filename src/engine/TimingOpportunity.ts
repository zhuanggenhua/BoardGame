import type {
    ChoiceRequest,
    ChoiceRequestAiSupport,
    ChoiceRequestCandidate,
    ChoiceRequestKind,
    ChoiceRequestRecoveryAction,
    ChoiceRequestResolution,
    ChoiceRequestSelectionBounds,
    ChoiceRequestSkipPolicy,
} from './ChoiceRequest';
import { validateChoiceRequest } from './ChoiceRequest';
import type { AiActionMetadata, AiCommandSpec } from './ai/types';
import type {
    Command,
    DomainCore,
    EventCommitArgs,
    EventCommitEvidence,
    GameEvent,
    MatchState,
    PlayerId,
    ResolutionFrame,
    ResolutionOrdering,
    ResponseWindowState,
} from './types';

export type TimingPointPosition =
    | 'before'
    | 'replace'
    | 'prevent'
    | 'after'
    | 'postCommit'
    | 'phaseStart'
    | 'phaseEnd'
    | string;

export type TimingFactKind =
    | 'command'
    | 'event'
    | 'phase'
    | 'action'
    | 'damage'
    | 'scoring'
    | 'attack'
    | 'move'
    | 'payment'
    | 'draw'
    | 'discard'
    | 'cleanup'
    | 'gameover'
    | string;

export type TimingSourceKind =
    | 'card'
    | 'ability'
    | 'token'
    | 'status'
    | 'rule'
    | 'scene'
    | 'command'
    | 'event'
    | 'system'
    | string;

export type TimingVisibility =
    | { scope: 'public' }
    | { scope: 'private'; playerIds: PlayerId[] }
    | { scope: 'controller' };

export interface TimingSourceRef {
    kind: TimingSourceKind;
    id: string;
    ownerId?: PlayerId;
    controllerId?: PlayerId;
    zoneId?: string;
    metadata?: Record<string, unknown>;
}

export interface TimingPoint<TCommand extends Command = Command, TEvent extends GameEvent = GameEvent> {
    id: string;
    gameId?: string;
    position: TimingPointPosition;
    factKind: TimingFactKind;
    source?: TimingSourceRef;
    controllerId?: PlayerId;
    affectedPlayerIds?: PlayerId[];
    command?: TCommand;
    event?: TEvent;
    eventBatchId?: string;
    parentFrameId?: string;
    visibility?: TimingVisibility;
    timestamp?: number;
    metadata?: Record<string, unknown>;
}

export type OpportunityClass =
    | 'mandatory'
    | 'optional'
    | 'response'
    | 'replacement'
    | 'prevention'
    | 'continuous'
    | 'delayed';

export interface OpportunityCondition {
    satisfied: boolean;
    reason?: string;
}

export interface OpportunityCost {
    kind: string;
    description?: string;
    paid?: boolean;
    refundable?: boolean;
    metadata?: Record<string, unknown>;
}

export interface OpportunityTargetRequest {
    kind: ChoiceRequestKind | string;
    min: number;
    max: number;
    ordered?: boolean;
    description?: string;
    metadata?: Record<string, unknown>;
}

export type OpportunityResolution =
    | {
        type: 'none';
    }
    | {
        type: 'commands';
        commands: AiCommandSpec[];
    }
    | {
        type: 'events';
        events: GameEvent[];
    }
    | {
        type: 'choice-request';
    }
    | {
        type: 'response-window';
        windowType: string;
        responderQueue: PlayerId[];
        loopUntilAllPass?: boolean;
        requiredInteractionId?: string;
    }
    | {
        type: 'child-frame';
        frameId?: string;
        frameKind: string;
        ordering?: ResolutionOrdering;
        phase?: string;
        phaseGate?: ResolutionFrame['phaseGate'];
        metadata?: Record<string, unknown>;
    };

export interface OpportunityChoiceContract<TValue = unknown> {
    requestId?: string;
    playerId?: PlayerId;
    kind: ChoiceRequestKind;
    candidates: ChoiceRequestCandidate<TValue>[];
    selection: ChoiceRequestSelectionBounds;
    skipPolicy?: ChoiceRequestSkipPolicy;
    recoveryAction?: ChoiceRequestRecoveryAction;
    resolution: ChoiceRequestResolution<TValue>;
    ai?: ChoiceRequestAiSupport;
    metadata?: AiActionMetadata;
}

export interface Opportunity<TValue = unknown> {
    id: string;
    timing: TimingPoint;
    sourceRef: TimingSourceRef;
    controllerId: PlayerId;
    class: OpportunityClass;
    condition: boolean | OpportunityCondition;
    cost?: OpportunityCost;
    targetRequest?: OpportunityTargetRequest;
    resolution: OpportunityResolution;
    ordering?: ResolutionOrdering;
    visibility?: TimingVisibility;
    aiSupport?: ChoiceRequestAiSupport;
    choice?: OpportunityChoiceContract<TValue>;
    metadata?: AiActionMetadata;
}

export interface TimingOpportunityDiscoveryArgs<
    TCore = unknown,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
> {
    state: MatchState<TCore>;
    timing: TimingPoint<TCommand, TEvent>;
    events?: TEvent[];
    command?: TCommand;
}

export interface TimingOpportunityDiscoveryResult<TValue = unknown> {
    opportunities: Opportunity<TValue>[];
}

export interface DiscoverTimingOpportunitiesOptions {
    playerId?: PlayerId;
    activeOnly?: boolean;
    sorted?: boolean;
}

export interface DiscoverTimingOpportunitiesResult<TValue = unknown> {
    opportunities: Opportunity<TValue>[];
    diagnostics: OpportunityDiagnostic[];
}

export type OpportunityDiagnosticSeverity = 'error' | 'warning';

export type OpportunityDiagnosticCode =
    | 'missing-opportunity-id'
    | 'missing-timing-id'
    | 'missing-source-ref'
    | 'missing-controller'
    | 'inactive-opportunity'
    | 'choice-resolution-without-choice'
    | 'response-without-window'
    | 'response-window-without-responders'
    | 'input-without-choice-or-response'
    | 'invalid-choice-request';

export interface OpportunityDiagnostic {
    severity: OpportunityDiagnosticSeverity;
    code: OpportunityDiagnosticCode;
    message: string;
}

export type EventCommitOpportunityClass = Extract<OpportunityClass, 'replacement' | 'prevention'>;

export type EventCommitFactKindResolver<TEvent extends GameEvent = GameEvent> =
    | TimingFactKind
    | ((event: TEvent, position: TimingPointPosition) => TimingFactKind);

export type EventCommitOpportunityPlanResult<TEvent extends GameEvent = GameEvent> =
    | TEvent
    | TEvent[]
    | { events: TEvent[]; appliedOpportunityIds?: string[] }
    | null
    | undefined;

export interface EventCommitOpportunityPlanComposerArgs<
    TCore = unknown,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
    TValue = unknown,
> {
    state: MatchState<TCore>;
    event: TEvent;
    command?: TCommand;
    timing: TimingPoint<TCommand, TEvent>;
    opportunities: Opportunity<TValue>[];
    diagnostics: OpportunityDiagnostic[];
}

export type EventCommitOpportunityPlanComposer<
    TCore = unknown,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
    TValue = unknown,
> = (
    args: EventCommitOpportunityPlanComposerArgs<TCore, TCommand, TEvent, TValue>
) => EventCommitOpportunityPlanResult<TEvent>;

export interface CommitEventWithTimingOpportunitiesOptions<
    TCore = unknown,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
    TValue = unknown,
> {
    positions?: TimingPointPosition[];
    factKind?: EventCommitFactKindResolver<TEvent>;
    /**
     * 游戏层显式提交计划。通用层仍负责发现、过滤、排序和校验机会；
     * composer 只负责把这些机会合成最终要正式归约的事件批。
     */
    composeEventCommitPlan?: EventCommitOpportunityPlanComposer<TCore, TCommand, TEvent, TValue>;
    /**
     * 多个 replacement/prevention 同时改写同一个事件时，默认要求游戏层显式提交计划。
     * 只有游戏已经证明这些事件 resolution 可安全并列提交时才打开。
     */
    allowMultipleEventResolutions?: boolean;
}

export interface CommitEventWithTimingOpportunitiesResult<
    TEvent extends GameEvent = GameEvent,
    TValue = unknown,
> {
    events: TEvent[];
    opportunities: Opportunity<TValue>[];
    diagnostics: OpportunityDiagnostic[];
    appliedOpportunityIds: string[];
    evidence?: EventCommitEvidence;
}

export function createTimingPoint<TCommand extends Command = Command, TEvent extends GameEvent = GameEvent>(
    input: Omit<TimingPoint<TCommand, TEvent>, 'id'> & { id?: string },
): TimingPoint<TCommand, TEvent> {
    const sourcePart = input.source?.id ?? input.event?.type ?? input.command?.type ?? input.factKind;
    const timestampPart = input.timestamp ?? input.event?.timestamp ?? input.command?.timestamp ?? 'no-ts';
    return {
        ...input,
        id: input.id ?? `${input.position}:${input.factKind}:${sourcePart}:${timestampPart}`,
    };
}

export function normalizeOpportunityCondition(condition: boolean | OpportunityCondition): OpportunityCondition {
    if (typeof condition === 'boolean') {
        return { satisfied: condition };
    }
    return condition;
}

export function isOpportunityActive(opportunity: Opportunity): boolean {
    return normalizeOpportunityCondition(opportunity.condition).satisfied;
}

export function isTimingVisibleToPlayer(
    visibility: TimingVisibility | undefined,
    controllerId: PlayerId | undefined,
    playerId: PlayerId,
): boolean {
    if (!visibility || visibility.scope === 'public') return true;
    if (visibility.scope === 'controller') return controllerId === playerId;
    return visibility.playerIds.includes(playerId);
}

export function isOpportunityVisibleToPlayer(
    opportunity: Opportunity,
    playerId: PlayerId,
): boolean {
    return isTimingVisibleToPlayer(
        opportunity.visibility ?? opportunity.timing.visibility,
        opportunity.controllerId,
        playerId,
    );
}

export function filterOpportunitiesForPlayer<TValue>(
    opportunities: Opportunity<TValue>[],
    playerId: PlayerId,
): Opportunity<TValue>[] {
    return opportunities.filter((opportunity) => isOpportunityVisibleToPlayer(opportunity, playerId));
}

export function getActiveOpportunities<TValue>(opportunities: Opportunity<TValue>[]): Opportunity<TValue>[] {
    return opportunities.filter(isOpportunityActive);
}

export function sortOpportunities<TValue>(opportunities: Opportunity<TValue>[]): Opportunity<TValue>[] {
    return [...opportunities].sort((left, right) => {
        const leftPriority = typeof left.metadata?.priority === 'number' ? left.metadata.priority : 0;
        const rightPriority = typeof right.metadata?.priority === 'number' ? right.metadata.priority : 0;
        if (leftPriority !== rightPriority) return rightPriority - leftPriority;
        return left.id.localeCompare(right.id);
    });
}

export function validateOpportunity<TValue>(opportunity: Opportunity<TValue>): OpportunityDiagnostic[] {
    const diagnostics: OpportunityDiagnostic[] = [];

    if (!opportunity.id.trim()) {
        diagnostics.push({
            severity: 'error',
            code: 'missing-opportunity-id',
            message: 'Opportunity 缺少稳定 id',
        });
    }
    if (!opportunity.timing?.id?.trim()) {
        diagnostics.push({
            severity: 'error',
            code: 'missing-timing-id',
            message: 'Opportunity 缺少来源 TimingPoint',
        });
    }
    if (!opportunity.sourceRef?.id?.trim() || !opportunity.sourceRef.kind?.trim()) {
        diagnostics.push({
            severity: 'error',
            code: 'missing-source-ref',
            message: 'Opportunity 缺少来源对象或来源类型',
        });
    }
    if (!opportunity.controllerId?.trim()) {
        diagnostics.push({
            severity: 'error',
            code: 'missing-controller',
            message: 'Opportunity 缺少控制者 controllerId',
        });
    }

    const condition = normalizeOpportunityCondition(opportunity.condition);
    if (!condition.satisfied) {
        diagnostics.push({
            severity: 'warning',
            code: 'inactive-opportunity',
            message: condition.reason
                ? `Opportunity 当前不成立：${condition.reason}`
                : 'Opportunity 当前条件不成立',
        });
    }

    if (opportunity.resolution.type === 'choice-request' && !opportunity.choice) {
        diagnostics.push({
            severity: 'error',
            code: 'choice-resolution-without-choice',
            message: 'Opportunity 声明需要 ChoiceRequest，但缺少 choice 合同',
        });
    }
    if (opportunity.class === 'response' && opportunity.resolution.type !== 'response-window') {
        diagnostics.push({
            severity: 'warning',
            code: 'response-without-window',
            message: '响应类 Opportunity 应显式声明 response-window resolution',
        });
    }
    if (opportunity.resolution.type === 'response-window' && opportunity.resolution.responderQueue.length === 0) {
        diagnostics.push({
            severity: 'error',
            code: 'response-window-without-responders',
            message: 'Opportunity 声明响应窗口，但响应者队列为空',
        });
    }
    if (opportunity.targetRequest && opportunity.resolution.type !== 'choice-request' && opportunity.resolution.type !== 'response-window') {
        diagnostics.push({
            severity: 'error',
            code: 'input-without-choice-or-response',
            message: 'Opportunity 有目标请求，但没有接到 ChoiceRequest 或 response window',
        });
    }

    if (opportunity.choice) {
        const choice = buildChoiceRequestFromOpportunity(opportunity);
        const choiceDiagnostics = validateChoiceRequest(choice).filter((diagnostic) => diagnostic.severity === 'error');
        for (const diagnostic of choiceDiagnostics) {
            diagnostics.push({
                severity: 'error',
                code: 'invalid-choice-request',
                message: diagnostic.message,
            });
        }
    }

    return diagnostics;
}

export function buildChoiceRequestFromOpportunity<TValue>(
    opportunity: Opportunity<TValue>,
): ChoiceRequest<TValue> {
    if (!opportunity.choice) {
        throw new Error(`Opportunity ${opportunity.id} 缺少 choice 合同`);
    }

    return {
        requestId: opportunity.choice.requestId ?? opportunity.id,
        gameId: opportunity.timing.gameId,
        playerId: opportunity.choice.playerId ?? opportunity.controllerId,
        ownerFrameId: opportunity.timing.parentFrameId,
        kind: opportunity.choice.kind,
        sourceId: opportunity.sourceRef.id,
        candidates: opportunity.choice.candidates,
        selection: opportunity.choice.selection,
        skipPolicy: opportunity.choice.skipPolicy,
        recoveryAction: opportunity.choice.recoveryAction,
        resolution: opportunity.choice.resolution,
        ai: opportunity.choice.ai ?? opportunity.aiSupport,
        metadata: {
            opportunityId: opportunity.id,
            timingPointId: opportunity.timing.id,
            opportunityClass: opportunity.class,
            ...(opportunity.metadata ?? {}),
            ...(opportunity.choice.metadata ?? {}),
        },
    };
}

export function buildResponseWindowFromOpportunity(
    opportunity: Opportunity,
): ResponseWindowState['current'] {
    if (opportunity.resolution.type !== 'response-window') {
        throw new Error(`Opportunity ${opportunity.id} 不是 response-window resolution`);
    }
    if (opportunity.resolution.responderQueue.length === 0) {
        return undefined;
    }

    return {
        id: opportunity.id,
        windowType: opportunity.resolution.windowType,
        sourceId: opportunity.sourceRef.id,
        responderQueue: [...opportunity.resolution.responderQueue],
        currentResponderIndex: 0,
        passedPlayers: [],
        ...(opportunity.timing.parentFrameId ? { resolutionFrameId: opportunity.timing.parentFrameId } : {}),
        ...(opportunity.resolution.requiredInteractionId
            ? { requiredInteractionId: opportunity.resolution.requiredInteractionId }
            : {}),
    };
}

export function buildResolutionFrameFromOpportunity(
    opportunity: Opportunity,
): ResolutionFrame {
    if (opportunity.resolution.type !== 'child-frame') {
        throw new Error(`Opportunity ${opportunity.id} 不是 child-frame resolution`);
    }

    return {
        id: opportunity.resolution.frameId ?? `${opportunity.id}:frame`,
        kind: opportunity.resolution.frameKind,
        ownerGame: opportunity.timing.gameId,
        ownerSystem: 'timing-opportunity',
        ownerToken: opportunity.id,
        parentFrameId: opportunity.timing.parentFrameId,
        ordering: opportunity.resolution.ordering ?? opportunity.ordering ?? 'explicit',
        status: 'running',
        phase: opportunity.resolution.phase,
        phaseGate: opportunity.resolution.phaseGate,
        metadata: {
            opportunityId: opportunity.id,
            timingPointId: opportunity.timing.id,
            opportunityClass: opportunity.class,
            ...(opportunity.metadata ?? {}),
            ...(opportunity.resolution.metadata ?? {}),
        },
    };
}

export function discoverTimingOpportunities<
    TCore,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
    TValue = unknown,
>(
    domain: DomainCore<TCore, TCommand, TEvent>,
    args: TimingOpportunityDiscoveryArgs<TCore, TCommand, TEvent>,
    options: DiscoverTimingOpportunitiesOptions = {},
): DiscoverTimingOpportunitiesResult<TValue> {
    const raw = domain.discoverTimingOpportunities?.(args) as TimingOpportunityDiscoveryResult<TValue> | undefined;
    let opportunities = raw?.opportunities ?? [];

    if (options.playerId) {
        opportunities = filterOpportunitiesForPlayer(opportunities, options.playerId);
    }
    if (options.activeOnly) {
        opportunities = getActiveOpportunities(opportunities);
    }
    if (options.sorted) {
        opportunities = sortOpportunities(opportunities);
    }

    return {
        opportunities,
        diagnostics: opportunities.flatMap(validateOpportunity),
    };
}

function eventCommitClassForPosition(position: TimingPointPosition): EventCommitOpportunityClass | undefined {
    if (position === 'replace') return 'replacement';
    if (position === 'prevent') return 'prevention';
    return undefined;
}

function isEventCommitOpportunity(opportunity: Opportunity): boolean {
    return opportunity.class === 'replacement' || opportunity.class === 'prevention';
}

function resolveEventCommitFactKind<TEvent extends GameEvent>(
    event: TEvent,
    position: TimingPointPosition,
    factKind: EventCommitFactKindResolver<TEvent> | undefined,
): TimingFactKind {
    if (typeof factKind === 'function') return factKind(event, position);
    return factKind ?? event.type;
}

function normalizeEventCommitOpportunityPlanResult<TEvent extends GameEvent>(
    event: TEvent,
    result: EventCommitOpportunityPlanResult<TEvent>,
): { events: TEvent[]; appliedOpportunityIds?: string[] } {
    if (result === undefined) return { events: [event] };
    if (result === null) return { events: [] };
    if (Array.isArray(result)) return { events: result };
    if ('events' in result) {
        return {
            events: result.events,
            appliedOpportunityIds: result.appliedOpportunityIds,
        };
    }
    return { events: [result] };
}

function createTimingPointForEventCommitOpportunity<
    TCommand extends Command,
    TEvent extends GameEvent,
>(
    args: EventCommitArgs<unknown, TCommand, TEvent>,
    position: TimingPointPosition,
    factKind: TimingFactKind,
): TimingPoint<TCommand, TEvent> {
    return createTimingPoint<TCommand, TEvent>({
        gameId: args.timing.gameId,
        position,
        factKind,
        source: args.timing.source,
        controllerId: args.timing.controllerId,
        affectedPlayerIds: args.timing.affectedPlayerIds,
        command: args.command,
        event: args.event,
        eventBatchId: args.timing.eventBatchId,
        parentFrameId: args.timing.parentFrameId,
        visibility: args.timing.visibility,
        timestamp: args.timing.timestamp ?? args.event.timestamp,
        metadata: {
            ...(args.timing.metadata ?? {}),
            eventCommitTimingPointId: args.timing.id,
        },
    });
}

function assertEventCommitResolutionSafe(opportunity: Opportunity): void {
    if (
        opportunity.resolution.type === 'choice-request'
        || opportunity.resolution.type === 'response-window'
        || opportunity.resolution.type === 'child-frame'
        || opportunity.resolution.type === 'commands'
    ) {
        throw new Error(
            `EventCommit 不能执行 Opportunity ${opportunity.id} 的 ${opportunity.resolution.type} resolution；请改成事件提交计划或由游戏层显式处理`,
        );
    }
}

function createEventCommitEvidence<
    TCommand extends Command,
    TEvent extends GameEvent,
    TValue,
>(
    args: EventCommitArgs<unknown, TCommand, TEvent>,
    opportunities: Opportunity<TValue>[],
    diagnostics: OpportunityDiagnostic[],
    appliedOpportunityIds: string[],
): EventCommitEvidence | undefined {
    if (opportunities.length === 0 && appliedOpportunityIds.length === 0 && diagnostics.length === 0) {
        return undefined;
    }

    return {
        timingPointId: args.timing.id,
        position: args.timing.position,
        factKind: args.timing.factKind,
        originalEventType: args.event.type,
        originalEventTimestamp: args.event.timestamp,
        ...(args.timing.gameId ? { gameId: args.timing.gameId } : {}),
        ...(args.command?.type ? { commandType: args.command.type } : {}),
        ...(args.timing.parentFrameId ? { parentFrameId: args.timing.parentFrameId } : {}),
        opportunityIds: opportunities.map(opportunity => opportunity.id),
        opportunityTimingPointIds: Array.from(new Set(
            opportunities
                .map(opportunity => opportunity.timing.id)
                .filter((timingPointId): timingPointId is string => Boolean(timingPointId)),
        )),
        appliedOpportunityIds: [...appliedOpportunityIds],
        ...(diagnostics.length > 0
            ? {
                diagnostics: diagnostics.map(diagnostic => ({
                    severity: diagnostic.severity,
                    code: diagnostic.code,
                    message: diagnostic.message,
                })),
            }
            : {}),
    };
}

/**
 * 在事件正式归约前发现 replacement/prevention 机会，并执行最小安全提交计划。
 *
 * 默认只解释两种机会：
 * - resolution none：只作为可追溯机会证据，不改写事件。
 * - resolution events：用该机会给出的事件批替代当前事件。
 *
 * 多个机会同时给出 events resolution 时，通用层无法证明顺序和组合语义，
 * 因此默认抛错，要求游戏层提供显式提交计划。
 */
export function commitEventWithTimingOpportunities<
    TCore,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
    TValue = unknown,
>(
    domain: DomainCore<TCore, TCommand, TEvent>,
    args: EventCommitArgs<TCore, TCommand, TEvent>,
    options: CommitEventWithTimingOpportunitiesOptions<TCore, TCommand, TEvent, TValue> = {},
): CommitEventWithTimingOpportunitiesResult<TEvent, TValue> {
    if (!domain.discoverTimingOpportunities) {
        return {
            events: [args.event],
            opportunities: [],
            diagnostics: [],
            appliedOpportunityIds: [],
        };
    }

    const positions = options.positions ?? ['replace', 'prevent'];
    const opportunities: Opportunity<TValue>[] = [];

    for (const position of positions) {
        const timing = createTimingPointForEventCommitOpportunity(
            args as EventCommitArgs<unknown, TCommand, TEvent>,
            position,
            resolveEventCommitFactKind(args.event, position, options.factKind),
        );
        const discovery = discoverTimingOpportunities<TCore, TCommand, TEvent, TValue>(
            domain,
            {
                state: args.state,
                timing,
                events: [args.event],
                command: args.command,
            },
            { activeOnly: true, sorted: true },
        );
        const expectedClass = eventCommitClassForPosition(position);
        opportunities.push(...discovery.opportunities.filter((opportunity) => (
            expectedClass ? opportunity.class === expectedClass : isEventCommitOpportunity(opportunity)
        )));
    }

    const diagnostics = opportunities.flatMap(validateOpportunity);
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
    if (errors.length > 0) {
        throw new Error(errors.map((diagnostic) => diagnostic.message).join('；'));
    }

    for (const opportunity of opportunities) {
        assertEventCommitResolutionSafe(opportunity);
    }

    if (options.composeEventCommitPlan) {
        const plan = normalizeEventCommitOpportunityPlanResult(
            args.event,
            options.composeEventCommitPlan({
                state: args.state,
                event: args.event,
                command: args.command,
                timing: args.timing,
                opportunities,
                diagnostics,
            }),
        );
        const appliedOpportunityIds = plan.appliedOpportunityIds ?? [];
        return {
            events: plan.events,
            opportunities,
            diagnostics,
            appliedOpportunityIds,
            evidence: createEventCommitEvidence(
                args as EventCommitArgs<unknown, TCommand, TEvent>,
                opportunities,
                diagnostics,
                appliedOpportunityIds,
            ),
        };
    }

    const eventResolutionOpportunities = opportunities.filter((opportunity) => (
        opportunity.resolution.type === 'events'
    ));
    if (eventResolutionOpportunities.length === 0) {
        return {
            events: [args.event],
            opportunities,
            diagnostics,
            appliedOpportunityIds: [],
            evidence: createEventCommitEvidence(
                args as EventCommitArgs<unknown, TCommand, TEvent>,
                opportunities,
                diagnostics,
                [],
            ),
        };
    }
    if (eventResolutionOpportunities.length > 1 && !options.allowMultipleEventResolutions) {
        throw new Error(
            `EventCommit 发现多个 replacement/prevention events resolution：${eventResolutionOpportunities.map((opportunity) => opportunity.id).join(', ')}；请由游戏层显式合成提交计划`,
        );
    }

    const appliedOpportunityIds = eventResolutionOpportunities.map((opportunity) => opportunity.id);
    return {
        events: eventResolutionOpportunities.flatMap((opportunity) => (
            opportunity.resolution.type === 'events'
                ? opportunity.resolution.events as TEvent[]
                : []
        )),
        opportunities,
        diagnostics,
        appliedOpportunityIds,
        evidence: createEventCommitEvidence(
            args as EventCommitArgs<unknown, TCommand, TEvent>,
            opportunities,
            diagnostics,
            appliedOpportunityIds,
        ),
    };
}
